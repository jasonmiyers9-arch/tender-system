from collections import deque
from datetime import datetime, timezone
from time import perf_counter
from typing import Deque, Literal
from urllib.request import Request, urlopen

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.config import settings

router = APIRouter(prefix="/ops/frontend", tags=["ops"])


class FrontendHeartbeatIn(BaseModel):
    route: str = "/"
    user_agent: str | None = None
    build_id: str | None = None


class FrontendEventIn(BaseModel):
    level: Literal["info", "warning", "error"] = "error"
    message: str = Field(min_length=1, max_length=2000)
    route: str = "/"
    stack: str | None = None


class FrontendEvent(BaseModel):
    timestamp: str
    level: str
    message: str
    route: str
    stack: str | None = None


MAX_EVENTS = 200
_EVENTS: Deque[FrontendEvent] = deque(maxlen=MAX_EVENTS)
_HEARTBEAT: dict[str, str | None] = {
    "last_seen_at": None,
    "last_route": None,
    "last_user_agent": None,
    "last_build_id": None,
}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _frontend_probe(url: str) -> tuple[bool, int | None, float | None, str | None]:
    start = perf_counter()
    try:
        req = Request(url, method="GET")
        with urlopen(req, timeout=4) as resp:  # nosec B310 - internal monitoring URL
            elapsed = (perf_counter() - start) * 1000
            return True, int(resp.status), round(elapsed, 1), None
    except Exception as exc:
        elapsed = (perf_counter() - start) * 1000
        return False, None, round(elapsed, 1), str(exc)


@router.get("/status")
def frontend_status():
    now = _utc_now()
    ok, status_code, latency_ms, error = _frontend_probe(settings.FRONTEND_APP_URL)

    last_seen_at = _HEARTBEAT["last_seen_at"]
    seconds_since_heartbeat = None
    if isinstance(last_seen_at, str):
        delta = now - datetime.fromisoformat(last_seen_at)
        seconds_since_heartbeat = int(delta.total_seconds())

    return {
        "frontend_url": settings.FRONTEND_APP_URL,
        "reachable": ok,
        "status_code": status_code,
        "latency_ms": latency_ms,
        "probe_error": error,
        "checked_at": now.isoformat(),
        "last_heartbeat": {
            "at": _HEARTBEAT["last_seen_at"],
            "route": _HEARTBEAT["last_route"],
            "user_agent": _HEARTBEAT["last_user_agent"],
            "build_id": _HEARTBEAT["last_build_id"],
            "seconds_since": seconds_since_heartbeat,
        },
        "events_count": len(_EVENTS),
    }


@router.post("/heartbeat")
def frontend_heartbeat(payload: FrontendHeartbeatIn):
    now = _utc_now().isoformat()
    _HEARTBEAT["last_seen_at"] = now
    _HEARTBEAT["last_route"] = payload.route
    _HEARTBEAT["last_user_agent"] = payload.user_agent
    _HEARTBEAT["last_build_id"] = payload.build_id
    return {"ok": True, "received_at": now}


@router.post("/events")
def frontend_event(payload: FrontendEventIn):
    evt = FrontendEvent(
        timestamp=_utc_now().isoformat(),
        level=payload.level,
        message=payload.message,
        route=payload.route,
        stack=payload.stack,
    )
    _EVENTS.appendleft(evt)
    return {"ok": True}


@router.get("/events")
def frontend_events(limit: int = 20):
    safe_limit = max(1, min(limit, 100))
    return {
        "items": [e.model_dump() for e in list(_EVENTS)[:safe_limit]],
        "total": len(_EVENTS),
    }
