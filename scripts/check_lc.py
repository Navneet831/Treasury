import duckdb
con = duckdb.connect(r'D:\GrewAnalytics\warehouse.duckdb', read_only=True)
res = con.execute('SELECT DISTINCT "Product Name", "Type" FROM LC').fetchall()
print(res)
