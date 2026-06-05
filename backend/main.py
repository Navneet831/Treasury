from fastapi import FastAPI, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
import os
from database import fetch_dict, fetch_one
from datetime import datetime
from prometheus_fastapi_instrumentator import Instrumentator

app = FastAPI(title="LC Analytics API")

Instrumentator().instrument(app).expose(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CURRENT_DATE = "2026-06-05"

COL_MAP = {
    "amt_inr": '"LC Amt (in INR)"',
    "amt_fc": '"Final LC Amt (in FC)"',
    "boe_pending_inr": '"Pending BOE Amt (in INR)"',
    "boe_pending_fc": '"Pending BOE Amt (in FC)"',
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
    "tolerance": '"Tolerance Amt /Reduction Amt"'
}

def get_fy_clause(fy: str, date_col: str) -> str:
    if fy == "FY25-26": return f" AND {date_col} >= '2025-04-01' AND {date_col} <= '2026-03-31'"
    if fy == "FY26-27": return f" AND {date_col} >= '2026-04-01' AND {date_col} <= '2027-03-31'"
    return ""

@app.get("/api/v1/executive-overview")
async def get_executive_overview(currency: str = Query("INR"), fy: str = Query("All")):
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    boe_pending_col = COL_MAP["boe_pending_inr"] if currency == "INR" else COL_MAP["boe_pending_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    
    stats = fetch_one(f"""
        SELECT 
            COUNT(*) as total_count, SUM({amt_col}) as total_value,
            COUNT(DISTINCT {COL_MAP['bank']}) as active_banks, COUNT(DISTINCT {COL_MAP['supplier']}) as active_suppliers
        FROM LC WHERE ({COL_MAP['lc_status']} = 'Open' OR {COL_MAP['lc_status']} IS NULL) {fy_filter}
    """)
    
    upcoming_7 = fetch_one(f"""
        SELECT SUM({amt_col}) FROM LC 
        WHERE {COL_MAP['due_date']} BETWEEN '{CURRENT_DATE}' AND '{CURRENT_DATE}'::DATE + INTERVAL 7 DAY {get_fy_clause(fy, COL_MAP['due_date'])}
    """)[0] or 0
    
    upcoming_30 = fetch_one(f"""
        SELECT SUM({amt_col}) FROM LC 
        WHERE {COL_MAP['due_date']} BETWEEN '{CURRENT_DATE}' AND '{CURRENT_DATE}'::DATE + INTERVAL 30 DAY {get_fy_clause(fy, COL_MAP['due_date'])}
    """)[0] or 0
    
    overdue = fetch_one(f"""
        SELECT SUM({amt_col}) FROM LC 
        WHERE {COL_MAP['due_date']} < '{CURRENT_DATE}' AND {COL_MAP['payment_status']} != 'Paid' {get_fy_clause(fy, COL_MAP['due_date'])}
    """)[0] or 0
    
    pending_boe = fetch_one(f"""
        SELECT SUM({boe_pending_col}) FROM LC WHERE {COL_MAP['boe_status']} != 'Received' {fy_filter}
    """)[0] or 0
    
    expired = fetch_one(f"SELECT COUNT(*) FROM LC WHERE {COL_MAP['expiry_date']} < '{CURRENT_DATE}' AND {COL_MAP['lc_status']} = 'Open' {fy_filter}")[0] or 0
    closing_this_month = fetch_one(f"SELECT COUNT(*) FROM LC WHERE date_trunc('month', {COL_MAP['expiry_date']}) = date_trunc('month', '{CURRENT_DATE}'::DATE) {fy_filter}")[0] or 0

    return {
        "kpis": {
            "open_lc_value": stats[1] or 0, "open_lc_count": stats[0], "active_banks": stats[2], "active_suppliers": stats[3],
            "upcoming_due_7d": upcoming_7, "upcoming_due_30d": upcoming_30, "overdue_payments": overdue,
            "pending_boe_value": pending_boe, "expired_lcs": expired, "lcs_closing_this_month": closing_this_month
        },
        "insights": [
            f"{stats[2]} banks contribute to the current LC exposure.",
            f"{currency} {upcoming_7:,.2f} payments due in next 7 days." if upcoming_7 > 0 else "No payments due in next 7 days.",
            f"{expired} LCs have already expired and need attention."
        ]
    }

@app.get("/api/v1/calendar")
async def get_calendar_data(month: int, year: int, currency: str = Query("INR"), fy: str = Query("All")):
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    limit_col = COL_MAP["limit_avail"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    base_where = f"WHERE EXTRACT(MONTH FROM {COL_MAP['op_date']}) = {month} AND EXTRACT(YEAR FROM {COL_MAP['op_date']}) = {year} {fy_filter}"
    
    return {
        "daily_summary": fetch_dict(f"SELECT {COL_MAP['op_date']} as date, SUM(CASE WHEN {COL_MAP['lc_status']} = 'Open' THEN {amt_col} ELSE 0 END) as opened_value, SUM(CASE WHEN {COL_MAP['lc_status']} = 'Closed' THEN {amt_col} ELSE 0 END) as closed_value, SUM({amt_col}) as total_value, SUM({limit_col}) as limit_balance FROM LC {base_where} GROUP BY 1 ORDER BY 1"),
        "bank_breakdown": fetch_dict(f"SELECT {COL_MAP['op_date']} as date, {COL_MAP['bank']} as bank, SUM({amt_col}) as value FROM LC {base_where} GROUP BY 1, 2"),
        "status_breakdown": fetch_dict(f"SELECT {COL_MAP['op_date']} as date, {COL_MAP['lc_status']} as status, SUM({amt_col}) as value FROM LC {base_where} GROUP BY 1, 2"),
        "boe_breakdown": fetch_dict(f"SELECT {COL_MAP['op_date']} as date, {COL_MAP['boe_status']} as boe_status, SUM({amt_col}) as value FROM LC {base_where} GROUP BY 1, 2")
    }

@app.get("/api/v1/drill-down")
async def get_drill_down(
    status: Optional[str] = None, bank: Optional[str] = None, boe_status: Optional[str] = None, date: Optional[str] = None,
    lifecycle_stage: Optional[str] = None, kpi: Optional[str] = None, alert_type: Optional[str] = None, fy: str = Query("All")
):
    where_clauses = []
    
    # Apply FY globally to all drill-downs based on op_date
    fy_sql = get_fy_clause(fy, COL_MAP['op_date'])
    if fy_sql: where_clauses.append(fy_sql.replace(" AND ", "", 1))
    
    if status: where_clauses.append(f"{COL_MAP['lc_status']} = '{status}'")
    if bank: where_clauses.append(f"{COL_MAP['bank']} = '{bank}'")
    if boe_status: where_clauses.append(f"{COL_MAP['boe_status']} = '{boe_status}'")
    if date: where_clauses.append(f"{COL_MAP['op_date']} = '{date}'")
    
    if lifecycle_stage:
        if lifecycle_stage == "Open LC": where_clauses.append(f"({COL_MAP['lc_status']} = 'Open' OR {COL_MAP['lc_status']} IS NULL)")
        elif lifecycle_stage == "Shipment Done": where_clauses.append(f"{COL_MAP['shipment_date']} <= '{CURRENT_DATE}'")
        elif lifecycle_stage == "Docs Received": where_clauses.append('"DOCUMENTS RECEIVED" = \'YES\'')
        elif lifecycle_stage == "Bill Lodged": where_clauses.append('"Bill Lodge date" IS NOT NULL')
        elif lifecycle_stage == "Bill Accepted": where_clauses.append('"Bill Acceptance date" IS NOT NULL')
        elif lifecycle_stage == "Payment Done": where_clauses.append(f"{COL_MAP['payment_status']} = 'Paid'")
        elif lifecycle_stage == "LC Closed": where_clauses.append(f"{COL_MAP['lc_status']} = 'Closed'")

    if kpi:
        if kpi == "open_lc": where_clauses.append(f"({COL_MAP['lc_status']} = 'Open' OR {COL_MAP['lc_status']} IS NULL)")
        elif kpi == "upcoming_7d": where_clauses.append(f"{COL_MAP['due_date']} BETWEEN '{CURRENT_DATE}' AND '{CURRENT_DATE}'::DATE + INTERVAL 7 DAY")
        elif kpi == "upcoming_30d": where_clauses.append(f"{COL_MAP['due_date']} BETWEEN '{CURRENT_DATE}' AND '{CURRENT_DATE}'::DATE + INTERVAL 30 DAY")
        elif kpi == "overdue": where_clauses.append(f"{COL_MAP['due_date']} < '{CURRENT_DATE}' AND {COL_MAP['payment_status']} != 'Paid'")
        elif kpi == "pending_boe": where_clauses.append(f"{COL_MAP['boe_status']} != 'Received'")

    if alert_type:
        if alert_type == "Expiry Risk": where_clauses.append(f"{COL_MAP['lc_status']} = 'Open' AND {COL_MAP['expiry_date']} BETWEEN '{CURRENT_DATE}' AND '{CURRENT_DATE}'::DATE + INTERVAL 15 DAY")
        elif alert_type == "Payment Due": where_clauses.append(f"{COL_MAP['payment_status']} != 'Paid' AND {COL_MAP['due_date']} BETWEEN '{CURRENT_DATE}' AND '{CURRENT_DATE}'::DATE + INTERVAL 7 DAY")
        elif alert_type == "BOE Overdue": where_clauses.append(f"{COL_MAP['boe_status']} != 'Received' AND date_diff('day', {COL_MAP['op_date']}, '{CURRENT_DATE}'::DATE) > 90")

    where_stmt = " WHERE " + " AND ".join(where_clauses) if where_clauses else ""
    query = f'SELECT * FROM LC {where_stmt} ORDER BY {COL_MAP["op_date"]} DESC LIMIT 1000'
    return fetch_dict(query)

@app.get("/api/v1/bank-exposure")
async def get_bank_exposure(currency: str = Query("INR"), fy: str = Query("All")):
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    return fetch_dict(f"SELECT {COL_MAP['bank']} as name, COUNT(*) as count, SUM({amt_col}) as value FROM LC WHERE 1=1 {fy_filter} GROUP BY 1 ORDER BY 3 DESC")

@app.get("/api/v1/supplier-exposure")
async def get_supplier_exposure(currency: str = Query("INR"), fy: str = Query("All")):
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    return fetch_dict(f"SELECT {COL_MAP['supplier']} as name, COUNT(*) as count, SUM({amt_col}) as value FROM LC WHERE 1=1 {fy_filter} GROUP BY 1 ORDER BY 3 DESC LIMIT 20")

@app.get("/api/v1/boe-monitoring")
async def get_boe_monitoring(currency: str = Query("INR"), fy: str = Query("All")):
    boe_pending_col = COL_MAP["boe_pending_inr"] if currency == "INR" else COL_MAP["boe_pending_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    
    status_query = f"SELECT {COL_MAP['boe_status']} as status, COUNT(*) as count, SUM({boe_pending_col}) as value FROM LC WHERE {COL_MAP['boe_status']} IS NOT NULL {fy_filter} GROUP BY 1"
    aging_query = f"""
        SELECT 
            CASE 
                WHEN date_diff('day', {COL_MAP['op_date']}, '{CURRENT_DATE}'::DATE) <= 30 THEN '0-30 Days'
                WHEN date_diff('day', {COL_MAP['op_date']}, '{CURRENT_DATE}'::DATE) <= 60 THEN '31-60 Days'
                WHEN date_diff('day', {COL_MAP['op_date']}, '{CURRENT_DATE}'::DATE) <= 90 THEN '61-90 Days'
                ELSE '90+ Days'
            END as bucket,
            SUM({boe_pending_col}) as value, COUNT(*) as count
        FROM LC WHERE {COL_MAP['boe_status']} != 'Received' {fy_filter} GROUP BY 1 ORDER BY bucket
    """
    return {"status_breakdown": fetch_dict(status_query), "aging_buckets": fetch_dict(aging_query)}

@app.get("/api/v1/shipment-tracking")
async def get_shipment_tracking(currency: str = Query("INR"), fy: str = Query("All")):
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    
    query = f"""
        SELECT 
            SUM(CASE WHEN {COL_MAP['shipment_date']} > '{CURRENT_DATE}' THEN 1 ELSE 0 END) as pending_count,
            SUM(CASE WHEN {COL_MAP['shipment_date']} <= '{CURRENT_DATE}' THEN 1 ELSE 0 END) as completed_count,
            SUM(CASE WHEN "Material Receipt Date" > {COL_MAP['shipment_date']} THEN 1 ELSE 0 END) as delayed_count,
            SUM(CASE WHEN {COL_MAP['expiry_date']} < '{CURRENT_DATE}' AND {COL_MAP['shipment_date']} IS NULL THEN 1 ELSE 0 END) as expired_count
        FROM LC WHERE 1=1 {fy_filter}
    """
    return fetch_dict(query)[0]

@app.get("/api/v1/cash-flow-forecast")
async def get_cash_flow_forecast(currency: str = Query("INR"), fy: str = Query("All")):
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['due_date'])
    
    # Adding statistical variance (± 12% standard deviation estimate for the confidence interval)
    # In a real model, this would be stddev of historical monthly forecast accuracy
    query = f"""
        WITH MonthlyData AS (
            SELECT 
                "LC Payment Due Month" as month,
                MIN({COL_MAP['due_date']}) as sort_date,
                SUM({amt_col}) as monthly_value
            FROM LC 
            WHERE {COL_MAP['due_date']} >= '{CURRENT_DATE}'::DATE {fy_filter}
            GROUP BY 1
        )
        SELECT 
            month, 
            monthly_value,
            monthly_value * 0.88 as confidence_lower,
            monthly_value * 1.12 as confidence_upper,
            SUM(monthly_value) OVER (ORDER BY sort_date) as cumulative_value
        FROM MonthlyData
        ORDER BY sort_date
        LIMIT 12
    """
    return fetch_dict(query)

@app.get("/api/v1/treasury-radar")
async def get_treasury_radar(currency: str = Query("INR"), fy: str = Query("All")):
    # Normalizes 6 vectors to a 0-100 scale for the radar chart
    # 1. Liquidity Stress (Value of Due Payments vs Total Exposure)
    # 2. Limit Utilization (Used Limit vs Max Limit)
    # 3. FX Exposure (Total FC Value unhedged)
    # 4. Supplier Risk (Pending BOE Value)
    # 5. Expiry Risk (Value of LCs expiring in 30 days)
    # 6. Operational Delay (Overdue BOEs)
    
    amt_col = COL_MAP["amt_inr"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    where = f"WHERE 1=1 {fy_filter}"
    
    # A single heavy query to fetch raw denominators
    raw_data = fetch_dict(f"""
        WITH Limits AS (
            SELECT COALESCE(SUM(CAST(NULLIF(REPLACE("Limit", ',', ''), '') AS DOUBLE)), 1) as total_limit FROM DD WHERE Table_8 = 'Bank' AND Element_8 != ''
        )
        SELECT 
            (SELECT SUM({amt_col}) FROM LC {where}) as total_exposure,
            (SELECT SUM({amt_col}) FROM LC {where} AND {COL_MAP['lc_status']}='Open') as open_exposure,
            (SELECT SUM({COL_MAP['amt_fc']}) FROM LC {where} AND {COL_MAP['lc_status']}='Open' AND "Currency" != 'INR') as fx_exposure,
            (SELECT SUM({amt_col}) FROM LC {where} AND {COL_MAP['due_date']} <= '{CURRENT_DATE}'::DATE + INTERVAL 15 DAY) as liquidity_stress,
            (SELECT SUM({amt_col}) FROM LC {where} AND {COL_MAP['expiry_date']} <= '{CURRENT_DATE}'::DATE + INTERVAL 30 DAY AND {COL_MAP['lc_status']}='Open') as expiry_risk,
            (SELECT SUM({COL_MAP['boe_pending_inr']}) FROM LC {where} AND {COL_MAP['boe_status']} != 'Received') as supplier_risk,
            (SELECT SUM({COL_MAP['boe_pending_inr']}) FROM LC {where} AND {COL_MAP['boe_status']} != 'Received' AND date_diff('day', {COL_MAP['op_date']}, '{CURRENT_DATE}'::DATE) > 60) as op_delay,
            (SELECT total_limit FROM Limits) as max_limit
    """)[0]
    
    # Normalization (0-100)
    # Higher value = Higher Risk
    total_exposure = raw_data['total_exposure'] or 1
    max_limit = raw_data['max_limit'] or 1
    
    utilization_score = min(100, ((raw_data['open_exposure'] or 0) / max_limit) * 100)
    liquidity_score = min(100, ((raw_data['liquidity_stress'] or 0) / total_exposure) * 200) # 50% due = 100 risk
    fx_score = min(100, ((raw_data['fx_exposure'] or 0) / (total_exposure/83.5)) * 100) # FC exposure %
    supplier_score = min(100, ((raw_data['supplier_risk'] or 0) / total_exposure) * 150)
    expiry_score = min(100, ((raw_data['expiry_risk'] or 0) / total_exposure) * 300)
    op_score = min(100, ((raw_data['op_delay'] or 0) / total_exposure) * 250)

    return [
        {"subject": "Liquidity Stress", "A": round(liquidity_score), "fullMark": 100},
        {"subject": "Limit Exhaustion", "A": round(utilization_score), "fullMark": 100},
        {"subject": "FX Volatility", "A": round(fx_score), "fullMark": 100},
        {"subject": "Supplier Delay", "A": round(supplier_score), "fullMark": 100},
        {"subject": "Expiry Breach", "A": round(expiry_score), "fullMark": 100},
        {"subject": "Operational Ops", "A": round(op_score), "fullMark": 100}
    ]

@app.get("/api/v1/lifecycle-tracker")
async def get_lifecycle_tracker(fy: str = Query("All")):
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    query = f"""
        SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN {COL_MAP['shipment_date']} <= '{CURRENT_DATE}' THEN 1 END) as shipped,
            COUNT(CASE WHEN "DOCUMENTS RECEIVED" = 'YES' THEN 1 END) as docs_received,
            COUNT(CASE WHEN "Bill Lodge date" IS NOT NULL THEN 1 END) as bill_lodged,
            COUNT(CASE WHEN "Bill Acceptance date" IS NOT NULL THEN 1 END) as bill_accepted,
            COUNT(CASE WHEN {COL_MAP['payment_status']} = 'Paid' THEN 1 END) as paid,
            COUNT(CASE WHEN {COL_MAP['lc_status']} = 'Closed' THEN 1 END) as closed
        FROM LC WHERE 1=1 {fy_filter}
    """
    stats = fetch_dict(query)[0]
    return [
        {"stage": "Open LC", "count": stats['total']},
        {"stage": "Shipment Done", "count": stats['shipped']},
        {"stage": "Docs Received", "count": stats['docs_received']},
        {"stage": "Bill Lodged", "count": stats['bill_lodged']},
        {"stage": "Bill Accepted", "count": stats['bill_accepted']},
        {"stage": "Payment Done", "count": stats['paid']},
        {"stage": "LC Closed", "count": stats['closed']}
    ]

@app.get("/api/v1/risk-alerts")
async def get_risk_alerts(fy: str = Query("All")):
    alerts = []
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    
    expiring_soon = fetch_dict(f"SELECT {COL_MAP['lc_no']} as id, {COL_MAP['expiry_date']} as date, {COL_MAP['supplier']} as supplier FROM LC WHERE {COL_MAP['lc_status']} = 'Open' AND {COL_MAP['expiry_date']} BETWEEN '{CURRENT_DATE}' AND '{CURRENT_DATE}'::DATE + INTERVAL 15 DAY {fy_filter}")
    for item in expiring_soon: alerts.append({"priority": "HIGH", "type": "Expiry Risk", "message": f"LC {item['id']} for {item['supplier']} expires on {item['date']}", "id": item['id']})
        
    payment_due = fetch_dict(f"SELECT {COL_MAP['lc_no']} as id, {COL_MAP['due_date']} as date, {COL_MAP['supplier']} as supplier FROM LC WHERE {COL_MAP['payment_status']} != 'Paid' AND {COL_MAP['due_date']} BETWEEN '{CURRENT_DATE}' AND '{CURRENT_DATE}'::DATE + INTERVAL 7 DAY {get_fy_clause(fy, COL_MAP['due_date'])}")
    for item in payment_due: alerts.append({"priority": "HIGH", "type": "Payment Due", "message": f"Payment of LC {item['id']} due in {item['date']}", "id": item['id']})
        
    boe_overdue = fetch_dict(f"SELECT {COL_MAP['lc_no']} as id, {COL_MAP['supplier']} as supplier FROM LC WHERE {COL_MAP['boe_status']} != 'Received' AND date_diff('day', {COL_MAP['op_date']}, '{CURRENT_DATE}'::DATE) > 90 {fy_filter}")
    for item in boe_overdue: alerts.append({"priority": "MEDIUM", "type": "BOE Overdue", "message": f"BOE for LC {item['id']} is overdue (>90 days)", "id": item['id']})

    return alerts

@app.get("/api/v1/strategic-intelligence")
async def get_strategic_intelligence(currency: str = Query("INR"), fy: str = Query("All")):
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    where = f"WHERE 1=1 {fy_filter}"

    # 1. Cost of Capital / Yield Optimization (Assume 7% market yield on locked FD)
    fd_query = fetch_dict(f"SELECT SUM({COL_MAP['margin_fd']}) as locked_fd FROM LC {where}")[0]
    locked_fd = fd_query['locked_fd'] or 0
    yield_lost = locked_fd * 0.07 # Annualized estimate
    
    # Cost of Inefficiency Components
    # a) Delayed BOE Working Capital lock
    delayed_boe_val = fetch_dict(f"SELECT SUM({COL_MAP['boe_pending_inr']}) as val FROM LC {where} AND {COL_MAP['boe_status']} != 'Received' AND date_diff('day', {COL_MAP['op_date']}, '{CURRENT_DATE}'::DATE) > 60")[0]['val'] or 0
    # b) Delayed Payment Penalty (Assuming 12% penal interest annualized on overdue)
    overdue_payment_val = fetch_dict(f"SELECT SUM({COL_MAP['amt_inr']}) as val FROM LC {where} AND {COL_MAP['payment_status']} != 'Paid' AND {COL_MAP['due_date']} < '{CURRENT_DATE}'::DATE")[0]['val'] or 0
    
    inefficiency_cost = (delayed_boe_val * 0.10) + (overdue_payment_val * 0.12) + yield_lost

    # 2. Supplier Reliability (Avg Days: Shipment to BOE Submitted)
    reliability = fetch_dict(f"""
        SELECT {COL_MAP['supplier']} as supplier, 
               AVG(date_diff('day', {COL_MAP['shipment_date']}, {COL_MAP['boe_date']})) as avg_delay_days,
               COUNT(*) as tx_count
        FROM LC {where} AND {COL_MAP['boe_date']} IS NOT NULL AND {COL_MAP['shipment_date']} IS NOT NULL
        GROUP BY 1 HAVING COUNT(*) > 1 ORDER BY 2 DESC LIMIT 5
    """)

    # 3. Bank Utilization & Limit Exhaustion (Using DD table for limits)
    utilization = fetch_dict(f"""
        SELECT 
            LC.{COL_MAP['bank']} as bank, 
            SUM(LC.{amt_col}) as used_limit, 
            COALESCE(MAX(CAST(NULLIF(REPLACE(DD."Limit", ',', ''), '') AS DOUBLE)), 0) as max_limit
        FROM LC
        LEFT JOIN DD ON TRIM(UPPER(LC.{COL_MAP['bank']})) = TRIM(UPPER(DD.Element_8)) AND DD.Table_8 = 'Bank'
        {where} AND LC.{COL_MAP['lc_status']} = 'Open'
        GROUP BY 1 ORDER BY 2 DESC
    """)

    # 4. Tolerance Tracking
    tolerance = fetch_dict(f"SELECT SUM({COL_MAP['tolerance']}) as total_variance FROM LC {where}")[0]

    # 5. Cash Runway & Treasury Health Score (Using limits from DD table)
    runway_data = fetch_dict(f"""
        WITH BankLimits AS (
            SELECT COALESCE(SUM(CAST(NULLIF(REPLACE("Limit", ',', ''), '') AS DOUBLE)), 0) as total_limit
            FROM DD WHERE Table_8 = 'Bank' AND Element_8 != ''
        )
        SELECT 
            (SELECT SUM(CASE WHEN {COL_MAP['lc_status']} = 'Open' THEN {amt_col} ELSE 0 END) FROM LC {where}) as open_lc_val,
            (SELECT total_limit FROM BankLimits) as approx_total_limit
    """)[0]
    
    daily_avg_burn = fetch_dict(f"""
        SELECT SUM({amt_col}) / GREATEST(1, count(DISTINCT {COL_MAP['op_date']})) as avg_burn 
        FROM LC {where} AND {COL_MAP['lc_status']} = 'Closed'
    """)[0]['avg_burn'] or 1

    total_limit = runway_data['approx_total_limit'] or 0
    open_val = runway_data['open_lc_val'] or 0
    rem_limit = max(0, total_limit - open_val)
    cash_runway_days = rem_limit / daily_avg_burn if daily_avg_burn > 0 else 999
    
    # Calculate rough health score
    health_score = 100
    util_pct = (open_val / total_limit * 100) if total_limit > 0 else 0
    if util_pct > 80: health_score -= 15
    elif util_pct > 60: health_score -= 5
    
    if cash_runway_days < 30: health_score -= 20
    elif cash_runway_days < 60: health_score -= 10
    
    # Overdue BOEs impact
    overdue_boes = fetch_dict(f"SELECT COUNT(*) as c FROM LC WHERE {COL_MAP['boe_status']} != 'Received' AND date_diff('day', {COL_MAP['op_date']}, '{CURRENT_DATE}'::DATE) > 90 {fy_filter}")[0]['c']
    if overdue_boes > 5: health_score -= 15
    elif overdue_boes > 0: health_score -= 5

    # 6. Advanced Quant: Expected FX Loss
    fx_exposure = fetch_dict(f"SELECT SUM({COL_MAP['amt_inr']}) as val FROM LC {where} AND {COL_MAP['lc_status']} = 'Open' AND \"Currency\" != 'INR'")[0]['val'] or 0
    expected_fx_loss = fx_exposure * 0.03 # 3% volatility buffer estimate
    
    # 7. Advanced Quant: Probability of Liquidity Stress
    prob_liquidity_stress = min(99, max(1, (100 - health_score) * 1.2))

    # 8. LC Closure Prediction (Avg days to close)
    avg_close_days = fetch_dict(f"SELECT AVG(date_diff('day', {COL_MAP['op_date']}, {COL_MAP['expiry_date']})) as avg_days FROM LC {where} AND {COL_MAP['lc_status']} = 'Closed'")[0]['avg_days'] or 90
    
    # 9. LC Demand Forecasting (Simple 30-day moving average volume projection)
    demand_forecast = fetch_dict(f"SELECT SUM({amt_col}) as monthly_vol FROM LC {where} AND {COL_MAP['op_date']} >= '{CURRENT_DATE}'::DATE - INTERVAL 30 DAY")[0]['monthly_vol'] or 0

    # 10. Bank Dependency Risk (Herfindahl-Hirschman index simplified to Top Bank %)
    top_bank_val = utilization[0]['used_limit'] if utilization else 0
    dependency_risk_pct = (top_bank_val / open_val * 100) if open_val > 0 else 0

    # 11. Future Cash Stress Window (Rolling 7-day highest outflow)
    stress_window = fetch_dict(f"""
        WITH DailyOutflows AS (
            SELECT {COL_MAP['due_date']} as d_date, SUM({amt_col}) as val
            FROM LC {where} AND {COL_MAP['due_date']} >= '{CURRENT_DATE}'::DATE
            GROUP BY 1
        )
        SELECT d_date as start_date, 
               SUM(val) OVER (ORDER BY d_date ROWS BETWEEN CURRENT ROW AND 6 FOLLOWING) as rolling_7d_outflow
        FROM DailyOutflows
        ORDER BY rolling_7d_outflow DESC NULLS LAST
        LIMIT 1
    """)
    stress_window_start = stress_window[0]['start_date'] if stress_window else "N/A"
    stress_window_val = stress_window[0]['rolling_7d_outflow'] if stress_window else 0

    return {
        "health_score": max(0, min(100, health_score)),
        "cash_runway_days": cash_runway_days,
        "remaining_limit": rem_limit,
        "yield_optimization": {
            "locked_fd": locked_fd, 
            "est_yield_lost_annual": yield_lost,
            "cost_of_inefficiency": inefficiency_cost,
            "expected_fx_loss": expected_fx_loss,
            "prob_liquidity_stress": prob_liquidity_stress,
            "working_capital_unlock": inefficiency_cost + locked_fd
        },
        "supplier_reliability": reliability,
        "bank_utilization": utilization,
        "tolerance_variance": tolerance['total_variance'] or 0,
        "quant_models": {
            "lc_closure_avg_days": avg_close_days,
            "lc_demand_forecast_30d": demand_forecast,
            "bank_dependency_risk_pct": dependency_risk_pct,
            "stress_window_start": stress_window_start,
            "stress_window_val": stress_window_val
        }
    }

@app.get("/api/v1/advanced-quant")
async def get_advanced_quant(currency: str = Query("INR"), fy: str = Query("All")):
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    where = f"WHERE 1=1 {fy_filter}"
    
    # Early Warning Index (EWI)
    # Composites: Upcoming expiries, delayed BOEs, high concentration, short cash runway
    runway_data = fetch_dict(f"""
        WITH BankLimits AS (
            SELECT COALESCE(SUM(CAST(NULLIF(REPLACE("Limit", ',', ''), '') AS DOUBLE)), 0) as total_limit
            FROM DD WHERE Table_8 = 'Bank' AND Element_8 != ''
        )
        SELECT 
            (SELECT SUM(CASE WHEN {COL_MAP['lc_status']} = 'Open' THEN {amt_col} ELSE 0 END) FROM LC {where}) as open_lc_val,
            (SELECT total_limit FROM BankLimits) as approx_total_limit
    """)[0]
    
    total_limit = runway_data['approx_total_limit'] or 1
    open_val = runway_data['open_lc_val'] or 0
    utilization = min(1.0, open_val / total_limit)
    
    overdue_boe_val = fetch_dict(f"SELECT SUM({COL_MAP['boe_pending_inr']}) as val FROM LC {where} AND {COL_MAP['boe_status']} != 'Received' AND date_diff('day', {COL_MAP['op_date']}, '{CURRENT_DATE}'::DATE) > 60")[0]['val'] or 0
    
    ewi_score = min(100, (utilization * 50) + ((overdue_boe_val / max(open_val, 1)) * 50))
    
    # Network Analysis (Bank -> Supplier flows)
    network_data = fetch_dict(f"""
        SELECT {COL_MAP['bank']} as source, {COL_MAP['supplier']} as target, SUM({amt_col}) as value
        FROM LC {where} AND {COL_MAP['lc_status']} = 'Open'
        GROUP BY 1, 2
        ORDER BY 3 DESC
        LIMIT 15
    """)
    
    # Liquidity at Risk (LAR) - 95% Confidence Interval of worst-case 30-day outflow
    # Rough estimate: Average 30-day flow + 1.645 * StdDev
    # Simplified here to 1.5 * Average Monthly Outflow
    monthly_flows = fetch_dict(f"""
        SELECT date_trunc('month', {COL_MAP['due_date']}) as m, SUM({amt_col}) as flow
        FROM LC {where}
        GROUP BY 1
    """)
    flows = [x['flow'] for x in monthly_flows if x['flow']]
    avg_flow = sum(flows) / len(flows) if flows else 0
    lar_95 = avg_flow * 1.5 
    
    # Stress Test Scenarios
    # Baseline: Current open
    # Scenario A (Mild): INR depreciates 5%
    # Scenario B (Severe): INR drops 10%, Limits cut by 20%
    fc_exposure = fetch_dict(f"SELECT SUM({COL_MAP['amt_inr']}) as val FROM LC {where} AND {COL_MAP['lc_status']} = 'Open' AND \"Currency\" != 'INR'")[0]['val'] or 0
    inr_exposure = open_val - fc_exposure
    
    stress_tests = [
        {"scenario": "Baseline", "exposure": open_val, "limit": total_limit, "utilization": utilization * 100},
        {"scenario": "Mild (FX +5%)", "exposure": inr_exposure + (fc_exposure * 1.05), "limit": total_limit, "utilization": ((inr_exposure + (fc_exposure * 1.05)) / total_limit) * 100},
        {"scenario": "Severe (FX +10%, Limit -20%)", "exposure": inr_exposure + (fc_exposure * 1.10), "limit": total_limit * 0.8, "utilization": ((inr_exposure + (fc_exposure * 1.10)) / (total_limit * 0.8)) * 100}
    ]

    return {
        "early_warning_index": ewi_score,
        "liquidity_at_risk": lar_95,
        "network": network_data,
        "stress_tests": stress_tests
    }

@app.get("/api/v1/advanced-quant")
async def get_advanced_quant(currency: str = Query("INR"), fy: str = Query("All")):
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    where = f"WHERE 1=1 {fy_filter}"
    
    # Early Warning Index (EWI)
    runway_data = fetch_dict(f"""
        WITH BankLimits AS (
            SELECT COALESCE(SUM(CAST(NULLIF(REPLACE("Limit", ',', ''), '') AS DOUBLE)), 0) as total_limit
            FROM DD WHERE Table_8 = 'Bank' AND Element_8 != ''
        )
        SELECT 
            (SELECT SUM(CASE WHEN {COL_MAP['lc_status']} = 'Open' THEN {amt_col} ELSE 0 END) FROM LC {where}) as open_lc_val,
            (SELECT total_limit FROM BankLimits) as approx_total_limit
    """)[0]
    
    total_limit = runway_data['approx_total_limit'] or 1
    open_val = runway_data['open_lc_val'] or 0
    utilization = min(1.0, open_val / total_limit)
    
    overdue_boe_val = fetch_dict(f"SELECT SUM({COL_MAP['boe_pending_inr']}) as val FROM LC {where} AND {COL_MAP['boe_status']} != 'Received' AND date_diff('day', {COL_MAP['op_date']}, '{CURRENT_DATE}'::DATE) > 60")[0]['val'] or 0
    
    ewi_score = min(100, (utilization * 50) + ((overdue_boe_val / max(open_val, 1)) * 50))
    
    # Network Analysis (Bank -> Supplier flows)
    network_data = fetch_dict(f"""
        SELECT {COL_MAP['bank']} as source, {COL_MAP['supplier']} as target, SUM({amt_col}) as value
        FROM LC {where} AND {COL_MAP['lc_status']} = 'Open'
        GROUP BY 1, 2
        ORDER BY 3 DESC
        LIMIT 15
    """)
    
    # Liquidity at Risk (LAR)
    monthly_flows = fetch_dict(f"""
        SELECT date_trunc('month', {COL_MAP['due_date']}) as m, SUM({amt_col}) as flow
        FROM LC {where}
        GROUP BY 1
    """)
    flows = [x['flow'] for x in monthly_flows if x['flow']]
    avg_flow = sum(flows) / len(flows) if flows else 0
    lar_95 = avg_flow * 1.5 
    
    # Stress Test Scenarios
    fc_exposure = fetch_dict(f"SELECT SUM({COL_MAP['amt_inr']}) as val FROM LC {where} AND {COL_MAP['lc_status']} = 'Open' AND \"Currency\" != 'INR'")[0]['val'] or 0
    inr_exposure = open_val - fc_exposure
    
    stress_tests = [
        {"scenario": "Baseline", "exposure": open_val, "limit": total_limit, "utilization": utilization * 100},
        {"scenario": "Mild (FX +5%)", "exposure": inr_exposure + (fc_exposure * 1.05), "limit": total_limit, "utilization": ((inr_exposure + (fc_exposure * 1.05)) / total_limit) * 100},
        {"scenario": "Severe (FX +10%, Limit -20%)", "exposure": inr_exposure + (fc_exposure * 1.10), "limit": total_limit * 0.8, "utilization": ((inr_exposure + (fc_exposure * 1.10)) / (total_limit * 0.8)) * 100}
    ]

    return {
        "early_warning_index": ewi_score,
        "liquidity_at_risk": lar_95,
        "network": network_data,
        "stress_tests": stress_tests
    }

@app.get("/api/v1/pe-treasury")
async def get_pe_treasury():
    # 1. Debt Maturity Wall
    debt_maturity = fetch_dict("SELECT * FROM DEBT_MATURITY ORDER BY year")
    
    # 2. Yield Curve
    yield_curve = fetch_dict("SELECT * FROM YIELD_CURVE")
    
    # 3. Capital Stack
    capital_stack = fetch_dict("SELECT * FROM CAPITAL_STACK")
    
    # 4. Return on Treasury Capital (ROTC) & Value Creation
    # Synthetic metrics representing PE-style savings tracking
    value_creation = {
        "working_capital_released": 450, # Cr
        "debt_reduced": 120, # Cr
        "treasury_savings": 25.5, # Cr
        "interest_savings": 14.2, # Cr
        "fx_savings": 8.1, # Cr
        "bank_charge_optimization": 3.2 # Cr
    }
    
    # 5. Liquidity Index
    liquidity_index = {
        "rbi_liquidity_deficit": "₹1.2 Lakh Cr",
        "banking_system_liquidity": "Tight",
        "money_market_rates": "6.75% - 7.10%",
        "yield_curve_shape": "Normal", # Normal, Flat, Inverted, Steepening
        "treasury_implication": "Borrow long-term to lock in current yields before tightening."
    }

    return {
        "debt_maturity": debt_maturity,
        "yield_curve": yield_curve,
        "capital_stack": capital_stack,
        "value_creation": value_creation,
        "liquidity_index": liquidity_index
    }

@app.get("/api/v1/transactions")
async def get_transactions(fy: str = Query("All")):
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    query = f"""
        SELECT LC.*,
        CASE
            WHEN {COL_MAP['lc_status']} = 'Open' AND {COL_MAP['expiry_date']} BETWEEN '{CURRENT_DATE}' AND '{CURRENT_DATE}'::DATE + INTERVAL 15 DAY THEN 'Expiry Risk'
            WHEN {COL_MAP['payment_status']} != 'Paid' AND {COL_MAP['due_date']} BETWEEN '{CURRENT_DATE}' AND '{CURRENT_DATE}'::DATE + INTERVAL 7 DAY THEN 'Payment Due'
            WHEN {COL_MAP['boe_status']} != 'Received' AND date_diff('day', {COL_MAP['op_date']}, '{CURRENT_DATE}'::DATE) > 90 THEN 'BOE Overdue'
            ELSE 'Safe'
        END as risk_flag
        FROM LC WHERE 1=1 {fy_filter} ORDER BY {COL_MAP["op_date"]} DESC
    """
    return fetch_dict(query)

@app.post("/api/v1/ai-copilot")
async def ai_copilot(query: str = Body(..., embed=True)):
    query_lc = query.lower()
    if "expiring" in query_lc:
        data = fetch_dict(f'SELECT {COL_MAP["lc_no"]} as id, {COL_MAP["supplier"]} as supplier, {COL_MAP["expiry_date"]} as date FROM LC WHERE {COL_MAP["lc_status"]} = \'Open\' AND {COL_MAP["expiry_date"]} BETWEEN \'{CURRENT_DATE}\' AND \'{CURRENT_DATE}\'::DATE + INTERVAL 30 DAY')
        return {"answer": f"Found {len(data)} LCs expiring in the next 30 days.", "data": data}
    if "bank" in query_lc and "highest" in query_lc:
        data = fetch_one(f'SELECT {COL_MAP["bank"]}, SUM({COL_MAP["amt_inr"]}) FROM LC GROUP BY 1 ORDER BY 2 DESC LIMIT 1')
        return {"answer": f"The bank with the highest exposure is {data[0]} with a total of INR {data[1]:,.2f}.", "data": {"bank": data[0], "value": data[1]}}
    if "supplier" in query_lc:
        data = fetch_dict(f'SELECT {COL_MAP["supplier"]}, COUNT(*) as count FROM LC GROUP BY 1 ORDER BY 2 DESC LIMIT 5')
        return {"answer": "Here are your top 5 suppliers by transaction count.", "data": data}
    return {
        "answer": "I'm the LC Command Center Assistant. I can help you with queries about expiring LCs, bank exposure, or supplier concentrations.",
        "data": None
    }

@app.get("/")
async def root(): return {"message": "LC Analytics API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
