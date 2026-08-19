param(
  [string]$LegacyRoot,
  [string]$StageFrameDirectory,
  [string]$ContentFrameDirectory,
  [string]$RuntimeAssetDirectory,
  [string]$MappingOutputPath
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $LegacyRoot) {
  $LegacyRoot = Join-Path $repositoryRoot "..\..\20_ThirdParty\qqfarm\upload\home\qqfarm"
}
$LegacyRoot = (Resolve-Path -LiteralPath $LegacyRoot).Path
if (-not $StageFrameDirectory) {
  $StageFrameDirectory = Join-Path $repositoryRoot "data\manor-asset-work\decoration-stage-frames"
}
if (-not $ContentFrameDirectory) {
  $ContentFrameDirectory = Join-Path $repositoryRoot "data\manor-asset-work\decoration-content-frames"
}
if (-not $RuntimeAssetDirectory) {
  $RuntimeAssetDirectory = Join-Path $repositoryRoot "apps\web\public\assets\manor\classic\decorations"
}
if (-not $MappingOutputPath) {
  $MappingOutputPath = Join-Path $repositoryRoot "docs\manor-assets\decoration-runtime-assets.csv"
}

$assetTablePath = Join-Path $repositoryRoot "docs\manor-assets\decoration-assets.csv"
foreach ($path in @($assetTablePath, $StageFrameDirectory, $ContentFrameDirectory)) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Required decoration asset source not found: $path"
  }
}

function Get-Hash([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-RelativePath([string]$Root, [string]$Path) {
  return [IO.Path]::GetRelativePath($Root, $Path).Replace("\", "/")
}

function Resolve-DecorationSource($Asset) {
  switch ($Asset.selected_source_kind) {
    "swf-stage-frame" {
      $relative = $Asset.source_export_file -replace '^stage-frame/', ''
      return Join-Path $StageFrameDirectory $relative.Replace("/", "\")
    }
    "swf-content-frame" {
      $relative = $Asset.source_export_file -replace '^content-frame/', ''
      return Join-Path $ContentFrameDirectory $relative.Replace("/", "\")
    }
    "full-image" {
      return Join-Path $LegacyRoot $Asset.source_export_file.Replace("/", "\")
    }
    default { throw "Decoration $($Asset.source_id) has unsupported source kind $($Asset.selected_source_kind)" }
  }
}

$runtimeImageDirectory = Join-Path $RuntimeAssetDirectory "items"
$runtimeThumbnailDirectory = Join-Path $RuntimeAssetDirectory "thumbnails"
New-Item -ItemType Directory -Force -Path $runtimeImageDirectory, $runtimeThumbnailDirectory | Out-Null

$rows = [Collections.Generic.List[object]]::new()
$assets = @(Import-Csv -LiteralPath $assetTablePath | Where-Object integration_policy -eq "default")
foreach ($asset in $assets) {
  if ($asset.visual_review_status -ne "reviewed-ok") {
    throw "Decoration $($asset.source_id) has not passed visual review"
  }
  $sourcePath = Resolve-DecorationSource $asset
  if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
    throw "Decoration source not found: $sourcePath"
  }
  if ((Get-Hash $sourcePath) -ne $asset.source_export_sha256) {
    throw "Decoration source hash mismatch: $sourcePath"
  }

  $extension = [IO.Path]::GetExtension($sourcePath).ToLowerInvariant()
  $runtimeImagePath = Join-Path $runtimeImageDirectory "$($asset.source_id)$extension"
  Copy-Item -LiteralPath $sourcePath -Destination $runtimeImagePath -Force

  $thumbnailSourcePath = Join-Path $LegacyRoot $asset.thumbnail_file.Replace("/", "\")
  if (-not (Test-Path -LiteralPath $thumbnailSourcePath -PathType Leaf)) {
    throw "Decoration thumbnail not found: $thumbnailSourcePath"
  }
  if ((Get-Hash $thumbnailSourcePath) -ne $asset.thumbnail_sha256) {
    throw "Decoration thumbnail hash mismatch: $thumbnailSourcePath"
  }
  $runtimeThumbnailPath = Join-Path $runtimeThumbnailDirectory "$($asset.source_id).jpg"
  Copy-Item -LiteralPath $thumbnailSourcePath -Destination $runtimeThumbnailPath -Force

  $rows.Add([pscustomobject][ordered]@{
    source_id = [int]$asset.source_id
    name = $asset.name
    set_name = $asset.set_name
    item_type = [int]$asset.item_type
    item_type_name = $asset.item_type_name
    source_kind = $asset.selected_source_kind
    source_file = $asset.source_export_file
    source_sha256 = $asset.source_export_sha256
    runtime_asset = Get-RelativePath $repositoryRoot $runtimeImagePath
    runtime_sha256 = Get-Hash $runtimeImagePath
    runtime_thumbnail = Get-RelativePath $repositoryRoot $runtimeThumbnailPath
    runtime_thumbnail_sha256 = Get-Hash $runtimeThumbnailPath
    width = [int]$asset.width
    height = [int]$asset.height
    visual_review_status = $asset.visual_review_status
    processing_status = "ready"
  })
}

$rows | Sort-Object source_id | Export-Csv -LiteralPath $MappingOutputPath -NoTypeInformation -Encoding utf8
if ($rows.Count -ne 162) {
  throw "Expected 162 runtime decorations, found $($rows.Count)"
}

[pscustomobject]@{
  Decorations = $rows.Count
  Backgrounds = @($rows | Where-Object item_type_name -eq "background").Count
  Houses = @($rows | Where-Object item_type_name -eq "house").Count
  Fences = @($rows | Where-Object item_type_name -eq "fence").Count
  Doghouses = @($rows | Where-Object item_type_name -eq "doghouse").Count
  MappingOutput = $MappingOutputPath
  RuntimeAssetDirectory = $RuntimeAssetDirectory
}
