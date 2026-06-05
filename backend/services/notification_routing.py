"""
Notification Routing Middleware: Centralized gating logic for all notifications.

Ensures that email, push, and admin alert notifications respect company-level settings:
- `email_notifications`: Gate all email-based notifications (digests, alerts)
- `admin_alerts`: Gate high-priority admin escalations
- `digest_frequency`: Control digest email frequency (daily, weekly, disabled)

Features:
- Company settings caching with configurable TTL (default 300s / 5 min)
- Thread-safe cache access via threading.Lock (fixes TOCTOU race)
- UUID validation on company_id (fixes silent fail-open from type mismatch)
- LRU-style eviction cap (fixes unbounded OOM growth)
- Audit logging for all notification decisions
- Fail-open design (allow notification if settings unavailable)
- Reusable for all notification trigger points

Security fixes:
  CWE-672: Added SETTINGS_CACHE_TTL_SECONDS to expire stale entries
  CWE-362: Wrapped cache read-check-write in threading.Lock
  CWE-20:  Added UUID regex validation on company_id parameter
  CWE-400: Added MAX_CACHE_SIZE LRU eviction cap
"""

import os
import re
import logging
from collections import OrderedDict
from datetime import datetime, timezone
from functools import wraps
from threading import Lock
from typing import Any, Dict, Optional

from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

CACHE_TTL_SECONDS = int(os.getenv("NOTIFICATION_CACHE_TTL_SECONDS", "300"))  # 5 minutes default

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

handler = logging.StreamHandler()
formatter = logging.Formatter("[NotificationRouting] %(asctime)s - %(levelname)s - %(message)s")
handler.setFormatter(formatter)
logger.addHandler(handler)

# ── Configuration constants ───────────────────────────────────────
# How long (seconds) a cached entry remains valid. Override via env var.
SETTINGS_CACHE_TTL_SECONDS: int = int(os.getenv("SETTINGS_CACHE_TTL_SECONDS", "300"))

# Maximum number of company entries held in-memory at once (LRU eviction).
MAX_CACHE_SIZE: int = int(os.getenv("SETTINGS_CACHE_MAX_SIZE", "1000"))

# Compiled regex for UUID v4 format validation.
_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)

# Module-level lock shared by all instances (singleton pattern).
_cache_lock = Lock()


class NotificationType(str):
    """Types of notifications that can be gated."""
    DAILY_DIGEST = "daily_digest"
    WEEKLY_DIGEST = "weekly_digest"
    TICKET_ALERT = "ticket_alert"
    ADMIN_ALERT = "admin_alert"
    PUSH_NOTIFICATION = "push_notification"


class NotificationRoutingMiddleware:
    """Middleware for routing and gating notifications based on company settings.

    Thread-safe singleton.  Cache entries expire after SETTINGS_CACHE_TTL_SECONDS
    (default 300 s) and are evicted LRU-style when MAX_CACHE_SIZE is exceeded.
    """

    _instance: Optional["NotificationRoutingMiddleware"] = None
    _singleton_lock: Lock = Lock()

    # OrderedDict preserves insertion order for LRU eviction.
    # Structure: { company_id: {"data": {...}, "cached_at": datetime} }
    _settings_cache: OrderedDict = OrderedDict()

    def __new__(cls) -> "NotificationRoutingMiddleware":
        if cls._instance is None:
            with cls._singleton_lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self) -> None:
        """Initialize Supabase client once (guarded by singleton)."""
        if getattr(self, "_initialised", False):
            return
        self.supabase = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
        )
        self.log_level = os.getenv("NOTIFICATION_ROUTING_LOG_LEVEL", "info").lower()
        self._initialised = True

    # ── Internal helpers ──────────────────────────────────────────

    @staticmethod
    def _validate_company_id(company_id: str) -> None:
        """Raise ValueError if company_id is not a valid UUID string.

        Fix for CWE-20: passing an int (or malformed string) to .eq() against
        a UUID column silently returns empty rows, triggering fail-open defaults.
        """
        if not isinstance(company_id, str) or not _UUID_RE.match(company_id):
            raise ValueError(
                f"company_id must be a UUID string (e.g. '550e8400-e29b-41d4-a716-446655440000'), "
                f"got {type(company_id).__name__!r}: {company_id!r}"
            )

    def _fetch_system_settings(self, company_id: str) -> Dict[str, Any]:
        """Fetch company settings from Supabase.

        Args:
            company_id: Validated UUID string of company.

        Returns:
            Dict with ``email_notifications``, ``admin_alerts``, ``digest_frequency``.
        """
        try:
            response = (
                self.supabase.table("system_settings")
                .select("email_notifications, admin_alerts, digest_frequency")
                .eq("company_id", company_id)
                .single()
                .execute()
            )
            if response.data:
                return {
                    "email_notifications": response.data.get("email_notifications", True),
                    "admin_alerts": response.data.get("admin_alerts", True),
                    "digest_frequency": response.data.get("digest_frequency", "daily"),
                }
        except Exception as exc:
            logger.warning(
                "Could not fetch company settings for %s: %s", company_id, exc
            )

        # Fail-open: allow notifications when DB is unavailable.
        return {
            "email_notifications": True,
            "admin_alerts": True,
            "digest_frequency": "daily",
        }

    def get_system_settings(self, company_id: str) -> Dict[str, Any]:
        """Return cached-or-fresh company notification settings.

        Thread-safe via _cache_lock.  Entries expire after
        SETTINGS_CACHE_TTL_SECONDS seconds.  Oldest entry is evicted
        when MAX_CACHE_SIZE is exceeded (LRU policy).

        Args:
            company_id: UUID string identifying the company.

        Returns:
            Dict with ``email_notifications``, ``admin_alerts``, ``digest_frequency``.

        Raises:
            ValueError: If company_id is not a valid UUID string (CWE-20 fix).
        """
        self._validate_company_id(company_id)

        with _cache_lock:
            cached = self._settings_cache.get(company_id)
            if cached is not None:
                age = (
                    datetime.now(timezone.utc) - cached["cached_at"]
                ).total_seconds()
                if age < SETTINGS_CACHE_TTL_SECONDS:
                    # Move to end (most-recently-used) to maintain LRU order.
                    self._settings_cache.move_to_end(company_id)
                    logger.debug("Cache HIT for company %s (age=%.1fs)", company_id, age)
                    return cached["data"]
                logger.debug(
                    "Cache EXPIRED for company %s (age=%.1fs > TTL=%ds)",
                    company_id, age, SETTINGS_CACHE_TTL_SECONDS,
                )

            # Cache miss or expired — fetch from DB.
            fresh = self._fetch_system_settings(company_id)
            self._settings_cache[company_id] = {
                "data": fresh,
                "cached_at": datetime.now(timezone.utc),
            }
            self._settings_cache.move_to_end(company_id)

            # Evict oldest entry if we exceeded the cap (LRU eviction, CWE-400 fix).
            if len(self._settings_cache) > MAX_CACHE_SIZE:
                evicted_id, _ = self._settings_cache.popitem(last=False)
                logger.debug("LRU evicted cache entry for company %s", evicted_id)

            return fresh

    def invalidate_cache(self, company_id: Optional[str] = None) -> None:
        """Invalidate cache for a specific company or all companies.

        Args:
            company_id: UUID string to invalidate, or None to clear everything.
        """
        with _cache_lock:
            if company_id is None:
                self._settings_cache.clear()
                logger.info("Invalidated entire notification settings cache")
            else:
                self._settings_cache.pop(company_id, None)
                logger.info("Invalidated cache for company %s", company_id)

    # ── Public gating methods ─────────────────────────────────────

    def should_send_email_notification(
        self, company_id: str, notification_type: str
    ) -> bool:
        """Check if email notification should be sent for this company.

        Args:
            company_id: UUID string of company.
            notification_type: One of the NotificationType constants.

        Returns:
            True if email notifications are enabled and digest frequency matches.
        """
        settings = self.get_system_settings(company_id)

        if not settings.get("email_notifications", True):
            self._log_skipped("email", company_id, "email_notifications=False")
            return False

        freq = settings.get("digest_frequency", "daily")
        if notification_type == NotificationType.DAILY_DIGEST and freq not in ("daily",):
            self._log_skipped("email", company_id, f"digest_frequency={freq!r} != daily")
            return False
        if notification_type == NotificationType.WEEKLY_DIGEST and freq not in ("weekly",):
            self._log_skipped("email", company_id, f"digest_frequency={freq!r} != weekly")
            return False

        self._log_sent("email", company_id)
        return True

    def should_send_admin_alert(self, company_id: str) -> bool:
        """Check if admin alert should be sent for this company."""
        settings = self.get_system_settings(company_id)

        if settings.get("admin_alerts") is False:
            self.log_notification_skipped(
                company_id, NotificationType.ADMIN_ALERT, "admin_alerts_disabled"
            )
            return False

        if settings.get("admin_alerts") is None:
            return False

        self.log_notification_sent(company_id, NotificationType.ADMIN_ALERT)
        return True

    def should_send_push_notification(self, company_id: str) -> bool:
        """Check if push notification should be sent for this company."""
        settings = self.get_system_settings(company_id)
        enabled = settings.get("email_notifications", True)
        if enabled:
            self._log_sent("push", company_id)
        else:
            self._log_skipped("push", company_id, "email_notifications=False")
        return enabled

    # ── Audit logging ─────────────────────────────────────────────

    def _log_sent(self, notification_type: str, company_id: str) -> None:
        if self.log_level == "info":
            logger.info("AUDIT SENT  | type=%-15s | company=%s", notification_type, company_id)

    def _log_skipped(self, notification_type: str, company_id: str, reason: str) -> None:
        if self.log_level == "info":
            logger.info(
                "AUDIT SKIP  | type=%-15s | company=%s | reason=%s",
                notification_type, company_id, reason,
            )

    def _log_error(self, notification_type: str, company_id: str, error: Exception) -> None:
        logger.error(
            "AUDIT ERROR | type=%-15s | company=%s | error=%s",
            notification_type, company_id, error,
        )


# ── Module-level singleton helpers ───────────────────────────────

_middleware_instance: Optional[NotificationRoutingMiddleware] = None


def load() -> NotificationRoutingMiddleware:
    """Load and return the global NotificationRoutingMiddleware singleton."""
    global _middleware_instance
    if _middleware_instance is None:
        _middleware_instance = NotificationRoutingMiddleware()
    return _middleware_instance


def get_instance() -> NotificationRoutingMiddleware:
    """Return the existing singleton, or create one if not yet initialised."""
    return load()


# ── Convenience decorator ─────────────────────────────────────────

def notification_gate(setting_method: str):
    """Decorator to gate notification sending based on company settings.

    Args:
        setting_method: Method name on NotificationRoutingMiddleware
                        (e.g. 'should_send_email_notification').
    """
    def decorator(func):
        @wraps(func)
        def wrapper(company_id: str, *args, **kwargs):
            router = get_instance()
            check_method = getattr(router, setting_method)
            if not check_method(company_id):
                logger.info(
                    "Notification blocked by %s for company %s",
                    setting_method, company_id,
                )
                return None
            return func(company_id, *args, **kwargs)
        return wrapper
    return decorator
