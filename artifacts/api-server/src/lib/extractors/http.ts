import { ExtractError, type ChatSource } from "./types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export interface FetchOptions {
  source: ChatSource;
  headers?: Record<string, string>;
  timeoutMs?: number;
  acceptJson?: boolean;
  /**
   * Predicate used to validate every redirect target (and the final URL)
   * against the per-source allowlist. Prevents redirect-based SSRF where a
   * supported short link (e.g. g.co) bounces to an arbitrary host.
   */
  isAllowedHost: (url: URL) => boolean;
  /** Maximum number of redirects to follow. Defaults to 5. */
  maxRedirects?: number;
}

export async function fetchPage(
  url: string,
  opts: FetchOptions,
): Promise<string> {
  const maxRedirects = opts.maxRedirects ?? 5;
  let current = url;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    let target: URL;
    try {
      target = new URL(current);
    } catch {
      throw new ExtractError(
        "fetch_failed",
        "Invalid redirect target.",
        { source: opts.source },
      );
    }
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      throw new ExtractError(
        "fetch_failed",
        "Refused to follow a non-http(s) redirect.",
        { source: opts.source },
      );
    }
    if (!opts.isAllowedHost(target)) {
      throw new ExtractError(
        "unsupported_url",
        "The share link redirected outside the supported platform.",
        { source: opts.source, status: 400 },
      );
    }

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15000);
    let res: Response;
    try {
      res = await fetch(target, {
        headers: {
          "User-Agent": UA,
          Accept: opts.acceptJson
            ? "application/json,text/html;q=0.9,*/*;q=0.8"
            : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          ...opts.headers,
        },
        signal: ctrl.signal,
        redirect: "manual",
      });
    } catch (err) {
      clearTimeout(t);
      throw new ExtractError(
        "fetch_failed",
        `Could not reach the share link (${(err as Error).message}).`,
        { source: opts.source },
      );
    }
    clearTimeout(t);

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) {
        throw new ExtractError(
          "fetch_failed",
          "Received a redirect without a destination.",
          { source: opts.source },
        );
      }
      current = new URL(loc, target).toString();
      continue;
    }

    return await handleResponse(res, opts.source);
  }

  throw new ExtractError(
    "fetch_failed",
    "Too many redirects.",
    { source: opts.source },
  );
}

async function handleResponse(res: Response, source: ChatSource): Promise<string> {

  if (res.status === 404 || res.status === 410) {
    throw new ExtractError(
      "not_public",
      "This share link no longer exists or was deleted.",
      { source },
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new ExtractError(
      "not_public",
      "This conversation is private and requires login to view.",
      { source },
    );
  }
  if (!res.ok) {
    throw new ExtractError(
      "fetch_failed",
      `The remote site responded with status ${res.status}.`,
      { source },
    );
  }
  const body = await res.text();
  detectPrivateOrMissing(body, source);
  return body;
}

const PRIVATE_MARKERS: RegExp[] = [
  /sign in to (?:view|continue)/i,
  /this (?:conversation|chat|page|share) (?:is|has been) (?:private|deleted|removed|unavailable|no longer)/i,
  /not found|page not found|page doesn't exist/i,
  /log ?in to (?:view|access|continue)/i,
];

function detectPrivateOrMissing(html: string, source: ChatSource): void {
  // Cheap heuristic — only inspects the first 8KB to avoid scanning huge pages.
  const sample = html.slice(0, 8192);
  // Look only at <title>/<h1>/meta description areas to keep false positives low.
  const headMatch = sample.match(/<title[^>]*>([^<]{0,200})<\/title>/i);
  const title = headMatch?.[1] ?? "";
  if (!title) return;
  for (const re of PRIVATE_MARKERS) {
    if (re.test(title)) {
      throw new ExtractError(
        "not_public",
        "This conversation is private, deleted, or requires login to view.",
        { source },
      );
    }
  }
}
