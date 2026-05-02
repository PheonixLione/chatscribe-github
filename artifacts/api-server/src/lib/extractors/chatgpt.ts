import * as cheerio from "cheerio";
import { fetchPage } from "./http";
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
  type SourceDescriptor,
} from "./types";

const SOURCE = "chatgpt" as const;

export const chatgpt: SourceDescriptor = {
  source: SOURCE,
  label: "ChatGPT",
  urlPatterns: ["https://chatgpt.com/share/<id>", "https://chat.openai.com/share/<id>"],
  example: "https://chatgpt.com/share/abcd-1234",
  matches(url) {
    const h = url.hostname.toLowerCase();
    return (
      (h === "chatgpt.com" ||
        h === "www.chatgpt.com" ||
        h === "chat.openai.com") &&
      url.pathname.startsWith("/share/")
    );
  },
  async extract(url) {
    const html = await fetchPage(url.toString(), {
      source: SOURCE,
      isAllowedHost: (u) => chatgpt.matches(u),
    });
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
            url: url.toString(),
            messages: conv.messages,
            extractedAt: new Date().toISOString(),
          };
        }
      } catch {
        // fall through to DOM parsing
      }
    }

    const messages: ChatMessage[] = [];
    $("[data-message-author-role]").each((_, el) => {
      const role = $(el).attr("data-message-author-role") || "";
      const inner =
        $(el).find('[data-message-id], .markdown, .prose').first().html() ||
        $(el).html() ||
        "";
      const content = htmlToMarkdown(inner);
      if (!content.trim()) return;
      messages.push({
        role: role === "user" ? "user" : role === "system" ? "system" : "assistant",
        content,
      });
    });
    if (!messages.length) {
      throw new ExtractError(
        "parse_failed",
        "Could not parse the ChatGPT conversation. The share page format may have changed.",
        { source: SOURCE },
      );
    }
    const title = $("title").first().text().replace(/\s*\|\s*ChatGPT\s*$/i, "").trim();
    return {
      source: SOURCE,
      sourceLabel: "ChatGPT",
      title: title || undefined,
      url: url.toString(),
      messages,
      extractedAt: new Date().toISOString(),
    };
  },
};

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
