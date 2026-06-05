import duckdb
import os

DB_PATH = r"..\..\..\..\GrewAnalytics\warehouse.duckdb"
con = duckdb.connect(DB_PATH, read_only=True)

print("--- Column Names ---")
cols = con.execute("PRAGMA table_info('LC')").fetchall()
for c in cols:
    print(f"'{c[1]}'")

print("\n--- Date Ranges ---")
dates = con.execute('SELECT MIN("LC Op. Date"), MAX("LC Op. Date"), MIN("LC Payment Due Date"), MAX("LC Payment Due Date") FROM LC').fetchone()
print(f"Op Date Range: {dates[0]} to {dates[1]}")
print(f"Due Date Range: {dates[2]} to {dates[3]}")

print("\n--- LC Status Count ---")
status = con.execute('SELECT "LC Status", count(*) FROM LC GROUP BY 1').fetchall()
for s in status:
    print(f"{s[0]}: {s[1]}")

print("\n--- BOE Status Count ---")
boe = con.execute('SELECT "BOE Status", count(*) FROM LC GROUP BY 1').fetchall()
for b in boe:
    print(f"{b[0]}: {b[1]}")

print("\n--- Payment Status Count ---")
pay = con.execute('SELECT "Payment Status", count(*) FROM LC GROUP BY 1').fetchall()
for p in pay:
    print(f"{p[0]}: {p[1]}")

con.close()
