@echo off
title Murray's FSM - Field Service Management
color 0B

echo.
echo  ======================================
echo   Murray's Garage Door Services - FSM
echo   Field Service Management System
echo  ======================================
echo.
echo  Starting Murray's FSM Dashboard...
echo.

:: Check if pnpm is available
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo  [INFO] Adding npm global to PATH...
    set "PATH=%PATH%;%APPDATA%\npm"
)

:: Navigate to project
cd /d "D:\murray-fsm"

:: Check if node_modules exist
if not exist "node_modules" (
    echo  [SETUP] Installing dependencies...
    call pnpm install
)

:: Start the dev server and open browser
echo  [START] Launching web dashboard...
echo.
echo  Dashboard will open at: http://localhost:3000
echo  (or next available port)
echo.
echo  Press Ctrl+C to stop the server.
echo.

:: Open browser after a short delay
start "" /b cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:3000"

:: Start the dev server
call pnpm dev:web
