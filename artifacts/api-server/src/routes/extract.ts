import { Router, type IRouter, type RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { ExtractConversationBody } from "@workspace/api-zod";
import { extractFromUrl, listSources, ExtractError } from "../lib/extractors";

const router: IRouter = Router();

const IS_SERVERLESS =
  process.env["NETLIFY"] === "true" || process.env["VERCEL"] === "1";

/**
 * Per-IP rate limit on the extractor. Prevents a single client from pinning
 * outbound bandwidth or exhausting fetch concurrency by hammering the
 * endpoint. Numbers are intentionally generous for normal interactive use
 * but tight enough to stop abusive bursts.
 *
 * Disabled in serverless deployments (Netlify, Vercel) because the
 * default in-memory store is useless when every invocation may land on
 * a fresh Lambda container — the limit would silently reset on every
 * cold start. To re-enable on a serverless platform, swap the store
 * for `rate-limit-redis` backed by Upstash or Vercel KV.
 */
const extractLimiter: RequestHandler = IS_SERVERLESS
  ? (_req, _res, next) => next()
  : rateLimit({
      windowMs: 60 * 1000,
      limit: 20,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      handler: (_req, res) => {
        // Distinct semantic code so clients can tell throttling apart from
        // a genuine upstream fetch failure. Not part of ExtractErrorCode
        // (which describes per-extractor outcomes), but the frontend
        // renders the `message` directly so any string is safe here.
        res.status(429).json({
          error: "rate_limited",
          message:
            "You're sending requests too quickly. Please wait a moment and try again.",
        });
      },
    });

router.post("/extract", extractLimiter, async (req, res) => {
  const parsed = ExtractConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "unsupported_url",
      message: "Please provide a valid share URL.",
    });
    return;
  }
  try {
    const conv = await extractFromUrl(parsed.data.url);
    res.json(conv);
  } catch (err) {
    if (err instanceof ExtractError) {
      res.status(err.status).json({
        error: err.code,
        message: err.message,
        ...(err.source ? { source: err.source } : {}),
      });
      return;
    }
    res.status(500).json({
      error: "parse_failed",
      message: (err as Error).message || "Unknown server error.",
    });
  }
});

router.get("/sources", (_req, res) => {
  res.json({ sources: listSources() });
});

export default router;
