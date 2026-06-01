"""
Tests for backend/services/translation_service.py
Covers: successful translation, language detection, fallback on API error,
empty text, same-language passthrough, batch translation, timeout handling,
rate limit (429), malformed responses, locale detection, unicode encoding.
"""

import sys
import os
import unittest
from unittest.mock import patch, MagicMock

# Ensure project root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.services.translation_service import (
    translate_text,
    detect_locale,
    batch_translate,
    detect_and_translate_to_english,
)


def _mock_response(status_code=200, json_data=None, raise_exc=None):
    """Helper to build a mock requests.Response."""
    mock_resp = MagicMock()
    mock_resp.status_code = status_code
    if json_data is not None:
        mock_resp.json.return_value = json_data
    if raise_exc:
        mock_resp.raise_for_status.side_effect = raise_exc
    else:
        mock_resp.raise_for_status.return_value = None
    return mock_resp


_GOOD_RESPONSE = {
    "responseStatus": 200,
    "responseData": {"translatedText": "Hello world", "match": 0.95},
    "responseDetails": "",
}


class TestDetectLocale(unittest.TestCase):
    def test_empty_string_returns_english(self):
        lang, conf = detect_locale("")
        self.assertEqual(lang, "en")

    def test_none_like_empty_returns_english(self):
        lang, conf = detect_locale("   ")
        self.assertEqual(lang, "en")

    def test_ascii_english_returns_english(self):
        lang, conf = detect_locale("My printer is not working")
        self.assertEqual(lang, "en")
        self.assertGreater(conf, 0.5)

    def test_hindi_devanagari(self):
        # "mera printer kaam nahin kar raha" in Hindi
        lang, conf = detect_locale("मेरा प्रिंटर काम नहीं कर रहा")
        self.assertEqual(lang, "hi")
        self.assertGreater(conf, 0.5)

    def test_telugu_script(self):
        lang, conf = detect_locale("నా పరికరం పని చేయడం లేదు")
        self.assertEqual(lang, "te")
        self.assertGreater(conf, 0.5)

    def test_arabic_script(self):
        lang, conf = detect_locale("الطابعة لا تعمل")
        self.assertEqual(lang, "ar")
        self.assertGreater(conf, 0.3)

    def test_confidence_is_between_0_and_1(self):
        _, conf = detect_locale("Hello world this is a long English sentence for testing purposes.")
        self.assertGreaterEqual(conf, 0.0)
        self.assertLessEqual(conf, 1.0)

    def test_returns_tuple_of_two(self):
        result = detect_locale("test")
        self.assertIsInstance(result, tuple)
        self.assertEqual(len(result), 2)

    def test_bengali_script(self):
        lang, conf = detect_locale("আমার প্রিন্টার কাজ করছে না")
        self.assertEqual(lang, "bn")

    def test_chinese_script(self):
        lang, conf = detect_locale("我的打印机不工作")
        self.assertEqual(lang, "zh")


class TestTranslateText(unittest.TestCase):
    def test_empty_text_returns_passthrough(self):
        result = translate_text("")
        self.assertEqual(result["source"], "passthrough")
        self.assertEqual(result["translated"], "")

    def test_whitespace_only_returns_passthrough(self):
        result = translate_text("   ")
        self.assertEqual(result["source"], "passthrough")

    def test_same_language_returns_passthrough(self):
        result = translate_text("Hello", from_lang="en", to_lang="en")
        self.assertEqual(result["source"], "passthrough")
        self.assertEqual(result["translated"], "Hello")

    def test_same_language_hindi(self):
        result = translate_text("नमस्ते", from_lang="hi", to_lang="hi")
        self.assertEqual(result["source"], "passthrough")

    @patch("backend.services.translation_service._requests_lib")
    def test_successful_translation(self, mock_requests):
        mock_requests.get.return_value = _mock_response(json_data=_GOOD_RESPONSE)
        result = translate_text("Bonjour le monde", from_lang="fr", to_lang="en")
        self.assertEqual(result["translated"], "Hello world")
        self.assertEqual(result["source"], "mymemory")
        self.assertAlmostEqual(result["confidence"], 0.95)

    @patch("backend.services.translation_service._requests_lib")
    def test_api_error_returns_fallback(self, mock_requests):
        mock_requests.get.return_value = _mock_response(
            json_data={"responseStatus": 500, "responseDetails": "Server error", "responseData": {}}
        )
        result = translate_text("Hola mundo", from_lang="es", to_lang="en")
        self.assertEqual(result["source"], "fallback")
        self.assertEqual(result["translated"], "Hola mundo")

    @patch("backend.services.translation_service._requests_lib")
    def test_timeout_returns_fallback(self, mock_requests):
        import requests as req_module
        mock_requests.exceptions.Timeout = req_module.exceptions.Timeout
        mock_requests.exceptions.RequestException = req_module.exceptions.RequestException
        mock_requests.get.side_effect = req_module.exceptions.Timeout("timed out")
        result = translate_text("test", from_lang="fr", to_lang="en")
        self.assertEqual(result["source"], "fallback")
        self.assertEqual(result["translated"], "test")

    @patch("backend.services.translation_service._requests_lib")
    def test_rate_limit_429_returns_fallback(self, mock_requests):
        mock_requests.get.return_value = _mock_response(status_code=429)
        mock_requests.get.return_value.raise_for_status.return_value = None
        result = translate_text("rate limited text", from_lang="de", to_lang="en")
        self.assertEqual(result["source"], "fallback")
        self.assertEqual(result["translated"], "rate limited text")

    @patch("backend.services.translation_service._requests_lib")
    def test_malformed_response_missing_key(self, mock_requests):
        mock_requests.get.return_value = _mock_response(
            json_data={"responseStatus": 200, "responseData": {}}
        )
        import requests as req_module
        mock_requests.exceptions.Timeout = req_module.exceptions.Timeout
        mock_requests.exceptions.RequestException = req_module.exceptions.RequestException
        result = translate_text("test malformed", from_lang="es", to_lang="en")
        self.assertIn("translated", result)

    @patch("backend.services.translation_service._requests_lib")
    def test_network_exception_returns_fallback(self, mock_requests):
        import requests as req_module
        mock_requests.exceptions.Timeout = req_module.exceptions.Timeout
        mock_requests.exceptions.RequestException = req_module.exceptions.RequestException
        mock_requests.get.side_effect = req_module.exceptions.ConnectionError("unreachable")
        result = translate_text("connection error test", from_lang="hi", to_lang="en")
        self.assertEqual(result["source"], "fallback")

    @patch("backend.services.translation_service._requests_lib")
    def test_unicode_text_translated(self, mock_requests):
        unicode_text = "こんにちは世界"
        good = {
            "responseStatus": 200,
            "responseData": {"translatedText": "Hello World", "match": 0.80},
        }
        mock_requests.get.return_value = _mock_response(json_data=good)
        result = translate_text(unicode_text, from_lang="ja", to_lang="en")
        self.assertEqual(result["translated"], "Hello World")

    @patch("backend.services.translation_service._requests_lib")
    def test_result_has_required_keys(self, mock_requests):
        mock_requests.get.return_value = _mock_response(json_data=_GOOD_RESPONSE)
        result = translate_text("test", from_lang="fr", to_lang="en")
        for key in ("translated", "detected_locale", "confidence", "source"):
            self.assertIn(key, result)

    @patch("backend.services.translation_service._requests_lib")
    def test_confidence_clamped_to_1(self, mock_requests):
        data = {
            "responseStatus": 200,
            "responseData": {"translatedText": "ok", "match": 1.5},  # over 1
        }
        mock_requests.get.return_value = _mock_response(json_data=data)
        result = translate_text("test", from_lang="de", to_lang="en")
        self.assertLessEqual(result["confidence"], 1.0)

    @patch("backend.services.translation_service._requests_lib")
    def test_lang_pair_passed_correctly(self, mock_requests):
        mock_requests.get.return_value = _mock_response(json_data=_GOOD_RESPONSE)
        translate_text("bonjour", from_lang="fr", to_lang="en")
        call_kwargs = mock_requests.get.call_args
        params = call_kwargs[1].get("params") or call_kwargs[0][1]
        self.assertIn("fr|en", params.get("langpair", ""))


class TestBatchTranslate(unittest.TestCase):
    @patch("backend.services.translation_service._requests_lib")
    def test_batch_returns_list(self, mock_requests):
        mock_requests.get.return_value = _mock_response(json_data=_GOOD_RESPONSE)
        results = batch_translate(["bonjour", "merci"], from_lang="fr", to_lang="en")
        self.assertIsInstance(results, list)
        self.assertEqual(len(results), 2)

    @patch("backend.services.translation_service._requests_lib")
    def test_batch_empty_list(self, mock_requests):
        results = batch_translate([], from_lang="fr", to_lang="en")
        self.assertEqual(results, [])

    @patch("backend.services.translation_service._requests_lib")
    def test_batch_each_item_has_keys(self, mock_requests):
        mock_requests.get.return_value = _mock_response(json_data=_GOOD_RESPONSE)
        results = batch_translate(["hello", "world"], from_lang="en", to_lang="fr")
        for r in results:
            self.assertIn("translated", r)

    @patch("backend.services.translation_service._requests_lib")
    def test_batch_passthrough_for_same_lang(self, mock_requests):
        results = batch_translate(["hello", "world"], from_lang="en", to_lang="en")
        for r in results:
            self.assertEqual(r["source"], "passthrough")

    @patch("backend.services.translation_service._requests_lib")
    def test_batch_one_fails_others_succeed(self, mock_requests):
        import requests as req_module
        mock_requests.exceptions.Timeout = req_module.exceptions.Timeout
        mock_requests.exceptions.RequestException = req_module.exceptions.RequestException
        # First call fails, second succeeds
        mock_requests.get.side_effect = [
            req_module.exceptions.Timeout("timeout"),
            _mock_response(json_data=_GOOD_RESPONSE),
        ]
        results = batch_translate(["fail", "ok"], from_lang="fr", to_lang="en")
        self.assertEqual(results[0]["source"], "fallback")
        self.assertEqual(results[1]["source"], "mymemory")


class TestDetectAndTranslateToEnglish(unittest.TestCase):
    def test_english_text_passthrough(self):
        result = detect_and_translate_to_english("My computer is broken")
        self.assertEqual(result["source"], "passthrough")
        self.assertEqual(result["original_lang"], "en")

    @patch("backend.services.translation_service._requests_lib")
    def test_hindi_text_translated(self, mock_requests):
        mock_requests.get.return_value = _mock_response(json_data=_GOOD_RESPONSE)
        result = detect_and_translate_to_english("मेरा कंप्यूटर टूट गया है")
        self.assertIn("original_lang", result)
        self.assertNotEqual(result["original_lang"], "en")

    def test_result_has_original_lang_key(self):
        result = detect_and_translate_to_english("test")
        self.assertIn("original_lang", result)

    @patch("backend.services.translation_service._requests_lib")
    def test_non_english_calls_translate(self, mock_requests):
        mock_requests.get.return_value = _mock_response(json_data=_GOOD_RESPONSE)
        detect_and_translate_to_english("मेरी नेटवर्क धीमी है")
        mock_requests.get.assert_called_once()


if __name__ == "__main__":
    unittest.main()
