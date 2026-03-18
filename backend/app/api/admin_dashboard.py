from datetime import date, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.db.session import get_db
from app.models.domain import ComplianceDocument
from app.models.user import Company, User

router = APIRouter(prefix="/admin/dashboard", tags=["admin-dashboard"])


def _bucket(days_until_expiry: int) -> str:
    if days_until_expiry < 0:
        return "expired"
    if days_until_expiry <= 7:
        return "due-7"
    if days_until_expiry <= 30:
        return "due-30"
    if days_until_expiry <= 60:
        return "due-60"
    return "due-90"


@router.get("/stats")
async def get_stats(_admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    total_companies = int((await db.scalar(select(func.count(Company.id)))) or 0)
    total_documents = int((await db.scalar(select(func.count(ComplianceDocument.id)))) or 0)
    pending_verification = int(
        (
            await db.scalar(
                select(func.count(ComplianceDocument.id)).where(ComplianceDocument.status == "uploaded")
            )
        )
        or 0
    )

    rows = await db.execute(
        select(
            Company.id,
            func.count(ComplianceDocument.id).label("docs"),
            func.sum(case((ComplianceDocument.status == "expired", 1), else_=0)).label("expired"),
            func.sum(case((ComplianceDocument.status == "rejected", 1), else_=0)).label("rejected"),
        )
        .outerjoin(ComplianceDocument, ComplianceDocument.company_id == Company.id)
        .group_by(Company.id)
    )

    tender_ready = 0
    partially_ready = 0
    high_risk = 0

    for _, docs, expired, rejected in rows:
        docs = int(docs or 0)
        bad = int(expired or 0) + int(rejected or 0)
        if bad > 0:
            high_risk += 1
        elif docs >= 3:
            tender_ready += 1
        else:
            partially_ready += 1

    return {
        "totalCompanies": total_companies,
        "tenderReady": tender_ready,
        "partiallyReady": partially_ready,
        "highRisk": high_risk,
        "totalDocuments": total_documents,
        "pendingVerification": pending_verification,
    }


@router.get("/renewals")
async def get_renewals(_admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    rows = await db.execute(
        select(ComplianceDocument, Company)
        .join(Company, Company.id == ComplianceDocument.company_id)
        .where(ComplianceDocument.expiry_date.is_not(None))
        .order_by(ComplianceDocument.expiry_date.asc())
        .limit(200)
    )

    today = date.today()
    items = []
    for doc, company in rows.all():
        expiry_dt = doc.expiry_date
        if not isinstance(expiry_dt, datetime):
            continue
        expiry = expiry_dt.date()
        days = (expiry - today).days
        items.append(
            {
                "id": str(doc.id),
                "companyName": company.name,
                "companyId": str(company.id),
                "documentName": doc.filename,
                "daysUntilExpiry": days,
                "expiryDate": expiry.isoformat(),
                "bucket": _bucket(days),
            }
        )

    return items
