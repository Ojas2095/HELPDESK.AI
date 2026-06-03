import sys
from unittest.mock import MagicMock

# Mock heavy/missing dependencies
sys.modules["torch"] = MagicMock()
sys.modules["torch.nn"] = MagicMock()
sys.modules["torch.nn.functional"] = MagicMock()
sys.modules["transformers"] = MagicMock()

import unittest
from services.classifier_service import ClassifierService

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
