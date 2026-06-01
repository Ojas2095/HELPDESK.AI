import unittest
import time
import base64
import json
import sys
from unittest.mock import MagicMock

# Mock heavy machine learning dependencies for fast and environment-agnostic unit testing
class MockModel(MagicMock):
    pass

sys.modules['torch'] = MagicMock()
sys.modules['torch.nn'] = MagicMock()
sys.modules['torch.nn.functional'] = MagicMock()
sys.modules['transformers'] = MagicMock()
sys.modules['sentence_transformers'] = MagicMock()
sys.modules['easyocr'] = MagicMock()
sys.modules['datasets'] = MagicMock()
sys.modules['accelerate'] = MagicMock()

from fastapi.testclient import TestClient
from backend.main import app

# Constants for testing
TENANT_A_COMPANY = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
TENANT_B_COMPANY = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

USER_A_ID = "11111111-1111-1111-1111-111111111111"
USER_B_ID = "22222222-2222-2222-2222-222222222222"
ADMIN_A_ID = "88888888-8888-8888-8888-888888888888"

TICKET_A_ID = "daaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
TICKET_B_ID = "dbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

ATTACHMENT_A_ID = "faaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

class MockSupabaseClient:
    """Mock Supabase client that returns isolated test data based on query arguments."""
    
    class MockQuery:
        def __init__(self, table, filter_col=None, filter_val=None, is_single=False, is_contains=False):
            self.table = table
            self.filter_col = filter_col
            self.filter_val = filter_val
            self.is_single = is_single
            self.is_contains = is_contains

        def select(self, *args, **kwargs):
            return self

        def eq(self, col, val):
            return MockSupabaseClient.MockQuery(self.table, col, val, self.is_single, self.is_contains)

        def contains(self, col, val):
            return MockSupabaseClient.MockQuery(self.table, col, val, self.is_single, is_contains=True)

        def single(self):
            return MockSupabaseClient.MockQuery(self.table, self.filter_col, self.filter_val, is_single=True, is_contains=self.is_contains)

        def order(self, *args, **kwargs):
            return self

        def execute(self):
            class MockResponse:
                def __init__(self, data):
                    self.data = data

            # Mock Profiles table responses
            if self.table == "profiles":
                if self.filter_val == USER_A_ID:
                    return MockResponse({"id": USER_A_ID, "company_id": TENANT_A_COMPANY, "role": "user", "full_name": "User A"})
                elif self.filter_val == USER_B_ID:
                    return MockResponse({"id": USER_B_ID, "company_id": TENANT_B_COMPANY, "role": "user", "full_name": "User B"})
                elif self.filter_val == ADMIN_A_ID:
                    return MockResponse({"id": ADMIN_A_ID, "company_id": TENANT_A_COMPANY, "role": "admin", "full_name": "Admin A"})
                else:
                    return MockResponse(None if self.is_single else [])

            # Mock Tickets table responses
            elif self.table == "tickets":
                if self.filter_col == "id":
                    if self.filter_val == TICKET_A_ID:
                        return MockResponse({"id": TICKET_A_ID, "company_id": TENANT_A_COMPANY, "title": "Ticket A", "status": "open", "priority": "low"})
                    elif self.filter_val == TICKET_B_ID:
                        return MockResponse({"id": TICKET_B_ID, "company_id": TENANT_B_COMPANY, "title": "Ticket B", "status": "open", "priority": "high"})
                elif self.filter_col == "company_id":
                    if self.filter_val == TENANT_A_COMPANY:
                        return MockResponse([{"id": TICKET_A_ID, "company_id": TENANT_A_COMPANY, "title": "Ticket A", "status": "open", "priority": "low"}])
                    elif self.filter_val == TENANT_B_COMPANY:
                        return MockResponse([{"id": TICKET_B_ID, "company_id": TENANT_B_COMPANY, "title": "Ticket B", "status": "open", "priority": "high"}])
                return MockResponse(None if self.is_single else [])

            # Mock Ticket Messages responses for attachments
            elif self.table == "ticket_messages":
                if self.is_contains and self.filter_val == [ATTACHMENT_A_ID]:
                    return MockResponse([{"id": "msg-123", "ticket_id": TICKET_A_ID, "attachments": [ATTACHMENT_A_ID]}])
                return MockResponse([])

            # Mock SLA escalations or other defaults
            return MockResponse([])

    def table(self, table_name):
        return self.MockQuery(table_name)

    def rpc(self, fn_name, params=None):
        class MockRpc:
            def execute(self):
                class MockRpcRes:
                    def __init__(self):
                        self.data = True
                return MockRpcRes()
        return MockRpc()

def generate_mock_jwt(user_id: str) -> str:
    """Generates a mock unverified JWT token containing the user_id in the sub claim."""
    header = {"alg": "none", "typ": "JWT"}
    payload = {"sub": user_id, "exp": int(time.time()) + 3600}
    
    header_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("=")
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    
    return f"{header_b64}.{payload_b64}.signature"

class TestTenantIsolation(unittest.TestCase):
    def setUp(self):
        # Override FastAPI app state supabase and global main.supabase with our mock client
        mock_client = MockSupabaseClient()
        app.state.supabase = mock_client
        import backend.main
        backend.main.supabase = mock_client
        self.client = TestClient(app)

    def test_happy_path_access_own_ticket(self):
        """User A can read their own ticket from Company A."""
        token = generate_mock_jwt(USER_A_ID)
        headers = {"Authorization": f"Bearer {token}"}
        
        response = self.client.get(f"/tickets/{TICKET_A_ID}", headers=headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], TICKET_A_ID)

    def test_cross_tenant_ticket_read_denied(self):
        """User A is barred from reading User B's ticket (mismatched company_id)."""
        token = generate_mock_jwt(USER_A_ID)
        headers = {"Authorization": f"Bearer {token}"}
        
        response = self.client.get(f"/tickets/{TICKET_B_ID}", headers=headers)
        self.assertEqual(response.status_code, 403)
        self.assertIn("forbidden", response.json()["detail"].lower())

    def test_cross_tenant_profile_read_denied(self):
        """User A cannot query User B's profile directly."""
        token = generate_mock_jwt(USER_A_ID)
        headers = {"Authorization": f"Bearer {token}"}
        
        response = self.client.get(f"/users/{USER_B_ID}", headers=headers)
        self.assertEqual(response.status_code, 403)
        self.assertIn("forbidden", response.json()["detail"].lower())

    def test_cross_tenant_attachment_read_denied(self):
        """User B cannot fetch an attachment belonging to Company A's ticket."""
        token = generate_mock_jwt(USER_B_ID)
        headers = {"Authorization": f"Bearer {token}"}
        
        response = self.client.get(f"/attachments/{ATTACHMENT_A_ID}", headers=headers)
        self.assertEqual(response.status_code, 403)
        self.assertIn("forbidden", response.json()["detail"].lower())

    def test_tenant_context_spoofing_prevention(self):
        """User A cannot pass Company B's ID in query parameters to spoof the context."""
        token = generate_mock_jwt(USER_A_ID)
        headers = {"Authorization": f"Bearer {token}"}
        
        # Accessing analytics of Company B with User A's token
        response = self.client.get(f"/analytics?company_id={TENANT_B_COMPANY}", headers=headers)
        self.assertEqual(response.status_code, 403)
        self.assertIn("mismatches", response.json()["detail"].lower())

    def test_analytics_isolated(self):
        """User A gets only their company's analytics."""
        token = generate_mock_jwt(USER_A_ID)
        headers = {"Authorization": f"Bearer {token}"}
        
        response = self.client.get(f"/analytics?company_id={TENANT_A_COMPANY}", headers=headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["company_id"], TENANT_A_COMPANY)

    def test_admin_dashboard_access_allowed(self):
        """Admin A can fetch the security dashboard."""
        token = generate_mock_jwt(ADMIN_A_ID)
        headers = {"Authorization": f"Bearer {token}"}
        
        response = self.client.get("/security/dashboard", headers=headers)
        self.assertEqual(response.status_code, 200)
        self.assertIn("leakage_risk_score", response.json())

    def test_non_admin_dashboard_access_forbidden(self):
        """Standard User A cannot fetch the security dashboard."""
        token = generate_mock_jwt(USER_A_ID)
        headers = {"Authorization": f"Bearer {token}"}
        
        response = self.client.get("/security/dashboard", headers=headers)
        self.assertEqual(response.status_code, 403)

    def test_middleware_performance_overhead(self):
        """Verifies that the tenant context middleware has negligible processing overhead (< 100ms)."""
        token = generate_mock_jwt(USER_A_ID)
        headers = {"Authorization": f"Bearer {token}"}
        
        start_time = time.perf_counter()
        response = self.client.get(f"/tickets/{TICKET_A_ID}", headers=headers)
        duration_ms = (time.perf_counter() - start_time) * 1000.0
        
        self.assertEqual(response.status_code, 200)
        self.assertLess(duration_ms, 100.0, "Middleware response is too slow")
        
        # Verify custom header exists and is < 10ms
        header_time = float(response.headers.get("X-Tenant-Isolation-Time-Ms", "999.0"))
        self.assertLess(header_time, 10.0, "Middleware execution overhead exceeded 10ms limit")

if __name__ == "__main__":
    unittest.main()
