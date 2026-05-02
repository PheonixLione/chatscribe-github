import * as cheerio from "cheerio";
import { fetchPage } from "./http";
import { htmlToMarkdown } from "./markdown";
import { getArray, getString, isObject, walk } from "./json";
import {
  ExtractError,
  type ChatMessage,
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
    const html = await fetchPage(url.toString(), {
      source: SOURCE,
      isAllowedHost: (u) => grok.matches(u),
    });
    const $ = cheerio.load(html);

    const next = $("script#__NEXT_DATA__").first().text();
    if (next) {
      try {
        const data: unknown = JSON.parse(next);
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

function firstSenderOrRole(arr: unknown[]): boolean {
  const first = arr[0];
  if (!isObject(first)) return false;
  return Boolean(getString(first, "sender") || getString(first, "role"));
}

function findGrokConversation(data: unknown): FoundConv | null {
  const found = walk(data, (v) => {
    if (getArray(v, "responses")) return v;
    const messages = getArray(v, "messages");
    if (messages && messages.length && firstSenderOrRole(messages)) return v;
    return null;
  });
  if (!isObject(found)) return null;
  const arr = getArray(found, "messages") ?? getArray(found, "responses") ?? [];
  const messages: ChatMessage[] = [];
  for (const m of arr) {
    if (!isObject(m)) continue;
    const sender = (getString(m, "sender") || getString(m, "role") || "").toLowerCase();
    const role: ChatMessage["role"] =
      sender === "human" || sender === "user"
        ? "user"
        : "assistant";

    let content =
      getString(m, "message") ||
      getString(m, "text") ||
      getString(m, "content") ||
      "";
    if (!content) {
      const contentArr = getArray(m, "content");
      if (contentArr) {
        content = contentArr
          .map((c) => {
            if (typeof c === "string") return c;
            if (isObject(c)) return getString(c, "text") || "";
            return "";
          })
          .filter(Boolean)
          .join("\n\n");
      }
    }
    const trimmed = content.trim();
    if (!trimmed) continue;
    messages.push({ role, content: trimmed });
  }
  if (!messages.length) return null;
  const title = getString(found, "title");
  return { title, messages };
}

function scrapeArrayLike(text: string): FoundConv | null {
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
      const parsed: unknown = JSON.parse(`"${raw}"`);
      if (typeof parsed === "string") content = parsed;
    } catch {
      content = raw;
    }
    if (content.trim()) candidates.push({ role, content: content.trim() });
  }
  if (!candidates.length) return null;
  return { messages: candidates };
}
