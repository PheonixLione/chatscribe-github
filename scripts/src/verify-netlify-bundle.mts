import { build } from "esbuild";
import { mkdtemp, rm, stat, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const entry = resolve(repoRoot, "netlify/functions/api.mts");

const SIZE_LIMIT_BYTES = 40 * 1024 * 1024;

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  for (const name of await readdir(dir)) {
    const p = join(dir, name);
    const s = await stat(p);
    total += s.isDirectory() ? await dirSize(p) : s.size;
  }
  return total;
}

function formatBytes(n: number): string {
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

async function main(): Promise<void> {
  const outdir = await mkdtemp(join(tmpdir(), "netlify-verify-"));
  console.log(`[verify-netlify-bundle] entry: ${entry}`);
  console.log(`[verify-netlify-bundle] outdir: ${outdir}`);

  try {
    // These options intentionally mirror Netlify's zip-it-and-ship-it
    // esbuild defaults for a Node 22 function written as ESM (.mts):
    // platform=node, format=esm, bundle=true, node mainFields/conditions,
    // .mjs out extension. The createRequire banner matches what Netlify
    // injects so CJS-style `require(...)` calls inside the api-server
    // graph (e.g. lazy-loaded pino-http) bundle correctly.
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
      metafile: true,
      banner: {
        js: "import { createRequire as __nv_cr } from 'module'; const require = __nv_cr(import.meta.url);",
      },
    });

    if (result.errors.length > 0) {
      throw new Error(
        `esbuild reported ${result.errors.length} error(s).`,
      );
    }

    const size = await dirSize(outdir);
    console.log(
      `[verify-netlify-bundle] bundle size: ${formatBytes(size)} (limit ${formatBytes(SIZE_LIMIT_BYTES)})`,
    );

    if (size > SIZE_LIMIT_BYTES) {
      throw new Error(
        `bundle exceeds ${formatBytes(SIZE_LIMIT_BYTES)} safety margin under Netlify's 50 MB limit.`,
      );
    }

    console.log("[verify-netlify-bundle] OK");
  } finally {
    await rm(outdir, { recursive: true, force: true });
  }
}

main().catch((err: unknown) => {
  console.error("[verify-netlify-bundle] FAIL:", err);
  process.exitCode = 1;
});
