import logging
import os
import sys
import duckdb
import pandas as pd
import polars as pl
from typing import Any, Dict, List, Optional
from packages.contracts import IRepository

logger = logging.getLogger(__name__)

# Global platform repository instance
_PLATFORM_REPO: Optional[IRepository] = None
# Lazily-created fallback for standalone mode — one connection, reused
_STANDALONE_REPO: Optional[IRepository] = None

def set_platform_repo(repo: IRepository):
    global _PLATFORM_REPO
    _PLATFORM_REPO = repo

class DuckDBRepository(IRepository):
    """
    Local implementation of IRepository for Treasury using DuckDB.
    """
    def __init__(self, connection):
        self.con = connection

    def execute(self, query: str, params: Optional[Dict[str, Any]] = None) -> Any:
        if params:
            return self.con.execute(query, params)
        return self.con.execute(query)

    def fetch_all(self, query: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        res = self.execute(query, params)
        cols = [desc[0] for desc in res.description]
        return [dict(zip(cols, row)) for row in res.fetchall()]

    def fetch_one(self, query: str, params: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        res = self.execute(query, params)
        cols = [desc[0] for desc in res.description]
        row = res.fetchone()
        return dict(zip(cols, row)) if row else None

    def get_dataframe(self, query: str, params: Optional[Dict[str, Any]] = None) -> pl.DataFrame:
        if params:
            return self.con.execute(query, params).pl()
        return self.con.execute(query).pl()

def get_repo() -> IRepository:
    global _STANDALONE_REPO
    if _PLATFORM_REPO:
        return _PLATFORM_REPO

    # Standalone fallback: connect once and reuse. No emoji in this message —
    # cp1252 Windows consoles crash on it (see root CLAUDE.md gotchas).
    if _STANDALONE_REPO is None:
        logger.warning("Treasury: using standalone DuckDB connection (no platform repo injected)")
        con = duckdb.connect(get_duckdb_path(), read_only=True)
        _STANDALONE_REPO = DuckDBRepository(con)
    return _STANDALONE_REPO

# REFACTORED UTILITIES
def fetch_dict(query: str, params=None):
    return get_repo().fetch_all(query, params)

def fetch_one(query: str, params=None):
    row = get_repo().fetch_one(query, params)
    if row:
        return tuple(row.values())
    return None

def get_polars_df(query: str):
    return get_repo().get_dataframe(query)

# HELPER FOR STANDALONE PATHS
def get_duckdb_path():
    # Priority 1: Environment variable
    env_path = os.getenv("DUCKDB_PATH")
    if env_path and os.path.exists(env_path):
        return env_path
        
    # Priority 2: Absolute path from check.py
    absolute_fallback = r"D:\GrewAnalytics\warehouse.duckdb"
    if os.path.exists(absolute_fallback):
        return absolute_fallback

    # Priority 3: Relative path from backend folder
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(os.path.dirname(os.path.dirname(base_dir)), "warehouse.duckdb")
