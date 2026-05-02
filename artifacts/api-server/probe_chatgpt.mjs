import { existsSync } from "node:fs";
import { join } from "node:path";
function findChromium() {
  for (const dir of (process.env.PATH ?? "").split(":")) {
    for (const n of ["chromium","chromium-browser","google-chrome"]) {
      const c = join(dir, n);
      if (existsSync(c)) return c;
    }
  }
}
const puppeteer = await import("puppeteer-core");
const browser = await puppeteer.default.launch({
  executablePath: findChromium(), headless: true,
  args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36");
await page.evaluateOnNewDocument(() => {
  Object.defineProperty(navigator, "webdriver", { get: () => undefined });
});
await page.setRequestInterception(true);
page.on("request", req => {
  const t = req.resourceType();
  if (t === "image" || t === "media" || t === "font") req.abort().catch(()=>{});
  else req.continue().catch(()=>{});
});
await page.goto("https://chatgpt.com/share/69f63e14-d998-83e8-9a8b-c4b7a3c161ec", { waitUntil: "domcontentloaded", timeout: 60000 });
await new Promise(r => setTimeout(r, 6000));
const probes = await page.evaluate(() => ({
  authorRole: document.querySelectorAll("[data-message-author-role]").length,
  messageId: document.querySelectorAll("[data-message-id]").length,
  markdown: document.querySelectorAll(".markdown").length,
  testidConv: document.querySelectorAll('[data-testid^="conversation-turn"]').length,
  whisperContainer: document.querySelectorAll("article").length,
  title: document.title,
}));
console.log("PROBES:", JSON.stringify(probes));
const sample = await page.evaluate(() => {
  const m = document.querySelectorAll("[data-message-author-role]");
  return Array.from(m).slice(0,4).map(el => ({
    role: el.getAttribute("data-message-author-role"),
    snippet: (el.textContent||"").slice(0,120).replace(/\s+/g," ").trim(),
  }));
});
console.log("SAMPLE:", JSON.stringify(sample, null, 2));
await browser.close();
