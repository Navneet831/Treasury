import sys
import os
import types

# Mock packages for the monorepo structure
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

apps = types.ModuleType('apps')
apps.__path__ = []
sys.modules['apps'] = apps

treasury = types.ModuleType('apps.Treasury')
treasury.__path__ = [root_dir]
sys.modules['apps.Treasury'] = treasury

pkgs = types.ModuleType('packages')
pkgs.__path__ = []
sys.modules['packages'] = pkgs

contracts = types.ModuleType('packages.contracts')
sys.modules['packages.contracts'] = contracts
contracts.IRepository = type('IRepository', (object,), {})
contracts.PlatformModule = type('PlatformModule', (object,), {})

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apps.Treasury.backend.main import router

app = FastAPI(title="Treasury Serverless Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/treasury")
