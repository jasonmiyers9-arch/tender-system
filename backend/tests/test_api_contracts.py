"""API contract tests — tenders, audit, verify, and document endpoints."""
import pytest


# ---------------------------------------------------------------------------
# Tenders
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_tenders_list_requires_auth(client):
    res = await client.get("/tenders")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_tenders_calendar_requires_auth(client):
    res = await client.get("/tenders/calendar")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_tender_patch_requires_auth(client):
    res = await client.patch("/tenders/1", json={"title": "hacked"})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_tender_delete_requires_auth(client):
    res = await client.delete("/tenders/1")
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_apply_tender_requires_auth(client):
    res = await client.post("/tenders/1/apply", json={})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_my_applications_requires_auth(client):
    res = await client.get("/companies/my-applications")
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# Admin audit log
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_audit_log_requires_auth(client):
    res = await client.get("/admin/audit")
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# Verify / compliance
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_verify_search_requires_auth(client):
    res = await client.get("/verify/companies?q=acme")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_verify_report_requires_auth(client):
    res = await client.get("/verify/companies/1/report")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_verify_bundle_url_requires_auth(client):
    res = await client.get("/verify/companies/1/bundle-url")
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# Document renewal
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_renew_document_requires_auth(client):
    res = await client.patch("/documents/1/renew", json={
        "issue_date": "2024-01-01",
        "expiry_date": "2025-01-01",
    })
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# Score history
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_score_history_requires_auth(client):
    res = await client.get("/score/history")
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# Shape validation — unregistered payload returns 422
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_register_missing_fields_returns_422(client):
    res = await client.post("/auth/register", json={"email": "x@y.com"})
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_forgot_password_missing_email_returns_422(client):
    res = await client.post("/auth/forgot-password", json={})
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_reset_password_missing_fields_returns_422(client):
    res = await client.post("/auth/reset-password", json={"token": "abc"})
    assert res.status_code == 422
