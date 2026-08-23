param(
  [string]$InventoryDirectory
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $InventoryDirectory) {
  $InventoryDirectory = Join-Path $repositoryRoot "docs\manor-v7-source"
}

$rows = @(Import-Csv -LiteralPath (Join-Path $InventoryDirectory "swf-symbols.csv"))
$issues = @(Import-Csv -LiteralPath (Join-Path $InventoryDirectory "swf-issues.csv"))
if ($rows.Count -ne 4735) { throw "Expected 4735 SWF rows, found $($rows.Count)" }
if (@($rows | Where-Object { -not $_.sha256 -or -not $_.domain -or -not $_.category }).Count -gt 0) {
  throw "Every SWF row must retain source identity and classification"
}
if (@($rows | Where-Object inspection_status -eq "inspected").Count + $issues.Count -ne 4735) {
  throw "Every SWF must be inspected or listed as an issue"
}
if (@($issues | Where-Object { -not $_.error }).Count -gt 0) { throw "Every issue must include an error" }

Write-Host "QQ Farm V7 SWF inventory verification passed: $($rows.Count) files, $($issues.Count) issues"

