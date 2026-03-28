"""Tenders API — all data persisted in PostgreSQL (Tender model)."""
from collections.abc import Sequence
from datetime import date, datetime, timezone
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_active_company_id, get_current_user, write_audit_log
from app.db.session import get_db
from app.models.domain import ComplianceDocument, Tender, TenderStatus
from app.models.user import User

router = APIRouter(prefix="/tenders", tags=["tenders"])

ALLOWED_CATEGORIES = {"tax", "legal", "financial", "certification", "bbbee", "registration"}

# ---------------------------------------------------------------------------
# Seed data — system tenders inserted once at startup (idempotent)
# ---------------------------------------------------------------------------
SYSTEM_TENDER_SEEDS = [
    {
        "title": "Municipal IT Support Services (12 Months)",
        "organization": "City Infrastructure Dept",
        "deadline": "2026-03-28",
        "value": "R 1.8M",
        "category": "IT Services",
        "description": "Provision of managed IT support, helpdesk, and endpoint maintenance for municipal offices.",
        "requirements": ["Valid tax clearance certificate", "CIPC company registration", "B-BBEE certificate", "Audited/financial compliance documents"],
        "required_categories": ["tax", "registration", "bbbee", "financial"],
        "eligibility_criteria": ["Registered South African company", "At least 3 years relevant experience", "Good standing for tax and statutory filings"],
    },
    {
        "title": "Provincial Facilities Maintenance Tender",
        "organization": "Provincial Public Works",
        "deadline": "2026-04-05",
        "value": "R 3.2M",
        "category": "Facilities",
        "description": "General building maintenance, emergency response, and compliance servicing across provincial offices.",
        "requirements": ["Tax compliance proof", "CIDB/technical certification", "Company registration documentation", "Insurance/financial backing"],
        "required_categories": ["tax", "certification", "registration", "financial"],
        "eligibility_criteria": ["Compliance with labour and safety laws", "Demonstrated service capacity", "Valid statutory documents"],
    },
    {
        "title": "Digital Transformation Advisory Panel",
        "organization": "National Innovation Agency",
        "deadline": "2026-04-18",
        "value": "R 950K",
        "category": "Consulting",
        "description": "Advisory support for digitization strategy, implementation planning, and governance alignment.",
        "requirements": ["Company registration", "Tax clearance", "Professional/legal compliance docs"],
        "required_categories": ["registration", "tax", "legal"],
        "eligibility_criteria": ["Relevant consulting track record", "Professional indemnity (where applicable)", "Regulatory compliance"],
    },
]


async def seed_system_tenders(db: AsyncSession) -> None:
    """Insert system tenders if they do not already exist (identified by title)."""
    existing_titles = {
        t.title
        for t in (await db.scalars(select(Tender).where(Tender.is_system.is_(True)))).all()
    }
    for seed in SYSTEM_TENDER_SEEDS:
        if seed["title"] not in existing_titles:
            db.add(
                Tender(
                    title=seed["title"],
                    organization=seed["organization"],
                    deadline=date.fromisoformat(seed["deadline"]),
                    value=seed["value"],
                    category=seed["category"],
                    description=seed["description"],
                    requirements=json.dumps(seed["requirements"]),
                    required_categories=json.dumps(seed["required_categories"]),
                    eligibility_criteria=json.dumps(seed["eligibility_criteria"]),
                    location="South Africa",
                    status=TenderStatus.published,
                    is_system=True,
                    created_by_role="system",
                )
            )
    await db.commit()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class CreateTenderIn(BaseModel):
    title: str
    organization: str
    deadline: str
    value: str
    category: str
    description: str
    requirements: list[str]
    required_categories: list[str]
    eligibilityCriteria: list[str] = []
    location: str = "South Africa"
    status: str = "published"


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _status_value(doc: ComplianceDocument) -> str:
    return doc.status.value if hasattr(doc.status, "value") else str(doc.status)


def _tender_required_cats(tender: Tender) -> list[str]:
    try:
        return json.loads(tender.required_categories or "[]")
    except Exception:
        return []


def _tender_requirements(tender: Tender) -> list[str]:
    try:
        return json.loads(tender.requirements or "[]")
    except Exception:
        return []


def _tender_eligibility(tender: Tender) -> list[str]:
    try:
        return json.loads(tender.eligibility_criteria or "[]")
    except Exception:
        return []


def _score_tender(
    tender: Tender, docs: Sequence[ComplianceDocument]
) -> tuple[int, list[str], list[str]]:
    today = date.today()
    required_cats = _tender_required_cats(tender)
    by_category: dict[str, list[ComplianceDocument]] = {}
    for d in docs:
        key = str(d.category or "").lower().strip()
        by_category.setdefault(key, []).append(d)

    gaps: list[str] = []
    recommended: list[str] = []
    score = 100

    for cat in required_cats:
        cat_docs = by_category.get(cat, [])
        if not cat_docs:
            gaps.append(f"Missing {cat} document")
            recommended.append(cat)
            score -= 18
            continue
        latest = sorted(cat_docs, key=lambda x: x.created_at or x.updated_at, reverse=True)[0]
        st = _status_value(latest)
        if st == "rejected":
            gaps.append(f"{cat} document was rejected")
            recommended.append(cat)
            score -= 14
        if latest.expiry_date and latest.expiry_date.date() < today:
            gaps.append(f"{cat} document is expired")
            recommended.append(cat)
            score -= 16

    if sum(1 for d in docs if _status_value(d) == "uploaded") >= 3:
        score -= 6

    return max(0, min(100, score)), gaps, sorted(set(recommended))


def _build_readiness(tender: Tender, docs: Sequence[ComplianceDocument]) -> dict:
    today = date.today()
    required_cats = _tender_required_cats(tender)
    by_category: dict[str, list[ComplianceDocument]] = {}
    for d in docs:
        key = str(d.category or "").lower().strip()
        by_category.setdefault(key, []).append(d)

    checklist, blockers, missing_categories = [], [], []

    for cat in required_cats:
        cat_docs = by_category.get(cat, [])
        if not cat_docs:
            checklist.append({"item": f"{cat} document available", "status": "missing"})
            missing_categories.append(cat)
            blockers.append(f"Missing required {cat} document")
            continue
        latest = sorted(cat_docs, key=lambda x: x.created_at or x.updated_at, reverse=True)[0]
        st = _status_value(latest)
        if latest.expiry_date and latest.expiry_date.date() < today:
            checklist.append({"item": f"{cat} document not expired", "status": "failed"})
            blockers.append(f"{cat} document is expired")
        elif st == "rejected":
            checklist.append({"item": f"{cat} document approved", "status": "failed"})
            blockers.append(f"{cat} document is rejected")
        else:
            checklist.append({"item": f"{cat} document valid", "status": "passed"})

    score, gaps, recommended = _score_tender(tender, docs)
    return {
        "readyToSubmit": len(blockers) == 0,
        "readinessScore": max(0, min(100, score - len(blockers) * 5)),
        "blockers": blockers,
        "missingCategories": missing_categories,
        "gaps": gaps,
        "recommendedDocuments": recommended,
        "checklist": checklist,
    }


def _serialize_tender(t: Tender, score: int = 100, gaps: list[str] | None = None) -> dict:
    s = t.status.value if hasattr(t.status, "value") else str(t.status)
    deadline = t.deadline.isoformat() if isinstance(t.deadline, date) else str(t.deadline)
    return {
        "id": str(t.id),
        "title": t.title,
        "organization": t.organization,
        "deadline": deadline,
        "value": t.value,
        "matchScore": score,
        "gaps": gaps or [],
        "category": t.category,
        "location": t.location or "South Africa",
        "status": s,
        "createdAt": t.created_at.isoformat() if t.created_at else None,
        "createdBy": t.created_by_email or t.created_by_role or "system",
        "isSystem": t.is_system,
    }


async def _get_company_docs(db: AsyncSession, user: User) -> list[ComplianceDocument]:
    company_id = await get_active_company_id(db, user)
    return (
        await db.scalars(
            select(ComplianceDocument)
            .where(ComplianceDocument.company_id == company_id)
            .order_by(ComplianceDocument.created_at.desc())
        )
    ).all()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("")
async def create_tender(
    payload: CreateTenderIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role = getattr(user.role, "value", user.role)
    if role not in {"admin", "evaluator"}:
        raise HTTPException(status_code=403, detail="Only admins and tender providers can create tenders")

    required_categories = [c.strip().lower() for c in payload.required_categories if c.strip()]
    if not required_categories:
        raise HTTPException(status_code=400, detail="At least one required category is needed")
    invalid = [c for c in required_categories if c not in ALLOWED_CATEGORIES]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid required categories: {', '.join(invalid)}")
    try:
        deadline = date.fromisoformat(payload.deadline)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid deadline date (use YYYY-MM-DD)")

    tender = Tender(
        title=payload.title.strip(),
        organization=payload.organization.strip(),
        deadline=deadline,
        value=payload.value.strip(),
        category=payload.category.strip(),
        description=payload.description.strip(),
        requirements=json.dumps([r.strip() for r in payload.requirements if r.strip()]),
        required_categories=json.dumps(required_categories),
        eligibility_criteria=json.dumps([e.strip() for e in payload.eligibilityCriteria if e.strip()]),
        location=(payload.location or "South Africa").strip(),
        status=TenderStatus.published if payload.status != "draft" else TenderStatus.draft,
        is_system=False,
        created_by_email=user.email,
        created_by_role=role,
    )
    db.add(tender)
    await db.commit()
    await db.refresh(tender)
    await write_audit_log(db, actor_email=user.email, action="CREATE", entity="Tender",
                          entity_id=str(tender.id), metadata={"title": tender.title})
    await db.commit()
    return {"ok": True, "tender": _serialize_tender(tender)}


@router.get("")
async def list_tender_matches(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role = getattr(user.role, "value", user.role)
    if role in {"admin", "evaluator"}:
        tenders = (await db.scalars(select(Tender).order_by(Tender.created_at.desc()))).all()
        return [_serialize_tender(t) for t in tenders]

    tenders = (
        await db.scalars(
            select(Tender).where(Tender.status == TenderStatus.published).order_by(Tender.created_at.desc())
        )
    ).all()
    docs = await _get_company_docs(db, user)
    items = [_serialize_tender(t, *_score_tender(t, docs)[:2]) for t in tenders]
    items.sort(key=lambda x: x["matchScore"], reverse=True)
    return items


@router.get("/calendar")
async def get_tender_calendar(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role = getattr(user.role, "value", user.role)
    q = select(Tender).order_by(Tender.deadline.asc())
    if role == "user":
        q = q.where(Tender.status == TenderStatus.published)
    tenders = (await db.scalars(q)).all()

    docs: list[ComplianceDocument] = []
    if role == "user":
        docs = await _get_company_docs(db, user)

    events = []
    for t in tenders:
        score, gaps, _ = _score_tender(t, docs) if role == "user" else (100, [], [])
        deadline = t.deadline.isoformat() if isinstance(t.deadline, date) else str(t.deadline)
        events.append({
            "id": f"tender-{t.id}",
            "title": t.title,
            "date": deadline,
            "type": "deadline",
            "organization": t.organization,
            "matchScore": score,
            "priority": "high" if score >= 80 else "medium" if score >= 60 else "low",
            "gapsCount": len(gaps),
        })
    return {"items": events}


@router.get("/calendar.ics", response_class=PlainTextResponse)
async def export_tender_calendar_ics(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    calendar_data = await get_tender_calendar(user=user, db=db)
    now_stamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TenderGuard Pro//Tender Calendar//EN"]
    for item in calendar_data["items"]:
        y, m, d_str = item["date"].split("-")
        dt = f"{y}{m}{d_str}"
        lines.extend([
            "BEGIN:VEVENT",
            f"UID:{item['id']}@tenderguard.local",
            f"DTSTAMP:{now_stamp}",
            f"DTSTART;VALUE=DATE:{dt}",
            f"SUMMARY:{item['title']} (Match {item['matchScore']}%)",
            f"DESCRIPTION:Organization: {item['organization']} | Gaps: {item['gapsCount']}",
            "END:VEVENT",
        ])
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines)


@router.get("/{tender_id}/readiness")
async def get_tender_readiness(
    tender_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tender = await db.get(Tender, tender_id)
    if not tender or tender.status != TenderStatus.published:
        raise HTTPException(status_code=404, detail="Tender not found")
    docs = await _get_company_docs(db, user)
    return {"tenderId": str(tender_id), **_build_readiness(tender, docs)}


@router.get("/{tender_id}")
async def get_tender_detail(
    tender_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role = getattr(user.role, "value", user.role)
    tender = await db.get(Tender, tender_id)
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    if role == "user" and tender.status != TenderStatus.published:
        raise HTTPException(status_code=404, detail="Tender not found")

    score, gaps, recommended = 100, [], []
    if role == "user":
        docs = await _get_company_docs(db, user)
        score, gaps, recommended = _score_tender(tender, docs)

    deadline = tender.deadline.isoformat() if isinstance(tender.deadline, date) else str(tender.deadline)
    return {
        "id": str(tender.id),
        "title": tender.title,
        "organization": tender.organization,
        "deadline": deadline,
        "value": tender.value,
        "matchScore": score,
        "gaps": gaps,
        "category": tender.category,
        "location": tender.location or "South Africa",
        "description": tender.description,
        "requirements": _tender_requirements(tender),
        "recommendedDocuments": recommended,
        "eligibilityCriteria": _tender_eligibility(tender),
        "status": tender.status.value if hasattr(tender.status, "value") else str(tender.status),
        "isSystem": tender.is_system,
    }


@router.patch("/{tender_id}")
async def update_tender(
    tender_id: int,
    payload: CreateTenderIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update any tender (system or provider). Admins can edit all; evaluators only their own."""
    role = getattr(user.role, "value", user.role)
    if role not in {"admin", "evaluator"}:
        raise HTTPException(status_code=403, detail="Forbidden")
    tender = await db.get(Tender, tender_id)
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    if role == "evaluator" and tender.created_by_email != user.email:
        raise HTTPException(status_code=403, detail="Not your tender")

    required_categories = [c.strip().lower() for c in payload.required_categories if c.strip()]
    invalid = [c for c in required_categories if c not in ALLOWED_CATEGORIES]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid required categories: {', '.join(invalid)}")
    try:
        deadline = date.fromisoformat(payload.deadline)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid deadline date (use YYYY-MM-DD)")

    tender.title = payload.title.strip()
    tender.organization = payload.organization.strip()
    tender.deadline = deadline
    tender.value = payload.value.strip()
    tender.category = payload.category.strip()
    tender.description = payload.description.strip()
    tender.requirements = json.dumps([r.strip() for r in payload.requirements if r.strip()])
    tender.required_categories = json.dumps(required_categories)
    tender.eligibility_criteria = json.dumps([e.strip() for e in payload.eligibilityCriteria if e.strip()])
    tender.location = (payload.location or "South Africa").strip()
    tender.status = TenderStatus.published if payload.status != "draft" else TenderStatus.draft
    await db.commit()
    await db.refresh(tender)
    await write_audit_log(db, actor_email=user.email, action="UPDATE", entity="Tender",
                          entity_id=str(tender.id), metadata={"title": tender.title})
    await db.commit()
    return {"ok": True, "tender": _serialize_tender(tender)}


@router.delete("/{tender_id}")
async def delete_tender(
    tender_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role = getattr(user.role, "value", user.role)
    if role not in {"admin", "evaluator"}:
        raise HTTPException(status_code=403, detail="Forbidden")
    tender = await db.get(Tender, tender_id)
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    if role == "evaluator" and tender.created_by_email != user.email:
        raise HTTPException(status_code=403, detail="Not your tender")
    await write_audit_log(db, actor_email=user.email, action="DELETE", entity="Tender",
                          entity_id=str(tender_id), metadata={"title": tender.title})
    await db.delete(tender)
    await db.commit()
    return {"ok": True}
