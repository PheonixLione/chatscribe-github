import * as cheerio from "cheerio";
import { fetchPage } from "./http";
import { htmlToMarkdown } from "./markdown";
import { getArray, getString, isObject, walk } from "./json";
import {
  ExtractError,
  type ChatMessage,
  type SourceDescriptor,
} from "./types";

const SOURCE = "claude" as const;

export const claude: SourceDescriptor = {
  source: SOURCE,
  label: "Claude",
  urlPatterns: ["https://claude.ai/share/<id>"],
  example: "https://claude.ai/share/abcd-1234",
  matches(url) {
    const h = url.hostname.toLowerCase();
    return (
      (h === "claude.ai" || h === "www.claude.ai") &&
      url.pathname.startsWith("/share/")
    );
  },
  async extract(url) {
    const html = await fetchPage(url.toString(), {
      source: SOURCE,
      isAllowedHost: (u) => claude.matches(u),
    });
    const $ = cheerio.load(html);

    const next = $("script#__NEXT_DATA__").first().text();
    if (next) {
      try {
        const data: unknown = JSON.parse(next);
        const conv = findClaudeConversation(data);
        if (conv) {
          return {
            source: SOURCE,
            sourceLabel: "Claude",
            title: conv.title,
            url: url.toString(),
            messages: conv.messages,
            extractedAt: new Date().toISOString(),
          };
        }
      } catch {
        // fall through
      }
    }

    const scripts = $("script").toArray();
    for (const s of scripts) {
      const text = $(s).text();
      if (!text || text.length < 50) continue;
      if (
        text.includes('"sender"') &&
        text.includes('"text"') &&
        text.includes('"chat_messages"')
      ) {
        const conv = tryExtractFromScript(text);
        if (conv) {
          return {
            source: SOURCE,
            sourceLabel: "Claude",
            title: conv.title,
            url: url.toString(),
            messages: conv.messages,
            extractedAt: new Date().toISOString(),
          };
        }
      }
    }

    const messages: ChatMessage[] = [];
    $("[data-testid='user-message'], [data-testid='message']").each((_, el) => {
      const isUser = $(el).attr("data-testid") === "user-message";
      const content = htmlToMarkdown($(el).html() || "");
      if (!content.trim()) return;
      messages.push({
        role: isUser ? "user" : "assistant",
        content,
      });
    });
    if (!messages.length) {
      throw new ExtractError(
        "parse_failed",
        "Could not parse the Claude conversation. The share page format may have changed.",
        { source: SOURCE },
      );
    }
    const title = $("title").first().text().replace(/\s*-\s*Claude\s*$/i, "").trim();
    return {
      source: SOURCE,
      sourceLabel: "Claude",
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

function findClaudeConversation(data: unknown): FoundConv | null {
  const found = walk(data, (v) => {
    return getArray(v, "chat_messages") ? v : null;
  });
  if (!isObject(found)) return null;
  return parseClaudeMessages(found);
}

function tryExtractFromScript(text: string): FoundConv | null {
  const matches = text.matchAll(/\{[^{}]*"chat_messages"\s*:\s*\[/g);
  for (const m of matches) {
    const start = m.index ?? 0;
    const obj = sliceBalancedObject(text, start);
    if (!obj) continue;
    try {
      const parsed: unknown = JSON.parse(obj);
      if (isObject(parsed)) {
        const conv = parseClaudeMessages(parsed);
        if (conv) return conv;
      }
    } catch {
      // try next
    }
  }
  return null;
}

function sliceBalancedObject(text: string, atIndex: number): string | null {
  let start = atIndex;
  while (start >= 0 && text[start] !== "{") start--;
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) {
        esc = false;
      } else if (c === "\\") {
        esc = true;
      } else if (c === '"') {
        inStr = false;
      }
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function parseClaudeMessages(obj: Record<string, unknown>): FoundConv | null {
  const msgs = getArray(obj, "chat_messages");
  if (!msgs) return null;
  const messages: ChatMessage[] = [];
  for (const raw of msgs) {
    if (!isObject(raw)) continue;
    const senderField = getString(raw, "sender");
    const roleField = getString(raw, "role");
    const sender =
      senderField || (roleField === "human" ? "human" : roleField) || "";
    const role: ChatMessage["role"] =
      sender === "human" || sender === "user" ? "user" : "assistant";

    let content = "";
    const contentArr = getArray(raw, "content");
    if (contentArr) {
      content = contentArr
        .map((c) => {
          if (typeof c === "string") return c;
          if (isObject(c)) {
            const type = getString(c, "type");
            const text = getString(c, "text");
            if ((type === "text" || !type) && text) return text;
          }
          return "";
        })
        .filter(Boolean)
        .join("\n\n");
    } else {
      content =
        getString(raw, "text") ||
        getString(raw, "content") ||
        "";
    }
    content = content.trim();
    if (!content) continue;
    messages.push({ role, content });
  }
  if (!messages.length) return null;
  const title = getString(obj, "name") ?? getString(obj, "title");
  return { title, messages };
}
