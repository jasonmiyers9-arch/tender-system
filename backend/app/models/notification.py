"""
models/notification.py
----------------------
In-app alert notifications triggered by document expiry scans.
"""
from __future__ import annotations

import datetime

from sqlalchemy import Boolean, Date, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        UniqueConstraint(
            "company_id", "document_id", "alert_type", "trigger_date",
            name="uq_notification_dedupe",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False
    )
    document_id: Mapped[int | None] = mapped_column(
        ForeignKey("compliance_documents.id", ondelete="SET NULL"), nullable=True
    )
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    trigger_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
