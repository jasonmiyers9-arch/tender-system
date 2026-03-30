from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.redis import get_redis
from app.db.session import get_db
from app.models.domain import CompanyMembership, ComplianceDocument
from app.models.user import Company, User

router = APIRouter(prefix='/companies', tags=['companies'])


class SwitchCompanyIn(BaseModel):
    company_id: int


class OnboardingIn(BaseModel):
    csd_number: str | None = None
    bbbee_level: str | None = None
    cidb_grade: str | None = None
    industry_sector: str | None = None
    province: str | None = None


class UpdateCompanyProfileIn(BaseModel):
    name: str | None = None
    registrationNumber: str | None = None
    vatNumber: str | None = None
    industry: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None


def _serialize_company(c: Company) -> dict:
    return {
        'id': str(c.id),
        'name': c.name,
        'registrationNumber': c.reg_number or '',
        'vatNumber': c.vat or '',
        'status': 'verified',
        'address': c.address or '',
        'phone': c.phone or '',
        'email': c.contact_email or '',
        'website': '',
        'industry': c.industry_sector or '',
        'incorporatedDate': c.created_at.date().isoformat() if c.created_at else '',
    }


def _onboarding_field_checks(company: Company) -> dict[str, bool]:
    return {
        'csd_number': bool((company.csd_number or '').strip()),
        'bbbee_level': bool((company.bbbee_level or '').strip()),
        'industry_sector': bool((company.industry_sector or '').strip()),
        'province': bool((company.province or '').strip()),
    }


async def _get_user_companies(db: AsyncSession, user: User) -> list[Company]:
    if user.role.value == 'admin':
        rows = await db.execute(select(Company).order_by(Company.id.asc()))
        return list(rows.scalars().all())

    rows = await db.execute(
        select(Company)
        .join(CompanyMembership, CompanyMembership.company_id == Company.id)
        .where(CompanyMembership.user_id == user.id)
        .order_by(Company.id.asc())
    )
    return list(rows.scalars().all())


async def _get_active_company_id(user_id: int) -> int | None:
    r = get_redis()
    raw = await r.get(f'active_company:{user_id}')
    return int(raw) if raw else None


async def _set_active_company_id(user_id: int, company_id: int) -> None:
    r = get_redis()
    await r.set(f'active_company:{user_id}', str(company_id))


@router.get('')
async def list_companies(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    companies = await _get_user_companies(db, user)
    if not companies:
        return {'items': []}

    active_id = await _get_active_company_id(user.id)
    if active_id is None:
        await _set_active_company_id(user.id, companies[0].id)

    return {'items': [_serialize_company(c) for c in companies]}


@router.get('/active')
async def get_active_company(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    companies = await _get_user_companies(db, user)
    if not companies:
        raise HTTPException(status_code=404, detail='No companies found')

    allowed_ids = {c.id for c in companies}
    active_id = await _get_active_company_id(user.id)

    if active_id not in allowed_ids:
        active_id = companies[0].id
        await _set_active_company_id(user.id, active_id)

    active = next(c for c in companies if c.id == active_id)
    return _serialize_company(active)


@router.post('/switch')
async def switch_company(
    payload: SwitchCompanyIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    companies = await _get_user_companies(db, user)
    if not companies:
        raise HTTPException(status_code=404, detail='No companies found')

    allowed_ids = {c.id for c in companies}
    if payload.company_id not in allowed_ids:
        raise HTTPException(status_code=403, detail='Company not accessible for user')

    await _set_active_company_id(user.id, payload.company_id)
    active = next(c for c in companies if c.id == payload.company_id)
    return {'activeCompanyId': str(payload.company_id), 'company': _serialize_company(active)}


@router.get('/onboarding/status')
async def onboarding_status(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    companies = await _get_user_companies(db, user)
    if not companies:
        raise HTTPException(status_code=404, detail='No companies found')
    company = companies[0]

    profile_checks = _onboarding_field_checks(company)
    docs_count = int(
        (
            await db.scalar(
                select(func.count(ComplianceDocument.id)).where(ComplianceDocument.company_id == company.id)
            )
        )
        or 0
    )
    docs_ok = docs_count >= 3
    completed = all(profile_checks.values()) and docs_ok

    if bool(company.onboarding_completed) != completed:
        company.onboarding_completed = completed
        await db.commit()

    checks = {
        **profile_checks,
        'minimum_documents_uploaded': docs_ok,
    }
    done_count = sum(1 for v in checks.values() if v)

    return {
        'onboardingCompleted': completed,
        'companyId': str(company.id),
        'checks': checks,
        'documentsUploaded': docs_count,
        'requiredDocuments': 3,
        'completionPercent': int((done_count / len(checks)) * 100),
    }


@router.patch('/active')
async def update_active_company(
    payload: UpdateCompanyProfileIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    companies = await _get_user_companies(db, user)
    if not companies:
        raise HTTPException(status_code=404, detail='No companies found')

    allowed_ids = {c.id for c in companies}
    active_id = await _get_active_company_id(user.id)

    if active_id not in allowed_ids:
        active_id = companies[0].id
        await _set_active_company_id(user.id, active_id)

    company = next(c for c in companies if c.id == active_id)

    if payload.name is not None:
        company.name = payload.name.strip() or company.name
    if payload.registrationNumber is not None:
        company.reg_number = payload.registrationNumber.strip() or None
    if payload.vatNumber is not None:
        company.vat = payload.vatNumber.strip() or None
    if payload.industry is not None:
        company.industry_sector = payload.industry.strip() or None
    if payload.email is not None:
        company.contact_email = payload.email.strip() or None
    if payload.phone is not None:
        company.phone = payload.phone.strip() or None
    if payload.address is not None:
        company.address = payload.address.strip() or None

    await db.commit()
    await db.refresh(company)
    return _serialize_company(company)


@router.post('/onboarding')
async def complete_onboarding(
    payload: OnboardingIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    companies = await _get_user_companies(db, user)
    if not companies:
        raise HTTPException(status_code=404, detail='No companies found')

    company = companies[0]
    company.csd_number = (payload.csd_number or '').strip() or None
    company.bbbee_level = (payload.bbbee_level or '').strip() or None
    company.cidb_grade = (payload.cidb_grade or '').strip() or None
    company.industry_sector = (payload.industry_sector or '').strip() or None
    company.province = (payload.province or '').strip() or None
    profile_checks = _onboarding_field_checks(company)
    docs_count = int(
        (
            await db.scalar(
                select(func.count(ComplianceDocument.id)).where(ComplianceDocument.company_id == company.id)
            )
        )
        or 0
    )
    company.onboarding_completed = all(profile_checks.values()) and docs_count >= 3

    await db.commit()
    await _set_active_company_id(user.id, company.id)

    return {'ok': True, 'company': _serialize_company(company), 'onboardingCompleted': bool(company.onboarding_completed)}
