"""
Translation API Routes — Multi-Language Ticket Support
"""

import logging
import re
from functools import lru_cache
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator

from backend.services.translation_service import (
    detect_language,
    get_supported_languages,
    translate_text,
    translate_ticket,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/translation", tags=["translation"])

# BCP-47 language tag pattern: "en", "en-US", "zh-Hant", etc.
_LANG_TAG_RE = re.compile(r"^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$")


# ─── Shared validator ─────────────────────────────────────────────────────────

def _validate_lang_tag(value: Optional[str]) -> Optional[str]:
    """
    Reject language codes that are syntactically invalid BCP-47 tags.
    Previously only max_length=5 was enforced, so codes like 'xy99' passed.
    """
    if value is None:
        return value
    if not _LANG_TAG_RE.match(value):
        raise ValueError(
            f"'{value}' is not a valid BCP-47 language tag (e.g. 'en', 'en-US')."
        )
    return value.lower()


# ─── Schemas — request ────────────────────────────────────────────────────────

class TranslateTextRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    target_lang: str = Field(default="en", max_length=10)
    source_lang: Optional[str] = Field(default=None, max_length=10)

    @field_validator("target_lang", "source_lang", mode="before")
    @classmethod
    def validate_lang(cls, v: Optional[str]) -> Optional[str]:
        return _validate_lang_tag(v)


class MessageSchema(BaseModel):
    """Typed shape for ticket messages — replaces bare dict."""
    id: Optional[str] = None
    body: str = Field(..., min_length=1)
    author: Optional[str] = None


class TranslateTicketRequest(BaseModel):
    subject: Optional[str] = Field(default=None, max_length=500)
    description: Optional[str] = Field(default=None, max_length=20000)
    messages: Optional[list[MessageSchema]] = None
    target_lang: str = Field(default="en", max_length=10)

    @field_validator("target_lang", mode="before")
    @classmethod
    def validate_lang(cls, v: str) -> str:
        return _validate_lang_tag(v)  # type: ignore[return-value]

    @model_validator(mode="after")
    def require_at_least_one_field(self) -> "TranslateTicketRequest":
        """
        Reject requests where every translatable field is None/empty.
        Previously an all-None body would silently call translate_ticket({})
        and return success:True with nothing translated.
        """
        if not any([self.subject, self.description, self.messages]):
            raise ValueError(
                "At least one of 'subject', 'description', or 'messages' must be provided."
            )
        return self


class DetectLanguageRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)


# ─── Schemas — response ───────────────────────────────────────────────────────

class TranslateTextResponse(BaseModel):
    success: bool
    data: Any


class TranslateTicketResponse(BaseModel):
    success: bool
    data: Any


class DetectLanguageData(BaseModel):
    language: str
    language_name: str
    supported: bool


class DetectLanguageResponse(BaseModel):
    success: bool
    data: DetectLanguageData


class LanguagesResponse(BaseModel):
    success: bool
    data: dict[str, str]


# ─── Cached language list ─────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _cached_supported_languages() -> dict[str, str]:
    """
    Cache the supported-languages mapping for the lifetime of the process.
    Previously get_supported_languages() was called on every /detect request
    with no caching, causing a redundant service call per detection.
    """
    return get_supported_languages()


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/translate", response_model=TranslateTextResponse)
async def translate(request: TranslateTextRequest) -> TranslateTextResponse:
    """Translate text to target language with auto-detection."""
    logger.info(
        "translate: target=%s source=%s length=%d",
        request.target_lang,
        request.source_lang,
        len(request.text),
    )
    try:
        result = translate_text(
            text=request.text,
            target_lang=request.target_lang,
            source_lang=request.source_lang,
        )
        return TranslateTextResponse(success=True, data=result)
    except HTTPException:
        raise
    except Exception as e:
        # Log the full exception internally; return a safe message to the client
        # to avoid leaking internal details via str(e).
        logger.exception("translate: unexpected error for target=%s", request.target_lang)
        raise HTTPException(status_code=500, detail="Translation failed. Please try again.")


@router.post("/translate-ticket", response_model=TranslateTicketResponse)
async def translate_ticket_endpoint(request: TranslateTicketRequest) -> TranslateTicketResponse:
    """Translate entire ticket content to target language."""
    logger.info(
        "translate-ticket: target=%s fields=%s",
        request.target_lang,
        [f for f in ("subject", "description", "messages") if getattr(request, f)],
    )
    try:
        ticket_data: dict[str, Any] = {}
        if request.subject:
            ticket_data["subject"] = request.subject
        if request.description:
            ticket_data["description"] = request.description
        if request.messages:
            ticket_data["messages"] = [m.model_dump(exclude_none=True) for m in request.messages]

        result = translate_ticket(ticket_data, target_lang=request.target_lang)
        return TranslateTicketResponse(success=True, data=result)
    except HTTPException:
        raise
    except Exception:
        logger.exception(
            "translate-ticket: unexpected error for target=%s", request.target_lang
        )
        raise HTTPException(status_code=500, detail="Ticket translation failed. Please try again.")


@router.post("/detect", response_model=DetectLanguageResponse)
async def detect(request: DetectLanguageRequest) -> DetectLanguageResponse:
    """Detect the language of the given text."""
    logger.info("detect: text_length=%d", len(request.text))
    lang = detect_language(request.text)
    if not lang:
        raise HTTPException(status_code=400, detail="Could not detect language.")
    languages = _cached_supported_languages()
    return DetectLanguageResponse(
        success=True,
        data=DetectLanguageData(
            language=lang,
            language_name=languages.get(lang, "Unknown"),
            supported=lang in languages,
        ),
    )


@router.get("/languages", response_model=LanguagesResponse)
async def list_languages() -> LanguagesResponse:
    """List all supported languages for translation."""
    return LanguagesResponse(success=True, data=_cached_supported_languages())