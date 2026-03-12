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
    foreach ($pid in $pids) {
        try {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
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
$backendRoot = Join-Path $repoRoot "backend_stockdashboard"

if (-not (Test-Path $backendRoot)) {
    throw "Backend directory not found: $backendRoot"
}

if ($KillExisting) {
    Write-Host "Stopping processes on ports $BackendPort and $FrontendPort ..."
    Stop-PortProcess -Port $BackendPort
    Stop-PortProcess -Port $FrontendPort
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
