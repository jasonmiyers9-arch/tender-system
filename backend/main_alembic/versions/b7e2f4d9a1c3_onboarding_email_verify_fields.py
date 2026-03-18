"""add onboarding and email verify fields

Revision ID: b7e2f4d9a1c3
Revises: 9ce89f5c713e
Create Date: 2026-03-06 13:10:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7e2f4d9a1c3"
down_revision: Union[str, Sequence[str], None] = "9ce89f5c713e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.false()))

    op.add_column("companies", sa.Column("phone", sa.String(length=50), nullable=True))
    op.add_column("companies", sa.Column("csd_number", sa.String(length=120), nullable=True))
    op.add_column("companies", sa.Column("bbbee_level", sa.String(length=50), nullable=True))
    op.add_column("companies", sa.Column("cidb_grade", sa.String(length=50), nullable=True))
    op.add_column("companies", sa.Column("industry_sector", sa.String(length=120), nullable=True))
    op.add_column("companies", sa.Column("province", sa.String(length=80), nullable=True))
    op.add_column("companies", sa.Column("onboarding_completed", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("companies", "onboarding_completed")
    op.drop_column("companies", "province")
    op.drop_column("companies", "industry_sector")
    op.drop_column("companies", "cidb_grade")
    op.drop_column("companies", "bbbee_level")
    op.drop_column("companies", "csd_number")
    op.drop_column("companies", "phone")

    op.drop_column("users", "email_verified")
