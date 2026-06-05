from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded


def create_test_app():
    app = FastAPI()
    from backend.routes.voice import router
    from backend.services.rate_limit_config import limiter

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.include_router(router)
    return app


def test_transcribe_endpoint_awaits_async_service():
    client = TestClient(create_test_app())
    service_result = {
        "transcribed_text": "My laptop will not connect to Wi-Fi.",
        "detected_language": "en",
        "confidence": 0.95,
        "duration_seconds": 1.2,
    }

    with patch(
        "backend.routes.voice.transcribe_audio_async",
        new=AsyncMock(return_value=service_result),
    ) as mock_transcribe:
        response = client.post(
            "/api/voice/transcribe",
            files={"audio": ("issue.wav", b"fake audio bytes", "audio/wav")},
            data={"language": "en"},
        )

    assert response.status_code == 200
    assert response.json() == service_result
    mock_transcribe.assert_awaited_once_with(
        file_bytes=b"fake audio bytes",
        filename="issue.wav",
        language="en",
    )


def test_create_ticket_endpoint_awaits_async_service_and_returns_draft():
    client = TestClient(create_test_app())
    service_result = {
        "transcribed_text": "VPN disconnects every few minutes during calls.",
        "detected_language": "en",
        "confidence": 0.91,
        "duration_seconds": 2.5,
    }

    with patch(
        "backend.routes.voice.transcribe_audio_async",
        new=AsyncMock(return_value=service_result),
    ) as mock_transcribe:
        response = client.post(
            "/api/voice/create-ticket",
            files={"audio": ("vpn.webm", b"voice bytes", "audio/webm")},
            data={"language": "en", "user_id": "user-1", "company": "Acme"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["transcription"] == service_result
    assert data["transcribed_text"] == service_result["transcribed_text"]
    assert data["suggested_title"] == "VPN disconnects every few minutes during calls."
    mock_transcribe.assert_awaited_once_with(
        file_bytes=b"voice bytes",
        filename="vpn.webm",
        language="en",
    )
