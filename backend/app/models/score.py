"""
models/score.py
---------------
Daily compliance score snapshots — used to build the score history chart.
"""
from __future__ import annotations

import datetime

from sqlalchemy import Date, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ScoreSnapshot(Base):
    __tablename__ = "score_snapshots"
    __table_args__ = (
        UniqueConstraint("company_id", "snapshot_date", name="uq_score_snapshot"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
