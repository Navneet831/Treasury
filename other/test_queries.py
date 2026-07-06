import duckdb
import traceback

con = duckdb.connect(r'..\..\..\..\GrewAnalytics\warehouse.duckdb')

print("--- Testing DD Table ---")
try:
    res = con.execute('SELECT Element_8 as Bank, "Limit" as Bank_Limit, Interchangeability_Limit FROM DD WHERE Table_8 = \'Bank\' AND Element_8 != \'\' LIMIT 5').df()
    print(res)
except Exception as e:
    print("DD Table error:")
    traceback.print_exc()

print("\n--- Testing Transactions Query ---")
try:
    res = con.execute('SELECT * FROM LC ORDER BY "LC Op. Date" DESC LIMIT 1').df()
    print("Transactions query successful. Columns: ", len(res.columns))
except Exception as e:
    print("Transactions query error:")
    traceback.print_exc()

print("\n--- Testing BOE Aging ---")
try:
    res = con.execute('''
        SELECT 
            CASE 
                WHEN date_diff('day', "LC Op. Date", '2026-06-05'::DATE) <= 30 THEN '0-30 Days'
                ELSE 'Other'
            END as bucket,
            COUNT(*) as count
        FROM LC
        WHERE "BOE Status" != 'Received'
        GROUP BY 1
    ''').df()
    print(res)
except Exception as e:
    print("BOE Aging error:")
    traceback.print_exc()

con.close()
