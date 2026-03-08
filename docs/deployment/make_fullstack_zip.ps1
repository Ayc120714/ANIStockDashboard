$ErrorActionPreference = "Stop"

$frontendRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$projectRoot = Split-Path -Parent $frontendRoot
$backendRoot = Join-Path $projectRoot "backend_stockdashboard"

$outDir = Join-Path $frontendRoot "dist"
$tempDir = Join-Path $outDir "ani_fullstack_bundle"
$zipPath = Join-Path $outDir "ani_fullstack_bundle.zip"

if (-not (Test-Path $backendRoot)) {
  throw "Backend folder not found: $backendRoot"
}

function Copy-SafeTree {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination
  )

  New-Item -ItemType Directory -Force -Path $Destination | Out-Null

  $excludeDirs = @(
    ".git",
    "node_modules",
    ".venv",
    "__pycache__",
    ".pytest_cache",
    "dist",
    "build",
    ".runtime"
  )
  $excludeFiles = @(
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    "*.pyc",
    "*.pyo",
    "*.sqlite",
    "*.db",
    "*.log"
  )

  $xd = $excludeDirs | ForEach-Object { "/XD `"$($_)`"" }
  $xf = $excludeFiles | ForEach-Object { "/XF `"$($_)`"" }

  $cmd = @(
    "robocopy",
    "`"$Source`"",
    "`"$Destination`"",
    "/E",
    "/NFL",
    "/NDL",
    "/NJH",
    "/NJS",
    "/NC",
    "/NS",
    "/NP"
  ) + $xd + $xf

  $null = Invoke-Expression ($cmd -join " ")
  # robocopy returns non-zero for success scenarios; ignore unless >=8
  if ($LASTEXITCODE -ge 8) {
    throw "robocopy failed with code $LASTEXITCODE"
  }
}

Write-Host "Preparing full-stack bundle..."
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

Copy-SafeTree -Source $frontendRoot -Destination (Join-Path $tempDir "stockdashboard")
Copy-SafeTree -Source $backendRoot -Destination (Join-Path $tempDir "backend_stockdashboard")

Compress-Archive -Path (Join-Path $tempDir "*") -DestinationPath $zipPath -CompressionLevel Optimal
Write-Host "Created full-stack ZIP: $zipPath"
