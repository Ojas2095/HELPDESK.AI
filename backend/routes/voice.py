"""
Voice-to-Ticket API Router

Provides endpoints for:
- POST /api/voice/transcribe  — Upload audio → get transcribed text
- POST /api/voice/create-ticket — Upload audio → transcribe → create ticket (full pipeline)
- GET  /api/voice/health       — Check if Whisper model is available

Issue #207: Voice-to-Ticket Feature
"""

import logging
import re
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voice", tags=["voice"])

# Maximum upload size: 25 MB
MAX_UPLOAD_SIZE = 25 * 1024 * 1024

# BCP-47 language tag pattern (e.g. "en", "zh", "fr-CA", "zh-Hans")
_BCP47_PATTERN = re.compile(
    r"^[a-zA-Z]{2,3}"           # ISO 639-1/2 primary language
    r"(?:-[a-zA-Z]{2,3})?"      # optional ISO 3166 region
    r"(?:-[a-zA-Z]{4})?"        # optional ISO 15924 script
    r"$"
)

# ---------------------------------------------------------------------------
# Response models (bug 5: no response_model → no OpenAPI schema/validation)
# ---------------------------------------------------------------------------

class VoiceTranscriptionData(BaseModel):
    """Transcription result data."""
    transcribed_text: str = ""
    detected_language: Optional[str] = None
    confidence: Optional[float] = None
    duration: Optional[float] = None


class VoiceTranscriptionResponse(BaseModel):
    """POST /api/voice/transcribe response."""
    transcribed_text: str = ""
    detected_language: Optional[str] = None
    confidence: Optional[float] = None
    duration: Optional[float] = None


class VoiceTicketResponse(BaseModel):
    """POST /api/voice/create-ticket response."""
    status: str = "success"
    transcription: Optional[VoiceTranscriptionData] = None
    transcribed_text: str = ""
    suggested_title: str = ""
    message: str = ""


class VoiceHealthResponse(BaseModel):
    """GET /api/voice/health response."""
    status: str = "ok"
    model_loaded: bool = False
    max_audio_size_mb: int = 25
    supported_formats: list[str] = Field(default_factory=lambda: [])


# ---------------------------------------------------------------------------
# Service imports (bug 4: deferred imports → top-level with graceful fallback)
# ---------------------------------------------------------------------------

_voice_service_available = True
try:
    from backend.services.voice_service import transcribe_audio_async  # noqa: F811
except ImportError:
    _voice_service_available = False
    transcribe_audio_async = None  # type: ignore


def _is_whisper_available() -> bool:
    """Check if the Whisper model is loaded (safe public-API check).

    Uses the service module's public interface rather than accessing
    private internals directly (bug 7: private _whisper_model access).
    """
    if not _voice_service_available:
        return False
    try:
        from backend.services import voice_service

        # Prefer a public check function if available
        if hasattr(voice_service, "is_model_loaded"):
            return voice_service.is_model_loaded()
        # Fallback: check if the public transcribe function is callable
        return callable(voice_service.transcribe_audio_async)
    except (ImportError, AttributeError):
        return False


# ---------------------------------------------------------------------------
# Helper: X-Request-ID propagation (bug 9)
# ---------------------------------------------------------------------------

def _request_id(req: Request) -> str:
    """Extract X-Request-ID from request headers for log correlation."""
    xid = req.headers.get("X-Request-ID", "")
    if not xid:
        xid = req.headers.get("x-request-id", "")
    return xid or "no-request-id"


# ---------------------------------------------------------------------------
# Helper: Validate audio upload content (bug 3: dedup copy-pasted validation)
# ---------------------------------------------------------------------------

def _validate_audio_upload(content: bytes) -> None:
    """Validate audio upload content: non-empty and within size limit."""
    if not content:
        raise HTTPException(status_code=400, detail="No audio data received.")
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Audio file too large. Max size: {MAX_UPLOAD_SIZE // (1024 * 1024)} MB.",
        )


# ---------------------------------------------------------------------------
# Helper: Validate BCP-47 language tag (bug 6)
# ---------------------------------------------------------------------------

def _validate_language_tag(language: Optional[str]) -> None:
    """Validate that a language tag conforms to BCP-47 format."""
    if language is None:
        return
    if not _BCP47_PATTERN.match(language):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid language code: '{language}'. Use BCP-47 format (e.g. 'en', 'zh', 'fr-CA').",
        )


# ---------------------------------------------------------------------------
# Helper: Extract title from text
# ---------------------------------------------------------------------------

def _extract_title(text: str, max_length: int = 80) -> str:
    """Generate a short title from transcribed text.

    Takes the first sentence or first N characters, whichever is shorter.
    """
    if not text:
        return "Voice Support Request"

    # Try to use the first sentence
    for delimiter in [". ", "! ", "? ", "\n"]:
        idx = text.find(delimiter)
        if 5 < idx <= max_length:
            return text[:idx].strip()

    # Fallback: truncate
    if len(text) <= max_length:
        return text.strip()
    return text[:max_length].rsplit(" ", 1)[0].strip() + "..."


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/transcribe", response_model=VoiceTranscriptionResponse)
async def transcribe_audio(
    req: Request,
    audio: UploadFile = File(...),
    language: Optional[str] = Form(None),
):
    """Transcribe an uploaded audio file into text.

    Accepts: webm, wav, mp3, ogg, m4a, flac
    Returns: transcribed text, detected language, confidence, duration
    """
    xid = _request_id(req)

    if not _voice_service_available:
        raise HTTPException(
            status_code=503,
            detail="Voice transcription service is not available.",
        )

    try:
        content = await audio.read()
        _validate_audio_upload(content)          # bug 3: deduped
        _validate_language_tag(language)         # bug 6: validate BCP-47

        result = await transcribe_audio_async(
            file_bytes=content,
            filename=audio.filename or "",
            language=language,
        )

        return result

    except ValueError as exc:
        # bug 1: don't leak internal error messages
        logger.warning(
            "[%s] /transcribe validation error: %s", xid, exc, exc_info=True
        )
        raise HTTPException(
            status_code=400,
            detail="Invalid audio format or unsupported file type.",
        )
    except RuntimeError as exc:
        # bug 2: RuntimeError as re → exc (avoids shadowing stdlib re)
        logger.error(
            "[%s] /transcribe processing error: %s", xid, exc, exc_info=True
        )
        raise HTTPException(
            status_code=500,
            detail="Audio processing failed. Please try again.",
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            "[%s] /transcribe unexpected error: %s", xid, exc, exc_info=True
        )
        raise HTTPException(
            status_code=500,
            detail="Voice transcription failed. Please try again later.",
        )


@router.post("/create-ticket", response_model=VoiceTicketResponse)
async def create_ticket_from_voice(
    req: Request,
    audio: UploadFile = File(...),
    user_id: Optional[str] = Form(None, max_length=100),     # bug 8: max_length
    company: Optional[str] = Form(None, max_length=100),     # bug 8: max_length
    language: Optional[str] = Form(None),
):
    """Full voice-to-ticket pipeline: transcribe audio → classify → return ticket draft.

    This endpoint combines speech recognition with the existing ticket analysis
    pipeline, returning a ready-to-review ticket object.
    """
    xid = _request_id(req)

    if not _voice_service_available:
        raise HTTPException(
            status_code=503,
            detail="Voice transcription service is not available.",
        )

    try:
        content = await audio.read()
        _validate_audio_upload(content)          # bug 3: deduped
        _validate_language_tag(language)         # bug 6: validate BCP-47

        # Step 1: Transcribe audio
        transcription = await transcribe_audio_async(
            file_bytes=content,
            filename=audio.filename or "",
            language=language,
        )

        transcribed_text = transcription.get("transcribed_text", "")

        if not transcribed_text:
            return VoiceTicketResponse(
                status="no_speech_detected",
                message="No speech was detected in the audio. Please try again.",
                transcription=VoiceTranscriptionData(**transcription)
                if transcription
                else None,
            )

        # Step 2: Return the transcribed text for the frontend to submit
        # through the normal ticket creation flow (preserves all existing
        # classification, duplicate detection, and AI analysis).
        return VoiceTicketResponse(
            status="success",
            transcription=VoiceTranscriptionData(**transcription),
            transcribed_text=transcribed_text,
            suggested_title=_extract_title(transcribed_text),
            message="Voice transcribed successfully. Review and submit as a ticket.",
        )

    except ValueError as exc:
        # bug 1: don't leak internal error messages
        logger.warning(
            "[%s] /create-ticket validation error: %s", xid, exc, exc_info=True
        )
        raise HTTPException(
            status_code=400,
            detail="Invalid audio format or unsupported file type.",
        )
    except RuntimeError as exc:
        # bug 2: RuntimeError as re → exc (avoids shadowing stdlib re)
        logger.error(
            "[%s] /create-ticket processing error: %s", xid, exc, exc_info=True
        )
        raise HTTPException(
            status_code=500,
            detail="Audio processing failed. Please try again.",
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            "[%s] /create-ticket unexpected error: %s", xid, exc, exc_info=True
        )
        raise HTTPException(
            status_code=500,
            detail="Voice-to-ticket processing failed. Please try again later.",
        )


@router.get("/health", response_model=VoiceHealthResponse)
async def voice_health():
    """Check if the voice transcription service is available."""
    model_loaded = _is_whisper_available()  # bug 7: safe public-access check

    return VoiceHealthResponse(
        status="ok" if model_loaded else "unavailable",
        model_loaded=model_loaded,
        max_audio_size_mb=MAX_UPLOAD_SIZE // (1024 * 1024),
        supported_formats=["webm", "wav", "mp3", "ogg", "m4a", "flac"],
    )
