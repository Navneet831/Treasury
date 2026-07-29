-- Migration 002: Create the "Index" table for financial benchmark indices
-- Applied directly to PostgreSQL (not through Supabase).
-- Run: psql -h 80.225.203.238 -U navneet -d Grewdb -f 002_create_index_table.sql

BEGIN;

-- ── 1. Sequence for auto-increment ──────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS index_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- ── 2. The Index table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Index" (
    id              INTEGER PRIMARY KEY DEFAULT nextval('index_id_seq'),
    symbol          VARCHAR(20) NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    category        VARCHAR(50),
    currency        VARCHAR(10) DEFAULT 'INR',
    last_value      DOUBLE PRECISION,
    previous_close  DOUBLE PRECISION,
    day_change      DOUBLE PRECISION,
    day_change_pct  DOUBLE PRECISION,
    high_52w        DOUBLE PRECISION,
    low_52w         DOUBLE PRECISION,
    last_updated    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source          VARCHAR(50) DEFAULT 'MANUAL',
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 3. Database indexes for fast lookups ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_index_symbol
    ON "Index" (symbol);

CREATE INDEX IF NOT EXISTS idx_index_category_active
    ON "Index" (category, is_active);

-- ── 4. Seed data ────────────────────────────────────────────────────────────
INSERT INTO "Index" (symbol, name, category, currency) VALUES
    -- Indian equity
    ('NIFTY',     'NIFTY 50',                 'EQUITY', 'INR'),
    ('SENSEX',    'BSE SENSEX',               'EQUITY', 'INR'),
    ('BANKNIFTY', 'NIFTY Bank',               'EQUITY', 'INR'),
    ('FINNIFTY',  'NIFTY Financial Services',  'EQUITY', 'INR'),
    ('MIDCAP',    'NIFTY Midcap 100',          'EQUITY', 'INR'),
    ('SMALLCAP',  'NIFTY Smallcap 100',        'EQUITY', 'INR'),
    ('AUTO',      'NIFTY Auto',               'EQUITY', 'INR'),
    ('IT',        'NIFTY IT',                 'EQUITY', 'INR'),
    ('PHARMA',    'NIFTY Pharma',             'EQUITY', 'INR'),
    ('FMCG',      'NIFTY FMCG',               'EQUITY', 'INR'),
    -- Global
    ('DJI',       'Dow Jones Industrial Average',  'GLOBAL', 'USD'),
    ('SPX',       'S&P 500',                       'GLOBAL', 'USD'),
    ('IXIC',      'NASDAQ Composite',              'GLOBAL', 'USD'),
    ('FTSE',      'FTSE 100',                      'GLOBAL', 'GBP'),
    ('DAX',       'DAX 40',                        'GLOBAL', 'EUR'),
    -- Commodities
    ('GOLD',      'Gold Spot',                'COMMODITY', 'USD'),
    ('SILVER',    'Silver Spot',              'COMMODITY', 'USD'),
    ('CRUDEOIL',  'Crude Oil WTI',            'COMMODITY', 'USD'),
    ('NATGAS',    'Natural Gas',              'COMMODITY', 'USD'),
    -- Bonds
    ('IND10Y',    'India 10-Year Bond Yield', 'BOND', 'INR'),
    ('US10Y',     'US 10-Year Treasury Yield','BOND', 'USD'),
    ('IND1Y',     'India 1-Year T-Bill',      'BOND', 'INR'),
    -- FX
    ('USDINR',    'USD/INR Spot',             'FX', 'INR'),
    ('EURINR',    'EUR/INR Spot',             'FX', 'INR'),
    ('GBPINR',    'GBP/INR Spot',             'FX', 'INR'),
    -- Treasury
    ('TREASURY_MM', 'Treasury Money Market',  'TREASURY', 'INR'),
    ('TREASURY_LI', 'Treasury Liquidity Index','TREASURY', 'INR')
ON CONFLICT (symbol) DO NOTHING;

COMMIT;
