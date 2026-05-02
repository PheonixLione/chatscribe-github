import { existsSync } from "node:fs";
import { join } from "node:path";

function findChromium() {
  for (const dir of (process.env.PATH ?? "").split(":")) {
    for (const n of ["chromium", "chromium-browser", "google-chrome"]) {
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
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
});
const page = await browser.newPage();
await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36");
// Hide webdriver flag
await page.evaluateOnNewDocument(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
});
await page.goto("https://claude.ai/share/79a2b1fd-4c25-4c0e-9d2a-34c12e043d88", { waitUntil: "domcontentloaded", timeout: 60000 });

for (let i = 0; i < 12; i++) {
  await new Promise(r => setTimeout(r, 5000));
  const title = await page.title();
  const url = page.url();
  console.log(`t+${(i+1)*5}s  title="${title}"  url=${url}`);
  if (!/just a moment|cloudflare|verifying/i.test(title) && title) {
    const probes = await page.evaluate(() => {
      const sels = ['[data-testid="user-message"]', '[data-testid="message"]', 'div.font-claude-message', 'div.font-user-message', 'div[class*="font-claude"]', 'div[class*="font-user"]', '.prose', 'script#__NEXT_DATA__', 'main'];
      const out = {};
      for (const s of sels) out[s] = document.querySelectorAll(s).length;
      return out;
    });
    console.log("PROBES:", JSON.stringify(probes));
    const snap = await page.evaluate(() => (document.querySelector('main') || document.body).innerText.slice(0, 800));
    console.log("TEXT:\n", snap);
    break;
  }
}
await browser.close();
