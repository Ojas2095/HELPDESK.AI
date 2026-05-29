"""
AES-256-GCM payload encryption/decryption for Supabase backup pipelines.

Usage:
    from backend.utils.encryption import encrypt_payload, decrypt_payload

    ciphertext = encrypt_payload(json.dumps(ticket_data))
    plain      = decrypt_payload(ciphertext)

Environment variable required:
    BACKUP_ENCRYPTION_KEY  — 32-byte hex string (64 hex chars)
                             Generate with: python -c "import secrets; print(secrets.token_hex(32))"
"""

import os
import base64
import json
from typing import Union

try:
    from Crypto.Cipher import AES
    from Crypto.Random import get_random_bytes
    _PYCRYPTODOME_AVAILABLE = True
except ImportError:
    _PYCRYPTODOME_AVAILABLE = False


_KEY_ENV = "BACKUP_ENCRYPTION_KEY"
_TAG_LEN = 16  # GCM authentication tag length in bytes
_NONCE_LEN = 12  # GCM recommended nonce length in bytes


def _load_key() -> bytes:
    """Load the 256-bit key from the environment, raising clearly on misconfiguration."""
    hex_key = os.environ.get(_KEY_ENV, "")
    if not hex_key:
        raise EnvironmentError(
            f"Environment variable '{_KEY_ENV}' is not set. "
            "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
        )
    raw = bytes.fromhex(hex_key)
    if len(raw) != 32:
        raise ValueError(
            f"'{_KEY_ENV}' must be a 64-character hex string representing 32 bytes. "
            f"Got {len(raw)} bytes."
        )
    return raw


def encrypt_payload(plaintext: Union[str, bytes]) -> str:
    """
    Encrypt *plaintext* with AES-256-GCM.

    Returns a base64-encoded string in the format:
        <nonce_b64>.<ciphertext_b64>.<tag_b64>

    Raises RuntimeError if pycryptodome is not installed.
    """
    if not _PYCRYPTODOME_AVAILABLE:
        raise RuntimeError(
            "pycryptodome is required for encryption. Install it: pip install pycryptodome"
        )

    if isinstance(plaintext, str):
        plaintext = plaintext.encode("utf-8")

    key = _load_key()
    nonce = get_random_bytes(_NONCE_LEN)
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce, mac_len=_TAG_LEN)
    ciphertext, tag = cipher.encrypt_and_digest(plaintext)

    def b64(b: bytes) -> str:
        return base64.urlsafe_b64encode(b).decode("ascii")

    return f"{b64(nonce)}.{b64(ciphertext)}.{b64(tag)}"


def decrypt_payload(token: str) -> str:
    """
    Decrypt an AES-256-GCM token produced by :func:`encrypt_payload`.

    Returns the original plaintext as a UTF-8 string.
    Raises ValueError on authentication failure (tampered data).
    """
    if not _PYCRYPTODOME_AVAILABLE:
        raise RuntimeError(
            "pycryptodome is required for decryption. Install it: pip install pycryptodome"
        )

    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Invalid token format. Expected '<nonce>.<ciphertext>.<tag>'.")

    def unb64(s: str) -> bytes:
        return base64.urlsafe_b64decode(s + "==")  # padding-tolerant

    nonce, ciphertext, tag = unb64(parts[0]), unb64(parts[1]), unb64(parts[2])
    key = _load_key()
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce, mac_len=_TAG_LEN)
    try:
        plaintext = cipher.decrypt_and_verify(ciphertext, tag)
    except ValueError as exc:
        raise ValueError("GCM authentication failed — data may have been tampered.") from exc

    return plaintext.decode("utf-8")


def encrypt_ticket_for_backup(ticket: dict) -> dict:
    """
    Return a backup envelope with the ticket JSON encrypted.

    Schema:
        {
            "ticket_id": "<id>",
            "encrypted": true,
            "algorithm": "AES-256-GCM",
            "payload": "<nonce>.<ciphertext>.<tag>"
        }
    """
    payload = json.dumps(ticket, default=str)
    return {
        "ticket_id": ticket.get("ticket_id") or ticket.get("id", "unknown"),
        "encrypted": True,
        "algorithm": "AES-256-GCM",
        "payload": encrypt_payload(payload),
    }


def decrypt_ticket_from_backup(envelope: dict) -> dict:
    """Reverse of :func:`encrypt_ticket_for_backup`."""
    if not envelope.get("encrypted"):
        return envelope
    return json.loads(decrypt_payload(envelope["payload"]))
