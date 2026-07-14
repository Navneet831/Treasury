"""
postgres_compat.py
==================
Thin compatibility layer that translates the SQL used across
Treasury services into standard PostgreSQL before execution.

Translations applied:
  • Unquoted Treasury table names      → double-quoted (case-preserved)
  • date_diff('day', a, b)            → (b::DATE - a::DATE)
  • 'x'::DATE + INTERVAL N DAY        → 'x'::DATE + INTERVAL 'N days'
  • date_trunc('month', CURRENT_DATE - INTERVAL N MONTH)
                                      → date_trunc('month', CURRENT_DATE - INTERVAL 'N months')
  • INTERVAL N MONTH                  → INTERVAL 'N months'
  • TRY_CAST(... AS DOUBLE)           → CAST(... AS DOUBLE PRECISION)
  • CAST(x AS DOUBLE)                 → CAST(x AS DOUBLE PRECISION)
  • SHOW TABLES                       → SELECT table_name AS name FROM information_schema.tables
  • DESCRIBE <table>                  → SELECT column_name, data_type AS column_type ...

Positional params (?) → psycopg2 positional params (%s).
"""

import re

# Treasury tables that must be double-quoted in PostgreSQL
# (they were created with uppercase names via CREATE TABLE "LC" etc.)
_TREASURY_TABLES = {
    "LC", "SBLC", "bank_limit", "APP_CONFIG", "FDR_List",
    "Bank_Guarantee", "supplier_Bank_Guarantee", "DD", "FX_RATES",
    "TREASURY_INSIGHTS", "YIELD_CURVE", "CAPITAL_STACK", "DEBT_MATURITY",
}

# Mixed-case column names that PostgreSQL would lowercase if unquoted.
# Only quote these when they appear as bare identifiers (not already quoted,
# not inside string literals).
_MIXED_CASE_COLS = {
    # bank_limit columns
    "Bank_Table", "Element",
    # LC BG in Process columns
    "MRGIN", "Bank_Name",
    # common columns that appear unquoted in queries
    "Margin", "Type", "Status",
}
_COL_RE = re.compile(
    r'(?<!["\w])(' + '|'.join(re.escape(c) for c in sorted(_MIXED_CASE_COLS, key=len, reverse=True)) + r')(?!["\w])',
)
# Pre-compiled pattern: word boundary + table name + word boundary, NOT already quoted
_TABLE_RE = re.compile(
    r'(?<!["\w])(' + '|'.join(re.escape(t) for t in sorted(_TREASURY_TABLES, key=len, reverse=True)) + r')(?!["\w])',
)


def _quote_tables(query: str) -> str:
    """Double-quote unquoted Treasury table and mixed-case column name references."""
    result = []
    i = 0
    while i < len(query):
        # Skip already-quoted identifiers
        if query[i] == '"':
            j = i + 1
            while j < len(query) and query[j] != '"':
                j += 1
            result.append(query[i:j+1])
            i = j + 1
            continue
        # Skip single-quoted string literals
        if query[i] == "'":
            j = i + 1
            while j < len(query):
                if query[j] == "'" and (j + 1 >= len(query) or query[j+1] != "'"):
                    break
                j += 1
            result.append(query[i:j+1])
            i = j + 1
            continue
        # Try table name match
        m = _TABLE_RE.match(query, i)
        if m:
            result.append(f'"{m.group(1)}"')
            i = m.end()
            continue
        # Try mixed-case column name match
        m = _COL_RE.match(query, i)
        if m:
            result.append(f'"{m.group(1)}"')
            i = m.end()
            continue
        result.append(query[i])
        i += 1
    return "".join(result)


def _interval_day(m: re.Match) -> str:
    """INTERVAL N DAY → INTERVAL 'N days'"""
    return f"INTERVAL '{m.group(1)} days'"


def _interval_month(m: re.Match) -> str:
    """INTERVAL N MONTH → INTERVAL 'N months'"""
    return f"INTERVAL '{m.group(1)} months'"


def _date_diff_days(m: re.Match) -> str:
    """date_diff('day', a, b) → (b::DATE - a::DATE)"""
    a, b = m.group(1).strip(), m.group(2).strip()
    return f"(({b})::DATE - ({a})::DATE)"


def _fix_cast_double(query: str) -> str:
    """Rewrite CAST(... AS DOUBLE) → CAST(... AS DOUBLE PRECISION).

    Handles arbitrarily nested parentheses inside the CAST expression, which
    a simple regex cannot.  Works character-by-character.
    """
    result = []
    i = 0
    upper = query.upper()
    while i < len(query):
        # Look for CAST( — case-insensitive
        if upper[i:i+5] == "CAST(" and (i == 0 or not (query[i-1].isalpha() or query[i-1] == '_')):
            # Collect the full balanced parenthesised expression
            start = i + 5          # position just inside the opening (
            depth = 1
            j = start
            in_sq = False
            while j < len(query) and depth > 0:
                c = query[j]
                if c == "'" and not in_sq:
                    in_sq = True
                elif c == "'" and in_sq:
                    in_sq = False
                elif not in_sq:
                    if c == "(":
                        depth += 1
                    elif c == ")":
                        depth -= 1
                j += 1
            # query[start:j-1] is the inner content; j points past the closing )
            inner = query[start:j-1]
            # Check if it ends with "AS DOUBLE" (ignoring trailing whitespace)
            m = re.match(r"^(.*?)\s+AS\s+DOUBLE\s*$", inner, re.IGNORECASE | re.DOTALL)
            if m:
                result.append(f"CAST({m.group(1)} AS DOUBLE PRECISION)")
            else:
                result.append(f"CAST({inner})")
            i = j
        else:
            result.append(query[i])
            i += 1
    return "".join(result)


def translate_sql(query: str) -> str:
    """Apply all dialect translations to PostgreSQL."""

    # 1. SHOW TABLES
    if re.match(r"^\s*SHOW\s+TABLES\s*;?\s*$", query, re.IGNORECASE):
        return (
            "SELECT table_name AS name "
            "FROM information_schema.tables "
            "WHERE table_schema = 'public' "
            "ORDER BY table_name"
        )

    # 2. DESCRIBE <table> (must be before table-quoting pass)
    m_desc = re.match(r'^\s*DESCRIBE\s+(?:"?([\w\s]+?)"?)\s*;?\s*$', query, re.IGNORECASE)
    if m_desc:
        tbl = m_desc.group(1).strip()
        return (
            f"SELECT column_name, data_type AS column_type "
            f"FROM information_schema.columns "
            f"WHERE table_name = '{tbl}' AND table_schema = 'public' "
            f"ORDER BY ordinal_position"
        )

    # 3. Quote unquoted Treasury table names + mixed-case column names
    query = _quote_tables(query)

    # Translate column names with spaces to their newline counterparts in the database
    query = query.replace('"LC Amt (in INR)"', '"LC Amt \n(in INR)"')
    query = query.replace('"Final LC Amt (in FC)"', '"Final LC Amt\n(in FC)"')
    query = query.replace('"BOE Bill Amt (in FC)"', '"BOE Bill Amt\n(in FC)"')
    query = query.replace('"Pending BOE Amt (in FC)"', '"Pending BOE Amt\n(in FC)"')
    query = query.replace('"BOE Bill Amt (in INR)"', '"BOE Bill Amt\n(in INR)"')
    query = query.replace('"Pending BOE Amt (in INR)"', '"Pending BOE Amt\n(in INR)"')

    # 3b. Cast known date/timestamp columns stored as TEXT to ::DATE so
    #     comparisons with date literals work. Applies to quoted column refs.
    _DATE_COL_NAMES = (
        "LC Payment Due Date", "LC Op. Date", "LC EXPIRY DATE",
        "LC SHIPMENT DATE", "LC Close date", "Material Receipt Date",
        "Bill Lodge date", "Bill Acceptance date",
        "Date of Bill of Entry Submitted to Bank",
        "SBLC ISSUE DATE", "SBLC LC Payment Due Date",
        "LC Op. Date",
    )
    for col in _DATE_COL_NAMES:
        quoted = f'"{col}"'
        # Replace uncast occurrences with ::DATE cast — skip if already cast
        query = re.sub(
            r'(?<!\:)' + re.escape(quoted) + r'(?!::)',
            f'{quoted}::DATE',
            query,
        )

    # 4. date_trunc with a plain column ref → cast it to TIMESTAMP
    #    date_trunc('x', col)  →  date_trunc('x', col::TIMESTAMP)
    #    Only applies when the second arg is NOT already a cast/function call.
    def _wrap_date_trunc(m: re.Match) -> str:
        unit = m.group(1)
        arg  = m.group(2).strip()
        # Already cast? leave it alone
        if '::' in arg or arg.upper().startswith('CAST('):
            return m.group(0)
        return f"date_trunc('{unit}', ({arg})::TIMESTAMP)"
    query = re.sub(
        r"date_trunc\s*\(\s*'(\w+)'\s*,\s*([^)]+?)\s*\)",
        _wrap_date_trunc,
        query,
        flags=re.IGNORECASE,
    )

    # 5. date_diff('day', a, b) → (b::DATE - a::DATE)
    query = re.sub(
        r"date_diff\s*\(\s*'day'\s*,\s*([^,]+?),\s*([^)]+?)\)",
        _date_diff_days,
        query,
        flags=re.IGNORECASE,
    )

    # 5. INTERVAL N DAY  (bare number, no quotes)
    query = re.sub(
        r"\bINTERVAL\s+(\d+)\s+DAY\b",
        _interval_day,
        query,
        flags=re.IGNORECASE,
    )

    # 6. INTERVAL N MONTH
    query = re.sub(
        r"\bINTERVAL\s+(\d+)\s+MONTH\b",
        _interval_month,
        query,
        flags=re.IGNORECASE,
    )

    # 7. TRY_CAST → CAST
    query = re.sub(r"\bTRY_CAST\s*\(", "CAST(", query, flags=re.IGNORECASE)
    # 8. CAST(... AS DOUBLE) → CAST(... AS DOUBLE PRECISION)
    #    Uses a scanner because the inner expression may contain nested parentheses.
    query = _fix_cast_double(query)

    # 9. ? params → psycopg2 %s params
    query = _replace_placeholders(query)

    return query


def _replace_placeholders(query: str) -> str:
    """Replace ? params with %s, skipping occurrences inside quotes."""
    result = []
    in_single = False
    in_double = False
    i = 0
    while i < len(query):
        c = query[i]
        if c == "'" and not in_double:
            in_single = not in_single
            result.append(c)
        elif c == '"' and not in_single:
            in_double = not in_double
            result.append(c)
        elif c == "?" and not in_single and not in_double:
            result.append("%s")
        else:
            result.append(c)
        i += 1
    return "".join(result)
