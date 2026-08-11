"""SBLC domain: standby LC exposure and bank-wise dues."""
from typing import Any, Dict

from apps.Treasury.backend.database import fetch_dict, fetch_one
from apps.Treasury.backend.services.core import COL_MAP, get_current_date, get_fy_clause, _table_exists


def get_sblc_module_data(currency: str = "INR", fy: str = "All") -> Dict[str, Any]:
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    cd = get_current_date()

    sblc_count = fetch_one("SELECT COUNT(*) FROM sblc")[0] if _table_exists("sblc") else 0

    if sblc_count > 0:
        metrics = fetch_dict(f"""
            SELECT
                SUM(CASE WHEN payment_status != 'Paid' OR payment_status IS NULL THEN boe_bill_amt_inr ELSE 0 END) as outstanding,
                SUM(CASE WHEN payment_status = 'Paid' THEN boe_bill_amt_inr ELSE 0 END) as paid,
                SUM(CASE WHEN "sblc_lc_payment_due_date" >= '{cd}' THEN boe_bill_amt_inr ELSE 0 END) as due,
                SUM(boe_bill_amt_inr) as exposure
            FROM sblc
        """)[0]

        bank_wise = fetch_dict(f"""
            SELECT
                bank as bank,
                SUM(CASE WHEN payment_status != 'Paid' OR payment_status IS NULL THEN boe_bill_amt_inr ELSE 0 END) as outstanding,
                SUM(CASE WHEN "sblc_lc_payment_due_date" BETWEEN '{cd}' AND '{cd}'::DATE + INTERVAL 7 DAY THEN boe_bill_amt_inr ELSE 0 END) as due_7d,
                SUM(CASE WHEN "sblc_lc_payment_due_date" BETWEEN '{cd}' AND '{cd}'::DATE + INTERVAL 30 DAY THEN boe_bill_amt_inr ELSE 0 END) as due_30d
            FROM sblc
            GROUP BY 1
        """)
    else:
        metrics = fetch_dict(f"""
            SELECT
                SUM(CASE WHEN ({COL_MAP['payment_status']} != 'Paid' OR {COL_MAP['payment_status']} IS NULL) AND {COL_MAP['lc_status']} = 'Open' THEN {amt_col} ELSE 0 END) as outstanding,
                SUM(CASE WHEN {COL_MAP['payment_status']} = 'Paid' THEN {amt_col} ELSE 0 END) as paid,
                SUM(CASE WHEN {COL_MAP['due_date']} >= '{cd}' AND {COL_MAP['lc_status']} = 'Open' THEN {amt_col} ELSE 0 END) as due,
                SUM({amt_col}) as exposure
            FROM lc
            WHERE "sblc_status" LIKE 'Yes%' {fy_filter}
        """)[0]

        bank_wise = fetch_dict(f"""
            SELECT
                {COL_MAP['bank']} as bank,
                SUM(CASE WHEN ({COL_MAP['payment_status']} != 'Paid' OR {COL_MAP['payment_status']} IS NULL) AND {COL_MAP['lc_status']} = 'Open' THEN {amt_col} ELSE 0 END) as outstanding,
                SUM(CASE WHEN {COL_MAP['due_date']} BETWEEN '{cd}' AND '{cd}'::DATE + INTERVAL 7 DAY AND {COL_MAP['lc_status']} = 'Open' THEN {amt_col} ELSE 0 END) as due_7d,
                SUM(CASE WHEN {COL_MAP['due_date']} BETWEEN '{cd}' AND '{cd}'::DATE + INTERVAL 30 DAY AND {COL_MAP['lc_status']} = 'Open' THEN {amt_col} ELSE 0 END) as due_30d
            FROM lc
            WHERE "sblc_status" LIKE 'Yes%' {fy_filter}
            GROUP BY 1
        """)

    return {
        "metrics": metrics,
        "bank_wise": bank_wise
    }
