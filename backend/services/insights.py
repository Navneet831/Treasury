"""Insights engine: computed, consultant-grade observations per page.

Each insight is {id, severity, headline, detail, value?, action?} — severity in
{critical, warning, positive, info}. Every number comes from the warehouse;
thresholds come from APP_CONFIG (defaults in core.CONFIG_DEFAULTS). Every page
always returns at least one insight (the portfolio summary), so the UI never
renders an empty strip.
"""
from typing import Any, Dict, List

from apps.Treasury.backend.services.core import (
    _app_config, _fmt_cr, _limit_exposure_snapshot, ttl_cache,
)
from apps.Treasury.backend.services.fd_bg import get_fd_module_data
from apps.Treasury.backend.services.fx import get_fx_risk_data, get_hedge_coverage_data
from apps.Treasury.backend.services.intelligence import (
    _peak_outflow_window, _portfolio_risk_inputs, get_strategic_intelligence_data,
)
from apps.Treasury.backend.services.lc import get_shipment_tracking_data
from apps.Treasury.backend.services.limits import get_limit_utilisation_data
from apps.Treasury.backend.services.payables import get_cash_flow_forecast_data

Insight = Dict[str, Any]


def _ins(id_: str, severity: str, headline: str, detail: str,
         value: float = None, action: str = None) -> Insight:
    out = {"id": id_, "severity": severity, "headline": headline, "detail": detail}
    if value is not None:
        out["value"] = value
    if action:
        out["action"] = action
    return out


def _command_insights(currency: str, fy: str) -> List[Insight]:
    cfg = _app_config()
    util = get_limit_utilisation_data(currency, fy)
    out: List[Insight] = []
    for b in util["bank_utilization"]:
        pct, bank = b["utilization_pct"], b["bank"]
        if pct >= cfg["util_critical_pct"]:
            out.append(_ins(f"util-crit-{bank}", "critical",
                f"{bank} at {pct:.0f}% of its LC limit",
                f"{_fmt_cr(b['used_limit'])} drawn against {_fmt_cr(b['max_limit'])}. "
                f"{_fmt_cr(b['available_limit'])} headroom left — a single large LC could breach the line.",
                value=pct, action=f"Shift new LC issuance away from {bank} or negotiate an interim limit enhancement."))
        elif pct >= cfg["util_warning_pct"]:
            out.append(_ins(f"util-warn-{bank}", "warning",
                f"{bank} utilization at {pct:.0f}%",
                f"{_fmt_cr(b['available_limit'])} headroom remains. Route upcoming LCs to lower-utilized banks.",
                value=pct))
    in_process = sum(float(b.get("lc_in_process") or 0) for b in util["bank_utilization"])
    if in_process > 0:
        out.append(_ins("inprocess", "info",
            f"{_fmt_cr(in_process)} of LCs in process",
            "Documents submitted to bank but not yet drawn — this will consume headroom when sanctioned.",
            value=in_process))
    ps = util["portfolio_summary"]
    out.append(_ins("headroom", "positive" if ps["overall_utilization_pct"] < cfg["util_warning_pct"] else "info",
        f"{_fmt_cr(ps['total_available'])} portfolio headroom",
        f"{ps['overall_utilization_pct']:.1f}% of the {_fmt_cr(ps['total_limit'])} NFB limit utilised "
        f"across {len(util['bank_utilization'])} banks.",
        value=ps["total_available"]))
    return out


def _overview_insights(currency: str, fy: str) -> List[Insight]:
    cfg = _app_config()
    snap = _limit_exposure_snapshot(currency, fy)
    risk = _portfolio_risk_inputs(currency, fy)
    intel = get_strategic_intelligence_data(currency, fy)
    out: List[Insight] = []
    if risk["overdue_amt"] > 0:
        out.append(_ins("overdue", "critical",
            f"{_fmt_cr(risk['overdue_amt'])} overdue",
            "Unpaid obligations past due date attract penal interest and damage bank relationships.",
            value=risk["overdue_amt"], action="Clear overdue bills before issuing new LCs."))
    headroom = snap["remaining_limit"] + snap["fb_limit"]
    if headroom > 0 and risk["due_30d"] / headroom * 100 >= cfg["due30_headroom_warn_pct"]:
        out.append(_ins("due30", "warning",
            f"30-day obligations are {risk['due_30d'] / headroom * 100:.0f}% of headroom",
            f"{_fmt_cr(risk['due_30d'])} falls due within 30 days against {_fmt_cr(headroom)} of available limits.",
            value=risk["due_30d"], action="Pre-arrange liquidity or stagger payments with suppliers."))
    open_inr = risk["open_inr"]
    if open_inr > 0 and risk["unhedged_inr"] > 0:
        pct = risk["unhedged_inr"] / open_inr * 100
        sev = "warning" if pct > cfg["unhedged_threshold_pct"] else "info"
        out.append(_ins("unhedged", sev,
            f"{pct:.1f}% of open exposure is unhedged",
            f"{_fmt_cr(risk['unhedged_inr'])} carries FX risk; expected loss at {cfg['fx_var_rate'] * 100:.0f}% VaR "
            f"is {_fmt_cr(risk['unhedged_inr'] * cfg['fx_var_rate'])}.",
            value=pct, action="Hedge the CAPEX-adjacent unhedged book first."))
    wcf = intel["yield_optimization"]["locked_fd"]
    if wcf > 0:
        out.append(_ins("margin-fd", "info",
            f"{_fmt_cr(wcf)} locked in margin FDs",
            f"Estimated {_fmt_cr(intel['yield_optimization']['est_yield_lost_annual'])} annual carry cost at "
            f"{intel['yield_optimization']['yield_rate_pct']:.1f}% yield. Renegotiating margin terms with the top "
            "two banks is the largest working-capital unlock available.",
            value=wcf))
    runway = intel["cash_runway_days"]
    out.append(_ins("runway",
        "positive" if runway > cfg["runway_warn_days"] else "critical",
        f"{runway:.0f}-day liquidity runway",
        f"Available limits cover {runway:.0f} days of average obligations; treasury health score {intel['health_score']:.0f}/100.",
        value=runway))
    return out


def _cashflow_insights(currency: str, fy: str) -> List[Insight]:
    snap = _limit_exposure_snapshot(currency, fy)
    forecast = get_cash_flow_forecast_data(currency, fy)
    out: List[Insight] = []
    total = sum(f["monthly_value"] for f in forecast)
    if forecast:
        avg = total / len(forecast)
        peak = max(forecast, key=lambda f: f["monthly_value"])
        if avg > 0 and peak["monthly_value"] > 1.5 * avg:
            out.append(_ins("peak-month", "warning",
                f"{peak['month']} outflow is {peak['monthly_value'] / avg:.1f}× the monthly average",
                f"{_fmt_cr(peak['monthly_value'])} due in {peak['month']} vs {_fmt_cr(avg)} average. "
                "Concentration this sharp deserves pre-arranged limits.",
                value=peak["monthly_value"], action=f"Pre-position liquidity for {peak['month']} now."))
    start, window_val = _peak_outflow_window(fy)
    if start and window_val > 0:
        out.append(_ins("stress-window", "warning" if forecast and window_val > total / max(len(forecast), 1) else "info",
            f"Heaviest 7-day window starts {start}",
            f"{_fmt_cr(window_val)} of payments cluster in a single week — the binding liquidity constraint.",
            value=window_val))
    headroom = snap["remaining_limit"] + snap["fb_limit"]
    coverage = (headroom / total) if total > 0 else None
    out.append(_ins("pipeline", "positive" if (coverage or 2) >= 1 else "critical",
        f"{_fmt_cr(total)} total forecast outflow",
        (f"Available limits of {_fmt_cr(headroom)} cover the forecast {coverage:.1f}×."
         if coverage is not None else "No unpaid future obligations in the forecast horizon."),
        value=total))
    return out


def _fx_insights(currency: str, fy: str) -> List[Insight]:
    cfg = _app_config()
    fxd = get_fx_risk_data(fy)
    hedge = get_hedge_coverage_data(currency, fy)
    risk = _portfolio_risk_inputs(currency, fy)
    out: List[Insight] = []
    pct = fxd["total_unhedged_pct"]
    open_inr = risk["open_inr"]
    open_unhedged_pct = (risk["unhedged_inr"] / open_inr * 100) if open_inr > 0 else 0.0
    if risk["unhedged_inr"] > 0:
        sev = "critical" if open_unhedged_pct > 2 * cfg["unhedged_threshold_pct"] else \
              "warning" if open_unhedged_pct > cfg["unhedged_threshold_pct"] else "info"
        out.append(_ins("unhedged-open", sev,
            f"{open_unhedged_pct:.1f}% of open exposure unhedged",
            f"{_fmt_cr(risk['unhedged_inr'])} open unhedged ({pct:.1f}% of all FC bookings); expected FX loss at "
            f"{cfg['fx_var_rate'] * 100:.0f}% VaR is {_fmt_cr(risk['unhedged_inr'] * cfg['fx_var_rate'])}.",
            value=open_unhedged_pct,
            action=f"Hedge {_fmt_cr(max(0.0, risk['unhedged_inr'] - open_inr * cfg['unhedged_threshold_pct'] / 100))} "
                   f"to reach the {cfg['unhedged_threshold_pct']:.0f}% policy threshold."))
    by_ccy = sorted(fxd["exposure"], key=lambda e: float(e["exposure_inr"] or 0), reverse=True)
    total_fc = sum(float(e["exposure_inr"] or 0) for e in by_ccy)
    if by_ccy and total_fc > 0:
        top = by_ccy[0]
        share = float(top["exposure_inr"] or 0) / total_fc * 100
        out.append(_ins("ccy-conc", "info" if share < 80 else "warning",
            f"{top['currency']} is {share:.0f}% of FC exposure",
            f"{_fmt_cr(float(top['exposure_inr'] or 0))} of {_fmt_cr(total_fc)} foreign-currency exposure "
            f"sits in {top['currency']} — hedging strategy should anchor on this pair.",
            value=share))
    s = hedge["summary"]
    out.append(_ins("hedge-book",
        "positive" if s["unhedged_pct"] <= cfg["unhedged_threshold_pct"] else "info",
        f"Unpaid bills: {s['hedge_pct']:.0f}% hedged",
        f"Of {_fmt_cr(s['total_unpaid'])} unpaid, {_fmt_cr(s['hedged'])} is hedged (CAPEX) and "
        f"{_fmt_cr(s['unhedged'])} is open to currency moves.",
        value=s["hedge_pct"]))
    return out


def _operations_insights(currency: str, fy: str) -> List[Insight]:
    cfg = _app_config()
    risk = _portfolio_risk_inputs(currency, fy)
    intel = get_strategic_intelligence_data(currency, fy)
    ship = get_shipment_tracking_data(fy)
    out: List[Insight] = []
    open_count = risk["open_count"]
    if open_count > 0 and risk["boe_pending_count"] > 0:
        pct = risk["boe_pending_count"] / open_count * 100
        out.append(_ins("boe-pending", "warning" if pct >= cfg["boe_pending_warn_pct"] else "info",
            f"BOE pending on {pct:.0f}% of open LCs",
            f"{risk['boe_pending_count']:.0f} of {open_count:.0f} open LCs have no bill of entry yet — "
            "documentation lag delays limit release and inflates utilisation.",
            value=pct, action="Chase BOE submission on the oldest open LCs first."))
    worst = next(iter(intel["supplier_reliability"]), None)
    if worst and float(worst["avg_delay_days"] or 0) > cfg["supplier_delay_warn_days"]:
        out.append(_ins("supplier-delay", "warning",
            f"{worst['supplier']} averages {float(worst['avg_delay_days']):.0f} days shipment→BOE",
            f"Slowest of the supplier base across {worst['tx_count']} transactions — each delayed day "
            "extends the LC cycle and locks margin FDs longer.",
            value=float(worst["avg_delay_days"]),
            action="Add documentation SLAs to the next renegotiation with this supplier."))
    if risk["expiring_30d_count"] > 0:
        out.append(_ins("expiring", "warning",
            f"{risk['expiring_30d_count']:.0f} LCs expire within 30 days",
            "Expiry without shipment forfeits the LC and strands the margin — confirm shipment or extend now.",
            value=risk["expiring_30d_count"]))
    if ship["delayed_count"] > 0:
        out.append(_ins("delayed-receipts", "info",
            f"{ship['delayed_count']} delayed material receipts",
            "Material arrived after the LC shipment date — track against supplier reliability scores.",
            value=ship["delayed_count"]))
    closure = intel["quant_models"]["lc_closure_avg_days"]
    out.append(_ins("cycle-time", "info",
        f"{closure:.0f}-day average LC cycle",
        f"Opening to closure averages {closure:.0f} days; every 10-day reduction releases roughly "
        f"{_fmt_cr(risk['open_inr'] / max(closure, 1) * 10)} of limit capacity.",
        value=closure))
    return out


_PAGE_BUILDERS = {
    "command": _command_insights,
    "overview": _overview_insights,
    "cashflow": _cashflow_insights,
    "fx": _fx_insights,
    "operations": _operations_insights,
}


@ttl_cache(seconds=60)
def get_page_insights(page: str, currency: str = "INR", fy: str = "All") -> List[Insight]:
    builder = _PAGE_BUILDERS.get(page)
    if builder is None:
        raise ValueError(f"Unknown insights page '{page}'. Valid pages: {sorted(_PAGE_BUILDERS)}")
    return builder(currency, fy)
