"""Shared foundation: column map, fiscal-year handling, config, cache, shared aggregates.

Nothing in this module hardcodes business thresholds — every rate/threshold has a
documented default that the APP_CONFIG warehouse table can override (key/value).
"""
import functools
import logging
import re
import time
from datetime import date
from typing import Any, Dict, List, Optional

from apps.Treasury.backend.database import fetch_dict, fetch_one

logger = logging.getLogger(__name__)

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

_UNPAID = f"({COL_MAP['payment_status']} IS NULL OR {COL_MAP['payment_status']} != 'Paid')"


def get_current_date() -> str:
    return date.today().isoformat()


def get_fy_clause(fy: str, date_col: str) -> str:
    """Indian fiscal year filter. Accepts any 'FY<yy>-<yy+1>' (e.g. FY27-28)."""
    m = re.fullmatch(r"FY(\d{2})-(\d{2})", fy or "")
    if not m or (int(m.group(1)) + 1) % 100 != int(m.group(2)):
        return ""
    start = f"20{int(m.group(1)):02d}-04-01"
    end = f"20{int(m.group(2)):02d}-03-31"
    return f" AND {date_col} >= '{start}' AND {date_col} <= '{end}'"


def sanitize_string(val: Optional[str]) -> str:
    if val is None:
        return ""
    return val.replace("'", "''")


def _fmt_cr(value: float) -> str:
    return f"₹{value / 1e7:,.2f} Cr"


def _due_amount_expr(currency: str) -> str:
    """Payment obligation = BOE bill amount once lodged, else LC amount."""
    boe = COL_MAP["boe_bill_inr"] if currency == "INR" else COL_MAP["boe_bill_fc"]
    amt = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    return f"CASE WHEN {boe} > 0 THEN {boe} ELSE {amt} END"


# ── TTL cache ────────────────────────────────────────────────────────────────

def ttl_cache(seconds: float = 60.0, maxsize: int = 256):
    """Read-through cache for warehouse aggregates. The warehouse is a read-only
    daily Excel load, so short TTLs trade no correctness for large latency wins."""
    def decorator(fn):
        store: Dict[Any, Any] = {}

        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            key = (args, tuple(sorted(kwargs.items())))
            now = time.monotonic()
            hit = store.get(key)
            if hit is not None and now - hit[0] < seconds:
                return hit[1]
            value = fn(*args, **kwargs)
            if len(store) >= maxsize:
                store.pop(next(iter(store)))
            store[key] = (now, value)
            return value

        wrapper.cache_clear = store.clear
        return wrapper
    return decorator


# ── Config (defaults overridable via APP_CONFIG table) ───────────────────────

CONFIG_DEFAULTS = {
    "yield_rate": 0.07,
    "fx_depreciation_mild": 0.05,
    "fx_depreciation_mod": 0.10,
    "fx_depreciation_crisis": 0.15,
    "inefficiency_boe_rate": 0.10,
    "inefficiency_overdue_rate": 0.12,
    "fx_var_rate": 0.03,
    # Insight thresholds
    "util_warning_pct": 85.0,
    "util_critical_pct": 95.0,
    "unhedged_threshold_pct": 30.0,
    "supplier_delay_warn_days": 20.0,
    "boe_pending_warn_pct": 40.0,
    "runway_warn_days": 30.0,
    "due30_headroom_warn_pct": 50.0,
}


@ttl_cache(seconds=300)
def _app_config() -> Dict[str, float]:
    rates = dict(CONFIG_DEFAULTS)
    try:
        rows = fetch_dict("SELECT key, value FROM APP_CONFIG")
        rates.update({r["key"]: float(r["value"]) for r in rows if r["value"] is not None})
    except Exception as e:
        logger.warning("APP_CONFIG unavailable, using default rates: %s", e)
    return rates


def _table_exists(name: str) -> bool:
    row = fetch_one("SELECT COUNT(*) FROM information_schema.tables WHERE table_name = ?", [name])
    return bool(row and row[0])


# ── Shared aggregates ────────────────────────────────────────────────────────

@ttl_cache(seconds=60)
def _limit_exposure_snapshot(currency: str = "INR", fy: str = "All") -> Dict[str, float]:
    amt_col = COL_MAP["amt_inr"] if currency == "INR" else COL_MAP["amt_fc"]
    fy_filter = get_fy_clause(fy, COL_MAP["op_date"])
    limits = fetch_one("""
        SELECT COALESCE(SUM(CAST(NULLIF(REPLACE("LC", ',', ''), '') AS DOUBLE)), 0),
               COALESCE(SUM(CAST(NULLIF(REPLACE("Cash", ',', ''), '') AS DOUBLE)), 0)
        FROM bank_limit WHERE Bank_Table = 'Bank' AND Element != ''
    """)
    nfb_limit = float(limits[0] or 0) if limits else 0.0
    fb_limit = float(limits[1] or 0) if limits else 0.0
    row = fetch_one(f"""
        SELECT COALESCE(SUM({amt_col}), 0)
        FROM LC WHERE {COL_MAP['lc_status']} IN ('Open', 'In Process') {fy_filter}
    """)
    exposure = float(row[0] or 0) if row else 0.0
    return {
        "nfb_limit": nfb_limit,
        "fb_limit": fb_limit,
        "exposure": exposure,
        "remaining_limit": max(0.0, nfb_limit - exposure),
        "utilization_pct": (exposure / nfb_limit * 100) if nfb_limit > 0 else 0.0,
    }


@ttl_cache(seconds=300)
def get_fy_list() -> List[str]:
    """Fiscal years actually present in the data — never a frozen list."""
    row = fetch_one(f"""
        SELECT MIN({COL_MAP['op_date']}),
               MAX(COALESCE({COL_MAP['due_date']}, {COL_MAP['op_date']}))
        FROM LC
    """)
    if not row or row[0] is None:
        return []
    def fy_start_year(d) -> int:
        return d.year if d.month >= 4 else d.year - 1
    first, last = fy_start_year(row[0]), fy_start_year(row[1] or row[0])
    return [f"FY{y % 100:02d}-{(y + 1) % 100:02d}" for y in range(first, last + 1)]
