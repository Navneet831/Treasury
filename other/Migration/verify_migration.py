"""
verify_migration.py
===================
Quick sanity check after running migrate_to_postgres.py.

Compares row counts for every migrated table between DuckDB and PostgreSQL,
then runs a few key Treasury queries against PostgreSQL to confirm the
dialect translator is working.

Usage:
    python verify_migration.py
"""

import os
import sys
import getpass
import logging

import duckdb
import psycopg2
import psycopg2.extras

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-8s  %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("verify")

DUCKDB_PATH = r"D:\Development\warehouse.duckdb"
PG_HOST     = "localhost"
PG_PORT     = 5433
PG_USER     = "navneet"
PG_DB       = "Grewdb"
PG_PASSWORD = os.getenv("PG_PASSWORD", "")

TABLES = [
    "LC", "LC BG in Process", "SBLC", "bank_limit",
    "APP_CONFIG", "FDR_List", "Bank_Guarantee",
]

# Key queries that exercise the dialect translator
SMOKE_QUERIES = [
    ("SHOW TABLES", None),
    ("DESCRIBE LC", None),
    (
        "SELECT COUNT(*) AS cnt FROM LC "
        "WHERE \"LC Status\" IN ('Open', 'In Process')",
        None,
    ),
    (
        "SELECT date_trunc('month', \"LC Op. Date\") AS m, COUNT(*) AS n "
        "FROM LC WHERE \"LC Op. Date\" IS NOT NULL GROUP BY 1 ORDER BY 1 DESC LIMIT 3",
        None,
    ),
    (
        "SELECT SUM(CAST(NULLIF(REPLACE(\"LC\", ',', ''), '') AS DOUBLE)) "
        "FROM bank_limit WHERE Bank_Table = 'Bank' AND Element != ''",
        None,
    ),
]


def main():
    global PG_PASSWORD
    if not PG_PASSWORD:
        PG_PASSWORD = getpass.getpass(f"PostgreSQL password for {PG_USER}@{PG_HOST}:{PG_PORT}/{PG_DB}: ")

    duck_con = duckdb.connect(DUCKDB_PATH, read_only=True)
    pg_con   = psycopg2.connect(host=PG_HOST, port=PG_PORT, user=PG_USER,
                                 password=PG_PASSWORD, dbname=PG_DB)

    log.info("=" * 65)
    log.info("ROW COUNT COMPARISON")
    log.info("=" * 65)
    all_ok = True
    for tbl in TABLES:
        try:
            duck_n = duck_con.execute(f'SELECT COUNT(*) FROM "{tbl}"').fetchone()[0]
        except Exception:
            duck_n = "MISSING"
        try:
            cur = pg_con.cursor()
            cur.execute(f'SELECT COUNT(*) FROM "{tbl}"')
            pg_n = cur.fetchone()[0]
        except Exception:
            pg_n = "MISSING"
        match = "✓" if duck_n == pg_n else "✗ MISMATCH"
        if duck_n != pg_n:
            all_ok = False
        log.info("  %-30s  DuckDB=%s  PG=%s  %s", tbl, duck_n, pg_n, match)

    log.info("")
    log.info("=" * 65)
    log.info("SMOKE TEST (dialect translator)")
    log.info("=" * 65)

    # Import translator
    sys.path.insert(0, os.path.dirname(__file__))
    from postgres_compat import translate_sql

    cur = pg_con.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    for query, params in SMOKE_QUERIES:
        translated = translate_sql(query)
        try:
            cur.execute(translated, params or ())
            rows = cur.fetchall()
            log.info("  ✓  %-55s → %d rows", query[:55], len(rows))
        except Exception as e:
            log.error("  ✗  %-55s → %s", query[:55], e)
            all_ok = False

    log.info("")
    if all_ok:
        log.info("ALL CHECKS PASSED ✓  — Treasury backend can now use PostgreSQL.")
    else:
        log.warning("SOME CHECKS FAILED — review output above before switching.")

    duck_con.close()
    pg_con.close()


if __name__ == "__main__":
    main()
