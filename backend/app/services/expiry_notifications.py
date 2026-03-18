import asyncio
import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import Date, cast, select

from app.db.session import AsyncSessionLocal
from app.models.domain import ComplianceDocument, Notification

logger = logging.getLogger("tenderguard.expiry_notifications")

REMINDER_WINDOWS = {30, 14, 7, 5, 1}
CHECK_INTERVAL_SECONDS = 60 * 60 * 24  # daily
LOCAL_TZ = timezone(timedelta(hours=2))  # Africa/Johannesburg


def _today_local() -> date:
    return datetime.now(LOCAL_TZ).date()


async def _notification_exists(db, *, company_id: int, document_id: int, alert_type: str, trigger_date: date) -> bool:
    existing = await db.scalar(
        select(Notification.id).where(
            Notification.company_id == company_id,
            Notification.document_id == document_id,
            Notification.alert_type == alert_type,
            Notification.trigger_date == trigger_date,
        )
    )
    return bool(existing)


async def run_expiry_notification_scan() -> int:
    today = _today_local()
    created = 0

    async with AsyncSessionLocal() as db:
        docs = (
            await db.scalars(
                select(ComplianceDocument).where(
                    ComplianceDocument.expiry_date.is_not(None),
                    ComplianceDocument.status.in_(["uploaded", "verified", "expired"]),
                    cast(ComplianceDocument.expiry_date, Date) <= today + timedelta(days=max(REMINDER_WINDOWS)),
                )
            )
        ).all()

        for doc in docs:
            expiry_day = doc.expiry_date.astimezone(LOCAL_TZ).date() if doc.expiry_date else today
            days_left = (expiry_day - today).days

            # Auto-mark expired documents
            if days_left < 0 and (doc.status.value if hasattr(doc.status, "value") else str(doc.status)) != "expired":
                doc.status = "expired"

            # Reminder windows: 30/14/7/5/1 days before expiry
            if days_left in REMINDER_WINDOWS:
                alert_type = f"expiry_{days_left}_day"
                if not await _notification_exists(
                    db,
                    company_id=doc.company_id,
                    document_id=doc.id,
                    alert_type=alert_type,
                    trigger_date=today,
                ):
                    db.add(
                        Notification(
                            company_id=doc.company_id,
                            document_id=doc.id,
                            alert_type=alert_type,
                            title=f"Document Expiring in {days_left} Day(s)",
                            message=f"{doc.filename} expires in {days_left} day(s) on {expiry_day.isoformat()}. Please renew before deadline.",
                            trigger_date=today,
                        )
                    )
                    created += 1

            # Escalation on expiry day and after expiry
            if days_left <= 0:
                escalation_type = "expiry_escalation"
                if not await _notification_exists(
                    db,
                    company_id=doc.company_id,
                    document_id=doc.id,
                    alert_type=escalation_type,
                    trigger_date=today,
                ):
                    title = "Document Expires Today" if days_left == 0 else "Document Expired"
                    status_text = "expires today" if days_left == 0 else "is already expired"
                    db.add(
                        Notification(
                            company_id=doc.company_id,
                            document_id=doc.id,
                            alert_type=escalation_type,
                            title=title,
                            message=f"Urgent: {doc.filename} {status_text} (expiry date: {expiry_day.isoformat()}). Immediate action required.",
                            trigger_date=today,
                        )
                    )
                    created += 1

        await db.commit()

    if created:
        logger.info("expiry_notification_scan_created %s notifications", created)
    return created


async def expiry_notification_loop() -> None:
    while True:
        try:
            await run_expiry_notification_scan()
        except Exception:
            logger.exception("expiry_notification_scan_failed")
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
