"""Health, readiness, and liveness endpoints for Kubernetes-style probes.

- `/live`  — process is alive (no DB check, just process heartbeat)
- `/ready` — process can accept traffic (DB is reachable)
- `/health` — full dependency status (DB, Redis, Sentry, uptime)
"""

import os
import time
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

_PROCESS_START_TIME: float = time.time()


def _uptime() -> str:
    """Return human-readable uptime since process start."""
    elapsed = time.time() - _PROCESS_START_TIME
    hours, remainder = divmod(int(elapsed), 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours}h {minutes}m {seconds}s"


def _check_db() -> Dict[str, Any]:
    """Check DB connectivity by running a simple SELECT 1."""
    try:
        from apps.Treasury.backend.database import get_repo
        repo = get_repo()
        import psycopg2.extensions as _ext
        from psycopg2 import OperationalError

        if repo._con.closed:
            return {"status": "error", "message": "Connection is closed"}

        if repo._con.status in (_ext.STATUS_IN_TRANSACTION, _ext.STATUS_PREPARED):
            try:
                repo._con.rollback()
            except Exception:
                return {"status": "error", "message": "Connection in broken transaction"}

        cur = repo._con.cursor()
        cur.execute("SELECT 1")
        cur.close()
        return {"status": "ok", "latency_ms": None}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def _check_redis() -> Dict[str, Any]:
    """Check Redis if configured and available."""
    try:
        from apps.Treasury.backend.redis_cache import _redis_available, _redis_client
        if not _redis_available or _redis_client is None:
            return {"status": "disabled", "message": "Redis not configured / Docker stopped"}
        _redis_client.ping()
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def _check_sentry() -> Dict[str, Any]:
    """Report whether Sentry DSN is configured."""
    dsn = os.getenv("SENTRY_DSN")
    if dsn:
        return {"status": "configured", "dsn_prefix": dsn.split("@")[0].split("://")[1][:8] + "..."}
    return {"status": "disabled", "message": "Set SENTRY_DSN in .env"}


def liveness() -> Dict[str, Any]:
    """Simple process-liveness probe. Never fails unless the process is truly dead."""
    return {
        "status": "alive",
        "uptime": _uptime(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "process_id": os.getpid(),
    }


def readiness() -> Dict[str, Any]:
    """Readiness probe: returns 200 only when the DB is reachable."""
    db = _check_db()
    all_ok = db["status"] == "ok"
    return {
        "status": "ready" if all_ok else "not_ready",
        "checks": {"database": db},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def health() -> Dict[str, Any]:
    """Full health check: returns the status of all dependencies."""
    db = _check_db()
    redis = _check_redis()
    sentry = _check_sentry()
    overall = all(dep["status"] == "ok" or dep["status"] in ("disabled", "configured")
                  for dep in [db, redis, sentry])
    return {
        "status": "operational" if overall else "degraded",
        "uptime": _uptime(),
        "module": "Treasury",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "dependencies": {
            "database": db,
            "redis": redis,
            "sentry": sentry,
        },
    }
