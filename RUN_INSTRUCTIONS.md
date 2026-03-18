# Tender System — Run Instructions(MVP)

These steps let u clone and run the project locally.

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
