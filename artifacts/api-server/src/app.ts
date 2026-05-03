import express, { type Express } from "express";
import cors from "cors";
import { createRequire } from "node:module";
import router from "./routes";

const IS_SERVERLESS =
  process.env["NETLIFY"] === "true" || process.env["VERCEL"] === "1";

const app: Express = express();

app.set("trust proxy", 1);

if (!IS_SERVERLESS) {
  // Lazy-load pino-http + logger only on long-lived servers so the
  // serverless bundle stays small and avoids pino's worker thread.
  const require = createRequire(import.meta.url);
  const pinoHttp = require("pino-http") as typeof import("pino-http").default;
  const { logger } = require("./lib/logger") as typeof import("./lib/logger");
  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url?.split("?")[0],
          };
        },
        res(res) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
    }),
  );
} else {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const dur = Date.now() - start;
      if (res.statusCode >= 400 || dur > 2000) {
        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify({
            method: req.method,
            url: req.url.split("?")[0],
            status: res.statusCode,
            ms: dur,
          }),
        );
      }
    });
    next();
  });
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
