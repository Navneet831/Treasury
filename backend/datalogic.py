"""Facade for the Treasury API surface.

Implementation lives in backend/services/* — one module per domain. This file
only re-exports the flat names used by main.py and the test-suite, so consumers
never need to know the internal layout.
"""
# ruff: noqa: F401
from apps.Treasury.backend.services.core import (
    COL_MAP,
    CONFIG_DEFAULTS,
    _UNPAID,
    _app_config,
    _due_amount_expr,
    _fmt_cr,
    _limit_exposure_snapshot,
    _table_exists,
    get_current_date,
    get_fy_clause,
    get_fy_list,
    sanitize_string,
    ttl_cache,
)
from apps.Treasury.backend.services.lc import (
    get_banks_list,
    get_cohort_analysis_data,
    get_drill_down_query,
    get_lc_exposure_data,
    get_lifecycle_tracker_data,
    get_payment_statuses,
    get_shipment_tracking_data,
    get_trend_analysis_data,
    get_trend_cohort_data,
)
from apps.Treasury.backend.services.boe import get_boe_analytics_data
from apps.Treasury.backend.services.sblc import get_sblc_module_data
from apps.Treasury.backend.services.payables import (
    get_cash_flow_forecast_data,
    get_payables_risk_data,
)
from apps.Treasury.backend.services.fx import get_fx_risk_data, get_hedge_coverage_data
from apps.Treasury.backend.services.fd_bg import get_bg_module_data, get_fd_module_data
from apps.Treasury.backend.services.calendar_svc import get_calendar_events, get_daily_reco
from apps.Treasury.backend.services.limits import (
    get_limit_utilisation_data,
    get_treasury_actions,
)
from apps.Treasury.backend.services.executive import (
    get_command_data,
    get_currency_breakdown,
    get_executive_overview_data,
)
from apps.Treasury.backend.services.intelligence import (
    _peak_outflow_window,
    _portfolio_risk_inputs,
    get_advanced_quant_data,
    get_strategic_intelligence_data,
    get_treasury_radar_data,
)
from apps.Treasury.backend.services.copilot import process_ai_query
from apps.Treasury.backend.services.insights import get_page_insights
from apps.Treasury.backend.services.audit import get_audit_catalog
