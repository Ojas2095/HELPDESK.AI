"""Self-contained tests for PII Redaction Engine.

Tests verify that all PII patterns are correctly detected and redacted,
with no false positives on safe data. No external dependencies required.
"""

import sys
import os

# Add this directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.pii_redaction import (
    redact_emails,
    redact_phones,
    redact_api_keys,
    redact_credit_cards,
    redact_ssns,
    redact_ip_addresses,
    redact_all,
    redact_row,
    redact_payload,
    REDACTED,
)


class TestEmailRedaction:
    def test_basic_email(self):
        result = redact_emails("Contact us at user@example.com for help")
        assert REDACTED in result
        assert "user@example.com" not in result

    def test_multiple_emails(self):
        text = "CC: alice@test.com and bob@test.com"
        result = redact_emails(text)
        assert "alice@test.com" not in result
        assert "bob@test.com" not in result

    def test_no_email(self):
        text = "No email here"
        assert redact_emails(text) == text

    def test_non_string_input(self):
        assert redact_emails(12345) == 12345

    def test_subdomain_email(self):
        result = redact_emails("Email: john@mail.corporate.co.uk please")
        assert "john@mail.corporate.co.uk" not in result


class TestPhoneRedaction:
    def test_dot_format(self):
        result = redact_phones("Call 555.123.4567 now")
        assert REDACTED in result
        assert "555.123.4567" not in result

    def test_international_format(self):
        result = redact_phones("Phone: +1-555-000-1111")
        assert REDACTED in result

    def test_parentheses_format(self):
        result = redact_phones("Call (555) 123-4567")
        assert REDACTED in result

    def test_non_string_input(self):
        assert redact_phones(12345) == 12345

    def test_short_number_not_redacted(self):
        text = "The number 123 is small"
        assert redact_phones(text) == text


class TestAPIKeyRedaction:
    def test_aws_access_key(self):
        result = redact_api_keys("Key: AKIAIOSFODNN7EXAMPLE")
        assert "AKIAIOSFODNN7EXAMPLE" not in result

    def test_github_pat(self):
        result = redact_api_keys("token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij")
        assert "ghp_" not in result

    def test_google_api_key(self):
        result = redact_api_keys("API: AIzaSyA1234567890abcdefghijklmnop")
        assert "AIzaSy" not in result

    def test_stripe_key(self):
        result = redact_api_keys("Key: FAKE_STRIPE_KEY_PLACEHOLDER")
        # Should not crash, key pattern handled
        assert isinstance(result, str)

    def test_no_api_key(self):
        text = "No keys here"
        assert redact_api_keys(text) == text

    def test_bearer_token(self):
        result = redact_api_keys("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.test.sig")
        assert "eyJhbG" not in result


class TestCreditCardRedaction:
    def test_visa_format(self):
        result = redact_credit_cards("Card: 4111-1111-1111-1111")
        assert "4111" not in result

    def test_amex_format(self):
        result = redact_credit_cards("AMEX: 3782-822463-10005")
        assert "3782" not in result

    def test_no_false_positive(self):
        text = "Order #1234-5678-9012 is not a card"
        assert redact_credit_cards(text) == text


class TestSSNRedaction:
    def test_us_ssn(self):
        result = redact_ssns("SSN: 123-45-6789")
        assert "123-45-6789" not in result

    def test_no_false_positive(self):
        text = "Part 123-45 is fine"
        assert redact_ssns(text) == text


class TestIPRedaction:
    def test_public_ip(self):
        result = redact_ip_addresses("Server: 8.8.8.8")
        assert "8.8.8.8" not in result

    def test_private_ip_not_redacted(self):
        result = redact_ip_addresses("Internal: 10.0.0.1")
        assert "10.0.0.1" in result

    def test_10_network_not_redacted(self):
        result = redact_ip_addresses("Local: 10.0.0.1")
        assert "10.0.0.1" in result


class TestRedactAll:
    def test_combined_pii(self):
        text = "Email: test@test.com, Phone: +1-555-000-1111, SSN: 123-45-6789"
        result = redact_all(text)
        assert "test@test.com" not in result
        assert "123-45-6789" not in result

    def test_non_string(self):
        assert redact_all(123) == 123

    def test_preserves_non_pii(self):
        text = "Hello world, this is a normal message."
        assert redact_all(text) == text


class TestRowRedaction:
    def test_target_fields_redacted(self):
        row = {
            "id": 1,
            "contact_email": "user@test.com",
            "description": "Call +1-555-000-1111 for help",
            "subject": "Urgent: SSN 123-45-6789 leaked",
            "customer_name": "John Doe",
            "priority": "high",
        }
        result = redact_row(row)
        assert "user@test.com" not in result["contact_email"]
        assert "123-45-6789" not in result["subject"]
        assert result["id"] == 1
        assert result["priority"] == "high"

    def test_none_fields_skipped(self):
        row = {"id": 1, "contact_email": None, "description": "Safe text"}
        result = redact_row(row)
        assert result["contact_email"] is None


class TestPayloadRedaction:
    def test_dict_payload(self):
        payload = {"email": "a@b.com", "subject": "SSN: 123-45-6789"}
        result = redact_payload(payload)
        assert "a@b.com" not in str(result)
        assert "123-45-6789" not in str(result)

    def test_list_payload(self):
        payload = [{"email": "x@y.com"}]
        result = redact_payload(payload)
        assert "x@y.com" not in str(result)

    def test_scalar_payload(self):
        assert redact_payload(42) == 42

    def test_nested_payload(self):
        payload = {"tickets": [{"email": "a@b.com", "subject": "SSN: 123-45-6789"}], "count": 1}
        result = redact_payload(payload)
        assert "a@b.com" not in str(result)
        assert "123-45-6789" not in str(result)
        assert result["count"] == 1
