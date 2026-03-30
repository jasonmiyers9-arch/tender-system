import asyncio
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.api.ops import router as ops_router
from app.api.auth import router as auth_router
from app.api.companies import router as companies_router
from app.api.documents import router as documents_router
from app.api.admin_dashboard import router as admin_dashboard_router
from app.api.admin_docs import router as admin_docs_router
from app.api.notifications import router as notifications_router
from app.api.score import router as score_router
from app.api.audit import router as audit_router
from app.api.verify import router as verify_router
from app.api.tenders import router as tenders_router
from app.api.applications import router as applications_router
from app.api.tenders import seed_system_tenders
from app.db.session import AsyncSessionLocal
from app.db.redis import close_pool
from app.services.expiry_service import expiry_notification_loop


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload)


def configure_logging() -> None:
    root = logging.getLogger()
    root.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))

    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())

    root.handlers.clear()
    root.addHandler(handler)


configure_logging()
logger = logging.getLogger("tenderguard.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup seeding + background tasks, graceful shutdown."""
    # Startup — each step is fault-tolerant so tests / cold-start work without Postgres/Redis
    try:
        logger.info("startup: seeding system tenders")
        async with AsyncSessionLocal() as db:
            await seed_system_tenders(db)
    except Exception as exc:
        logger.warning("startup: seed_system_tenders skipped (%s)", exc)

    try:
        expiry_task: asyncio.Task | None = asyncio.create_task(expiry_notification_loop())
        logger.info("startup: expiry notification loop started")
    except Exception as exc:
        logger.warning("startup: expiry_notification_loop skipped (%s)", exc)
        expiry_task = None

    yield  # Application runs here

    # Shutdown
    if expiry_task and not expiry_task.done():
        expiry_task.cancel()
        try:
            await expiry_task
        except asyncio.CancelledError:
            pass
    await close_pool()
    logger.info("shutdown: complete")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_log_middleware(request: Request, call_next):
    logger.info("request_started %s %s", request.method, request.url.path)
    try:
        response = await call_next(request)
    except Exception as exc:  # pragma: no cover
        logger.error(
            "unhandled_exception %s %s: %s",
            request.method,
            request.url.path,
            exc,
            exc_info=True,
        )
        # Manually set CORS headers because BaseHTTPMiddleware error responses
        # bypass the CORSMiddleware send-wrapper (known Starlette limitation).
        origin = request.headers.get("origin", "")
        cors_headers: dict[str, str] = {"Vary": "Origin"}
        if origin:
            cors_headers["Access-Control-Allow-Origin"] = origin
            cors_headers["Access-Control-Allow-Credentials"] = "true"
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error. Please try again later."},
            headers=cors_headers,
        )
    logger.info("request_completed %s %s %s", request.method, request.url.path, response.status_code)
    return response


app.include_router(ops_router)
app.include_router(auth_router)
app.include_router(companies_router)
app.include_router(documents_router)
app.include_router(admin_dashboard_router)
app.include_router(admin_docs_router)
app.include_router(notifications_router)
app.include_router(score_router)
app.include_router(tenders_router)
app.include_router(applications_router)
app.include_router(audit_router)
app.include_router(verify_router)


@app.get("/health")
async def health_check():
    return {"ok": True}
