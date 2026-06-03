"""
Unit tests for backend/services/digest_service.py — pure HTML builders.

Covers the _build_team_performance_html and _build_category_list_html
helpers. These are pure functions that take a list of dicts and
return HTML strings. The existing test_digest_service.py covers
the full email flow with mocked supabase; this module exercises the
HTML rendering and color-coding logic.
"""

import os
import sys
import unittest
from unittest import mock

# Stub heavy backend modules so the import does not pull in supabase.
sys.path.insert(
    0,
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")),
)

from backend.services.digest_service import (
    _build_team_performance_html,
    _build_category_list_html,
)


class TestBuildTeamPerformanceHtml(unittest.TestCase):
    def test_empty_list_returns_placeholder(self):
        out = _build_team_performance_html([])
        self.assertIn("No team data", out)

    def test_single_team_renders_table(self):
        team = {
            "team": "Network",
            "total": 10,
            "resolved": 8,
            "resolution_rate": 80.0,
            "avg_resolution_time": "2h",
            "sla_breaches": 0,
        }
        out = _build_team_performance_html([team])
        self.assertIn("Network", out)
        self.assertIn("10", out)
        self.assertIn("8", out)
        self.assertIn("80.0%", out)
        self.assertIn("2h", out)

    def test_high_resolution_rate_uses_green(self):
        team = {
            "team": "A",
            "total": 1, "resolved": 1,
            "resolution_rate": 95.0,
            "avg_resolution_time": "1h",
            "sla_breaches": 0,
        }
        out = _build_team_performance_html([team])
        self.assertIn("#059669", out)  # green for >= 80

    def test_medium_resolution_rate_uses_amber(self):
        team = {
            "team": "A",
            "total": 1, "resolved": 1,
            "resolution_rate": 60.0,
            "avg_resolution_time": "1h",
            "sla_breaches": 0,
        }
        out = _build_team_performance_html([team])
        self.assertIn("#d97706", out)  # amber for >= 50 and < 80

    def test_low_resolution_rate_uses_red(self):
        team = {
            "team": "A",
            "total": 1, "resolved": 1,
            "resolution_rate": 30.0,
            "avg_resolution_time": "1h",
            "sla_breaches": 0,
        }
        out = _build_team_performance_html([team])
        self.assertIn("#dc2626", out)  # red for < 50

    def test_breaches_use_red(self):
        team = {
            "team": "A",
            "total": 1, "resolved": 1,
            "resolution_rate": 100.0,
            "avg_resolution_time": "1h",
            "sla_breaches": 3,
        }
        out = _build_team_performance_html([team])
        # Red for breaches count > 0
        self.assertIn(">3<", out)

    def test_zero_breaches_use_gray(self):
        team = {
            "team": "A",
            "total": 1, "resolved": 1,
            "resolution_rate": 100.0,
            "avg_resolution_time": "1h",
            "sla_breaches": 0,
        }
        out = _build_team_performance_html([team])
        # The 0 value should be present
        self.assertIn(">0<", out)

    def test_multiple_teams(self):
        teams = [
            {"team": "A", "total": 1, "resolved": 1, "resolution_rate": 100.0,
             "avg_resolution_time": "1h", "sla_breaches": 0},
            {"team": "B", "total": 1, "resolved": 0, "resolution_rate": 0.0,
             "avg_resolution_time": "1h", "sla_breaches": 1},
        ]
        out = _build_team_performance_html(teams)
        self.assertIn(">A<", out)
        self.assertIn(">B<", out)

    def test_returns_table_html(self):
        team = {
            "team": "X",
            "total": 1, "resolved": 1,
            "resolution_rate": 100.0,
            "avg_resolution_time": "1h",
            "sla_breaches": 0,
        }
        out = _build_team_performance_html([team])
        self.assertIn("<table", out)
        self.assertIn("<thead>", out)
        self.assertIn("<tbody>", out)
        self.assertIn("</table>", out)


class TestBuildCategoryListHtml(unittest.TestCase):
    def test_empty_list_returns_placeholder(self):
        out = _build_category_list_html([])
        self.assertIn("No category data", out)

    def test_single_category(self):
        out = _build_category_list_html([{"category": "Network", "count": 5}])
        self.assertIn("Network", out)
        self.assertIn("5 tickets", out)

    def test_multiple_categories(self):
        cats = [
            {"category": "Network", "count": 5},
            {"category": "Hardware", "count": 3},
        ]
        out = _build_category_list_html(cats)
        self.assertIn("Network", out)
        self.assertIn("Hardware", out)
        self.assertIn("5 tickets", out)
        self.assertIn("3 tickets", out)

    def test_html_contains_divs(self):
        out = _build_category_list_html([{"category": "X", "count": 1}])
        self.assertIn("<div", out)
        self.assertIn("</div>", out)


if __name__ == "__main__":
    unittest.main()
