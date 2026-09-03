# Runs on the MAPT Windows VM via pde2e-image scriptPaths (after -pdUrl install).
# Sets KAIDEN_BINARY for Playwright CDP packaged-mode tests.
# pde2e-image renames the installed app binary to pd.exe and exposes it as PODMAN_DESKTOP_BINARY.

$ErrorActionPreference = 'Stop'

function Set-KaidenBinary([string]$BinaryPath) {
  Write-Host "Resolved Kaiden binary: $BinaryPath"
  $env:KAIDEN_BINARY = $BinaryPath
  [System.Environment]::SetEnvironmentVariable('KAIDEN_BINARY', $BinaryPath, 'Process')
  [System.Environment]::SetEnvironmentVariable('KAIDEN_BINARY', $BinaryPath, 'User')
}

function Resolve-InstalledBinary([string]$Path) {
  if (-not (Test-Path $Path)) {
    return $null
  }

  $installDir = Split-Path $Path -Parent
  $kaidenExe = Join-Path $installDir 'Kaiden.exe'

  # pde2e-image renames the installed app to pd.exe; restore Kaiden.exe for CDP packaged-mode parity with SSH runs.
  if ($Path -like '*\pd.exe' -and -not (Test-Path $kaidenExe)) {
    Copy-Item -Path $Path -Destination $kaidenExe -Force
    Write-Host "Restored Kaiden.exe from pde2e pd.exe install"
  }

  if (Test-Path $kaidenExe) {
    return $kaidenExe
  }

  return $Path
}

if ($env:PODMAN_DESKTOP_BINARY -and (Test-Path $env:PODMAN_DESKTOP_BINARY)) {
  $resolved = Resolve-InstalledBinary $env:PODMAN_DESKTOP_BINARY
  Set-KaidenBinary $resolved
  exit 0
}

$candidatePaths = @(
  (Join-Path $env:LOCALAPPDATA 'Programs\kaiden\Kaiden.exe'),
  (Join-Path $env:LOCALAPPDATA 'Programs\kaiden\pd.exe'),
  (Join-Path $env:LOCALAPPDATA 'Programs\Kaiden\Kaiden.exe')
)

foreach ($candidatePath in $candidatePaths) {
  $resolved = Resolve-InstalledBinary $candidatePath
  if ($resolved) {
    Set-KaidenBinary $resolved
    exit 0
  }
}

Write-Host "ERROR: Kaiden binary not found after pdUrl install. Checked PODMAN_DESKTOP_BINARY and: $($candidatePaths -join ', ')"
exit 1
