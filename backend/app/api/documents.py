from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_active_company_id, get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.domain import ComplianceDocument
from app.models.user import Company, User
from app.services.document_ai import enqueue_document_ai_processing
from app.services.firebase_storage import (
    generate_firebase_signed_download_url,
    is_firebase_storage_configured,
    upload_document_to_firebase,
)

router = APIRouter(prefix="/documents", tags=["documents"])

# Allowed upload extensions and max size
_ALLOWED_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg",
    ".txt", ".csv", ".zip",
}
_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


def _storage_root() -> Path:
    root = Path(settings.STORAGE_DIR)
    root.mkdir(parents=True, exist_ok=True)
    return root


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
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    category: str = Form(...),
    issue_date: str | None = Form(default=None),
    expiry_date: str | None = Form(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate file extension
    safe_name = Path(file.filename or "document.bin").name
    ext = Path(safe_name).suffix.lower()
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' is not allowed. Accepted: {', '.join(sorted(_ALLOWED_EXTENSIONS))}",
        )

    # Validate file size (read into memory, check before saving)
    content = await file.read()
    if len(content) > _MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {_MAX_UPLOAD_BYTES // (1024*1024)} MB.",
        )

    company_id = await get_active_company_id(db, user)

    key = f"company_{company_id}/{uuid4().hex}_{safe_name}"
    if is_firebase_storage_configured():
        try:
            upload_document_to_firebase(key, content, content_type=file.content_type or "application/octet-stream")
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail="Failed to save document to Firebase Storage.",
            ) from exc
    else:
        target = _storage_root() / key
        target.parent.mkdir(parents=True, exist_ok=True)
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

    background_tasks.add_task(enqueue_document_ai_processing, doc.id, doc.storage_key, company_id)
    return _doc_to_item(doc, user)


@router.get("")
async def list_documents(
    category: str | None = None,
    status: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    company_id = await get_active_company_id(db, user)
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
    company_id = await get_active_company_id(db, user)
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
    company_id = await get_active_company_id(db, user)
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
    company_id = await get_active_company_id(db, user)
    doc = await db.scalar(
        select(ComplianceDocument).where(ComplianceDocument.id == doc_id, ComplianceDocument.company_id == company_id)
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if is_firebase_storage_configured():
        try:
            url = generate_firebase_signed_download_url(doc.storage_key)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="Stored file missing")
        return RedirectResponse(url)

    file_path = _storage_root() / doc.storage_key
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Stored file missing")

    return FileResponse(path=file_path, filename=doc.filename, media_type="application/octet-stream")


from pydantic import BaseModel


class RenewDocumentIn(BaseModel):
    issue_date: str | None = None
    expiry_date: str | None = None


@router.patch("/{doc_id}/renew")
async def renew_document(
    doc_id: int,
    payload: RenewDocumentIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update expiry/issue dates on an existing document — used to renew expired documents."""
    company_id = await get_active_company_id(db, user)
    doc = await db.scalar(
        select(ComplianceDocument).where(ComplianceDocument.id == doc_id, ComplianceDocument.company_id == company_id)
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if payload.issue_date:
        doc.issue_date = datetime.fromisoformat(payload.issue_date)
    if payload.expiry_date:
        doc.expiry_date = datetime.fromisoformat(payload.expiry_date)

    # Reset status to uploaded so admin can re-verify
    doc.status = "uploaded"
    await db.commit()
    await db.refresh(doc)
    return {"ok": True, **_doc_to_item(doc, user)}
