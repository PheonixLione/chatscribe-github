import * as cheerio from "cheerio";
import { fetchPage } from "./http";
import { htmlToMarkdown } from "./markdown";
import {
  ExtractError,
  type ChatMessage,
  type Conversation,
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
    const html = await fetchPage(url.toString(), { source: SOURCE, isAllowedHost: (u) => claude.matches(u) });
    const $ = cheerio.load(html);

    // Try Next.js __NEXT_DATA__ first
    const next = $("script#__NEXT_DATA__").first().text();
    if (next) {
      try {
        const data = JSON.parse(next);
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

    // Try inline JSON shipped in <script> tags (Remix/Next variants)
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

    // Fallback to DOM
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
    if (
      v &&
      typeof v === "object" &&
      "chat_messages" in (v as object) &&
      Array.isArray((v as any).chat_messages)
    ) {
      return v;
    }
    return null;
  });
  if (!found) return null;
  return parseClaudeMessages(found);
}

function tryExtractFromScript(text: string): FoundConv | null {
  // Find any object literal containing chat_messages
  const matches = text.matchAll(/\{[^{}]*"chat_messages"\s*:\s*\[/g);
  for (const m of matches) {
    const start = m.index ?? 0;
    // Walk back to find enclosing object start
    const obj = sliceBalancedObject(text, start);
    if (!obj) continue;
    try {
      const parsed = JSON.parse(obj);
      const conv = parseClaudeMessages(parsed);
      if (conv) return conv;
    } catch {
      // try next
    }
  }
  return null;
}

function sliceBalancedObject(text: string, atIndex: number): string | null {
  // Walk backward to opening `{`
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

function parseClaudeMessages(obj: unknown): FoundConv | null {
  const o = obj as any;
  const msgs = o?.chat_messages;
  if (!Array.isArray(msgs)) return null;
  const messages: ChatMessage[] = [];
  for (const m of msgs) {
    const sender: string =
      m?.sender || (m?.role === "human" ? "human" : m?.role) || "";
    const role: ChatMessage["role"] =
      sender === "human" || sender === "user"
        ? "user"
        : sender === "assistant" || sender === "ai"
          ? "assistant"
          : "assistant";
    let content = "";
    if (Array.isArray(m?.content)) {
      content = m.content
        .map((c: any) => {
          if (typeof c === "string") return c;
          if (c?.type === "text" && typeof c.text === "string") return c.text;
          if (typeof c?.text === "string") return c.text;
          return "";
        })
        .filter(Boolean)
        .join("\n\n");
    } else if (typeof m?.text === "string") {
      content = m.text;
    } else if (typeof m?.content === "string") {
      content = m.content;
    }
    content = content.trim();
    if (!content) continue;
    messages.push({ role, content });
  }
  if (!messages.length) return null;
  const title: string | undefined =
    typeof o.name === "string"
      ? o.name
      : typeof o.title === "string"
        ? o.title
        : undefined;
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
