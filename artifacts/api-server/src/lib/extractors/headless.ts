import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Browser, LaunchOptions } from "puppeteer-core";
import { ExtractError, type ChatSource } from "./types";

/**
 * Headless browser support for share pages that render entirely with
 * client-side JavaScript (Gemini, DeepSeek) or sit behind a JS-based
 * bot-protection challenge (DeepSeek's AWS WAF). The browser is launched
 * lazily, reused across requests, and torn down on process shutdown.
 *
 * Two runtime modes:
 *
 * 1. **Long-lived server** (Replit, Render, Railway, local dev). Uses
 *    the system Chromium found on $PATH. Browser instance is reused
 *    across requests for the entire process lifetime.
 *
 * 2. **Serverless** (Netlify Functions, Vercel — `process.env.NETLIFY`
 *    or `process.env.VERCEL` set). Uses `@sparticuz/chromium-min`,
 *    which downloads a Chromium tarball into /tmp on cold start. The
 *    browser instance is reused across warm invocations within the
 *    same Lambda container, but cold starts pay a one-time ~3-5s
 *    download/launch cost.
 */

const IS_SERVERLESS =
  process.env["NETLIFY"] === "true" || process.env["VERCEL"] === "1";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

const FIXED_CANDIDATE_PATHS = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROMIUM_PATH,
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
];

const BIN_NAMES = ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable", "chrome"];

let browserPromise: Promise<Browser> | null = null;
let shutdownRegistered = false;
let resolvedExecutable: string | null = null;

function findChromium(): string {
  if (resolvedExecutable) return resolvedExecutable;

  for (const p of FIXED_CANDIDATE_PATHS) {
    if (p && existsSync(p)) {
      resolvedExecutable = p;
      return p;
    }
  }
  // Search every directory in PATH for one of the known binary names.
  // On Replit/NixOS chromium lives under /nix/store/<hash>-chromium-*/bin/.
  const pathEnv = process.env.PATH ?? "";
  for (const dir of pathEnv.split(":")) {
    if (!dir) continue;
    for (const name of BIN_NAMES) {
      const candidate = join(dir, name);
      if (existsSync(candidate)) {
        resolvedExecutable = candidate;
        return candidate;
      }
    }
  }
  // Last-ditch fallback; puppeteer-core will fail loudly if it can't find it.
  return "chromium";
}

async function getBrowser(): Promise<Browser> {
  if (browserPromise) {
    try {
      const b = await browserPromise;
      if (b.connected) return b;
    } catch {
      // fall through and relaunch
    }
    browserPromise = null;
  }

  const launch = async (): Promise<Browser> => {
    const puppeteer = await import("puppeteer-core");

    if (IS_SERVERLESS) {
      // Serverless path: pull the bundled Chromium binary from
      // @sparticuz/chromium-min. The package itself is ~50 MB; the
      // ~170 MB Chromium tarball is downloaded lazily into /tmp on
      // first call within a Lambda container and reused on warm
      // invocations. CHROMIUM_PACK_URL must point to the matching
      // pack release (set in netlify.toml [build.environment]).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chromiumMod: any = await import("@sparticuz/chromium-min");
      const chromium = chromiumMod.default ?? chromiumMod;
      const packUrl = process.env["CHROMIUM_PACK_URL"];
      if (!packUrl) {
        throw new Error(
          "CHROMIUM_PACK_URL is not set — cannot fetch Chromium binary. " +
            "Set it in netlify.toml or your platform's environment vars.",
        );
      }
      const executablePath: string = await chromium.executablePath(packUrl);
      const opts: LaunchOptions = {
        executablePath,
        headless: true,
        // chromium.args is a curated list tuned for Lambda's read-only
        // filesystem and tight memory ceiling.
        args: chromium.args as string[],
        // Sparticuz ships its own viewport defaults — use them.
        defaultViewport: chromium.defaultViewport,
      };
      return await puppeteer.default.launch(opts);
    }

    // Long-lived server path: system Chromium.
    const opts: LaunchOptions = {
      executablePath: findChromium(),
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
        "--disable-background-networking",
        "--disable-extensions",
        "--disable-default-apps",
        "--mute-audio",
        "--hide-scrollbars",
      ],
    };
    return await puppeteer.default.launch(opts);
  };

  browserPromise = launch();

  if (!shutdownRegistered) {
    shutdownRegistered = true;
    const shutdown = async () => {
      const p = browserPromise;
      browserPromise = null;
      if (p) {
        try {
          const b = await p;
          await b.close();
        } catch {
          // ignore
        }
      }
    };
    process.once("beforeExit", shutdown);
    process.once("SIGTERM", () => void shutdown());
    process.once("SIGINT", () => void shutdown());
  }

  return browserPromise;
}

export interface RenderOptions {
  source: ChatSource;
  /** Per-page navigation/render budget. Defaults to 30s. */
  timeoutMs?: number;
  /**
   * Readiness check. A CSS selector waits for the element to appear; a
   * string predicate is the *body* of a function executed in the browser
   * context (it should `return true` when the page is ready).
   */
  waitFor:
    | { selector: string }
    | { fn: string };
  /** Extra wait once the readiness condition is met (lets late hydration finish). */
  settleMs?: number;
}

export interface RenderResult {
  html: string;
  finalUrl: string;
}

export async function renderPage(
  url: string,
  opts: RenderOptions,
): Promise<RenderResult> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  let browser: Browser;
  try {
    browser = await getBrowser();
  } catch (err) {
    throw new ExtractError(
      "fetch_failed",
      `Could not start the headless browser used to render JavaScript share pages (${(err as Error).message}).`,
      { source: opts.source },
    );
  }

  const page = await browser.newPage();
  try {
    await page.setUserAgent(UA);
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
    });
    await page.setViewport({ width: 1280, height: 900 });

    // Hide the obvious automation tells that bot challenges (Cloudflare
    // Turnstile, AWS WAF, etc.) sniff for. Without this, claude.ai's
    // managed challenge never auto-clears.
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    // Block heavy assets we don't need; speeds things up considerably,
    // avoids fonts/images stalling navigation, and prevents SSRF-style
    // egress to attacker-controlled image URLs embedded in shared pages.
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const t = req.resourceType();
      if (t === "image" || t === "media" || t === "font") {
        req.abort().catch(() => {});
      } else {
        req.continue().catch(() => {});
      }
    });

    let response;
    try {
      response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });
    } catch (err) {
      throw new ExtractError(
        "fetch_failed",
        `Could not load the share page (${(err as Error).message}).`,
        { source: opts.source },
      );
    }

    const status = response?.status() ?? 0;
    if (status === 404 || status === 410) {
      throw new ExtractError(
        "not_public",
        "This share link no longer exists or was deleted.",
        { source: opts.source },
      );
    }
    if (status === 401 || status === 403) {
      // Some hosts return 4xx initially while a JS challenge runs; only
      // bail if the page never recovers, which we let waitFor decide.
    }

    try {
      if ("selector" in opts.waitFor) {
        await page.waitForSelector(opts.waitFor.selector, { timeout: timeoutMs });
      } else {
        // Wrap the body in a function the browser will evaluate. Using a
        // string predicate keeps DOM globals out of our Node typecheck.
        await page.waitForFunction(
          `(function(){ ${opts.waitFor.fn} })()`,
          { timeout: timeoutMs, polling: 500 },
        );
      }
    } catch {
      throw new ExtractError(
        "parse_failed",
        `The share page never rendered its conversation content within ${Math.round(timeoutMs / 1000)}s.`,
        { source: opts.source },
      );
    }

    if (opts.settleMs) {
      await new Promise((r) => setTimeout(r, opts.settleMs));
    }

    // Use evaluate() rather than page.content() to extract HTML. page.content()
    // wraps a CDP `getOuterHTML` round-trip with a separate `Page.navigate`
    // probe and reliably hangs on very large hydrated pages (4MB+ Gemini long
    // conversations). Reading documentElement.outerHTML directly is a single
    // serialized callFunctionOn and returns even when the page is enormous.
    // Pass as a string-bodied function so DOM globals (`document`) don't
    // need to be in the api-server tsconfig `lib`.
    const html = (await page.evaluate(
      "document.documentElement.outerHTML",
    )) as string;
    const finalUrl = page.url();
    return { html, finalUrl };
  } finally {
    await page.close().catch(() => {});
  }
}
