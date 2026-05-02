import { ExtractError, type ChatSource } from "./types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Hard cap on the size of a remote response body. Pages larger than this
 * are rejected before they can pin server memory.
 */
export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

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
  /** Maximum bytes to read from a single response. Defaults to MAX_RESPONSE_BYTES. */
  maxBytes?: number;
}

export async function fetchPage(
  url: string,
  opts: FetchOptions,
): Promise<string> {
  const maxRedirects = opts.maxRedirects ?? 5;
  const maxBytes = opts.maxBytes ?? MAX_RESPONSE_BYTES;
  let current = url;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    let target: URL;
    try {
      target = new URL(current);
    } catch {
      // Status 400 marks this as a deterministic URL-policy failure
      // (see `isUnrecoverable` in ./types). Without it, the per-extractor
      // fallback chain would burn ~90s on a doomed headless retry.
      throw new ExtractError(
        "fetch_failed",
        "Invalid redirect target.",
        { source: opts.source, status: 400 },
      );
    }
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      throw new ExtractError(
        "fetch_failed",
        "Refused to follow a non-http(s) redirect.",
        { source: opts.source, status: 400 },
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
          { source: opts.source, status: 400 },
        );
      }
      current = new URL(loc, target).toString();
      continue;
    }

    return await handleResponse(res, opts.source, maxBytes);
  }

  throw new ExtractError(
    "fetch_failed",
    "Too many redirects.",
    { source: opts.source, status: 400 },
  );
}

async function handleResponse(
  res: Response,
  source: ChatSource,
  maxBytes: number,
): Promise<string> {

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

  // Reject up front when the server advertises a body larger than our cap.
  const contentLength = res.headers.get("content-length");
  if (contentLength) {
    const declared = Number.parseInt(contentLength, 10);
    if (Number.isFinite(declared) && declared > maxBytes) {
      // Drain quietly so we don't leave the socket hanging.
      try {
        await res.body?.cancel();
      } catch {
        // ignore
      }
      throw new ExtractError(
        "fetch_failed",
        `That page is too large to process (over ${formatMb(maxBytes)}).`,
        { source, status: 413 },
      );
    }
  }

  const body = await readBodyWithCap(res, maxBytes, source);
  detectPrivateOrMissing(body, source);
  return body;
}

async function readBodyWithCap(
  res: Response,
  maxBytes: number,
  source: ChatSource,
): Promise<string> {
  // Stream the body so we can abort once we cross the cap, instead of letting
  // the runtime buffer an arbitrarily large response into memory.
  if (!res.body) {
    return "";
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      received += value.byteLength;
      if (received > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // ignore
        }
        throw new ExtractError(
          "fetch_failed",
          `That page is too large to process (over ${formatMb(maxBytes)}).`,
          { source, status: 413 },
        );
      }
      chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
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
