"""Prometheus metrics for LLM / Copilot requests.

Tracks:
- Request count per model (counter)
- Latency per model (histogram)
- Token usage: prompt + completion tokens (histogram)
- Retrieval time for DB snapshot (histogram)
- Model fallback chain depth (summary)
- Errors per model (counter)

Usage in copilot.py:
    from apps.Treasury.backend.llm_metrics import (
        LLM_REQUESTS, LLM_LATENCY, LLM_TOKENS,
        LLM_RETRIEVAL_TIME, LLM_ERRORS, LLM_FALLBACK_DEPTH,
        observe_llm_call
    )
"""

import time
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ── Prometheus Metrics ──────────────────────────────────────────────────────────
# These are lazily created so they don't crash if prometheus_client isn't installed.

_LLM_REQUESTS = None
_LLM_LATENCY = None
_LLM_TOKENS = None
_LLM_RETRIEVAL_TIME = None
_LLM_ERRORS = None
_LLM_FALLBACK_DEPTH = None


def _register_metrics():
    """Eagerly register all LLM metrics at import time so they appear in /metrics
    immediately, not just after the first LLM call."""
    global _LLM_REQUESTS, _LLM_LATENCY, _LLM_TOKENS, _LLM_RETRIEVAL_TIME, _LLM_ERRORS, _LLM_FALLBACK_DEPTH
    if _LLM_REQUESTS is not None:
        return

    try:
        from prometheus_client import Counter, Histogram, Summary

        _LLM_REQUESTS = Counter(
            "llm_requests_total",
            "Total number of LLM / Copilot requests",
            ["model", "status"],  # status: success | error
        )
        _LLM_LATENCY = Histogram(
            "llm_latency_seconds",
            "Latency of LLM requests in seconds",
            ["model"],
            buckets=(0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 15.0, 30.0, 45.0, 60.0, float("inf")),
        )
        _LLM_TOKENS = Histogram(
            "llm_tokens_total",
            "Token usage per LLM request (prompt + completion)",
            ["model", "type"],  # type: prompt | completion
            buckets=(100, 500, 1000, 2000, 4000, 8000, 16000, 32000),
        )
        _LLM_RETRIEVAL_TIME = Histogram(
            "llm_retrieval_duration_seconds",
            "Time spent fetching the DB snapshot for the LLM context",
            buckets=(0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0),
        )
        _LLM_ERRORS = Counter(
            "llm_errors_total",
            "Total number of LLM request errors",
            ["model", "error_type"],
        )
        _LLM_FALLBACK_DEPTH = Histogram(
            "llm_fallback_depth",
            "Number of model attempts before success (1 = first model worked)",
            buckets=(1, 2, 3, 4, 5),
        )

        logger.info("LLM Prometheus metrics registered")
    except ImportError as e:
        logger.debug("prometheus_client not available for LLM metrics: %s", e)
    except Exception as e:
        logger.warning("Failed to register LLM metrics: %s", e)


def _ensure_metrics():
    """Idempotent call to make sure metrics are created (no-op after first call)."""
    _register_metrics()


# Eagerly register metrics at import time
_register_metrics()


def observe_llm_call(
    model: str,
    status: str,
    latency_seconds: float,
    prompt_tokens: Optional[int] = None,
    completion_tokens: Optional[int] = None,
    error_type: Optional[str] = None,
) -> None:
    """Record a single LLM call with its metrics."""
    _ensure_metrics()

    try:
        if _LLM_REQUESTS is not None:
            _LLM_REQUESTS.labels(model=model, status=status).inc()

        if _LLM_LATENCY is not None:
            _LLM_LATENCY.labels(model=model).observe(latency_seconds)

        if _LLM_TOKENS is not None and prompt_tokens is not None:
            _LLM_TOKENS.labels(model=model, type="prompt").observe(prompt_tokens)

        if _LLM_TOKENS is not None and completion_tokens is not None:
            _LLM_TOKENS.labels(model=model, type="completion").observe(completion_tokens)

        if _LLM_ERRORS is not None and status == "error" and error_type:
            _LLM_ERRORS.labels(model=model, error_type=error_type).inc()

    except Exception as e:
        logger.debug("Failed to record LLM metric: %s", e)


def observe_retrieval_time(seconds: float) -> None:
    """Record DB snapshot retrieval time."""
    _ensure_metrics()
    try:
        if _LLM_RETRIEVAL_TIME is not None:
            _LLM_RETRIEVAL_TIME.observe(seconds)
    except Exception:
        pass


def observe_fallback_depth(depth: int) -> None:
    """Record how many models were tried before success."""
    _ensure_metrics()
    try:
        if _LLM_FALLBACK_DEPTH is not None:
            _LLM_FALLBACK_DEPTH.observe(depth)
    except Exception:
        pass
