# TenderGuard Pro

A compliance management and tender readiness platform for South African businesses. Upload compliance documents, get AI-powered readiness scores, browse matched government tenders, and apply — all from one portal.

Built with **Next.js 16**, **React 19**, **Firebase** (Auth + Firestore + Storage), **Tailwind CSS v4**, and **OpenRouter AI**.

---

## Current State

The app is a **fully functional monolithic BFF** (Backend-for-Frontend) with 53 API routes, 30+ pages, and 15 server-side services. It runs entirely from the `frontend/` directory — there is no separate backend.

### What Works

- **Authentication**: Email/password + Google OAuth sign-in/register, role-based access (Company, Evaluator, Admin), demo login buttons
- **Document Vault**: Upload compliance documents (PDF, DOC, XLS, images, ZIP — up to 10 MB), AI-powered text extraction, expiry detection, verification workflow
- **Compliance Scoring**: Weighted scoring engine (completeness 25%, validity 25%, requirement matching 30%, verification 20%) with optional LLM-based adjustment via OpenRouter
- **Tender Marketplace**: Browse tenders with AI match scores, category filters, deadline calendar with iCal export, gap analysis before applying
- **Tender Scraper**: Scrapes SA government sites (eTenders.gov.za, tenderbulletins.co.za), parses full detail pages, downloads and extracts attached PDFs, filters by company categories
- **Applications**: Submit applications to tenders, evaluator-side review with document access, approve/reject workflow
- **Evaluator Portal**: Create/edit/delete tenders, define required documents, review applications
- **Admin Portal**: Account approvals (with 48h SLA tracking), document verification queue, Kanban renewal pipeline, audit log, AI settings management, scraper controls, frontend health monitoring
- **Knowledge Base**: AI Q&A against uploaded document content via OpenRouter LLM
- **Notifications**: Expiry reminders, deadline alerts, configurable preferences
- **In-Memory Fallback**: Everything runs locally without Firebase — the app seeds mock data automatically

### User Roles

| Role | Access |
|------|--------|
| **Company** | Dashboard, Vault, Score, Tenders, Applications, Company Profile, Knowledge Base |
| **Evaluator** | Create Tenders, Review Applications, Verify Companies |
| **Admin** | Full platform: Account Approvals, Document Verification, Audit Log, Scraper, AI Settings, Monitoring |

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Auth | Firebase Authentication (Email/Password + Google) |
| Database | Cloud Firestore (in-memory fallback for local dev) |
| Storage | Firebase Storage (local filesystem fallback) |
| AI | OpenRouter API (summarization, scoring adjustment, knowledge Q&A) |
| PDF Extraction | pdfjs-dist + pdf-parse (dual-engine with caching) |
| Web Scraping | Cheerio |
| State Management | Zustand (client), TanStack React Query v5 (server) |
| Testing | Vitest + Testing Library (unit), Playwright (E2E) |
| Deployment | Netlify via `@netlify/plugin-nextjs` |

---

## Getting Started

### Prerequisites

- **Node.js 20+** and **npm 10+**
- Git

```powershell
# Windows (winget)
winget install -e --id OpenJS.NodeJS.LTS

# Verify
node -v   # should be 20+
npm -v    # should be 10+
```

### 1. Clone and install

```bash
git clone https://github.com/CodeWithMouse/tender-system.git
cd tender-system/frontend
npm install
```

### 2. Configure environment (optional)

Create a `.env.local` file in `frontend/`:

```env
# Firebase Admin (server-side — optional, app works without it)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Firebase Client (browser-side — optional, needed for Google Auth)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app

# OpenRouter AI (optional — enables AI scoring, summaries, knowledge Q&A)
OPENROUTER_API_KEY=sk-or-v1-...

# Scheduled jobs and outbound alerts (production)
CRON_SECRET=replace-with-a-long-random-secret
SENDGRID_API_KEY=SG...
SENDGRID_FROM_EMAIL=alerts@your-domain.co.za
SENDGRID_FROM_NAME=TenderGuard Pro
CLICKATELL_API_KEY=your-clickatell-api-key
CLICKATELL_FROM=TenderGuard

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **No Firebase? No problem.** Without any env vars, the app runs fully functional using an in-memory database seeded with mock data. All features work locally.

### 3. Run the dev server

```bash
npm run dev
```

Open **http://localhost:3000**

### 4. Demo accounts

The login page has one-click demo login buttons:

| Name | Email | Password | Role |
|------|-------|----------|------|
| Tender Demo User | demo@tenderguard.local | password | Company |
| Vusu | vusu@tenderguard.dev | Demo@1234 | Evaluator |
| Mouse | mouse@tenderguard.dev | Demo@1234 | Admin |

Or register a new company account via the sign-up page.

---

## Project Structure

```
tender-system/
├── frontend/                         # Next.js 16 monolithic BFF
│   └── src/
│       ├── app/
│       │   ├── (auth)/               # Login, Register, Forgot Password, Verify Email
│       │   ├── (app)/                # Authenticated pages
│       │   │   ├── home/             # Role-aware dashboard
│       │   │   ├── dashboard/        # Compliance overview + onboarding checklist
│       │   │   ├── vault/            # Document management + upload
│       │   │   ├── score/            # Compliance score gauge + history
│       │   │   ├── tenders/          # Marketplace, detail, apply, calendar
│       │   │   ├── applications/     # Submitted applications
│       │   │   ├── company/          # Company profile editor
│       │   │   ├── knowledge/        # AI document Q&A
│       │   │   ├── verify/           # Evaluator company compliance reports
│       │   │   ├── provider/         # Evaluator portal (CRUD + review)
│       │   │   ├── admin/            # Admin dashboard, accounts, docs, audit, scraper
│       │   │   ├── notifications/    # Notification center
│       │   │   ├── settings/         # Preferences
│       │   │   ├── account/          # Personal profile
│       │   │   └── onboarding/       # Post-registration wizard
│       │   └── api/                  # 53 API route handlers
│       ├── components/               # UI component library
│       ├── lib/
│       │   ├── api/                  # Client-side API wrappers + types
│       │   ├── hooks/                # React Query hooks
│       │   ├── server/               # 15 server-side services
│       │   └── utils/
│       └── store/                    # Zustand state management
├── netlify.toml                      # Deployment + security headers
└── infra/
    └── docker-compose.yml            # Legacy (not required)
```

---

## Available Scripts

Run from the `frontend/` directory:

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (http://localhost:3000) |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint checks |
| `npm run typecheck` | TypeScript type checking |
| `npm run test` | Unit tests (Vitest) |
| `npm run test:coverage` | Tests with coverage report |
| `npm run test:e2e` | Playwright E2E tests |

---

## Deployment (Netlify)

The root `netlify.toml` is pre-configured:

- **Base**: `frontend/`
- **Build**: `npm install && npm run build`
- **Plugin**: `@netlify/plugin-nextjs`
- **Security headers**: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- **Scheduled functions** (all times UTC):
  - Tender ingestion: `03:00` daily (`05:00` SAST)
  - Tender matching: `03:30` daily (`05:30` SAST)
  - Document expiry checks: `04:00` daily (`06:00` SAST)
  - Tender alerts and digests: `05:00` daily (`07:00` SAST)
  - Compliance score snapshots: `21:59` daily (`23:59` SAST)

Set the same environment variables from `.env.local` in the Netlify dashboard. Production automation requires `CRON_SECRET` and Firebase Admin credentials; without Firestore, separate serverless invocations cannot share tender or job-run state. Scheduled functions run only on published deploys and can be tested with **Run now** from Netlify's Functions page.

---

## Troubleshooting

**Port 3000 in use:**
```bash
npx kill-port 3000
npm run dev
```

**Firebase connection errors:** The app auto-falls back to in-memory storage. Check that `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` are correct if you want persistence.

**Build errors:**
```bash
npm run typecheck   # TypeScript errors
npm run lint        # Lint issues
```

---

## License

Private — CodeWithMouse. All rights reserved.
