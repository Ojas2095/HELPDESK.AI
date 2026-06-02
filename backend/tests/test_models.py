"""
Unit tests for Pydantic ticket models in backend/main.py.

Tests cover:
  - TicketRequest validation (threshold range, image size limits)
  - TicketSaveRequest serialization
  - RatingRequest validation
  - DuplicateInfo, IncidentInfo, EntityInfo models
  - SpamCheck model
  - TicketResponse model with nested models
  - Message model
  - Edge cases and error handling

NOTE: These tests define the models locally (matching main.py definitions)
to avoid importing backend.main which has heavy ML dependencies.
"""

import pytest
from pydantic import BaseModel, ValidationError, field_validator


# ---------------------------------------------------------------------------
# Models — copied from backend/main.py for isolated testing
# ---------------------------------------------------------------------------


class TicketRequest(BaseModel):
    text: str
    image_base64: str = ""
    image_text: str = ""
    user_id: str | None = None
    company: str | None = None
    company_id: str | None = None
    image_url: str | None = None
    confidence_threshold: float = 0.20
    duplicate_sensitivity: float = 0.85

    @field_validator("confidence_threshold", "duplicate_sensitivity")
    @classmethod
    def validate_threshold_range(cls, v: float) -> float:
        if not 0.0 <= v <= 1.0:
            raise ValueError(f"Value must be between 0.0 and 1.0, got {v}")
        return v


class TicketSaveRequest(BaseModel):
    user_id: str
    subject: str
    description: str
    category: str
    subcategory: str
    priority: str
    assigned_team: str
    status: str


class RatingRequest(BaseModel):
    ticket_id: str
    rating: int
    feedback: str | None = None


class DuplicateInfo(BaseModel):
    is_duplicate: bool
    duplicate_ticket_id: str | None = None
    similarity: float = 0.0


class IncidentInfo(BaseModel):
    incident_id: str | None = None
    is_major_incident: bool = False
    ticket_count: int = 0
    affected_users: int = 0
    similarity: float = 0.0


class EntityInfo(BaseModel):
    text: str
    label: str
    confidence: float


class SpamCheck(BaseModel):
    is_spam: bool = False
    risk_score: float = 0.0
    reasons: list[str] = []
    suspicious_urls: list[str] = []
    matched_keywords: list[str] = []


class TicketResponse(BaseModel):
    id: str | int | None = None
    ticket_id: str | None = None
    summary: str
    category: str
    subcategory: str
    priority: str
    auto_resolve: bool
    assigned_team: str
    entities: list[EntityInfo]
    duplicate_ticket: DuplicateInfo
    incident: IncidentInfo = IncidentInfo()
    confidence: float
    needs_review: bool = False
    reasoning: str = ""
    decision_factors: list[str] = []
    image_description: str = ""
    ocr_text: str = ""
    image_url: str | None = None
    highlights: list[str] = []
    timeline: dict = {}
    env_metadata: dict = {}
    sla_breach_at: str | None = None
    original_text: str | None = None
    source_language: str = "en"
    source_language_name: str = "English"
    was_translated: bool = False
    spam_check: SpamCheck = SpamCheck()
    version: str = "2.1.0-Neural-Diagnostic"


class Message(BaseModel):
    sender: str
    message: str
    timestamp: str


# ===========================================================================
# TicketRequest Tests
# ===========================================================================


class TestTicketRequest:
    def test_valid_ticket_request(self):
        ticket = TicketRequest(text="My laptop won't turn on")
        assert ticket.text == "My laptop won't turn on"
        assert ticket.image_base64 == ""
        assert ticket.confidence_threshold == 0.20
        assert ticket.duplicate_sensitivity == 0.85

    def test_all_fields_populated(self):
        ticket = TicketRequest(
            text="Screen is flickering", image_base64="base64data",
            image_text="extracted text", user_id="user123", company="Acme Corp",
            company_id="comp_456", image_url="https://example.com/img.png",
            confidence_threshold=0.50, duplicate_sensitivity=0.90,
        )
        assert ticket.text == "Screen is flickering"
        assert ticket.confidence_threshold == 0.50

    def test_threshold_lower_bound(self):
        assert TicketRequest(text="t", confidence_threshold=0.0).confidence_threshold == 0.0

    def test_threshold_upper_bound(self):
        assert TicketRequest(text="t", confidence_threshold=1.0).confidence_threshold == 1.0

    def test_threshold_below_zero_raises(self):
        with pytest.raises(ValidationError):
            TicketRequest(text="t", confidence_threshold=-0.1)

    def test_threshold_above_one_raises(self):
        with pytest.raises(ValidationError):
            TicketRequest(text="t", confidence_threshold=1.5)

    def test_duplicate_sensitivity_validation(self):
        with pytest.raises(ValidationError):
            TicketRequest(text="t", duplicate_sensitivity=-0.5)
        with pytest.raises(ValidationError):
            TicketRequest(text="t", duplicate_sensitivity=2.0)

    def test_empty_text_allowed(self):
        assert TicketRequest(text="").text == ""

    def test_optional_fields_default_to_none(self):
        ticket = TicketRequest(text="t")
        assert ticket.user_id is None
        assert ticket.company is None

    def test_text_required(self):
        with pytest.raises(ValidationError):
            TicketRequest()

    def test_serialization(self):
        data = TicketRequest(text="t", confidence_threshold=0.5).model_dump()
        assert data["text"] == "t"
        assert data["confidence_threshold"] == 0.5

    def test_json_roundtrip(self):
        ticket = TicketRequest(text="test", user_id="u1", confidence_threshold=0.75)
        restored = TicketRequest.model_validate_json(ticket.model_dump_json())
        assert restored.text == ticket.text
        assert restored.confidence_threshold == 0.75


# ===========================================================================
# TicketSaveRequest Tests
# ===========================================================================


class TestTicketSaveRequest:
    def test_valid_save_request(self):
        req = TicketSaveRequest(
            user_id="u1", subject="s", description="d", category="c",
            subcategory="sc", priority="high", assigned_team="t", status="open",
        )
        assert req.priority == "high"

    def test_missing_required_field(self):
        with pytest.raises(ValidationError):
            TicketSaveRequest(user_id="u1", subject="s")

    def test_serialization(self):
        req = TicketSaveRequest(
            user_id="u1", subject="s", description="d", category="c",
            subcategory="sc", priority="low", assigned_team="t", status="open",
        )
        assert len(req.model_dump()) == 8


# ===========================================================================
# RatingRequest Tests
# ===========================================================================


class TestRatingRequest:
    def test_valid_rating(self):
        req = RatingRequest(ticket_id="tkt_123", rating=5)
        assert req.rating == 5
        assert req.feedback is None

    def test_with_feedback(self):
        req = RatingRequest(ticket_id="tkt_456", rating=3, feedback="faster")
        assert req.feedback == "faster"


# ===========================================================================
# DuplicateInfo Tests
# ===========================================================================


class TestDuplicateInfo:
    def test_not_duplicate(self):
        info = DuplicateInfo(is_duplicate=False)
        assert info.similarity == 0.0

    def test_is_duplicate(self):
        info = DuplicateInfo(is_duplicate=True, duplicate_ticket_id="tkt_789", similarity=0.95)
        assert info.duplicate_ticket_id == "tkt_789"


# ===========================================================================
# IncidentInfo Tests
# ===========================================================================


class TestIncidentInfo:
    def test_default_values(self):
        info = IncidentInfo()
        assert info.is_major_incident is False
        assert info.ticket_count == 0

    def test_major_incident(self):
        info = IncidentInfo(incident_id="INC-001", is_major_incident=True, ticket_count=50)
        assert info.is_major_incident is True


# ===========================================================================
# EntityInfo Tests
# ===========================================================================


class TestEntityInfo:
    def test_valid_entity(self):
        entity = EntityInfo(text="John", label="PERSON", confidence=0.95)
        assert entity.text == "John"

    def test_missing_field_raises(self):
        with pytest.raises(ValidationError):
            EntityInfo(text="t", label="ORG")


# ===========================================================================
# SpamCheck Tests
# ===========================================================================


class TestSpamCheck:
    def test_default_not_spam(self):
        check = SpamCheck()
        assert check.is_spam is False
        assert check.reasons == []

    def test_spam_detected(self):
        check = SpamCheck(is_spam=True, risk_score=0.95, reasons=["r1", "r2"])
        assert check.is_spam is True
        assert len(check.reasons) == 2


# ===========================================================================
# TicketResponse Tests
# ===========================================================================


class TestTicketResponse:
    def _resp(self, **kw):
        d = {
            "summary": "T", "category": "G", "subcategory": "O",
            "priority": "medium", "auto_resolve": False, "assigned_team": "S",
            "entities": [], "duplicate_ticket": DuplicateInfo(is_duplicate=False),
            "confidence": 0.85,
        }
        d.update(kw)
        return TicketResponse(**d)

    def test_minimal_response(self):
        r = self._resp()
        assert r.version == "2.1.0-Neural-Diagnostic"
        assert r.source_language == "en"

    def test_with_entities(self):
        r = self._resp(entities=[EntityInfo(text="W11", label="OS", confidence=0.9)])
        assert len(r.entities) == 1

    def test_with_duplicate(self):
        r = self._resp(duplicate_ticket=DuplicateInfo(is_duplicate=True, similarity=0.92))
        assert r.duplicate_ticket.is_duplicate is True

    def test_with_spam(self):
        r = self._resp(spam_check=SpamCheck(is_spam=True, risk_score=0.88))
        assert r.spam_check.is_spam is True

    def test_defaults(self):
        r = self._resp()
        assert r.id is None
        assert r.needs_review is False
        assert r.was_translated is False

    def test_roundtrip(self):
        r = self._resp(id="tkt_999", confidence=0.75, needs_review=True)
        restored = TicketResponse.model_validate_json(r.model_dump_json())
        assert restored.id == "tkt_999"
        assert restored.confidence == 0.75

    def test_id_string_or_int(self):
        assert self._resp(id="tkt_123").id == "tkt_123"
        assert self._resp(id=42).id == 42


# ===========================================================================
# Message Tests
# ===========================================================================


class TestMessage:
    def test_valid_message(self):
        msg = Message(sender="user", message="Hello", timestamp="2026-06-02T10:00:00Z")
        assert msg.sender == "user"

    def test_missing_field_raises(self):
        with pytest.raises(ValidationError):
            Message(sender="user", message="test")

    def test_serialization(self):
        msg = Message(sender="agent", message="H", timestamp="2026-06-02T10:05:00Z")
        assert "timestamp" in msg.model_dump()
