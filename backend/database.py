import logging
import os
import pandas as pd
import polars as pl
from typing import Any, Dict, List, Optional
from packages.contracts import IRepository

logger = logging.getLogger(__name__)

# ── Global repository instances ───────────────────────────────────────────────
_PLATFORM_REPO: Optional[IRepository] = None   # injected by module.py (platform mode)
_STANDALONE_REPO: Optional[IRepository] = None # lazily created (standalone mode)


def set_platform_repo(repo: IRepository):
    global _PLATFORM_REPO
    _PLATFORM_REPO = repo


# ── PostgreSQL repository ─────────────────────────────────────────────────────

class PostgreSQLRepository(IRepository):
    """IRepository implementation backed by PostgreSQL (psycopg2).

    All Treasury services execute queries via this PostgreSQL repository.
    This class runs every query through ``postgres_compat.translate_sql``
    before execution so that standard compatibility constructs (date_diff,
    INTERVAL N DAY, TRY_CAST, SHOW TABLES, DESCRIBE …) work transparently.
    """

    def __init__(self, dsn: str):
        import psycopg2
        import psycopg2.extras
        self._psycopg2 = psycopg2
        self._extras = psycopg2.extras
        self._dsn = dsn
        self._con = psycopg2.connect(dsn)
        self._con.autocommit = True   # read-only workload; no transactions needed
        logger.info("Treasury: PostgreSQL repository connected (%s)", dsn.split("@")[-1])

    # -- internal helpers
    def _cursor(self):
        """Return a dict cursor, reconnecting once if the connection dropped."""
        try:
            if self._con.closed:
                raise Exception("connection closed")
            return self._con.cursor(cursor_factory=self._extras.RealDictCursor)
        except Exception:
            self._con = self._psycopg2.connect(self._dsn)
            self._con.autocommit = True
            return self._con.cursor(cursor_factory=self._extras.RealDictCursor)

    def _translate(self, query: str) -> str:
        from apps.Treasury.backend.postgres_compat import translate_sql
        return translate_sql(query)

    # -- IRepository interface
    def execute(self, query: str, params: Optional[Any] = None) -> Any:
        q = self._translate(query)
        cur = self._cursor()
        if params:
            cur.execute(q, list(params) if not isinstance(params, (list, tuple)) else params)
        else:
            # psycopg2 interprets % as a param marker even with no params.
            # Escape any literal % so the query executes cleanly.
            cur.execute(q.replace("%", "%%"))
        return cur

    def fetch_all(self, query: str, params: Optional[Any] = None) -> List[Dict[str, Any]]:
        cur = self.execute(query, params)
        return [dict(row) for row in cur.fetchall()]

    def fetch_one(self, query: str, params: Optional[Any] = None) -> Optional[Dict[str, Any]]:
        cur = self.execute(query, params)
        row = cur.fetchone()
        return dict(row) if row else None

    def get_dataframe(self, query: str, params: Optional[Any] = None) -> pd.DataFrame:
        q = self._translate(query)
        import psycopg2
        con = psycopg2.connect(self._dsn)
        df = pd.read_sql_query(q, con, params=params)
        con.close()
        return df


# ── Repository factory ────────────────────────────────────────────────────────

def get_repo() -> IRepository:
    global _STANDALONE_REPO
    if _PLATFORM_REPO:
        return _PLATFORM_REPO

    if _STANDALONE_REPO:
        return _STANDALONE_REPO

    # Check for direct database URL first
    pg_url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
    
    if not pg_url:
        # Fallback to individual credentials
        db_user = os.getenv("DB_USER") or os.getenv("PG_USER") or "postgres"
        db_password = os.getenv("DB_PASSWORD") or os.getenv("PG_PASSWORD")
        db_host = os.getenv("DB_HOST") or os.getenv("PG_HOST")
        db_port = os.getenv("DB_PORT") or os.getenv("PG_PORT") or "5432"
        db_name = os.getenv("DB_NAME") or os.getenv("PG_DATABASE") or "postgres"
        
        if db_host and db_password:
            import urllib.parse
            encoded_password = urllib.parse.quote_plus(db_password)
            pg_url = f"postgresql://{db_user}:{encoded_password}@{db_host}:{db_port}/{db_name}"

    if not pg_url:
        raise RuntimeError(
            "Treasury: DATABASE_URL or DB_HOST/DB_PASSWORD must be configured in environment variables."
        )

    repo = PostgreSQLRepository(pg_url)
    _STANDALONE_REPO = repo
    logger.info("Treasury: using PostgreSQL repository (configured from environment).")
    return _STANDALONE_REPO


# ── Public helper functions (used by all services) ────────────────────────────

def fetch_dict(query: str, params=None):
    return get_repo().fetch_all(query, params)

def fetch_one(query: str, params=None):
    row = get_repo().fetch_one(query, params)
    if row:
        return tuple(row.values())
    return None

def get_polars_df(query: str):
    return get_repo().get_dataframe(query)
