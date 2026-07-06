"""BOE domain: bill-of-entry bifurcation, aging, status breakdown."""
from typing import Any, Dict

from apps.Treasury.backend.database import fetch_dict
from apps.Treasury.backend.services.core import COL_MAP, get_fy_clause


def get_boe_analytics_data(currency: str = "INR", fy: str = "All", lc_status: str = "Open") -> Dict[str, Any]:
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    pending_col = COL_MAP["boe_pending_inr"] if currency == "INR" else COL_MAP["boe_pending_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    status_filter = "('Open', 'In Process')" if lc_status == "Open" else "('Closed')"

    bifurcation = fetch_dict(f"""
        SELECT
            CASE
                WHEN {COL_MAP['boe_status']} = 'Received' AND {COL_MAP['payment_status']} = 'Paid' THEN 'BOE Received & Paid'
                WHEN {COL_MAP['boe_status']} = 'Received' AND ({COL_MAP['payment_status']} != 'Paid' OR {COL_MAP['payment_status']} IS NULL) THEN 'BOE Received & Unpaid'
                WHEN {COL_MAP['boe_status']} = 'Not Received' OR {COL_MAP['boe_status']} IS NULL THEN 'BOE Not Received'
                WHEN {COL_MAP['boe_status']} = 'Cancelled' THEN 'Cancelled'
                ELSE 'Other'
            END as status_group,
            COUNT(*) as count,
            COALESCE(SUM({amt_col}), 0) as amount
        FROM LC
        WHERE 1=1 AND {COL_MAP['lc_status']} IN {status_filter} {fy_filter}
        GROUP BY 1
    """)
    total_amt = sum(r['amount'] or 0 for r in bifurcation)
    for r in bifurcation:
        r['pct'] = (r['amount'] / total_amt * 100) if total_amt > 0 else 0

    aging = fetch_dict(f"""
        SELECT
            CASE
                WHEN date_diff('day', {COL_MAP['boe_date']}::DATE, CURRENT_DATE) BETWEEN 0 AND 30 THEN '0-30 Days'
                WHEN date_diff('day', {COL_MAP['boe_date']}::DATE, CURRENT_DATE) BETWEEN 31 AND 60 THEN '31-60 Days'
                WHEN date_diff('day', {COL_MAP['boe_date']}::DATE, CURRENT_DATE) BETWEEN 61 AND 90 THEN '61-90 Days'
                WHEN date_diff('day', {COL_MAP['boe_date']}::DATE, CURRENT_DATE) > 90 THEN '90+ Days'
            END as bucket,
            COUNT(*) as count,
            COALESCE(SUM({pending_col}), 0) as value
        FROM LC
        WHERE {COL_MAP['boe_date']} IS NOT NULL
          AND ({COL_MAP['payment_status']} IS NULL OR {COL_MAP['payment_status']} != 'Paid') {fy_filter}
        GROUP BY 1
        ORDER BY bucket
    """)
    aging_buckets = [a for a in aging if a.get('bucket') is not None]

    status_breakdown = fetch_dict(f"""
        SELECT
            COALESCE({COL_MAP['boe_status']}, 'Not Received') as status,
            COUNT(*) as count,
            COALESCE(SUM({pending_col}), 0) as value
        FROM LC
        WHERE 1=1 {fy_filter}
        GROUP BY 1
        ORDER BY value DESC
    """)

    return {
        "bifurcation": bifurcation,
        "total_amount": total_amt,
        "aging_buckets": aging_buckets,
        "status_breakdown": status_breakdown,
    }
