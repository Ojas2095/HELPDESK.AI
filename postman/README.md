# HELPDESK.AI Postman Collection

Postman collection covering the core HELPDESK.AI backend API endpoints.

## Structure

- **Auth** — Login, logout
- **Tickets** — CRUD operations for support tickets
- **AI Analysis** — Triage, similarity search, troubleshooting, bug analysis
- **Translation** — Language detection and translation (MarianMT models)
- **Sentiment** — Sentiment analysis
- **System** — Health, readiness, metrics
- **WebSocket** — Real-time ticket updates
- **Digest** — Weekly digest email trigger

## Setup

1. Import `HELPDESK_AI_API.postman_collection.json` into Postman
2. Set `baseUrl` variable to your backend server (default: `http://localhost:8000`)
3. For protected endpoints, set the `session` cookie from `/auth/login` response
4. For `/metrics`, set `metricsToken` to your configured metrics token

## Endpoints

| Category | Count | Key Endpoints |
|----------|-------|---------------|
| Auth | 2 | `/auth/login`, `/auth/logout` |
| Tickets | 5 | GET/POST/PATCH `/tickets` |
| AI Analysis | 6 | `/analyze`, `/similar`, `/ai/*` |
| Translation | 1 | `/api/translation/detect-and-translate` |
| Sentiment | 1 | `/api/sentiment/analyze` |
| System | 5 | `/`, `/health`, `/ready`, `/metrics` |
| WebSocket | 2 | `/ws/{company_id}`, `/ws/stats` |
| Digest | 1 | `/api/digest/send-now` |

## Bounty Reference

This collection was created as part of issue #1410 (Build Interactive Swagger API Documentation Theme and Comprehensive Postman Collection).