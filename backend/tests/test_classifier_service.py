import sys
import unittest
from unittest.mock import MagicMock, patch

# Mock heavy/missing dependencies during import using patch.dict to prevent leakage
mock_modules = {
    "torch": MagicMock(),
    "torch.nn": MagicMock(),
    "torch.nn.functional": MagicMock(),
    "transformers": MagicMock(),
}

with patch.dict(sys.modules, mock_modules):
    # Import matching the package-qualified namespace
    from backend.services.classifier_service import ClassifierService

class TestClassifierService(unittest.TestCase):
    def setUp(self):
        self.service = ClassifierService()

    def test_predict_empty_text_raises_value_error(self):
        # Test None
        with self.assertRaises(ValueError) as context:
            self.service.predict(None)
        self.assertIn("cannot be empty", str(context.exception))

        # Test empty string
        with self.assertRaises(ValueError) as context:
            self.service.predict("")
        self.assertIn("cannot be empty", str(context.exception))

        # Test whitespace string
        with self.assertRaises(ValueError) as context:
            self.service.predict("   ")
        self.assertIn("cannot be empty", str(context.exception))

if __name__ == "__main__":
    unittest.main()
