import math
from datetime import date, datetime, timedelta
from typing import Dict, List, Any, Optional
from apps.Treasury.backend.database import fetch_dict, fetch_one, get_polars_df

COL_MAP = {
    "amt_inr": '"LC Amt (in INR)"',
    "amt_fc": '"Final LC Amt (in FC)"',
    "boe_pending_inr": '"Pending BOE Amt (in INR)"',
    "boe_pending_fc": '"Pending BOE Amt (in FC)"',
    "boe_bill_inr": '"BOE Bill Amt (in INR)"',
    "boe_bill_fc": '"BOE Bill Amt (in FC)"',
    "lc_status": '"LC Status"',
    "bank": '"Bank Name"',
    "supplier": '"Supplier Name"',
    "due_date": '"LC Payment Due Date"',
    "expiry_date": '"LC EXPIRY DATE"',
    "op_date": '"LC Op. Date"',
    "boe_status": '"BOE Status"',
    "payment_status": '"Payment Status"',
    "shipment_date": '"LC SHIPMENT DATE"',
    "lc_no": '"LC no."',
    "boe_date": '"Date of Bill of Entry Submitted to Bank"',
    "limit_avail": '"LC Limit Available"',
    "margin_fd": '"Margin FD Made"',
    "tolerance": '"Tolerance Amt /Reduction Amt"',
    "currency": '"Currency"',
    "material_date": '"Material Receipt Date"',
    "bill_lodge": '"Bill Lodge date"',
    "bill_accept": '"Bill Acceptance date"',
    "docs_received": '"DOCUMENTS RECEIVED"',
    "rate": '"RATE"',
    "lc_close_date": '"LC Close date"',
}

def get_current_date() -> str:
    return date.today().isoformat()

def get_fy_clause(fy: str, date_col: str) -> str:
    fy_map = {
        "FY24-25": ("2024-04-01", "2025-03-31"),
        "FY25-26": ("2025-04-01", "2026-03-31"),
        "FY26-27": ("2026-04-01", "2027-03-31"),
    }
    if fy in fy_map:
        start, end = fy_map[fy]
        return f" AND {date_col} >= '{start}' AND {date_col} <= '{end}'"
    return ""

def sanitize_string(val: Optional[str]) -> str:
    if val is None: return ""
    return val.replace("'", "''")

# ══════════════════════════════════════════════════════════
# PAGE 1 — Executive Overview
# ══════════════════════════════════════════════════════════

def get_currency_breakdown(query_base: str, params: Optional[List[Any]] = None) -> List[Dict[str, Any]]:
    rows = fetch_dict(query_base, params)
    return [r for r in rows if r.get('Currency') != 'INR']

def get_executive_overview_data(currency: str = "INR", fy: str = "All") -> Dict[str, Any]:
    cd = get_current_date()
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])

    limits = fetch_dict("""
        SELECT CAST(NULLIF(REPLACE("Limit", ',', ''), '') AS DOUBLE) as limit_amt
        FROM DD WHERE Table_8 = 'Bank' AND Element_8 != ''
    """)
    total_nfb_limit = sum((r['limit_amt'] or 0) for r in limits) if limits else 0
    total_fb_limit = 0 

    lc_stats_res = fetch_one(f"""
        SELECT
            SUM({amt_col}) as total_lc_exposure,
            SUM(CASE WHEN {COL_MAP['lc_status']} = 'Open' THEN {COL_MAP['margin_fd']} ELSE 0 END) as margin_fd,
            SUM(CASE WHEN "Type" != 'Unhedged' THEN {amt_col} ELSE 0 END) as hedged_amt,
            SUM(CASE WHEN {COL_MAP['lc_status']} = 'In Process' THEN {amt_col} ELSE 0 END) as lc_in_process
        FROM LC WHERE {COL_MAP['lc_status']} IN ('Open', 'In Process') {fy_filter}
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
            "available_sblc_limit": 0,
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

def get_lc_exposure_data(currency: str = "INR", fy: str = "All") -> Dict[str, Any]:
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])

    exposure_res = fetch_dict(f"""
        SELECT 
            {COL_MAP['lc_status']} as status,
            SUM({amt_col}) as value,
            COUNT(*) as count
        FROM LC
        WHERE 1=1 {fy_filter}
        GROUP BY 1
    """)
    
    bank_wise = fetch_dict(f"""
        SELECT
            LC.{COL_MAP['bank']} as bank,
            COALESCE(MAX(CAST(NULLIF(REPLACE(DD."Limit", ',', ''), '') AS DOUBLE)), 0) as limit_amt,
            SUM(CASE WHEN LC.{COL_MAP['lc_status']} IN ('Open', 'In Process') THEN LC.{amt_col} ELSE 0 END) as utilized,
            COALESCE(SUM(LC.{COL_MAP['margin_fd']}), 0) as margin_fd,
            COUNT(*) as lc_count
        FROM LC
        LEFT JOIN DD ON TRIM(UPPER(LC.{COL_MAP['bank']})) = TRIM(UPPER(DD.Element_8))
            AND DD.Table_8 = 'Bank'
        WHERE 1=1 {fy_filter}
        GROUP BY 1
    """)
    for b in bank_wise:
        b['available'] = max(0, b['limit_amt'] - b['utilized'])
        b['utilization_pct'] = (b['utilized'] / b['limit_amt'] * 100) if b['limit_amt'] > 0 else 0

    margin_wise = fetch_dict(f"""
        SELECT 
            Margin as margin_pct,
            SUM({amt_col}) as exposure,
            COUNT(*) as count,
            SUM({COL_MAP['margin_fd']}) as limit_consumed
        FROM LC
        WHERE Margin IS NOT NULL {fy_filter}
        GROUP BY 1
    """)

    return {
        "overall": exposure_res,
        "bank_wise": bank_wise,
        "margin_wise": margin_wise
    }

def get_sblc_module_data(currency: str = "INR", fy: str = "All") -> Dict[str, Any]:
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    cd = get_current_date()

    sblc_count = fetch_one("SELECT COUNT(*) FROM SBLC")[0]
    
    if sblc_count > 0:
        metrics = fetch_dict(f"""
            SELECT 
                SUM(CASE WHEN "Payment Status" != 'Paid' OR "Payment Status" IS NULL THEN "BOE Bill Amt\n(in INR)" ELSE 0 END) as outstanding,
                SUM(CASE WHEN "Payment Status" = 'Paid' THEN "BOE Bill Amt\n(in INR)" ELSE 0 END) as paid,
                SUM(CASE WHEN "SBLC LC Payment Due Date" >= '{cd}' THEN "BOE Bill Amt\n(in INR)" ELSE 0 END) as due,
                SUM("BOE Bill Amt\n(in INR)") as exposure
            FROM SBLC
        """)[0]
        
        bank_wise = fetch_dict(f"""
            SELECT 
                BANK as bank,
                SUM(CASE WHEN "Payment Status" != 'Paid' OR "Payment Status" IS NULL THEN "BOE Bill Amt\n(in INR)" ELSE 0 END) as outstanding,
                SUM(CASE WHEN "SBLC LC Payment Due Date" BETWEEN '{cd}' AND '{cd}'::DATE + INTERVAL 7 DAY THEN "BOE Bill Amt\n(in INR)" ELSE 0 END) as due_7d,
                SUM(CASE WHEN "SBLC LC Payment Due Date" BETWEEN '{cd}' AND '{cd}'::DATE + INTERVAL 30 DAY THEN "BOE Bill Amt\n(in INR)" ELSE 0 END) as due_30d
            FROM SBLC
            GROUP BY 1
        """)
    else:
        metrics = fetch_dict(f"""
            SELECT 
                SUM(CASE WHEN ({COL_MAP['payment_status']} != 'Paid' OR {COL_MAP['payment_status']} IS NULL) AND {COL_MAP['lc_status']} = 'Open' THEN {amt_col} ELSE 0 END) as outstanding,
                SUM(CASE WHEN {COL_MAP['payment_status']} = 'Paid' THEN {amt_col} ELSE 0 END) as paid,
                SUM(CASE WHEN {COL_MAP['due_date']} >= '{cd}' AND {COL_MAP['lc_status']} = 'Open' THEN {amt_col} ELSE 0 END) as due,
                SUM({amt_col}) as exposure
            FROM LC
            WHERE "SBLC Status" LIKE 'Yes%' {fy_filter}
        """)[0]
        
        bank_wise = fetch_dict(f"""
            SELECT 
                {COL_MAP['bank']} as bank,
                SUM(CASE WHEN ({COL_MAP['payment_status']} != 'Paid' OR {COL_MAP['payment_status']} IS NULL) AND {COL_MAP['lc_status']} = 'Open' THEN {amt_col} ELSE 0 END) as outstanding,
                SUM(CASE WHEN {COL_MAP['due_date']} BETWEEN '{cd}' AND '{cd}'::DATE + INTERVAL 7 DAY AND {COL_MAP['lc_status']} = 'Open' THEN {amt_col} ELSE 0 END) as due_7d,
                SUM(CASE WHEN {COL_MAP['due_date']} BETWEEN '{cd}' AND '{cd}'::DATE + INTERVAL 30 DAY AND {COL_MAP['lc_status']} = 'Open' THEN {amt_col} ELSE 0 END) as due_30d
            FROM LC
            WHERE "SBLC Status" LIKE 'Yes%' {fy_filter}
            GROUP BY 1
        """)

    return {
        "metrics": metrics,
        "bank_wise": bank_wise
    }

def get_boe_analytics_data(currency: str = "INR", fy: str = "All") -> Dict[str, Any]:
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    pending_col = COL_MAP["boe_pending_inr"] if currency == "INR" else COL_MAP["boe_pending_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])

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
        WHERE 1=1 {fy_filter}
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
        ORDER BY CASE bucket
            WHEN '0-30 Days' THEN 1 WHEN '31-60 Days' THEN 2
            WHEN '61-90 Days' THEN 3 WHEN '90+ Days' THEN 4 ELSE 5 END
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
        WHERE {COL_MAP['lc_status']} = 'Open' {fy_filter.replace(COL_MAP['due_date'], COL_MAP['op_date'])}
        GROUP BY 1
    """)
    return {"categories": categories, "risk_flags": risk_flags}

def get_fx_risk_data(fy: str = "All") -> Dict[str, Any]:
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    exposure = fetch_dict(f"""
        SELECT 
            {COL_MAP['currency']} as currency,
            SUM({COL_MAP['amt_fc']}) as exposure_fc,
            SUM({COL_MAP['amt_inr']}) as exposure_inr,
            SUM(CASE WHEN "Type" != 'Unhedged' THEN {COL_MAP['amt_inr']} ELSE 0 END) as hedged,
            SUM(CASE WHEN "Type" = 'Unhedged' THEN {COL_MAP['amt_inr']} ELSE 0 END) as unhedged
        FROM LC
        WHERE {COL_MAP['currency']} IS NOT NULL AND {COL_MAP['currency']} != 'INR' {fy_filter}
        GROUP BY 1
    """)
    for e in exposure:
        total = (e['hedged'] or 0) + (e['unhedged'] or 0)
        e['hedge_pct'] = (e['hedged'] / total * 100) if total > 0 else 0
    total_unhedged = sum(e['unhedged'] or 0 for e in exposure)
    total_exposure = sum((e['hedged'] or 0) + (e['unhedged'] or 0) for e in exposure)
    unhedged_pct = (total_unhedged / total_exposure * 100) if total_exposure > 0 else 0
    alert = f"Unhedged exposure is {unhedged_pct:.1f}%, which is above the 30% threshold." if unhedged_pct > 30 else None
    return {"exposure": exposure, "total_unhedged_pct": unhedged_pct, "alert": alert}

def get_hedge_coverage_data(currency: str = "INR", fy: str = "All") -> Dict[str, Any]:
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    ps = COL_MAP['payment_status']
    boe_inr  = COL_MAP['boe_bill_inr']
    lc_inr   = COL_MAP['amt_inr']
    boe_fc   = COL_MAP['boe_bill_fc']
    lc_fc    = COL_MAP['amt_fc']
    amt_inr  = f"CASE WHEN {boe_inr} > 0 THEN {boe_inr} ELSE {lc_inr} END"
    amt_fc   = f"CASE WHEN {boe_fc}  > 0 THEN {boe_fc}  ELSE {lc_fc}  END"
    rows = fetch_dict(f"""
        SELECT COALESCE(TRIM("Product Name"), 'Unknown') AS product, COALESCE("Type", 'Unknown') AS type,
            CASE WHEN COALESCE("Type",'') = 'CAPEX' THEN 'Hedged' ELSE 'Unhedged' END AS hedge_status,
            COUNT(*) AS lc_count, SUM({amt_inr}) AS unpaid_inr, SUM({amt_fc}) AS unpaid_fc, MAX(COALESCE("Currency", 'USD')) AS currency
        FROM LC WHERE {ps} = 'Unpaid' {fy_filter} GROUP BY 1, 2, 3 HAVING SUM({amt_inr}) > 0 OR SUM({amt_fc}) > 0 ORDER BY SUM({amt_inr}) DESC
    """)
    products = [{'product': r['product'], 'type': r['type'], 'hedge_status': r['hedge_status'], 'lc_count': int(r['lc_count'] or 0),
                'unpaid_inr': round(float(r['unpaid_inr'] or 0), 2), 'unpaid_fc': round(float(r['unpaid_fc']  or 0), 2),
                'currency': r['currency'] or 'USD'} for r in rows]
    total = sum(p['unpaid_inr'] for p in products)
    hedged = sum(p['unpaid_inr'] for p in products if p['hedge_status'] == 'Hedged')
    return {'summary': {'total_unpaid': round(total, 2), 'hedged': round(hedged, 2), 'unhedged': round(total - hedged, 2),
                      'hedge_pct': round(hedged / total * 100, 1) if total > 0 else 0,
                      'unhedged_pct': round((total - hedged) / total * 100, 1) if total > 0 else 0}, 'products': products}

def get_payment_statuses() -> List[str]:
    rows = fetch_dict('SELECT DISTINCT "Payment Status" FROM LC WHERE "Payment Status" IS NOT NULL ORDER BY 1')
    return [r["Payment Status"] for r in rows if r["Payment Status"]]

def get_calendar_events(month: int, year: int, bank: Optional[str] = None, instrument: Optional[str] = None, currency: str = "INR", supplier: Optional[str] = None, status: Optional[str] = None, fy: str = "All", payment_status: Optional[str] = None) -> List[Dict[str, Any]]:
    month, year = int(month), int(year)
    lc_amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    boe_bill_col = COL_MAP["boe_bill_inr"] if currency == "INR" else COL_MAP["boe_bill_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    filter_conditions = []
    filter_params = []
    if bank and bank != "All": filter_conditions.append(f"{COL_MAP['bank']} = ?"); filter_params.append(bank)
    if supplier and supplier != "All": filter_conditions.append(f"{COL_MAP['supplier']} = ?"); filter_params.append(supplier)
    if status and status != "All": filter_conditions.append(f"{COL_MAP['lc_status']} = ?"); filter_params.append(status)
    extra = (" AND " + " AND ".join(filter_conditions)) if filter_conditions else ""
    def run(date_col, extra_where, label, color, params_prefix, amount_expr=None):
        amt = amount_expr or lc_amt_col
        q = (f"SELECT {date_col} as date, {COL_MAP['bank']} as bank, SUM({amt}) as amount, COUNT(*) as count, '{label}' as type, '{color}' as color "
             f"FROM LC WHERE EXTRACT(MONTH FROM {date_col}) = ? AND EXTRACT(YEAR FROM {date_col}) = ?"
             f"{extra_where}{extra}{fy_filter} GROUP BY 1, 2")
        return fetch_dict(q, params_prefix + filter_params)
    due_amt = f"CASE WHEN {boe_bill_col} > 0 THEN {boe_bill_col} ELSE {lc_amt_col} END"
    ps = COL_MAP['payment_status']
    if payment_status and payment_status not in ('All', ''):
        ps_where = f" AND {ps} = ?"
        due = [] if payment_status == 'Paid' else run(COL_MAP['due_date'], ps_where, 'Payment Due', 'Red', [month, year, payment_status], amount_expr=due_amt)
        paid = run(COL_MAP['due_date'], ps_where, 'Paid', 'Green', [month, year, payment_status], amount_expr=due_amt) if payment_status == 'Paid' else []
        boe_to_pay = run(COL_MAP['due_date'], f" AND {COL_MAP['boe_status']} = 'Received'" + ps_where, 'BOE Unpaid', 'BoeRed', [month, year, payment_status], amount_expr=due_amt) if payment_status != 'Paid' else []
        boe_paid_ev = run(COL_MAP['due_date'], f" AND {COL_MAP['boe_status']} = 'Received'" + ps_where, 'BOE Paid', 'BoeGreen', [month, year, payment_status], amount_expr=due_amt) if payment_status == 'Paid' else []
    else:
        due = run(COL_MAP['due_date'], f" AND ({ps} != 'Paid' OR {ps} IS NULL)", 'Payment Due', 'Red', [month, year], amount_expr=due_amt)
        paid = run(COL_MAP['due_date'], f" AND {ps} = 'Paid'", 'Paid', 'Green', [month, year], amount_expr=due_amt)
        boe_to_pay = run(COL_MAP['due_date'], f" AND {COL_MAP['boe_status']} = 'Received' AND {ps} != 'Paid'", 'BOE Unpaid', 'BoeRed', [month, year], amount_expr=due_amt)
        boe_paid_ev = run(COL_MAP['due_date'], f" AND {COL_MAP['boe_status']} = 'Received' AND {ps} = 'Paid'", 'BOE Paid', 'BoeGreen', [month, year], amount_expr=due_amt)
    opened = run(COL_MAP['op_date'], '', 'LC Opened', 'Blue', [month, year])
    closed = run(COL_MAP['lc_close_date'], '', 'LC Closed', 'Orange', [month, year])
    expiry = run(COL_MAP['expiry_date'], f" AND {COL_MAP['lc_status']} NOT IN ('Closed', 'Cancelled')", 'LC Expiry', 'DarkRed', [month, year])
    boe_recv = run(COL_MAP['boe_date'], f" AND {COL_MAP['boe_status']} = 'Received'", 'BOE Received', 'Purple', [month, year], amount_expr=due_amt)
    fd_events = []
    try:
        fd_events = fetch_dict("SELECT CAST(CAST(\"Maturity Date\" AS TIMESTAMP) AS DATE) as date, SUM(COALESCE(TRY_CAST(REPLACE(REPLACE(\"FD LIEN AMT for LC/BG\", ',', ''), ' ', '') AS DOUBLE), 0)) as amount, 'FD Margin Released' as type, 'Teal' as color "
                               "FROM FDR_List WHERE \"Maturity Date\" IS NOT NULL AND UPPER(TRIM(STATUS)) = 'ACTIVE' AND EXTRACT(MONTH FROM CAST(\"Maturity Date\" AS TIMESTAMP)) = ? AND EXTRACT(YEAR FROM CAST(\"Maturity Date\" AS TIMESTAMP)) = ? GROUP BY 1 HAVING amount > 0", [month, year])
    except: pass
    return due + paid + opened + closed + expiry + boe_recv + boe_to_pay + boe_paid_ev + fd_events

def get_daily_reco(date_str: str) -> Dict[str, Any]:
    a = COL_MAP['amt_inr']
    lc_opened = fetch_one(f"SELECT COUNT(*), SUM({a}) FROM LC WHERE {COL_MAP['op_date']} = ?", [date_str])
    lc_closed = fetch_one(f"SELECT COUNT(*), SUM({a}) FROM LC WHERE {COL_MAP['lc_close_date']} = ?", [date_str])
    payments_due = fetch_one(f"SELECT COUNT(*), SUM({a}) FROM LC WHERE {COL_MAP['due_date']} = ? AND ({COL_MAP['payment_status']} != 'Paid' OR {COL_MAP['payment_status']} IS NULL)", [date_str])
    payments_done = fetch_one(f"SELECT COUNT(*), SUM({a}) FROM LC WHERE {COL_MAP['due_date']} = ? AND {COL_MAP['payment_status']} = 'Paid'", [date_str])
    boe_received = fetch_one(f"SELECT COUNT(*), SUM({a}) FROM LC WHERE {COL_MAP['boe_date']} = ?", [date_str])
    fd_releasing = fetch_one("SELECT COUNT(*), SUM(COALESCE(TRY_CAST(REPLACE(REPLACE(\"FD LIEN AMT for LC/BG\", ',', ''), ' ', '') AS DOUBLE), 0)) FROM FDR_List WHERE CAST(CAST(\"Maturity Date\" AS TIMESTAMP) AS DATE) = ? AND UPPER(TRIM(STATUS)) = 'ACTIVE'", [date_str])
    return {"lc_opened": {"count": lc_opened[0] or 0, "value": lc_opened[1] or 0}, "lc_closed": {"count": lc_closed[0] or 0, "value": lc_closed[1] or 0},
            "payments_due": {"count": payments_due[0] or 0, "value": payments_due[1] or 0}, "payments_completed": {"count": payments_done[0] or 0, "value": payments_done[1] or 0},
            "boe_received": {"count": boe_received[0] or 0, "value": boe_received[1] or 0}, "fd_releasing": {"count": fd_releasing[0] or 0, "value": fd_releasing[1] or 0}}

def get_fd_module_data() -> Dict[str, Any]:
    fdr_data = fetch_dict("SELECT * FROM FDR_List")
    total_fd, total_lien = 0, 0
    bank_wise, purpose_wise = {}, {"LC": 0, "BG": 0, "Collateral": 0, "Other": 0}
    cd, maturity_analysis = date.today(), {"7 Days": 0, "30 Days": 0, "60 Days": 0, "90 Days": 0, "Over 90 Days": 0}
    for row in fdr_data:
        def clean_val(v):
            try: return float(str(v).replace(',', '').replace('₹', '').strip())
            except: return 0
        amt, lien = clean_val(row.get('FINAL FD  AMT')), clean_val(row.get('FD LIEN AMT for LC/BG'))
        total_fd += amt; total_lien += lien
        bank = row.get('Bank Name', 'Unknown'); bank_wise[bank] = bank_wise.get(bank, 0) + amt
        purpose = str(row.get('LC/BG/COLLETRAL', 'Other')).upper()
        if "LC" in purpose: purpose_wise["LC"] += amt
        elif "BG" in purpose: purpose_wise["BG"] += amt
        elif "COLL" in purpose: purpose_wise["Collateral"] += amt
        else: purpose_wise["Other"] += amt
        m_date_str = row.get('Maturity Date') or row.get('New Maturity Date')
        if m_date_str:
            try:
                m_date = datetime.strptime(str(m_date_str), "%Y-%m-%d").date()
                diff = (m_date - cd).days
                if diff <= 7: maturity_analysis["7 Days"] += amt
                elif diff <= 30: maturity_analysis["30 Days"] += amt
                elif diff <= 60: maturity_analysis["60 Days"] += amt
                elif diff <= 90: maturity_analysis["90 Days"] += amt
                else: maturity_analysis["Over 90 Days"] += amt
            except: pass
    return {"kpis": {"total_fd": total_fd, "total_lien": total_lien, "working_capital_frozen": total_lien, "available_fd": total_fd - total_lien},
            "bank_wise": [{"bank": k, "value": v} for k, v in bank_wise.items()], "purpose_wise": [{"purpose": k, "value": v} for k, v in purpose_wise.items()],
            "maturity": [{"bucket": k, "value": v} for k, v in maturity_analysis.items()]}

def get_bg_module_data() -> Dict[str, Any]:
    bg_data = fetch_dict("SELECT * FROM Bank_Guarantee")
    outstanding, expiring_soon, expired, fd_linked = 0, 0, 0, 0
    for bg in bg_data:
        def clean_val(v):
            try: return float(str(v).replace(',', '').strip())
            except: return 0
        amt, status = clean_val(bg.get('Amt.')), str(bg.get('status')).lower()
        exp_date_str = bg.get('Date of expiry ')
        if exp_date_str:
            try:
                exp_date = datetime.strptime(str(exp_date_str), "%Y-%m-%d").date()
                diff = (exp_date - date.today()).days
                if diff < 0: expired += amt
                elif status == 'open':
                    outstanding += amt
                    if diff < 30: expiring_soon += amt
            except:
                if status == 'open': outstanding += amt
        elif status == 'open': outstanding += amt
        if clean_val(bg.get('FD Lien Amt')) > 0 and status == 'open': fd_linked += amt
    return {"outstanding": outstanding, "expiring_30d": expiring_soon, "expired": expired, "fd_linked": fd_linked}

def get_limit_utilisation_data(currency: str = "INR", fy: str = "All", payment_status: str = "Unpaid") -> Dict[str, Any]:
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    bank_data = fetch_dict(f"""SELECT LC.{COL_MAP['bank']} as bank, COUNT(*) as lc_count, 
                               SUM(CASE WHEN LC.{COL_MAP['lc_status']} = 'Open' THEN LC.{amt_col} ELSE 0 END) as lc_open,
                               SUM(CASE WHEN LC.{COL_MAP['lc_status']} = 'In Process' THEN LC.{amt_col} ELSE 0 END) as lc_in_process,
                               COALESCE(MAX(CAST(NULLIF(REPLACE(DD."Limit", ',', ''), '') AS DOUBLE)), 0) as max_limit,
                               COALESCE(MAX(CAST(NULLIF(REPLACE(DD."SBLC", ',', ''), '') AS DOUBLE)), 0) as sblc_limit,
                               COALESCE(MAX(CAST(NULLIF(REPLACE(DD."Cash", ',', ''), '') AS DOUBLE)), 0) as cash_limit
                               FROM LC LEFT JOIN DD ON TRIM(UPPER(LC.{COL_MAP['bank']})) = TRIM(UPPER(DD.Element_8)) AND DD.Table_8 = 'Bank'
                               WHERE LC.{COL_MAP['lc_status']} IN ('Open', 'In Process') {fy_filter} GROUP BY 1 ORDER BY max_limit DESC""")
    
    # ── Margin-Bank Pivot (LC Exposure) ──────────────────────────────────────
    margin_bank_raw = fetch_dict(f"SELECT {COL_MAP['bank']} as bank, Margin as margin_pct, SUM({amt_col}) as value FROM LC WHERE {COL_MAP['lc_status']} = 'Open' {fy_filter} GROUP BY 1, 2")
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
        SELECT {COL_MAP['bank']} as bank, Margin as margin_pct, SUM(COALESCE({boe_amt_col}, {amt_col})) as value 
        FROM LC WHERE {COL_MAP['boe_status']} = 'Received' AND {pay_cond} {fy_filter}
        GROUP BY 1, 2
    """)
    boe_margin_pivot = []
    for m in margins_list:
        row = {"margin": m}
        for b in banks_list: row[b] = sum(r['value'] for r in boe_margin_raw if r['bank'] == b and r['margin_pct'] == m)
        boe_margin_pivot.append(row)

    sblc_data_res = fetch_dict(f"SELECT {COL_MAP['bank']} as bank, SUM(CASE WHEN \"SBLC Status\" LIKE 'Yes%' THEN {amt_col} ELSE 0 END) as sblc_used FROM LC WHERE {COL_MAP['lc_status']} = 'Open' AND TRIM(Margin) = '10%' {fy_filter} GROUP BY 1")
    sblc_map = {r['bank']: r['sblc_used'] for r in sblc_data_res}
    total_max, total_used, total_sblc = 0, 0, 0
    for row in bank_data:
        lc_open = row.get('lc_open', 0)
        lc_in_process = row.get('lc_in_process', 0)
        used = lc_open + lc_in_process
        limit = row.get('max_limit', 0)
        sblc_used = sblc_map.get(row['bank'], 0)
        row.update({
            'used_limit': used,
            'lc_open': lc_open,
            'lc_in_process': lc_in_process,
            'utilization_pct': round(used / max(limit, 1) * 100, 1),
            'available_limit': max(0, limit - used),
            'sblc_utilization': sblc_used,
            'sblc_limit': row.get('sblc_limit', 0),
            'cash_limit': row.get('cash_limit', 0),
            'cash_utilization': 0,
            'interchangeability_limit': limit,
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
    if fx['total_unhedged_pct'] > 30: actions.append({"priority": 4, "type": "FX Exposure Risk", "message": fx['alert']})
    return sorted(actions, key=lambda x: x['priority'])

def get_command_data(currency: str = "INR", fy: str = "All", payment_status: str = "Unpaid") -> Dict[str, Any]:
    cd, amt_col = get_current_date(), COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    exec_d, exp_d, boe_d, sblc_d = get_executive_overview_data(currency, fy), get_lc_exposure_data(currency, fy), get_boe_analytics_data(currency, fy), get_sblc_module_data(currency, fy)
    kpis = exec_d['kpis']
    
    # Define limit_map for pivots
    limits = fetch_dict("""
        SELECT TRIM(Element_8) as bank, CAST(NULLIF(REPLACE("Limit", ',', ''), '') AS DOUBLE) as limit_amt
        FROM DD WHERE Table_8 = 'Bank' AND Element_8 != '' AND Element_8 IS NOT NULL
    """)
    limit_map = {r['bank']: r['limit_amt'] or 0 for r in limits}
    bank_limit_summary = [{"bank": b, "limit": l} for b, l in limit_map.items()]

    overdue = fetch_one(f"""
        SELECT COUNT(*), SUM({amt_col}) 
        FROM LC 
        WHERE {COL_MAP['due_date']} < '{cd}' 
          AND ({COL_MAP['payment_status']} IS NULL OR {COL_MAP['payment_status']} != 'Paid')
          AND {COL_MAP['lc_status']} NOT IN ('Closed', 'Cancelled')
    """)
    due_7d = fetch_one(f"""
        SELECT COUNT(*), SUM({amt_col}) 
        FROM LC 
        WHERE {COL_MAP['due_date']} BETWEEN '{cd}' AND '{cd}'::DATE + INTERVAL 7 DAY 
          AND ({COL_MAP['payment_status']} IS NULL OR {COL_MAP['payment_status']} != 'Paid')
          AND {COL_MAP['lc_status']} NOT IN ('Closed', 'Cancelled')
    """)

    # ── Product-Bank Pivot ──────────────────────────────────────────────────
    pay_cond = f"{COL_MAP['payment_status']} = 'Paid'" if payment_status == "Paid" else f"({COL_MAP['payment_status']} != 'Paid' OR {COL_MAP['payment_status']} IS NULL)"
    boe_amt_col = COL_MAP["boe_pending_inr"] if currency == "INR" else COL_MAP["boe_pending_fc"]
    product_unpaid_raw = fetch_dict(f"""
        SELECT 
            COALESCE(TRIM("Product Name"), 'Unknown') as product,
            COALESCE(TRIM("Type"), 'Unknown') as type,
            TRIM({COL_MAP['bank']}) as bank,
            SUM(COALESCE({boe_amt_col}, {amt_col}, 0)) as value
        FROM LC
        WHERE {pay_cond}
          AND {COL_MAP['boe_status']} = 'Received'
          AND {COL_MAP['lc_status']} NOT IN ('Closed', 'Cancelled')
          {get_fy_clause(fy, COL_MAP['due_date'])}
        GROUP BY 1, 2, 3
    """)
    
    product_list = sorted(list(set((r['product'], r['type']) for r in product_unpaid_raw)))
    product_unpaid_pivot = []
    for p, t in product_list:
        row = {"product": p, "type": t}
        for b in limit_map.keys():
            row[b] = sum(r['value'] for r in product_unpaid_raw if r['product'] == p and r['type'] == t and r['bank'] == b)
        product_unpaid_pivot.append(row)

    # ── BOE Status-Bank Pivot (Refactored) ───────────────────────────────────
    boe_bill_amt_col = COL_MAP["boe_bill_inr"] if currency == "INR" else COL_MAP["boe_bill_fc"]
    boe_status_bank_raw = fetch_dict(f"""
        SELECT 
            COALESCE({COL_MAP['boe_status']}, 'Not Received') as boe_status,
            COALESCE({COL_MAP['payment_status']}, 'Unpaid') as payment_status,
            TRIM({COL_MAP['bank']}) as bank,
            SUM(COALESCE({boe_bill_amt_col}, 0)) as value
        FROM LC WHERE 1=1 {fy_filter}
        GROUP BY 1, 2, 3
    """)
    
    status_pairs = sorted(list(set((r['boe_status'], r['payment_status']) for r in boe_status_bank_raw)))
    boe_status_bank_pivot = []
    boe_bank_pivot = {}
    for boe_st, pay_st in status_pairs:
        row = {"boe_status": boe_st, "payment_status": pay_st}
        key = (boe_st, pay_st)
        if key not in boe_bank_pivot:
            boe_bank_pivot[key] = {"boe_status": boe_st, "payment_status": pay_st}
        for b in limit_map.keys():
            val = sum(r['value'] for r in boe_status_bank_raw if r['boe_status'] == boe_st and r['payment_status'] == pay_st and r['bank'] == b)
            row[b] = val
            boe_bank_pivot[key][b] = val
        boe_status_bank_pivot.append(row)

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
            "banks_list": sorted(list(limit_map.keys()))}

def get_trend_cohort_data(currency: str = "INR") -> Dict[str, Any]:
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    return {"exposure_trend": fetch_dict(f"SELECT date_trunc('month', {COL_MAP['op_date']}) as month, SUM({amt_col}) as value FROM LC WHERE {COL_MAP['op_date']} >= date_trunc('month', CURRENT_DATE - INTERVAL 6 MONTH) GROUP BY 1 ORDER BY 1"),
            "util_trend": fetch_dict(f"SELECT date_trunc('month', {COL_MAP['op_date']}) as month, {COL_MAP['bank']} as bank, SUM({amt_col}) as value FROM LC WHERE {COL_MAP['op_date']} >= date_trunc('month', CURRENT_DATE - INTERVAL 6 MONTH) GROUP BY 1, 2 ORDER BY 1"),
            "supplier_cohort": fetch_dict(f"SELECT {COL_MAP['supplier']} as supplier, SUM({amt_col}) as exposure, SUM(CASE WHEN {COL_MAP['payment_status']} = 'Paid' THEN {amt_col} ELSE 0 END) as payments, SUM(CASE WHEN {COL_MAP['due_date']} < CURRENT_DATE AND ({COL_MAP['payment_status']} != 'Paid' OR {COL_MAP['payment_status']} IS NULL) THEN {amt_col} ELSE 0 END) as overdues FROM LC GROUP BY 1 ORDER BY 2 DESC LIMIT 10")}

def get_strategic_intelligence_data(currency: str = "INR", fy: str = "All") -> Dict[str, Any]:
    amt_col, fy_f = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"], get_fy_clause(fy, COL_MAP['op_date'])
    try: locked_fd = fetch_one(f"SELECT SUM({COL_MAP['margin_fd']}) FROM LC WHERE 1=1 {fy_f}")[0] or 0
    except: locked_fd = 0
    yield_lost = locked_fd * 0.07
    return {"health_score": 85.0, "cash_runway_days": 45, "remaining_limit": 50000000, "yield_optimization": {"locked_fd": locked_fd, "est_yield_lost_annual": yield_lost, "cost_of_inefficiency": yield_lost * 1.2, "expected_fx_loss": 500000, "prob_liquidity_stress": 12.5, "working_capital_unlock": locked_fd + (yield_lost * 1.2)}, "supplier_reliability": [], "bank_utilization": [], "quant_models": {"lc_closure_avg_days": 90, "lc_demand_forecast_30d": 10000000, "bank_dependency_risk_pct": 25.0, "stress_window_start": "2026-07-01", "stress_window_val": 5000000}}

def get_advanced_quant_data(currency: str = "INR", fy: str = "All") -> Dict[str, Any]:
    return {"early_warning_index": 42.5, "liquidity_at_risk": 15000000, "lar_mean": 10000000, "lar_stddev": 2000000, "network": [], "stress_tests": []}

def get_pe_treasury_data() -> Dict[str, Any]:
    return {"debt_maturity": fetch_dict("SELECT * FROM DEBT_MATURITY ORDER BY year") if fetch_one("SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'DEBT_MATURITY'") else [],
            "yield_curve": fetch_dict("SELECT * FROM YIELD_CURVE") if fetch_one("SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'YIELD_CURVE'") else [],
            "capital_stack": fetch_dict("SELECT * FROM CAPITAL_STACK") if fetch_one("SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'CAPITAL_STACK'") else [], "value_creation": {}, "liquidity_index": {}}

def get_lifecycle_tracker_data(fy: str = "All") -> List[Dict[str, Any]]:
    cd, fy_f = get_current_date(), get_fy_clause(fy, COL_MAP['op_date'])
    stats = fetch_dict(f"SELECT COUNT(*) as total, COUNT(CASE WHEN {COL_MAP['shipment_date']} <= '{cd}' THEN 1 END) as shipped, COUNT(CASE WHEN {COL_MAP['docs_received']} = 'YES' THEN 1 END) as docs_received, COUNT(CASE WHEN {COL_MAP['bill_lodge']} IS NOT NULL THEN 1 END) as bill_lodged, COUNT(CASE WHEN {COL_MAP['bill_accept']} IS NOT NULL THEN 1 END) as bill_accepted, COUNT(CASE WHEN {COL_MAP['payment_status']} = 'Paid' THEN 1 END) as paid, COUNT(CASE WHEN {COL_MAP['lc_status']} = 'Closed' THEN 1 END) as closed FROM LC WHERE 1=1 {fy_f}")[0]
    return [{"stage": "Open LC", "count": stats['total']}, {"stage": "Shipment Done", "count": stats['shipped']}, {"stage": "Docs Received", "count": stats['docs_received']}, {"stage": "Bill Lodged", "count": stats['bill_lodged']}, {"stage": "Bill Accepted", "count": stats['bill_accepted']}, {"stage": "Payment Done", "count": stats['paid']}, {"stage": "LC Closed", "count": stats['closed']}]

def get_treasury_radar_data(currency: str = "INR", fy: str = "All") -> List[Dict[str, Any]]:
    return [{"subject": "Liquidity Stress", "A": 45, "fullMark": 100}, {"subject": "Limit Exhaustion", "A": 65, "fullMark": 100}, {"subject": "FX Volatility", "A": 30, "fullMark": 100}, {"subject": "Supplier Delay", "A": 55, "fullMark": 100}, {"subject": "Expiry Breach", "A": 20, "fullMark": 100}, {"subject": "Operational Delay", "A": 40, "fullMark": 100}]

def get_shipment_tracking_data(fy: str = "All") -> Dict[str, Any]:
    cd, fy_f = get_current_date(), get_fy_clause(fy, COL_MAP['op_date'])
    pending = fetch_one(f"SELECT COUNT(*) FROM LC WHERE {COL_MAP['lc_status']} = 'Open' AND ({COL_MAP['shipment_date']} > '{cd}' OR {COL_MAP['shipment_date']} IS NULL) {fy_f}")[0] or 0
    completed = fetch_one(f"SELECT COUNT(*) FROM LC WHERE {COL_MAP['shipment_date']} <= '{cd}' {fy_f}")[0] or 0
    expired = fetch_one(f"SELECT COUNT(*) FROM LC WHERE {COL_MAP['lc_status']} = 'Expired' AND {COL_MAP['shipment_date']} IS NULL {fy_f}")[0] or 0
    return {"pending_count": int(pending), "completed_count": int(completed), "delayed_count": 0, "expired_count": int(expired)}

_ALLOWED_LC_STATUSES, _ALLOWED_BOE_STATUSES, _ALLOWED_DATE_FIELDS = {'Open', 'Closed', 'In Process', 'Cancelled', 'Expired'}, {'Received', 'Not Received', 'Cancelled'}, {'due_date', 'op_date', 'lc_close_date', 'expiry_date', 'boe_date'}

def get_drill_down_query(status: Optional[str] = None, bank: Optional[str] = None, boe_status: Optional[str] = None, date: Optional[str] = None, date_field: Optional[str] = None, fy: str = "All") -> List[Dict[str, Any]]:
    conditions, params, fy_map = [], [], {"FY24-25": ("2024-04-01", "2025-03-31"), "FY25-26": ("2025-04-01", "2026-03-31"), "FY26-27": ("2026-04-01", "2027-03-31")}
    if fy in fy_map:
        start, end = fy_map[fy]; conditions.append(f"{COL_MAP['op_date']} >= ? AND {COL_MAP['op_date']} <= ?"); params.extend([start, end])
    if status and status in _ALLOWED_LC_STATUSES: conditions.append(f"{COL_MAP['lc_status']} = ?"); params.append(status)
    if bank: conditions.append(f"{COL_MAP['bank']} = ?"); params.append(bank)
    if boe_status and boe_status in _ALLOWED_BOE_STATUSES: conditions.append(f"{COL_MAP['boe_status']} = ?"); params.append(boe_status)
    if date: df = date_field if date_field in _ALLOWED_DATE_FIELDS else 'due_date'; conditions.append(f"{COL_MAP[df]} = ?"); params.append(date)
    where_stmt = (" WHERE " + " AND ".join(conditions)) if conditions else ""
    return fetch_dict(f'SELECT * FROM LC{where_stmt} ORDER BY {COL_MAP["op_date"]} DESC LIMIT 1000', params if params else None)
