"""
Translation Service — Python backend utility wrapping the MyMemory Translation API.
Supports language detection, batch translation, fallback on error, and locale heuristics.
"""

import re
import logging
from typing import Optional
from functools import lru_cache

try:
    import requests as _requests_lib
except ImportError:
    _requests_lib = None  # type: ignore

logger = logging.getLogger(__name__)

MYMEMORY_URL = "https://api.mymemory.translated.net/get"
DEFAULT_TIMEOUT = 10  # seconds

# BCP-47 language tag regex
_LANG_TAG_RE = re.compile(r"^[a-zA-Z]{2,3}(?:-[a-zA-Z]{2,8})*$")

# Supported languages for translation
SUPPORTED_LANGUAGES = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "ru": "Russian",
    "zh": "Chinese",
    "ja": "Japanese",
    "ko": "Korean",
    "ar": "Arabic",
    "hi": "Hindi",
    "nl": "Dutch",
    "pl": "Polish",
    "tr": "Turkish",
}

# Unicode block ranges for locale detection heuristics
_LOCALE_RANGES = {
    "hi": (0x0900, 0x097F),   # Devanagari (Hindi, Marathi)
    "te": (0x0C00, 0x0C7F),   # Telugu
    "ta": (0x0B80, 0x0BFF),   # Tamil
    "kn": (0x0C80, 0x0CFF),   # Kannada
    "ml": (0x0D00, 0x0D7F),   # Malayalam
    "bn": (0x0980, 0x09FF),   # Bengali
    "ar": (0x0600, 0x06FF),   # Arabic
    "zh": (0x4E00, 0x9FFF),   # CJK Chinese
    "ja": (0x3040, 0x309F),   # Hiragana (Japanese)
    "ko": (0xAC00, 0xD7AF),   # Hangul (Korean)
    "ru": (0x0400, 0x04FF),   # Cyrillic (Russian)
    "el": (0x0370, 0x03FF),   # Greek
    "he": (0x0590, 0x05FF),   # Hebrew
    "th": (0x0E00, 0x0E7F),   # Thai
}

# Marathi shares Devanagari with Hindi; differentiate by word list heuristic
_MARATHI_WORDS = {"आहे", "नाही", "आणि", "हे", "या", "तो", "ती", "ते"}
_HINDI_WORDS = {"है", "नहीं", "और", "यह", "वह", "हम", "आप", "क्या"}


def detect_locale(text: str) -> tuple[str, float]:
    """
    Detect the locale/language of the input text using Unicode block heuristics.

    Returns:
        Tuple of (language_code, confidence) e.g. ("hi", 0.87)
        Falls back to ("en", 0.5) for ASCII/unknown text.
    """
    if not text or not text.strip():
        return ("en", 0.5)

    text_stripped = text.strip()
    total_chars = len([c for c in text_stripped if not c.isspace()])
    if total_chars == 0:
        return ("en", 0.5)

    counts: dict[str, int] = {}

    for ch in text_stripped:
        cp = ord(ch)
        for lang, (lo, hi) in _LOCALE_RANGES.items():
            if lo <= cp <= hi:
                counts[lang] = counts.get(lang, 0) + 1
                break

    if not counts:
        # Pure ASCII/Latin — assume English
        return ("en", 0.90)

    best_lang = max(counts, key=lambda k: counts[k])
    best_count = counts[best_lang]
    confidence = round(min(best_count / total_chars, 1.0), 4)

    # Differentiate Hindi vs Marathi for Devanagari text
    if best_lang == "hi":
        words = set(text_stripped.split())
        marathi_hits = len(words & _MARATHI_WORDS)
        hindi_hits = len(words & _HINDI_WORDS)
        if marathi_hits > hindi_hits:
            best_lang = "mr"

    return (best_lang, confidence)


def detect_language(text: str) -> Optional[str]:
    """Detect the language of the given text using langdetect."""
    try:
        from langdetect import detect
        if not text or len(text.strip()) < 3:
            return None
        lang = detect(text)
        return lang
    except Exception as e:
        logger.warning("Language detection failed: %s", e)
        return None


@lru_cache(maxsize=1)
def get_supported_languages() -> dict[str, str]:
    """Return supported languages for translation (cached)."""
    return SUPPORTED_LANGUAGES.copy()


def translate_text(
    text: str,
    target_lang: str = "en",
    source_lang: Optional[str] = None,
    timeout: int = DEFAULT_TIMEOUT,
) -> dict:
    """
    Translate text to target language.

    Args:
        text:        The text to translate.
        target_lang: Target language code (e.g. 'en', 'es').
        source_lang: Source language code (auto-detected if None).
        timeout:     HTTP request timeout in seconds.

    Returns:
        {
            "translated": str,
            "source_lang": str,
            "target_lang": str,
            "cached": bool,
        }
    """
    if not text or not text.strip():
        return {"translated": "", "source_lang": source_lang, "target_lang": target_lang, "cached": False}

    # Auto-detect language if not provided
    if not source_lang:
        detected_locale, _confidence = detect_locale(text)
        source_lang = detected_locale

    # Same-language passthrough
    if source_lang == target_lang:
        return {"translated": text, "source_lang": source_lang, "target_lang": target_lang, "cached": False}

    if _requests_lib is None:
        logger.warning("[TranslationService] 'requests' library not available; returning original text.")
        return {"translated": text, "source_lang": source_lang, "target_lang": target_lang, "cached": False}

    try:
        lang_pair = f"{source_lang}|{target_lang}"
        params = {"q": text, "langpair": lang_pair}
        response = _requests_lib.get(MYMEMORY_URL, params=params, timeout=timeout)

        if response.status_code == 429:
            logger.warning("[TranslationService] Rate limit (429) hit; returning original text.")
            return {"translated": text, "source_lang": source_lang, "target_lang": target_lang, "cached": False}

        response.raise_for_status()
        data = response.json()

        status = data.get("responseStatus")
        if status == 200:
            translated = data["responseData"]["translatedText"]
            return {
                "translated": translated,
                "source_lang": source_lang,
                "target_lang": target_lang,
                "cached": False,
            }

        # Non-200 API status
        details = data.get("responseDetails", "Unknown error")
        logger.warning("[TranslationService] API returned status %s: %s", status, details)
        return {"translated": text, "source_lang": source_lang, "target_lang": target_lang, "cached": False}

    except _requests_lib.exceptions.Timeout:
        logger.error("[TranslationService] Request timed out; returning original text.")
        return {"translated": text, "source_lang": source_lang, "target_lang": target_lang, "cached": False}
    except _requests_lib.exceptions.RequestException as exc:
        logger.error("[TranslationService] Network error: %s; returning original text.", exc)
        return {"translated": text, "source_lang": source_lang, "target_lang": target_lang, "cached": False}
    except (KeyError, ValueError, TypeError) as exc:
        logger.error("[TranslationService] Malformed response: %s; returning original text.", exc)
        return {"translated": text, "source_lang": source_lang, "target_lang": target_lang, "cached": False}


def batch_translate(
    texts: list[str],
    target_lang: str = "en",
    source_lang: Optional[str] = None,
    timeout: int = DEFAULT_TIMEOUT,
) -> list[dict]:
    """
    Translate a list of texts using translate_text for each entry.

    Args:
        texts:       List of strings to translate.
        target_lang: Target language code.
        source_lang: Source language code (auto-detected if None).
        timeout:     HTTP timeout per request.

    Returns:
        List of translation result dicts (same structure as translate_text).
    """
    results = []
    for text in texts:
        result = translate_text(text, target_lang=target_lang, source_lang=source_lang, timeout=timeout)
        results.append(result)
    return results


def translate_ticket(ticket_data: dict, target_lang: str = "en") -> dict:
    """
    Translate ticket content (subject, description, messages) to target language.

    Args:
        ticket_data: dict with 'subject', 'description', and optional 'messages'
        target_lang: target language code

    Returns:
        dict with translated fields and metadata
    """
    result = {
        "original_language": None,
        "target_language": target_lang,
        "translations": {},
    }

    # Translate subject
    if "subject" in ticket_data:
        subject_result = translate_text(ticket_data["subject"], target_lang=target_lang)
        result["translations"]["subject"] = subject_result
        if not result["original_language"]:
            result["original_language"] = subject_result["source_lang"]

    # Translate description
    if "description" in ticket_data:
        desc_result = translate_text(ticket_data["description"], target_lang=target_lang)
        result["translations"]["description"] = desc_result
        if not result["original_language"]:
            result["original_language"] = desc_result["source_lang"]

    # Translate messages
    if "messages" in ticket_data:
        translated_messages = []
        for msg in ticket_data["messages"]:
            body = msg.get("body", "") if isinstance(msg, dict) else ""
            msg_result = translate_text(body, target_lang=target_lang)
            translated_messages.append({
                "original": body,
                "translated": msg_result["translated"],
                "language": msg_result["source_lang"],
            })
        result["translations"]["messages"] = translated_messages

    return result


def clear_cache():
    """Clear the translation cache."""
    get_supported_languages.cache_clear()
