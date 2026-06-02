"""
OCR Service — Local, CPU-only text extraction using EasyOCR.
No API key required. Runs entirely on the local machine.

Includes size validation and concurrency controls to prevent DoS via
oversized image payloads (CWE-400, CWE-770).
"""

import asyncio
import base64
import io
import logging

from PIL import Image

logger = logging.getLogger(__name__)

# ── Size limits ──────────────────────────────────────────────────────────────
MAX_BASE64_LENGTH = 10 * 1024 * 1024          # 10 MB base64 string (~7.5 MB binary)
MAX_DECODED_BYTES = 8 * 1024 * 1024            # 8 MB decoded image bytes
MAX_IMAGE_DIMENSION = 4096                      # max width or height in pixels
MAX_PIXELS = 4096 * 4096                        # ~16.7 MP — prevents decompression bombs
ALLOWED_CONTENT_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp", "image/tiff"}

# ── Concurrency / timeout ───────────────────────────────────────────────────
MAX_CONCURRENT_OCR = 2                          # EasyOCR is CPU-bound; limit parallel runs
OCR_TIMEOUT_SECONDS = 60                        # kill OCR if it hangs

# Lazy import: easyocr is only imported on first use (heavy initialization ~3-5 s)
_reader = None


def _get_reader():
    """Lazy-initialize EasyOCR reader in CPU-only mode."""
    global _reader
    if _reader is None:
        import easyocr
        logger.info("[OCRService] Initializing EasyOCR (CPU mode)... this may take a moment on first load.")
        _reader = easyocr.Reader(["en"], gpu=False)
        logger.info("[OCRService] Ready.")
    return _reader


class OCRService:
    def __init__(self):
        self._semaphore = asyncio.Semaphore(MAX_CONCURRENT_OCR)

    # ── internal: synchronous OCR run (called via executor) ──────────────────
    def _run_ocr(self, image_bytes: bytes) -> list[str]:
        reader = _get_reader()
        return reader.readtext(image_bytes, detail=0, paragraph=True)

    # ── public API ───────────────────────────────────────────────────────────
    async def extract_text(self, image_base64: str) -> str:
        """
        Extract all text from a base64-encoded image using EasyOCR.

        Applies strict size, dimension, and concurrency guards to prevent
        CPU starvation and memory exhaustion from malicious payloads.

        Returns:
            A single cleaned string of extracted text, or "" on failure.
        """
        if not image_base64 or not image_base64.strip():
            return ""

        image_base64 = image_base64.strip()

        # ── 1. Strip data-URI prefix ─────────────────────────────────────────
        content_type = None
        if "," in image_base64:
            header, image_base64 = image_base64.split(",", 1)
            # e.g. "data:image/png;base64"
            if ";base64" in header:
                content_type = header.split(";")[0].replace("data:", "")
                if content_type and content_type not in ALLOWED_CONTENT_TYPES:
                    logger.warning("[OCRService] Rejected: unsupported content type %s", content_type)
                    return ""

        # ── 2. Re-add padding ─────────────────────────────────────────────────
        missing_padding = len(image_base64) % 4
        if missing_padding:
            image_base64 += "=" * (4 - missing_padding)

        # ── 3. Validate base64 characters ─────────────────────────────────────
        _b64_chars = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=")
        if not all(c in _b64_chars for c in image_base64):
            logger.warning("[OCRService] Rejected: invalid base64 characters detected.")
            return ""

        # ── 4. Base64 length guard ────────────────────────────────────────────
        if len(image_base64) > MAX_BASE64_LENGTH:
            logger.warning(
                "[OCRService] Rejected: base64 length %d exceeds limit %d",
                len(image_base64), MAX_BASE64_LENGTH,
            )
            return ""

        try:
            # ── 5. Decode ─────────────────────────────────────────────────────
            image_bytes = base64.b64decode(image_base64)

            # ── 6. Decoded-bytes guard ────────────────────────────────────────
            if len(image_bytes) > MAX_DECODED_BYTES:
                logger.warning(
                    "[OCRService] Rejected: decoded size %d exceeds limit %d",
                    len(image_bytes), MAX_DECODED_BYTES,
                )
                return ""

            # ── 7. Image dimension & pixel-count guard (PIL) ──────────────────
            try:
                img = Image.open(io.BytesIO(image_bytes))
                img.verify()  # validate image integrity
                # Re-open after verify() (verify() consumes the stream)
                img = Image.open(io.BytesIO(image_bytes))
                width, height = img.size

                if width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION:
                    logger.warning(
                        "[OCRService] Rejected: image dimensions %dx%d exceed limit %d",
                        width, height, MAX_IMAGE_DIMENSION,
                    )
                    return ""

                if width * height > MAX_PIXELS:
                    logger.warning(
                        "[OCRService] Rejected: pixel count %d exceeds limit %d",
                        width * height, MAX_PIXELS,
                    )
                    return ""
            except Exception as img_err:
                logger.warning("[OCRService] Rejected: invalid or unreadable image — %s", img_err)
                return ""

            # ── 8. OCR with concurrency cap + timeout ─────────────────────────
            loop = asyncio.get_event_loop()
            async with self._semaphore:
                try:
                    results = await asyncio.wait_for(
                        loop.run_in_executor(None, self._run_ocr, image_bytes),
                        timeout=OCR_TIMEOUT_SECONDS,
                    )
                    extracted = " ".join(results).strip()
                    logger.info("[OCRService] Extracted %d chars from image.", len(extracted))
                    return extracted
                except asyncio.TimeoutError:
                    logger.warning("[OCRService] OCR timed out after %ds", OCR_TIMEOUT_SECONDS)
                    return ""

        except Exception as e:
            logger.warning("[OCRService] Error during OCR: %s", e)
            return ""
