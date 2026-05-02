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
  Object.defineProperty(navigator,"languages",{get:()=>["en-US","en"]});
  Object.defineProperty(navigator,"plugins",{get:()=>[1,2,3,4,5]});
});

const xhrs = [];
page.on("response", async (r) => {
  const u = r.url();
  if (u.includes("/_/BardChatUi/") || u.includes("batchexecute") || u.includes("share")) {
    let len = 0;
    try { const buf = await r.buffer(); len = buf.length; } catch {}
    xhrs.push({ url: u.length > 120 ? u.slice(0,120)+"..." : u, status: r.status(), len, type: r.request().resourceType() });
  }
});

const t0 = Date.now();
await page.goto("https://gemini.google.com/share/6e84f620fbf8", { waitUntil: "domcontentloaded", timeout: 60000 });
console.log("loaded@",Date.now()-t0);
// Wait longer with no asset blocking
for (let i = 0; i < 20; i++) {
  await new Promise(r => setTimeout(r,3000));
  const info = await page.evaluate(() => {
    const customs = new Set();
    document.querySelectorAll('*').forEach(e => {
      const t = e.tagName.toLowerCase();
      if (t.includes('-')) customs.add(t);
    });
    return {
      bodyLen: (document.body?.innerText||"").length,
      bodyStart: (document.body?.innerText||"").slice(0,300),
      customsCount: customs.size,
      customs: Array.from(customs),
      visibleH1: Array.from(document.querySelectorAll("h1,h2")).map(e=>e.textContent?.slice(0,80)),
      title: document.title,
    };
  });
  console.log(`t+${Date.now()-t0}ms body=${info.bodyLen}c customs=${info.customsCount} title="${info.title}"`);
  if (info.bodyLen > 100) {
    console.log("  bodyStart:", info.bodyStart.replace(/\s+/g," "));
    console.log("  customs:", info.customs.slice(0,40).join(", "));
    console.log("  h1/h2:", info.visibleH1);
  }
  if (info.bodyLen > 500) break;
}
console.log("---XHRs---");
xhrs.forEach(x=>console.log(JSON.stringify(x)));
await browser.close();
