import { existsSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
const log = (s) => { appendFileSync("/tmp/probe_dump.log", s+"\n"); };
writeFileSync("/tmp/probe_dump.log","");
function findChromium() { for (const dir of (process.env.PATH ?? "").split(":")) for (const n of ["chromium","chromium-browser","google-chrome"]) { const c = join(dir, n); if (existsSync(c)) return c; } }
const puppeteer = await import("puppeteer-core");
log("launch");
const browser = await puppeteer.default.launch({ executablePath: findChromium(), headless: true, args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36");
await page.evaluateOnNewDocument(() => Object.defineProperty(navigator,"webdriver",{get:()=>undefined}));
await page.setRequestInterception(true);
page.on("request", req => { const t = req.resourceType(); if (t === "image" || t === "media" || t === "font") req.abort().catch(()=>{}); else req.continue().catch(()=>{}); });
try {
  log("goto");
  await page.goto("https://gemini.google.com/share/6e84f620fbf8", { waitUntil: "domcontentloaded", timeout: 45000 });
  log("loaded");
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r,2000));
    try {
      const stat = await page.evaluate(() => ({ uq: document.querySelectorAll('user-query').length, body: (document.body?.innerText||"").length }));
      log(`tick ${i}: uq=${stat.uq} body=${stat.body}`);
      if (stat.uq > 5 && stat.body > 5000) break;
    } catch (e) { log("eval err"); break; }
  }
  await new Promise(r => setTimeout(r,3000));
  const html = await page.content();
  writeFileSync("/tmp/gem_rendered.html", html);
  log(`dumped ${html.length} bytes`);
} catch (e) { log("ERR "+e.message); } finally { try { await browser.close(); } catch {} log("done"); }
