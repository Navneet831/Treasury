import os
import sys
import duckdb
import pandas as pd
import polars as pl
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
import math

load_dotenv()

# Database Engine Selection
DB_TYPE = os.getenv("DB_TYPE", "duckdb") # Options: "duckdb", "postgres"

def get_duckdb_path():
    if getattr(sys, 'frozen', False):
        exe_dir = os.path.dirname(sys.executable)
        local_db = os.path.join(exe_dir, "warehouse.duckdb")
        if os.path.exists(local_db):
            return local_db
    else:
        # Development root
        base_dir = os.path.dirname(os.path.abspath(__file__))
        local_db = os.path.join(os.path.dirname(base_dir), "warehouse.duckdb")
        if os.path.exists(local_db):
            return local_db
    
    fallback = r"D:\GrewAnalytics\warehouse.duckdb"
    return fallback if os.path.exists(fallback) else "warehouse.duckdb"

def get_connection():
    if DB_TYPE == "postgres":
        return psycopg2.connect(
            dbname=os.getenv("DB_NAME", "treasury"),
            user=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASS", ""),
            host=os.getenv("DB_HOST", "localhost"),
            port=os.getenv("DB_PORT", "5432")
        )
    else:
        return duckdb.connect(get_duckdb_path(), read_only=True)

def fetch_dict(query: str, params=None):
    if DB_TYPE == "postgres":
        with get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query, params)
                records = cur.fetchall()
                # PostgreSQL RealDictCursor returns dict-like objects
                return [dict(r) for r in records]
    else:
        with get_connection() as con:
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
                        if hasattr(val, 'isoformat'):
                            row_dict[columns[i]] = val.isoformat()
                        else:
                            row_dict[columns[i]] = val
                result.append(row_dict)
            return result

def fetch_one(query: str, params=None):
    with get_connection() as conn:
        if DB_TYPE == "postgres":
            with conn.cursor() as cur:
                cur.execute(query, params)
                res = cur.fetchone()
                return res
        else:
            if params:
                res = conn.execute(query, params).fetchone()
            else:
                res = conn.execute(query).fetchone()
            if res:
                return tuple(None if pd.isna(x) else x for x in res)
            return res

def get_polars_df(query: str):
    """Utility to get data as a Polars DataFrame for advanced analytics."""
    if DB_TYPE == "postgres":
        uri = f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASS')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
        return pl.read_database_uri(query, uri)
    else:
        with get_connection() as con:
            return con.execute(query).pl()

# Export DB_PATH for logging
if DB_TYPE == "duckdb":
    DB_PATH = get_duckdb_path()
else:
    DB_PATH = f"Postgres @ {os.getenv('DB_HOST')}"
