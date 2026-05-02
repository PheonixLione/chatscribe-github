import * as cheerio from "cheerio";
import { fetchPage } from "./http";
import { renderPage } from "./headless";
import { htmlToMarkdown } from "./markdown";
import { walkAll } from "./json";
import {
  ExtractError,
  type ChatMessage,
  type Conversation,
  type SourceDescriptor,
} from "./types";

const SOURCE = "gemini" as const;

const isAllowedHost = (u: URL) => {
  const h = u.hostname.toLowerCase();
  return (
    h === "g.co" ||
    h === "gemini.google.com" ||
    h === "www.gemini.google.com"
  );
};

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
    // 1) Fast path: try the legacy SSR shell that used to embed
    //    AF_initDataCallback blocks. As of 2026 Q1 Google no longer
    //    inlines conversation data in the static HTML for share routes,
    //    but we keep this in case they bring it back or serve a cached
    //    older snapshot.
    let staticErr: ExtractError | null = null;
    try {
      const html = await fetchPage(url.toString(), {
        source: SOURCE,
        isAllowedHost,
      });
      const fromStatic = parseStaticHtml(html, url.toString());
      if (fromStatic) return fromStatic;
    } catch (err) {
      if (err instanceof ExtractError && err.code === "not_public") throw err;
      staticErr = err instanceof ExtractError ? err : null;
    }

    // 2) Headless render. Gemini share pages now hydrate the conversation
    //    via lazy XHR (`/_/BardChatUi/data/batchexecute?rpcids=ujx1Bf`).
    //    For long conversations this single XHR can be 2MB+ and takes
    //    20-60s on a slow link, so we use a generous budget and a
    //    "count-stable" predicate that waits until no new turns are
    //    appearing (the renderer streams in turns incrementally).
    try {
      const { html: rendered } = await renderPage(url.toString(), {
        source: SOURCE,
        // The conversation arrives via a single batchexecute XHR. Cold or
        // throttled clients (we have observed Google deliberately delaying
        // the response when many shares are fetched in a short window) can
        // take 80-100s before the XHR resolves. Once it does, the entire
        // conversation hydrates within ~1-2s. Give a generous 150s budget
        // so a single throttled request still succeeds rather than aborting
        // mid-flight.
        timeoutMs: 150_000,
        settleMs: 2000,
        waitFor: {
          fn: `
            // Auto-dismiss the "this app was created by another person"
            // disclaimer that some shares wrap the conversation with.
            var dialog = document.querySelector(
              "immersive-share-disclaimer-dialog, mat-dialog-container"
            );
            if (dialog) {
              var btns = dialog.querySelectorAll("button");
              for (var b = 0; b < btns.length; b++) {
                var label = (btns[b].textContent || "").trim().toLowerCase();
                if (
                  label === "continue" ||
                  label === "i agree" ||
                  label === "agree" ||
                  label === "accept" ||
                  label === "got it"
                ) {
                  btns[b].click();
                  return false;
                }
              }
            }

            // Short-circuit non-conversation outcomes so the caller can
            // produce a meaningful error without waiting for the full
            // render budget.
            var bodyText = (document.body && document.body.innerText) || "";
            if (/Link doesn'?t exist/i.test(bodyText)) return true;
            if (
              document.querySelector(
                "immersive-share-landing-page, web-preview"
              )
            ) {
              return true;
            }

            // Modern Gemini share DOM: <share-viewer> contains the chat
            // history with one <share-turn-viewer> per turn. Wait until
            // the turn count is stable across 3 polls (~1.5s) AND the
            // total transcript text length has not grown by more than a
            // tiny delta in the last poll (so the tail isn't still
            // actively streaming). Combining both signals catches the
            // common case where all turn containers appear in one batch
            // but their content hydrates progressively.
            var turns = document.querySelectorAll("share-turn-viewer");
            // Legacy / pre-modern selectors as a safety net.
            var legacy = document.querySelectorAll(
              "user-query, [data-test-id='user-query'], .user-query, " +
              "model-response, [data-test-id='model-response'], .model-response"
            );
            var count = turns.length || legacy.length;
            if (count === 0) {
              window.__gemTurnCount = 0;
              window.__gemTextLen = 0;
              window.__gemTurnStable = 0;
              return false;
            }
            var probe = turns.length ? turns : legacy;
            var textLen = 0;
            for (var i = 0; i < probe.length; i++) {
              textLen += (probe[i].textContent || "").length;
            }
            // Need at least one substantial turn before we even
            // consider stability (avoids stabilizing on empty shells).
            if (textLen < 40) return false;

            var prevCount = window.__gemTurnCount || 0;
            var prevTextLen = window.__gemTextLen || 0;
            var countStable = count === prevCount;
            // "Tail not streaming" = text grew by less than 0.5% (or 200
            // chars, whichever is larger) in the last poll. This tolerates
            // late-arriving DOM hydration without requiring an exact match.
            var growth = textLen - prevTextLen;
            var tolerance = Math.max(200, Math.floor(prevTextLen * 0.005));
            var textQuiet = growth >= 0 && growth <= tolerance;

            window.__gemTurnCount = count;
            window.__gemTextLen = textLen;

            if (countStable && textQuiet) {
              window.__gemTurnStable = (window.__gemTurnStable || 0) + 1;
              if (window.__gemTurnStable >= 3) return true;
              return false;
            }
            window.__gemTurnStable = 0;
            return false;
          `,
        },
      });

      const classified = classifyRendered(rendered);
      if (classified) throw classified;

      const conv = parseRenderedHtml(rendered, url.toString());
      if (conv) return conv;
    } catch (err) {
      if (err instanceof ExtractError) throw err;
      // fall through
    }

    if (staticErr) throw staticErr;
    throw new ExtractError(
      "parse_failed",
      "Could not parse the Gemini conversation. The share page format may have changed.",
      { source: SOURCE },
    );
  },
};

/**
 * Inspect a rendered Gemini share page that did not yield message turns
 * and translate well-known non-conversation outcomes into a meaningful
 * ExtractError.
 */
function classifyRendered(html: string): ExtractError | null {
  if (/Link doesn'?t exist/i.test(html)) {
    return new ExtractError(
      "not_public",
      "This Gemini share link no longer exists or was deleted.",
      { source: SOURCE },
    );
  }
  if (
    /<immersive-share-landing-page\b/i.test(html) ||
    /<web-preview\b/i.test(html)
  ) {
    return new ExtractError(
      "parse_failed",
      "This is a Gemini Canvas / Gem app share, not a chat conversation. Only conversation share links are supported.",
      { source: SOURCE },
    );
  }
  return null;
}

// ---------- Static HTML / AF_initDataCallback parsing (legacy) ----------

function parseStaticHtml(html: string, originalUrl: string): Conversation | null {
  const blocks = extractAfInitDataBlocks(html);
  for (const data of blocks) {
    const conv = findGeminiConversationFromAf(data);
    if (conv && conv.messages.length) {
      return {
        source: SOURCE,
        sourceLabel: "Gemini",
        title: conv.title,
        url: originalUrl,
        messages: conv.messages,
        extractedAt: new Date().toISOString(),
      };
    }
  }
  // Some shells (older A/B buckets, archived snapshots, fixtures) emit the
  // conversation directly in the SSR HTML using the same DOM the headless
  // parser handles. Try the DOM parser before paying the headless cost —
  // BUT only if this does not look like the modern Gemini hydration shell
  // (which contains <share-viewer> but is empty until the lazy XHR
  // resolves). Returning early on a partially-hydrated shell would yield
  // a truncated transcript.
  const looksLikeHydrationShell =
    /<share-viewer\b/i.test(html) && !/<share-turn-viewer\b/i.test(html);
  if (looksLikeHydrationShell) return null;
  return parseRenderedHtml(html, originalUrl);
}

function parseRenderedHtml(html: string, originalUrl: string): Conversation | null {
  const $ = cheerio.load(html);

  const messages: ChatMessage[] = [];

  // Modern shape (2026+): walk every <share-turn-viewer> in document order.
  // Each turn may contain a <user-query> (the question) and a
  // <response-container>/<message-content> (the answer). Some turns are
  // assistant-only (regenerations / tool turns), some are user-only
  // (in-flight). We emit whatever is present, preserving DOM order so the
  // conversation reads correctly.
  const turns = $("share-turn-viewer").toArray();
  if (turns.length) {
    for (const turn of turns) {
      const $turn = $(turn);

      const $userQuery = $turn.find("user-query").first();
      if ($userQuery.length) {
        // Prefer the .query-text-line paragraphs over the full user-query
        // textContent so we drop the screen-reader "You said" prefix and
        // the inline action buttons.
        const lines = $userQuery
          .find(".query-text-line, .query-text")
          .map((_, el) => $(el).text().trim())
          .get()
          .filter(Boolean);
        let userText = lines.join("\n\n").trim();
        if (!userText) {
          userText = htmlToMarkdown($userQuery.html() || "")
            .replace(/^You said\s*/i, "")
            .trim();
        }
        if (userText) {
          messages.push({ role: "user", content: userText });
        }
      }

      // The assistant turn lives inside .response-container > message-content.
      // A single turn can contain multiple message-content siblings (e.g.
      // tool output followed by a final answer, or regenerated responses),
      // so we collect ALL message-content nodes in DOM order. We must NOT
      // also collect descendant .markdown nodes from the same turn — they
      // typically live INSIDE message-content and would be captured twice
      // (once as part of message-content's html, once on their own). Only
      // fall back to .markdown if no message-content exists (older shells),
      // and to the whole response-container if neither is present.
      const responseChunks: string[] = [];
      let $blocks = $turn.find("response-container message-content");
      if (!$blocks.length) {
        $blocks = $turn.find("response-container .markdown");
      }
      if ($blocks.length) {
        $blocks.each((_, el) => {
          const chunk = htmlToMarkdown($(el).html() || "").trim();
          if (chunk) responseChunks.push(chunk);
        });
      } else {
        const fallback = htmlToMarkdown(
          $turn.find("response-container").first().html() || "",
        ).trim();
        if (fallback) responseChunks.push(fallback);
      }
      const responseText = responseChunks.join("\n\n").trim();
      if (responseText) {
        messages.push({ role: "assistant", content: responseText });
      }
    }
  }

  // Legacy fallback: pre-2026 DOM that exposed user-query / model-response
  // as top-level siblings. Kept so older fixtures and any A/B test bucket
  // still working with the old shell continue to extract.
  if (!messages.length) {
    const USER_SEL = "user-query, [data-test-id='user-query'], .user-query";
    const MODEL_SEL =
      "model-response, [data-test-id='model-response'], .model-response, message-content";
    $(`${USER_SEL}, ${MODEL_SEL}`).each((_, el) => {
      const tagName = ((el as { name?: string }).name ?? "").toLowerCase();
      const cls = $(el).attr("class") || "";
      const isUser =
        tagName === "user-query" ||
        $(el).is(USER_SEL) ||
        /user|query|prompt/i.test(cls);
      const inner =
        $(el).find(".markdown, .response-content, .query-text").first().html() ??
        $(el).html() ??
        "";
      const content = htmlToMarkdown(inner);
      if (!content.trim()) return;
      messages.push({ role: isUser ? "user" : "assistant", content });
    });
  }

  if (!messages.length) return null;

  // Title: prefer the in-page H1 (".share-title-section h1") since
  // <title> is the generic "Gemini - direct access to Google AI" for
  // share pages.
  const title =
    $(".share-title-section h1, share-viewer h1").first().text().trim() ||
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").first().text().trim() ||
    undefined;

  return {
    source: SOURCE,
    sourceLabel: "Gemini",
    title: title || undefined,
    url: originalUrl,
    messages,
    extractedAt: new Date().toISOString(),
  };
}

/**
 * Pull the `data` field out of every `AF_initDataCallback({key:'ds:N', ...})`
 * block in the SSR shell. These were the proto-shaped JSON arrays Google
 * used to hydrate WIZ-rendered apps. As of 2026 Q1 Gemini share pages no
 * longer emit these blocks (only the function symbol appears), but other
 * Google surfaces still use the format so we keep the legacy parser.
 */
function extractAfInitDataBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /AF_initDataCallback\s*\(\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const objStart = m.index + m[0].length - 1;
    const obj = sliceBalancedObject(html, objStart);
    if (!obj) continue;
    const dataField = extractDataField(obj);
    if (!dataField) continue;
    try {
      const parsed = JSON.parse(dataField);
      out.push(parsed);
    } catch {
      // skip malformed block
    }
  }
  return out;
}

function extractDataField(obj: string): string | null {
  const re = /(?:^|[,{])\s*['"]?data['"]?\s*:\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(obj))) {
    const valueStart = m.index + m[0].length;
    const c = obj[valueStart];
    if (c !== "[" && c !== "{") continue;
    const value = sliceBalancedValue(obj, valueStart);
    if (value) return value;
  }
  return null;
}

function sliceBalancedValue(text: string, start: number): string | null {
  const open = text[start];
  const close = open === "[" ? "]" : open === "{" ? "}" : "";
  if (!close) return null;
  let depth = 0;
  let inStr = false;
  let quote = '"';
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) {
        esc = false;
      } else if (c === "\\") {
        esc = true;
      } else if (c === quote) {
        inStr = false;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = true;
      quote = c;
      continue;
    }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function sliceBalancedObject(text: string, atIndex: number): string | null {
  return sliceBalancedValue(text, atIndex);
}

interface FoundConv {
  title?: string;
  messages: ChatMessage[];
}

function findGeminiConversationFromAf(data: unknown): FoundConv | null {
  const candidates = collectCandidateStrings(data);
  if (!candidates.length) return null;
  const filtered = candidates.filter((s) => {
    const t = s.trim();
    if (t.length < 2) return false;
    if (/^[A-Z0-9_]{8,}$/.test(t)) return false;
    if (/^https?:\/\/\S+$/.test(t) && t.length < 120) return false;
    return true;
  });
  if (!filtered.length) return null;

  const messages: ChatMessage[] = [];
  for (let i = 0; i < filtered.length; i++) {
    const raw = filtered[i];
    const looksHtml = /<\/?[a-z][\s\S]*?>/i.test(raw);
    const content = looksHtml ? htmlToMarkdown(raw) : raw.trim();
    if (!content) continue;
    messages.push({
      role: i % 2 === 0 ? "user" : "assistant",
      content,
    });
  }
  if (!messages.length) return null;
  return { messages };
}

function collectCandidateStrings(data: unknown): string[] {
  const out: string[] = [];
  const visit = (node: unknown) => {
    if (typeof node === "string") {
      const trimmed = node.trim();
      if (!trimmed) return;
      const looksLikeBody =
        /<\/?[a-z][\s\S]*?>/i.test(trimmed) ||
        /\n/.test(trimmed) ||
        trimmed.length > 40;
      if (looksLikeBody) {
        if (!/[∞∰]/.test(trimmed)) out.push(trimmed);
      }
      return;
    }
    if (Array.isArray(node)) {
      for (const v of node) visit(v);
      return;
    }
    if (node && typeof node === "object") {
      for (const v of Object.values(node)) visit(v);
    }
  };
  visit(data);
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const s of out) {
    const key = s.length > 200 ? s.slice(0, 200) : s;
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(s);
  }
  return uniq;
}

export { walkAll };
