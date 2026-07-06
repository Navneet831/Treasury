"""Payables domain: aging risk buckets and the forward cash-flow forecast."""
import statistics
from typing import Any, Dict, List

from apps.Treasury.backend.database import fetch_dict
from apps.Treasury.backend.services.core import (
    COL_MAP, _UNPAID, _due_amount_expr, get_current_date, get_fy_clause,
)


def get_payables_risk_data(currency: str = "INR", fy: str = "All") -> Dict[str, Any]:
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['due_date'])
    cd = get_current_date()
    query = f"""
        SELECT
            CASE
                WHEN date_diff('day', '{cd}'::DATE, {COL_MAP['due_date']}) BETWEEN 0 AND 7 THEN '0-7 days'
                WHEN date_diff('day', '{cd}'::DATE, {COL_MAP['due_date']}) BETWEEN 8 AND 15 THEN '8-15 days'
                WHEN date_diff('day', '{cd}'::DATE, {COL_MAP['due_date']}) BETWEEN 16 AND 30 THEN '16-30 days'
                WHEN date_diff('day', '{cd}'::DATE, {COL_MAP['due_date']}) > 30 THEN '30+ days'
                WHEN date_diff('day', '{cd}'::DATE, {COL_MAP['due_date']}) < 0 THEN 'Overdue'
                ELSE 'Unknown'
            END as category,
            SUM({amt_col}) as amount,
            COUNT(*) as count
        FROM LC
        WHERE ({COL_MAP['payment_status']} != 'Paid' OR {COL_MAP['payment_status']} IS NULL)
          AND {COL_MAP['due_date']} IS NOT NULL {fy_filter}
        GROUP BY 1
    """
    categories = fetch_dict(query)
    risk_flags = fetch_dict(f"""
        SELECT
            CASE
                WHEN "Type" = 'Unhedged' AND {COL_MAP['currency']} != 'INR' THEN 'Red'
                WHEN {COL_MAP['boe_status']} != 'Received' OR {COL_MAP['boe_status']} IS NULL THEN 'Amber'
                WHEN {COL_MAP['payment_status']} = 'Paid' THEN 'Green'
                ELSE 'Neutral'
            END as flag,
            COUNT(*) as count,
            SUM({amt_col}) as amount
        FROM LC
        WHERE {COL_MAP['lc_status']} = 'Open' {get_fy_clause(fy, COL_MAP['op_date'])}
        GROUP BY 1
    """)
    return {"categories": categories, "risk_flags": risk_flags}


def get_cash_flow_forecast_data(currency: str = "INR", fy: str = "All") -> List[Dict[str, Any]]:
    due, ps = COL_MAP["due_date"], COL_MAP["payment_status"]
    due_amt = _due_amount_expr(currency)
    fy_filter = get_fy_clause(fy, due)
    rows = fetch_dict(f"""
        SELECT date_trunc('month', {due}) as m, SUM({due_amt}) as v, COUNT(*) as n
        FROM LC
        WHERE CAST({due} AS DATE) >= date_trunc('month', CURRENT_DATE)
          AND {_UNPAID}
          AND {COL_MAP['lc_status']} NOT IN ('Closed', 'Cancelled') {fy_filter}
        GROUP BY 1 ORDER BY 1
    """)
    history = fetch_dict(f"""
        SELECT date_trunc('month', {due}) as m, SUM({due_amt}) as v
        FROM LC WHERE {due} IS NOT NULL GROUP BY 1
    """)
    monthly_totals = [float(h["v"] or 0) for h in history]
    sigma = statistics.stdev(monthly_totals) if len(monthly_totals) > 1 else 0.0
    out, cumulative = [], 0.0
    for r in rows:
        value = float(r["v"] or 0)
        cumulative += value
        out.append({
            "month": r["m"].strftime("%b %Y"),
            "monthly_value": value,
            "lc_count": int(r["n"] or 0),
            "confidence_upper": value + 1.645 * sigma,
            "confidence_lower": max(0.0, value - 1.645 * sigma),
            "cumulative_value": cumulative,
        })
    return out
