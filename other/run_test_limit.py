import duckdb

con = duckdb.connect(r'..\..\..\..\GrewAnalytics\warehouse.duckdb')
res = con.execute('SELECT "LC Op. Date", "Bank Name", "LC Limit Available" FROM LC WHERE "LC Limit Available" IS NOT NULL LIMIT 5').df()
print(res)
con.close()
