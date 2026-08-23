param(
  [string]$InventoryDirectory
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $InventoryDirectory) {
  $InventoryDirectory = Join-Path $repositoryRoot "docs\manor-v7-source"
}

$files = @(Import-Csv -LiteralPath (Join-Path $InventoryDirectory "files.csv"))
$summary = @{}
Import-Csv -LiteralPath (Join-Path $InventoryDirectory "summary.csv") | ForEach-Object {
  $summary[$_.key] = $_.value
}
$duplicates = @(Import-Csv -LiteralPath (Join-Path $InventoryDirectory "duplicates.csv"))
$categories = @(Import-Csv -LiteralPath (Join-Path $InventoryDirectory "categories.csv"))
$database = @(Import-Csv -LiteralPath (Join-Path $InventoryDirectory "database-boundary.csv"))

if ($summary.source_version -ne "7.0 Beta1 Build 20120209.1000") { throw "Unexpected source version" }
if ($files.Count -ne 8197) { throw "Expected 8197 module files, found $($files.Count)" }
if (@($files | Where-Object { -not $_.domain -or -not $_.category -or -not $_.integration_policy }).Count -gt 0) {
  throw "Every module file must have a domain, category and integration policy"
}
if (@($files | Where-Object inventory_status -ne "inventoried").Count -gt 0) {
  throw "Every module file must be inventoried"
}
if (@($files | Where-Object extension -eq ".swf").Count -ne 4735) { throw "SWF count drifted" }
if (@($files | Where-Object extension -eq ".png").Count -ne 1249) { throw "PNG count drifted" }
if (@($files | Where-Object extension -eq ".jpg").Count -ne 2189) { throw "JPG count drifted" }
if (@($files | Where-Object extension -eq ".gif").Count -ne 21) { throw "GIF count drifted" }
if (@($files | Where-Object extension -eq ".xml").Count -ne 3) { throw "XML count drifted" }
if (@($duplicates | Group-Object duplicate_group).Count -ne 12) { throw "Duplicate group count drifted" }
if ($categories.Count -eq 0) { throw "Category summary is empty" }
if ($database.Count -ne 7 -or @($database | Where-Object migration_policy -ne "do-not-migrate").Count -gt 0) {
  throw "Database boundary must contain seven non-migrating QQ Farm tables"
}

Write-Host "QQ Farm V7 inventory verification passed: $($files.Count) files"

