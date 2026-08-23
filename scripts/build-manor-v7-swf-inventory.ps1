param(
  [string]$SourceRoot = $env:MANOR_V7_SOURCE_PATH,
  [string]$JpexsJar = "C:\Code\30_Tools\jpexs\26.2.1\app\ffdec.jar",
  [string]$InventoryDirectory
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $SourceRoot) { throw "Pass -SourceRoot or set MANOR_V7_SOURCE_PATH" }
$SourceRoot = (Resolve-Path -LiteralPath $SourceRoot).Path
$JpexsJar = (Resolve-Path -LiteralPath $JpexsJar).Path
if (-not $InventoryDirectory) {
  $InventoryDirectory = Join-Path $repositoryRoot "docs\manor-v7-source"
}

$pluginRoot = @(
  $SourceRoot
  (Join-Path $SourceRoot "wwwroot\source\plugin\qqfarm")
  (Join-Path $SourceRoot "source\plugin\qqfarm")
) | Where-Object {
  Test-Path -LiteralPath (Join-Path $_ "core\module") -PathType Container
} | Select-Object -First 1
if (-not $pluginRoot) { throw "QQ Farm V7 plugin root was not found below $SourceRoot" }

$moduleRoot = Join-Path $pluginRoot "core\module"
$javaSource = Join-Path $PSScriptRoot "ManorSwfInventory.java"
$fileInventoryPath = Join-Path $InventoryDirectory "files.csv"
foreach ($path in @($javaSource, $fileInventoryPath)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required inventory input not found: $path" }
}

$fileByPath = @{}
foreach ($row in Import-Csv -LiteralPath $fileInventoryPath) {
  $fileByPath[$row.relative_path] = $row
}

$lines = @(& java --class-path $JpexsJar $javaSource $moduleRoot)
if ($LASTEXITCODE -ne 0) { throw "JPEXS SWF inventory failed with exit code $LASTEXITCODE" }
$rawRows = @($lines | ConvertFrom-Csv -Delimiter "`t")
if ($rawRows.Count -ne 4735) { throw "Expected 4735 SWF rows, found $($rawRows.Count)" }

$rows = @($rawRows | ForEach-Object {
  $source = $fileByPath[$_.source_file]
  if (-not $source) { throw "SWF is missing from source inventory: $($_.source_file)" }
  [pscustomobject][ordered]@{
    relative_path = $_.source_file
    sha256 = $source.sha256
    domain = $source.domain
    category = $source.category
    integration_policy = $source.integration_policy
    root_class = $_.class_name
    root_sprite_id = $_.root_sprite_id
    placed_character_ids = $_.state_character_ids
    placed_depths = $_.state_depths
    sprite_ids = $_.all_sprite_ids
    symbol_classes = $_.symbol_classes
    export_assets = $_.export_assets
    display_rect_twips = $_.display_rect
    content_rect_twips = $_.content_rect
    outline_rect = $_.outline_rect
    inspection_status = if ($_.error) { "inspection-error" } else { "inspected" }
    error = $_.error
  }
})

$issues = @($rows | Where-Object inspection_status -ne "inspected")
$summary = @(
  [pscustomobject]@{ key = "swf_files"; value = $rows.Count }
  [pscustomobject]@{ key = "inspected"; value = @($rows | Where-Object inspection_status -eq "inspected").Count }
  [pscustomobject]@{ key = "inspection_errors"; value = $issues.Count }
  [pscustomobject]@{ key = "with_symbol_classes"; value = @($rows | Where-Object symbol_classes).Count }
  [pscustomobject]@{ key = "with_export_assets"; value = @($rows | Where-Object export_assets).Count }
  [pscustomobject]@{ key = "with_root_class"; value = @($rows | Where-Object root_class).Count }
)

$rows | Export-Csv -LiteralPath (Join-Path $InventoryDirectory "swf-symbols.csv") -NoTypeInformation -Encoding utf8
$issues | Export-Csv -LiteralPath (Join-Path $InventoryDirectory "swf-issues.csv") -NoTypeInformation -Encoding utf8
$summary | Export-Csv -LiteralPath (Join-Path $InventoryDirectory "swf-summary.csv") -NoTypeInformation -Encoding utf8

Write-Host "Inspected $($rows.Count) V7 SWF files; errors: $($issues.Count)"

