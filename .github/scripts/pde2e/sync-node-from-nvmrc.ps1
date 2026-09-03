# Runs on the MAPT Windows VM via pde2e-image scriptPaths (after repo clone, before pnpm install).
# Ensures Node on PATH matches the checked-out repo .nvmrc instead of pde2e-image defaults.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$nvmrcPath = Join-Path (Get-Location) '.nvmrc'
if (-not (Test-Path $nvmrcPath)) {
  Write-Host "ERROR: .nvmrc not found at $nvmrcPath"
  exit 1
}

$rawVersion = (Get-Content -Path $nvmrcPath -Raw).Trim()
if ([string]::IsNullOrWhiteSpace($rawVersion)) {
  Write-Host 'ERROR: .nvmrc is empty'
  exit 1
}

$nodeVersion = if ($rawVersion.StartsWith('v')) { $rawVersion } else { "v$rawVersion" }
Write-Host "Target Node version from .nvmrc: $nodeVersion"

function Get-NodeSemver([string]$VersionOutput) {
  if ($VersionOutput -match 'v?(\d+\.\d+\.\d+)') {
    return $Matches[1]
  }
  return $null
}

$expectedSemver = Get-NodeSemver $nodeVersion
$currentSemver = $null
try {
  $currentSemver = Get-NodeSemver (node -v 2>$null)
} catch {
  # node not on PATH yet
}

if ($currentSemver -eq $expectedSemver) {
  Write-Host "Node already matches .nvmrc: v$currentSemver"
  node -v
  pnpm -v 2>$null
  exit 0
}

$toolsDir = Join-Path $env:USERPROFILE 'tools'
if (-not (Test-Path $toolsDir)) {
  New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null
}

$nodeDir = Join-Path $toolsDir "node-$nodeVersion-win-x64"
if (-not (Test-Path $nodeDir)) {
  Write-Host "Downloading Node.js $nodeVersion..."
  $zipPath = Join-Path $toolsDir 'nodejs.zip'
  Invoke-WebRequest -Uri "https://nodejs.org/dist/$nodeVersion/node-$nodeVersion-win-x64.zip" -OutFile $zipPath -UseBasicParsing
  Expand-Archive -Path $zipPath -DestinationPath $toolsDir -Force
  Remove-Item $zipPath -Force
}

$nodeBin = Join-Path $nodeDir 'node.exe'
if (-not (Test-Path $nodeBin)) {
  Write-Host "ERROR: Node install missing at $nodeBin"
  exit 1
}

$env:PATH = "$nodeDir;$env:PATH"
$userPath = [System.Environment]::GetEnvironmentVariable('PATH', 'User')
if ($userPath -notlike "*$nodeDir*") {
  [System.Environment]::SetEnvironmentVariable('PATH', "$nodeDir;$userPath", 'User')
}

Write-Host "Synced Node from .nvmrc:"
node -v
pnpm -v 2>$null
