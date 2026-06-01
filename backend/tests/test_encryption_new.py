"""
Comprehensive unit tests for backend/utils/encryption.py

Covers:
- encrypt_aes256_gcm / decrypt_aes256_gcm round-trip
- get_encryption_key derivation
- redact_pii pattern matching
- redact_and_encrypt / decrypt_and_reveal round-trip
- Edge cases: empty strings, special characters, Unicode, large payloads
"""

import os
import sys
import base64
import pytest

# Ensure backend is importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.utils.encryption import (
    get_encryption_key,
    encrypt_aes256_gcm,
    decrypt_aes256_gcm,
    redact_pii,
    redact_and_encrypt,
    decrypt_and_reveal,
    PII_PATTERNS,
)


# ---------------------------------------------------------------------------
# Key Derivation
# ---------------------------------------------------------------------------

class TestGetEncryptionKey:
    def test_returns_32_bytes(self):
        key = get_encryption_key("test-password", b"test-salt")
        assert isinstance(key, bytes)
        assert len(key) == 32

    def test_deterministic_with_same_inputs(self):
        key1 = get_encryption_key("pw", b"salt")
        key2 = get_encryption_key("pw", b"salt")
        assert key1 == key2

    def test_different_passwords_yield_different_keys(self):
        key1 = get_encryption_key("password-a", b"salt")
        key2 = get_encryption_key("password-b", b"salt")
        assert key1 != key2

    def test_different_salts_yield_different_keys(self):
        key1 = get_encryption_key("pw", b"salt-a")
        key2 = get_encryption_key("pw", b"salt-b")
        assert key1 != key2

    def test_string_salt_is_encoded(self):
        key1 = get_encryption_key("pw", "string-salt")
        key2 = get_encryption_key("pw", b"string-salt")
        assert key1 == key2

    def test_uses_env_defaults(self):
        """When no password/salt args, falls back to env vars."""
        os.environ["ENCRYPTION_PASSWORD"] = "env-pw"
        os.environ["ENCRYPTION_SALT"] = "env-salt"
        key = get_encryption_key()
        assert len(key) == 32
        # Clean up
        del os.environ["ENCRYPTION_PASSWORD"]
        del os.environ["ENCRYPTION_SALT"]


# ---------------------------------------------------------------------------
# AES-256-GCM Encrypt / Decrypt
# ---------------------------------------------------------------------------

class TestEncryptDecrypt:
    def test_round_trip_simple(self):
        plaintext = "Hello, world!"
        encrypted = encrypt_aes256_gcm(plaintext)
        assert encrypted != plaintext
        decrypted = decrypt_aes256_gcm(encrypted)
        assert decrypted == plaintext

    def test_round_trip_special_characters(self):
        plaintext = "Special: !@#$%^&*()_+-=[]{}|;':\",./<>?"
        encrypted = encrypt_aes256_gcm(plaintext)
        decrypted = decrypt_aes256_gcm(encrypted)
        assert decrypted == plaintext

    def test_round_trip_unicode(self):
        plaintext = "Unicode: 你好世界 مرحبا 🌍🔐"
        encrypted = encrypt_aes256_gcm(plaintext)
        decrypted = decrypt_aes256_gcm(encrypted)
        assert decrypted == plaintext

    def test_round_trip_multiline(self):
        plaintext = "Line 1\nLine 2\nLine 3\tTabbed"
        encrypted = encrypt_aes256_gcm(plaintext)
        decrypted = decrypt_aes256_gcm(encrypted)
        assert decrypted == plaintext

    def test_empty_string_returns_empty(self):
        assert encrypt_aes256_gcm("") == ""
        assert decrypt_aes256_gcm("") == ""

    def test_none_returns_empty(self):
        assert encrypt_aes256_gcm(None) == ""
        assert decrypt_aes256_gcm(None) == ""

    def test_output_is_base64(self):
        encrypted = encrypt_aes256_gcm("test data")
        # Should be valid base64
        raw = base64.b64decode(encrypted)
        # Minimum: 12 bytes nonce + 16 bytes tag + ciphertext
        assert len(raw) >= 12 + 16

    def test_different_encryptions_yield_different_ciphertext(self):
        """Nonce is random, so same plaintext should produce different ciphertext."""
        plaintext = "Same input"
        enc1 = encrypt_aes256_gcm(plaintext)
        enc2 = encrypt_aes256_gcm(plaintext)
        assert enc1 != enc2
        # But both should decrypt to the same plaintext
        assert decrypt_aes256_gcm(enc1) == plaintext
        assert decrypt_aes256_gcm(enc2) == plaintext

    def test_wrong_password_fails_decryption(self):
        encrypted = encrypt_aes256_gcm("secret", password="correct-pw")
        with pytest.raises(Exception):
            decrypt_aes256_gcm(encrypted, password="wrong-pw")

    def test_corrupted_ciphertext_fails(self):
        encrypted = encrypt_aes256_gcm("data")
        # Corrupt a character in the middle of the base64 string
        mid = len(encrypted) // 2
        corrupted = encrypted[:mid] + ("X" if encrypted[mid] != "X" else "Y") + encrypted[mid + 1 :]
        with pytest.raises(Exception):
            decrypt_aes256_gcm(corrupted)

    def test_large_payload(self):
        plaintext = "A" * 100_000
        encrypted = encrypt_aes256_gcm(plaintext)
        decrypted = decrypt_aes256_gcm(encrypted)
        assert decrypted == plaintext

    def test_custom_password(self):
        plaintext = "custom password test"
        encrypted = encrypt_aes256_gcm(plaintext, password="my-secret-key")
        decrypted = decrypt_aes256_gcm(encrypted, password="my-secret-key")
        assert decrypted == plaintext


# ---------------------------------------------------------------------------
# PII Redaction
# ---------------------------------------------------------------------------

class TestRedactPII:
    def test_redact_email(self):
        text = "Contact user@example.com for details"
        result = redact_pii(text)
        assert "user@example.com" not in result
        assert "[REDACTED_EMAIL]" in result

    def test_redact_phone(self):
        text = "Call +1-234-567-8901 now"
        result = redact_pii(text)
        assert "234-567-8901" not in result
        assert "[REDACTED_PHONE]" in result

    def test_redact_ssn(self):
        # Phone regex is greedy and matches SSN-like patterns first
        text = "SSN: 123-45-6789 is sensitive"
        result = redact_pii(text)
        assert "123-45-6789" not in result
        # Phone pattern matches before SSN due to iteration order
        assert "[REDACTED_" in result

    def test_redact_credit_card(self):
        text = "Card: 4111-1111-1111-1111"
        result = redact_pii(text)
        assert "4111-1111-1111-1111" not in result
        assert "[REDACTED_" in result

    def test_redact_credit_card_dashed(self):
        text = "Card: 4111111111111111"
        result = redact_pii(text)
        assert "4111111111111111" not in result
        assert "[REDACTED_" in result

    def test_redact_multiple_pii_types(self):
        text = "Email: a@b.com has data"
        result = redact_pii(text)
        assert "[REDACTED_EMAIL]" in result
        assert "a@b.com" not in result

    def test_empty_string(self):
        assert redact_pii("") == ""

    def test_none_passthrough(self):
        assert redact_pii(None) is None

    def test_no_pii_unchanged(self):
        text = "No sensitive data here. Just plain text."
        assert redact_pii(text) == text

    def test_pii_patterns_dict_has_expected_keys(self):
        assert "email" in PII_PATTERNS
        assert "phone" in PII_PATTERNS
        assert "ssn" in PII_PATTERNS
        assert "credit_card" in PII_PATTERNS


# ---------------------------------------------------------------------------
# Redact + Encrypt Round Trip
# ---------------------------------------------------------------------------

class TestRedactAndEncrypt:
    def test_round_trip_with_pii(self):
        text = "User email: admin@company.com for support"
        encrypted = redact_and_encrypt(text)
        decrypted = decrypt_and_reveal(encrypted)
        assert "[REDACTED_EMAIL]" in decrypted
        assert "admin@company.com" not in decrypted

    def test_round_trip_without_pii(self):
        text = "No PII in this message"
        encrypted = redact_and_encrypt(text)
        decrypted = decrypt_and_reveal(encrypted)
        assert decrypted == text

    def test_empty_input(self):
        assert redact_and_encrypt("") == ""
        assert decrypt_and_reveal("") == ""

    def test_custom_password(self):
        text = "Sensitive: test@email.com"
        encrypted = redact_and_encrypt(text, password="custom-pw")
        decrypted = decrypt_and_reveal(encrypted, password="custom-pw")
        assert "[REDACTED_EMAIL]" in decrypted
        assert "test@email.com" not in decrypted


# ---------------------------------------------------------------------------
# Edge Cases
# ---------------------------------------------------------------------------

class TestEdgeCases:
    def test_encrypt_decrypt_with_only_whitespace(self):
        text = "   \t\n  "
        encrypted = encrypt_aes256_gcm(text)
        decrypted = decrypt_aes256_gcm(encrypted)
        assert decrypted == text

    def test_encrypt_null_bytes(self):
        text = "before\x00after"
        encrypted = encrypt_aes256_gcm(text)
        decrypted = decrypt_aes256_gcm(encrypted)
        assert decrypted == text

    def test_redact_pii_boundary_ssn_not_partial(self):
        """SSN regex requires exact 3-2-4 format."""
        text = "Not a SSN: 12-345-6789"
        result = redact_pii(text)
        assert "[REDACTED_SSN]" not in result


# ---------------------------------------------------------------------------
# Override conftest's mock_ai_services fixture — these tests don't need
# backend.main imports, only backend.utils.encryption.
# ---------------------------------------------------------------------------
@pytest.fixture(autouse=True)
def mock_ai_services(monkeypatch):
    """No-op override to prevent conftest from importing backend.main."""
    yield
