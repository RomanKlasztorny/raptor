@echo off
echo Запускаю РАПТОР...
start /min "LLM Proxy" cmd /c "node "%~dp0llm-proxy.js""
start /min "RAPTOR Server" cmd /c "npx serve "%~dp0" -p 5500"
timeout /t 2 /nobreak >nul
start http://localhost:5500
