"""Audit catalog: the methodology register behind the Audit tab.

Static parts (metric definitions, conventions) are versioned here, next to the
services that compute them — change a formula, change its entry. Live parts
(config values, table row counts) are read from the warehouse at request time
so the register can never drift from what the app is actually using.
"""
import logging
from typing import Any, Dict, List

from apps.Treasury.backend.database import fetch_dict, fetch_one
from apps.Treasury.backend.services.core import CONFIG_DEFAULTS, ttl_cache

logger = logging.getLogger(__name__)

# Tables the app reads, and why. Row counts are fetched live.
_DATA_SOURCES = [
    {"table": "LC", "purpose": "Master letter-of-credit register — every exposure, due date, BOE and payment status. Primary source for almost every number in the app.",
     "columns_used": "LC Amt (in INR/FC), BOE Bill Amt, Pending BOE Amt, LC Status, Payment Status, BOE Status, LC Op./Close/Due/Expiry/Shipment dates, Margin, Margin FD Made, Bank, Supplier, Currency, Type, Product Name"},
    {"table": "bank_limit", "purpose": "Sanctioned limits per bank (LC / SBLC / Cash columns, Bank_Table='Bank' rows). Source of every limit and headroom figure.",
     "columns_used": "Element (bank), LC, SBLC, Cash"},
    {"table": "SBLC", "purpose": "Standby LC register — outstanding and paid SBLC bills per bank.",
     "columns_used": "BANK, BOE Bill Amt (in INR), Final PAYMENT AMT INR, Payment Status, SBLC LC Payment Due Date"},
    {"table": "LC BG in Process", "purpose": "Instruments submitted to bank but not yet drawn — shown as 'In Process', informational until sanctioned.",
     "columns_used": "Bank Name, AMT IN INR, Amt in FC, Status"},
    {"table": "FDR_List", "purpose": "Fixed-deposit register (varchar Excel load) — margin FDs, lien amounts, maturity buckets, FD-release calendar events.",
     "columns_used": "Bank Name, FINAL FD AMT, FD LIEN AMT for LC/BG, LC/BG/COLLETRAL, Maturity Date, STATUS"},
    {"table": "Bank_Guarantee", "purpose": "BG register (varchar Excel load) — outstanding, expiring and FD-linked guarantees; feeds the limit waterfall.",
     "columns_used": "Amt., status, Date of expiry, FD Lien Amt"},
    {"table": "APP_CONFIG", "purpose": "Rates and thresholds (key/value). Overrides the documented defaults below — nothing is hardcoded in the app.",
     "columns_used": "key, value, description"},
]

# What each configurable rate/threshold controls (defaults in core.CONFIG_DEFAULTS).
_CONFIG_DESCRIPTIONS = {
    "yield_rate": "Annual opportunity yield applied to margin FDs (yield lost = locked FD × rate).",
    "fx_depreciation_mild": "Mild INR-depreciation shock applied to FC exposure in stress tests.",
    "fx_depreciation_mod": "Moderate INR-depreciation shock in stress tests.",
    "fx_depreciation_crisis": "Crisis INR-depreciation shock in stress tests.",
    "inefficiency_boe_rate": "Carry-cost rate applied to BOE-received-but-unpaid bills in the inefficiency cost.",
    "inefficiency_overdue_rate": "Penalty-cost rate applied to overdue bills in the inefficiency cost.",
    "fx_var_rate": "Value-at-risk rate applied to unhedged open exposure (expected FX loss).",
    "util_warning_pct": "Bank utilization % that raises a warning insight.",
    "util_critical_pct": "Bank utilization % that raises a critical insight.",
    "unhedged_threshold_pct": "Policy ceiling for unhedged share of open exposure.",
    "supplier_delay_warn_days": "Average shipment→BOE delay (days) that flags a supplier.",
    "boe_pending_warn_pct": "Share of open LCs without BOE that raises a warning.",
    "runway_warn_days": "Liquidity runway (days) below which the runway insight turns critical.",
    "due30_headroom_warn_pct": "30-day obligations as % of headroom that raises a warning.",
}

_CONVENTIONS = [
    {"topic": "Amounts", "rule": "All amounts display as ₹ Cr (crores, 2 decimals) unless the unit toggle is set to Absolute. Backend always returns raw rupees; formatting is purely presentational."},
    {"topic": "Unpaid", "rule": "A bill is 'unpaid' when Payment Status is NULL or anything other than 'Paid'. NULL is deliberately treated as unpaid — absence of confirmation is not payment."},
    {"topic": "Payment obligation amount", "rule": "Once a BOE bill is lodged (BOE Bill Amt > 0) the obligation is the BOE bill amount; before that it is the LC amount. This 'due amount' rule is used by the calendar, forecast, insights and copilot consistently."},
    {"topic": "Fiscal year (FY)", "rule": "Indian fiscal year, 1 April – 31 March. The FY dropdown lists only years actually present in the LC data (derived live, never hardcoded). FY filters apply to the opening date unless a view states otherwise."},
    {"topic": "Limit utilization rule", "rule": "Bank limit utilization counts Open LCs at 10% margin only (Margin = 0.1) — the business rule for limit-consuming instruments. 'In Process' amounts come from the LC BG in Process table and are informational until drawn."},
    {"topic": "Hedged classification", "rule": "An LC is hedged when its Type is anything other than 'Unhedged'. In the hedge-coverage product view, CAPEX-type bills are treated as the hedged book."},
    {"topic": "Caching", "rule": "Heavy aggregates are cached for 60s (reference lists 300s). The warehouse is a read-only daily load, so cached figures cannot be stale within a working session in any material way."},
    {"topic": "AI Copilot", "rule": "The copilot is a deterministic intent router — every answer is a SQL aggregate over the LC table with a computed narrative. It does not generate numbers and cannot hallucinate."},
    {"topic": "No synthetic data", "rule": "Every figure derives from the warehouse. Tabs whose source tables contained seeded sample data (PE Treasury) were removed rather than shown."},
]

_METRICS: List[Dict[str, Any]] = [
    # ── Command Center ───────────────────────────────────────────────────
    {"id": "cmd-used-limit", "name": "Used Limit (per bank)", "tab": "Command Center",
     "formula": "Sum of LC Amt for LCs with Status = 'Open' AND Margin = 0.1, per bank.",
     "source": "LC: LC Amt (in INR), LC Status, Margin, Bank Name",
     "caveats": "Only 10%-margin Open LCs consume the sanctioned limit (business rule)."},
    {"id": "cmd-in-process", "name": "LC In Process (per bank)", "tab": "Command Center",
     "formula": "Sum of AMT IN INR from 'LC BG in Process' where Status = 'DOC SUBMITTED TO BANK'.",
     "source": "LC BG in Process: Bank Name, AMT IN INR, Status",
     "caveats": "Informational — will consume headroom when sanctioned, not counted in utilization."},
    {"id": "cmd-utilization", "name": "Utilization % (per bank)", "tab": "Command Center",
     "formula": "Used Limit ÷ sanctioned LC limit × 100.",
     "source": "LC + bank_limit.LC (matched on bank name, case/space-insensitive)"},
    {"id": "cmd-available", "name": "Available Limit (per bank)", "tab": "Command Center",
     "formula": "max(0, sanctioned LC limit − Used Limit).",
     "source": "bank_limit.LC − computed Used Limit"},
    {"id": "cmd-interchangeable", "name": "Interchangeable SBLC / Cash rows", "tab": "Command Center",
     "formula": "SBLC and Cash sub-limits read directly from bank_limit per bank; '—' when not sanctioned.",
     "source": "bank_limit: SBLC, Cash columns"},
    {"id": "cmd-waterfall", "name": "Limit Waterfall", "tab": "Command Center",
     "formula": "Total NFB Limit − LC Exposure − BG Outstanding = Available Limit.",
     "source": "bank_limit.LC totals, LC used limit, Bank_Guarantee outstanding"},
    {"id": "cmd-boe-pivot", "name": "BOE × Margin pivot", "tab": "Command Center",
     "formula": "BOE Bill Amt (falling back to LC Amt) summed by bank × margin bucket for BOE-received bills, filtered by the payment-status toggle.",
     "source": "LC: BOE Bill Amt, Margin, BOE Status, Payment Status"},

    # ── Executive Overview ───────────────────────────────────────────────
    {"id": "ov-available-lc", "name": "Available LC Limit", "tab": "Executive Overview",
     "formula": "max(0, Σ bank_limit.LC − Total LC Exposure).",
     "source": "bank_limit.LC, LC exposure (Open + In Process)"},
    {"id": "ov-cash-credit", "name": "Cash Credit Limit", "tab": "Executive Overview",
     "formula": "Σ bank_limit.Cash across banks — the sanctioned fund-based limit.",
     "source": "bank_limit.Cash",
     "caveats": "This is the sanctioned limit, NOT a live cash balance — bank-statement integration is pending."},
    {"id": "ov-exposure", "name": "Total LC Exposure", "tab": "Executive Overview",
     "formula": "Σ LC Amt for Status IN ('Open', 'In Process').",
     "source": "LC: LC Amt (in INR/FC), LC Status"},
    {"id": "ov-sblc-exposure", "name": "Total SBLC Exposure", "tab": "Executive Overview",
     "formula": "Σ LC Amt for Open LCs whose SBLC Status starts with 'Yes'.",
     "source": "LC: SBLC Status, LC Amt"},
    {"id": "ov-wc-frozen", "name": "Working Capital Frozen", "tab": "Executive Overview",
     "formula": "Σ 'Margin FD Made' across Open LCs — cash locked as LC margin.",
     "source": "LC: Margin FD Made, LC Status"},
    {"id": "ov-hedged-pct", "name": "Hedged / Unhedged %", "tab": "Executive Overview",
     "formula": "Hedged = Σ exposure where Type ≠ 'Unhedged' ÷ total exposure × 100; Unhedged = 100 − Hedged.",
     "source": "LC: Type, LC Amt"},
    {"id": "ov-upcoming-30d", "name": "Due in 30 Days", "tab": "Executive Overview",
     "formula": "Σ LC Amt of unpaid bills with due date in [today, today+30d].",
     "source": "LC: LC Payment Due Date, Payment Status"},
    {"id": "ov-overdue", "name": "Overdue (insight & action queue)", "tab": "Executive Overview",
     "formula": "Σ due amount of unpaid, non-closed bills with due date < today.",
     "source": "LC: LC Payment Due Date, Payment Status, LC Status, BOE Bill Amt"},
    {"id": "ov-actions", "name": "Action Queue", "tab": "Executive Overview",
     "formula": "Priority 1: bank utilization > 90%. Priority 2: payments due within 7 days. Priority 3: FDs maturing within 7 days. Priority 4: unhedged share above the configured threshold.",
     "source": "Computed from limit utilisation, LC dues, FDR_List maturities, FX risk",
     "config_keys": "unhedged_threshold_pct"},

    # ── Calendar ─────────────────────────────────────────────────────────
    {"id": "cal-events", "name": "Calendar events", "tab": "Calendar",
     "formula": "Payment Due / Paid use the due-amount rule on the due date; LC Opened/Closed use LC Amt on their dates; LC Expiry shows non-closed LCs on expiry date; BOE Received on BOE submission date; FD Margin Released sums active FDR lien amounts on maturity date.",
     "source": "LC date columns + FDR_List (Maturity Date, FD LIEN AMT, STATUS='ACTIVE')"},
    {"id": "cal-reco", "name": "Daily reconciliation panel", "tab": "Calendar",
     "formula": "For the selected day: count and Σ LC Amt of LCs opened, closed, due-unpaid, due-paid, BOE received, plus FD lien releasing.",
     "source": "LC, FDR_List — exact-date matches"},

    # ── Cash Flow ────────────────────────────────────────────────────────
    {"id": "cf-monthly", "name": "Monthly forecast value", "tab": "Cash Flow",
     "formula": "Σ due amount (BOE bill if lodged, else LC amount) of unpaid, non-closed bills grouped by due month, from the current month forward.",
     "source": "LC: LC Payment Due Date, BOE Bill Amt, LC Amt, Payment Status, LC Status"},
    {"id": "cf-ci", "name": "95% confidence band", "tab": "Cash Flow",
     "formula": "monthly value ± 1.645 × σ, where σ is the standard deviation of ALL historical monthly due totals. Lower bound floored at 0.",
     "source": "Historical monthly totals from the same due-amount rule",
     "caveats": "A volatility band, not a prediction interval — it shows how variable months have been."},
    {"id": "cf-cumulative", "name": "Cumulative exposure line", "tab": "Cash Flow",
     "formula": "Running sum of monthly forecast values.",
     "source": "Derived from monthly forecast"},
    {"id": "cf-trend", "name": "Opening vs Closure trend", "tab": "Cash Flow",
     "formula": "Per month: Σ LC Amt opened (by op date), Σ LC Amt closed (by close date), net = opened − closed.",
     "source": "LC: LC Op. Date, LC Close date, LC Amt"},
    {"id": "cf-cohort", "name": "Cohort closure / payment rates", "tab": "Cash Flow",
     "formula": "Per opening month: closed count ÷ total × 100, paid count ÷ total × 100, avg age = days from opening to closure (or today if open).",
     "source": "LC grouped by month of LC Op. Date"},

    # ── FX & Hedging ─────────────────────────────────────────────────────
    {"id": "fx-exposure", "name": "FC exposure by currency", "tab": "FX & Hedging",
     "formula": "Σ LC Amt (FC and INR values) grouped by currency, excluding INR bookings.",
     "source": "LC: Currency, Final LC Amt (in FC), LC Amt (in INR)"},
    {"id": "fx-unhedged", "name": "Unhedged share", "tab": "FX & Hedging",
     "formula": "Σ exposure where Type = 'Unhedged' ÷ total FC exposure × 100. Alert fires above the configured policy threshold.",
     "source": "LC: Type, LC Amt (in INR)", "config_keys": "unhedged_threshold_pct"},
    {"id": "fx-loss", "name": "Expected FX loss (VaR)", "tab": "FX & Hedging",
     "formula": "Unhedged open exposure × fx_var_rate.",
     "source": "LC unhedged open exposure × APP_CONFIG rate", "config_keys": "fx_var_rate"},
    {"id": "fx-hedge-book", "name": "Hedge coverage by product", "tab": "FX & Hedging",
     "formula": "Unpaid bills grouped by product; CAPEX-type rows form the hedged book, everything else is unhedged.",
     "source": "LC: Product Name, Type, Payment Status, BOE Bill/LC Amt",
     "caveats": "CAPEX-as-hedged reflects current treasury practice; revisit if forward contracts are booked per-LC."},

    # ── Operations ───────────────────────────────────────────────────────
    {"id": "ops-funnel", "name": "Lifecycle funnel", "tab": "Operations",
     "formula": "Counts per stage: all LCs → shipment date passed → documents received = 'YES' → bill lodged → bill accepted → paid → closed. Percentages are stage-to-stage conversion.",
     "source": "LC stage columns"},
    {"id": "ops-boe-aging", "name": "BOE aging buckets", "tab": "Operations",
     "formula": "Unpaid bills with a BOE submission date, bucketed by days since submission (0-30 / 31-60 / 61-90 / 90+), valued at Pending BOE Amt.",
     "source": "LC: Date of Bill of Entry Submitted to Bank, Pending BOE Amt, Payment Status"},
    {"id": "ops-delayed", "name": "Delayed receipts", "tab": "Operations",
     "formula": "Count of LCs where Material Receipt Date > LC Shipment Date.",
     "source": "LC: Material Receipt Date, LC SHIPMENT DATE"},
    {"id": "ops-supplier-delay", "name": "Supplier shipment→BOE delay", "tab": "Operations",
     "formula": "Average days between LC Shipment Date and BOE submission per supplier (slowest first).",
     "source": "LC: LC SHIPMENT DATE, Date of Bill of Entry Submitted to Bank, Supplier Name",
     "config_keys": "supplier_delay_warn_days"},
    {"id": "ops-supplier-cohort", "name": "Supplier exposure & discipline", "tab": "Operations",
     "formula": "Per supplier (top 10 by exposure): Σ exposure, Σ paid, Σ overdue (due < today and unpaid).",
     "source": "LC grouped by Supplier Name"},

    # ── Intelligence ─────────────────────────────────────────────────────
    {"id": "int-health", "name": "Treasury Health Score", "tab": "Intelligence",
     "formula": "100 − (0.4 × utilization% + 0.3 × overdue share of open exposure + 0.3 × unhedged share), clamped to 0–100.",
     "source": "Limit snapshot + LC risk aggregates"},
    {"id": "int-runway", "name": "Cash Runway (days)", "tab": "Intelligence",
     "formula": "(NFB headroom + cash credit limit) ÷ (90-day unpaid dues ÷ 90), capped at 365. 365 when no dues.",
     "source": "bank_limit + LC dues", "config_keys": "runway_warn_days"},
    {"id": "int-stress-prob", "name": "Liquidity stress probability", "tab": "Intelligence",
     "formula": "30-day unpaid dues ÷ total headroom × 100, capped at 100. A coverage ratio expressed as a score, not a statistical probability.",
     "source": "LC dues + limits"},
    {"id": "int-yield-lost", "name": "Yield lost / Working-capital unlock", "tab": "Intelligence",
     "formula": "Yield lost = margin FDs on Open LCs × yield_rate. Unlock = locked FD + annual yield lost.",
     "source": "LC: Margin FD Made × APP_CONFIG rate", "config_keys": "yield_rate"},
    {"id": "int-inefficiency", "name": "Inefficiency cost", "tab": "Intelligence",
     "formula": "BOE-received-but-unpaid amount × inefficiency_boe_rate + overdue amount × inefficiency_overdue_rate.",
     "source": "LC aggregates × APP_CONFIG rates",
     "config_keys": "inefficiency_boe_rate, inefficiency_overdue_rate"},
    {"id": "int-closure", "name": "Average LC cycle (days)", "tab": "Intelligence",
     "formula": "Mean of (close date − opening date) across all closed LCs.",
     "source": "LC: LC Op. Date, LC Close date"},
    {"id": "int-demand", "name": "30-day demand forecast", "tab": "Intelligence",
     "formula": "Average monthly LC opening value over the last 3 full calendar months.",
     "source": "LC: LC Op. Date, LC Amt (in INR)",
     "caveats": "Simple moving average — no seasonality adjustment yet."},
    {"id": "int-dependency", "name": "Bank dependency risk", "tab": "Intelligence",
     "formula": "Largest single bank's share of total open exposure × 100.",
     "source": "LC exposure grouped by bank"},
    {"id": "int-stress-window", "name": "Stress window (7-day)", "tab": "Intelligence",
     "formula": "The 7-day span with the maximum sum of future unpaid obligations, found by sliding a window over daily due totals.",
     "source": "LC: due dates and due amounts"},
    {"id": "int-ewi", "name": "Early Warning Index", "tab": "Intelligence",
     "formula": "0.35 × utilization% + 0.25 × (30-day dues ÷ headroom %) + 0.20 × unhedged% + 0.20 × overdue%, capped at 100.",
     "source": "Composite of limit snapshot + LC risk aggregates"},
    {"id": "int-lar", "name": "Liquidity-at-Risk (95%)", "tab": "Intelligence",
     "formula": "Mean of historical monthly obligation totals + 1.645 × their standard deviation.",
     "source": "LC monthly due totals (due-amount rule)"},
    {"id": "int-stress-tests", "name": "FX / limit stress scenarios", "tab": "Intelligence",
     "formula": "FC portion of exposure inflated by the configured depreciation shocks (mild/moderate/crisis); 'Limit Cut 10%' recomputes utilization against 90% of the NFB limit.",
     "source": "LC exposure split INR/FC × APP_CONFIG shocks",
     "config_keys": "fx_depreciation_mild, fx_depreciation_mod, fx_depreciation_crisis"},
    {"id": "int-radar", "name": "Risk radar axes", "tab": "Intelligence",
     "formula": "Liquidity Stress = 30-day dues ÷ headroom. Limit Exhaustion = utilization %. FX Volatility = unhedged share. Supplier Delay = avg shipment→BOE delay ÷ 45 days. Expiry Breach = share of open LCs expiring ≤30d. Operational Delay = share of open LCs without BOE. All scaled 0–100.",
     "source": "LC + bank_limit aggregates"},
    {"id": "int-network", "name": "Bank → supplier concentration", "tab": "Intelligence",
     "formula": "Top 8 open-LC exposure pairs of (bank, supplier).",
     "source": "LC grouped by Bank Name × Supplier Name"},

    # ── Insights engine ──────────────────────────────────────────────────
    {"id": "ins-severity", "name": "Insight severities & thresholds", "tab": "Insights",
     "formula": "critical/warning fire when a metric crosses its configured threshold (e.g. bank utilization ≥ util_warning_pct / util_critical_pct; unhedged ≥ unhedged_threshold_pct; 30-day dues ≥ due30_headroom_warn_pct of headroom). Each page always emits at least one summary insight.",
     "source": "Computed from the same aggregates as the host page",
     "config_keys": "util_warning_pct, util_critical_pct, unhedged_threshold_pct, boe_pending_warn_pct, supplier_delay_warn_days, due30_headroom_warn_pct, runway_warn_days"},
    {"id": "ins-actions", "name": "Insight 'action' lines", "tab": "Insights",
     "formula": "Deterministic recommendations attached when a threshold is crossed (e.g. the hedge amount needed to return to policy = unhedged − open exposure × threshold).",
     "source": "Same aggregates; arithmetic shown in each insight's detail text"},
]


@ttl_cache(seconds=60)
def get_audit_catalog() -> Dict[str, Any]:
    # Live config: defaults overlaid with APP_CONFIG rows
    overrides: Dict[str, Dict[str, Any]] = {}
    try:
        for r in fetch_dict("SELECT key, value, description FROM APP_CONFIG"):
            overrides[r["key"]] = r
    except Exception as e:
        logger.warning("APP_CONFIG unavailable for audit catalog: %s", e)

    config = []
    for key, default in CONFIG_DEFAULTS.items():
        row = overrides.get(key)
        config.append({
            "key": key,
            "value": float(row["value"]) if row and row["value"] is not None else default,
            "default": default,
            "overridden": row is not None,
            "description": (row.get("description") if row else None) or _CONFIG_DESCRIPTIONS.get(key, ""),
        })
    # DB keys the app doesn't know defaults for — still surface them
    for key, row in overrides.items():
        if key not in CONFIG_DEFAULTS:
            config.append({
                "key": key,
                "value": float(row["value"]) if row["value"] is not None else None,
                "default": None,
                "overridden": True,
                "description": row.get("description") or "",
            })

    data_sources = []
    for src in _DATA_SOURCES:
        try:
            count = fetch_one(f'SELECT COUNT(*) FROM "{src["table"]}"')[0]
        except Exception as e:
            logger.warning("Audit row count failed for %s: %s", src["table"], e)
            count = None
        data_sources.append({**src, "row_count": count})

    return {
        "config": config,
        "data_sources": data_sources,
        "conventions": _CONVENTIONS,
        "metrics": _METRICS,
    }
