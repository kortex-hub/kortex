# Runs first in pde2e scriptPaths (after pde2e loads secretFile into the VM environment).
# Saves inference API keys and tokens to a local file and removes them from the environment
# so pnpm install / node-gyp cannot dump them into CI logs.
# Keys are discovered dynamically by suffix convention (_API_KEY, _TOKEN, _SECRET).

$ErrorActionPreference = 'Stop'

$secretNames = @([Environment]::GetEnvironmentVariables('Process').Keys |
  Where-Object { $_ -match '_(API_KEY|TOKEN|SECRET)$' })

if ($secretNames.Count -eq 0) {
  Write-Host 'No secrets matching *_API_KEY / *_TOKEN / *_SECRET in environment to defer'
  exit 0
}

$lines = @()
foreach ($name in $secretNames) {
  $value = [Environment]::GetEnvironmentVariable($name, 'Process')
  if ([string]::IsNullOrWhiteSpace($value)) {
    continue
  }
  $lines += "$name=$value"
}

if ($lines.Count -eq 0) {
  Write-Host 'All matching secret env vars were empty, nothing to defer'
  exit 0
}

$deferredSecretsFile = Join-Path $env:USERPROFILE '.pde2e-deferred-secrets'

try {
  Set-Content -Path $deferredSecretsFile -Value $lines -Encoding UTF8
} catch {
  Write-Host "ERROR: Failed to write deferred secrets file: $_"
  throw
}

foreach ($name in $secretNames) {
  [Environment]::SetEnvironmentVariable($name, $null, 'Process')
}

Write-Host "Deferred $($lines.Count) secret(s) until test run"
