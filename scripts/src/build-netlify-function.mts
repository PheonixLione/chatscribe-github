/**
 * Pre-build the Netlify function as a fully self-contained ESM bundle.
 *
 * Why we don't rely on Netlify's deploy-time bundler:
 *   - For .mts entries with `"type": "module"`, Netlify's
 *     `zip-it-and-ship-it` falls back to NFT (file inclusion only),
 *     even when `node_bundler = "esbuild"` is set in netlify.toml.
 *   - NFT doesn't follow pnpm workspace symlinks reliably under
 *     Lambda's read-only /var/task layout, so transitive deps like
 *     `express` (in artifacts/api-server/node_modules) are never
 *     copied and the function crashes at cold start with
 *     ERR_MODULE_NOT_FOUND.
 *
 * Doing it ourselves with esbuild produces a single ~7.6 MB .mjs that
 * has every dep inlined — Netlify just zips and ships.
 */
import { build } from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const entry = resolve(repoRoot, "netlify/functions/api.mts");
const outdir = resolve(repoRoot, "netlify/functions-built");

await mkdir(outdir, { recursive: true });
// Clear any previous build output (both ESM and CJS variants from
// older revisions of this script).
await rm(join(outdir, "api.mjs"), { force: true });
await rm(join(outdir, "api.mjs.map"), { force: true });
await rm(join(outdir, "api.js"), { force: true });
await rm(join(outdir, "api.js.map"), { force: true });

// Output as CJS — Netlify's deploy-time esbuild step ALWAYS converts
// our function to CJS (its default output format), and the previous
// ESM-with-banner approach left an `import.meta.url` reference that
// became `undefined` after that conversion → cold-start crash. Building
// CJS from the start sidesteps the conversion: `require()` is native
// and Netlify ships api.js unchanged.
//
// Some bundled deps (chromium-min, enhanced-resolve) reference
// `import.meta.url` directly. esbuild's default CJS lowering sets
// `import_meta = {}`, so `import.meta.url` becomes `undefined` and
// `fileURLToPath(undefined)` throws. The `define` below replaces every
// `import.meta.url` site with a real `file://` URL derived from the
// CJS-native `__filename`.
const result = await build({
  entryPoints: [entry],
  outdir,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  mainFields: ["main", "module"],
  conditions: ["node"],
  outExtension: { ".js": ".js" },
  logLevel: "warning",
  define: {
    "import.meta.url": "__nv_import_meta_url",
    "process.env.NODE_ENV": '"production"',
    "process.env.NETLIFY": '"true"',
  },
  banner: {
    js: "const __nv_import_meta_url = require('url').pathToFileURL(__filename).href;",
  },
});

if (result.errors.length > 0) {
  console.error("[build-netlify-function] esbuild errors:", result.errors);
  process.exit(1);
}

console.log(`[build-netlify-function] wrote ${outdir}/api.js`);
