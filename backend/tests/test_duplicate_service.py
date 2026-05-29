"""
Unit tests for DuplicateService check_duplicate method

Tests cover:
- Threshold override parameter
- Empty ticket store behavior
- Degraded mode when model is not available
"""

import unittest
from unittest.mock import Mock, patch, MagicMock, mock_open
import os
import sys
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.duplicate_service import DuplicateService, SIMILARITY_THRESHOLD


class TestDuplicateServiceCheckDuplicate(unittest.TestCase):
    """Test suite for DuplicateService.check_duplicate method."""

    def setUp(self):
        """Set up test fixtures."""
        # Mock environment variables
        self.env_patcher = patch.dict(os.environ, {}, clear=False)
        self.env_patcher.start()
        
        # Create service instance without loading model
        self.service = DuplicateService()
        
        # Mock model and utilities
        self.mock_model_patcher = patch('services.duplicate_service.SentenceTransformer')
        self.mock_util_patcher = patch('services.duplicate_service.util')
        
        self.mock_model_class = self.mock_model_patcher.start()
        self.mock_util = self.mock_util_patcher.start()
        
        self.mock_model = Mock()
        self.mock_model_class.return_value = self.mock_model
        
        # Mock tensor operations
        self.mock_tensor = Mock()
        self.mock_tensor.item.return_value = 0.85
        self.mock_util.cos_sim.return_value = self.mock_tensor
        
        # Mock model.encode to return predictable embeddings
        self.mock_model.encode.return_value = Mock()

    def tearDown(self):
        """Clean up test fixtures."""
        self.env_patcher.stop()
        self.mock_model_patcher.stop()
        self.mock_util_patcher.stop()

    def test_check_duplicate_returns_no_match_when_store_empty(self):
        """Test that check_duplicate returns no match when ticket store is empty."""
        # Arrange: Service loaded but no tickets
        self.service._loaded = True
        self.service._load_failed = False
        self.service.model = self.mock_model
        self.service._tickets = []
        
        # Act
        result = self.service.check_duplicate("Test ticket text")
        
        # Assert
        self.assertFalse(result["is_duplicate"])
        self.assertIsNone(result["duplicate_ticket_id"])
        self.assertEqual(result["similarity"], 0.0)

    def test_check_duplicate_uses_custom_threshold(self):
        """Test that check_duplicate uses custom threshold when provided."""
        # Arrange: Service loaded with one ticket
        self.service._loaded = True
        self.service._load_failed = False
        self.service.model = self.mock_model
        
        # Add a ticket with embedding
        mock_embedding = Mock()
        self.service._tickets = [("ticket-1", mock_embedding, "Original text")]
        
        # Mock similarity score below default threshold but above custom
        self.mock_tensor.item.return_value = 0.65  # Below 0.70 default
        
        # Act: Use custom threshold of 0.60
        result = self.service.check_duplicate("Test text", threshold=0.60)
        
        # Assert: Should be duplicate with custom threshold
        self.assertTrue(result["is_duplicate"])
        self.assertEqual(result["duplicate_ticket_id"], "ticket-1")

    def test_check_duplicate_uses_default_threshold(self):
        """Test that check_duplicate uses default threshold when none provided."""
        # Arrange: Service loaded with one ticket
        self.service._loaded = True
        self.service._load_failed = False
        self.service.model = self.mock_model
        
        mock_embedding = Mock()
        self.service._tickets = [("ticket-1", mock_embedding, "Original text")]
        
        # Mock similarity score exactly at default threshold
        self.mock_tensor.item.return_value = SIMILARITY_THRESHOLD
        
        # Act
        result = self.service.check_duplicate("Test text")
        
        # Assert: Should be duplicate at threshold
        self.assertTrue(result["is_duplicate"])
        self.assertEqual(result["similarity"], SIMILARITY_THRESHOLD)

    def test_check_duplicate_handles_degraded_mode(self):
        """Test that check_duplicate handles degraded mode when model is not available."""
        # Arrange: Service in degraded mode (model failed to load)
        self.service._loaded = False
        self.service._load_failed = True
        self.service.model = None
        
        # Act
        result = self.service.check_duplicate("Test text")
        
        # Assert: Should return no duplicate in degraded mode
        self.assertFalse(result["is_duplicate"])
        self.assertIsNone(result["duplicate_ticket_id"])
        self.assertEqual(result["similarity"], 0.0)

    def test_check_duplicate_finds_best_match(self):
        """Test that check_duplicate finds the best matching ticket."""
        # Arrange: Service loaded with multiple tickets
        self.service._loaded = True
        self.service._load_failed = False
        self.service.model = self.mock_model
        
        mock_emb1 = Mock()
        mock_emb2 = Mock()
        mock_emb3 = Mock()
        
        self.service._tickets = [
            ("ticket-1", mock_emb1, "Text 1"),
            ("ticket-2", mock_emb2, "Text 2"),
            ("ticket-3", mock_emb3, "Text 3"),
        ]
        
        # Mock different similarity scores
        def mock_cos_sim(query, stored):
            result = Mock()
            if stored == mock_emb2:
                result.item.return_value = 0.90  # Best match
            else:
                result.item.return_value = 0.50
            return result
        
        self.mock_util.cos_sim.side_effect = mock_cos_sim
        
        # Act
        result = self.service.check_duplicate("Test text")
        
        # Assert: Should find ticket-2 as best match
        self.assertTrue(result["is_duplicate"])
        self.assertEqual(result["duplicate_ticket_id"], "ticket-2")
        self.assertEqual(result["similarity"], 0.90)

    def test_check_duplicate_no_match_below_threshold(self):
        """Test that check_duplicate returns no match when all scores are below threshold."""
        # Arrange: Service loaded with tickets
        self.service._loaded = True
        self.service._load_failed = False
        self.service.model = self.mock_model
        
        mock_embedding = Mock()
        self.service._tickets = [("ticket-1", mock_embedding, "Original text")]
        
        # Mock similarity score below threshold
        self.mock_tensor.item.return_value = 0.50  # Below 0.70 threshold
        
        # Act
        result = self.service.check_duplicate("Test text")
        
        # Assert: Should not be duplicate
        self.assertFalse(result["is_duplicate"])
        self.assertIsNone(result["duplicate_ticket_id"])
        self.assertEqual(result["similarity"], 0.50)

    def test_check_duplicate_with_exact_match(self):
        """Test that check_duplicate handles exact text match."""
        # Arrange: Service loaded with ticket
        self.service._loaded = True
        self.service._load_failed = False
        self.service.model = self.mock_model
        
        mock_embedding = Mock()
        self.service._tickets = [("ticket-1", mock_embedding, "Exact same text")]
        
        # Mock perfect similarity
        self.mock_tensor.item.return_value = 1.0
        
        # Act
        result = self.service.check_duplicate("Exact same text")
        
        # Assert: Should be duplicate with perfect score
        self.assertTrue(result["is_duplicate"])
        self.assertEqual(result["duplicate_ticket_id"], "ticket-1")
        self.assertEqual(result["similarity"], 1.0)

    def test_check_duplicate_threshold_boundary(self):
        """Test threshold boundary conditions."""
        # Arrange
        self.service._loaded = True
        self.service._load_failed = False
        self.service.model = self.mock_model
        
        mock_embedding = Mock()
        self.service._tickets = [("ticket-1", mock_embedding, "Text")]
        
        # Test just below threshold
        self.mock_tensor.item.return_value = SIMILARITY_THRESHOLD - 0.01
        result = self.service.check_duplicate("Test")
        self.assertFalse(result["is_duplicate"])
        
        # Test just above threshold
        self.mock_tensor.item.return_value = SIMILARITY_THRESHOLD + 0.01
        result = self.service.check_duplicate("Test")
        self.assertTrue(result["is_duplicate"])


class TestDuplicateServiceEdgeCases(unittest.TestCase):
    """Edge case tests for DuplicateService."""

    @patch.dict(os.environ, {}, clear=False)
    @patch('services.duplicate_service.SentenceTransformer')
    @patch('services.duplicate_service.util')
    def test_check_duplicate_with_empty_text(self, mock_util, mock_model_class):
        """Test check_duplicate with empty text."""
        service = DuplicateService()
        service._loaded = True
        service._load_failed = False
        service.model = mock_model_class.return_value
        
        mock_embedding = Mock()
        service._tickets = [("ticket-1", mock_embedding, "Text")]
        
        mock_tensor = Mock()
        mock_tensor.item.return_value = 0.0
        mock_util.cos_sim.return_value = mock_tensor
        
        result = service.check_duplicate("")
        
        self.assertFalse(result["is_duplicate"])
        self.assertIsNone(result["duplicate_ticket_id"])

    @patch.dict(os.environ, {}, clear=False)
    @patch('services.duplicate_service.SentenceTransformer')
    @patch('services.duplicate_service.util')
    def test_check_duplicate_with_very_high_threshold(self, mock_util, mock_model_class):
        """Test check_duplicate with very high threshold."""
        service = DuplicateService()
        service._loaded = True
        service._load_failed = False
        service.model = mock_model_class.return_value
        
        mock_embedding = Mock()
        service._tickets = [("ticket-1", mock_embedding, "Text")]
        
        mock_tensor = Mock()
        mock_tensor.item.return_value = 0.85  # Below 0.99
        mock_util.cos_sim.return_value = mock_tensor
        
        result = service.check_duplicate("Test", threshold=0.99)
        
        # Should return no duplicate with such high threshold
        self.assertFalse(result["is_duplicate"])

    @patch.dict(os.environ, {}, clear=False)
    @patch('services.duplicate_service.SentenceTransformer')
    @patch('services.duplicate_service.util')
    def test_check_duplicate_with_zero_threshold(self, mock_util, mock_model_class):
        """Test check_duplicate with zero threshold."""
        service = DuplicateService()
        service._loaded = True
        service._load_failed = False
        service.model = mock_model_class.return_value
        
        mock_embedding = Mock()
        service._tickets = [("ticket-1", mock_embedding, "Text")]
        
        mock_tensor = Mock()
        mock_tensor.item.return_value = 0.1
        mock_util.cos_sim.return_value = mock_tensor
        
        # Any score > 0 should match with threshold 0
        result = service.check_duplicate("Test", threshold=0.0)
        
        # Should find a match with zero threshold
        self.assertTrue(result["is_duplicate"])


if __name__ == '__main__':
    unittest.main()