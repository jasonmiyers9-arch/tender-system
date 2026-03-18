"""Initial schema

Revision ID: 9ce89f5c713e
Revises:
Create Date: 2026-03-04 16:04:56.960871

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9ce89f5c713e"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


user_role = sa.Enum("user", "admin", "evaluator", name="user_role", native_enum=False)
membership_role = sa.Enum("owner", "member", name="membership_role", native_enum=False)
membership_status = sa.Enum("active", "invited", name="membership_status", native_enum=False)
document_status = sa.Enum("uploaded", "verified", "rejected", "expired", name="document_status", native_enum=False)


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", user_role, nullable=False, server_default="user"),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("verification_status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verified_by", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["verified_by"], ["users.id"]),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)

    op.create_table(
        "companies",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("reg_number", sa.String(length=100), nullable=True),
        sa.Column("vat", sa.String(length=100), nullable=True),
        sa.Column("address", sa.String(length=500), nullable=True),
        sa.Column("contact_email", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_companies_id"), "companies", ["id"], unique=False)

    op.create_table(
        "company_memberships",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("role", membership_role, nullable=False),
        sa.Column("status", membership_status, nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "company_id"),
    )

    op.create_table(
        "compliance_documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("status", document_status, nullable=False, server_default="uploaded"),
        sa.Column("issue_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expiry_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("storage_key", sa.String(length=500), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_compliance_documents_company_id"), "compliance_documents", ["company_id"], unique=False)
    op.create_index(op.f("ix_compliance_documents_id"), "compliance_documents", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_compliance_documents_id"), table_name="compliance_documents")
    op.drop_index(op.f("ix_compliance_documents_company_id"), table_name="compliance_documents")
    op.drop_table("compliance_documents")

    op.drop_table("company_memberships")

    op.drop_index(op.f("ix_companies_id"), table_name="companies")
    op.drop_table("companies")

    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
