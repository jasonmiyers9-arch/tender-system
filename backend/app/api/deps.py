import json

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import security
from app.db.session import get_db
from app.db.redis import get_redis
from app.models.user import User


def _get_bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return authorization.split(" ", 1)[1]


async def get_current_user(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = _get_bearer(authorization)
    payload = security.decode_token(token, "access")
    user = await db.get(User, int(payload["sub"]))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_current_user_id(
    authorization: str | None = Header(default=None),
) -> int:
    token = _get_bearer(authorization)
    payload = security.decode_token(token, "access")
    try:
        return int(payload["sub"])
    except (ValueError, TypeError, KeyError) as exc:
        raise HTTPException(status_code=401, detail="Invalid token subject") from exc


async def require_admin(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = _get_bearer(authorization)
    payload = security.decode_token(token, "access")
    user = await db.get(User, int(payload["sub"]))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return user


async def get_active_company_id(db: AsyncSession, user: User) -> int:
    """Return the currently active company ID for the given user.

    Looks up the Redis key ``active_company:{user.id}``, validates that the
    stored company is in the user's allowed set, and falls back to the first
    allowed company when necessary.  Uses the shared Redis connection pool.
    """
    from app.models.domain import CompanyMembership
    from app.models.user import Company

    if getattr(user.role, "value", user.role) == "admin":
        rows = await db.execute(select(Company.id).order_by(Company.id.asc()))
        allowed_ids = [int(r[0]) for r in rows.all()]
    else:
        rows = await db.execute(
            select(Company.id)
            .join(CompanyMembership, CompanyMembership.company_id == Company.id)
            .where(CompanyMembership.user_id == user.id)
            .order_by(Company.id.asc())
        )
        allowed_ids = [int(r[0]) for r in rows.all()]

    if not allowed_ids:
        fallback = await db.scalar(select(Company.id).order_by(Company.id.asc()).limit(1))
        if fallback is None:
            raise HTTPException(status_code=404, detail="No company found")
        allowed_ids = [int(fallback)]

    # Redis is a cache — if it is unavailable we fall back to the DB-derived default
    # rather than propagating a 500 to every endpoint.
    active_id: int | None = None
    try:
        r = get_redis()
        raw = await r.get(f"active_company:{user.id}")
        active_id = int(raw) if raw else None
    except Exception:
        active_id = None  # Redis unavailable; will be resolved below

    if active_id not in allowed_ids:
        active_id = allowed_ids[0]
        try:
            r = get_redis()
            await r.set(f"active_company:{user.id}", str(active_id))
        except Exception:
            pass  # Best-effort cache write; not fatal
    return active_id


async def write_audit_log(
    db: AsyncSession,
    *,
    actor_email: str,
    action: str,
    entity: str,
    entity_id: str,
    metadata: dict | None = None,
) -> None:
    """Append a row to the audit_logs table (fire-and-forget helper)."""
    from app.models.domain import AuditLog

    entry = AuditLog(
        actor_email=actor_email,
        action=action,
        entity=entity,
        entity_id=entity_id,
        metadata_json=json.dumps(metadata) if metadata else None,
    )
    db.add(entry)
    # Caller is responsible for committing.
