import * as cheerio from "cheerio";
import { fetchPage } from "./http";
import { htmlToMarkdown } from "./markdown";
import {
  ExtractError,
  type ChatMessage,
  type Conversation,
  type SourceDescriptor,
} from "./types";

const SOURCE = "perplexity" as const;

export const perplexity: SourceDescriptor = {
  source: SOURCE,
  label: "Perplexity",
  urlPatterns: [
    "https://www.perplexity.ai/search/<slug>",
    "https://perplexity.ai/search/<slug>",
  ],
  example: "https://www.perplexity.ai/search/example-abcd1234",
  matches(url) {
    const h = url.hostname.toLowerCase();
    return (
      (h === "perplexity.ai" || h === "www.perplexity.ai") &&
      (url.pathname.startsWith("/search/") || url.pathname.startsWith("/page/"))
    );
  },
  async extract(url) {
    const html = await fetchPage(url.toString(), { source: SOURCE, isAllowedHost: (u) => perplexity.matches(u) });
    const $ = cheerio.load(html);

    const next = $("script#__NEXT_DATA__").first().text();
    if (next) {
      try {
        const data = JSON.parse(next);
        const conv = findPerplexityConversation(data);
        if (conv) {
          return {
            source: SOURCE,
            sourceLabel: "Perplexity",
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

    // DOM fallback: pull query and answer text.
    const messages: ChatMessage[] = [];
    const queryEl = $("h1, [data-testid='query']").first();
    const answerEl = $("[data-testid='answer'], .prose, article").first();
    const q = queryEl.text().trim();
    if (q) messages.push({ role: "user", content: q });
    const a = htmlToMarkdown(answerEl.html() || "");
    if (a.trim()) messages.push({ role: "assistant", content: a });

    if (!messages.length) {
      throw new ExtractError(
        "parse_failed",
        "Could not parse the Perplexity page. The page format may have changed.",
        { source: SOURCE },
      );
    }
    const title =
      $('meta[property="og:title"]').attr("content")?.trim() ||
      $("title").first().text().trim();
    return {
      source: SOURCE,
      sourceLabel: "Perplexity",
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

function findPerplexityConversation(data: unknown): FoundConv | null {
  // Look for an object with `query_str` + `text` fields, often nested as an array of "blocks".
  const messages: ChatMessage[] = [];
  let title: string | undefined;
  walk(data, (v) => {
    if (v && typeof v === "object") {
      const o = v as any;
      if (typeof o.query_str === "string" && o.query_str.trim()) {
        messages.push({ role: "user", content: o.query_str.trim() });
        if (!title && typeof o.title === "string") title = o.title;
      }
      if (typeof o.answer === "string" && o.answer.trim()) {
        // Perplexity sometimes JSON-encodes the answer object inside a string field.
        try {
          const parsed = JSON.parse(o.answer);
          const txt =
            (typeof parsed?.answer === "string" && parsed.answer) ||
            (Array.isArray(parsed?.chunks)
              ? parsed.chunks.map((c: any) => c?.text || "").join("\n\n")
              : "");
          if (txt.trim()) messages.push({ role: "assistant", content: txt.trim() });
        } catch {
          messages.push({ role: "assistant", content: o.answer.trim() });
        }
      } else if (typeof o.text === "string" && o.text.length > 80 && !o.query_str) {
        // Some payloads nest the rendered answer text under .text
        if (!messages.some((m) => m.content === o.text.trim())) {
          messages.push({ role: "assistant", content: o.text.trim() });
        }
      }
    }
    return null;
  });
  if (!messages.length) return null;
  return { title, messages };
}

function walk(value: unknown, visitor: (v: unknown) => unknown): void {
  const seen = new WeakSet<object>();
  const stack: unknown[] = [value];
  while (stack.length) {
    const v = stack.pop();
    if (v && typeof v === "object") {
      if (seen.has(v as object)) continue;
      seen.add(v as object);
      visitor(v);
      if (Array.isArray(v)) {
        for (const item of v) stack.push(item);
      } else {
        for (const key of Object.keys(v as Record<string, unknown>)) {
          stack.push((v as Record<string, unknown>)[key]);
        }
      }
    }
  }
}
