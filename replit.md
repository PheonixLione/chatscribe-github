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

- The whole app is wrapped in `AdblockGuard` (`src/components/AdblockGuard.tsx`) which runs five independent detection probes — bait `/ads.js` script, network fetch of `/ads.js`, hidden DOM bait element with classes filter lists target, real `<ins class="adsbygoogle">` tag, and bait image at `/ads/banner.gif`. Probes re-run every 4 s and on window focus.
- When any probe trips, a full-screen overlay (`AdblockOverlay`) blocks all interaction with an emotional "please disable" message and a retry button. Body scroll is locked while the overlay is up.
- Bait file `public/ads.js` sets `window.canRunAds = true`. Filter lists block it by default so the flag stays unset for users with blockers.
- `AdSlot` component (`src/components/AdSlot.tsx`) is the placeholder for ad units. Currently rendered on the Home page as `home-top`, `home-mid`, and `result-top` (above the extracted conversation).
- **Before launch**: replace `ca-pub-XXXXXXXXXXXXXXXX` in two places — the `<script async src="...adsbygoogle.js?client=...">` tag in `index.html`, and the `data-ad-client` attribute inside `AdSlot.tsx` — with your real AdSense publisher ID. Then create individual ad units in AdSense and pass each unit's slot ID to the `<AdSlot slot="..." />` instances.
- Ad-blocker detection is a layered best-effort. Sophisticated users with custom uBlock filters can still bypass any in-browser detector — there is no perfect solution. The combined probes catch all common blockers (uBlock Origin, AdBlock Plus, Brave Shields, AdGuard, Ghostery) at default settings.
