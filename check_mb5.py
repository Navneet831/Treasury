import duckdb
con = duckdb.connect(r'D:\GrewAnalytics\warehouse.duckdb', read_only=True)
print(con.execute('SHOW TABLES').fetchall())
res = con.execute('SELECT * FROM mb5bd LIMIT 1').fetchall()
print(res)
