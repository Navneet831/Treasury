from fastapi import APIRouter, Query, Body, HTTPException
from typing import Optional, List
from datetime import datetime, date

# Import centralized logic
import apps.Treasury.backend.datalogic as datalogic
from apps.Treasury.backend.datalogic import get_current_date

router = APIRouter()

# ══════════════════════════════════════════════════════════
# Domain Isolation Endpoints
# ══════════════════════════════════════════════════════════

@router.get("/executive-overview")
async def get_executive_overview(currency: str = Query("INR"), fy: str = Query("All")):
    return datalogic.get_executive_overview_data(currency, fy)

@router.get("/command-data")
async def get_command_data(currency: str = Query("INR"), fy: str = Query("All")):
    return datalogic.get_command_data(currency, fy)

@router.get("/lc-exposure")
async def get_lc_exposure(currency: str = Query("INR"), fy: str = Query("All")):
    return datalogic.get_lc_exposure_data(currency, fy)

@router.get("/sblc-module")
async def get_sblc_module(currency: str = Query("INR"), fy: str = Query("All")):
    return datalogic.get_sblc_module_data(currency, fy)

@router.get("/boe-analytics")
async def get_boe_analytics(currency: str = Query("INR"), fy: str = Query("All")):
    return datalogic.get_boe_analytics_data(currency, fy)

@router.get("/payables-risk")
async def get_payables_risk(currency: str = Query("INR"), fy: str = Query("All")):
    return datalogic.get_payables_risk_data(currency, fy)

@router.get("/fx-risk")
async def get_fx_risk(fy: str = Query("All")):
    return datalogic.get_fx_risk_data(fy)

@router.get("/calendar")
async def get_calendar(month: int, year: int, bank: Optional[str] = None, instrument: Optional[str] = None, currency: str = Query("INR"), supplier: Optional[str] = None, status: Optional[str] = None, fy: str = Query("All"), payment_status: Optional[str] = None):
    events = datalogic.get_calendar_events(month, year, bank, instrument, currency, supplier, status, fy, payment_status)
    return events

@router.get("/banks")
async def get_banks():
    return datalogic.get_banks_list()

@router.get("/payment-statuses")
async def get_payment_statuses():
    return datalogic.get_payment_statuses()

@router.get("/hedge-coverage")
async def get_hedge_coverage(currency: str = Query("INR"), fy: str = Query("All")):
    return datalogic.get_hedge_coverage_data(currency, fy)

@router.get("/cash-flow-forecast")
async def get_cash_flow_forecast(currency: str = Query("INR"), fy: str = Query("All")):
    return datalogic.get_cash_flow_forecast_data(currency, fy)

@router.get("/trend-analysis")
async def get_trend_analysis(currency: str = Query("INR"), fy: str = Query("All")):
    return datalogic.get_trend_analysis_data(currency, fy)

@router.get("/cohort-analysis")
async def get_cohort_analysis(currency: str = Query("INR"), fy: str = Query("All")):
    return datalogic.get_cohort_analysis_data(currency, fy)

@router.get("/daily-reco")
async def get_daily_reco(date: str):
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    return datalogic.get_daily_reco(date)

@router.get("/fd-module")
async def get_fd_module():
    return datalogic.get_fd_module_data()

@router.get("/bg-module")
async def get_bg_module():
    return datalogic.get_bg_module_data()

@router.get("/limit-utilisation")
async def get_limit_utilisation(currency: str = Query("INR")):
    return datalogic.get_limit_utilisation_data(currency)

@router.get("/treasury-actions")
async def get_treasury_actions():
    return datalogic.get_treasury_actions()

@router.get("/trend-cohort")
async def get_trend_cohort(currency: str = Query("INR")):
    return datalogic.get_trend_cohort_data(currency)

@router.get("/lifecycle-tracker")
async def get_lifecycle_tracker(fy: str = Query("All")):
    return datalogic.get_lifecycle_tracker_data(fy)

@router.get("/strategic-intelligence")
async def get_strategic_intelligence(currency: str = Query("INR"), fy: str = Query("All")):
    return datalogic.get_strategic_intelligence_data(currency, fy)

@router.get("/advanced-quant")
async def get_advanced_quant(currency: str = Query("INR"), fy: str = Query("All")):
    return datalogic.get_advanced_quant_data(currency, fy)

@router.get("/pe-treasury")
async def get_pe_treasury():
    return datalogic.get_pe_treasury_data()

@router.get("/shipment-tracking")
async def get_shipment_tracking(fy: str = Query("All")):
    return datalogic.get_shipment_tracking_data(fy)

@router.get("/treasury-radar")
async def get_treasury_radar(currency: str = Query("INR"), fy: str = Query("All")):
    return datalogic.get_treasury_radar_data(currency, fy)

# ══════════════════════════════════════════════════════════
# Shared/Utility Endpoints
# ══════════════════════════════════════════════════════════

@router.get("/drill-down")
async def get_drill_down(
    status: Optional[str] = None,
    bank: Optional[str] = None,
    boe_status: Optional[str] = None,
    date: Optional[str] = None,
    date_field: Optional[str] = None,
    lifecycle_stage: Optional[str] = None,
    kpi: Optional[str] = None,
    alert_type: Optional[str] = None,
    fy: str = Query("All")
):
    validated_date: Optional[str] = None
    if date:
        try:
            datetime.strptime(date, "%Y-%m-%d")
            validated_date = date
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    return datalogic.get_drill_down_query(
        status=status,
        bank=bank,
        boe_status=boe_status,
        date=validated_date,
        date_field=date_field,
        fy=fy,
    )

@router.post("/ai-copilot")
async def ai_copilot(query: str = Body(..., embed=True)):
    return datalogic.process_ai_query(query)

@router.get("/transactions")
async def get_transactions(fy: str = Query("All")):
    return datalogic.get_drill_down_query(fy=fy)
