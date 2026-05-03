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
