/**
 * Vercel serverless entry for the ChatScribe API.
 *
 * Vercel auto-discovers files under `/api/` and treats `export default`
 * as the request handler. Express applications are valid handlers
 * because `app(req, res)` matches the Node http signature, so we just
 * re-export the same Express app the long-lived Replit deployment uses.
 *
 * The rewrite `/api/(.*) → /api/index` in vercel.json funnels every
 * `/api/*` request through this single function — Express's own
 * router takes it from there.
 *
 * Runtime branching for Chromium happens inside `headless.ts`, which
 * checks `process.env.VERCEL` (set automatically by Vercel) and uses
 * @sparticuz/chromium-min in place of the system Chromium binary
 * used on Replit.
 *
 * Note: The user explicitly redirected this project to Netlify
 * (see netlify.toml). This Vercel entry is kept so the same codebase
 * supports either platform — pick ONE for any given deployment.
 */
import app from "../artifacts/api-server/src/app";

export default app;
