"""Email delivery helpers (SendGrid).

All functions are fire-and-forget: they catch exceptions so callers are never
blocked by email provider failures.
"""
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger("tenderguard.email_service")


async def send_verification_email(email: str, verify_link: str) -> None:
    """Send an email-verification link via SendGrid.

    No-ops silently when ``SENDGRID_API_KEY`` is not configured.
    """
    if not settings.SENDGRID_API_KEY:
        return
    payload = {
        "personalizations": [{"to": [{"email": email}]}],
        "from": {"email": settings.SENDGRID_FROM_EMAIL},
        "subject": "Verify your TenderGuard account",
        "content": [
            {
                "type": "text/plain",
                "value": f"Verify your email within 15 minutes: {verify_link}",
            }
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                json=payload,
                headers={"Authorization": f"Bearer {settings.SENDGRID_API_KEY}"},
            )
    except Exception:
        logger.warning("send_verification_email_failed email=%s", email)


async def send_password_reset_email(email: str, reset_link: str) -> None:
    """Send a password-reset link via SendGrid.

    No-ops silently when ``SENDGRID_API_KEY`` is not configured.
    """
    if not settings.SENDGRID_API_KEY:
        return
    payload = {
        "personalizations": [{"to": [{"email": email}]}],
        "from": {"email": settings.SENDGRID_FROM_EMAIL},
        "subject": "Reset your TenderGuard password",
        "content": [
            {
                "type": "text/plain",
                "value": f"Reset your password within 1 hour: {reset_link}",
            }
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                json=payload,
                headers={"Authorization": f"Bearer {settings.SENDGRID_API_KEY}"},
            )
    except Exception:
        logger.warning("send_password_reset_email_failed email=%s", email)
