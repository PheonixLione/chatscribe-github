# Deploying ChatScribe to Vercel (free tier)

> **The user's primary deployment target for this project is Netlify
> (see `DEPLOY-NETLIFY.md`).** Vercel is also supported because the
> backend's runtime branching recognizes `process.env.VERCEL`. Pick
> ONE platform per deployment — do not deploy both at the same domain.

## One-time setup

1. Push this repo to GitHub / GitLab / Bitbucket.
2. In Vercel, **Add New… → Project** and import the repo.
3. Vercel auto-detects `vercel.json` — accept the suggested settings.
4. Click **Deploy**.

That's it. No required environment variables — `CHROMIUM_PACK_URL`
defaults to a hardcoded Sparticuz v148 release in `headless.ts`. If
you upgrade `@sparticuz/chromium-min`, you can either bump the
default in `headless.ts` or override `CHROMIUM_PACK_URL` in
**Project → Settings → Environment Variables**.

## How requests flow

```
Browser → https://your-site.vercel.app/api/extract
       → Vercel auto-routes /api/* to api/[...all].ts (catch-all)
       → api/[...all].ts re-exports the Express app
       → Express router matches /api/extract
       → extractor → response
```

The catch-all dynamic route (`api/[...all].ts`) means Vercel sends every
`/api/*` request to a single function with the original URL preserved
on `req.url`. Express's `/api` mount then matches its own routes
without any path rewriting — no `vercel.json` rewrite needed for the
API surface, only the SPA fallback for client-side routes.

## Reliability matrix

Same as Netlify (both run on AWS Lambda with a 10-second free-tier
function timeout):

| Platform     | Method                  | Status                          |
| ------------ | ----------------------- | ------------------------------- |
| ChatGPT      | Plain HTTP fetch        | ✅ Reliable, fast               |
| Claude       | Plain HTTP fetch        | ✅ Reliable, fast               |
| Grok         | Plain HTTP fetch        | ✅ Reliable, fast               |
| Perplexity   | Plain HTTP fetch        | ✅ Reliable, fast               |
| Gemini       | Headless browser        | ⚠️ Cold-start sensitive         |
| DeepSeek     | Headless browser        | ⚠️ Cold-start sensitive         |

Cold-start failures and render-budget timeouts return a friendly
JSON `{ "error": "headless_unavailable", "message": "..." }` (HTTP
503), never an opaque platform 504. The frontend renders the
message directly so users can retry — a warm container almost
always succeeds the second time.

## Free-tier limits to watch

- **Hobby plan: 100 GB-hours of function execution / month** —
  generous; only a problem if you get serious traffic.
- **100 GB bandwidth / month** — fine for a static SPA + JSON.
- **45 minutes of build time / month** — each deploy ≈ 2 min, so
  ~22 deploys/month before paying.

## Local Vercel-style dev

```bash
pnpm dlx vercel@latest dev
```

Useful for validating function rewrites before pushing.

## If Gemini/DeepSeek reliability matters

Same options as Netlify — see the matching section in `DEPLOY-NETLIFY.md`.
