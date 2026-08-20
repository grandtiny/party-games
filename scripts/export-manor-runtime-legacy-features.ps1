param(
  [string]$LegacyRoot,
  [string]$JpexsJar = "C:\Code\30_Tools\jpexs\26.2.1\app\ffdec.jar",
  [string]$JavaExe = "java",
  [string]$WorkDirectory,
  [string]$RuntimeAssetDirectory,
  [string]$MappingOutputPath
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $LegacyRoot) {
  $LegacyRoot = Join-Path $repositoryRoot "..\..\20_ThirdParty\qqfarm\upload\home\qqfarm"
}
$LegacyRoot = (Resolve-Path $LegacyRoot).Path
if (-not $WorkDirectory) {
  $WorkDirectory = Join-Path $repositoryRoot "data\manor-asset-work\legacy-feature-export"
}
if (-not $RuntimeAssetDirectory) {
  $RuntimeAssetDirectory = Join-Path $repositoryRoot "apps\web\public\assets\manor\classic\legacy"
}
if (-not $MappingOutputPath) {
  $MappingOutputPath = Join-Path $repositoryRoot "docs\manor-assets\legacy-feature-runtime-assets.csv"
}

$mediaExporter = Join-Path $PSScriptRoot "ManorSwfMediaExporter.java"
$frameExporter = Join-Path $PSScriptRoot "ManorSwfFrameExporter.java"
$mediaOutput = Join-Path $WorkDirectory "media"
$buildingOutput = Join-Path $WorkDirectory "buildings"
$pastureBuildingDirectory = Join-Path $RuntimeAssetDirectory "..\pasture\buildings"
New-Item -ItemType Directory -Force -Path $mediaOutput, $buildingOutput, $RuntimeAssetDirectory, $pastureBuildingDirectory | Out-Null

$mediaSources = @(
  "module/nc/main/farmui1_v_12.swf",
  "module/mc/main/farmui1_v_12.swf",
  "module/mc/main/shopui2_v_9.swf"
)
$mediaRows = & $JavaExe --class-path $JpexsJar $mediaExporter $LegacyRoot $mediaOutput @mediaSources |
  ConvertFrom-Csv -Delimiter "`t"
if ($LASTEXITCODE -ne 0) {
  throw "Legacy feature media export failed"
}

$buildingSource = Join-Path $LegacyRoot "module\mc\farm\diy"
$buildingRows = & $JavaExe --class-path $JpexsJar $frameExporter $buildingSource $buildingOutput |
  ConvertFrom-Csv -Delimiter "`t"
if ($LASTEXITCODE -ne 0) {
  throw "Pasture building export failed"
}

function Copy-VerifiedAsset(
  [string]$Source,
  [string]$Destination,
  [string]$Feature,
  [string]$SourceFile,
  [string]$CharacterId
) {
  if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) {
    throw "Missing exported asset: $Source"
  }
  Copy-Item -LiteralPath $Source -Destination $Destination -Force
  $sourceHash = (Get-FileHash -LiteralPath $Source -Algorithm SHA256).Hash.ToLowerInvariant()
  $runtimeHash = (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($sourceHash -ne $runtimeHash) { throw "Runtime asset hash mismatch: $Destination" }
  return [pscustomobject][ordered]@{
    feature = $Feature
    source_file = $SourceFile
    source_character_id = $CharacterId
    source_sha256 = $sourceHash
    runtime_asset = [IO.Path]::GetRelativePath($repositoryRoot, $Destination).Replace("\", "/")
    runtime_sha256 = $runtimeHash
    status = "ready"
  }
}

$rows = [Collections.Generic.List[object]]::new()
$mediaMappings = @(
  @{ Feature = "dog-1"; Source = "module/nc/main/farmui1_v_12.swf.assets/character-21.png"; SourceFile = $mediaSources[0]; CharacterId = "21"; Destination = "dog-1.png" },
  @{ Feature = "dog-3"; Source = "module/nc/main/farmui1_v_12.swf.assets/character-85.png"; SourceFile = $mediaSources[0]; CharacterId = "85"; Destination = "dog-3.png" },
  @{ Feature = "rainy-weather"; Source = "module/nc/main/farmui1_v_12.swf.assets/character-283.png"; SourceFile = $mediaSources[0]; CharacterId = "283"; Destination = "rainy.png" },
  @{ Feature = "pasture-mosquito"; Source = "module/mc/main/farmui1_v_12.swf.assets/character-431.png"; SourceFile = $mediaSources[1]; CharacterId = "431"; Destination = "mosquito.png" },
  @{ Feature = "pasture-manure"; Source = "module/mc/main/shopui2_v_9.swf.assets/character-412.png"; SourceFile = $mediaSources[2]; CharacterId = "412"; Destination = "manure.png" }
)
foreach ($mapping in $mediaMappings) {
  $rows.Add((Copy-VerifiedAsset `
    (Join-Path $mediaOutput $mapping.Source) `
    (Join-Path $RuntimeAssetDirectory $mapping.Destination) `
    $mapping.Feature $mapping.SourceFile $mapping.CharacterId))
}

foreach ($house in @(
  @{ Feature = "pasture-hutch"; Prefix = "z2_102"; Runtime = "hutch"; Minimum = 1 },
  @{ Feature = "pasture-shed"; Prefix = "z3_103"; Runtime = "shed"; Minimum = 1 }
)) {
  foreach ($level in $house.Minimum..8) {
    $sourceName = "$($house.Prefix)_$level.swf"
    $rows.Add((Copy-VerifiedAsset `
      (Join-Path $buildingOutput "$sourceName.png") `
      (Join-Path $pastureBuildingDirectory "$($house.Runtime)-$level.png") `
      "$($house.Feature)-$level" "module/mc/farm/diy/$sourceName" "root-frame"))
  }
}

$rows | Export-Csv -LiteralPath $MappingOutputPath -NoTypeInformation -Encoding utf8
[pscustomobject]@{
  RuntimeAssets = $rows.Count
  MappingOutput = $MappingOutputPath
  RuntimeAssetDirectory = $RuntimeAssetDirectory
}
