@echo off
setlocal
cd /d "%~dp0app"
"%~dp0runtime\node.exe" server.cjs
echo.
echo App stopped. Press any key to close this window.
pause >nul
