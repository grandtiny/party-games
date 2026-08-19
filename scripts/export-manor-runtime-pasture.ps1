param(
  [string]$AnimalInventoryDirectory,
  [string]$InterfaceInventoryDirectory,
  [string]$RuntimeAssetDirectory,
  [string]$AnimalMappingOutputPath,
  [string]$UiMappingOutputPath
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $AnimalInventoryDirectory) {
  $AnimalInventoryDirectory = Join-Path $repositoryRoot "data\manor-asset-work\animal-export"
}
if (-not $InterfaceInventoryDirectory) {
  $InterfaceInventoryDirectory = Join-Path $repositoryRoot "data\manor-asset-work\interface-media-export"
}
if (-not $RuntimeAssetDirectory) {
  $RuntimeAssetDirectory = Join-Path $repositoryRoot "apps\web\public\assets\manor\classic\pasture"
}
if (-not $AnimalMappingOutputPath) {
  $AnimalMappingOutputPath = Join-Path $repositoryRoot "docs\manor-assets\animal-runtime-assets.csv"
}
if (-not $UiMappingOutputPath) {
  $UiMappingOutputPath = Join-Path $repositoryRoot "docs\manor-assets\pasture-runtime-ui-assets.csv"
}

$animalStateTablePath = Join-Path $repositoryRoot "docs\manor-assets\animal-state-assets.csv"
$animalVisualReviewPath = Join-Path $repositoryRoot "docs\manor-assets\animal-visual-review.csv"
$interfaceSymbolTablePath = Join-Path $repositoryRoot "docs\manor-assets\interface-symbol-assets.csv"
foreach ($path in @(
  $animalStateTablePath,
  $animalVisualReviewPath,
  $interfaceSymbolTablePath,
  $AnimalInventoryDirectory,
  $InterfaceInventoryDirectory
)) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Required pasture asset source not found: $path"
  }
}

function Get-Hash([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-RelativePath([string]$Root, [string]$Path) {
  return [IO.Path]::GetRelativePath($Root, $Path).Replace("\", "/")
}

function Resolve-InventoryPath([string]$Root, [string]$RelativePath) {
  $path = Join-Path $Root $RelativePath.Replace("/", "\")
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Pasture inventory asset not found: $path"
  }
  return (Resolve-Path -LiteralPath $path).Path
}

function Copy-VerifiedAsset(
  [string]$SourcePath,
  [string]$ExpectedHash,
  [string]$DestinationPath
) {
  $sourceHash = Get-Hash $SourcePath
  if ($sourceHash -ne $ExpectedHash) {
    throw "Source hash mismatch for $SourcePath"
  }
  $destinationDirectory = Split-Path -Parent $DestinationPath
  New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null
  Copy-Item -LiteralPath $SourcePath -Destination $DestinationPath -Force
  $runtimeHash = Get-Hash $DestinationPath
  if ($runtimeHash -ne $sourceHash) {
    throw "Runtime copy hash mismatch for $DestinationPath"
  }
  return $runtimeHash
}

$reviewStatuses = @{}
foreach ($review in Import-Csv -LiteralPath $animalVisualReviewPath) {
  $reviewStatuses[$review.source_id] = $review.review_status
}

$animalRuntimeDirectory = Join-Path $RuntimeAssetDirectory "animals"
$animalRows = [Collections.Generic.List[object]]::new()
foreach ($asset in Import-Csv -LiteralPath $animalStateTablePath) {
  $reviewStatus = $reviewStatuses[$asset.source_id]
  if ($reviewStatus -notin @("reviewed-ok", "reviewed-with-note")) {
    throw "Animal $($asset.source_id) has not passed visual review"
  }
  $sourcePath = Resolve-InventoryPath $AnimalInventoryDirectory $asset.source_export_file
  $runtimePath = Join-Path $animalRuntimeDirectory "$($asset.source_id)\$($asset.state_key).png"
  $runtimeHash = Copy-VerifiedAsset $sourcePath $asset.source_sha256 $runtimePath
  $animalRows.Add([pscustomobject][ordered]@{
    source_id = [int]$asset.source_id
    name = $asset.name
    runtime_status = [int]$asset.runtime_status
    state_key = $asset.state_key
    source_character_id = [int]$asset.source_character_id
    source_export_file = $asset.source_export_file
    source_sha256 = $asset.source_sha256
    runtime_asset = Get-RelativePath $repositoryRoot $runtimePath
    runtime_sha256 = $runtimeHash
    visual_review_status = $reviewStatus
    processing_status = "ready"
  })
}

$uiDefinitions = @(
  [pscustomobject]@{ Entry = "DefaultBg"; RuntimeName = "background.png" },
  [pscustomobject]@{ Entry = "HeadBg"; RuntimeName = "head-bg.png" },
  [pscustomobject]@{ Entry = "ToolBarBg"; RuntimeName = "toolbar-bg.png" },
  [pscustomobject]@{ Entry = "WindowBg"; RuntimeName = "window-bg.png" },
  [pscustomobject]@{ Entry = "ButtonFarm"; RuntimeName = "nav-farm.png" },
  [pscustomobject]@{ Entry = "ButtonMC"; RuntimeName = "nav-pasture.png" },
  [pscustomobject]@{ Entry = "ButtonWarehouse"; RuntimeName = "nav-warehouse.png" },
  [pscustomobject]@{ Entry = "ButtonShop"; RuntimeName = "nav-shop.png" },
  [pscustomobject]@{ Entry = "ButtonDecorate"; RuntimeName = "nav-decorate.png" },
  [pscustomobject]@{ Entry = "Grass"; RuntimeName = "grass.png" },
  [pscustomobject]@{ Entry = "Mucao"; RuntimeName = "trough.png" },
  [pscustomobject]@{ Entry = "MucaoGoumai"; RuntimeName = "trough-buy.png" },
  [pscustomobject]@{ Entry = "ButtonHand"; RuntimeName = "tool-hand.png" },
  [pscustomobject]@{ Entry = "ButtonSeed"; RuntimeName = "tool-animal.png" },
  [pscustomobject]@{ Entry = "FlapperButton"; RuntimeName = "tool-poop.png" },
  [pscustomobject]@{ Entry = "FlyButton"; RuntimeName = "tool-fly.png" },
  [pscustomobject]@{ Entry = "ShengChanButton"; RuntimeName = "tool-produce.png" },
  [pscustomobject]@{ Entry = "ButtonTheft"; RuntimeName = "tool-steal.png" },
  [pscustomobject]@{ Entry = "WhistleButton"; RuntimeName = "tool-whistle.png" },
  [pscustomobject]@{ Entry = "FoodTips"; RuntimeName = "food-tip.png" },
  [pscustomobject]@{ Entry = "ItemBg"; RuntimeName = "item-bg.png" },
  [pscustomobject]@{ Entry = "CloseButton"; RuntimeName = "close.png" },
  [pscustomobject]@{ Entry = "Animalnfo"; RuntimeName = "animal-info.png" },
  [pscustomobject]@{ Entry = "ProductInfo"; RuntimeName = "product-info.png" }
)
$interfaceRows = @(Import-Csv -LiteralPath $interfaceSymbolTablePath)
$uiRuntimeDirectory = Join-Path $RuntimeAssetDirectory "ui"
$uiRows = [Collections.Generic.List[object]]::new()
foreach ($definition in $uiDefinitions) {
  $matches = @($interfaceRows | Where-Object {
    $_.source_file -eq "module/mc/main/farmui1_v_12.swf" -and
    $_.entry_name -eq $definition.Entry -and
    $_.render_status -eq "rendered"
  })
  if ($matches.Count -ne 1) {
    throw "Expected one rendered pasture UI entry named $($definition.Entry), found $($matches.Count)"
  }
  $asset = $matches[0]
  if ([int]$asset.visible_pixels -le 0) {
    throw "Pasture UI entry $($definition.Entry) has no visible pixels"
  }
  $sourcePath = Resolve-InventoryPath $InterfaceInventoryDirectory $asset.source_export_file
  $runtimePath = Join-Path $uiRuntimeDirectory $definition.RuntimeName
  $runtimeHash = Copy-VerifiedAsset $sourcePath $asset.source_export_sha256 $runtimePath
  $uiRows.Add([pscustomobject][ordered]@{
    entry_name = $asset.entry_name
    source_character_id = [int]$asset.source_character_id
    source_export_file = $asset.source_export_file
    source_sha256 = $asset.source_export_sha256
    runtime_asset = Get-RelativePath $repositoryRoot $runtimePath
    runtime_sha256 = $runtimeHash
    width = [int]$asset.width
    height = [int]$asset.height
    processing_status = "ready"
  })
}

$animalRows | Export-Csv -LiteralPath $AnimalMappingOutputPath -NoTypeInformation -Encoding utf8
$uiRows | Export-Csv -LiteralPath $UiMappingOutputPath -NoTypeInformation -Encoding utf8
if ($animalRows.Count -ne 210) {
  throw "Expected 210 animal runtime assets, found $($animalRows.Count)"
}
if ($uiRows.Count -ne $uiDefinitions.Count) {
  throw "Expected $($uiDefinitions.Count) pasture UI runtime assets, found $($uiRows.Count)"
}

[pscustomobject]@{
  Animals = @($animalRows | Select-Object -ExpandProperty source_id -Unique).Count
  AnimalRuntimeAssets = $animalRows.Count
  UiRuntimeAssets = $uiRows.Count
  AnimalMappingOutput = $AnimalMappingOutputPath
  UiMappingOutput = $UiMappingOutputPath
  RuntimeAssetDirectory = $RuntimeAssetDirectory
}
