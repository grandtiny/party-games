param(
  [string]$SourceRoot = $env:MANOR_V7_SOURCE_PATH,
  [string]$JpexsJar = "C:\Code\30_Tools\jpexs\26.2.1\app\ffdec.jar",
  [string]$InventoryDirectory,
  [string]$RuntimeDirectory
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $SourceRoot) { throw "Pass -SourceRoot or set MANOR_V7_SOURCE_PATH" }
$SourceRoot = (Resolve-Path -LiteralPath $SourceRoot).Path
$JpexsJar = (Resolve-Path -LiteralPath $JpexsJar).Path
if (-not $InventoryDirectory) { $InventoryDirectory = Join-Path $repositoryRoot "docs\manor-v7-source" }
if (-not $RuntimeDirectory) { $RuntimeDirectory = Join-Path $repositoryRoot "apps\web\public\assets\manor\v7-runtime" }

$pluginRoot = @(
  $SourceRoot
  (Join-Path $SourceRoot "wwwroot\source\plugin\qqfarm")
  (Join-Path $SourceRoot "source\plugin\qqfarm")
) | Where-Object { Test-Path -LiteralPath (Join-Path $_ "core\module") -PathType Container } | Select-Object -First 1
if (-not $pluginRoot) { throw "QQ Farm V7 plugin root was not found below $SourceRoot" }

$workDirectory = Join-Path $repositoryRoot "data\manor-asset-work\v7-runtime"
$cropIdsPath = Join-Path $workDirectory "crop-ids.txt"
$animalIdsPath = Join-Path $workDirectory "animal-ids.txt"
$javaSource = Join-Path $PSScriptRoot "ManorV7CatalogExporter.java"
New-Item -ItemType Directory -Force -Path $workDirectory, $RuntimeDirectory | Out-Null

$crops = @(Import-Csv -LiteralPath (Join-Path $InventoryDirectory "catalog-crops.csv") | Where-Object integration_policy -eq "core-candidate")
$animals = @(Import-Csv -LiteralPath (Join-Path $InventoryDirectory "catalog-animals.csv") | Where-Object integration_policy -eq "core-candidate")
$crops.source_id | Set-Content -LiteralPath $cropIdsPath -Encoding ascii
$animals.source_id | Set-Content -LiteralPath $animalIdsPath -Encoding ascii

$cropLines = @(& java --class-path $JpexsJar $javaSource "crop" (Join-Path $pluginRoot "core\module\ui\allcrops") $RuntimeDirectory $cropIdsPath)
if ($LASTEXITCODE -ne 0) { throw "V7 crop export failed with exit code $LASTEXITCODE" }
$cropRows = @($cropLines | ConvertFrom-Csv -Delimiter "`t")

$animalLines = @(& java --class-path $JpexsJar $javaSource "animal" (Join-Path $pluginRoot "core\module\mc\farm\aswf") $RuntimeDirectory $animalIdsPath)
if ($LASTEXITCODE -ne 0) { throw "V7 animal export failed with exit code $LASTEXITCODE" }
$animalRows = @($animalLines | ConvertFrom-Csv -Delimiter "`t")

$rows = @($cropRows + $animalRows)
$sourceFiles = @{}
foreach ($source in Import-Csv -LiteralPath (Join-Path $InventoryDirectory "files.csv")) { $sourceFiles[$source.relative_path] = $source }
$manifest = @($rows | ForEach-Object {
  $source = if ($_.source_file) { $sourceFiles[$_.source_file] } else { $null }
  $runtimePath = if ($_.runtime_asset) { Join-Path $RuntimeDirectory ($_.runtime_asset.Replace("/", "\")) } else { "" }
  [pscustomobject][ordered]@{
    domain = $_.domain
    source_id = $_.source_id
    state_key = $_.state_key
    source_file = $_.source_file
    source_sha256 = if ($source) { $source.sha256 } else { "" }
    source_class = $_.source_class
    character_id = $_.character_id
    rendered_character_id = $_.rendered_character_id
    export_strategy = $_.export_strategy
    frame_count = $_.frame_count
    selected_frame = $_.selected_frame
    content_rect_twips = $_.content_rect_twips
    width = $_.width
    height = $_.height
    runtime_asset = if ($_.runtime_asset) { "apps/web/public/assets/manor/v7-runtime/$($_.runtime_asset)" } else { "" }
    runtime_sha256 = if ($runtimePath -and (Test-Path -LiteralPath $runtimePath -PathType Leaf)) { (Get-FileHash -LiteralPath $runtimePath -Algorithm SHA256).Hash.ToLowerInvariant() } else { "" }
    processing_status = if ($_.error) { "blocked" } else { "exported-root-symbol" }
    error = $_.error
  }
})

$manifest | Export-Csv -LiteralPath (Join-Path $InventoryDirectory "runtime-catalog-assets.csv") -NoTypeInformation -Encoding utf8
$manifest | Where-Object processing_status -eq "blocked" | Export-Csv -LiteralPath (Join-Path $InventoryDirectory "runtime-catalog-issues.csv") -NoTypeInformation -Encoding utf8

Write-Host "Exported $(@($manifest | Where-Object processing_status -eq 'exported-root-symbol').Count) V7 catalog assets; blocked: $(@($manifest | Where-Object processing_status -eq 'blocked').Count)"
