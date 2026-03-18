import pytest
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_ok():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"ok": True}


@pytest.mark.xfail(reason="Implemented in Step 2 (auth endpoints)")
def test_auth_register_login_flow_contract():
    # Will be replaced with real register/login assertions in Step 2.
    res = client.post("/auth/register", json={})
    assert res.status_code == 201


@pytest.mark.xfail(reason="Implemented in Step 4 (document upload/list)")
def test_documents_upload_and_list_contract():
    # Will be replaced with real multipart upload/list assertions in Step 4.
    res = client.get("/documents")
    assert res.status_code == 200
