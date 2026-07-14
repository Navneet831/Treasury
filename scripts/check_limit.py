import duckdb
con = duckdb.connect(r'D:\GrewAnalytics\warehouse.duckdb', read_only=True)
res = con.execute('SELECT * FROM bank_limit LIMIT 1').fetchall()
print(con.execute('DESCRIBE bank_limit').fetchall())
print(res)
