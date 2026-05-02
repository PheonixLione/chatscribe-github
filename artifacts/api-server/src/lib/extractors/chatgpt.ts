import * as cheerio from "cheerio";
import { fetchPage } from "./http";
import { renderPage } from "./headless";
import { htmlToMarkdown } from "./markdown";
import {
  getArray,
  getObject,
  getString,
  isObject,
  walk,
} from "./json";
import {
  ExtractError,
  type ChatMessage,
  type Conversation,
  type SourceDescriptor,
} from "./types";

const SOURCE = "chatgpt" as const;

const isAllowedHost = (u: URL) => {
  const h = u.hostname.toLowerCase();
  return (
    (h === "chatgpt.com" || h === "www.chatgpt.com" || h === "chat.openai.com") &&
    u.pathname.startsWith("/share/")
  );
};

export const chatgpt: SourceDescriptor = {
  source: SOURCE,
  label: "ChatGPT",
  urlPatterns: ["https://chatgpt.com/share/<id>", "https://chat.openai.com/share/<id>"],
  example: "https://chatgpt.com/share/abcd-1234",
  matches(url) {
    return isAllowedHost(url);
  },
  async extract(url) {
    // 1) Static fast path. ChatGPT used to embed the conversation in
    //    `__NEXT_DATA__`, but the share route migrated to React Router and
    //    now ships an empty shell + a turbo-stream payload that needs the
    //    client to hydrate. We still try the legacy parser in case OpenAI
    //    serves the old format on a cached/proxied response.
    let staticErr: ExtractError | null = null;
    try {
      const html = await fetchPage(url.toString(), {
        source: SOURCE,
        isAllowedHost,
      });
      const conv = parseStaticHtml(html, url.toString());
      if (conv) return conv;
    } catch (err) {
      if (err instanceof ExtractError) {
        if (err.code === "not_public" && err.status === 404) throw err;
        staticErr = err;
      }
    }

    // 2) Headless render. Wait for `[data-message-author-role]` — the
    //    same hook the legacy DOM fallback used — to appear after React
    //    hydrates the conversation.
    try {
      const { html } = await renderPage(url.toString(), {
        source: SOURCE,
        timeoutMs: 45_000,
        settleMs: 1500,
        waitFor: {
          fn: `
            var nodes = document.querySelectorAll('[data-message-author-role]');
            if (nodes.length === 0) return false;
            // Make sure at least one node has actual text content (not
            // just the empty hydration shell).
            for (var i = 0; i < nodes.length; i++) {
              if ((nodes[i].textContent || "").trim().length > 0) return true;
            }
            return false;
          `,
        },
      });
      const conv = parseRenderedHtml(html, url.toString());
      if (conv) return conv;
    } catch (err) {
      if (err instanceof ExtractError && err.code === "not_public") throw err;
      // fall through
    }

    if (staticErr) throw staticErr;
    throw new ExtractError(
      "parse_failed",
      "Could not parse the ChatGPT conversation. The share page format may have changed.",
      { source: SOURCE },
    );
  },
};

function parseStaticHtml(html: string, originalUrl: string): Conversation | null {
  const $ = cheerio.load(html);

  const next = $("script#__NEXT_DATA__").first().text();
  if (next) {
    try {
      const data: unknown = JSON.parse(next);
      const conv = findChatGPTConversation(data);
      if (conv) {
        return {
          source: SOURCE,
          sourceLabel: "ChatGPT",
          title: conv.title,
          url: originalUrl,
          messages: conv.messages,
          extractedAt: new Date().toISOString(),
        };
      }
    } catch {
      // fall through
    }
  }

  // Try the rendered-DOM parser as well — useful for fixtures and for
  // any cached SSR snapshots that include hydrated markup.
  return parseRenderedHtml(html, originalUrl);
}

function parseRenderedHtml(html: string, originalUrl: string): Conversation | null {
  const $ = cheerio.load(html);
  const messages: ChatMessage[] = [];

  $("[data-message-author-role]").each((_, el) => {
    const role = $(el).attr("data-message-author-role") || "";
    const inner =
      $(el).find('[data-message-id], .markdown, .prose').first().html() ||
      $(el).html() ||
      "";
    const content = htmlToMarkdown(inner).trim();
    if (!content) return;
    messages.push({
      role:
        role === "user" ? "user" : role === "system" ? "system" : "assistant",
      content,
    });
  });

  if (!messages.length) return null;

  const title = $("title")
    .first()
    .text()
    .replace(/\s*\|\s*ChatGPT\s*$/i, "")
    .replace(/^\s*ChatGPT\s*[\-—]\s*/i, "")
    .trim();

  return {
    source: SOURCE,
    sourceLabel: "ChatGPT",
    title: title || undefined,
    url: originalUrl,
    messages,
    extractedAt: new Date().toISOString(),
  };
}

interface FoundConv {
  title?: string;
  messages: ChatMessage[];
}

function findChatGPTConversation(data: unknown): FoundConv | null {
  const found = walk(data, (v) => {
    const mapping = getObject(v, "mapping");
    if (!mapping) return null;
    const sample = Object.values(mapping)[0];
    if (
      isObject(sample) &&
      "id" in sample &&
      ("message" in sample || "children" in sample)
    ) {
      return v;
    }
    return null;
  });
  if (!isObject(found)) return null;

  const mapping = getObject(found, "mapping");
  if (!mapping) return null;
  const title = getString(found, "title");

  const nodes = Object.values(mapping).filter(isObject);
  const root = nodes.find((n) => n.parent == null) ?? nodes[0];
  const rootId = root ? getString(root, "id") : Object.keys(mapping)[0];

  const messages: ChatMessage[] = [];
  let cursor: string | undefined = rootId;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const node = mapping[cursor];
    if (!isObject(node)) break;

    const msg = getObject(node, "message");
    if (msg) {
      const role = getString(getObject(msg, "author"), "role");
      const parts = getArray(getObject(msg, "content"), "parts");
      const contentType = getString(getObject(msg, "content"), "content_type");
      if (
        role &&
        role !== "system" &&
        parts &&
        parts.length &&
        (!contentType || contentType === "text" || contentType === "multimodal_text")
      ) {
        const text = parts
          .map((p) => (typeof p === "string" ? p : ""))
          .filter(Boolean)
          .join("\n\n")
          .trim();
        if (text) {
          const model = getString(getObject(msg, "metadata"), "model_slug");
          messages.push({
            role:
              role === "user"
                ? "user"
                : role === "tool"
                  ? "tool"
                  : "assistant",
            content: text,
            model: role === "assistant" ? model : undefined,
          });
        }
      }
    }
    const children = getArray(node, "children");
    cursor = children && typeof children[0] === "string" ? children[0] : undefined;
  }
  if (!messages.length) return null;
  return { title, messages };
}
