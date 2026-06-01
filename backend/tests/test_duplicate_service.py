# backend/tests/test_duplicate_service.py

import sys
from unittest.mock import MagicMock, patch

import pytest

# Mock heavy dependencies BEFORE they are imported by the service.
# This allows the service module to be imported without the actual libraries
# being installed, and it gives us control over their behavior in tests.
sys.modules["torch"] = MagicMock()
sys.modules["sentence_transformers"] = MagicMock()

# Now, with mocks in place, we can safely import the service.
from backend.services.duplicate_service import DuplicateTicketService


@pytest.fixture
def mock_torch():
    """
    Provides a clean, pre-configured mock of the `torch` module for each test.
    """
    torch_mock = sys.modules["torch"]
    torch_mock.reset_mock()

    # Default behavior for torch.stack: return the list of embeddings as-is.
    # Our mocked cos_sim will work directly with this list.
    torch_mock.stack.side_effect = lambda x, dim=0: x

    return torch_mock


@pytest.fixture
def mock_cos_sim():
    """
    Provides a mock for `sentence_transformers.util.cos_sim` patched
    within the duplicate_service's namespace.
    """
    with patch("backend.services.duplicate_service.cos_sim") as mock:
        yield mock


@pytest.fixture
def service():
    """Provides a fresh, empty DuplicateTicketService instance for each test."""
    return DuplicateTicketService()


def test_no_duplicates_found(service, mock_torch, mock_cos_sim):
    """
    Tests that `check_duplicate` returns `None` when the highest similarity
    score is below the specified threshold.
    """
    # Arrange
    service.add_ticket("TICKET-1", MagicMock(), "This is a test ticket.")

    scores_tensor = MagicMock()
    mock_cos_sim.return_value = scores_tensor

    # Simulate torch.max returning a score that is below the threshold.
    low_score = 0.5
    mock_torch.max.return_value = (
        MagicMock(item=MagicMock(return_value=low_score)),  # best_score_tensor
        MagicMock(item=MagicMock(return_value=0)),  # best_match_idx_tensor
    )

    # Act
    result = service.check_duplicate(MagicMock(), threshold=0.9)

    # Assert
    assert result is None
    mock_cos_sim.assert_called_once()
    mock_torch.max.assert_called_once_with(scores_tensor, dim=1)


def test_finds_single_duplicate(service, mock_torch, mock_cos_sim):
    """
    Tests that a duplicate is correctly identified when its similarity score
    is above the threshold.
    """
    # Arrange
    ticket_id, ticket_embedding, ticket_text = "TICKET-1", MagicMock(), "Ticket content"
    service.add_ticket(ticket_id, ticket_embedding, ticket_text)

    scores_tensor = MagicMock()
    mock_cos_sim.return_value = scores_tensor

    high_score = 0.95
    mock_torch.max.return_value = (
        MagicMock(item=MagicMock(return_value=high_score)),
        MagicMock(item=MagicMock(return_value=0)),  # Index is 0 for the single ticket
    )

    # Act
    result = service.check_duplicate(MagicMock(), threshold=0.9)

    # Assert
    assert result is not None
    assert result["id"] == ticket_id
    assert result["text"] == ticket_text
    assert result["score"] == high_score
    mock_cos_sim.assert_called_once()
    mock_torch.stack.assert_called_once_with([ticket_embedding], dim=0)
    mock_torch.max.assert_called_once_with(scores_tensor, dim=1)


def test_picks_best_match_among_multiple_tickets(service, mock_torch, mock_cos_sim):
    """
    Tests that the service identifies the ticket with the highest similarity score
    among multiple candidates and returns it.
    """
    # Arrange
    tickets = [
        ("T1", MagicMock(), "Low similarity"),
        ("T2", MagicMock(), "High similarity"),
        ("T3", MagicMock(), "Medium similarity"),
    ]
    for tid, temb, ttext in tickets:
        service.add_ticket(tid, temb, ttext)

    scores = [0.50, 0.95, 0.72]
    best_match_index = 1

    scores_tensor = MagicMock()
    mock_cos_sim.return_value = scores_tensor

    # torch.max finds the highest score and its index from the similarity tensor.
    mock_torch.max.return_value = (
        MagicMock(item=MagicMock(return_value=scores[best_match_index])),
        MagicMock(item=MagicMock(return_value=best_match_index)),
    )

    # Act
    result = service.check_duplicate(MagicMock(), threshold=0.9)

    # Assert
    assert result is not None
    assert result["id"] == tickets[best_match_index][0]
    assert result["text"] == tickets[best_match_index][2]
    assert result["score"] == scores[best_match_index]

    mock_cos_sim.assert_called_once()
    ticket_embeddings = [t[1] for t in tickets]
    mock_torch.stack.assert_called_once_with(ticket_embeddings, dim=0)
    mock_torch.max.assert_called_once_with(scores_tensor, dim=1)


def test_ignores_tickets_below_threshold(service, mock_torch, mock_cos_sim):
    """
    Tests that `check_duplicate` returns `None` if even the best match's
    score is below the threshold.
    """
    # Arrange
    tickets = [("T1", MagicMock(), "Ticket 1"), ("T2", MagicMock(), "Ticket 2")]
    for tid, temb, ttext in tickets:
        service.add_ticket(tid, temb, ttext)

    scores = [0.6, 0.8]  # Highest score is 0.8
    best_match_index = 1

    scores_tensor = MagicMock()
    mock_cos_sim.return_value = scores_tensor

    mock_torch.max.return_value = (
        MagicMock(item=MagicMock(return_value=scores[best_match_index])),
        MagicMock(item=MagicMock(return_value=best_match_index)),
    )

    # Act
    # The threshold (0.9) is higher than the best score (0.8).
    result = service.check_duplicate(MagicMock(), threshold=0.9)

    # Assert
    assert result is None
    mock_cos_sim.assert_called_once()
    mock_torch.max.assert_called_once_with(scores_tensor, dim=1)


def test_handles_no_existing_tickets(service, mock_torch, mock_cos_sim):
    """
    Tests that the service returns `None` and does not perform any calculations
    when there are no tickets stored.
    """
    # Act
    result = service.check_duplicate(MagicMock(), threshold=0.9)

    # Assert
    assert result is None
    mock_cos_sim.assert_not_called()
    mock_torch.stack.assert_not_called()
    mock_torch.max.assert_not_called()
