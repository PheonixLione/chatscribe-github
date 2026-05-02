import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { fetchPage } from "./http";
import { renderPage } from "./headless";
import { htmlToMarkdown } from "./markdown";
import { isObject, walkAll } from "./json";
import {
  ExtractError,
  isUnrecoverable,
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
      // Fail fast on terminal errors (404/private or a redirect that
      // hopped off the host allowlist) so we don't burn ~90s on a
      // headless retry that will hit the same wall.
      if (isUnrecoverable(err)) throw err;
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
      if (isUnrecoverable(err)) throw err;
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
  // Some DeepSeek share responses (and our fixtures / cached snapshots)
  // inline the entire conversation as a `window.__INITIAL_STATE__` blob
  // before React even mounts. When present this is by far the most
  // reliable source — we don't need any DOM heuristics.
  const fromState = parseInitialState(html, originalUrl);
  if (fromState) return fromState;

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

/**
 * Pull the JSON object out of a `window.__INITIAL_STATE__ = {...};` script
 * tag and try to find a `messages` array of `{role, content}` objects
 * (anywhere in the tree — DeepSeek nests it under `share` or `data` in
 * different deployments). Returns a Conversation if a usable transcript
 * is found, otherwise null.
 */
function parseInitialState(
  html: string,
  originalUrl: string,
): Conversation | null {
  const re = /window\s*\.\s*__INITIAL_STATE__\s*=\s*/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const start = match.index + match[0].length;
    // Find the matching closing brace by counting nesting, respecting
    // strings so braces inside JSON string values don't trip us up.
    if (html[start] !== "{") continue;
    let depth = 0;
    let inStr = false;
    let escape = false;
    let end = -1;
    for (let i = start; i < html.length; i++) {
      const ch = html[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (inStr) {
        if (ch === "\\") {
          escape = true;
        } else if (ch === '"') {
          inStr = false;
        }
        continue;
      }
      if (ch === '"') {
        inStr = true;
      } else if (ch === "{") {
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    if (end === -1) continue;
    const json = html.slice(start, end);
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      continue;
    }
    const conv = conversationFromState(parsed, originalUrl);
    if (conv) return conv;
  }
  return null;
}

function conversationFromState(
  state: unknown,
  originalUrl: string,
): Conversation | null {
  // Walk every object in the state tree and inspect each of its array
  // fields, looking for the longest array whose entries match
  // `{role: "user"|"assistant"|"system", content: string}`. This handles
  // both `state.share.messages` (current shape) and any future renames.
  let bestMessages: ChatMessage[] | null = null;
  walkAll(state, (node) => {
    for (const key of Object.keys(node)) {
      const arr = node[key];
      if (!Array.isArray(arr) || arr.length === 0) continue;
      const candidate: ChatMessage[] = [];
      let valid = true;
      for (const item of arr) {
        if (!isObject(item)) {
          valid = false;
          break;
        }
        const role = item.role;
        const content = item.content;
        if (
          (role !== "user" && role !== "assistant" && role !== "system") ||
          typeof content !== "string"
        ) {
          valid = false;
          break;
        }
        candidate.push({
          role: role as "user" | "assistant" | "system",
          content,
        });
      }
      if (
        valid &&
        candidate.length &&
        (!bestMessages || candidate.length > bestMessages.length)
      ) {
        bestMessages = candidate;
      }
    }
  });

  if (!bestMessages) return null;
  const messages: ChatMessage[] = bestMessages;
  if (messages.length === 0) return null;

  // Try to find a title in the same state tree.
  let title: string | undefined;
  walkAll(state, (node) => {
    if (title) return;
    const t = node.title ?? node.shareTitle ?? node.name;
    if (typeof t === "string" && t.trim()) title = t.trim();
  });

  return {
    source: SOURCE,
    sourceLabel: "DeepSeek",
    title: title || undefined,
    url: originalUrl,
    messages,
    extractedAt: new Date().toISOString(),
  };
}
