@echo off
echo Запускаю РАПТОР...
start /min "Copilot Proxy" cmd /c "start-proxy.bat"
start /min "RAPTOR Server" cmd /c "npx serve "%~dp0" -p 5500"
timeout /t 2 /nobreak >nul
start http://localhost:5500
