# TenderGuard Frontend

Next.js 16 app containing the UI and BFF API routes under `src/app/api`.

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

## Standalone Architecture

- UI pages and layouts: `src/app`
- API routes (BFF): `src/app/api`
- API clients: `src/lib/api`
- Server adapters (Firestore/Firebase): `src/lib/server`

## Deploy Notes (Netlify)

Root `netlify.toml` already configures frontend deployment with:
- base: `frontend`
- build command: `npm install && npm run build`
- plugin: `@netlify/plugin-nextjs`

## Environment Variables

See `.env.example` for required variables. Minimum for Firestore-backed routes:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
