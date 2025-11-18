# Script used to launch a flow within a scheduled task on Windows
# It adds BEGIN/END markers to the output and the execution time
# It also captures the exit code of the flow and returns it
# Usage: kortex-scheduler-executor.ps1 -StorageDir <path> -SchedulerId <id> [-Metadata @{key=value}] -Command <command> -Arguments <args>

param(
    [Parameter(Mandatory=$true)]
    [string]$StorageDir,

    [Parameter(Mandatory=$true)]
    [string]$SchedulerId,

    [Parameter(Mandatory=$false)]
    [string]$Metadata = "{}",

    [Parameter(Mandatory=$false)]
    [string]$EnvJson = "{}",

    [Parameter(Mandatory=$true, ValueFromRemainingArguments=$true)]
    [string[]]$CommandArgs
)

$ErrorActionPreference = "Stop"

# Check if storage directory exists
if (-not (Test-Path -Path $StorageDir -PathType Container)) {
    Write-Error "ERROR: Storage directory does not exist: $StorageDir"
    Write-Error "Kortex may not be installed or has been removed."
    exit 1
}

# Create log directory if it doesn't exist
$logDir = Join-Path $StorageDir $SchedulerId
if (-not (Test-Path -Path $logDir)) {
    New-Item -Path $logDir -ItemType Directory -Force | Out-Null
}

# Get start timestamp (Unix epoch)
$startTime = [int][double]::Parse((Get-Date -UFormat %s))
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logFile = Join-Path $logDir "execution-$timestamp.log"

# Write BEGIN marker
"<<<KORTEX_SCHEDULE_TASK_BEGIN>>>" | Out-File -FilePath $logFile -Encoding UTF8
"{`"id`":`"$SchedulerId`",`"timestamp`":$startTime,`"metadata`":$Metadata}" | Out-File -FilePath $logFile -Append -Encoding UTF8
"<<<KORTEX_SCHEDULE_TASK_BEGIN_DATA>>>" | Out-File -FilePath $logFile -Append -Encoding UTF8

# Execute the command and capture output
$exitCode = 0
try {
    # Join command arguments and execute
    $command = $CommandArgs -join ' '

    # Use Start-Process to properly capture output and wait for completion
    $pinfo = New-Object System.Diagnostics.ProcessStartInfo
    $pinfo.FileName = "cmd.exe"
    $pinfo.Arguments = "/c $command"
    $pinfo.RedirectStandardOutput = $true
    $pinfo.RedirectStandardError = $true
    $pinfo.UseShellExecute = $false
    $pinfo.CreateNoWindow = $true

        # Parse and set environment variables
    if ($EnvJson -ne "{}") {
        try {
            $envVars = ConvertFrom-Json $EnvJson
            foreach ($property in $envVars.PSObject.Properties) {
                $pinfo.EnvironmentVariables[$property.Name] = $property.Value
            }
        } catch {
            Write-Error "Failed to parse environment variables: $_"
        }
    }

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $pinfo
    $process.Start() | Out-Null

    # Read output while process is running
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()

    # Wait for process to complete
    $process.WaitForExit()
    $exitCode = $process.ExitCode

    # Write captured output to log file
    if ($stdout) { $stdout | Out-File -FilePath $logFile -Append -Encoding UTF8 -NoNewline }
    if ($stderr) { $stderr | Out-File -FilePath $logFile -Append -Encoding UTF8 -NoNewline }

} catch {
    $_.Exception.Message | Out-File -FilePath $logFile -Append -Encoding UTF8
    $exitCode = 1
}

# Get end timestamp
$endTime = [int][double]::Parse((Get-Date -UFormat %s))
$duration = $endTime - $startTime

Write-Host "Running command: $command got exit code: $exitCode after $duration seconds"

# Write END marker
"<<<KORTEX_SCHEDULE_TASK_END_DATA>>>" | Out-File -FilePath $logFile -Append -Encoding UTF8
"{`"id`":`"$SchedulerId`",`"timestamp`":$endTime,`"duration`":$duration,`"exitCode`":$exitCode}" | Out-File -FilePath $logFile -Append -Encoding UTF8
"<<<KORTEX_SCHEDULE_TASK_END>>>" | Out-File -FilePath $logFile -Append -Encoding UTF8

exit $exitCode
