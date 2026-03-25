from datetime import datetime
from pathlib import Path
import json
import uuid

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.domain import ComplianceDocument
from app.models.user import Company, User
from app.api.tenders import _get_active_company_id, _load_provider_tenders

router = APIRouter(tags=["applications"])


class RejectApplicationIn(BaseModel):
    reason: str | None = None


def _apps_file() -> Path:
    root = Path(settings.STORAGE_DIR)
    root.mkdir(parents=True, exist_ok=True)
    return root / "tender_applications.json"


def _load_apps() -> list[dict]:
    f = _apps_file()
    if not f.exists():
        return []
    try:
        data = json.loads(f.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def _save_apps(items: list[dict]) -> None:
    _apps_file().write_text(json.dumps(items, indent=2), encoding="utf-8")


@router.post("/tenders/{tender_id}/apply")
async def apply_for_tender(
    tender_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role = getattr(user.role, "value", user.role)
    if role != "user":
        raise HTTPException(status_code=403, detail=f"Only company users can apply for tenders (your role: {role}, email: {user.email})")

    all_tenders = _load_provider_tenders()
    tender = next((t for t in all_tenders if t["id"] == tender_id and t.get("status") == "published"), None)
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found or not published")

    company_id = await _get_active_company_id(db, user)
    company = await db.get(Company, company_id)
    company_name = company.name if company else f"Company {company_id}"

    apps = _load_apps()
    existing = next((a for a in apps if a["tenderId"] == tender_id and a["companyId"] == company_id), None)
    if existing:
        raise HTTPException(status_code=409, detail="You have already applied for this tender")

    application = {
        "id": f"app-{uuid.uuid4().hex[:8]}",
        "tenderId": tender_id,
        "tenderTitle": tender["title"],
        "tenderOrganization": tender["organization"],
        "tenderDeadline": tender["deadline"],
        "tenderValue": tender["value"],
        "providerEmail": tender.get("createdBy"),
        "companyId": company_id,
        "companyName": company_name,
        "appliedBy": user.email,
        "appliedAt": datetime.utcnow().isoformat(),
        "status": "pending",
    }
    apps.append(application)
    _save_apps(apps)
    return {"ok": True, "application": application}


@router.get("/tenders/{tender_id}/applications")
async def list_tender_applications(
    tender_id: str,
    user: User = Depends(get_current_user),
):
    role = getattr(user.role, "value", user.role)
    if role not in {"admin", "evaluator"}:
        raise HTTPException(status_code=403, detail="Forbidden")

    if role == "evaluator":
        all_tenders = _load_provider_tenders()
        my_tender_ids = {t["id"] for t in all_tenders if t.get("createdBy") == user.email}
        if tender_id not in my_tender_ids:
            raise HTTPException(status_code=403, detail="This is not your tender")

    apps = _load_apps()
    return [a for a in apps if a["tenderId"] == tender_id]


@router.get("/providers/applications")
async def list_all_provider_applications(
    user: User = Depends(get_current_user),
):
    role = getattr(user.role, "value", user.role)
    if role not in {"admin", "evaluator"}:
        raise HTTPException(status_code=403, detail="Forbidden")

    apps = _load_apps()
    if role == "admin":
        return apps

    all_tenders = _load_provider_tenders()
    my_tender_ids = {t["id"] for t in all_tenders if t.get("createdBy") == user.email}
    return [a for a in apps if a["tenderId"] in my_tender_ids]


@router.get("/companies/my-applications")
async def list_my_applications(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role = getattr(user.role, "value", user.role)
    if role != "user":
        raise HTTPException(status_code=403, detail="Forbidden")

    company_id = await _get_active_company_id(db, user)
    apps = _load_apps()
    return [a for a in apps if a["companyId"] == company_id]


@router.get("/companies/my-applications/{tender_id}")
async def get_my_application_for_tender(
    tender_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role = getattr(user.role, "value", user.role)
    if role != "user":
        raise HTTPException(status_code=403, detail="Forbidden")

    company_id = await _get_active_company_id(db, user)
    apps = _load_apps()
    app = next((a for a in apps if a["tenderId"] == tender_id and a["companyId"] == company_id), None)
    return app


@router.post("/applications/{app_id}/approve")
async def approve_application(
    app_id: str,
    user: User = Depends(get_current_user),
):
    role = getattr(user.role, "value", user.role)
    if role not in {"admin", "evaluator"}:
        raise HTTPException(status_code=403, detail="Only providers and admins can approve applications")

    apps = _load_apps()
    idx = next((i for i, a in enumerate(apps) if a["id"] == app_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Application not found")

    if role == "evaluator":
        all_tenders = _load_provider_tenders()
        my_tender_ids = {t["id"] for t in all_tenders if t.get("createdBy") == user.email}
        if apps[idx]["tenderId"] not in my_tender_ids:
            raise HTTPException(status_code=403, detail="This is not your tender")

    apps[idx]["status"] = "approved"
    apps[idx]["reviewedBy"] = user.email
    apps[idx]["reviewedAt"] = datetime.utcnow().isoformat()
    apps[idx].pop("rejectionReason", None)
    _save_apps(apps)
    return {"ok": True, "application": apps[idx]}


@router.post("/applications/{app_id}/reject")
async def reject_application(
    app_id: str,
    payload: RejectApplicationIn,
    user: User = Depends(get_current_user),
):
    role = getattr(user.role, "value", user.role)
    if role not in {"admin", "evaluator"}:
        raise HTTPException(status_code=403, detail="Only providers and admins can reject applications")

    apps = _load_apps()
    idx = next((i for i, a in enumerate(apps) if a["id"] == app_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Application not found")

    if role == "evaluator":
        all_tenders = _load_provider_tenders()
        my_tender_ids = {t["id"] for t in all_tenders if t.get("createdBy") == user.email}
        if apps[idx]["tenderId"] not in my_tender_ids:
            raise HTTPException(status_code=403, detail="This is not your tender")

    apps[idx]["status"] = "rejected"
    apps[idx]["reviewedBy"] = user.email
    apps[idx]["reviewedAt"] = datetime.utcnow().isoformat()
    if payload.reason:
        apps[idx]["rejectionReason"] = payload.reason
    _save_apps(apps)
    return {"ok": True, "application": apps[idx]}


@router.get("/applications/{app_id}/company-documents")
async def get_application_company_documents(
    app_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role = getattr(user.role, "value", user.role)
    if role not in {"admin", "evaluator"}:
        raise HTTPException(status_code=403, detail="Forbidden")

    apps = _load_apps()
    app = next((a for a in apps if a["id"] == app_id), None)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if role == "evaluator":
        all_tenders = _load_provider_tenders()
        my_tender_ids = {t["id"] for t in all_tenders if t.get("createdBy") == user.email}
        if app["tenderId"] not in my_tender_ids:
            raise HTTPException(status_code=403, detail="This is not your tender")

    company_id = app["companyId"]
    company = await db.get(Company, company_id)

    docs = (await db.scalars(
        select(ComplianceDocument)
        .where(ComplianceDocument.company_id == company_id)
        .order_by(ComplianceDocument.created_at.desc())
    )).all()

    return {
        "companyId": company_id,
        "companyName": app.get("companyName", f"Company {company_id}"),
        "appliedBy": app.get("appliedBy"),
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

    apps = _load_apps()
    app = next((a for a in apps if a["id"] == app_id), None)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if role == "evaluator":
        all_tenders = _load_provider_tenders()
        my_tender_ids = {t["id"] for t in all_tenders if t.get("createdBy") == user.email}
        if app["tenderId"] not in my_tender_ids:
            raise HTTPException(status_code=403, detail="This is not your tender")

    company_id = app["companyId"]
    doc = await db.scalar(
        select(ComplianceDocument).where(
            ComplianceDocument.id == doc_id,
            ComplianceDocument.company_id == company_id,
        )
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    storage_root = Path(settings.STORAGE_DIR)
    file_path = storage_root / doc.storage_key
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Stored file missing")

    return FileResponse(path=file_path, filename=doc.filename, media_type="application/octet-stream")
