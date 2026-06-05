"""
HTML Input Sanitizer — prevents XSS in user-submitted ticket content.
"""
import re
import html


ALLOWED_TAGS = {"b", "i", "u", "strong", "em", "p", "br", "ul", "ol", "li", "code", "pre"}
DANGEROUS_PATTERNS = [
    r"<script[^>]*>.*?</script>",
    r"javascript:",
    r"on\w+\s*=",
    r"<iframe[^>]*>",
    r"<object[^>]*>",
    r"<embed[^>]*>",
    r"<link[^>]*>",
    r"<meta[^>]*>",
]


def sanitize_html(raw: str) -> str:
    """
    Strip dangerous HTML from user input while allowing safe formatting tags.

    Args:
        raw: Raw HTML string from user input.

    Returns:
        Sanitized HTML string safe for display.
    """
    if not raw:
        return ""

    # Remove dangerous patterns
    cleaned = raw
    for pattern in DANGEROUS_PATTERNS:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE | re.DOTALL)

    # Remove any remaining tags not in allowlist
    def replace_tag(m):
        tag = m.group(1).lower().split()[0] if m.group(1) else ""
        if tag in ALLOWED_TAGS:
            return m.group(0)
        return html.escape(m.group(0))

    cleaned = re.sub(r"<(/?\w[^>]*)>", replace_tag, cleaned)
    return cleaned.strip()


def sanitize_plain_text(raw: str) -> str:
    """Strip all HTML tags and return plain text only."""
    if not raw:
        return ""
    no_tags = re.sub(r"<[^>]+>", "", raw)
    return html.unescape(no_tags).strip()
