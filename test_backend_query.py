import os
import sys

# Mimic the path setup in backend/run_standalone.py
current_dir = os.getcwd()
grew_analytics_root = os.path.dirname(os.path.dirname(current_dir))
if grew_analytics_root not in sys.path:
    sys.path.insert(0, grew_analytics_root)

try:
    from backend.database import get_duckdb_path, fetch_dict
    from backend.datalogic import get_executive_overview_data
    
    path = get_duckdb_path()
    print(f"Using DB path: {path}")
    
    data = get_executive_overview_data()
    print("Executive Overview Data KPIs:")
    print(data['kpis'])
    
    # Check tables
    import duckdb
    con = duckdb.connect(path, read_only=True)
    tables = con.execute("SHOW TABLES").fetchall()
    print(f"Tables: {tables}")
    
    if ('LC',) in tables:
        count = con.execute("SELECT COUNT(*) FROM LC").fetchone()[0]
        print(f"LC count: {count}")
    else:
        print("Table 'LC' not found!")

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
