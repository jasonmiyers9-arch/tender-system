"""schemas/score.py — Pydantic models for compliance score endpoints."""
from __future__ import annotations

from pydantic import BaseModel


class ScoreResponse(BaseModel):
    score: int
    band: str        # "tender-ready" | "partial" | "high-risk"
    breakdown: dict[str, int]
    expiringCount: int
    missingCount: int
    lastUpdated: str


class ScoreHistoryPoint(BaseModel):
    date: str
    score: int


class ScoreHistoryResponse(BaseModel):
    history: list[ScoreHistoryPoint]
    currentScore: int


class ReadinessBandResponse(BaseModel):
    band: str
    score: int
    description: str
