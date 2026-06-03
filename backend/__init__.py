# Backend AI System for AI Helpdesk

import sys as _sys
import os as _os

# Ensure the project root is always on sys.path so `from backend.xxx import ...`
# works when this package is imported from any working directory (e.g. CI, pytest).
_project_root = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), ".."))
if _project_root not in _sys.path:
    _sys.path.insert(0, _project_root)
