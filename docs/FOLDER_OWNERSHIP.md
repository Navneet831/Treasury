# Folder Responsibility Map

## Root Directory
- `start_app.bat`: Entry point for launching the entire system.
- `warehouse.duckdb`: Primary data source (DuckDB database).
- `skill.md`: Audit of all formulas and business logic.
- `ARCHITECTURE.md`: High-level system design.

## Backend (`/backend`)
- `main.py`: **API Orchestrator**. Handles HTTP routing, static file serving, and environment configuration.
- `datalogic.py`: **Business Logic Core**. Owns all SQL queries and formula implementations.
- `database.py`: **Connectivity Layer**. Manages database connections and low-level fetch operations.

## Frontend (`/frontend`)
- `src/App.tsx`: **Module Orchestrator**. Uses lazy loading to sandbox domain modules.
- `src/api.ts`: **Network Interface**. Centralized Axios client for backend communication.
- `src/domains/`: **Functional Islands**.
    - `/executive`: Executive Overview, Strategic Intelligence, Quant models.
    - `/lc`: LC Exposure, BOE Analytics, Lifecycle tracking.
    - `/sblc`: SBLC specific exposure and tracking.
    - `/fx`: Currency exposure and hedging analytics.
    - `/payables`: Forecasts and supplier risk.
    - `/calendar`: Visual payment scheduling.
    - `/fd`: Fixed Deposit and working capital lock analysis.
    - `/utilization`: Bank-wise limit monitoring.
- `src/shared/`: **Cross-Cutting Concerns**.
    - `DomainSandbox.tsx`: Error boundary and loading state wrapper for modules.
    - `utils.ts`: Shared formatting and calculation helpers.
