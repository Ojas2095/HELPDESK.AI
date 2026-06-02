"""
Unit tests for backend.services.classifier_service (Issue #916).

Covers:
- initialization defaults
- load method (handling of missing model files vs success, checking Git LFS placeholders)
- predict method:
  - calls load if not loaded
  - decodes predicted index to category and subcategory
  - priority mapping based on subcategory severity
  - team assignment mapping based on category
  - auto-resolve checks
  - regex override layer for technical keywords (Access, Network, Software)
"""

import os
import sys
import json
import unittest
from unittest.mock import MagicMock, patch, mock_open

# Mock the deep learning dependencies prior to any import to avoid imports failing or downloading models
if "torch" not in sys.modules: sys.modules["torch"] = MagicMock()
if "torch.nn" not in sys.modules: sys.modules["torch.nn"] = MagicMock()
if "torch.nn.functional" not in sys.modules: sys.modules["torch.nn.functional"] = MagicMock()
if "transformers" not in sys.modules: sys.modules["transformers"] = MagicMock()
sys.modules.pop("backend.services.classifier_service", None)

import transformers
mock_tokenizer_cls = transformers.DistilBertTokenizerFast
mock_model_cls = transformers.DistilBertForSequenceClassification

import torch
import torch.nn.functional as F

# Configure basic behavior for mocked libraries
torch.device.return_value = "cpu"
torch.cuda.is_available.return_value = False

def mock_softmax(input, dim=None):
    return input
F.softmax = mock_softmax

# Ensure project root is in sys.path
_project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

import backend.services.classifier_service as cs
cs._HAS_TORCH = True
cs.DistilBertTokenizerFast = mock_tokenizer_cls
cs.DistilBertForSequenceClassification = mock_model_cls
cs.torch = torch
cs.F = F
cs.DEVICE = "cpu"

from backend.services.classifier_service import ClassifierService, PRIORITY_MAP, TEAM_MAP, AUTO_RESOLVE_SUBS

def _mock_tokenizer_return():
    mock_input_ids = MagicMock()
    mock_input_ids.to.return_value = mock_input_ids
    mock_attention_mask = MagicMock()
    mock_attention_mask.to.return_value = mock_attention_mask
    mock_attention_mask.sum.return_value.item.return_value = 5
    return {
        "input_ids": mock_input_ids,
        "attention_mask": mock_attention_mask
    }


class TestClassifierServiceInit(unittest.TestCase):
    def test_init_defaults(self):
        svc = ClassifierService()
        self.assertIsNone(svc.model)
        self.assertIsNone(svc.tokenizer)
        self.assertIsNone(svc.id2label)
        self.assertIsNone(svc.label2id)
        self.assertFalse(svc._loaded)


class TestClassifierServiceLoad(unittest.TestCase):
    @patch("backend.services.classifier_service.os.path.exists")
    def test_load_missing_model_file_raises_error(self, mock_exists):
        mock_exists.return_value = False
        svc = ClassifierService()
        with self.assertRaises(FileNotFoundError):
            svc.load()

    @patch("backend.services.classifier_service.os.path.exists")
    @patch("builtins.open")
    def test_load_git_lfs_placeholder_raises_error(self, mock_file_open, mock_exists):
        mock_exists.return_value = True
        
        # Mock file opens: first is model.safetensors, returning Git LFS header bytes
        mock_file_open.side_effect = [
            mock_open(read_data=b"version https://git-lfs.github.com/spec/v1\noid sha256:1234").return_value,
        ]
        
        svc = ClassifierService()
        with self.assertRaises(FileNotFoundError) as ctx:
            svc.load()
        self.assertIn("Git LFS placeholder", str(ctx.exception))

    @patch("backend.services.classifier_service.os.path.exists")
    @patch("builtins.open")
    def test_load_success(self, mock_file_open, mock_exists):
        mock_exists.return_value = True
        
        # Mock open side effects:
        # 1. model.safetensors (read in binary mode)
        # 2. id2label.json (read in text mode)
        # 3. label2id.json (read in text mode)
        safetensors_mock = mock_open(read_data=b"dummy weights bytes").return_value
        id2label_data = '{"0": "Access | Password Reset", "1": "Network | WiFi Issue"}'
        label2id_data = '{"Access | Password Reset": 0, "Network | WiFi Issue": 1}'
        
        mock_file_open.side_effect = [
            safetensors_mock,
            mock_open(read_data=id2label_data).return_value,
            mock_open(read_data=label2id_data).return_value,
        ]
        
        mock_tokenizer = MagicMock()
        mock_model = MagicMock()
        mock_tokenizer_cls.from_pretrained.return_value = mock_tokenizer
        mock_model_cls.from_pretrained.return_value = mock_model

        svc = ClassifierService()
        svc.load()

        self.assertTrue(svc._loaded)
        self.assertEqual(svc.id2label, {"0": "Access | Password Reset", "1": "Network | WiFi Issue"})
        self.assertEqual(svc.label2id, {"Access | Password Reset": 0, "Network | WiFi Issue": 1})
        self.assertEqual(svc.tokenizer, mock_tokenizer)
        self.assertEqual(svc.model, mock_model)


class TestClassifierServicePredict(unittest.TestCase):
    def setUp(self):
        mock_tokenizer_cls.from_pretrained.reset_mock()
        mock_model_cls.from_pretrained.reset_mock()

    @patch("backend.services.classifier_service.os.path.exists")
    @patch("builtins.open")
    def test_predict_success_and_auto_resolve(self, mock_file_open, mock_exists):
        mock_exists.return_value = True
        
        safetensors_mock = mock_open(read_data=b"dummy weights bytes").return_value
        id2label_data = '{"1": "Access | Password Reset"}'
        label2id_data = '{"Access | Password Reset": 1}'
        
        mock_file_open.side_effect = [
            safetensors_mock,
            mock_open(read_data=id2label_data).return_value,
            mock_open(read_data=label2id_data).return_value,
        ]

        # Setup tokenizer output
        mock_tokenizer = MagicMock()
        mock_tokenizer.return_value = _mock_tokenizer_return()
        mock_tokenizer_cls.from_pretrained.return_value = mock_tokenizer

        # Setup model output logits
        mock_outputs = MagicMock(logits="mock_logits")
        mock_model = MagicMock()
        mock_model.return_value = mock_outputs
        mock_model_cls.from_pretrained.return_value = mock_model

        # Patch torch.max to return specific confidence and index
        mock_conf = MagicMock(item=lambda: 0.95)
        mock_idx = MagicMock(item=lambda: 1)
        
        svc = ClassifierService()
        
        with patch("torch.max", return_value=(mock_conf, mock_idx)):
            res = svc.predict("I cannot login to my account")
            
            self.assertEqual(res["category"], "Access")
            self.assertEqual(res["subcategory"], "Password Reset")
            self.assertEqual(res["priority"], "High")
            self.assertEqual(res["assigned_team"], "IAM Team")
            self.assertTrue(res["auto_resolve"])
            self.assertEqual(res["confidence"], 0.95)

    @patch("backend.services.classifier_service.os.path.exists")
    @patch("builtins.open")
    def test_predict_general_classification_unknown_fallback(self, mock_file_open, mock_exists):
        mock_exists.return_value = True
        
        safetensors_mock = mock_open(read_data=b"dummy weights bytes").return_value
        id2label_data = '{"3": "General | Unknown Issue"}'
        label2id_data = '{"General | Unknown Issue": 3}'
        
        mock_file_open.side_effect = [
            safetensors_mock,
            mock_open(read_data=id2label_data).return_value,
            mock_open(read_data=label2id_data).return_value,
        ]

        # Setup mock tokenizer and model
        mock_tokenizer = MagicMock()
        mock_tokenizer.return_value = _mock_tokenizer_return()
        mock_tokenizer_cls.from_pretrained.return_value = mock_tokenizer
        mock_outputs = MagicMock(logits="mock_logits")
        mock_model = MagicMock()
        mock_model.return_value = mock_outputs
        mock_model_cls.from_pretrained.return_value = mock_model

        mock_conf = MagicMock(item=lambda: 0.75)
        mock_idx = MagicMock(item=lambda: 3)

        svc = ClassifierService()

        with patch("torch.max", return_value=(mock_conf, mock_idx)):
            res = svc.predict("something generic here")
            self.assertEqual(res["category"], "General")
            self.assertEqual(res["assigned_team"], "General Support")
            self.assertFalse(res["auto_resolve"])
            self.assertEqual(res["confidence"], 0.75)

    @patch("backend.services.classifier_service.os.path.exists")
    @patch("builtins.open")
    def test_predict_regex_override_network(self, mock_file_open, mock_exists):
        mock_exists.return_value = True
        
        safetensors_mock = mock_open(read_data=b"dummy weights").return_value
        id2label_data = '{"2": "General | WiFi Issue"}'
        label2id_data = '{"General | WiFi Issue": 2}'
        
        mock_file_open.side_effect = [
            safetensors_mock,
            mock_open(read_data=id2label_data).return_value,
            mock_open(read_data=label2id_data).return_value,
        ]

        mock_tokenizer = MagicMock()
        mock_tokenizer.return_value = _mock_tokenizer_return()
        mock_tokenizer_cls.from_pretrained.return_value = mock_tokenizer
        mock_model = MagicMock()
        mock_model.return_value = MagicMock(logits="mock_logits")
        mock_model_cls.from_pretrained.return_value = mock_model

        mock_conf = MagicMock(item=lambda: 0.50)
        mock_idx = MagicMock(item=lambda: 2)

        svc = ClassifierService()

        with patch("torch.max", return_value=(mock_conf, mock_idx)):
            res = svc.predict("My IP address connection is not working")
            self.assertEqual(res["category"], "Network")
            self.assertEqual(res["assigned_team"], "Network Support")
            self.assertEqual(res["confidence"], 0.92)

    @patch("backend.services.classifier_service.os.path.exists")
    @patch("builtins.open")
    def test_predict_regex_override_software(self, mock_file_open, mock_exists):
        mock_exists.return_value = True
        
        safetensors_mock = mock_open(read_data=b"dummy weights").return_value
        id2label_data = '{"2": "General | Bug Report"}'
        label2id_data = '{"General | Bug Report": 2}'
        
        mock_file_open.side_effect = [
            safetensors_mock,
            mock_open(read_data=id2label_data).return_value,
            mock_open(read_data=label2id_data).return_value,
        ]

        mock_tokenizer = MagicMock()
        mock_tokenizer.return_value = _mock_tokenizer_return()
        mock_tokenizer_cls.from_pretrained.return_value = mock_tokenizer
        mock_model = MagicMock()
        mock_model.return_value = MagicMock(logits="mock_logits")
        mock_model_cls.from_pretrained.return_value = mock_model

        mock_conf = MagicMock(item=lambda: 0.60)
        mock_idx = MagicMock(item=lambda: 2)

        svc = ClassifierService()

        with patch("torch.max", return_value=(mock_conf, mock_idx)):
            res = svc.predict("The application crashed on loading")
            self.assertEqual(res["category"], "Software")
            self.assertEqual(res["assigned_team"], "Application Support")
            self.assertEqual(res["confidence"], 0.92)


if __name__ == "__main__":
    unittest.main()
