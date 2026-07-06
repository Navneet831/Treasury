import duckdb
con = duckdb.connect(r'D:\GrewAnalytics\warehouse.duckdb', read_only=True)
print(con.execute('DESCRIBE LC').fetchall())
