import os
import sys
import uvicorn
import uuid
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

# Windows consoles default to cp1252 — reconfigure so log output with unicode
# never crashes request handling (same guard as the platform shell's main.py).
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Add the GrewAnalytics root to sys.path to support 'apps.Treasury...' imports
current_dir = os.path.dirname(os.path.abspath(__file__))
grew_analytics_root = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
if grew_analytics_root not in sys.path:
    sys.path.insert(0, grew_analytics_root)

# Mock modules for monorepo compatibility
import types
if 'apps' not in sys.modules:
    apps = types.ModuleType('apps')
    apps.__path__ = []
    sys.modules['apps'] = apps

if 'apps.Treasury' not in sys.modules:
    treasury = types.ModuleType('apps.Treasury')
    treasury.__path__ = [os.path.dirname(current_dir)]
    sys.modules['apps.Treasury'] = treasury

if 'packages' not in sys.modules:
    pkgs = types.ModuleType('packages')
    pkgs.__path__ = []
    sys.modules['packages'] = pkgs

if 'packages.contracts' not in sys.modules:
    contracts = types.ModuleType('packages.contracts')
    sys.modules['packages.contracts'] = contracts
    contracts.IRepository = type('IRepository', (object,), {})
    contracts.PlatformModule = type('PlatformModule', (object,), {})

# Import the router after setting up the path
from apps.Treasury.backend.main import router

app = FastAPI(title="Treasury Control Tower Backend")

# ── Middleware Order (innermost → outermost) ─────────────────────────────────────
# GZip → ETag → RequestID → CORS (gzip compresses response, ETag hashes compressed,
# RequestID adds trace headers, CORS runs outermost for preflight handling)

# 1. GZip compression — compresses all JSON responses >500 bytes (saves ~80% on wire)
app.add_middleware(GZipMiddleware, minimum_size=500)

# 2. ETag — HTTP-level caching (304 Not Modified on re-request)
from etag_middleware import ETagMiddleware
app.add_middleware(ETagMiddleware)

# 3. Request ID / Correlation ID
from request_id_middleware import RequestIDMiddleware
app.add_middleware(RequestIDMiddleware)

# 4. CORS — cross-origin for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Prometheus Metrics ──────────────────────────────────────────────────────────
from prometheus_fastapi_instrumentator import Instrumentator

prometheus_instrumentator = Instrumentator(
    should_group_status_codes=True,
    should_ignore_untemplated=False,
)
prometheus_instrumentator.instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

# ── Sentry (error monitoring) ──────────────────────────────────────────────────
sentry_dsn = os.getenv("SENTRY_DSN")
if sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration

    sentry_sdk.init(
        dsn=sentry_dsn,
        environment=os.getenv("APP_ENV", "development"),
        traces_sample_rate=0.2,
        profiles_sample_rate=0.2,
        integrations=[
            FastApiIntegration(),
            LoggingIntegration(level=None, event_level=None),
        ],
    )

# ── LLM Metrics (eager registration so /metrics shows them immediately) ─────────
try:
    import apps.Treasury.backend.llm_metrics  # noqa: F401 — registers Prometheus counters/histograms
except Exception:
    pass

# ── Health / Readiness / Liveness endpoints ─────────────────────────────────────
from apps.Treasury.backend.services.health import liveness, readiness, health

@app.get("/live", tags=["Health"])
async def live_endpoint():
    """Liveness probe — process is alive. No DB check."""
    return liveness()

@app.get("/ready", tags=["Health"])
async def ready_endpoint():
    """Readiness probe — DB is reachable. Returns 503 if not."""
    result = readiness()
    status_code = 200 if result["status"] == "ready" else 503
    return JSONResponse(content=result, status_code=status_code)

@app.get("/health", tags=["Health"])
async def health_endpoint():
    """Full dependency health — DB, Redis, Sentry, uptime."""
    return health()

# ── OpenTelemetry (if configured) ──────────────────────────────────────────────
_otel_tp = None
try:
    from otel_setup import setup_opentelemetry, instrument_fastapi
    _otel_tp = setup_opentelemetry(service_name="treasury-backend", service_version="0.1.0")
    if _otel_tp:
        instrument_fastapi(app, _otel_tp)
except Exception as e:
    print(f"[INFO] OpenTelemetry not configured: {e}")

app.include_router(router)

if __name__ == "__main__":
    from dotenv import load_dotenv
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    treasury_dir = os.path.dirname(backend_dir)
    grew_analytics_root = os.path.dirname(os.path.dirname(treasury_dir))

    for path in [grew_analytics_root, treasury_dir, backend_dir]:
        env_file = os.path.join(path, '.env')
        if os.path.exists(env_file):
            load_dotenv(dotenv_path=env_file, override=True)

    host = os.getenv("BACKEND_HOST", "127.0.0.1")
    port = int(os.getenv("BACKEND_PORT", "8002"))

    print(f"[INFO] Starting Treasury Backend on http://{host}:{port}")
    print(f"[INFO] Prometheus metrics: http://{host}:{port}/metrics")
    print(f"[INFO] GZip compression: enabled (min 500 bytes)")
    print(f"[INFO] ETag caching: enabled")
    print(f"[INFO] Sentry: {'enabled' if sentry_dsn else 'disabled (set SENTRY_DSN in .env)'}")
    uvicorn.run(app, host=host, port=port)
