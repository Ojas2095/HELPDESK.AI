"""
PII Redaction Engine for HELPDESK.AI

Scans ticket descriptions, subjects, and raw text for Personally Identifiable
Information (PII) such as email addresses, phone numbers, and API keys,
replacing them with [REDACTED] tokens before storage or backup.

Part of bounty #632: AES-256-GCM Payload Encryption and PII Redaction
for Supabase Database Backups.
"""

import re
import logging
from typing import Any

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter("[PII Redaction] %(asctime)s - %(levelname)s - %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)

# ---------------------------------------------------------------------------
# PII Detection Patterns
# ---------------------------------------------------------------------------

# Email addresses: standard format with common TLDs
EMAIL_PATTERN = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}",
    re.IGNORECASE,
)

# Phone numbers: supports multiple international formats
#   +1-234-567-8901, +44 20 7946 0958, (555) 123-4567, 555.123.4567
PHONE_PATTERN = re.compile(
    r"(?:(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4})"
    r"|(?:\+?\d{1,3}[-.\s]?\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4})",
)

# API keys and tokens: common prefixes for cloud/service provider keys
API_KEY_PATTERNS = [
    # AWS Access Key ID (starts with AKIA)
    re.compile(r"AKIA[0-9A-Z]{16}", re.IGNORECASE),
    # AWS Secret Access Key (40 char base64)
    re.compile(r"(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[=:]\s*[A-Za-z0-9/+=]{40}"),
    # Google API Key (starts with AIza)
    re.compile(r"AIza[0-9A-Za-z\-_]{20,}", re.IGNORECASE),
    # GitHub Personal Access Token (ghp_ or gho_ or ghu_ or ghs_)
    re.compile(r"gh[posu]_[A-Za-z0-9_]{36,}", re.IGNORECASE),
    # Slack tokens (xoxb-, xoxp-, xoxa-)
    re.compile(r"xox[bpas]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,34}"),
    # Stripe keys (sk_live_, pk_live_)
    re.compile(r"(?:sk|pk)_(?:test|live)_[A-Za-z0-9]{24,}", re.IGNORECASE),
    # Generic Bearer tokens
    re.compile(r"Bearer\s+[A-Za-z0-9\-._~+/]+=*", re.IGNORECASE),
    # Supabase anon/service key pattern
    re.compile(r"eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+"),
]

# Credit card numbers (basic Luhn-agnostic pattern)
CREDIT_CARD_PATTERN = re.compile(
    r"\b(?:\d[ -]*?){13,19}\b",
)

# SSN pattern (US format: XXX-XX-XXXX)
SSN_PATTERN = re.compile(
    r"\b\d{3}-\d{2}-\d{4}\b",
)

# IP addresses (IPv4)
IP_PATTERN = re.compile(
    r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b",
)

# Redaction token
REDACTED = "[REDACTED]"


# ---------------------------------------------------------------------------
# Redaction Functions
# ---------------------------------------------------------------------------

def redact_emails(text: str) -> str:
    """Replace all email addresses with [REDACTED]."""
    if not isinstance(text, str):
        return text
    return EMAIL_PATTERN.sub(REDACTED, text)


def redact_phones(text: str) -> str:
    """Replace phone numbers with [REDACTED].

    Uses a conservative approach: only redact strings that look like
    actual phone numbers (7+ digits with separators) to avoid false
    positives on short numeric strings like ticket IDs.
    """
    if not isinstance(text, str):
        return text
    result = text
    for match in PHONE_PATTERN.finditer(text):
        candidate = match.group()
        # Count digits in the candidate
        digit_count = sum(c.isdigit() for c in candidate)
        # Only redact if it has at least 7 digits (valid phone number)
        if digit_count >= 7:
            result = result.replace(candidate, REDACTED, 1)
    return result


def redact_api_keys(text: str) -> str:
    """Replace detected API keys and tokens with [REDACTED]."""
    if not isinstance(text, str):
        return text
    result = text
    for pattern in API_KEY_PATTERNS:
        result = pattern.sub(REDACTED, result)
    return result


def redact_credit_cards(text: str) -> str:
    """Replace credit card number patterns with [REDACTED]."""
    if not isinstance(text, str):
        return text
    result = text
    for match in CREDIT_CARD_PATTERN.finditer(text):
        candidate = match.group()
        # Strip separators and check length
        digits_only = re.sub(r"[\s\-]", "", candidate)
        if 13 <= len(digits_only) <= 19 and digits_only.isdigit():
            result = result.replace(candidate, REDACTED, 1)
    return result


def redact_ssns(text: str) -> str:
    """Replace US Social Security Numbers with [REDACTED]."""
    if not isinstance(text, str):
        return text
    return SSN_PATTERN.sub(REDACTED, text)


def redact_ip_addresses(text: str) -> str:
    """Replace IPv4 addresses with [REDACTED].

    Skips private/internal IPs (10.x, 172.16-31.x, 192.168.x) as they
    are not typically PII.
    """
    if not isinstance(text, str):
        return text
    result = text
    for match in IP_PATTERN.finditer(text):
        ip = match.group()
        # Skip private IP ranges
        if ip.startswith("10.") or ip.startswith("192.168."):
            continue
        if ip.startswith("172."):
            octets = ip.split(".")
            if len(octets) >= 2 and 16 <= int(octets[1]) <= 31:
                continue
        result = result.replace(ip, REDACTED, 1)
    return result


def redact_all(text: str) -> str:
    """Apply all PII redaction patterns to the given text.

    Order matters: API keys first (most specific), then emails,
    SSNs, credit cards, phones, and finally IPs.
    """
    if not isinstance(text, str):
        return text
    result = text
    result = redact_api_keys(result)
    result = redact_emails(result)
    result = redact_ssns(result)
    result = redact_credit_cards(result)
    result = redact_phones(result)
    result = redact_ip_addresses(result)
    return result


# ---------------------------------------------------------------------------
# Row-Level Redaction
# ---------------------------------------------------------------------------

# Fields to scan for PII in ticket/backup rows
PII_TARGET_FIELDS = {
    "contact_email",
    "description",
    "raw_text",
    "subject",
    "customer_name",
    "phone",
}


def redact_row(row: dict) -> dict:
    """Redact PII from a dictionary row, returning a new dict.

    Only fields in PII_TARGET_FIELDS are processed.
    """
    if not isinstance(row, dict):
        return row
    new_row = dict(row)
    for field in PII_TARGET_FIELDS:
        if field in new_row and new_row[field] is not None:
            new_row[field] = redact_all(str(new_row[field]))
    return new_row


def _redact_value(value: Any) -> Any:
    """Recursively redact PII from any value type."""
    if isinstance(value, str):
        return redact_all(value)
    elif isinstance(value, dict):
        return {k: _redact_value(v) for k, v in value.items()}
    elif isinstance(value, list):
        return [_redact_value(item) for item in value]
    return value


def redact_payload(payload: Any) -> Any:
    """Redact PII from a payload (dict or list of dicts).
    
    Recursively processes all nested structures to ensure
    PII is redacted at every level.
    """
    return _redact_value(payload)
