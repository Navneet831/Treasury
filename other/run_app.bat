@echo off
set DB_PATH=D:\GrewAnalytics\warehouse.duckdb

echo ========================================
echo     LC Analytics Command Center
echo ========================================
echo.

:: Ensure the app-specific tables exist in the DB
echo Step 1: Syncing application configuration to database...
python seed_app_data.py
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to seed application data. Check your Python environment.
    pause
    exit /b %ERRORLEVEL%
)
echo.

:: Start the Backend
echo Step 2: Starting FastAPI Backend...
start "LC_BACKEND" /D backend cmd /c "set DB_PATH=%DB_PATH% && python -m uvicorn main:app --host 0.0.0.0 --port 8000"

:: Start the Frontend
echo Step 3: Starting React Frontend...
start "LC_FRONTEND" /D frontend cmd /c "npm run dev"

echo.
echo ----------------------------------------
echo Application is launching!
echo ----------------------------------------
echo Backend API: http://localhost:8000
echo Dashboard:   http://localhost:5173
echo ----------------------------------------
echo.
echo Note: You can close this window. Backend and Frontend will keep running in their own windows.
echo.
pause
