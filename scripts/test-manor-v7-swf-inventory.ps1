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
$runtimeModuleRoot = Join-Path $repositoryRoot "apps\web\public\assets\manor\v7-swf\module"
if ($rows.Count -ne 4735) { throw "Expected 4735 SWF rows, found $($rows.Count)" }
if (@($rows | Where-Object { -not $_.sha256 -or -not $_.domain -or -not $_.category }).Count -gt 0) {
  throw "Every SWF row must retain source identity and classification"
}
if (@($rows | Where-Object inspection_status -eq "inspected").Count + $issues.Count -ne 4735) {
  throw "Every SWF must be inspected or listed as an issue"
}
if (@($issues | Where-Object { -not $_.error }).Count -gt 0) { throw "Every issue must include an error" }

$runtimePaths = @(Get-ChildItem -LiteralPath $runtimeModuleRoot -Recurse -File -Filter "*.swf" | ForEach-Object {
  $_.FullName.Substring($runtimeModuleRoot.Length).TrimStart("\").Replace("\", "/")
})
if ($runtimePaths.Count -ne 4735) { throw "Expected 4735 runtime SWFs, found $($runtimePaths.Count)" }
$runtimePathSet = [System.Collections.Generic.HashSet[string]]::new([string[]]$runtimePaths, [System.StringComparer]::OrdinalIgnoreCase)
$missingRuntimePaths = @($rows | Where-Object { -not $runtimePathSet.Contains($_.relative_path) })
if ($missingRuntimePaths.Count -gt 0) {
  throw "Runtime is missing source SWFs: $($missingRuntimePaths.relative_path -join ', ')"
}

Write-Host "QQ Farm V7 SWF inventory verification passed: $($rows.Count) source and runtime files, $($issues.Count) source issues"
