import os
import sys
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

if __name__ == "__main__":
    from dotenv import load_dotenv
    # Load environment variables. Load from parent directories first so closer files can override.
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
    uvicorn.run(app, host=host, port=port)

