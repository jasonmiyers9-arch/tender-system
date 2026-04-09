from __future__ import annotations

import io
import json
import logging
from datetime import datetime
from pathlib import Path

from app.core.config import settings

LOGGER = logging.getLogger(__name__)

_GEMINI_PROMPT = """You are analyzing a South African government compliance document.
Analyze the following extracted text and return ONLY a valid JSON object with no markdown formatting:
{{
  "documentType": one of ["tax","bbbee","registration","legal","financial","certification","insurance","cidb"] or null,
  "expiryDate": "YYYY-MM-DD" string or null,
  "confidence": number between 0 and 1,
  "summary": "one sentence description of the document"
}}

Document text:
{text}"""


def _extract_pdf_text(file_bytes: bytes) -> str:
    """Extract plain text from a PDF using pypdf."""
    try:
        import pypdf  # type: ignore

        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception as exc:
        LOGGER.warning("pypdf text extraction failed: %s", exc)
        return ""


def _call_gemini(text: str) -> dict:
    """Send document text to Gemini 1.5 Flash and parse the JSON response."""
    import google.generativeai as genai  # type: ignore

    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-1.5-flash")
    prompt = _GEMINI_PROMPT.format(text=text[:8000])
    response = model.generate_content(prompt)
    raw = response.text.strip()
    # Strip markdown code fences if the model includes them
    raw = raw.lstrip("```json").lstrip("```").rstrip("```").strip()
    return json.loads(raw)


async def enqueue_document_ai_processing(
    document_id: int, storage_key: str, company_id: int
) -> None:
    """Analyse an uploaded document with Gemini and update the DB record.

    Runs in a FastAPI BackgroundTask — all errors are caught and logged so they
    never surface to the HTTP caller.
    """
    if not settings.DOCUMENT_AI_ENABLED or not settings.GEMINI_API_KEY:
        LOGGER.info(
            "Document AI disabled or key missing; skipping document=%s", document_id
        )
        return

    LOGGER.info(
        "AI processing started: document=%s storage_key=%s company_id=%s",
        document_id,
        storage_key,
        company_id,
    )

    # Locate the file on disk
    file_path = Path(settings.STORAGE_DIR) / storage_key
    if not file_path.exists():
        LOGGER.warning("File not found for AI processing: %s", file_path)
        return

    ext = file_path.suffix.lower()
    if ext != ".pdf":
        LOGGER.info(
            "Skipping non-PDF document=%s (ext=%s) — only PDFs are analysed",
            document_id,
            ext,
        )
        return

    file_bytes = file_path.read_bytes()
    text = _extract_pdf_text(file_bytes)

    if len(text.strip()) < 20:
        LOGGER.info(
            "Too little text extracted from document=%s (chars=%d), skipping AI",
            document_id,
            len(text.strip()),
        )
        return

    try:
        ai_result = _call_gemini(text)
    except Exception as exc:
        LOGGER.error(
            "Gemini call failed for document=%s: %s", document_id, exc
        )
        return

    LOGGER.info("AI result for document=%s: %s", document_id, ai_result)

    expiry_str: str | None = ai_result.get("expiryDate")
    detected_category: str | None = ai_result.get("documentType")

    if not expiry_str and not detected_category:
        return

    # Persist AI findings back to the DB
    try:
        from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
        from app.models.document import ComplianceDocument

        engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI)
        async with AsyncSession(engine) as session:
            doc = await session.get(ComplianceDocument, document_id)
            if doc:
                if expiry_str and doc.expiry_date is None:
                    try:
                        doc.expiry_date = datetime.fromisoformat(expiry_str)
                        LOGGER.info(
                            "Auto-filled expiry_date=%s for document=%s",
                            expiry_str,
                            document_id,
                        )
                    except ValueError:
                        LOGGER.warning(
                            "Gemini returned unparseable date '%s' for document=%s",
                            expiry_str,
                            document_id,
                        )
                if detected_category and detected_category != doc.category:
                    # Log for audit — do not overwrite, the user chose the category
                    LOGGER.info(
                        "AI suggests category=%s but stored=%s for document=%s (not overwriting)",
                        detected_category,
                        doc.category,
                        document_id,
                    )
                await session.commit()
        await engine.dispose()
    except Exception as exc:
        LOGGER.error(
            "DB update after AI analysis failed for document=%s: %s", document_id, exc
        )
