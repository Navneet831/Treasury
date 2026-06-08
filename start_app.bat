@echo off
title Treasury Command Startup

echo ===================================================
echo Starting Treasury Command (Backend + Frontend)
echo ===================================================
echo.

:: Start Backend
echo [1/2] Starting FastAPI Backend on port 8080...
start cmd /c "cd backend && uvicorn main:app --port 8080 --reload"

:: Start Frontend
echo [2/2] Starting Vite Frontend on port 5173...
start cmd /c "cd frontend && npm run dev"

echo.
echo ===================================================
echo Services are starting in separate windows.
echo Frontend will be available at: http://localhost:5173
echo Backend API will be available at: http://localhost:8080
echo ===================================================
pause