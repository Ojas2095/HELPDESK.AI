"""
Auto-Close Service: Scheduled background job to automatically close resolved tickets
after a company-configured inactivity period.

Features:
- Configurable per-company auto-close settings
- Respects company-specific auto_close_days setting (default: 7 days)
- Only processes tickets in "resolved" status
- Tracks auto-closed tickets separately for auditing
- Full logging and error handling

FIX: Now reads auto_close_enabled from database system_settings table
instead of hardcoding from environment variable.
"""

import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, List

from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

handler = logging.StreamHandler()
formatter = logging.Formatter("[AutoCloseService] %(asctime)s - %(levelname)s - %(message)s")
handler.setFormatter(formatter)
logger.addHandler(handler)


class AutoCloseService:
    """Background service for automatically closing resolved tickets."""

    def __init__(self):
        """Initialize the auto-close service with Supabase client.
        
        Kelthos Fix: Removed global AUTO_CLOSE_ENABLED env check.
        The admin toggle in the dashboard writes to system_settings.auto_close_enabled,
        so the backend MUST read per-company DB settings — not a global env var.
        The env var AUTO_CLOSE_ENABLED is now DEPRECATED in favor of DB-driven config.
        """
        self.supabase = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )
        # Global fallback default (used when company has no settings)
        self.default_auto_close_days = int(os.getenv("AUTO_CLOSE_DAYS", "7"))
        self.cron_schedule = os.getenv("AUTO_CLOSE_CRON_SCHEDULE", "0 2 * * *")  # 2 AM UTC daily
        # Cache for company settings to reduce DB queries
        self._settings_cache: Dict[str, Dict] = {}
        self._cache_ttl = 300  # 5 minutes cache TTL

    def get_company_settings(self, company_id: str) -> Dict:
        """
        Fetch company's auto-close settings from database.

        Args:
            company_id: UUID of the company

        Returns:
            Dict with auto_close_days and auto_close_enabled settings.
            Falls back to defaults if system_settings not found.
        """
        # Check cache first
        if company_id in self._settings_cache:
            cached = self._settings_cache[company_id]
            if datetime.now(timezone.utc).timestamp() - cached.get("_cached_at", 0) < self._cache_ttl:
                return cached

        try:
            # Query system_settings table for company-specific settings
            response = self.supabase.table("system_settings").select(
                "auto_close_days, auto_close_enabled, updated_at"
            ).eq("company_id", company_id).single().execute()

            if response.data:
                settings = {
                    "auto_close_days": response.data.get("auto_close_days", self.default_auto_close_days),
                    # Fixes #913: respect the DB value explicitly; default to False (safe/disabled)
                    # so that a missing or unreadable setting never silently auto-closes tickets.
                    "auto_close_enabled": bool(response.data.get("auto_close_enabled", False))
                }
                self._settings_cache[company_id] = settings
                return settings

        except Exception as e:
            logger.warning(f"Could not fetch settings for company {company_id}: {str(e)}. Using defaults.")
        
        # Fall back to safe default: disabled.
        # Fixes #913: previously defaulted to True, which meant a DB failure would
        # silently enable auto-close for all companies regardless of their setting.
        return {
            "auto_close_days": self.default_auto_close_days,
            "auto_close_enabled": False
        }

        # Fall back to defaults (enabled by default)
        default_settings = {
            "auto_close_days": self.default_auto_close_days,
            "auto_close_enabled": True,
            "_cached_at": datetime.now(timezone.utc).timestamp()
        }
        self._settings_cache[company_id] = default_settings
        return default_settings

    def is_auto_close_enabled(self, company_id: str) -> bool:
        """
        Check if auto-close is enabled for a specific company.

        This method reads from the database system_settings table,
        NOT from environment variables.

        Args:
            company_id: UUID of the company

        Returns:
            bool: True if auto-close is enabled for this company
        """
        settings = self.get_company_settings(company_id)
        return settings.get("auto_close_enabled", True)

    def get_auto_close_days(self, company_id: str) -> int:
        """
        Get the auto-close days setting for a specific company.

        Args:
            company_id: UUID of the company

        Returns:
            int: Number of days after which to auto-close resolved tickets
        """
        settings = self.get_company_settings(company_id)
        return settings.get("auto_close_days", self.default_auto_close_days)

    def clear_cache(self):
        """Clear the settings cache."""
        self._settings_cache.clear()
        logger.info("Settings cache cleared")

    def _close_ticket(self, ticket_id: str, company_id: str, stats: Dict) -> bool:
        """
        Update a ticket's status to closed and set auto_closed flag.

        Args:
            ticket_id: UUID of ticket to close
            company_id: UUID of ticket's company
            stats: Statistics dict to track success/failure

        Returns:
            True if successful, False otherwise
        """
        try:
            self.supabase.table("tickets").update({
                "status": "closed",
                "auto_closed": True,
                "closed_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", ticket_id).eq("company_id", company_id).execute()

            stats["closed_count"] += 1
            logger.info(f"Closed ticket {ticket_id} for company {company_id}")
            return True
        except Exception as e:
            stats["error_count"] += 1
            logger.error(f"Failed to close ticket {ticket_id}: {str(e)}")
            return False

    def run(self) -> Dict:
        """
        Execute the auto-close job.

        Process:
        1. Fetch all resolved tickets
        2. Group by company_id
        3. For each company, check auto-close settings from DATABASE
        4. Close tickets older than auto_close_days
        5. Log results and return statistics

        Returns:
            Dict with statistics on processed/closed/error tickets
        """
        stats = {
            "processed_count": 0,
            "closed_count": 0,
            "error_count": 0,
            "skipped_count": 0,
            "companies_processed": 0,
            "companies_disabled": 0
        }

        try:
            logger.info("Starting auto-close job...")

            # Fetch all resolved tickets
            response = self.supabase.table("tickets").select(
                "id, company_id, status, updated_at"
            ).eq("status", "resolved").execute()

            resolved_tickets = response.data if response.data else []
            stats["processed_count"] = len(resolved_tickets)
            logger.info(f"Found {len(resolved_tickets)} resolved tickets")

            if not resolved_tickets:
                logger.info("No resolved tickets to process")
                return stats

            # Group by company
            company_tickets: Dict[str, List] = {}
            for ticket in resolved_tickets:
                company_id = ticket.get("company_id")
                if company_id not in company_tickets:
                    company_tickets[company_id] = []
                company_tickets[company_id].append(ticket)

            # Process each company's tickets
            for company_id, tickets in company_tickets.items():
                stats["companies_processed"] += 1
                
                # Check if auto-close is enabled for this company from DATABASE
                if not self.is_auto_close_enabled(company_id):
                    logger.info(f"Auto-close disabled for company {company_id}, skipping {len(tickets)} tickets")
                    stats["skipped_count"] += len(tickets)
                    stats["companies_disabled"] += 1
                    continue

                auto_close_days = self.get_auto_close_days(company_id)
                cutoff_date = datetime.now(timezone.utc) - timedelta(days=auto_close_days)

                logger.info(f"Processing company {company_id}: auto_close_days={auto_close_days}, cutoff={cutoff_date.isoformat()}")

                # Filter tickets older than cutoff
                for ticket in tickets:
                    try:
                        updated_at_str = ticket.get("updated_at")
                        if not updated_at_str:
                            logger.warning(f"Ticket {ticket['id']} missing updated_at, skipping")
                            continue

                        # Parse ISO format timestamp
                        updated_at = datetime.fromisoformat(updated_at_str.replace("Z", "+00:00"))

                        if updated_at < cutoff_date:
                            self._close_ticket(ticket["id"], company_id, stats)
                        else:
                            stats["skipped_count"] += 1

                    except ValueError as e:
                        logger.error(f"Invalid timestamp for ticket {ticket['id']}: {str(e)}")
                        stats["error_count"] += 1

            logger.info(
                f"Auto-close job completed. Closed: {stats['closed_count']}, "
                f"Skipped: {stats['skipped_count']}, Errors: {stats['error_count']}, "
                f"Companies: {stats['companies_processed']} ({stats['companies_disabled']} disabled)"
            )
            return stats

        except Exception as e:
            logger.error(f"Fatal error in auto-close job: {str(e)}")
            stats["error_count"] += 1
            return stats

    def test_query(self) -> List:
        """
        Debug utility: show resolved tickets that would be affected without making changes.

        Returns:
            List of resolved tickets with company info
        """
        try:
            response = self.supabase.table("tickets").select(
                "id, company_id, status, updated_at, title"
            ).eq("status", "resolved").limit(10).execute()

            tickets = response.data if response.data else []
            logger.info(f"Found {len(tickets)} resolved tickets (sample)")
            
            # Also show company settings for each unique company
            companies = set(t.get("company_id") for t in tickets if t.get("company_id"))
            for company_id in companies:
                settings = self.get_company_settings(company_id)
                logger.info(f"Company {company_id}: enabled={settings.get('auto_close_enabled')}, days={settings.get('auto_close_days')}")
            
            return tickets

        except Exception as e:
            logger.error(f"Error in test_query: {str(e)}")
            return []


# Singleton instance
_instance: Optional[AutoCloseService] = None


def load():
    """Load and return singleton instance of AutoCloseService."""
    global _instance
    if _instance is None:
        _instance = AutoCloseService()
        logger.info(f"AutoCloseService loaded. Schedule: {_instance.cron_schedule}")
    return _instance


def get_instance() -> Optional[AutoCloseService]:
    """Get the singleton instance if already loaded."""
    return _instance
