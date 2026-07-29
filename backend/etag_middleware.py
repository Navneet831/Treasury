"""ETag middleware for FastAPI — HTTP-level response caching.

Adds an ETag header to every JSON response (SHA-256 of the body).
On subsequent requests with If-None-Match, returns 304 Not Modified
with zero body. Works alongside Redis/in-memory caching — ETags save
the serialization + network transfer cost even for cache hits.

Usage (in run_standalone.py):
    from etag_middleware import ETagMiddleware
    app.add_middleware(ETagMiddleware)
"""

import hashlib
from typing import Callable, List
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class ETagMiddleware(BaseHTTPMiddleware):
    """Computes ETag = SHA-256 of response body.

    Skips streaming responses and non-200/304 status codes.
    When the client sends If-None-Match matching the current ETag,
    returns 304 Not Modified with the same ETag and zero body.
    """

    # Endpoints that should NEVER be cached (always return full body)
    _NO_CACHE_PATHS: List[str] = [
        "/metrics",
        "/health",
        "/db-config",
    ]

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response: Response = await call_next(request)

        # Only cache JSON 200 responses for GET/HEAD
        if request.method not in ("GET", "HEAD"):
            return response
        if response.status_code not in (200, 304):
            return response
        if response.headers.get("content-type", "").startswith("text/html"):
            return response

        # Skip no-cache endpoints
        if request.url.path in self._NO_CACHE_PATHS:
            return response

        # Compute ETag from response body
        body = b""
        async for chunk in response.body_iterator:
            body += chunk

        etag = f'W/"{hashlib.sha256(body).hexdigest()}"'
        response.headers["ETag"] = etag

        # Honour conditional request
        if_none_match = request.headers.get("if-none-match")
        if if_none_match and if_none_match.strip('" ') == etag.strip('W/"'):
            # Return 304 with original headers but EMPTY body
            return Response(
                status_code=304,
                headers={k: v for k, v in response.headers.items() if k.lower() not in ("content-length", "content-encoding")},
                media_type=response.media_type,
            )

        return Response(
            content=body,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type,
        )
