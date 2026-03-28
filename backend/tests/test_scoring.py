"""Unit tests for the tender scoring algorithm.

_score_tender returns (score: int, gaps: list[str], recommended: list[str])
_build_readiness returns a dict with keys: readyToSubmit, readinessScore,
    blockers, missingCategories, gaps, recommendedDocuments, checklist.
"""
from datetime import date, timedelta
from typing import cast as _cast
from unittest.mock import MagicMock

from app.api.tenders import _score_tender, _build_readiness
from app.models.domain import ComplianceDocument, Tender


import json as _json


def _make_tender(required_cats: list[str] | None = None) -> MagicMock:
    """Minimal Tender-like object that satisfies _score_tender / _build_readiness.

    _tender_required_cats reads `tender.required_categories` as a JSON string.
    """
    tender = MagicMock()
    tender.id = 1
    tender.title = "Test Tender"
    tender.deadline = date.today() + timedelta(days=30)
    tender.value = 100_000
    tender.category = "IT"
    # _tender_required_cats does json.loads(tender.required_categories or "[]")
    tender.required_categories = _json.dumps(required_cats or [])
    # _tender_requirements and _tender_eligibility also read JSON strings
    tender.requirements = "[]"
    tender.eligibility_criteria = "[]"
    tender.is_system = True
    return tender


def _make_doc(category: str, status: str = "verified", expiry_date=None) -> ComplianceDocument:
    doc = MagicMock()
    doc.category = category
    doc.status = status
    doc.created_at = None
    doc.updated_at = None
    # expiry_date should be a MagicMock with a .date() method returning a real date
    exp = expiry_date or (date.today() + timedelta(days=365))
    expiry_mock = MagicMock()
    expiry_mock.date.return_value = exp
    doc.expiry_date = expiry_mock
    return _cast(ComplianceDocument, doc)


# ---------------------------------------------------------------------------
# _score_tender — returns (int, list[str], list[str])
# ---------------------------------------------------------------------------

def test_score_starts_high_with_no_requirements():
    # A tender with no required docs should give score=100, no gaps
    tender = _make_tender(required_cats=[])
    score, gaps, recommended = _score_tender(tender, [])
    assert score == 100
    assert gaps == []
    assert recommended == []


def test_score_penalised_for_missing_required_doc():
    tender = _make_tender(required_cats=["tax_clearance"])
    score, gaps, recommended = _score_tender(tender, [])
    assert score < 100
    assert any("tax_clearance" in g for g in gaps)
    assert "tax_clearance" in recommended


def test_score_penalised_for_rejected_doc():
    tender = _make_tender(required_cats=["tax_clearance"])
    docs = [_make_doc("tax_clearance", status="rejected")]
    score_rejected, gaps_rejected, _ = _score_tender(tender, docs)
    docs_ok = [_make_doc("tax_clearance", status="verified")]
    score_verified, gaps_verified, _ = _score_tender(tender, docs_ok)
    assert score_verified > score_rejected
    assert len(gaps_verified) < len(gaps_rejected)


def test_score_penalised_for_expired_doc():
    tender = _make_tender(required_cats=["cipc_registration"])
    yesterday = date.today() - timedelta(days=1)
    expired_doc = _make_doc("cipc_registration", status="verified", expiry_date=yesterday)
    score_exp, gaps_exp, _ = _score_tender(tender, [expired_doc])
    valid_doc = _make_doc("cipc_registration", status="verified")
    score_ok, gaps_ok, _ = _score_tender(tender, [valid_doc])
    assert score_ok >= score_exp


def test_score_clamped_at_zero():
    # 6+ required docs missing → penalty > 100
    tender = _make_tender(required_cats=[
        "tax_clearance", "cipc_registration", "bee_certificate",
        "csd_registration", "professional_indemnity", "declaration",
    ])
    score, _, _ = _score_tender(tender, [])
    assert score == 0


def test_score_never_exceeds_100():
    tender = _make_tender(required_cats=["tax_clearance"])
    docs = [_make_doc("tax_clearance", status="verified")]
    score, _, _ = _score_tender(tender, docs)
    assert 0 <= score <= 100


# ---------------------------------------------------------------------------
# _build_readiness — returns dict
# ---------------------------------------------------------------------------

def test_readiness_structure_keys():
    tender = _make_tender()
    result = _build_readiness(tender, [])
    assert isinstance(result, dict)
    for key in ("readyToSubmit", "readinessScore", "blockers", "missingCategories",
                "gaps", "recommendedDocuments", "checklist"):
        assert key in result, f"Missing key: {key}"


def test_readiness_not_ready_when_docs_missing():
    tender = _make_tender(required_cats=["tax_clearance"])
    result = _build_readiness(tender, [])
    assert result["readyToSubmit"] is False
    assert "tax_clearance" in result["missingCategories"]
    assert len(result["blockers"]) > 0


def test_readiness_ready_with_valid_docs():
    tender = _make_tender(required_cats=["tax_clearance"])
    docs = [_make_doc("tax_clearance", status="verified")]
    result = _build_readiness(tender, docs)
    assert result["readyToSubmit"] is True
    assert result["blockers"] == []


def test_readiness_checklist_items_have_status():
    tender = _make_tender(required_cats=["tax_clearance"])
    result = _build_readiness(tender, [])
    assert isinstance(result["checklist"], list)
    for item in result["checklist"]:
        assert "item" in item
        assert "status" in item
        assert item["status"] in ("passed", "failed", "missing")
