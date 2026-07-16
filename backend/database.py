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
_DB_CONFIG_SOURCE: str = "env"


def set_platform_repo(repo: IRepository):
    global _PLATFORM_REPO
    _PLATFORM_REPO = repo


# ── PostgreSQL repository ─────────────────────────────────────────────────────

class PostgreSQLRepository(IRepository):
    """IRepository implementation backed by PostgreSQL (psycopg2).

    All Treasury services execute queries via this PostgreSQL repository.
    Queries are run through a SQL translation layer so that standard
    compatibility constructs (date_diff, INTERVAL N DAY, TRY_CAST,
    SHOW TABLES, DESCRIBE …) work transparently.
    """

    def __init__(self, dsn: str):
        import psycopg2
        import psycopg2.extras
        self._psycopg2 = psycopg2
        self._extras = psycopg2.extras
        self._dsn = dsn
        # Add connection timeout (30s) and keepalive to prevent hanging
        self._con = psycopg2.connect(
            dsn,
            connect_timeout=30,
            keepalives=1,
            keepalives_idle=60,
            keepalives_interval=30,
            keepalives_count=5,
        )
        self._con.autocommit = True   # read-only workload; no transactions needed
        logger.info("Treasury: PostgreSQL repository connected (%s)", dsn.split("@")[-1])

    # -- internal helpers
    def _ensure_connection(self):
        """Ensure the connection is usable by checking local state only (no network ping)."""
        import psycopg2.extensions as _ext
        needs_reconnect = False
        try:
            if self._con.closed:
                needs_reconnect = True
            elif self._con.status == _ext.STATUS_IN_TRANSACTION:
                # Aborted transaction — try rollback, fall back to reconnect
                try:
                    self._con.rollback()
                except Exception:
                    needs_reconnect = True
        except Exception:
            needs_reconnect = True

        if needs_reconnect:
            self._reconnect()

    def _reconnect(self, max_attempts: int = 3, base_delay: float = 1.0):
        """Reconnect with exponential back-off. Raises OperationalError after all retries."""
        import time
        last_err: Exception = RuntimeError("no attempts")
        for attempt in range(max_attempts):
            try:
                try:
                    self._con.close()
                except Exception:
                    pass
                self._con = self._psycopg2.connect(self._dsn)
                self._con.autocommit = True
                logger.info("Treasury: DB reconnected (attempt %d/%d)", attempt + 1, max_attempts)
                return
            except self._psycopg2.OperationalError as e:
                last_err = e
                if attempt < max_attempts - 1:
                    delay = base_delay * (2 ** attempt)
                    logger.warning(
                        "Treasury: Reconnect attempt %d/%d failed (%s) -- retrying in %.1fs...",
                        attempt + 1, max_attempts, e, delay
                    )
                    time.sleep(delay)
        raise last_err

    def _cursor(self):
        """Return a dict cursor, reconnecting if the connection is in a bad state."""
        self._ensure_connection()
        return self._con.cursor(cursor_factory=self._extras.RealDictCursor)

    def _translate(self, query: str) -> str:
        from apps.Treasury.backend.postgres_compat import translate_sql
        return translate_sql(query)

    # -- IRepository interface
    def execute(self, query: str, params: Optional[Any] = None) -> Any:
        q = self._translate(query)
        try:
            cur = self._cursor()
            if params:
                cur.execute(q, list(params) if not isinstance(params, (list, tuple)) else params)
            else:
                cur.execute(q.replace("%", "%%"))
            return cur
        except (self._psycopg2.OperationalError, self._psycopg2.InternalError) as e:
            # Connection died mid-query -- reconnect with back-off and retry once
            logger.warning("Treasury: Query failed (%s), reconnecting and retrying...", e)
            try:
                self._reconnect()
                cur = self._con.cursor(cursor_factory=self._extras.RealDictCursor)
                if params:
                    cur.execute(q, list(params) if not isinstance(params, (list, tuple)) else params)
                else:
                    cur.execute(q.replace("%", "%%"))
                return cur
            except Exception as retry_err:
                logger.error("Treasury: Retry after reconnect also failed: %s", retry_err)
                raise

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
    global _STANDALONE_REPO, _DB_CONFIG_SOURCE
    if _PLATFORM_REPO:
        return _PLATFORM_REPO

    if _STANDALONE_REPO:
        return _STANDALONE_REPO

    import urllib.parse

    pg_url = None

    # ── Priority 1: Explicit DATABASE_URL env var (local dev / direct override) ─
    pg_url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
    if pg_url:
        _DB_CONFIG_SOURCE = "DATABASE_URL"
        logger.info("Treasury: Using DATABASE_URL from environment.")

    # ── Priority 2: Supabase edge function (Vercel / production) ─────────────────
    if not pg_url:
        supabase_url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
        supabase_key = (
            os.getenv("SUPABASE_ANON_KEY")
            or os.getenv("VITE_SUPABASE_ANON_KEY")
            or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )

        if supabase_url and supabase_key:
            import urllib.request
            import json

            edge_url = f"{supabase_url.rstrip('/')}/functions/v1/credentials"
            req = urllib.request.Request(
                edge_url,
                headers={
                    "Authorization": f"Bearer {supabase_key}",
                    "apikey": supabase_key,
                    "Content-Type": "application/json",
                },
                method="GET",
            )

            try:
                with urllib.request.urlopen(req, timeout=10) as response:
                    if response.status == 200:
                        creds = json.loads(response.read().decode("utf-8"))
                        db_user = creds.get("PG_USER")
                        db_password = creds.get("PG_PASSWORD")
                        db_host = creds.get("PG_HOST")
                        db_port = str(creds.get("PG_PORT", 5432))
                        db_name = creds.get("PG_DATABASE")

                        if db_user and db_password and db_host and db_name:
                            masked = "*" * len(db_password)
                            logger.info(
                                f"Treasury: Fetched DB details from edge function: "
                                f"user={db_user}, host={db_host}, port={db_port}, database={db_name}, password={masked}"
                            )

                            # Apply IPv4 pooler transform ONLY in Vercel serverless
                            if os.getenv("VERCEL") and db_host.endswith(".supabase.co") and db_port == "5432":
                                project_ref = db_host.split(".")[1]
                                db_host = "aws-0-ap-south-1.pooler.supabase.com"
                                db_port = "6543"
                                db_user = f"{db_user}.{project_ref}"
                                logger.info(
                                    f"Treasury: IPv4 pooler transform applied: "
                                    f"host={db_host}, port={db_port}, user={db_user}"
                                )

                            encoded_password = urllib.parse.quote_plus(db_password)
                            pg_url = f"postgresql://{db_user}:{encoded_password}@{db_host}:{db_port}/{db_name}"
                            _DB_CONFIG_SOURCE = "edge_function"
            except Exception as e:
                logger.warning(f"Treasury: Failed to fetch DB credentials from edge function: {e}")

    # ── Priority 3: Individual DB_* / PG_* env vars ───────────────────────────
    if not pg_url:
        db_user = os.getenv("DB_USER") or os.getenv("PG_USER") or "postgres"
        db_password = os.getenv("DB_PASSWORD") or os.getenv("PG_PASSWORD")
        db_host = os.getenv("DB_HOST") or os.getenv("PG_HOST")
        db_port = os.getenv("DB_PORT") or os.getenv("PG_PORT") or "5432"
        db_name = os.getenv("DB_NAME") or os.getenv("PG_DATABASE") or "postgres"

        if db_host and db_password:
            encoded_password = urllib.parse.quote_plus(db_password)
            pg_url = f"postgresql://{db_user}:{encoded_password}@{db_host}:{db_port}/{db_name}"
            _DB_CONFIG_SOURCE = "env_vars"

    if not pg_url:
        raise RuntimeError(
            "Treasury: DATABASE_URL, DB_HOST/DB_PASSWORD, or SUPABASE_URL/SUPABASE_ANON_KEY must be configured."
        )

    repo = PostgreSQLRepository(pg_url)
    _STANDALONE_REPO = repo
    logger.info("Treasury: using PostgreSQL repository.")

    # Detect if database columns use newlines
    try:
        check_query = (
            "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'LC' AND column_name = 'BOE Bill Amt\n(in FC)')"
        )
        cur = repo._cursor()
        cur.execute(check_query)
        row = cur.fetchone()
        has_newlines = row['exists'] if row else False
        import apps.Treasury.backend.postgres_compat as compat
        compat.HAS_NEWLINE_COLUMNS = has_newlines
        logger.info(f"Treasury: Detected database column style: {'newline' if has_newlines else 'space'}")
    except Exception as e:
        logger.warning(f"Treasury: Failed to detect column style: {e}")

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


def get_db_config_info() -> dict:
    """Return the resolved connection config for transparency/debugging.
    Password is always masked. Returns None if repo not yet initialised."""
    try:
        repo = get_repo()
        dsn = repo._dsn  # postgresql://user:pass@host:port/db
        # Parse
        rest = dsn[len("postgresql://"):]
        userpass, hostdb = rest.split("@", 1)
        user = userpass.split(":")[0]
        hostport, db = hostdb.split("/", 1)
        host, *port_part = hostport.split(":")
        port = int(port_part[0]) if port_part else 5432
        return {
            "host": host,
            "port": port,
            "user": user,
            "database": db,
            "source": _DB_CONFIG_SOURCE,
            "masked_password": "****",
        }
    except Exception as e:
        return {"error": str(e)}

