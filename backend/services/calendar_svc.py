"""Calendar domain: event feed and daily reconciliation."""
import logging
from typing import Any, Dict, List, Optional

from apps.Treasury.backend.database import fetch_dict, fetch_one
from apps.Treasury.backend.services.core import COL_MAP, get_fy_clause

logger = logging.getLogger(__name__)


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
    except Exception as e:
        logger.warning("FD maturity events unavailable for %s-%s: %s", year, month, e)
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
