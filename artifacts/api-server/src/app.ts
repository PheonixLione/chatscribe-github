import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

// Detect AWS-Lambda-style serverless platforms (Netlify Functions, Vercel).
// `pino-http`'s default config relies on a worker thread which crashes
// inside Lambda's frozen event loop, and rate limiters with in-memory
// stores are useless when every invocation is a fresh container.
const IS_SERVERLESS =
  process.env["NETLIFY"] === "true" || process.env["VERCEL"] === "1";

const app: Express = express();

// Both Replit (mTLS proxy) and Netlify (Lambda + their CDN) put the real
// client IP in X-Forwarded-For. Trust the first proxy hop so req.ip
// resolves correctly when the rate limiter or extractor logs need it.
app.set("trust proxy", 1);

if (!IS_SERVERLESS) {
  // Long-lived server path: full structured logging via pino-http.
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
  // Serverless path: minimal sync logging to stdout. Netlify/Vercel
  // already capture per-invocation timing & status in their dashboards;
  // we only log when something interesting happens (errors, slow
  // requests). Avoids pino's worker thread which doesn't survive
  // Lambda's frozen-on-response model.
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
