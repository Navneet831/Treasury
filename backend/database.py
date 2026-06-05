import duckdb
import os
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Default to warehouse.duckdb in the root LC directory (one level up from backend)
DEFAULT_DB_PATH = os.path.join(os.path.dirname(BASE_DIR), "warehouse.duckdb")
DB_PATH = os.getenv("DB_PATH", DEFAULT_DB_PATH)

def get_db_connection():
    return duckdb.connect(DB_PATH, read_only=True)

def fetch_data(query: str, params=None):
    with get_db_connection() as con:
        if params:
            return con.execute(query, params).fetchall()
        else:
            return con.execute(query).fetchall()

import math

def fetch_dict(query: str, params=None):
    with get_db_connection() as con:
        cursor = con.cursor()
        if params:
            cursor.execute(query, params)
        else:
            cursor.execute(query)
            
        columns = [desc[0] for desc in cursor.description]
        records = cursor.fetchall()
        
        result = []
        for row in records:
            row_dict = {}
            for i, val in enumerate(row):
                if val is None:
                    row_dict[columns[i]] = None
                elif isinstance(val, float) and math.isnan(val):
                    row_dict[columns[i]] = None
                else:
                    # Convert datetimes to isoformat strings for safe JSON serialization
                    if hasattr(val, 'isoformat'):
                        row_dict[columns[i]] = val.isoformat()
                    else:
                        row_dict[columns[i]] = val
            result.append(row_dict)
        return result

def fetch_one(query: str, params=None):
    with get_db_connection() as con:
        if params:
            res = con.execute(query, params).fetchone()
        else:
            res = con.execute(query).fetchone()
        # fetchone returns a tuple. Convert nan to None.
        if res:
            return tuple(None if pd.isna(x) else x for x in res)
        return res
