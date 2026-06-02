"""
Translation helpers for locale detection, MyMemory API fallback, and ticket translation.
"""

from __future__ import annotations

import logging
from typing import Optional

try:
    import requests as _requests_lib
except ImportError:  # pragma: no cover - exercised only when requests is absent
    _requests_lib = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)

MYMEMORY_URL = "https://api.mymemory.translated.net/get"
DEFAULT_TIMEOUT = 10
MAX_CACHE_SIZE = 1000
MAX_TEXT_LENGTH = 5000

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

_translation_cache: dict[str, str] = {}
_model_cache: dict[str, object] = {}

_LOCALE_RANGES = {
    "hi": (0x0900, 0x097F),
    "te": (0x0C00, 0x0C7F),
    "ta": (0x0B80, 0x0BFF),
    "kn": (0x0C80, 0x0CFF),
    "ml": (0x0D00, 0x0D7F),
    "bn": (0x0980, 0x09FF),
    "ar": (0x0600, 0x06FF),
    "zh": (0x4E00, 0x9FFF),
    "ja": (0x3040, 0x309F),
    "ko": (0xAC00, 0xD7AF),
    "ru": (0x0400, 0x04FF),
    "el": (0x0370, 0x03FF),
    "he": (0x0590, 0x05FF),
    "th": (0x0E00, 0x0E7F),
}

_MARATHI_WORDS = {"आहे", "नाही", "आणि", "हे", "या", "तो", "ती", "ते"}
_HINDI_WORDS = {"है", "नहीं", "और", "यह", "वह", "हम", "आप", "क्या"}


def detect_locale(text: str) -> tuple[str, float]:
    """Detect a locale using lightweight Unicode block heuristics."""
    if not text or not text.strip():
        return ("en", 0.5)

    stripped_text = text.strip()
    total_chars = len([char for char in stripped_text if not char.isspace()])
    if total_chars == 0:
        return ("en", 0.5)

    counts: dict[str, int] = {}
    for char in stripped_text:
        codepoint = ord(char)
        for language, (lower, upper) in _LOCALE_RANGES.items():
            if lower <= codepoint <= upper:
                counts[language] = counts.get(language, 0) + 1
                break

    if not counts:
        return ("en", 0.9)

    best_language = max(counts, key=counts.get)
    confidence = round(min(counts[best_language] / total_chars, 1.0), 4)

    if best_language == "hi":
        words = set(stripped_text.split())
        if len(words & _MARATHI_WORDS) > len(words & _HINDI_WORDS):
            best_language = "mr"

    return (best_language, confidence)


def detect_language(text: str) -> Optional[str]:
    """Detect language with langdetect when available."""
    try:
        from langdetect import detect

        if not text or len(text.strip()) < 3:
            return None
        return detect(text)
    except Exception as exc:
        logger.warning("Language detection failed: %s", exc)
        return None


def get_supported_languages() -> dict[str, str]:
    """Return a copy of supported translation language codes."""
    return SUPPORTED_LANGUAGES.copy()


def _get_model_name(source_lang: str, target_lang: str) -> str:
    """Get the Helsinki-NLP model name for a language pair."""
    return f"Helsinki-NLP/opus-mt-{source_lang}-{target_lang}"


def _load_translation_model(source_lang: str, target_lang: str):
    """Load and cache a Helsinki-NLP translation model."""
    model_key = f"{source_lang}-{target_lang}"
    if model_key in _model_cache:
        return _model_cache[model_key]

    try:
        from transformers import MarianMTModel, MarianTokenizer

        model_name = _get_model_name(source_lang, target_lang)
        tokenizer = MarianTokenizer.from_pretrained(model_name)
        model = MarianMTModel.from_pretrained(model_name)
        _model_cache[model_key] = (model, tokenizer)
        return model, tokenizer
    except Exception as exc:
        logger.error("Failed to load translation model %s-%s: %s", source_lang, target_lang, exc)
        return None


def _unsupported_language_result(text: str, source_lang: Optional[str], target_lang: str) -> dict:
    return {
        "translated": text,
        "source_lang": source_lang,
        "target_lang": target_lang,
        "cached": False,
        "error": "unsupported_language",
    }


def _passthrough_result(
    text: str,
    detected_locale: str,
    confidence: float,
    source_lang: Optional[str],
    target_lang: str,
    source: str = "passthrough",
) -> dict:
    return {
        "translated": text,
        "detected_locale": detected_locale,
        "confidence": confidence,
        "source": source,
        "source_lang": source_lang,
        "target_lang": target_lang,
        "cached": False,
    }


def _translate_with_mymemory(text: str, from_lang: str, to_lang: str, timeout: int) -> dict:
    detected_locale, locale_confidence = detect_locale(text)

    if _requests_lib is None:
        logger.warning("[TranslationService] 'requests' library not available; returning original text.")
        return _passthrough_result(text, detected_locale, locale_confidence, from_lang, to_lang, "fallback")

    try:
        response = _requests_lib.get(
            MYMEMORY_URL,
            params={"q": text, "langpair": f"{from_lang}|{to_lang}"},
            timeout=timeout,
        )
        if response.status_code == 429:
            logger.warning("[TranslationService] Rate limit hit; returning original text.")
            return _passthrough_result(text, detected_locale, locale_confidence, from_lang, to_lang, "fallback")

        response.raise_for_status()
        data = response.json()
        if data.get("responseStatus") == 200:
            translated = data["responseData"]["translatedText"]
            api_confidence = float(data["responseData"].get("match", locale_confidence) or locale_confidence)
            return {
                "translated": translated,
                "detected_locale": detected_locale,
                "confidence": round(min(api_confidence, 1.0), 4),
                "source": "mymemory",
                "source_lang": from_lang,
                "target_lang": to_lang,
                "cached": False,
            }

        logger.warning(
            "[TranslationService] API returned status %s: %s",
            data.get("responseStatus"),
            data.get("responseDetails", "Unknown error"),
        )
    except _requests_lib.exceptions.Timeout:
        logger.error("[TranslationService] Request timed out; returning original text.")
    except _requests_lib.exceptions.RequestException as exc:
        logger.error("[TranslationService] Network error: %s; returning original text.", exc)
    except (KeyError, ValueError, TypeError) as exc:
        logger.error("[TranslationService] Malformed response: %s; returning original text.", exc)

    return _passthrough_result(text, detected_locale, locale_confidence, from_lang, to_lang, "fallback")


def _translate_with_model(text: str, source_lang: Optional[str], target_lang: str) -> dict:
    if not text or not text.strip():
        return {
            "translated": "",
            "source_lang": source_lang,
            "target_lang": target_lang,
            "cached": False,
        }

    if len(text) > MAX_TEXT_LENGTH:
        text = text[:MAX_TEXT_LENGTH] + "..."

    if not source_lang:
        source_lang = detect_language(text)
        if not source_lang:
            return {
                "translated": text,
                "source_lang": "unknown",
                "target_lang": target_lang,
                "cached": False,
            }

    if source_lang == target_lang:
        return {
            "translated": text,
            "source_lang": source_lang,
            "target_lang": target_lang,
            "cached": False,
        }

    cache_key = f"{source_lang}:{target_lang}:{hash(text)}"
    if cache_key in _translation_cache:
        return {
            "translated": _translation_cache[cache_key],
            "source_lang": source_lang,
            "target_lang": target_lang,
            "cached": True,
        }

    model_result = _load_translation_model(source_lang, target_lang)
    if not model_result:
        return {
            "translated": text,
            "source_lang": source_lang,
            "target_lang": target_lang,
            "cached": False,
        }

    model, tokenizer = model_result
    try:
        inputs = tokenizer(text, return_tensors="pt", padding=True, truncation=True, max_length=512)
        translated = model.generate(**inputs)
        translated_text = tokenizer.decode(translated[0], skip_special_tokens=True)
        if len(_translation_cache) < MAX_CACHE_SIZE:
            _translation_cache[cache_key] = translated_text
        return {
            "translated": translated_text,
            "source_lang": source_lang,
            "target_lang": target_lang,
            "cached": False,
        }
    except Exception as exc:
        logger.error("Translation failed: %s", exc)
        return {
            "translated": text,
            "source_lang": source_lang,
            "target_lang": target_lang,
            "cached": False,
        }


def translate_text(
    text: str,
    from_lang: str = "en",
    to_lang: str = "en",
    timeout: int = DEFAULT_TIMEOUT,
    *,
    target_lang: Optional[str] = None,
    source_lang: Optional[str] = None,
) -> dict:
    """Translate text using either the legacy MyMemory path or model-backed path."""
    uses_model_path = target_lang is not None or source_lang is not None
    resolved_target = target_lang if target_lang is not None else to_lang
    resolved_source = source_lang if source_lang is not None else from_lang

    if resolved_target not in SUPPORTED_LANGUAGES:
        return _unsupported_language_result(text, resolved_source, resolved_target)

    if not uses_model_path:
        if not text or not text.strip():
            detected_locale, confidence = detect_locale(text or "")
            return _passthrough_result("", detected_locale, confidence, from_lang, to_lang)
        if from_lang == to_lang:
            detected_locale, confidence = detect_locale(text)
            return _passthrough_result(text, detected_locale, confidence, from_lang, to_lang)
        return _translate_with_mymemory(text, from_lang, to_lang, timeout)

    return _translate_with_model(text, source_lang, resolved_target)


def batch_translate(
    texts: list[str],
    from_lang: str = "en",
    to_lang: str = "en",
    timeout: int = DEFAULT_TIMEOUT,
) -> list[dict]:
    """Translate a list of texts with the legacy MyMemory-compatible path."""
    return [translate_text(text, from_lang=from_lang, to_lang=to_lang, timeout=timeout) for text in texts]


def detect_and_translate_to_english(text: str, timeout: int = DEFAULT_TIMEOUT) -> dict:
    """Detect text locale and translate non-English content to English."""
    detected_locale, confidence = detect_locale(text)
    if detected_locale == "en":
        result = _passthrough_result(text, "en", confidence, "en", "en")
        result["original_lang"] = "en"
        return result

    result = translate_text(text, from_lang=detected_locale, to_lang="en", timeout=timeout)
    result["original_lang"] = detected_locale
    return result


def translate_ticket(ticket_data: dict, target_lang: str = "en") -> dict:
    """Translate ticket subject, description, and messages."""
    result = {
        "original_language": None,
        "target_language": target_lang,
        "translations": {},
    }

    if "subject" in ticket_data:
        subject_result = translate_text(ticket_data["subject"], target_lang=target_lang)
        result["translations"]["subject"] = subject_result
        if not result["original_language"]:
            result["original_language"] = subject_result["source_lang"]

    if "description" in ticket_data:
        description_result = translate_text(ticket_data["description"], target_lang=target_lang)
        result["translations"]["description"] = description_result
        if not result["original_language"]:
            result["original_language"] = description_result["source_lang"]

    if "messages" in ticket_data:
        translated_messages = []
        for message in ticket_data["messages"]:
            content = message.get("content", "")
            message_result = translate_text(content, target_lang=target_lang)
            translated_messages.append(
                {
                    "original": content,
                    "translated": message_result["translated"],
                    "language": message_result["source_lang"],
                }
            )
        result["translations"]["messages"] = translated_messages

    return result


def clear_cache():
    """Clear translation and model caches."""
    _translation_cache.clear()
    _model_cache.clear()
