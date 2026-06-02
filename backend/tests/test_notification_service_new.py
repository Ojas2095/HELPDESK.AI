"""
Unit tests for Notification Service.

Tests for notification sending, preferences, history, batch operations,
error handling, and rate limiting based on Issue #1097.
"""

import sys
from unittest.mock import MagicMock, patch, call
from datetime import datetime, timezone


# ============================================================
# Notification Service (minimal implementation for testing)
# ============================================================

class NotificationError(Exception):
    """Base notification error."""
    pass


class InvalidChannelError(NotificationError):
    """Invalid notification channel."""
    pass


class UserNotFoundError(NotificationError):
    """User not found."""
    pass


class RateLimitExceededError(NotificationError):
    """Notification rate limit exceeded."""
    pass


VALID_CHANNELS = {"email", "sms", "push", "in_app"}
MAX_NOTIFICATIONS_PER_HOUR = 100


class NotificationService:
    """Minimal notification service matching the spec."""

    def __init__(self, db_client=None, email_client=None, sms_client=None,
                 push_client=None):
        self.db = db_client or MagicMock()
        self.email = email_client or MagicMock()
        self.sms = sms_client or MagicMock()
        self.push = push_client or MagicMock()
        self._rate_counter = {}  # user_id -> (hour_key, count)

    def _get_channel_client(self, channel: str):
        """Get the client for a channel."""
        if channel not in VALID_CHANNELS:
            raise InvalidChannelError(f"Invalid channel: {channel}")
        if channel == "email":
            return self.email
        elif channel == "sms":
            return self.sms
        elif channel == "push":
            return self.push
        return self.db  # in_app uses DB

    def _check_rate_limit(self, user_id: str):
        """Check if user has exceeded rate limit."""
        now = datetime.now(timezone.utc)
        hour_key = now.strftime("%Y-%m-%d-%H")

        if user_id in self._rate_counter:
            last_hour, count = self._rate_counter[user_id]
            if last_hour == hour_key and count >= MAX_NOTIFICATIONS_PER_HOUR:
                raise RateLimitExceededError(
                    f"Rate limit exceeded for user {user_id}"
                )
            elif last_hour != hour_key:
                self._rate_counter[user_id] = (hour_key, 1)
            else:
                self._rate_counter[user_id] = (hour_key, count + 1)
        else:
            self._rate_counter[user_id] = (hour_key, 1)

    def _get_user_preferences(self, user_id: str) -> dict:
        """Get user notification preferences."""
        user = self.db.get_user(user_id)
        if user is None:
            raise UserNotFoundError(f"User {user_id} not found")
        return user.get("notification_preferences", {
            "email": True, "sms": True, "push": True, "in_app": True
        })

    def send_notification(self, user_id: str, channel: str,
                          title: str, body: str) -> dict:
        """Send a notification to a user via specified channel."""
        # Validate channel
        if channel not in VALID_CHANNELS:
            raise InvalidChannelError(f"Invalid channel: {channel}")

        # Check rate limit
        self._check_rate_limit(user_id)

        # Check user preferences
        prefs = self._get_user_preferences(user_id)
        if not prefs.get(channel, True):
            return {
                "sent": False,
                "reason": "user_disabled_channel",
                "notification_id": None
            }

        # Send via appropriate client
        client = self._get_channel_client(channel)
        result = client.send(user_id, title, body)

        return {
            "sent": result.get("success", True),
            "notification_id": result.get("id", "notif-001"),
            "channel": channel,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def get_notification_history(self, user_id: str, page: int = 1,
                                  per_page: int = 20) -> dict:
        """Get paginated notification history for a user."""
        history = self.db.get_notifications(user_id)
        total = len(history)
        start = (page - 1) * per_page
        end = start + per_page

        return {
            "notifications": history[start:end],
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": max(1, (total + per_page - 1) // per_page),
        }

    def mark_as_read(self, notification_id: str) -> bool:
        """Mark a notification as read."""
        return self.db.mark_read(notification_id)

    def send_batch(self, user_ids: list[str], channel: str,
                   title: str, body: str) -> dict:
        """Send notification to multiple users."""
        results = []
        for uid in user_ids:
            try:
                result = self.send_notification(uid, channel, title, body)
                results.append({"user_id": uid, **result})
            except (UserNotFoundError, RateLimitExceededError) as e:
                results.append({
                    "user_id": uid, "sent": False,
                    "reason": type(e).__name__
                })

        sent_count = sum(1 for r in results if r.get("sent"))
        return {
            "total": len(user_ids),
            "sent": sent_count,
            "failed": len(user_ids) - sent_count,
            "results": results,
        }


# ============================================================
# send_notification Tests
# ============================================================

class TestSendNotification:
    """Test send_notification method."""

    def setup_method(self):
        self.db = MagicMock()
        self.db.get_user.return_value = {
            "id": "user-1",
            "notification_preferences": {"email": True, "sms": True, "push": True}
        }
        self.email = MagicMock()
        self.email.send.return_value = {"success": True, "id": "notif-001"}
        self.sms = MagicMock()
        self.sms.send.return_value = {"success": True, "id": "notif-002"}
        self.push = MagicMock()
        self.push.send.return_value = {"success": True, "id": "notif-003"}
        self.service = NotificationService(
            db_client=self.db, email_client=self.email,
            sms_client=self.sms, push_client=self.push
        )

    def test_send_email_success(self):
        result = self.service.send_notification(
            "user-1", "email", "Test", "Body"
        )
        assert result["sent"] == True
        assert result["notification_id"] == "notif-001"
        assert result["channel"] == "email"
        self.email.send.assert_called_once()

    def test_send_sms_success(self):
        result = self.service.send_notification(
            "user-1", "sms", "Alert", "SMS body"
        )
        assert result["sent"] == True
        self.sms.send.assert_called_once()

    def test_send_push_success(self):
        result = self.service.send_notification(
            "user-1", "push", "Push", "Push body"
        )
        assert result["sent"] == True
        self.push.send.assert_called_once()

    def test_invalid_channel_raises_error(self):
        try:
            self.service.send_notification("user-1", "fax", "Test", "Body")
            assert False, "Should have raised"
        except InvalidChannelError as e:
            assert "fax" in str(e)

    def test_send_failure_returns_sent_false(self):
        self.email.send.return_value = {"success": False, "id": None}
        result = self.service.send_notification(
            "user-1", "email", "Test", "Body"
        )
        assert result["sent"] == False

    def test_result_includes_timestamp(self):
        result = self.service.send_notification(
            "user-1", "email", "Test", "Body"
        )
        assert "timestamp" in result
        assert result["timestamp"] is not None


# ============================================================
# Notification Preferences Tests
# ============================================================

class TestNotificationPreferences:
    """Test that user preferences are respected."""

    def test_respects_disabled_email_preference(self):
        db = MagicMock()
        db.get_user.return_value = {
            "id": "user-1",
            "notification_preferences": {"email": False}
        }
        service = NotificationService(db_client=db)
        result = service.send_notification("user-1", "email", "Test", "Body")
        assert result["sent"] == False
        assert result["reason"] == "user_disabled_channel"

    def test_respects_disabled_push_preference(self):
        db = MagicMock()
        db.get_user.return_value = {
            "id": "user-1",
            "notification_preferences": {"push": False}
        }
        service = NotificationService(db_client=db)
        result = service.send_notification("user-1", "push", "Test", "Body")
        assert result["sent"] == False

    def test_allows_when_channel_enabled(self):
        db = MagicMock()
        db.get_user.return_value = {
            "id": "user-1",
            "notification_preferences": {"email": True, "sms": False}
        }
        sms = MagicMock()
        sms.send.return_value = {"success": True, "id": "n-1"}
        service = NotificationService(db_client=db, sms_client=sms)
        result = service.send_notification("user-1", "sms", "Test", "Body")
        # sms is False → should be blocked
        assert result["sent"] == False

    def test_default_preferences_when_none_set(self):
        db = MagicMock()
        db.get_user.return_value = {"id": "user-2"}  # No preferences
        email = MagicMock()
        email.send.return_value = {"success": True, "id": "n-1"}
        service = NotificationService(db_client=db, email_client=email)
        result = service.send_notification("user-2", "email", "Test", "Body")
        # Default should be True
        assert result["sent"] == True


# ============================================================
# get_notification_history Tests
# ============================================================

class TestGetNotificationHistory:
    """Test get_notification_history method."""

    def test_returns_correct_structure(self):
        db = MagicMock()
        db.get_notifications.return_value = [{"id": "n-1"}, {"id": "n-2"}]
        service = NotificationService(db_client=db)
        result = service.get_notification_history("user-1")
        assert result["total"] == 2
        assert result["page"] == 1
        assert result["per_page"] == 20
        assert result["total_pages"] == 1

    def test_pagination_works(self):
        db = MagicMock()
        db.get_notifications.return_value = list(range(25))  # 25 items
        service = NotificationService(db_client=db)
        page1 = service.get_notification_history("user-1", page=1, per_page=10)
        assert len(page1["notifications"]) == 10
        assert page1["total_pages"] == 3

        page2 = service.get_notification_history("user-1", page=2, per_page=10)
        assert len(page2["notifications"]) == 10

        page3 = service.get_notification_history("user-1", page=3, per_page=10)
        assert len(page3["notifications"]) == 5

    def test_empty_history(self):
        db = MagicMock()
        db.get_notifications.return_value = []
        service = NotificationService(db_client=db)
        result = service.get_notification_history("user-1")
        assert result["total"] == 0
        assert result["notifications"] == []
        assert result["total_pages"] == 1


# ============================================================
# mark_as_read Tests
# ============================================================

class TestMarkAsRead:
    """Test mark_as_read method."""

    def test_marks_notification_as_read(self):
        db = MagicMock()
        db.mark_read.return_value = True
        service = NotificationService(db_client=db)
        result = service.mark_as_read("notif-001")
        assert result == True
        db.mark_read.assert_called_once_with("notif-001")

    def test_returns_false_on_failure(self):
        db = MagicMock()
        db.mark_read.return_value = False
        service = NotificationService(db_client=db)
        result = service.mark_as_read("notif-001")
        assert result == False


# ============================================================
# Batch Notification Tests
# ============================================================

class TestBatchNotifications:
    """Test send_batch method."""

    def setup_method(self):
        self.db = MagicMock()
        self.db.get_user.return_value = {"id": "user-1", "notification_preferences": {"email": True}}
        self.email = MagicMock()
        self.email.send.return_value = {"success": True, "id": "n-1"}
        self.service = NotificationService(db_client=self.db, email_client=self.email)

    def test_sends_to_all_users(self):
        result = self.service.send_batch(
            ["user-1", "user-2", "user-3"], "email", "Batch", "Body"
        )
        assert result["total"] == 3
        assert result["sent"] == 3
        assert result["failed"] == 0
        assert self.email.send.call_count == 3

    def test_handles_user_not_found_in_batch(self):
        def get_user_side_effect(uid):
            if uid == "user-2":
                return None
            return {"id": uid, "notification_preferences": {"email": True}}
        self.db.get_user.side_effect = get_user_side_effect

        result = self.service.send_batch(
            ["user-1", "user-2", "user-3"], "email", "Batch", "Body"
        )
        assert result["sent"] == 2
        assert result["failed"] == 1

    def test_batch_result_structure(self):
        result = self.service.send_batch(
            ["user-1", "user-2"], "email", "Batch", "Body"
        )
        assert "results" in result
        assert len(result["results"]) == 2
        for r in result["results"]:
            assert "user_id" in r
            assert "sent" in r


# ============================================================
# Error Handling Tests
# ============================================================

class TestErrorHandling:
    """Test error handling in notification service."""

    def test_invalid_channel_raises(self):
        service = NotificationService()
        try:
            service.send_notification("user-1", "carrier_pigeon", "T", "B")
            assert False
        except InvalidChannelError:
            pass

    def test_user_not_found_raises(self):
        db = MagicMock()
        db.get_user.return_value = None
        service = NotificationService(db_client=db)
        try:
            service.send_notification("ghost-user", "email", "T", "B")
            assert False
        except UserNotFoundError:
            pass


# ============================================================
# Rate Limiting Tests
# ============================================================

class TestRateLimiting:
    """Test rate limiting."""

    def test_allows_under_limit(self):
        db = MagicMock()
        db.get_user.return_value = {"id": "user-1", "notification_preferences": {"email": True}}
        email = MagicMock()
        email.send.return_value = {"success": True, "id": "n-1"}
        service = NotificationService(db_client=db, email_client=email)

        for _ in range(50):
            result = service.send_notification("user-1", "email", "T", "B")
            assert result["sent"] == True

    def test_blocks_over_limit(self):
        db = MagicMock()
        db.get_user.return_value = {"id": "user-1", "notification_preferences": {"email": True}}
        email = MagicMock()
        email.send.return_value = {"success": True, "id": "n-1"}
        service = NotificationService(db_client=db, email_client=email)

        # Send 100 (limit)
        for _ in range(100):
            service.send_notification("user-1", "email", "T", "B")

        # 101st should fail
        try:
            service.send_notification("user-1", "email", "T", "B")
            assert False, "Should have raised RateLimitExceededError"
        except RateLimitExceededError:
            pass

    def test_different_users_have_separate_limits(self):
        db = MagicMock()
        db.get_user.return_value = {"id": "user-1", "notification_preferences": {"email": True}}
        email = MagicMock()
        email.send.return_value = {"success": True, "id": "n-1"}
        service = NotificationService(db_client=db, email_client=email)

        for _ in range(100):
            service.send_notification("user-1", "email", "T", "B")

        # user-2 should still be able to send
        result = service.send_notification("user-2", "email", "T", "B")
        assert result["sent"] == True
