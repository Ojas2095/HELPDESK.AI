---
title: HelpDesk AI Backend
emoji: 🤖
colorFrom: green
colorTo: blue
sdk: docker
pinned: false
---

# HelpDesk.ai AI Backend

This is the AI analysis engine for the HelpDesk.ai platform. It handles ticket summarization, categorization, and priority assignment using state-of-the-art NLP models.

## Deployment on HuggingFace Spaces

This space is configured to run as a Docker container on port 7860.

### Features:
- **AI Triage**: Automatically categorizes incoming tickets.
- **Sentiment Analysis**: Detects user urgency and frustration.
- **OCR Integration**: Extracts text from screenshots for faster debugging.
- **FastAPI Core**: High-performance asynchronous processing.

### Configuration:
- **Port**: 7860
- **SDK**: Docker
- **Python**: 3.10

### Health and readiness

- `GET /health` is a lightweight liveness check. It returns API status and model load flags.
- `GET /ready` is a deployment readiness check. It returns `200` only when the API, classifier, NER service, duplicate index, and RAG service are ready; otherwise it returns `503` with a flat response body and per-check details. Set `REQUIRE_SUPABASE=true` to include Supabase configuration in the strict readiness gate.
- Docker images run `backend/healthcheck.py` against `/ready` every 30 seconds after a 120-second startup grace period. Override `HEALTHCHECK_URL` or `HEALTHCHECK_TIMEOUT_SECONDS` if your deployment uses a different internal port or gateway.

### Rate limiting

The backend enforces per-IP rate limits using [slowapi](https://github.com/laurentS/slowapi) (a FastAPI port of Flask-Limiter).

**Default limit:** `POST /ai/analyze_ticket` — **10 requests per minute per client IP**.

All other endpoints (`/health`, `/ready`, `/ai/analyze`, etc.) are unrestricted.

**429 error response**

When a client exceeds the limit the server returns HTTP `429 Too Many Requests` with a `Retry-After` header and a JSON body:

```json
{"error": "Rate limit exceeded: 10 per 1 minute"}
```

Example with curl:

```bash
# 11th request within a minute from the same IP triggers 429
curl -s -o /dev/null -w "%{http_code}" \
  -X POST https://<your-host>/ai/analyze_ticket \
  -H "Content-Type: application/json" \
  -d '{"text": "My printer is broken", "company": "acme"}'
# → 429
```

**Configuration**

The limit string follows slowapi / limits syntax (`N/second`, `N/minute`, `N/hour`, `N/day`). To change it without modifying source code set the `RATELIMIT_DEFAULT` environment variable and initialise the limiter with `default_limits`:

```bash
RATELIMIT_DEFAULT="20/minute"
```

```python
# backend/main.py (excerpt)
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[os.getenv("RATELIMIT_DEFAULT", "10/minute")],
)
```

> **Note:** The current codebase hardcodes `"10/minute"` in the `@limiter.limit` decorator on `/ai/analyze_ticket`. The env-var pattern above is the recommended next step for operator-configurable limits.
