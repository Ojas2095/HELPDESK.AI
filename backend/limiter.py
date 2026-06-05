"""
Rate limiter configuration — shared global instance.
Extracted to avoid circular imports between main.py and routers.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

# Single global limiter instance (used by main.py and all routers)
limiter = Limiter(key_func=get_remote_address)

# Shared limit constants
ML_HEAVY_LIMIT = "10/minute"   # NLP, OCR, Gemini — GPU/CPU intensive
ML_LIGHT_LIMIT = "30/minute"   # Similar incident search — lighter
