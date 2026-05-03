import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { fetchPage } from "./http";
import { renderPage } from "./headless";
import { htmlToMarkdown } from "./markdown";
import { getArray, getString, isObject, walk } from "./json";
import {
  ExtractError,
  isUnrecoverable,
  type ChatMessage,
  type Conversation,
  type SourceDescriptor,
} from "./types";

const SOURCE = "grok" as const;

export const grok: SourceDescriptor = {
  source: SOURCE,
  label: "Grok",
  urlPatterns: [
    "https://grok.com/share/<id>",
    "https://x.com/i/grok/share/<id>",
  ],
  example: "https://grok.com/share/abcd1234",
  matches(url) {
    const h = url.hostname.toLowerCase();
    if ((h === "grok.com" || h === "www.grok.com") && url.pathname.includes("/share/"))
      return true;
    if ((h === "x.com" || h === "twitter.com") && url.pathname.includes("/grok/share/"))
      return true;
    return false;
  },
  async extract(url) {
    // 1) Static fast path. Older Grok shares (and our fixture) embed the
    //    conversation in `__NEXT_DATA__`. Modern grok.com responses ship
    //    a streamed RSC payload that contains feature flags but NOT the
    //    transcript, so this path will return null and we'll fall through
    //    to the headless render below.
    let staticErr: ExtractError | null = null;
    try {
      const html = await fetchPage(url.toString(), {
        source: SOURCE,
        isAllowedHost: (u) => grok.matches(u),
      });
      const conv = parseStaticHtml(html, url.toString());
      if (conv) return conv;
    } catch (err) {
      if (err instanceof ExtractError) {
        if (isUnrecoverable(err)) throw err;
        staticErr = err;
      }
    }

    // 2) Headless render. Grok hydrates the transcript client-side and
    //    exposes two stable hooks: `[data-testid="user-message"]` for
    //    human turns and `[data-testid="assistant-message"]` for model
    //    turns. We wait until at least one assistant turn has text so we
    //    don't capture a half-hydrated shell.
    try {
      const { html } = await renderPage(url.toString(), {
        source: SOURCE,
        timeoutMs: 90_000,
        // Trimmed from 2500 ms — once messages appear Grok hydration
        // completes within ~500 ms.
        settleMs: 1000,
        onJsonResponse: (respUrl) => {
          // Diagnostic: surface any candidate share-content endpoint so
          // we can wire a direct API call (mirroring DeepSeek/ChatGPT).
          if (
            respUrl.includes("grok.com/") ||
            (respUrl.includes("/api/") && respUrl.includes("share"))
          ) {
            process.stderr.write(`[grok] intercepted ${respUrl}\n`);
          }
        },
        waitFor: {
          // Wait until any conversation content is hydrated. We probe two
          // independent signals because Grok occasionally delays
          // `data-testid` attribute hydration on shares that include
          // images: (1) a `.response-content-markdown` body has real
          // text, or (2) any `[data-testid="user-message"]` /
          // `[data-testid="assistant-message"]` element has real text.
          // Either is sufficient for the cheerio parser downstream.
          fn: `
            var md = document.querySelectorAll('.response-content-markdown');
            for (var i = 0; i < md.length; i++) {
              if ((md[i].textContent || "").trim().length > 5) return true;
            }
            var bubbles = document.querySelectorAll('[data-testid="user-message"], [data-testid="assistant-message"]');
            for (var j = 0; j < bubbles.length; j++) {
              if ((bubbles[j].textContent || "").trim().length > 5) return true;
            }
            return false;
          `,
        },
      });
      const conv = parseRenderedHtml(html, url.toString());
      if (conv) return conv;
    } catch (err) {
      if (isUnrecoverable(err)) throw err;
      // fall through
    }

    if (staticErr) throw staticErr;
    throw new ExtractError(
      "parse_failed",
      "Could not parse the Grok conversation. The share page format may have changed.",
      { source: SOURCE },
    );
  },
};

/**
 * Try the legacy `__NEXT_DATA__` path used by older Grok deployments and
 * by our test fixture. As a last-resort it also tries to scrape any
 * inline JSON-ish blob that looks like a transcript. Returns null if no
 * transcript can be recovered — the caller will then try the headless
 * render.
 */
function parseStaticHtml(html: string, originalUrl: string): Conversation | null {
  const $ = cheerio.load(html);

  const next = $("script#__NEXT_DATA__").first().text();
  if (next) {
    try {
      const data: unknown = JSON.parse(next);
      const conv = findGrokConversation(data);
      if (conv) {
        return {
          source: SOURCE,
          sourceLabel: "Grok",
          title: conv.title,
          url: originalUrl,
          messages: conv.messages,
          extractedAt: new Date().toISOString(),
        };
      }
    } catch {
      // fall through
    }
  }

  for (const s of $("script").toArray()) {
    const text = $(s).text();
    if (!text) continue;
    if (
      (text.includes('"sender"') || text.includes('"role"')) &&
      text.includes('"message"') &&
      text.length > 200
    ) {
      const conv = scrapeArrayLike(text);
      if (conv && conv.messages.length) {
        return {
          source: SOURCE,
          sourceLabel: "Grok",
          title: conv.title,
          url: originalUrl,
          messages: conv.messages,
          extractedAt: new Date().toISOString(),
        };
      }
    }
  }

  // If the rendered DOM happens to be in the static body (cached/SSR
  // snapshot), pick it up here too.
  return parseRenderedHtml(html, originalUrl);
}

/**
 * Parse a fully-hydrated Grok share page. Walks `[data-testid="user-message"]`
 * and `[data-testid="assistant-message"]` in document order, extracting
 * the inner `.response-content-markdown` block (Grok renders both user
 * and assistant turns as markdown) and falling back to the bubble's
 * own HTML when no nested markdown wrapper is present.
 *
 * De-dupes by DOM ancestry: nested testid wrappers (which Grok occasionally
 * renders for tool/code blocks inside an assistant turn) are skipped if
 * an ancestor was already emitted.
 */
function parseRenderedHtml(html: string, originalUrl: string): Conversation | null {
  const $ = cheerio.load(html);
  const messages: ChatMessage[] = [];
  const emitted = new Set<Element>();

  const candidates = $(
    '[data-testid="user-message"], [data-testid="assistant-message"]',
  ).toArray();

  for (const el of candidates) {
    if (hasEmittedAncestor(el, emitted)) continue;
    const testid = $(el).attr("data-testid") || "";
    const role: ChatMessage["role"] =
      testid === "user-message" ? "user" : "assistant";

    // Prefer the markdown body when present, otherwise the bubble itself.
    const md = $(el).find(".response-content-markdown").first();
    const bubble = $(el).find(".message-bubble").first();
    const innerHtml =
      (md.length && md.html()) ||
      (bubble.length && bubble.html()) ||
      $(el).html() ||
      "";
    const content = htmlToMarkdown(innerHtml).trim();
    if (!content) continue;

    messages.push({ role, content });
    emitted.add(el);
  }

  if (!messages.length) return null;

  // Title: Grok's <title> tag concatenates several spans during hydration
  // (e.g. "Foo | Shared Grok ConversationFoo | …Back ButtonSearch Icon").
  // We split on the canonical " | Shared Grok Conversation" suffix and
  // return the first segment.
  const rawTitle = $("title").first().text().trim();
  let title: string | undefined = rawTitle;
  const sepIdx = rawTitle.indexOf(" | Shared Grok Conversation");
  if (sepIdx >= 0) title = rawTitle.slice(0, sepIdx).trim();
  if (title) {
    title = title.replace(/\s*\|\s*Grok\s*$/i, "").trim();
  }

  return {
    source: SOURCE,
    sourceLabel: "Grok",
    title: title || undefined,
    url: originalUrl,
    messages,
    extractedAt: new Date().toISOString(),
  };
}

function hasEmittedAncestor(el: Element, emitted: Set<Element>): boolean {
  let cur: Element | null = el.parent as Element | null;
  while (cur && cur.type === "tag") {
    if (emitted.has(cur)) return true;
    cur = (cur.parent as Element | null) ?? null;
  }
  return false;
}

interface FoundConv {
  title?: string;
  messages: ChatMessage[];
}

function firstSenderOrRole(arr: unknown[]): boolean {
  const first = arr[0];
  if (!isObject(first)) return false;
  return Boolean(getString(first, "sender") || getString(first, "role"));
}

function findGrokConversation(data: unknown): FoundConv | null {
  const found = walk(data, (v) => {
    if (getArray(v, "responses")) return v;
    const messages = getArray(v, "messages");
    if (messages && messages.length && firstSenderOrRole(messages)) return v;
    return null;
  });
  if (!isObject(found)) return null;
  const arr = getArray(found, "messages") ?? getArray(found, "responses") ?? [];
  const messages: ChatMessage[] = [];
  for (const m of arr) {
    if (!isObject(m)) continue;
    const sender = (getString(m, "sender") || getString(m, "role") || "").toLowerCase();
    const role: ChatMessage["role"] =
      sender === "human" || sender === "user"
        ? "user"
        : "assistant";

    let content =
      getString(m, "message") ||
      getString(m, "text") ||
      getString(m, "content") ||
      "";
    if (!content) {
      const contentArr = getArray(m, "content");
      if (contentArr) {
        content = contentArr
          .map((c) => {
            if (typeof c === "string") return c;
            if (isObject(c)) return getString(c, "text") || "";
            return "";
          })
          .filter(Boolean)
          .join("\n\n");
      }
    }
    const trimmed = content.trim();
    if (!trimmed) continue;
    messages.push({ role, content: trimmed });
  }
  if (!messages.length) return null;
  const title = getString(found, "title");
  return { title, messages };
}

function scrapeArrayLike(text: string): FoundConv | null {
  const candidates: ChatMessage[] = [];
  const re =
    /"(?:sender|role)"\s*:\s*"([a-z_]+)"[^{}]*?"(?:message|text|content)"\s*:\s*"((?:\\.|[^"\\])*)"/gi;
  for (const m of text.matchAll(re)) {
    const sender = (m[1] || "").toLowerCase();
    const raw = m[2] || "";
    const role: ChatMessage["role"] =
      sender === "human" || sender === "user" ? "user" : "assistant";
    let content = "";
    try {
      const parsed: unknown = JSON.parse(`"${raw}"`);
      if (typeof parsed === "string") content = parsed;
    } catch {
      content = raw;
    }
    if (content.trim()) candidates.push({ role, content: content.trim() });
  }
  if (!candidates.length) return null;
  return { messages: candidates };
}
