"""add tenders applications score_snapshots audit_logs

Revision ID: d5e8f1a2b3c4
Revises: c3f4f6b2a901
Create Date: 2026-03-25 10:00:00
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "d5e8f1a2b3c4"
down_revision = "c3f4f6b2a901"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── tenders ────────────────────────────────────────────────────────────────
    op.create_table(
        "tenders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("organization", sa.String(length=255), nullable=False),
        sa.Column("deadline", sa.Date(), nullable=False),
        sa.Column("value", sa.String(length=100), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("location", sa.String(length=100), nullable=False, server_default="South Africa"),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="published",
        ),
        sa.Column("requirements", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("required_categories", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("eligibility_criteria", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("created_by_email", sa.String(length=255), nullable=True),
        sa.Column("created_by_role", sa.String(length=50), nullable=False, server_default="system"),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_tenders_id"), "tenders", ["id"], unique=False)

    # ── tender_applications ────────────────────────────────────────────────────
    op.create_table(
        "tender_applications",
        sa.Column("id", sa.String(length=50), nullable=False),
        sa.Column("tender_id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("applied_by", sa.String(length=255), nullable=False),
        sa.Column("applied_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("reviewed_by", sa.String(length=255), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tender_id"], ["tenders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tender_id", "company_id", name="uq_tender_company_application"),
    )
    op.create_index(op.f("ix_tender_applications_tender_id"), "tender_applications", ["tender_id"], unique=False)
    op.create_index(op.f("ix_tender_applications_company_id"), "tender_applications", ["company_id"], unique=False)

    # ── score_snapshots ────────────────────────────────────────────────────────
    op.create_table(
        "score_snapshots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_id", "snapshot_date", name="uq_score_snapshot"),
    )
    op.create_index(op.f("ix_score_snapshots_id"), "score_snapshots", ["id"], unique=False)
    op.create_index(op.f("ix_score_snapshots_company_id"), "score_snapshots", ["company_id"], unique=False)

    # ── audit_logs ─────────────────────────────────────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("actor_email", sa.String(length=255), nullable=False),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("entity", sa.String(length=100), nullable=False),
        sa.Column("entity_id", sa.String(length=100), nullable=False),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_logs_id"), "audit_logs", ["id"], unique=False)

    # ── password_reset_tokens ──────────────────────────────────────────────────
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token", sa.String(length=128), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_password_reset_tokens_id"), "password_reset_tokens", ["id"], unique=False)
    op.create_index(op.f("ix_password_reset_tokens_token"), "password_reset_tokens", ["token"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_password_reset_tokens_token"), table_name="password_reset_tokens")
    op.drop_index(op.f("ix_password_reset_tokens_id"), table_name="password_reset_tokens")
    op.drop_table("password_reset_tokens")

    op.drop_index(op.f("ix_audit_logs_id"), table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_index(op.f("ix_score_snapshots_company_id"), table_name="score_snapshots")
    op.drop_index(op.f("ix_score_snapshots_id"), table_name="score_snapshots")
    op.drop_table("score_snapshots")

    op.drop_index(op.f("ix_tender_applications_company_id"), table_name="tender_applications")
    op.drop_index(op.f("ix_tender_applications_tender_id"), table_name="tender_applications")
    op.drop_table("tender_applications")

    op.drop_index(op.f("ix_tenders_id"), table_name="tenders")
    op.drop_table("tenders")
