# Project Context

## Running
- Frontend: Vite+React 19 on :8000 (PID 6888)
- Backend: FastAPI on :8002 (PID 17144)
- PostgreSQL: 80.225.203.238:5432 — UNREACHABLE (network issue)

## Bugs Fixed
1. `start.bat` — Delayed expansion (!FRONTEND_PORT!), encoding, working dir
2. `LimitUtilization.tsx` L1087 — `utilData?.margin_bank_pivot` null guard

## Pending
- **User still sees**: `Cannot read properties of null (reading 'margin_bank_pivot')`
- Fix IS applied (`utilData?.margin_bank_pivot` on line 1087)
- Likely causes: browser cache / Vite HMR didn't reload / another reference missed
- Need to: hard-refresh browser, check `grep` for extra references, verify Vite HMR

## How to Start
```
start.bat
```
