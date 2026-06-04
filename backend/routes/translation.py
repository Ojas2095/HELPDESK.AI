"""
Translation API Routes — Multi-Language Ticket Support
"""

import logging
import re
from functools import lru_cache

from fastapi import APIRouter, HTTPException, status, Request
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, Any
from backend.services.rate_limit_config import limiter



from backend.services.translation_service import (
    detect_language,
    get_supported_languages,
    translate_text,
    translate_ticket,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/translation", tags=["translation"])

# BCP-47 language tag regex (covers "en", "en-US", "zh-Hant", "pt-BR", etc.)
_LANG_TAG_RE = re.compile(r"^[a-zA-Z]{2,3}(?:-[a-zA-Z]{2,8})*$")


class TranslateTextRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    target_lang: str = Field(default="en", max_length=10)
    source_lang: Optional[str] = Field(default=None, max_length=10)

    @field_validator("target_lang", "source_lang", mode="before")
    @classmethod
    def validate_lang_tag(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not _LANG_TAG_RE.match(v):
            raise ValueError(
                f"Invalid BCP-47 language tag: '{v}'. "
                "Expected format like 'en', 'en-US', or 'zh-Hant'."
            )
        return v


class MessageSchema(BaseModel):
    """Structured schema for ticket messages."""
    id: Optional[str] = None
    body: str = Field(..., min_length=1, max_length=10000)
    author: Optional[str] = None


class TranslateTicketRequest(BaseModel):
    subject: Optional[str] = None
    description: Optional[str] = None
    messages: Optional[list[MessageSchema]] = None
    target_lang: str = Field(default="en", max_length=10)

    @field_validator("target_lang", mode="before")
    @classmethod
    def validate_lang_tag(cls, v: str) -> str:
        if not _LANG_TAG_RE.match(v):
            raise ValueError(
                f"Invalid BCP-47 language tag: '{v}'. "
                "Expected format like 'en', 'en-US', or 'zh-Hant'."
            )
        return v

    @model_validator(mode="after")
    def require_translatable_content(self):
        """Reject requests where all translatable fields are None/empty."""
        has_subject = self.subject is not None and self.subject.strip()
        has_description = self.description is not None and self.description.strip()
        has_messages = self.messages is not None and len(self.messages) > 0
        if not (has_subject or has_description or has_messages):
            raise ValueError(
                "At least one of 'subject', 'description', or 'messages' must be provided."
            )
        return self


class DetectLanguageRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)


# --- Response Models ---

class TranslationData(BaseModel):
    translated: str
    source_lang: Optional[str] = None
    target_lang: Optional[str] = "en"
    cached: bool = False


class TranslateResponse(BaseModel):
    success: bool
    data: TranslationData


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


# --- Cached wrapper for supported languages ---

@lru_cache(maxsize=1)
def _cached_supported_languages() -> dict[str, str]:
    """Cache supported languages to avoid repeated calls."""
    return get_supported_languages()


@router.post("/translate", response_model=TranslateResponse)
@limiter.limit("20/minute")
async def translate(request: Request, body: TranslateTextRequest):
    """Translate text to target language with auto-detection."""
    logger.info(
        "translate: text_len=%d, target=%s, source=%s",
        len(body.text), body.target_lang, body.source_lang,
    )
    try:
        result = translate_text(
            text=body.text,
            target_lang=body.target_lang,
            source_lang=body.source_lang,
        )
        return {"success": True, "data": result}
    except Exception:
        logger.exception("Translation failed for text_len=%d", len(body.text))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Translation service temporarily unavailable. Please try again later.",
        )


@router.post("/translate-ticket")
@limiter.limit("20/minute")
async def translate_ticket_endpoint(request: Request, body: TranslateTicketRequest):
    """Translate entire ticket content to target language."""
    logger.info(
        "translate_ticket: target=%s, has_subject=%s, has_desc=%s, msg_count=%d",
        body.target_lang,
        body.subject is not None,
        body.description is not None,
        len(body.messages) if body.messages else 0,
    )
    try:
        ticket_data: dict[str, Any] = {}
        if body.subject:
            ticket_data["subject"] = body.subject
        if body.description:
            ticket_data["description"] = body.description
        if body.messages:
            ticket_data["messages"] = [m.model_dump() for m in body.messages]

        result = translate_ticket(ticket_data, target_lang=body.target_lang)
        return {"success": True, "data": result}
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception:
        logger.exception("Ticket translation failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ticket translation service temporarily unavailable. Please try again later.",
        )


@router.post("/detect", response_model=DetectResponse)
@limiter.limit("30/minute")
async def detect(request: Request, body: DetectLanguageRequest):
    """Detect the language of the given text."""
    logger.info("detect: text_len=%d", len(body.text))
    lang = detect_language(body.text)
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
@limiter.limit("60/minute")
async def list_languages(request: Request):
    """List supported languages for translation."""
    return {"success": True, "data": _cached_supported_languages()}
