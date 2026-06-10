# Treasury Control Tower Architecture

## Overview
The Treasury Control Tower is built on a **Modular Domain Isolation Architecture**. It follows a Micro-frontend pattern on the frontend and a centralized Data-Logic pattern on the backend.

## Backend Architecture
- **API Layer (`main.py`)**: Slim FastAPI endpoints that delegate all business logic to the Data Logic layer.
- **Data Logic Layer (`datalogic.py`)**: Centralized repository of all SQL queries, business formulas, and data processing.
- **Database Layer (`database.py`)**: Interface for DuckDB/PostgreSQL connectivity.
- **Domain Isolation**: Each major feature (LC, SBLC, FX, BG, etc.) has dedicated functions in `datalogic.py` and dedicated endpoints.

## Frontend Architecture
- **Domain-Driven Design**: The `src/domains/` folder is split into functional domains (executive, lc, sblc, fx, etc.).
- **Sandboxing**: Each domain module is lazy-loaded using `React.lazy` and wrapped in a `DomainSandbox` component.
- **Error Boundaries**: Failure in one module (e.g., FX exposure) does not crash the entire application; only that specific widget or page is affected.
- **Shared Components**: Common UI elements (Header, Sidebar, KPI cards) are kept in `src/components/` and `src/shared/`.

## Data Flow
1. User interacts with a specific domain component (e.g., `ExecutiveOverview`).
2. Component triggers a lazy-load of its own logic.
3. Component calls a specific domain API endpoint.
4. Backend executes optimized SQL queries against `warehouse.duckdb`.
5. Data is processed through the formulas defined in `skill.md`.
6. Result is returned as JSON and rendered in the isolated UI module.
