import * as cheerio from "cheerio";
import type { Element } from "domhandler";
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
    // 1) Fast path: fetch the SSR shell and parse the AF_initDataCallback
    //    blocks Google bakes into the HTML. This avoids paying for a full
    //    headless render on the common case.
    let html: string | null = null;
    let staticErr: ExtractError | null = null;
    try {
      html = await fetchPage(url.toString(), { source: SOURCE, isAllowedHost });
      const fromStatic = parseStaticHtml(html, url.toString());
      if (fromStatic) return fromStatic;
    } catch (err) {
      if (err instanceof ExtractError && err.code === "not_public") throw err;
      staticErr = err instanceof ExtractError ? err : null;
    }

    // 2) Fallback: render with a headless browser, wait for Gemini's
    //    custom elements, then walk the DOM.
    try {
      const { html: rendered } = await renderPage(url.toString(), {
        source: SOURCE,
        timeoutMs: 45_000,
        settleMs: 1200,
        waitFor: {
          fn: `
            // Some shares ("This app was created by another person") show a
            // disclaimer dialog blocking the conversation. Click through it
            // automatically. The polling re-runs us every 500ms, so the
            // very next tick will see the real content.
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
            // Stop early if the page has resolved into a non-conversation
            // state we cannot extract (dead link, Canvas/Gem app share).
            // Returning true short-circuits the wait; the caller then runs
            // its own classification on the rendered HTML.
            var bodyText = (document.body && document.body.innerText) || "";
            if (/Link doesn'?t exist/i.test(bodyText)) return true;
            if (document.querySelector("immersive-share-landing-page, web-preview")) {
              return true;
            }
            var sel = "user-query, [data-test-id='user-query'], .user-query, " +
              "model-response, [data-test-id='model-response'], .model-response, " +
              "message-content";
            var els = document.querySelectorAll(sel);
            for (var i = 0; i < els.length; i++) {
              if ((els[i].textContent || "").trim().length > 5) return true;
            }
            return false;
          `,
        },
      });

      // Classify non-conversation outcomes *before* trying to parse turns,
      // so the caller gets an actionable error instead of "parse_failed".
      const classified = classifyRendered(rendered);
      if (classified) throw classified;

      const conv = parseRenderedHtml(rendered, url.toString());
      if (conv) return conv;
    } catch (err) {
      if (err instanceof ExtractError) throw err;
      // fall through to final error
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
 * ExtractError. Returns null when the page looks like it should contain a
 * conversation we just failed to parse.
 */
function classifyRendered(html: string): ExtractError | null {
  // "Link doesn't exist / The link might have been deleted..." dialog.
  if (/Link doesn'?t exist/i.test(html)) {
    return new ExtractError(
      "not_public",
      "This Gemini share link no longer exists or was deleted.",
      { source: SOURCE },
    );
  }
  // Canvas / Gem (interactive app) shares use a different surface and
  // don't contain a regular conversation. Detect their custom elements.
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

// ---------- Static HTML / AF_initDataCallback parsing ----------

function parseStaticHtml(html: string, originalUrl: string): Conversation | null {
  const blocks = extractAfInitDataBlocks(html);
  for (const data of blocks) {
    const conv = findGeminiConversation(data);
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
  return null;
}

function parseRenderedHtml(html: string, originalUrl: string): Conversation | null {
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

    // Prefer the inner markdown body if present so we don't pick up the
    // surrounding chrome (avatars, action buttons, etc.).
    const inner =
      $(el).find(".markdown, .response-content, .query-text").first().html() ??
      $(el).html() ??
      "";
    const content = htmlToMarkdown(inner);
    if (!content.trim()) return;
    messages.push({ role: isUser ? "user" : "assistant", content });
  });

  if (!messages.length) return null;

  const title =
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
 * block in the SSR shell. These are the proto-shaped JSON arrays Google
 * uses to hydrate its WIZ-rendered apps.
 */
function extractAfInitDataBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  // Match the function call regardless of whitespace; we then slice the
  // balanced object literal that follows.
  const re = /AF_initDataCallback\s*\(\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const objStart = m.index + m[0].length - 1; // position of '{'
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

/**
 * AF_initDataCallback object literals are JS object syntax, not strict JSON
 * (unquoted keys, single quotes, etc.). We don't need to fully parse them —
 * we only want the `data:` value, which is itself valid JSON because Google
 * serializes it from a proto. Find `data:` then balance-slice the value.
 */
function extractDataField(obj: string): string | null {
  // Look for `data` as an unquoted key followed by a colon.
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

// ---------- Heuristic conversation walker ----------

interface FoundConv {
  title?: string;
  messages: ChatMessage[];
}

/**
 * Walk a parsed AF_initDataCallback `data` payload looking for the
 * conversation turns. Gemini's shape varies between deployments and the
 * arrays are anonymous (proto-derived), so we identify message text via
 * structural heuristics rather than fixed indices:
 *
 *   - A message body shows up as a string ≥ a few characters long that
 *     either contains HTML/markdown or is the only string in its parent
 *     array.
 *   - Turns alternate user → model. The user-query text is typically the
 *     shorter of an adjacent pair, the model response the longer.
 *
 * We collect all candidate strings in document order and then pair them
 * up; this is resilient to indexing churn while still preserving order.
 */
function findGeminiConversation(data: unknown): FoundConv | null {
  const candidates = collectCandidateStrings(data);
  if (!candidates.length) return null;

  // Drop obvious non-message strings (very short, all-uppercase IDs, urls).
  const filtered = candidates.filter((s) => {
    const t = s.trim();
    if (t.length < 2) return false;
    if (/^[A-Z0-9_]{8,}$/.test(t)) return false;
    if (/^https?:\/\/\S+$/.test(t) && t.length < 120) return false;
    return true;
  });
  if (!filtered.length) return null;

  // Heuristic: turns alternate user/model. Even index = user, odd = assistant.
  // Convert any embedded HTML to markdown.
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

/**
 * Collect strings inside the proto data tree that look like message bodies.
 * We treat a string as a candidate when it sits inside an array whose first
 * element is a role-like marker (`"user"`, `"model"`, integer 0/1) or when
 * it contains HTML/markdown formatting.
 */
function collectCandidateStrings(data: unknown): string[] {
  const out: string[] = [];

  const visit = (node: unknown, parent: unknown[] | null, _idx: number) => {
    if (typeof node === "string") {
      const trimmed = node.trim();
      if (!trimmed) return;
      // Strings containing HTML tags or newlines are very likely message
      // bodies. Bare alphanumeric short strings (IDs, tokens) are skipped.
      const looksLikeBody =
        /<\/?[a-z][\s\S]*?>/i.test(trimmed) ||
        /\n/.test(trimmed) ||
        trimmed.length > 40;
      if (looksLikeBody) {
        // Avoid picking up the page-wide hardcoded landing-page strings
        // (e.g. the "DnVkpd" demo prompts in WIZ_global_data). Those use
        // a "∞" / "∰" delimiter format we can recognize.
        if (!/[∞∰]/.test(trimmed)) {
          out.push(trimmed);
        }
      }
      return;
    }
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) visit(node[i], node, i);
      return;
    }
    if (node && typeof node === "object") {
      for (const v of Object.values(node)) visit(v, null, 0);
    }
  };

  visit(data, null, 0);

  // De-duplicate while preserving order; some payloads include the same
  // turn twice (rendered + plain text representations).
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

// Re-export so other modules don't have to import json helpers separately.
export { walkAll };
