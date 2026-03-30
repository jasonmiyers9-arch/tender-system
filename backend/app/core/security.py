"""
core/security.py
----------------
All cryptographic and token helpers for TenderGuard.

Extracted from api/auth.py so any module can import them without
pulling in FastAPI route machinery → no circular-import risk.
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException

from app.core.config import settings


# ──────────────────────────────────────────────────────────────────────────────
# Password hashing  (PBKDF2-SHA256, Django-compatible format)
# ──────────────────────────────────────────────────────────────────────────────

_PBKDF2_ITERATIONS = 390_000


def hash_password(password: str) -> str:
    """Return a salted PBKDF2-SHA256 hash of *password*."""
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        _PBKDF2_ITERATIONS,
    )
    return f"pbkdf2_sha256${_PBKDF2_ITERATIONS}${salt}${dk.hex()}"


def verify_password(password: str, hashed: str) -> bool:
    """Return True if *password* matches *hashed*.

    Supports:
    * ``pbkdf2_sha256$…`` — production hash format
    * ``dev$<plaintext>``  — dev-only shortcut for seeded accounts
    """
    if hashed.startswith("dev$"):
        return hashed == f"dev${password}"
    if hashed.startswith("pbkdf2_sha256$"):
        try:
            _, iter_s, salt, digest = hashed.split("$", 3)
            dk = hashlib.pbkdf2_hmac(
                "sha256",
                password.encode("utf-8"),
                salt.encode("utf-8"),
                int(iter_s),
            )
            return secrets.compare_digest(digest, dk.hex())
        except Exception:
            return False
    return False


# ──────────────────────────────────────────────────────────────────────────────
# JWT helpers
# ──────────────────────────────────────────────────────────────────────────────

def create_access_token(user_id: int, email: str, role: str, minutes: int | None = None) -> str:
    """Create a signed JWT access token."""
    return _build_token(
        sub=str(user_id),
        email=email,
        role=role,
        token_type="access",
        minutes=minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES,
    )


def create_refresh_token(user_id: int, email: str, role: str) -> str:
    """Create a signed JWT refresh token (14-day lifetime)."""
    return _build_token(
        sub=str(user_id),
        email=email,
        role=role,
        token_type="refresh",
        minutes=60 * 24 * 14,
    )


def create_email_verify_token(user_id: int, email: str) -> str:
    """Create a short-lived JWT used for email address verification (15 min)."""
    return _build_token(
        sub=str(user_id),
        email=email,
        role="",
        token_type="email_verify",
        minutes=15,
    )


def decode_token(token: str, expected_type: str) -> dict:
    """Decode and validate a JWT, raising HTTP 401 on any failure."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc
    if payload.get("type") != expected_type:
        raise HTTPException(status_code=401, detail="Invalid token type")
    return payload


# ──────────────────────────────────────────────────────────────────────────────
# Internal
# ──────────────────────────────────────────────────────────────────────────────

def _build_token(*, sub: str, email: str, role: str, token_type: str, minutes: int) -> str:
    now = datetime.now(timezone.utc)
    payload: dict = {
        "sub": sub,
        "email": email,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=minutes)).timestamp()),
    }
    if role:
        payload["role"] = role
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")
