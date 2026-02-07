@echo off
echo Starting Murray's FSM Development Server...
echo.
cd /d "D:\murrayfsm\ai-stack-backup-claude-fsm-offline-first-build-8Ux6s\murray-fsm"
call "%USERPROFILE%\AppData\Roaming\npm\pnpm.cmd" dev:web
pause
