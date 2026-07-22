param(
  [string]$BaseUrl = "http://127.0.0.1:18081"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$dataPath = Join-Path $projectRoot "data"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$stdoutPath = Join-Path $dataPath "demo-room-$timestamp.out.log"
$stderrPath = Join-Path $dataPath "demo-room-$timestamp.err.log"
$nodePath = (Get-Command node).Source
$previousBaseUrl = $env:BASE_URL

try {
  $env:BASE_URL = $BaseUrl
  $process = Start-Process `
    -FilePath $nodePath `
    -ArgumentList @("scripts/demo-room.mjs") `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -PassThru
} finally {
  $env:BASE_URL = $previousBaseUrl
}

Start-Sleep -Seconds 2
$process.Refresh()

[PSCustomObject]@{
  ProcessId = $process.Id
  Running = -not $process.HasExited
  Stdout = $stdoutPath
  Stderr = $stderrPath
} | ConvertTo-Json -Compress

if (Test-Path -LiteralPath $stdoutPath) {
  Get-Content -LiteralPath $stdoutPath -Raw
}
if ((Test-Path -LiteralPath $stderrPath) -and (Get-Item -LiteralPath $stderrPath).Length -gt 0) {
  Get-Content -LiteralPath $stderrPath -Raw
}
