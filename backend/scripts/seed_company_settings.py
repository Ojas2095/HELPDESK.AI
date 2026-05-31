#!/usr/bin/env python
# NOTE: Filename contains `company_settings`. The script now seeds `system_settings` records
# (columns: `email_notifications`, `admin_alerts`, etc.). Filename was kept for backwards compatibility.
"""
Seed System Settings Script

Initializes default system_settings records for all existing companies in the database.
Run this script after applying the 20260531_add_company_settings.sql migration.

Usage:
    cd backend
    python scripts/seed_company_settings.py [--dry-run]

Flags:
    --dry-run   Show what would be inserted without writing to the database.

This script:
- Queries unique companies from tickets table
- Creates default system_settings record for each (batch insert)
- Sets default values:
    - auto_close_enabled: true
    - auto_close_days: 7
    - email_notifications: true
    - admin_alerts: true
    - digest_frequency: 'daily'
"""

import os
import sys
import logging
import argparse
from datetime import datetime, timezone

from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="[SeedCompanySettings] %(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Supabase default page size — requests beyond this need explicit pagination.
_SUPABASE_PAGE_SIZE = 1000

# Default values written into every new system_settings row.
_DEFAULT_SETTINGS = {
    "auto_close_enabled": True,
    "auto_close_days": 7,
    "email_notifications": True,
    "admin_alerts": True,
    "digest_frequency": "daily",
}


# ─── Supabase helpers ─────────────────────────────────────────────────────────

def _build_client() -> Client:
    """Create and return a Supabase client, with a clear error if env vars are missing."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise EnvironmentError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set."
        )
    return create_client(url, key)


def _fetch_all_pages(client: Client, table: str, select: str) -> list[dict]:
    """
    Fetch every row from *table* using range-based pagination.

    Supabase returns at most 1 000 rows per request by default. Without
    pagination, large installations are silently truncated — the original
    script did not paginate, so any database with > 1 000 tickets or
    system_settings rows would produce incomplete results with no error.
    """
    rows: list[dict] = []
    offset = 0
    while True:
        page = (
            client.table(table)
            .select(select)
            .range(offset, offset + _SUPABASE_PAGE_SIZE - 1)
            .execute()
        ).data or []
        rows.extend(page)
        if len(page) < _SUPABASE_PAGE_SIZE:
            break
        offset += _SUPABASE_PAGE_SIZE
    return rows


def _get_unique_company_ids(client: Client) -> set[str]:
    """Return distinct company_ids present in the tickets table."""
    tickets = _fetch_all_pages(client, "tickets", "company_id")
    return {row["company_id"] for row in tickets if row.get("company_id")}


def _get_existing_company_ids(client: Client) -> set[str]:
    """Return company_ids that already have a system_settings row."""
    settings = _fetch_all_pages(client, "system_settings", "company_id")
    return {row["company_id"] for row in settings if row.get("company_id")}


def _build_records(company_ids: list[str]) -> list[dict]:
    """Build insert payload for each company, including an explicit created_at."""
    now = datetime.now(timezone.utc).isoformat()
    return [
        {"company_id": cid, "created_at": now, **_DEFAULT_SETTINGS}
        for cid in company_ids
    ]


# ─── Core logic ───────────────────────────────────────────────────────────────

def seed_company_settings(client: Client, *, dry_run: bool = False) -> dict:
    """Seed default system_settings for every company that does not have one."""

    logger.info(
        "Starting system_settings seed script%s...",
        " (DRY RUN)" if dry_run else "",
    )

    try:
        # Step 1: Unique companies from tickets
        logger.info("Fetching unique company IDs from tickets table...")
        all_company_ids = _get_unique_company_ids(client)

        if not all_company_ids:
            logger.warning("No tickets found. Database may be empty.")
            return {"status": "no_tickets", "created_count": 0}

        logger.info("Found %d unique companies", len(all_company_ids))

        # Step 2: Companies that already have settings
        logger.info("Fetching existing system_settings...")
        existing_ids = _get_existing_company_ids(client)
        logger.info("Found %d existing system_settings rows", len(existing_ids))

        # Step 3: Delta — only companies without settings
        to_create = sorted(all_company_ids - existing_ids)
        logger.info("Need to create settings for %d companies", len(to_create))

        if not to_create:
            logger.info("All companies already have settings. Nothing to do.")
            return {"status": "complete", "created_count": 0}

        # Step 4: Batch insert (single round-trip) instead of per-row loop
        records = _build_records(to_create)

        if dry_run:
            logger.info("[DRY RUN] Would insert %d records:", len(records))
            for rec in records:
                logger.info("  %s", rec)
            return {"status": "dry_run", "created_count": len(records)}

        client.table("system_settings").insert(records).execute()
        logger.info("Batch insert complete: %d records written", len(records))

        return {"status": "success", "created_count": len(records)}

    except Exception as e:
        logger.error("Fatal error during seed: %s", e)
        return {"status": "error", "message": str(e)}


# ─── Verification ─────────────────────────────────────────────────────────────

def verify_seed(client: Client) -> bool:
    """Verify every company in tickets has a system_settings row."""

    logger.info("Verifying seed results...")

    try:
        company_ids = _get_unique_company_ids(client)
        settings_ids = _get_existing_company_ids(client)

        companies_count = len(company_ids)
        settings_count = len(settings_ids & company_ids)

        logger.info(
            "Verification: %d unique companies, %d with system_settings",
            companies_count, settings_count,
        )

        if companies_count == settings_count:
            logger.info("✓ Verification passed: All companies have settings!")
            return True

        logger.warning(
            "✗ Verification failed: %d companies missing settings",
            companies_count - settings_count,
        )
        return False

    except Exception as e:
        logger.error("Verification failed: %s", e)
        return False


# ─── CLI ──────────────────────────────────────────────────────────────────────

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed default system_settings for all companies."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview inserts without writing to the database.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()

    try:
        supabase = _build_client()
    except EnvironmentError as e:
        logger.error(str(e))
        sys.exit(1)

    result = seed_company_settings(supabase, dry_run=args.dry_run)

    if args.dry_run:
        logger.info("Dry-run complete — no data was written.")
        sys.exit(0)

    verified = verify_seed(supabase)

    if verified and result.get("status") in {"success", "complete"}:
        logger.info("Seed script completed successfully!")
        sys.exit(0)
    elif result.get("status") == "no_tickets":
        logger.warning("Nothing seeded — no tickets in database.")
        sys.exit(0)
    else:
        logger.error(
            "Seed script completed with issues (status=%s)", result.get("status")
        )
        sys.exit(1)