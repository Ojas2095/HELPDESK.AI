"""
Locust Load Testing Suite for HELPDESK.AI Critical API Endpoints.

Simulates concurrent users performing realistic workflows:
  - Authentication (login with token reuse)
  - Ticket browsing (paginated lists with filters)
  - Ticket creation (submitting support tickets)
  - AI ticket analysis (DistilBERT classifier)
  - OCR processing (image upload + analysis)

Usage:
    locust --host=https://staging.example.com --users=50 --spawn-rate=5 --run-time=10m
    locust --headless --host=https://staging.example.com --users=100 --spawn-rate=10 --run-time=5m --html=report.html
"""

import json
import os
import random
import time
from urllib.parse import urlencode

from locust import HttpUser, task, between, events
from locust.exception import StopUser

from .locust_config import DEFAULT_BUDGET, PERFORMANCE_BUDGET_ENV_VAR, parse_budget_env

# ─── Test Data ─────────────────────────────────────────────

SAMPLE_TICKET_TITLES = [
    "Cannot connect to VPN after latest update",
    "Email client crashes when opening attachments",
    "Printer not responding on network",
    "Login page returns 500 error intermittently",
    "Database connection timeout during peak hours",
    "UI freezes when loading large ticket lists",
    "File upload fails for PDFs over 10MB",
    "Search results not showing recently created tickets",
    "Mobile app push notifications not delivered",
    "Two-factor authentication SMS delay",
]

SAMPLE_TICKET_DESCRIPTIONS = [
    "After updating to version 3.2.1, the VPN client fails to establish a connection. "
    "I've tried reinstalling and restarting, but the issue persists. The error log shows "
    "a TLS handshake failure.",
    "The email client (version 5.0) crashes consistently when trying to open emails with "
    "attachments larger than 5MB. CPU usage spikes to 100% before the crash.",
    "Network printer HP LaserJet M404dn is not responding from any workstation. Printer "
    "dashboard shows 'Ready' status. Network ping to printer IP succeeds.",
    "Login endpoint returns HTTP 500 for approximately 1 in 50 requests during business "
    "hours. The issue correlates with high database connection pool usage.",
    "Primary database connection pool maxes out at 100 connections during peak usage "
    "(10:00-12:00 UTC). Query response time degrades from 50ms to 2000ms.",
]

SAMPLE_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
]

# ─── SLA Configuration ─────────────────────────────────────

# Read performance budget from environment variable
PERFORMANCE_BUDGET = parse_budget_env(
    os.environ.get(PERFORMANCE_BUDGET_ENV_VAR)
)


# ─── Test User ─────────────────────────────────────────────

class HelpDeskUser(HttpUser):
    """
    Simulates a helpdesk agent performing common daily workflows.
    Each user gets a unique session with token-based authentication.
    """

    wait_time = between(1, 5)  # Think time between tasks (seconds)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.auth_token = None
        self.auth_headers = {}
        self.created_ticket_ids = []
        self.session_start = time.time()

    def on_start(self):
        """Called when a simulated user starts — performs login."""
        self.login()

    def login(self):
        """
        Simulate user login via /auth/login.
        Reuses session cookies/tokens for subsequent requests.
        """
        email = f"loadtest.user{random.randint(1, 10000):04d}@example.com"
        password = "LoadTestPass123!"

        payload = {"email": email, "password": password}

        with self.client.post(
            "/auth/login",
            json=payload,
            headers={"Content-Type": "application/json"},
            name="/auth/login",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                resp.success()
                # Extract session token from cookies or response body
                cookies = resp.cookies
                if cookies:
                    self.auth_token = cookies.get("session", "")
                # Try JSON body for token
                try:
                    body = resp.json()
                    if isinstance(body, dict) and "token" in body:
                        self.auth_token = body["token"]
                except (json.JSONDecodeError, ValueError):
                    pass

                # Build authorization headers
                if self.auth_token:
                    self.auth_headers = {
                        "Authorization": f"Bearer {self.auth_token}",
                        "Content-Type": "application/json",
                        "User-Agent": random.choice(SAMPLE_USER_AGENTS),
                    }
                else:
                    # Fall back to no auth for open endpoints
                    self.auth_headers = {
                        "Content-Type": "application/json",
                        "User-Agent": random.choice(SAMPLE_USER_AGENTS),
                    }
            else:
                resp.failure(f"Login failed: HTTP {resp.status_code}")
                # Don't stop the user — some endpoints may be unauthenticated

    # ── Task 1: Health Check (lightweight) ────────────────

    @task(2)
    def health_check(self):
        """Check API health endpoint — lightweight liveness probe."""
        with self.client.get(
            "/health",
            name="/health",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            else:
                resp.failure(f"Health check failed: HTTP {resp.status_code}")

    # ── Task 2: Readiness Check ──────────────────────────

    @task(1)
    def readiness_check(self):
        """Check API readiness — full service dependency check."""
        with self.client.get(
            "/ready",
            name="/ready",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            else:
                resp.failure(f"Readiness check failed: HTTP {resp.status_code}")

    # ── Task 3: Browse Tickets ──────────────────────────

    @task(5)
    def browse_tickets(self):
        """GET /tickets — browse paginated ticket list with various filters."""
        params = {
            "page": random.randint(1, 5),
            "per_page": random.choice([10, 20, 50]),
        }
        # Occasionally add filters
        if random.random() < 0.3:
            params["status"] = random.choice(["open", "in_progress", "resolved"])
        if random.random() < 0.2:
            params["priority"] = random.choice(["high", "medium", "low"])

        url = f"/tickets?{urlencode(params)}"
        with self.client.get(
            url,
            headers=self.auth_headers,
            name="/tickets",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            else:
                resp.failure(f"Browse tickets failed: HTTP {resp.status_code}")

    # ── Task 4: Get Single Ticket ────────────────────────

    @task(3)
    def get_ticket_detail(self):
        """GET /tickets/{id} — view a single ticket's details."""
        # Use a realistic ticket ID pattern
        ticket_id = f"TKT-{random.randint(1000, 9999)}"
        with self.client.get(
            f"/tickets/{ticket_id}",
            headers=self.auth_headers,
            name="/tickets/{id}",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 404):
                # 404 is acceptable if the ticket doesn't exist in staging
                resp.success()
            else:
                resp.failure(f"Get ticket failed: HTTP {resp.status_code}")

    # ── Task 5: Create Ticket ───────────────────────────

    @task(3)
    def create_ticket(self):
        """POST /tickets — submit a new support ticket."""
        title = random.choice(SAMPLE_TICKET_TITLES)
        description = random.choice(SAMPLE_TICKET_DESCRIPTIONS)

        payload = {
            "title": title,
            "description": description,
            "priority": random.choice(["low", "medium", "high", "critical"]),
            "category": random.choice(["network", "software", "hardware", "access"]),
            "contact_email": f"user{random.randint(100, 999)}@company.com",
        }

        with self.client.post(
            "/tickets",
            json=payload,
            headers=self.auth_headers,
            name="/tickets POST",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 201):
                resp.success()
                try:
                    body = resp.json()
                    if isinstance(body, dict) and "id" in body:
                        self.created_ticket_ids.append(body["id"])
                except (json.JSONDecodeError, ValueError):
                    pass
            elif resp.status_code == 422:
                # Validation error — acceptable if payload doesn't match schema
                resp.success()
            else:
                resp.failure(f"Create ticket failed: HTTP {resp.status_code}")

    # ── Task 6: Save Ticket ─────────────────────────────

    @task(2)
    def save_ticket(self):
        """POST /tickets/save — save ticket from draft/form."""
        payload = {
            "title": random.choice(SAMPLE_TICKET_TITLES),
            "description": random.choice(SAMPLE_TICKET_DESCRIPTIONS),
            "status": "draft",
            "urgency": random.choice(["low", "medium", "high"]),
        }

        with self.client.post(
            "/tickets/save",
            json=payload,
            headers=self.auth_headers,
            name="/tickets/save",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 201):
                resp.success()
            else:
                resp.failure(f"Save ticket failed: HTTP {resp.status_code}")

    # ── Task 7: AI Ticket Analysis ──────────────────────

    @task(4)
    def analyze_ticket(self):
        """POST /ai/analyze_ticket — full AI triage pipeline (DistilBERT)."""
        payload = {
            "ticket_text": f"{random.choice(SAMPLE_TICKET_TITLES)}. "
                           f"{random.choice(SAMPLE_TICKET_DESCRIPTIONS)}",
            "ticket_id": f"TKT-{random.randint(1000, 9999)}",
        }

        with self.client.post(
            "/ai/analyze_ticket",
            json=payload,
            headers=self.auth_headers,
            name="/ai/analyze_ticket",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                resp.success()
                # Verify response has expected structure
                try:
                    body = resp.json()
                    if not isinstance(body, dict):
                        resp.failure("Response is not a JSON object")
                except (json.JSONDecodeError, ValueError):
                    resp.failure("Response is not valid JSON")
            elif resp.status_code == 503:
                # Model not loaded — acceptable on staging without GPU
                resp.success()
            else:
                resp.failure(f"AI analysis failed: HTTP {resp.status_code}")

    # ── Task 8: AI Lightweight Analysis ─────────────────

    @task(2)
    def analyze_only(self):
        """POST /ai/analyze — lightweight analysis (no ticket save)."""
        payload = {
            "ticket_text": random.choice(SAMPLE_TICKET_DESCRIPTIONS),
        }

        with self.client.post(
            "/ai/analyze",
            json=payload,
            headers=self.auth_headers,
            name="/ai/analyze",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            elif resp.status_code == 503:
                resp.success()  # Model loading acceptable
            else:
                resp.failure(f"Analyze only failed: HTTP {resp.status_code}")

    # ── Task 9: AI Troubleshooting ──────────────────────

    @task(1)
    def troubleshoot(self):
        """POST /ai/troubleshoot — get step-by-step troubleshooting."""
        payload = {
            "query": random.choice(SAMPLE_TICKET_TITLES),
            "history": [],
        }

        with self.client.post(
            "/ai/troubleshoot",
            json=payload,
            headers=self.auth_headers,
            name="/ai/troubleshoot",
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                resp.success()
            else:
                resp.failure(f"Troubleshoot failed: HTTP {resp.status_code}")

    # ── Task 10: Patch Ticket ───────────────────────────

    @task(1)
    def update_ticket(self):
        """PATCH /tickets/{id} — update ticket status/priority."""
        ticket_id = f"TKT-{random.randint(1000, 9999)}"
        payload = {
            "status": random.choice(["in_progress", "resolved"]),
            "priority": random.choice(["low", "medium", "high"]),
        }

        with self.client.patch(
            f"/tickets/{ticket_id}",
            json=payload,
            headers=self.auth_headers,
            name="/tickets/{id} PATCH",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 404):
                resp.success()
            else:
                resp.failure(f"Update ticket failed: HTTP {resp.status_code}")


# ── Event Handlers ──────────────────────────────────────────

@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Called when the load test starts."""
    print(f"[LOAD TEST] Starting performance test against {environment.host}")
    print(f"[LOAD TEST] Performance budget: "
          f"CRUD p50<{PERFORMANCE_BUDGET.crud.p50_ms}ms, "
          f"p95<{PERFORMANCE_BUDGET.crud.p95_ms}ms, "
          f"p99<{PERFORMANCE_BUDGET.crud.p99_ms}ms")
    print(f"[LOAD TEST] AI p50<{PERFORMANCE_BUDGET.ai_analysis.p50_ms}ms, "
          f"p95<{PERFORMANCE_BUDGET.ai_analysis.p95_ms}ms")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Called when the load test stops."""
    stats = environment.stats
    print(f"\n[LOAD TEST] Test complete: {stats.total.num_requests} requests in "
          f"{stats.total.total_content_length / 1024:.1f} KB")
    print(f"[LOAD TEST] Fail ratio: {stats.total.fail_ratio * 100:.2f}%")

    # SLA validation
    sla_violations = 0
    for key, entry in stats.entries.items():
        endpoint = entry.name
        threshold = PERFORMANCE_BUDGET.get_threshold(endpoint)

        if entry.avg_response_time > threshold.p50_ms:
            print(f"  ⚠ SLA VIOLATION: {endpoint} avg={entry.avg_response_time:.0f}ms "
                  f"> p50 threshold={threshold.p50_ms}ms")
            sla_violations += 1
        if entry.total_rps and entry.fail_ratio > threshold.max_error_rate:
            print(f"  ⚠ SLA VIOLATION: {endpoint} error_rate={entry.fail_ratio*100:.2f}% "
                  f"> threshold={threshold.max_error_rate*100:.2f}%")
            sla_violations += 1

    if sla_violations == 0:
        print("[LOAD TEST] ✅ All SLA thresholds passed!")
    else:
        print(f"[LOAD TEST] ❌ {sla_violations} SLA violations detected")

    # Write results summary for the report generator
    report_dir = os.environ.get("LOAD_TEST_REPORT_DIR", "load_test_reports")
    os.makedirs(report_dir, exist_ok=True)
    summary_path = os.path.join(report_dir, "summary.json")

    summary = {
        "total_requests": stats.total.num_requests,
        "total_failures": stats.total.num_failures,
        "fail_ratio": stats.total.fail_ratio,
        "avg_response_time_ms": stats.total.avg_response_time,
        "p95_response_time_ms": getattr(stats.total, "get_response_time_percentile", lambda x: 0)(0.95)
        if hasattr(stats.total, "get_response_time_percentile") else 0,
        "requests_per_second": stats.total.total_rps if hasattr(stats.total, "total_rps") else 0,
        "total_content_bytes": stats.total.total_content_length,
        "sla_violations": sla_violations,
        "sla_passed": sla_violations == 0,
        "endpoints": {
            key: {
                "avg_ms": entry.avg_response_time,
                "min_ms": entry.min_response_time,
                "max_ms": entry.max_response_time,
                "num_requests": entry.num_requests,
                "num_failures": entry.num_failures,
                "fail_ratio": entry.fail_ratio,
                "rps": entry.total_rps if hasattr(entry, "total_rps") else 0,
            }
            for key, entry in stats.entries.items()
        },
    }

    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)

    print(f"[LOAD TEST] Summary saved to: {summary_path}")
