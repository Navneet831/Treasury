import duckdb
con = duckdb.connect(r'D:\GrewAnalytics\warehouse.duckdb', read_only=True)
print('LC count:', con.execute('SELECT COUNT(*) FROM LC').fetchone()[0])
print('Dates:', con.execute('SELECT MIN("LC Op. Date"), MAX("LC Op. Date") FROM LC').fetchone())
