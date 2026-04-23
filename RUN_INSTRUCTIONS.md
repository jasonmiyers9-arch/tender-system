# TenderGuard — Compliance & Tender Management System

A compliance management and tender readiness platform for South African businesses. Built with **Next.js 15**, **React 19**, **TypeScript**, and **Tailwind CSS v4**.

---

## Overview

TenderGuard helps companies manage compliance documents, track tender readiness scores, and apply for tenders — all from a unified portal. It supports three distinct user roles:

| Role | Portal | Capabilities |
|------|--------|-------------|
| **Company User** | Dashboard, Vault, Score, Tenders | Upload compliance docs, track readiness score, browse & apply for tenders |
| **Tender Provider** | Provider Dashboard | Create tenders, review applications, manage provider profile |
| **Admin** | Managed Service Dashboard | Verify documents, manage accounts, audit logs, renewals pipeline |

### Key Features

- **Compliance Vault** — Upload, track, and manage B-BBEE certificates, tax clearance, CIPC registration, and other compliance documents
- **Tender Readiness Score** — Real-time scoring based on document completeness and validity
- **Tender Marketplace** — Browse available tenders with match scoring, apply directly
- **Evaluator Portal** — Third-party verification of company compliance records
- **Admin Dashboard** — Kanban-style renewals pipeline, document verification, audit logs
- **Notifications** — Document expiry reminders and system alerts
- **SA Compliance** — CSD supplier numbers, B-BBEE levels, CIDB grades, province tracking

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| Data | Firestore (Firebase) with in-memory mock data fallback |
| Auth | JWT-based with role-based access control |
| Storage | Firebase Storage |

---

## Project Structure

```
tender-system/
├── frontend/                  # Next.js 15 app
│   └── src/
│       ├── app/
│       │   ├── (auth)/        # Login, Register, Forgot Password, Verify Email
│       │   ├── (app)/         # Authenticated app pages
│       │   │   ├── home/      # Landing dashboard with quick actions
│       │   │   ├── dashboard/ # Compliance overview
│       │   │   ├── vault/     # Document management
│       │   │   ├── score/     # Readiness scoring
│       │   │   ├── tenders/   # Tender marketplace & calendar
│       │   │   ├── applications/ # My tender applications
│       │   │   ├── company/   # Company profile & SA compliance
│       │   │   ├── verify/    # Evaluator search portal
│       │   │   ├── provider/  # Tender provider portal
│       │   │   ├── admin/     # Admin dashboard & management
│       │   │   ├── notifications/
│       │   │   ├── settings/
│       │   │   └── onboarding/
│       │   ├── api/           # Next.js API routes (auth, companies, tenders, etc.)
│       │   └── page.tsx       # Root redirect
│       ├── components/
│       │   ├── ui/            # Button, Card, Table, PageHeader, Input, etc.
│       │   ├── cards/         # ScoreCard, StatCard
│       │   ├── badges/        # StatusBadge, ScoreBandBadge
│       │   └── layout/        # AppShell, Sidebar, Topbar, Breadcrumbs
│       ├── lib/
│       │   ├── api/           # API client modules
│       │   ├── hooks/         # React Query hooks
│       │   ├── server/        # Firestore service, Firebase admin, mock data
│       │   └── utils/         # Formatters, helpers
│       └── store/             # Zustand state management
└── RUN_INSTRUCTIONS.md        # This file
```

---

## Run Instructions

### Prerequisites

- **Node.js 20+** and **npm**

```powershell
winget install -e --id OpenJS.NodeJS.LTS
```

### Start the app

```bash
cd frontend
npm install
npm run dev
```

App runs at: `http://localhost:3000`

The app works out of the box with mock data. To connect to Firebase/Firestore, configure environment variables in `frontend/.env.local`.

---

## Demo Accounts

One-click login buttons are available on the login page for demo access.

---

## License

Private — CodeWithMouse. All rights reserved.
