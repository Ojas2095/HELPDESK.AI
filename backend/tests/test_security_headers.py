"""
Unit tests for backend/middleware/security_headers.py.
"""

import os
import sys
import unittest
from unittest import mock

sys.path.insert(
    0,
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")),
)

from backend.middleware.security_headers import (
    _parse_allowed_origins,
    _SECURITY_HEADERS,
    SecurityHeadersMiddleware,
    add_security_middleware,
)


class TestParseAllowedOrigins(unittest.TestCase):
    def test_empty_env_returns_defaults(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            origins = _parse_allowed_origins()
        self.assertIn("https://helpdeskaiv1.vercel.app", origins)
        self.assertIn("http://localhost:5173", origins)
        self.assertIn("http://localhost:3000", origins)

    def test_custom_env(self):
        with mock.patch.dict(
            os.environ,
            {"ALLOWED_ORIGINS": "https://a.example,https://b.example"},
        ):
            origins = _parse_allowed_origins()
        self.assertEqual(
            origins, ["https://a.example", "https://b.example"]
        )

    def test_strips_whitespace(self):
        with mock.patch.dict(
            os.environ,
            {"ALLOWED_ORIGINS": "  https://a.example , https://b.example  "},
        ):
            origins = _parse_allowed_origins()
        self.assertEqual(
            origins, ["https://a.example", "https://b.example"]
        )

    def test_skips_empty_segments(self):
        with mock.patch.dict(
            os.environ,
            {"ALLOWED_ORIGINS": "https://a.example,,https://b.example"},
        ):
            origins = _parse_allowed_origins()
        self.assertEqual(
            origins, ["https://a.example", "https://b.example"]
        )

    def test_single_origin(self):
        with mock.patch.dict(
            os.environ, {"ALLOWED_ORIGINS": "https://only.example"}
        ):
            origins = _parse_allowed_origins()
        self.assertEqual(origins, ["https://only.example"])


class TestSecurityHeadersConstants(unittest.TestCase):
    def test_includes_x_content_type_options(self):
        self.assertIn("X-Content-Type-Options", _SECURITY_HEADERS)
        self.assertEqual(_SECURITY_HEADERS["X-Content-Type-Options"], "nosniff")

    def test_includes_x_frame_options(self):
        self.assertEqual(_SECURITY_HEADERS["X-Frame-Options"], "DENY")

    def test_includes_hsts(self):
        self.assertIn("Strict-Transport-Security", _SECURITY_HEADERS)
        self.assertIn("max-age", _SECURITY_HEADERS["Strict-Transport-Security"])

    def test_includes_csp(self):
        self.assertIn("Content-Security-Policy", _SECURITY_HEADERS)
        self.assertIn("default-src 'self'", _SECURITY_HEADERS["Content-Security-Policy"])

    def test_includes_referrer_policy(self):
        self.assertEqual(
            _SECURITY_HEADERS["Referrer-Policy"],
            "strict-origin-when-cross-origin",
        )


class TestSecurityHeadersMiddlewareInit(unittest.TestCase):
    def test_default_headers(self):
        # Mock the inner app with a callable
        m = SecurityHeadersMiddleware(mock.MagicMock())
        for header in _SECURITY_HEADERS:
            self.assertIn(header, m.headers)

    def test_extra_headers_merged(self):
        m = SecurityHeadersMiddleware(
            mock.MagicMock(), extra_headers={"X-Custom": "value"}
        )
        self.assertEqual(m.headers["X-Custom"], "value")
        # Default headers still present
        self.assertIn("X-Frame-Options", m.headers)

    def test_extra_headers_can_override(self):
        m = SecurityHeadersMiddleware(
            mock.MagicMock(), extra_headers={"X-Frame-Options": "SAMEORIGIN"}
        )
        self.assertEqual(m.headers["X-Frame-Options"], "SAMEORIGIN")


class TestAddSecurityMiddleware(unittest.TestCase):
    def test_adds_cors_and_security_middleware(self):
        app = mock.MagicMock()
        with mock.patch.dict(os.environ, {}, clear=True):
            add_security_middleware(app)
        # Two add_middleware calls: CORS and SecurityHeaders
        self.assertEqual(app.add_middleware.call_count, 2)
        calls = [c.args[0].__name__ for c in app.add_middleware.call_args_list]
        self.assertIn("CORSMiddleware", calls)
        self.assertIn("SecurityHeadersMiddleware", calls)

    def test_extra_headers_passed_through(self):
        app = mock.MagicMock()
        with mock.patch.dict(os.environ, {}, clear=True):
            add_security_middleware(app, extra_headers={"X-Custom": "v"})
        # Find the SecurityHeadersMiddleware call
        for call in app.add_middleware.call_args_list:
            if call.args[0].__name__ == "SecurityHeadersMiddleware":
                self.assertEqual(call.kwargs.get("extra_headers", {}).get("X-Custom"), "v")
                return
        self.fail("SecurityHeadersMiddleware was not added")


if __name__ == "__main__":
    unittest.main()
