"""
Unit tests for classifier_service.py
Tests ML classifier loading routines and classification category distributions.
"""

import pytest
import os
import json
from unittest.mock import Mock, patch, MagicMock
import torch

# Mock the model directory before importing
@pytest.fixture(autouse=True)
def mock_model_path():
    with patch('backend.services.classifier_service.SAVE_DIR', '/mock/models/classifier'):
        yield

class TestClassifierServiceInit:
    """Test ClassifierService initialization."""
    
    def test_init_creates_empty_service(self):
        """Test that init creates service with None values."""
        from backend.services.classifier_service import ClassifierService
        service = ClassifierService()
        
        assert service.model is None
        assert service.tokenizer is None
        assert service.id2label is None
        assert service.label2id is None
        assert service._loaded is False
    
    def test_load_skip_if_already_loaded(self):
        """Test that load() skips if already loaded."""
        from backend.services.classifier_service import ClassifierService
        service = ClassifierService()
        service._loaded = True
        
        # Should not raise any error
        service.load()
        assert service._loaded is True


class TestClassifierServiceLoad:
    """Test ClassifierService model loading."""
    
    @patch('os.path.exists')
    @patch('builtins.open', create=True)
    @patch('backend.services.classifier_service.DistilBertTokenizerFast')
    @patch('backend.services.classifier_service.DistilBertForSequenceClassification')
    def test_load_success(self, mock_model_class, mock_tokenizer_class, mock_open, mock_exists):
        """Test successful model loading."""
        from backend.services.classifier_service import ClassifierService
        
        # Setup mocks
        mock_exists.return_value = True
        mock_open.return_value.__enter__ = Mock(return_value=Mock())
        mock_open.return_value.__enter__.return_value.read = Mock(return_value='{"0": "Network | DNS Problem"}')
        
        mock_tokenizer = Mock()
        mock_tokenizer_class.from_pretrained.return_value = mock_tokenizer
        
        mock_model = Mock()
        mock_model_class.from_pretrained.return_value = mock_model
        
        service = ClassifierService()
        service.load()
        
        assert service._loaded is True
        assert service.tokenizer is not None
        assert service.model is not None
    
    @patch('os.path.exists')
    def test_load_fails_without_model(self, mock_exists):
        """Test that load raises error when model not found."""
        from backend.services.classifier_service import ClassifierService
        
        mock_exists.return_value = False
        
        service = ClassifierService()
        with pytest.raises(FileNotFoundError):
            service.load()


class TestClassifierServicePredict:
    """Test ClassifierService prediction functionality."""
    
    @patch('backend.services.classifier_service.ClassifierService.load')
    def test_predict_returns_correct_structure(self, mock_load):
        """Test that predict returns all required fields."""
        from backend.services.classifier_service import ClassifierService
        
        service = ClassifierService()
        service._loaded = True
        service.id2label = {"0": "Network | DNS Problem", "1": "Software | Application Crash"}
        service.model = Mock()
        service.tokenizer = Mock()
        
        # Mock tokenizer output
        service.tokenizer.return_value = {
            "input_ids": torch.tensor([[1, 2, 3]]),
            "attention_mask": torch.tensor([[1, 1, 1]])
        }
        
        # Mock model output
        mock_output = Mock()
        mock_output.logits = torch.tensor([[0.1, 0.9]])
        service.model.return_value = mock_output
        service.model.eval = Mock()
        
        with patch('torch.no_grad'):
            result = service.predict("DNS server not responding")
        
        assert "category" in result
        assert "subcategory" in result
        assert "priority" in result
        assert "auto_resolve" in result
        assert "assigned_team" in result
        assert "confidence" in result
    
    @patch('backend.services.classifier_service.ClassifierService.load')
    def test_predict_category_distribution(self, mock_load):
        """Test that predictions fall within expected category distribution."""
        from backend.services.classifier_service import ClassifierService
        
        service = ClassifierService()
        service._loaded = True
        service.id2label = {
            "0": "Network | DNS Problem",
            "1": "Software | Application Crash",
            "2": "Access | Login Failure",
            "3": "Hardware | Blue Screen"
        }
        service.model = Mock()
        service.tokenizer = Mock()
        
        service.tokenizer.return_value = {
            "input_ids": torch.tensor([[1, 2, 3]]),
            "attention_mask": torch.tensor([[1, 1, 1]])
        }
        
        mock_output = Mock()
        mock_output.logits = torch.tensor([[0.7, 0.1, 0.1, 0.1]])
        service.model.return_value = mock_output
        service.model.eval = Mock()
        
        with patch('torch.no_grad'):
            result = service.predict("DNS lookup failed")
        
        # Verify category is one of the expected values
        valid_categories = ["Network", "Software", "Access", "Hardware", "Unknown"]
        assert result["category"] in valid_categories


class TestPriorityMapping:
    """Test priority mapping logic."""
    
    def test_critical_priority_keywords(self):
        """Test that critical keywords map to Critical priority."""
        from backend.services.classifier_service import PRIORITY_MAP
        
        critical_keywords = ["Blue Screen", "Overheating", "Data Loss", "Hardware Failure"]
        for keyword in critical_keywords:
            assert PRIORITY_MAP.get(keyword) == "Critical"
    
    def test_high_priority_keywords(self):
        """Test that high priority keywords map correctly."""
        from backend.services.classifier_service import PRIORITY_MAP
        
        high_keywords = ["Application Crash", "Login Failure", "Password Reset", "VPN Connection"]
        for keyword in high_keywords:
            assert PRIORITY_MAP.get(keyword) == "High"
    
    def test_medium_priority_keywords(self):
        """Test that medium priority keywords map correctly."""
        from backend.services.classifier_service import PRIORITY_MAP
        
        medium_keywords = ["Permission Issue", "Access Request", "Software Install", "Performance"]
        for keyword in medium_keywords:
            assert PRIORITY_MAP.get(keyword) == "Medium"
    
    def test_low_priority_keywords(self):
        """Test that low priority keywords map correctly."""
        from backend.services.classifier_service import PRIORITY_MAP
        
        low_keywords = ["Account Unlock", "Keyboard/Mouse", "Monitor Problem", "Printer Error"]
        for keyword in low_keywords:
            assert PRIORITY_MAP.get(keyword) == "Low"


class TestTeamMapping:
    """Test team assignment logic."""
    
    def test_team_mapping_categories(self):
        """Test that categories map to correct teams."""
        from backend.services.classifier_service import TEAM_MAP
        
        assert TEAM_MAP.get("Access") == "IAM Team"
        assert TEAM_MAP.get("Network") == "Network Support"
        assert TEAM_MAP.get("Software") == "Application Support"
        assert TEAM_MAP.get("Hardware") == "Hardware Support"


class TestAutoResolve:
    """Test auto-resolve logic."""
    
    def test_auto_resolve_subcategories(self):
        """Test that correct subcategories are marked for auto-resolve."""
        from backend.services.classifier_service import AUTO_RESOLVE_SUBS
        
        auto_resolve_items = {"Password Reset", "Account Unlock", "Software Install", "WiFi Issue", "Printer Error", "Monitor Problem"}
        assert AUTO_RESOLVE_SUBS == auto_resolve_items