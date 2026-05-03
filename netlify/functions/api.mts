import serverless from "serverless-http";
import app from "../../artifacts/api-server/src/app";

const handler = serverless(app, {
  binary: false,
  request: (req: { netlifyContext?: unknown }, _event: unknown, context: unknown) => {
    req.netlifyContext = context;
  },
});

export default handler;
