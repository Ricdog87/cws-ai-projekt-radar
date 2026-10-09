@echo off
rem Starts the CWS AI Project Radar at http://localhost:8765
rem Keep this window open while you use the radar. Stop: Ctrl+C or close the window.
cd /d "%~dp0"
title CWS AI Project Radar - http://localhost:8765

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
if %errorlevel%==0 goto :eof

echo.
echo PowerShell start did not work. Trying Python ...
where python >nul 2>nul
if errorlevel 1 goto :nopython
echo Radar is running at http://localhost:8765  (stop: Ctrl+C)
start "" http://localhost:8765/index.html
python -m http.server 8765 --bind 127.0.0.1 --directory "%~dp0."
goto :eof

:nopython
echo.
echo No Python found. Alternatives:
echo   1) Open index.html directly by double-clicking (always works)
echo   2) Send a screenshot of this window to Claude
echo.
pause
