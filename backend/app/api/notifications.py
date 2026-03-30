from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_active_company_id, get_current_user
from app.db.session import get_db
from app.models.domain import Notification
from app.models.user import User
from app.services.expiry_notifications import run_expiry_notification_scan

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(
    unread_only: bool = False,
    limit: int = 20,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    company_id = await get_active_company_id(db, user)

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
    company_id = await get_active_company_id(db, user)
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
    company_id = await get_active_company_id(db, user)
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
