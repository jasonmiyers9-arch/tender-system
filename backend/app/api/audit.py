"""Admin audit log API."""
import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.db.session import get_db
from app.models.domain import AuditLog
from app.models.user import User

router = APIRouter(prefix="/admin/audit", tags=["audit"])


@router.get("")
async def list_audit_log(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    actor: str | None = None,
    action: str | None = None,
    entity: str | None = None,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    q = select(AuditLog)
    if actor:
        q = q.where(AuditLog.actor_email.ilike(f"%{actor}%"))
    if action:
        q = q.where(AuditLog.action == action.upper())
    if entity:
        q = q.where(AuditLog.entity == entity)

    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    rows = (
        await db.scalars(
            q.order_by(AuditLog.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()

    entries = [
        {
            "id": r.id,
            "actorEmail": r.actor_email,
            "action": r.action,
            "entity": r.entity,
            "entityId": r.entity_id,
            "metadata": json.loads(r.metadata_json) if r.metadata_json else None,
            "timestamp": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]

    return {"entries": entries, "total": total or 0, "page": page, "pageSize": page_size}
