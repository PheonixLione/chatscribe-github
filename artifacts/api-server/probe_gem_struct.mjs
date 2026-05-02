import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
function findChromium() { for (const dir of (process.env.PATH ?? "").split(":")) for (const n of ["chromium","chromium-browser","google-chrome"]) { const c = join(dir, n); if (existsSync(c)) return c; } }
const puppeteer = await import("puppeteer-core");
const browser = await puppeteer.default.launch({ executablePath: findChromium(), headless: true, args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36");
await page.evaluateOnNewDocument(() => Object.defineProperty(navigator,"webdriver",{get:()=>undefined}));
await page.setRequestInterception(true);
page.on("request", req => { const t = req.resourceType(); if (t === "image" || t === "media" || t === "font") req.abort().catch(()=>{}); else req.continue().catch(()=>{}); });
await page.goto("https://gemini.google.com/share/6e84f620fbf8", { waitUntil: "domcontentloaded", timeout: 45000 });
// Wait for content
for (let i = 0; i < 30; i++) {
  await new Promise(r => setTimeout(r,2000));
  const has = await page.evaluate(() => document.querySelectorAll('user-query').length > 0 && (document.body.innerText||"").length > 5000);
  if (has) break;
}
await new Promise(r => setTimeout(r,3000)); // settle
const result = await page.evaluate(() => {
  const sv = document.querySelector('share-viewer');
  if (!sv) return { error: "no share-viewer" };
  // List direct children tags + recurse one level
  const directChildren = [...sv.children].map(e => e.tagName.toLowerCase());
  // Find all custom elements inside
  const allCustoms = new Map();
  sv.querySelectorAll('*').forEach(e => {
    const t = e.tagName.toLowerCase();
    if (t.includes('-')) allCustoms.set(t, (allCustoms.get(t)||0)+1);
  });
  // Look for model response candidates: any element with significant text near a user-query
  const userQs = document.querySelectorAll('user-query');
  const sample = [];
  for (let i = 0; i < Math.min(3, userQs.length); i++) {
    const uq = userQs[i];
    sample.push({
      idx: i, parent: uq.parentElement?.tagName, parentChildren: [...(uq.parentElement?.children||[])].map(c=>c.tagName.toLowerCase()),
      nextSibling: uq.nextElementSibling?.tagName?.toLowerCase(),
      text: (uq.textContent||"").slice(0,80)
    });
  }
  // Top-level message containers within share-viewer: look for the shape "container with one user-query and one ?"
  const turnCandidates = [];
  document.querySelectorAll('*').forEach(el => {
    const uq = el.querySelectorAll(':scope > user-query, :scope > * > user-query');
    if (uq.length === 1 && el.tagName.toLowerCase().includes('-') && (el.textContent||"").length > 100) {
      turnCandidates.push({ tag: el.tagName.toLowerCase(), children: [...el.children].map(c=>c.tagName.toLowerCase()).slice(0,8), textLen: (el.textContent||"").length });
    }
  });
  return {
    title: document.title,
    customCounts: Object.fromEntries(allCustoms),
    directChildrenOfShareViewer: directChildren,
    sampleUQ: sample,
    turnCandidates: turnCandidates.slice(0,5),
    h1: document.querySelector('h1')?.textContent?.slice(0,80),
  };
});
writeFileSync("/tmp/gem_struct.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
// Also dump first 60KB of share-viewer outerHTML
const html = await page.evaluate(() => document.querySelector('share-viewer')?.outerHTML?.slice(0, 60000) || "");
writeFileSync("/tmp/share_viewer.html", html);
console.log("share-viewer html size:", html.length);
await browser.close();
