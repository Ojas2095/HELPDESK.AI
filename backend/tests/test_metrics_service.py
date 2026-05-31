"""
Tests for backend/services/metrics_service.py
"""
import pytest


class TestMetricsService:
    """Test cases for Prometheus metrics service."""

    def test_classifier_latency_histogram_exists(self):
        """Test that CLASSIFIER_LATENCY histogram is properly configured."""
        from prometheus_client import Histogram

        from backend.services.metrics_service import CLASSIFIER_LATENCY

        assert isinstance(CLASSIFIER_LATENCY, Histogram)
        assert "Latency" in CLASSIFIER_LATENCY._documentation
        assert "model" in CLASSIFIER_LATENCY._labelnames

    def test_classifier_requests_counter_exists(self):
        """Test that CLASSIFIER_REQUESTS counter is properly configured."""
        from prometheus_client import Counter

        from backend.services.metrics_service import CLASSIFIER_REQUESTS

        assert isinstance(CLASSIFIER_REQUESTS, Counter)
        assert "Total" in CLASSIFIER_REQUESTS._documentation
        assert "model" in CLASSIFIER_REQUESTS._labelnames
        assert "status" in CLASSIFIER_REQUESTS._labelnames

    def test_classifier_tokens_counter_exists(self):
        """Test that CLASSIFIER_TOKENS counter is properly configured."""
        from prometheus_client import Counter

        from backend.services.metrics_service import CLASSIFIER_TOKENS

        assert isinstance(CLASSIFIER_TOKENS, Counter)
        assert "Total" in CLASSIFIER_TOKENS._documentation
        assert "model" in CLASSIFIER_TOKENS._labelnames

    def test_metrics_can_be_observed(self):
        """Test that metrics can be observed without error."""
        from backend.services.metrics_service import CLASSIFIER_LATENCY, CLASSIFIER_REQUESTS, CLASSIFIER_TOKENS

        CLASSIFIER_LATENCY.labels(model="distilbert").observe(0.05)
        CLASSIFIER_REQUESTS.labels(model="distilbert", status="ok").inc()
        CLASSIFIER_TOKENS.labels(model="distilbert").inc(100)

    def test_metrics_labels(self):
        """Test that metric labels are accessible."""
        from backend.services.metrics_service import CLASSIFIER_LATENCY, CLASSIFIER_REQUESTS, CLASSIFIER_TOKENS

        latency_labels = CLASSIFIER_LATENCY._labelnames
        requests_labels = CLASSIFIER_REQUESTS._labelnames
        tokens_labels = CLASSIFIER_TOKENS._labelnames

        assert "model" in latency_labels
        assert "model" in requests_labels
        assert "status" in requests_labels
        assert "model" in tokens_labels

    def test_multiple_model_labels(self):
        """Test that multiple model labels can be used simultaneously."""
        from backend.services.metrics_service import CLASSIFIER_LATENCY

        CLASSIFIER_LATENCY.labels(model="distilbert").observe(0.05)
        CLASSIFIER_LATENCY.labels(model="bert").observe(0.08)

    def test_counter_increment(self):
        """Test that counters can be incremented without error."""
        from backend.services.metrics_service import CLASSIFIER_REQUESTS

        CLASSIFIER_REQUESTS.labels(model="test", status="ok").inc()

    def test_histogram_observe(self):
        """Test that histogram can record observations without error."""
        from backend.services.metrics_service import CLASSIFIER_LATENCY

        CLASSIFIER_LATENCY.labels(model="test").observe(0.1)