import pytest
from datetime import datetime, date

# ─── Daily breakdown: opening balance derivation ──────────────────────────────

def test_daily_breakdown_opening_balance(datalogic):
    """Verify Day 1 opening derivation.

    - If the first day has interest entries (prior-month adjustments): opening = raw balance.
    - Otherwise: opening = reverse first day's transactions (first_bal + first_dr - first_cr).
    """
    from apps.Treasury.backend.database import fetch_dict
    from apps.Treasury.backend.services.interest import (
        get_daily_breakdown, parse_date_flexible, is_interest_entry,
    )

    # Find a CC account with statement data via the interest summary
    res = datalogic.get_interest_summary_data()
    cc_rows = [r for r in res["rows"] if r["type"] == "CC" and r["tableFound"] and r["tableName"]]
    assert cc_rows, "No CC account with statement data found"

    for row in cc_rows:
        tbl_name = row["tableName"]
        acct = row["account"]
        mk = row["monthKey"]  # e.g. "apr_26"

        # Parse month key
        month_dt = datetime.strptime(mk, "%b_%y")
        y, m = month_dt.year, month_dt.month

        # Fetch raw statement rows for this account/month
        # Check if id column exists
        col_check = fetch_dict(f"""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = '{tbl_name}' AND column_name = 'id'
            AND table_schema = 'treasury'
        """)
        has_id = len(col_check) > 0
        order_by = "ORDER BY txn_date ASC, id ASC" if has_id else "ORDER BY txn_date ASC"

        stmt = fetch_dict(f"""
            SELECT txn_date, description, COALESCE(debit,0) as debit,
                   COALESCE(credit,0) as credit, balance
            FROM "{tbl_name}"
            {order_by}
        """)
        month_rows = []
        for r in stmt:
            pd = parse_date_flexible(r["txn_date"])
            if pd and pd.year == y and pd.month == m:
                month_rows.append(r)

        if not month_rows:
            continue

        # Get first-day rows to determine derivation mode
        first_date = parse_date_flexible(month_rows[0]["txn_date"]).date()
        first_day_rows = [r for r in month_rows
                          if parse_date_flexible(r["txn_date"]).date() == first_date]

        # Check if first day has interest entries (prior-month adjustments)
        first_day_has_interest = any(
            is_interest_entry(str(r.get("description", "")))
            for r in first_day_rows
        )

        # Compute expected opening based on whether interest entries exist
        last_of_first_day = first_day_rows[-1]
        fb = float(last_of_first_day["balance"]) if last_of_first_day["balance"] is not None else 0.0

        if first_day_has_interest:
            # Exception: opening = raw balance (no reversal)
            expected_opening = round(fb, 2)
        else:
            fdr = sum(float(r.get("debit", 0) or 0) for r in first_day_rows)
            fcr = sum(float(r.get("credit", 0) or 0) for r in first_day_rows)
            expected_opening = round(fb + fdr - fcr, 2)

        # Get daily breakdown from the function under test
        bd = get_daily_breakdown(acct, mk)
        assert bd, f"Empty breakdown for {acct} {mk}"

        d1 = bd[0]
        assert d1["day"] == 1
        assert abs(d1["opening"] - expected_opening) < 0.01, (
            f"{acct} {mk}: Day 1 opening {d1['opening']} != expected {expected_opening} "
            f"(fb={fb})"
        )


# ─── Daily breakdown: opening carry-forward ───────────────────────────────────

def test_daily_breakdown_opening_carry_forward(datalogic):
    """Opening = previous day's rawClosing (raw data carries forward)."""
    from apps.Treasury.backend.database import fetch_dict
    from apps.Treasury.backend.services.interest import get_daily_breakdown

    res = datalogic.get_interest_summary_data()
    cc_rows = [r for r in res["rows"] if r["type"] == "CC" and r["tableFound"]]

    for row in cc_rows[:3]:  # test up to 3 accounts
        bd = get_daily_breakdown(row["account"], row["monthKey"])
        if not bd:
            continue

        for i in range(1, len(bd)):
            # Opening of day i+1 = rawClosing of day i
            assert abs(bd[i]["opening"] - bd[i-1]["rawClosing"]) < 0.01, (
                f"{row['account']} {row['monthKey']}: Day {bd[i]['day']} opening "
                f"{bd[i]['opening']} != Day {bd[i-1]['day']} rawClosing {bd[i-1]['rawClosing']}"
            )


# ─── Daily breakdown: closing = rawClosing + cumIntCharged ────────────────────

def test_daily_breakdown_closing_adjustment(datalogic):
    """For every day: closing == rawClosing + cumIntCharged."""
    from apps.Treasury.backend.services.interest import get_daily_breakdown

    res = datalogic.get_interest_summary_data()
    cc_rows = [r for r in res["rows"] if r["type"] == "CC" and r["tableFound"]]
    assert cc_rows, "No CC accounts with data"

    for row in cc_rows:
        bd = get_daily_breakdown(row["account"], row["monthKey"])
        if not bd:
            continue

        for d in bd:
            expected = round(d["rawClosing"] + d["cumIntCharged"], 2)
            assert abs(d["closing"] - expected) < 0.01, (
                f"{row['account']} {row['monthKey']} Day {d['day']}: "
                f"closing={d['closing']} != rawClosing({d['rawClosing']}) + cumIntCharged({d['cumIntCharged']}) = {expected}"
            )


# ─── Daily breakdown: cumIntCharged is monotonically increasing ───────────────

def test_daily_breakdown_cumulative_monotonic(datalogic):
    """cumIntCharged should never decrease across days."""
    from apps.Treasury.backend.services.interest import get_daily_breakdown

    res = datalogic.get_interest_summary_data()
    cc_rows = [r for r in res["rows"] if r["type"] == "CC" and r["tableFound"]]

    for row in cc_rows:
        bd = get_daily_breakdown(row["account"], row["monthKey"])
        if not bd:
            continue

        prev = -1.0
        for d in bd:
            assert d["cumIntCharged"] >= prev - 0.01, (
                f"{row['account']} {row['monthKey']}: cumIntCharged decreased from "
                f"{prev} to {d['cumIntCharged']} on day {d['day']}"
            )
            prev = d["cumIntCharged"]


# ─── Daily breakdown: cumIntCharged matches actual charged in stmt rows ───────

def test_daily_breakdown_cum_total_matches_charged(datalogic):
    """Final cumIntCharged should equal total is_interest_charged debits for the month."""
    from apps.Treasury.backend.database import fetch_dict
    from apps.Treasury.backend.services.interest import (
        get_daily_breakdown, parse_date_flexible, is_interest_charged
    )
    from datetime import datetime

    res = datalogic.get_interest_summary_data()
    cc_rows = [r for r in res["rows"] if r["type"] == "CC" and r["tableFound"] and r["tableName"]]

    for row in cc_rows:
        tbl_name = row["tableName"]
        mk = row["monthKey"]
        month_dt = datetime.strptime(mk, "%b_%y")

        stmt = fetch_dict(f'SELECT txn_date, description, COALESCE(debit,0) as debit FROM "{tbl_name}"')
        total_charged = 0.0
        for r in stmt:
            if not is_interest_charged(r["description"]):
                continue
            pd = parse_date_flexible(r["txn_date"])
            if pd and pd.year == month_dt.year and pd.month == month_dt.month:
                total_charged += float(r["debit"] or 0)

        bd = get_daily_breakdown(row["account"], mk)
        if not bd:
            continue

        final_cum = bd[-1]["cumIntCharged"]
        assert abs(final_cum - total_charged) < 0.01, (
            f"{row['account']} {mk}: final cumIntCharged {final_cum} != "
            f"total charged {total_charged}"
        )


# ─── Daily breakdown: interest on adjusted closing ────────────────────────────

def test_daily_breakdown_interest_on_adjusted_closing(datalogic):
    """Daily interest should be computed on negative adjusted_closing using ROI/365."""
    from apps.Treasury.backend.services.interest import get_daily_breakdown

    res = datalogic.get_interest_summary_data()
    cc_rows = [r for r in res["rows"] if r["type"] == "CC" and r["tableFound"] and r["roi"]]

    for row in cc_rows:
        rate = float(row["roi"])
        if rate <= 0:
            continue
        bd = get_daily_breakdown(row["account"], row["monthKey"])
        if not bd:
            continue

        for d in bd:
            if d["closing"] < 0:
                expected_int = round(abs(d["closing"]) * (rate / 100.0) / 365.0, 2)
                assert abs(d["interest"] - expected_int) < 0.01, (
                    f"{row['account']} {row['monthKey']} Day {d['day']}: "
                    f"interest {d['interest']} != expected {expected_int} "
                    f"(closing={d['closing']}, rate={rate})"
                )
            else:
                assert d["interest"] == 0.0, (
                    f"{row['account']} {row['monthKey']} Day {d['day']}: "
                    f"non-negative closing {d['closing']} but interest={d['interest']}"
                )


# ─── Daily breakdown: rawClosing matches statement balance for transaction days ─

def test_daily_breakdown_raw_closing_matches_statement(datalogic):
    """On transaction days, rawClosing should equal the last transaction balance."""
    from apps.Treasury.backend.database import fetch_dict
    from apps.Treasury.backend.services.interest import (
        get_daily_breakdown, parse_date_flexible
    )
    from datetime import datetime

    res = datalogic.get_interest_summary_data()
    cc_rows = [r for r in res["rows"] if r["type"] == "CC" and r["tableFound"] and r["tableName"]]

    for row in cc_rows:
        tbl_name = row["tableName"]
        mk = row["monthKey"]
        month_dt = datetime.strptime(mk, "%b_%y")

        col_check = fetch_dict(f"""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = '{tbl_name}' AND column_name = 'id'
            AND table_schema = 'treasury'
        """)
        has_id = len(col_check) > 0
        order_by = "ORDER BY txn_date ASC, id ASC" if has_id else "ORDER BY txn_date ASC"
        stmt = fetch_dict(f'SELECT txn_date, description, balance FROM "{tbl_name}" {order_by}')
        
        # Group by date -> last balance
        from collections import OrderedDict
        day_balances = {}
        for r in stmt:
            pd = parse_date_flexible(r["txn_date"])
            if pd and pd.year == month_dt.year and pd.month == month_dt.month:
                day_balances[pd.date()] = float(r["balance"]) if r["balance"] is not None else None

        bd = get_daily_breakdown(row["account"], mk)
        if not bd:
            continue

        for d in bd:
            d_date = date(month_dt.year, month_dt.month, d["day"])
            if d_date in day_balances and day_balances[d_date] is not None:
                expected_raw = day_balances[d_date]
                assert abs(d["rawClosing"] - expected_raw) < 0.01, (
                    f"{row['account']} {mk} Day {d['day']}: rawClosing {d['rawClosing']} "
                    f"!= statement balance {expected_raw}"
                )
