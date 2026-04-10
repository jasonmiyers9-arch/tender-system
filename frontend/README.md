# TenderGuard Frontend

Next.js 16 monolithic BFF containing the UI and 52 API route handlers under `src/app/api`.

## Requirements

- Node.js 20+
- npm 10+

## Setup

1. Install dependencies:
   - `npm install`
2. Create env file:
   - copy `.env.example` to `.env.local`
3. Start dev server:
   - `npm run dev`

App URL: `http://localhost:3000`

## Scripts

- `npm run dev` - Start dev server
- `npm run build` - Production build
- `npm run start` - Run production server
- `npm run lint` - ESLint checks
- `npm run typecheck` - TypeScript checks
- `npm run test` - Unit tests (Vitest)
- `npm run test:coverage` - Unit tests with coverage
- `npm run test:e2e` - Playwright smoke tests

## Architecture

- **UI pages and layouts**: `src/app/(app)/`, `src/app/(auth)/`
- **API routes (BFF)**: `src/app/api/` — 52 handlers across auth, tenders, documents, score, admin, etc.
- **API clients**: `src/lib/api/` — client-side fetch wrappers
- **React Query hooks**: `src/lib/hooks/` — TanStack React Query v5
- **Server services**: `src/lib/server/` — 13 modules (Firebase Admin, Firestore, scoring, PDF extraction, AI)
- **Auth middleware**: `src/lib/server/apiAuth.ts` — `requireAuth()`, `requireRole()`, `requireAdmin()`
- **State management**: `src/store/` — Zustand with localStorage persistence

## Deploy (Netlify)

Root `netlify.toml` configures:
- base: `frontend`
- build command: `npm install && npm run build`
- plugin: `@netlify/plugin-nextjs`
- Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options

## Environment Variables

See `.env.example` for all variables. Key groups:

| Variable | Purpose |
|----------|---------|
| `FIREBASE_PROJECT_ID` | Firebase Admin (server-side) |
| `FIREBASE_CLIENT_EMAIL` | Firebase Admin (server-side) |
| `FIREBASE_PRIVATE_KEY` | Firebase Admin (server-side) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Client (browser) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Client (browser) |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Client (browser) |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Client (browser) |
| `OPENROUTER_API_KEY` | OpenRouter AI (optional) |
| `NEXT_PUBLIC_APP_URL` | App URL for redirects |

> Without Firebase config, the app runs locally with an in-memory database fallback.
