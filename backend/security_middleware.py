"""
security_middleware.py — HTTP Security Headers Middleware (Helmet.js equivalent)
Issue #1169 — Standardize Security Headers and CORS Policy
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import os


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Adds production-grade HTTP security headers to every response.
    FastAPI/Starlette equivalent of helmet.js for Express backends.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        self._apply_headers(response)
        return response

    def _apply_headers(self, response: Response) -> None:
        # ── Content Security Policy ───────────────────────────────────────────
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com data:; "
            "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in; "
            "connect-src 'self' https://*.supabase.co https://*.supabase.in "
            "wss://*.supabase.co https://generativelanguage.googleapis.com; "
            "worker-src 'self' blob:; "
            "object-src 'none'; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'; "
            "upgrade-insecure-requests;"
        )

        # ── Prevent MIME-type sniffing ────────────────────────────────────────
        response.headers["X-Content-Type-Options"] = "nosniff"

        # ── Prevent Clickjacking ──────────────────────────────────────────────
        response.headers["X-Frame-Options"] = "DENY"

        # ── Legacy XSS protection ─────────────────────────────────────────────
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # ── Referrer policy ───────────────────────────────────────────────────
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # ── Permissions policy ────────────────────────────────────────────────
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), "
            "payment=(), usb=(), magnetometer=(), "
            "gyroscope=(), accelerometer=()"
        )

        # ── HSTS — production only ────────────────────────────────────────────
        env = os.getenv("ENV", os.getenv("ENVIRONMENT", "development")).lower()
        if env == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )

        # ── Cross-origin policies ─────────────────────────────────────────────
        response.headers["Cross-Origin-Opener-Policy"]   = "same-origin"
        response.headers["Cross-Origin-Resource-Policy"] = "same-origin"

        # ── Remove server fingerprinting ──────────────────────────────────────
        response.headers.pop("Server", None)
        response.headers.pop("X-Powered-By", None)


def get_allowed_origins() -> list[str]:
    """
    Read allowed CORS origins from ALLOWED_ORIGINS env var.
    Validates format — must start with http:// or https://.
    Falls back to localhost defaults — NEVER wildcards.

    Issue #1169: Replaces the previous CORS_ORIGINS env var with the
    standardized ALLOWED_ORIGINS documented in .env.example (issue #637).
    """
    # Support both env var names for backwards compatibility
    raw = os.getenv("ALLOWED_ORIGINS", "") or os.getenv("CORS_ORIGINS", "")

    if not raw.strip():
        defaults = [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",
        ]
        print("[security] ALLOWED_ORIGINS not set — using localhost defaults")
        return defaults

    origins = []
    for origin in raw.split(","):
        origin = origin.strip().rstrip("/")
        if not origin:
            continue
        if origin.startswith("http://") or origin.startswith("https://"):
            origins.append(origin)
        else:
            print(f"[security] Skipping invalid origin (must start with http/https): '{origin}'")

    if not origins:
        print("[security] WARNING: No valid origins — falling back to localhost")
        return ["http://localhost:5173", "http://localhost:3000"]

    return origins
