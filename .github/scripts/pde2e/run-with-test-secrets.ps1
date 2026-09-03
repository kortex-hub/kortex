# Restores deferred inference API keys and executes the pnpm test script.

param(
  [Parameter(Mandatory)][string]$NpmScript
)

$ErrorActionPreference = 'Stop'

$deferredSecretsFile = Join-Path $env:USERPROFILE '.pde2e-deferred-secrets'
$restoredNames = @()

if (Test-Path $deferredSecretsFile) {
  Get-Content $deferredSecretsFile | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
      $name = $Matches[1]
      $value = $Matches[2]
      [Environment]::SetEnvironmentVariable($name, $value, 'Process')
      $restoredNames += $name
    }
  }
  Write-Host "Restored $($restoredNames.Count) deferred secret(s) for test run"
}

$exitCode = 1

try {
  pnpm run $NpmScript
  $exitCode = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 1 }
} finally {
  foreach ($name in $restoredNames) {
    [Environment]::SetEnvironmentVariable($name, $null, 'Process')
  }
  Remove-Item $deferredSecretsFile -Force -ErrorAction SilentlyContinue
}

if ($exitCode -ne 0) {
  exit $exitCode
}
