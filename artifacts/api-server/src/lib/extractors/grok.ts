import * as cheerio from "cheerio";
import { fetchPage } from "./http";
import { htmlToMarkdown } from "./markdown";
import {
  ExtractError,
  type ChatMessage,
  type Conversation,
  type SourceDescriptor,
} from "./types";

const SOURCE = "grok" as const;

export const grok: SourceDescriptor = {
  source: SOURCE,
  label: "Grok",
  urlPatterns: [
    "https://grok.com/share/<id>",
    "https://x.com/i/grok/share/<id>",
  ],
  example: "https://grok.com/share/abcd1234",
  matches(url) {
    const h = url.hostname.toLowerCase();
    if ((h === "grok.com" || h === "www.grok.com") && url.pathname.includes("/share/"))
      return true;
    if ((h === "x.com" || h === "twitter.com") && url.pathname.includes("/grok/share/"))
      return true;
    return false;
  },
  async extract(url) {
    const html = await fetchPage(url.toString(), { source: SOURCE, isAllowedHost: (u) => grok.matches(u) });
    const $ = cheerio.load(html);

    // Try Next.js data
    const next = $("script#__NEXT_DATA__").first().text();
    if (next) {
      try {
        const data = JSON.parse(next);
        const conv = findGrokConversation(data);
        if (conv) {
          return {
            source: SOURCE,
            sourceLabel: "Grok",
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

    // Try generic inline scripts containing message arrays
    const scripts = $("script").toArray();
    for (const s of scripts) {
      const text = $(s).text();
      if (!text) continue;
      if (
        (text.includes('"sender"') || text.includes('"role"')) &&
        text.includes('"message"') &&
        text.length > 200
      ) {
        const conv = scrapeArrayLike(text);
        if (conv && conv.messages.length) {
          return {
            source: SOURCE,
            sourceLabel: "Grok",
            title: conv.title,
            url: url.toString(),
            messages: conv.messages,
            extractedAt: new Date().toISOString(),
          };
        }
      }
    }

    // DOM fallback
    const messages: ChatMessage[] = [];
    $("[data-message-author-role], [data-role]").each((_, el) => {
      const role =
        $(el).attr("data-message-author-role") || $(el).attr("data-role") || "";
      const content = htmlToMarkdown($(el).html() || "");
      if (!content.trim()) return;
      messages.push({
        role: role === "user" ? "user" : "assistant",
        content,
      });
    });

    if (!messages.length) {
      throw new ExtractError(
        "parse_failed",
        "Could not parse the Grok conversation. The share page format may have changed.",
        { source: SOURCE },
      );
    }
    const title = $("title").first().text().replace(/\s*\|\s*Grok\s*$/i, "").trim();
    return {
      source: SOURCE,
      sourceLabel: "Grok",
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

function findGrokConversation(data: unknown): FoundConv | null {
  const found = walk(data, (v) => {
    if (
      v &&
      typeof v === "object" &&
      "responses" in (v as object) &&
      Array.isArray((v as any).responses)
    )
      return v;
    if (
      v &&
      typeof v === "object" &&
      "messages" in (v as object) &&
      Array.isArray((v as any).messages) &&
      (v as any).messages.length &&
      ((v as any).messages[0]?.sender || (v as any).messages[0]?.role)
    )
      return v;
    return null;
  });
  if (!found) return null;
  const obj = found as any;
  const arr: any[] = obj.messages || obj.responses;
  const messages: ChatMessage[] = [];
  for (const m of arr) {
    const sender: string = (m.sender || m.role || "").toString().toLowerCase();
    const role: ChatMessage["role"] =
      sender === "human" || sender === "user"
        ? "user"
        : sender === "assistant" || sender === "model" || sender === "ai" || sender === "grok"
          ? "assistant"
          : "assistant";
    const content =
      (typeof m.message === "string" && m.message) ||
      (typeof m.text === "string" && m.text) ||
      (typeof m.content === "string" && m.content) ||
      (Array.isArray(m.content)
        ? m.content
            .map((c: any) =>
              typeof c === "string" ? c : typeof c?.text === "string" ? c.text : "",
            )
            .filter(Boolean)
            .join("\n\n")
        : "");
    const trimmed = (content || "").trim();
    if (!trimmed) continue;
    messages.push({ role, content: trimmed });
  }
  if (!messages.length) return null;
  const title: string | undefined =
    typeof obj.title === "string" ? obj.title : undefined;
  return { title, messages };
}

function scrapeArrayLike(text: string): FoundConv | null {
  // Find the first `[ ... ]` containing message-shaped objects.
  // Naive: scan for sender/role patterns and slice surrounding object.
  const candidates: ChatMessage[] = [];
  const re =
    /"(?:sender|role)"\s*:\s*"([a-z_]+)"[^{}]*?"(?:message|text|content)"\s*:\s*"((?:\\.|[^"\\])*)"/gi;
  for (const m of text.matchAll(re)) {
    const sender = (m[1] || "").toLowerCase();
    const raw = m[2] || "";
    const role: ChatMessage["role"] =
      sender === "human" || sender === "user" ? "user" : "assistant";
    let content = "";
    try {
      content = JSON.parse(`"${raw}"`);
    } catch {
      content = raw;
    }
    if (content.trim()) candidates.push({ role, content: content.trim() });
  }
  if (!candidates.length) return null;
  return { messages: candidates };
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
