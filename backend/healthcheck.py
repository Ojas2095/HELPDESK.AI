"""
Healthcheck script — compatible with K8s liveness/readiness probes and Docker HEALTHCHECK.

Exit codes:
  0 — healthy
  1 — unhealthy

Probes:
  - Liveness: GET /health  — fast check, exits 0 if API responds 2xx
  - Readiness: GET /ready  — checks all service statuses

Usage:
  python backend/healthcheck.py [--liveness | --readiness]
  Default: uses HEALTHCHECK_URL env var (falls back to /health for liveness)

Environment variables:
  HEALTHCHECK_URL           — full URL to probe (default: http://127.0.0.1:7860/health)
  HEALTHCHECK_TIMEOUT_SECONDS — HTTP timeout in seconds (default: 5)
  HEALTHCHECK_MODE          — "liveness" or "readiness" (default: "liveness")
"""

import os
import sys
import json
import urllib.error
import urllib.request
from urllib.parse import urlparse


_BASE_URL = os.environ.get("HEALTHCHECK_BASE_URL", "http://127.0.0.1:7860")

_MODE_ENDPOINTS = {
    "liveness": "/health",
    "readiness": "/ready",
}


def _get_url() -> str:
    """Build the probe URL from env vars or command-line args."""
    explicit = os.environ.get("HEALTHCHECK_URL", "")
    if explicit:
        return explicit

    mode = os.environ.get("HEALTHCHECK_MODE", "liveness")
    if "--readiness" in sys.argv:
        mode = "readiness"
    elif "--liveness" in sys.argv:
        mode = "liveness"

    endpoint = _MODE_ENDPOINTS.get(mode, "/health")
    return f"{_BASE_URL.rstrip('/')}{endpoint}"


def _get_timeout() -> float:
    try:
        return float(os.environ.get("HEALTHCHECK_TIMEOUT_SECONDS", "5"))
    except (TypeError, ValueError):
        return 5.0


def main() -> int:
    url = _get_url()
    timeout = _get_timeout()

    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        print(f"[healthcheck] ERROR: Invalid URL scheme in '{url}'", file=sys.stderr)
        return 1

    try:
        req = urllib.request.Request(url, method="GET")
        req.add_header("User-Agent", "helpdesk-healthcheck/1.0")
        with urllib.request.urlopen(req, timeout=timeout) as response:
            status = response.status
            if 200 <= status < 300:
                # For readiness probe: parse body to check all services
                if "/ready" in url:
                    try:
                        body = json.loads(response.read())
                        if body.get("status") not in ("ready", "ok"):
                            print(
                                f"[healthcheck] NOT READY: {body.get('status')} — checks: {body.get('checks')}",
                                file=sys.stderr,
                            )
                            return 1
                    except Exception:
                        pass  # Treat as healthy if body can't be parsed
                return 0
            print(f"[healthcheck] HTTP {status} from {url}", file=sys.stderr)
            return 1

    except urllib.error.HTTPError as exc:
        print(f"[healthcheck] HTTP error {exc.code} from {url}", file=sys.stderr)
        return 1
    except (TimeoutError, urllib.error.URLError, OSError) as exc:
        print(f"[healthcheck] Connection error: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"[healthcheck] Unexpected error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
