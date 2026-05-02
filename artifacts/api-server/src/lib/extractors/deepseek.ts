import * as cheerio from "cheerio";
import { fetchPage } from "./http";
import { htmlToMarkdown } from "./markdown";
import {
  ExtractError,
  type ChatMessage,
  type Conversation,
  type SourceDescriptor,
} from "./types";

const SOURCE = "deepseek" as const;

export const deepseek: SourceDescriptor = {
  source: SOURCE,
  label: "DeepSeek",
  urlPatterns: [
    "https://chat.deepseek.com/share/<id>",
    "https://chat.deepseek.com/a/share/<id>",
  ],
  example: "https://chat.deepseek.com/share/abcd1234",
  matches(url) {
    const h = url.hostname.toLowerCase();
    return (
      (h === "chat.deepseek.com" || h === "deepseek.com" || h === "www.deepseek.com") &&
      url.pathname.includes("/share/")
    );
  },
  async extract(url) {
    const html = await fetchPage(url.toString(), { source: SOURCE, isAllowedHost: (u) => deepseek.matches(u) });
    const $ = cheerio.load(html);

    // Try inline JSON
    const scripts = $("script").toArray();
    for (const s of scripts) {
      const text = $(s).text();
      if (!text || text.length < 100) continue;
      if (
        text.includes('"role"') &&
        text.includes('"content"') &&
        (text.includes("user") || text.includes("assistant"))
      ) {
        const conv = scrapeMessages(text);
        if (conv && conv.messages.length) {
          return {
            source: SOURCE,
            sourceLabel: "DeepSeek",
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
    $("[data-role], [data-message-author-role]").each((_, el) => {
      const role =
        $(el).attr("data-role") ||
        $(el).attr("data-message-author-role") ||
        "";
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
        "Could not parse the DeepSeek conversation. The share page may render fully with JavaScript.",
        { source: SOURCE },
      );
    }
    const title = $("title").first().text().replace(/\s*\|\s*DeepSeek\s*$/i, "").trim();
    return {
      source: SOURCE,
      sourceLabel: "DeepSeek",
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

function scrapeMessages(text: string): FoundConv | null {
  const messages: ChatMessage[] = [];
  const re =
    /"role"\s*:\s*"(user|assistant|system)"[^{}]*?"content"\s*:\s*"((?:\\.|[^"\\])*)"/gi;
  for (const m of text.matchAll(re)) {
    const role = m[1] as ChatMessage["role"];
    const raw = m[2] || "";
    let content = "";
    try {
      content = JSON.parse(`"${raw}"`);
    } catch {
      content = raw;
    }
    if (content.trim()) messages.push({ role, content: content.trim() });
  }
  if (!messages.length) return null;
  return { messages };
}
