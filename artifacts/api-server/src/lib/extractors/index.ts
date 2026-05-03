import { chatgpt } from "./chatgpt";
import { claude } from "./claude";
import { gemini } from "./gemini";
import { grok } from "./grok";
import { deepseek } from "./deepseek";
import { ExtractError, type Conversation, type SourceDescriptor } from "./types";

export const SOURCES: SourceDescriptor[] = [
  chatgpt,
  claude,
  gemini,
  grok,
  deepseek,
];

export function listSources() {
  return SOURCES.map((s) => ({
    source: s.source,
    label: s.label,
    urlPatterns: s.urlPatterns,
    example: s.example,
  }));
}

export async function extractFromUrl(rawUrl: string): Promise<Conversation> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new ExtractError(
      "unsupported_url",
      "That doesn't look like a valid URL. Please paste a full https:// share link.",
    );
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ExtractError(
      "unsupported_url",
      "Only http(s) share links are supported.",
    );
  }
  const match = SOURCES.find((s) => s.matches(url));
  if (!match) {
    throw new ExtractError(
      "unsupported_url",
      "This link is not from a supported AI chat platform.",
    );
  }
  try {
    const conv = await match.extract(url);
    return conv;
  } catch (err) {
    if (err instanceof ExtractError) throw err;
    throw new ExtractError(
      "parse_failed",
      `Unexpected error while extracting: ${(err as Error).message}`,
      { source: match.source },
    );
  }
}

export { ExtractError };
