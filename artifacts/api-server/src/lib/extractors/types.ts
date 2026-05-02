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

export interface SourceDescriptor {
  source: ChatSource;
  label: string;
  urlPatterns: string[];
  example: string;
  matches: (url: URL) => boolean;
  extract: (url: URL) => Promise<Conversation>;
}
