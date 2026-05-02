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
await page.setViewport({ width: 1280, height: 800 });
await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36");
await page.evaluateOnNewDocument(() => Object.defineProperty(navigator,"webdriver",{get:()=>undefined}));
await page.setRequestInterception(true);
page.on("request", req => {
  const t = req.resourceType();
  if (t === "image" || t === "media" || t === "font") req.abort().catch(()=>{});
  else req.continue().catch(()=>{});
});
const t0 = Date.now();
try {
  await page.goto("https://gemini.google.com/share/6e84f620fbf8", { waitUntil: "domcontentloaded", timeout: 45000 });
  console.log("loaded@",Date.now()-t0);
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r,2500));
    const info = await page.evaluate(() => {
      const all = {};
      const sels = ['user-query','model-response','share-viewer','share-landing-page','message-content','.markdown','.query-text','.response-content'];
      for (const s of sels) {
        const els = document.querySelectorAll(s);
        let withText = 0;
        els.forEach(e => { if ((e.textContent||"").trim().length > 5) withText++; });
        all[s] = els.length + "/" + withText + "t";
      }
      return { all, body: (document.body?.innerText||"").length };
    });
    console.log(`t+${Date.now()-t0}ms body=${info.body}c ${JSON.stringify(info.all)}`);
    if (info.all['user-query']?.match(/\/[1-9]/) || info.all['model-response']?.match(/\/[1-9]/)) {
      console.log("FOUND messages, sampling...");
      const samp = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('user-query, model-response')).slice(0,4).map(e => ({
          tag: e.tagName, len: (e.textContent||"").length, txt: (e.textContent||"").slice(0,150).replace(/\s+/g," ").trim()
        }));
      });
      console.log(JSON.stringify(samp,null,2));
      break;
    }
  }
} catch (e) {
  console.log("ERROR:", e.message);
} finally {
  await browser.close();
}
