@echo off
title Vedanjay Power - Outbound Lead Discovery System
echo ===================================================
echo  Starting Vedanjay Power Outbound Lead Discovery
echo ===================================================
echo [1/2] Starting Backend API Server on http://localhost:5000 ...
start "Vedanjay Backend API" cmd /k "cd /d %~dp0backend && node src/server.js"

echo [2/2] Starting Frontend Web Dashboard on http://localhost:3000 ...
start "Vedanjay Frontend Dashboard" cmd /k "cd /d %~dp0frontend && npm run dev"

echo ===================================================
echo  Both services launched!
echo  Dashboard: http://localhost:3000/
echo  Backend:   http://localhost:5000/api/v1/health
echo ===================================================
timeout /t 3
start http://localhost:3000/
