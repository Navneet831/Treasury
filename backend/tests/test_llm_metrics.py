"""Tests for LLM / Copilot Prometheus metrics.

Validates that the 6 Prometheus metrics defined in llm_metrics.py
are correctly registered, respond to observations, and handle edge cases
(error paths, missing args, idempotency, multi-model independence).
"""

import uuid

import pytest
from prometheus_client import REGISTRY, Counter, Histogram

from apps.Treasury.backend.llm_metrics import (
    _ensure_metrics,
    _LLM_ERRORS,
    _LLM_FALLBACK_DEPTH,
    _LLM_LATENCY,
    _LLM_REQUESTS,
    _LLM_RETRIEVAL_TIME,
    _LLM_TOKENS,
    observe_fallback_depth,
    observe_llm_call,
    observe_retrieval_time,
)


# ── Helpers ────────────────────────────────────────────────────────────────────


def _sample(name, labels=None):
    """Return the current value of a Prometheus sample, or 0.0 if absent."""
    val = REGISTRY.get_sample_value(name, labels or {})
    return val if val is not None else 0.0


def _uname(tag):
    """Unique label value per call so parallel tests never collide."""
    return f"{tag}-{uuid.uuid4().hex[:8]}"


# ── Metric Registration ────────────────────────────────────────────────────────


class TestMetricsRegistered:
    """All 6 metric objects exist and are the correct Prometheus type."""

    def test_types(self):
        assert isinstance(_LLM_REQUESTS, Counter)
        assert isinstance(_LLM_LATENCY, Histogram)
        assert isinstance(_LLM_TOKENS, Histogram)
        assert isinstance(_LLM_RETRIEVAL_TIME, Histogram)
        assert isinstance(_LLM_ERRORS, Counter)
        assert isinstance(_LLM_FALLBACK_DEPTH, Histogram)

    def test_smoke_observe(self):
        """A single observation appears in the Prometheus registry."""
        m = "test-smoke-registered"
        observe_llm_call(m, "success", 0.1)
        assert (
            REGISTRY.get_sample_value(
                "llm_requests_total", {"model": m, "status": "success"}
            )
            == 1.0
        )


# ── observe_llm_call — success path ────────────────────────────────────────────


class TestObserveLlmCallSuccess:
    """Success path increments request counter and records latency + tokens."""

    def test_all_metrics(self):
        model = _uname("model")
        observe_llm_call(
            model, "success", 0.5, prompt_tokens=100, completion_tokens=50
        )

        # Counter
        assert (
            _sample("llm_requests_total", {"model": model, "status": "success"})
            == 1.0
        )
        # Latency histogram
        assert (
            _sample("llm_latency_seconds_count", {"model": model}) == 1.0
        )
        assert _sample("llm_latency_seconds_sum", {"model": model}) == pytest.approx(0.5)
        # Token histograms
        assert (
            _sample("llm_tokens_total_count", {"model": model, "type": "prompt"})
            == 1.0
        )
        assert _sample(
            "llm_tokens_total_sum", {"model": model, "type": "prompt"}
        ) == pytest.approx(100.0)
        assert (
            _sample(
                "llm_tokens_total_count", {"model": model, "type": "completion"}
            )
            == 1.0
        )
        assert _sample(
            "llm_tokens_total_sum", {"model": model, "type": "completion"}
        ) == pytest.approx(50.0)
        # No error recorded for this model
        assert (
            _sample("llm_errors_total", {"model": model, "error_type": "n/a"})
            == 0.0
        )

    def test_no_tokens(self):
        """Call without token arguments should not crash nor record token metrics."""
        model = _uname("model")
        observe_llm_call(model, "success", 0.3)

        assert (
            _sample("llm_requests_total", {"model": model, "status": "success"})
            == 1.0
        )
        # Token histograms were NOT incremented
        assert (
            _sample("llm_tokens_total_count", {"model": model, "type": "prompt"})
            == 0.0
        )
        assert (
            _sample(
                "llm_tokens_total_count", {"model": model, "type": "completion"}
            )
            == 0.0
        )

    def test_zero_tokens_explicit(self):
        """Explicitly passing 0 for tokens should still record a token observation."""
        model = _uname("model")
        observe_llm_call(model, "success", 0.3, prompt_tokens=0, completion_tokens=0)

        assert (
            _sample("llm_tokens_total_count", {"model": model, "type": "prompt"})
            == 1.0
        )
        assert (
            _sample(
                "llm_tokens_total_count", {"model": model, "type": "completion"}
            )
            == 1.0
        )


# ── observe_llm_call — error path ──────────────────────────────────────────────


class TestObserveLlmCallError:
    """Error path increments error counter with the correct error_type label."""

    def test_with_error_type(self):
        model = _uname("model")
        error_type = "TimeoutError"
        observe_llm_call(model, "error", 2.0, error_type=error_type)

        assert (
            _sample("llm_requests_total", {"model": model, "status": "error"})
            == 1.0
        )
        assert _sample("llm_latency_seconds_count", {"model": model}) == 1.0
        assert (
            _sample(
                "llm_errors_total", {"model": model, "error_type": error_type}
            )
            == 1.0
        )

    def test_missing_error_type(self):
        """status='error' without error_type should NOT increment error counter."""
        model = _uname("model")
        observe_llm_call(model, "error", 1.0)  # no error_type
        assert (
            _sample("llm_errors_total", {"model": model, "error_type": "missing"})
            == 0.0
        )

    def test_error_type_with_success_status(self):
        """error_type with status='success' should NOT increment error counter."""
        model = _uname("model")
        observe_llm_call(model, "success", 0.5, error_type="SomeError")
        assert (
            _sample("llm_errors_total", {"model": model, "error_type": "SomeError"})
            == 0.0
        )


# ── observe_retrieval_time ─────────────────────────────────────────────────────


class TestObserveRetrievalTime:
    """Histogram records DB snapshot retrieval time."""

    def test_records_value(self):
        before_count = _sample("llm_retrieval_duration_seconds_count")
        before_sum = _sample("llm_retrieval_duration_seconds_sum")

        observe_retrieval_time(1.5)

        assert (
            _sample("llm_retrieval_duration_seconds_count")
            == before_count + 1.0
        )
        assert _sample("llm_retrieval_duration_seconds_sum") == pytest.approx(
            before_sum + 1.5
        )

    def test_multiple_calls(self):
        """Multiple observations accumulate independently."""
        before_count = _sample("llm_retrieval_duration_seconds_count")

        observe_retrieval_time(0.1)
        observe_retrieval_time(0.2)
        observe_retrieval_time(0.3)

        assert (
            _sample("llm_retrieval_duration_seconds_count")
            == before_count + 3.0
        )


# ── observe_fallback_depth ─────────────────────────────────────────────────────


class TestObserveFallbackDepth:
    """Histogram records model fallback chain depth."""

    def test_records_value(self):
        before_count = _sample("llm_fallback_depth_count")
        before_sum = _sample("llm_fallback_depth_sum")

        observe_fallback_depth(3)

        assert _sample("llm_fallback_depth_count") == before_count + 1.0
        assert _sample("llm_fallback_depth_sum") == pytest.approx(before_sum + 3.0)

    def test_various_depths(self):
        """Depth 1, 2, 3, 4, 5 are all valid values."""
        for d in range(1, 6):
            observe_fallback_depth(d)

        assert _sample("llm_fallback_depth_count") >= 5.0


# ── Multi-model independence ───────────────────────────────────────────────────


class TestMultipleModels:
    """Independent metric counters for different model names."""

    def test_three_models(self):
        models = [_uname("m1"), _uname("m2"), _uname("m3")]
        for m in models:
            observe_llm_call(m, "success", 0.3, prompt_tokens=200, completion_tokens=100)

        for m in models:
            assert (
                _sample("llm_requests_total", {"model": m, "status": "success"})
                == 1.0
            )
            assert _sample("llm_latency_seconds_count", {"model": m}) == 1.0
            assert (
                _sample("llm_tokens_total_count", {"model": m, "type": "prompt"})
                == 1.0
            )

    def test_mixed_success_error(self):
        """Same model can have both success and error counters."""
        model = _uname("mix")
        observe_llm_call(model, "success", 0.3)
        observe_llm_call(model, "error", 2.0, error_type="RateLimitError")

        assert (
            _sample("llm_requests_total", {"model": model, "status": "success"})
            == 1.0
        )
        assert (
            _sample("llm_requests_total", {"model": model, "status": "error"})
            == 1.0
        )
        assert (
            _sample(
                "llm_errors_total",
                {"model": model, "error_type": "RateLimitError"},
            )
            == 1.0
        )


# ── Idempotency ────────────────────────────────────────────────────────────────


class TestEnsureMetricsIdempotent:
    """Calling _ensure_metrics multiple times does not duplicate or crash."""

    def test_called_twice(self):
        _ensure_metrics()  # first call (no-op after import)
        _ensure_metrics()  # second call — must not fail or raise
        assert True

    def test_called_after_observations(self):
        """_ensure_metrics after observations should still be safe."""
        m = _uname("idempotent")
        observe_llm_call(m, "success", 0.1)
        _ensure_metrics()
        assert (
            _sample("llm_requests_total", {"model": m, "status": "success"})
            == 1.0
        )
