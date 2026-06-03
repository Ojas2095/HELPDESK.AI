"""
Translation API Routes — Multi-Language Ticket Support
"""

import logging
import re
import uuid
from functools import lru_cache
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator, model_validator

from backend.services.translation_service import (
    detect_language,
    get_supported_languages,
    translate_text,
    translate_ticket,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/translation", tags=["translation"])

# BCP-47 language tag regex (covers "en", "en-US", "zh-Hant", "pt-BR", "zh-419", etc.)
_LANG_TAG_RE = re.compile(r"^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$")


# ------------------------------------------------------------------
# Shared validator (extracted from duplicate class validators)
# ------------------------------------------------------------------
def _validate_lang_tag(cls, v: Optional[str]) -> Optional[str]:
    """Shared BCP-47 language tag validator used by both request models."""
    if v is None:
        return v
    if not _LANG_TAG_RE.match(v):
        raise ValueError(
            f"Invalid BCP-47 language tag: '{v}'. "
            "Expected format like 'en', 'en-US', 'zh-Hant', or 'zh-419'."
        )
    return v


# ------------------------------------------------------------------
# Request ID helper
# ------------------------------------------------------------------
def _request_id(req: Request) -> str:
    """Read X-Request-ID header or generate a UUID for tracing."""
    x_request_id = req.headers.get("X-Request-ID", "")
    return x_request_id or str(uuid.uuid4())


# ------------------------------------------------------------------
# Request Models
# ------------------------------------------------------------------

class TranslateTextRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    target_lang: str = Field(default="en", max_length=10)
    source_lang: Optional[str] = Field(default=None, max_length=10)

    @field_validator("target_lang", "source_lang", mode="before")
    @classmethod
    def validate_lang_tag(cls, v: Optional[str]) -> Optional[str]:
        return _validate_lang_tag(cls, v)


class MessageSchema(BaseModel):
    """Structured schema for ticket messages."""
    id: Optional[str] = None
    body: str = Field(..., min_length=1, max_length=10000)
    author: Optional[str] = None


class TranslateTicketRequest(BaseModel):
    subject: Optional[str] = Field(default=None, max_length=500)
    description: Optional[str] = Field(default=None, max_length=20000)
    messages: Optional[list[MessageSchema]] = None
    target_lang: str = Field(default="en", max_length=10)

    @field_validator("target_lang", mode="before")
    @classmethod
    def validate_lang_tag(cls, v: str) -> str:
        result = _validate_lang_tag(cls, v)
        return v if result is None else result

    @model_validator(mode="after")
    def require_translatable_content(self):
        """Reject requests where all translatable fields are None/empty (after stripping)."""
        # Fix: strip whitespace before checking emptiness
        if self.subject is not None:
            stripped = self.subject.strip()
            self.subject = stripped if stripped else None
        if self.description is not None:
            stripped = self.description.strip()
            self.description = stripped if stripped else None

        has_subject = self.subject is not None and len(self.subject) > 0
        has_description = self.description is not None and len(self.description) > 0
        has_messages = self.messages is not None and len(self.messages) > 0
        if not (has_subject or has_description or has_messages):
            raise ValueError(
                "At least one of 'subject', 'description', or 'messages' must be provided."
            )
        return self


class DetectLanguageRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)


# ------------------------------------------------------------------
# Response Models
# ------------------------------------------------------------------

class TranslationData(BaseModel):
    translated: str
    source_lang: Optional[str] = None
    target_lang: str
    cached: bool = False


class TranslateResponse(BaseModel):
    success: bool
    data: TranslationData


class TicketTranslationData(BaseModel):
    """Response schema for /translate-ticket endpoint."""
    subject: Optional[str] = None
    description: Optional[str] = None
    messages: Optional[list[dict]] = None
    target_lang: str


class TranslateTicketResponse(BaseModel):
    success: bool
    data: TicketTranslationData


class DetectData(BaseModel):
    language: Optional[str]
    language_name: str
    supported: bool


class DetectResponse(BaseModel):
    success: bool
    data: DetectData


class LanguagesResponse(BaseModel):
    success: bool
    data: dict[str, str]


# ------------------------------------------------------------------
# Cached wrapper for supported languages
# ------------------------------------------------------------------

@lru_cache(maxsize=1)
def _cached_supported_languages() -> dict[str, str]:
    """Cache supported languages to avoid repeated calls."""
    return get_supported_languages()


# ------------------------------------------------------------------
# Routes
# ------------------------------------------------------------------

@router.post("/translate", response_model=TranslateResponse)
async def translate(request: TranslateTextRequest, req: Request):
    """Translate text to target language with auto-detection."""
    rid = _request_id(req)
    logger.info(
        "[%s] translate: text_len=%d, target=%s, source=%s",
        rid, len(request.text), request.target_lang, request.source_lang,
    )
    try:
        result = translate_text(
            text=request.text,
            target_lang=request.target_lang,
            source_lang=request.source_lang,
        )
        return {"success": True, "data": result}
    except Exception:
        logger.exception("[%s] Translation failed for text_len=%d", rid, len(request.text))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Translation service temporarily unavailable. Please try again later.",
        )


@router.post("/translate-ticket", response_model=TranslateTicketResponse)
async def translate_ticket_endpoint(request: TranslateTicketRequest, req: Request):
    """Translate entire ticket content to target language."""
    rid = _request_id(req)
    logger.info(
        "[%s] translate_ticket: target=%s, has_subject=%s, has_desc=%s, msg_count=%d",
        rid,
        request.target_lang,
        request.subject is not None,
        request.description is not None,
        len(request.messages) if request.messages else 0,
    )
    try:
        ticket_data: dict[str, Any] = {}
        if request.subject:
            ticket_data["subject"] = request.subject
        if request.description:
            ticket_data["description"] = request.description
        if request.messages:
            # Fix: exclude_none to avoid forwarding null id/author
            ticket_data["messages"] = [m.model_dump(exclude_none=True) for m in request.messages]

        result = translate_ticket(ticket_data, target_lang=request.target_lang)
        return {"success": True, "data": result}
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception:
        logger.exception("[%s] Ticket translation failed", rid)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ticket translation service temporarily unavailable. Please try again later.",
        )


@router.post("/detect", response_model=DetectResponse)
async def detect(request: DetectLanguageRequest, req: Request):
    """Detect the language of the given text."""
    rid = _request_id(req)
    logger.info("[%s] detect: text_len=%d", rid, len(request.text))
    lang = detect_language(request.text)
    if not lang:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not detect language from the provided text.",
        )
    languages = _cached_supported_languages()
    return {
        "success": True,
        "data": {
            "language": lang,
            "language_name": languages.get(lang, "Unknown"),
            "supported": lang in languages,
        },
    }


@router.get("/languages", response_model=LanguagesResponse)
async def list_languages(req: Request):
    """List supported languages for translation."""
    rid = _request_id(req)
    logger.info("[%s] languages: listing supported languages", rid)
    return {"success": True, "data": _cached_supported_languages()}
