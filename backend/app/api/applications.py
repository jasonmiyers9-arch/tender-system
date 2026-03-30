"""Applications API — TenderApplication stored in PostgreSQL."""
from datetime import datetime, timezone
from pathlib import Path
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_active_company_id, get_current_user, write_audit_log
from app.core.config import settings
from app.db.session import get_db
from app.models.domain import (
    ApplicationStatus,
    ComplianceDocument,
    Tender,
    TenderApplication,
    TenderStatus,
)
from app.models.user import Company, User

router = APIRouter(tags=["applications"])


class RejectApplicationIn(BaseModel):
    reason: str | None = None


def _serialize_app(app: TenderApplication, tender: Tender | None = None, company: Company | None = None) -> dict:
    t = tender or app.tender
    c = company or app.company
    deadline = ""
    if t and t.deadline:
        deadline = t.deadline.isoformat() if hasattr(t.deadline, "isoformat") else str(t.deadline)
    return {
        "id": app.id,
        "tenderId": str(app.tender_id),
        "tenderTitle": t.title if t else "Unknown",
        "tenderOrganization": t.organization if t else "",
        "tenderDeadline": deadline,
        "tenderValue": t.value if t else "",
        "companyId": app.company_id,
        "companyName": c.name if c else f"Company {app.company_id}",
        "appliedBy": app.applied_by,
        "appliedAt": app.applied_at.isoformat() if app.applied_at else None,
        "status": app.status.value if hasattr(app.status, "value") else str(app.status),
        "reviewedBy": app.reviewed_by,
        "reviewedAt": app.reviewed_at.isoformat() if app.reviewed_at else None,
        "rejectionReason": app.rejection_reason,
    }


async def _load_app_with_relations(db: AsyncSession, app_id: str) -> TenderApplication | None:
    return await db.scalar(
        select(TenderApplication)
        .where(TenderApplication.id == app_id)
        .options(selectinload(TenderApplication.tender), selectinload(TenderApplication.company))
    )


@router.post("/tenders/{tender_id}/apply")
async def apply_for_tender(
    tender_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role = getattr(user.role, "value", user.role)
    if role != "user":
        raise HTTPException(
            status_code=403,
            detail=f"Only company users can apply for tenders (your role: {role}, email: {user.email})",
        )

    tender = await db.get(Tender, tender_id)
    if not tender or tender.status != TenderStatus.published:
        raise HTTPException(status_code=404, detail="Tender not found or not published")

    company_id = await get_active_company_id(db, user)

    existing = await db.scalar(
        select(TenderApplication).where(
            TenderApplication.tender_id == tender_id,
            TenderApplication.company_id == company_id,
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="You have already applied for this tender")

    app_id = f"app-{uuid.uuid4().hex[:8]}"
    application = TenderApplication(
        id=app_id,
        tender_id=tender_id,
        company_id=company_id,
        applied_by=user.email,
        applied_at=datetime.now(timezone.utc),
        status=ApplicationStatus.pending,
    )
    db.add(application)
    await db.commit()

    full = await _load_app_with_relations(db, app_id)
    return {"ok": True, "application": _serialize_app(full)}


@router.get("/tenders/{tender_id}/applications")
async def list_tender_applications(
    tender_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role = getattr(user.role, "value", user.role)
    if role not in {"admin", "evaluator"}:
        raise HTTPException(status_code=403, detail="Forbidden")

    if role == "evaluator":
        tender = await db.get(Tender, tender_id)
        if not tender or tender.created_by_email != user.email:
            raise HTTPException(status_code=403, detail="This is not your tender")

    apps = (
        await db.scalars(
            select(TenderApplication)
            .where(TenderApplication.tender_id == tender_id)
            .options(selectinload(TenderApplication.tender), selectinload(TenderApplication.company))
        )
    ).all()
    return [_serialize_app(a) for a in apps]


@router.get("/providers/applications")
async def list_all_provider_applications(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role = getattr(user.role, "value", user.role)
    if role not in {"admin", "evaluator"}:
        raise HTTPException(status_code=403, detail="Forbidden")

    q = (
        select(TenderApplication)
        .options(selectinload(TenderApplication.tender), selectinload(TenderApplication.company))
    )
    if role == "evaluator":
        # Only applications for tenders created by this evaluator
        q = q.join(Tender, Tender.id == TenderApplication.tender_id).where(
            Tender.created_by_email == user.email
        )
    apps = (await db.scalars(q)).all()
    return [_serialize_app(a) for a in apps]


@router.get("/companies/my-applications")
async def list_my_applications(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role = getattr(user.role, "value", user.role)
    if role != "user":
        raise HTTPException(status_code=403, detail="Forbidden")

    company_id = await get_active_company_id(db, user)
    apps = (
        await db.scalars(
            select(TenderApplication)
            .where(TenderApplication.company_id == company_id)
            .options(selectinload(TenderApplication.tender), selectinload(TenderApplication.company))
            .order_by(TenderApplication.applied_at.desc())
        )
    ).all()
    return [_serialize_app(a) for a in apps]


@router.get("/companies/my-applications/{tender_id}")
async def get_my_application_for_tender(
    tender_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role = getattr(user.role, "value", user.role)
    if role != "user":
        raise HTTPException(status_code=403, detail="Forbidden")

    company_id = await get_active_company_id(db, user)
    app = await db.scalar(
        select(TenderApplication)
        .where(
            TenderApplication.tender_id == tender_id,
            TenderApplication.company_id == company_id,
        )
        .options(selectinload(TenderApplication.tender), selectinload(TenderApplication.company))
    )
    return _serialize_app(app) if app else None


@router.post("/applications/{app_id}/approve")
async def approve_application(
    app_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role = getattr(user.role, "value", user.role)
    if role not in {"admin", "evaluator"}:
        raise HTTPException(status_code=403, detail="Only providers and admins can approve applications")

    app = await _load_app_with_relations(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if role == "evaluator" and (not app.tender or app.tender.created_by_email != user.email):
        raise HTTPException(status_code=403, detail="This is not your tender")

    app.status = ApplicationStatus.approved
    app.reviewed_by = user.email
    app.reviewed_at = datetime.now(timezone.utc)
    app.rejection_reason = None
    await db.commit()

    await write_audit_log(db, actor_email=user.email, action="APPROVE", entity="TenderApplication",
                          entity_id=app_id)
    await db.commit()
    return {"ok": True, "application": _serialize_app(app)}


@router.post("/applications/{app_id}/reject")
async def reject_application(
    app_id: str,
    payload: RejectApplicationIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role = getattr(user.role, "value", user.role)
    if role not in {"admin", "evaluator"}:
        raise HTTPException(status_code=403, detail="Only providers and admins can reject applications")

    app = await _load_app_with_relations(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if role == "evaluator" and (not app.tender or app.tender.created_by_email != user.email):
        raise HTTPException(status_code=403, detail="This is not your tender")

    app.status = ApplicationStatus.rejected
    app.reviewed_by = user.email
    app.reviewed_at = datetime.now(timezone.utc)
    if payload.reason:
        app.rejection_reason = payload.reason
    await db.commit()

    await write_audit_log(db, actor_email=user.email, action="REJECT", entity="TenderApplication",
                          entity_id=app_id, metadata={"reason": payload.reason})
    await db.commit()
    return {"ok": True, "application": _serialize_app(app)}


@router.get("/applications/{app_id}/company-documents")
async def get_application_company_documents(
    app_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role = getattr(user.role, "value", user.role)
    if role not in {"admin", "evaluator"}:
        raise HTTPException(status_code=403, detail="Forbidden")

    app = await _load_app_with_relations(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if role == "evaluator" and (not app.tender or app.tender.created_by_email != user.email):
        raise HTTPException(status_code=403, detail="This is not your tender")

    company_id = app.company_id
    docs = (
        await db.scalars(
            select(ComplianceDocument)
            .where(ComplianceDocument.company_id == company_id)
            .order_by(ComplianceDocument.created_at.desc())
        )
    ).all()

    return {
        "companyId": company_id,
        "companyName": app.company.name if app.company else f"Company {company_id}",
        "appliedBy": app.applied_by,
        "documents": [
            {
                "id": str(doc.id),
                "name": doc.filename,
                "category": doc.category,
                "status": doc.status.value if hasattr(doc.status, "value") else str(doc.status),
                "expiryDate": doc.expiry_date.date().isoformat() if doc.expiry_date else None,
                "uploadedAt": doc.created_at.isoformat() if doc.created_at else None,
            }
            for doc in docs
        ],
    }


@router.get("/applications/{app_id}/company-documents/{doc_id}/download")
async def download_application_document(
    app_id: str,
    doc_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role = getattr(user.role, "value", user.role)
    if role not in {"admin", "evaluator"}:
        raise HTTPException(status_code=403, detail="Forbidden")

    app = await _load_app_with_relations(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if role == "evaluator" and (not app.tender or app.tender.created_by_email != user.email):
        raise HTTPException(status_code=403, detail="This is not your tender")

    doc = await db.scalar(
        select(ComplianceDocument).where(
            ComplianceDocument.id == doc_id,
            ComplianceDocument.company_id == app.company_id,
        )
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = Path(settings.STORAGE_DIR) / doc.storage_key
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Stored file missing")

    return FileResponse(path=file_path, filename=doc.filename, media_type="application/octet-stream")
