import os
import unittest
from unittest.mock import patch, MagicMock

# Set test key
os.environ["DB_ENCRYPTION_SECRET_KEY"] = "super-secret-test-key-32-bytes"

from backend.auth.crypto import encrypt, decrypt, apply_db_encryption_patch
apply_db_encryption_patch()

from supabase import create_client

class TestCryptoPII(unittest.TestCase):
    def test_aes_encryption_decryption(self):
        plain = "sensitive PII text"
        enc = encrypt(plain)
        self.assertNotEqual(plain, enc)
        
        dec = decrypt(enc)
        self.assertEqual(plain, dec)
        
    def test_graceful_decrypt_plaintext(self):
        # Decrypting plain text should just return it as-is
        plain = "not encrypted text"
        dec = decrypt(plain)
        self.assertEqual(plain, dec)

    @patch("httpx.Client.send")
    def test_transparent_hooks(self, mock_send):
        import httpx
        # Initialize client with dummy credentials
        client = create_client("https://dummy.supabase.co", "apikey")
        builder = client.table("tickets")
        
        # Test Insert Hook
        payload = {
            "contact_email": "pii@email.com",
            "description": "My secret PII",
            "raw_text": "Sensitive raw PII"
        }
        
        # Mock httpx Response returning encrypted data from server
        mock_response = httpx.Response(
            status_code=201,
            json=[{
                "id": "1",
                "contact_email": encrypt("pii@email.com"),
                "description": encrypt("My secret PII"),
                "raw_text": encrypt("Sensitive raw PII")
            }],
            request=httpx.Request("POST", "https://dummy.supabase.co")
        )
        mock_send.return_value = mock_response
        
        # Call query
        res = builder.insert(payload).execute()
        
        # Verify write payload got encrypted before sending
        self.assertNotEqual(payload["contact_email"], "pii@email.com")
        self.assertTrue(payload["contact_email"].strip() != "")
        
        # Verify read response got decrypted
        self.assertEqual(res.data[0]["contact_email"], "pii@email.com")
        self.assertEqual(res.data[0]["description"], "My secret PII")
        self.assertEqual(res.data[0]["raw_text"], "Sensitive raw PII")


if __name__ == "__main__":
    unittest.main()
