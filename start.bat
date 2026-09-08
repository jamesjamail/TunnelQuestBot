@echo off
setlocal
cd /d "%~dp0"
docker compose up -d
if errorlevel 1 exit /b %errorlevel%
docker compose ps
