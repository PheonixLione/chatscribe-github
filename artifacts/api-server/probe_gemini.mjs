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
await page.setRequestInterception(true);
page.on("request", req => {
  const t = req.resourceType();
  if (t === "image" || t === "media" || t === "font") req.abort().catch(()=>{});
  else req.continue().catch(()=>{});
});
const t0 = Date.now();
await page.goto("https://gemini.google.com/share/6e84f620fbf8", { waitUntil: "domcontentloaded", timeout: 60000 });
console.log("loaded@", Date.now()-t0,"ms");
for (let i = 0; i < 18; i++) {
  await new Promise(r => setTimeout(r, 3000));
  const probes = await page.evaluate(() => {
    const sels = ['user-query','[data-test-id="user-query"]','.user-query','model-response','[data-test-id="model-response"]','.model-response','message-content','immersive-share-disclaimer-dialog','mat-dialog-container','immersive-share-landing-page','web-preview','article','main','.conversation-container'];
    const out = {};
    for (const s of sels) {
      const els = document.querySelectorAll(s);
      let withText = 0;
      for (const el of els) if ((el.textContent||"").trim().length > 5) withText++;
      out[s] = `${els.length}/${withText}t`;
    }
    return { title: document.title, probes: out, bodyTextLen: (document.body?.innerText||"").length };
  });
  console.log(`t+${Date.now()-t0}ms title="${probes.title}" bodyChars=${probes.bodyTextLen}`);
  console.log("  ", JSON.stringify(probes.probes));
  if (probes.probes['user-query']?.match(/^\d+\/[1-9]/) || probes.probes['model-response']?.match(/^\d+\/[1-9]/)) {
    console.log("FOUND content");
    // dump tag names of message elements
    const tags = await page.evaluate(() => {
      const out = [];
      const sels = ['user-query','model-response','message-content','[data-test-id]'];
      for (const sel of sels) {
        const els = Array.from(document.querySelectorAll(sel));
        for (const el of els.slice(0,3)) {
          out.push({ sel, tag: el.tagName, attr: el.getAttribute('data-test-id'), text: (el.textContent||"").slice(0,80).replace(/\s+/g," ").trim() });
        }
      }
      return out;
    });
    console.log("TAGS:", JSON.stringify(tags, null, 2));
    break;
  }
}
await browser.close();
