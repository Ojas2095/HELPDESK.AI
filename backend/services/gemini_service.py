import os
import base64
import io
import re
from PIL import Image
from google import genai
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from backend/.env
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# ---------------------------------------------------------------------------
# Model registry — validated at init time so misconfigs are caught early.
# Add new models here as Google releases them; do NOT hardcode model names
# inside the class body (CWE-547 / CWE-798).
# ---------------------------------------------------------------------------
_SUPPORTED_MODELS = {
    "gemini-2.5-flash",
    "gemini-2.5-flash-preview-05-20",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
}
_DEFAULT_MODEL = "gemini-2.5-flash"

# ---------------------------------------------------------------------------
# Input-size guard (CWE-400 / CWE-789) — rejects oversized base64 payloads
# before they are decoded and inflated in RAM by PIL.
# ---------------------------------------------------------------------------
MAX_IMAGE_B64_BYTES = int(os.getenv("GEMINI_MAX_IMAGE_B64_BYTES", str(5 * 1024 * 1024)))  # 5 MB


class GeminiService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        self._initialized = False

        # ── Env-configurable model name (fixes hardcoded 'gemini-2.5-flash') ──
        _requested = os.getenv("GEMINI_MODEL_NAME", _DEFAULT_MODEL).strip()
        if _requested not in _SUPPORTED_MODELS:
            print(
                f"[GeminiService] WARNING: Unknown model '{_requested}'. "
                f"Supported: {sorted(_SUPPORTED_MODELS)}. "
                f"Falling back to {_DEFAULT_MODEL}."
            )
            _requested = _DEFAULT_MODEL
        self.model_name = _requested

        if self.api_key:
            try:
                self.client = genai.Client(api_key=self.api_key)
                self._initialized = True
                print(f"[GeminiService] Connected to Google GenAI API (Model: {self.model_name})")
            except Exception as e:
                # CWE-532: redact API key from exception message before logging
                _safe_err = str(e).replace(self.api_key, "[REDACTED]")
                print(f"[GeminiService] Initialization Error: {_safe_err}")
        else:
            print("[GeminiService] WARNING: GEMINI_API_KEY not found in environment.")

    def analyze_image(self, image_base64: str) -> dict:
        """
        Perform OCR and image analysis using Gemini logic.
        """
        if not self._initialized:
            return {
                "image_description": "[Gemini API Key Missing] Could not analyze image.",
                "ocr_text": "",
                "detected_problem": ""
            }

        # ── Size guard (CWE-400) — reject payloads > MAX_IMAGE_B64_BYTES ──────
        if len(image_base64) > MAX_IMAGE_B64_BYTES:
            print(
                f"[GeminiService] analyze_image: payload {len(image_base64):,} bytes "
                f"exceeds cap of {MAX_IMAGE_B64_BYTES:,} bytes. Rejecting."
            )
            return {
                "image_description": (
                    f"[Error] Image payload exceeds the {MAX_IMAGE_B64_BYTES // (1024*1024)} MB limit. "
                    "Please upload a smaller screenshot."
                ),
                "ocr_text": "",
                "detected_problem": ""
            }

        try:
            # Decode base64 image
            image_bytes = base64.b64decode(image_base64)
            img = Image.open(io.BytesIO(image_bytes))

            prompt = (
                "Analyze this screenshot from a user reporting a technical issue. "
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
                contents=[prompt, img]
            )
            text_response = response.text

            description_match = re.search(r"(?:Description|1\.)\s*[:\-]?\s*(.*)", text_response, re.IGNORECASE)
            ocr_match        = re.search(r"(?:OCR|2\.)\s*[:\-]?\s*(.*)", text_response, re.IGNORECASE)
            problem_match    = re.search(r"(?:Problem|3\.)\s*[:\-]?\s*(.*)", text_response, re.IGNORECASE)

            return {
                "image_description": description_match.group(1).strip() if description_match else text_response[:500],
                "ocr_text":          ocr_match.group(1).strip() if ocr_match else "",
                "detected_problem":  problem_match.group(1).strip() if problem_match else ""
            }

        except Exception as e:
            _safe = str(e).replace(self.api_key or "", "[REDACTED]")
            print(f"[GeminiService] Image Analysis Error: {_safe}")
            return {
                "image_description": f"Error analyzing image: {_safe}",
                "ocr_text": "",
                "detected_problem": ""
            }

    def get_summary(self, ticket_text: str) -> str:
        """
        Generate a concise, one-line summary of the ticket text.
        """
        if not self._initialized:
            return ticket_text[:100] + ("…" if len(ticket_text) > 100 else "")

        try:
            prompt = (
                "You are an expert IT triage specialized in extreme brevity. "
                "Summarize the following IT support ticket into exactly ONE concise, hard-hitting line (max 15 words) "
                "that captures the technical essence. NO intro, NO filler, just the core problem headline. "
                f"Ticket: '{ticket_text}'"
            )
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=[prompt]
            )
            return response.text.strip()

        except Exception as e:
            _safe = str(e).replace(self.api_key or "", "[REDACTED]")
            print(f"[GeminiService] Summary Error: {_safe}")
            return ticket_text[:100] + ("…" if len(ticket_text) > 100 else "")

    def get_reasoning(self, ticket_text: str, category: str, subcategory: str) -> str:
        """
        Generate reasoning/explanation for the classification decision.
        """
        if not self._initialized:
            return f"Classified as {category} / {subcategory} based on ticket content."

        try:
            prompt = (
                f"You are an IT support analyst. A ticket has been classified as: "
                f"Category: {category}, Subcategory: {subcategory}.\n"
                f"Ticket: '{ticket_text}'\n"
                "Provide a 2-3 sentence explanation of why this classification is correct, "
                "highlighting the key indicators in the ticket text. Be concise and technical."
            )
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=[prompt]
            )
            return response.text.strip()

        except Exception as e:
            _safe = str(e).replace(self.api_key or "", "[REDACTED]")
            print(f"[GeminiService] Reasoning Error: {_safe}")
            return f"Classified as {category} / {subcategory} based on ticket content."

    def get_troubleshooting_step(self, ticket_text: str, step_number: int = 1,
                                  previous_steps: list = None) -> dict:
        """
        Generate an interactive troubleshooting step with options.
        """
        if not self._initialized:
            return {
                "step": step_number,
                "instruction": "Please check the system logs for error details.",
                "options": ["Issue resolved", "Issue persists", "Need more help"],
                "context": ""
            }

        try:
            prev_context = ""
            if previous_steps:
                prev_context = f"Previous steps taken: {previous_steps}. "

            prompt = (
                f"You are an expert IT support technician. {prev_context}"
                f"For this IT issue: '{ticket_text}'\n"
                f"Provide troubleshooting step #{step_number} in JSON format with these exact keys: "
                "'instruction' (clear action for the user), "
                "'options' (list of 2-3 possible outcomes/responses), "
                "'context' (brief technical explanation). "
                "Keep it concise and actionable."
            )
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=[prompt]
            )

            import json as _json
            text = response.text.strip()
            json_match = re.search(r"\{.*\}", text, re.DOTALL)
            if json_match:
                result = _json.loads(json_match.group())
            else:
                result = {
                    "instruction": text[:200],
                    "options": ["Issue resolved", "Issue persists", "Need more help"],
                    "context": ""
                }
            result["step"] = step_number
            return result

        except Exception as e:
            _safe = str(e).replace(self.api_key or "", "[REDACTED]")
            print(f"[GeminiService] Troubleshooting Error: {_safe}")
            return {
                "step": step_number,
                "instruction": "Please check the system logs for error details.",
                "options": ["Issue resolved", "Issue persists", "Need more help"],
                "context": ""
            }

    def analyze_bug_report(self, error_log: str, system_info: str = "") -> dict:
        """
        Perform root cause analysis from error logs.
        """
        if not self._initialized:
            return {
                "root_cause": "Gemini API not available for analysis.",
                "affected_components": [],
                "severity_assessment": "unknown",
                "recommended_actions": []
            }

        try:
            prompt = (
                "You are a senior software engineer performing root cause analysis. "
                f"System info: {system_info or 'Not provided'}.\n"
                f"Error log:\n{error_log[:3000]}\n\n"  # cap log size sent to API
                "Analyze this bug report and respond in JSON with keys: "
                "'root_cause' (string), 'affected_components' (list), "
                "'severity_assessment' (critical/high/medium/low), "
                "'recommended_actions' (list of strings)."
            )
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=[prompt]
            )

            import json as _json
            text = response.text.strip()
            json_match = re.search(r"\{.*\}", text, re.DOTALL)
            if json_match:
                return _json.loads(json_match.group())
            return {
                "root_cause": text[:500],
                "affected_components": [],
                "severity_assessment": "unknown",
                "recommended_actions": []
            }

        except Exception as e:
            _safe = str(e).replace(self.api_key or "", "[REDACTED]")
            print(f"[GeminiService] Bug Analysis Error: {_safe}")
            return {
                "root_cause": f"Analysis failed: {_safe}",
                "affected_components": [],
                "severity_assessment": "unknown",
                "recommended_actions": []
            }
