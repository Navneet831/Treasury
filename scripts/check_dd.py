import duckdb
con = duckdb.connect(r'D:\GrewAnalytics\warehouse.duckdb', read_only=True)
res = con.execute('SELECT * FROM DD LIMIT 5').fetchall()
print(con.execute('DESCRIBE DD').fetchall())
print(res)
