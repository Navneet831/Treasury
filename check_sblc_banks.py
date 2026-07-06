import duckdb
con = duckdb.connect(r'D:\GrewAnalytics\warehouse.duckdb', read_only=True)
res = con.execute('SELECT BANK, SUM("Final PAYMENT AMT INR") FROM SBLC GROUP BY 1').fetchall()
print(res)
