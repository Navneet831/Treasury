from fastapi import FastAPI, Query, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import Optional
import os
import sys
from pathlib import Path
from database import fetch_dict, fetch_one
from datetime import datetime, date
import math
from prometheus_fastapi_instrumentator import Instrumentator

app = FastAPI(title="LC Analytics API")

Instrumentator().instrument(app).expose(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────────────────
# Dynamic current date — always reflects today, not hardcoded
# ──────────────────────────────────────────────────────────
def get_current_date() -> str:
    return date.today().isoformat()

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
    "tolerance": '"Tolerance Amt /Reduction Amt"',
    "currency": '"Currency"',
    "material_date": '"Material Receipt Date"',
    "bill_lodge": '"Bill Lodge date"',
    "bill_accept": '"Bill Acceptance date"',
    "docs_received": '"DOCUMENTS RECEIVED"',
    "rate": '"RATE"',
}

# ──────────────────────────────────────────────────────────
# Whitelist for SQL injection mitigation on drill-down filters
# ──────────────────────────────────────────────────────────
ALLOWED_STATUS = {"Open", "Closed", "Cancelled", "Expired"}
ALLOWED_BOE_STATUS = {"Received", "Not Received", "Pending", "Accepted"}
ALLOWED_PAYMENT_STATUS = {"Paid", "Unpaid", "Pending"}

def get_config(key: str, default: float) -> float:
    """Helper to fetch config constants from DB."""
    try:
        res = fetch_one(f"SELECT value FROM APP_CONFIG WHERE key = '{key}'")
        return res[0] if res else default
    except:
        return default

def sanitize_string(val: Optional[str], allowed: set) -> Optional[str]:
    """Whitelist-based sanitizer for enum-like fields."""
    if val is None:
        return None
    if val in allowed:
        return val
    # For free-form strings (bank/supplier names), escape single quotes only
    return val.replace("'", "''")

def get_fy_clause(fy: str, date_col: str) -> str:
    if fy == "FY25-26":
        return f" AND {date_col} >= '2025-04-01' AND {date_col} <= '2026-03-31'"
    if fy == "FY26-27":
        return f" AND {date_col} >= '2026-04-01' AND {date_col} <= '2027-03-31'"
    return ""


# ══════════════════════════════════════════════════════════
# PAGE 1 — Executive Overview
# ══════════════════════════════════════════════════════════
@app.get("/api/v1/executive-overview")
async def get_executive_overview(currency: str = Query("INR"), fy: str = Query("All")):
    cd = get_current_date()
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    boe_pending_col = COL_MAP["boe_pending_inr"] if currency == "INR" else COL_MAP["boe_pending_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])

    stats = fetch_one(f"""
        SELECT
            COUNT(*) as total_count,
            SUM({amt_col}) as total_value,
            COUNT(DISTINCT {COL_MAP['bank']}) as active_banks,
            COUNT(DISTINCT {COL_MAP['supplier']}) as active_suppliers
        FROM LC WHERE ({COL_MAP['lc_status']} = 'Open' OR {COL_MAP['lc_status']} IS NULL) {fy_filter}
    """)

    # FIX: exclude already-paid LCs from upcoming/overdue sums
    upcoming_7 = fetch_one(f"""
        SELECT SUM({amt_col}) FROM LC
        WHERE {COL_MAP['due_date']} BETWEEN '{cd}' AND '{cd}'::DATE + INTERVAL 7 DAY
        AND ({COL_MAP['payment_status']} IS NULL OR {COL_MAP['payment_status']} != 'Paid')
        {get_fy_clause(fy, COL_MAP['due_date'])}
    """)[0] or 0

    upcoming_30 = fetch_one(f"""
        SELECT SUM({amt_col}) FROM LC
        WHERE {COL_MAP['due_date']} BETWEEN '{cd}' AND '{cd}'::DATE + INTERVAL 30 DAY
        AND ({COL_MAP['payment_status']} IS NULL OR {COL_MAP['payment_status']} != 'Paid')
        {get_fy_clause(fy, COL_MAP['due_date'])}
    """)[0] or 0

    overdue = fetch_one(f"""
        SELECT SUM({amt_col}) FROM LC
        WHERE {COL_MAP['due_date']} < '{cd}'
        AND ({COL_MAP['payment_status']} IS NULL OR {COL_MAP['payment_status']} != 'Paid')
        {get_fy_clause(fy, COL_MAP['due_date'])}
    """)[0] or 0

    pending_boe = fetch_one(f"""
        SELECT SUM({boe_pending_col}) FROM LC
        WHERE ({COL_MAP['boe_status']} IS NULL OR {COL_MAP['boe_status']} != 'Received')
        {fy_filter}
    """)[0] or 0

    expired = fetch_one(f"SELECT COUNT(*) FROM LC WHERE {COL_MAP['expiry_date']} < '{cd}' AND {COL_MAP['lc_status']} = 'Open' {fy_filter}")[0] or 0
    closing_this_month = fetch_one(f"SELECT COUNT(*) FROM LC WHERE date_trunc('month', {COL_MAP['expiry_date']}) = date_trunc('month', '{cd}'::DATE) {fy_filter}")[0] or 0

    # Enhanced: Treasury health score & limit KPIs
    limit_data = fetch_dict("""
        WITH BankLimits AS (
            SELECT COALESCE(SUM(CAST(NULLIF(REPLACE("Limit", ',', ''), '') AS DOUBLE)), 0) as total_limit
            FROM DD WHERE Table_8 = 'Bank' AND Element_8 != ''
        )
        SELECT total_limit FROM BankLimits
    """)
    total_limit = limit_data[0]['total_limit'] if limit_data else 0
    open_val = stats[1] or 0
    avail_limit = max(0, total_limit - open_val)
    util_pct = (open_val / total_limit * 100) if total_limit > 0 else 0

    # Health score: multi-factor (weighted)
    health = 100.0
    if util_pct > 90: health -= 25
    elif util_pct > 80: health -= 15
    elif util_pct > 60: health -= 5

    if overdue > 0:
        overdue_pct = (overdue / max(open_val, 1)) * 100
        health -= min(20, overdue_pct * 2)

    if expired > 5: health -= 15
    elif expired > 0: health -= 5

    if upcoming_7 > 0:
        liquidity_pressure = (upcoming_7 / max(open_val, 1)) * 100
        health -= min(10, liquidity_pressure)

    health = max(0, min(100, health))

    # Top bank concentration
    top_bank = fetch_one(f"""
        SELECT {COL_MAP['bank']}, SUM({amt_col}) as val
        FROM LC WHERE {COL_MAP['lc_status']} = 'Open' {fy_filter}
        GROUP BY 1 ORDER BY 2 DESC LIMIT 1
    """)
    top_bank_name = top_bank[0] if top_bank else "N/A"
    top_bank_val = top_bank[1] if top_bank else 0
    top_bank_pct = (top_bank_val / max(open_val, 1)) * 100 if top_bank else 0

    insights = [
        f"{stats[2] or 0} banks are active in current LC portfolio.",
    ]
    if upcoming_7 > 0:
        insights.append(f"{currency} {upcoming_7:,.0f} in payments due within the next 7 days.")
    else:
        insights.append("No payments due in next 7 days.")
    if expired > 0:
        insights.append(f"{expired} LCs have expired while still marked Open — immediate action required.")
    if top_bank_pct > 40:
        insights.append(f"⚠ {top_bank_name} carries {top_bank_pct:.1f}% of total exposure — concentration risk elevated.")
    if overdue > 0:
        insights.append(f"⚠ Overdue payments of {currency} {overdue:,.0f} pending — past maturity date.")

    return {
        "kpis": {
            "open_lc_value": open_val,
            "open_lc_count": stats[0],
            "active_banks": stats[2],
            "active_suppliers": stats[3],
            "upcoming_due_7d": upcoming_7,
            "upcoming_due_30d": upcoming_30,
            "overdue_payments": overdue,
            "pending_boe_value": pending_boe,
            "expired_lcs": expired,
            "lcs_closing_this_month": closing_this_month,
            "available_lc_limit": avail_limit,
            "limit_utilization_pct": round(util_pct, 1),
            "treasury_health_score": round(health, 1),
            "total_limit": total_limit,
        },
        "insights": insights,
        "top_bank_concentration": {
            "bank": top_bank_name,
            "value": top_bank_val,
            "pct": round(top_bank_pct, 1)
        }
    }


# ══════════════════════════════════════════════════════════
# PAGE 2 — Calendar
# ══════════════════════════════════════════════════════════
@app.get("/api/v1/calendar")
async def get_calendar_data(month: int, year: int, currency: str = Query("INR"), fy: str = Query("All")):
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    limit_col = COL_MAP["limit_avail"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    base_where = f"WHERE EXTRACT(MONTH FROM {COL_MAP['op_date']}) = {month} AND EXTRACT(YEAR FROM {COL_MAP['op_date']}) = {year} {fy_filter}"

    return {
        "daily_summary": fetch_dict(f"""
            SELECT {COL_MAP['op_date']} as date,
                SUM(CASE WHEN {COL_MAP['lc_status']} = 'Open' THEN {amt_col} ELSE 0 END) as opened_value,
                SUM(CASE WHEN {COL_MAP['lc_status']} = 'Closed' THEN {amt_col} ELSE 0 END) as closed_value,
                SUM({amt_col}) as total_value,
                SUM({limit_col}) as limit_balance
            FROM LC {base_where} GROUP BY 1 ORDER BY 1
        """),
        "bank_breakdown": fetch_dict(f"SELECT {COL_MAP['op_date']} as date, {COL_MAP['bank']} as bank, SUM({amt_col}) as value FROM LC {base_where} GROUP BY 1, 2"),
        "status_breakdown": fetch_dict(f"SELECT {COL_MAP['op_date']} as date, {COL_MAP['lc_status']} as status, SUM({amt_col}) as value FROM LC {base_where} GROUP BY 1, 2"),
        "boe_breakdown": fetch_dict(f"SELECT {COL_MAP['op_date']} as date, {COL_MAP['boe_status']} as boe_status, SUM({amt_col}) as value FROM LC {base_where} GROUP BY 1, 2"),
        "due_breakdown": fetch_dict(f"SELECT {COL_MAP['due_date']} as date, SUM({amt_col}) as due_value, COUNT(*) as due_count FROM LC WHERE EXTRACT(MONTH FROM {COL_MAP['due_date']}) = {month} AND EXTRACT(YEAR FROM {COL_MAP['due_date']}) = {year} {get_fy_clause(fy, COL_MAP['due_date'])} GROUP BY 1 ORDER BY 1"),
    }


# ══════════════════════════════════════════════════════════
# Drill Down
# ══════════════════════════════════════════════════════════
@app.get("/api/v1/drill-down")
async def get_drill_down(
    status: Optional[str] = None,
    bank: Optional[str] = None,
    boe_status: Optional[str] = None,
    date: Optional[str] = None,
    lifecycle_stage: Optional[str] = None,
    kpi: Optional[str] = None,
    alert_type: Optional[str] = None,
    fy: str = Query("All")
):
    cd = get_current_date()
    where_clauses = []

    fy_sql = get_fy_clause(fy, COL_MAP['op_date'])
    if fy_sql:
        where_clauses.append(fy_sql.replace(" AND ", "", 1))

    # SQL injection mitigation: sanitize inputs
    if status:
        safe_status = sanitize_string(status, ALLOWED_STATUS)
        where_clauses.append(f"{COL_MAP['lc_status']} = '{safe_status}'")
    if bank:
        safe_bank = sanitize_string(bank, set())  # Free-form, just escape quotes
        where_clauses.append(f"{COL_MAP['bank']} = '{safe_bank}'")
    if boe_status:
        safe_boe = sanitize_string(boe_status, ALLOWED_BOE_STATUS)
        where_clauses.append(f"{COL_MAP['boe_status']} = '{safe_boe}'")
    if date:
        # Validate date format
        try:
            datetime.strptime(date, "%Y-%m-%d")
            where_clauses.append(f"{COL_MAP['op_date']} = '{date}'")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    if lifecycle_stage:
        stage_map = {
            "Open LC": f"({COL_MAP['lc_status']} = 'Open' OR {COL_MAP['lc_status']} IS NULL)",
            "Shipment Done": f"{COL_MAP['shipment_date']} <= '{cd}'",
            "Docs Received": f"{COL_MAP['docs_received']} = 'YES'",
            "Bill Lodged": f"{COL_MAP['bill_lodge']} IS NOT NULL",
            "Bill Accepted": f"{COL_MAP['bill_accept']} IS NOT NULL",
            "Payment Done": f"{COL_MAP['payment_status']} = 'Paid'",
            "LC Closed": f"{COL_MAP['lc_status']} = 'Closed'",
        }
        if lifecycle_stage in stage_map:
            where_clauses.append(stage_map[lifecycle_stage])

    if kpi:
        kpi_map = {
            "open_lc": f"({COL_MAP['lc_status']} = 'Open' OR {COL_MAP['lc_status']} IS NULL)",
            "upcoming_7d": f"{COL_MAP['due_date']} BETWEEN '{cd}' AND '{cd}'::DATE + INTERVAL 7 DAY AND ({COL_MAP['payment_status']} IS NULL OR {COL_MAP['payment_status']} != 'Paid')",
            "upcoming_30d": f"{COL_MAP['due_date']} BETWEEN '{cd}' AND '{cd}'::DATE + INTERVAL 30 DAY AND ({COL_MAP['payment_status']} IS NULL OR {COL_MAP['payment_status']} != 'Paid')",
            "overdue": f"{COL_MAP['due_date']} < '{cd}' AND ({COL_MAP['payment_status']} IS NULL OR {COL_MAP['payment_status']} != 'Paid')",
            "pending_boe": f"({COL_MAP['boe_status']} IS NULL OR {COL_MAP['boe_status']} != 'Received')",
        }
        if kpi in kpi_map:
            where_clauses.append(kpi_map[kpi])

    if alert_type:
        alert_map = {
            "Expiry Risk": f"{COL_MAP['lc_status']} = 'Open' AND {COL_MAP['expiry_date']} BETWEEN '{cd}' AND '{cd}'::DATE + INTERVAL 15 DAY",
            "Payment Due": f"({COL_MAP['payment_status']} IS NULL OR {COL_MAP['payment_status']} != 'Paid') AND {COL_MAP['due_date']} BETWEEN '{cd}' AND '{cd}'::DATE + INTERVAL 7 DAY",
            "BOE Overdue": f"({COL_MAP['boe_status']} IS NULL OR {COL_MAP['boe_status']} != 'Received') AND date_diff('day', {COL_MAP['op_date']}, '{cd}'::DATE) > 90",
        }
        if alert_type in alert_map:
            where_clauses.append(alert_map[alert_type])

    where_stmt = " WHERE " + " AND ".join(where_clauses) if where_clauses else ""
    query = f'SELECT * FROM LC {where_stmt} ORDER BY {COL_MAP["op_date"]} DESC LIMIT 1000'
    return fetch_dict(query)


# ══════════════════════════════════════════════════════════
# PAGE 5 — Bank Exposure
# ══════════════════════════════════════════════════════════
@app.get("/api/v1/bank-exposure")
async def get_bank_exposure(currency: str = Query("INR"), fy: str = Query("All")):
    cd = get_current_date()
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    boe_col = COL_MAP["boe_pending_inr"] if currency == "INR" else COL_MAP["boe_pending_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    return fetch_dict(f"""
        SELECT
            {COL_MAP['bank']} as name,
            COUNT(*) as count,
            SUM({amt_col}) as value,
            SUM(CASE WHEN {COL_MAP['lc_status']} = 'Open' THEN {amt_col} ELSE 0 END) as open_value,
            SUM({boe_col}) as pending_boe,
            AVG({amt_col}) as avg_lc_size
        FROM LC WHERE 1=1 {fy_filter}
        GROUP BY 1 ORDER BY 3 DESC
    """)


# ══════════════════════════════════════════════════════════
# PAGE 6 — Supplier Analytics
# ══════════════════════════════════════════════════════════
@app.get("/api/v1/supplier-exposure")
async def get_supplier_exposure(currency: str = Query("INR"), fy: str = Query("All")):
    cd = get_current_date()
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    boe_col = COL_MAP["boe_pending_inr"] if currency == "INR" else COL_MAP["boe_pending_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    return fetch_dict(f"""
        SELECT
            {COL_MAP['supplier']} as name,
            COUNT(*) as count,
            SUM({amt_col}) as value,
            SUM({boe_col}) as pending_boe,
            AVG(date_diff('day', {COL_MAP['shipment_date']}, {COL_MAP['material_date']})) as avg_shipment_delay_days,
            AVG(date_diff('day', {COL_MAP['op_date']}, {COL_MAP['bill_accept']})) as avg_payment_cycle_days
        FROM LC WHERE 1=1 {fy_filter}
        GROUP BY 1 ORDER BY 3 DESC LIMIT 20
    """)


# ══════════════════════════════════════════════════════════
# PAGE 7 — BOE Monitoring
# ══════════════════════════════════════════════════════════
@app.get("/api/v1/boe-monitoring")
async def get_boe_monitoring(currency: str = Query("INR"), fy: str = Query("All")):
    cd = get_current_date()
    boe_pending_col = COL_MAP["boe_pending_inr"] if currency == "INR" else COL_MAP["boe_pending_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])

    status_query = f"""
        SELECT {COL_MAP['boe_status']} as status, COUNT(*) as count, SUM({boe_pending_col}) as value
        FROM LC WHERE {COL_MAP['boe_status']} IS NOT NULL {fy_filter}
        GROUP BY 1
    """
    aging_query = f"""
        SELECT
            CASE
                WHEN date_diff('day', {COL_MAP['op_date']}, '{cd}'::DATE) <= 30 THEN '0-30 Days'
                WHEN date_diff('day', {COL_MAP['op_date']}, '{cd}'::DATE) <= 60 THEN '31-60 Days'
                WHEN date_diff('day', {COL_MAP['op_date']}, '{cd}'::DATE) <= 90 THEN '61-90 Days'
                ELSE '90+ Days'
            END as bucket,
            SUM({boe_pending_col}) as value,
            COUNT(*) as count
        FROM LC
        WHERE ({COL_MAP['boe_status']} IS NULL OR {COL_MAP['boe_status']} != 'Received') {fy_filter}
        GROUP BY 1 ORDER BY bucket
    """
    monthly_trend = f"""
        SELECT date_trunc('month', {COL_MAP['op_date']}) as month,
               SUM({boe_pending_col}) as pending_value,
               COUNT(*) as count
        FROM LC WHERE ({COL_MAP['boe_status']} IS NULL OR {COL_MAP['boe_status']} != 'Received') {fy_filter}
        GROUP BY 1 ORDER BY 1
        LIMIT 12
    """
    return {
        "status_breakdown": fetch_dict(status_query),
        "aging_buckets": fetch_dict(aging_query),
        "monthly_trend": fetch_dict(monthly_trend)
    }


# ══════════════════════════════════════════════════════════
# PAGE 8 — Shipment Tracking
# ══════════════════════════════════════════════════════════
@app.get("/api/v1/shipment-tracking")
async def get_shipment_tracking(currency: str = Query("INR"), fy: str = Query("All")):
    cd = get_current_date()
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])

    query = f"""
        SELECT
            SUM(CASE WHEN {COL_MAP['shipment_date']} > '{cd}' THEN 1 ELSE 0 END) as pending_count,
            SUM(CASE WHEN {COL_MAP['shipment_date']} <= '{cd}' THEN 1 ELSE 0 END) as completed_count,
            SUM(CASE WHEN {COL_MAP['material_date']} > {COL_MAP['shipment_date']} THEN 1 ELSE 0 END) as delayed_count,
            SUM(CASE WHEN {COL_MAP['expiry_date']} < '{cd}' AND {COL_MAP['shipment_date']} IS NULL THEN 1 ELSE 0 END) as expired_count,
            SUM(CASE WHEN {COL_MAP['expiry_date']} BETWEEN '{cd}' AND '{cd}'::DATE + INTERVAL 15 DAY THEN 1 ELSE 0 END) as expiry_risk_count,
            SUM(CASE WHEN {COL_MAP['shipment_date']} > '{cd}' THEN {amt_col} ELSE 0 END) as pending_value,
            SUM(CASE WHEN {COL_MAP['material_date']} > {COL_MAP['shipment_date']} THEN {amt_col} ELSE 0 END) as delayed_value
        FROM LC WHERE 1=1 {fy_filter}
    """
    return fetch_dict(query)[0]


# ══════════════════════════════════════════════════════════
# PAGE 4 — Cash Flow Forecast
# ══════════════════════════════════════════════════════════
@app.get("/api/v1/cash-flow-forecast")
async def get_cash_flow_forecast(currency: str = Query("INR"), fy: str = Query("All")):
    cd = get_current_date()
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['due_date'])

    # Historical monthly stddev for proper confidence intervals
    query = f"""
        WITH MonthlyData AS (
            SELECT
                "LC Payment Due Month" as month,
                MIN({COL_MAP['due_date']}) as sort_date,
                SUM({amt_col}) as monthly_value
            FROM LC
            WHERE {COL_MAP['due_date']} >= '{cd}'::DATE {fy_filter}
            GROUP BY 1
        ),
        HistoricalStdDev AS (
            SELECT STDDEV(monthly_val) as stddev_val
            FROM (
                SELECT date_trunc('month', {COL_MAP['due_date']}) as m, SUM({amt_col}) as monthly_val
                FROM LC
                WHERE {COL_MAP['due_date']} < '{cd}'::DATE
                GROUP BY 1
            ) h
        )
        SELECT
            month,
            monthly_value,
            monthly_value - (1.645 * COALESCE((SELECT stddev_val FROM HistoricalStdDev), monthly_value * 0.12)) as confidence_lower,
            monthly_value + (1.645 * COALESCE((SELECT stddev_val FROM HistoricalStdDev), monthly_value * 0.12)) as confidence_upper,
            SUM(monthly_value) OVER (ORDER BY sort_date) as cumulative_value
        FROM MonthlyData
        ORDER BY sort_date
        LIMIT 12
    """
    return fetch_dict(query)


# ══════════════════════════════════════════════════════════
# Treasury Radar
# ══════════════════════════════════════════════════════════
@app.get("/api/v1/treasury-radar")
async def get_treasury_radar(currency: str = Query("INR"), fy: str = Query("All")):
    cd = get_current_date()
    amt_col = COL_MAP["amt_inr"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    where = f"WHERE 1=1 {fy_filter}"

    raw_data = fetch_dict(f"""
        WITH Limits AS (
            SELECT COALESCE(SUM(CAST(NULLIF(REPLACE("Limit", ',', ''), '') AS DOUBLE)), 1) as total_limit
            FROM DD WHERE Table_8 = 'Bank' AND Element_8 != ''
        )
        SELECT
            (SELECT SUM({amt_col}) FROM LC {where}) as total_exposure,
            (SELECT SUM({amt_col}) FROM LC {where} AND {COL_MAP['lc_status']}='Open') as open_exposure,
            (SELECT SUM({COL_MAP['amt_fc']}) FROM LC {where} AND {COL_MAP['lc_status']}='Open' AND {COL_MAP['currency']} != 'INR') as fx_exposure,
            (SELECT SUM({amt_col}) FROM LC {where} AND {COL_MAP['due_date']} <= '{cd}'::DATE + INTERVAL 15 DAY AND ({COL_MAP['payment_status']} IS NULL OR {COL_MAP['payment_status']} != 'Paid')) as liquidity_stress,
            (SELECT SUM({amt_col}) FROM LC {where} AND {COL_MAP['expiry_date']} <= '{cd}'::DATE + INTERVAL 30 DAY AND {COL_MAP['lc_status']}='Open') as expiry_risk,
            (SELECT SUM({COL_MAP['boe_pending_inr']}) FROM LC {where} AND ({COL_MAP['boe_status']} IS NULL OR {COL_MAP['boe_status']} != 'Received')) as supplier_risk,
            (SELECT SUM({COL_MAP['boe_pending_inr']}) FROM LC {where} AND ({COL_MAP['boe_status']} IS NULL OR {COL_MAP['boe_status']} != 'Received') AND date_diff('day', {COL_MAP['op_date']}, '{cd}'::DATE) > 60) as op_delay,
            (SELECT total_limit FROM Limits) as max_limit
    """)[0]

    total_exposure = raw_data['total_exposure'] or 1
    max_limit = raw_data['max_limit'] or 1

    utilization_score = min(100, ((raw_data['open_exposure'] or 0) / max_limit) * 100)
    liquidity_score = min(100, ((raw_data['liquidity_stress'] or 0) / total_exposure) * 200)
    fx_score = min(100, ((raw_data['fx_exposure'] or 0) / max(total_exposure / 84, 1)) * 100)
    supplier_score = min(100, ((raw_data['supplier_risk'] or 0) / total_exposure) * 150)
    expiry_score = min(100, ((raw_data['expiry_risk'] or 0) / total_exposure) * 300)
    op_score = min(100, ((raw_data['op_delay'] or 0) / total_exposure) * 250)

    return [
        {"subject": "Liquidity Stress", "A": round(liquidity_score), "fullMark": 100},
        {"subject": "Limit Exhaustion", "A": round(utilization_score), "fullMark": 100},
        {"subject": "FX Volatility", "A": round(fx_score), "fullMark": 100},
        {"subject": "Supplier Delay", "A": round(supplier_score), "fullMark": 100},
        {"subject": "Expiry Breach", "A": round(expiry_score), "fullMark": 100},
        {"subject": "Operational Delay", "A": round(op_score), "fullMark": 100}
    ]


# ══════════════════════════════════════════════════════════
# PAGE 3 — Lifecycle Tracker
# ══════════════════════════════════════════════════════════
@app.get("/api/v1/lifecycle-tracker")
async def get_lifecycle_tracker(fy: str = Query("All")):
    cd = get_current_date()
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    query = f"""
        SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN {COL_MAP['shipment_date']} <= '{cd}' THEN 1 END) as shipped,
            COUNT(CASE WHEN {COL_MAP['docs_received']} = 'YES' THEN 1 END) as docs_received,
            COUNT(CASE WHEN {COL_MAP['bill_lodge']} IS NOT NULL THEN 1 END) as bill_lodged,
            COUNT(CASE WHEN {COL_MAP['bill_accept']} IS NOT NULL THEN 1 END) as bill_accepted,
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


# ══════════════════════════════════════════════════════════
# PAGE 10 — Risk Alerts
# ══════════════════════════════════════════════════════════
@app.get("/api/v1/risk-alerts")
async def get_risk_alerts(fy: str = Query("All")):
    cd = get_current_date()
    alerts = []
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])

    expiring_soon = fetch_dict(f"""
        SELECT {COL_MAP['lc_no']} as id, {COL_MAP['expiry_date']} as date, {COL_MAP['supplier']} as supplier,
               date_diff('day', '{cd}'::DATE, {COL_MAP['expiry_date']}) as days_remaining
        FROM LC
        WHERE {COL_MAP['lc_status']} = 'Open'
        AND {COL_MAP['expiry_date']} BETWEEN '{cd}' AND '{cd}'::DATE + INTERVAL 15 DAY
        {fy_filter}
        ORDER BY {COL_MAP['expiry_date']}
    """)
    for item in expiring_soon:
        alerts.append({
            "priority": "HIGH",
            "type": "Expiry Risk",
            "message": f"LC {item['id']} for {item['supplier']} expires on {item['date']} ({item['days_remaining']} days remaining)",
            "id": item['id']
        })

    payment_due = fetch_dict(f"""
        SELECT {COL_MAP['lc_no']} as id, {COL_MAP['due_date']} as date, {COL_MAP['supplier']} as supplier,
               date_diff('day', '{cd}'::DATE, {COL_MAP['due_date']}) as days_to_due
        FROM LC
        WHERE ({COL_MAP['payment_status']} IS NULL OR {COL_MAP['payment_status']} != 'Paid')
        AND {COL_MAP['due_date']} BETWEEN '{cd}' AND '{cd}'::DATE + INTERVAL 7 DAY
        {get_fy_clause(fy, COL_MAP['due_date'])}
        ORDER BY {COL_MAP['due_date']}
    """)
    for item in payment_due:
        alerts.append({
            "priority": "HIGH",
            "type": "Payment Due",
            "message": f"Payment for LC {item['id']} ({item['supplier']}) due on {item['date']} ({item['days_to_due']} days)",
            "id": item['id']
        })

    boe_overdue = fetch_dict(f"""
        SELECT {COL_MAP['lc_no']} as id, {COL_MAP['supplier']} as supplier,
               date_diff('day', {COL_MAP['op_date']}, '{cd}'::DATE) as age_days
        FROM LC
        WHERE ({COL_MAP['boe_status']} IS NULL OR {COL_MAP['boe_status']} != 'Received')
        AND date_diff('day', {COL_MAP['op_date']}, '{cd}'::DATE) > 90
        {fy_filter}
        ORDER BY age_days DESC
        LIMIT 20
    """)
    for item in boe_overdue:
        alerts.append({
            "priority": "MEDIUM",
            "type": "BOE Overdue",
            "message": f"BOE for LC {item['id']} ({item['supplier']}) is {item['age_days']} days old with no BOE filed",
            "id": item['id']
        })

    # Medium: High bank concentration
    conc_data = fetch_dict(f"""
        SELECT {COL_MAP['bank']} as bank, COUNT(*) as cnt,
               (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM LC WHERE {COL_MAP['lc_status']} = 'Open' {fy_filter})) as pct
        FROM LC WHERE {COL_MAP['lc_status']} = 'Open' {fy_filter}
        GROUP BY 1 HAVING pct > 50
        LIMIT 1
    """)
    for item in conc_data:
        alerts.append({
            "priority": "MEDIUM",
            "type": "Concentration Risk",
            "message": f"⚠ {item['bank']} accounts for {item['pct']:.1f}% of all open LCs — single-bank dependency risk",
            "id": "BANK_CONC"
        })

    return alerts


# ══════════════════════════════════════════════════════════
# PAGE — Strategic Intelligence
# ══════════════════════════════════════════════════════════
@app.get("/api/v1/strategic-intelligence")
async def get_strategic_intelligence(currency: str = Query("INR"), fy: str = Query("All")):
    cd = get_current_date()
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    where = f"WHERE 1=1 {fy_filter}"

    # 1. Yield Optimization
    fd_query = fetch_dict(f"SELECT SUM({COL_MAP['margin_fd']}) as locked_fd FROM LC {where}")[0]
    locked_fd = fd_query['locked_fd'] or 0
    yield_lost = locked_fd * get_config('yield_rate', 0.07)

    # 2. Cost of Inefficiency
    delayed_boe_val = fetch_dict(f"""
        SELECT SUM({COL_MAP['boe_pending_inr']}) as val FROM LC {where}
        AND ({COL_MAP['boe_status']} IS NULL OR {COL_MAP['boe_status']} != 'Received')
        AND date_diff('day', {COL_MAP['op_date']}, '{cd}'::DATE) > 60
    """)[0]['val'] or 0

    overdue_payment_val = fetch_dict(f"""
        SELECT SUM({COL_MAP['amt_inr']}) as val FROM LC {where}
        AND ({COL_MAP['payment_status']} IS NULL OR {COL_MAP['payment_status']} != 'Paid')
        AND {COL_MAP['due_date']} < '{cd}'::DATE
    """)[0]['val'] or 0

    inefficiency_cost = (delayed_boe_val * get_config('inefficiency_boe_rate', 0.10)) + (overdue_payment_val * get_config('inefficiency_overdue_rate', 0.12)) + yield_lost

    # 3. Supplier Reliability (avg days shipment → BOE submission)
    reliability = fetch_dict(f"""
        SELECT {COL_MAP['supplier']} as supplier,
               AVG(date_diff('day', {COL_MAP['shipment_date']}, {COL_MAP['boe_date']})) as avg_delay_days,
               COUNT(*) as tx_count
        FROM LC {where} AND {COL_MAP['boe_date']} IS NOT NULL AND {COL_MAP['shipment_date']} IS NOT NULL
        GROUP BY 1 HAVING COUNT(*) > 1 ORDER BY 2 DESC LIMIT 5
    """)

    # 4. Bank Utilization with Limits
    utilization = fetch_dict(f"""
        SELECT
            LC.{COL_MAP['bank']} as bank,
            SUM(LC.{amt_col}) as used_limit,
            COALESCE(MAX(CAST(NULLIF(REPLACE(DD."Limit", ',', ''), '') AS DOUBLE)), 0) as max_limit
        FROM LC
        LEFT JOIN DD ON TRIM(UPPER(LC.{COL_MAP['bank']})) = TRIM(UPPER(DD.Element_8))
            AND DD.Table_8 = 'Bank'
        {where} AND LC.{COL_MAP['lc_status']} = 'Open'
        GROUP BY 1 ORDER BY 2 DESC
    """)

    # 5. Tolerance Tracking
    tolerance = fetch_dict(f"SELECT SUM({COL_MAP['tolerance']}) as total_variance FROM LC {where}")[0]

    # 6. Cash Runway & Health Score
    runway_data = fetch_dict(f"""
        WITH BankLimits AS (
            SELECT COALESCE(SUM(CAST(NULLIF(REPLACE("Limit", ',', ''), '') AS DOUBLE)), 0) as total_limit
            FROM DD WHERE Table_8 = 'Bank' AND Element_8 != ''
        )
        SELECT
            (SELECT SUM(CASE WHEN {COL_MAP['lc_status']} = 'Open' THEN {amt_col} ELSE 0 END) FROM LC {where}) as open_lc_val,
            (SELECT total_limit FROM BankLimits) as approx_total_limit
    """)[0]

    # Use monthly opening rate as burn rate (more accurate than closed LCs / days)
    monthly_open_rate = fetch_dict(f"""
        SELECT AVG(monthly_vol) as avg_monthly_vol FROM (
            SELECT date_trunc('month', {COL_MAP['op_date']}) as m, SUM({amt_col}) as monthly_vol
            FROM LC {where} AND {COL_MAP['lc_status']} = 'Open'
            GROUP BY 1
        ) t
    """)[0]['avg_monthly_vol'] or 1

    total_limit = runway_data['approx_total_limit'] or 0
    open_val = runway_data['open_lc_val'] or 0
    rem_limit = max(0, total_limit - open_val)
    daily_burn = monthly_open_rate / 30
    cash_runway_days = rem_limit / daily_burn if daily_burn > 0 else 999

    # Multi-factor health score
    health_score = 100.0
    util_pct = (open_val / total_limit * 100) if total_limit > 0 else 0
    if util_pct > 90: health_score -= 25
    elif util_pct > 80: health_score -= 15
    elif util_pct > 60: health_score -= 5

    if cash_runway_days < 15: health_score -= 25
    elif cash_runway_days < 30: health_score -= 20
    elif cash_runway_days < 60: health_score -= 10

    overdue_boes = fetch_dict(f"""
        SELECT COUNT(*) as c FROM LC {where}
        AND ({COL_MAP['boe_status']} IS NULL OR {COL_MAP['boe_status']} != 'Received')
        AND date_diff('day', {COL_MAP['op_date']}, '{cd}'::DATE) > 90
    """)[0]['c'] or 0
    if overdue_boes > 10: health_score -= 20
    elif overdue_boes > 5: health_score -= 10
    elif overdue_boes > 0: health_score -= 5

    # FX risk factor
    fx_exposure_val = fetch_dict(f"""
        SELECT SUM({COL_MAP['amt_inr']}) as val FROM LC {where}
        AND {COL_MAP['lc_status']} = 'Open' AND {COL_MAP['currency']} != 'INR'
    """)[0]['val'] or 0
    if open_val > 0 and (fx_exposure_val / open_val) > 0.5:
        health_score -= 10  # High FX concentration

    health_score = max(0, min(100, health_score))
    expected_fx_loss = fx_exposure_val * get_config('fx_var_rate', 0.03)


    # FIXED: prob_liquidity_stress properly bounded
    prob_liquidity_stress = max(1, min(99, (100 - health_score) * 1.0))

    # 7. LC Demand Forecast (30-day rolling)
    demand_forecast = fetch_dict(f"""
        SELECT SUM({amt_col}) as monthly_vol FROM LC {where}
        AND {COL_MAP['op_date']} >= '{cd}'::DATE - INTERVAL 30 DAY
    """)[0]['monthly_vol'] or 0

    # 8. Bank Dependency Risk (Top Bank % of open exposure)
    top_bank_data = utilization[0] if utilization else {}
    top_bank_val = top_bank_data.get('used_limit', 0)
    dependency_risk_pct = (top_bank_val / max(open_val, 1)) * 100

    # 9. Future Cash Stress Window (highest rolling 7-day outflow)
    stress_window = fetch_dict(f"""
        WITH DailyOutflows AS (
            SELECT {COL_MAP['due_date']} as d_date, SUM({amt_col}) as val
            FROM LC {where} AND {COL_MAP['due_date']} >= '{cd}'::DATE
            AND ({COL_MAP['payment_status']} IS NULL OR {COL_MAP['payment_status']} != 'Paid')
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

    # 10. LC closure avg days
    avg_close_days = fetch_dict(f"""
        SELECT AVG(date_diff('day', {COL_MAP['op_date']}, {COL_MAP['expiry_date']})) as avg_days
        FROM LC {where} AND {COL_MAP['lc_status']} = 'Closed'
    """)[0]['avg_days'] or 90

    return {
        "health_score": round(health_score, 1),
        "cash_runway_days": round(cash_runway_days, 0),
        "remaining_limit": rem_limit,
        "yield_optimization": {
            "locked_fd": locked_fd,
            "est_yield_lost_annual": yield_lost,
            "cost_of_inefficiency": inefficiency_cost,
            "expected_fx_loss": expected_fx_loss,
            "prob_liquidity_stress": round(prob_liquidity_stress, 1),
            "working_capital_unlock": inefficiency_cost + locked_fd
        },
        "supplier_reliability": reliability,
        "bank_utilization": utilization,
        "tolerance_variance": tolerance['total_variance'] or 0,
        "quant_models": {
            "lc_closure_avg_days": round(avg_close_days, 0) if avg_close_days else 0,
            "lc_demand_forecast_30d": demand_forecast,
            "bank_dependency_risk_pct": round(dependency_risk_pct, 1),
            "stress_window_start": stress_window_start,
            "stress_window_val": stress_window_val
        }
    }


# ══════════════════════════════════════════════════════════
# Advanced Quant (SINGLE definition — duplicate removed)
# ══════════════════════════════════════════════════════════
@app.get("/api/v1/advanced-quant")
async def get_advanced_quant(currency: str = Query("INR"), fy: str = Query("All")):
    cd = get_current_date()
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    where = f"WHERE 1=1 {fy_filter}"

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

    overdue_boe_val = fetch_dict(f"""
        SELECT SUM({COL_MAP['boe_pending_inr']}) as val FROM LC {where}
        AND ({COL_MAP['boe_status']} IS NULL OR {COL_MAP['boe_status']} != 'Received')
        AND date_diff('day', {COL_MAP['op_date']}, '{cd}'::DATE) > 60
    """)[0]['val'] or 0

    ewi_score = min(100, (utilization * 50) + ((overdue_boe_val / max(open_val, 1)) * 50))

    # Network Analysis
    network_data = fetch_dict(f"""
        SELECT {COL_MAP['bank']} as source, {COL_MAP['supplier']} as target, SUM({amt_col}) as value
        FROM LC {where} AND {COL_MAP['lc_status']} = 'Open'
        GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 20
    """)

    # FIXED LAR: mean + 1.645 * stddev (proper 95% VaR methodology)
    monthly_flows = fetch_dict(f"""
        SELECT date_trunc('month', {COL_MAP['due_date']}) as m, SUM({amt_col}) as flow
        FROM LC {where} GROUP BY 1
    """)
    flows = [x['flow'] for x in monthly_flows if x['flow']]
    avg_flow = sum(flows) / len(flows) if flows else 0
    if len(flows) > 1:
        variance = sum((f - avg_flow) ** 2 for f in flows) / (len(flows) - 1)
        std_dev = math.sqrt(variance)
    else:
        std_dev = avg_flow * 0.15  # Fallback: assume 15% volatility
    lar_95 = avg_flow + (1.645 * std_dev)

    # FIXED Stress Tests: properly separate INR-native vs FC-equivalent amounts
    fc_in_inr = fetch_dict(f"""
        SELECT SUM({COL_MAP['amt_inr']}) as val FROM LC {where}
        AND {COL_MAP['lc_status']} = 'Open' AND {COL_MAP['currency']} != 'INR'
    """)[0]['val'] or 0
    inr_native = open_val - fc_in_inr  # Pure INR LCs

    stress_tests = [
        {
            "scenario": "Baseline",
            "exposure": open_val,
            "limit": total_limit,
            "utilization": utilization * 100
        },
        {
            "scenario": "Mild (FX +5%)",
            "exposure": inr_native + (fc_in_inr * 1.05),
            "limit": total_limit,
            "utilization": ((inr_native + (fc_in_inr * 1.05)) / total_limit) * 100
        },
        {
            "scenario": "Moderate (FX +10%)",
            "exposure": inr_native + (fc_in_inr * 1.10),
            "limit": total_limit,
            "utilization": ((inr_native + (fc_in_inr * 1.10)) / total_limit) * 100
        },
        {
            "scenario": "Severe (FX +10%, Limit -20%)",
            "exposure": inr_native + (fc_in_inr * 1.10),
            "limit": total_limit * 0.8,
            "utilization": ((inr_native + (fc_in_inr * 1.10)) / (total_limit * 0.8)) * 100
        },
        {
            "scenario": "Crisis (FX +15%, Limit -30%)",
            "exposure": inr_native + (fc_in_inr * 1.15),
            "limit": total_limit * 0.7,
            "utilization": ((inr_native + (fc_in_inr * 1.15)) / (total_limit * 0.7)) * 100
        },
    ]

    return {
        "early_warning_index": round(ewi_score, 1),
        "liquidity_at_risk": round(lar_95, 0),
        "lar_mean": round(avg_flow, 0),
        "lar_stddev": round(std_dev, 0),
        "network": network_data,
        "stress_tests": stress_tests
    }


# ══════════════════════════════════════════════════════════
# NEW: FX Exposure Breakdown
# ══════════════════════════════════════════════════════════
@app.get("/api/v1/fx-exposure")
async def get_fx_exposure(fy: str = Query("All")):
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    where = f"WHERE 1=1 {fy_filter}"

    breakdown = fetch_dict(f"""
        SELECT
            {COL_MAP['currency']} as currency,
            COUNT(*) as lc_count,
            SUM({COL_MAP['amt_fc']}) as exposure_fc,
            SUM({COL_MAP['amt_inr']}) as exposure_inr,
            AVG({COL_MAP['rate']}) as avg_rate
        FROM LC {where} AND {COL_MAP['currency']} IS NOT NULL AND {COL_MAP['currency']} != ''
        GROUP BY 1 ORDER BY 4 DESC
    """)

    # 1% depreciation impact per currency
    for row in breakdown:
        row['depreciation_1pct_impact'] = (row['exposure_inr'] or 0) * 0.01

    total_fc_inr = sum(r['exposure_inr'] or 0 for r in breakdown if r['currency'] != 'INR')

    return {
        "breakdown": breakdown,
        "total_fc_exposure_inr": total_fc_inr,
        "var_1pct_depreciation": total_fc_inr * 0.01,
        "var_5pct_depreciation": total_fc_inr * 0.05,
        "var_10pct_depreciation": total_fc_inr * 0.10,
    }


# ══════════════════════════════════════════════════════════
# NEW: Trend Analysis (12-month rolling)
# ══════════════════════════════════════════════════════════
@app.get("/api/v1/trend-analysis")
async def get_trend_analysis(currency: str = Query("INR"), fy: str = Query("All")):
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])

    monthly_trend = fetch_dict(f"""
        SELECT
            date_trunc('month', {COL_MAP['op_date']}) as month,
            COUNT(*) as opened_count,
            SUM({amt_col}) as opened_value,
            COUNT(CASE WHEN {COL_MAP['lc_status']} = 'Closed' THEN 1 END) as closed_count,
            SUM(CASE WHEN {COL_MAP['lc_status']} = 'Closed' THEN {amt_col} ELSE 0 END) as closed_value,
            SUM(CASE WHEN {COL_MAP['lc_status']} = 'Open' THEN {amt_col} ELSE 0 END) as net_exposure
        FROM LC WHERE 1=1 {fy_filter}
        GROUP BY 1 ORDER BY 1
        LIMIT 18
    """)

    due_trend = fetch_dict(f"""
        SELECT
            date_trunc('month', {COL_MAP['due_date']}) as month,
            SUM({amt_col}) as due_value,
            COUNT(*) as due_count
        FROM LC WHERE {COL_MAP['due_date']} IS NOT NULL {fy_filter.replace(COL_MAP['op_date'], COL_MAP['due_date'])}
        GROUP BY 1 ORDER BY 1
        LIMIT 18
    """)

    return {
        "monthly_opening_trend": monthly_trend,
        "monthly_due_trend": due_trend
    }


# ══════════════════════════════════════════════════════════
# NEW: Bottleneck Analysis (avg days per lifecycle stage)
# ══════════════════════════════════════════════════════════
@app.get("/api/v1/bottleneck-analysis")
async def get_bottleneck_analysis(fy: str = Query("All")):
    cd = get_current_date()
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    where = f"WHERE 1=1 {fy_filter}"

    stages = fetch_dict(f"""
        SELECT
            AVG(date_diff('day', {COL_MAP['op_date']}, {COL_MAP['shipment_date']})) as lc_to_shipment,
            AVG(date_diff('day', {COL_MAP['shipment_date']}, {COL_MAP['bill_lodge']})) as shipment_to_lodge,
            AVG(date_diff('day', {COL_MAP['bill_lodge']}, {COL_MAP['bill_accept']})) as lodge_to_accept,
            AVG(date_diff('day', {COL_MAP['bill_accept']}, {COL_MAP['due_date']})) as accept_to_due,
            AVG(date_diff('day', {COL_MAP['op_date']}, {COL_MAP['expiry_date']})) as lc_to_close,
            STDDEV(date_diff('day', {COL_MAP['shipment_date']}, {COL_MAP['bill_lodge']})) as stddev_ship_to_lodge,
            COUNT(*) as sample_size
        FROM LC {where}
        AND {COL_MAP['shipment_date']} IS NOT NULL
        AND {COL_MAP['bill_lodge']} IS NOT NULL
        AND {COL_MAP['bill_accept']} IS NOT NULL
        AND {COL_MAP['due_date']} IS NOT NULL
    """)

    result = stages[0] if stages else {}

    stage_list = [
        {"stage": "LC Open → Shipment", "avg_days": result.get("lc_to_shipment"), "stddev": None},
        {"stage": "Shipment → Bill Lodge", "avg_days": result.get("shipment_to_lodge"), "stddev": result.get("stddev_ship_to_lodge")},
        {"stage": "Bill Lodge → Acceptance", "avg_days": result.get("lodge_to_accept"), "stddev": None},
        {"stage": "Acceptance → Payment Due", "avg_days": result.get("accept_to_due"), "stddev": None},
        {"stage": "LC Open → Close (Total)", "avg_days": result.get("lc_to_close"), "stddev": None},
    ]
    # Clean None values
    for s in stage_list:
        s['avg_days'] = round(s['avg_days'], 1) if s['avg_days'] else None
        s['stddev'] = round(s['stddev'], 1) if s['stddev'] else None

    # Find bottleneck (highest avg_days excluding total)
    bottleneck = max(
        [s for s in stage_list[:-1] if s['avg_days'] is not None],
        key=lambda x: x['avg_days'],
        default={"stage": "N/A"}
    )

    return {
        "stages": stage_list,
        "bottleneck_stage": bottleneck.get("stage", "N/A"),
        "bottleneck_days": bottleneck.get("avg_days"),
        "sample_size": result.get("sample_size", 0)
    }


# ══════════════════════════════════════════════════════════
# NEW: Cohort Analysis (LC performance by opening month)
# ══════════════════════════════════════════════════════════
@app.get("/api/v1/cohort-analysis")
async def get_cohort_analysis(currency: str = Query("INR"), fy: str = Query("All")):
    cd = get_current_date()
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])

    cohorts = fetch_dict(f"""
        SELECT
            date_trunc('month', {COL_MAP['op_date']}) as cohort_month,
            COUNT(*) as total_lcs,
            SUM({amt_col}) as total_value,
            COUNT(CASE WHEN {COL_MAP['lc_status']} = 'Closed' THEN 1 END) as closed_count,
            COUNT(CASE WHEN {COL_MAP['lc_status']} = 'Open' THEN 1 END) as still_open,
            AVG(date_diff('day', {COL_MAP['op_date']}, COALESCE({COL_MAP['expiry_date']}, '{cd}'::DATE))) as avg_age_days,
            SUM({COL_MAP['boe_pending_inr']}) as pending_boe_value,
            COUNT(CASE WHEN {COL_MAP['payment_status']} = 'Paid' THEN 1 END) as paid_count
        FROM LC WHERE {COL_MAP['op_date']} IS NOT NULL {fy_filter}
        GROUP BY 1 ORDER BY 1 DESC
        LIMIT 12
    """)

    # Compute closure rate per cohort
    for c in cohorts:
        total = c['total_lcs'] or 1
        c['closure_rate_pct'] = round((c['closed_count'] or 0) / total * 100, 1)
        c['payment_rate_pct'] = round((c['paid_count'] or 0) / total * 100, 1)

    return cohorts


# ══════════════════════════════════════════════════════════
# NEW: Limit Utilization with Exhaustion Forecast
# ══════════════════════════════════════════════════════════
@app.get("/api/v1/limit-utilization")
async def get_limit_utilization(currency: str = Query("INR"), fy: str = Query("All")):
    cd = get_current_date()
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])

    # Get bank-wise utilization with limits from DD table
    bank_data = fetch_dict(f"""
        SELECT
            LC.{COL_MAP['bank']} as bank,
            COUNT(*) as lc_count,
            SUM(LC.{amt_col}) as used_limit,
            COALESCE(MAX(CAST(NULLIF(REPLACE(DD."Limit", ',', ''), '') AS DOUBLE)), 0) as max_limit
        FROM LC
        LEFT JOIN DD ON TRIM(UPPER(LC.{COL_MAP['bank']})) = TRIM(UPPER(DD.Element_8))
            AND DD.Table_8 = 'Bank'
        WHERE LC.{COL_MAP['lc_status']} = 'Open' {fy_filter}
        GROUP BY 1 ORDER BY 3 DESC
    """)

    # Monthly LC opening rate per bank for exhaustion forecast
    monthly_rate = fetch_dict(f"""
        SELECT
            {COL_MAP['bank']} as bank,
            SUM({amt_col}) / GREATEST(COUNT(DISTINCT date_trunc('month', {COL_MAP['op_date']})), 1) as avg_monthly_addition
        FROM LC WHERE {COL_MAP['lc_status']} = 'Open' {fy_filter}
        GROUP BY 1
    """)
    rate_map = {r['bank']: r['avg_monthly_addition'] for r in monthly_rate}

    for row in bank_data:
        util = (row['used_limit'] or 0) / max(row['max_limit'] or 1, 1)
        row['utilization_pct'] = round(util * 100, 1)
        row['available_limit'] = max(0, (row['max_limit'] or 0) - (row['used_limit'] or 0))
        # Exhaustion forecast: days until limit is full at current burn rate
        monthly_add = rate_map.get(row['bank'], 0) or 0
        daily_add = monthly_add / 30 if monthly_add > 0 else 0
        avail = row['available_limit']
        if daily_add > 0 and avail > 0:
            row['days_to_exhaustion'] = round(avail / daily_add, 0)
        elif avail <= 0:
            row['days_to_exhaustion'] = 0
        else:
            row['days_to_exhaustion'] = 999  # Far future

    total_max = sum(r['max_limit'] or 0 for r in bank_data)
    total_used = sum(r['used_limit'] or 0 for r in bank_data)
    total_avail = max(0, total_max - total_used)

    return {
        "bank_utilization": bank_data,
        "portfolio_summary": {
            "total_limit": total_max,
            "total_used": total_used,
            "total_available": total_avail,
            "overall_utilization_pct": round(total_used / max(total_max, 1) * 100, 1)
        }
    }


# ══════════════════════════════════════════════════════════
# PE Treasury (with error handling & fallback data)
# ══════════════════════════════════════════════════════════
@app.get("/api/v1/pe-treasury")
async def get_pe_treasury():
    debt_maturity = fetch_dict("SELECT * FROM DEBT_MATURITY ORDER BY year")
    yield_curve = fetch_dict("SELECT * FROM YIELD_CURVE")
    capital_stack = fetch_dict("SELECT * FROM CAPITAL_STACK")

    # Fetch textual insights from TREASURY_INSIGHTS
    value_creation_raw = fetch_dict("SELECT key, value FROM TREASURY_INSIGHTS WHERE category = 'value_creation' ORDER BY priority")
    value_creation = {item['key']: float(item['value']) if item['value'].replace('.','',1).isdigit() else item['value'] for item in value_creation_raw}

    liquidity_index_raw = fetch_dict("SELECT key, value FROM TREASURY_INSIGHTS WHERE category = 'liquidity_index' ORDER BY priority")
    liquidity_index = {item['key']: item['value'] for item in liquidity_index_raw}

    return {
        "debt_maturity": debt_maturity,
        "yield_curve": yield_curve,
        "capital_stack": capital_stack,
        "value_creation": value_creation,
        "liquidity_index": liquidity_index
    }


# ══════════════════════════════════════════════════════════
# All Transactions
# ══════════════════════════════════════════════════════════
@app.get("/api/v1/transactions")
async def get_transactions(fy: str = Query("All")):
    cd = get_current_date()
    fy_filter = get_fy_clause(fy, COL_MAP['op_date'])
    query = f"""
        SELECT LC.*,
        CASE
            WHEN {COL_MAP['lc_status']} = 'Open' AND {COL_MAP['expiry_date']} BETWEEN '{cd}' AND '{cd}'::DATE + INTERVAL 15 DAY THEN 'Expiry Risk'
            WHEN ({COL_MAP['payment_status']} IS NULL OR {COL_MAP['payment_status']} != 'Paid') AND {COL_MAP['due_date']} BETWEEN '{cd}' AND '{cd}'::DATE + INTERVAL 7 DAY THEN 'Payment Due'
            WHEN ({COL_MAP['boe_status']} IS NULL OR {COL_MAP['boe_status']} != 'Received') AND date_diff('day', {COL_MAP['op_date']}, '{cd}'::DATE) > 90 THEN 'BOE Overdue'
            WHEN {COL_MAP['due_date']} < '{cd}' AND ({COL_MAP['payment_status']} IS NULL OR {COL_MAP['payment_status']} != 'Paid') THEN 'Overdue'
            ELSE 'Safe'
        END as risk_flag
        FROM LC WHERE 1=1 {fy_filter} ORDER BY {COL_MAP["op_date"]} DESC
    """
    return fetch_dict(query)


# ══════════════════════════════════════════════════════════
# AI Copilot
# ══════════════════════════════════════════════════════════
@app.post("/api/v1/ai-copilot")
async def ai_copilot(query: str = Body(..., embed=True)):
    cd = get_current_date()
    q = query.lower()

    if any(word in q for word in ["expiring", "expire", "expiry"]):
        data = fetch_dict(f"""
            SELECT {COL_MAP["lc_no"]} as id, {COL_MAP["supplier"]} as supplier,
                   {COL_MAP["expiry_date"]} as date,
                   date_diff('day', '{cd}'::DATE, {COL_MAP["expiry_date"]}) as days_remaining
            FROM LC WHERE {COL_MAP["lc_status"]} = 'Open'
            AND {COL_MAP["expiry_date"]} BETWEEN '{cd}' AND '{cd}'::DATE + INTERVAL 30 DAY
            ORDER BY {COL_MAP["expiry_date"]}
        """)
        return {"answer": f"Found {len(data)} LCs expiring in the next 30 days.", "data": data}

    if "bank" in q and ("highest" in q or "most" in q or "maximum" in q):
        data = fetch_one(f'SELECT {COL_MAP["bank"]}, SUM({COL_MAP["amt_inr"]}) FROM LC WHERE {COL_MAP["lc_status"]} = \'Open\' GROUP BY 1 ORDER BY 2 DESC LIMIT 1')
        if data:
            return {"answer": f"The bank with highest open LC exposure is {data[0]} with ₹{data[1]:,.0f}.", "data": {"bank": data[0], "value": data[1]}}

    if "payment" in q and ("due" in q or "week" in q or "next" in q):
        data = fetch_dict(f"""
            SELECT {COL_MAP["lc_no"]} as id, {COL_MAP["supplier"]} as supplier,
                   {COL_MAP["due_date"]} as due_date, {COL_MAP["amt_inr"]} as amount
            FROM LC WHERE ({COL_MAP["payment_status"]} IS NULL OR {COL_MAP["payment_status"]} != 'Paid')
            AND {COL_MAP["due_date"]} BETWEEN '{cd}' AND '{cd}'::DATE + INTERVAL 30 DAY
            ORDER BY {COL_MAP["due_date"]}
        """)
        total = sum(r['amount'] or 0 for r in data)
        return {"answer": f"₹{total:,.0f} in payments due over next 30 days across {len(data)} LCs.", "data": data}

    if "supplier" in q and "delay" in q:
        data = fetch_dict(f"""
            SELECT {COL_MAP["supplier"]} as supplier,
                   AVG(date_diff('day', {COL_MAP["shipment_date"]}, {COL_MAP["material_date"]})) as avg_delay_days,
                   COUNT(*) as count
            FROM LC WHERE {COL_MAP["material_date"]} > {COL_MAP["shipment_date"]}
            GROUP BY 1 ORDER BY 2 DESC LIMIT 5
        """)
        return {"answer": f"Top {len(data)} suppliers with shipment delays.", "data": data}

    if "pending boe" in q or ("boe" in q and "pending" in q):
        data = fetch_dict(f"""
            SELECT {COL_MAP["lc_no"]} as id, {COL_MAP["supplier"]} as supplier,
                   {COL_MAP["boe_pending_inr"]} as pending_amount
            FROM LC WHERE ({COL_MAP["boe_status"]} IS NULL OR {COL_MAP["boe_status"]} != 'Received')
            AND {COL_MAP["boe_pending_inr"]} > 5000000
            ORDER BY {COL_MAP["boe_pending_inr"]} DESC
            LIMIT 10
        """)
        return {"answer": f"Found {len(data)} LCs with pending BOE above ₹50 Lakhs.", "data": data}

    if "supplier" in q:
        data = fetch_dict(f'SELECT {COL_MAP["supplier"]} as supplier, COUNT(*) as count, SUM({COL_MAP["amt_inr"]}) as value FROM LC GROUP BY 1 ORDER BY 3 DESC LIMIT 5')
        return {"answer": "Top 5 suppliers by LC exposure value.", "data": data}

    return {
        "answer": "I'm the LC Command Center AI. I understand: 'expiring LCs', 'payments due', 'bank exposure', 'supplier delays', 'pending BOE above X amount'. Please try a more specific query.",
        "data": None
    }


# Removed root route to allow StaticFiles mount at "/" to work correctly


import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from database import DB_PATH
logger.info(f"Using database at: {DB_PATH}")

def get_static_path():
    if getattr(sys, 'frozen', False):
        # Path for PyInstaller bundle
        # Try both common patterns
        path1 = Path(sys._MEIPASS) / "frontend" / "dist"
        path2 = Path(sys._MEIPASS) / "dist"
        if path1.exists(): return path1
        if path2.exists(): return path2
        return path1 # Default
    else:
        # Local development path
        return Path(__file__).parent.parent / "frontend" / "dist"

static_path = get_static_path()
logger.info(f"Static files path: {static_path} (Exists: {static_path.exists()})")

if static_path.exists():
    app.mount("/", StaticFiles(directory=str(static_path), html=True), name="static")
else:
    logger.warning("Static files directory not found! Frontend will not be served.")

if __name__ == "__main__":
    import uvicorn
    import os
    import threading
    import webview
    import time
    import sys
    
    # Fix for windowed mode: sys.stdout and sys.stderr are None, which causes uvicorn logging to fail
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w")

    # Use port 8000 by default, but allow override
    port = int(os.getenv("PORT", 8000))
    # Default to 127.0.0.1 for local standalone app to avoid firewall prompts
    host = os.getenv("HOST", "127.0.0.1")

    def start_uvicorn():
        uvicorn.run(app, host=host, port=port, log_level="error")

    # Start server in a background thread
    server_thread = threading.Thread(target=start_uvicorn, daemon=True)
    server_thread.start()

    # Give the server a second to initialize
    time.sleep(1.5)

    # Launch the native desktop window
    # This will block until the window is closed
    webview.create_window(
        "Treasury Dashboard", 
        f"http://{host}:{port}",
        width=1366,
        height=850,
        min_size=(1024, 720),
        background_color='#ffffff'
    )
    webview.start()
    
    # When webview.start() returns, the window was closed, so the process can exit
    sys.exit(0)
