#!/usr/bin/env python3
import psycopg2, json
from datetime import datetime

DSN = "postgresql://navneet:Navn%4098765@80.225.203.238:5432/Grewdb"
conn = psycopg2.connect(DSN)
cur = conn.cursor()

acct = "00000041973511184"
tbl = acct

# Get ALL June transactions
cur.execute(f'''
    SELECT txn_date, description, debit, credit, balance
    FROM "{tbl}"
    WHERE txn_date >= '2026-06-01' AND txn_date <= '2026-06-30'
    ORDER BY txn_date
''')
rows = cur.fetchall()
print(f"June total rows: {len(rows)}")

# Replicate the interest classification logic
def is_interest_entry(desc):
    d = str(desc).upper()
    kws = ["INTEREST", " PART PERIOD INTER", "DEBIT INTEREST", "INT TRF", "TL INT", "INT REP"]
    return any(kw in d for kw in kws)

def is_interest_recovered(desc):
    d = str(desc).upper()
    kws = ["O.S. INTEREST REP", "INT TRF FRM", "TL INT FOR", "TL INT ", "INT REP", "INTEREST RECOVERY"]
    return any(kw in d for kw in kws)

def is_interest_charged(desc):
    d = str(desc).upper()
    kws = ["PART PERIOD INTER", "DEBIT INTEREST"]
    return any(kw in d for kw in kws)

def make_month_key(dt):
    return dt.strftime("%b_%y").lower()

# Check each row
print("\n=== All rows where is_interest_recovered=True in June ===")
recovered_total = 0
for r in rows:
    txn_date = r[0]
    desc = str(r[1])
    dr = float(r[2]) if r[2] else 0
    cr = float(r[3]) if r[3] else 0
    
    if is_interest_recovered(desc):
        # Calculate interest_month
        dt_obj = datetime(txn_date.year, txn_date.month, txn_date.day)
        day = dt_obj.day
        is_int = is_interest_entry(desc)
        if day == 1 and is_int:
            prev = dt_obj.replace(day=1)
            from datetime import timedelta
            prev -= timedelta(days=1)
            int_month = make_month_key(prev)
        else:
            int_month = make_month_key(dt_obj)
        
        amount = dr + cr
        recovered_total += amount
        print(f"  {txn_date}: dr={dr:>12.2f} cr={cr:>12.2f} amount={amount:>12.2f} int_month={int_month} desc={desc[:70]}")
        print(f"    is_interest={is_int}, is_charged={is_interest_charged(desc)}, day={day}")

print(f"\nTotal is_interest_recovered amount in June: {recovered_total:.2f}")

# Now filter to interest_month = jun_26
cur.execute(f'''
    SELECT txn_date, description, debit, credit
    FROM "{tbl}"
    WHERE txn_date >= '2026-06-01' AND txn_date <= '2026-06-30'
    ORDER BY txn_date
''')
rows2 = cur.fetchall()
recovered_june = 0
print(f"\n=== is_interest_recovered AND interest_month=jun_26 ===")
for r in rows2:
    txn_date = r[0]
    desc = str(r[1])
    dr = float(r[2]) if r[2] else 0
    cr = float(r[3]) if r[3] else 0
    
    if is_interest_recovered(desc):
        dt_obj = datetime(txn_date.year, txn_date.month, txn_date.day)
        day = dt_obj.day
        is_int = is_interest_entry(desc)
        if day == 1 and is_int:
            from datetime import timedelta
            prev = dt_obj.replace(day=1) - timedelta(days=1)
            int_month = make_month_key(prev)
        else:
            int_month = make_month_key(dt_obj)
        
        if int_month == "jun_26":
            amount = dr + cr
            recovered_june += amount
            print(f"  {txn_date}: dr={dr:>12.2f} cr={cr:>12.2f} amount={amount:>12.2f} desc={desc[:70]}")

print(f"\nTotal intRecovered(interest_month=jun_26): {recovered_june:.2f}")

# Also check: what about the DEBIT INTEREST?
print("\n=== DEBIT INTEREST classification ===")
for r in rows:
    desc = str(r[1])
    if "DEBIT INTEREST" in desc.upper():
        dr = float(r[2]) if r[2] else 0
        cr = float(r[3]) if r[3] else 0
        print(f"  {r[0]}: dr={dr} cr={cr}")
        print(f"    is_interest_recovered={is_interest_recovered(desc)}")
        print(f"    is_interest_charged={is_interest_charged(desc)}")
        print(f"    is_interest_entry={is_interest_entry(desc)}")

conn.close()
