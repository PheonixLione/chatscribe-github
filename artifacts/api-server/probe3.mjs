import { existsSync } from "node:fs";
import { join } from "node:path";
function findChromium() {
  for (const dir of (process.env.PATH ?? "").split(":")) {
    for (const n of ["chromium", "chromium-browser", "google-chrome"]) {
      const c = join(dir, n);
      if (existsSync(c)) return c;
    }
  }
}
const puppeteer = await import("puppeteer-core");
const browser = await puppeteer.default.launch({
  executablePath: findChromium(),
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36");
await page.evaluateOnNewDocument(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
});
// WITH default asset blocking (image/media/font blocked)
await page.setRequestInterception(true);
page.on("request", (req) => {
  const t = req.resourceType();
  if (t === "image" || t === "media" || t === "font") req.abort().catch(()=>{});
  else req.continue().catch(()=>{});
});
const t0 = Date.now();
await page.goto("https://claude.ai/share/79a2b1fd-4c25-4c0e-9d2a-34c12e043d88", { waitUntil: "domcontentloaded", timeout: 60000 });
let cleared = false;
for (let i = 0; i < 12; i++) {
  await new Promise(r => setTimeout(r, 2500));
  const title = await page.title();
  if (!/just a moment|verifying|cloudflare/i.test(title) && title) {
    console.log(`CLEARED at t+${Date.now()-t0}ms title="${title}"`);
    cleared = true;
    break;
  }
  console.log(`t+${Date.now()-t0}ms title="${title}"`);
}
if (cleared) {
  await new Promise(r => setTimeout(r, 1500));
  const probes = await page.evaluate(() => ({
    user: document.querySelectorAll('[data-testid="user-message"]').length,
    fontClaude: document.querySelectorAll('div[class*="font-claude"]').length,
    fontUser: document.querySelectorAll('div[class*="font-user"]').length,
  }));
  console.log("PROBES:", JSON.stringify(probes));
}
await browser.close();
