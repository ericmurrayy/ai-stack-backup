@echo off
title Murray FSM - Web Dashboard
cd /d "D:\ai-stack-backup-claude-fsm-offline-first-build-8Ux6s\ai-stack-backup-claude-fsm-offline-first-build-8Ux6s\murray-fsm"
echo.
echo ========================================
echo   Murray FSM - Starting Web Dashboard
echo ========================================
echo.

REM Kill any existing node processes on ports 3000-3003 to ensure clean start
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING"') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001.*LISTENING"') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3002.*LISTENING"') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3003.*LISTENING"') do taskkill /F /PID %%a 2>nul

timeout /t 2 /nobreak >nul

echo Starting dev server at http://localhost:3000
echo.
echo Opening browser in 5 seconds...
timeout /t 5 /nobreak >nul
start "" "http://localhost:3000"
echo.
echo Press Ctrl+C to stop the server
echo.
call "C:\Users\ericm\AppData\Roaming\npm\pnpm.cmd" dev:web
pause
