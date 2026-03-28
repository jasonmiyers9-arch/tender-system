"""Auth-layer service helpers.

Contains rate-limiting, role mapping, and company lookup utilities extracted
from ``api/auth.py`` so they can be reused by other API modules.
"""
import logging

from fastapi import HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.redis import get_redis
from app.models.domain import CompanyMembership, MembershipRole
from app.models.user import Company, User, UserRole

logger = logging.getLogger("tenderguard.auth_service")


async def enforce_rate_limit(request: Request, bucket: str, limit: int) -> None:
    """Increment a Redis-backed counter and raise ``HTTP 429`` when exceeded.

    Degrades gracefully (skips enforcement) when Redis is unavailable.
    """
    ip = request.client.host if request.client else "unknown"
    key = f"rate:{bucket}:{ip}"
    try:
        r = get_redis()
        count = await r.incr(key)
        if count == 1:
            await r.expire(key, settings.AUTH_RATE_WINDOW_SECONDS)
        if count > limit:
            raise HTTPException(status_code=429, detail="Too many requests")
    except HTTPException:
        raise
    except Exception:
        logger.warning("rate_limit_skipped bucket=%s ip=%s", bucket, ip)


def map_registration_role(role: str) -> UserRole:
    """Map a raw registration role string to the internal ``UserRole`` enum.

    Raises ``HTTP 400`` for unknown role strings.
    """
    normalized = (role or "company").strip().lower().replace("-", "_").replace(" ", "_")
    mapping: dict[str, UserRole] = {
        "company": UserRole.user,
        "user": UserRole.user,
        "tender_provider": UserRole.evaluator,
        "tenderprovider": UserRole.evaluator,
        "provider": UserRole.evaluator,
        "evaluator": UserRole.evaluator,
        "admin": UserRole.admin,
    }
    if normalized not in mapping:
        raise HTTPException(status_code=400, detail="Invalid role")
    return mapping[normalized]


async def get_owner_company(db: AsyncSession, user_id: int) -> Company | None:
    """Return the first company the user owns (ordered by company ID ascending)."""
    return await db.scalar(
        select(Company)
        .join(CompanyMembership, CompanyMembership.company_id == Company.id)
        .where(
            CompanyMembership.user_id == user_id,
            CompanyMembership.role == MembershipRole.owner,
        )
        .order_by(Company.id.asc())
        .limit(1)
    )
