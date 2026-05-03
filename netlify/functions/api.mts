import serverless from "serverless-http";
import app from "../../artifacts/api-server/src/app";

// Surface late-cycle crashes in the Netlify function log instead of a
// silent 502 with no trace. Listener registered at module init so it
// catches anything thrown after the response is dispatched.
process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? `${reason.message}\n${reason.stack}` : String(reason);
  process.stderr.write(`[netlify-api] unhandledRejection: ${msg}\n`);
});
process.on("uncaughtException", (err) => {
  process.stderr.write(`[netlify-api] uncaughtException: ${err.message}\n${err.stack}\n`);
});

// NAMED `handler` export — Netlify's bootstrap looks up `module.handler`,
// not `module.default`. Using only `export default` previously caused
// every invocation to crash with `TypeError: y.handler is not a function`.
export const handler = serverless(app, {
  binary: false,
  request: (req: { netlifyContext?: unknown }, _event: unknown, context: unknown) => {
    req.netlifyContext = context;
  },
});
