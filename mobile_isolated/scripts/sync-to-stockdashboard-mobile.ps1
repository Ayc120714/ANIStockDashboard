# Sync ani-mobile workspace into stockdashboard/mobile_isolated for mainline commits.
# Run from repo root: npm run sync:stockdashboard
$ErrorActionPreference = 'Stop'

$Source = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Dest = 'C:\Users\gvc19\OneDrive\Desktop\GVC\Yogitha\Learnings\ReactStockProject\ANIStockProject\stockdashboard\mobile_isolated'

if (-not (Test-Path -LiteralPath $Dest)) {
    New-Item -ItemType Directory -Path $Dest -Force | Out-Null
}

$robocopyArgs = @(
    $Source, $Dest,
    '/E',
    '/XD', 'node_modules',
    '/XD', 'android\.gradle',
    '/XD', 'android\build',
    '/XD', 'android\app\build',
    '/XD', 'android\app\.cxx',
    '/XD', 'ios\Pods',
    '/XD', 'ios\build',
    '/XD', '.idea',
    '/XF', '.env',
    '/NFL', '/NDL', '/NJH', '/NJS', '/NP'
)

& robocopy @robocopyArgs
$code = $LASTEXITCODE
if ($code -ge 8) {
    throw "robocopy failed with exit code $code"
}

$staleAndroidBuild = Join-Path $Dest 'android\build'
if (Test-Path -LiteralPath $staleAndroidBuild) {
    Remove-Item -Recurse -Force -LiteralPath $staleAndroidBuild
    Write-Host "Removed stale $staleAndroidBuild"
}

Write-Host ""
Write-Host "Synced to $Dest"
Write-Host "Next: commit from stockdashboard repo root (mobile_isolated/**)"
