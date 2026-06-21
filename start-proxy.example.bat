@echo off
:: Скопируй этот файл в start-proxy.bat и вставь свой GitHub токен
:: Получить токен: github.com → Settings → Developer settings → Personal access tokens
:: Нужен GitHub Copilot (есть бесплатный план)

SET GH_TOKEN=paste_your_github_token_here
node "%~dp0copilot-proxy.js"
pause
