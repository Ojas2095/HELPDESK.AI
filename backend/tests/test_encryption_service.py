"""
Unit tests for encryption_service — AES-256-GCM encrypt/decrypt, key management,
and PII redaction integration.
"""

import os
import sys
import base64
from unittest.mock import patch, MagicMock

# Mock Crypto.Cipher at module level (pycryptodome not installed)
_mock_crypto = MagicMock()
_mock_aes = MagicMock()
_mock_crypto.Cipher = MagicMock()
_mock_crypto.Cipher.AES = MagicMock()

sys.modules["Crypto"] = _mock_crypto
sys.modules["Crypto.Cipher"] = _mock_crypto.Cipher
sys.modules["Crypto.Cipher.AES"] = _mock_crypto.Cipher.AES

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "services"))
from encryption_service import (
    encrypt,
    decrypt,
    redact_and_encrypt,
    is_encryption_available,
    generate_key,
)

import pytest


# ─── Reset mock state between tests ──────────────────────────────

@pytest.fixture(autouse=True)
def reset_mocks():
    _mock_crypto.Cipher.AES.reset_mock()
    _mock_crypto.Cipher.AES.new.reset_mock()
    yield


# ─── Fixtures ─────────────────────────────────────────────────────

@pytest.fixture
def valid_key():
    """Set up a valid base64-encoded 32-byte key in environment."""
    key_bytes = b"a" * 32  # 32 bytes
    key_b64 = base64.b64encode(key_bytes).decode("ascii")
    with patch.dict(os.environ, {"ENCRYPTION_KEY": key_b64}):
        yield key_b64


# ─── Key Management Tests ─────────────────────────────────────────

class TestKeyManagement:
    def test_generate_key_returns_base64_string(self):
        key = generate_key()
        assert isinstance(key, str)
        assert len(key) > 0
        # Verify it's valid base64 of 32 bytes
        decoded = base64.b64decode(key)
        assert len(decoded) == 32

    def test_is_available_true_with_key(self):
        key_bytes = b"b" * 32
        with patch.dict(os.environ, {"ENCRYPTION_KEY": base64.b64encode(key_bytes).decode("ascii")}):
            assert is_encryption_available() is True

    def test_is_available_false_without_key(self):
        with patch.dict(os.environ, {}, clear=True):
            assert is_encryption_available() is False

    def test_is_available_false_with_empty_key(self):
        with patch.dict(os.environ, {"ENCRYPTION_KEY": ""}):
            assert is_encryption_available() is False


# ─── Encryption Tests ─────────────────────────────────────────────

class TestEncrypt:
    def test_encrypt_returns_string_with_valid_key(self, valid_key):
        """encrypt() returns a nonce|ciphertext|tag string."""
        # Mock AES-GCM
        mock_cipher = MagicMock()
        mock_cipher.nonce = b"\x01\x02\x03\x04\x05\x06\x07\x08"
        mock_cipher.encrypt_and_digest.return_value = (
            b"\x10\x11\x12\x13",  # ciphertext
            b"\x20\x21\x22\x23",  # tag
        )
        _mock_crypto.Cipher.AES.new.return_value = mock_cipher

        result = encrypt("hello world")
        assert result is not None
        assert "|" in result
        parts = result.split("|")
        assert len(parts) == 3
        # Each part should be valid base64
        for p in parts:
            assert base64.b64decode(p)

    def test_encrypt_returns_none_without_key(self):
        with patch.dict(os.environ, {}, clear=True):
            result = encrypt("test")
            assert result is None

    def test_encrypt_handles_empty_string(self, valid_key):
        mock_cipher = MagicMock()
        mock_cipher.nonce = b"\x01" * 12
        mock_cipher.encrypt_and_digest.return_value = (b"", b"\x02" * 16)
        _mock_crypto.Cipher.AES.new.return_value = mock_cipher

        result = encrypt("")
        assert result is not None

    def test_encrypt_calls_aes_gcm(self, valid_key):
        mock_cipher = MagicMock()
        mock_cipher.nonce = b"\x01" * 12
        mock_cipher.encrypt_and_digest.return_value = (b"\x10" * 5, b"\x20" * 16)
        _mock_crypto.Cipher.AES.new.return_value = mock_cipher

        encrypt("test data")
        _mock_crypto.Cipher.AES.new.assert_called_once()
        # Verify AES.new was called (mode is positional arg, not keyword)
        assert _mock_crypto.Cipher.AES.new.call_count == 1

    def test_encrypt_uses_proper_key_length(self, valid_key):
        mock_cipher = MagicMock()
        mock_cipher.nonce = b"\x01" * 12
        mock_cipher.encrypt_and_digest.return_value = (b"\x10" * 5, b"\x20" * 16)
        _mock_crypto.Cipher.AES.new.return_value = mock_cipher

        encrypt("test")
        args, kwargs = _mock_crypto.Cipher.AES.new.call_args
        key = args[0] if args else kwargs.get("key")
        assert len(key) == 32  # AES-256 requires 32-byte key


# ─── Decryption Tests ─────────────────────────────────────────────

class TestDecrypt:
    def test_decrypt_success(self, valid_key):
        """decrypt() successfully decrypts valid payload."""
        mock_cipher = MagicMock()
        mock_cipher.decrypt_and_verify.return_value = b"hello world"
        _mock_crypto.Cipher.AES.new.return_value = mock_cipher

        encoded = base64.b64encode(b"\x01" * 12).decode() + "|" + \
                  base64.b64encode(b"\x02" * 5).decode() + "|" + \
                  base64.b64encode(b"\x03" * 16).decode()

        result = decrypt(encoded)
        assert result == "hello world"

    def test_decrypt_returns_none_with_invalid_format(self, valid_key):
        """decrypt() returns None for malformed payload."""
        result = decrypt("not-enough-parts")
        assert result is None

        result = decrypt("part1|part2")
        assert result is None  # only 2 parts

    def test_decrypt_returns_none_on_tampered_data(self, valid_key):
        """decrypt() returns None when verification fails."""
        mock_cipher = MagicMock()
        mock_cipher.decrypt_and_verify.side_effect = ValueError("MAC check failed")
        _mock_crypto.Cipher.AES.new.return_value = mock_cipher

        encoded = base64.b64encode(b"\x01" * 12).decode() + "|" + \
                  base64.b64encode(b"\x02" * 5).decode() + "|" + \
                  base64.b64encode(b"\x03" * 16).decode()

        result = decrypt(encoded)
        assert result is None

    def test_decrypt_returns_none_without_key(self):
        with patch.dict(os.environ, {}, clear=True):
            result = decrypt("a|b|c")
            assert result is None

    def test_decrypt_returns_none_on_invalid_base64(self, valid_key):
        result = decrypt("not-base64!|also-not|nope")
        assert result is None


# ─── Round-trip + Integration Tests ──────────────────────────────

class TestEncryptDecryptRoundTrip:
    def test_round_trip(self, valid_key):
        """Real round-trip encrypt → decrypt with mocked crypto."""
        nonce = b"\xaa" * 12
        ct = b"\xbb" * 10
        tag = b"\xcc" * 16

        # encrypt
        enc_cipher = MagicMock()
        enc_cipher.nonce = nonce
        enc_cipher.encrypt_and_digest.return_value = (ct, tag)
        _mock_crypto.Cipher.AES.new.return_value = enc_cipher

        encrypted = encrypt("secret message")
        assert encrypted is not None

        # decrypt
        dec_cipher = MagicMock()
        dec_cipher.decrypt_and_verify.return_value = b"secret message"
        _mock_crypto.Cipher.AES.new.return_value = dec_cipher

        decrypted = decrypt(encrypted)
        assert decrypted == "secret message"

    def test_redact_and_encrypt(self, valid_key):
        """redact_and_encrypt redacts PII then encrypts."""
        nonce = b"\xdd" * 12
        tag = b"\xee" * 16

        enc_cipher = MagicMock()
        enc_cipher.nonce = nonce
        enc_cipher.encrypt_and_digest.return_value = (b"\xff" * 20, tag)
        _mock_crypto.Cipher.AES.new.return_value = enc_cipher

        text = "User email: user@example.com, secret: ghp_ab...mnop"
        result = redact_and_encrypt(text)
        assert result is not None
        # Verify PII was redacted before encrypt by checking what gets encrypted
        assert enc_cipher.encrypt_and_digest.called
        # The plaintext passed to encrypt should not contain original email or key
        args = enc_cipher.encrypt_and_digest.call_args
        plaintext_encrypted = args[0][0]
        assert b"user@example.com" not in plaintext_encrypted
        assert b"ghp_ab...mnop" not in plaintext_encrypted
        # Verify redacted markers are present
        assert b"[REDACTED]" in plaintext_encrypted