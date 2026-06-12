"""AI Copilot: deterministic intent router over warehouse data. No generation —
every answer is a SQL result with a computed narrative, so it is always auditable."""
from typing import Any, Dict

from apps.Treasury.backend.database import fetch_dict
from apps.Treasury.backend.services.core import (
    COL_MAP, _UNPAID, _due_amount_expr, _fmt_cr, _limit_exposure_snapshot,
)


def process_ai_query(query: str) -> Dict[str, Any]:
    q = (query or "").lower()
    due, st = COL_MAP["due_date"], COL_MAP["lc_status"]
    due_amt = _due_amount_expr("INR")
    base_cols = (f"{COL_MAP['lc_no']} as lc_no, {COL_MAP['bank']} as bank, "
                 f"{COL_MAP['supplier']} as supplier, {due} as due_date, {due_amt} as amount")

    if "bank" in q and ("unpaid" in q or "outstanding" in q or "total" in q):
        data = fetch_dict(f"""
            SELECT {COL_MAP['bank']} as bank, COUNT(*) as bills, SUM({due_amt}) as unpaid_amount
            FROM LC WHERE {_UNPAID} AND {st} NOT IN ('Closed', 'Cancelled')
            GROUP BY 1 ORDER BY 3 DESC
        """)
        total = sum(float(r["unpaid_amount"] or 0) for r in data)
        return {"answer": f"Unpaid obligations across {len(data)} banks total {_fmt_cr(total)}.", "data": data}

    if "overdue" in q:
        data = fetch_dict(f"""
            SELECT {base_cols} FROM LC
            WHERE {due} < CURRENT_DATE AND {_UNPAID} AND {st} NOT IN ('Closed', 'Cancelled')
            ORDER BY {due} LIMIT 50
        """)
        total = sum(float(r["amount"] or 0) for r in data)
        return {"answer": f"{len(data)} overdue bills totalling {_fmt_cr(total)}.", "data": data}

    if "unpaid" in q or "bills" in q:
        data = fetch_dict(f"""
            SELECT {base_cols} FROM LC
            WHERE {_UNPAID} AND {st} NOT IN ('Closed', 'Cancelled') AND {due} IS NOT NULL
            ORDER BY {due} LIMIT 50
        """)
        total = sum(float(r["amount"] or 0) for r in data)
        return {"answer": f"{len(data)} unpaid bills totalling {_fmt_cr(total)}, ordered by due date.", "data": data}

    if "expir" in q:
        data = fetch_dict(f"""
            SELECT {COL_MAP['lc_no']} as lc_no, {COL_MAP['bank']} as bank,
                   {COL_MAP['supplier']} as supplier, {COL_MAP['expiry_date']} as expiry_date,
                   {COL_MAP['amt_inr']} as amount
            FROM LC
            WHERE {st} = 'Open'
              AND {COL_MAP['expiry_date']} BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL 60 DAY
            ORDER BY {COL_MAP['expiry_date']} LIMIT 50
        """)
        return {"answer": f"{len(data)} open LCs expire within 60 days.", "data": data}

    if "upcoming" in q or "due" in q or "payment" in q or "obligation" in q:
        data = fetch_dict(f"""
            SELECT {base_cols} FROM LC
            WHERE {due} BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL 30 DAY
              AND {_UNPAID} AND {st} NOT IN ('Closed', 'Cancelled')
            ORDER BY {due} LIMIT 50
        """)
        total = sum(float(r["amount"] or 0) for r in data)
        return {"answer": f"{len(data)} payments totalling {_fmt_cr(total)} fall due in the next 30 days.", "data": data}

    if "utiliz" in q or "limit" in q:
        snap = _limit_exposure_snapshot()
        return {
            "answer": (f"LC exposure is {_fmt_cr(snap['exposure'])} against a sanctioned NFB limit of "
                       f"{_fmt_cr(snap['nfb_limit'])} — {snap['utilization_pct']:.1f}% utilised, "
                       f"{_fmt_cr(snap['remaining_limit'])} headroom."),
            "data": [snap],
        }

    return {
        "answer": ("I can answer questions about: unpaid bills, overdue bills, bank-wise unpaid totals, "
                   "expiring LCs, upcoming payment obligations, and limit utilization."),
        "data": None,
    }
