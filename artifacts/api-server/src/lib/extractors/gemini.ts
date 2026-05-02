import * as cheerio from "cheerio";
import { fetchPage } from "./http";
import { htmlToMarkdown } from "./markdown";
import {
  ExtractError,
  type ChatMessage,
  type Conversation,
  type SourceDescriptor,
} from "./types";

const SOURCE = "gemini" as const;

export const gemini: SourceDescriptor = {
  source: SOURCE,
  label: "Gemini",
  urlPatterns: [
    "https://g.co/gemini/share/<id>",
    "https://gemini.google.com/share/<id>",
  ],
  example: "https://g.co/gemini/share/abcd1234",
  matches(url) {
    const h = url.hostname.toLowerCase();
    return (
      (h === "g.co" && url.pathname.startsWith("/gemini/share/")) ||
      ((h === "gemini.google.com" || h === "www.gemini.google.com") &&
        url.pathname.includes("/share/"))
    );
  },
  async extract(url) {
    const html = await fetchPage(url.toString(), {
      source: SOURCE,
      isAllowedHost: (u) => {
        // Gemini publishes share links via g.co that 30x to gemini.google.com.
        // Allow either host on every hop.
        const h = u.hostname.toLowerCase();
        return h === "g.co" || h === "gemini.google.com" || h === "www.gemini.google.com";
      },
    });
    const $ = cheerio.load(html);

    // Gemini share pages render the user prompt and model response inside
    // distinct containers. Walk the DOM in document order so multi-turn
    // conversations stay correctly ordered.
    const messages: ChatMessage[] = [];
    const USER_SEL = "user-query, [data-test-id='user-query'], .user-query";
    const MODEL_SEL =
      "model-response, [data-test-id='model-response'], .model-response, message-content";
    $(`${USER_SEL}, ${MODEL_SEL}`).each((_, el) => {
      const tagName = (el as any).name || "";
      const cls = $(el).attr("class") || "";
      const isUser =
        tagName === "user-query" ||
        $(el).is(USER_SEL) ||
        /user|query|prompt/i.test(cls);
      const content = htmlToMarkdown($(el).html() || "");
      if (!content.trim()) return;
      messages.push({ role: isUser ? "user" : "assistant", content });
    });

    // Pattern B: turn-based containers in document order
    if (!messages.length) {
      $(".conversation-container, .chat-container, [data-test-id='turn']").each(
        (_, el) => {
          const role = inferRoleFromClass($(el).attr("class") || "");
          const content = htmlToMarkdown($(el).html() || "");
          if (content.trim() && role) messages.push({ role, content });
        },
      );
    }

    // Pattern C: meta og:description fallback (single-turn)
    if (!messages.length) {
      const desc = $('meta[property="og:description"]').attr("content");
      const ogTitle = $('meta[property="og:title"]').attr("content");
      if (ogTitle && desc) {
        messages.push({ role: "user", content: ogTitle.trim() });
        messages.push({ role: "assistant", content: desc.trim() });
      }
    }

    if (!messages.length) {
      throw new ExtractError(
        "parse_failed",
        "Could not parse the Gemini conversation. Public Gemini shares often render with JavaScript and may not be extractable.",
        { source: SOURCE },
      );
    }

    const title =
      $('meta[property="og:title"]').attr("content")?.trim() ||
      $("title").first().text().trim();
    return {
      source: SOURCE,
      sourceLabel: "Gemini",
      title: title || undefined,
      url: url.toString(),
      messages,
      extractedAt: new Date().toISOString(),
    };
  },
};

function inferRoleFromClass(cls: string): ChatMessage["role"] | null {
  const c = cls.toLowerCase();
  if (c.includes("user") || c.includes("query") || c.includes("prompt"))
    return "user";
  if (c.includes("model") || c.includes("response") || c.includes("assistant"))
    return "assistant";
  return null;
}
