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
- Docker images run [`backend/healthcheck.py`](./healthcheck.py) against `/ready` every 30 seconds after a 120-second startup grace period. Override `HEALTHCHECK_URL` or `HEALTHCHECK_TIMEOUT_SECONDS` if your deployment uses a different internal port or gateway.

#### Local healthcheck verification

1. Start the API locally on the expected port (default `7860`).
2. Run the built-in healthcheck script:

```bash
cd backend
python healthcheck.py
```

3. Or verify the endpoints directly:

```bash
curl -i http://127.0.0.1:7860/health
curl -i http://127.0.0.1:7860/ready
```

4. Override the target or timeout when needed:

```bash
HEALTHCHECK_URL=http://127.0.0.1:8000/ready HEALTHCHECK_TIMEOUT_SECONDS=5 python healthcheck.py
```

A `200` response means the backend is ready. If the script times out or the endpoint returns `503`, review service initialization logs before proceeding.
