"""
Classifier Service — Loads the trained DistilBert sequence classifier and predicts.
The model outputs combined "Category | SubCategory" labels.
Priority and other fields are derived from the category mapping.
"""

import os
import json
import re
import torch
import torch.nn.functional as F
from transformers import DistilBertTokenizerFast, DistilBertForSequenceClassification

SAVE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "models", "classifier")
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MAX_LEN = 128

# Priority mapping based on sub-category severity
PRIORITY_MAP = {
    "Blue Screen": "Critical", "Overheating": "Critical", "Data Loss": "Critical",
    "Hardware Failure": "Critical", "Application Crash": "High",
    "Login Failure": "High", "Password Reset": "High", "VPN Connection": "High",
    "Firewall Block": "High", "DNS Problem": "High", "MFA Problem": "High",
    "Account Expired": "High", "Permission Issue": "Medium", "Access Request": "Medium",
    "Software Install": "Medium", "Update Problem": "Medium", "Compatibility": "Medium",
    "Configuration": "Medium", "License Issue": "Medium", "Performance": "Medium",
    "Internet Slow": "Medium", "WiFi Issue": "Medium", "Remote Access": "Medium",
    "Proxy Error": "Medium", "Network Drive": "Medium", "Role Change": "Medium",
    "Account Unlock": "Low", "Keyboard/Mouse": "Low", "Monitor Problem": "Low",
    "Printer Error": "Low", "Battery Issue": "Low", "Laptop Issue": "Low",
}

# Team assignment based on category
TEAM_MAP = {
    "Access": "IAM Team",
    "Network": "Network Support",
    "Software": "Application Support",
    "Hardware": "Hardware Support",
}

# Auto-resolve: simple issues that can be auto-resolved
AUTO_RESOLVE_SUBS = {
    "Password Reset", "Account Unlock", "Software Install",
    "WiFi Issue", "Printer Error", "Monitor Problem",
}

# Fix Bug 1 & 4: Sensible default subcategory when category is overridden by keyword match.
# These are used to re-derive priority and auto_resolve after an override so the returned
# prediction object is always internally consistent.
_CATEGORY_DEFAULT_SUBCATEGORY = {
    "Network":  "Internet Slow",
    "Software": "Application Crash",
    "Access":   "Login Failure",
    "Hardware": "Hardware Failure",
}

# Fix Bug 2: Use word-boundary-safe keyword lists with NO cross-category duplicates.
# "Latency" was present in both Network and Software — removed from Network to avoid
# category poisoning via dict-iteration order.
_TECH_KEYWORDS = {
    "Network": [
        r"\bIP address\b", r"\bhostname\b", r"\bconnection\b", r"\bnetwork\b",
        r"\bbandwidth\b", r"\bDNS\b", r"\bfirewall\b", r"\bVPN\b",
        r"\bConnectivity\b", r"\bRouting\b", r"\bSpikes\b",
    ],
    "Software": [
        r"\bcrash\b", r"\bload\b", r"\bwebsite\b", r"\bapplication\b",
        r"\berror\b", r"\bbug\b", r"\bfailing\b", r"\bsoftware\b",
        r"\bSQL\b", r"\bCluster\b", r"\bDatabase\b", r"\bProduction\b",
        r"\bLatency\b",
    ],
    "Access": [
        r"\blogin\b", r"\bpassword\b", r"\baccess\b", r"\bauthentication\b",
        r"\baccount\b", r"\bpermission\b", r"\bMFA\b", r"\bOAuth\b",
    ],
}


class ClassifierService:
    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.id2label = None
        self.label2id = None
        self._loaded = False

    def load(self):
        """Load model, tokenizer, and label mappings from disk."""
        if self._loaded:
            return

        abs_dir = os.path.abspath(SAVE_DIR)

        if not os.path.exists(os.path.join(abs_dir, "model.safetensors")):
            raise FileNotFoundError(
                f"Classifier model not found at {abs_dir}. "
                "Please ensure model files are present."
            )

        # Load label mappings
        with open(os.path.join(abs_dir, "id2label.json"), "r") as f:
            self.id2label = json.load(f)
        with open(os.path.join(abs_dir, "label2id.json"), "r") as f:
            self.label2id = json.load(f)

        # Load tokenizer
        self.tokenizer = DistilBertTokenizerFast.from_pretrained(abs_dir)

        # Load model
        self.model = DistilBertForSequenceClassification.from_pretrained(abs_dir)
        self.model.to(DEVICE)
        self.model.eval()

        self._loaded = True
        print("Classifier loaded successfully")

    def predict(self, text: str) -> dict:
        """
        Predict category, subcategory, priority, auto_resolve, assigned_team, confidence,
        and keyword_matched.

        Fixes applied:
          Bug 1 (CWE-704/697): subcategory, priority, and auto_resolve are now re-derived
            after the keyword override so the returned object is always internally consistent.
          Bug 2 (CWE-20): keyword matching uses compiled word-boundary regex patterns instead
            of bare substring search; "Latency" deduplicated from Network list.
          Bug 3 (CWE-345): real softmax confidence is never inflated; a separate
            keyword_matched flag is returned so callers can apply their own confidence logic.
          Bug 4 (CWE-841): auto_resolve is re-derived from the (possibly overridden)
            subcategory, preventing non-trivial issues from being auto-resolved.
        """
        self.load()

        encoding = self.tokenizer(
            text,
            truncation=True,
            padding="max_length",
            max_length=MAX_LEN,
            return_tensors="pt",
        )
        input_ids = encoding["input_ids"].to(DEVICE)
        attention_mask = encoding["attention_mask"].to(DEVICE)

        with torch.no_grad():
            outputs = self.model(input_ids=input_ids, attention_mask=attention_mask)
            logits = outputs.logits
            probs = F.softmax(logits, dim=1)
            confidence, pred_idx = torch.max(probs, dim=1)

        pred_idx   = pred_idx.item()
        confidence = round(confidence.item(), 4)   # Fix Bug 3: keep real softmax score

        # Decode the combined label "Category | SubCategory"
        combined_label = self.id2label.get(str(pred_idx), "Unknown | Unknown")
        parts      = combined_label.split(" | ", 1)
        category   = parts[0].strip() if len(parts) > 0 else "Unknown"
        subcategory = parts[1].strip() if len(parts) > 1 else "Unknown"

        # Derive priority, team, auto_resolve from model prediction
        priority      = PRIORITY_MAP.get(subcategory, "Medium")
        assigned_team = TEAM_MAP.get(category, "General Support")
        auto_resolve  = subcategory in AUTO_RESOLVE_SUBS

        # ── Keyword Override Layer (Bug 2 fix: word-boundary regex) ───────────────
        keyword_matched = False
        for cat, patterns in _TECH_KEYWORDS.items():
            if any(re.search(pattern, text, re.IGNORECASE) for pattern in patterns):
                if category == "General" or confidence < 0.9:
                    category      = cat
                    assigned_team = TEAM_MAP.get(cat, "General Support")

                    # Fix Bug 1 & 4: re-derive subcategory/priority/auto_resolve
                    subcategory  = _CATEGORY_DEFAULT_SUBCATEGORY.get(cat, subcategory)
                    priority     = PRIORITY_MAP.get(subcategory, "Medium")
                    auto_resolve = subcategory in AUTO_RESOLVE_SUBS

                    # Fix Bug 3: do NOT inflate confidence; use separate flag instead
                    keyword_matched = True
                    break

        return {
            "category":       category,
            "subcategory":    subcategory,
            "priority":       priority,
            "auto_resolve":   auto_resolve,
            "assigned_team":  assigned_team,
            "confidence":     confidence,
            "keyword_matched": keyword_matched,   # new field — callers may use for display
        }
