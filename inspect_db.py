import duckdb
con = duckdb.connect(r'D:\GrewAnalytics\warehouse.duckdb', read_only=True)
print("LC Status counts:")
print(con.execute('SELECT "LC Status", COUNT(*) FROM LC GROUP BY 1').fetchall())
print("\nBOE Status counts:")
print(con.execute('SELECT "BOE Status", COUNT(*) FROM LC GROUP BY 1').fetchall())
print("\nFinancial Years in data (using LC Op. Date):")
print(con.execute('SELECT DISTINCT strftime("%Y-%m", "LC Op. Date") FROM LC ORDER BY 1').fetchall())
