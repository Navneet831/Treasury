#!/usr/bin/env python3
"""Investigate whether account 00000041973511184 exists in the DB."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "apps.Treasury.backend.settings")

import django
django.setup()

from apps.Treasury.backend.database import fetch_dict

account = "00000041973511184"

# 1. Check bank_summary
rows = fetch_dict("SELECT * FROM bank_summary WHERE account_no = %s", [account])
print(f"=== bank_summary rows for {account}: {len(rows)} ===")
for r in rows:
    print(r)

# 2. Check statement tables
tables = fetch_dict(
    "SELECT tablename FROM pg_tables WHERE schemaname='treasury' AND tablename IN (%s, %s)",
    [account, "41973511184"]
)
print(f"\n=== Statement tables found: {len(tables)} ===")
for t in tables:
    print(t["tablename"])

# 3. Show all CC accounts in bank_summary
cc = fetch_dict(
    "SELECT DISTINCT account_no, table_type, roi FROM bank_summary WHERE table_type = 'CC' ORDER BY account_no"
)
print(f"\n=== CC accounts in bank_summary: {len(cc)} ===")
for r in cc:
    print(r)

# 4. Check what tables exist that start with 4197
tbls = fetch_dict(
    "SELECT tablename FROM pg_tables WHERE schemaname='treasury' AND tablename LIKE '4197%%'"
)
print(f"\n=== Tables starting with 4197: {len(tbls)} ===")
for t in tbls:
    print(t["tablename"])
