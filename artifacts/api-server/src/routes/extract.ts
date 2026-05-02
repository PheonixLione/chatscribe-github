import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { ExtractConversationBody } from "@workspace/api-zod";
import { extractFromUrl, listSources, ExtractError } from "../lib/extractors";

const router: IRouter = Router();

/**
 * Per-IP rate limit on the extractor. Prevents a single client from pinning
 * outbound bandwidth or exhausting fetch concurrency by hammering the
 * endpoint. Numbers are intentionally generous for normal interactive use
 * but tight enough to stop abusive bursts.
 */
const extractLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: "fetch_failed",
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
