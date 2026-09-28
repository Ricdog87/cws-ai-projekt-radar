@echo off
rem Startet das CWS AI Projekt-Radar auf http://localhost:8765
rem Dieses Fenster offen lassen, solange du das Radar nutzt. Beenden: Strg+C oder Fenster schliessen.
cd /d "%~dp0"
title CWS AI Projekt-Radar - http://localhost:8765

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
if %errorlevel%==0 goto :eof

echo.
echo PowerShell-Start hat nicht funktioniert. Versuche es mit Python ...
where python >nul 2>nul
if errorlevel 1 goto :nopython
echo Radar laeuft auf http://localhost:8765  (Beenden: Strg+C)
start "" http://localhost:8765/index.html
python -m http.server 8765 --bind 127.0.0.1 --directory app
goto :eof

:nopython
echo.
echo Kein Python gefunden. Alternativen:
echo   1) app\index.html direkt per Doppelklick oeffnen (funktioniert immer)
echo   2) Screenshot dieses Fensters an Claude schicken
echo.
pause
