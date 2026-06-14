# Syncs this repo to C:\dev\mobile_isolated so Android CMake/Ninja stay under Windows MAX_PATH.
# Run from the repo root: npm run setup:dev
$ErrorActionPreference = 'Stop'

$DestRoot = 'C:\dev'
$Dest = Join-Path $DestRoot 'mobile_isolated'
$Source = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

New-Item -ItemType Directory -Path $DestRoot -Force | Out-Null

if (Test-Path -LiteralPath $Dest) {
    $srcR = [string]((Resolve-Path -LiteralPath $Source).Path).TrimEnd('\')
    $dstR = [string]((Resolve-Path -LiteralPath $Dest).Path).TrimEnd('\')
    if ($srcR -ieq $dstR) {
        Write-Host "Already under $Dest - skipping copy, running npm install only."
        Push-Location -LiteralPath $Dest
        try {
            npm install
        } finally {
            Pop-Location
        }
        exit 0
    }
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
    '/NFL', '/NDL', '/NJH', '/NJS', '/NP'
)

& robocopy @robocopyArgs
$code = $LASTEXITCODE
if ($code -ge 8) {
    throw "robocopy failed with exit code $code"
}

# `robocopy` excludes `android/build`; a stale copy keeps old absolute paths in
# `android/build/generated/autolinking/autolinking.json` and breaks CMake/Ninja (MAX_PATH).
$staleAndroidBuild = Join-Path $Dest 'android\build'
if (Test-Path -LiteralPath $staleAndroidBuild) {
    Remove-Item -Recurse -Force -LiteralPath $staleAndroidBuild
    Write-Host "Removed stale $staleAndroidBuild so autolinking regenerates for this path."
}

Push-Location -LiteralPath $Dest
try {
    npm install
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "Synced to $Dest - open that folder in your editor and run Android builds from there:"
Write-Host "  cd $Dest"
Write-Host "  npm start"
Write-Host "  npm run android"
