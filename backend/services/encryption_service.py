"""
AES-256-GCM Encryption Service — secure payload encryption/decryption
for database backups and storage pipelines.

Uses pycryptodome library for AES-GCM authenticated encryption.
"""

import os
import base64
from typing import Optional, Tuple
from dotenv import load_dotenv

load_dotenv()

# ─── Configuration ───────────────────────────────────────────────

# Key must be exactly 32 bytes for AES-256
_ENCRYPTION_KEY_ENV = "ENCRYPTION_KEY"


def _get_key() -> Optional[bytes]:
    """Retrieve the encryption key from environment."""
    key_str = os.getenv(_ENCRYPTION_KEY_ENV)
    if not key_str:
        return None
    try:
        return base64.b64decode(key_str)
    except Exception:
        pass
    # Fallback: treat as raw string, pad/truncate to 32 bytes
    key = key_str.encode("utf-8")
    if len(key) < 32:
        key = key.ljust(32, b"\0")[:32]
    return key[:32]


# ─── Core Functions ───────────────────────────────────────────────

def encrypt(plaintext: str) -> Optional[str]:
    """
    Encrypt a plaintext string using AES-256-GCM.

    Args:
        plaintext: String to encrypt.

    Returns:
        Base64-encoded ciphertext in format "nonce|ciphertext|tag",
        or None if encryption key is not configured.
    """
    key = _get_key()
    if not key:
        return None

    from Crypto.Cipher import AES

    data = plaintext.encode("utf-8")
    cipher = AES.new(key, AES.MODE_GCM)
    ciphertext, tag = cipher.encrypt_and_digest(data)

    # Encode as base64: nonce|ciphertext|tag
    result = "|".join(
        base64.b64encode(part).decode("ascii")
        for part in (cipher.nonce, ciphertext, tag)
    )
    return result


def decrypt(encoded: str) -> Optional[str]:
    """
    Decrypt a payload previously encrypted with encrypt().

    Args:
        encoded: Base64-encoded ciphertext (format: "nonce|ciphertext|tag").

    Returns:
        Decrypted plaintext string, or None if key is missing or
        decryption fails (e.g., tampered data).
    """
    key = _get_key()
    if not key:
        return None

    from Crypto.Cipher import AES

    try:
        parts = encoded.split("|")
        if len(parts) != 3:
            return None
        nonce = base64.b64decode(parts[0])
        ciphertext = base64.b64decode(parts[1])
        tag = base64.b64decode(parts[2])

        cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
        plaintext = cipher.decrypt_and_verify(ciphertext, tag)
        return plaintext.decode("utf-8")
    except (ValueError, KeyError, Exception):
        return None


def redact_and_encrypt(plaintext: str) -> Optional[str]:
    """
    Redact PII from text, then encrypt the result.

    Convenience function combining pii_redactor and encryption.

    Args:
        plaintext: Input text potentially containing PII.

    Returns:
        Encrypted string with PII already removed, or None if encryption fails.
    """
    from pii_redactor import redact_pii

    cleaned = redact_pii(plaintext)
    return encrypt(cleaned)


def is_encryption_available() -> bool:
    """Check if encryption key is configured."""
    return _get_key() is not None


def generate_key() -> str:
    """Generate a new random AES-256 key as base64 string."""
    key = os.urandom(32)
    return base64.b64encode(key).decode("ascii")