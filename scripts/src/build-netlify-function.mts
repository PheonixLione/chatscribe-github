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
// Only remove the previous build output. Keep package.json (which is
// committed and declares "type": "module" so the .mjs loads as ESM).
await rm(join(outdir, "api.mjs"), { force: true });
await rm(join(outdir, "api.mjs.map"), { force: true });

const result = await build({
  entryPoints: [entry],
  outdir,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  mainFields: ["main", "module"],
  conditions: ["node"],
  outExtension: { ".js": ".mjs" },
  logLevel: "warning",
  // Same banner verify-netlify-bundle uses: lets bundled CJS deps that
  // call `require(...)` (lazy pino-http, etc.) keep working in ESM.
  banner: {
    js: "import { createRequire as __nv_cr } from 'module'; const require = __nv_cr(import.meta.url);",
  },
});

if (result.errors.length > 0) {
  console.error("[build-netlify-function] esbuild errors:", result.errors);
  process.exit(1);
}

console.log(`[build-netlify-function] wrote ${outdir}/api.mjs`);
