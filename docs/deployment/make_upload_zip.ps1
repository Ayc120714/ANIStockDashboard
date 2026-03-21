$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$OutDir = Join-Path $RepoRoot "dist"
$TempDir = Join-Path $OutDir "hostinger_upload_bundle"
$ZipPath = Join-Path $OutDir "hostinger_upload_bundle.zip"

Write-Host "Preparing Hostinger upload bundle..."
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
if (Test-Path $TempDir) { Remove-Item -Recurse -Force $TempDir }
if (Test-Path $ZipPath) { Remove-Item -Force $ZipPath }
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null

$frontendBuild = Join-Path $RepoRoot "build"
if (-not (Test-Path $frontendBuild)) {
  throw "Frontend build folder not found. Run 'npm run build' first."
}

Copy-Item -Recurse -Force $frontendBuild (Join-Path $TempDir "frontend_build")
Copy-Item -Recurse -Force (Join-Path $RepoRoot "docs\deployment") (Join-Path $TempDir "deployment_docs")
Copy-Item -Force (Join-Path $RepoRoot ".env.production.example") (Join-Path $TempDir ".env.production.example")

$backendEnvExample = Join-Path $RepoRoot "backend_stockdashboard\.env.production.example"
if (-not (Test-Path $backendEnvExample)) {
  $backendEnvExample = Join-Path (Split-Path -Parent $RepoRoot) "backend_stockdashboard\.env.production.example"
}
if (Test-Path $backendEnvExample) {
  Copy-Item -Force $backendEnvExample (Join-Path $TempDir "backend.env.production.example")
}

Compress-Archive -Path (Join-Path $TempDir "*") -DestinationPath $ZipPath -CompressionLevel Optimal
Write-Host "Created ZIP: $ZipPath"
