export type ChatRole = "user" | "assistant" | "system" | "tool";

export type ChatSource =
  | "chatgpt"
  | "claude"
  | "gemini"
  | "grok"
  | "perplexity"
  | "deepseek";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  model?: string;
}

export interface Conversation {
  source: ChatSource;
  sourceLabel: string;
  title?: string;
  url: string;
  messages: ChatMessage[];
  extractedAt: string;
}

export type ExtractErrorCode =
  | "unsupported_url"
  | "not_public"
  | "fetch_failed"
  | "parse_failed";

export class ExtractError extends Error {
  code: ExtractErrorCode;
  source?: ChatSource;
  status: number;

  constructor(
    code: ExtractErrorCode,
    message: string,
    options: { source?: ChatSource; status?: number } = {},
  ) {
    super(message);
    this.code = code;
    this.source = options.source;
    this.status =
      options.status ??
      (code === "unsupported_url"
        ? 400
        : code === "not_public"
          ? 404
          : 502);
  }
}

/**
 * Errors that a headless render cannot plausibly recover from. When the
 * static fetch (or the headless render itself) raises one of these, we
 * surface it immediately instead of paying another ~90s for a headless
 * attempt that will fail in exactly the same way:
 *   - `unsupported_url`: the user's URL — or a redirect from it — points
 *     outside the per-source host allowlist. A real browser would hit
 *     the same allowlist when it followed the same redirect.
 *   - `not_public`: a hard 404/410 or a private-page marker. These are
 *     terminal regardless of the rendering strategy.
 */
export function isUnrecoverable(err: unknown): err is ExtractError {
  if (!(err instanceof ExtractError)) return false;
  if (err.code === "unsupported_url" || err.code === "not_public") return true;
  // Static-only fetch failures are tagged with status 400 (deterministic
  // URL/redirect-policy failures: invalid redirect target, non-http(s)
  // redirect, missing Location, too many redirects) or 413 (body too
  // large). Headless rendering would hit the exact same wall, so we
  // skip it.
  if (err.code === "fetch_failed" && (err.status === 400 || err.status === 413)) {
    return true;
  }
  return false;
}

export interface SourceDescriptor {
  source: ChatSource;
  label: string;
  urlPatterns: string[];
  example: string;
  matches: (url: URL) => boolean;
  extract: (url: URL) => Promise<Conversation>;
}
