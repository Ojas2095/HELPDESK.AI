"""
Unit tests for OCRService.
Tests cover: extract_text with various inputs, data URI handling,
padding correction, error handling, and degraded mode.
"""

import base64
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture()
def service():
    from backend.services.ocr_service import OCRService
    return OCRService()


@pytest.fixture()
def mock_reader():
    """Provide a mock EasyOCR reader."""
    with patch("backend.services.ocr_service._get_reader") as mock_get:
        reader = MagicMock()
        mock_get.return_value = reader
        yield reader


class TestExtractText:
    def test_empty_input(self, service):
        assert service.extract_text("") == ""

    def test_none_input(self, service):
        assert service.extract_text(None) == ""

    def test_basic_extraction(self, service, mock_reader):
        mock_reader.readtext.return_value = ["Hello", "World"]
        b64 = base64.b64encode(b"fake image").decode()
        result = service.extract_text(b64)
        assert result == "Hello World"
        mock_reader.readtext.assert_called_once()

    def test_strips_data_uri_prefix(self, service, mock_reader):
        mock_reader.readtext.return_value = ["text"]
        data_uri = "data:image/png;base64," + base64.b64encode(b"img").decode()
        result = service.extract_text(data_uri)
        assert result == "text"

    def test_handles_missing_padding(self, service, mock_reader):
        """Base64 strings without padding should be handled."""
        mock_reader.readtext.return_value = ["ok"]
        # Create a base64 string that needs padding
        raw = base64.b64encode(b"test").decode()
        # Remove padding chars
        unpadded = raw.rstrip("=")
        result = service.extract_text(unpadded)
        assert result == "ok"

    def test_joins_multiple_results(self, service, mock_reader):
        mock_reader.readtext.return_value = ["line1", "line2", "line3"]
        b64 = base64.b64encode(b"img").decode()
        result = service.extract_text(b64)
        assert result == "line1 line2 line3"

    def test_empty_readtext_result(self, service, mock_reader):
        mock_reader.readtext.return_value = []
        b64 = base64.b64encode(b"img").decode()
        result = service.extract_text(b64)
        assert result == ""

    def test_exception_returns_empty(self, service, mock_reader):
        mock_reader.readtext.side_effect = RuntimeError("OCR failed")
        b64 = base64.b64encode(b"bad").decode()
        result = service.extract_text(b64)
        assert result == ""

    def test_readtext_called_with_detail_0(self, service, mock_reader):
        mock_reader.readtext.return_value = ["text"]
        b64 = base64.b64encode(b"img").decode()
        service.extract_text(b64)
        call_args = mock_reader.readtext.call_args
        assert call_args[1]["detail"] == 0
        assert call_args[1]["paragraph"] is True


class TestGetReader:
    def test_lazy_initialization(self):
        """_get_reader should initialize EasyOCR on first call."""
        import backend.services.ocr_service as ocr_mod

        # Reset global state
        original = ocr_mod._reader
        ocr_mod._reader = None

        # easyocr is imported inside _get_reader, so we mock the import
        mock_easyocr = MagicMock()
        mock_reader_instance = MagicMock()
        mock_easyocr.Reader.return_value = mock_reader_instance

        import sys
        saved = sys.modules.get("easyocr")
        sys.modules["easyocr"] = mock_easyocr
        try:
            reader = ocr_mod._get_reader()
            assert reader is mock_reader_instance
            mock_easyocr.Reader.assert_called_once_with(["en"], gpu=False)
        finally:
            ocr_mod._reader = original
            if saved is not None:
                sys.modules["easyocr"] = saved
            else:
                sys.modules.pop("easyocr", None)

    def test_caches_reader(self):
        """_get_reader should return the same instance on subsequent calls."""
        import backend.services.ocr_service as ocr_mod

        original = ocr_mod._reader
        mock_reader = MagicMock()
        ocr_mod._reader = mock_reader

        result = ocr_mod._get_reader()
        assert result is mock_reader

        ocr_mod._reader = original
