# TenderGuard — Compliance & Tender Management System

A full-stack compliance management and tender readiness platform for South African businesses. Built with **Next.js 15**, **FastAPI**, **PostgreSQL**, and **Tailwind CSS v4**.

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
| Backend | FastAPI, SQLAlchemy, Alembic, Pydantic |
| Database | PostgreSQL 16, Redis |
| Infrastructure | Docker Compose |
| Auth | JWT-based with role-based access control |

---

## UI Design System

The app uses a consistent design language across all pages:

- **Gradient PageHeader** banners (`linear-gradient(135deg, #1E1B4B → #312E81 → #1E3A5C)`) on every page
- **Elevated cards** with `card-shadow`, `rounded-2xl`, white surface backgrounds
- **Gradient CTA buttons** (indigo→purple primary, cyan secondary, red danger, green success)
- **Color-coded icon squares** per feature area
- **Dark mode** support via CSS custom properties
- **Demo login** — one-click access with seeded Mouse (admin) and Vusu (evaluator) accounts

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
│       │   └── page.tsx       # Root redirect
│       ├── components/
│       │   ├── ui/            # Button, Card, Table, PageHeader, Input, etc.
│       │   ├── cards/         # ScoreCard, StatCard
│       │   ├── badges/        # StatusBadge, ScoreBandBadge
│       │   └── layout/        # AppShell, Sidebar, Topbar, Breadcrumbs
│       ├── lib/
│       │   ├── api/           # API client modules
│       │   ├── hooks/         # React Query hooks
│       │   └── utils/         # Formatters, helpers
│       └── store/             # Zustand state management
├── backend/                   # FastAPI server
│   ├── app/
│   │   ├── api/               # Route handlers
│   │   ├── core/              # Config
│   │   ├── db/                # Database session
│   │   ├── models/            # SQLAlchemy models
│   │   └── services/          # Business logic
│   ├── main_alembic/          # DB migrations
│   └── tests/                 # Contract & integration tests
├── infra/
│   └── docker-compose.yml     # Postgres + Redis
└── RUN_INSTRUCTIONS.md        # This file
```

---

## Run Instructions (MVP)

## 1) Prerequisites

Install:
- **Git**
- **Docker Desktop** (or Docker Engine + Compose)
- **Node.js 20+** and **npm**
- **Python 3.11+** and **pip**

### Windows install commands (winget)

```powershell
winget install -e --id Docker.DockerDesktop
winget install -e --id OpenJS.NodeJS.LTS
winget install -e --id Python.Python.3.11
```

### Verify installations

```powershell
docker --version
docker compose version
node -v
npm -v
python --version
pip --version
```

> If `docker` is not recognized immediately after install, restart Windows (or sign out/in), then open Docker Desktop once.

## 2) Clone the repo

```bash
git clone https://github.com/CodeWithMouse/tender-system.git
cd tender-system
```

## 3) Start infrastructure (Postgres + Redis)

From project root:

```bash
docker compose -f infra/docker-compose.yml up -d
```

This starts:
- Postgres on `localhost:5432`
- Redis on `localhost:6379`

Default DB credentials in this project:
- DB: `tenderguard`
- User: `tenderadmin`
- Password: `tenderpassword`

## 4) Run backend (FastAPI)

Open a terminal in `backend`:

```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate

pip install --upgrade pip
pip install fastapi "uvicorn[standard]" sqlalchemy asyncpg alembic pydantic-settings
```

Run DB migrations:

```bash
alembic upgrade head
```

Start backend:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health check:
- `http://localhost:8000/health`

## 5) Run frontend (Next.js)

Open another terminal in `frontend`:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at:
- `http://localhost:3000`

## 6) Stop services

From project root:

```bash
docker compose -f infra/docker-compose.yml down
```

---

## Troubleshooting

### Port already in use
- Change host ports in `infra/docker-compose.yml`, or stop conflicting apps.

### Backend cannot connect to DB
- Make sure Docker containers are running:
  ```bash
  docker ps
  ```
- Confirm Postgres is up on `5432`.

### Migration errors
- Ensure you are in `backend/` when running `alembic upgrade head`.

### CORS issues
- Backend currently allows `http://localhost:3000`.

---

## Demo Accounts

After running the backend, seed demo users:

```bash
cd backend
python seed_demo_users.py
```

This creates:

| Name | Email | Password | Role |
|------|-------|----------|------|
| Mouse | mouse@tenderguard.co.za | Mouse@123 | Admin |
| Vusu | vusu@tenderguard.co.za | Vusu@123 | Evaluator |

One-click login buttons are also available on the login page.

---

## License

Private — CodeWithMouse. All rights reserved.
