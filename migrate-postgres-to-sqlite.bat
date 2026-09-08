@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0migrate-postgres-to-sqlite.ps1" %*
exit /b %errorlevel%
