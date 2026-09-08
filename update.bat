@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0assert-sqlite-ready.ps1"
if errorlevel 1 exit /b %errorlevel%
docker compose pull
if errorlevel 1 exit /b %errorlevel%
docker compose up -d
if errorlevel 1 exit /b %errorlevel%
docker compose ps
