param(
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 3000,
    [int]$BackendStartupTimeoutSec = 90,
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

$frontendRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $frontendRoot
# Real backend: ANIStockProject/backend_stockdashboard (sibling of stockdashboard). Not the nested copy under stockdashboard/.
$backendRoot = Join-Path $repoRoot "backend_stockdashboard"
if (-not (Test-Path $backendRoot)) {
    throw "Backend directory not found: $backendRoot`nClone https://github.com/Ayc120714/backend_stockdashboard.git next to stockdashboard."
}
Write-Host "Backend directory: $backendRoot"

if ($KillExisting) {
    Write-Host "Stopping old backend/frontend processes ..."
    Stop-PortProcess -Port $BackendPort
    Stop-PortProcess -Port $FrontendPort
    # Extra guard: kill stale launchers that may not hold the port anymore.
    Stop-ProcessByCommandPattern -Patterns @($backendRoot, "uvicorn", "app.main:app") -Label "backend"
    Stop-ProcessByCommandPattern -Patterns @($frontendRoot, "react-scripts", "craco", "start") -Label "frontend"
    Stop-ProcessByCommandPattern -Patterns @($frontendRoot, "npm start") -Label "frontend-launcher"
    Start-Sleep -Seconds 1
}

Write-Host "Starting backend first ..."
$backendCmd = "python -m uvicorn app.main:app --host 127.0.0.1 --port $BackendPort --log-level info"
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

Write-Host "Backend is ready. Starting frontend ..."
$frontendCmd = "npm start"
Start-DetachedTerminal -WorkingDir $frontendRoot -Command $frontendCmd

Write-Host ""
Write-Host "Full stack startup complete:"
Write-Host "  Backend : http://127.0.0.1:$BackendPort"
Write-Host "  Frontend: https://localhost:$FrontendPort"
Write-Host ""
Write-Host "Tip: Run this again anytime to restart both."
