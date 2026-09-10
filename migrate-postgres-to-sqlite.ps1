#requires -Version 5.1

param(
    [switch]$Force,
    [string]$BackupDirectory = (Join-Path $env:USERPROFILE 'TunnelQuestBot-backups')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$migrationCompose = @(
    '-f', 'docker-compose.yml',
    '-f', 'docker-compose.postgres-migration.yml'
)
$sourceVariableSet = $false
$botStopped = $false
$backupPath = $null
$environmentBackupPath = $null
$temporaryEnv = $null
$environmentSwitched = $false
$postgresStopped = $false
$sqliteActivated = $false

function Assert-LastExitCode([string]$Action) {
    if ($LASTEXITCODE -ne 0) {
        throw "$Action failed with exit code $LASTEXITCODE"
    }
}

function Wait-ForPostgres {
    $deadline = (Get-Date).AddMinutes(2)
    while ((Get-Date) -lt $deadline) {
        $health = docker inspect postgres --format '{{.State.Health.Status}}' 2>$null
        if ($LASTEXITCODE -eq 0 -and $health.Trim() -eq 'healthy') {
            return
        }
        Start-Sleep -Seconds 2
    }
    throw 'PostgreSQL did not become healthy within two minutes'
}

function Get-PostgresCounts([hashtable]$PostgresEnvironment) {
    $query = @'
SELECT json_build_object(
  'User', (SELECT count(*) FROM public."User"),
  'Watch', (SELECT count(*) FROM public."Watch"),
  'BlockedPlayer', (SELECT count(*) FROM public."BlockedPlayer"),
  'BlockedPlayerByWatch', (SELECT count(*) FROM public."BlockedPlayerByWatch"),
  'PlayerLink', (SELECT count(*) FROM public."PlayerLink")
)::text;
'@
    $output = (
        $query |
            docker exec -i postgres psql `
                -U $PostgresEnvironment.POSTGRES_USER `
                -d $PostgresEnvironment.POSTGRES_DB -At |
            Out-String
    ).Trim()
    Assert-LastExitCode 'PostgreSQL row-count query'
    try {
        $counts = $output | ConvertFrom-Json
    } catch {
        throw 'PostgreSQL returned an invalid row-count result'
    }
    Write-Host "PostgreSQL counts: $output"
    return $counts
}

function Test-SqliteImport {
    $verification = @'
const Database = require('better-sqlite3');
const db = new Database('/data/tunnelquestbot.db', { readonly: true });
const tables = ['User', 'Watch', 'BlockedPlayer', 'BlockedPlayerByWatch', 'PlayerLink'];
const counts = Object.fromEntries(
  tables.map((table) => [
    table,
    db.prepare(`SELECT count(*) AS count FROM [${table}]`).get().count,
  ]),
);
const marker = db
  .prepare('SELECT count(*) AS count FROM DataMigration WHERE name = ?')
  .get('postgres-to-sqlite-v1').count;
const foreignKeyFailures = db.pragma('foreign_key_check').length;
const integrity = db.pragma('quick_check', { simple: true });
db.close();
console.log(JSON.stringify({ counts, marker, foreignKeyFailures, integrity }));
if (marker !== 1 || foreignKeyFailures !== 0 || integrity !== 'ok') process.exit(1);
'@
    # Use the persistent volume without starting the bot or its dependencies.
    $output = (
        $verification |
            docker compose run --rm --no-deps -T --entrypoint node tunnelquestbot |
            Out-String
    ).Trim()
    Assert-LastExitCode 'SQLite verification'
    try {
        $state = $output | ConvertFrom-Json
    } catch {
        throw 'SQLite returned an invalid verification result'
    }
    Write-Host "SQLite verification: $output"
    return $state
}

function Compare-RowCounts([object]$PostgresCounts, [object]$SqliteCounts) {
    foreach ($table in @('User', 'Watch', 'BlockedPlayer', 'BlockedPlayerByWatch', 'PlayerLink')) {
        $source = [Int64]$PostgresCounts.$table
        $target = [Int64]$SqliteCounts.$table
        if ($source -ne $target) {
            throw "Row-count mismatch for $table (PostgreSQL=$source, SQLite=$target)"
        }
    }
    Write-Host 'PostgreSQL and SQLite row counts match.'
}

try {
    if (-not (Test-Path '.env')) {
        throw 'Missing .env in the deployment directory'
    }

    docker compose version | Out-Host
    Assert-LastExitCode 'Docker Compose preflight'

    $envPath = (Resolve-Path '.env').Path
    $envText = [IO.File]::ReadAllText($envPath)
    $databaseMatches = [regex]::Matches(
        $envText,
        '(?m)^(?!\s*#)\s*DATABASE_URL\s*=\s*(.+?)\s*$'
    )
    if ($databaseMatches.Count -ne 1) {
        throw "Expected exactly one active DATABASE_URL in .env; found $($databaseMatches.Count)"
    }
    if ($databaseMatches[0].Groups[1].Value -notmatch '^\s*[''"]?postgres(?:ql)?:') {
        throw 'DATABASE_URL is not PostgreSQL; this one-time cutover is not applicable'
    }

    Write-Host 'Pulling and validating the promoted production image...'
    docker compose pull tunnelquestbot
    Assert-LastExitCode 'Production image pull'
    $configText = (docker compose config --format json | Out-String)
    Assert-LastExitCode 'Compose configuration'
    $botImage = ($configText | ConvertFrom-Json).services.tunnelquestbot.image
    docker run --rm --entrypoint sh $botImage -ec `
        'test -f /app/build/prisma/import-postgres.js && test -f /app/prisma.config.ts && test -d /app/src/prisma/migrations'
    Assert-LastExitCode 'SQLite migration support check in the production image'

    $postgresJson = (docker inspect postgres 2>$null | Out-String)
    if ($LASTEXITCODE -ne 0) {
        throw 'The existing postgres container was not found; restore the old deployment before migrating'
    }
    $postgres = ($postgresJson | ConvertFrom-Json)[0]
    $postgresEnvironment = @{}
    foreach ($entry in $postgres.Config.Env) {
        $parts = $entry -split '=', 2
        $postgresEnvironment[$parts[0]] = $parts[1]
    }
    foreach ($name in @('POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB')) {
        if (-not $postgresEnvironment.ContainsKey($name) -or
            [string]::IsNullOrWhiteSpace($postgresEnvironment[$name])) {
            throw "The existing postgres container has no $name value"
        }
    }

    $user = [Uri]::EscapeDataString($postgresEnvironment.POSTGRES_USER)
    $password = [Uri]::EscapeDataString($postgresEnvironment.POSTGRES_PASSWORD)
    $database = [Uri]::EscapeDataString($postgresEnvironment.POSTGRES_DB)
    $env:POSTGRES_MIGRATION_URL = "postgresql://${user}:${password}@postgres/${database}"
    $sourceVariableSet = $true

    docker compose @migrationCompose config --quiet
    Assert-LastExitCode 'Migration Compose configuration'

    Write-Host ''
    Write-Host 'Ready to perform the one-time PostgreSQL to SQLite cutover.'
    Write-Host 'The bot will be stopped, backed up, imported, verified, and restarted.'
    Write-Host "The PostgreSQL volume will be retained. Backups: $BackupDirectory"
    if (-not $Force) {
        $answer = Read-Host 'Type MIGRATE to continue'
        if ($answer -cne 'MIGRATE') {
            throw 'Cutover cancelled; no application data was changed'
        }
    }

    docker compose @migrationCompose stop tunnelquestbot
    Assert-LastExitCode 'Bot shutdown'
    $botStopped = $true

    docker compose @migrationCompose up -d postgres
    Assert-LastExitCode 'PostgreSQL startup'
    Wait-ForPostgres

    New-Item -ItemType Directory -Force -Path $BackupDirectory | Out-Null
    $stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
    $backupPath = Join-Path $BackupDirectory "tqb-before-sqlite-$stamp.sql"
    $environmentBackupPath = Join-Path $BackupDirectory "tqb-before-sqlite-$stamp.env"
    Copy-Item -LiteralPath $envPath -Destination $environmentBackupPath
    Write-Host "Saved original environment: $environmentBackupPath"
    $containerBackup = '/tmp/tqb-before-sqlite.sql'
    docker exec postgres sh -ec `
        'umask 077; pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > /tmp/tqb-before-sqlite.sql'
    Assert-LastExitCode 'PostgreSQL backup'
    docker cp "postgres:$containerBackup" $backupPath
    Assert-LastExitCode 'Backup copy'
    docker exec postgres rm -f $containerBackup
    Assert-LastExitCode 'Temporary backup cleanup'

    $backup = Get-Item $backupPath
    $dumpComplete = [bool](
        Select-String -Path $backupPath -Pattern '^-- PostgreSQL database dump complete$' -Quiet
    )
    if ($backup.Length -lt 1024 -or -not $dumpComplete) {
        throw 'The PostgreSQL dump did not pass validation'
    }
    Write-Host "Validated PostgreSQL backup: $backupPath ($($backup.Length) bytes)"
    $postgresCounts = Get-PostgresCounts $postgresEnvironment

    # Import in a one-shot container. The service stays stopped until independent
    # count and integrity checks succeed, so Discord commands cannot race them.
    docker compose @migrationCompose run --rm --no-deps -T --entrypoint sh tunnelquestbot -ec `
        './node_modules/.bin/prisma migrate deploy && node ./build/prisma/import-postgres.js'
    Assert-LastExitCode 'PostgreSQL import'
    $sqliteState = Test-SqliteImport
    Compare-RowCounts $postgresCounts $sqliteState.counts

    docker compose @migrationCompose stop postgres
    Assert-LastExitCode 'PostgreSQL shutdown'
    $postgresStopped = $true

    $updatedEnv = [regex]::Replace(
        $envText,
        '(?m)^(?!\s*#)\s*DATABASE_URL\s*=.*$',
        'DATABASE_URL=file:./data/tunnelquestbot.db'
    )
    $updatedEnv = [regex]::Replace(
        $updatedEnv,
        '(?m)^(?!\s*#)\s*POSTGRES_MIGRATION_URL\s*=.*(?:\r?\n|$)',
        ''
    )
    $temporaryEnv = "$envPath.sqlite-cutover.tmp"
    $utf8WithoutBom = New-Object Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($temporaryEnv, $updatedEnv, $utf8WithoutBom)
    Move-Item -Force $temporaryEnv $envPath
    $temporaryEnv = $null
    $environmentSwitched = $true

    Remove-Item Env:POSTGRES_MIGRATION_URL
    $sourceVariableSet = $false
    # Once startup is attempted, SQLite may receive writes even if Compose fails.
    # Recovery must keep SQLite selected instead of restoring the old database.
    $sqliteActivated = $true
    docker compose up -d --force-recreate tunnelquestbot
    Assert-LastExitCode 'SQLite bot startup'
    Start-Sleep -Seconds 10

    $botState = docker inspect tunnelquestbot --format '{{.State.Status}}'
    Assert-LastExitCode 'Bot status check'
    $restartCount = [int](docker inspect tunnelquestbot --format '{{.RestartCount}}')
    Assert-LastExitCode 'Bot restart check'
    if ($botState.Trim() -ne 'running' -or $restartCount -ne 0) {
        docker logs --tail 100 tunnelquestbot
        throw "The SQLite bot is not stable (status=$botState, restarts=$restartCount)"
    }
    # Live traffic can legitimately add or delete rows after activation.
    # Verify integrity and the marker here; strict reconciliation was offline.
    $null = Test-SqliteImport
    docker compose ps
    Assert-LastExitCode 'Final service status'

    $botStopped = $false
    $environmentSwitched = $false
    $postgresStopped = $false
    Write-Host ''
    Write-Host 'SQLite cutover completed successfully.'
    Write-Host "Rollback dump: $backupPath"
    Write-Host "Rollback environment: $environmentBackupPath"
    Write-Host 'The stopped postgres container and its data volume were retained.'
} catch {
    Write-Host ''
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    if ($botStopped) {
        docker stop tunnelquestbot 2>$null | Out-Null
        if ($environmentSwitched -and -not $sqliteActivated) {
            try {
                $temporaryEnv = "$envPath.sqlite-cutover-restore.tmp"
                $restoreEncoding = New-Object Text.UTF8Encoding($false)
                [IO.File]::WriteAllText($temporaryEnv, $envText, $restoreEncoding)
                Move-Item -Force $temporaryEnv $envPath
                $temporaryEnv = $null
                Write-Host 'Restored the original PostgreSQL DATABASE_URL in .env.'
            } catch {
                Write-Host "WARNING: Could not restore .env automatically: $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
        if ($postgresStopped -and -not $sqliteActivated) {
            docker start postgres 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host 'Restarted the retained PostgreSQL container.'
            } else {
                Write-Host 'WARNING: Could not restart the PostgreSQL container automatically.' -ForegroundColor Yellow
            }
        }
        Write-Host 'The bot was left stopped. PostgreSQL data and any completed backup were retained.'
        if ($sqliteActivated) {
            Write-Host 'SQLite remains configured because it may contain new writes. Repair the startup problem and use start.bat.'
            Write-Host 'Do not rerun the import or switch back to PostgreSQL without reconciling post-cutover changes.'
        } else {
            Write-Host 'Correct the reported problem before retrying or follow the rollback procedure.'
        }
    }
    exit 1
} finally {
    if ($null -ne $temporaryEnv -and (Test-Path $temporaryEnv)) {
        Remove-Item -Force $temporaryEnv -ErrorAction SilentlyContinue
    }
    if ($sourceVariableSet) {
        Remove-Item Env:POSTGRES_MIGRATION_URL -ErrorAction SilentlyContinue
    }
}
