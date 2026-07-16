import bisect
import calendar
import functools
import hashlib
import logging
import math
import os
import pickle
import re
import time
from datetime import datetime, date, timedelta
from pathlib import Path
from typing import Any, Dict, List
import pandas as pd

from apps.Treasury.backend.database import fetch_dict, fetch_one

logger = logging.getLogger(__name__)

def clean_float(val):
    if val is None:
        return None
    try:
        f_val = float(val)
        if math.isnan(f_val) or math.isinf(f_val):
            return None
        return f_val
    except (ValueError, TypeError):
        return None

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
        return f"FY{dt.year % 100:02d}-{dt.year + 1 - 2000:02d}"
    else:
        return f"FY{(dt.year - 1) % 100:02d}-{dt.year - 2000:02d}"

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


def _disk_cache(seconds: float = 3600, cache_dir: str = None):
    """File-backed cache decorator. Uses pickle, keyed by fn name + args.
    Falls back to computing if file I/O fails."""
    if cache_dir is None:
        cache_dir = os.path.join(os.path.dirname(__file__), ".cache")
    os.makedirs(cache_dir, exist_ok=True)

    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            key_data = f"{fn.__name__}:{args}:{sorted(kwargs.items())}"
            key_hash = hashlib.sha256(key_data.encode()).hexdigest()[:16]
            cache_path = os.path.join(cache_dir, f"{key_hash}.pkl")
            now = time.time()
            # Check valid cache
            try:
                if os.path.exists(cache_path):
                    mtime = os.path.getmtime(cache_path)
                    if now - mtime < seconds:
                        with open(cache_path, "rb") as f:
                            val = pickle.load(f)
                            logger.debug("Disk cache HIT for %s (key=%s)", fn.__name__, key_hash)
                            return val
            except Exception:
                pass
            # Compute
            val = fn(*args, **kwargs)
            try:
                with open(cache_path, "wb") as f:
                    pickle.dump(val, f)
                logger.debug("Disk cache STORE for %s (key=%s)", fn.__name__, key_hash)
            except Exception as e:
                logger.warning("Disk cache write failed for %s: %s", fn.__name__, e)
            return val
        return wrapper
    return decorator

def discover_months_info():
    """Discover all months, labels, and ranges present in bank statement tables.
    Uses fast per-table MIN/MAX queries instead of a massive UNION ALL."""
    t0 = time.time()
    tables_res = fetch_dict("""
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND (tablename ~ '^[0-9]{6,}' OR tablename ~ '^4[0-9]{5,}')
    """)
    table_names = [t["tablename"] for t in tables_res]
    if not table_names:
        return [], {}, {}

    # Fast path: query MIN/MAX per table instead of UNION ALL over all rows
    min_date = None
    max_date = None
    for tbl in table_names:
        try:
            row = fetch_one(f'SELECT MIN(TO_DATE(txn_date, \'DD/MM/YYYY\')), MAX(TO_DATE(txn_date, \'DD/MM/YYYY\')) FROM "{tbl}"')
            if row:
                dmin, dmax = row
                dmin_dt = parse_date_flexible(dmin)
                dmax_dt = parse_date_flexible(dmax)
                if dmin_dt and (min_date is None or dmin_dt < min_date):
                    min_date = dmin_dt
                if dmax_dt and (max_date is None or dmax_dt > max_date):
                    max_date = dmax_dt
        except Exception:
            pass

    if not min_date or not max_date:
        return [], {}, {}

    logger.info("discover_months_info: %d tables scanned in %.2fs", len(table_names), time.time() - t0)

    months_order = []
    month_ranges = {}
    month_labels = {}

    current = min_date.replace(day=1)
    end = max_date

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

def get_daily_balances_for_month(stmt_rows: List[Dict[str, Any]], year: int, month: int, days_in_month: int) -> List[float]:
    # Parse dates first and sort statement rows stably by date
    parsed_rows = []
    for r in stmt_rows:
        parsed_d = parse_date_flexible(r["txn_date"])
        if parsed_d:
            parsed_rows.append((parsed_d, r))
    parsed_rows.sort(key=lambda x: x[0])

    # Group statement rows by transaction date (date -> last balance)
    date_balances = {}
    for parsed_d, r in parsed_rows:
        d_key = parsed_d.date()
        date_balances[d_key] = float(r["balance"]) if r["balance"] is not None else None

    # Sort all unique transaction dates once, outside the day loop
    sorted_tx_dates = sorted(date_balances.keys())

    daily_balances = []
    for d in range(1, days_in_month + 1):
        day_date = date(year, month, d)

        last_bal = 0.0
        if day_date in date_balances and date_balances[day_date] is not None:
            last_bal = date_balances[day_date]
        else:
            # Binary search: find the insertion point for day_date, then step back one
            # to get the most recent transaction date strictly before day_date — O(log n)
            idx = bisect.bisect_left(sorted_tx_dates, day_date) - 1
            if idx >= 0:
                pred_date = sorted_tx_dates[idx]
                last_bal = date_balances[pred_date] if date_balances[pred_date] is not None else 0.0
            else:
                # No transaction has occurred yet; fall back to the earliest known balance
                if sorted_tx_dates:
                    last_bal = date_balances[sorted_tx_dates[0]] if date_balances[sorted_tx_dates[0]] is not None else 0.0
                else:
                    last_bal = 0.0
        daily_balances.append(last_bal)
    return daily_balances

def get_interest_summary_data(fy: str = None) -> Dict[str, Any]:
    t_start = time.time()
    logger.info("get_interest_summary_data(fy=%s) START", fy)

    # 1. Load Bank_summary
    accounts_res = fetch_dict("""
        SELECT account_no, table_type, bank_name, description, name, period, roi
        FROM bank_summary
        ORDER BY table_type, account_no
    """)
    logger.info("Loaded %d account periods in %.2fs", len(accounts_res), time.time() - t_start)

    # De-duplicate accounts to get unique account metadata and build monthly ROI map
    seen_accts = set()
    unique_accounts = []
    roi_map = {}
    for r in accounts_res:
        acct = r["account_no"]
        if acct not in seen_accts:
            seen_accts.add(acct)
            unique_accounts.append({
                "account_no": acct,
                "table_type": r["table_type"],
                "bank_name": r["bank_name"],
                "description": r["description"],
                "name": r["name"]
            })
        
        # Build monthly ROI mapping
        period_val = r["period"]
        roi_val = float(r["roi"]) if r["roi"] is not None else 0.0
        if period_val:
            m_key = period_val.strftime("%b_%y").lower() if hasattr(period_val, "strftime") else str(period_val)
            roi_map[(acct, m_key)] = roi_val

    # 2. Discover months
    months_order, month_labels, month_ranges = discover_months_info()
    if not months_order:
        return {"rows": [], "months": [], "monthLabels": {}, "fyList": []}

    # Get list of public tables to match statements fast
    tables_res = fetch_dict("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
    existing_tables = {t["tablename"] for t in tables_res}

    # Pre-compute FY for every month key to support partitioned loading
    month_fy_map = {}
    for mk in months_order:
        dt = datetime.strptime(mk, "%b_%y")
        month_fy_map[mk] = get_fy_label(dt)

    # Determine which months to process (filter by FY if specified)
    active_months = months_order
    if fy:
        active_months = [mk for mk in months_order if month_fy_map.get(mk) == fy]

    # Parse FY into date range for SQL WHERE clause
    fy_date_start = None
    fy_date_end = None
    if fy and '-' in fy:
        try:
            # Clean 'FY' prefix if present, and handle 2-digit/4-digit years
            clean_fy = fy[2:] if fy.startswith("FY") else fy
            parts = clean_fy.split('-')
            start_yr = int(parts[0])
            if start_yr < 100:
                start_year = 2000 + start_yr
            else:
                start_year = start_yr
            end_year_str = parts[1]
            if len(end_year_str) == 2:
                end_year = 2000 + int(end_year_str)
            else:
                end_year = int(end_year_str)
            fy_date_start = f"{start_year}-04-01"
            fy_date_end = f"{end_year}-03-31"
            logger.debug("FY date range: %s to %s", fy_date_start, fy_date_end)
        except (ValueError, IndexError):
            pass

    # Compute full FY list from all months (so FY picker shows all options)
    fy_list = sorted(set(month_fy_map.values()), reverse=True)

    all_rows = []
    
    for acct_row in unique_accounts:
        acct = acct_row["account_no"]
        
        try:
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
                    """)
                except Exception as e:
                    logger.warning(f"Failed to query statement table '{tbl_name}': {e}")
                    # Brief pause so the remote server can recover before the next table query
                    import time as _time
                    _time.sleep(0.5)

            # Compute metrics per month
            metrics = {}
            if stmt_rows:
                # Parse statement rows
                df_list = []
                for idx, r in enumerate(stmt_rows):
                    try:
                        parsed_d = parse_date_flexible(r["txn_date"])
                        if parsed_d:
                            m_key = make_month_key(parsed_d)
                            df_list.append({
                                "original_index": idx,
                                "parsed_date": parsed_d,
                                "month_key": m_key,
                                "description": str(r.get("description", "")),
                                "debit": float(r.get("debit", 0) or 0),
                                "credit": float(r.get("credit", 0) or 0),
                                "balance": float(r["balance"]) if r.get("balance") is not None else None
                            })
                    except Exception:
                        continue  # skip malformed row
                
                if df_list:
                    df = pd.DataFrame(df_list)
                    df = df.sort_values(["parsed_date", "original_index"]).reset_index(drop=True)
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

                    # Pre-compute daily balance mapping for carrying forward balances when no transactions occur
                    parsed_rows = []
                    for r in stmt_rows:
                        parsed_d = parse_date_flexible(r["txn_date"])
                        if parsed_d:
                            parsed_rows.append((parsed_d, r))
                    parsed_rows.sort(key=lambda x: x[0])
                    date_balances = {}
                    for parsed_d, r in parsed_rows:
                        d_key = parsed_d.date()
                        date_balances[d_key] = float(r["balance"]) if r.get("balance") is not None else None
                    sorted_tx_dates = sorted(date_balances.keys())

                    # Only compute metrics for active (requested) months
                    for mk in active_months:
                        try:
                            month_data = df[df["month_key"] == mk]
                            if len(month_data) == 0:
                                # Carry forward the last known balance before this month
                                dt_start = datetime.strptime(mk, "%b_%y")
                                start_date = dt_start.date()
                                idx = bisect.bisect_left(sorted_tx_dates, start_date) - 1
                                carried_bal = 0.0
                                if idx >= 0:
                                    carried_bal = date_balances[sorted_tx_dates[idx]] or 0.0
                                elif sorted_tx_dates:
                                    carried_bal = date_balances[sorted_tx_dates[0]] or 0.0
                                metrics[mk] = {
                                    "opening": carried_bal,
                                    "closing": carried_bal,
                                    "int_recovered": 0.0,
                                    "has_data": False
                                }
                                continue

                            recovered_df = df[(df["is_interest_recovered"]) & (df["interest_month"] == mk)]
                            int_recovered = (recovered_df["credit"] + recovered_df["debit"]).sum()

                            opening = month_data.iloc[0]["balance"]
                            raw_closing = month_data.iloc[-1]["balance"]

                            # Adjust closing balance to exclude interest amount effect
                            actual_charged = month_data[month_data["is_interest_charged"]]["debit"].sum()
                            actual_recovered = month_data[month_data["is_interest_recovered"]]["credit"].sum()
                            adjusted_closing = raw_closing
                            if raw_closing is not None:
                                adjusted_closing = raw_closing + actual_charged

                            metrics[mk] = {
                                "opening": float(opening) if opening is not None else None,
                                "closing": float(adjusted_closing) if adjusted_closing is not None else None,
                                "int_recovered": round(float(int_recovered), 2),
                                "actual_charged": round(float(actual_charged), 2),
                                "actual_recovered": round(float(actual_recovered), 2),
                                "raw_closing": float(raw_closing) if raw_closing is not None else None,
                                "has_data": True
                            }
                        except Exception:
                            continue  # skip month on error
        except Exception as e:
            logger.warning(f"Failed to process account '{acct}': {e}")
            continue  # skip account on error

        # Generate rows (only for active months = filtered by FY)
        for mk in active_months:
            m_metric = metrics.get(mk, {"opening": None, "closing": None, "int_recovered": 0, "has_data": False})
            
            # Days in month
            dt = datetime.strptime(mk, "%b_%y")
            days_in_month = calendar.monthrange(dt.year, dt.month)[1]

            opening_bal = m_metric.get("opening")
            closing_bal = m_metric.get("closing")
            int_recovered = m_metric.get("int_recovered", 0)

            # Get the monthly ROI from our map (with fallback)
            roi_val = roi_map.get((acct, mk))
            if roi_val is None:
                fallback_rois = [v for k, v in roi_map.items() if k[0] == acct]
                roi_val = fallback_rois[0] if fallback_rois else 0.0

            # Interest calculation: Daily balance method
            int_calculated = None
            daily_bals = []
            if roi_val is not None:
                rate = float(roi_val)
                if stmt_rows:
                    daily_bals = get_daily_balances_for_month(stmt_rows, dt.year, dt.month, days_in_month)
                    daily_interests = [abs(bal) * (rate / 100.0) / 365.0 for bal in daily_bals]
                    int_calculated = round(sum(daily_interests), 2)
                else:
                    if opening_bal is not None:
                        principal = abs(opening_bal)
                        int_calculated = round((principal * rate / 100) * (days_in_month / 365.0), 2)
                    else:
                        int_calculated = 0.0

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

            # Build calc breakdown
            actual_charged = m_metric.get("actual_charged", 0)
            actual_recovered = m_metric.get("actual_recovered", 0)
            raw_closing = m_metric.get("raw_closing")
            daily_bal_count = len(daily_bals)
            avg_daily_bal = clean_float(sum(daily_bals) / len(daily_bals)) if daily_bals else None
            calc_breakdown = {
                "daysInMonth": days_in_month,
                "actualCharged": clean_float(actual_charged),
                "actualRecovered": clean_float(actual_recovered),
                "rawClosingBal": clean_float(raw_closing),
                "adjustedClosingBal": clean_float(closing_bal),
                "dailyBalCount": daily_bal_count,
                "avgDailyBalance": avg_daily_bal,
                "openingBalUsed": clean_float(opening_bal),
                "roiUsed": clean_float(roi_val)
            }

            all_rows.append({
                "account": acct,
                "type": acct_row["table_type"],
                "bank": acct_row["bank_name"],
                "month": month_labels[mk],
                "monthKey": mk,
                "fy": get_fy_label(dt),
                "openingBal": clean_float(opening_bal),
                "closingBal": clean_float(closing_bal),
                "roi": clean_float(roi_val),
                "intRecovered": clean_float(int_recovered),
                "intCalculated": clean_float(int_calculated),
                "variance": clean_float(variance),
                "variancePct": clean_float(variance_pct),
                "tableFound": True if tbl_name else False,
                "tableName": tbl_name,
                "calcBreakdown": calc_breakdown
            })

    logger.info("get_interest_summary_data(fy=%s) DONE: %d rows in %.2fs",
                fy, len(all_rows), time.time() - t_start)
    # Return metadata + filtered rows
    return {
        "rows": all_rows,
        "months": active_months if fy else months_order,
        "monthLabels": month_labels,
        "fyList": fy_list
    }
