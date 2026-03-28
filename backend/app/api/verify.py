"""Verify / compliance API — search companies and generate compliance reports."""
from collections.abc import Sequence
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.domain import ComplianceDocument
from app.models.user import Company, User

router = APIRouter(prefix="/verify", tags=["verify"])

REQUIRED_CATEGORIES = ["tax", "legal", "financial", "certification", "bbbee", "registration"]


def _compliance_score(docs: Sequence[ComplianceDocument]) -> int:
    today = date.today()
    from datetime import timedelta

    present = {str(d.category).lower() for d in docs if d.category}
    missing = len([c for c in REQUIRED_CATEGORIES if c not in present])

    score = 100
    score -= missing * 12
    for d in docs:
        st = d.status.value if hasattr(d.status, "value") else str(d.status)
        if st == "expired":
            score -= 20
        elif st == "rejected":
            score -= 15
        elif d.expiry_date and d.expiry_date.date() <= today + timedelta(days=30):
            if d.expiry_date.date() >= today:
                score -= 6
        elif st == "verified":
            score += 2
    return max(0, min(100, score))


@router.get("/companies")
async def search_companies(
    q: str = Query(default="", description="Search by company name or registration number"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search companies for compliance verification (evaluator/admin only)."""
    role = getattr(user.role, "value", user.role)
    if role not in {"admin", "evaluator"}:
        raise HTTPException(status_code=403, detail="Forbidden")

    query = select(Company)
    if q:
        query = query.where(
            Company.name.ilike(f"%{q}%") | Company.reg_number.ilike(f"%{q}%")
        )
    query = query.limit(50)
    companies = (await db.scalars(query)).all()

    results = []
    for c in companies:
        doc_count = await db.scalar(
            select(func.count(ComplianceDocument.id)).where(ComplianceDocument.company_id == c.id)
        )
        results.append(
            {
                "id": str(c.id),
                "name": c.name,
                "registrationNumber": c.reg_number or "",
                "industry": c.industry_sector or "",
                "province": c.province or "",
                "documentCount": int(doc_count or 0),
                "onboardingCompleted": c.onboarding_completed,
            }
        )

    return results


@router.get("/companies/{company_id}/report")
async def get_company_compliance_report(
    company_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a compliance report for a specific company."""
    role = getattr(user.role, "value", user.role)
    if role not in {"admin", "evaluator"}:
        raise HTTPException(status_code=403, detail="Forbidden")

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

    score = _compliance_score(docs)
    present_cats = {str(d.category).lower() for d in docs if d.category}
    missing = [c for c in REQUIRED_CATEGORIES if c not in present_cats]

    today = date.today()
    doc_items = []
    for d in docs:
        st = d.status.value if hasattr(d.status, "value") else str(d.status)
        doc_items.append(
            {
                "id": str(d.id),
                "name": d.filename,
                "category": d.category,
                "status": st,
                "expiryDate": d.expiry_date.date().isoformat() if d.expiry_date else None,
                "isExpired": bool(d.expiry_date and d.expiry_date.date() < today),
            }
        )

    band = "tender-ready" if score >= 85 else "partially-ready" if score >= 65 else "high-risk"
    return {
        "companyId": str(company_id),
        "companyName": company.name,
        "registrationNumber": company.reg_number or "",
        "industry": company.industry_sector or "",
        "province": company.province or "",
        "bbbeeLevel": company.bbbee_level or "",
        "cidbGrade": company.cidb_grade or "",
        "csdNumber": company.csd_number or "",
        "score": score,
        "band": band,
        "missingCategories": missing,
        "documents": doc_items,
        "generatedAt": date.today().isoformat(),
    }


@router.get("/companies/{company_id}/bundle-url")
async def get_bundle_url(
    company_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return a signed URL (or direct API path) to download all verified docs as a bundle."""
    role = getattr(user.role, "value", user.role)
    if role not in {"admin", "evaluator"}:
        raise HTTPException(status_code=403, detail="Forbidden")

    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # In production this would generate a pre-signed S3/GCS URL or a zip endpoint.
    # For now return the admin documents API path.
    return {"url": f"/admin/companies/{company_id}/documents/bundle"}
