#!/usr/bin/env python
# NOTE: Filename contains `company_settings`. The script now seeds `system_settings` records
# (columns: `email_notifications`, `admin_alerts`, etc.). Filename was kept for backwards compatibility.
"""
Seed System Settings Script

Initializes default system_settings records for all existing companies in the database.
Run this script after applying the 20260531_add_company_settings.sql migration.

Usage:
    cd backend
    python scripts/seed_company_settings.py
    python scripts/seed_company_settings.py --dry-run   # preview only, no writes

This script:
- Queries unique companies from tickets table (paginated)
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
import argparse
import logging
from datetime import datetime, timezone

from supabase import create_client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="[SeedCompanySettings] %(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Pagination page size (Supabase default max)
PAGE_SIZE = 1000


def _build_client():
    """Build a Supabase client with env-var validation.

    Raises:
        EnvironmentError: If required environment variables are missing.
    """
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    missing = []
    if not url:
        missing.append("SUPABASE_URL")
    if not key:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")

    if missing:
        raise EnvironmentError(
            f"Missing required environment variables: {', '.join(missing)}. "
            "Set them in .env or export them before running this script."
        )

    return create_client(url, key)


def _fetch_all_pages(supabase, table: str, column: str = "*") -> list[dict]:
    """Fetch all rows from a table using range-based pagination.

    Supabase caps responses at 1 000 rows by default.  This helper pages
    through the entire table so no rows are silently dropped.
    """
    all_rows: list[dict] = []
    offset = 0

    while True:
        response = (
            supabase.table(table)
            .select(column)
            .range(offset, offset + PAGE_SIZE - 1)
            .execute()
        )
        page = response.data or []
        all_rows.extend(page)

        if len(page) < PAGE_SIZE:
            # Last page (partial or exact page boundary)
            break
        offset += PAGE_SIZE

    return all_rows


def seed_company_settings(dry_run: bool = False) -> dict:
    """Main function to seed company settings for all companies.

    Args:
        dry_run: If True, log intended inserts without writing to the database.
    """
    supabase = _build_client()

    logger.info("Starting company settings seed script...")
    if dry_run:
        logger.info("[DRY RUN] No database writes will be performed.")

    try:
        # Step 1: Get all unique companies from tickets table (paginated)
        logger.info("Fetching all unique companies from tickets table...")

        all_tickets = _fetch_all_pages(supabase, "tickets", "company_id")

        if not all_tickets:
            logger.warning("No tickets found. Database may be empty.")
            return {"status": "no_tickets", "created_count": 0}

        # Extract unique company IDs
        unique_companies = list({
            t["company_id"]
            for t in all_tickets
            if t.get("company_id")
        })
        logger.info(f"Found {len(unique_companies)} unique companies")

        # Step 2: Get existing system_settings to avoid duplicates (paginated)
        logger.info("Fetching existing system_settings...")

        all_settings = _fetch_all_pages(supabase, "system_settings", "company_id")

        existing_companies = {
            s["company_id"]
            for s in all_settings
            if s.get("company_id")
        }
        logger.info(f"Found {len(existing_companies)} existing system_settings")

        # Step 3: Determine which companies need settings created
        companies_to_create = [c for c in unique_companies if c not in existing_companies]
        logger.info(f"Need to create settings for {len(companies_to_create)} companies")

        if not companies_to_create:
            logger.info("All companies already have settings. Nothing to do.")
            return {"status": "complete", "created_count": 0}

        # Step 4: Build records with explicit created_at timestamp
        now_iso = datetime.now(timezone.utc).isoformat()
        records = [
            {
                "company_id": company_id,
                "auto_close_enabled": True,
                "auto_close_days": 7,
                "email_notifications": True,
                "admin_alerts": True,
                "digest_frequency": "daily",
                "created_at": now_iso,
            }
            for company_id in companies_to_create
        ]

        if dry_run:
            for rec in records:
                logger.info(f"[DRY RUN] Would insert: {rec}")
            logger.info(f"[DRY RUN] Total: {len(records)} records")
            return {"status": "dry_run", "created_count": len(records)}

        # Step 5: Batch insert (single HTTP call)
        logger.info(f"Batch inserting {len(records)} system_settings records...")
        supabase.table("system_settings").insert(records).execute()

        logger.info(f"Seed complete: {len(records)} created")
        logger.info("All company settings successfully created!")
        return {"status": "success", "created_count": len(records)}

    except Exception as e:
        logger.error(f"Fatal error during seed: {str(e)}")
        return {"status": "error", "message": str(e)}


def verify_seed(supabase=None) -> bool:
    """Verify that seed was successful.

    Args:
        supabase: Optional pre-built client. If None, builds one via _build_client().
    """
    if supabase is None:
        supabase = _build_client()

    logger.info("Verifying seed results...")

    try:
        # Paginated fetches
        all_tickets = _fetch_all_pages(supabase, "tickets", "company_id")
        all_settings = _fetch_all_pages(supabase, "system_settings", "company_id")

        companies_count = len({
            t["company_id"]
            for t in all_tickets
            if t.get("company_id")
        })
        settings_count = len({
            s["company_id"]
            for s in all_settings
            if s.get("company_id")
        })

        logger.info(f"Verification: {companies_count} unique companies, {settings_count} system_settings")

        if companies_count == settings_count:
            logger.info("✓ Verification passed: All companies have settings!")
            return True
        else:
            logger.warning(f"✗ Verification failed: {companies_count - settings_count} companies missing settings")
            return False

    except Exception as e:
        logger.error(f"Verification failed: {str(e)}")
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed system_settings for all companies.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be inserted without writing to the database.",
    )
    args = parser.parse_args()

    # Run seed
    result = seed_company_settings(dry_run=args.dry_run)

    # Skip verification on dry run
    if args.dry_run:
        sys.exit(0)

    # Verify
    verified = verify_seed()

    # Exit with appropriate code
    if verified and result.get("status") in ["success", "complete"]:
        logger.info("Seed script completed successfully!")
        sys.exit(0)
    else:
        logger.error("Seed script completed with issues")
        sys.exit(1)
