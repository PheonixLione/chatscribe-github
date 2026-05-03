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
    // 0) Try the public share-content API directly. The browser-intercepted
    //    XHR shows DeepSeek serves the entire conversation in one call to
    //    `/api/v0/share/content?share_id=<id>` — if that endpoint isn't
    //    WAF-gated, hitting it directly skips the entire browser pipeline.
    const shareId = extractShareId(url);
    if (shareId) {
      const direct = await tryDirectShareApi(shareId, url.toString());
      if (direct) return direct;
    }

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
    //    React hydrates the conversation. We intercept every JSON response
    //    (DeepSeek fetches the full conversation via XHR after React boots)
    //    and accumulate all paginated batches. DeepSeek's virtual list loads
    //    the LATEST messages first; scrolling UP triggers XHR calls for
    //    earlier batches. We collect every batch and merge them in reverse
    //    arrival order (latest-arriving batch = earliest messages) so the
    //    final transcript runs from the very first message to the last.
    try {
      const interceptedBatches: Conversation[] = [];

      const { html } = await renderPage(url.toString(), {
        source: SOURCE,
        timeoutMs: 120_000,
        settleMs: 3000,
        scrollToLoad: false,
        scrollUp: true,
        scrollUpTimeoutMs: 60_000,
        scrollUpProgress: () => interceptedBatches.length,
        onJsonResponse: (respUrl, body) => {
          const conv = conversationFromState(body, url.toString());
          process.stderr.write(
            `[deepseek] intercepted ${respUrl} → ${conv ? conv.messages.length + " msgs" : "no match"}\n`,
          );
          // Dump full body when the share-content endpoint fails to parse.
          // This is the one XHR that contains the conversation; if our
          // generic walker can't find it, we need to see the exact shape.
          if (!conv && respUrl.includes("/api/v0/share/content")) {
            try {
              process.stderr.write(
                `[deepseek] share/content body: ${JSON.stringify(body).slice(0, 4000)}\n`,
              );
            } catch {
              process.stderr.write(`[deepseek] share/content body: (unstringifiable)\n`);
            }
          }
          if (conv && conv.messages.length > 0) {
            interceptedBatches.push(conv);
          }
        },
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

      // XHR-captured batches are authoritative — full JSON before DOM windowing.
      process.stderr.write(`[deepseek] total batches captured: ${interceptedBatches.length}\n`);
      if (interceptedBatches.length > 0) {
        return mergeInterceptedBatches(interceptedBatches, url.toString());
      }

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
  // Run both parsers and return whichever yields more messages. This
  // handles two failure modes:
  //   (a) __INITIAL_STATE__ has only the first N messages (server paginates
  //       the initial render) while the fully-scrolled DOM has everything.
  //   (b) __INITIAL_STATE__ is absent (WAF redirect → SPA fetch, no SSR)
  //       and only the DOM is available.
  const fromState = parseInitialState(html, originalUrl);
  const fromDom = parseDomHtml(html, originalUrl);

  if (fromState && fromDom) {
    return fromState.messages.length >= fromDom.messages.length
      ? fromState
      : fromDom;
  }
  return fromState ?? fromDom ?? null;
}

function parseDomHtml(html: string, originalUrl: string): Conversation | null {
  const $ = cheerio.load(html);

  const messages: ChatMessage[] = [];

  // Each turn is a `.ds-message` element. Role is determined by structure:
  // assistant turns contain `.ds-markdown` (answer) and/or `.ds-think-content`
  // (thinking); user turns contain neither. Walk in DOM order so the
  // conversation stays in sequence.
  const turns = $(".ds-message").toArray();
  for (const turn of turns) {
    const $turn = $(turn);
    const isAssistant =
      $turn.find(".ds-markdown").length > 0 ||
      $turn.find(".ds-think-content").length > 0;

    if (isAssistant) {
      const content = extractAssistantContent($, turn);
      if (content) messages.push({ role: "assistant", content });
    } else {
      const content = extractUserContent($, turn);
      if (content) messages.push({ role: "user", content });
    }
  }

  // Fallback for older/extension snapshots that expose explicit role attrs.
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
 * Strip non-text children (file/image attachment chips) from a user turn
 * and return the plain text prompt. DeepSeek wraps each attachment in
 * `._5cadb25` (file card) or other chip-like containers; the actual
 * prompt text lives in a sibling text bubble (`.fbb737a4` historically,
 * but we also fall back to "anything that's not an attachment chip").
 */
function extractUserContent(
  $: cheerio.CheerioAPI,
  turn: Element,
): string {
  const $turn = $(turn);
  const $clone = $turn.clone();
  // Remove file/image/attachment chips — anything we don't want to show.
  $clone
    .find(
      "._5cadb25, " + // file attachment card
        "img, picture, video, audio, source, " +
        "[class*='attachment'], [class*='file-'], " +
        "[class*='upload'], [class*='image-preview']",
    )
    .remove();
  const html = $clone.html() ?? "";
  const md = htmlToMarkdown(html).trim();
  if (md) return md;
  return $clone.text().replace(/\s+\n/g, "\n").trim();
}

/**
 * Build the assistant's content by walking thinking/answer blocks in DOM
 * order. Thinking blocks render as a `> **Thinking**` blockquote; answer
 * blocks render as plain markdown. Search-result chips and other UI
 * affordances are excluded so the transcript stays readable.
 */
function extractAssistantContent(
  $: cheerio.CheerioAPI,
  turn: Element,
): string {
  const blocks = $(turn)
    .find(".ds-think-content, .ds-markdown")
    .toArray();
  const parts: string[] = [];
  for (const block of blocks) {
    const $b = $(block);
    const cls = $b.attr("class") || "";
    const isThinking = /ds-think-content/.test(cls);
    // Drop any nested attachment/image chips before serializing.
    const $clone = $b.clone();
    $clone
      .find(
        "img, picture, video, audio, source, " +
          "[class*='attachment'], [class*='file-'], " +
          "[class*='upload'], [class*='image-preview']",
      )
      .remove();
    const text = htmlToMarkdown($clone.html() || "").trim();
    if (!text) continue;
    if (isThinking) {
      parts.push(
        "> **Thinking**\n>\n" +
          text
            .split("\n")
            .map((l) => `> ${l}`)
            .join("\n"),
      );
    } else {
      parts.push(text);
    }
  }
  return parts.join("\n\n").trim();
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

/**
 * Pull a string body out of a DeepSeek message item, handling both shapes
 * the share-content API has been observed to return:
 *
 *   1. `content: "string"` — older / direct-API shape
 *   2. `fragments: [{ type: "REQUEST"|"RESPONSE"|"THINK"|..., content }]`
 *      — newer browser-XHR shape
 *
 * For fragments, THINK / THINKING / REASONING blocks are wrapped in a
 * `> **Thinking**` blockquote so chain-of-thought stays readable but
 * visually distinct from the final answer.
 *
 * Returns null if neither field yields a usable string.
 */
function extractMessageContent(item: Record<string, unknown>): string | null {
  if (typeof item.content === "string") return item.content;

  const frags = item.fragments;
  if (Array.isArray(frags) && frags.length > 0) {
    const parts: string[] = [];
    for (const f of frags) {
      if (!isObject(f)) continue;
      const text = typeof f.content === "string" ? f.content : "";
      if (!text) continue;
      const type = typeof f.type === "string" ? f.type.toUpperCase() : "";
      if (type === "THINK" || type === "THINKING" || type === "REASONING") {
        parts.push(
          "> **Thinking**\n>\n" +
            text.split("\n").map((l) => `> ${l}`).join("\n"),
        );
      } else {
        parts.push(text);
      }
    }
    if (parts.length > 0) return parts.join("\n\n");
  }
  return null;
}

function conversationFromState(
  state: unknown,
  originalUrl: string,
): Conversation | null {
  // Walk every object in the state tree and inspect each of its array
  // fields, looking for the longest array whose entries ALL match
  // {role: "user"|"assistant"|"system", content: string}. Strict
  // whole-array rejection (not per-item skipping) is intentional: it
  // prevents accidentally picking a larger UI-state or metadata array
  // that incidentally has some items with matching field names.
  let bestMessages: ChatMessage[] | null = null;
  walkAll(state, (node) => {
    for (const key of Object.keys(node)) {
      const arr = node[key];
      if (!Array.isArray(arr) || arr.length === 0) continue;
      const candidate: ChatMessage[] = [];
      let valid = true;
      for (const item of arr) {
        if (!isObject(item)) { valid = false; break; }
        const rawRole = item.role;
        if (typeof rawRole !== "string") { valid = false; break; }
        // Case-insensitive: DeepSeek's share-content API returns "USER" /
        // "ASSISTANT" uppercase; older shapes use lowercase.
        const role = rawRole.toLowerCase();
        // Non-display message types (DeepSeek R1 chain-of-thought, tool
        // calls): skip the item but keep the array valid. Any OTHER
        // unrecognised role still rejects the whole array — that's what
        // protects against the wrong-array selection bug.
        if (role === "thinking" || role === "tool" || role === "function") {
          continue;
        }
        if (role !== "user" && role !== "assistant" && role !== "system") {
          valid = false;
          break;
        }
        const content = extractMessageContent(item);
        if (typeof content !== "string") {
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

/**
 * Merge paginated XHR batches into a single chronological conversation.
 *
 * DeepSeek loads the LATEST messages on initial page load, then serves
 * earlier batches as the user scrolls toward the top. Batches therefore
 * arrive in reverse chronological order: batch[0] = tail of conversation,
 * batch[N-1] = head. Reversing the batch list restores forward order.
 *
 * Within each batch messages are already in sequence. Overlapping messages
 * across batches (DeepSeek may include a small overlap for continuity) are
 * deduplicated by role + first-100-chars of content.
 */
function mergeInterceptedBatches(
  batches: Conversation[],
  originalUrl: string,
): Conversation {
  if (batches.length === 1) return batches[0];

  const seen = new Set<string>();
  const messages: ChatMessage[] = [];

  // Reverse so the batch that arrived LAST (= earliest messages) comes first.
  for (const batch of [...batches].reverse()) {
    for (const msg of batch.messages) {
      // Full content as dedup key — first-100-chars collapses distinct
      // messages that share boilerplate openers in long conversations.
      const key = `${msg.role}\x00${msg.content}`;
      if (!seen.has(key)) {
        seen.add(key);
        messages.push(msg);
      }
    }
  }

  const title = batches.find((b) => b.title)?.title;
  return {
    source: SOURCE,
    sourceLabel: "DeepSeek",
    title,
    url: originalUrl,
    messages,
    extractedAt: new Date().toISOString(),
  };
}

/**
 * Pull the share token out of `https://chat.deepseek.com/share/<id>` (or
 * `/a/share/<id>`). Returns null if the URL doesn't match either shape.
 */
function extractShareId(url: URL): string | null {
  const m = url.pathname.match(/\/(?:a\/)?share\/([^\/?#]+)/);
  return m ? m[1] : null;
}

/**
 * Fetch DeepSeek's public share-content endpoint directly. The browser
 * always hits this URL after solving the WAF challenge — if the endpoint
 * itself is unauthenticated, going straight to it skips the entire
 * Puppeteer pipeline and returns the full conversation in one shot.
 *
 * On failure (WAF block, auth required, response shape mismatch) returns
 * null and falls back to the existing static + headless paths.
 */
async function tryDirectShareApi(
  shareId: string,
  originalUrl: string,
): Promise<Conversation | null> {
  const apiUrl = `https://chat.deepseek.com/api/v0/share/content?share_id=${encodeURIComponent(shareId)}`;
  let text: string;
  try {
    text = await fetchPage(apiUrl, {
      source: SOURCE,
      isAllowedHost: (u) => u.hostname.toLowerCase() === "chat.deepseek.com",
      acceptJson: true,
      headers: {
        "x-app-version": "20241129.1",
        "x-client-platform": "web",
        "x-client-version": "1.0.0-always",
      },
    });
  } catch (err) {
    process.stderr.write(`[deepseek] direct API call failed: ${(err as Error).message}\n`);
    return null;
  }

  // WAF challenge body is small + has a recognizable token blob.
  if (isAwsWafChallenge(text)) {
    process.stderr.write(`[deepseek] direct API blocked by WAF\n`);
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    process.stderr.write(
      `[deepseek] direct API returned non-JSON (first 200): ${text.slice(0, 200)}\n`,
    );
    return null;
  }

  // Always log the shape so we can refine the parser if walkAll misses.
  try {
    process.stderr.write(
      `[deepseek] direct API body (first 4000): ${JSON.stringify(parsed).slice(0, 4000)}\n`,
    );
  } catch {
    // ignore
  }

  const conv = conversationFromState(parsed, originalUrl);
  if (conv) {
    process.stderr.write(`[deepseek] direct API extracted ${conv.messages.length} msgs\n`);
    return conv;
  }
  process.stderr.write(`[deepseek] direct API parsed OK but conversationFromState returned null\n`);
  return null;
}
