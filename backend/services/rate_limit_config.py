"""
Rate Limit Configuration — Centralised rate limit definitions with per-environment overrides.

Uses environment variables to allow tuning without code changes:
  RATE_LIMIT_AI      — limit string for AI endpoints (default: "10/minute")
  RATE_LIMIT_TICKETS — limit string for ticket CRUD (default: "30/minute")
  RATE_LIMIT_AUTH    — limit string for auth endpoints (default: "5/minute")

Format: "N/period" where period is second|minute|hour|day
"""

import os
import logging

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
_DEFAULT_AI = "10/minute"
_DEFAULT_TICKETS = "30/minute"
_DEFAULT_AUTH = "5/minute"


def _parse_limit(env_key: str, default: str) -> str:
    """
    Read a rate limit string from an environment variable.
    Validates the format "N/period" — falls back to default on invalid input.
    """
    raw = os.getenv(env_key, "").strip()
    if not raw:
        return default

    parts = raw.split("/")
    if len(parts) == 2:
        count_str, period = parts
        valid_periods = {"second", "minute", "hour", "day"}
        try:
            int(count_str)
            if period in valid_periods:
                return raw
        except ValueError:
            pass

    logger.warning(
        f"[rate_limit_config] Invalid value for {env_key}='{raw}'. "
        f"Using default: '{default}'."
    )
    return default


# ---------------------------------------------------------------------------
# Resolved limits (read once at import time)
# ---------------------------------------------------------------------------

#: Rate limit for AI analysis endpoints (10 req/min default)
RATE_LIMIT_AI: str = _parse_limit("RATE_LIMIT_AI", _DEFAULT_AI)

#: Rate limit for ticket CRUD endpoints (30 req/min default)
RATE_LIMIT_TICKETS: str = _parse_limit("RATE_LIMIT_TICKETS", _DEFAULT_TICKETS)

#: Rate limit for authentication endpoints (5 req/min default — brute-force protection)
RATE_LIMIT_AUTH: str = _parse_limit("RATE_LIMIT_AUTH", _DEFAULT_AUTH)


def get_all() -> dict:
    """Return all current rate limit settings as a dict."""
    return {
        "ai": RATE_LIMIT_AI,
        "tickets": RATE_LIMIT_TICKETS,
        "auth": RATE_LIMIT_AUTH,
    }


def get_retry_after_seconds(limit_str: str) -> int:
    """
    Estimate the retry-after period in seconds for a rate limit string.

    Examples:
        "10/minute" → 60
        "5/minute"  → 60
        "100/hour"  → 3600
    """
    period_seconds = {
        "second": 1,
        "minute": 60,
        "hour": 3600,
        "day": 86400,
    }
    parts = limit_str.split("/")
    if len(parts) == 2:
        return period_seconds.get(parts[1], 60)
    return 60
