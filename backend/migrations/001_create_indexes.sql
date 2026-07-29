-- Treasury Performance: Database Index Migration
-- Run this against your PostgreSQL warehouse (Supabase SQL Editor or psql)
-- Improves query performance for all LC, SBLC, and related table queries
-- Run: psql $DATABASE_URL -f backend/migrations/001_create_indexes.sql

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- "LC" Table — Primary Warehouse Table (heavy read workload)
-- Note: All identifiers are double-quoted because columns contain spaces
-- and the table name must be exact-case (LC != lc which is a view).
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Date + Status composite indexes (used by every domain view for fiscal year filtering)
CREATE INDEX IF NOT EXISTS idx_lc_op_date_status ON "LC" ("LC Op. Date", "LC Status");
CREATE INDEX IF NOT EXISTS idx_lc_due_date_status ON "LC" ("LC Payment Due Date", "LC Status");

-- 2. Status + Payment/BOE status (used in WHERE filters across all views)
CREATE INDEX IF NOT EXISTS idx_lc_status ON "LC" ("LC Status");
CREATE INDEX IF NOT EXISTS idx_lc_payment_status ON "LC" ("Payment Status");
CREATE INDEX IF NOT EXISTS idx_lc_boe_status ON "LC" ("BOE Status");
CREATE INDEX IF NOT EXISTS idx_lc_status_payment ON "LC" ("LC Status", "Payment Status");

-- 3. Bank + Date (used in utilization, group-by, and margin pivot queries)
CREATE INDEX IF NOT EXISTS idx_lc_bank_name ON "LC" ("Bank Name");
CREATE INDEX IF NOT EXISTS idx_lc_bank_op_date ON "LC" ("Bank Name", "LC Op. Date");

-- 4. Currency + Status (used in FX exposure and hedge coverage queries)
CREATE INDEX IF NOT EXISTS idx_lc_currency ON "LC" ("Currency");
CREATE INDEX IF NOT EXISTS idx_lc_currency_status ON "LC" ("Currency", "LC Status");

-- 5. Supplier + Amount (used in cohort and trend analysis)
CREATE INDEX IF NOT EXISTS idx_lc_supplier ON "LC" ("Supplier Name");
CREATE INDEX IF NOT EXISTS idx_lc_supplier_status ON "LC" ("Supplier Name", "LC Status");

-- 6. SBLC Status + LC Status (used in SBLC-specific queries)
CREATE INDEX IF NOT EXISTS idx_lc_sblc_status ON "LC" ("SBLC Status");
CREATE INDEX IF NOT EXISTS idx_lc_sblc_lc_status ON "LC" ("SBLC Status", "LC Status");

-- 7. Margin (used in pivot queries)
CREATE INDEX IF NOT EXISTS idx_lc_margin ON "LC" ("Margin");

-- 8. Type + Product (used in cash-flow and product-level queries)
CREATE INDEX IF NOT EXISTS idx_lc_type ON "LC" ("Type");
CREATE INDEX IF NOT EXISTS idx_lc_product ON "LC" ("Product Name");

-- 9. Close Date (used in lifecycle/trend queries)
CREATE INDEX IF NOT EXISTS idx_lc_close_date ON "LC" ("LC Close date");

-- 10. Shipment Date + Material Date (used in operations/tracking queries)
CREATE INDEX IF NOT EXISTS idx_lc_shipment ON "LC" ("LC SHIPMENT DATE");
CREATE INDEX IF NOT EXISTS idx_lc_material ON "LC" ("Material Receipt Date");

-- 11. LC Number + Op Date (used in drill-down ORDER BY)
CREATE INDEX IF NOT EXISTS idx_lc_no_op_date ON "LC" ("LC no.", "LC Op. Date");

-- 12. Margin + LC Status + Bank (used in margin pivot queries, the heaviest query)
CREATE INDEX IF NOT EXISTS idx_lc_margin_status_bank ON "LC" ("Margin", "LC Status", "Bank Name");

-- ═══════════════════════════════════════════════════════════════════════════════
-- SBLC Table
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_sblc_bank ON "SBLC" ("BANK");
CREATE INDEX IF NOT EXISTS idx_sblc_payment_status ON "SBLC" ("Payment Status");
CREATE INDEX IF NOT EXISTS idx_sblc_due_date ON "SBLC" ("SBLC LC Payment Due Date");
CREATE INDEX IF NOT EXISTS idx_sblc_bank_payment ON "SBLC" ("BANK", "Payment Status");

-- ═══════════════════════════════════════════════════════════════════════════════
-- LC BG in Process Table
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_lc_inprocess_status ON "LC BG in Process" ("STATUS");
CREATE INDEX IF NOT EXISTS idx_lc_inprocess_type ON "LC BG in Process" ("Type");
CREATE INDEX IF NOT EXISTS idx_lc_inprocess_bank ON "LC BG in Process" ("Bank Name");
CREATE INDEX IF NOT EXISTS idx_lc_inprocess_status_type ON "LC BG in Process" ("STATUS", "Type");

-- ═══════════════════════════════════════════════════════════════════════════════
-- bank_limit Table
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_bank_limit_element ON bank_limit ("Element");
CREATE INDEX IF NOT EXISTS idx_bank_limit_bank_table ON bank_limit ("Bank_Table");

-- ═══════════════════════════════════════════════════════════════════════════════
-- FDR_List Table
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_fdr_maturity ON "FDR_List" ("Maturity Date");
CREATE INDEX IF NOT EXISTS idx_fdr_status ON "FDR_List" ("STATUS");

-- ═══════════════════════════════════════════════════════════════════════════════
-- Bank_Guarantee Table
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_bg_status ON "Bank_Guarantee" (status);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Maintenance
-- ═══════════════════════════════════════════════════════════════════════════════

-- Ensure statistics are up to date for query planner
ANALYZE "LC";
ANALYZE "SBLC";
ANALYZE "LC BG in Process";
ANALYZE bank_limit;
ANALYZE "FDR_List";
ANALYZE "Bank_Guarantee";
ANALYZE "APP_CONFIG";

COMMIT;
