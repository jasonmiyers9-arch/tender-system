from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.core.config import settings
from app.db.session import get_db
from app.models.domain import ComplianceDocument
from app.models.user import Company, User

router = APIRouter(prefix="/admin", tags=["admin-docs"])


class RejectIn(BaseModel):
    reason: str | None = None


def _serialize_doc(doc: ComplianceDocument, company_name: str) -> dict:
    return {
        "id": str(doc.id),
        "name": doc.filename,
        "category": doc.category,
        "status": doc.status.value if hasattr(doc.status, "value") else str(doc.status),
        "expiryDate": doc.expiry_date.date().isoformat() if doc.expiry_date else None,
        "lastUpdated": doc.updated_at.date().isoformat() if doc.updated_at else doc.created_at.date().isoformat(),
        "uploadedBy": "Company User",
        "fileSize": "N/A",
        "fileType": doc.filename.split(".")[-1].upper() if "." in doc.filename else "FILE",
        "companyName": company_name,
    }


@router.get("/documents/pending")
async def pending_documents(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(ComplianceDocument, Company)
        .join(Company, Company.id == ComplianceDocument.company_id)
        .where(ComplianceDocument.status == "uploaded")
        .order_by(ComplianceDocument.created_at.desc())
    )
    return {"items": [_serialize_doc(doc, company.name) | {"companyId": str(company.id)} for doc, company in rows.all()]}


@router.get("/companies/{company_id}/documents")
async def company_documents(
    company_id: int,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    docs = (
        await db.scalars(
            select(ComplianceDocument)
            .where(ComplianceDocument.company_id == company_id)
            .order_by(ComplianceDocument.created_at.desc())
        )
    ).all()
    return {"items": [_serialize_doc(d, company.name) | {"companyId": str(company_id)} for d in docs]}


@router.get("/documents/{doc_id}/download")
async def download_document(
    doc_id: int,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    doc = await db.get(ComplianceDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = Path(settings.STORAGE_DIR) / doc.storage_key
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Stored file missing")

    return FileResponse(path=file_path, filename=doc.filename, media_type="application/octet-stream")


@router.post("/documents/{doc_id}/verify")
async def verify_document(
    doc_id: int,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    doc = await db.get(ComplianceDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    doc.status = "verified"
    await db.commit()
    return {"ok": True}


@router.post("/documents/{doc_id}/reject")
async def reject_document(
    doc_id: int,
    payload: RejectIn,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    doc = await db.get(ComplianceDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    doc.status = "rejected"
    await db.commit()
    return {"ok": True, "reason": payload.reason}
