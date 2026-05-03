/**
 * Netlify serverless entry for the ChatScribe API.
 *
 * Strategy: keep the Express app authoritative (it's the same code that
 * runs on Replit / Render / Railway), and wrap it once here for AWS
 * Lambda's request/response shape via `serverless-http`.
 *
 * The Express app is imported from source — Netlify's esbuild bundler
 * compiles it and follows the pnpm workspace symlinks for shared
 * packages like @workspace/api-zod.
 *
 * Runtime branching for Chromium happens inside `headless.ts`, which
 * checks `process.env.NETLIFY` and uses @sparticuz/chromium-min in
 * place of the system Chromium binary used on Replit.
 */
import serverless from "serverless-http";
import app from "../../artifacts/api-server/src/app";

// `serverless-http` wraps the Express app so it can be invoked with
// (event, context) like a Lambda function. We disable `binary` because
// every API response is JSON — no need to base64-encode bodies.
const handler = serverless(app, {
  binary: false,
  // Trim irrelevant request bookkeeping from the lambda response object.
  request: (req: { netlifyContext?: unknown }, _event: unknown, context: unknown) => {
    req.netlifyContext = context;
  },
});

export default handler;
