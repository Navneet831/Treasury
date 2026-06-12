"""LC domain: reference lists, exposure, trends, cohorts, lifecycle, shipment, drill-down."""
import logging
from typing import Any, Dict, List, Optional

from apps.Treasury.backend.database import fetch_dict, fetch_one
from apps.Treasury.backend.services.core import (
    COL_MAP, _UNPAID, _due_amount_expr, get_current_date, get_fy_clause, ttl_cache,
)

logger = logging.getLogger(__name__)


@ttl_cache(seconds=300)
def get_banks_list() -> List[str]:
    rows = fetch_dict(f'SELECT DISTINCT {COL_MAP["bank"]} as bank FROM LC WHERE {COL_MAP["bank"]} IS NOT NULL ORDER BY 1')
    return [r["bank"] for r in rows if r["bank"]]


@ttl_cache(seconds=300)
def get_payment_statuses() -> List[str]:
    rows = fetch_dict('SELECT DISTINCT "Payment Status" FROM LC WHERE "Payment Status" IS NOT NULL ORDER BY 1')
    return [r["Payment Status"] for r in rows if r["Payment Status"]]


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
            COALESCE(MAX(CAST(NULLIF(REPLACE(bank_limit."LC", ',', ''), '') AS DOUBLE)), 0) as limit_amt,
            SUM(CASE WHEN LC.{COL_MAP['lc_status']} IN ('Open', 'In Process') THEN LC.{amt_col} ELSE 0 END) as utilized,
            COALESCE(SUM(LC.{COL_MAP['margin_fd']}), 0) as margin_fd,
            COUNT(*) as lc_count
        FROM LC
        LEFT JOIN bank_limit ON TRIM(UPPER(LC.{COL_MAP['bank']})) = TRIM(UPPER(bank_limit.Element))
            AND bank_limit.Bank_Table = 'Bank'
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


def get_trend_analysis_data(currency: str = "INR", fy: str = "All") -> Dict[str, Any]:
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    due_amt = _due_amount_expr(currency)
    op, close, due = COL_MAP["op_date"], COL_MAP["lc_close_date"], COL_MAP["due_date"]
    opened = fetch_dict(f"""
        SELECT date_trunc('month', {op}) as m, SUM({amt_col}) as v, COUNT(*) as n
        FROM LC WHERE {op} IS NOT NULL {get_fy_clause(fy, op)} GROUP BY 1
    """)
    closed = fetch_dict(f"""
        SELECT date_trunc('month', {close}) as m, SUM({amt_col}) as v, COUNT(*) as n
        FROM LC WHERE {close} IS NOT NULL {get_fy_clause(fy, close)} GROUP BY 1
    """)
    o_map, c_map = {r["m"]: r for r in opened}, {r["m"]: r for r in closed}
    monthly_opening_trend = []
    for m in sorted(set(o_map) | set(c_map)):
        ov = float((o_map.get(m) or {}).get("v") or 0)
        cv = float((c_map.get(m) or {}).get("v") or 0)
        monthly_opening_trend.append({
            "month": m.isoformat() if hasattr(m, "isoformat") else str(m),
            "opened_value": ov,
            "opened_count": int((o_map.get(m) or {}).get("n") or 0),
            "closed_value": cv,
            "closed_count": int((c_map.get(m) or {}).get("n") or 0),
            "net_exposure": ov - cv,
        })
    due_rows = fetch_dict(f"""
        SELECT date_trunc('month', {due}) as m, SUM({due_amt}) as v, COUNT(*) as n
        FROM LC WHERE {due} IS NOT NULL {get_fy_clause(fy, due)} GROUP BY 1 ORDER BY 1
    """)
    monthly_due_trend = [{
        "month": r["m"].isoformat() if hasattr(r["m"], "isoformat") else str(r["m"]),
        "due_value": float(r["v"] or 0),
        "due_count": int(r["n"] or 0),
    } for r in due_rows]
    return {"monthly_opening_trend": monthly_opening_trend, "monthly_due_trend": monthly_due_trend}


def get_cohort_analysis_data(currency: str = "INR", fy: str = "All") -> List[Dict[str, Any]]:
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    pending_col = COL_MAP["boe_pending_inr"] if currency == "INR" else COL_MAP["boe_pending_fc"]
    op, close, st, ps = COL_MAP["op_date"], COL_MAP["lc_close_date"], COL_MAP["lc_status"], COL_MAP["payment_status"]
    rows = fetch_dict(f"""
        SELECT
            date_trunc('month', {op}) as cohort_month,
            COUNT(*) as total_lcs,
            COALESCE(SUM({amt_col}), 0) as total_value,
            COUNT(CASE WHEN {st} = 'Closed' THEN 1 END) as closed_count,
            COUNT(CASE WHEN {ps} = 'Paid' THEN 1 END) as paid_count,
            COALESCE(SUM({pending_col}), 0) as pending_boe_value,
            AVG(date_diff('day', {op}, COALESCE({close}, CURRENT_DATE))) as avg_age_days
        FROM LC WHERE {op} IS NOT NULL {get_fy_clause(fy, op)}
        GROUP BY 1 ORDER BY 1 DESC
    """)
    for r in rows:
        total = int(r["total_lcs"] or 0)
        r["cohort_month"] = r["cohort_month"].isoformat() if hasattr(r["cohort_month"], "isoformat") else str(r["cohort_month"])
        r["total_lcs"] = total
        r["total_value"] = float(r["total_value"] or 0)
        r["closed_count"] = int(r["closed_count"] or 0)
        r["paid_count"] = int(r["paid_count"] or 0)
        r["pending_boe_value"] = float(r["pending_boe_value"] or 0)
        r["avg_age_days"] = float(r["avg_age_days"] or 0)
        r["closure_rate_pct"] = (r["closed_count"] / total * 100) if total > 0 else 0.0
        r["payment_rate_pct"] = (r["paid_count"] / total * 100) if total > 0 else 0.0
    return rows


def get_lifecycle_tracker_data(fy: str = "All") -> List[Dict[str, Any]]:
    cd, fy_f = get_current_date(), get_fy_clause(fy, COL_MAP['op_date'])
    stats = fetch_dict(f"SELECT COUNT(*) as total, COUNT(CASE WHEN {COL_MAP['shipment_date']} <= '{cd}' THEN 1 END) as shipped, COUNT(CASE WHEN {COL_MAP['docs_received']} = 'YES' THEN 1 END) as docs_received, COUNT(CASE WHEN {COL_MAP['bill_lodge']} IS NOT NULL THEN 1 END) as bill_lodged, COUNT(CASE WHEN {COL_MAP['bill_accept']} IS NOT NULL THEN 1 END) as bill_accepted, COUNT(CASE WHEN {COL_MAP['payment_status']} = 'Paid' THEN 1 END) as paid, COUNT(CASE WHEN {COL_MAP['lc_status']} = 'Closed' THEN 1 END) as closed FROM LC WHERE 1=1 {fy_f}")[0]
    return [{"stage": "Open LC", "count": stats['total']}, {"stage": "Shipment Done", "count": stats['shipped']}, {"stage": "Docs Received", "count": stats['docs_received']}, {"stage": "Bill Lodged", "count": stats['bill_lodged']}, {"stage": "Bill Accepted", "count": stats['bill_accepted']}, {"stage": "Payment Done", "count": stats['paid']}, {"stage": "LC Closed", "count": stats['closed']}]


def get_shipment_tracking_data(fy: str = "All") -> Dict[str, Any]:
    cd, fy_f = get_current_date(), get_fy_clause(fy, COL_MAP['op_date'])
    pending = fetch_one(f"SELECT COUNT(*) FROM LC WHERE {COL_MAP['lc_status']} = 'Open' AND ({COL_MAP['shipment_date']} > '{cd}' OR {COL_MAP['shipment_date']} IS NULL) {fy_f}")[0] or 0
    completed = fetch_one(f"SELECT COUNT(*) FROM LC WHERE {COL_MAP['shipment_date']} <= '{cd}' {fy_f}")[0] or 0
    delayed = fetch_one(f"SELECT COUNT(*) FROM LC WHERE {COL_MAP['material_date']} IS NOT NULL AND {COL_MAP['shipment_date']} IS NOT NULL AND {COL_MAP['material_date']} > {COL_MAP['shipment_date']} {fy_f}")[0] or 0
    expired = fetch_one(f"SELECT COUNT(*) FROM LC WHERE {COL_MAP['lc_status']} = 'Expired' AND {COL_MAP['shipment_date']} IS NULL {fy_f}")[0] or 0
    return {"pending_count": int(pending), "completed_count": int(completed), "delayed_count": int(delayed), "expired_count": int(expired)}


def get_trend_cohort_data(currency: str = "INR") -> Dict[str, Any]:
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    return {"exposure_trend": fetch_dict(f"SELECT date_trunc('month', {COL_MAP['op_date']}) as month, SUM({amt_col}) as value FROM LC WHERE {COL_MAP['op_date']} >= date_trunc('month', CURRENT_DATE - INTERVAL 6 MONTH) GROUP BY 1 ORDER BY 1"),
            "util_trend": fetch_dict(f"SELECT date_trunc('month', {COL_MAP['op_date']}) as month, {COL_MAP['bank']} as bank, SUM({amt_col}) as value FROM LC WHERE {COL_MAP['op_date']} >= date_trunc('month', CURRENT_DATE - INTERVAL 6 MONTH) GROUP BY 1, 2 ORDER BY 1"),
            "supplier_cohort": fetch_dict(f"SELECT {COL_MAP['supplier']} as supplier, SUM({amt_col}) as exposure, SUM(CASE WHEN {COL_MAP['payment_status']} = 'Paid' THEN {amt_col} ELSE 0 END) as payments, SUM(CASE WHEN {COL_MAP['due_date']} < CURRENT_DATE AND ({COL_MAP['payment_status']} != 'Paid' OR {COL_MAP['payment_status']} IS NULL) THEN {amt_col} ELSE 0 END) as overdues FROM LC GROUP BY 1 ORDER BY 2 DESC LIMIT 10")}


_ALLOWED_LC_STATUSES = {'Open', 'Closed', 'In Process', 'Cancelled', 'Expired'}
_ALLOWED_BOE_STATUSES = {'Received', 'Not Received', 'Cancelled'}
_ALLOWED_DATE_FIELDS = {'due_date', 'op_date', 'lc_close_date', 'expiry_date', 'boe_date'}
_ALLOWED_PAYMENT_STATUSES = {'Paid', 'Unpaid', 'Cancelled'}


def get_drill_down_query(status: Optional[str] = None, bank: Optional[str] = None, boe_status: Optional[str] = None, date: Optional[str] = None, date_field: Optional[str] = None, fy: str = "All", margin: Optional[float] = None, payment_status: Optional[str] = None) -> List[Dict[str, Any]]:
    conditions, params = [], []
    fy_clause = get_fy_clause(fy, COL_MAP['op_date'])
    if fy_clause:
        conditions.append(fy_clause.removeprefix(" AND "))
    if status and status in _ALLOWED_LC_STATUSES: conditions.append(f"{COL_MAP['lc_status']} = ?"); params.append(status)
    if bank: conditions.append(f"{COL_MAP['bank']} = ?"); params.append(bank)
    if boe_status and boe_status in _ALLOWED_BOE_STATUSES:
        # NULL BOE Status is coalesced to 'Not Received' in the pivots — match that here too.
        if boe_status == 'Not Received': conditions.append(f"({COL_MAP['boe_status']} = 'Not Received' OR {COL_MAP['boe_status']} IS NULL)")
        else: conditions.append(f"{COL_MAP['boe_status']} = ?"); params.append(boe_status)
    if payment_status and payment_status in _ALLOWED_PAYMENT_STATUSES:
        # NULL Payment Status is coalesced to 'Unpaid' in the pivots — match that here too.
        if payment_status == 'Unpaid': conditions.append(f"({COL_MAP['payment_status']} = 'Unpaid' OR {COL_MAP['payment_status']} IS NULL)")
        else: conditions.append(f"{COL_MAP['payment_status']} = ?"); params.append(payment_status)
    if date: df = date_field if date_field in _ALLOWED_DATE_FIELDS else 'due_date'; conditions.append(f"{COL_MAP[df]} = ?"); params.append(date)
    if margin is not None: conditions.append("Margin = ?"); params.append(margin)
    where_stmt = (" WHERE " + " AND ".join(conditions)) if conditions else ""
    return fetch_dict(f'SELECT * FROM LC{where_stmt} ORDER BY {COL_MAP["op_date"]} DESC LIMIT 1000', params if params else None)
