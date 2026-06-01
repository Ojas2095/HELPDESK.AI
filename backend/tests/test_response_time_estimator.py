import pytest
from datetime import datetime, timedelta
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from backend.services.response_time_estimator import (
    estimate_response_time,
    get_sla_targets,
    generate_estimation_summary,
    SLA_TARGETS,
    PRIORITY_WEIGHTS
)


class TestSLATargets:
    def test_get_sla_targets_critical(self):
        targets = get_sla_targets("critical")
        assert targets["first_response"] == 1
        assert targets["resolution"] == 4

    def test_get_sla_targets_high(self):
        targets = get_sla_targets("high")
        assert targets["first_response"] == 4
        assert targets["resolution"] == 8

    def test_get_sla_targets_medium(self):
        targets = get_sla_targets("medium")
        assert targets["first_response"] == 8
        assert targets["resolution"] == 24

    def test_get_sla_targets_low(self):
        targets = get_sla_targets("low")
        assert targets["first_response"] == 24
        assert targets["resolution"] == 72

    def test_get_sla_targets_unknown_returns_default(self):
        targets = get_sla_targets("unknown")
        assert targets == SLA_TARGETS["default"]


class TestEstimateResponseTime:
    def test_estimate_response_time_basic(self):
        result = estimate_response_time(priority="medium")
        assert "estimated_first_response_hours" in result
        assert "estimated_resolution_hours" in result
        assert "sla_targets" in result
        assert "breach_risk" in result
        assert "predictions" in result
        assert "factors" in result

    def test_estimate_response_time_returns_valid_structure(self):
        result = estimate_response_time(priority="high")
        assert "first_response" in result["sla_targets"]
        assert "resolution" in result["sla_targets"]
        assert "level" in result["breach_risk"]
        assert "overall" in result["breach_risk"]

    def test_estimate_response_time_with_workload(self):
        result = estimate_response_time(
            priority="high",
            team_workload=10,
            team_size=2
        )
        assert result["factors"]["team_workload"] == 10
        assert result["factors"]["team_size"] == 2
        assert result["factors"]["workload_factor"] > 1.0

    def test_estimate_response_time_with_historical_data(self):
        result = estimate_response_time(
            priority="medium",
            historical_avg_hours=12.0
        )
        assert result["factors"]["has_historical_data"] is True

    def test_estimate_response_time_high_workload_increases_time(self):
        low_workload = estimate_response_time(priority="medium", team_workload=0, team_size=1)
        high_workload = estimate_response_time(priority="medium", team_workload=20, team_size=1)
        assert high_workload["estimated_first_response_hours"] > low_workload["estimated_first_response_hours"]

    def test_estimate_response_time_breach_risk_calculation(self):
        result = estimate_response_time(priority="critical")
        assert "first_response" in result["breach_risk"]
        assert "resolution" in result["breach_risk"]
        assert "overall" in result["breach_risk"]
        assert result["breach_risk"]["level"] in ["low", "medium", "high"]

    def test_estimate_response_time_predictions(self):
        result = estimate_response_time(priority="low")
        assert "will_breach_first_response" in result["predictions"]
        assert "will_breach_resolution" in result["predictions"]
        assert "first_response_deadline" in result["predictions"]
        assert "resolution_deadline" in result["predictions"]


class TestGenerateEstimationSummary:
    def test_generate_summary_returns_string(self):
        estimation = estimate_response_time(priority="medium")
        summary = generate_estimation_summary(estimation)
        assert isinstance(summary, str)
        assert len(summary) > 0

    def test_generate_summary_contains_risk_info(self):
        estimation = estimate_response_time(priority="critical")
        summary = generate_estimation_summary(estimation)
        assert any(word in summary.lower() for word in ["risk", "breach", "sla"])

    def test_generate_summary_contains_time_estimates(self):
        estimation = estimate_response_time(priority="high")
        summary = generate_estimation_summary(estimation)
        assert "first response" in summary.lower() or "response" in summary.lower()


class TestPriorityWeights:
    def test_priority_weights_exist(self):
        assert PRIORITY_WEIGHTS["critical"] == 4
        assert PRIORITY_WEIGHTS["high"] == 3
        assert PRIORITY_WEIGHTS["medium"] == 2
        assert PRIORITY_WEIGHTS["low"] == 1
