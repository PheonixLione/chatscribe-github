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
  args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage","--lang=en-US,en"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36");
await page.evaluateOnNewDocument(() => {
  Object.defineProperty(navigator,"webdriver",{get:()=>undefined});
});
// Block images/media/font like our real headless does
await page.setRequestInterception(true);
page.on("request", req => {
  const t = req.resourceType();
  if (t === "image" || t === "media" || t === "font") req.abort().catch(()=>{});
  else req.continue().catch(()=>{});
});
const t0 = Date.now();
await page.goto("https://gemini.google.com/share/6e84f620fbf8", { waitUntil: "domcontentloaded", timeout: 60000 });
console.log("loaded@",Date.now()-t0);
let lastCount = 0, stableTicks = 0;
for (let i = 0; i < 60; i++) {
  await new Promise(r => setTimeout(r,2000));
  const info = await page.evaluate(() => {
    const uq = document.querySelectorAll('user-query, [data-test-id="user-query"], .user-query');
    const mr = document.querySelectorAll('model-response, [data-test-id="model-response"], .model-response');
    const sv = document.querySelectorAll('share-viewer, share-landing-page');
    let uqText=0, mrText=0;
    uq.forEach(e=>{if((e.textContent||"").trim().length>5) uqText++});
    mr.forEach(e=>{if((e.textContent||"").trim().length>5) mrText++});
    return { uq:uq.length, uqText, mr:mr.length, mrText, sv:sv.length, bodyLen:(document.body?.innerText||"").length };
  });
  const total = info.uqText + info.mrText;
  console.log(`t+${Date.now()-t0}ms uq=${info.uq}/${info.uqText}t mr=${info.mr}/${info.mrText}t sv=${info.sv} body=${info.bodyLen}c`);
  if (total > 0 && total === lastCount) stableTicks++;
  else { stableTicks = 0; lastCount = total; }
  if (stableTicks >= 2 && total > 0) { console.log(`CONVERGED at ${total} messages, stable for ${stableTicks*2}s`); break; }
}
const sample = await page.evaluate(() => {
  const items = [];
  document.querySelectorAll('user-query, model-response').forEach((e,i) => {
    if (i > 4) return;
    items.push({ tag: e.tagName, len: (e.textContent||"").length, first120: (e.textContent||"").slice(0,120).replace(/\s+/g," ").trim() });
  });
  return items;
});
console.log("SAMPLE:", JSON.stringify(sample,null,2));
await browser.close();
