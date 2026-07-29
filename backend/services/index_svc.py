"""Index domain: financial benchmark indices (NIFTY, SENSEX, GOLD, etc.)."""
from typing import Any, Dict, List, Optional
from apps.Treasury.backend.database import fetch_dict, fetch_one
from apps.Treasury.backend.services.core import ttl_cache


@ttl_cache(seconds=120)
def get_all_indices(category: Optional[str] = None, active_only: bool = True) -> List[Dict[str, Any]]:
    """Return all financial indices, optionally filtered by category."""
    filters = []
    if active_only:
        filters.append("is_active = TRUE")
    if category:
        filters.append(f"category = '{category.replace(chr(39), chr(39)+chr(39))}'")

    where = "WHERE " + " AND ".join(filters) if filters else ""
    rows = fetch_dict(f"""
        SELECT id, symbol, name, category, currency,
               last_value, previous_close, day_change, day_change_pct,
               high_52w, low_52w, last_updated, source
        FROM "Index"
        {where}
        ORDER BY category, symbol
    """)
    # Convert numeric types for JSON serialization
    for r in rows:
        for k in ('last_value', 'previous_close', 'day_change', 'day_change_pct', 'high_52w', 'low_52w'):
            if r.get(k) is not None:
                r[k] = round(float(r[k]), 4)
    return rows


@ttl_cache(seconds=60)
def get_index_by_symbol(symbol: str) -> Optional[Dict[str, Any]]:
    """Return a single index by its symbol (e.g. 'NIFTY')."""
    row = fetch_one(f"""
        SELECT id, symbol, name, category, currency,
               last_value, previous_close, day_change, day_change_pct,
               high_52w, low_52w, last_updated, source
        FROM "Index"
        WHERE symbol = '{symbol.replace(chr(39), chr(39)+chr(39))}'
    """)
    if row:
        return {
            "id": row[0],
            "symbol": row[1],
            "name": row[2],
            "category": row[3],
            "currency": row[4],
            "last_value": round(float(row[5]), 4) if row[5] is not None else None,
            "previous_close": round(float(row[6]), 4) if row[6] is not None else None,
            "day_change": round(float(row[7]), 4) if row[7] is not None else None,
            "day_change_pct": round(float(row[8]), 4) if row[8] is not None else None,
            "high_52w": round(float(row[9]), 4) if row[9] is not None else None,
            "low_52w": round(float(row[10]), 4) if row[10] is not None else None,
            "last_updated": str(row[11]) if row[11] else None,
            "source": row[12],
        }
    return None


@ttl_cache(seconds=300)
def get_index_categories() -> List[str]:
    """Return distinct categories for filter UI."""
    rows = fetch_dict('SELECT DISTINCT category FROM "Index" WHERE is_active = TRUE ORDER BY category')
    return [r['category'] for r in rows if r['category']]


def update_index_value(symbol: str, last_value: float, previous_close: Optional[float] = None) -> bool:
    """Update the current value for an index symbol (called by data import)."""
    from apps.Treasury.backend.database import get_repo
    prev = previous_close
    if prev is None:
        # Auto-calculate from stored previous_close
        row = fetch_one(f'SELECT previous_close FROM "Index" WHERE symbol = \'{symbol}\'')
        prev = float(row[0]) if row and row[0] else last_value

    day_change = last_value - prev
    day_change_pct = (day_change / prev * 100) if prev and prev != 0 else 0.0

    get_repo().execute(f"""
        UPDATE "Index"
        SET last_value = {last_value},
            previous_close = {prev},
            day_change = {day_change},
            day_change_pct = {day_change_pct},
            last_updated = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE symbol = '{symbol}'
    """)
    return True
