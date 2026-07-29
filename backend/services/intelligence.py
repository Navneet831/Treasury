"""Intelligence domain: health score, runway, quant models, stress tests, risk radar.

Every number is computed from the LC warehouse; rates and shock scenarios come
from APP_CONFIG (with documented defaults in core.CONFIG_DEFAULTS).
"""
import statistics
from datetime import timedelta
from typing import Any, Dict, List

from apps.Treasury.backend.database import fetch_dict, fetch_one
from apps.Treasury.backend.services.core import (
    COL_MAP, _UNPAID, _app_config, _due_amount_expr, _limit_exposure_snapshot,
    get_fy_clause, ttl_cache,
)

# Model weights — single definition, used by health score and EWI alike.
HEALTH_WEIGHTS = {"utilization": 0.40, "overdue": 0.30, "unhedged": 0.30}
EWI_WEIGHTS = {"utilization": 0.35, "stress": 0.25, "unhedged": 0.20, "overdue": 0.20}
SUPPLIER_DELAY_FULL_MARK_DAYS = 45  # avg shipment→BOE delay that scores 100 on the radar


def _risk_ratios(currency: str = "INR", fy: str = "All") -> Dict[str, float]:
    """The normalized 0–100 ratios every risk model shares (DRY single source)."""
    snap = _limit_exposure_snapshot(currency, fy)
    risk = _portfolio_risk_inputs(currency, fy)
    open_inr = risk["open_inr"]
    headroom = snap["remaining_limit"] + snap["fb_limit"]
    return {
        "headroom": headroom,
        "util_pct": min(100.0, snap["utilization_pct"]),
        "overdue_pct": min(100.0, risk["overdue_amt"] / open_inr * 100) if open_inr > 0 else 0.0,
        "unhedged_pct": min(100.0, risk["unhedged_inr"] / open_inr * 100) if open_inr > 0 else 0.0,
        "stress_pct": min(100.0, risk["due_30d"] / headroom * 100) if headroom > 0 else 100.0,
    }


@ttl_cache(seconds=60)
def _portfolio_risk_inputs(currency: str = "INR", fy: str = "All") -> Dict[str, float]:
    """One pass over LC for the aggregates every risk model shares."""
    amt_inr = COL_MAP["amt_inr"]
    due, ps, st = COL_MAP["due_date"], COL_MAP["payment_status"], COL_MAP["lc_status"]
    due_amt = _due_amount_expr("INR")
    fy_f = get_fy_clause(fy, COL_MAP["op_date"])
    row = fetch_dict(f"""
        SELECT
            COALESCE(SUM(CASE WHEN {st} = 'Open' THEN {amt_inr} ELSE 0 END), 0) as open_inr,
            COALESCE(SUM(CASE WHEN {st} IN ('Open', 'In Process') AND {COL_MAP['currency']} != 'INR' THEN {amt_inr} ELSE 0 END), 0) as fc_exposure_inr,
            COALESCE(SUM(CASE WHEN {st} = 'Open' AND "Type" = 'Unhedged' AND {COL_MAP['currency']} != 'INR' THEN {amt_inr} ELSE 0 END), 0) as unhedged_inr,
            COALESCE(SUM(CASE WHEN CAST({due} AS DATE) < CURRENT_DATE AND {_UNPAID} AND {st} NOT IN ('Closed', 'Cancelled') THEN {due_amt} ELSE 0 END), 0) as overdue_amt,
            COALESCE(SUM(CASE WHEN CAST({due} AS DATE) BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL 30 DAY AND {_UNPAID} THEN {due_amt} ELSE 0 END), 0) as due_30d,
            COALESCE(SUM(CASE WHEN CAST({due} AS DATE) BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL 90 DAY AND {_UNPAID} THEN {due_amt} ELSE 0 END), 0) as due_90d,
            COALESCE(SUM(CASE WHEN {COL_MAP['boe_status']} = 'Received' AND {_UNPAID} THEN {due_amt} ELSE 0 END), 0) as boe_received_unpaid,
            COUNT(CASE WHEN {st} = 'Open' THEN 1 END) as open_count,
            COUNT(CASE WHEN {st} = 'Open' AND CAST({COL_MAP['expiry_date']} AS DATE) BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL 30 DAY THEN 1 END) as expiring_30d_count,
            COUNT(CASE WHEN {st} = 'Open' AND ({COL_MAP['boe_status']} != 'Received' OR {COL_MAP['boe_status']} IS NULL) THEN 1 END) as boe_pending_count
        FROM LC WHERE 1=1 {fy_f}
    """)[0]
    return {k: float(v or 0) for k, v in row.items()}


def _peak_outflow_window(fy: str = "All", window_days: int = 7) -> tuple:
    """Largest 7-day cluster of future unpaid obligations: (start ISO date, value)."""
    due = COL_MAP["due_date"]
    rows = fetch_dict(f"""
        SELECT CAST({due} AS DATE) as d, SUM({_due_amount_expr("INR")}) as v
        FROM LC
        WHERE CAST({due} AS DATE) >= CURRENT_DATE AND {_UNPAID}
          AND {COL_MAP['lc_status']} NOT IN ('Closed', 'Cancelled') {get_fy_clause(fy, due)}
        GROUP BY 1 ORDER BY 1
    """)
    daily = [(r["d"], float(r["v"] or 0)) for r in rows if r["d"] is not None]
    best_start, best_val = None, 0.0
    for start_date, _ in daily:
        end_date = start_date + timedelta(days=window_days - 1)
        window_val = sum(v for d, v in daily if start_date <= d <= end_date)
        if window_val > best_val:
            best_start, best_val = start_date, window_val
    return (best_start.isoformat() if best_start else None), best_val


@ttl_cache(seconds=60)
def get_strategic_intelligence_data(currency: str = "INR", fy: str = "All") -> Dict[str, Any]:
    fy_f = get_fy_clause(fy, COL_MAP["op_date"])
    cfg = _app_config()
    snap = _limit_exposure_snapshot(currency, fy)
    risk = _portfolio_risk_inputs(currency, fy)

    locked_fd = float(fetch_one(
        f"SELECT COALESCE(SUM({COL_MAP['margin_fd']}), 0) FROM LC WHERE {COL_MAP['lc_status']} = 'Open' {fy_f}"
    )[0] or 0)
    yield_lost = locked_fd * cfg["yield_rate"]
    cost_of_inefficiency = (risk["boe_received_unpaid"] * cfg["inefficiency_boe_rate"]
                            + risk["overdue_amt"] * cfg["inefficiency_overdue_rate"])
    expected_fx_loss = risk["unhedged_inr"] * cfg["fx_var_rate"]

    ratios = _risk_ratios(currency, fy)
    health_score = max(0.0, min(100.0, 100 - (
        HEALTH_WEIGHTS["utilization"] * ratios["util_pct"]
        + HEALTH_WEIGHTS["overdue"] * ratios["overdue_pct"]
        + HEALTH_WEIGHTS["unhedged"] * ratios["unhedged_pct"]
    )))

    headroom = ratios["headroom"]
    daily_burn = risk["due_90d"] / 90 if risk["due_90d"] > 0 else 0.0
    cash_runway_days = min(365.0, headroom / daily_burn) if daily_burn > 0 else 365.0
    prob_liquidity_stress = ratios["stress_pct"]

    supplier_reliability = fetch_dict(f"""
        SELECT {COL_MAP['supplier']} as supplier,
               AVG(date_diff('day', {COL_MAP['shipment_date']}, {COL_MAP['boe_date']})) as avg_delay_days,
               COUNT(*) as tx_count
        FROM LC
        WHERE {COL_MAP['shipment_date']} IS NOT NULL AND {COL_MAP['boe_date']} IS NOT NULL {fy_f}
        GROUP BY 1 ORDER BY avg_delay_days DESC LIMIT 8
    """)

    bank_utilization = fetch_dict(f"""
        SELECT LC.{COL_MAP['bank']} as bank,
               COALESCE(SUM(CASE WHEN LC.{COL_MAP['lc_status']} IN ('Open', 'In Process') THEN LC.{COL_MAP['amt_inr']} ELSE 0 END), 0) as used_limit,
               COALESCE(MAX(CAST(NULLIF(REPLACE(bank_limit."LC", ',', ''), '') AS DOUBLE)), 0) as max_limit
        FROM LC
        LEFT JOIN bank_limit ON TRIM(UPPER(LC.{COL_MAP['bank']})) = TRIM(UPPER(bank_limit.Element))
            AND bank_limit.Bank_Table = 'Bank'
        WHERE 1=1 {fy_f}
        GROUP BY 1 ORDER BY 2 DESC
    """)

    closure = fetch_one(f"""
        SELECT AVG(date_diff('day', {COL_MAP['op_date']}, {COL_MAP['lc_close_date']}))
        FROM LC WHERE {COL_MAP['lc_close_date']} IS NOT NULL AND {COL_MAP['op_date']} IS NOT NULL {fy_f}
    """)
    lc_closure_avg_days = float(closure[0] or 0) if closure else 0.0

    demand = fetch_dict(f"""
        SELECT date_trunc('month', {COL_MAP['op_date']}) as m, SUM({COL_MAP['amt_inr']}) as v
        FROM LC
        WHERE CAST({COL_MAP['op_date']} AS DATE) >= CAST(date_trunc('month', CURRENT_DATE) - INTERVAL 3 MONTH AS DATE)
          AND CAST({COL_MAP['op_date']} AS DATE) < CAST(date_trunc('month', CURRENT_DATE) AS DATE)
        GROUP BY 1
    """)
    demand_vals = [float(d["v"] or 0) for d in demand]
    lc_demand_forecast_30d = sum(demand_vals) / len(demand_vals) if demand_vals else 0.0

    top_bank = max((float(b["used_limit"] or 0) for b in bank_utilization), default=0.0)
    total_used = sum(float(b["used_limit"] or 0) for b in bank_utilization)
    bank_dependency_risk_pct = (top_bank / total_used * 100) if total_used > 0 else 0.0

    stress_window_start, stress_window_val = _peak_outflow_window(fy)

    return {
        "health_score": round(health_score, 1),
        "cash_runway_days": round(cash_runway_days, 0),
        "remaining_limit": snap["remaining_limit"],
        "yield_optimization": {
            "locked_fd": locked_fd,
            "yield_rate_pct": cfg["yield_rate"] * 100,
            "fx_var_rate_pct": cfg["fx_var_rate"] * 100,
            "est_yield_lost_annual": yield_lost,
            "cost_of_inefficiency": cost_of_inefficiency,
            "expected_fx_loss": expected_fx_loss,
            "prob_liquidity_stress": round(prob_liquidity_stress, 1),
            "working_capital_unlock": locked_fd + yield_lost,
        },
        "supplier_reliability": supplier_reliability,
        "bank_utilization": bank_utilization,
        "quant_models": {
            "lc_closure_avg_days": lc_closure_avg_days,
            "lc_demand_forecast_30d": lc_demand_forecast_30d,
            "bank_dependency_risk_pct": round(bank_dependency_risk_pct, 1),
            "stress_window_start": stress_window_start,
            "stress_window_val": stress_window_val,
        },
    }


@ttl_cache(seconds=60)
def get_advanced_quant_data(currency: str = "INR", fy: str = "All") -> Dict[str, Any]:
    cfg = _app_config()
    snap = _limit_exposure_snapshot(currency, fy)
    risk = _portfolio_risk_inputs(currency, fy)
    due = COL_MAP["due_date"]

    history = fetch_dict(f"""
        SELECT date_trunc('month', {due}) as m, SUM({_due_amount_expr("INR")}) as v
        FROM LC WHERE {due} IS NOT NULL {get_fy_clause(fy, due)} GROUP BY 1
    """)
    monthly = [float(h["v"] or 0) for h in history]
    lar_mean = statistics.mean(monthly) if monthly else 0.0
    lar_stddev = statistics.stdev(monthly) if len(monthly) > 1 else 0.0
    liquidity_at_risk = lar_mean + 1.645 * lar_stddev

    ratios = _risk_ratios(currency, fy)
    early_warning_index = min(100.0, (
        EWI_WEIGHTS["utilization"] * ratios["util_pct"]
        + EWI_WEIGHTS["stress"] * ratios["stress_pct"]
        + EWI_WEIGHTS["unhedged"] * ratios["unhedged_pct"]
        + EWI_WEIGHTS["overdue"] * ratios["overdue_pct"]
    ))

    nfb = snap["nfb_limit"]
    exposure = snap["exposure"]
    inr_part = max(0.0, exposure - risk["fc_exposure_inr"])
    stress_tests = [{
        "scenario": "Base Case",
        "stressed_exposure": exposure,
        "utilization": (exposure / nfb * 100) if nfb > 0 else 0.0,
    }]
    for label, key in (("FX Shock — Mild", "fx_depreciation_mild"),
                       ("FX Shock — Moderate", "fx_depreciation_mod"),
                       ("FX Shock — Crisis", "fx_depreciation_crisis")):
        shocked = inr_part + risk["fc_exposure_inr"] * (1 + cfg[key])
        stress_tests.append({
            "scenario": f"{label} (+{cfg[key] * 100:.0f}% INR dep.)",
            "stressed_exposure": shocked,
            "utilization": (shocked / nfb * 100) if nfb > 0 else 0.0,
        })
    stress_tests.append({
        "scenario": "Limit Cut 10%",
        "stressed_exposure": exposure,
        "utilization": (exposure / (nfb * 0.9) * 100) if nfb > 0 else 0.0,
    })

    network = fetch_dict(f"""
        SELECT {COL_MAP['bank']} as source, {COL_MAP['supplier']} as target,
               SUM({COL_MAP['amt_inr']}) as value
        FROM LC
        WHERE {COL_MAP['lc_status']} = 'Open'
          AND {COL_MAP['bank']} IS NOT NULL AND {COL_MAP['supplier']} IS NOT NULL
          {get_fy_clause(fy, COL_MAP['op_date'])}
        GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 8
    """)

    return {
        "early_warning_index": round(early_warning_index, 1),
        "liquidity_at_risk": liquidity_at_risk,
        "lar_mean": lar_mean,
        "lar_stddev": lar_stddev,
        "network": network,
        "stress_tests": stress_tests,
    }


@ttl_cache(seconds=60)
def get_treasury_radar_data(currency: str = "INR", fy: str = "All") -> List[Dict[str, Any]]:
    risk = _portfolio_risk_inputs(currency, fy)
    ratios = _risk_ratios(currency, fy)
    open_count = risk["open_count"]

    expiry_breach = (risk["expiring_30d_count"] / open_count * 100) if open_count > 0 else 0.0
    operational_delay = (risk["boe_pending_count"] / open_count * 100) if open_count > 0 else 0.0

    delay_row = fetch_one(f"""
        SELECT AVG(date_diff('day', {COL_MAP['shipment_date']}, {COL_MAP['boe_date']}))
        FROM LC WHERE {COL_MAP['shipment_date']} IS NOT NULL AND {COL_MAP['boe_date']} IS NOT NULL
        {get_fy_clause(fy, COL_MAP['op_date'])}
    """)
    avg_delay = float(delay_row[0] or 0) if delay_row else 0.0
    supplier_delay = min(100.0, max(0.0, avg_delay) / SUPPLIER_DELAY_FULL_MARK_DAYS * 100)

    return [
        {"subject": "Liquidity Stress", "A": round(ratios["stress_pct"], 1), "fullMark": 100},
        {"subject": "Limit Exhaustion", "A": round(ratios["util_pct"], 1), "fullMark": 100},
        {"subject": "FX Volatility", "A": round(ratios["unhedged_pct"], 1), "fullMark": 100},
        {"subject": "Supplier Delay", "A": round(supplier_delay, 1), "fullMark": 100},
        {"subject": "Expiry Breach", "A": round(expiry_breach, 1), "fullMark": 100},
        {"subject": "Operational Delay", "A": round(operational_delay, 1), "fullMark": 100},
    ]
