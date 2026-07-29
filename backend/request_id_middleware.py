"""Request ID and Correlation ID middleware.

Generates:
- `X-Request-ID` — unique per request (uuid4). Added to every response.
- `X-Correlation-ID` — propagated from frontend or generated. Stays the same
  across frontend → API → downstream calls so you can trace a user action end-to-end.

FastAPI middleware runs on every request. Adds IDs to the request state and
response headers. Also logs every request with its IDs for Loki/OpenTelemetry correlation.
"""

import uuid
import logging
import time
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Middleware that assigns X-Request-ID and X-Correlation-ID to every request."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # ── Generate or propagate Correlation ID ────────────────────────────
        correlation_id = request.headers.get("X-Correlation-ID", "")
        if not correlation_id:
            correlation_id = str(uuid.uuid4())

        # ── Generate unique Request ID ──────────────────────────────────────
        request_id = str(uuid.uuid4())

        # ── Attach to request state for use in route handlers ───────────────
        request.state.request_id = request_id
        request.state.correlation_id = correlation_id
        request.state.start_time = time.time()

        # ── Log the incoming request with IDs ───────────────────────────────
        logger.info(
            "[%s] [%s] %s %s — %s",
            request_id[:8],
            correlation_id[:8],
            request.method,
            request.url.path,
            request.client.host if request.client else "unknown",
        )

        # ── Process the request ─────────────────────────────────────────────
        start = time.time()
        response = await call_next(request)
        elapsed_ms = round((time.time() - start) * 1000, 1)

        # ── Inject IDs into response headers ────────────────────────────────
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Correlation-ID"] = correlation_id
        response.headers["X-Response-Time-Ms"] = str(elapsed_ms)

        # ── Log the response ────────────────────────────────────────────────
        logger.info(
            "[%s] [%s] %s %s → %s (%sms)",
            request_id[:8],
            correlation_id[:8],
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )

        return response
