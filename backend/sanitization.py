"""
Input sanitization utilities for HELPDESK.AI.

Provides defense-in-depth against XSS and injection attacks by sanitizing
user-generated content before storage. React's JSX auto-escaping provides
client-side protection, but server-side sanitization ensures safety even if
content is consumed by non-React clients (API consumers, mobile apps, etc.).

Addresses: https://github.com/ritesh-1918/HELPDESK.AI/issues/739
"""

import html
import re
from typing import Optional


# Regex patterns for dangerous content
_SCRIPT_TAG_RE = re.compile(r"<\s*script[^>]*>.*?<\s*/\s*script\s*>", re.IGNORECASE | re.DOTALL)
_EVENT_HANDLER_RE = re.compile(r"\bon\w+\s*=", re.IGNORECASE)
_JAVASCRIPT_URI_RE = re.compile(r"javascript\s*:", re.IGNORECASE)
_DATA_URI_RE = re.compile(r"data\s*:\s*text/html", re.IGNORECASE)
_STYLE_EXPRESSION_RE = re.compile(r"expression\s*\(", re.IGNORECASE)
_HTML_TAG_RE = re.compile(r"<[^>]+>")


def sanitize_text(text: Optional[str], *, strip_html: bool = True, max_length: int = 10000) -> Optional[str]:
    """Sanitize user-generated text content.

    Args:
        text: Raw user input to sanitize.
        strip_html: If True, remove all HTML tags. If False, escape them.
        max_length: Maximum allowed length (truncates beyond this).

    Returns:
        Sanitized text, or None if input was None.
    """
    if text is None:
        return None

    # Normalize unicode whitespace
    text = text.strip()

    if not text:
        return text

    # Truncate to max length
    if len(text) > max_length:
        text = text[:max_length]

    # Remove script tags and their content
    text = _SCRIPT_TAG_RE.sub("", text)

    # Remove event handlers (onclick, onerror, onload, etc.)
    text = _EVENT_HANDLER_RE.sub("", text)

    # Remove javascript: URIs
    text = _JAVASCRIPT_URI_RE.sub("", text)

    # Remove data:text/html URIs
    text = _DATA_URI_RE.sub("", text)

    # Remove CSS expression() attacks
    text = _STYLE_EXPRESSION_RE.sub("", text)

    if strip_html:
        # Remove all remaining HTML tags
        text = _HTML_TAG_RE.sub("", text)
    else:
        # Escape HTML entities instead of stripping
        text = html.escape(text, quote=True)

    return text


def sanitize_ticket_data(data: dict, *, fields: Optional[list[str]] = None) -> dict:
    """Sanitize ticket-related fields in a dictionary.

    Applies sanitization to common user-content fields. Specify ``fields``
    to override which keys are sanitized.

    Args:
        data: Dictionary with ticket data.
        fields: List of keys to sanitize. Defaults to common text fields.

    Returns:
        New dictionary with sanitized values (original is not modified).
    """
    if fields is None:
        fields = [
            "text", "description", "subject", "summary",
            "company", "category", "priority",
        ]

    sanitized = dict(data)
    for field in fields:
        if field in sanitized and isinstance(sanitized[field], str):
            sanitized[field] = sanitize_text(sanitized[field])

    return sanitized


def get_security_headers() -> dict[str, str]:
    """Return recommended security headers for HTTP responses.

    Includes Content-Security-Policy, X-Content-Type-Options, and others
    that mitigate XSS even if sanitization is bypassed.
    """
    return {
        "Content-Security-Policy": (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self' wss: ws: https:; "
            "frame-ancestors 'none';"
        ),
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
    }
