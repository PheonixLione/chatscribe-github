import serverless from "serverless-http";
import app from "../../artifacts/api-server/src/app";

const inner = serverless(app, {
  binary: false,
  request: (req: { netlifyContext?: unknown }, _event: unknown, context: unknown) => {
    req.netlifyContext = context;
  },
});

// Wrap so any uncaught error inside the Express stack surfaces in the
// Netlify function log instead of returning a silent 502 with no trace.
const handler = async (event: unknown, context: unknown) => {
  try {
    return await (inner as unknown as (
      e: unknown,
      c: unknown,
    ) => Promise<unknown>)(event, context);
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    process.stderr.write(`[netlify-api] uncaught: ${msg}\n`);
    throw err;
  }
};

export default handler;

// Also log unhandled promise rejections — these silently kill Lambdas.
process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? `${reason.message}\n${reason.stack}` : String(reason);
  process.stderr.write(`[netlify-api] unhandledRejection: ${msg}\n`);
});
