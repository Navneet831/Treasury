"""Limits domain: bank-wise limit utilisation, pivots, and prioritized treasury actions."""
from datetime import date
from typing import Any, Dict, List

from apps.Treasury.backend.database import fetch_dict
from apps.Treasury.backend.services.core import COL_MAP, get_fy_clause, ttl_cache
from apps.Treasury.backend.services.fd_bg import get_bg_module_data, get_fd_module_data
from apps.Treasury.backend.services.fx import get_fx_risk_data


@ttl_cache(seconds=60)
def get_limit_utilisation_data(currency: str = "INR", fy: str = "All", payment_status: str = "Unpaid", facility_type: str = "LC", lc_status: str = "Open") -> Dict[str, Any]:
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    
    # Facility filter for LC table
    if facility_type == "SBLC":
        fac_filter = " AND \"SBLC Status\" LIKE 'Yes%'"
    elif facility_type == "CASH":
        fac_filter = " AND (\"Product Name\" LIKE '%CASH%' OR \"Type\" LIKE '%CASH%')"
    else:
        fac_filter = " AND (\"SBLC Status\" NOT LIKE 'Yes%' OR \"SBLC Status\" IS NULL) AND (\"Product Name\" NOT LIKE '%CASH%' OR \"Product Name\" IS NULL)"

    if lc_status == "Open":
        status_filter = "('Open', 'In Process')"
    elif lc_status == "Closed":
        status_filter = "('Closed')"
    else:
        status_filter = "('Open', 'In Process', 'Closed')"
    
    boe_col = COL_MAP["boe_bill_inr"] if currency == "INR" else COL_MAP["boe_bill_fc"]
    bank_data = fetch_dict(f"""SELECT LC.{COL_MAP['bank']} as bank, COUNT(*) as lc_count,
                               SUM(CASE WHEN LC.{COL_MAP['lc_status']} = 'Open' AND Margin = 0.1 THEN 
                                   (CASE WHEN UPPER(LC.{COL_MAP['bank']}) IN ('BOI', 'IDBI') THEN COALESCE(LC.{boe_col}, 0) ELSE LC.{amt_col} END)
                               ELSE 0 END) as lc_open,
                               SUM(CASE WHEN LC.{COL_MAP['lc_status']} = 'In Process' AND Margin = 0.1 THEN 
                                   (CASE WHEN UPPER(LC.{COL_MAP['bank']}) IN ('BOI', 'IDBI') THEN 0 ELSE LC.{amt_col} END)
                               ELSE 0 END) as lc_in_process,
                               COALESCE(MAX(CAST(NULLIF(REPLACE(bank_limit."LC", ',', ''), '') AS DOUBLE)), 0) as max_limit,
                               MAX(CAST(NULLIF(REPLACE(bank_limit."SBLC", ',', ''), '') AS DOUBLE)) as sblc_limit,
                               MAX(CAST(NULLIF(REPLACE(bank_limit."Cash", ',', ''), '') AS DOUBLE)) as cash_limit
                               FROM LC LEFT JOIN bank_limit ON TRIM(UPPER(LC.{COL_MAP['bank']})) = TRIM(UPPER(bank_limit.Element)) AND bank_limit.Bank_Table = 'Bank'
                               WHERE LC.{COL_MAP['lc_status']} IN {status_filter} AND LC.{COL_MAP['bank']} IS NOT NULL {fy_filter} GROUP BY 1 ORDER BY max_limit DESC""")

    # ── Margin-Bank Pivot (LC Exposure) ──────────────────────────────────────
    margin_bank_raw = fetch_dict(f"""
        SELECT {COL_MAP['bank']} as bank, Margin as margin_pct, 
               SUM(CASE WHEN UPPER({COL_MAP['bank']}) IN ('BOI', 'IDBI') 
                        THEN (CASE WHEN {COL_MAP['lc_status']} = 'Open' AND Margin = 0.1 THEN COALESCE({boe_col}, 0) ELSE 0 END)
                        ELSE {amt_col} END) as value 
        FROM LC WHERE {COL_MAP['lc_status']} IN {status_filter} {fy_filter} {fac_filter} GROUP BY 1, 2
    """)

    # Include LC in Process from the separate "LC BG in Process" table
    if facility_type == "LC" and lc_status == "Open":
        inprocess_amt_col = '"AMT IN INR"' if currency == "INR" else '"Amt in FC"'
        inprocess_margin_raw = fetch_dict(f"""
            SELECT "Bank Name" as bank, COALESCE(MRGIN, 0.1) as margin_pct,
                   SUM(CASE WHEN UPPER("Bank Name") IN ('BOI', 'IDBI') THEN 0 ELSE {inprocess_amt_col} END) as value
            FROM "LC BG in Process"
            WHERE "STATUS" = 'DOC SUBMITTED TO BANK' AND UPPER(Type) = 'LC'
            GROUP BY 1, 2
        """)
        margin_bank_raw.extend(inprocess_margin_raw)

    banks_list = sorted(list(set(r['bank'] for r in bank_data)))
    margins_list = sorted(list(set(r['margin_pct'] for r in margin_bank_raw if r['margin_pct'] is not None)))
    margin_bank_pivot = []
    for m in margins_list:
        row = {"margin": m}
        for b in banks_list: row[b] = sum(r['value'] for r in margin_bank_raw if r['bank'] == b and r['margin_pct'] == m)
        margin_bank_pivot.append(row)

    # ── Margin-Bank BOE Pivot ────────────────────────────────────────────────
    boe_amt_col = COL_MAP["boe_bill_inr"] if currency == "INR" else COL_MAP["boe_bill_fc"]
    pay_cond = f"{COL_MAP['payment_status']} = 'Paid'" if payment_status == "Paid" else f"({COL_MAP['payment_status']} != 'Paid' OR {COL_MAP['payment_status']} IS NULL)"
    boe_margin_raw = fetch_dict(f"""
        SELECT {COL_MAP['bank']} as bank, Margin as margin_pct, 
               SUM(CASE WHEN UPPER({COL_MAP['bank']}) IN ('BOI', 'IDBI') 
                        THEN (CASE WHEN {COL_MAP['lc_status']} = 'Open' AND Margin = 0.1 THEN COALESCE({boe_col}, 0) ELSE 0 END)
                        ELSE COALESCE({boe_amt_col}, {amt_col}) END) as value
        FROM LC WHERE {COL_MAP['boe_status']} = 'Received' AND {pay_cond} {fy_filter} {fac_filter}
        GROUP BY 1, 2
    """)
    boe_margin_pivot = []
    for m in margins_list:
        row = {"margin": m}
        for b in banks_list: row[b] = sum(r['value'] for r in boe_margin_raw if r['bank'] == b and r['margin_pct'] == m)
        boe_margin_pivot.append(row)

    sblc_data_res = fetch_dict("""
        SELECT
            "BANK" as bank,
            SUM(CASE WHEN "Payment Status" != 'Paid' OR "Payment Status" IS NULL THEN "Final PAYMENT AMT INR" ELSE 0 END) as sblc_used
        FROM SBLC
        GROUP BY 1
    """)
    sblc_map = {r['bank']: r['sblc_used'] for r in sblc_data_res}
    # LC In Process: sourced from the "LC BG in Process" table (docs submitted to bank, not yet drawn)
    inprocess_amt_col = '"AMT IN INR"' if currency == "INR" else '"Amt in FC"'
    inprocess_res = fetch_dict(f"""
        SELECT "Bank Name" as bank, SUM({inprocess_amt_col}) as amt
        FROM "LC BG in Process"
        WHERE "STATUS" = 'DOC SUBMITTED TO BANK'
        GROUP BY 1
    """)
    inprocess_map = {r['bank']: (r['amt'] or 0) for r in inprocess_res}
    total_max, total_used, total_sblc = 0, 0, 0
    for row in bank_data:
        lc_open = row.get('lc_open', 0)
        # For BOI/IDBI, we strictly follow the BOE Bill Amt rule for Open LCs. 
        # In Process from any source is zeroed.
        if row['bank'].upper() in ('BOI', 'IDBI'):
            lc_in_process = 0
        else:
            lc_in_process = inprocess_map.get(row['bank'], 0)
        
        used = lc_open  # utilization reflects drawn (Open) LCs only; in-process is informational
        
        # Total Limit = LC Pot + Cash Limit
        limit_pot = row.get('max_limit', 0)
        cash_lim = row.get('cash_limit', 0) or 0
        limit = limit_pot + cash_lim
        
        sblc_used = sblc_map.get(row['bank'], 0)
        row.update({
            'used_limit': used,
            'lc_open': lc_open,
            'lc_in_process': lc_in_process,
            'utilization_pct': round(used / max(limit, 1) * 100, 1),
            'available_limit': max(0, limit - used),
            'sblc_utilization': sblc_used,
            'sblc_limit': row.get('sblc_limit'),
            'cash_limit': row.get('cash_limit'),
            'cash_utilization': 0,
            'interchangeability_limit': limit_pot, # keep original pot name for frontend logic
            'sblc_balance': max(0, limit - used)
        })
        total_max += limit; total_used += used; total_sblc += sblc_used
    total_bg = get_bg_module_data()['outstanding']
    return {"bank_utilization": bank_data, "margin_bank_pivot": margin_bank_pivot, "boe_margin_pivot": boe_margin_pivot, "banks_list": banks_list,
            "portfolio_summary": {"total_limit": total_max, "total_used": total_used, "total_sblc": total_sblc, "total_available": max(0, total_max - total_used), "overall_utilization_pct": round(total_used / max(total_max, 1) * 100, 1)},
            "waterfall": [{"label": "Total NFB Limit", "value": total_max}, {"label": "LC Exposure", "value": -total_used}, {"label": "BG Exposure", "value": -total_bg}, {"label": "Available Limit", "value": total_max - total_used - total_bg}]}


def get_treasury_actions() -> List[Dict[str, Any]]:
    actions, cd = [], date.today()
    util = get_limit_utilisation_data()
    for b in util['bank_utilization']:
        if b['utilization_pct'] > 90: actions.append({"priority": 1, "type": "Limit Breach Risk", "message": f"Bank {b['bank']} utilization is at {b['utilization_pct']:.1f}%. Action required to shift exposure.", "bank": b['bank']})
    upcoming_payments = fetch_dict(f"SELECT {COL_MAP['lc_no']} as id, {COL_MAP['supplier']} as supplier, {COL_MAP['due_date']} as date, {COL_MAP['amt_inr']} as amount FROM LC WHERE {COL_MAP['due_date']} BETWEEN '{cd.isoformat()}' AND '{cd.isoformat()}'::DATE + INTERVAL 7 DAY AND ({COL_MAP['payment_status']} != 'Paid' OR {COL_MAP['payment_status']} IS NULL)")
    for p in upcoming_payments: actions.append({"priority": 2, "type": "Payment Due", "message": f"Payment of {p['amount']:,.0f} for {p['supplier']} is due on {p['date']}.", "id": p['id']})
    for m in get_fd_module_data()['maturity']:
        if m['bucket'] == "7 Days" and m['value'] > 0: actions.append({"priority": 3, "type": "FD Maturity", "message": f"FDs worth {m['value']:,.0f} are maturing within 7 days. Plan reinvestment or payout."})
    fx = get_fx_risk_data()
    if fx['alert']: actions.append({"priority": 4, "type": "FX Exposure Risk", "message": fx['alert']})
    return sorted(actions, key=lambda x: x['priority'])
