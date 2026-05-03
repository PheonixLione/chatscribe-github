/**
 * Vercel serverless catch-all entry for the ChatScribe API.
 *
 * Vercel routes any request matching `/api/*` to this function
 * because the file lives at `/api/[...all].ts` (catch-all dynamic
 * route). The original request URL (e.g. `/api/extract`) is
 * preserved on `req.url`, so Express's `/api` mount matches its
 * own routes (`/api/extract`, `/api/sources`, `/api/healthz`)
 * without any path rewriting.
 *
 * Express applications are valid Vercel handlers because
 * `app(req, res)` matches the Node http signature, so we just
 * re-export the same Express app the long-lived Replit deployment
 * uses. Runtime branching for Chromium happens inside `headless.ts`,
 * which checks `process.env.VERCEL` (set automatically by Vercel)
 * and uses @sparticuz/chromium-min in place of system Chromium.
 *
 * Note: The user explicitly redirected this project to Netlify
 * (see netlify.toml). This Vercel entry is kept so the same
 * codebase supports either platform — pick ONE per deployment.
 */
import app from "../artifacts/api-server/src/app";

export default app;
