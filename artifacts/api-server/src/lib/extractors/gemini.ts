import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { fetchPage } from "./http";
import { htmlToMarkdown } from "./markdown";
import {
  ExtractError,
  type ChatMessage,
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
        // g.co share links 30x to gemini.google.com — allow either host on every hop.
        const h = u.hostname.toLowerCase();
        return h === "g.co" || h === "gemini.google.com" || h === "www.gemini.google.com";
      },
    });
    const $ = cheerio.load(html);

    const messages: ChatMessage[] = [];
    const USER_SEL = "user-query, [data-test-id='user-query'], .user-query";
    const MODEL_SEL =
      "model-response, [data-test-id='model-response'], .model-response, message-content";
    $(`${USER_SEL}, ${MODEL_SEL}`).each((_, el) => {
      const tagName = (el as Element).name?.toLowerCase() ?? "";
      const cls = $(el).attr("class") || "";
      const isUser =
        tagName === "user-query" ||
        $(el).is(USER_SEL) ||
        /user|query|prompt/i.test(cls);
      const content = htmlToMarkdown($(el).html() || "");
      if (!content.trim()) return;
      messages.push({ role: isUser ? "user" : "assistant", content });
    });

    if (!messages.length) {
      $(".conversation-container, .chat-container, [data-test-id='turn']").each(
        (_, el) => {
          const role = inferRoleFromClass($(el).attr("class") || "");
          const content = htmlToMarkdown($(el).html() || "");
          if (content.trim() && role) messages.push({ role, content });
        },
      );
    }

    // Note: We intentionally do NOT fall back to og:title/og:description here.
    // Those metadata tags are typically truncated previews, not full transcripts,
    // and returning them would silently violate the "full conversation" contract.
    // It is better to surface parse_failed and let the user know.
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
