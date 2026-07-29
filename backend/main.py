from fastapi import APIRouter, Query, Body, HTTPException
from typing import Optional, List, Dict
from datetime import datetime, date
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor, as_completed
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

# ── Financial Indices ────────────────────────────────────────────────────────
@router.get("/indices")
async def get_indices(
    category: Optional[str] = Query(None, description="Filter by category (EQUITY, BOND, COMMODITY, FX, GLOBAL, TREASURY)"),
):
    """Return all financial benchmark indices (NIFTY, SENSEX, GOLD, etc.)."""
    from apps.Treasury.backend.services.index_svc import get_all_indices
    return get_all_indices(category=category)


@router.get("/indices/categories")
async def get_index_categories():
    """Return distinct index categories for filtering."""
    from apps.Treasury.backend.services.index_svc import get_index_categories
    return {"categories": get_index_categories()}


@router.get("/indices/{symbol}")
async def get_index_symbol(symbol: str):
    """Return a single index by symbol (e.g. /indices/NIFTY)."""
    from apps.Treasury.backend.services.index_svc import get_index_by_symbol
    result = get_index_by_symbol(symbol.upper())
    if result is None:
        raise HTTPException(status_code=404, detail=f"Index '{symbol}' not found")
    return result

@router.get("/live")
async def live_check():
    """Liveness probe — process heartbeat."""
    from apps.Treasury.backend.services.health import liveness
    return liveness()


@router.get("/ready")
async def ready_check():
    """Readiness probe — DB reachable."""
    from apps.Treasury.backend.services.health import readiness
    result = readiness()
    if result["status"] != "ready":
        raise HTTPException(status_code=503, detail=result)
    return result


@router.get("/health")
async def health_check():
    """Full dependency health — DB, Redis, Sentry, uptime."""
    from apps.Treasury.backend.database import get_repo
    from apps.Treasury.backend.services.health import health
    repo = get_repo()
    h = health()
    h["repository"] = type(repo).__name__
    return h

@router.get("/db-config")
async def get_db_config():
    import subprocess
    from apps.Treasury.backend.database import get_db_config_info

    connection = None
    source = None
    connection_error = None

    try:
        info = get_db_config_info()
        if "error" in info:
            connection_error = info["error"]
        else:
            connection = {
                "host": info.get("host"),
                "port": info.get("port"),
                "user": info.get("user"),
                "database": info.get("database"),
                "ssl": "require" if "pooler.supabase.com" in (info.get("host") or "") else False,
                "masked_password": info.get("masked_password"),
            }
            source = info.get("source", "env")
    except Exception as e:
        connection_error = f"Failed to retrieve database configuration: {str(e)}"

    # On Vercel, git info is injected via environment variables.
    # Fall back to local subprocess for development.
    git_info = {"branch": None, "commits": [], "error": None}
    try:
        branch = (
            os.environ.get("VERCEL_GIT_COMMIT_REF")
            or subprocess.check_output(
                ["git", "rev-parse", "--abbrev-ref", "HEAD"],
                stderr=subprocess.DEVNULL
            ).decode().strip()
        )
        # Build a single commit from Vercel env vars, or fall back to git log
        vercel_sha = os.environ.get("VERCEL_GIT_COMMIT_SHA")
        vercel_msg = os.environ.get("VERCEL_GIT_COMMIT_MESSAGE")
        vercel_author = os.environ.get("VERCEL_GIT_COMMIT_AUTHOR_NAME")
        if vercel_sha:
            commits = [{
                "hash": vercel_sha[:7],
                "message": (vercel_msg or "").split("\n")[0],
                "date": "",
                "author": vercel_author or "",
            }]
        else:
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
        "fetchMode": "direct_pg",
        "tableCounts": {},
    }
    
    try:
        repo = get_repo()
        data_stats["fetchMode"] = "direct_pg"
        
        # Parallel table counts for all app tables
        all_tables = ['LC', 'bank_limit', 'SBLC', 'LC BG in Process', 'FDR_List', 'Bank_Guarantee', 'APP_CONFIG']
        
        def count_table(tbl):
            try:
                r = fetch_dict(f'SELECT COUNT(*) as cnt FROM "{tbl}"')
                return tbl, r[0]["cnt"] if r else 0
            except Exception:
                return tbl, None
        
        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = {pool.submit(count_table, t): t for t in all_tables}
            for f in as_completed(futures):
                tbl, cnt = f.result()
                data_stats["tableCounts"][tbl] = cnt
        
        # LC date range
        date_res = fetch_dict('SELECT MIN("LC Op. Date") as min_d, MAX("LC Op. Date") as max_d FROM "LC"')
        if date_res:
            data_stats["minDate"] = str(date_res[0]["min_d"])
            data_stats["maxDate"] = str(date_res[0]["max_d"])
            total = data_stats["tableCounts"].get("LC")
            if total is not None:
                data_stats["totalRecords"] = total
                data_stats["cacheStatus"] = "warm"
    except Exception as ex:
        data_stats["cacheStatus"] = "error"
        connection_error = f"Stats query failed: {str(ex)}"

    # Parallel schema for all app tables
    db_schema = []
    schema_tables = ['LC', 'bank_limit', 'SBLC', 'LC BG in Process', 'FDR_List', 'Bank_Guarantee', 'APP_CONFIG']
    
    def fetch_schema(tbl):
        try:
            cols = fetch_dict(
                "SELECT column_name, data_type FROM information_schema.columns "
                f"WHERE table_name = '{tbl}' AND table_schema = 'public' ORDER BY ordinal_position"
            )
            return tbl, [{"table": tbl, "column": c["column_name"], "type": c["data_type"]} for c in cols]
        except Exception:
            return tbl, []
    
    with ThreadPoolExecutor(max_workers=8) as pool:
        sfutures = {pool.submit(fetch_schema, t): t for t in schema_tables}
        for f in as_completed(sfutures):
            tbl, cols = f.result()
            db_schema.extend(cols)
    
    # Column mapping by table (app field names, currency placeholder)
    column_mapping_by_table = {
        "LC": {
            "PO NO": "poNo",
            "LC no.": "lcNo",
            "LC Op. Date": "lcIssueDate",
            "Bank Name": "bank",
            "Margin": "margin",
            "Supplier Name": "supplier",
            "Currency": "currency",
            "LC Amt (in CUR)": "lcAmt",
            "Pending BOE Amt (in CUR)": "pendingBoeAmt",
            "BOE Bill Amt (in CUR)": "boeBillAmt",
            "Payment Status": "paymentStatus",
            "BOE Status": "boeStatus",
            "LC Status": "lcStatus",
        }
    }

    return {
        "connection": connection,
        "source": source,
        "connectionError": connection_error,
        "dataStats": data_stats,
        "gitInfo": git_info,
        "dbSchema": db_schema,
        "columnMappingByTable": column_mapping_by_table,
        "dataLogic": {
            "table": "public.LC",
            "dateColumn": '"LC Op. Date"',
            "minDateFilter": "None",
            "currencyDivider": "10,000,000 (Divide to get Crores) or Absolute",
            "fiscalYearStart": "April (month index 3)",
            "weekDefinition": "Not applicable",
            "columnMapping": {},  # kept for backward compat, use columnMappingByTable
        }
    }

# ══════════════════════════════════════════════════════════
# Domain Isolation Endpoints
# ══════════════════════════════════════════════════════════

def _db_endpoint(fn):
    """Decorator: wrap a route handler so any DB exception becomes a clean 500."""
    import functools
    @functools.wraps(fn)
    async def wrapper(*args, **kwargs):
        try:
            return await fn(*args, **kwargs)
        except HTTPException:
            raise
        except Exception as e:
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=str(e))
    return wrapper

@router.get("/executive-overview")
@_db_endpoint
async def get_executive_overview(currency: str = Query("INR"), fy: str = Query("All")):
    return datalogic.get_executive_overview_data(currency, fy)

@router.get("/command-data")
@_db_endpoint
async def get_command_data(currency: str = Query("INR"), fy: str = Query("All"), payment_status: str = Query("Unpaid"), facility_type: str = Query("LC"), lc_status: str = Query("Open")):
    return datalogic.get_command_data(currency, fy, payment_status, facility_type, lc_status)

@router.get("/lc-exposure")
@_db_endpoint
async def get_lc_exposure(currency: str = Query("INR"), fy: str = Query("All")):
    return datalogic.get_lc_exposure_data(currency, fy)

@router.get("/sblc-module")
@_db_endpoint
async def get_sblc_module(currency: str = Query("INR"), fy: str = Query("All")):
    return datalogic.get_sblc_module_data(currency, fy)

@router.get("/boe-analytics")
@_db_endpoint
async def get_boe_analytics(currency: str = Query("INR"), fy: str = Query("All")):
    return datalogic.get_boe_analytics_data(currency, fy)

@router.get("/payables-risk")
@_db_endpoint
async def get_payables_risk(currency: str = Query("INR"), fy: str = Query("All")):
    return datalogic.get_payables_risk_data(currency, fy)

@router.get("/fx-risk")
@_db_endpoint
async def get_fx_risk(fy: str = Query("All")):
    return datalogic.get_fx_risk_data(fy)

@router.get("/calendar")
@_db_endpoint
async def get_calendar(month: int, year: int, bank: Optional[str] = None, instrument: Optional[str] = None, currency: str = Query("INR"), supplier: Optional[str] = None, status: Optional[str] = None, fy: str = Query("All"), payment_status: Optional[str] = None):
    events = datalogic.get_calendar_events(month, year, bank, instrument, currency, supplier, status, fy, payment_status)
    return events

@router.get("/banks")
@_db_endpoint
async def get_banks():
    return datalogic.get_banks_list()

@router.get("/fy-list")
@_db_endpoint
async def get_fy_list():
    return datalogic.get_fy_list()

@router.get("/audit-catalog")
@_db_endpoint
async def get_audit_catalog():
    return datalogic.get_audit_catalog()

@router.get("/insights")
@_db_endpoint
async def get_insights(page: str, currency: str = Query("INR"), fy: str = Query("All")):
    return datalogic.get_page_insights(page, currency, fy)

@router.get("/payment-statuses")
@_db_endpoint
async def get_payment_statuses():
    return datalogic.get_payment_statuses()

@router.get("/hedge-coverage")
@_db_endpoint
async def get_hedge_coverage(currency: str = Query("INR"), fy: str = Query("All")):
    return datalogic.get_hedge_coverage_data(currency, fy)

@router.get("/cash-flow-forecast")
@_db_endpoint
async def get_cash_flow_forecast(currency: str = Query("INR"), fy: str = Query("All")):
    return datalogic.get_cash_flow_forecast_data(currency, fy)

@router.get("/trend-analysis")
@_db_endpoint
async def get_trend_analysis(currency: str = Query("INR"), fy: str = Query("All")):
    return datalogic.get_trend_analysis_data(currency, fy)

@router.get("/cohort-analysis")
@_db_endpoint
async def get_cohort_analysis(currency: str = Query("INR"), fy: str = Query("All")):
    return datalogic.get_cohort_analysis_data(currency, fy)

@router.get("/daily-reco")
@_db_endpoint
async def get_daily_reco(date: str):
    datetime.strptime(date, "%Y-%m-%d")
    return datalogic.get_daily_reco(date)

@router.get("/fd-module")
@_db_endpoint
async def get_fd_module():
    return datalogic.get_fd_module_data()

@router.get("/bg-module")
@_db_endpoint
async def get_bg_module():
    return datalogic.get_bg_module_data()

@router.get("/limit-utilisation")
@_db_endpoint
async def get_limit_utilisation(currency: str = Query("INR"), fy: str = Query("All"), payment_status: str = Query("Unpaid"), facility_type: str = Query("LC"), lc_status: str = Query("Open")):
    return datalogic.get_limit_utilisation_data(currency, fy, payment_status, facility_type, lc_status)

@router.get("/treasury-actions")
@_db_endpoint
async def get_treasury_actions():
    return datalogic.get_treasury_actions()

@router.get("/trend-cohort")
@_db_endpoint
async def get_trend_cohort(currency: str = Query("INR")):
    return datalogic.get_trend_cohort_data(currency)

@router.get("/lifecycle-tracker")
@_db_endpoint
async def get_lifecycle_tracker(fy: str = Query("All")):
    return datalogic.get_lifecycle_tracker_data(fy)

@router.get("/strategic-intelligence")
@_db_endpoint
async def get_strategic_intelligence(currency: str = Query("INR"), fy: str = Query("All")):
    return datalogic.get_strategic_intelligence_data(currency, fy)

@router.get("/advanced-quant")
@_db_endpoint
async def get_advanced_quant(currency: str = Query("INR"), fy: str = Query("All")):
    return datalogic.get_advanced_quant_data(currency, fy)

@router.get("/shipment-tracking")
@_db_endpoint
async def get_shipment_tracking(fy: str = Query("All")):
    return datalogic.get_shipment_tracking_data(fy)

@router.get("/treasury-radar")
@_db_endpoint
async def get_treasury_radar(currency: str = Query("INR"), fy: str = Query("All")):
    return datalogic.get_treasury_radar_data(currency, fy)

# ══════════════════════════════════════════════════════════
# Cache Admin Endpoint
# ══════════════════════════════════════════════════════════

@router.post("/cache/clear")
async def clear_cache():
    """Clear all Redis + in-memory caches. Useful during data refresh cycles."""
    from apps.Treasury.backend.redis_cache import clear_all_caches
    try:
        clear_all_caches()
        return {"status": "ok", "message": "All caches cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cache clear failed: {e}")

@router.get("/cache/status")
async def cache_status():
    """Check if Redis is connected and cache statistics."""
    from apps.Treasury.backend.redis_cache import _redis_available
    from apps.Treasury.backend.services.core import ttl_cache
    return {
        "redis_connected": _redis_available,
        "cache_layer": "redis" if _redis_available else "in-memory (fallback)",
        "note": "Redis is optional — in-memory fallback is always active. Start Redis via: docker compose -f other/docker-compose.yml up -d redis"
    }

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
    fy: str = Query("All"),
    page: int = Query(0, ge=0),
    page_size: int = Query(0, ge=0),
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
        payment_status=payment_status,
        page=page,
        page_size=page_size,
    )

from apps.Treasury.backend.database import fetch_dict, get_repo

@router.post("/ai-copilot")
async def ai_copilot(query: str = Body(..., embed=True)):
    return datalogic.process_ai_query(query)


# ══════════════════════════════════════════════════════════
# Developer Chat (RAG-powered)
# ══════════════════════════════════════════════════════════

@router.get("/dev-chat/status")
async def dev_chat_status():
    """Return vector store health and collection counts."""
    from apps.Treasury.backend.vector_store import PgJsonbVectorStore
    store = PgJsonbVectorStore()
    store.initialize()
    counts = {col: store.count(col) for col in store.COLLECTIONS}
    return {
        "status": "ready",
        "collections": counts,
        "total": sum(counts.values()),
        "store_type": "PgJsonbVectorStore (JSONB+numpy)",
    }


@router.post("/dev-chat/query")
async def dev_chat_query(
    query: str = Body(..., embed=True),
    top_k: int = Body(5),
    include_code: bool = Body(True),
    include_docs: bool = Body(True),
    include_schema: bool = Body(True),
):
    """Answer a developer question using RAG over the indexed repository."""
    from apps.Treasury.backend.vector_store import PgJsonbVectorStore
    from apps.Treasury.backend.services.retrieval_service import retrieve_context, format_context
    store = PgJsonbVectorStore()
    store.initialize()
    results = retrieve_context(query, store=store, top_k_per_collection=top_k,
                               include_code=include_code, include_docs=include_docs,
                               include_schema=include_schema)
    context = format_context(results)
    # Build a simple RAG response — for now return context + metadata;
    # LLM integration (e.g., OpenAI / local model) can be added later.
    sources = list(set(
        r.metadata.get("source_file", r.source_table) for r in results
    ))
    return {
        "query": query,
        "response": context,
        "sources": sources,
        "chunks": len(results),
        "note": "Context from vector store. Integrate with an LLM for natural-language answers.",
    }


@router.post("/dev-chat/index")
async def dev_chat_index(force: bool = Body(False)):
    """Trigger a full or incremental re-index of the repository."""
    from apps.Treasury.backend.services.repo_indexer import index_repository
    summary = index_repository(force=force)
    return {
        "message": "Indexing complete",
        "summary": summary,
    }

@router.get("/interest-summary")
async def get_interest_summary(fy: Optional[str] = Query(None), month: Optional[str] = Query(None), recompute: Optional[bool] = Query(False)):
    try:
        return datalogic.get_interest_summary_data(fy=fy if fy else None, month=month if month else None, recompute=recompute)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/interest-daily-breakdown")
async def get_interest_daily_breakdown(acct: str = Query(...), month: str = Query(...)):
    try:
        return datalogic.get_daily_breakdown(acct=acct, month_key=month)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tables")
async def get_tables():
    try:
        res = fetch_dict("SHOW TABLES")
        return [r["name"] for r in res]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tables/{table_name}")
async def get_table_data(
    table_name: str,
    page: int = Query(0, ge=0),
    page_size: int = Query(0, ge=0),
):
    try:
        # Validate table name against SHOW TABLES to prevent SQL injection
        res_tables = fetch_dict("SHOW TABLES")
        valid_tables = [r["name"] for r in res_tables]
        if table_name not in valid_tables:
            raise HTTPException(status_code=400, detail="Invalid table name")
        
        # Double quote table name to handle spaces like "LC BG in Process"
        limit_clause = f" LIMIT {page_size} OFFSET {page * page_size}" if page_size > 0 else ""
        data = fetch_dict(f'SELECT * FROM "{table_name}"{limit_clause}')
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
