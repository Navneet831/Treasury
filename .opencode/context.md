# Treasury Project Context

## Mission
DB schema changed: all tables/columns lowercase in `treasury` schema. Update code, run app, fix bugs.

## M16: PUSH CODE TO GITHUB (2026-08-11, in progress)
### Goal: push necessary code to https://github.com/Navneet831/Treasury (origin already set, branch main, last commit 7e21f9e)

### GIT STATE
- Remote: origin https://github.com/Navneet831/Treasury (fetch+push) OK
- Branch: main; recent commits: 7e21f9e, 471731d, c52962c, 52dfff7, d4b4ee6 (all pre-existing)
- Working tree: 32 changed files (22 modified + 10 untracked)
- .gitignore EXISTS: ignores sheets/, Scripts/*.{md,bat,py}, docker-compose/prometheus/alertmanager (in Scripts/), __pycache__, *.pyc, .venv/venv/env, build/dist, *.spec, .env, node_modules, frontend/dist, .npm, *.duckdb*, *.log, .DS_Store/Thumbs.db/desktop.ini, .sentryclirc

### MODIFIED (tracked, likely PUSH): backend/database.py, main.py, postgres_compat.py, services/{audit,boe,calendar_svc,copilot,core,executive,fd_bg,fx,intelligence,interest,lc,limits,payables,repo_indexer,sblc}.py, tests/test_interest.py, bank_roi_app.py, backend/_investigate.py
### UNTRACKED (likely temp/debug — DO NOT push): backend/{check_schema,fix_dates,fix_dpp,fix_margin,fix_schema,test_endpoints,test_errors}.py
### .opencode/*.md modified (context/status/todo/work-log) — orchestrator metadata; user said "push necessary, rest in gitignore" — decide: .opencode/ may be kept or ignored (ask-free decision: keep tracked since already tracked, or add to gitignore; prefer minimal push = keep existing tracked files as-is, do NOT add new untracked temp scripts)

### NEXT STEPS
1. git status --short full (done: 32 files) — classify: push tracked source changes; ignore untracked temp scripts
2. Review git diff for the source files quickly (ensure only intended changes, no secrets)
3. Optionally add untracked temp scripts to .gitignore (backend/fix_*.py, check_schema.py, test_endpoints.py, test_errors.py, _investigate.py?) — but _investigate.py is already tracked (M)
4. git add -A (respects .gitignore); commit with concise message (repo style: "fix: ...", "ui: ...", "feat: ...")
5. git push origin main
6. Verify push succeeded (git log origin/main or git status ahead/behind)
### ROOT CAUSE
DB normalized: per-account digit statement tables REMOVED → statements now in `bank_transaction` (account_id FK → `bank_account`), txn_date is DATE type. Old interest.py scanned pg_tables for digit tables → found none → empty response (rows=0).

### FIXES (interest.py + main.py) — all compile OK
1. discover_months_info() → `SELECT MIN(txn_date), MAX(txn_date) FROM bank_transaction`
2. get_interest_summary_data() → account resolution via `bank_account.account_number` (lstrip("0")) + `bank_transaction WHERE account_id=%s`
3. Removed unused existing_tables scan
4. get_daily_breakdown() → same bank_account resolution, month filter with ISO date params
5. Cache key → `v2|{fy}|{month}` (invalidates stale empty DB cache)
6. main.py `/tables/{name}` → fallback to bank_transaction by account_number
7. **main.py import fix**: added `fetch_one` to `from apps.Treasury.backend.database import fetch_dict, fetch_one, get_repo` (was NameError → 500 on /tables fallback)
- Backend running job_0e9621f1 (v6) on :8002, logs backend_stderr3.log/stdout3.log

### VERIFICATION (ALL PASS, 0 failures)
- /interest-summary: 251 rows, 28 months, fyList FY24-25/FY25-26/FY26-27; CC sample roi=9.75 rec=8.72M calc=8.51M
- /interest-summary?fy=FY25-26: 155 rows, 12 months, types TL1=12 TL2=12 TL3=9 WCDL=122, 0 null int values, all tableFound
- /interest-daily-breakdown?acct=00000041973511184&month=jun_26: 30 days, total interest 12,577,365.47
- /tables/41955053304 + /tables/43478784435 + /tables/42816378632: 200 with real txn rows
- No regressions: /limit-utilisation, /command-data, /daily-reco, /calendar, /audit-catalog, /db-config, /health, /live all 200
- stderr3 log CLEAN (no tracebacks)
- Frontend: NO changes needed (uses tableName/account from rows + /tables fallback)

### PENDING (final)
1. Update work-log.md (M15 rows: interest.py MODIFY + main.py MODIFY) + todo.md (M15 section all [x]) + status.md (pass) → then conclude
2. Optional cleanup: temp scripts in C:\Users\NAVNEE~1.CHA\AppData\Local\Temp\opencode\ (diag_*.py, test_*.py, check_*.py)

## M14 FIXED (2026-08-11): Limit Utilization 500 (completed earlier)
- Root cause: stale uppercase table/column refs after lowercase migration
- Fixed (9 files): limits.py, lc.py, sblc.py, executive.py, fd_bg.py, main.py, postgres_compat.py, audit.py, calendar_svc.py
- calendar_svc.py: FDR_List→fdr_list, "Maturity Date"→maturity_date, "FD LIEN AMT for LC/BG"→fd_lien_amt_for_lc_bg, "STATUS"→status; HAVING alias → aggregate expr (PG doesn't resolve output aliases in HAVING)
- audit.py: _DATA_SOURCES lowercase + row counts unquoted + system.app_config (2 places)
- Backend restarted FINAL (v4, task job_cb748c98), logs backend_stderr3.log/backend_stdout3.log

## Current State — VERIFIED CLEAN
- ALL 34 endpoints → 200 (incl. /limit-utilisation, /command-data, /daily-reco, /calendar, /audit-catalog)
- /daily-reco 2026-06-15: lc_opened=1 closed=11 due=2 done=7
- /calendar Aug 2026: 9 events incl. FD margin Released 2026-08-13 ₹15,00,000
- /audit-catalog: row_counts lc=224 sblc=84 lc_bg_in_process=6 fdr_list=208 bank_guarantee=70 bank_limit=3 app_config=7
- stderr: ZERO tracebacks (only benign "Redis unavailable - falling back to in-memory cache")
- Stale-ref sweep of backend/services/*.py: only benign hits (audit.py:99 description string, health.py status strings, lc.py:226-228 SELECT aliases = intentional display names). NO stale SQL refs remain.
- Backend running on :8002, task job_cb748c98 (v4 final). Logs: backend_stderr3.log/backend_stdout3.log.

## PENDING (final steps)
1. Reviewer task_fe500be3 (ses_00f144a67ffehTcvqIl1NGzFJq) STILL RUNNING (spawned 18:33, ~7min, likely hung like prior agents). Verify: 34-endpoint sweep, payload sanity, stderr check, then mark M14 [x] in todo.md + update status.md.
   - Plan if hung: cancel task_fe500be3 → spawn fresh Reviewer with leaner prompt (or verify via direct evidence: I already have full verification results above + update todo.md/status.md marks per role matrix — todo.md M14 tasks S14.1.1→S14.5.3 must be [x]).
2. todo.md M14 now has: T14.1 (limits.py S14.1.1-2), T14.2 (lc.py S14.2.1), T14.3 (sblc.py S14.3.1-2), T14.4 (main.py S14.4.1-2), T14.4b (audit.py S14.4b.1-2), T14.4c (calendar_svc.py S14.4c.1-2), T14.5 (restart+verify S14.5.1-3), T14.6 (Reviewer full verify S14.6.1) — ALL still [ ] pending Reviewer marks.
3. On pass: status.md → Execution Status: pass, Current Phase: M14 Complete; confirm zero sync issues; conclude mission with summary.
4. Optional cleanup: temp scripts in C:\Users\NAVNEE~1.CHA\AppData\Local\Temp\opencode\ (check_cols.py, verify_*.py, check_data*.py, check_fdr_cols.py, test_rewrite.py, test_having.py).

## DB Changes
- Tables lowercase: lc, sblc, bank_limit, bank_summary, fdr_list, bank_guarantee, etc.
- Columns lowercase: lc_status, bank_name, lc_amt_inr, margin, type, etc.
- system.app_config (qualified name needed)
- DD table dropped

## COMPLETED
1. Schema refs public→treasury (8+ files)
2. search_path=treasury,public in database.py (init+reconnect+get_dataframe)
3. COL_MAP: all column refs updated to snake_case in core.py
4. postgres_compat.py: _TREASURY_TABLES lowercase, _MIXED_CASE_COLS cleared, _DATE_COL_NAMES re-enabled
5. FROM LC→lc in ALL service files (executive, lc, limits, payables, boe, fx, intelligence, copilot, calendar_svc, sblc)
6. bank_limit cols: LC→lc, SBLC→sblc, Cash→cash, Bank_Table→bank_table, Element→element
7. DOUBLE PRECISION PRECISION bug fixed
8. system.app_config qualified name
9. Margin→margin, MRGIN→margin globally
10. Date column casting via postgres_compat

## CURRENT STATUS
Server just restarted (PID TBD) on port 8002. Last run background task: `job_07553584`.

### Endpoints that were PASSING before restart:
/executive-overview, /sblc-module, /boe-analytics, /fd-module, /interest-summary, /fx-risk, /live, /ready, /health, /market-rates, /usd-inr

### Endpoints that were FAILING (500) before restart:
/command-data, /lc-exposure — had bank_limit."LC" bug, SHOULD be fixed now

## PENDING (next session — DO THIS FIRST)
1. Check server started OK: `check_background({taskId:"job_07553584"})`
2. Test ALL endpoints via HTTP. Fix any 500s by checking stderr tracebacks.
3. Key endpoints to test: command-data, lc-exposure, bg-module, limit-utilisation, payables-risk, calendar, insights, tables, db-config, all intelligence endpoints
4. Common remaining issues: uppercase column refs, missing ::DATE casts, table name mismatches
5. Clean up temp files: fix_schema.py, fix_dpp.py, fix_dates.py, fix_margin.py, check_schema.py, test_endpoints.py

## Modified Files
backend/database.py, main.py, postgres_compat.py, services/core.py, executive.py, lc.py, limits.py, payables.py, boe.py, fx.py, intelligence.py, copilot.py, calendar_svc.py, sblc.py, interest.py, repo_indexer.py, audit.py, bank_roi_app.py, _investigate.py, tests/test_interest.py

## Tech Stack
Python 3.12, FastAPI, psycopg2, PostgreSQL (treasury schema), port 8002
Start: `python backend/run_standalone.py`
