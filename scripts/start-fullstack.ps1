param(
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 3000,
    [int]$BackendStartupTimeoutSec = 90,
    [int]$BootstrapReadinessTimeoutSec = 900,
    [string]$BackendHealthUrl = "",
    [switch]$KillExisting = $true
)

$ErrorActionPreference = "Stop"

function Stop-PortProcess {
    param([int]$Port)
    $pids = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
    foreach ($procId in $pids) {
        try {
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        } catch {
            # ignore
        }
    }
}

function Stop-ProcessByCommandPattern {
    param(
        [string[]]$Patterns,
        [string]$Label = "process"
    )
    if (-not $Patterns -or $Patterns.Count -eq 0) {
        return
    }
    $all = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue
    foreach ($p in $all) {
        $cmd = [string]$p.CommandLine
        if ([string]::IsNullOrWhiteSpace($cmd)) {
            continue
        }
        $matched = $true
        foreach ($pat in $Patterns) {
            if ($cmd -notlike "*$pat*") {
                $matched = $false
                break
            }
        }
        if (-not $matched) {
            continue
        }
        try {
            Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
            Write-Host "Stopped stale $Label process $($p.ProcessId)"
        } catch {
            # ignore
        }
    }
}

function Start-DetachedTerminal {
    param(
        [string]$WorkingDir,
        [string]$Command
    )
    $safeDir = $WorkingDir -replace "'", "''"
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "Set-Location '$safeDir'; $Command"
    ) -WorkingDirectory $WorkingDir | Out-Null
}

# Frontend repo root (folder that contains package.json + scripts/)
$frontendRoot = Split-Path -Parent $PSScriptRoot
# Backend lives as a SIBLING of stockdashboard: ANIStockProject/backend_stockdashboard
$projectRoot = Split-Path -Parent $frontendRoot
$backendRoot = Join-Path $projectRoot "backend_stockdashboard"
if (-not (Test-Path $backendRoot)) {
    throw @"
Backend directory not found: $backendRoot

Expected layout:
  <project>/stockdashboard/     (this React app)
  <project>/backend_stockdashboard/   (FastAPI — clone next to stockdashboard, not inside it)

"@
}

if ($KillExisting) {
    Write-Host "Stopping old backend/frontend processes ..."
    Stop-PortProcess -Port $BackendPort
    Stop-PortProcess -Port $FrontendPort
    # Extra guard: kill stale launchers that may not hold the port anymore.
    Stop-ProcessByCommandPattern -Patterns @($backendRoot, "uvicorn", "app.main:app") -Label "backend"
    Stop-ProcessByCommandPattern -Patterns @($frontendRoot, "react-scripts", "start") -Label "frontend"
    Stop-ProcessByCommandPattern -Patterns @($frontendRoot, "npm start") -Label "frontend-launcher"
    Start-Sleep -Seconds 1
}

Write-Host "Starting backend first (BACKGROUND_REFRESH + sector sync + orchestrator enabled for this session) ..."
# Child shell env so startup bootstrap + scheduled jobs can populate indices, candles, FII/DII, etc.
$backendCmd = (
    '$env:BACKGROUND_REFRESH=''true''; ' +
    '$env:SECTOR_CLASSIFICATION_SYNC_ON_STARTUP=''true''; ' +
    '$env:ENABLE_ORCHESTRATOR=''true''; ' +
    'python -m uvicorn app.main:app --host 127.0.0.1 --port ' + $BackendPort + ' --log-level info'
)
Start-DetachedTerminal -WorkingDir $backendRoot -Command $backendCmd

$urls = @()
if ($BackendHealthUrl) {
    $urls += $BackendHealthUrl
}
$urls += @(
    "http://127.0.0.1:$BackendPort/api/system/status",
    "http://127.0.0.1:$BackendPort/docs"
)

Write-Host "Waiting for backend to stabilize ..."
$ready = $false
for ($i = 0; $i -lt $BackendStartupTimeoutSec; $i++) {
    foreach ($url in $urls) {
        try {
            $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
                $ready = $true
                break
            }
        } catch {
            # keep polling
        }
    }
    if ($ready) { break }
    Start-Sleep -Seconds 1
}

if (-not $ready) {
    throw "Backend did not become ready within $BackendStartupTimeoutSec seconds."
}

$readinessUrl = "http://127.0.0.1:$BackendPort/api/system/readiness"
Write-Host "Waiting for startup DB/candle bootstrap (readiness) up to $BootstrapReadinessTimeoutSec s ..."
$bootstrapDone = $false
$readinessMissing = $false
for ($j = 0; $j -lt $BootstrapReadinessTimeoutSec; $j += 2) {
    try {
        $body = Invoke-RestMethod -Uri $readinessUrl -TimeoutSec 8 -ErrorAction Stop
        if ($body.bootstrap_complete -eq $true) {
            $bootstrapDone = $true
            break
        }
    } catch {
        $resp = $_.Exception.Response
        if ($resp -and [int]$resp.StatusCode -eq 404) {
            Write-Host "Readiness endpoint not found (older backend) — skipping bootstrap wait."
            $readinessMissing = $true
            $bootstrapDone = $true
            break
        }
    }
    Start-Sleep -Seconds 2
}

if (-not $bootstrapDone) {
    throw "Startup bootstrap did not report complete within $BootstrapReadinessTimeoutSec seconds. Check backend logs (Samco login, CandleSyncEngine)."
}

if (-not $readinessMissing) {
    Write-Host "Startup bootstrap complete."
}

Write-Host "Starting frontend ..."
$frontendCmd = "npm start"
Start-DetachedTerminal -WorkingDir $frontendRoot -Command $frontendCmd

Write-Host ""
Write-Host "Full stack startup complete:"
Write-Host "  Backend : http://127.0.0.1:$BackendPort"
Write-Host "  Frontend: https://localhost:$FrontendPort"
Write-Host ""
Write-Host "Tip: Run this again anytime to restart both."
