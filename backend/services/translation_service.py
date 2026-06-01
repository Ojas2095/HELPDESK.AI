"""
Translation Service — Python backend utility wrapping the MyMemory Translation API.
Supports language detection, batch translation, fallback on error, and locale heuristics.
"""

import re
import logging
from typing import Optional

try:
    import requests as _requests_lib
except ImportError:
    _requests_lib = None  # type: ignore

logger = logging.getLogger(__name__)

MYMEMORY_URL = "https://api.mymemory.translated.net/get"
DEFAULT_TIMEOUT = 10  # seconds

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


def translate_text(
    text: str,
    from_lang: str = "en",
    to_lang: str = "en",
    timeout: int = DEFAULT_TIMEOUT,
) -> dict:
    """
    Translate text using the MyMemory API.

    Args:
        text:      The text to translate.
        from_lang: Source language code (e.g. 'hi').
        to_lang:   Target language code (e.g. 'en').
        timeout:   HTTP request timeout in seconds.

    Returns:
        {
            "translated": str,
            "detected_locale": str,
            "confidence": float,
            "source": "mymemory" | "passthrough" | "fallback",
        }
    """
    if not text or not text.strip():
        detected_locale, confidence = detect_locale(text or "")
        return {
            "translated": text or "",
            "detected_locale": detected_locale,
            "confidence": confidence,
            "source": "passthrough",
        }

    # Same-language passthrough
    if from_lang == to_lang:
        detected_locale, confidence = detect_locale(text)
        return {
            "translated": text,
            "detected_locale": detected_locale,
            "confidence": confidence,
            "source": "passthrough",
        }

    detected_locale, locale_confidence = detect_locale(text)

    if _requests_lib is None:
        logger.warning("[TranslationService] 'requests' library not available; returning original text.")
        return {
            "translated": text,
            "detected_locale": detected_locale,
            "confidence": locale_confidence,
            "source": "fallback",
        }

    try:
        lang_pair = f"{from_lang}|{to_lang}"
        params = {"q": text, "langpair": lang_pair}
        response = _requests_lib.get(MYMEMORY_URL, params=params, timeout=timeout)

        if response.status_code == 429:
            logger.warning("[TranslationService] Rate limit (429) hit; returning original text.")
            return {
                "translated": text,
                "detected_locale": detected_locale,
                "confidence": locale_confidence,
                "source": "fallback",
            }

        response.raise_for_status()
        data = response.json()

        status = data.get("responseStatus")
        if status == 200:
            translated = data["responseData"]["translatedText"]
            api_confidence = float(data["responseData"].get("match", locale_confidence) or locale_confidence)
            return {
                "translated": translated,
                "detected_locale": detected_locale,
                "confidence": round(min(api_confidence, 1.0), 4),
                "source": "mymemory",
            }

        # Non-200 API status
        details = data.get("responseDetails", "Unknown error")
        logger.warning(f"[TranslationService] API returned status {status}: {details}")
        return {
            "translated": text,
            "detected_locale": detected_locale,
            "confidence": locale_confidence,
            "source": "fallback",
        }

    except _requests_lib.exceptions.Timeout:
        logger.error("[TranslationService] Request timed out; returning original text.")
        return {
            "translated": text,
            "detected_locale": detected_locale,
            "confidence": locale_confidence,
            "source": "fallback",
        }
    except _requests_lib.exceptions.RequestException as exc:
        logger.error(f"[TranslationService] Network error: {exc}; returning original text.")
        return {
            "translated": text,
            "detected_locale": detected_locale,
            "confidence": locale_confidence,
            "source": "fallback",
        }
    except (KeyError, ValueError, TypeError) as exc:
        logger.error(f"[TranslationService] Malformed response: {exc}; returning original text.")
        return {
            "translated": text,
            "detected_locale": detected_locale,
            "confidence": locale_confidence,
            "source": "fallback",
        }


def batch_translate(
    texts: list[str],
    from_lang: str = "en",
    to_lang: str = "en",
    timeout: int = DEFAULT_TIMEOUT,
) -> list[dict]:
    """
    Translate a list of texts using translate_text for each entry.

    Args:
        texts:     List of strings to translate.
        from_lang: Source language code.
        to_lang:   Target language code.
        timeout:   HTTP timeout per request.

    Returns:
        List of translation result dicts (same structure as translate_text).
    """
    results = []
    for text in texts:
        result = translate_text(text, from_lang=from_lang, to_lang=to_lang, timeout=timeout)
        results.append(result)
    return results


def detect_and_translate_to_english(
    text: str, timeout: int = DEFAULT_TIMEOUT
) -> dict:
    """
    Auto-detect the locale of the text and translate it to English if it is not
    already English.

    Returns:
        Same structure as translate_text, plus "original_lang" key.
    """
    detected_locale, confidence = detect_locale(text)
    if detected_locale == "en":
        return {
            "translated": text,
            "detected_locale": "en",
            "confidence": confidence,
            "source": "passthrough",
            "original_lang": "en",
        }

    result = translate_text(text, from_lang=detected_locale, to_lang="en", timeout=timeout)
    result["original_lang"] = detected_locale
    return result
