#requires -Version 5.1

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

try {
    if (-not (Test-Path '.env')) {
        throw 'Missing .env in the deployment directory'
    }
    $envText = [IO.File]::ReadAllText((Resolve-Path '.env'))
    $databaseMatches = [regex]::Matches(
        $envText,
        '(?m)^(?!\s*#)\s*DATABASE_URL\s*=\s*(.+?)\s*$'
    )
    if ($databaseMatches.Count -ne 1) {
        throw "Expected exactly one active DATABASE_URL in .env; found $($databaseMatches.Count)"
    }
    if ($databaseMatches[0].Groups[1].Value -match '^\s*[''"]?postgres(?:ql)?:') {
        throw 'PostgreSQL cutover is pending. Run migrate-postgres-to-sqlite.bat instead.'
    }
    if ($databaseMatches[0].Groups[1].Value -notmatch '^\s*[''"]?file:') {
        throw 'DATABASE_URL must be a persistent SQLite file URL'
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
