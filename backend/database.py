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

    All Treasury services were written against DuckDB dialect. This class
    runs every query through ``postgres_compat.translate_sql`` before
    execution so that DuckDB-specific constructs (date_diff, INTERVAL N DAY,
    TRY_CAST, SHOW TABLES, DESCRIBE …) work transparently on PostgreSQL.
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
        from apps.Treasury.other.Migration.postgres_compat import translate_sql
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

    # Priority 2 — PostgreSQL
    pg_url = os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")
    if not pg_url:
        db_user = os.getenv("DB_USER") or os.getenv("PG_USER")
        db_password = os.getenv("DB_PASSWORD") or os.getenv("PG_PASSWORD")
        db_host = os.getenv("DB_HOST") or os.getenv("PG_HOST")
        db_port = os.getenv("DB_PORT") or os.getenv("PG_PORT")
        db_name = os.getenv("DB_NAME") or os.getenv("PG_DATABASE")
        if db_user and db_password and db_host and db_port and db_name:
            import urllib.parse
            encoded_password = urllib.parse.quote_plus(db_password)
            pg_url = f"postgresql://{db_user}:{encoded_password}@{db_host}:{db_port}/{db_name}"

    if not pg_url:
        supabase_url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_ANON_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if supabase_url and supabase_key:
            import urllib.request
            import urllib.parse
            import json
            url = f"{supabase_url.rstrip('/')}/functions/v1/db-credentials"
            req = urllib.request.Request(
                url,
                headers={
                    "Authorization": f"Bearer {supabase_key}",
                    "apikey": supabase_key,
                    "Content-Type": "application/json"
                },
                method="GET"
            )
            try:
                with urllib.request.urlopen(req, timeout=10) as response:
                    if response.status == 200:
                        creds = json.loads(response.read().decode('utf-8'))
                        db_user = creds.get("user")
                        db_password = creds.get("password")
                        db_host = creds.get("host")
                        db_port = str(creds.get("port", 5432))
                        db_name = creds.get("database")
                        if db_user and db_password and db_host and db_port and db_name:
                            encoded_password = urllib.parse.quote_plus(db_password)
                            pg_url = f"postgresql://{db_user}:{encoded_password}@{db_host}:{db_port}/{db_name}"
                            logger.info("Treasury: Successfully fetched PostgreSQL credentials from Supabase edge function.")
            except Exception as e:
                logger.error(f"Treasury: Failed to fetch PostgreSQL credentials from edge function: {e}")

    if not pg_url:
        raise RuntimeError(
            "Treasury: no PostgreSQL connection configured. Set POSTGRES_URL "
            "(or PG_USER/PG_PASSWORD/PG_HOST/PG_PORT/PG_DATABASE) in the .env."
        )

    repo = PostgreSQLRepository(pg_url)
    _STANDALONE_REPO = repo
    logger.info("Treasury: using PostgreSQL repository.")
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
