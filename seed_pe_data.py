import duckdb
import random
from datetime import datetime

con = duckdb.connect(r'..\..\..\..\GrewAnalytics\warehouse.duckdb')

print("--- Seeding PE/Macro Data ---")
try:
    # 1. Debt Maturity Wall
    con.execute("CREATE OR REPLACE TABLE DEBT_MATURITY (year INT, amount_cr DOUBLE, debt_type VARCHAR)")
    debt_data = [
        (2026, 120, 'Term Loan'),
        (2027, 350, 'NCD'),
        (2028, 420, 'Working Capital'),
        (2029, 200, 'Senior Debt'),
        (2030, 500, 'Mezzanine')
    ]
    con.executemany("INSERT INTO DEBT_MATURITY VALUES (?, ?, ?)", debt_data)

    # 2. Yield Curve
    con.execute("CREATE OR REPLACE TABLE YIELD_CURVE (tenor VARCHAR, rate DOUBLE)")
    yield_data = [
        ('1M', 6.5),
        ('3M', 6.6),
        ('6M', 6.8),
        ('1Y', 7.0),
        ('2Y', 7.1),
        ('5Y', 7.3),
        ('10Y', 7.5)
    ]
    con.executemany("INSERT INTO YIELD_CURVE VALUES (?, ?)", yield_data)

    # 3. Capital Stack
    con.execute("CREATE OR REPLACE TABLE CAPITAL_STACK (component VARCHAR, amount_cr DOUBLE)")
    stack_data = [
        ('Senior Debt', 1200),
        ('Working Capital Debt', 800),
        ('LC Exposure', 450),
        ('BG Exposure', 200),
        ('Mezzanine', 300),
        ('Equity', 2500)
    ]
    con.executemany("INSERT INTO CAPITAL_STACK VALUES (?, ?)", stack_data)

    print("PE Data Seeded Successfully!")
except Exception as e:
    print(e)
    
con.close()
