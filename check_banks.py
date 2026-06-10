import duckdb
con = duckdb.connect(r'D:\GrewAnalytics\warehouse.duckdb', read_only=True)
print("Banks in LC:")
print(con.execute('SELECT DISTINCT "Bank Name" FROM LC').fetchall())
print("\nBanks in DD (Element_8 where Table_8 is Bank):")
print(con.execute("SELECT DISTINCT Element_8 FROM DD WHERE Table_8 = 'Bank'").fetchall())
