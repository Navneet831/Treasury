from fastapi import APIRouter
from typing import Dict, Any, List
from packages.contracts import PlatformModule, IRepository
import apps.Treasury.backend.main as main_api

class TreasuryModule(PlatformModule):
    def __init__(self):
        super().__init__()
        self.name = "treasury"
        self.version = "1.1.0"
        self.dependencies = ["core >= 1.0.0"]
        self.permissions = ["treasury:read", "treasury:write"]
        self.services = {}

    def initialize(self, services: Dict[str, Any]):
        self.services = services
        
        # Inject platform services into Treasury's internal database layer.
        # It configures the PostgreSQL repository.
        from apps.Treasury.backend.database import set_platform_repo
        
        pg_manager = services.get("pg_db")
        
        if pg_manager is not None:
            from apps.Treasury.backend.database import PostgreSQLRepository
            # pg_manager.database_url holds the connection string
            repo = PostgreSQLRepository(pg_manager.database_url)
            set_platform_repo(repo)
        
        self.audit = services.get("audit")
        self.agent = services.get("agent")
        self.graph = services.get("knowledge")

    def get_router(self) -> APIRouter:
        return main_api.router

    def check_health(self) -> Dict[str, Any]:
        health = super().check_health()
        # Add treasury-specific DB check here if needed
        return health

# Export an instance for the loader
module = TreasuryModule()
