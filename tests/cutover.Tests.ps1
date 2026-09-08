#requires -Version 5.1
# Process-level regression tests; Docker is replaced with a synthetic stand-in.
param(
    [string]$Scenario,
    [string]$FixtureDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($Scenario) {
    $global:LASTEXITCODE = 0
    if ($Scenario.StartsWith('ready-')) {
        & (Join-Path $FixtureDirectory 'assert-sqlite-ready.ps1')
        exit $LASTEXITCODE
    }

    $global:tqbBotRunning = $true
    $global:tqbVerificationCount = 0
    $global:tqbLiveCounts = $false
    $tracePath = Join-Path $FixtureDirectory 'trace.txt'
    function Start-Sleep { }
    function docker {
        $command = $args -join ' '
        $global:LASTEXITCODE = 0
        Add-Content -LiteralPath $tracePath -Value $command
        if ($command -eq 'compose version') { return 'Docker Compose synthetic' }
        if ($command -eq 'compose pull tunnelquestbot') { return }
        if ($command -eq 'compose config --format json') {
            return '{"services":{"tunnelquestbot":{"image":"synthetic:image"}}}'
        }
        if ($command.StartsWith('run --rm --entrypoint sh synthetic:image')) { return }
        if ($command -eq 'inspect postgres') {
            return '[{"Config":{"Env":["POSTGRES_USER=test","POSTGRES_PASSWORD=fake","POSTGRES_DB=test"]}}]'
        }
        if ($command -eq 'inspect postgres --format {{.State.Health.Status}}') { return 'healthy' }
        if ($command.EndsWith('config --quiet')) { return }
        if ($command.EndsWith('stop tunnelquestbot') -or $command -eq 'stop tunnelquestbot') {
            $global:tqbBotRunning = $false
            return
        }
        if ($command.EndsWith('up -d postgres') -or $command.EndsWith('stop postgres') -or $command -eq 'start postgres') { return }
        if ($command.StartsWith('exec postgres sh -ec ')) { return }
        if ($command.StartsWith('cp postgres:/tmp/tqb-before-sqlite.sql ')) {
            [IO.File]::WriteAllText($args[2], ('-' * 1200) + "`n-- PostgreSQL database dump complete`n")
            return
        }
        if ($command -eq 'exec postgres rm -f /tmp/tqb-before-sqlite.sql') { return }
        if ($command.StartsWith('exec -i postgres psql ')) {
            if ($global:tqbBotRunning) { throw 'Source counted while bot was running' }
            return '{"User":1,"Watch":1,"BlockedPlayer":1,"BlockedPlayerByWatch":1,"PlayerLink":1}'
        }
        if ($command.Contains('run --rm --no-deps -T --entrypoint sh tunnelquestbot -ec')) {
            if ($global:tqbBotRunning) { throw 'Importer ran while bot was serving traffic' }
            if (-not $command.Contains('prisma migrate deploy && node ./build/prisma/import-postgres.js')) {
                throw 'Offline importer command was changed'
            }
            if ($Scenario -eq 'import-failure') { $global:LASTEXITCODE = 1 }
            return
        }
        if ($command -eq 'compose run --rm --no-deps -T --entrypoint node tunnelquestbot') {
            $global:tqbVerificationCount++
            if ($global:tqbVerificationCount -eq 1 -and $global:tqbBotRunning) {
                throw 'Initial reconciliation ran while bot was serving traffic'
            }
            if (($Scenario -eq 'pre-integrity-failure' -and -not $global:tqbLiveCounts) -or
                ($Scenario -eq 'post-integrity-failure' -and $global:tqbLiveCounts)) {
                $global:LASTEXITCODE = 1
            }
            $watchCount = 1
            if ($Scenario -eq 'count-mismatch') { $watchCount = 0 }
            if ($global:tqbLiveCounts -and $Scenario -eq 'traffic-add') { $watchCount = 2 }
            if ($global:tqbLiveCounts -and $Scenario -eq 'traffic-delete') { $watchCount = 0 }
            return (@{
                counts = @{ User = 1; Watch = $watchCount; BlockedPlayer = 1; BlockedPlayerByWatch = 1; PlayerLink = 1 }
                marker = 1; foreignKeyFailures = 0; integrity = 'ok'
            } | ConvertTo-Json -Compress)
        }
        if ($command -eq 'compose up -d --force-recreate tunnelquestbot') {
            if ($global:tqbVerificationCount -ne 1) { throw 'Bot started before offline verification' }
            if ([IO.File]::ReadAllText((Join-Path $FixtureDirectory '.env')) -notmatch 'DATABASE_URL=file:') {
                throw 'Bot started before switching configuration'
            }
            $global:tqbBotRunning = $true
            $global:tqbLiveCounts = $true
            if ($Scenario -eq 'startup-failure') { $global:LASTEXITCODE = 1 }
            return
        }
        if ($command -eq 'inspect tunnelquestbot --format {{.State.Status}}') {
            if ($Scenario -eq 'unstable-bot') { return 'restarting' }
            return 'running'
        }
        if ($command -eq 'inspect tunnelquestbot --format {{.RestartCount}}') {
            if ($Scenario -eq 'unstable-bot') { return '1' }
            return '0'
        }
        if ($command -eq 'logs --tail 100 tunnelquestbot' -or $command -eq 'compose ps') { return }
        throw "Unexpected Docker command: $command"
    }

    & (Join-Path $FixtureDirectory 'migrate-postgres-to-sqlite.ps1') -Force -BackupDirectory (Join-Path $FixtureDirectory 'backups')
    exit $LASTEXITCODE
}

function Assert-Test([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}

$sourceDirectory = Split-Path $PSScriptRoot -Parent
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('tqb-cutover-tests-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
try {
    foreach ($case in @('success', 'traffic-add', 'traffic-delete', 'count-mismatch', 'import-failure', 'startup-failure', 'unstable-bot', 'pre-integrity-failure', 'post-integrity-failure', 'ready-sqlite', 'ready-postgres', 'ready-invalid', 'ready-duplicate')) {
        $fixture = Join-Path $testRoot $case
        New-Item -ItemType Directory -Path $fixture | Out-Null
        Copy-Item (Join-Path $sourceDirectory '*.ps1') $fixture
        $originalEnv = "DATABASE_URL=postgresql://test:fake@postgres/test`n"
        if ($case -eq 'ready-sqlite') { $originalEnv = "DATABASE_URL=file:./data/test.db`n" }
        if ($case -eq 'ready-invalid') { $originalEnv = "DATABASE_URL=invalid`n" }
        if ($case -eq 'ready-duplicate') { $originalEnv += $originalEnv }
        [IO.File]::WriteAllText((Join-Path $fixture '.env'), $originalEnv)
        $processInfo = New-Object Diagnostics.ProcessStartInfo
        $processInfo.FileName = Join-Path $PSHOME 'powershell.exe'
        $processInfo.Arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}" -Scenario {1} -FixtureDirectory "{2}"' -f $PSCommandPath, $case, $fixture
        $processInfo.UseShellExecute = $false
        $processInfo.RedirectStandardOutput = $true
        $processInfo.RedirectStandardError = $true
        $child = [Diagnostics.Process]::Start($processInfo)
        try {
            $stdout = $child.StandardOutput.ReadToEndAsync()
            $stderr = $child.StandardError.ReadToEndAsync()
            if (-not $child.WaitForExit(30000)) {
                $child.Kill()
                throw "$case timed out"
            }
            $output = $stdout.Result + $stderr.Result
            $exitCode = $child.ExitCode
        } finally {
            $child.Dispose()
        }
        $expectedSuccess = $case -in @('success', 'traffic-add', 'traffic-delete', 'ready-sqlite')
        Assert-Test (($exitCode -eq 0) -eq $expectedSuccess) "$case exited $exitCode : $output"
        $expectedFailures = @{
            'count-mismatch' = 'Row-count mismatch for Watch'
            'import-failure' = 'PostgreSQL import failed with exit code'
            'startup-failure' = 'SQLite bot startup failed with exit code'
            'unstable-bot' = 'The SQLite bot is not stable'
            'pre-integrity-failure' = 'SQLite verification failed with exit code'
            'post-integrity-failure' = 'SQLite verification failed with exit code'
            'ready-postgres' = 'PostgreSQL cutover is pending'
            'ready-invalid' = 'DATABASE_URL must be a persistent SQLite file URL'
            'ready-duplicate' = 'Expected exactly one active DATABASE_URL'
        }
        if ($expectedFailures.ContainsKey($case)) {
            Assert-Test (($output | Out-String).Contains($expectedFailures[$case])) "$case failed for the wrong reason: $output"
        }
        $finalEnv = [IO.File]::ReadAllText((Join-Path $fixture '.env'))
        if (-not $case.StartsWith('ready-')) {
            $trace = [IO.File]::ReadAllText((Join-Path $fixture 'trace.txt'))
            $activated = $case -in @('success', 'traffic-add', 'traffic-delete', 'startup-failure', 'unstable-bot', 'post-integrity-failure')
            if ($activated) {
                Assert-Test ($finalEnv -match 'DATABASE_URL=file:') "$case restored stale PostgreSQL configuration"
                Assert-Test (-not $trace.Contains("`nstart postgres")) "$case restarted the old database after activation"
            } else {
                Assert-Test ($finalEnv -eq $originalEnv) "$case changed the original configuration"
                Assert-Test (-not $trace.Contains('compose up -d --force-recreate tunnelquestbot')) "$case started the bot after failed validation"
            }
            if (-not $expectedSuccess) {
                Assert-Test ($trace.Contains("`nstop tunnelquestbot")) "$case did not leave the bot stopped"
            }
        }
        Write-Host "PASS $case"
    }
} finally {
    Remove-Item -LiteralPath $testRoot -Recurse -Force
}
