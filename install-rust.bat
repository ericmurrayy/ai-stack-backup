@echo off
echo.
echo =============================================
echo  Murray's FSM - Install Rust for Desktop App
echo =============================================
echo.
echo This will download and install Rust, which is needed
echo to build the Tauri desktop application.
echo.
echo Press any key to open the Rust installer download page...
pause >nul
start https://rustup.rs
echo.
echo After installing Rust:
echo 1. Close and reopen your terminal
echo 2. Run: rustc --version
echo 3. Then run: npm run tauri:build (in apps/web folder)
echo.
pause
