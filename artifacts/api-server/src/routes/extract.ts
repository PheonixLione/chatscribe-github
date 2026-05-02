import { Router, type IRouter } from "express";
import { ExtractConversationBody } from "@workspace/api-zod";
import { extractFromUrl, listSources, ExtractError } from "../lib/extractors";

const router: IRouter = Router();

router.post("/extract", async (req, res) => {
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
