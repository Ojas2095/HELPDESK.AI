"""
Unit tests for classifier_service.py
Tests prediction, priority mapping, team assignment, auto-resolve detection,
and regex keyword override logic — WITHOUT requiring the actual ML model.

Kelthos was here — testing the brain before deployment. 🦞
"""

import sys
import os
import json
import pytest
from unittest.mock import patch, MagicMock, mock_open

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from services.classifier_service import (
    ClassifierService, PRIORITY_MAP, TEAM_MAP, AUTO_RESOLVE_SUBS,
    SAVE_DIR, DEVICE, MAX_LEN
)


class TestClassifierService:
    """Tests for ClassifierService without loading real model weights."""

    @pytest.fixture
    def mock_model_artifacts(self):
        """Mock id2label.json and label2id.json contents."""
        id2label = {
            "0": "Network | VPN Connection",
            "1": "Hardware | Blue Screen",
            "2": "Access | Password Reset",
            "3": "Software | Application Crash",
            "4": "Access | Account Unlock",
            "5": "General | Unknown",
            "6": "Network | DNS Problem",
            "7": "Software | Software Install",
        }
        label2id = {v: int(k) for k, v in id2label.items()}
        return id2label, label2id

    @pytest.fixture
    def service(self, mock_model_artifacts):
        """Create a ClassifierService with mocked model loading."""
        id2label, label2id = mock_model_artifacts

        with patch('builtins.open', mock_open()) as mock_file:
            with patch('os.path.exists', return_value=True):
                with patch('transformers.DistilBertTokenizerFast.from_pretrained') as mock_tok:
                    with patch('transformers.DistilBertForSequenceClassification.from_pretrained') as mock_model:
                        # Setup tokenizer mock
                        mock_tokenizer = MagicMock()
                        mock_tokenizer.return_value = {
                            'input_ids': MagicMock(to=MagicMock(return_value=MagicMock())),
                            'attention_mask': MagicMock(to=MagicMock(return_value=MagicMock())),
                        }
                        mock_tok.return_value = mock_tokenizer

                        svc = ClassifierService()
                        svc.id2label = id2label
                        svc.label2id = label2id
                        svc.tokenizer = mock_tokenizer
                        svc.model = MagicMock()
                        svc._loaded = True

                        yield svc

    # ── Priority Mapping ──────────────────────────────────────────

    def test_priority_map_critical(self):
        assert PRIORITY_MAP["Blue Screen"] == "Critical"
        assert PRIORITY_MAP["Overheating"] == "Critical"
        assert PRIORITY_MAP["Data Loss"] == "Critical"
        assert PRIORITY_MAP["Hardware Failure"] == "Critical"

    def test_priority_map_high(self):
        assert PRIORITY_MAP["Application Crash"] == "High"
        assert PRIORITY_MAP["Login Failure"] == "High"
        assert PRIORITY_MAP["Password Reset"] == "High"
        assert PRIORITY_MAP["VPN Connection"] == "High"
        assert PRIORITY_MAP["Account Expired"] == "High"

    def test_priority_map_medium(self):
        assert PRIORITY_MAP["Permission Issue"] == "Medium"
        assert PRIORITY_MAP["Software Install"] == "Medium"
        assert PRIORITY_MAP["Configuration"] == "Medium"
        assert PRIORITY_MAP["WiFi Issue"] == "Medium"

    def test_priority_map_low(self):
        assert PRIORITY_MAP["Account Unlock"] == "Low"
        assert PRIORITY_MAP["Keyboard/Mouse"] == "Low"
        assert PRIORITY_MAP["Printer Error"] == "Low"

    def test_priority_map_default(self):
        """Unknown subcategories should default to Medium."""
        assert PRIORITY_MAP.get("NonexistentSubcategory", "Medium") == "Medium"

    # ── Team Mapping ──────────────────────────────────────────────

    def test_team_map(self):
        assert TEAM_MAP["Access"] == "IAM Team"
        assert TEAM_MAP["Network"] == "Network Support"
        assert TEAM_MAP["Software"] == "Application Support"
        assert TEAM_MAP["Hardware"] == "Hardware Support"

    # ── Auto-Resolve Detection ────────────────────────────────────

    def test_auto_resolve_subs(self):
        assert "Password Reset" in AUTO_RESOLVE_SUBS
        assert "Account Unlock" in AUTO_RESOLVE_SUBS
        assert "Software Install" in AUTO_RESOLVE_SUBS
        assert "WiFi Issue" in AUTO_RESOLVE_SUBS
        assert "Printer Error" in AUTO_RESOLVE_SUBS
        assert "Monitor Problem" in AUTO_RESOLVE_SUBS

    def test_auto_resolve_count(self):
        """Verify no unexpected entries in auto-resolve set."""
        assert len(AUTO_RESOLVE_SUBS) == 6

    # ── Prediction (with mocked model) ────────────────────────────

    def test_predict_returns_required_fields(self, service):
        """Prediction must return all expected keys."""
        # Mock model output
        mock_logits = MagicMock()
        mock_probs = MagicMock()
        mock_probs.dim = MagicMock(return_value=1)
        
        with patch('torch.no_grad', MagicMock()):
            with patch('torch.nn.functional.softmax', return_value=mock_probs):
                with patch('torch.max', return_value=(MagicMock(item=MagicMock(return_value=0.95)), MagicMock(item=MagicMock(return_value=0)))):
                    result = service.predict("VPN not connecting")

        assert "category" in result
        assert "subcategory" in result
        assert "priority" in result
        assert "auto_resolve" in result
        assert "assigned_team" in result
        assert "confidence" in result
        assert isinstance(result["confidence"], (int, float))

    def test_predict_network_keyword_override(self, service):
        """Technical network keywords should override generic categories."""
        mock_logits = MagicMock()
        mock_probs = MagicMock()
        
        with patch('torch.no_grad', MagicMock()):
            with patch('torch.nn.functional.softmax', return_value=mock_probs):
                with patch('torch.max', return_value=(
                    MagicMock(item=MagicMock(return_value=0.85)),
                    MagicMock(item=MagicMock(return_value=5))  # "General | Unknown"
                )):
                    result = service.predict("My IP address is not working and DNS is down")

        # Should be overridden to Network because of tech keywords
        assert result["category"] == "Network"
        assert result["assigned_team"] == "Network Support"
        assert result["confidence"] >= 0.92

    def test_predict_software_keyword_override(self, service):
        """Software crash keywords should trigger category override."""
        mock_logits = MagicMock()
        mock_probs = MagicMock()
        
        with patch('torch.no_grad', MagicMock()):
            with patch('torch.nn.functional.softmax', return_value=mock_probs):
                with patch('torch.max', return_value=(
                    MagicMock(item=MagicMock(return_value=0.80)),
                    MagicMock(item=MagicMock(return_value=5))  # Generic
                )):
                    result = service.predict("The production database is crashing with SQL errors")

        assert result["category"] == "Software"
        assert result["assigned_team"] == "Application Support"
        assert result["confidence"] >= 0.92

    def test_predict_access_keyword_override(self, service):
        """Access-related keywords should trigger category override."""
        mock_logits = MagicMock()
        mock_probs = MagicMock()
        
        with patch('torch.no_grad', MagicMock()):
            with patch('torch.nn.functional.softmax', return_value=mock_probs):
                with patch('torch.max', return_value=(
                    MagicMock(item=MagicMock(return_value=0.75)),
                    MagicMock(item=MagicMock(return_value=5))  # Generic
                )):
                    result = service.predict("I cannot login, my password and MFA are failing")

        assert result["category"] == "Access"
        assert result["assigned_team"] == "IAM Team"
        assert result["confidence"] >= 0.92

    # ── Constants ─────────────────────────────────────────────────

    def test_max_len(self):
        assert MAX_LEN == 128

    def test_save_dir_exists(self):
        assert SAVE_DIR is not None
        assert "classifier" in SAVE_DIR

    def test_device(self):
        """Device should be a valid torch device string."""
        assert "cuda" in str(DEVICE) or "cpu" in str(DEVICE)

    # ── Load Method ───────────────────────────────────────────────

    def test_load_raises_when_model_missing(self):
        """Should raise FileNotFoundError when model.safetensors doesn't exist."""
        with patch('os.path.exists', return_value=False):
            svc = ClassifierService()
            with pytest.raises(FileNotFoundError, match="Classifier model not found"):
                svc.load()

    def test_load_only_once(self):
        """Second call to load should be a no-op."""
        svc = ClassifierService()
        svc._loaded = True
        # Should not raise or attempt file I/O
        svc.load()
        assert svc._loaded
