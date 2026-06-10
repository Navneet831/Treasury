import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from packages.core import DuckDBManager, AuthService, settings
from apps.Treasury.backend.module import module

app = FastAPI(title="Treasury Module - Standalone")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize module with local development services
services = {
    "db": DuckDBManager(db_path=settings.DUCKDB_PATH, read_only=True),
    "auth": AuthService(secret=settings.JWT_SECRET),
    "config": settings
}

module.initialize(services)
app.include_router(module.get_router())

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002)
