# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Web app (artifacts/web) — SEO

- Router: `wouter`. Routes: `/`, `/how-it-works`, `/supported-platforms`, `/faq`, `/about`, `/privacy`, `/terms`, `*` 404.
- Shared chrome: `src/components/Layout.tsx` (sticky header + footer) wraps every page.
- Per-route meta tags: `useSEO()` hook in `src/lib/seo.ts` updates title / description / canonical / OG / Twitter.
- **`SITE_URL` constant in `src/lib/seo.ts` is the launch domain.** Currently `https://chatextractor.replit.app` — change it once the production domain is decided. Also update `public/robots.txt`, `public/sitemap.xml`, and `index.html` (canonical, og:url, twitter:image, JSON-LD `url`) to match.
- Structured data: `WebApplication` JSON-LD in `index.html`, `WebSite` + `SearchAction` in `Home.tsx`, `FAQPage` in `Faq.tsx`.
- `public/robots.txt` allows all crawlers and points to `/sitemap.xml`. `public/sitemap.xml` lists every public route.
- Add new content pages by: creating `src/pages/X.tsx` (using `Layout` + `ContentPage` + `useSEO`), registering the route in `src/App.tsx`, adding the link to `Layout` nav/footer, and appending the URL to `public/sitemap.xml`.

## Web app — Topical cluster (hub & spoke)

- **Pillar guide** at `/guides/save-ai-conversations` is the topical hub. It covers the entire "saving AI conversations" topic and links down to all spoke guides.
- **Spoke guides** at `/guides/save-chatgpt-as-pdf`, `/guides/export-claude-to-markdown`, `/guides/download-gemini-chat`, `/guides/save-grok-conversation`, `/guides/convert-ai-chat-to-markdown`. Each links back to the pillar and across to siblings (dense interlinking signal).
- **Index** at `/guides` lists pillar + all spokes with `ItemList` schema.
- **`GuideLayout`** (`src/components/GuideLayout.tsx`) is the shared shell for spoke pages. It auto-emits `BreadcrumbList`, `HowTo`, and `FAQPage` JSON-LD from the props you pass in.
- Helper functions in `src/lib/seo.ts`: `useJsonLd(id, data)` (cleanup-aware injection), `breadcrumbLd()`, `howToLd()`, `faqLd()`.
- Every spoke leads with a "Quick answer" callout (TL;DR paragraph styled in a primary-tinted box). This is what AI Overviews and featured snippets pull from — keep it concise, direct, and front-loaded with the platform/format the page targets.
- Adding a new spoke: create `src/pages/guides/X.tsx` returning `<GuideLayout ... />` with `path`, `title`, `description`, `tldr`, `howTo.steps[]`, `faqs[]`, `related[]`, optional `pillar`. Then register the route in `App.tsx`, add it to `SPOKES` in `GuidesIndex.tsx`, append it to `public/sitemap.xml`, and add `related[]` cross-links from sibling spokes.
- `Organization` JSON-LD lives in `index.html` alongside the existing `WebApplication` block — both are global, no per-route handling needed.

## Web app — Performance budget

- `pnpm --filter @workspace/web run perf-check` runs a production build and asserts the **initial JS for the Home route** (entry chunk + every `<link rel="modulepreload">`) stays under a gzip budget. Default ceiling is 245 kB gzip; current total is ~205 kB gzip.
- The script (`artifacts/web/scripts/perf-check.mjs`) parses `dist/public/index.html`, finds every JS asset the browser fetches before interactivity, gzip-compresses each one, and exits 1 if the sum exceeds the budget. Override the ceiling with `PERF_BUDGET_GZIP_BYTES=...`.
- Run this before merging any change that touches `src/pages/Home.tsx`, `src/App.tsx`, `src/main.tsx`, or `vite.config.ts`'s `manualChunks`. If it fails, the script prints the per-chunk gzip breakdown — the offender is almost always a heavy dep (markdown, syntax-highlighter, pdf, etc.) that got statically imported into the entry chunk instead of `React.lazy`'d.
- The chunking rules in `vite.config.ts` plus `modulePreload.resolveDependencies` keep `markdown`, `syntax-highlighter`, and `pdf` chunks out of the initial preload set — do not weaken either without re-running `perf-check`.

## Web app — Ads & ad-blocker enforcement

- **Single source of truth**: `src/config/adNetworks.ts`. To add or remove an ad network, change `enabled: true|false` and fill in the credentials object — nothing else needs to change. Read the "Compatibility notes" comment at the bottom of that file before enabling multiple networks together (AdSense + popunder networks usually violates AdSense ToS).
- **Supported networks**: Google AdSense (in-content banners), Adsterra (banner / native / social-bar / popunder), PropellerAds (popunder + interstitial), PopAds (popunder), HilltopAds and any other network via the generic `custom.scripts[]` array.
- **Ad components** live in `src/components/ads/`:
  - `ScriptInjector` — generic third-party script loader. Supports `waitForUserGesture` to defer injection until first click/scroll/keydown, which is required for popunder networks (browser popup blockers) and is also how we keep the popunder/interstitial off Googlebot's radar (Googlebot doesn't gesture, so it never triggers them — sidesteps Google's "intrusive interstitial" SEO penalty).
  - `PopunderLoader` — eagerly mounted in `App.tsx`. Loads every enabled popunder network (Adsterra, PropellerAds, PopAds, custom). Tiny module, no perf impact. Browsers enforce one popup per user gesture so only ONE popunder fires regardless of how many networks you enable.
  - `InterstitialAd` (lazy) — full-screen overlay with countdown gate (default 5s) before the close button appears. Renders an iframe URL or arbitrary HTML snippet from `AD_NETWORKS.interstitial`. Once-per-session via sessionStorage flag. Locks body scroll while open.
  - `SocialBar` (lazy) — sticky bottom-bar ad (Adsterra "Social Bar" / similar). Loads after first user gesture.
  - `AdSlot` (refactored) — banner placeholder with a `provider` prop: `"adsense" | "adsterra" | "custom"`. Defaults to whichever banner network is enabled. Adsterra path uses a per-instance `atOptions_<slot>` global to avoid the network's well-known global-collision bug when multiple banners are on one page. Custom path executes injected `<script>` tags inline.
- **Lazy-loading & perf budget**: `InterstitialAd` and `SocialBar` are loaded via `React.lazy` and excluded from `modulePreload` (vite.config.ts filter excludes `/ads-` chunks). All ad-component code is also bundled into its own `ads` manualChunk so it never bleeds into the entry chunk. The 245 kB gzip Home-route budget is preserved unchanged.
- **"Unskippable" caveat**: there is no way to make a browser interstitial truly un-closeable — the user can always close the tab. We delay the close button by `interstitial.skipAfterSeconds` (default 5s), which is the industry standard. Longer values cause bounce-rate spikes.
- **AdblockGuard interaction**: every ad component renders inside the existing `AdblockGuard` wrapper, so when an ad blocker is detected the whole tree (including all ad networks) is hidden behind the emotional overlay. No bypassing needed.

### Original AdblockGuard

- The whole app is wrapped in `AdblockGuard` (`src/components/AdblockGuard.tsx`) which runs five independent detection probes — bait `/ads.js` script, network fetch of `/ads.js`, hidden DOM bait element with classes filter lists target, real `<ins class="adsbygoogle">` tag, and bait image at `/ads/banner.gif`. Probes re-run every 4 s and on window focus.
- When any probe trips, a full-screen overlay (`AdblockOverlay`) blocks all interaction with an emotional "please disable" message and a retry button. Body scroll is locked while the overlay is up.
- Bait file `public/ads.js` sets `window.canRunAds = true`. Filter lists block it by default so the flag stays unset for users with blockers.
- `AdSlot` component (`src/components/AdSlot.tsx`) is the placeholder for ad units. Currently rendered on the Home page as `home-top`, `home-mid`, and `result-top` (above the extracted conversation).
- **Before launch**: replace `ca-pub-XXXXXXXXXXXXXXXX` in two places — the `<script async src="...adsbygoogle.js?client=...">` tag in `index.html`, and the `data-ad-client` attribute inside `AdSlot.tsx` — with your real AdSense publisher ID. Then create individual ad units in AdSense and pass each unit's slot ID to the `<AdSlot slot="..." />` instances.
- Ad-blocker detection is a layered best-effort. Sophisticated users with custom uBlock filters can still bypass any in-browser detector — there is no perfect solution. The combined probes catch all common blockers (uBlock Origin, AdBlock Plus, Brave Shields, AdGuard, Ghostery) at default settings.

## Deployment — Replit, Netlify, Vercel (all from the same codebase)

The app supports three deployment paths from the same codebase. Backend code branches on `process.env.NETLIFY` and `process.env.VERCEL`. Pick ONE platform per deployment — do not deploy two at the same domain.

- **Replit Deploy** (default, recommended). Long-lived Express server. System Chromium found via `$PATH`. Full pino-http logging, in-memory rate limiter (20 req/min/IP). All extractors (ChatGPT, Claude, Grok, Gemini, DeepSeek) reliable.
- **Netlify Functions** (free tier — user's documented preference). Express app wrapped via `serverless-http` at `netlify/functions/api.mts`, mounted at `/api/*` via `netlify.toml` rewrite. Chromium via `@sparticuz/chromium-min` (binary downloaded into `/tmp` on cold start from `CHROMIUM_PACK_URL`). Pino-http and rate limiter disabled (Lambda-incompatible). HTTP-only extractors (ChatGPT/Claude/Grok) reliable; Gemini/DeepSeek work but cold-start sensitive due to 10-second sync function timeout. See `DEPLOY-NETLIFY.md`.
- **Vercel** (free tier). Express app re-exported from `api/[...all].ts` (catch-all dynamic route); `vercel.json` configures the build and SPA fallback. Same Chromium and serverless trade-offs as Netlify (Lambda-based, 10 s Hobby timeout). Vercel auto-sets `process.env.VERCEL=1` so all the serverless branches activate. `CHROMIUM_PACK_URL` falls back to a hardcoded Sparticuz v148 default in `headless.ts` so Vercel deploys work without any env-var configuration. See `DEPLOY-VERCEL.md`.

Files involved:
- `netlify.toml` / `vercel.json` — per-platform build, publish, function, rewrites
- `.netlifyignore` / `.vercelignore` — each excludes the other's config + Replit-only files
- `netlify/functions/api.mts` — Netlify entry, `serverless-http` wrapper
- `api/[...all].ts` — Vercel entry (catch-all dynamic route), re-exports the Express app directly so `req.url` keeps the original `/api/*` path for Express's mount to match
- `artifacts/api-server/src/lib/extractors/headless.ts` — branches on `IS_SERVERLESS` to choose chromium-min vs system Chromium; throws `headless_unavailable` (HTTP 503) on serverless launch/timeout failures so the frontend can prompt a retry
- `artifacts/api-server/src/lib/extractors/types.ts` + `lib/api-spec/openapi.yaml` — `headless_unavailable` is a first-class error code in the OpenAPI spec; regenerate `lib/api-zod` via `pnpm --filter @workspace/api-spec run codegen` after any schema change
- `artifacts/api-server/src/app.ts` — branches on `IS_SERVERLESS` to skip pino-http worker thread
- `artifacts/api-server/src/routes/extract.ts` — branches on `IS_SERVERLESS` to disable in-memory rate limiter

When upgrading `@sparticuz/chromium-min`, also bump `CHROMIUM_PACK_URL` in `netlify.toml` (and any platform env vars on Vercel) to the matching pack release at https://github.com/Sparticuz/chromium/releases — the package version and binary tarball must agree.
