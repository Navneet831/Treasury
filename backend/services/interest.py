import calendar
import logging
import re
from datetime import datetime, date, timedelta
from typing import Any, Dict, List
import pandas as pd

from apps.Treasury.backend.database import fetch_dict
from apps.Treasury.backend.services.core import ttl_cache

logger = logging.getLogger(__name__)

def parse_date_flexible(val):
    if not val:
        return None
    if isinstance(val, (datetime, date)):
        # Convert date to datetime
        if isinstance(val, date) and not isinstance(val, datetime):
            return datetime(val.year, val.month, val.day)
        return val
    val_str = str(val).strip()
    for fmt in ["%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y", "%Y-%m-%d"]:
        try:
            return datetime.strptime(val_str, fmt)
        except ValueError:
            continue
    return None

def make_month_key(dt):
    return dt.strftime("%b_%y").lower()

def make_month_label(dt):
    return dt.strftime("%b-%y").capitalize()

def get_fy_label(dt):
    if dt.month >= 4:
        return f"{dt.year}-{dt.year + 1 - 2000:02d}"
    else:
        return f"{dt.year - 1}-{dt.year - 2000:02d}"

def is_interest_entry(description):
    desc = str(description).upper()
    keywords = ["INTEREST", " PART PERIOD INTER", "DEBIT INTEREST",
                "INT TRF", "TL INT", "INT REP"]
    return any(kw in desc for kw in keywords)

def is_interest_charged(description):
    desc = str(description).upper()
    return any(kw in desc for kw in ["PART PERIOD INTER", "DEBIT INTEREST"])

def is_interest_recovered(description):
    desc = str(description).upper()
    return any(kw in desc for kw in ["O.S. INTEREST REP", "INT TRF FRM",
                                      "TL INT FOR", "TL INT ", "INT REP",
                                      "INTEREST RECOVERY"])

@ttl_cache(seconds=600)
def discover_months_info():
    """Discover all months, labels, and ranges present in bank statement tables."""
    tables_res = fetch_dict("""
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND (tablename ~ '^[0-9]{6,}' OR tablename ~ '^4[0-9]{5,}')
    """)
    table_names = [t["tablename"] for t in tables_res]
    if not table_names:
        return [], {}, {}

    union_parts = [f'SELECT DISTINCT txn_date as d FROM "{t}"' for t in table_names]
    union_sql = " UNION ALL ".join(union_parts)
    dates_df = fetch_dict(f"SELECT DISTINCT d FROM ({union_sql}) all_dates")

    parsed_dates = []
    for row in dates_df:
        dt = parse_date_flexible(row["d"])
        if dt:
            parsed_dates.append(dt)

    if not parsed_dates:
        return [], {}, {}

    min_dt = min(parsed_dates)
    max_dt = max(parsed_dates)

    months_order = []
    month_ranges = {}
    month_labels = {}

    current = min_dt.replace(day=1)
    end = max_dt

    while current <= end:
        mk = make_month_key(current)
        dt_last = calendar.monthrange(current.year, current.month)[1]
        month_start = current.replace(day=1)
        month_end = current.replace(day=dt_last)

        if mk not in month_ranges:
            months_order.append(mk)
            month_ranges[mk] = (month_start.strftime("%Y-%m-%d"), month_end.strftime("%Y-%m-%d"))
            month_labels[mk] = make_month_label(current)

        if current.month == 12:
            current = current.replace(year=current.year + 1, month=1, day=1)
        else:
            current = current.replace(month=current.month + 1, day=1)

    return months_order, month_labels, month_ranges

@ttl_cache(seconds=300)
def get_interest_summary_data() -> Dict[str, Any]:
    # 1. Load Bank_summary
    accounts_res = fetch_dict("""
        SELECT account_no, table_type, bank_name, description, name, roi
        FROM Bank_summary
        ORDER BY table_type, account_no
    """)

    # 2. Discover months
    months_order, month_labels, month_ranges = discover_months_info()
    if not months_order:
        return {"rows": [], "months": [], "monthLabels": {}, "fyList": []}

    # Get list of public tables to match statements fast
    tables_res = fetch_dict("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
    existing_tables = {t["tablename"] for t in tables_res}

    all_rows = []
    
    for acct_row in accounts_res:
        acct = acct_row["account_no"]
        roi_val = acct_row["roi"]
        
        # Check matching table
        tbl_name = None
        candidates = [acct]
        if acct.startswith("000000"):
            stripped = acct.lstrip("0")
            if stripped:
                candidates.append(stripped)
        else:
            padded = acct.zfill(15)
            candidates.append(padded)

        for c in candidates:
            if c in existing_tables:
                tbl_name = c
                break

        # Load statement data
        stmt_rows = []
        if tbl_name:
            try:
                stmt_rows = fetch_dict(f"""
                    SELECT txn_date, value_date, description,
                           COALESCE(debit, 0) as debit,
                           COALESCE(credit, 0) as credit,
                           balance
                    FROM "{tbl_name}"
                    ORDER BY txn_date, value_date
                """)
            except Exception as e:
                logger.warning(f"Failed to query statement table '{tbl_name}': {e}")

        # Compute metrics per month
        metrics = {}
        if stmt_rows:
            # Parse statement rows
            df_list = []
            for r in stmt_rows:
                parsed_d = parse_date_flexible(r["txn_date"])
                if parsed_d:
                    m_key = make_month_key(parsed_d)
                    df_list.append({
                        "parsed_date": parsed_d,
                        "month_key": m_key,
                        "description": r["description"],
                        "debit": float(r["debit"] or 0),
                        "credit": float(r["credit"] or 0),
                        "balance": float(r["balance"]) if r["balance"] is not None else None
                    })
            
            if df_list:
                df = pd.DataFrame(df_list)
                df["is_interest"] = df["description"].apply(is_interest_entry)
                df["is_interest_charged"] = df["description"].apply(is_interest_charged)
                df["is_interest_recovered"] = df["description"].apply(is_interest_recovered)

                def get_interest_month(row):
                    date_obj = row["parsed_date"]
                    day = date_obj.day
                    if day == 1 and row.get("is_interest", False):
                        prev_month = date_obj.replace(day=1) - timedelta(days=1)
                        return make_month_key(prev_month)
                    return row["month_key"]

                df["interest_month"] = df.apply(get_interest_month, axis=1)

                for mk in months_order:
                    month_data = df[df["month_key"] == mk]
                    if len(month_data) == 0:
                        metrics[mk] = {"opening": None, "closing": None, "int_recovered": 0, "has_data": False}
                        continue

                    int_recovered = df[
                        (df["is_interest_recovered"]) &
                        (df["interest_month"] == mk)
                    ]["credit"].sum()

                    opening = month_data.iloc[0]["balance"]
                    closing = month_data.iloc[-1]["balance"]

                    actual_charged = month_data[month_data["is_interest_charged"]]["debit"].sum()
                    if closing is not None and actual_charged > 0:
                        closing = closing + actual_charged

                    metrics[mk] = {
                        "opening": float(opening) if opening is not None else None,
                        "closing": float(closing) if closing is not None else None,
                        "int_recovered": round(float(int_recovered), 2),
                        "has_data": True
                    }

        # Generate rows
        for mk in months_order:
            m_metric = metrics.get(mk, {"opening": None, "closing": None, "int_recovered": 0, "has_data": False})
            
            # Days in month
            dt = datetime.strptime(mk, "%b_%y")
            days_in_month = calendar.monthrange(dt.year, dt.month)[1]

            opening_bal = m_metric.get("opening")
            closing_bal = m_metric.get("closing")
            int_recovered = m_metric.get("int_recovered", 0)

            # Interest calculation: Simple interest = |Opening Balance| * ROI% / 100 * (days / 365)
            int_calculated = None
            if opening_bal is not None and roi_val is not None:
                principal = abs(opening_bal)
                rate = float(roi_val)
                int_calculated = round((principal * rate / 100) * (days_in_month / 365.0), 2)

            # Variance
            variance = 0.0
            variance_pct = 0.0
            if int_calculated is not None:
                variance = round(int_recovered - int_calculated, 2)
                if int_calculated != 0:
                    variance_pct = round((variance / int_calculated) * 100, 2)
                else:
                    variance_pct = 0.0
            else:
                variance = int_recovered
                variance_pct = 100.0 if int_recovered != 0 else 0.0

            all_rows.append({
                "account": acct,
                "type": acct_row["table_type"],
                "bank": acct_row["bank_name"],
                "month": month_labels[mk],
                "monthKey": mk,
                "fy": get_fy_label(dt),
                "openingBal": opening_bal,
                "closingBal": closing_bal,
                "roi": float(roi_val) if roi_val is not None else None,
                "intRecovered": int_recovered,
                "intCalculated": int_calculated,
                "variance": variance,
                "variancePct": variance_pct,
                "tableFound": True if tbl_name else False,
                "tableName": tbl_name
            })

    # Sort fy list
    fy_list = sorted(list({r["fy"] for r in all_rows}), reverse=True)

    return {
        "rows": all_rows,
        "months": months_order,
        "monthLabels": month_labels,
        "fyList": fy_list
    }
