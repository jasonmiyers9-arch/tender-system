# Tender Guard Pro — Run Instructions

A compliance management and tender readiness platform for South African businesses.  
Built with **Next.js 16**, **React 19**, **TypeScript**, **Firebase** (Auth + Firestore + Storage), and **Tailwind CSS v4**.  
Deployed to **Netlify**.

---

## Overview

Tender Guard Pro helps companies manage compliance documents, track tender readiness scores, and apply for tenders from a unified portal. It supports three user roles:

| Role | Portal | Capabilities |
|------|--------|-------------|
| **Company User** | Dashboard, Vault, Score, Tenders | Upload compliance docs, track readiness score, browse & apply for tenders |
| **Evaluator** | Verification Portal | Search companies, review compliance reports, request updates, and download bundles |
| **Admin** | Admin Dashboard | Verify documents, manage accounts, audit logs, renewals pipeline |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend + BFF | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| Auth | Firebase Authentication (Email/Password + Google OAuth), JWT-based RBAC |
| Database | Cloud Firestore (with in-memory fallback for local dev) |
| File Storage | Firebase Storage (with local filesystem fallback) |
| AI/LLM | Gemini API (document summarization, scoring, knowledge Q&A, expiry extraction) |
| Deployment | Netlify (serverless functions via `@netlify/plugin-nextjs`) |
| State | Zustand (client), TanStack React Query v5 (server) |

---

## Project Structure

```
tender-system/
├── frontend/                     # Next.js 16 monolithic BFF
│   └── src/
│       ├── app/
│       │   ├── (auth)/           # Login, Register, Forgot Password, Verify Email
│       │   ├── (app)/            # Authenticated app pages
│       │   │   ├── home/         # Landing dashboard
│       │   │   ├── dashboard/    # Compliance overview
│       │   │   ├── vault/        # Document management
│       │   │   ├── score/        # Readiness scoring
│       │   │   ├── tenders/      # Tender marketplace & calendar
│       │   │   ├── applications/ # Tender applications
│       │   │   ├── company/      # Company profile
│       │   │   ├── verify/       # Evaluator portal
│       │   │   ├── provider/     # Evaluator portal
│       │   │   ├── admin/        # Admin dashboard
│       │   │   ├── knowledge/    # AI knowledge base
│       │   │   ├── renewals/     # Document renewals pipeline
│       │   │   ├── notifications/
│       │   │   ├── settings/
│       │   │   └── onboarding/
│       │   └── api/              # Next.js API route handlers (BFF)
│       ├── components/
│       │   ├── ui/               # Button, Card, Table, PageHeader, Input, etc.
│       │   ├── cards/            # ScoreCard, StatCard
│       │   ├── badges/           # StatusBadge, ScoreBandBadge
│       │   └── layout/           # AppShell, Sidebar, Topbar, Breadcrumbs
│       ├── lib/
│       │   ├── api/              # Client-side API modules + React Query hooks
│       │   ├── hooks/            # React Query hooks
│       │   ├── server/           # Server-only modules
│       │   │   ├── firebaseAdmin.ts       # Firebase Admin SDK init
│       │   │   ├── firestoreService.ts    # Firestore data layer
│       │   │   ├── firebaseStorage.ts     # Storage upload/download
│       │   │   ├── apiAuth.ts             # Auth middleware (requireAuth, requireRole, requireAdmin)
│       │   │   ├── complianceScoring.ts   # Deterministic scoring engine
│       │   │   ├── analystEngine.ts       # Hybrid scoring (deterministic + LLM)
│       │   │   ├── pdfExtractor.ts        # Dual-engine PDF extraction
│       │   │   ├── documentAi.ts          # AI document processing
│       │   │   ├── documentSummary.ts     # Gemini summarization
│       │   │   ├── expiryCheckService.ts  # Document expiry monitoring
│       │   │   ├── aiSettingsService.ts   # AI model configuration
│       │   │   ├── aiPrompts.ts           # LLM prompt templates
│       │   │   └── mockData.ts            # In-memory fallback data
│       │   └── utils/                     # Formatters, helpers
│       └── store/                # Zustand state management
├── netlify.toml                  # Netlify deployment config + security headers
└── RUN_INSTRUCTIONS.md           # This file
```

---

## Prerequisites

- **Node.js 20+** and **npm 10+**
- A **Firebase project** (required for production; local development supports mock fallback)
- Git

### Windows install (winget)

```powershell
winget install -e --id OpenJS.NodeJS.LTS
```

### Verify

```powershell
node -v    # v20+
npm -v     # 10+
```

---

## 1) Clone the Repo

```bash
git clone https://github.com/jasonmiyers9-arch/tender-system.git
cd tender-system
```

## 2) Install Dependencies

```bash
cd frontend
npm install
```

## 3) Configure Environment

Copy the example env file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

```env
# Firebase Admin (server-side — required for production)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Firebase Client (browser-side — required for Google Auth)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app

# Gemini AI (optional — enables AI features)
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-2.0-flash

# Scheduled jobs and outbound alerts (production)
CRON_SECRET=replace-with-a-long-random-secret
SENDGRID_API_KEY=SG...
SENDGRID_FROM_EMAIL=alerts@your-domain.co.za
SENDGRID_FROM_NAME=Tender Guard Pro
# Twilio SMS (preferred)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_FROM_NUMBER=+27...
# Clickatell SMS (optional fallback)
CLICKATELL_API_KEY=your-clickatell-api-key
CLICKATELL_FROM=TenderGuard

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Production requirement:** Firebase Admin, Firestore, Auth, and Storage must be configured. Production API routes fail closed instead of using memory or local disk. Mock fallback is development-only.

## 4) Start Development Server

```bash
npm run dev
```

App runs at: **http://localhost:3000**

## 5) Demo Accounts

One-click login buttons are available on the login page:

| Name | Email | Password | Role |
|------|-------|----------|------|
| Tender Demo User | demo@tenderguard.local | password | Company |
| Vusu | vusu@tenderguard.dev | Demo@1234 | Evaluator |
| Mouse | mouse@tenderguard.dev | Demo@1234 | Admin |

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (port 3000) |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint checks |
| `npm run typecheck` | TypeScript type checking |
| `npm run test` | Unit tests (Vitest) |
| `npm run test:coverage` | Tests with coverage report |
| `npm run test:e2e` | Playwright E2E tests |

---

## Deployment (Netlify)

The root `netlify.toml` configures:
- Build base: `frontend/`
- Build command: `npm install && npm run build`
- Plugin: `@netlify/plugin-nextjs`
- Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options

Set environment variables in the Netlify dashboard (same keys as `.env.local`).

### Scheduled automation

Netlify scheduled functions are included under `frontend/netlify/functions/`. Netlify evaluates schedules in UTC:

| Job | UTC | SAST |
|-----|-----|------|
| Tender ingestion | 03:00 daily | 05:00 daily |
| Tender matching | 03:30 daily | 05:30 daily |
| Expiry checks | 04:00 daily | 06:00 daily |
| Tender alerts/digests | 05:00 daily | 07:00 daily |
| Score snapshots | 21:59 daily | 23:59 daily |

Set `CRON_SECRET` and Firebase Admin credentials before publishing. Verify each function in **Netlify → Functions** using **Run now** after the first production deploy.

For AI, configure `GEMINI_API_KEY` and `GEMINI_MODEL` in Netlify. The Admin dashboard can also update the active key and model from the AI settings panel.

---

## Troubleshooting

### Port 3000 in use
```bash
npx kill-port 3000
npm run dev
```

### Firebase connection errors
- Verify `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` are set correctly
- The app will fall back to in-memory storage if Firebase is unavailable

### Build errors
```bash
npm run typecheck   # Check for TypeScript errors
npm run lint        # Check for lint issues
```

---

## UI Design System

- **Gradient PageHeader** banners on every page
- **Elevated cards** with rounded corners and shadows
- **Gradient CTA buttons** (indigo→purple primary, cyan secondary)
- **Color-coded icon squares** per feature area
- **Dark mode** support via CSS custom properties
- One-click demo login buttons on login page

## License

Private — All rights reserved.
