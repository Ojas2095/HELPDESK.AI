"""
Unit tests for DuplicateService.check_duplicate method.

Tests:
- test_check_duplicate_returns_no_match_when_store_empty
- test_check_duplicate_uses_custom_threshold
- test_check_duplicate_handles_degraded_mode
"""

import os
import pytest
from unittest.mock import patch, MagicMock

# Set environment variables before importing
os.environ["ALLOW_DEGRADED_STARTUP"] = "1"

from backend.services.duplicate_service import DuplicateService, SIMILARITY_THRESHOLD


class TestCheckDuplicate:
    """Test cases for DuplicateService.check_duplicate method."""

    def setup_method(self):
        """Reset service before each test."""
        self.service = DuplicateService()

    def test_check_duplicate_returns_no_match_when_store_empty(self):
        """When the ticket store is empty, check_duplicate should return no match."""
        # Mock the model to avoid loading
        self.service._loaded = True
        self.service._load_failed = False
        self.service.model = MagicMock()
        self.service._tickets = []

        result = self.service.check_duplicate("test ticket text")

        assert result["is_duplicate"] is False
        assert result["duplicate_ticket_id"] is None
        assert result["similarity"] == 0.0

    def test_check_duplicate_uses_custom_threshold(self):
        """When a custom threshold is provided, it should override the default."""
        # Mock the model and embeddings
        mock_model = MagicMock()
        mock_embedding = MagicMock()
        mock_model.encode.return_value = mock_embedding

        # Mock cosine similarity to return a specific score
        with patch("backend.services.duplicate_service.util") as mock_util:
            mock_util.cos_sim.return_value.item.return_value = 0.75

            self.service._loaded = True
            self.service._load_failed = False
            self.service.model = mock_model
            self.service._tickets = [
                ("ticket-1", mock_embedding, "existing ticket text")
            ]

            # With default threshold (0.70), 0.75 should be a duplicate
            result_default = self.service.check_duplicate("new ticket text")
            assert result_default["is_duplicate"] is True

            # With custom threshold (0.80), 0.75 should NOT be a duplicate
            result_custom = self.service.check_duplicate("new ticket text", threshold=0.80)
            assert result_custom["is_duplicate"] is False

    def test_check_duplicate_handles_degraded_mode(self):
        """When model is not available (degraded mode), should return no duplicate."""
        self.service._loaded = False
        self.service._load_failed = True
        self.service.model = None

        result = self.service.check_duplicate("test ticket text")

        assert result["is_duplicate"] is False
        assert result["duplicate_ticket_id"] is None
        assert result["similarity"] == 0.0

    def test_check_duplicate_returns_best_match(self):
        """Should return the ticket with highest similarity score."""
        mock_model = MagicMock()
        mock_embedding = MagicMock()
        mock_model.encode.return_value = mock_embedding

        with patch("backend.services.duplicate_service.util") as mock_util:
            # First ticket: 0.60 (below threshold)
            # Second ticket: 0.85 (above threshold)
            mock_util.cos_sim.side_effect = [
                MagicMock(item=MagicMock(return_value=0.60)),
                MagicMock(item=MagicMock(return_value=0.85)),
            ]

            self.service._loaded = True
            self.service._load_failed = False
            self.service.model = mock_model
            self.service._tickets = [
                ("ticket-1", mock_embedding, "first ticket"),
                ("ticket-2", mock_embedding, "second ticket"),
            ]

            result = self.service.check_duplicate("new ticket text")

            assert result["is_duplicate"] is True
            assert result["duplicate_ticket_id"] == "ticket-2"
            assert result["similarity"] == 0.85

    def test_check_duplicate_below_threshold(self):
        """When best match is below threshold, should return no duplicate."""
        mock_model = MagicMock()
        mock_embedding = MagicMock()
        mock_model.encode.return_value = mock_embedding

        with patch("backend.services.duplicate_service.util") as mock_util:
            mock_util.cos_sim.return_value.item.return_value = 0.50

            self.service._loaded = True
            self.service._load_failed = False
            self.service.model = mock_model
            self.service._tickets = [
                ("ticket-1", mock_embedding, "existing ticket")
            ]

            result = self.service.check_duplicate("new ticket text")

            assert result["is_duplicate"] is False
            assert result["duplicate_ticket_id"] is None
            assert result["similarity"] == 0.50
