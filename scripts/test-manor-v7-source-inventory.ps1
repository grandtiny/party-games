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
$protocols = @(Import-Csv -LiteralPath (Join-Path $InventoryDirectory "source-protocols.csv"))
$avatars = @(Import-Csv -LiteralPath (Join-Path $InventoryDirectory "catalog-avatars.csv"))
$featureMatrix = Get-Content -LiteralPath (Join-Path $InventoryDirectory "FEATURE-MATRIX.md") -Raw -Encoding utf8

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
if ($protocols.Count -ne 252) { throw "Expected 252 protocol inventory rows, found $($protocols.Count)" }
if (@($protocols | Where-Object { -not $_.area -or -not $_.module_name -or -not $_.source_condition }).Count -gt 0) {
  throw "Every protocol row must have an area, module name and source condition"
}
$allowedProtocols = @($protocols | Where-Object allowlisted -eq "true")
if (@($allowedProtocols | Where-Object area -eq "farm").Count -ne 135) { throw "Farm protocol allowlist drifted" }
if (@($allowedProtocols | Where-Object area -eq "pasture").Count -ne 97) { throw "Pasture protocol allowlist drifted" }
if (@($protocols | Where-Object source_condition -eq "allowed-handler-missing").Count -ne 11) {
  throw "Expected 11 allowlisted protocols without source handlers"
}
if (@($protocols | Where-Object source_condition -eq "handler-not-allowlisted").Count -ne 20) {
  throw "Expected 20 source handlers outside the entry allowlists"
}
if (@($protocols | Where-Object { [int]$_.declaration_count -gt 1 }).Count -ne 5) {
  throw "Expected five duplicate protocol declarations"
}
if ($avatars.Count -ne 326) { throw "Expected 326 farm avatars, found $($avatars.Count)" }
if (@($avatars.source_id | Sort-Object -Unique).Count -ne 326) { throw "Farm avatar IDs must be unique" }
if (@($avatars | Where-Object sex -eq "M").Count -ne 167) { throw "Male farm avatar count drifted" }
if (@($avatars | Where-Object sex -eq "F").Count -ne 159) { throw "Female farm avatar count drifted" }
if (@($avatars | Where-Object {
  [int]$_.width -ne 140 -or
  [int]$_.height -ne 226 -or
  $_.asset_status -ne "complete" -or
  $_.integration_policy -ne "core-candidate"
}).Count -gt 0) {
  throw "Farm avatar dimensions or integration status drifted"
}

$featureDefinitionMatch = [regex]::Match($featureMatrix, '(?ms)\A.*?(?=^## 15\.)')
if (-not $featureDefinitionMatch.Success) { throw "Feature matrix detail boundary was not found" }
$featureRows = @([regex]::Matches(
  $featureDefinitionMatch.Value,
  '(?m)^\| (?<id>[A-Z]+-[0-9]+) \|[^|\r\n]*\| (?<status>[^|\r\n]+?) \|'
) | ForEach-Object {
  [pscustomobject]@{
    id = $_.Groups["id"].Value
    status = $_.Groups["status"].Value.Trim()
  }
} | Where-Object id -notlike "D-*")
$allowedFeatureStatuses = @("已实现", "部分实现", "特殊实现", "未实现", "放弃", "待确认", "源残留")
if ($featureRows.Count -ne 235) { throw "Expected 235 stable feature rows, found $($featureRows.Count)" }
if (@($featureRows | Group-Object id | Where-Object Count -gt 1).Count -gt 0) {
  throw "Feature matrix contains duplicate stable IDs"
}
if (@($featureRows | Where-Object status -notin $allowedFeatureStatuses).Count -gt 0) {
  throw "Feature matrix contains an unknown status"
}
$expectedStatusCounts = @{
  "已实现" = 112
  "部分实现" = 12
  "特殊实现" = 23
  "未实现" = 35
  "放弃" = 44
  "待确认" = 3
  "源残留" = 6
}
foreach ($status in $expectedStatusCounts.Keys) {
  $actualCount = @($featureRows | Where-Object status -eq $status).Count
  if ($actualCount -ne $expectedStatusCounts[$status]) {
    throw "Feature matrix status '$status' drifted: expected $($expectedStatusCounts[$status]), found $actualCount"
  }
}

function Assert-StatusIndex([string]$Status, [string]$SectionPattern) {
  $sectionMatch = [regex]::Match($featureMatrix, $SectionPattern)
  if (-not $sectionMatch.Success) {
    throw "Feature matrix status index section was not found for '$Status'"
  }

  $expectedIds = @($featureRows | Where-Object status -eq $Status | ForEach-Object id | Sort-Object -Unique)
  $indexedIds = @([regex]::Matches($sectionMatch.Value, '[A-Z]+-[0-9]+') | ForEach-Object Value |
    Where-Object { $_ -notlike 'D-*' } | Sort-Object -Unique)
  $missingIds = @($expectedIds | Where-Object { $_ -notin $indexedIds })
  $unexpectedIds = @($indexedIds | Where-Object { $_ -notin $expectedIds })
  if ($missingIds.Count -gt 0 -or $unexpectedIds.Count -gt 0) {
    throw "Feature matrix status index '$Status' drifted: missing [$($missingIds -join ', ')], unexpected [$($unexpectedIds -join ', ')]"
  }
}

Assert-StatusIndex "未实现" '(?ms)^### 15\.1 .*?(?=^### 15\.2 )'
Assert-StatusIndex "待确认" '(?ms)^### 15\.2 .*?(?=^### 15\.3 )'
Assert-StatusIndex "部分实现" '(?ms)^### 15\.3 .*?(?=^### 15\.4 )'
Assert-StatusIndex "特殊实现" '(?ms)^### 15\.4 .*?(?=^## 16\.)'
Assert-StatusIndex "放弃" '(?ms)^## 16\..*?(?=^## 17\.)'
Assert-StatusIndex "源残留" '(?ms)^## 17\..*?(?=^## 18\.)'

$backtick = [char]96
$undocumentedProtocols = @($protocols | Where-Object {
  -not $featureMatrix.Contains($backtick + $_.module_name + $backtick)
})
if ($undocumentedProtocols.Count -gt 0) {
  throw "Feature matrix does not mention source protocols: $($undocumentedProtocols.module_name -join ', ')"
}

Write-Host "QQ Farm V7 inventory verification passed: $($files.Count) files, $($protocols.Count) protocol rows, $($featureRows.Count) features"
