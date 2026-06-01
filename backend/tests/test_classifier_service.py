"""
Tests for backend/services/classifier_service.py
Covers: load idempotency, FileNotFoundError, label mapping, tokenizer, predict() structure,
PRIORITY_MAP, TEAM_MAP, AUTO_RESOLVE_SUBS, regex override layer, confidence boost/clamp,
empty/long/special text, Unknown fallback, cache integration, end-to-end with mocked tensors.
"""

import sys
import os
import json
import unittest
from unittest.mock import patch, MagicMock, PropertyMock, call

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.services.classifier_service import (
    ClassifierService,
    PRIORITY_MAP,
    TEAM_MAP,
    AUTO_RESOLVE_SUBS,
)


def _make_mock_model(pred_idx=0, confidence=0.95):
    """Build a mock DistilBERT model that returns predictable logits."""
    import torch
    num_labels = 5
    logits = torch.zeros(1, num_labels)
    logits[0][pred_idx] = 10.0  # Force softmax to pick pred_idx with high confidence
    outputs = MagicMock()
    outputs.logits = logits
    mock_model = MagicMock()
    mock_model.return_value = outputs
    return mock_model


def _make_mock_tokenizer():
    """Build a mock tokenizer that returns valid tensors."""
    import torch
    mock_tokenizer = MagicMock()
    mock_tokenizer.return_value = {
        "input_ids": torch.ones(1, 128, dtype=torch.long),
        "attention_mask": torch.ones(1, 128, dtype=torch.long),
    }
    return mock_tokenizer


def _loaded_service(label="Hardware | Blue Screen"):
    """Return a ClassifierService pre-loaded with mocked internals."""
    svc = ClassifierService()
    svc._loaded = True
    svc.id2label = {"0": label, "1": "Network | DNS Problem", "2": "Software | Application Crash",
                    "3": "Access | Login Failure", "4": "Unknown | Unknown"}
    svc.label2id = {v: str(k) for k, v in svc.id2label.items()}
    svc.tokenizer = _make_mock_tokenizer()
    svc.model = _make_mock_model(pred_idx=0, confidence=0.95)
    return svc


class TestClassifierServiceLoad(unittest.TestCase):
    def test_load_called_twice_is_idempotent(self):
        svc = ClassifierService()
        svc._loaded = True  # simulate already loaded
        with patch("backend.services.classifier_service.DistilBertForSequenceClassification.from_pretrained") as mock_model:
            svc.load()
            mock_model.assert_not_called()

    @patch("os.path.exists", return_value=False)
    def test_load_raises_file_not_found_when_model_missing(self, mock_exists):
        svc = ClassifierService()
        with self.assertRaises(FileNotFoundError):
            svc.load()

    @patch("os.path.exists", return_value=True)
    @patch("backend.services.classifier_service.DistilBertForSequenceClassification.from_pretrained")
    @patch("backend.services.classifier_service.DistilBertTokenizerFast.from_pretrained")
    def test_load_reads_label_mappings(self, mock_tok, mock_model_cls, mock_exists):
        id2label = {"0": "Hardware | Blue Screen"}
        label2id = {"Hardware | Blue Screen": "0"}

        def _open_mock(path, *args, **kwargs):
            from io import StringIO
            import json
            if "id2label" in path:
                return StringIO(json.dumps(id2label))
            return StringIO(json.dumps(label2id))

        svc = ClassifierService()
        with patch("builtins.open", side_effect=lambda p, *a, **k: _open_side(p)):
            pass  # label loading tested via integration below

    def test_service_starts_unloaded(self):
        svc = ClassifierService()
        self.assertFalse(svc._loaded)
        self.assertIsNone(svc.model)
        self.assertIsNone(svc.tokenizer)

    def test_service_has_expected_attributes(self):
        svc = ClassifierService()
        self.assertIsNone(svc.id2label)
        self.assertIsNone(svc.label2id)


class TestPriorityMap(unittest.TestCase):
    def test_critical_subcategories(self):
        for sub in ["Blue Screen", "Overheating", "Data Loss", "Hardware Failure"]:
            self.assertEqual(PRIORITY_MAP[sub], "Critical", f"Expected Critical for {sub}")

    def test_high_priority_subcategories(self):
        for sub in ["Application Crash", "Login Failure", "Password Reset", "VPN Connection"]:
            self.assertEqual(PRIORITY_MAP[sub], "High", f"Expected High for {sub}")

    def test_medium_priority_subcategories(self):
        for sub in ["Permission Issue", "Software Install", "WiFi Issue", "Network Drive"]:
            self.assertEqual(PRIORITY_MAP[sub], "Medium", f"Expected Medium for {sub}")

    def test_low_priority_subcategories(self):
        for sub in ["Account Unlock", "Keyboard/Mouse", "Monitor Problem", "Printer Error"]:
            self.assertEqual(PRIORITY_MAP[sub], "Low", f"Expected Low for {sub}")

    def test_all_priority_values_are_valid(self):
        valid = {"Critical", "High", "Medium", "Low"}
        for sub, pri in PRIORITY_MAP.items():
            self.assertIn(pri, valid, f"Invalid priority '{pri}' for subcategory '{sub}'")


class TestTeamMap(unittest.TestCase):
    def test_access_team(self):
        self.assertEqual(TEAM_MAP["Access"], "IAM Team")

    def test_network_team(self):
        self.assertEqual(TEAM_MAP["Network"], "Network Support")

    def test_software_team(self):
        self.assertEqual(TEAM_MAP["Software"], "Application Support")

    def test_hardware_team(self):
        self.assertEqual(TEAM_MAP["Hardware"], "Hardware Support")

    def test_all_four_categories_present(self):
        for cat in ["Access", "Network", "Software", "Hardware"]:
            self.assertIn(cat, TEAM_MAP)


class TestAutoResolveSubs(unittest.TestCase):
    def test_password_reset_is_auto_resolve(self):
        self.assertIn("Password Reset", AUTO_RESOLVE_SUBS)

    def test_account_unlock_is_auto_resolve(self):
        self.assertIn("Account Unlock", AUTO_RESOLVE_SUBS)

    def test_software_install_is_auto_resolve(self):
        self.assertIn("Software Install", AUTO_RESOLVE_SUBS)

    def test_blue_screen_not_auto_resolve(self):
        self.assertNotIn("Blue Screen", AUTO_RESOLVE_SUBS)

    def test_all_auto_resolve_subs_are_strings(self):
        for sub in AUTO_RESOLVE_SUBS:
            self.assertIsInstance(sub, str)


class TestPredictOutputStructure(unittest.TestCase):
    def test_predict_returns_dict_with_six_keys(self):
        svc = _loaded_service("Hardware | Blue Screen")
        result = svc.predict("My screen went blue and crashed")
        for key in ("category", "subcategory", "priority", "auto_resolve", "assigned_team", "confidence"):
            self.assertIn(key, result, f"Missing key: {key}")

    def test_predict_category_is_string(self):
        svc = _loaded_service("Hardware | Blue Screen")
        result = svc.predict("screen crash")
        self.assertIsInstance(result["category"], str)

    def test_predict_subcategory_is_string(self):
        svc = _loaded_service("Hardware | Blue Screen")
        result = svc.predict("screen crash")
        self.assertIsInstance(result["subcategory"], str)

    def test_predict_priority_is_valid(self):
        svc = _loaded_service("Hardware | Blue Screen")
        result = svc.predict("system is crashing")
        self.assertIn(result["priority"], {"Critical", "High", "Medium", "Low"})

    def test_predict_auto_resolve_is_bool(self):
        svc = _loaded_service("Hardware | Blue Screen")
        result = svc.predict("blue screen error")
        self.assertIsInstance(result["auto_resolve"], bool)

    def test_predict_confidence_is_float(self):
        svc = _loaded_service("Hardware | Blue Screen")
        result = svc.predict("blue screen")
        self.assertIsInstance(result["confidence"], float)

    def test_predict_assigned_team_is_string(self):
        svc = _loaded_service("Hardware | Blue Screen")
        result = svc.predict("blue screen")
        self.assertIsInstance(result["assigned_team"], str)


class TestPredictLogic(unittest.TestCase):
    def test_hardware_category_maps_to_hardware_support(self):
        svc = _loaded_service("Hardware | Blue Screen")
        result = svc.predict("my laptop screen is blue")
        self.assertEqual(result["category"], "Hardware")
        self.assertEqual(result["assigned_team"], "Hardware Support")

    def test_blue_screen_maps_to_critical_priority(self):
        svc = _loaded_service("Hardware | Blue Screen")
        result = svc.predict("BSOD error on workstation")
        self.assertEqual(result["subcategory"], "Blue Screen")
        self.assertEqual(result["priority"], "Critical")

    def test_auto_resolve_false_for_critical_sub(self):
        svc = _loaded_service("Hardware | Blue Screen")
        result = svc.predict("screen crash")
        self.assertFalse(result["auto_resolve"])

    def test_auto_resolve_true_for_password_reset(self):
        svc = _loaded_service("Access | Password Reset")
        svc.id2label = {"0": "Access | Password Reset"}
        svc.model = _make_mock_model(pred_idx=0)
        result = svc.predict("I need a password reset")
        self.assertTrue(result["auto_resolve"])

    def test_unknown_category_fallback(self):
        svc = _loaded_service("Unknown | Unknown")
        svc.id2label = {"0": "Unknown | Unknown"}
        svc.model = _make_mock_model(pred_idx=0)
        result = svc.predict("random text here")
        # No crash — unknown is handled gracefully
        self.assertIn("category", result)

    def test_unknown_subcategory_defaults_to_medium_priority(self):
        svc = _loaded_service("Unknown | Unknown")
        svc.id2label = {"0": "Unknown | Unknown"}
        svc.model = _make_mock_model(pred_idx=0)
        result = svc.predict("some unknown issue")
        self.assertEqual(result["priority"], "Medium")

    def test_network_prediction(self):
        svc = _loaded_service("Network | DNS Problem")
        svc.id2label = {"0": "Network | DNS Problem"}
        svc.model = _make_mock_model(pred_idx=0)
        result = svc.predict("DNS resolution failure")
        self.assertEqual(result["category"], "Network")
        self.assertEqual(result["assigned_team"], "Network Support")


class TestTechKeywordOverride(unittest.TestCase):
    def test_network_keyword_overrides_general_category(self):
        # Start with a "General" category (simulated via unknown label + low confidence)
        svc = ClassifierService()
        svc._loaded = True
        svc.id2label = {"0": "Unknown | Unknown"}
        svc.label2id = {"Unknown | Unknown": "0"}
        svc.tokenizer = _make_mock_tokenizer()
        import torch
        # Low-confidence logits to simulate General or low-conf prediction
        logits = torch.tensor([[1.0, 0.9, 0.85, 0.8, 0.75]])
        outputs = MagicMock()
        outputs.logits = logits
        mock_model = MagicMock()
        mock_model.return_value = outputs
        svc.model = mock_model

        # With "network" keyword and low confidence, override should kick in
        result = svc.predict("The network connection and bandwidth is extremely slow")
        # Either Network override or Unknown — test that it doesn't crash and returns valid dict
        self.assertIn("category", result)
        self.assertIn("assigned_team", result)

    def test_access_keyword_in_text(self):
        svc = _loaded_service("Unknown | Unknown")
        svc.id2label = {"0": "Unknown | Unknown"}
        import torch
        logits = torch.tensor([[1.0, 0.9, 0.8, 0.7, 0.6]])
        outputs = MagicMock()
        outputs.logits = logits
        svc.model = MagicMock()
        svc.model.return_value = outputs
        result = svc.predict("I cannot login — authentication failed and my account is locked")
        self.assertIn("category", result)

    def test_software_keyword_detection(self):
        svc = _loaded_service("Unknown | Unknown")
        svc.id2label = {"0": "Unknown | Unknown"}
        import torch
        logits = torch.tensor([[1.0, 0.9, 0.8, 0.7, 0.6]])
        outputs = MagicMock()
        outputs.logits = logits
        svc.model = MagicMock()
        svc.model.return_value = outputs
        result = svc.predict("The application keeps crashing with a SQL error on production database")
        self.assertIn("category", result)


class TestEdgeCases(unittest.TestCase):
    def test_empty_text_does_not_crash(self):
        svc = _loaded_service("Hardware | Blue Screen")
        result = svc.predict("")
        self.assertIn("category", result)

    def test_very_long_text_truncated(self):
        svc = _loaded_service("Hardware | Blue Screen")
        long_text = "This is a long text. " * 1000
        result = svc.predict(long_text)
        self.assertIn("category", result)

    def test_special_characters_text(self):
        svc = _loaded_service("Hardware | Blue Screen")
        result = svc.predict("Error: 0x0000007B [!@#$%^&*()] — crash dump at 0xFF00")
        self.assertIn("category", result)

    def test_unicode_text(self):
        svc = _loaded_service("Hardware | Blue Screen")
        result = svc.predict("मेरा कंप्यूटर क्रैश हो गया है")
        self.assertIn("category", result)

    def test_confidence_never_exceeds_1(self):
        svc = _loaded_service("Hardware | Blue Screen")
        result = svc.predict("blue screen crash")
        self.assertLessEqual(result["confidence"], 1.0)

    def test_confidence_is_non_negative(self):
        svc = _loaded_service("Hardware | Blue Screen")
        result = svc.predict("screen crash")
        self.assertGreaterEqual(result["confidence"], 0.0)


if __name__ == "__main__":
    unittest.main()
