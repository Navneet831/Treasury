import duckdb
import os

db_path = os.getenv('DB_PATH', r'D:\GrewAnalytics\warehouse.duckdb')
print(f"Connecting to {db_path}...")
con = duckdb.connect(db_path)

# 1. Config Table for Constants
print("Creating APP_CONFIG table...")
con.execute("CREATE TABLE IF NOT EXISTS APP_CONFIG (key VARCHAR PRIMARY KEY, value DOUBLE, description VARCHAR)")
configs = [
    ('yield_rate', 0.07, 'Annual yield rate for FD margin'),
    ('fx_depreciation_mild', 0.05, 'Mild FX depreciation impact'),
    ('fx_depreciation_mod', 0.10, 'Moderate FX depreciation impact'),
    ('fx_depreciation_crisis', 0.15, 'Crisis FX depreciation impact'),
    ('inefficiency_boe_rate', 0.10, 'Cost of inefficiency for delayed BOE'),
    ('inefficiency_overdue_rate', 0.12, 'Cost of inefficiency for overdue payments'),
    ('fx_var_rate', 0.03, 'FX VaR rate')
]
for k, v, d in configs:
    # Use INSERT OR IGNORE to not overwrite existing values
    con.execute("INSERT OR IGNORE INTO APP_CONFIG VALUES (?, ?, ?)", [k, v, d])

# 2. Treasury Insights Table for Textual/Mixed data
print("Creating TREASURY_INSIGHTS table...")
con.execute("CREATE TABLE IF NOT EXISTS TREASURY_INSIGHTS (category VARCHAR, key VARCHAR, value VARCHAR, priority INT)")
insights = [
    ('value_creation', 'working_capital_released', '450', 1),
    ('value_creation', 'debt_reduced', '120', 2),
    ('value_creation', 'treasury_savings', '25.5', 3),
    ('value_creation', 'interest_savings', '14.2', 4),
    ('value_creation', 'fx_savings', '8.1', 5),
    ('value_creation', 'bank_charge_optimization', '3.2', 6),
    ('liquidity_index', 'rbi_liquidity_deficit', '₹1.2 Lakh Cr', 1),
    ('liquidity_index', 'banking_system_liquidity', 'Tight', 2),
    ('liquidity_index', 'money_market_rates', '6.75% - 7.10%', 3),
    ('liquidity_index', 'yield_curve_shape', 'Normal', 4),
    ('liquidity_index', 'treasury_implication', 'Borrow long-term to lock in current yields before potential tightening.', 5),
]
for cat, k, v, p in insights:
    # Check if exists before inserting to satisfy "dont change existing data"
    exists = con.execute("SELECT 1 FROM TREASURY_INSIGHTS WHERE category = ? AND key = ?", [cat, k]).fetchone()
    if not exists:
        con.execute("INSERT INTO TREASURY_INSIGHTS VALUES (?, ?, ?, ?)", [cat, k, v, p])

print("Database seeded successfully with non-hardcoded app data.")
con.close()
