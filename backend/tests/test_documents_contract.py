import pytest
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


@pytest.mark.xfail(reason="Implemented in Step 4 (documents upload/list/detail/download)")
def test_documents_upload_and_list_contract():
    # Contract placeholder required by slice plan.
    response = client.get('/documents')
    assert response.status_code == 200
