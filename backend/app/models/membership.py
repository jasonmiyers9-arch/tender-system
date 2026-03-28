"""
models/membership.py
--------------------
CompanyMembership and its enums — the link between User ↔ Company.
"""
from __future__ import annotations

import enum

from sqlalchemy import Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MembershipRole(str, enum.Enum):
    owner = "owner"
    member = "member"


class MembershipStatus(str, enum.Enum):
    active = "active"
    invited = "invited"


class CompanyMembership(Base):
    __tablename__ = "company_memberships"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[MembershipRole] = mapped_column(
        Enum(MembershipRole, name="membership_role", native_enum=False), nullable=False
    )
    status: Mapped[MembershipStatus] = mapped_column(
        Enum(MembershipStatus, name="membership_status", native_enum=False),
        default=MembershipStatus.active,
        nullable=False,
    )

    user = relationship("User", back_populates="memberships")
    company = relationship("Company", back_populates="memberships")
