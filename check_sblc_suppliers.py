import duckdb
con = duckdb.connect(r'D:\GrewAnalytics\warehouse.duckdb', read_only=True)
res = con.execute('SELECT DISTINCT "Supplier Name" FROM SBLC').fetchall()
print(res)
