from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

from app.core.config import settings

LOGGER = logging.getLogger(__name__)

try:
    import firebase_admin
    from firebase_admin import credentials, storage
except ImportError:  # pragma: no cover
    firebase_admin = None  # type: ignore[misc]
    credentials = None  # type: ignore[misc]
    storage = None  # type: ignore[misc]

_firebase_app: Any | None = None


def _normalize_private_key(raw_key: str) -> str:
    return raw_key.replace("\\n", "\n").strip()


def is_firebase_storage_configured() -> bool:
    if not (
        settings.FIREBASE_PROJECT_ID
        and settings.FIREBASE_CLIENT_EMAIL
        and settings.FIREBASE_PRIVATE_KEY
        and settings.FIREBASE_STORAGE_BUCKET
    ):
        return False
    if firebase_admin is None or credentials is None or storage is None:
        LOGGER.warning("firebase-admin package is not installed; falling back to local storage")
        return False
    try:
        return get_storage_bucket() is not None
    except Exception as exc:  # pragma: no cover
        LOGGER.warning("Firebase storage initialization failed: %s", exc)
        return False


def _build_service_account_info() -> dict[str, str]:
    return {
        "type": "service_account",
        "project_id": settings.FIREBASE_PROJECT_ID,
        "private_key_id": settings.FIREBASE_PRIVATE_KEY_ID,
        "private_key": _normalize_private_key(settings.FIREBASE_PRIVATE_KEY),
        "client_email": settings.FIREBASE_CLIENT_EMAIL,
        "client_id": settings.FIREBASE_CLIENT_ID,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{settings.FIREBASE_CLIENT_EMAIL.replace('@', '%40')}",
    }


def _ensure_firebase_app() -> Any:
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app
    if firebase_admin is None or credentials is None or storage is None:
        raise RuntimeError("firebase-admin is not installed")
    if not settings.FIREBASE_PROJECT_ID:
        raise RuntimeError("FIREBASE_PROJECT_ID is not configured")
    if not settings.FIREBASE_STORAGE_BUCKET:
        raise RuntimeError("FIREBASE_STORAGE_BUCKET is not configured")

    app_name = None
    if firebase_admin._apps:
        app_name = next(iter(firebase_admin._apps))

    if app_name is None:
        service_account_info = _build_service_account_info()
        cred = credentials.Certificate(service_account_info)
        _firebase_app = firebase_admin.initialize_app(
            cred,
            {"storageBucket": settings.FIREBASE_STORAGE_BUCKET},
        )
    else:
        _firebase_app = firebase_admin.get_app(app_name)
    return _firebase_app


def get_storage_bucket() -> Any:
    firebase_app = _ensure_firebase_app()
    if storage is None:
        raise RuntimeError("firebase-admin storage module is unavailable")
    return storage.bucket(app=firebase_app)


def upload_document_to_firebase(blob_name: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    bucket = get_storage_bucket()
    blob = bucket.blob(blob_name)
    blob.upload_from_string(data, content_type=content_type)
    return blob.name


def generate_firebase_signed_download_url(blob_name: str, expiration_seconds: int = 900) -> str:
    bucket = get_storage_bucket()
    blob = bucket.blob(blob_name)
    if not blob.exists():
        raise FileNotFoundError("Storage blob not found")
    return blob.generate_signed_url(expiration=timedelta(seconds=expiration_seconds), version="v4")
