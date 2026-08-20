param(
  [string]$LegacyRoot,
  [string]$JpexsJar = "C:\Code\30_Tools\jpexs\26.2.1\app\ffdec.jar",
  [string]$JavaExe = "java",
  [string]$InventoryDirectory,
  [string]$RuntimeAssetDirectory,
  [string]$MappingOutputPath,
  [switch]$SkipJpexsExport
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $LegacyRoot) {
  $LegacyRoot = Join-Path $repositoryRoot "..\..\20_ThirdParty\qqfarm\upload\home\qqfarm"
}
$LegacyRoot = (Resolve-Path $LegacyRoot).Path
if (-not $InventoryDirectory) {
  $InventoryDirectory = Join-Path $repositoryRoot "data\manor-asset-work\crop-export"
}
if (-not $RuntimeAssetDirectory) {
  $RuntimeAssetDirectory = Join-Path $repositoryRoot "apps\web\public\assets\manor\classic\crops"
}
if (-not $MappingOutputPath) {
  $MappingOutputPath = Join-Path $repositoryRoot "docs\manor-assets\crop-runtime-assets.csv"
}

$cropDirectory = Join-Path $LegacyRoot "module\nc\crops"
$cropTablePath = Join-Path $repositoryRoot "docs\manor-assets\crops.csv"
$visualReviewPath = Join-Path $repositoryRoot "docs\manor-assets\crop-visual-review.csv"
foreach ($path in @($cropTablePath, $visualReviewPath)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Required crop table not found: $path"
  }
}

New-Item -ItemType Directory -Force -Path $InventoryDirectory, $RuntimeAssetDirectory | Out-Null
if (-not $SkipJpexsExport) {
  if (-not (Test-Path -LiteralPath $JpexsJar -PathType Leaf)) {
    throw "JPEXS jar not found: $JpexsJar"
  }
  & $JavaExe -jar $JpexsJar -onerror abort -export sprite $InventoryDirectory $cropDirectory
  if ($LASTEXITCODE -ne 0) {
    throw "JPEXS crop sprite export failed"
  }
}

function Get-Hash([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-RelativePath([string]$Root, [string]$Path) {
  return [IO.Path]::GetRelativePath($Root, $Path).Replace("\", "/")
}

function Get-StateSpritePath([string]$CropExportDirectory, [string]$CharacterId) {
  $spriteDirectory = Join-Path $CropExportDirectory "sprites"
  if (-not (Test-Path -LiteralPath $spriteDirectory -PathType Container)) {
    $spriteDirectory = $CropExportDirectory
  }
  $pattern = '^DefineSprite_' + [regex]::Escape($CharacterId) + '(?:_|$)'
  $matches = @(Get-ChildItem -LiteralPath $spriteDirectory -Directory | Where-Object Name -Match $pattern)
  if ($matches.Count -ne 1) {
    throw "Expected one sprite directory for character $CharacterId in $spriteDirectory, found $($matches.Count)"
  }
  $frames = @(Get-ChildItem -LiteralPath $matches[0].FullName -File -Filter "*.png" | Sort-Object Name)
  if ($frames.Count -ne 1) {
    throw "Expected one PNG frame for character $CharacterId in $($matches[0].FullName), found $($frames.Count)"
  }
  return $frames[0].FullName
}

$stageDefinitions = @(
  [pscustomobject]@{ RuntimeStage = 0; RuntimeKey = "seed"; StateIndex = 0; StateKey = "seed" },
  [pscustomobject]@{ RuntimeStage = 1; RuntimeKey = "sprout"; StateIndex = 1; StateKey = "sprout" },
  [pscustomobject]@{ RuntimeStage = 2; RuntimeKey = "young"; StateIndex = 2; StateKey = "young" },
  [pscustomobject]@{ RuntimeStage = 3; RuntimeKey = "growing"; StateIndex = 3; StateKey = "growing" },
  [pscustomobject]@{ RuntimeStage = 4; RuntimeKey = "pre_mature"; StateIndex = 4; StateKey = "pre_mature" },
  [pscustomobject]@{ RuntimeStage = 5; RuntimeKey = "mature"; StateIndex = 5; StateKey = "mature" },
  [pscustomobject]@{ RuntimeStage = 6; RuntimeKey = "withered"; StateIndex = 6; StateKey = "withered" }
)
$stageOverrides = @{
  # Rice's early top-level states include a field tile. The scene needs the plant-only child sprite.
  "60:1" = [pscustomobject]@{ StateIndex = 2; StateKey = "young"; CharacterId = 14; Relationship = "nested-character-of-state" }
  "60:2" = [pscustomobject]@{ StateIndex = 2; StateKey = "young"; CharacterId = 14; Relationship = "nested-character-of-state" }
  "60:3" = [pscustomobject]@{ StateIndex = 4; StateKey = "pre_mature"; CharacterId = 44; Relationship = "state-character" }
  "60:4" = [pscustomobject]@{ StateIndex = 4; StateKey = "pre_mature"; CharacterId = 44; Relationship = "state-character" }
  "61:3" = [pscustomobject]@{ StateIndex = 4; StateKey = "pre_mature"; CharacterId = 22; Relationship = "state-character" }
  "61:4" = [pscustomobject]@{ StateIndex = 4; StateKey = "pre_mature"; CharacterId = 22; Relationship = "state-character" }
}

$visualReviews = @{}
foreach ($review in Import-Csv -LiteralPath $visualReviewPath) {
  $visualReviews[$review.source_id] = $review.review_status
}

$mappingRows = [Collections.Generic.List[object]]::new()
$crops = @(Import-Csv -LiteralPath $cropTablePath)
foreach ($crop in $crops) {
  $cropExportDirectory = Join-Path $InventoryDirectory "Crop_$($crop.source_id).swf"
  if (-not (Test-Path -LiteralPath $cropExportDirectory -PathType Container)) {
    throw "Missing JPEXS export directory: $cropExportDirectory"
  }
  $characterIds = @($crop.state_character_ids -split ",")
  if ($characterIds.Count -ne 7) {
    throw "Crop $($crop.source_id) expected seven state character IDs, found $($characterIds.Count)"
  }

  $runtimeCropDirectory = Join-Path $RuntimeAssetDirectory $crop.source_id
  New-Item -ItemType Directory -Force -Path $runtimeCropDirectory | Out-Null
  foreach ($stage in $stageDefinitions) {
    $stateIndex = $stage.StateIndex
    $stateKey = $stage.StateKey
    $sourceCharacterId = [int]$characterIds[$stateIndex]
    $relationship = "state-character"
    $overrideKey = "$($crop.source_id):$($stage.RuntimeStage)"
    if ($stageOverrides.ContainsKey($overrideKey)) {
      $override = $stageOverrides[$overrideKey]
      $stateIndex = $override.StateIndex
      $stateKey = $override.StateKey
      $sourceCharacterId = $override.CharacterId
      $relationship = $override.Relationship
    }

    $sourceImagePath = Get-StateSpritePath $cropExportDirectory $sourceCharacterId
    $runtimeImagePath = Join-Path $runtimeCropDirectory "$($stage.RuntimeKey).png"
    Copy-Item -LiteralPath $sourceImagePath -Destination $runtimeImagePath -Force
    $sourceHash = Get-Hash $sourceImagePath
    $runtimeHash = Get-Hash $runtimeImagePath
    if ($runtimeHash -ne $sourceHash) {
      throw "Runtime copy hash mismatch for crop $($crop.source_id), stage $($stage.RuntimeKey)"
    }

    $mappingRows.Add([pscustomobject][ordered]@{
      source_id = [int]$crop.source_id
      runtime_id = if ($crop.current_id) { $crop.current_id } else { "legacy-$($crop.source_id)" }
      name = $crop.name
      runtime_stage = $stage.RuntimeStage
      runtime_stage_key = $stage.RuntimeKey
      linked_state_index = $stateIndex
      linked_state_key = $stateKey
      source_character_id = $sourceCharacterId
      source_relationship = $relationship
      source_export_file = Get-RelativePath $InventoryDirectory $sourceImagePath
      source_sha256 = $sourceHash
      runtime_asset = Get-RelativePath $repositoryRoot $runtimeImagePath
      runtime_sha256 = $runtimeHash
      visual_review_status = $visualReviews[$crop.source_id]
      processing_status = "ready"
    })
  }
}

$mappingRows | Export-Csv -LiteralPath $MappingOutputPath -NoTypeInformation -Encoding utf8
if ($mappingRows.Count -ne 602) {
  throw "Expected 602 runtime crop mappings, found $($mappingRows.Count)"
}

[pscustomobject]@{
  Crops = $crops.Count
  RuntimeAssets = $mappingRows.Count
  Reviewed = @($mappingRows | Where-Object visual_review_status -eq "reviewed-ok").Count
  MappingOutput = $MappingOutputPath
  RuntimeAssetDirectory = $RuntimeAssetDirectory
}
