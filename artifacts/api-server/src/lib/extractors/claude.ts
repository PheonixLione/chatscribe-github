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

const SOURCE = "claude" as const;

const isAllowedHost = (u: URL) => {
  const h = u.hostname.toLowerCase();
  return h === "claude.ai" || h === "www.claude.ai";
};

export const claude: SourceDescriptor = {
  source: SOURCE,
  label: "Claude",
  urlPatterns: ["https://claude.ai/share/<id>"],
  example: "https://claude.ai/share/abcd-1234",
  matches(url) {
    return isAllowedHost(url) && url.pathname.startsWith("/share/");
  },
  async extract(url) {
    // 1) Static fast path. Claude.ai is normally fronted by Cloudflare's
    //    "Just a moment..." managed challenge, so this almost always falls
    //    through to the headless path — but if a cache or proxy returns the
    //    real HTML we can skip the browser entirely.
    let staticErr: ExtractError | null = null;
    try {
      const html = await fetchPage(url.toString(), {
        source: SOURCE,
        isAllowedHost,
      });
      if (!isCloudflareChallenge(html)) {
        const conv = parseStaticHtml(html, url.toString());
        if (conv) return conv;
      }
    } catch (err) {
      // Cloudflare can serve the challenge as 401/403 with no body, which
      // http.ts maps to `not_public`. Don't trust that classification for
      // Claude — the headless render distinguishes a real deleted page
      // (which returns 404 in-browser too) from a CF gate. Only a 404/410
      // from the static path is treated as definitively gone.
      // We also fail fast on `unsupported_url` (e.g. a redirect that
      // hopped off the allowlist) since a headless render would hit the
      // same allowlist when it followed the same redirect.
      if (err instanceof ExtractError) {
        if (err.code === "unsupported_url") throw err;
        if (err.code === "not_public" && err.status === 404) throw err;
        if (
          err.code === "fetch_failed" &&
          (err.status === 400 || err.status === 413)
        ) {
          throw err;
        }
        staticErr = err;
      }
    }

    // 2) Headless render. The Cloudflare challenge auto-clears once the
    //    page proves it can run real JS, then React hydrates the
    //    transcript. We wait for at least one user-message bubble.
    try {
      const { html } = await renderPage(url.toString(), {
        source: SOURCE,
        timeoutMs: 90_000,
        // Claude hydrates within ~200 ms once Cloudflare clears.
        // Trimmed from 1500 ms to 800 ms.
        settleMs: 800,
        responseUrlIncludes: ["/api/", "share"],
        onJsonResponse: (respUrl) => {
          // Diagnostic: surface any unauthenticated share-content endpoint
          // Claude may expose so we can wire a direct API call later.
          if (respUrl.includes("/api/") && respUrl.includes("share")) {
            process.stderr.write(`[claude] intercepted ${respUrl}\n`);
          }
        },
        waitFor: {
          fn: `
            if (/just a moment|verifying|cloudflare/i.test(document.title || "")) return false;
            var users = document.querySelectorAll('[data-testid="user-message"]');
            var assistants = document.querySelectorAll('div[class*="font-claude"]');
            return users.length > 0 || assistants.length > 0;
          `,
        },
      });
      const conv = parseRenderedHtml(html, url.toString());
      if (conv) return conv;
    } catch (err) {
      if (err instanceof ExtractError) throw err;
      // fall through
    }

    if (staticErr) throw staticErr;
    throw new ExtractError(
      "parse_failed",
      "Could not parse the Claude conversation. The share page format may have changed.",
      { source: SOURCE },
    );
  },
};

function isCloudflareChallenge(html: string): boolean {
  // The "Just a moment..." interstitial is small and inlines a
  // `_cf_chl_opt` blob. Real share pages are much larger and don't
  // contain that token.
  return (
    html.length < 50_000 &&
    /_cf_chl_opt|cf-mitigated|just a moment|cf-turnstile-response/i.test(html)
  );
}

interface ParsedConv {
  title?: string;
  messages: ChatMessage[];
}

/**
 * Parse a fully-rendered Claude share page. The transcript uses two
 * stable hooks: `[data-testid="user-message"]` for human turns and a
 * class containing "font-claude" for assistant turns. We collect every
 * matching element in document order so multi-turn conversations stay
 * correctly interleaved.
 *
 * Both selectors can match nested wrappers (e.g. an assistant turn that
 * contains another `font-claude` styled child for code blocks), so we
 * de-dupe by DOM ancestry: if a candidate's ancestor chain already
 * contains an emitted element we skip it. This is robust to identical
 * adjacent turns (which a content-only de-dupe would incorrectly drop).
 */
function parseRenderedHtml(html: string, originalUrl: string): Conversation | null {
  const $ = cheerio.load(html);
  const messages: ChatMessage[] = [];
  const emitted = new Set<Element>();

  const candidates = $('[data-testid="user-message"], div[class*="font-claude"]').toArray();
  for (const el of candidates) {
    if (hasEmittedAncestor(el, emitted)) continue;

    const $el = $(el);
    const isUser = $el.attr("data-testid") === "user-message";
    const content = htmlToMarkdown($el.html() || "").trim();
    if (!content) continue;

    emitted.add(el);
    messages.push({ role: isUser ? "user" : "assistant", content });
  }

  if (!messages.length) return null;

  const title = parseTitle($);
  return {
    source: SOURCE,
    sourceLabel: "Claude",
    title,
    url: originalUrl,
    messages,
    extractedAt: new Date().toISOString(),
  };
}

function hasEmittedAncestor(el: Element, emitted: Set<Element>): boolean {
  let cur = el.parent;
  while (cur) {
    if (cur.type === "tag" && emitted.has(cur as Element)) return true;
    cur = cur.parent;
  }
  return false;
}

/**
 * Parse a non-challenged static response. Tries the embedded JSON blobs
 * first, then falls back to the same DOM hooks the rendered parser uses.
 */
function parseStaticHtml(html: string, originalUrl: string): Conversation | null {
  const $ = cheerio.load(html);

  const next = $("script#__NEXT_DATA__").first().text();
  if (next) {
    try {
      const data: unknown = JSON.parse(next);
      const conv = findClaudeConversation(data);
      if (conv) {
        return {
          source: SOURCE,
          sourceLabel: "Claude",
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
    if (!text || text.length < 50) continue;
    if (
      text.includes('"sender"') &&
      text.includes('"text"') &&
      text.includes('"chat_messages"')
    ) {
      const conv = tryExtractFromScript(text);
      if (conv) {
        return {
          source: SOURCE,
          sourceLabel: "Claude",
          title: conv.title,
          url: originalUrl,
          messages: conv.messages,
          extractedAt: new Date().toISOString(),
        };
      }
    }
  }

  return parseRenderedHtml(html, originalUrl);
}

function parseTitle($: cheerio.CheerioAPI): string | undefined {
  const t = $("title").first().text().replace(/\s*-\s*Claude\s*$/i, "").trim();
  return t || undefined;
}

function findClaudeConversation(data: unknown): ParsedConv | null {
  const found = walk(data, (v) => (getArray(v, "chat_messages") ? v : null));
  if (!isObject(found)) return null;
  return parseClaudeMessages(found);
}

function tryExtractFromScript(text: string): ParsedConv | null {
  const matches = text.matchAll(/\{[^{}]*"chat_messages"\s*:\s*\[/g);
  for (const m of matches) {
    const start = m.index ?? 0;
    const obj = sliceBalancedObject(text, start);
    if (!obj) continue;
    try {
      const parsed: unknown = JSON.parse(obj);
      if (isObject(parsed)) {
        const conv = parseClaudeMessages(parsed);
        if (conv) return conv;
      }
    } catch {
      // try next
    }
  }
  return null;
}

function sliceBalancedObject(text: string, atIndex: number): string | null {
  let start = atIndex;
  while (start >= 0 && text[start] !== "{") start--;
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) {
        esc = false;
      } else if (c === "\\") {
        esc = true;
      } else if (c === '"') {
        inStr = false;
      }
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function parseClaudeMessages(obj: Record<string, unknown>): ParsedConv | null {
  const msgs = getArray(obj, "chat_messages");
  if (!msgs) return null;
  const messages: ChatMessage[] = [];
  for (const raw of msgs) {
    if (!isObject(raw)) continue;
    const senderField = getString(raw, "sender");
    const roleField = getString(raw, "role");
    const sender =
      senderField || (roleField === "human" ? "human" : roleField) || "";
    const role: ChatMessage["role"] =
      sender === "human" || sender === "user" ? "user" : "assistant";

    let content = "";
    const contentArr = getArray(raw, "content");
    if (contentArr) {
      content = contentArr
        .map((c) => {
          if (typeof c === "string") return c;
          if (isObject(c)) {
            const type = getString(c, "type");
            const text = getString(c, "text");
            if ((type === "text" || !type) && text) return text;
          }
          return "";
        })
        .filter(Boolean)
        .join("\n\n");
    } else {
      content = getString(raw, "text") || getString(raw, "content") || "";
    }
    content = content.trim();
    if (!content) continue;
    messages.push({ role, content });
  }
  if (!messages.length) return null;
  const title = getString(obj, "name") ?? getString(obj, "title");
  return { title, messages };
}
