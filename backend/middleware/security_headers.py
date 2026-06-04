"""
HTTP Security Headers middleware for FastAPI (issue #637).

Adds standard Helmet-equivalent headers to every response:
  - X-Content-Type-Options
  - X-Frame-Options
  - X-XSS-Protection
  - Referrer-Policy
  - Permissions-Policy
  - Strict-Transport-Security (HSTS)
  - Content-Security-Policy

Also refactors CORS to read allowed origins from the ALLOWED_ORIGINS env var
so production and staging environments are controlled without code changes.

Usage in main.py:
    from backend.middleware.security_headers import add_security_middleware
    add_security_middleware(app)
"""

import os
from typing import Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware


# ---------------------------------------------------------------------------
# CORS — read allowed origins from environment
# ---------------------------------------------------------------------------

def _parse_allowed_origins() -> list[str]:
    """
    Read ALLOWED_ORIGINS from env (comma-separated) and return as a list.
    Falls back to sensible defaults for local development when the var is not set.
    """
    raw = os.environ.get("ALLOWED_ORIGINS", "")
    if raw:
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
    # Default: production deployment + local dev
    return [
        "https://helpdeskaiv1.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
    ]


# ---------------------------------------------------------------------------
# Security headers middleware
# ---------------------------------------------------------------------------

_SECURITY_HEADERS: dict[str, str] = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "Content-Security-Policy": (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; "
        "font-src 'self' data: https://fonts.gstatic.com; "
        "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https:; "
        "connect-src 'self' https://*.supabase.co https://*.supabase.in "
        "wss://*.supabase.co https://generativelanguage.googleapis.com "
        "http://localhost:* ws://localhost:*; "
        "frame-ancestors 'none'; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    ),
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Injects security headers into every HTTP response."""

    def __init__(self, app, extra_headers: dict[str, str] | None = None):
        super().__init__(app)
        self.headers = {**_SECURITY_HEADERS, **(extra_headers or {})}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        for header, value in self.headers.items():
            response.headers[header] = value
        return response


# ---------------------------------------------------------------------------
# Convenience setup function
# ---------------------------------------------------------------------------

def add_security_middleware(app: FastAPI, *, extra_headers: dict[str, str] | None = None) -> None:
    """
    Attach CORS (from ALLOWED_ORIGINS env var) and security headers middleware to *app*.

    Call this AFTER creating the FastAPI app but BEFORE adding routes:

        app = FastAPI(...)
        add_security_middleware(app)

    CORS origins are read from the ALLOWED_ORIGINS environment variable (comma-separated).
    Supports wildcard patterns via ALLOWED_ORIGIN_REGEX (e.g., r"https://.*\\.vercel\\.app").
    """
    import re

    allowed_origins = _parse_allowed_origins()
    origin_regex = os.environ.get("ALLOWED_ORIGIN_REGEX", "")

    cors_kwargs: dict = {
        "allow_origins": allowed_origins,
        "allow_credentials": True,
        "allow_methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        "allow_headers": ["Authorization", "Content-Type", "X-Requested-With", "X-CSRF-Token"],
        "expose_headers": ["X-Request-ID", "X-Process-Time"],
        "max_age": 600,
    }

    if origin_regex:
        cors_kwargs["allow_origin_regex"] = origin_regex

    app.add_middleware(CORSMiddleware, **cors_kwargs)
    app.add_middleware(SecurityHeadersMiddleware, extra_headers=extra_headers)
