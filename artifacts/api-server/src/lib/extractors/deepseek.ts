import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { fetchPage } from "./http";
import { renderPage } from "./headless";
import { htmlToMarkdown } from "./markdown";
import {
  ExtractError,
  type ChatMessage,
  type Conversation,
  type SourceDescriptor,
} from "./types";

const SOURCE = "deepseek" as const;

const isAllowedHost = (u: URL) => {
  const h = u.hostname.toLowerCase();
  return (
    h === "chat.deepseek.com" ||
    h === "deepseek.com" ||
    h === "www.deepseek.com"
  );
};

export const deepseek: SourceDescriptor = {
  source: SOURCE,
  label: "DeepSeek",
  urlPatterns: [
    "https://chat.deepseek.com/share/<id>",
    "https://chat.deepseek.com/a/share/<id>",
  ],
  example: "https://chat.deepseek.com/share/abcd1234",
  matches(url) {
    return isAllowedHost(url) && url.pathname.includes("/share/");
  },
  async extract(url) {
    // 1) Try the static SSR shell first. DeepSeek normally serves an AWS
    //    WAF challenge here, but if a proxy/cache returns the real HTML
    //    we'll use it without spinning up a browser.
    let staticErr: ExtractError | null = null;
    try {
      const html = await fetchPage(url.toString(), {
        source: SOURCE,
        isAllowedHost,
      });
      if (!isAwsWafChallenge(html)) {
        const conv = parseHtml(html, url.toString());
        if (conv) return conv;
      }
    } catch (err) {
      if (err instanceof ExtractError && err.code === "not_public") throw err;
      staticErr = err instanceof ExtractError ? err : null;
    }

    // 2) Headless render. The browser solves the WAF challenge JS, then
    //    React hydrates the conversation. We wait for `.ds-markdown` (the
    //    stable assistant-content class) to appear with non-empty text.
    try {
      const { html } = await renderPage(url.toString(), {
        source: SOURCE,
        timeoutMs: 90_000,
        settleMs: 1500,
        waitFor: {
          fn: `
            if (document.title === "" && document.querySelector("#challenge-container")) {
              return false;
            }
            var md = document.querySelectorAll(".ds-markdown");
            for (var i = 0; i < md.length; i++) {
              if ((md[i].textContent || "").trim().length > 5) return true;
            }
            return false;
          `,
        },
      });
      const conv = parseHtml(html, url.toString());
      if (conv) return conv;
    } catch (err) {
      if (err instanceof ExtractError && err.code === "not_public") throw err;
      // fall through
    }

    if (staticErr) throw staticErr;
    throw new ExtractError(
      "parse_failed",
      "Could not parse the DeepSeek conversation. The share page format may have changed.",
      { source: SOURCE },
    );
  },
};

function isAwsWafChallenge(html: string): boolean {
  // The challenge body is small and unmistakable — it inlines awswaf.com
  // assets and a `gokuProps` token blob.
  return (
    html.length < 5000 &&
    /awswaf\.com|AwsWafIntegration|gokuProps/i.test(html)
  );
}

/**
 * Parse a fully-rendered DeepSeek share page. The chat layout uses hashed
 * class names that change between deployments, but `.ds-markdown` (the
 * assistant message body) is a stable, semantic selector. We use it as
 * the anchor and walk siblings/ancestors to recover the user turn that
 * preceded each assistant turn.
 */
function parseHtml(html: string, originalUrl: string): Conversation | null {
  const $ = cheerio.load(html);

  const messages: ChatMessage[] = [];
  const seen = new Set<Element>();

  // Walk the document in source order so user/assistant ordering is preserved.
  // Each assistant turn is marked by `.ds-markdown`; the user turn is the
  // nearest preceding "row" sibling.
  const allMarkdown = $(".ds-markdown").toArray();
  for (const md of allMarkdown) {
    const turn = findTurnRoot($, md);
    if (!turn || seen.has(turn)) continue;
    seen.add(turn);

    // Look back through preceding turn rows for the user message.
    const userTurn = findPreviousUserTurn($, turn, seen);
    if (userTurn) {
      const userText = extractUserText($, userTurn);
      if (userText) {
        messages.push({ role: "user", content: userText });
        seen.add(userTurn);
      }
    }

    const assistantText = extractAssistantText($, md);
    if (assistantText) {
      messages.push({ role: "assistant", content: assistantText });
    }
  }

  // Fallback: if the heuristic above found nothing, try generic [data-role]
  // selectors used by some snapshots/extensions.
  if (!messages.length) {
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
  }

  if (!messages.length) return null;

  const title = $("title")
    .first()
    .text()
    .replace(/\s*[\|\-]\s*DeepSeek\s*$/i, "")
    .trim();

  return {
    source: SOURCE,
    sourceLabel: "DeepSeek",
    title: title || undefined,
    url: originalUrl,
    messages,
    extractedAt: new Date().toISOString(),
  };
}

/**
 * From a `.ds-markdown` element, walk up to the nearest "turn row" — the
 * outermost ancestor whose siblings are other turn rows. We approximate
 * that by climbing while the parent has only one matching markdown child
 * and stopping before the conversation root.
 */
function findTurnRoot(
  $: cheerio.CheerioAPI,
  md: Element,
): Element | null {
  let cur: Element | null = md;
  for (let depth = 0; depth < 10 && cur; depth++) {
    const parent = cur.parent;
    if (!parent || parent.type !== "tag") break;
    const parentEl = parent as Element;
    // Stop once we'd merge multiple turns into one row.
    const mdInside = $(parentEl).find(".ds-markdown").length;
    if (mdInside > 1) return cur;
    cur = parentEl;
  }
  return cur;
}

function findPreviousUserTurn(
  $: cheerio.CheerioAPI,
  turn: Element,
  seen: Set<Element>,
): Element | null {
  // Walk previous siblings first; if none qualifies, climb a level and try
  // again. Stop at the first sibling that has user-styled content (no
  // `.ds-markdown` inside, but text length > 0).
  let cur: Element | null = turn;
  while (cur) {
    let prev = cur.prev;
    while (prev) {
      if (prev.type === "tag") {
        const el = prev as Element;
        if (!seen.has(el) && looksLikeUserTurn($, el)) return el;
        // If it already contains a ds-markdown, it's another assistant
        // turn — stop searching backwards.
        if ($(el).find(".ds-markdown").length > 0) return null;
      }
      prev = prev.prev;
    }
    const parent = cur.parent;
    if (!parent || parent.type !== "tag") break;
    cur = parent as Element;
  }
  return null;
}

function looksLikeUserTurn($: cheerio.CheerioAPI, el: Element): boolean {
  if ($(el).find(".ds-markdown").length > 0) return false;
  const text = $(el).text().trim();
  return text.length > 0;
}

function extractUserText($: cheerio.CheerioAPI, el: Element): string {
  // User messages on DeepSeek are plain text bubbles (no markdown rendering).
  // Preserve line breaks but otherwise treat as text.
  const html = $(el).html() ?? "";
  const md = htmlToMarkdown(html).trim();
  if (md) return md;
  return $(el).text().replace(/\s+\n/g, "\n").trim();
}

function extractAssistantText(
  $: cheerio.CheerioAPI,
  md: Element,
): string {
  // Some assistant turns include a separate "thinking" block before the
  // final answer; include it as a blockquote so it's visible but clearly
  // demarcated from the answer.
  const turn = findTurnRoot($, md);
  let thinking = "";
  if (turn) {
    const thinkEl = $(turn)
      .find('[class*="thinking-content"], [class*="think"]')
      .first();
    if (thinkEl.length) {
      const t = htmlToMarkdown(thinkEl.html() || "").trim();
      if (t) {
        thinking =
          "> **Thinking**\n>\n" +
          t
            .split("\n")
            .map((l) => `> ${l}`)
            .join("\n") +
          "\n\n";
      }
    }
  }
  const answer = htmlToMarkdown($(md).html() || "").trim();
  return (thinking + answer).trim();
}
