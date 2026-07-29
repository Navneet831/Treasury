@echo off
setlocal enabledelayedexpansion
title Treasury Control Tower
color 0B

echo =====================================================================
echo        TREASURY CONTROL TOWER + TRADE FINANCE COMMAND CENTER
echo =====================================================================
echo.

:: -- Prerequisites ---------------------------------------------------
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    pause
    exit /b
)
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed.
    pause
    exit /b
)

:: -- Config ----------------------------------------------------------
set FRONTEND_PORT=8000
set BACKEND_PORT=8002

:: Load .env
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

:: Resolve ports now (to avoid delayed expansion issues later)
set FP=%FRONTEND_PORT%
set BP=%BACKEND_PORT%

echo [INFO] Frontend : http://127.0.0.1:%FP%
echo [INFO] Backend  : http://127.0.0.1:%BP%
echo.

:: -- Kill old processes ----------------------------------------------
echo [1/3] Cleaning up old processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%FP%') do (
    if not "%%a"=="0" (
        taskkill /F /PID %%a >nul 2>nul
    )
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%BP%') do (
    if not "%%a"=="0" (
        taskkill /F /PID %%a >nul 2>nul
    )
)
timeout /t 1 /nobreak >nul

:: -- Backend ---------------------------------------------------------
echo [2/3] Starting Backend Services...
cd /d "%~dp0backend"
if not exist ".env" (
    if exist "%~dp0.env" copy "%~dp0.env" ".env" >nul
)
start "Treasury Backend" /min cmd /c "cd /d "%~dp0backend" && set NO_WINDOW=true && python run_standalone.py"
cd /d "%~dp0"
timeout /t 4 /nobreak >nul

:: -- Frontend --------------------------------------------------------
echo [3/3] Starting Frontend Interface...
cd /d "%~dp0frontend"
if not exist "node_modules\" (
    echo [INFO] Installing frontend dependencies...
    call npm install --silent
)

echo.
echo =====================================================================
echo    SYSTEM ACTIVE - Open http://127.0.0.1:%FP%
echo =====================================================================
echo.

npx vite --port %FP%

pause
