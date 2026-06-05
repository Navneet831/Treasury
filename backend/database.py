import duckdb
import os
from dotenv import load_dotenv

load_dotenv()

# Relative to the root of the project
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
            return con.execute(query, params).df().to_dict(orient="records")
        else:
            return con.execute(query).df().to_dict(orient="records")

def fetch_one(query: str, params=None):
    with get_db_connection() as con:
        if params:
            return con.execute(query, params).fetchone()
        else:
            return con.execute(query).fetchone()
