import base64
import io
import logging
from typing import Optional

import google.generativeai as genai
from PIL import Image

# Prevent decompression bomb attacks
Image.MAX_IMAGE_PIXELS = 50_000_000  # ~50 megapixels max

from backend.config import settings

logger = logging.getLogger(__name__)

# Initialize Gemini API
genai.configure(api_key=settings.GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-2.0-flash")


def analyze_image(image_base64: str, prompt: str = "Describe this image in detail.") -> Optional[str]:
    """
    Analyze an image using Gemini's vision capabilities.
    
    Args:
        image_base64: Base64 encoded image string
        prompt: Text prompt for Gemini model
        
    Returns:
        Generated text response or None if analysis fails
    """
    try:
        image_bytes = base64.b64decode(image_base64)
        
        # Validate image size (max 10MB)
        MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
        if len(image_bytes) > MAX_IMAGE_SIZE:
            raise ValueError(f"Image too large: {len(image_bytes)} bytes (max {MAX_IMAGE_SIZE})")
        
        # Validate magic bytes (JPEG/PNG/WebP/GIF)
        VALID_MAGIC_BYTES = [
            b'\xff\xd8\xff',  # JPEG
            b'\x89PNG',       # PNG
            b'RIFF',          # WebP (RIFF header)
            b'GIF8',          # GIF
        ]
        has_valid_magic = any(image_bytes.startswith(m) for m in VALID_MAGIC_BYTES)
        if not has_valid_magic:
            raise ValueError("Invalid image format: not a recognized image file")
        
        img = Image.open(io.BytesIO(image_bytes))
        img.verify()
        img = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if necessary (remove alpha channel for RGBA images)
        if img.mode in ('RGBA', 'LA', 'P'):
            img = img.convert('RGB')
        
        # Generate content with image and prompt
        response = model.generate_content([prompt, img])
        
        return response.text
        
    except ValueError as e:
        logger.error(f"Invalid image: {e}")
        raise
    except Exception as e:
        logger.error(f"Failed to analyze image: {e}")
        return None
