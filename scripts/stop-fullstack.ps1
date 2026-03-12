param(
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 3000
)

$ErrorActionPreference = "Continue"

function Stop-PortProcess {
    param([int]$Port)
    $pids = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
    if (-not $pids -or $pids.Count -eq 0) {
        Write-Host "No listening process found on port $Port"
        return
    }
    foreach ($pid in $pids) {
        try {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Write-Host "Stopped process $pid on port $Port"
        } catch {
            Write-Host "Failed to stop process $pid on port $Port"
        }
    }
}

Write-Host "Stopping full stack services ..."
Stop-PortProcess -Port $BackendPort
Stop-PortProcess -Port $FrontendPort
Write-Host "Done."
