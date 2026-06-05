import duckdb
import os
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

DB_PATH = os.getenv("DB_PATH", r"..\..\..\..\GrewAnalytics\warehouse.duckdb")

def get_db_connection():
    return duckdb.connect(DB_PATH, read_only=True)

def fetch_data(query: str, params=None):
    with get_db_connection() as con:
        if params:
            return con.execute(query, params).fetchall()
        else:
            return con.execute(query).fetchall()

def fetch_dict(query: str, params=None):
    with get_db_connection() as con:
        if params:
            df = con.execute(query, params).df()
        else:
            df = con.execute(query).df()
        
        records = df.to_dict(orient="records")
        cleaned = []
        for row in records:
            clean_row = {}
            for k, v in row.items():
                if pd.isna(v):
                    clean_row[k] = None
                else:
                    clean_row[k] = v
            cleaned.append(clean_row)
        return cleaned

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
