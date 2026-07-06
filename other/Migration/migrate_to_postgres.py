"""
migrate_to_postgres.py
======================
Migrates all Treasury-relevant tables from DuckDB warehouse to PostgreSQL.

Usage:
    python migrate_to_postgres.py

Connection target:
    psql -h localhost -p 5433 -U navneet -d Grewdb

Set PG_PASSWORD env var or enter it at the prompt.
"""

import os
import sys
import io
import csv
import getpass
import logging
import traceback

import duckdb
import psycopg2
import psycopg2.extras
import pandas as pd
from psycopg2 import sql as pgsql

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("migration")

# ── Config ────────────────────────────────────────────────────────────────────
DUCKDB_PATH = r"D:\Development\warehouse.duckdb"

PG_HOST     = "localhost"
PG_PORT     = 5433
PG_USER     = "navneet"
PG_DB       = "Grewdb"
PG_PASSWORD = os.getenv("PG_PASSWORD", "")   # set env var or will prompt

# Tables the Treasury app actually queries — in dependency order
TREASURY_TABLES = [
    "LC",
    "LC BG in Process",
    "SBLC",
    "bank_limit",
    "APP_CONFIG",
    "FDR_List",
    "Bank_Guarantee",
    "supplier_Bank_Guarantee",
    "DD",
    "FX_RATES",
    "TREASURY_INSIGHTS",
    "YIELD_CURVE",
    "CAPITAL_STACK",
    "DEBT_MATURITY",
]

# ── DuckDB → PostgreSQL type mapping ──────────────────────────────────────────
DUCK_TO_PG = {
    "INTEGER":          "INTEGER",
    "INT":              "INTEGER",
    "INT4":             "INTEGER",
    "BIGINT":           "BIGINT",
    "INT8":             "BIGINT",
    "HUGEINT":          "NUMERIC",
    "SMALLINT":         "SMALLINT",
    "TINYINT":          "SMALLINT",
    "UBIGINT":          "BIGINT",
    "UINTEGER":         "INTEGER",
    "FLOAT":            "REAL",
    "FLOAT4":           "REAL",
    "REAL":             "REAL",
    "DOUBLE":           "DOUBLE PRECISION",
    "FLOAT8":           "DOUBLE PRECISION",
    "DECIMAL":          "NUMERIC",
    "NUMERIC":          "NUMERIC",
    "VARCHAR":          "TEXT",
    "TEXT":             "TEXT",
    "STRING":           "TEXT",
    "CHAR":             "TEXT",
    "BOOLEAN":          "BOOLEAN",
    "BOOL":             "BOOLEAN",
    "DATE":             "DATE",
    "TIMESTAMP":        "TIMESTAMP",
    "TIMESTAMP WITH TIME ZONE": "TIMESTAMPTZ",
    "TIME":             "TIME",
    "BLOB":             "BYTEA",
    "INTERVAL":         "INTERVAL",
    "JSON":             "JSONB",
    "MAP":              "JSONB",
    "STRUCT":           "JSONB",
    "LIST":             "TEXT",       # fallback
}


def map_type(duck_type: str) -> str:
    """Map a DuckDB column type string to a PostgreSQL type."""
    upper = duck_type.upper().split("(")[0].strip()
    return DUCK_TO_PG.get(upper, "TEXT")


def quote_pg_ident(name: str) -> str:
    """Double-quote an identifier for PostgreSQL (handles spaces, mixed case)."""
    return '"' + name.replace('"', '""') + '"'


# ── Core helpers ──────────────────────────────────────────────────────────────

def get_duck_schema(duck_con, table_name: str) -> list[dict]:
    """Return [{column_name, column_type}, ...] for a DuckDB table."""
    rows = duck_con.execute(f'DESCRIBE {quote_pg_ident(table_name)}').fetchall()
    # DuckDB DESCRIBE → (column_name, column_type, null, key, default, extra)
    return [{"name": r[0], "duck_type": r[1]} for r in rows]


def build_create_table(table_name: str, schema: list[dict]) -> str:
    """Generate a CREATE TABLE IF NOT EXISTS statement."""
    cols = []
    for col in schema:
        pg_type = map_type(col["duck_type"])
        cols.append(f"  {quote_pg_ident(col['name'])} {pg_type}")
    cols_sql = ",\n".join(cols)
    return (
        f"CREATE TABLE IF NOT EXISTS {quote_pg_ident(table_name)} (\n"
        f"{cols_sql}\n);"
    )


def copy_table(duck_con, pg_con, table_name: str):
    """Read from DuckDB, bulk-insert into PostgreSQL via COPY."""
    log.info("  Reading from DuckDB …")
    df: pd.DataFrame = duck_con.execute(
        f"SELECT * FROM {quote_pg_ident(table_name)}"
    ).df()

    if df.empty:
        log.info("  Table is empty — skipping data load.")
        return 0

    # Write to an in-memory CSV buffer
    buf = io.StringIO()
    df.to_csv(buf, index=False, header=True, na_rep="")
    buf.seek(0)

    pg_cursor = pg_con.cursor()
    quoted = quote_pg_ident(table_name)

    # Build column list
    col_list = ", ".join(quote_pg_ident(c) for c in df.columns)

    try:
        pg_cursor.copy_expert(
            f"COPY {quoted} ({col_list}) FROM STDIN WITH (FORMAT CSV, HEADER TRUE, NULL '')",
            buf,
        )
        pg_con.commit()
        log.info("  ✓  %d rows inserted via COPY.", len(df))
        return len(df)
    except Exception as e:
        pg_con.rollback()
        log.error("  COPY failed: %s — falling back to INSERT.", e)
        # Fallback: row-by-row insert (slow but reliable for problem rows)
        return _fallback_insert(df, pg_con, table_name)
    finally:
        pg_cursor.close()


def _fallback_insert(df: pd.DataFrame, pg_con, table_name: str) -> int:
    """Row-by-row parameterised insert — used only when COPY fails."""
    quoted = quote_pg_ident(table_name)
    col_list = ", ".join(quote_pg_ident(c) for c in df.columns)
    placeholders = ", ".join(["%s"] * len(df.columns))
    stmt = f"INSERT INTO {quoted} ({col_list}) VALUES ({placeholders}) ON CONFLICT DO NOTHING"
    inserted = 0
    cur = pg_con.cursor()
    for _, row in df.iterrows():
        try:
            values = [None if pd.isna(v) else v for v in row]
            cur.execute(stmt, values)
            inserted += 1
        except Exception as e:
            pg_con.rollback()
            log.warning("    Row skipped: %s", e)
    pg_con.commit()
    cur.close()
    log.info("  ✓  %d rows inserted via fallback INSERT.", inserted)
    return inserted


def table_exists_in_duck(duck_con, name: str) -> bool:
    try:
        duck_con.execute(f"SELECT 1 FROM {quote_pg_ident(name)} LIMIT 1")
        return True
    except Exception:
        return False


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    global PG_PASSWORD
    if not PG_PASSWORD:
        PG_PASSWORD = getpass.getpass(f"PostgreSQL password for {PG_USER}@{PG_HOST}:{PG_PORT}/{PG_DB}: ")

    # ── Connect DuckDB
    log.info("Connecting to DuckDB: %s", DUCKDB_PATH)
    if not os.path.exists(DUCKDB_PATH):
        log.error("DuckDB file not found: %s", DUCKDB_PATH)
        sys.exit(1)
    duck_con = duckdb.connect(DUCKDB_PATH, read_only=True)
    log.info("DuckDB connected OK.")

    # ── Connect PostgreSQL
    log.info("Connecting to PostgreSQL: %s@%s:%d/%s", PG_USER, PG_HOST, PG_PORT, PG_DB)
    try:
        pg_con = psycopg2.connect(
            host=PG_HOST, port=PG_PORT,
            user=PG_USER, password=PG_PASSWORD,
            dbname=PG_DB,
        )
    except Exception as e:
        log.error("PostgreSQL connection failed: %s", e)
        sys.exit(1)
    log.info("PostgreSQL connected OK.")

    # ── Schema: set search_path
    pg_con.cursor().execute("SET search_path TO public;")
    pg_con.commit()

    total_rows = 0
    skipped    = []
    migrated   = []

    for table_name in TREASURY_TABLES:
        log.info("=" * 60)
        log.info("Table: %s", table_name)

        if not table_exists_in_duck(duck_con, table_name):
            log.warning("  NOT FOUND in DuckDB — skipping.")
            skipped.append(table_name)
            continue

        # Get schema
        try:
            schema = get_duck_schema(duck_con, table_name)
        except Exception as e:
            log.error("  Could not read schema: %s", e)
            skipped.append(table_name)
            continue

        log.info("  Columns (%d): %s", len(schema),
                 ", ".join(f"{c['name']}:{c['duck_type']}" for c in schema))

        # Create table in PG (drop first for a clean migration)
        ddl = build_create_table(table_name, schema)
        cur = pg_con.cursor()
        try:
            cur.execute(f"DROP TABLE IF EXISTS {quote_pg_ident(table_name)} CASCADE;")
            cur.execute(ddl)
            pg_con.commit()
            log.info("  Table (re)created in PostgreSQL.")
        except Exception as e:
            pg_con.rollback()
            log.error("  DDL failed: %s\n%s", e, ddl)
            skipped.append(table_name)
            cur.close()
            continue
        cur.close()

        # Copy data
        try:
            rows = copy_table(duck_con, pg_con, table_name)
            total_rows += rows
            migrated.append(table_name)
        except Exception as e:
            log.error("  Data copy failed: %s", e)
            traceback.print_exc()
            skipped.append(table_name)

    # ── Summary
    log.info("=" * 60)
    log.info("MIGRATION COMPLETE")
    log.info("  Migrated : %d tables  (%d total rows)", len(migrated), total_rows)
    log.info("  Skipped  : %d tables  %s", len(skipped), skipped or "")

    duck_con.close()
    pg_con.close()


if __name__ == "__main__":
    main()
