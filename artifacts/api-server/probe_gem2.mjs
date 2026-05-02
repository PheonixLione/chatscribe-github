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
await page.evaluateOnNewDocument(() => Object.defineProperty(navigator,"webdriver",{get:()=>undefined}));
// NO request interception this time
const t0 = Date.now();
const resp = await page.goto("https://gemini.google.com/share/6e84f620fbf8", { waitUntil: "networkidle2", timeout: 60000 });
console.log("loaded@",Date.now()-t0,"status=",resp?.status(),"url=",page.url());
await new Promise(r => setTimeout(r,3000));
const info = await page.evaluate(() => ({
  title: document.title,
  url: location.href,
  bodyLen: (document.body?.innerText||"").length,
  bodyStart: (document.body?.innerText||"").slice(0,500),
  hasUserQuery: document.querySelectorAll('user-query').length,
  hasModelResp: document.querySelectorAll('model-response').length,
  customElements: Array.from(document.querySelectorAll('*')).map(e=>e.tagName.toLowerCase()).filter(t=>t.includes('-')).slice(0,30),
}));
console.log(JSON.stringify(info,null,2));
await browser.close();
