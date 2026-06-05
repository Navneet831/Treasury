import polars as pl
import duckdb
import os

xlsb_path = 'LC.xlsb'
db_path = r'..\..\..\..\GrewAnalytics\warehouse.duckdb'
sheet_name = 'LC'
table_name = 'LC'

print(f"Reading {xlsb_path}...")
try:
    df = pl.read_excel(xlsb_path, sheet_name=sheet_name)
    
    # Standardize column names
    new_cols = []
    for col in df.columns:
        clean_col = col.replace('\n', ' ').replace('  ', ' ').strip()
        new_cols.append(clean_col)
    
    df.columns = new_cols
    print(f"Standardized {len(df.columns)} columns.")

    con = duckdb.connect(db_path)
    con.execute(f"CREATE OR REPLACE TABLE {table_name} AS SELECT * FROM df")
    print(f"Successfully re-loaded {len(df)} rows with clean headers.")
    
    # Print the new clean names for verification
    print("\nNew Column Names:")
    for c in df.columns:
        print(f"'{c}'")
        
    con.close()
except Exception as e:
    print(f"Error: {e}")
