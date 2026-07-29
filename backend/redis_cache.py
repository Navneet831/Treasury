"""Redis-backed cache decorator with in-memory fallback.

Replaces the simple in-memory `ttl_cache` with a Redis-backed version that
survives process restarts and is shared across workers. Falls back to in-memory
caching if Redis is unavailable.

Usage:
    from redis_cache import redis_cache

    @redis_cache(seconds=60)
    def get_fx_risk_data(fy: str = "All"):
        ...
"""

import functools
import hashlib
import json
import logging
import os
import time
from typing import Any, Callable, Dict, Optional

logger = logging.getLogger(__name__)

# ── Redis client (lazy) ─────────────────────────────────────────────────────────

_redis_client = None
_redis_available = False
_redis_checked = False

REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")


def _get_redis():
    """Lazily initialise and return Redis client. Returns None if Redis is down."""
    global _redis_client, _redis_available, _redis_checked
    if _redis_checked:
        return _redis_client if _redis_available else None
    _redis_checked = True
    try:
        import redis as _redis_module
        _redis_client = _redis_module.from_url(REDIS_URL, socket_timeout=2, socket_connect_timeout=2)
        _redis_client.ping()
        _redis_available = True
        logger.info("Redis connected at %s", REDIS_URL.replace("redis://", "redis://***@"))
    except Exception as e:
        _redis_available = False
        _redis_client = None
        logger.warning("Redis unavailable (%s) — falling back to in-memory cache", e)
    return _redis_client if _redis_available else None


# ── In-memory fallback (same logic as ttl_cache) ────────────────────────────────

_memory_store: Dict[str, Any] = {}


# ── Key helpers ─────────────────────────────────────────────────────────────────

def _make_key(fn: Callable, args: tuple, kwargs: dict) -> str:
    """Deterministic hash from module, function name, and serialised arguments."""
    parts = [fn.__module__, fn.__qualname__, json.dumps(args, sort_keys=True, default=str)]
    if kwargs:
        parts.append(json.dumps(kwargs, sort_keys=True, default=str))
    raw = "::".join(parts)
    return hashlib.sha256(raw.encode()).hexdigest()


# ── Redis cache decorator ───────────────────────────────────────────────────────

def redis_cache(seconds: float = 60.0):
    """Read-through cache backed by Redis with in-memory fallback.

    Args:
        seconds: TTL in seconds (default 60). Warehouse is a read-only daily load,
                 so short TTLs trade no correctness for large latency wins.
    """
    def decorator(fn: Callable) -> Callable:
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            key = _make_key(fn, args, kwargs)
            now = time.monotonic()

            # 1. Try Redis first
            client = _get_redis()
            if client is not None:
                try:
                    raw = client.get(key)
                    if raw is not None:
                        return json.loads(raw)
                except Exception as e:
                    logger.debug("Redis get failed for %s: %s", key[:16], e)

            # 2. Fallback: in-memory cache
            hit = _memory_store.get(key)
            if hit is not None and now - hit[0] < seconds:
                return hit[1]

            # 3. Compute value
            value = fn(*args, **kwargs)

            # 4. Store in Redis (if available) and in-memory
            if client is not None:
                try:
                    client.setex(key, int(seconds), json.dumps(value, default=str))
                except Exception as e:
                    logger.debug("Redis set failed for %s: %s", key[:16], e)
            _memory_store[key] = (now, value)

            return value

        # Expose a cache-clear helper for testing / admin
        wrapper.cache_clear = lambda: _memory_store.clear()
        return wrapper
    return decorator


# ── Admin helper ─────────────────────────────────────────────────────────────────

def clear_all_caches():
    """Clear both Redis and in-memory caches. Useful for admin endpoints."""
    _memory_store.clear()
    client = _get_redis()
    if client is not None:
        try:
            client.flushdb()
        except Exception:
            pass
