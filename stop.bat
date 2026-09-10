@echo off
setlocal
cd /d "%~dp0"
docker compose stop
if errorlevel 1 exit /b %errorlevel%
docker compose ps -a
