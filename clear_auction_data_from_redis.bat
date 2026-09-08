@echo off
setlocal
cd /d "%~dp0"
docker compose exec -T redis sh -ec "redis-cli --scan --pattern 'auctionLog*' | while IFS= read -r key; do redis-cli DEL \"$key\" > /dev/null; done"
if errorlevel 1 exit /b %errorlevel%
echo Parsed Auction Data cleared from Redis cache