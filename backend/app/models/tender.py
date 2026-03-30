"""
models/tender.py
----------------
Tender listings and company applications against them.
"""
from __future__ import annotations

import enum
import datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TenderStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    closed = "closed"


class Tender(Base):
    __tablename__ = "tenders"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    organization: Mapped[str] = mapped_column(String(255), nullable=False)
    deadline: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    value: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    location: Mapped[str] = mapped_column(String(100), nullable=False, default="South Africa")
    status: Mapped[TenderStatus] = mapped_column(
        Enum(TenderStatus, name="tender_status", native_enum=False),
        default=TenderStatus.published,
        nullable=False,
    )
    # JSON-encoded lists stored as Text columns
    requirements: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    required_categories: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    eligibility_criteria: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    created_by_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_by_role: Mapped[str] = mapped_column(String(50), nullable=False, default="system")
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    applications: Mapped[list["TenderApplication"]] = relationship(
        "TenderApplication", back_populates="tender", cascade="all, delete-orphan"
    )


class ApplicationStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    withdrawn = "withdrawn"


class TenderApplication(Base):
    __tablename__ = "tender_applications"
    __table_args__ = (
        UniqueConstraint("tender_id", "company_id", name="uq_tender_company_application"),
    )

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tender_id: Mapped[int] = mapped_column(
        ForeignKey("tenders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    applied_by: Mapped[str] = mapped_column(String(255), nullable=False)
    applied_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(ApplicationStatus, name="application_status", native_enum=False),
        default=ApplicationStatus.pending,
        nullable=False,
    )
    reviewed_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reviewed_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    tender: Mapped["Tender"] = relationship("Tender", back_populates="applications")
    company = relationship("Company")
