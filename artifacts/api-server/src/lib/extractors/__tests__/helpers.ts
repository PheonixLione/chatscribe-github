import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "..", "__fixtures__");

export function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf8");
}

export interface MockResponseSpec {
  status?: number;
  headers?: Record<string, string>;
  body?: string;
}

export type FetchHandler = (url: string) => MockResponseSpec | MockResponseSpec[];

interface InstalledMock {
  original: typeof globalThis.fetch;
  calls: string[];
}

let installed: InstalledMock | null = null;

/**
 * Replace globalThis.fetch with a deterministic handler. The handler may
 * return a single response, or an array of responses (for redirect chains —
 * each call consumes the next entry).
 */
export function installFetchMock(handler: FetchHandler): { calls: string[] } {
  if (installed) {
    throw new Error("fetch mock already installed; restoreFetch() first");
  }
  const original = globalThis.fetch;
  const calls: string[] = [];
  const queues = new Map<string, MockResponseSpec[]>();

  globalThis.fetch = (async (input: unknown) => {
    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as { url: string }).url;
    calls.push(urlStr);

    let queue = queues.get(urlStr);
    if (!queue) {
      const result = handler(urlStr);
      queue = Array.isArray(result) ? [...result] : [result];
      queues.set(urlStr, queue);
    }
    const spec = queue.shift() ?? { status: 500, body: "no more mock responses" };

    return new Response(spec.body ?? "", {
      status: spec.status ?? 200,
      headers: spec.headers ?? { "content-type": "text/html; charset=utf-8" },
    });
  }) as typeof globalThis.fetch;

  installed = { original, calls };
  return { calls };
}

export function restoreFetch(): void {
  if (!installed) return;
  globalThis.fetch = installed.original;
  installed = null;
}
