# backend/tests/test_classifier_service.py
# Unit tests for ClassifierService (V1 DistilBert loader and predictor).

import os
import sys
import json
import pytest
from unittest.mock import patch, MagicMock, mock_open

# Mock heavy ML libraries before importing the service to keep test environment isolated and fast.
sys.modules['torch'] = MagicMock()
sys.modules['torch.nn.functional'] = MagicMock()
sys.modules['transformers'] = MagicMock()

# Force reloading the actual module (avoid using the mock stub in conftest.py)
if 'backend.services.classifier_service' in sys.modules:
    del sys.modules['backend.services.classifier_service']

from backend.services.classifier_service import ClassifierService, SAVE_DIR

class TestClassifierService:
    """Test suite covering model loading and prediction outcomes of ClassifierService."""

    def test_load_fails_when_model_missing(self):
        """Verify load() raises FileNotFoundError if model file is not present on disk."""
        svc = ClassifierService()
        with patch("os.path.exists", return_value=False):
            with pytest.raises(FileNotFoundError) as exc_info:
                svc.load()
            assert "Classifier model not found" in str(exc_info.value)

    def test_load_fails_when_lfs_placeholder(self):
        """Verify load() raises FileNotFoundError if model file is a Git LFS placeholder."""
        svc = ClassifierService()
        
        # Mock file operations to simulate reading LFS header info
        mock_lfs_header = b"version https://git-lfs.github.com/spec/v1\noid sha256:12345"
        
        with patch("os.path.exists", return_value=True), \
             patch("builtins.open", mock_open(read_data=mock_lfs_header)):
            with pytest.raises(FileNotFoundError) as exc_info:
                svc.load()
            assert "Git LFS placeholder, not the actual model" in str(exc_info.value)

    def test_load_success(self):
        """Verify load() successfully populates mappings and loads pretrained models when valid files exist."""
        svc = ClassifierService()
        
        id2label = {"0": "Software | Application Crash", "1": "Network | VPN Connection"}
        label2id = {"Software | Application Crash": 0, "Network | VPN Connection": 1}
        
        # Real binary header (non-LFS)
        mock_real_header = b"\x00\x00\x00\x00\x00\x00\x00"
        
        # Mock file reading for json configs
        def custom_mock_open(*args, **kwargs):
            path = args[0]
            if "id2label.json" in path:
                return mock_open(read_data=json.dumps(id2label))()
            elif "label2id.json" in path:
                return mock_open(read_data=json.dumps(label2id))()
            else:
                return mock_open(read_data=mock_real_header)()

        with patch("os.path.exists", return_value=True), \
             patch("builtins.open", side_effect=custom_mock_open), \
             patch("transformers.DistilBertTokenizerFast.from_pretrained") as mock_tok, \
             patch("transformers.DistilBertForSequenceClassification.from_pretrained") as mock_model, \
             patch("backend.services.classifier_service._HAS_TORCH", True):
            
            mock_model_instance = MagicMock()
            mock_model.return_value = mock_model_instance
            
            svc.load()
            
            assert svc._loaded is True
            assert svc.id2label == id2label
            assert svc.label2id == label2id
            mock_tok.assert_called_once()
            mock_model.assert_called_once()
            mock_model_instance.to.assert_called_once()
            mock_model_instance.eval.assert_called_once()

    def test_predict_success_mappings(self):
        """Verify predict() maps outputs correctly (category, priority, auto-resolve) from model logits."""
        svc = ClassifierService()
        svc._loaded = True
        svc.tokenizer = MagicMock()
        svc.model = MagicMock()
        svc.id2label = {"0": "Software | Application Crash", "1": "Access | Password Reset"}
        
        # Mock tokenizer outputs
        mock_encoding = {"input_ids": MagicMock(), "attention_mask": MagicMock()}
        svc.tokenizer.return_value = mock_encoding
        
        # Mock PyTorch outputs
        import torch
        import torch.nn.functional as F
        
        mock_logits = MagicMock()
        mock_outputs = MagicMock(logits=mock_logits)
        svc.model.return_value = mock_outputs
        
        mock_probs = MagicMock()
        F.softmax.return_value = mock_probs
        
        # Mock torch.max returning confidence = 0.95, pred_idx = 1
        mock_val = MagicMock()
        mock_val.item.return_value = 0.95
        mock_idx = MagicMock()
        mock_idx.item.return_value = 1
        torch.max.return_value = (mock_val, mock_idx)
        
        with patch("backend.services.classifier_service._HAS_TORCH", True), \
             patch("backend.services.classifier_service._METRICS_ENABLED", False):
            
            result = svc.predict("Cannot login with my account")
            
            assert result["category"] == "Access"
            assert result["subcategory"] == "Password Reset"
            assert result["priority"] == "High"  # In mapped list
            assert result["auto_resolve"] is True  # Password reset is auto-resolved
            assert result["assigned_team"] == "IAM Team"
            assert result["confidence"] == 0.95

    def test_predict_regex_override_boost(self):
        """Verify predict() applies regex override and boosts confidence when specific keywords are present."""
        svc = ClassifierService()
        svc._loaded = True
        svc.tokenizer = MagicMock()
        svc.model = MagicMock()
        svc.id2label = {"0": "General | Other"}
        
        # Mock tokenizer and PyTorch outputs
        import torch
        import torch.nn.functional as F
        
        mock_encoding = {"input_ids": MagicMock(), "attention_mask": MagicMock()}
        svc.tokenizer.return_value = mock_encoding
        mock_logits = MagicMock()
        mock_outputs = MagicMock(logits=mock_logits)
        svc.model.return_value = mock_outputs
        
        # Low confidence generic prediction (0.45)
        mock_val = MagicMock()
        mock_val.item.return_value = 0.45
        mock_idx = MagicMock()
        mock_idx.item.return_value = 0
        torch.max.return_value = (mock_val, mock_idx)
        
        with patch("backend.services.classifier_service._HAS_TORCH", True), \
             patch("backend.services.classifier_service._METRICS_ENABLED", False):
            
            # Text contains "VPN connection" (Network keyword signal)
            result = svc.predict("I am experiencing a VPN connection failure")
            
            # Should override "General" with "Network" and boost confidence
            assert result["category"] == "Network"
            assert result["assigned_team"] == "Network Support"
            assert result["confidence"] >= 0.92
