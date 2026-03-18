from datetime import datetime

import redis.asyncio as redis
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.domain import CompanyMembership, Notification
from app.models.user import Company, User
from app.services.expiry_notifications import run_expiry_notification_scan

router = APIRouter(prefix="/notifications", tags=["notifications"])


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


@router.get("")
async def list_notifications(
    unread_only: bool = False,
    limit: int = 20,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    company_id = await _get_active_company_id(db, user)

    q = select(Notification).where(Notification.company_id == company_id)
    if unread_only:
        q = q.where(Notification.is_read.is_(False))
    q = q.order_by(Notification.created_at.desc()).limit(max(1, min(limit, 100)))

    items = (await db.scalars(q)).all()
    return [
        {
            "id": str(n.id),
            "alertType": n.alert_type,
            "title": n.title,
            "message": n.message,
            "isRead": n.is_read,
            "triggerDate": n.trigger_date.isoformat(),
            "createdAt": n.created_at.isoformat() if isinstance(n.created_at, datetime) else None,
        }
        for n in items
    ]


@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    company_id = await _get_active_company_id(db, user)
    item = await db.scalar(
        select(Notification).where(Notification.id == notification_id, Notification.company_id == company_id)
    )
    if not item:
        raise HTTPException(status_code=404, detail="Notification not found")

    item.is_read = True
    await db.commit()
    return {"ok": True}


@router.post("/mark-all-read")
async def mark_all_read(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    company_id = await _get_active_company_id(db, user)
    items = (
        await db.scalars(
            select(Notification).where(Notification.company_id == company_id, Notification.is_read.is_(False))
        )
    ).all()
    for item in items:
        item.is_read = True
    await db.commit()
    return {"ok": True, "count": len(items)}


@router.post("/run-expiry-scan")
async def run_expiry_scan_now(_user: User = Depends(get_current_user)):
    created = await run_expiry_notification_scan()
    return {"ok": True, "created": created}
