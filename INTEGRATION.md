# Treasury Module: Integration Review

## Current State
- **Status**: Implemented with FastAPI backend and React frontend.
- **Backend**: FastAPI, DuckDB, Pandas.
- **Frontend**: React (TS), Tailwind, AG Grid, Recharts.

## Recommended Tech Stack (Unified)
- **Backend**: Replace **Pandas** with **Polars** to match the Revenue and DBquery performance standards.
- **Frontend**: React 19 + Tailwind CSS 4.x (Upgrade from Tailwind 3/PostCSS if necessary).
- **Data Engine**: DuckDB for analytical SQL.

## Integration Roadmap & Improvements
1. **Tech Debt**: Migrate all data processing logic from Pandas to Polars. This will significantly reduce memory overhead and improve scalability.
2. **State Management**: Consolidate Zustand stores with the main app's state management strategy.
3. **UI Alignment**: Ensure AG Grid themes and configurations match the DBquery and Inventory modules. Use the shared `lucide-react` icons.
4. **Monitoring**: Standardize the Prometheus instrumentation with the Revenue module for unified platform health tracking.
5. **Data Enrichment**: Link Treasury cash positions with Revenue's "Leakage Ratio" to provide a holistic view of capital risk.
