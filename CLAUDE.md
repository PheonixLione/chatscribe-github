# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (enforced — npm/yarn will be rejected).

```bash
# Install dependencies
pnpm install

# Development
pnpm --filter @workspace/web run dev          # Frontend (Vite, port 5173)
pnpm --filter @workspace/api-server run dev   # API server (Express)

# Build & typecheck
pnpm run build        # Full build (typecheck + all artifacts + bundle verification)
pnpm run typecheck    # Typecheck all workspaces

# Tests (API server only — extractor unit tests)
pnpm --filter @workspace/api-server run test

# Database schema push
pnpm --filter @workspace/db run push
```

## Architecture

Pnpm monorepo with two top-level workspace groups:

- **`artifacts/`** — deployable apps: `web` (React SPA), `api-server` (Express), `mockup-sandbox`
- **`lib/`** — shared packages: `api-zod` (Zod schemas), `api-client-react` (TanStack Query hooks), `api-spec` (Orval codegen), `db` (Drizzle ORM)
- **`netlify/functions/`** and **`api/`** — serverless adapter entry points for Netlify and Vercel respectively

### Frontend (`artifacts/web/`)

React 19 SPA built with Vite. Routing via Wouter, styling via TailwindCSS 4, data fetching via TanStack Query (hooks live in `lib/api-client-react`). Entry: `src/main.tsx` → `src/App.tsx` (router). Main extraction UI is `src/pages/Home.tsx`.

### Backend (`artifacts/api-server/`)

Express server. Routes mounted at `/api`. Key endpoint: `POST /api/extract` — takes a share URL, routes to the matching extractor, returns a `Conversation` JSON. Rate limiting via `express-rate-limit`; in serverless deployments uses Upstash Redis for distributed state.

### Extractor pattern

Each AI platform has a descriptor in `artifacts/api-server/src/lib/extractors/`:

```ts
{
  source: string         // "chatgpt" | "claude" | "gemini" | "grok" | "deepseek"
  urlPatterns: string[]  // regexes
  matches(url: URL): boolean
  extract(url: URL): Promise<Conversation>
}
```

`index.ts` iterates descriptors and delegates to the first match. Extractors use either raw HTTP fetch or Puppeteer headless browser depending on whether the platform exposes a public API.

### Deployment

Supports three deployment targets:
- **Netlify** — `netlify/functions/api.mts` wraps the Express app; config in `netlify.toml`
- **Vercel** — `api/[...all].ts`; config in `vercel.json`
- **Standalone Node.js** — run `artifacts/api-server` directly

Frontend builds to `artifacts/web/dist/public` in all cases.
