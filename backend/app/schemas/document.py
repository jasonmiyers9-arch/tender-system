"""schemas/document.py — Pydantic models for compliance document endpoints."""
from __future__ import annotations

from pydantic import BaseModel


class DocumentResponse(BaseModel):
    id: str
    name: str
    category: str
    status: str
    expiryDate: str | None
    lastUpdated: str
    uploadedBy: str
    fileSize: str
    fileType: str


class DocumentListResponse(BaseModel):
    items: list[DocumentResponse]


class AdminDocumentUpdateRequest(BaseModel):
    status: str
    rejection_reason: str | None = None
    expiry_date: str | None = None
