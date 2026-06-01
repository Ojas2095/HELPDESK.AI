"""
Tests for NER Service — unit tests for entity extraction, regex fallback,
label parsing, and edge cases.

Focuses on the regex fallback layer and _clean_label helper since the
DistilBert model requires GPU/heavy dependencies that are mocked in CI.

Issue #837: test : add unit tests for ner_service
"""

import re
import pytest
import sys
import importlib
from unittest.mock import patch, MagicMock


# ── Regex patterns copied from ner_service.py ──────────────────────────
# (conftest stubs out the whole module, so we duplicate the patterns here
#  and test them independently. The service code is the source of truth.)
REGEX_PATTERNS = {
    "IP_ADDRESS": r"\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b|IP\s?Address",
    "HOSTNAME": r"\b(?:srv|db|app|web|dev|prod)-[\w\d-]+\b|Hostname",
    "NETWORK_ERROR": r"Network issues|Timeout|Connection failed|Cannot load|Latency|Spikes",
    "LOGIN_ISSUE": r"logging in|login error|authentication failed|MFA",
    "VLAN": r"\bVLAN\s?\d+\b",
    "DATABASE": r"\bSQL\b|\bPostgres\b|\bDatabase\b|\bCluster\b|\bNode\b",
    "SYSTEM": r"\bProduction\b|\bStaging\b|\bInstance\b|\bMainframe\b",
    "BROWSER": r"Chrome|Edge|Firefox|Safari|Browser",
}


# ── Load the real NERService class by bypassing conftest stubs ─────────
def _load_real_ner_service():
    """Import the real ner_service module, working around conftest stubs."""
    # Remove the stub so we can import the real module
    stub = sys.modules.pop("backend.services.ner_service", None)

    # Also temporarily unstub torch if it was faked
    torch_modules = {}
    for mod_name in ["torch", "torch.nn.functional", "transformers"]:
        if mod_name in sys.modules and hasattr(sys.modules[mod_name], "_mock_name"):
            torch_modules[mod_name] = sys.modules.pop(mod_name)

    try:
        # Fresh import
        if "backend.services.ner_service" in sys.modules:
            del sys.modules["backend.services.ner_service"]
        mod = importlib.import_module("backend.services.ner_service")
        importlib.reload(mod)
        return mod.NERService, mod
    finally:
        # Restore stubs so other tests aren't affected
        if stub is not None:
            sys.modules["backend.services.ner_service"] = stub
        for mod_name, mod_obj in torch_modules.items():
            sys.modules[mod_name] = mod_obj


try:
    NERService, _ner_mod = _load_real_ner_service()
    _HAS_REAL_NER = True
except Exception:
    _HAS_REAL_NER = False
    NERService = None


# ═══════════════════════════════════════════════════════════════════════
# _clean_label tests — pure logic, no ML dependencies
# ═══════════════════════════════════════════════════════════════════════

class TestCleanLabel:
    """Tests for NERService._clean_label() — label parsing helper."""

    @pytest.fixture(autouse=True)
    def _svc(self):
        if not _HAS_REAL_NER:
            pytest.skip("Real NERService not importable (torch/transformers missing)")
        self.svc = NERService()

    def test_o_tag_returns_empty_entity(self):
        bio, entity = self.svc._clean_label("O")
        assert bio == "O"
        assert entity == ""

    def test_b_b_prefix_parsed_correctly(self):
        """B-B-APP_NAME → ('B', 'APP_NAME')"""
        bio, entity = self.svc._clean_label("B-B-APP_NAME")
        assert bio == "B"
        assert entity == "APP_NAME"

    def test_i_b_prefix_parsed_correctly(self):
        """I-B-APP_NAME → ('I', 'APP_NAME')"""
        bio, entity = self.svc._clean_label("I-B-APP_NAME")
        assert bio == "I"
        assert entity == "APP_NAME"

    def test_b_prefix_single_dash(self):
        """B-LOCATION → ('B', 'LOCATION')"""
        bio, entity = self.svc._clean_label("B-LOCATION")
        assert bio == "B"
        assert entity == "LOCATION"

    def test_i_prefix_single_dash(self):
        """I-LOCATION → ('I', 'LOCATION')"""
        bio, entity = self.svc._clean_label("I-LOCATION")
        assert bio == "I"
        assert entity == "LOCATION"

    def test_unknown_label_returns_o(self):
        bio, entity = self.svc._clean_label("UNKNOWN_LABEL")
        assert bio == "O"
        assert entity == ""

    def test_empty_label_returns_o(self):
        bio, entity = self.svc._clean_label("")
        assert bio == "O"
        assert entity == ""

    def test_b_b_multiple_entity_types(self):
        """Various entity type suffixes should parse correctly."""
        for suffix in ["APP_NAME", "PRODUCT", "LOCATION", "PERSON", "NETWORK_ERROR"]:
            bio, entity = self.svc._clean_label(f"B-B-{suffix}")
            assert bio == "B"
            assert entity == suffix

    def test_i_b_continuation(self):
        bio, entity = self.svc._clean_label("I-B-PRODUCT")
        assert bio == "I"
        assert entity == "PRODUCT"


# ═══════════════════════════════════════════════════════════════════════
# Regex pattern tests — verify each pattern matches expected inputs
# ═══════════════════════════════════════════════════════════════════════

class TestRegexPatternIP:
    def test_matches_ipv4(self):
        p = REGEX_PATTERNS["IP_ADDRESS"]
        assert re.search(p, "Server at 192.168.1.1 is down")
        assert re.search(p, "10.0.0.1 unreachable")
        assert re.search(p, "IP Address: 172.16.0.100")

    def test_no_match_plain_text(self):
        assert not re.search(REGEX_PATTERNS["IP_ADDRESS"], "no ip here just text")

    def test_matches_ip_keyword(self):
        assert re.search(REGEX_PATTERNS["IP_ADDRESS"], "IP Address assigned")

    def test_boundary_255(self):
        assert re.search(REGEX_PATTERNS["IP_ADDRESS"], "255.255.255.255")


class TestRegexPatternHostname:
    def test_matches_server_names(self):
        p = REGEX_PATTERNS["HOSTNAME"]
        assert re.search(p, "srv-prod-01 is unreachable")
        assert re.search(p, "db-main-cluster")
        assert re.search(p, "app-web-frontend")
        assert re.search(p, "dev-api-server")

    def test_no_match_plain_words(self):
        assert not re.search(REGEX_PATTERNS["HOSTNAME"], "the server is fine")

    def test_matches_hostname_keyword(self):
        assert re.search(REGEX_PATTERNS["HOSTNAME"], "Hostname resolution failed")


class TestRegexPatternNetworkError:
    def test_all_keywords(self):
        p = REGEX_PATTERNS["NETWORK_ERROR"]
        for kw in ["Network issues", "Timeout", "Connection failed", "Cannot load", "Latency", "Spikes"]:
            assert re.search(p, f"Got {kw} error"), f"Failed to match: {kw}"

    def test_no_match_generic_text(self):
        assert not re.search(REGEX_PATTERNS["NETWORK_ERROR"], "Everything is working fine")


class TestRegexPatternLoginIssue:
    def test_login_keywords(self):
        p = REGEX_PATTERNS["LOGIN_ISSUE"]
        for kw in ["logging in", "login error", "authentication failed", "MFA"]:
            assert re.search(p, f"User reported {kw}"), f"Failed: {kw}"


class TestRegexPatternVlan:
    def test_vlan_with_space(self):
        assert re.search(REGEX_PATTERNS["VLAN"], "Check VLAN 42 config")

    def test_vlan_without_space(self):
        assert re.search(REGEX_PATTERNS["VLAN"], "VLAN100 is misconfigured")

    def test_no_match_no_vlan(self):
        assert not re.search(REGEX_PATTERNS["VLAN"], "No vlan issue here")


class TestRegexPatternDatabase:
    def test_keywords(self):
        p = REGEX_PATTERNS["DATABASE"]
        for kw in ["SQL", "Postgres", "Database", "Cluster", "Node"]:
            assert re.search(p, f"{kw} connection error"), f"Failed: {kw}"


class TestRegexPatternSystem:
    def test_keywords(self):
        p = REGEX_PATTERNS["SYSTEM"]
        for kw in ["Production", "Staging", "Instance", "Mainframe"]:
            assert re.search(p, f"{kw} environment"), f"Failed: {kw}"


class TestRegexPatternBrowser:
    def test_browsers(self):
        p = REGEX_PATTERNS["BROWSER"]
        for b in ["Chrome", "Edge", "Firefox", "Safari"]:
            assert re.search(p, f"{b} version 120"), f"Failed: {b}"

    def test_browser_keyword(self):
        assert re.search(REGEX_PATTERNS["BROWSER"], "Browser cache cleared")


# ═══════════════════════════════════════════════════════════════════════
# Regex extraction integration — simulates the fallback layer
# ═══════════════════════════════════════════════════════════════════════

def _regex_extract(text: str) -> list[dict]:
    """Simulate the regex fallback extraction from ner_service.extract_entities."""
    entities = []
    for label, pattern in REGEX_PATTERNS.items():
        for match in re.finditer(pattern, text, re.IGNORECASE):
            match_text = match.group()
            if not any(e["text"].lower() == match_text.lower() for e in entities):
                entities.append({"text": match_text, "label": label, "confidence": 0.99})
    return entities


class TestRegexExtraction:
    def test_ip_address_extracted(self):
        entities = _regex_extract("Server 192.168.1.100 is not responding")
        ips = [e for e in entities if e["label"] == "IP_ADDRESS"]
        assert len(ips) >= 1
        assert ips[0]["text"] == "192.168.1.100"

    def test_multiple_hostnames(self):
        entities = _regex_extract("srv-prod-01 and db-replica-02 are both down")
        hosts = [e for e in entities if e["label"] == "HOSTNAME"]
        texts = [h["text"] for h in hosts]
        assert "srv-prod-01" in texts
        assert "db-replica-02" in texts

    def test_multiple_entity_types(self):
        text = "Chrome on srv-web-01 reports Timeout to Database at 10.0.0.5"
        entities = _regex_extract(text)
        labels = {e["label"] for e in entities}
        assert "BROWSER" in labels
        assert "HOSTNAME" in labels
        assert "NETWORK_ERROR" in labels
        assert "DATABASE" in labels

    def test_no_entities_plain_text(self):
        entities = _regex_extract("The quick brown fox jumps over the lazy dog")
        assert len(entities) == 0

    def test_case_insensitive(self):
        entities = _regex_extract("CHROME browser TIMEOUT on SRV-PROD-01")
        labels = {e["label"] for e in entities}
        assert "BROWSER" in labels
        assert "NETWORK_ERROR" in labels
        assert "HOSTNAME" in labels

    def test_deduplication(self):
        entities = _regex_extract("Chrome and Chrome and Chrome")
        browsers = [e for e in entities if e["label"] == "BROWSER"]
        assert len(browsers) == 1

    def test_confidence_always_099(self):
        entities = _regex_extract("Timeout on srv-prod-01 and Chrome browser")
        for e in entities:
            assert e["confidence"] == 0.99

    def test_empty_string_returns_empty(self):
        assert _regex_extract("") == []

    def test_whitespace_only_returns_empty(self):
        assert _regex_extract("   ") == []

    def test_complex_ticket_text(self):
        """Simulate a realistic helpdesk ticket description."""
        text = (
            "User reports login error on Chrome browser. "
            "Server srv-app-01 shows Timeout connecting to Postgres database. "
            "IP 10.0.0.5 unreachable from VLAN 42. "
            "Production environment affected."
        )
        entities = _regex_extract(text)
        labels = {e["label"] for e in entities}
        assert "LOGIN_ISSUE" in labels
        assert "BROWSER" in labels
        assert "HOSTNAME" in labels
        assert "NETWORK_ERROR" in labels
        assert "DATABASE" in labels
        assert "VLAN" in labels
        assert "SYSTEM" in labels
        assert len(entities) >= 6

    def test_mfa_and_ip(self):
        entities = _regex_extract("MFA token expired for user at 172.16.0.100")
        labels = {e["label"] for e in entities}
        assert "LOGIN_ISSUE" in labels
        assert "IP_ADDRESS" in labels


# ═══════════════════════════════════════════════════════════════════════
# Model-dependent tests (mocked) — verify service init and structure
# ═══════════════════════════════════════════════════════════════════════

@pytest.mark.skipif(not _HAS_REAL_NER, reason="Real NERService not importable")
class TestNERServiceInit:
    def test_initial_state_not_loaded(self):
        svc = NERService()
        assert svc._loaded is False
        assert svc.model is None
        assert svc.tokenizer is None
        assert svc.id2label is None

    def test_load_missing_model_raises_or_graceful(self):
        """load() raises FileNotFoundError when torch is available but model dir missing,
        or prints info and returns gracefully when torch is not available."""
        svc = NERService()
        import backend.services.ner_service as _ner
        if _ner._HAS_TORCH:
            with patch("os.path.exists", return_value=False):
                with pytest.raises(FileNotFoundError, match="NER model not found"):
                    svc.load()
        else:
            # Without torch, load() should silently return
            svc.load()
            assert svc._loaded is False

    def test_extract_empty_words_returns_empty(self):
        """extract_entities with empty string should return [] without loading model."""
        svc = NERService()
        svc._loaded = True
        svc.model = MagicMock()
        svc.tokenizer = MagicMock()
        svc.id2label = {"0": "O"}

        mock_encoding = MagicMock()
        mock_encoding.word_ids.return_value = []
        svc.tokenizer.return_value = mock_encoding

        mock_output = MagicMock()
        mock_output.logits = MagicMock()
        svc.model.return_value = mock_output

        with patch("torch.no_grad"):
            result = svc.extract_entities("")
            assert result == []
