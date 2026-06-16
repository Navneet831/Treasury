"""Executive domain: overview KPIs and the command-center aggregate."""
from typing import Any, Dict, List, Optional

from apps.Treasury.backend.database import fetch_dict, fetch_one
from apps.Treasury.backend.services.core import (
    COL_MAP, get_current_date, get_fy_clause, ttl_cache,
)
from apps.Treasury.backend.services.boe import get_boe_analytics_data
from apps.Treasury.backend.services.lc import get_lc_exposure_data
from apps.Treasury.backend.services.sblc import get_sblc_module_data


def get_currency_breakdown(query_base: str, params: Optional[List[Any]] = None) -> List[Dict[str, Any]]:
    rows = fetch_dict(query_base, params)
    return [r for r in rows if r.get('Currency') != 'INR']


@ttl_cache(seconds=60)
def get_executive_overview_data(currency: str = "INR", fy: str = "All", lc_status: str = "Open") -> Dict[str, Any]:
    cd = get_current_date()
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    
    if lc_status == "Open":
        status_filter = "('Open', 'In Process')"
    elif lc_status == "Closed":
        status_filter = "('Closed')"
    else:
        status_filter = "('Open', 'In Process', 'Closed')"

    limits = fetch_dict("""
        SELECT
            CAST(NULLIF(REPLACE("LC", ',', ''), '') AS DOUBLE) as lc_limit,
            CAST(NULLIF(REPLACE("SBLC", ',', ''), '') AS DOUBLE) as sblc_limit,
            CAST(NULLIF(REPLACE("Cash", ',', ''), '') AS DOUBLE) as cash_limit
        FROM bank_limit WHERE Bank_Table = 'Bank' AND Element != ''
    """)
    total_nfb_limit = sum((r['lc_limit'] or 0) for r in limits) if limits else 0
    total_sblc_limit = sum((r['sblc_limit'] or 0) for r in limits) if limits else 0
    total_fb_limit = sum((r['cash_limit'] or 0) for r in limits) if limits else 0

    boe_col = COL_MAP["boe_bill_inr"] if currency == "INR" else COL_MAP["boe_bill_fc"]
    lc_stats_res = fetch_one(f"""
        SELECT
            SUM(CASE WHEN UPPER({COL_MAP['bank']}) IN ('BOI', 'IDBI') 
                     THEN (CASE WHEN {COL_MAP['lc_status']} = 'Open' AND Margin = 0.1 THEN COALESCE({boe_col}, 0) ELSE 0 END)
                     ELSE {amt_col} END) as total_lc_exposure,
            SUM(CASE WHEN {COL_MAP['lc_status']} = 'Open' THEN {COL_MAP['margin_fd']} ELSE 0 END) as margin_fd,
            SUM(CASE WHEN "Type" != 'Unhedged' THEN {amt_col} ELSE 0 END) as hedged_amt,
            SUM(CASE WHEN {COL_MAP['lc_status']} = 'In Process' THEN 
                (CASE WHEN UPPER({COL_MAP['bank']}) IN ('BOI', 'IDBI') THEN 0 ELSE {amt_col} END)
            ELSE 0 END) as lc_in_process
        FROM LC WHERE {COL_MAP['lc_status']} IN {status_filter} {fy_filter}
    """)
    lc_stats = lc_stats_res if lc_stats_res else (0, 0, 0, 0)
    total_lc_exposure = lc_stats[0] if lc_stats[0] is not None else 0
    working_capital_frozen = lc_stats[1] if lc_stats[1] is not None else 0
    hedged_amt = lc_stats[2] if lc_stats[2] is not None else 0
    lc_in_process = lc_stats[3] if lc_stats[3] is not None else 0

    sblc_stats_res = fetch_one(f"""
        SELECT SUM({amt_col}) as sblc_outstanding
        FROM LC WHERE "SBLC Status" LIKE 'Yes%' AND {COL_MAP['lc_status']} = 'Open' {fy_filter}
    """)
    total_sblc_exposure = sblc_stats_res[0] if sblc_stats_res and sblc_stats_res[0] is not None else 0

    available_cash = total_fb_limit
    available_lc_limit = max(0, total_nfb_limit - total_lc_exposure)
    available_sblc_limit = max(0, total_sblc_limit - total_sblc_exposure)
    total_util_pct = (total_lc_exposure / total_nfb_limit * 100) if total_nfb_limit > 0 else 0
    hedged_pct = (hedged_amt / total_lc_exposure * 100) if total_lc_exposure > 0 else 0
    unhedged_pct = 100 - hedged_pct if total_lc_exposure > 0 else 0

    u30_res = fetch_one(f"""
        SELECT SUM({amt_col}) FROM LC
        WHERE {COL_MAP['due_date']} BETWEEN '{cd}' AND '{cd}'::DATE + INTERVAL 30 DAY
        AND ({COL_MAP['payment_status']} IS NULL OR {COL_MAP['payment_status']} != 'Paid')
        {get_fy_clause(fy, COL_MAP['due_date'])}
    """)
    upcoming_30_days = u30_res[0] if u30_res and u30_res[0] is not None else 0

    breakdowns = {}
    if currency == 'FC':
        breakdowns['total_lc_exposure'] = get_currency_breakdown(f"""
            SELECT {COL_MAP['currency']} as Currency, SUM({COL_MAP['amt_fc']}) as value
            FROM LC WHERE {COL_MAP['lc_status']} IN ('Open', 'In Process') {fy_filter}
            GROUP BY 1
        """)
        breakdowns['upcoming_30d'] = get_currency_breakdown(f"""
            SELECT {COL_MAP['currency']} as Currency, SUM({COL_MAP['amt_fc']}) as value
            FROM LC WHERE {COL_MAP['due_date']} BETWEEN '{cd}' AND '{cd}'::DATE + INTERVAL 30 DAY
            AND ({COL_MAP['payment_status']} IS NULL OR {COL_MAP['payment_status']} != 'Paid')
            {get_fy_clause(fy, COL_MAP['due_date'])}
            GROUP BY 1
        """)
        breakdowns['working_capital_frozen'] = get_currency_breakdown(f"""
            SELECT {COL_MAP['currency']} as Currency, SUM({COL_MAP['margin_fd']}) as value
            FROM LC WHERE {COL_MAP['lc_status']} = 'Open' {fy_filter}
            GROUP BY 1
        """)

    return {
        "kpis": {
            "available_cash": available_cash,
            "available_lc_limit": available_lc_limit,
            "available_sblc_limit": available_sblc_limit,
            "total_nfb_limit": total_nfb_limit,
            "total_fb_limit": total_fb_limit,
            "total_utilization_pct": total_util_pct,
            "total_lc_exposure": total_lc_exposure,
            "lc_in_process": lc_in_process,
            "total_sblc_exposure": total_sblc_exposure,
            "working_capital_frozen": working_capital_frozen,
            "hedged_pct": hedged_pct,
            "unhedged_pct": unhedged_pct,
            "upcoming_30d": upcoming_30_days,
            "breakdowns": breakdowns if breakdowns else None
        },
        "insights": [
            f"{currency} {upcoming_30_days:,.0f} in payments due within the next 30 days." if upcoming_30_days > 0 else "No payments due in next 30 days.",
            f"Limit utilization stands at {total_util_pct:.1f}%."
        ]
    }


@ttl_cache(seconds=60)
def get_command_data(currency: str = "INR", fy: str = "All", payment_status: str = "Unpaid", facility_type: str = "LC", lc_status: str = "Open") -> Dict[str, Any]:
    cd, amt_col = get_current_date(), COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
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

    fy_filter += fac_filter
    
    exec_d, exp_d, boe_d, sblc_d = get_executive_overview_data(currency, fy, lc_status), get_lc_exposure_data(currency, fy), get_boe_analytics_data(currency, fy), get_sblc_module_data(currency, fy)
    kpis = exec_d['kpis']

    # Define limit_map for pivots
    limits = fetch_dict("""
        SELECT TRIM(Element) as bank, CAST(NULLIF(REPLACE("LC", ',', ''), '') AS DOUBLE) as limit_amt
        FROM bank_limit WHERE Bank_Table = 'Bank' AND Element != '' AND Element IS NOT NULL
    """)
    limit_map = {r['bank']: r['limit_amt'] or 0 for r in limits}
    bank_limit_summary = [{"bank": b, "limit": l} for b, l in limit_map.items()]

    overdue = fetch_one(f"""
        SELECT COUNT(*), SUM({amt_col})
        FROM LC
        WHERE {COL_MAP['due_date']} < '{cd}'
          AND ({COL_MAP['payment_status']} IS NULL OR {COL_MAP['payment_status']} != 'Paid')
          AND {COL_MAP['lc_status']} IN {status_filter}
          {fac_filter}
    """)
    due_7d = fetch_one(f"""
        SELECT COUNT(*), SUM({amt_col})
        FROM LC
        WHERE {COL_MAP['due_date']} BETWEEN '{cd}' AND '{cd}'::DATE + INTERVAL 7 DAY
          AND ({COL_MAP['payment_status']} IS NULL OR {COL_MAP['payment_status']} != 'Paid')
          AND {COL_MAP['lc_status']} IN {status_filter}
          {fac_filter}
    """)

    # ── Product-Bank Pivot ──────────────────────────────────────────────────
    if payment_status == "Paid":
        pay_cond = f"{COL_MAP['payment_status']} = 'Paid'"
    elif payment_status == "Unpaid":
        pay_cond = f"({COL_MAP['payment_status']} != 'Paid' OR {COL_MAP['payment_status']} IS NULL)"
    else:
        pay_cond = "1=1"
    
    boe_amt_col = COL_MAP["boe_pending_inr"] if currency == "INR" else COL_MAP["boe_pending_fc"]
    boe_bill_col = COL_MAP["boe_bill_inr"] if currency == "INR" else COL_MAP["boe_bill_fc"]
    product_unpaid_raw = fetch_dict(f"""
        SELECT
            COALESCE(TRIM("Product Name"), 'Unknown') as product,
            COALESCE(TRIM("Type"), 'Unknown') as type,
            TRIM({COL_MAP['bank']}) as bank,
            SUM(CASE WHEN UPPER({COL_MAP['bank']}) IN ('BOI', 'IDBI') 
                     THEN (CASE WHEN {COL_MAP['lc_status']} = 'Open' AND Margin = 0.1 THEN COALESCE({boe_bill_col}, 0) ELSE 0 END)
                     ELSE COALESCE({boe_amt_col}, {amt_col}, 0) END) as value
        FROM LC
        WHERE {pay_cond}
          AND {COL_MAP['lc_status']} IN {status_filter}
          {get_fy_clause(fy, COL_MAP['due_date'])}
          {fac_filter}
        GROUP BY 1, 2, 3
    """)

    product_list = sorted(list(set((r['product'], r['type']) for r in product_unpaid_raw)))
    product_unpaid_pivot = []
    for p, t in product_list:
        row = {"product": p, "type": t}
        for b in limit_map.keys():
            row[b] = sum(r['value'] for r in product_unpaid_raw if r['product'] == p and r['type'] == t and r['bank'] == b)
        product_unpaid_pivot.append(row)

    # ── BOE Status-Bank Pivot ────────────────────────────────────────────────
    boe_bill_amt_col = COL_MAP["boe_bill_inr"] if currency == "INR" else COL_MAP["boe_bill_fc"]
    boe_status_bank_raw = fetch_dict(f"""
        SELECT
            {COL_MAP['lc_status']} as lc_status,
            COALESCE({COL_MAP['boe_status']}, 'Not Received') as boe_status,
            COALESCE({COL_MAP['payment_status']}, 'Unpaid') as payment_status,
            TRIM({COL_MAP['bank']}) as bank,
            SUM(CASE WHEN UPPER({COL_MAP['bank']}) IN ('BOI', 'IDBI') 
                     THEN (CASE WHEN Margin = 0.1 THEN COALESCE({boe_bill_amt_col}, 0) ELSE 0 END)
                     ELSE COALESCE({boe_bill_amt_col}, 0) END) as value
        FROM LC WHERE 1=1 {fy_filter}
        GROUP BY 1, 2, 3, 4
    """)

    status_pairs = sorted(list(set((r['boe_status'], r['payment_status']) for r in boe_status_bank_raw)))
    boe_status_bank_pivot = []
    boe_status_bank_pivot_closed = []
    boe_status_bank_pivot_all = []
    boe_bank_pivot = {}
    
    for boe_st, pay_st in status_pairs:
        row_open = {"boe_status": boe_st, "payment_status": pay_st}
        row_closed = {"boe_status": boe_st, "payment_status": pay_st}
        row_all = {"boe_status": boe_st, "payment_status": pay_st}
        
        key = (boe_st, pay_st)
        if key not in boe_bank_pivot:
            boe_bank_pivot[key] = {"boe_status": boe_st, "payment_status": pay_st}
            
        for b in limit_map.keys():
            val_open = sum(r['value'] for r in boe_status_bank_raw if r['boe_status'] == boe_st and r['payment_status'] == pay_st and r['bank'] == b and r['lc_status'] in ('Open', 'In Process'))
            val_closed = sum(r['value'] for r in boe_status_bank_raw if r['boe_status'] == boe_st and r['payment_status'] == pay_st and r['bank'] == b and r['lc_status'] == 'Closed')
            val_all = sum(r['value'] for r in boe_status_bank_raw if r['boe_status'] == boe_st and r['payment_status'] == pay_st and r['bank'] == b)
            
            row_open[b] = val_open
            row_closed[b] = val_closed
            row_all[b] = val_all
            boe_bank_pivot[key][b] = val_open
            
        boe_status_bank_pivot.append(row_open)
        boe_status_bank_pivot_closed.append(row_closed)
        boe_status_bank_pivot_all.append(row_all)

    margin_bank_rows = fetch_dict(f"""
        SELECT
            {COL_MAP['bank']} as bank,
            COUNT(*) as lc_count,
            AVG(Margin) as avg_margin_pct,
            SUM({COL_MAP['margin_fd']}) as total_margin_fd
        FROM LC
        WHERE {COL_MAP['lc_status']} = 'Open' {fy_filter}
        GROUP BY 1
    """)

    return {"summary": {"total_nfb_limit": kpis['total_nfb_limit'], "limit_utilization_pct": kpis['total_utilization_pct'], "available_balance": kpis['available_lc_limit'], "total_lc_exposure": kpis['total_lc_exposure'], "lc_in_process": kpis.get('lc_in_process', 0), "sblc_outstanding": kpis['total_sblc_exposure'], "working_capital_frozen": kpis['working_capital_frozen'], "upcoming_30d": kpis['upcoming_30d'], "overdue_count": int(overdue[0] or 0), "overdue_amount": float(overdue[1] or 0), "due_7d_count": int(due_7d[0] or 0), "due_7d_amount": float(due_7d[1] or 0)},
            "bank_wise": [{"bank": b['bank'], "lc_outstanding": b['utilized'], "margin_fd": b.get('margin_fd') or 0, "utilization_pct": b['utilization_pct']} for b in exp_d['bank_wise']],
            "margin_wise": [{"margin_pct": m['margin_pct'], "exposure": m['exposure']} for m in exp_d['margin_wise']],
            "boe_status_wise": [{"boe_status": b['status_group'], "count": b.get('count', 0), "value": b['amount']} for b in boe_d['bifurcation']],
            "hedging_wise": [{"type": "Hedged", "value": kpis['total_lc_exposure'] * (kpis['hedged_pct'] / 100)}, {"type": "Unhedged", "value": kpis['total_lc_exposure'] * (kpis['unhedged_pct'] / 100)}],
            "bank_limit_summary": bank_limit_summary,
            "boe_bank_wise": [row for row in boe_bank_pivot.values()],
            "margin_bank_wise": [{'bank': r['bank'], 'lc_count': int(r['lc_count'] or 0), 'avg_margin_pct': float(r['avg_margin_pct'] or 0), 'total_margin_fd': round(float(r['total_margin_fd'] or 0), 2)} for r in margin_bank_rows],
            "product_unpaid_pivot": product_unpaid_pivot,
            "boe_status_bank_pivot": boe_status_bank_pivot,
            "boe_status_bank_pivot_closed": boe_status_bank_pivot_closed,
            "boe_status_bank_pivot_all": boe_status_bank_pivot_all,
            "banks_list": sorted(list(limit_map.keys()))}
