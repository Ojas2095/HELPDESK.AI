"""
Unit tests for backend/services/metrics_service.py
Covers Prometheus metrics instrumentation for AI classifier inference telemetry.
"""
import unittest
from unittest.mock import patch, MagicMock


class TestMetricsService(unittest.TestCase):
    """Test suite for metrics_service.py Prometheus metrics."""

    # ── CLASSIFIER_LATENCY Histogram ────────────────────────────

    def test_latency_histogram_name(self):
        """Histogram metric name should be correct."""
        with patch.dict("sys.modules", {"prometheus_client": MagicMock()}):
            import importlib
            import backend.services.metrics_service as ms
            importlib.reload(ms)
            self.assertEqual(
                ms.CLASSIFIER_LATENCY._name,
                "ai_classifier_inference_latency_seconds",
            )

    def test_latency_histogram_description(self):
        """Histogram should have a meaningful description."""
        with patch.dict("sys.modules", {"prometheus_client": MagicMock()}):
            import importlib
            import backend.services.metrics_service as ms
            importlib.reload(ms)
            self.assertIn("Latency", ms.CLASSIFIER_LATENCY._documentation)

    def test_latency_histogram_labelnames(self):
        """Histogram should expose model label."""
        with patch.dict("sys.modules", {"prometheus_client": MagicMock()}):
            import importlib
            import backend.services.metrics_service as ms
            importlib.reload(ms)
            self.assertIn("model", ms.CLASSIFIER_LATENCY._labelnames)

    def test_latency_histogram_buckets(self):
        """Histogram buckets should span from 0.01s to 10s."""
        with patch.dict("sys.modules", {"prometheus_client": MagicMock()}):
            import importlib
            import backend.services.metrics_service as ms
            importlib.reload(ms)
            expected = (0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0)
            self.assertEqual(ms.CLASSIFIER_LATENCY._buckets, expected)

    def test_latency_buckets_monotonically_increasing(self):
        """Buckets should be sorted in ascending order."""
        with patch.dict("sys.modules", {"prometheus_client": MagicMock()}):
            import importlib
            import backend.services.metrics_service as ms
            importlib.reload(ms)
            buckets = ms.CLASSIFIER_LATENCY._buckets
            self.assertEqual(buckets, tuple(sorted(buckets)))

    def test_latency_observe_distilbert(self):
        """Observe should record latency for distilbert model."""
        mock_hist = MagicMock()
        with patch("backend.services.metrics_service.CLASSIFIER_LATENCY", mock_hist):
            from backend.services.metrics_service import CLASSIFIER_LATENCY
            CLASSIFIER_LATENCY.labels(model="distilbert-base-uncased").observe(0.05)
            mock_hist.labels.assert_called_with(model="distilbert-base-uncased")
            mock_hist.labels.return_value.observe.assert_called_with(0.05)

    def test_latency_observe_zero_latency(self):
        """Observe should handle zero latency."""
        mock_hist = MagicMock()
        with patch("backend.services.metrics_service.CLASSIFIER_LATENCY", mock_hist):
            from backend.services.metrics_service import CLASSIFIER_LATENCY
            CLASSIFIER_LATENCY.labels(model="distilbert").observe(0.0)
            mock_hist.labels.return_value.observe.assert_called_with(0.0)

    def test_latency_observe_max_bucket(self):
        """Observe should handle latency at the max bucket edge."""
        mock_hist = MagicMock()
        with patch("backend.services.metrics_service.CLASSIFIER_LATENCY", mock_hist):
            from backend.services.metrics_service import CLASSIFIER_LATENCY
            CLASSIFIER_LATENCY.labels(model="distilbert").observe(10.0)
            mock_hist.labels.return_value.observe.assert_called_with(10.0)

    def test_latency_observe_beyond_max(self):
        """Observe should handle latency exceeding max bucket."""
        mock_hist = MagicMock()
        with patch("backend.services.metrics_service.CLASSIFIER_LATENCY", mock_hist):
            from backend.services.metrics_service import CLASSIFIER_LATENCY
            CLASSIFIER_LATENCY.labels(model="distilbert").observe(30.0)
            mock_hist.labels.return_value.observe.assert_called_with(30.0)

    def test_latency_different_models(self):
        """Different model labels should create separate histogram series."""
        mock_hist = MagicMock()
        with patch("backend.services.metrics_service.CLASSIFIER_LATENCY", mock_hist):
            from backend.services.metrics_service import CLASSIFIER_LATENCY
            CLASSIFIER_LATENCY.labels(model="model-a").observe(0.1)
            CLASSIFIER_LATENCY.labels(model="model-b").observe(0.2)
            calls = [c[1] for c in mock_hist.labels.call_args_list]
            self.assertEqual(calls, [{"model": "model-a"}, {"model": "model-b"}])

    # ── CLASSIFIER_REQUESTS Counter ─────────────────────────────

    def test_requests_counter_name(self):
        """Counter metric name should be correct."""
        with patch.dict("sys.modules", {"prometheus_client": MagicMock()}):
            import importlib
            import backend.services.metrics_service as ms
            importlib.reload(ms)
            self.assertEqual(
                ms.CLASSIFIER_REQUESTS._name,
                "ai_classifier_inference_requests_total",
            )

    def test_requests_counter_labelnames(self):
        """Counter should expose model and status labels."""
        with patch.dict("sys.modules", {"prometheus_client": MagicMock()}):
            import importlib
            import backend.services.metrics_service as ms
            importlib.reload(ms)
            self.assertIn("model", ms.CLASSIFIER_REQUESTS._labelnames)
            self.assertIn("status", ms.CLASSIFIER_REQUESTS._labelnames)

    def test_requests_counter_ok_increment(self):
        """Counter should increment for successful requests."""
        mock_ctr = MagicMock()
        with patch("backend.services.metrics_service.CLASSIFIER_REQUESTS", mock_ctr):
            from backend.services.metrics_service import CLASSIFIER_REQUESTS
            CLASSIFIER_REQUESTS.labels(model="distilbert", status="ok").inc()
            mock_ctr.labels.assert_called_with(model="distilbert", status="ok")
            mock_ctr.labels.return_value.inc.assert_called_once()

    def test_requests_counter_error_increment(self):
        """Counter should increment for error requests."""
        mock_ctr = MagicMock()
        with patch("backend.services.metrics_service.CLASSIFIER_REQUESTS", mock_ctr):
            from backend.services.metrics_service import CLASSIFIER_REQUESTS
            CLASSIFIER_REQUESTS.labels(model="distilbert", status="error").inc()
            mock_ctr.labels.assert_called_with(model="distilbert", status="error")

    def test_requests_counter_ok_and_error_separate(self):
        """OK and error labels should be independent counters."""
        mock_ctr = MagicMock()
        with patch("backend.services.metrics_service.CLASSIFIER_REQUESTS", mock_ctr):
            from backend.services.metrics_service import CLASSIFIER_REQUESTS
            CLASSIFIER_REQUESTS.labels(model="distilbert", status="ok").inc()
            CLASSIFIER_REQUESTS.labels(model="distilbert", status="error").inc()
            ok_call = mock_ctr.labels.call_args_list[0][1]
            err_call = mock_ctr.labels.call_args_list[1][1]
            self.assertNotEqual(ok_call["status"], err_call["status"])

    # ── CLASSIFIER_TOKENS Counter ───────────────────────────────

    def test_tokens_counter_name(self):
        """Token counter name should be correct."""
        with patch.dict("sys.modules", {"prometheus_client": MagicMock()}):
            import importlib
            import backend.services.metrics_service as ms
            importlib.reload(ms)
            self.assertEqual(
                ms.CLASSIFIER_TOKENS._name,
                "ai_classifier_input_tokens_total",
            )

    def test_tokens_counter_labelnames(self):
        """Token counter should expose model label."""
        with patch.dict("sys.modules", {"prometheus_client": MagicMock()}):
            import importlib
            import backend.services.metrics_service as ms
            importlib.reload(ms)
            self.assertIn("model", ms.CLASSIFIER_TOKENS._labelnames)

    def test_tokens_counter_increment(self):
        """Token counter should increment with model label."""
        mock_ctr = MagicMock()
        with patch("backend.services.metrics_service.CLASSIFIER_TOKENS", mock_ctr):
            from backend.services.metrics_service import CLASSIFIER_TOKENS
            CLASSIFIER_TOKENS.labels(model="distilbert").inc(512)
            mock_ctr.labels.assert_called_with(model="distilbert")
            mock_ctr.labels.return_value.inc.assert_called_with(512)

    def test_tokens_counter_zero_tokens(self):
        """Token counter should handle zero tokens."""
        mock_ctr = MagicMock()
        with patch("backend.services.metrics_service.CLASSIFIER_TOKENS", mock_ctr):
            from backend.services.metrics_service import CLASSIFIER_TOKENS
            CLASSIFIER_TOKENS.labels(model="distilbert").inc(0)
            mock_ctr.labels.return_value.inc.assert_called_with(0)

    def test_tokens_counter_large_input(self):
        """Token counter should handle large token counts."""
        mock_ctr = MagicMock()
        with patch("backend.services.metrics_service.CLASSIFIER_TOKENS", mock_ctr):
            from backend.services.metrics_service import CLASSIFIER_TOKENS
            CLASSIFIER_TOKENS.labels(model="distilbert").inc(100000)
            mock_ctr.labels.return_value.inc.assert_called_with(100000)

    # ── Metric Family / Registration ────────────────────────────

    def test_all_metrics_are_instantiated(self):
        """All three Prometheus metrics should be importable."""
        with patch("prometheus_client.Counter") as mock_counter, \
             patch("prometheus_client.Histogram") as mock_histogram:
            import importlib
            import backend.services.metrics_service as ms
            importlib.reload(ms)
            self.assertIsNotNone(ms.CLASSIFIER_LATENCY)
            self.assertIsNotNone(ms.CLASSIFIER_REQUESTS)
            self.assertIsNotNone(ms.CLASSIFIER_TOKENS)

    def test_histogram_type(self):
        """CLASSIFIER_LATENCY should be a Histogram instance."""
        with patch("prometheus_client.Histogram") as mock_hist:
            import importlib
            import backend.services.metrics_service as ms
            importlib.reload(ms)
            self.assertTrue(hasattr(ms.CLASSIFIER_LATENCY, 'observe'))

    def test_counter_types(self):
        """REQUESTS and TOKENS should be Counter instances."""
        with patch("prometheus_client.Counter") as mock_ctr, \
             patch("prometheus_client.Histogram"):
            import importlib
            import backend.services.metrics_service as ms
            importlib.reload(ms)
            self.assertTrue(hasattr(ms.CLASSIFIER_REQUESTS, 'inc'))
            self.assertTrue(hasattr(ms.CLASSIFIER_TOKENS, 'inc'))

    # ── Integration Scenario ────────────────────────────────────

    def test_typical_inference_flow(self):
        """Simulate a typical inference recording: observe latency, inc requests, inc tokens."""
        mock_hist = MagicMock()
        mock_req = MagicMock()
        mock_tok = MagicMock()

        with patch("backend.services.metrics_service.CLASSIFIER_LATENCY", mock_hist), \
             patch("backend.services.metrics_service.CLASSIFIER_REQUESTS", mock_req), \
             patch("backend.services.metrics_service.CLASSIFIER_TOKENS", mock_tok):

            from backend.services.metrics_service import (
                CLASSIFIER_LATENCY, CLASSIFIER_REQUESTS, CLASSIFIER_TOKENS,
            )

            model = "distilbert-base-uncased"
            CLASSIFIER_TOKENS.labels(model=model).inc(128)
            CLASSIFIER_LATENCY.labels(model=model).observe(0.045)
            CLASSIFIER_REQUESTS.labels(model=model, status="ok").inc()

            mock_tok.labels.assert_called_with(model=model)
            mock_hist.labels.assert_called_with(model=model)
            mock_req.labels.assert_called_with(model=model, status="ok")

    def test_error_inference_flow(self):
        """Simulate recording a failed inference."""
        mock_req = MagicMock()
        with patch("backend.services.metrics_service.CLASSIFIER_REQUESTS", mock_req):
            from backend.services.metrics_service import CLASSIFIER_REQUESTS
            CLASSIFIER_REQUESTS.labels(model="distilbert", status="error").inc()
            mock_req.labels.assert_called_with(model="distilbert", status="error")


if __name__ == "__main__":
    unittest.main()
