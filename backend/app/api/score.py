from datetime import date, timedelta

import redis.asyncio as redis
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.domain import CompanyMembership, ComplianceDocument
from app.models.user import Company, User

router = APIRouter(prefix="/score", tags=["score"])

REQUIRED_CATEGORIES = ["tax", "legal", "financial", "certification", "bbbee", "registration"]


async def _get_active_company_id(db: AsyncSession, user: User) -> int:
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

    client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        raw = await client.get(f"active_company:{user.id}")
        active_id = int(raw) if raw else None
        if active_id not in allowed_ids:
            active_id = allowed_ids[0]
            await client.set(f"active_company:{user.id}", str(active_id))
        return active_id
    finally:
        await client.aclose()


def _band_for(score: int) -> str:
    if score >= 85:
        return "tender-ready"
    if score >= 65:
        return "partially-ready"
    return "high-risk"


@router.get("/current")
async def get_current_score(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    company_id = await _get_active_company_id(db, user)
    docs = (
        await db.scalars(
            select(ComplianceDocument)
            .where(ComplianceDocument.company_id == company_id)
            .order_by(ComplianceDocument.created_at.desc())
        )
    ).all()

    today = date.today()
    present_categories = {str(d.category).lower() for d in docs if d.category}
    missing_categories = [c for c in REQUIRED_CATEGORIES if c not in present_categories]

    expiring = []
    expired_count = 0
    rejected_count = 0
    verified_count = 0

    for d in docs:
        status = d.status.value if hasattr(d.status, "value") else str(d.status)
        if status == "verified":
            verified_count += 1
        if status == "rejected":
            rejected_count += 1

        if d.expiry_date:
            expiry = d.expiry_date.date()
            if expiry < today:
                expired_count += 1
            elif expiry <= today + timedelta(days=30):
                expiring.append(d.filename)

    score_value = 100
    score_value -= len(missing_categories) * 12
    score_value -= len(expiring) * 6
    score_value -= expired_count * 20
    score_value -= rejected_count * 15
    score_value += min(verified_count, 5) * 2
    score_value = max(0, min(100, score_value))

    completed_documents = max(0, len(REQUIRED_CATEGORIES) - len(missing_categories))

    return {
        "score": score_value,
        "band": _band_for(score_value),
        "completedDocuments": completed_documents,
        "totalDocuments": len(REQUIRED_CATEGORIES),
        "missingDocuments": missing_categories,
        "expiringDocuments": expiring,
        "lastCalculated": date.today().isoformat(),
    }


@router.get("/history")
async def get_score_history(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current = await get_current_score(user=user, db=db)
    base = int(current["score"])
    today = date.today()

    points = []
    for days_ago, delta in [(6, -10), (5, -8), (4, -6), (3, -4), (2, -3), (1, -1), (0, 0)]:
        points.append(
            {
                "date": (today - timedelta(days=days_ago)).isoformat(),
                "score": max(0, min(100, base + delta)),
            }
        )

    return points
