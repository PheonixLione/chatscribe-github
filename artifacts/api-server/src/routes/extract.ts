import { Router, type IRouter, type RequestHandler } from "express";
import rateLimit, {
  type Store,
  type IncrementResponse,
  type Options,
} from "express-rate-limit";
import { ExtractConversationBody } from "@workspace/api-zod";
import { extractFromUrl, listSources, ExtractError } from "../lib/extractors";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const IS_SERVERLESS =
  process.env["NETLIFY"] === "true" || process.env["VERCEL"] === "1";

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    logger.warn(
      { envVar: name, value: raw, fallback },
      "Invalid rate-limit env var (expected positive integer); using fallback",
    );
    return fallback;
  }
  return n;
}

const RATE_LIMIT_WINDOW_MS = readPositiveInt("RATE_LIMIT_WINDOW_MS", 60 * 1000);
const RATE_LIMIT_MAX = readPositiveInt("RATE_LIMIT_MAX", 20);

/**
 * Distributed rate-limit store backed by Upstash Redis (REST). Used in
 * serverless deploys (Netlify/Vercel) where the default in-memory store
 * is useless because each function invocation may land on a fresh
 * Lambda container — the counter would silently reset on every cold
 * start.
 *
 * We talk to Upstash through its high-level client (HTTP, not TCP) and
 * rely on `incr` + `pexpire` for an atomic-enough counter:
 *  - `incr` returns the new total, returning 1 on the first hit
 *  - on that first hit we set the TTL once, so the window resets
 *    `windowMs` after the *first* request in the window (matches the
 *    semantics of express-rate-limit's MemoryStore).
 *
 * That's two round-trips on the very first request of a window and one
 * thereafter — well within Upstash's free 10K commands/day even under
 * sustained traffic.
 */
class UpstashStore implements Store {
  windowMs!: number;
  readonly redis: import("@upstash/redis").Redis;
  readonly prefix: string;

  constructor(
    redis: import("@upstash/redis").Redis,
    prefix = "rl:extract:",
  ) {
    this.redis = redis;
    this.prefix = prefix;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  private k(key: string): string {
    return `${this.prefix}${key}`;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const k = this.k(key);
    const totalHits = await this.redis.incr(k);
    if (totalHits === 1) {
      await this.redis.pexpire(k, this.windowMs);
    }
    const pttl = await this.redis.pttl(k);
    const resetTime = new Date(
      Date.now() + (pttl > 0 ? pttl : this.windowMs),
    );
    return { totalHits, resetTime };
  }

  async decrement(key: string): Promise<void> {
    await this.redis.decr(this.k(key));
  }

  async resetKey(key: string): Promise<void> {
    await this.redis.del(this.k(key));
  }
}

async function buildUpstashStore(): Promise<Store | null> {
  const url = process.env["UPSTASH_REDIS_REST_URL"];
  const token = process.env["UPSTASH_REDIS_REST_TOKEN"];
  if (!url || !token) return null;

  try {
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({ url, token });
    logger.info("Rate limiter using Upstash Redis store");
    return new UpstashStore(redis);
  } catch (err) {
    logger.warn(
      { err: (err as Error).message },
      "Failed to initialize Upstash rate-limit store; falling back",
    );
    return null;
  }
}

/**
 * Per-IP rate limit on the extractor. Prevents a single client from pinning
 * outbound bandwidth or exhausting fetch concurrency by hammering the
 * endpoint. Numbers are intentionally generous for normal interactive use
 * but tight enough to stop abusive bursts.
 *
 * Behaviour by environment:
 *  - Long-running server (Replit, local): in-memory counter, always on.
 *  - Serverless WITH Upstash creds: distributed counter via Upstash
 *    REST — survives cold starts.
 *  - Serverless WITHOUT Upstash creds: no-op (preserves the previous
 *    behaviour so deploys don't suddenly start 500-ing). A warning is
 *    logged at boot so operators notice.
 *
 * Tunables (env vars):
 *  - `RATE_LIMIT_WINDOW_MS` (default 60_000)
 *  - `RATE_LIMIT_MAX`       (default 20)
 *  - `UPSTASH_REDIS_REST_URL`   — enables distributed mode
 *  - `UPSTASH_REDIS_REST_TOKEN` — enables distributed mode
 */
async function buildLimiter(): Promise<RequestHandler> {
  const store = await buildUpstashStore();

  if (IS_SERVERLESS && !store) {
    logger.warn(
      "Serverless deploy without UPSTASH_REDIS_REST_URL/TOKEN — /api/extract is NOT rate-limited",
    );
    return (_req, _res, next) => next();
  }

  return rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    limit: RATE_LIMIT_MAX,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    ...(store ? { store } : {}),
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
}

// Resolve once at module load. The promise resolves synchronously-fast
// (no network) — the dynamic import is purely for code-splitting so the
// Upstash SDK isn't pulled into cold starts that don't need it.
let limiterPromise: Promise<RequestHandler> = buildLimiter();

const extractLimiter: RequestHandler = (req, res, next) => {
  limiterPromise
    .then((fn) => fn(req, res, next))
    .catch((err) => {
      logger.error({ err }, "Rate limiter failed; allowing request through");
      next();
    });
};

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
