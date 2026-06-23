@echo off
echo Запускаю РАПТОР...
start /min "Copilot Proxy" cmd /c "node "%~dp0copilot-proxy.js""
start /min "RAPTOR Server" cmd /c "npx serve "%~dp0" -p 5500"
timeout /t 2 /nobreak >nul
start http://localhost:5500
