"""Backward-compatibility shim.

All real logic has moved to ``app.services.expiry_service``.
Existing imports like ``from app.services.expiry_notifications import ...`` continue to work.
"""
from app.services.expiry_service import (  # noqa: F401
    CHECK_INTERVAL_SECONDS,
    LOCAL_TZ,
    REMINDER_WINDOWS,
    expiry_notification_loop,
    run_expiry_notification_scan,
)
