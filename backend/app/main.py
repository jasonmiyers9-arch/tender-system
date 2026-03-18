import asyncio
import json
import logging
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.ops import router as ops_router
from app.api.auth import router as auth_router
from app.api.companies import router as companies_router
from app.api.documents import router as documents_router
from app.api.admin_dashboard import router as admin_dashboard_router
from app.api.admin_docs import router as admin_docs_router
from app.api.notifications import router as notifications_router
from app.api.score import router as score_router
from app.api.tenders import router as tenders_router
from app.services.expiry_notifications import expiry_notification_loop


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
expiry_task: asyncio.Task | None = None

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
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
    response = await call_next(request)
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


@app.on_event("startup")
async def startup_tasks() -> None:
    global expiry_task
    if expiry_task is None or expiry_task.done():
        expiry_task = asyncio.create_task(expiry_notification_loop())


@app.on_event("shutdown")
async def shutdown_tasks() -> None:
    global expiry_task
    if expiry_task and not expiry_task.done():
        expiry_task.cancel()
        try:
            await expiry_task
        except asyncio.CancelledError:
            pass


@app.get("/health")
async def health_check():
    return {"ok": True}
