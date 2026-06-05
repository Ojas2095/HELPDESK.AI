"""
GeminiService — Google Gemini API integration for image analysis, summarisation,
reasoning, troubleshooting, agent coaching, bug analysis, and translation.

Security guards on analyze_image (CWE-400, CWE-770):
  - Input base64 string length is checked before any decoding to prevent
    memory exhaustion from a 100 MB base64 payload.
  - Decoded byte length is checked before PIL opens the data.
  - PIL's decompression-bomb protection is enabled via MAX_IMAGE_PIXELS so
    a crafted PNG/TIFF that inflates to gigabytes is rejected early.
  - Image dimensions (width × height) are checked after open.
  - A per-process asyncio Semaphore caps concurrent Gemini API calls.
  - Malformed base64 and unsupported content types are rejected with
    structured error responses rather than raw exceptions.
"""

from __future__ import annotations

import base64
import binascii
import io
import logging
import os
import re
import json
from pathlib import Path

from dotenv import load_dotenv

logger = logging.getLogger(__name__)

try:
    from PIL import Image
    from google import genai
    _HAS_GEMINI_DEPS = True
except ImportError:
    Image = None
    genai = None
    _HAS_GEMINI_DEPS = False

# Load environment variables from backend/.env
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# ---------------------------------------------------------------------------
# Size and concurrency limits for analyze_image
# ---------------------------------------------------------------------------
# Base64 string length gate — reject before any decoding (1 base64 char ≈ 0.75 bytes)
MAX_BASE64_LEN: int = 15 * 1024 * 1024        # 15 MB string  (~11 MB decoded)
# Decoded binary gate — secondary check after decoding
MAX_DECODED_BYTES: int = 10 * 1024 * 1024     # 10 MB
# Pixel-count gate — prevents decompression-bomb attacks (a 1 KB PNG → 1 GB raster)
MAX_PIXELS: int = 4096 * 4096                  # ~16.7 MP
MAX_DIMENSION: int = 4096                       # per side

# Accepted MIME types (data-URI content-type field)
_ALLOWED_TYPES: frozenset[str] = frozenset({
    "image/png", "image/jpeg", "image/webp", "image/gif",
    "image/bmp", "image/tiff",
})

# Maximum simultaneous Gemini API calls (each holds GPU-equivalent server resources)
_MAX_CONCURRENT_GEMINI: int = 3

# Thread-level semaphore for synchronous concurrency bounding
import threading
_gemini_semaphore = threading.Semaphore(_MAX_CONCURRENT_GEMINI)


def _error_response(reason: str) -> dict:
    return {"image_description": reason, "ocr_text": "", "detected_problem": ""}


class GeminiService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        self._initialized = False
        self.model_name = 'gemini-2.5-flash'

        if self.api_key and _HAS_GEMINI_DEPS:
            try:
                self.client = genai.Client(api_key=self.api_key)
                self._initialized = True
                logger.info("[GeminiService] Connected to Google GenAI API (Model: %s)", self.model_name)
            except Exception as exc:
                logger.error("[GeminiService] Initialization Error: %s", exc)
        else:
            if not _HAS_GEMINI_DEPS:
                logger.warning(
                    "[GeminiService] PIL or google-genai package not installed. Service disabled."
                )
            else:
                logger.warning("[GeminiService] GEMINI_API_KEY not found in environment.")

    # ------------------------------------------------------------------
    # Input validation helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _validate_and_decode(image_base64: str) -> tuple[bytes | None, str | None]:
        """
        Validate and decode a raw or data-URI base64 image string.

        Returns:
            (image_bytes, None)  on success
            (None, error_message) if any guard fails
        """
        if not image_base64 or not image_base64.strip():
            return None, "[Image Error] Empty image data."

        image_base64 = image_base64.strip()

        # 1. Length gate — check before any memory-heavy operation
        if len(image_base64) > MAX_BASE64_LEN:
            logger.warning(
                "[GeminiService] Rejected base64 input: %d bytes > %d limit",
                len(image_base64), MAX_BASE64_LEN,
            )
            return None, (
                f"[Image Too Large] Base64 payload exceeds "
                f"{MAX_BASE64_LEN // (1024 * 1024)} MB limit."
            )

        # 2. Strip data-URI prefix and validate content type
        content_type: str | None = None
        if "," in image_base64:
            header, image_base64 = image_base64.split(",", 1)
            if ";base64" in header:
                content_type = header.split(";")[0].replace("data:", "").strip().lower()
                if content_type and content_type not in _ALLOWED_TYPES:
                    logger.warning("[GeminiService] Rejected unsupported type: %s", content_type)
                    return None, f"[Image Error] Unsupported content type: {content_type}."

        # 3. Fix missing base64 padding
        padding = 4 - len(image_base64) % 4
        if padding != 4:
            image_base64 += "=" * padding

        # 4. Decode — reject malformed base64
        try:
            image_bytes = base64.b64decode(image_base64, validate=True)
        except (binascii.Error, ValueError) as exc:
            logger.warning("[GeminiService] Malformed base64: %s", exc)
            return None, "[Image Error] Malformed base64 data."

        # 5. Decoded byte length gate
        if len(image_bytes) > MAX_DECODED_BYTES:
            logger.warning(
                "[GeminiService] Rejected decoded image: %d bytes > %d limit",
                len(image_bytes), MAX_DECODED_BYTES,
            )
            return None, (
                f"[Image Too Large] Decoded image exceeds "
                f"{MAX_DECODED_BYTES // (1024 * 1024)} MB limit."
            )

        return image_bytes, None

    @staticmethod
    def _open_and_validate_image(image_bytes: bytes) -> tuple["Image.Image | None", str | None]:
        """
        Open a PIL Image with decompression-bomb and dimension guards.

        Returns:
            (pil_image, None)      on success
            (None, error_message)  if any guard fails
        """
        if Image is None:
            return None, "[Image Error] PIL not installed."

        # Enforce pixel cap to block decompression-bomb attacks before Image.open
        Image.MAX_IMAGE_PIXELS = MAX_PIXELS

        try:

            # Validate magic bytes (file signature) to prevent non-image data
            # from being passed to PIL's format detection
            if not _validate_image_signature(image_bytes):
                return {
                    "image_description": "[Invalid Image] Unsupported or unrecognized image format.",
                    "ocr_text": "",
                    "detected_problem": ""
                }

            # Decompression bomb protection: limit total pixels PIL will allocate
            Image.MAX_IMAGE_PIXELS = 50_000_000  # 50 megapixels

            img = Image.open(io.BytesIO(image_bytes))
            img.verify()  # detect truncated/corrupted files early
        except Exception as exc:
            logger.warning("[GeminiService] PIL verify failed: %s", exc)
            return None, f"[Image Error] Could not open image: {exc}"

        # Re-open after verify (verify() closes the file pointer)
        try:
            img = Image.open(io.BytesIO(image_bytes))
        except Exception as exc:
            return None, f"[Image Error] Could not re-open image: {exc}"

        # 6. Dimension gate (applies even after pixel-count gate passes)
        width, height = img.size
        if width > MAX_DIMENSION or height > MAX_DIMENSION:
            logger.warning(
                "[GeminiService] Rejected oversized image: %dx%d > %d",
                width, height, MAX_DIMENSION,
            )
            return None, (
                f"[Image Too Large] Image dimensions {width}×{height} exceed "
                f"{MAX_DIMENSION}px per side."
            )

        return img, None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def analyze_image(self, image_base64: str, context_text: str | None = None) -> dict:
        """
        Perform OCR and image analysis using the Gemini API.

        Applies strict input validation before any decoding or API call:
          - base64 string length gate (pre-decode)
          - decoded byte length gate
          - PIL decompression-bomb protection (MAX_IMAGE_PIXELS)
          - image dimension gate
          - concurrency cap via asyncio Semaphore
        """
        if not self._initialized or not _HAS_GEMINI_DEPS:
            return _error_response("[Gemini Service Offline] Could not analyze image.")

        # Validate and decode
        image_bytes, err = self._validate_and_decode(image_base64)
        if err or image_bytes is None:
            return _error_response(err or "[Image Error] Decode failed.")

        # Open and validate with PIL
        img, err = self._open_and_validate_image(image_bytes)
        if err:
            return _error_response(err)

        with _gemini_semaphore:
            try:
                prompt = "Analyze this screenshot from a user reporting a technical issue. "
                if context_text:
                    prompt += f"Context/description provided by user: '{context_text}'\n"
                prompt += (
                    "1. Provide a concise description of what is shown in the image. "
                    "2. Perform OCR and extract any error messages or key text. "
                    "3. Identify the main technical problem depicted. "
                    "Return the result in the following format: "
                    "Description: <description>\n"
                    "OCR: <text>\n"
                    "Problem: <problem>"
                )

                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=[prompt, img],
                )
                text_response = response.text

                description_match = re.search(r"(?:Description|1\.)\s*[:\-]?\s*(.*)", text_response, re.IGNORECASE)
                ocr_match = re.search(r"(?:OCR|2\.)\s*[:\-]?\s*(.*)", text_response, re.IGNORECASE)
                problem_match = re.search(r"(?:Problem|3\.)\s*[:\-]?\s*(.*)", text_response, re.IGNORECASE)

                return {
                    "image_description": description_match.group(1).strip() if description_match else text_response[:500],
                    "ocr_text": ocr_match.group(1).strip() if ocr_match else "",
                    "detected_problem": problem_match.group(1).strip() if problem_match else "",
                }

            except Exception as exc:
                logger.error("[GeminiService] Image Analysis Error: %s", exc)
                return _error_response(f"Error analyzing image: {exc}")


    def get_summary(self, ticket_text: str) -> str:
        """Generate a concise, one-line summary of the ticket text."""
        if not self._initialized:
            return ticket_text[:100] + ("…" if len(ticket_text) > 100 else "")

        try:
            prompt = (
                "You are an expert IT triage specialized in extreme brevity. "
                "Summarize the following IT support ticket into exactly ONE concise, hard-hitting line (max 15 words) "
                "that captures the technical essence. NO intro, NO filler, just the core problem headline. "
                f"Ticket: '{ticket_text}'"
            )
            response = self.client.models.generate_content(model=self.model_name, contents=prompt)
            return response.text.strip().replace("\n", " ")
        except Exception as exc:
            logger.error("[GeminiService] Summarization Error: %s", exc)
            return ticket_text[:100] + ("…" if len(ticket_text) > 100 else "")

    def get_reasoning(self, ticket_text: str, category: str, team: str) -> dict:
        """Get a deeper AI explanation and key takeaways for the ticket."""
        if not self._initialized:
            return {"reasoning": "", "highlights": []}

        try:
            prompt = (
                f"Analyze this IT support ticket: '{ticket_text}'\n"
                f"It was categorized as '{category}' and routed to '{team}'.\n\n"
                "Please provide:\n"
                "1. Reasoning: A professional explanation of why this category/team was chosen (max 2 sentences).\n"
                "2. Highlights: 2-3 key technical points or symptoms mentioned in the ticket (short bullets).\n"
                "\nFormat the output strictly as:\n"
                "REASONING: <text>\n"
                "HIGHLIGHTS: <point1> | <point2> | <point3>"
            )
            response = self.client.models.generate_content(model=self.model_name, contents=prompt)
            text_response = response.text.strip()

            reasoning_match = re.search(r"REASONING:\s*(.*)", text_response, re.IGNORECASE)
            highlights_match = re.search(r"HIGHLIGHTS:\s*(.*)", text_response, re.IGNORECASE)

            reasoning = reasoning_match.group(1).strip() if reasoning_match else ""
            highlights_raw = highlights_match.group(1).strip() if highlights_match else ""
            highlights = [h.strip() for h in highlights_raw.split("|") if h.strip()]

            return {"reasoning": reasoning, "highlights": highlights}
        except Exception as exc:
            logger.error("[GeminiService] Reasoning Error: %s", exc)
            return {"reasoning": "", "highlights": []}

    def get_troubleshooting_step(self, ticket_text: str, history: list[dict], category: str) -> dict:
        """Get the next troubleshooting step from Gemini based on conversation history."""
        if not self._initialized:
            return {
                "step_text": "AI Troubleshooting is currently unavailable.",
                "options": ["Try again later"],
                "is_final": True,
            }

        try:
            history_str = ""
            for msg in history:
                role = "User" if msg["role"] == "user" else "AI"
                history_str += f"{role}: {msg['text']}\n"

            prompt = (
                f"You are an expert IT support assistant. A user is reporting this issue: '{ticket_text}' (Category: {category}).\n\n"
                f"Previous conversation:\n{history_str}\n"
                "Provide the NEXT troubleshooting step. Follow these rules:\n"
                "1. If the issue seems resolved based on history, or if you've exhausted basic steps, set is_final: True.\n"
                "2. Provide exactly 2-3 short, actionable user options (e.g., 'Yes, I did that', 'I need help').\n"
                "3. Keep the bot message concise and professional.\n\n"
                "Format your response EXACTLY like this:\n"
                "STEP: <the instructions for the user>\n"
                "OPTIONS: <option1> | <option2> | <option3>\n"
                "FINAL: <True/False>"
            )

            response = self.client.models.generate_content(model=self.model_name, contents=prompt)
            text_response = response.text.strip()

            step_match = re.search(r"STEP:\s*(.*)", text_response, re.IGNORECASE)
            options_match = re.search(r"OPTIONS:\s*(.*)", text_response, re.IGNORECASE)
            final_match = re.search(r"FINAL:\s*(True|False)", text_response, re.IGNORECASE)

            return {
                "step_text": step_match.group(1).strip() if step_match else "Let's try checking your settings.",
                "options": [
                    o.strip()
                    for o in (options_match.group(1).strip() if options_match else "Done | Stuck").split("|")
                    if o.strip()
                ],
                "is_final": final_match.group(1).lower() == "true" if final_match else False,
            }
        except Exception as exc:
            logger.error("[GeminiService] Troubleshooting Error: %s", exc)
            return {
                "step_text": "I encountered an error. Let's try one more basic check.",
                "options": ["Okay", "Skip to agent"],
                "is_final": False,
            }

    def get_agent_coaching(self, agent_name: str, metrics: dict) -> dict:
        """
        Generate AI-powered coaching insights for a support agent based on their
        resolved ticket metrics.

        Args:
            agent_name: Display name of the agent (used in the prompt only).
            metrics: Dict with keys:
                total_tickets, resolved_tickets, open_tickets, critical_tickets,
                avg_resolution_hours, sla_breach_rate, auto_resolved_rate,
                top_categories (list of str), common_subcategories (list of str)

        Returns:
            {
                "performance_score": int (0-100),
                "strengths": list[str],
                "improvement_areas": list[str],
                "coaching_tip": str,
                "recommended_training": list[str]
            }
        """
        if not self._initialized:
            return {
                "performance_score": 0,
                "strengths": [],
                "improvement_areas": [],
                "coaching_tip": "AI coaching unavailable — Gemini API key not configured.",
                "recommended_training": [],
            }

        try:
            top_cats = ", ".join(metrics.get("top_categories", [])[:3]) or "N/A"
            common_subs = ", ".join(metrics.get("common_subcategories", [])[:3]) or "N/A"

            prompt = (
                f"You are an IT support team performance coach. Analyse the following metrics "
                f"for support agent '{agent_name}' and provide actionable, specific coaching.\n\n"
                f"Metrics:\n"
                f"- Total tickets handled: {metrics.get('total_tickets', 0)}\n"
                f"- Resolved: {metrics.get('resolved_tickets', 0)}\n"
                f"- Still open: {metrics.get('open_tickets', 0)}\n"
                f"- Critical priority tickets: {metrics.get('critical_tickets', 0)}\n"
                f"- Average resolution time: {metrics.get('avg_resolution_hours', 0):.1f} hours\n"
                f"- SLA breach rate: {metrics.get('sla_breach_rate', 0):.1f}%\n"
                f"- Auto-resolved rate: {metrics.get('auto_resolved_rate', 0):.1f}%\n"
                f"- Top issue categories: {top_cats}\n"
                f"- Most frequent subcategories: {common_subs}\n\n"
                "Respond ONLY in the following structured format (no extra text):\n"
                "SCORE: <integer 0-100 reflecting overall performance>\n"
                "STRENGTHS: <strength1> | <strength2> | <strength3>\n"
                "IMPROVEMENTS: <area1> | <area2> | <area3>\n"
                "TIP: <single actionable coaching tip, max 2 sentences>\n"
                "TRAINING: <module1> | <module2> | <module3>"
            )

            response = self.client.models.generate_content(model=self.model_name, contents=prompt)
            text = response.text.strip()

            def _extract(label: str) -> str:
                m = re.search(rf"{label}:\s*(.*)", text, re.IGNORECASE)
                return m.group(1).strip() if m else ""

            def _split(raw: str) -> list[str]:
                return [p.strip() for p in raw.split("|") if p.strip()]

            score_raw = _extract("SCORE")
            try:
                score = max(0, min(100, int(score_raw)))
            except (ValueError, TypeError):
                score = 50

            return {
                "performance_score": score,
                "strengths": _split(_extract("STRENGTHS")),
                "improvement_areas": _split(_extract("IMPROVEMENTS")),
                "coaching_tip": _extract("TIP"),
                "recommended_training": _split(_extract("TRAINING")),
            }

        except Exception as exc:
            logger.error("[GeminiService] Agent coaching error: %s", exc)
            return {
                "performance_score": 0,
                "strengths": [],
                "improvement_areas": [],
                "coaching_tip": f"Coaching analysis failed: {exc}",
                "recommended_training": [],
            }

    def analyze_bug_report(self, bug_title: str, description: str, steps: str, errors: list) -> str:
        """Analyze a bug report and captured console errors to generate a Probable Cause."""
        if not self._initialized:
            return "AI Diagnostics unavailable (API key missing or disconnected)."

        try:
            errors_schema = "\n".join([f"- {err}" for err in errors]) if errors else "None captured."
            prompt = (
                f"You are a Level 3 Senior System Engineer diagnosing a bug report.\n"
                f"Title: {bug_title}\n"
                f"Description: {description}\n"
                f"Steps to reproduce: {steps}\n"
                f"Captured Console/Network Errors: \n{errors_schema}\n\n"
                "Based on this exact telemetry and report, provide a concise 'Probable Root Cause' (1-3 sentences maximum). "
                "Focus purely on technical inference and what the developer should investigate first. "
                "Do not include pleasantries. Do not say 'The probable cause is', just state the technical theory."
            )

            response = self.client.models.generate_content(model=self.model_name, contents=prompt)
            return response.text.strip()
        except Exception as exc:
            logger.error("[GeminiService] Bug Analysis Error: %s", exc)
            return f"Diagnostic analysis failed: {exc}"

    def detect_language(self, text: str) -> dict:
        """Detect language for the given text. Returns ISO-ish language code and English name."""
        if not text or not text.strip():
            return {"code": "en", "name": "English"}
        if not self._initialized:
            return {"code": "en", "name": "English"}

        try:
            prompt = (
                "Detect the natural language of the following user message. "
                "Return strict JSON only with keys: code, name. "
                "Example: {\"code\":\"es\",\"name\":\"Spanish\"}.\n\n"
                f"Text:\n{text}"
            )
            response = self.client.models.generate_content(model=self.model_name, contents=prompt)
            raw = (response.text or "").strip()
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            parsed = json.loads(match.group(0) if match else raw)
            code = str(parsed.get("code", "en")).lower()
            name = str(parsed.get("name", "English"))
            return {"code": code or "en", "name": name or "English"}
        except Exception as exc:
            logger.error("[GeminiService] Language detection error: %s", exc)
            return {"code": "en", "name": "English"}

    def translate_to_english(self, text: str, source_language: str | None = None) -> str:
        """Translate user text to English while preserving technical terms."""
        if not text or not text.strip():
            return text
        if not self._initialized:
            return text

        try:
            lang_hint = f"Source language: {source_language}. " if source_language else ""
            prompt = (
                "Translate the following support ticket text to natural, concise English. "
                "Preserve technical terms, error codes, product names, and formatting. "
                "Return only translated text with no prefix or explanation. "
                f"{lang_hint}\n\n"
                f"Text:\n{text}"
            )
            response = self.client.models.generate_content(model=self.model_name, contents=prompt)
            return (response.text or "").strip() or text
        except Exception as exc:
            logger.error("[GeminiService] Translation error: %s", exc)
            return text
