@echo off
echo Starting LLM proxy on :8966 (OpenAI / Anthropic / Groq via VPN)...
node "%~dp0llm-proxy.js"
pause
