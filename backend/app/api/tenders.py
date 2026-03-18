from datetime import date, datetime
from pathlib import Path
import json
import uuid

import redis.asyncio as redis
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.domain import CompanyMembership, ComplianceDocument
from app.models.user import Company, User

router = APIRouter(prefix="/tenders", tags=["tenders"])

TENDER_CATALOG = [
    {
        "id": "1",
        "title": "Municipal IT Support Services (12 Months)",
        "organization": "City Infrastructure Dept",
        "deadline": "2026-03-28",
        "value": "R 1.8M",
        "category": "IT Services",
        "description": "Provision of managed IT support, helpdesk, and endpoint maintenance for municipal offices.",
        "requirements": [
            "Valid tax clearance certificate",
            "CIPC company registration",
            "B-BBEE certificate",
            "Audited/financial compliance documents",
        ],
        "required_categories": ["tax", "registration", "bbbee", "financial"],
        "eligibilityCriteria": [
            "Registered South African company",
            "At least 3 years relevant experience",
            "Good standing for tax and statutory filings",
        ],
        "location": "South Africa",
        "status": "published",
        "createdByRole": "system",
    },
    {
        "id": "2",
        "title": "Provincial Facilities Maintenance Tender",
        "organization": "Provincial Public Works",
        "deadline": "2026-04-05",
        "value": "R 3.2M",
        "category": "Facilities",
        "description": "General building maintenance, emergency response, and compliance servicing across provincial offices.",
        "requirements": [
            "Tax compliance proof",
            "CIDB/technical certification",
            "Company registration documentation",
            "Insurance/financial backing",
        ],
        "required_categories": ["tax", "certification", "registration", "financial"],
        "eligibilityCriteria": [
            "Compliance with labour and safety laws",
            "Demonstrated service capacity",
            "Valid statutory documents",
        ],
        "location": "South Africa",
        "status": "published",
        "createdByRole": "system",
    },
    {
        "id": "3",
        "title": "Digital Transformation Advisory Panel",
        "organization": "National Innovation Agency",
        "deadline": "2026-04-18",
        "value": "R 950K",
        "category": "Consulting",
        "description": "Advisory support for digitization strategy, implementation planning, and governance alignment.",
        "requirements": [
            "Company registration",
            "Tax clearance",
            "Professional/legal compliance docs",
        ],
        "required_categories": ["registration", "tax", "legal"],
        "eligibilityCriteria": [
            "Relevant consulting track record",
            "Professional indemnity (where applicable)",
            "Regulatory compliance",
        ],
        "location": "South Africa",
        "status": "published",
        "createdByRole": "system",
    },
]

ALLOWED_CATEGORIES = {"tax", "legal", "financial", "certification", "bbbee", "registration"}


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


def _status_value(doc: ComplianceDocument) -> str:
    return doc.status.value if hasattr(doc.status, "value") else str(doc.status)


def _storage_file() -> Path:
    root = Path(settings.STORAGE_DIR)
    root.mkdir(parents=True, exist_ok=True)
    return root / "provider_tenders.json"


def _load_provider_tenders() -> list[dict]:
    file_path = _storage_file()
    if not file_path.exists():
        return []
    try:
        data = json.loads(file_path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def _save_provider_tenders(items: list[dict]) -> None:
    _storage_file().write_text(json.dumps(items, indent=2), encoding="utf-8")


def _all_tenders() -> list[dict]:
    return [*TENDER_CATALOG, *_load_provider_tenders()]


def _published_tenders() -> list[dict]:
    return [t for t in _all_tenders() if t.get("status", "published") == "published"]


def _score_tender(tender: dict, docs: list[ComplianceDocument]) -> tuple[int, list[str], list[str]]:
    today = date.today()
    by_category: dict[str, list[ComplianceDocument]] = {}
    for d in docs:
        key = str(d.category or "").lower().strip()
        by_category.setdefault(key, []).append(d)

    gaps: list[str] = []
    recommended: list[str] = []
    score = 100

    for cat in tender["required_categories"]:
        cat_docs = by_category.get(cat, [])
        if not cat_docs:
            gaps.append(f"Missing {cat} document")
            recommended.append(cat)
            score -= 18
            continue

        latest = sorted(cat_docs, key=lambda x: x.created_at or x.updated_at, reverse=True)[0]
        status = _status_value(latest)
        if status == "rejected":
            gaps.append(f"{cat} document was rejected")
            recommended.append(cat)
            score -= 14
        if latest.expiry_date and latest.expiry_date.date() < today:
            gaps.append(f"{cat} document is expired")
            recommended.append(cat)
            score -= 16

    unverified = sum(1 for d in docs if _status_value(d) == "uploaded")
    if unverified >= 3:
        score -= 6

    score = max(0, min(100, score))
    return score, gaps, sorted(set(recommended))


def _build_readiness(tender: dict, docs: list[ComplianceDocument]) -> dict:
    today = date.today()
    by_category: dict[str, list[ComplianceDocument]] = {}
    for d in docs:
        key = str(d.category or "").lower().strip()
        by_category.setdefault(key, []).append(d)

    checklist = []
    blockers: list[str] = []
    missing_categories: list[str] = []

    for cat in tender["required_categories"]:
        cat_docs = by_category.get(cat, [])
        if not cat_docs:
            checklist.append({"item": f"{cat} document available", "status": "missing"})
            missing_categories.append(cat)
            blockers.append(f"Missing required {cat} document")
            continue

        latest = sorted(cat_docs, key=lambda x: x.created_at or x.updated_at, reverse=True)[0]
        status = _status_value(latest)
        if latest.expiry_date and latest.expiry_date.date() < today:
            checklist.append({"item": f"{cat} document not expired", "status": "failed"})
            blockers.append(f"{cat} document is expired")
        elif status == "rejected":
            checklist.append({"item": f"{cat} document approved", "status": "failed"})
            blockers.append(f"{cat} document is rejected")
        else:
            checklist.append({"item": f"{cat} document valid", "status": "passed"})

    score, gaps, recommended = _score_tender(tender, docs)
    readiness_score = max(0, min(100, score - (len(blockers) * 5)))
    ready = len(blockers) == 0

    return {
        "readyToSubmit": ready,
        "readinessScore": readiness_score,
        "blockers": blockers,
        "missingCategories": missing_categories,
        "gaps": gaps,
        "recommendedDocuments": recommended,
        "checklist": checklist,
    }


def _serialize_match(t: dict, score: int, gaps: list[str]) -> dict:
    return {
        "id": t["id"],
        "title": t["title"],
        "organization": t["organization"],
        "deadline": t["deadline"],
        "value": t["value"],
        "matchScore": score,
        "gaps": gaps,
        "category": t["category"],
        "location": t.get("location", "South Africa"),
    }


@router.post("")
async def create_tender(
    payload: CreateTenderIn,
    user: User = Depends(get_current_user),
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

    items = _load_provider_tenders()
    tender = {
        "id": f"provider-{uuid.uuid4().hex[:8]}",
        "title": payload.title.strip(),
        "organization": payload.organization.strip(),
        "deadline": payload.deadline,
        "value": payload.value.strip(),
        "category": payload.category.strip(),
        "description": payload.description.strip(),
        "requirements": [r.strip() for r in payload.requirements if r.strip()],
        "required_categories": required_categories,
        "eligibilityCriteria": [e.strip() for e in payload.eligibilityCriteria if e.strip()],
        "location": payload.location.strip() or "South Africa",
        "status": "published" if payload.status != "draft" else "draft",
        "createdBy": user.email,
        "createdByRole": role,
        "createdAt": datetime.utcnow().isoformat(),
    }
    items.append(tender)
    _save_provider_tenders(items)
    return {"ok": True, "tender": tender}


@router.get("")
async def list_tender_matches(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role = getattr(user.role, "value", user.role)
    tenders = _all_tenders() if role in {"admin", "evaluator"} else _published_tenders()

    if role in {"admin", "evaluator"}:
        return [
            {
                "id": t["id"],
                "title": t["title"],
                "organization": t["organization"],
                "deadline": t["deadline"],
                "value": t["value"],
                "matchScore": 100,
                "gaps": [],
                "category": t["category"],
                "location": t.get("location", "South Africa"),
                "status": t.get("status", "published"),
                "createdAt": t.get("createdAt"),
                "createdBy": t.get("createdBy", t.get("createdByRole", "system")),
            }
            for t in tenders
        ]

    company_id = await _get_active_company_id(db, user)
    docs = (
        await db.scalars(
            select(ComplianceDocument)
            .where(ComplianceDocument.company_id == company_id)
            .order_by(ComplianceDocument.created_at.desc())
        )
    ).all()

    items = []
    for t in tenders:
        score, gaps, _recommended = _score_tender(t, docs)
        items.append(_serialize_match(t, score, gaps))

    items.sort(key=lambda x: x["matchScore"], reverse=True)
    return items


@router.get('/calendar')
async def get_tender_calendar(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role = getattr(user.role, "value", user.role)
    tenders = _all_tenders() if role in {"admin", "evaluator"} else _published_tenders()
    docs: list[ComplianceDocument] = []

    if role == "user":
        company_id = await _get_active_company_id(db, user)
        docs = (
            await db.scalars(
                select(ComplianceDocument)
                .where(ComplianceDocument.company_id == company_id)
                .order_by(ComplianceDocument.created_at.desc())
            )
        ).all()

    events = []
    for t in tenders:
        score, gaps, _recommended = _score_tender(t, docs) if role == "user" else (100, [], [])
        deadline = t['deadline']
        events.append(
            {
                'id': f"tender-{t['id']}",
                'title': t['title'],
                'date': deadline,
                'type': 'deadline',
                'organization': t['organization'],
                'matchScore': score,
                'priority': 'high' if score >= 80 else 'medium' if score >= 60 else 'low',
                'gapsCount': len(gaps),
            }
        )

    events.sort(key=lambda e: e['date'])
    return {'items': events}


@router.get('/calendar.ics', response_class=PlainTextResponse)
async def export_tender_calendar_ics(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    calendar_data = await get_tender_calendar(user=user, db=db)
    now_stamp = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//TenderGuard Pro//Tender Calendar//EN',
    ]

    for item in calendar_data['items']:
        y, m, d = item['date'].split('-')
        dt = f'{y}{m}{d}'
        lines.extend(
            [
                'BEGIN:VEVENT',
                f"UID:{item['id']}@tenderguard.local",
                f"DTSTAMP:{now_stamp}",
                f"DTSTART;VALUE=DATE:{dt}",
                f"SUMMARY:{item['title']} (Match {item['matchScore']}%)",
                f"DESCRIPTION:Organization: {item['organization']} | Gaps: {item['gapsCount']}",
                'END:VEVENT',
            ]
        )

    lines.append('END:VCALENDAR')
    return '\r\n'.join(lines)


@router.get("/{tender_id}/readiness")
async def get_tender_readiness(
    tender_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    company_id = await _get_active_company_id(db, user)
    docs = (
        await db.scalars(
            select(ComplianceDocument)
            .where(ComplianceDocument.company_id == company_id)
            .order_by(ComplianceDocument.created_at.desc())
        )
    ).all()

    tender = next((t for t in _published_tenders() if t["id"] == tender_id), None)
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    return {
        "tenderId": tender_id,
        **_build_readiness(tender, docs),
    }


@router.get("/{tender_id}")
async def get_tender_detail(
    tender_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role = getattr(user.role, "value", user.role)
    tenders = _all_tenders() if role in {"admin", "evaluator"} else _published_tenders()
    tender = next((t for t in tenders if t["id"] == tender_id), None)
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    score = 100
    gaps: list[str] = []
    recommended: list[str] = []
    if role == "user":
        company_id = await _get_active_company_id(db, user)
        docs = (
            await db.scalars(
                select(ComplianceDocument)
                .where(ComplianceDocument.company_id == company_id)
                .order_by(ComplianceDocument.created_at.desc())
            )
        ).all()
        score, gaps, recommended = _score_tender(tender, docs)

    return {
        "id": tender["id"],
        "title": tender["title"],
        "organization": tender["organization"],
        "deadline": tender["deadline"],
        "value": tender["value"],
        "matchScore": score,
        "gaps": gaps,
        "category": tender["category"],
        "location": tender.get("location", "South Africa"),
        "description": tender["description"],
        "requirements": tender["requirements"],
        "recommendedDocuments": recommended,
        "eligibilityCriteria": tender["eligibilityCriteria"],
    }
