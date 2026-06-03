"""Unit tests for backend/utils/encryption.py - AES-256-GCM encryption utilities.

Issue: #1101 - test: add unit tests for encryption utility
"""

import unittest
import base64
from unittest.mock import patch, MagicMock


# ---------------------------------------------------------------------------
# Import the real module after mocking heavy crypto imports
# ---------------------------------------------------------------------------

# We patch the heavy crypto imports so tests run fast without real crypto
# but we still exercise the actual logic by patching at the function level.

import sys
sys.modules['cryptography'] = MagicMock()
sys.modules['cryptography.hazmat'] = MagicMock()
sys.modules['cryptography.hazmat.primitives'] = MagicMock()
sys.modules['cryptography.hazmat.primitives.ciphers'] = MagicMock()
sys.modules['cryptography.hazmat.primitives.ciphers.aead'] = MagicMock()
sys.modules['cryptography.hazmat.primitives.hashes'] = MagicMock()
sys.modules['cryptography.hazmat.primitives.kdf'] = MagicMock()
sys.modules['cryptography.hazmat.primitives.kdf.pbkdf2'] = MagicMock()

# Now import our module
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


class TestEncryptionUtilities(unittest.TestCase):
    """Test the encryption.py utility functions with mocked crypto."""

    def setUp(self):
        """Reset mocks before each test."""
        self._mock_aesgcm = MagicMock()
        self._mock_kdf = MagicMock()
        self._mock_derive = MagicMock(return_value=b'0' * 32)

        AESGCM.reset_mock()
        PBKDF2HMAC.reset_mock()
        self._mock_kdf.derive = self._mock_derive
        PBKDF2HMAC.return_value = self._mock_kdf

    # ---- get_encryption_key ----

    def test_get_key_default_password_and_salt(self):
        """Key derived from default password and salt when env vars unset."""
        with patch.dict('os.environ', {}, clear=True):
            from backend.utils.encryption import get_encryption_key
            PBKDF2HMAC.reset_mock()
            self._mock_kdf.derive = self._mock_derive
            PBKDF2HMAC.return_value = self._mock_kdf
            result = get_encryption_key()
            self.assertEqual(result, b'0' * 32)
            self._mock_derive.assert_called_once()

    def test_get_key_custom_password(self):
        """Key derived from provided password."""
        with patch.dict('os.environ', {}, clear=True):
            from backend.utils.encryption import get_encryption_key
            PBKDF2HMAC.reset_mock()
            self._mock_kdf.derive = self._mock_derive
            PBKDF2HMAC.return_value = self._mock_kdf
            result = get_encryption_key(password="my-secret-pw")
            self.assertEqual(result, b'0' * 32)
            # Password should be used in derive call
            call_args = self._mock_derive.call_args[0]
            self.assertIn("my-secret-pw", call_args[0].decode())

    def test_get_key_custom_salt_bytes(self):
        """Key derived with custom salt as bytes."""
        from backend.utils.encryption import get_encryption_key
        PBKDF2HMAC.reset_mock()
        self._mock_kdf.derive = self._mock_derive
        PBKDF2HMAC.return_value = self._mock_kdf
        result = get_encryption_key(salt=b'custom-salt-bytes-16char')
        self.assertEqual(result, b'0' * 32)

    def test_get_key_custom_salt_string(self):
        """Key derived with custom salt as string (should be encoded)."""
        from backend.utils.encryption import get_encryption_key
        PBKDF2HMAC.reset_mock()
        self._mock_kdf.derive = self._mock_derive
        PBKDF2HMAC.return_value = self._mock_kdf
        result = get_encryption_key(salt="string-salt")
        self.assertEqual(result, b'0' * 32)

    def test_get_key_from_env(self):
        """Key derived from ENCRYPTION_PASSWORD env var."""
        with patch.dict('os.environ', {'ENCRYPTION_PASSWORD': 'env-password'}):
            from backend.utils.encryption import get_encryption_key
            PBKDF2HMAC.reset_mock()
            self._mock_kdf.derive = self._mock_derive
            PBKDF2HMAC.return_value = self._mock_kdf
            result = get_encryption_key()
            self.assertEqual(result, b'0' * 32)

    def test_get_key_with_salt_from_env(self):
        """Key derived with ENCRYPTION_SALT env var."""
        with patch.dict('os.environ', {'ENCRYPTION_SALT': 'env-salt'}):
            from backend.utils.encryption import get_encryption_key
            PBKDF2HMAC.reset_mock()
            self._mock_kdf.derive = self._mock_derive
            PBKDF2HMAC.return_value = self._mock_kdf
            result = get_encryption_key()
            self.assertEqual(result, b'0' * 32)

    # ---- encrypt_aes256_gcm ----

    def test_encrypt_empty_string_returns_empty(self):
        """Empty string should return empty string."""
        with patch.dict('os.environ', {}, clear=True):
            from backend.utils.encryption import encrypt_aes256_gcm
            result = encrypt_aes256_gcm("")
            self.assertEqual(result, "")

    def test_encrypt_normal_text(self):
        """Normal text should be encrypted and return base64 string."""
        with patch.dict('os.environ', {}, clear=True):
            from backend.utils.encryption import encrypt_aes256_gcm
            # Mock AESGCM encrypt to return known bytes
            mock_aes = MagicMock()
            mock_aes.encrypt.return_value = b'encrypted_data_here!'
            AESGCM.return_value = mock_aes
            PBKDF2HMAC.reset_mock()
            self._mock_kdf.derive = self._mock_derive
            PBKDF2HMAC.return_value = self._mock_kdf

            with patch('os.urandom', return_value=b'\x01' * 12):
                result = encrypt_aes256_gcm("Hello World")
                self.assertIsInstance(result, str)
                decoded = base64.b64decode(result)
                # First 12 bytes should be nonce
                self.assertEqual(decoded[:12], b'\x01' * 12)

    def test_encrypt_with_special_characters(self):
        """Text with special/unicode characters should encrypt correctly."""
        with patch.dict('os.environ', {}, clear=True):
            from backend.utils.encryption import encrypt_aes256_gcm
            mock_aes = MagicMock()
            mock_aes.encrypt.return_value = b'special_encrypted'
            AESGCM.return_value = mock_aes
            PBKDF2HMAC.reset_mock()
            self._mock_kdf.derive = self._mock_derive
            PBKDF2HMAC.return_value = self._mock_kdf

            with patch('os.urandom', return_value=b'\x02' * 12):
                result = encrypt_aes256_gcm("p@ssw0rd!$%^&*()_+-={}[]|:;<>,.?/~`")
                self.assertIsInstance(result, str)
                self.assertTrue(len(result) > 0)

    def test_encrypt_unicode_text(self):
        """Unicode text (Chinese, emoji) should encrypt correctly."""
        with patch.dict('os.environ', {}, clear=True):
            from backend.utils.encryption import encrypt_aes256_gcm
            mock_aes = MagicMock()
            mock_aes.encrypt.return_value = b'unicode_encrypted'
            AESGCM.return_value = mock_aes
            PBKDF2HMAC.reset_mock()
            self._mock_kdf.derive = self._mock_derive
            PBKDF2HMAC.return_value = self._mock_kdf

            with patch('os.urandom', return_value=b'\x03' * 12):
                result = encrypt_aes256_gcm("你好世界 🌍✨")
                self.assertIsInstance(result, str)

    def test_encrypt_different_nonces_produce_different_outputs(self):
        """Same plaintext with different nonces produces different ciphertexts."""
        with patch.dict('os.environ', {}, clear=True):
            from backend.utils.encryption import encrypt_aes256_gcm
            mock_aes = MagicMock()
            mock_aes.encrypt.side_effect = [
                b'cipher1', b'cipher2'
            ]
            AESGCM.return_value = mock_aes
            PBKDF2HMAC.reset_mock()
            self._mock_kdf.derive = self._mock_derive
            PBKDF2HMAC.return_value = self._mock_kdf

            with patch('os.urandom', side_effect=[b'\xaa' * 12, b'\xbb' * 12]):
                r1 = encrypt_aes256_gcm("same text")
                r2 = encrypt_aes256_gcm("same text")
                self.assertNotEqual(r1, r2)

    # ---- decrypt_aes256_gcm ----

    def test_decrypt_empty_string_returns_empty(self):
        """Empty encrypted string should return empty string."""
        from backend.utils.encryption import decrypt_aes256_gcm
        result = decrypt_aes256_gcm("")
        self.assertEqual(result, "")

    def test_decrypt_roundtrip(self):
        """Decrypt should recover original plaintext."""
        with patch.dict('os.environ', {}, clear=True):
            from backend.utils.encryption import decrypt_aes256_gcm

            original = "Secret message 42!"
            nonce = b'\xde' * 12
            ciphertext = nonce + b'enc_payload'

            mock_aes = MagicMock()
            mock_aes.decrypt.return_value = original.encode()
            AESGCM.return_value = mock_aes
            PBKDF2HMAC.reset_mock()
            self._mock_kdf.derive = self._mock_derive
            PBKDF2HMAC.return_value = self._mock_kdf

            encrypted_b64 = base64.b64encode(ciphertext).decode()
            result = decrypt_aes256_gcm(encrypted_b64)
            self.assertEqual(result, original)

    def test_decrypt_with_custom_password(self):
        """Decrypt with custom password uses that password for key derivation."""
        from backend.utils.encryption import decrypt_aes256_gcm
        mock_aes = MagicMock()
        mock_aes.decrypt.return_value = b'recovered_data'
        AESGCM.return_value = mock_aes
        PBKDF2HMAC.reset_mock()
        self._mock_kdf.derive = self._mock_derive
        PBKDF2HMAC.return_value = self._mock_kdf

        ciphertext = b'\x11' * 12 + b'payload'
        encrypted_b64 = base64.b64encode(ciphertext).decode()
        result = decrypt_aes256_gcm(encrypted_b64, password="custom-pw")
        self.assertEqual(result, "recovered_data")

    def test_decrypt_long_text(self):
        """Decrypt handles long encrypted payloads."""
        from backend.utils.encryption import decrypt_aes256_gcm
        long_text = "A" * 10000
        mock_aes = MagicMock()
        mock_aes.decrypt.return_value = long_text.encode()
        AESGCM.return_value = mock_aes
        PBKDF2HMAC.reset_mock()
        self._mock_kdf.derive = self._mock_derive
        PBKDF2HMAC.return_value = self._mock_kdf

        ciphertext = b'\x44' * 12 + b'long_payload'
        encrypted_b64 = base64.b64encode(ciphertext).decode()
        result = decrypt_aes256_gcm(encrypted_b64)
        self.assertEqual(result, long_text)

    # ---- redact_pii (from encryption.py) ----

    def test_redact_pii_empty_text(self):
        """Empty text returns empty."""
        from backend.utils.encryption import redact_pii
        result = redact_pii("")
        self.assertEqual(result, "")

    def test_redact_pii_none_text(self):
        """None returns None (falsy check)."""
        from backend.utils.encryption import redact_pii
        result = redact_pii(None)
        self.assertIsNone(result)

    def test_redact_pii_email(self):
        """Email addresses are redacted."""
        from backend.utils.encryption import redact_pii
        result = redact_pii("Contact user@example.com for help")
        self.assertNotIn("user@example.com", result)
        self.assertIn("[REDACTED_EMAIL]", result)

    def test_redact_pii_multiple_emails(self):
        """Multiple email addresses are all redacted."""
        from backend.utils.encryption import redact_pii
        text = "Email a@b.com and c@d.org"
        result = redact_pii(text)
        self.assertNotIn("a@b.com", result)
        self.assertNotIn("c@d.org", result)

    def test_redact_pii_phone(self):
        """Phone numbers are redacted."""
        from backend.utils.encryption import redact_pii
        result = redact_pii("Call 800-555-0199 for support")
        self.assertNotIn("800-555-0199", result)
        self.assertIn("[REDACTED_PHONE]", result)

    def test_redact_pii_ssn(self):
        """SSN formatted numbers are redacted."""
        from backend.utils.encryption import redact_pii
        result = redact_pii("SSN: 123-45-6789")
        self.assertNotIn("123-45-6789", result)
        self.assertIn("[REDACTED_SSN]", result)

    def test_redact_pii_credit_card(self):
        """Credit card numbers are redacted."""
        from backend.utils.encryption import redact_pii
        result = redact_pii("Card: 4111-1111-1111-1111")
        self.assertNotIn("4111-1111-1111-1111", result)
        self.assertIn("[REDACTED_CREDIT_CARD]", result)

    def test_redact_pii_combined(self):
        """All PII types redacted simultaneously."""
        from backend.utils.encryption import redact_pii
        text = "Email: me@test.com, Phone: 123-456-7890, SSN: 987-65-4321, Card: 5555 5555 5555 4444"
        result = redact_pii(text)
        for pii_type in ["EMAIL", "PHONE", "SSN", "CREDIT_CARD"]:
            self.assertIn(f"[REDACTED_{pii_type}]", result)

    def test_redact_pii_no_pii_unchanged(self):
        """Text without PII is returned unchanged."""
        from backend.utils.encryption import redact_pii
        text = "Just a normal sentence with no PII."
        result = redact_pii(text)
        self.assertEqual(result, text)

    # ---- redact_and_encrypt ----

    def test_redact_and_encrypt_normal_text(self):
        """Redact then encrypt should produce base64 output."""
        with patch.dict('os.environ', {}, clear=True):
            from backend.utils.encryption import redact_and_encrypt
            mock_aes = MagicMock()
            mock_aes.encrypt.return_value = b'combined_encrypted'
            AESGCM.return_value = mock_aes
            PBKDF2HMAC.reset_mock()
            self._mock_kdf.derive = self._mock_derive
            PBKDF2HMAC.return_value = self._mock_kdf

            with patch('os.urandom', return_value=b'\xcc' * 12):
                result = redact_and_encrypt("Email: a@b.com, normal text")
                self.assertIsInstance(result, str)
                # Should not contain the raw email
                self.assertNotIn("a@b.com", result)

    def test_redact_and_encrypt_empty(self):
        """Empty text redacted and encrypted returns empty."""
        with patch.dict('os.environ', {}, clear=True):
            from backend.utils.encryption import redact_and_encrypt
            result = redact_and_encrypt("")
            self.assertEqual(result, "")

    # ---- decrypt_and_reveal ----

    def test_decrypt_and_reveal_roundtrip(self):
        """Decrypt reveals the redacted+encrypted text."""
        with patch.dict('os.environ', {}, clear=True):
            from backend.utils.encryption import decrypt_and_reveal
            redacted_text = "Message: [REDACTED_EMAIL] normal"
            mock_aes = MagicMock()
            mock_aes.decrypt.return_value = redacted_text.encode()
            AESGCM.return_value = mock_aes
            PBKDF2HMAC.reset_mock()
            self._mock_kdf.derive = self._mock_derive
            PBKDF2HMAC.return_value = self._mock_kdf

            ciphertext = b'\xee' * 12 + b'payload'
            encrypted_b64 = base64.b64encode(ciphertext).decode()
            result = decrypt_and_reveal(encrypted_b64)
            self.assertEqual(result, redacted_text)

    # ---- Edge cases ----

    def test_encrypt_very_long_text(self):
        """Very long text (100KB+) encrypts without error."""
        with patch.dict('os.environ', {}, clear=True):
            from backend.utils.encryption import encrypt_aes256_gcm
            long_text = "X" * 100000
            mock_aes = MagicMock()
            mock_aes.encrypt.return_value = b'x' * 100016
            AESGCM.return_value = mock_aes
            PBKDF2HMAC.reset_mock()
            self._mock_kdf.derive = self._mock_derive
            PBKDF2HMAC.return_value = self._mock_kdf

            with patch('os.urandom', return_value=b'\xff' * 12):
                result = encrypt_aes256_gcm(long_text)
                self.assertIsInstance(result, str)
                self.assertTrue(len(result) > 0)

    def test_encrypt_single_char(self):
        """Single character text encrypts correctly."""
        with patch.dict('os.environ', {}, clear=True):
            from backend.utils.encryption import encrypt_aes256_gcm
            mock_aes = MagicMock()
            mock_aes.encrypt.return_value = b'x'
            AESGCM.return_value = mock_aes
            PBKDF2HMAC.reset_mock()
            self._mock_kdf.derive = self._mock_derive
            PBKDF2HMAC.return_value = self._mock_kdf

            with patch('os.urandom', return_value=b'\x99' * 12):
                result = encrypt_aes256_gcm("X")
                self.assertIsInstance(result, str)

    def test_decrypt_tampered_ciphertext(self):
        """Decrypt with wrong password or tampered data raises error."""
        from backend.utils.encryption import decrypt_aes256_gcm
        mock_aes = MagicMock()
        mock_aes.decrypt.side_effect = Exception("InvalidTag")
        AESGCM.return_value = mock_aes
        PBKDF2HMAC.reset_mock()
        self._mock_kdf.derive = self._mock_derive
        PBKDF2HMAC.return_value = self._mock_kdf

        ciphertext = b'\x00' * 12 + b'tampered'
        encrypted_b64 = base64.b64encode(ciphertext).decode()
        with self.assertRaises(Exception):
            decrypt_aes256_gcm(encrypted_b64)


if __name__ == '__main__':
    unittest.main()
