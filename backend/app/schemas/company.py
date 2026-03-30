"""schemas/company.py — Pydantic models for company and onboarding endpoints."""
from __future__ import annotations

from pydantic import BaseModel


class OnboardingUpdateRequest(BaseModel):
    csd_number: str | None = None
    bbbee_level: str | None = None
    cidb_grade: str | None = None
    industry_sector: str | None = None
    province: str | None = None


class CompanyProfileUpdateRequest(BaseModel):
    name: str | None = None
    registrationNumber: str | None = None
    vatNumber: str | None = None
    industry: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None


class SwitchCompanyRequest(BaseModel):
    company_id: int


class CompanyResponse(BaseModel):
    id: str
    name: str
    registrationNumber: str
    vatNumber: str
    status: str
    address: str
    phone: str
    email: str
    website: str
    industry: str
    incorporatedDate: str


class OnboardingStatusResponse(BaseModel):
    onboardingCompleted: bool
    companyId: str
    checks: dict[str, bool]
    documentsUploaded: int
    requiredDocuments: int
    completionPercent: int
