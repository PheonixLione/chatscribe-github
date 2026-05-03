# Deploy ChatScribe to Netlify (free tier)

A 3-step, zero-config deploy from a downloaded zip.

## 1. Download

In Replit, **⋮ → Download as zip**, then unzip locally.

## 2. Push to Netlify

Either:

- **Drag & drop:** open <https://app.netlify.com/drop> and drop the
  unzipped folder onto the page, **or**
- **Git import:** push the folder to a GitHub repo, then in Netlify
  pick **Add new site → Import an existing project** and select it.

## 3. Click Deploy

Netlify auto-detects `netlify.toml` and uses these settings — leave
them as-is:

- Build command: `pnpm install --frozen-lockfile=false && pnpm --filter @workspace/web build`
- Publish directory: `artifacts/web/dist/public`
- Functions directory: `netlify/functions`
- Node version: `22`

No environment variables are required. First build takes ~3 min.

## What you get

- React SPA at `/` with client-side routing (hard refresh works on any route).
- Same-origin API at `/api/*` (no CORS), backed by a single serverless
  function wrapping the Express app.
- Static-fetch extractors (ChatGPT old shares, Claude, Grok, Perplexity)
  work on the first request.
- Headless extractors (Gemini, DeepSeek, modern ChatGPT shares) use
  `@sparticuz/chromium-min`, downloaded on cold start into `/tmp`.

## Expected behavior

Netlify's free tier hard-kills functions at **10 seconds**. On a cold
container, Gemini/DeepSeek extractions occasionally exceed that budget
during the one-time Chromium download. When they do, the API returns
the friendly `headless_unavailable` error (HTTP 503) instead of a
generic 500 — **just retry once and the now-warm container will
succeed**. The frontend already handles this gracefully.

## Verifying the function bundle locally

Netlify bundles `netlify/functions/api.mts` with esbuild during deploy.
A local script reproduces that step so you catch broken bundles
(unresolved imports, missing workspace packages, oversized output)
before pushing:

```sh
pnpm --filter @workspace/scripts run verify-netlify-bundle
```

It runs as part of the root `pnpm build`, fails on any esbuild error,
and rejects bundles larger than 40 MB (safety margin under Netlify's
50 MB function size limit).

## Upgrading Chromium

`netlify.toml` pins `CHROMIUM_PACK_URL` to the exact tarball that
matches `@sparticuz/chromium-min` in
`artifacts/api-server/package.json`. When you bump the package, also
update the URL — keep the two in lockstep.
