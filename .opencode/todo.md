# Mission Tasks

## M15: Fix Interest Tab ✅ completed
Root cause: DB normalized — per-account digit statement tables replaced by `bank_transaction`+`bank_account`; interest.py still scanned for digit tables → empty response. Fixed in backend/services/interest.py + backend/main.py.

### T15.1: Fix interest.py statement source | agent:Worker ✅
- [x] S15.1.1: discover_months_info() → MIN/MAX from bank_transaction
- [x] S15.1.2: account resolution via bank_account + bank_transaction (summary + daily breakdown)
- [x] S15.1.3: cache key v2 bump; remove unused existing_tables scan

### T15.2: Fix /tables/{name} drilldown fallback | agent:Worker ✅
- [x] S15.2.1: bank_account fallback in main.py /tables/{name}
- [x] S15.2.2: import fetch_one in main.py (was NameError → 500)

### T15.3: Verification | agent:Commander ✅
- [x] S15.3.1: /interest-summary 200 with 251 rows/28 months/3 FYs; FY filter 155 rows/12 months, 0 nulls
- [x] S15.3.2: /interest-daily-breakdown 200 (30 days); /tables/{acct} 200 (118 rows)
- [x] S15.3.3: No regressions (limit-utilisation, command-data, daily-reco, calendar, audit-catalog, db-config all 200); stderr clean


## M14: Fix Limit Utilization 500 â€” lowercase schema migration leftovers ðŸš§ in_progress
Root cause: DB tables migrated to lowercase (`lc_bg_in_process`, `sblc`, `lc`), but service SQL still references old uppercase quoted names â†’ `/limit-utilisation` 500 â†’ frontend shows "No data available. Verify the backend connection."

### T14.1: Fix backend/services/limits.py | agent:Worker | status: in_progress
- [x] S14.1.1: Replace `FROM "LC BG in Process"` + `"Bank Name"`/`"AMT IN INR"`/`"Amt in FC"`/`"status"`/`UPPER(Type)` with lowercase `lc_bg_in_process`/`bank_name`/`amt_in_inr`/`amt_in_fc`/`status`/`UPPER(type)` (2 queries, lines ~54-64 & ~99-106)
- [x] S14.1.2: Fix SBLC query (lines ~91-97): `FROM SBLC` â†’ `FROM sblc`, `"BANK"` â†’ `bank`, `"payment_status"` â†’ `payment_status`, `"Final PAYMENT AMT INR"` â†’ `final_payment_amt_inr`

### T14.2: Fix backend/services/lc.py | agent:Worker | status: in_progress
- [x] S14.2.1: Fix drill-down in-process query (lines ~209-236): `FROM "LC BG in Process"` â†’ `FROM lc_bg_in_process`, `"Bank Name"` â†’ `bank_name`, `"Party Name"` â†’ `party_name`, `"AMT IN INR"` â†’ `amt_in_inr`, `"Amt in FC"` â†’ `amt_in_fc`, `UPPER(Type)` â†’ `UPPER(type)`, `STATUS =` â†’ `status =`, `CAST(PO ...)` â†’ `CAST(po ...)` â€” keep SELECT aliases unchanged (result keys)

### T14.3: Fix backend/services/sblc.py | agent:Worker | status: in_progress
- [x] S14.3.1: `_table_exists("SBLC")` â†’ `_table_exists("sblc")`; `FROM SBLC` â†’ `FROM sblc` (3x)
- [x] S14.3.2: `"BANK"` â†’ `bank`, `"payment_status"` â†’ `payment_status`, `"BOE Bill Amt (in INR)"` â†’ `boe_bill_amt_inr`, `"SBLC LC Payment Due Date"` â†’ `sblc_lc_payment_due_date` (2 queries)

### T14.4: Fix backend/main.py db-config stats | agent:Worker | status: in_progress
- [x] S14.4.1: Table lists â†’ lowercase: `['lc', 'bank_limit', 'sblc', 'lc_bg_in_process', 'fdr_list', 'bank_guarantee']` (drop APP_CONFIG â€” system schema)
- [x] S14.4.2: LC date-range query â†’ `SELECT MIN(lc_op_date)::DATE, MAX(lc_op_date)::DATE FROM lc`

### T14.4b: Fix backend/services/audit.py | agent:Worker | status: in_progress
- [x] S14.4b.1: `_DATA_SOURCES` table names â†’ lowercase (`lc`, `sblc`, `lc_bg_in_process`, `fdr_list`, `bank_guarantee`)
- [x] S14.4b.2: Row-count query â†’ unquoted names + `system.app_config` qualified; live config query â†’ `FROM system.app_config`

### T14.4c: Fix backend/services/calendar_svc.py | agent:Worker | status: in_progress
- [x] S14.4c.1: FD events + daily-reco queries â†’ `fdr_list`/`maturity_date`/`fd_lien_amt_for_lc_bg`/`status`
- [x] S14.4c.2: Replace `HAVING amount > 0` (alias â€” PG doesn't resolve in HAVING) â†’ aggregate expr

### T14.5: Restart backend + endpoint verification | agent:Commander
- [x] S14.5.1: Restart backend on :8002 with updated code
- [x] S14.5.2: Verify /limit-utilisation, /sblc-module, /drill-down, /lc-exposure, /command-data all return 200
- [x] S14.5.3: Verify /daily-reco, /calendar, /audit-catalog return 200 with real payloads

### T14.6: Full verification | agent:Reviewer
- [x] S14.6.1: Test all key endpoints + confirm zero 500s + confirm no stale uppercase table refs remain in backend/services

## M1-M4: Previous Work âœ… (prior sessions)
- [x] Sentry setup complete
- [x] DB indexes applied (27 on 6 tables)
- [x] Backend running on :8002
- [x] Build verified

## M5: Index Table â€” Mock Data ðŸš« CANCELLED
- [x] Cancelled (no mock data per user req)

## M6: App Running âœ…
- [x] Frontend :8000 running
- [x] Backend :8002 running
- [x] Proxy chain verified

## M7: Source Button Investigation âœ…
- [x] Root cause identified: hover-mode activation

## M8-M10: Observability Stack âœ…
- [x] Health endpoints, RequestID, OpenTelemetry, LLM metrics
- [x] Loki, Promtail, Jaeger, Alertmanager (docker-compose)
- [x] All verified: /live, /ready, /health, /metrics

## M11: Mobile-Responsive Frontend âœ…
- [x] Worker completed (task_4bdc6921): 11 files modified
- [x] Collapsible sidebar, responsive grid stacking, touch-friendly Source Mode

## M12: Enterprise Knowledge Indexing (pgvector) âœ…
- [x] All sub-tasks verified and complete

## M13: Fix Command Center Module Error âœ…
### T13.1: Analyze root cause | agent: Commander âœ…
- [x] Identified: useEffect cascading render pattern + missing null guards + StricMode race condition

### T13.2: Fix data loading pattern | agent: Worker âœ…
- [x] Replaced useCallback+useEffect with AbortSignal pattern
- [x] Added AbortController cleanup for StrictMode double-mount
- [x] Added stable event listener via useRef

### T13.3: Fix defensive null handling | agent: Worker âœ…
- [x] Made toProperCase() null-safe with typeof guard
- [x] Cleaned up unused imports (29 removed)
- [x] Cleaned up unused variables (asOnDate, cashPct, utilColor, etc.)

### T13.4: Enhance ErrorBoundary | agent: Worker âœ…
- [x] Track error object in state
- [x] Display error.message in error UI

### T13.5: Final verification | agent: Reviewer âœ…
- [x] tsc -b: compiles clean (exit 0)
- [x] vite build: builds clean (exit 0)
- [x] Backend :8002 responds 200
- [x] Frontend :8000 serves correctly
- [x] ESLint errors reduced from 78 to 49 (only no-explicit-any remain)

