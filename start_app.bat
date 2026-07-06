@echo off
setlocal enabledelayedexpansion
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

:: Set Default Environment Variables
set PY_CMD=python
set FRONTEND_HOST=127.0.0.1
set FRONTEND_PORT=8001
set BACKEND_HOST=127.0.0.1
set BACKEND_PORT=8002
set NO_WINDOW=true

:: Load from .env if exists
if exist ".env" (
    for /f "usebackq tokens=1,2 delims==" %%A in (".env") do (
        set "KEY=%%A"
        set "VAL=%%B"
        if not "!KEY!"=="" (
            set "first=!KEY:~0,1!"
            if not "!first!"=="#" (
                set "!KEY!=!VAL!"
            )
        )
    )
)


echo [1/3] Checking Backend Dependencies...
cd backend
%PY_CMD% -m pip install -r requirements.txt --quiet
if %errorlevel% neq 0 (
    echo [WARNING] Failed to verify/install python requirements. Attempting to start anyway...
)
cd ..

echo [2/3] Starting Backend Services (Headless)...
set PRINT_BACK_HOST=!BACKEND_HOST!
if "!PRINT_BACK_HOST!"=="0.0.0.0" set PRINT_BACK_HOST=127.0.0.1
echo [LINK] API Documentation: http://!PRINT_BACK_HOST!:!BACKEND_PORT!/docs
start "Treasury Backend" /min cmd /c "cd backend && set NO_WINDOW=true && !PY_CMD! run_standalone.py"

:: Wait for backend to initialize
timeout /t 3 /nobreak >nul

echo [3/3] Starting Frontend Interface...
cd frontend
if not exist "node_modules\" (
    echo [INFO] node_modules not found. Installing dependencies...
    call npm install --silent
)
set PRINT_FRONT_HOST=!FRONTEND_HOST!
if "!PRINT_FRONT_HOST!"=="0.0.0.0" set PRINT_FRONT_HOST=127.0.0.1
echo [LINK] Web Dashboard: http://!PRINT_FRONT_HOST!:!FRONTEND_PORT!
echo.
echo ======================================================================
echo SYSTEM IS ACTIVE (Listening on all network interfaces)
echo ======================================================================
echo.
echo Local URL:   http://!PRINT_FRONT_HOST!:!FRONTEND_PORT!
echo Network URL: http://[Your-System-IP]:!FRONTEND_PORT!
echo.

:: Start Vite Dev Server
npm run dev


pause
