#!/usr/bin/env node
/**
 * Bundle-size budget check for the Home route.
 *
 * Parses the built dist/public/index.html, finds every JS asset that the
 * browser will fetch before the app becomes interactive (the entry script
 * plus every <link rel="modulepreload">), gzip-compresses each one, and
 * fails the build if the total exceeds the configured budget.
 *
 * This guards against a future change accidentally pulling a heavy
 * dependency (markdown, syntax highlighter, pdf, etc.) into the Home
 * entry chunk and silently regressing first-load performance.
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, "..");
const distDir = resolve(webRoot, "dist/public");
const indexHtml = join(distDir, "index.html");

const BUDGET_GZIP_BYTES = Number(
  process.env.PERF_BUDGET_GZIP_BYTES ?? 245 * 1024,
);

function fail(msg) {
  console.error(`\n[perf-check] FAIL: ${msg}\n`);
  process.exit(1);
}

if (!existsSync(indexHtml)) {
  fail(
    `dist/public/index.html not found. Run \`pnpm --filter @workspace/web run build\` first.`,
  );
}

const html = readFileSync(indexHtml, "utf8");

const entryMatches = [
  ...html.matchAll(
    /<script[^>]+type=["']module["'][^>]+src=["']([^"']+\.js)["']/g,
  ),
].map((m) => m[1]);

const preloadMatches = [
  ...html.matchAll(
    /<link[^>]+rel=["']modulepreload["'][^>]+href=["']([^"']+\.js)["']/g,
  ),
].map((m) => m[1]);

const initialJs = [...new Set([...entryMatches, ...preloadMatches])];

if (initialJs.length === 0) {
  fail("Could not find any initial JS assets in index.html.");
}

let totalRaw = 0;
let totalGzip = 0;
const rows = [];

function resolveAsset(href) {
  // Strip an absolute origin if Vite ever emits one.
  let path = href.replace(/^https?:\/\/[^/]+/, "");
  // Strip the BASE_PATH prefix (Vite injects `base` into every href when
  // building with a non-root base, e.g. `/app/assets/foo.js`). We try the
  // configured BASE_PATH first, then fall back to assuming root-relative.
  const basePath = (process.env.BASE_PATH ?? "/").replace(/\/+$/, "");
  if (basePath && path.startsWith(basePath + "/")) {
    path = path.slice(basePath.length);
  }
  return join(distDir, path.replace(/^\//, ""));
}

for (const href of initialJs) {
  const abs = resolveAsset(href);
  if (!existsSync(abs) || !statSync(abs).isFile()) {
    fail(`Referenced asset ${href} not found at ${abs}.`);
  }
  const buf = readFileSync(abs);
  const gz = gzipSync(buf, { level: 9 }).length;
  totalRaw += buf.length;
  totalGzip += gz;
  rows.push({ href, raw: buf.length, gzip: gz });
}

rows.sort((a, b) => b.gzip - a.gzip);

const fmt = (n) => `${(n / 1024).toFixed(2)} kB`;

console.log("\n[perf-check] Initial JS for Home route (entry + modulepreload):");
console.log("  ─────────────────────────────────────────────────────────────");
for (const r of rows) {
  console.log(
    `  ${r.href.padEnd(48)}  ${fmt(r.raw).padStart(10)}  gz ${fmt(r.gzip).padStart(10)}`,
  );
}
console.log("  ─────────────────────────────────────────────────────────────");
console.log(
  `  ${"TOTAL".padEnd(48)}  ${fmt(totalRaw).padStart(10)}  gz ${fmt(totalGzip).padStart(10)}`,
);
console.log(`  Budget (gzip): ${fmt(BUDGET_GZIP_BYTES)}`);

if (totalGzip > BUDGET_GZIP_BYTES) {
  fail(
    `Initial JS gzip size ${fmt(totalGzip)} exceeds budget ${fmt(BUDGET_GZIP_BYTES)}. ` +
      `A heavy import has likely been pulled into the Home entry chunk. ` +
      `Inspect the largest chunk above and lazy-load it (React.lazy / dynamic import) ` +
      `or extend the manualChunks rules in vite.config.ts.`,
  );
}

const headroom = BUDGET_GZIP_BYTES - totalGzip;
console.log(
  `\n[perf-check] OK — ${fmt(totalGzip)} gzip is within budget (${fmt(headroom)} headroom).\n`,
);
