import duckdb
import pandas as pl
from datetime import datetime, timedelta
import random

con = duckdb.connect(r'..\..\..\..\GrewAnalytics\warehouse.duckdb')

print("--- Seeding Market Data (FX Rates) into DuckDB ---")
try:
    # Create a simple table for USD/INR FX rates for VaR calculations
    con.execute("CREATE OR REPLACE TABLE FX_RATES (date DATE, currency VARCHAR, rate DOUBLE, volatility DOUBLE)")
    
    # Seed past year and future year
    base_date = datetime.strptime("2025-01-01", "%Y-%m-%d")
    rates = []
    current_rate = 83.50
    for i in range(1000):
        dt = base_date + timedelta(days=i)
        # Random walk for fx
        change = random.uniform(-0.005, 0.005) # max 0.5% daily move
        current_rate = current_rate * (1 + change)
        vol = random.uniform(0.02, 0.05) # 2-5% annualized volatility for this period
        rates.append((dt.strftime("%Y-%m-%d"), 'USD', round(current_rate, 4), round(vol, 4)))
    
    con.executemany("INSERT INTO FX_RATES VALUES (?, ?, ?, ?)", rates)
    print("FX_RATES table created and seeded successfully.")
    
except Exception as e:
    print(f"Error seeding data: {e}")

con.close()
