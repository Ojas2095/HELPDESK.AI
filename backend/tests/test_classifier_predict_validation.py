import importlib.util
import os
import sys
import types
from unittest.mock import MagicMock

import pytest


for mod_name in ["torch", "torch.nn.functional", "transformers"]:
    sys.modules.setdefault(mod_name, types.ModuleType(mod_name))

sys.modules["transformers"].DistilBertTokenizerFast = MagicMock()
sys.modules["transformers"].DistilBertForSequenceClassification = MagicMock()
sys.modules.setdefault("backend.services.cache_service", MagicMock())
sys.modules.setdefault("backend.services.metrics_service", MagicMock())

sys.modules.pop("backend.services.classifier_service", None)
_spec = importlib.util.spec_from_file_location(
    "classifier_service_real_empty_validation",
    os.path.join(os.path.dirname(__file__), "..", "services", "classifier_service.py"),
)
_classifier_module = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_classifier_module)

ClassifierService = _classifier_module.ClassifierService


@pytest.mark.parametrize("text", [None, "", "   "])
def test_predict_rejects_empty_text_before_loading_model(text):
    service = ClassifierService()

    with pytest.raises(ValueError, match="must not be empty"):
        service.predict(text)
