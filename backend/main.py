from fastapi import APIRouter, Query, Body, HTTPException
from typing import Optional, List
from datetime import datetime, date
from dotenv import load_dotenv
import os

# Load environment variables. Load from parent directories first so closer files can override.
backend_dir = os.path.dirname(os.path.abspath(__file__))
treasury_dir = os.path.dirname(backend_dir)
grew_analytics_root = os.path.dirname(os.path.dirname(treasury_dir))

for path in [grew_analytics_root, treasury_dir, backend_dir]:
    env_file = os.path.join(path, '.env')
    if os.path.exists(env_file):
        load_dotenv(dotenv_path=env_file, override=True)


# Import centralized logic
import apps.Treasury.backend.datalogic as datalogic
from apps.Treasury.backend.datalogic import get_current_date
import apps.Treasury.backend.market_data as market_data

router = APIRouter()

@router.get("/usd-inr")
async def get_usd_inr_rate():
    rate = market_data.get_usd_inr_rate()
    return {"rate": rate}

@router.get("/market-rates")
async def get_market_rates():
    return market_data.get_all_rates()

@router.get("/health")
async def health_check():
    from apps.Treasury.backend.database import get_repo
    repo = get_repo()
    return {
        "status": "operational",
        "module": "Treasury",
        "repository": type(repo).__name__,
        "timestamp": datetime.now().isoformat()
    }

@router.get("/db-config")
async def get_db_config():
    import os
    import subprocess
    from apps.Treasury.backend.database import get_repo
    
    connection = None
    source = None
    connection_error = None
    
    try:
        repo = get_repo()
        dsn = repo._dsn
        if dsn.startswith("postgresql://"):
            parts = dsn[len("postgresql://"):].split("@")
            user_pass = parts[0].split(":")
            user = user_pass[0]
            host_port_db = parts[1].split("/")
            database = host_port_db[1]
            host_port = host_port_db[0].split(":")
            host = host_port[0]
            port = int(host_port[1]) if len(host_port) > 1 else 5432
            
            connection = {
                "host": host,
                "port": port,
                "user": user,
                "database": database,
                "ssl": False
            }
            source = "env"
    except Exception as e:
        connection_error = f"Failed to retrieve database configuration: {str(e)}"

    git_info = {"branch": None, "commits": [], "error": None}
    try:
        branch = subprocess.check_output(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"], 
            stderr=subprocess.DEVNULL
        ).decode().strip()
        
        raw_log = subprocess.check_output(
            ["git", "log", "-5", "--format=%H|%s|%ai|%an"], 
            stderr=subprocess.DEVNULL
        ).decode().strip()
        
        commits = []
        for line in raw_log.split("\n"):
            if not line:
                continue
            parts = line.split("|")
            if len(parts) >= 4:
                commits.append({
                    "hash": parts[0][:7],
                    "message": parts[1],
                    "date": parts[2],
                    "author": parts[3]
                })
        git_info = {"branch": branch, "commits": commits, "error": None}
    except Exception as e:
        git_info = {
            "branch": None,
            "commits": [],
            "error": f"Git metadata unavailable: {str(e)}"
        }

    data_stats = {
        "totalRecords": 0,
        "minDate": None,
        "maxDate": None,
        "cacheStatus": "cold",
        "fetchMode": "direct_pg"
    }
    
    try:
        repo = get_repo()
        data_stats["fetchMode"] = "direct_pg"
        
        count_res = fetch_dict('SELECT COUNT(*) as cnt FROM "LC"')
        if count_res:
            data_stats["totalRecords"] = count_res[0]["cnt"]
            data_stats["cacheStatus"] = "warm"
            
        date_res = fetch_dict('SELECT MIN("LC Op. Date") as min_d, MAX("LC Op. Date") as max_d FROM "LC"')
        if date_res:
            data_stats["minDate"] = str(date_res[0]["min_d"])
            data_stats["maxDate"] = str(date_res[0]["max_d"])
    except Exception as ex:
        data_stats["cacheStatus"] = "error"
        connection_error = f"Stats query failed: {str(ex)}"

    return {
        "connection": connection,
        "source": source,
        "connectionError": connection_error,
        "dataStats": data_stats,
        "gitInfo": git_info,
        "dataLogic": {
            "table": "public.LC",
            "dateColumn": '"LC Op. Date"',
            "minDateFilter": "None",
            "sqlQuery": 'SELECT * FROM "LC"',
            "currencyDivider": "10,000,000 (Divide to get Crores) or Absolute",
            "fiscalYearStart": "April (month index 3)",
            "weekDefinition": "Not applicable",
            "columnMapping": {
                '"PO NO"': "poNo (string)",
                '" LC no."': "lcNo (string)",
                '"LC Op. Date"': "lcIssueDate (date)",
                '"Bank Name"': "bank (string)",
                '"Margin"': "margin (number)",
                '"Supplier Name"': "supplier (string)",
                '"Currency"': "currency (string)",
                '"LC Amt \\n(in INR)"': "lcAmt (number)",
                '"Pending BOE Amt\\n(in INR)"': "pendingBoeAmt (number)",
                '"BOE Bill Amt\\n(in INR)"': "boeBillAmt (number)",
                '"Payment Status"': "paymentStatus (string)",
                '"BOE Status"': "boeStatus (string)",
                '"LC Status"': "lcStatus (string)"
            }
        }
    }

# ══════════════════════════════════════════════════════════
# Domain Isolation Endpoints
# ══════════════════════════════════════════════════════════

@router.get("/executive-overview")
async def get_executive_overview(currency: str = Query("INR"), fy: str = Query("All")):
    return datalogic.get_executive_overview_data(currency, fy)

@router.get("/command-data")
async def get_command_data(currency: str = Query("INR"), fy: str = Query("All"), payment_status: str = Query("Unpaid"), facility_type: str = Query("LC"), lc_status: str = Query("Open")):
    return datalogic.get_command_data(currency, fy, payment_status, facility_type, lc_status)

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

@router.get("/fy-list")
async def get_fy_list():
    return datalogic.get_fy_list()

@router.get("/audit-catalog")
async def get_audit_catalog():
    return datalogic.get_audit_catalog()

@router.get("/insights")
async def get_insights(page: str, currency: str = Query("INR"), fy: str = Query("All")):
    try:
        return datalogic.get_page_insights(page, currency, fy)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

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
async def get_limit_utilisation(currency: str = Query("INR"), fy: str = Query("All"), payment_status: str = Query("Unpaid"), facility_type: str = Query("LC"), lc_status: str = Query("Open")):
    return datalogic.get_limit_utilisation_data(currency, fy, payment_status, facility_type, lc_status)

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
    margin: Optional[float] = None,
    payment_status: Optional[str] = None,
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
        margin=margin,
        payment_status=payment_status
    )

from apps.Treasury.backend.database import fetch_dict

@router.post("/ai-copilot")
async def ai_copilot(query: str = Body(..., embed=True)):
    return datalogic.process_ai_query(query)

@router.get("/tables")
async def get_tables():
    try:
        res = fetch_dict("SHOW TABLES")
        return [r["name"] for r in res]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tables/{table_name}")
async def get_table_data(table_name: str):
    try:
        # Validate table name against SHOW TABLES to prevent SQL injection
        res_tables = fetch_dict("SHOW TABLES")
        valid_tables = [r["name"] for r in res_tables]
        if table_name not in valid_tables:
            raise HTTPException(status_code=400, detail="Invalid table name")
        
        # Double quote table name to handle spaces like "LC BG in Process"
        data = fetch_dict(f'SELECT * FROM "{table_name}"')
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
