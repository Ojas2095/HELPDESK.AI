import os
import base64
import io
import re
import json
from dotenv import load_dotenv
from pathlib import Path

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

class GeminiService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        self._initialized = False
        self.model_name = 'gemini-2.5-flash'
        
        if self.api_key and _HAS_GEMINI_DEPS:
            try:
                self.client = genai.Client(api_key=self.api_key)
                self._initialized = True
                print(f"[GeminiService] Connected to Google GenAI API (Model: {self.model_name})")
            except Exception as e:
                print(f"[GeminiService] Initialization Error: {e}")
        else:
            if not _HAS_GEMINI_DEPS:
                print("[GeminiService] WARNING: PIL or google-genai package is not installed. Gemini service is disabled.")
            else:
                print("[GeminiService] WARNING: GEMINI_API_KEY not found in environment.")

    def analyze_image(self, image_base64: str, context_text: str = None) -> dict:
        """
        Perform OCR and image analysis using Gemini logic.
        """
        if not self._initialized or not _HAS_GEMINI_DEPS:
            return {
                "image_description": "[Gemini Service Offline] Could not analyze image.",
                "ocr_text": "",
                "detected_problem": ""
            }

        try:
            # Decode base64 image (actually the new SDK handles base64 easily if we just pass bytes, 
            # but we can also use PIL if we need to process it)
            image_bytes = base64.b64decode(image_base64)

            # Defense-in-depth: reject oversized images to prevent memory exhaustion
            max_size_bytes = 10 * 1024 * 1024  # 10MB
            if len(image_bytes) > max_size_bytes:
                return {
                    "image_description": "[Image Too Large] Image exceeds 10MB limit.",
                    "ocr_text": "",
                    "detected_problem": ""
                }

            img = Image.open(io.BytesIO(image_bytes))

            prompt = (
                "Analyze this screenshot from a user reporting a technical issue. "
            )
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
                contents=[prompt, img]
            )
            text_response = response.text

            description_match = re.search(r"(?:Description|1\.)\s*[:\-]?\s*(.*)", text_response, re.IGNORECASE)
            ocr_match = re.search(r"(?:OCR|2\.)\s*[:\-]?\s*(.*)", text_response, re.IGNORECASE)
            problem_match = re.search(r"(?:Problem|3\.)\s*[:\-]?\s*(.*)", text_response, re.IGNORECASE)

            return {
                "image_description": description_match.group(1).strip() if description_match else text_response[:500],
                "ocr_text": ocr_match.group(1).strip() if ocr_match else "",
                "detected_problem": problem_match.group(1).strip() if problem_match else ""
            }

        except Exception as e:
            print(f"[GeminiService] Image Analysis Error: {e}")
            return {
                "image_description": f"Error analyzing image: {str(e)}",
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
                contents=prompt
            )
            return response.text.strip().replace("\n", " ")
        except Exception as e:
            print(f"[GeminiService] Summarization Error: {e}")
            return ticket_text[:100] + ("…" if len(ticket_text) > 100 else "")

    def get_reasoning(self, ticket_text: str, category: str, team: str) -> dict:
        """
        Get a deeper AI explanation and key takeaways for the ticket.
        """
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
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt
            )
            text_response = response.text.strip()

            reasoning_match = re.search(r"REASONING:\s*(.*)", text_response, re.IGNORECASE)
            highlights_match = re.search(r"HIGHLIGHTS:\s*(.*)", text_response, re.IGNORECASE)

            reasoning = reasoning_match.group(1).strip() if reasoning_match else ""
            highlights_raw = highlights_match.group(1).strip() if highlights_match else ""
            highlights = [h.strip() for h in highlights_raw.split("|") if h.strip()]

            return {
                "reasoning": reasoning,
                "highlights": highlights
            }
        except Exception as e:
            print(f"[GeminiService] Reasoning Error: {e}")
            return {"reasoning": "", "highlights": []}

    def get_troubleshooting_step(self, ticket_text: str, history: list[dict], category: str) -> dict:
        """
        Get the next troubleshooting step from Gemini based on conversation history.
        """
        if not self._initialized:
            return {
                "step_text": "AI Troubleshooting is currently unavailable.",
                "options": ["Try again later"],
                "is_final": True
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

            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt
            )
            text_response = response.text.strip()

            step_match = re.search(r"STEP:\s*(.*)", text_response, re.IGNORECASE)
            options_match = re.search(r"OPTIONS:\s*(.*)", text_response, re.IGNORECASE)
            final_match = re.search(r"FINAL:\s*(True|False)", text_response, re.IGNORECASE)

            return {
                "step_text": step_match.group(1).strip() if step_match else "Let's try checking your settings.",
                "options": [o.strip() for o in (options_match.group(1).strip() if options_match else "Done | Stuck").split("|") if o.strip()],
                "is_final": final_match.group(1).lower() == "true" if final_match else False
            }
        except Exception as e:
            print(f"[GeminiService] Troubleshooting Error: {e}")
            return {
                "step_text": "I encountered an error. Let's try one more basic check.",
                "options": ["Okay", "Skip to agent"],
                "is_final": False
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

            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
            )
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
            print(f"[GeminiService] Agent coaching error: {exc}")
            return {
                "performance_score": 0,
                "strengths": [],
                "improvement_areas": [],
                "coaching_tip": f"Coaching analysis failed: {exc}",
                "recommended_training": [],
            }

    def analyze_bug_report(self, bug_title: str, description: str, steps: str, errors: list) -> str:
        """
        Analyze a bug report and captured console errors to generate a Probable Cause.
        """
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

            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt
            )
            return response.text.strip()
        except Exception as e:
            print(f"[GeminiService] Bug Analysis Error: {e}")
            return f"Diagnostic analysis failed: {str(e)}"

    def detect_language(self, text: str) -> dict:
        """
        Detect language for the given text. Returns ISO-ish language code and English language name.
        """
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
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt
            )
            raw = (response.text or "").strip()
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            parsed = json.loads(match.group(0) if match else raw)
            code = str(parsed.get("code", "en")).lower()
            name = str(parsed.get("name", "English"))
            if not code:
                code = "en"
            if not name:
                name = "English"
            return {"code": code, "name": name}
        except Exception as e:
            print(f"[GeminiService] Language detection error: {e}")
            return {"code": "en", "name": "English"}

    def translate_to_english(self, text: str, source_language: str | None = None) -> str:
        """
        Translate user text to English while preserving technical terms.
        """
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
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt
            )
            translated = (response.text or "").strip()
            return translated or text
        except Exception as e:
            print(f"[GeminiService] Translation error: {e}")
            return text
