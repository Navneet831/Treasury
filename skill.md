# Trade Finance Intelligence — Skill, Methodology & Design Audit

> **Purpose**: This file is the auditable single source of truth for every calculation, 
> design decision, and UX rule in the app. Any future modification must be reconciled 
> against this document. "Weaker" refactors that contradict these rules should be rejected.

---

## 0. Architecture Rules (Inviolable)

1. **No mock data**: Every number rendered in the UI must trace to a SQL query against `warehouse.duckdb`.
2. **No hardcoded values**: Bank names, status codes, thresholds, yield rates — all from DB tables (`APP_CONFIG`, `meta_risk_thresholds`, `LC`, `FDR_List`).
3. **Parameterized SQL only**: User-supplied filter values (bank, status, date) must be passed as `?` bind params. Never interpolated into query strings.
4. **Allowlisted enums**: LC Status values validated against `_ALLOWED_LC_STATUSES`, BOE Status against `_ALLOWED_BOE_STATUSES`.
5. **Domain sandboxing**: Each tab = `DomainSandbox` (ErrorBoundary + Suspense). Deleting one domain folder removes that feature without touching any other.
6. **API isolation**: Each domain fetches its own data. No shared global data fetches. Each component owns its loading, error, and data state.

---

## 1. Amount Columns — Critical Distinction

| Column | Meaning | When to Use |
|--------|---------|-------------|
| `LC Amt (in INR)` | Approved LC credit limit (INR) | Limit utilization, exposure calculation |
| `Final LC Amt (in FC)` | Approved LC credit limit (FC) | FC exposure |
| `BOE Bill Amt (in INR)` | Actual invoice/bill amount (INR) — what is actually owed | Payment due, cash flow forecast, calendar payments |
| `BOE Bill Amt (in FC)` | Actual invoice/bill amount (FC) | FC payment obligations |
| `Pending BOE Amt (in INR)` | BOE amount not yet paid | BOE aging, outstanding obligations |

**Rule**: Calendar payment events and cash flow forecasts MUST use `BOE Bill Amt`, not `LC Amt`. The LC Amt is the credit limit, not the actual payment obligation.

---

## 2. Executive KPIs

### Available LC Limit
- **Formula**: `MAX(0, Total NFB Limit − Total LC Exposure)`
- **Source**: `DD` table for limit, `LC` table for exposure
- **Filter**: `LC Status IN ('Open', 'In Process')`

### Total NFB Limit
- **Formula**: `SUM(Limit)` where `Table_8 = 'Bank'`
- **Source**: `DD` table

### Total Utilisation %
- **Formula**: `(Total LC Exposure / Total NFB Limit) × 100`
- **Warning threshold**: > 80%

### Working Capital Frozen (Margin FD)
- **Formula**: `SUM("Margin FD Made")` for open LCs
- **Source**: `LC` table, `"Margin FD Made"` column
- **Why this matters**: This capital cannot be deployed elsewhere. The opportunity cost is `frozen_amount × yield_rate (from APP_CONFIG)`.

### Yield Lost (Opportunity Cost)
- **Formula**: `SUM("Margin FD Made") × yield_rate`
- **yield_rate source**: `APP_CONFIG` table, key = `'yield_rate'`
- **Do not hardcode**: Fetched at runtime from DB

---

## 3. BOE Analytics

### BOE Aging
- **Metric**: Days since `"Date of Bill of Entry Submitted to Bank"` to today
- **Formula**: `date_diff('day', boe_date::DATE, CURRENT_DATE)`
- **Buckets**: 0–30, 31–60, 61–90, 90+ days
- **Amount used**: `Pending BOE Amt (in INR)` — what remains unpaid
- **Filter**: Unpaid rows only (`Payment Status != 'Paid'`)

### BOE Status Values (from DB)
- `'Received'` — BOE submitted to bank
- `'Not Received'` — BOE not yet received
- `'Cancelled'` — LC/transaction cancelled

### Semantic Color Coding for BOE
- Green = `BOE Received & Paid` (complete, no action needed)
- Amber = `BOE Received & Unpaid` (action: follow up payment)
- Red = `BOE Not Received` (action: chase supplier/shipper)

---

## 4. Cash Flow Forecast

### Methodology
1. **Forecast period**: Next 365 days, grouped by month
2. **Amount basis**: `BOE Bill Amt` (actual obligation), fallback to `LC Amt` if BOE not yet raised
3. **Filter**: Unpaid LCs with payment due date in future
4. **95% Confidence Interval**: 
   - σ = standard deviation of historical monthly paid amounts
   - Upper CI = forecast + 1.645σ
   - Lower CI = max(0, forecast − 1.645σ)
5. **Cumulative exposure**: Running sum across months

### Why BOE Bill Amt, not LC Amt
The LC Amt is the approved credit limit. The BOE Bill Amt is what the supplier actually invoiced. For cash planning, you need the invoice amount.

---

## 5. Payment Calendar Events

### Event Types, Colors, Sources (Single Source of Truth)

| Event Type | Color Hex | Backend Color Key | Source Column / Table |
|-----------|-----------|------------------|----------------------|
| Payment Due | `#dc2626` (Red) | `Red` | `"LC Payment Due Date"` + Payment Status ≠ Paid — ALL LCs |
| Paid | `#059669` (Emerald) | `Green` | `"LC Payment Due Date"` + Payment Status = Paid — ALL LCs |
| LC Opened | `#2563eb` (Blue) | `Blue` | `"LC Op. Date"` |
| LC Closed | `#d97706` (Amber) | `Orange` | `"LC Close date"` |
| LC Expiry | `#7f1d1d` (Dark Red) | `DarkRed` | `"LC EXPIRY DATE"` — open LCs only |
| BOE Received | `#7c3aed` (Purple) | `Purple` | `"Date of Bill of Entry Submitted to Bank"` |
| BOE To Pay | `#b91c1c` (Dark Red) | `BoeRed` | `"LC Payment Due Date"` + BOE Status = Received + Payment Status = Unpaid/NULL |
| BOE Paid | `#047857` (Dark Green) | `BoeGreen` | `"LC Payment Due Date"` + BOE Status = Received + Payment Status = Paid |
| FD Margin Released | `#0891b2` (Teal) | `Teal` | `FDR_List."Maturity Date"` — ACTIVE FDs |

**BOE vs Payment Due distinction**: `Payment Due` shows ALL unpaid LCs regardless of BOE status. `BOE To Pay` shows only LCs where BOE has been submitted (`BOE Status = 'Received'`) and payment is still pending — this is the actionable sub-set (goods received, bank has BOE, payment is overdue or upcoming).

**Rule**: The legend color in the frontend MUST use the same hex as the cell background. `EVENT_STYLE` in `CalendarView.tsx` is the single source of truth — both legend and cells reference it.

### FD Margin Released
- **Source**: `FDR_List` table, `STATUS = 'ACTIVE'`
- **Amount**: `"FD LIEN AMT for LC/BG"` — this is the margin being released
- **Date**: `"Maturity Date"` — when the FD matures and lien is lifted
- **Why**: CFO needs to know when frozen capital becomes available again

### Calendar Amount Rule
- **Payment Due / Paid events**: Show `BOE Bill Amt` (actual payment), not `LC Amt` (credit limit)
- **LC Opened / Closed**: Show `LC Amt (in INR)` (limit value)
- **FD Margin Released**: Show lien amount

---

## 6. Trend & Cohort Analysis

### Monthly Trend
- **Opening value**: `SUM("LC Amt (in INR)")` grouped by `date_trunc('month', "LC Op. Date")`
- **Closing value**: `SUM("LC Amt (in INR)")` grouped by `date_trunc('month', "LC Close date")`
- **Net exposure**: Opening − Closing for that month

### Cohort Analysis
- **Cohort definition**: LCs grouped by their opening month
- **Closure rate**: `closed_count / total_lcs × 100`
- **Payment rate**: `paid_count / total_lcs × 100`
- **Avg age**: `date_diff('day', "LC Op. Date", CURRENT_DATE)` averaged per cohort

---

## 7. Limit Utilisation

### Days to Exhaustion
- **Formula**: `available_limit / (used_limit / 90_days) × 30`
- **Logic**: Assumes current quarter's usage rate as monthly burn rate
- **Uses**: Helps flag banks where limits will exhaust soon at current pace

### Waterfall Components
1. Total NFB Limit
2. − LC Exposure (current open LCs)
3. − BG Exposure (outstanding bank guarantees)
4. = Available Limit

---

## 8. Priority Logic (Treasury Actions)

| Priority | Type | Condition |
|---------|------|-----------|
| 1 | Limit Breach Risk | Bank utilization > 90% |
| 2 | Payment Due | Due within next 7 days, unpaid |
| 3 | FD Maturity | FDs maturing within 7 days |
| 4 | FX Exposure Risk | Unhedged % > 30% |

---

## 9. Neuroscience & Consumer Psychology Design Rules

### Information Hierarchy (F-pattern scanning)
1. **Top-left**: Most actionable/critical metrics (overdue amounts, utilization %)
2. **Top-right**: Controls (FY, currency) — scanned but not primary focus
3. **Center**: Data visualizations — pattern recognition
4. **Bottom**: Legend, footnotes, audit trail

### Color Semantics (Pre-attentive processing)
- **Red** (`#dc2626`): Danger, action required, overdue, expiry
- **Amber** (`#d97706`): Warning, caution, approaching threshold
- **Green** (`#059669`): Safe, complete, positive
- **Blue** (`#2563eb`): Informational, new, in progress
- **Purple** (`#7c3aed`): Document milestone, compliance
- **Teal** (`#0891b2`): Opportunity, capital released, liquidity event
- **Dark Red** (`#7f1d1d`): Critical expiry, irreversible deadline

### Cognitive Load Rules
- **No pure white**: Use `#f8fafc` (warm gray) for backgrounds — reduces eye strain
- **Max density**: Show ₹ values in Crores (X.XX Cr) — 8 chars vs 12 for raw numbers
- **Color-only signals**: In compact spaces (calendar cells), color alone carries meaning — no text labels
- **Hover reveals detail**: Primary view shows amounts only; tooltip/modal reveals breakdown
- **CFO must not scroll**: Critical monthly summary visible before fold — achieved via sticky toolbar in Calendar
- **Gestalt proximity**: Related metrics grouped with shared container/background
- **Von Restorff effect**: Danger items (red) immediately pop against neutral background

### Element Placement Rules
- **Command/Overview tabs**: First in sidebar — most frequently visited
- **AI Copilot**: Placed last in sidebar — used for specific queries, not primary workflow
- **Risk Alerts**: Red badge in sidebar draws attention without disrupting flow
- **Calendar**: All event types visible without scrolling; toolbar is sticky

---

## 10. Display Format Rules

- **All currency values**: Crores to 2 decimal places (₹12.34 Cr) — via `formatCurrencyCompact()`
- **Percentages**: 1 decimal place (84.7%)
- **Dates**: DD MMM YYYY format (15 Jun 2026)
- **FC amounts**: Show $ symbol with 2 decimal places in millions for large values
- **Never show**: Raw 8-digit INR numbers in KPI chips — always compact format
- **Negative values**: Show in red with parentheses, e.g., (₹1.20 Cr)

---

## 11. SQL Security Rules

- All user-supplied filter values use `?` bind parameters (DuckDB) or `%s` (PostgreSQL via `_pg_query()`)
- Bank names, status values, dates — never string-interpolated
- Allowed LC statuses: `{'Open', 'Closed', 'In Process', 'Cancelled', 'Expired'}`
- Allowed BOE statuses: `{'Received', 'Not Received', 'Cancelled'}`
- Drill-down endpoint validates date format (YYYY-MM-DD) before passing to query builder

---

## 12. App Naming Convention

- **App name**: "Trade Finance Intelligence" (not "Treasury Control Tower" — too informal)
- **Rationale**: Enterprise-grade, function-specific, matches Bloomberg/GTreasury naming conventions
- **References**: Header.tsx, main.py FastAPI title, webview window title

---

## 13. Data Freshness

- **Source**: `D:\GrewAnalytics\warehouse.duckdb` (DuckDB v1.5.2)
- **Read-only connection**: All queries use `read_only=True`
- **No caching**: Every API call hits the DB directly — data is always current
- **Live clock**: Header shows HH:MM:SS with green pulse to signal live data

---

## 14. Package Audit

### Frontend (npm)
- `agentation` — agent-based interaction framework (installed)
- `recharts` — charts (BarChart, PieChart, AreaChart, ComposedChart)
- `ag-grid-react` — transaction ledger grid
- `zustand` — global state (currency, fy)
- `axios` — HTTP client with base URL auto-switch (dev vs. prod)

### Backend (pip)
- `fastapi` + `uvicorn` — API server
- `duckdb` — primary DB engine
- `polars` — advanced analytics DataFrames
- `prometheus_fastapi_instrumentator` — metrics endpoint
