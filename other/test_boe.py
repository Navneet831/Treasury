import duckdb
import traceback

con = duckdb.connect(r'..\..\..\..\GrewAnalytics\warehouse.duckdb')

print("--- BOE Test ---")
try:
    res = con.execute('SELECT COUNT(*), SUM("Pending BOE Amt (in INR)") FROM LC WHERE "BOE Status" != \'Received\' AND "Pending BOE Amt (in INR)" > 0').df()
    print(res)
except Exception as e:
    traceback.print_exc()

print("\n--- DD Bank Limits ---")
try:
    res = con.execute('SELECT Element_8 as Bank, "Limit" as Bank_Limit, Interchangeability_Limit FROM DD WHERE Table_8 = \'Bank\' AND Element_8 != \'\'').df()
    print(res)
except Exception as e:
    traceback.print_exc()

con.close()
