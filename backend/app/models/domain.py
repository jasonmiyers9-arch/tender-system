import enum
import datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MembershipRole(str, enum.Enum):
    owner = "owner"
    member = "member"


class MembershipStatus(str, enum.Enum):
    active = "active"
    invited = "invited"


class DocumentStatus(str, enum.Enum):
    uploaded = "uploaded"
    verified = "verified"
    rejected = "rejected"
    expired = "expired"


class CompanyMembership(Base):
    __tablename__ = "company_memberships"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), primary_key=True)
    role: Mapped[MembershipRole] = mapped_column(
        Enum(MembershipRole, name="membership_role", native_enum=False), nullable=False
    )
    status: Mapped[MembershipStatus] = mapped_column(
        Enum(MembershipStatus, name="membership_status", native_enum=False), default=MembershipStatus.active, nullable=False
    )

    user = relationship("User", back_populates="memberships")
    company = relationship("Company", back_populates="memberships")


class ComplianceDocument(Base):
    __tablename__ = "compliance_documents"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus, name="document_status", native_enum=False), default=DocumentStatus.uploaded, nullable=False
    )
    issue_date: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expiry_date: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)

    company = relationship("Company", back_populates="documents")


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        UniqueConstraint("company_id", "document_id", "alert_type", "trigger_date", name="uq_notification_dedupe"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False)
    document_id: Mapped[int | None] = mapped_column(ForeignKey("compliance_documents.id", ondelete="SET NULL"), nullable=True)
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    trigger_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
