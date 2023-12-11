@echo off
REM Setting the Redis container name
SET REDIS_CONTAINER=redis

REM Deleting keys with a specific prefix in Redis
docker exec %REDIS_CONTAINER% sh -c "redis-cli --scan --pattern 'auctionLog*' | while read key; do redis-cli DEL \"$key\"; done"

echo Parsed Auction Data cleared from Redis cache