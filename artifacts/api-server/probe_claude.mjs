import { existsSync } from "node:fs";
import { join } from "node:path";

const BIN_NAMES = ["chromium", "chromium-browser", "google-chrome"];
function findChromium() {
  for (const dir of (process.env.PATH ?? "").split(":")) {
    for (const n of BIN_NAMES) {
      const c = join(dir, n);
      if (existsSync(c)) return c;
    }
  }
  return "chromium";
}

const puppeteer = await import("puppeteer-core");
const browser = await puppeteer.default.launch({
  executablePath: findChromium(),
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36");
await page.goto("https://claude.ai/share/79a2b1fd-4c25-4c0e-9d2a-34c12e043d88", { waitUntil: "domcontentloaded", timeout: 45000 });
// wait for Cloudflare challenge to clear
await new Promise(r => setTimeout(r, 8000));
const title = await page.title();
console.log("TITLE:", title);
const html = await page.content();
console.log("HTML LENGTH:", html.length);
// look for tell-tale selectors
const probes = await page.evaluate(() => {
  const sels = [
    '[data-testid="user-message"]',
    '[data-testid="message"]',
    '[data-testid="conversation-message"]',
    '[data-test-render-count]',
    'div.font-claude-message',
    'div.font-user-message',
    'div[class*="font-claude"]',
    'div[class*="font-user"]',
    '.prose',
    '__NEXT_DATA__',
    'script#__NEXT_DATA__',
  ];
  const out = {};
  for (const s of sels) out[s] = document.querySelectorAll(s).length;
  return out;
});
console.log("PROBES:", JSON.stringify(probes, null, 2));

// Snapshot a chunk of the rendered DOM near messages
const snapshot = await page.evaluate(() => {
  const root = document.querySelector('main') || document.body;
  return root.innerHTML.slice(0, 4000);
});
console.log("SNAPSHOT (4kb):\n", snapshot);

await browser.close();
