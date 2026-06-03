import sys
import os
from unittest.mock import MagicMock
# Mock heavy modules to prevent loading failures when torch/transformers are missing
for module in ["torch", "torch.nn", "torch.nn.functional", "transformers", "sentence_transformers"]:
    sys.modules[module] = MagicMock()

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import patch, MagicMock

# Start the mock patcher for _anon_supabase before importing/creating client
patcher = patch("backend.auth_cookie._anon_supabase")
mock_anon = patcher.start()
mock_client = MagicMock()
mock_anon.return_value = mock_client
mock_client.auth.sign_in_with_password.side_effect = Exception("Invalid email or password.")
mock_client.auth.sign_up.side_effect = Exception("Invalid signup details or email already in use.")

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_login_valid_email_formats():
    """Test that valid emails including aliases are accepted by validation, even if unauthorized"""
    valid_emails = [
        "john@gmail.com",
        "john.doe@gmail.com",
        "john+test@gmail.com",
        "john%2Btest@gmail.com",
        "user.name+alias@domain.com",
        "dev_team+support@example.org"
    ]
    
    for email in valid_emails:
        response = client.post("/auth/login", json={"email": email, "password": "password"})
        assert response.status_code in (401, 503), f"Email {email} failed validation unexpectedly. Code: {response.status_code}, Body: {response.text}"
        if response.status_code == 401:
            assert response.json()["detail"] == "Invalid email or password.", f"Unexpected error detail for {email}"

def test_login_invalid_email_formats():
    """Test that malformed emails are rejected with 422 Unprocessable Entity"""
    invalid_emails = [
        "john@",
        "@gmail.com",
        "invalid-email",
        "john@gmail",
        "john doe@gmail.com"
    ]
    
    for email in invalid_emails:
        response = client.post("/auth/login", json={"email": email, "password": "password"})
        assert response.status_code == 422, f"Email {email} was incorrectly accepted"
        assert "Invalid email format" in str(response.json()), f"Unexpected validation error for {email}"

def test_signup_valid_email_formats():
    """Test that valid emails are accepted for signup"""
    response = client.post("/auth/signup", json={"email": "new.user+alias@gmail.com", "password": "password"})
    assert response.status_code in (400, 503), "Validation should pass but DB error expected"
    if response.status_code == 400:
         assert response.json()["detail"] == "Invalid signup details or email already in use."

def test_signup_invalid_email_formats():
    """Test that malformed emails are rejected for signup"""
    response = client.post("/auth/signup", json={"email": "invalid@", "password": "password"})
    assert response.status_code == 422
    assert "Invalid email format" in str(response.json())
