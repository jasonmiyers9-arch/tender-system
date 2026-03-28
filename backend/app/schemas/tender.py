"""schemas/tender.py — Pydantic models for tender and application endpoints."""
from __future__ import annotations

from pydantic import BaseModel


class TenderCreateRequest(BaseModel):
    title: str
    organization: str
    deadline: str          # ISO date string, e.g. "2026-06-30"
    value: str
    category: str
    description: str = ""
    location: str = "South Africa"
    requirements: list[str] = []
    required_categories: list[str] = []
    eligibility_criteria: list[str] = []


class TenderResponse(BaseModel):
    id: str
    title: str
    organization: str
    deadline: str
    value: str
    category: str
    description: str
    location: str
    status: str
    requirements: list[str]
    eligibility: list[str]
    matchScore: int | None = None
    applied: bool = False


class ApplicationCreateRequest(BaseModel):
    tender_id: int


class ApplicationResponse(BaseModel):
    id: str
    tenderId: str
    tenderTitle: str
    companyId: str
    status: str
    appliedAt: str
    reviewedBy: str | None
    reviewedAt: str | None
    rejectionReason: str | None


class ApplicationReviewRequest(BaseModel):
    status: str                   # "approved" | "rejected"
    rejection_reason: str | None = None
