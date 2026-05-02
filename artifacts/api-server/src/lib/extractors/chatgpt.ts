import * as cheerio from "cheerio";
import { fetchPage } from "./http";
import { htmlToMarkdown } from "./markdown";
import {
  ExtractError,
  type ChatMessage,
  type Conversation,
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
    const html = await fetchPage(url.toString(), { source: SOURCE, isAllowedHost: (u) => chatgpt.matches(u) });
    const $ = cheerio.load(html);

    // ChatGPT embeds a Next.js __NEXT_DATA__ JSON blob with the full thread.
    const next = $("script#__NEXT_DATA__").first().text();
    if (next) {
      try {
        const data = JSON.parse(next);
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

    // Fallback: parse rendered transcript.
    const messages: ChatMessage[] = [];
    $("[data-message-author-role]").each((_, el) => {
      const role = $(el).attr("data-message-author-role") || "";
      const html = $(el).find('[data-message-id], .markdown, .prose').first().html() ||
        $(el).html() || "";
      const content = htmlToMarkdown(html);
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
  // Walk the JSON looking for an object that contains a `mapping` of nodes
  // with `message.author.role` and `message.content.parts`.
  const found = walk(data, (v) => {
    if (
      v &&
      typeof v === "object" &&
      "mapping" in (v as object) &&
      (v as any).mapping &&
      typeof (v as any).mapping === "object"
    ) {
      const mapping = (v as any).mapping as Record<string, any>;
      const sample = Object.values(mapping)[0];
      if (
        sample &&
        typeof sample === "object" &&
        "id" in sample &&
        ("message" in sample || "children" in sample)
      ) {
        return v;
      }
    }
    return null;
  });
  if (!found) return null;
  const obj = found as any;
  const mapping = obj.mapping as Record<string, any>;
  const title: string | undefined =
    typeof obj.title === "string" ? obj.title : undefined;

  // Find root (parent === null) then walk children depth-first picking the first child
  // (ChatGPT's linear share = always first child branch).
  const rootId =
    Object.values(mapping).find((n: any) => !n.parent)?.id ??
    Object.keys(mapping)[0];
  const messages: ChatMessage[] = [];
  let cursor: string | undefined = rootId;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const node = mapping[cursor];
    if (!node) break;
    const msg = node.message;
    if (msg) {
      const role = msg.author?.role as string | undefined;
      const parts = msg.content?.parts as unknown[] | undefined;
      const contentType = msg.content?.content_type as string | undefined;
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
          const model: string | undefined = msg.metadata?.model_slug;
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
    const children = (node.children ?? []) as string[];
    cursor = children[0];
  }
  if (!messages.length) return null;
  return { title, messages };
}

function walk(value: unknown, predicate: (v: unknown) => unknown | null): unknown {
  const seen = new WeakSet<object>();
  const stack: unknown[] = [value];
  while (stack.length) {
    const v = stack.pop();
    if (v && typeof v === "object") {
      if (seen.has(v as object)) continue;
      seen.add(v as object);
      const hit = predicate(v);
      if (hit) return hit;
      if (Array.isArray(v)) {
        for (const item of v) stack.push(item);
      } else {
        for (const key of Object.keys(v as Record<string, unknown>)) {
          stack.push((v as Record<string, unknown>)[key]);
        }
      }
    }
  }
  return null;
}
