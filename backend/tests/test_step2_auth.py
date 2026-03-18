import pytest

from app.api.auth import _create_token, _decode_token, _hash_password, _verify_password
from app.models.user import User, UserRole


def test_password_hash_roundtrip():
    raw = "S3curePass!"
    hashed = _hash_password(raw)
    assert hashed.startswith("pbkdf2_sha256$")
    assert _verify_password(raw, hashed) is True
    assert _verify_password("wrong", hashed) is False


def test_access_token_contains_subject_and_type():
    user = User(
        id=123,
        email="admin@example.com",
        password_hash="x",
        role=UserRole.admin,
        is_verified=True,
        verification_status="approved",
    )
    token = _create_token(user, "access", 5)
    payload = _decode_token(token, "access")
    assert payload["sub"] == "123"
    assert payload["type"] == "access"
