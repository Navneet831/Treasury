import duckdb
con = duckdb.connect(r'D:\GrewAnalytics\warehouse.duckdb', read_only=True)
res = con.execute('SELECT "Product Name", "Type", "LC no.", "Bank Name", "LC Amt (in INR)" FROM LC WHERE "Product Name" LIKE \'%CASH%\' OR "Type" LIKE \'%CASH%\'').fetchall()
print(res)
