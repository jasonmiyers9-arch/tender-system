from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import redis.asyncio as redis
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.domain import CompanyMembership, ComplianceDocument
from app.models.user import Company, User

router = APIRouter(prefix="/documents", tags=["documents"])


def _storage_root() -> Path:
    root = Path(settings.STORAGE_DIR)
    root.mkdir(parents=True, exist_ok=True)
    return root


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


def _onboarding_profile_ok(company: Company) -> bool:
    return all(
        [
            bool((company.csd_number or '').strip()),
            bool((company.bbbee_level or '').strip()),
            bool((company.industry_sector or '').strip()),
            bool((company.province or '').strip()),
        ]
    )


def _doc_to_item(doc: ComplianceDocument, user: User) -> dict:
    return {
        "id": str(doc.id),
        "name": doc.filename,
        "category": doc.category,
        "status": doc.status.value if hasattr(doc.status, "value") else str(doc.status),
        "expiryDate": doc.expiry_date.date().isoformat() if doc.expiry_date else None,
        "lastUpdated": doc.updated_at.date().isoformat() if doc.updated_at else doc.created_at.date().isoformat(),
        "uploadedBy": user.full_name or user.email.split("@")[0],
        "fileSize": "N/A",
        "fileType": Path(doc.filename).suffix.replace(".", "").upper() or "FILE",
    }


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    category: str = Form(...),
    issue_date: str | None = Form(default=None),
    expiry_date: str | None = Form(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    company_id = await _get_active_company_id(db, user)

    safe_name = Path(file.filename or "document.bin").name
    key = f"company_{company_id}/{uuid4().hex}_{safe_name}"
    target = _storage_root() / key
    target.parent.mkdir(parents=True, exist_ok=True)

    content = await file.read()
    target.write_bytes(content)

    issue_dt = datetime.fromisoformat(issue_date) if issue_date else None
    expiry_dt = datetime.fromisoformat(expiry_date) if expiry_date else None

    doc = ComplianceDocument(
        company_id=company_id,
        category=category,
        filename=safe_name,
        status="uploaded",
        issue_date=issue_dt,
        expiry_date=expiry_dt,
        storage_key=key,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    company = await db.get(Company, company_id)
    docs_count = int(
        (
            await db.scalar(
                select(func.count(ComplianceDocument.id)).where(ComplianceDocument.company_id == company_id)
            )
        )
        or 0
    )
    if company:
        company.onboarding_completed = _onboarding_profile_ok(company) and docs_count >= 3
        await db.commit()

    return _doc_to_item(doc, user)


@router.get("")
async def list_documents(
    category: str | None = None,
    status: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    company_id = await _get_active_company_id(db, user)
    q = select(ComplianceDocument).where(ComplianceDocument.company_id == company_id)
    if category:
        q = q.where(ComplianceDocument.category == category)
    if status:
        q = q.where(ComplianceDocument.status == status)
    q = q.order_by(ComplianceDocument.created_at.desc())

    docs = (await db.scalars(q)).all()
    return [_doc_to_item(d, user) for d in docs]


@router.get("/{doc_id}")
async def get_document(doc_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    company_id = await _get_active_company_id(db, user)
    doc = await db.scalar(
        select(ComplianceDocument).where(ComplianceDocument.id == doc_id, ComplianceDocument.company_id == company_id)
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    item = _doc_to_item(doc, user)
    return {
        **item,
        "timeline": [
            {
                "id": f"evt-{doc.id}-1",
                "action": "Document uploaded",
                "actor": user.full_name or user.email,
                "timestamp": (doc.created_at or datetime.now(timezone.utc)).isoformat(),
                "note": None,
            }
        ],
        "metadata": {
            "issue_date": issue_date if (issue_date := (doc.issue_date.date().isoformat() if doc.issue_date else "")) else "",
            "storage_key": doc.storage_key,
        },
    }


@router.post("/{doc_id}/request-verification")
async def request_verification(doc_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    company_id = await _get_active_company_id(db, user)
    doc = await db.scalar(
        select(ComplianceDocument).where(ComplianceDocument.id == doc_id, ComplianceDocument.company_id == company_id)
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if str(doc.status) in ("rejected", "expired") or getattr(doc.status, "value", "") in ("rejected", "expired"):
        doc.status = "uploaded"
        await db.commit()

    return {"ok": True, "status": "uploaded"}


@router.get("/{doc_id}/download")
async def download_document(doc_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    company_id = await _get_active_company_id(db, user)
    doc = await db.scalar(
        select(ComplianceDocument).where(ComplianceDocument.id == doc_id, ComplianceDocument.company_id == company_id)
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = _storage_root() / doc.storage_key
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Stored file missing")

    return FileResponse(path=file_path, filename=doc.filename, media_type="application/octet-stream")
