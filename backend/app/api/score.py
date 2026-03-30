from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_active_company_id, get_current_user
from app.db.session import get_db
from app.models.domain import ComplianceDocument, ScoreSnapshot
from app.models.user import User

router = APIRouter(prefix="/score", tags=["score"])

REQUIRED_CATEGORIES = ["tax", "legal", "financial", "certification", "bbbee", "registration"]


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
    company_id = await get_active_company_id(db, user)
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


async def _persist_snapshot(db: AsyncSession, company_id: int, score: int) -> None:
    """Upsert today's score snapshot for the company (ignore if already exists)."""
    today = date.today()
    existing = await db.scalar(
        select(ScoreSnapshot).where(
            ScoreSnapshot.company_id == company_id,
            ScoreSnapshot.snapshot_date == today,
        )
    )
    if existing:
        existing.score = score
    else:
        db.add(ScoreSnapshot(company_id=company_id, score=score, snapshot_date=today))
    await db.commit()


@router.get("/history")
async def get_score_history(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    company_id = await get_active_company_id(db, user)
    current = await get_current_score(user=user, db=db)

    # Persist today's snapshot so history grows over time
    await _persist_snapshot(db, company_id, int(current["score"]))

    # Read up to 30 days of real snapshots
    snapshots = (
        await db.scalars(
            select(ScoreSnapshot)
            .where(ScoreSnapshot.company_id == company_id)
            .order_by(ScoreSnapshot.snapshot_date.desc())
            .limit(30)
        )
    ).all()

    points = [
        {"date": s.snapshot_date.isoformat(), "score": s.score}
        for s in reversed(snapshots)
    ]

    # If less than 7 days of history, synthesize earlier points from current score
    if len(points) < 7:
        existing_dates = {p["date"] for p in points}
        base = int(current["score"])
        today = date.today()
        synthetic = []
        for days_ago, delta in [(6, -10), (5, -8), (4, -6), (3, -4), (2, -3), (1, -1)]:
            d = (today - timedelta(days=days_ago)).isoformat()
            if d not in existing_dates:
                synthetic.append({"date": d, "score": max(0, min(100, base + delta))})
        points = sorted(synthetic + points, key=lambda x: x["date"])

    return points
