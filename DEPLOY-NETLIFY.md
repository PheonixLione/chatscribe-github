# Deploying ChatScribe to Netlify (free tier)

This repo is configured to deploy as a single Netlify site:

- **Frontend** (`artifacts/web`) → static SPA served from `dist/public`
- **Backend** (`artifacts/api-server`) → wrapped as a single serverless
  function at `/.netlify/functions/api`, reachable as `/api/*` via the
  rewrite in `netlify.toml`

## One-time setup

1. Push this repo to GitHub / GitLab / Bitbucket.
2. In Netlify, **Add new site → Import an existing project** and pick the repo.
3. Netlify auto-detects `netlify.toml` — leave the build command and
   publish directory as Netlify suggests (they're already set in the
   toml file).
4. Click **Deploy site**. First deploy takes ~3 minutes (pnpm install
   from cold).

That's it. No environment variables are required for a basic deploy —
`CHROMIUM_PACK_URL` is set in `netlify.toml`.

## How requests flow

```
Browser → https://your-site.netlify.app/api/extract
       → netlify.toml rewrite → /.netlify/functions/api/extract
       → netlify/functions/api.mts (serverless-http wrapper)
       → artifacts/api-server/src/app.ts (Express app)
       → router → extractor → response
```

## What works on Netlify free tier

| Platform     | Method                  | Status                          |
| ------------ | ----------------------- | ------------------------------- |
| ChatGPT      | Plain HTTP fetch        | ✅ Reliable, fast               |
| Claude       | Plain HTTP fetch        | ✅ Reliable, fast               |
| Grok         | Plain HTTP fetch        | ✅ Reliable, fast               |
| Perplexity   | Plain HTTP fetch        | ✅ Reliable, fast               |
| Gemini       | Headless browser        | ⚠️ Cold-start sensitive         |
| DeepSeek     | Headless browser        | ⚠️ Cold-start sensitive         |

Gemini and DeepSeek require a real browser (their share pages render
entirely with JavaScript). On Netlify's free tier, functions have a
**hard 10-second timeout**. Cold-starting Chromium takes ~3-5 seconds
on the first request after the container goes idle, leaving very
little budget for slow renders. Expect:

- **Warm container** (recent traffic): ~95% success rate, 2-4 s latency
- **Cold container** (first request after idle): ~50-70% success rate

If a render times out, the user sees a friendly error message, not a
500 — they can just retry and the now-warm container will succeed.

## Free tier limits to watch

- **125,000 function invocations / month** — generous; only a problem
  if you get serious traffic.
- **100 hours of function runtime / month** — at ~3 s per extraction,
  that's ~120,000 extractions before you hit the cap.
- **100 GB bandwidth / month** — fine for a static SPA + small JSON.
- **300 build minutes / month** — each deploy ≈ 2 min, so ~150 deploys.

## Upgrading the Chromium binary

`netlify.toml` pins `CHROMIUM_PACK_URL` to a specific Sparticuz release
(`v148.0.0`). When you bump `@sparticuz/chromium-min` in
`artifacts/api-server/package.json`, **also update the URL in
`netlify.toml`** to the matching pack release — the package version
and the binary tarball must agree or the launch will fail.

Releases are at: https://github.com/Sparticuz/chromium/releases

## Re-enabling rate limiting on Netlify

The default in-memory rate limiter is disabled in serverless mode (see
the comment in `artifacts/api-server/src/routes/extract.ts`). To turn
it back on with a distributed store:

1. Provision an Upstash Redis (free tier: 10K commands/day).
2. `pnpm --filter @workspace/api-server add rate-limit-redis @upstash/redis`
3. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in
   Netlify's site env vars.
4. Replace the `IS_SERVERLESS ? noop : rateLimit({...})` ternary with
   a `rateLimit({ store: new RedisStore({...}) })` call.

## Local development on Netlify-style runtime

```bash
pnpm dlx netlify-cli@latest dev
```

This serves the frontend, runs the function locally, and applies the
rewrites. Useful for validating changes before pushing.

## What if Gemini/DeepSeek reliability matters?

Three options, in increasing order of effort:

1. **Upgrade to Netlify Pro** ($19/mo) — bumps function timeout to 26 s
   and unlocks background functions (15 min). Gemini becomes ~99% reliable.
2. **Run the API on Render or Railway** instead — both have free tiers
   that run the existing Express server unmodified, with no Chromium
   size constraints and 30+ second request timeouts. Set the frontend
   `VITE_API_URL` to the Render/Railway URL and host only the SPA on
   Netlify.
3. **Stay on Replit Deploy** — it's already configured and Just Works
   for both providers.
