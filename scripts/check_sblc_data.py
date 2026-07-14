import duckdb
con = duckdb.connect(r'D:\GrewAnalytics\warehouse.duckdb', read_only=True)
res = con.execute('SELECT * FROM SBLC LIMIT 1').fetchall()
print(con.execute('DESCRIBE SBLC').fetchall())
print(res)
