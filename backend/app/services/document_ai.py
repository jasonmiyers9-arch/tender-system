from __future__ import annotations

import logging

from app.core.config import settings

LOGGER = logging.getLogger(__name__)


def enqueue_document_ai_processing(document_id: int, storage_key: str, company_id: int) -> None:
    """Stub hook for document intelligence processing on upload.

    This is intentionally non-blocking in the upload request lifecycle. It is
    the earliest integration point for AI pipeline work such as extraction,
    embeddings, or verification helper tasks.
    """
    if not settings.DOCUMENT_AI_ENABLED:
        LOGGER.info(
            "Document AI pipeline disabled; skipping asynchronous analysis for document=%s",
            document_id,
        )
        return

    LOGGER.info(
        "Document AI pipeline scheduled for document=%s company_id=%s storage_key=%s",
        document_id,
        company_id,
        storage_key,
    )
    # TODO: push this document into an actual AI processing queue or service.
