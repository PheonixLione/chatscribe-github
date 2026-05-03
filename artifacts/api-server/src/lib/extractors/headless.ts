import { existsSync } from "node:fs";
import { join, delimiter } from "node:path";
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

/**
 * Minimal structural type for the bits of `@sparticuz/chromium-min` we
 * actually use. The package ships its own .d.ts but we declare a local
 * shape so the dynamic-import-with-default-unwrap can stay typed without
 * pulling the dep into the static import graph (it's only loaded on
 * serverless platforms — long-lived servers never resolve it).
 */
interface ChromiumMin {
  args: string[];
  executablePath: (packUrl?: string) => Promise<string>;
}

async function loadChromiumMin(): Promise<ChromiumMin> {
  // The package's default export is a class with `args`/`executablePath`
  // as static members — structurally compatible with our minimal shape.
  // Cast through `unknown` because TS won't widen a class's static side
  // to a plain interface on its own.
  const mod = (await import("@sparticuz/chromium-min")) as unknown as {
    default: ChromiumMin;
  };
  return mod.default;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

const FIXED_CANDIDATE_PATHS = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROMIUM_PATH,
  // Linux / Replit / Docker
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  // Windows — Chrome
  process.env.LOCALAPPDATA
    ? join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe")
    : undefined,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  // Windows — Edge (fallback when Chrome is not installed)
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
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
  for (const dir of pathEnv.split(delimiter)) {
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
      const chromium = await loadChromiumMin();
      const packUrl =
        process.env["CHROMIUM_PACK_URL"] ??
        "https://github.com/Sparticuz/chromium/releases/download/v148.0.0/chromium-v148.0.0-pack.x64.tar";
      // Race the cold-start binary fetch + browser launch against an
      // internal budget so we can throw `headless_unavailable` before
      // the platform's 10s hard kill. If the launch wins after the
      // timeout, close the orphan to avoid leaking a browser process
      // in a warm container.
      const launchPromise = (async () => {
        const executablePath = await chromium.executablePath(packUrl);
        const opts: LaunchOptions = {
          executablePath,
          headless: true,
          args: chromium.args,
        };
        return await puppeteer.default.launch(opts);
      })();
      let timedOut = false;
      const timeoutPromise = new Promise<Browser>((_resolve, reject) => {
        setTimeout(() => {
          timedOut = true;
          reject(new Error("serverless chromium launch budget exceeded"));
        }, SERVERLESS_LAUNCH_BUDGET_MS);
      });
      launchPromise
        .then((b) => {
          if (timedOut) {
            void b.close().catch(() => {});
          }
        })
        .catch(() => {});
      return await Promise.race([launchPromise, timeoutPromise]);
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
  /**
   * After waitFor resolves, scroll to the bottom of the page repeatedly
   * until scrollHeight stabilises. Forces lazy-rendered/virtual-scroll
   * content (ChatGPT, Claude, Grok, DeepSeek DOM path) into the DOM
   * before the HTML is captured. Defaults to true. Skipped on serverless
   * (already budget-constrained). Budget defaults to 20s.
   */
  scrollToLoad?: boolean;
  scrollTimeoutMs?: number;
}

export interface RenderResult {
  html: string;
  finalUrl: string;
}

// Clamp render budget below the 10s serverless function timeout so app
// errors surface before the platform kills the invocation.
const SERVERLESS_RENDER_BUDGET_MS = 7_000;
const SERVERLESS_LAUNCH_BUDGET_MS = 6_000;

// Scroll ALL scrollable containers (window + any overflow:auto/scroll div)
// to the bottom, then measure the tallest scrollHeight across all of them.
// Modern AI share pages (DeepSeek, Claude, Grok, ChatGPT) render the
// conversation inside a fixed-height div with overflow-y:auto — not the
// body — so window.scrollTo alone is a no-op for those containers.
const SCROLL_ALL_JS = `(function () {
  window.scrollTo(0, document.body.scrollHeight);
  var all = document.querySelectorAll('div,main,section,article,ul,ol');
  for (var i = 0; i < all.length; i++) {
    try {
      var el = all[i];
      if (el.scrollHeight > el.clientHeight + 50) {
        var s = window.getComputedStyle(el);
        if (/auto|scroll/.test(s.overflowY) || /auto|scroll/.test(s.overflow)) {
          el.scrollTop = el.scrollHeight;
        }
      }
    } catch (e) {}
  }
})()`;

// Return the largest scrollHeight across body and all scrollable divs so
// we can detect when no new content is loading.
const MAX_HEIGHT_JS = `(function () {
  var h = document.body.scrollHeight;
  var all = document.querySelectorAll('div,main,section,article');
  for (var i = 0; i < all.length; i++) {
    try { if (all[i].scrollHeight > h) h = all[i].scrollHeight; } catch (e) {}
  }
  return h;
})()`;

async function scrollToLoadAll(
  page: import("puppeteer-core").Page,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let stableCount = 0;
  let lastHeight = 0;
  while (Date.now() < deadline && stableCount < 3) {
    await page.evaluate(SCROLL_ALL_JS);
    await new Promise<void>((r) => setTimeout(r, 1_200));
    const height = (await page.evaluate(MAX_HEIGHT_JS)) as number;
    if (height === lastHeight) {
      stableCount++;
    } else {
      stableCount = 0;
      lastHeight = height;
    }
  }
}

export async function renderPage(
  url: string,
  opts: RenderOptions,
): Promise<RenderResult> {
  const requestedTimeout = opts.timeoutMs ?? 30_000;
  const timeoutMs = IS_SERVERLESS
    ? Math.min(requestedTimeout, SERVERLESS_RENDER_BUDGET_MS)
    : requestedTimeout;
  let browser: Browser;
  try {
    browser = await getBrowser();
  } catch (err) {
    if (IS_SERVERLESS) {
      throw new ExtractError(
        "headless_unavailable",
        "The browser used to render this share page could not start in time on this deployment. Please try again in a moment — the next attempt usually succeeds because the browser has been warmed up.",
        { source: opts.source },
      );
    }
    throw new ExtractError(
      "fetch_failed",
      `Could not start the headless browser used to render JavaScript share pages (${(err as Error).message}).`,
      { source: opts.source },
    );
  }

  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  page.setDefaultNavigationTimeout(timeoutMs);
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
      const msg = (err as Error).message;
      if (IS_SERVERLESS && /timeout|timed out/i.test(msg)) {
        throw new ExtractError(
          "headless_unavailable",
          "The share page did not finish loading within the serverless time budget. Please try again in a moment — a warm container usually succeeds.",
          { source: opts.source },
        );
      }
      throw new ExtractError(
        "fetch_failed",
        `Could not load the share page (${msg}).`,
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
      // On serverless, a render timeout is the dominant failure mode —
      // a cold container plus a slow XHR (Gemini in particular streams
      // its conversation via a 2 MB+ batchexecute call) routinely
      // exceeds the 10 s budget. Surface the actionable
      // `headless_unavailable` code so the frontend can prompt a retry
      // rather than treating it as a permanent parse failure.
      if (IS_SERVERLESS) {
        throw new ExtractError(
          "headless_unavailable",
          `The share page did not finish rendering within this deployment's ${Math.round(timeoutMs / 1000)}s budget. Please try again — a warm container usually finishes well under the limit.`,
          { source: opts.source },
        );
      }
      throw new ExtractError(
        "parse_failed",
        `The share page never rendered its conversation content within ${Math.round(timeoutMs / 1000)}s.`,
        { source: opts.source },
      );
    }

    // Scroll to the bottom repeatedly so that lazily-rendered/virtual-scroll
    // content (ChatGPT, Claude, Grok, DeepSeek DOM path) is fully in the
    // DOM before we capture the HTML. Skipped on serverless (budget too
    // tight) and when the caller explicitly opts out.
    if (!IS_SERVERLESS && opts.scrollToLoad !== false) {
      await scrollToLoadAll(page, opts.scrollTimeoutMs ?? 20_000);
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
