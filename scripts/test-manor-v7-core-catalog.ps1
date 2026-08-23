param([string]$InventoryDirectory)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $InventoryDirectory) { $InventoryDirectory = Join-Path $repositoryRoot "docs\manor-v7-source" }

$rows = @(Import-Csv -LiteralPath (Join-Path $InventoryDirectory "runtime-catalog-assets.csv"))
$issues = @(Import-Csv -LiteralPath (Join-Path $InventoryDirectory "runtime-catalog-issues.csv"))
$crops = @($rows | Where-Object domain -eq "farm")
$animals = @($rows | Where-Object domain -eq "pasture")
if ($crops.Count -ne (219 * 6)) { throw "Expected 1314 V7 crop assets, found $($crops.Count)" }
if ($animals.Count -ne (153 * 6)) { throw "Expected 918 V7 animal assets, found $($animals.Count)" }
if ($issues.Count -gt 0) { throw "V7 catalog export has $($issues.Count) blocked assets" }
if (@($rows | Where-Object { -not $_.source_sha256 -or -not $_.runtime_sha256 -or -not $_.source_class }).Count -gt 0) {
  throw "Every V7 runtime catalog asset must retain source and output identity"
}
if (@($rows | Where-Object { [int]$_.width -lt 1 -or [int]$_.height -lt 1 }).Count -gt 0) {
  throw "Every V7 runtime catalog asset must have non-zero dimensions"
}

Write-Host "QQ Farm V7 core catalog verification passed: $($rows.Count) assets"

