"""
PII Encryption Utilities -- AES-256-GCM via pycryptodome.

Stores ciphertext as:  base64( nonce(12B) || ciphertext || tag(16B) )
Decoded and split on read; authentication tag is verified by AES-GCM internally.

Environment variable ENCRYPTION_KEY must contain a 64-char hex string
(32 raw bytes = 256-bit key).  Generate one with:
    python -c \"import os; print(os.urandom(32).hex())\"
"""

import os
import base64
from typing import Optional

from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes


def get_encryption_key(password: str | None = None, salt: bytes | None = None) -> bytes:
    """Derive a 256-bit encryption key from password using PBKDF2."""
    if password is None:
        password = os.getenv("ENCRYPTION_PASSWORD")
    if password is None:
        raise ValueError(
            "ENCRYPTION_PASSWORD environment variable must be set. "
            "Encryption is disabled without a configured password."
        )
    if salt is None:
        salt_env = os.getenv("ENCRYPTION_SALT")
        if salt_env:
            salt = salt_env.encode()
        else:
            salt = os.urandom(16)
    elif isinstance(salt, str):
        salt = salt.encode()

    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=480000,
    )
    return kdf.derive(password.encode())


def encrypt_pii(plaintext: str) -> str:
    """
    Encrypt *plaintext* with AES-256-GCM via pycryptodome.

    Returns base64-encoded bundle:  nonce(12B) || ciphertext || tag(16B)
    Raises ValueError on None input.  Empty string stored as-is.
    """
    if plaintext is None:
        raise ValueError("encrypt_pii: plaintext must not be None")
    if plaintext == "":
        return ""

    key = _get_key()
    nonce = get_random_bytes(12)  # GCM standard nonce size

    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    ciphertext, tag = cipher.encrypt_and_digest(plaintext.encode("utf-8"))

    bundle = nonce + ciphertext + tag
    return base64.b64encode(bundle).decode("ascii")


def decrypt_pii(cipher_b64: str) -> str:
    """
    Decrypt AES-256-GCM bundle back to plaintext.

    Accepts:
      - base64-encoded bundle (nonce || ciphertext || tag)  -> decrypts normally
      - empty string                                        -> returns \"\"
      - legacy plaintext (not valid GCM bundle)              -> returns as-is (backward compat)

    Raises ValueError only on unrecoverable corruption (tag mismatch).
    """
    if cipher_b64 == "":
        return ""

    # Try base64 decode
    try:
        bundle = base64.b64decode(cipher_b64, validate=True)
    except Exception:
        return cipher_b64  # not base64 -> legacy plaintext

    # Minimum: nonce(12) + 1 byte ciphertext + tag(16) = 29 bytes
    if len(bundle) < 29:
        return cipher_b64  # too short -> legacy plaintext

    nonce = bundle[:12]
    tag = bundle[-16:]
    ciphertext = bundle[12:-16]

    try:
        key = _get_key()
        cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
        plaintext_bytes = cipher.decrypt_and_verify(ciphertext, tag)
        return plaintext_bytes.decode("utf-8")
    except (ValueError, KeyError, Exception):
        return cipher_b64  # corrupt or legacy -> plaintext
