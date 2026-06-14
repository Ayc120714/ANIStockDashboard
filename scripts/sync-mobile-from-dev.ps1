# Copy dev mobile app (c:\ani-mobile by default) into this monorepo's mobile_isolated/.
# Run from stockdashboard root: npm run mobile:isolated:sync
$ErrorActionPreference = 'Stop'

$Source = if ($env:MOBILE_DEV_ROOT) { $env:MOBILE_DEV_ROOT } else { 'c:\ani-mobile' }
$Dest = Join-Path $PSScriptRoot '..\mobile_isolated' | Resolve-Path -ErrorAction SilentlyContinue
if (-not $Dest) {
    $Dest = (Resolve-Path (Join-Path $PSScriptRoot '..\mobile_isolated')).Path
}

if (-not (Test-Path -LiteralPath $Source)) {
    throw "Source not found: $Source (set MOBILE_DEV_ROOT if your dev copy lives elsewhere)"
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

foreach ($stale in @('android\build', 'android\app\build', 'android\app\.cxx')) {
    $p = Join-Path $Dest $stale
    if (Test-Path -LiteralPath $p) {
        Remove-Item -Recurse -Force -LiteralPath $p
        Write-Host "Removed stale $p"
    }
}

Write-Host "Synced $Source -> $Dest"
