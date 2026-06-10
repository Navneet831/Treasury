@echo off
title Treasury Control Tower Startup
color 0B

echo ======================================================================
echo           TREASURY CONTROL TOWER + TRADE FINANCE COMMAND CENTER
echo ======================================================================
echo.
echo [INFO] Initializing system components...
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install it to run the frontend.
    pause
    exit /b
)

:: Check for Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed. Please install it to run the backend.
    pause
    exit /b
)

:: Set Environment
set PY_CMD=python
set PORT=8001
set HOST=127.0.0.1
set NO_WINDOW=true

echo [1/3] Checking Backend Dependencies...
cd backend
%PY_CMD% -m pip install -r requirements.txt --quiet
if %errorlevel% neq 0 (
    echo [WARNING] Failed to verify/install python requirements. Attempting to start anyway...
)
cd ..

echo [2/3] Starting Backend Services (Headless)...
echo [LINK] API Documentation: http://%HOST%:%PORT%/docs
start "Treasury Backend" /min cmd /c "cd backend && set NO_WINDOW=true && %PY_CMD% run_standalone.py"

:: Wait for backend to initialize
timeout /t 3 /nobreak >nul

echo [3/3] Starting Frontend Interface...
cd frontend
if not exist "node_modules\" (
    echo [INFO] node_modules not found. Installing dependencies...
    call npm install --silent
)
echo [LINK] Web Dashboard: http://localhost:5175
echo.
echo ======================================================================
echo SYSTEM IS ACTIVE
echo ======================================================================
echo.
echo [URL] http://localhost:5175
echo.

:: Start Vite Dev Server
npm run dev

pause
