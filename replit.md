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

## Web app — Ads & ad-blocker enforcement

- The whole app is wrapped in `AdblockGuard` (`src/components/AdblockGuard.tsx`) which runs five independent detection probes — bait `/ads.js` script, network fetch of `/ads.js`, hidden DOM bait element with classes filter lists target, real `<ins class="adsbygoogle">` tag, and bait image at `/ads/banner.gif`. Probes re-run every 4 s and on window focus.
- When any probe trips, a full-screen overlay (`AdblockOverlay`) blocks all interaction with an emotional "please disable" message and a retry button. Body scroll is locked while the overlay is up.
- Bait file `public/ads.js` sets `window.canRunAds = true`. Filter lists block it by default so the flag stays unset for users with blockers.
- `AdSlot` component (`src/components/AdSlot.tsx`) is the placeholder for ad units. Currently rendered on the Home page as `home-top`, `home-mid`, and `result-top` (above the extracted conversation).
- **Before launch**: replace `ca-pub-XXXXXXXXXXXXXXXX` in two places — the `<script async src="...adsbygoogle.js?client=...">` tag in `index.html`, and the `data-ad-client` attribute inside `AdSlot.tsx` — with your real AdSense publisher ID. Then create individual ad units in AdSense and pass each unit's slot ID to the `<AdSlot slot="..." />` instances.
- Ad-blocker detection is a layered best-effort. Sophisticated users with custom uBlock filters can still bypass any in-browser detector — there is no perfect solution. The combined probes catch all common blockers (uBlock Origin, AdBlock Plus, Brave Shields, AdGuard, Ghostery) at default settings.
