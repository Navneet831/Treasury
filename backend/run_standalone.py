import os
import sys
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Add the GrewAnalytics root to sys.path to support 'apps.Treasury...' imports
current_dir = os.path.dirname(os.path.abspath(__file__))
grew_analytics_root = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
if grew_analytics_root not in sys.path:
    sys.path.insert(0, grew_analytics_root)

# Import the router after setting up the path
try:
    from apps.Treasury.backend.main import router
except ImportError as e:
    print(f"Error importing apps.Treasury.backend.main: {e}")
    # Fallback to local import if the above fails
    from main import router

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
    uvicorn.run(app, host="127.0.0.1", port=8001)
