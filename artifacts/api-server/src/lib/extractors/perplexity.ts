import * as cheerio from "cheerio";
import { fetchPage } from "./http";
import { htmlToMarkdown } from "./markdown";
import { getArray, getString, walkAll } from "./json";
import {
  ExtractError,
  type ChatMessage,
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
    const html = await fetchPage(url.toString(), {
      source: SOURCE,
      isAllowedHost: (u) => perplexity.matches(u),
    });
    const $ = cheerio.load(html);

    const next = $("script#__NEXT_DATA__").first().text();
    if (next) {
      try {
        const data: unknown = JSON.parse(next);
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
  const messages: ChatMessage[] = [];
  let title: string | undefined;
  walkAll(data, (o) => {
    const queryStr = getString(o, "query_str");
    if (queryStr && queryStr.trim()) {
      messages.push({ role: "user", content: queryStr.trim() });
      if (!title) title = getString(o, "title");
    }
    const answer = getString(o, "answer");
    if (answer && answer.trim()) {
      try {
        const parsed: unknown = JSON.parse(answer);
        const parsedAnswer = getString(parsed, "answer");
        const chunks = getArray(parsed, "chunks");
        const txt =
          parsedAnswer ||
          (chunks
            ? chunks
                .map((c) => getString(c, "text") ?? "")
                .filter(Boolean)
                .join("\n\n")
            : "");
        if (txt.trim()) {
          messages.push({ role: "assistant", content: txt.trim() });
          return;
        }
      } catch {
        // fall through to raw answer
      }
      messages.push({ role: "assistant", content: answer.trim() });
      return;
    }
    const text = getString(o, "text");
    if (text && text.length > 80 && !queryStr) {
      const trimmed = text.trim();
      if (!messages.some((m) => m.content === trimmed)) {
        messages.push({ role: "assistant", content: trimmed });
      }
    }
  });
  if (!messages.length) return null;
  return { title, messages };
}
