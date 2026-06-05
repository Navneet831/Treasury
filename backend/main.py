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
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    base_where = f"WHERE EXTRACT(MONTH FROM {COL_MAP['op_date']}) = {month} AND EXTRACT(YEAR FROM {COL_MAP['op_date']}) = {year} {fy_filter}"
    
    return {
        "daily_summary": fetch_dict(f"SELECT {COL_MAP['op_date']} as date, SUM(CASE WHEN {COL_MAP['lc_status']} = 'Open' THEN {amt_col} ELSE 0 END) as opened_value, SUM(CASE WHEN {COL_MAP['lc_status']} = 'Closed' THEN {amt_col} ELSE 0 END) as closed_value, SUM({amt_col}) as total_value FROM LC {base_where} GROUP BY 1 ORDER BY 1"),
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
        FROM LC WHERE {COL_MAP['boe_status']} != 'Received' AND {boe_pending_col} > 0 {fy_filter} GROUP BY 1 ORDER BY bucket
    """
    return {"status_breakdown": fetch_dict(status_query), "aging_buckets": fetch_dict(aging_query)}

@app.get("/api/v1/cash-flow-forecast")
async def get_cash_flow_forecast(currency: str = Query("INR"), fy: str = Query("All")):
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['due_date'])
    return fetch_dict(f"SELECT \"LC Payment Due Month\" as month, SUM({amt_col}) as monthly_value, SUM(SUM({amt_col})) OVER (ORDER BY MIN({COL_MAP['due_date']})) as cumulative_value FROM LC WHERE {COL_MAP['due_date']} >= '{CURRENT_DATE}'::DATE {fy_filter} GROUP BY 1 ORDER BY MIN({COL_MAP['due_date']}) LIMIT 12")

@app.get("/api/v1/lifecycle-tracker")
async def get_lifecycle_tracker(fy: str = Query("All")):
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    query = f"""
        SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN {COL_MAP['shipment_date']} <= '2026-06-05' THEN 1 END) as shipped,
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
    
    # 2. Supplier Reliability (Avg Days: Shipment to BOE Submitted)
    reliability = fetch_dict(f"""
        SELECT {COL_MAP['supplier']} as supplier, 
               AVG(date_diff('day', {COL_MAP['shipment_date']}, {COL_MAP['boe_date']})) as avg_delay_days,
               COUNT(*) as tx_count
        FROM LC {where} AND {COL_MAP['boe_date']} IS NOT NULL AND {COL_MAP['shipment_date']} IS NOT NULL
        GROUP BY 1 HAVING COUNT(*) > 1 ORDER BY 2 DESC LIMIT 5
    """)

    # 3. Bank Utilization
    utilization = fetch_dict(f"""
        SELECT {COL_MAP['bank']} as bank, SUM({amt_col}) as used_limit, MAX({COL_MAP['limit_avail']}) as max_limit
        FROM LC {where} AND {COL_MAP['lc_status']} = 'Open'
        GROUP BY 1 ORDER BY 2 DESC
    """)

    # 4. Tolerance Tracking
    tolerance = fetch_dict(f"SELECT SUM({COL_MAP['tolerance']}) as total_variance FROM LC {where}")[0]

    return {
        "yield_optimization": {"locked_fd": locked_fd, "est_yield_lost_annual": yield_lost},
        "supplier_reliability": reliability,
        "bank_utilization": utilization,
        "tolerance_variance": tolerance['total_variance'] or 0
    }

@app.get("/api/v1/transactions")
async def get_transactions(fy: str = Query("All")):
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    return fetch_dict(f'SELECT * FROM LC WHERE 1=1 {fy_filter} ORDER BY {COL_MAP["op_date"]} DESC')

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
