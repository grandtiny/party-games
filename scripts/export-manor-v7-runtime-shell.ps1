param(
  [string]$SourceRoot = $env:MANOR_V7_SOURCE_PATH,
  [string]$JpexsJar = "C:\Code\30_Tools\jpexs\26.2.1\app\ffdec-cli.jar"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $SourceRoot -and (Test-Path -LiteralPath "D:\QQnc" -PathType Container)) {
  $SourceRoot = "D:\QQnc"
}
if (-not $SourceRoot) {
  throw "Pass -SourceRoot or set MANOR_V7_SOURCE_PATH"
}

$SourceRoot = (Resolve-Path -LiteralPath $SourceRoot).Path
$JpexsJar = (Resolve-Path -LiteralPath $JpexsJar).Path
$pluginRoot = @(
  $SourceRoot
  (Join-Path $SourceRoot "wwwroot\source\plugin\qqfarm")
  (Join-Path $SourceRoot "source\plugin\qqfarm")
) | Where-Object {
  Test-Path -LiteralPath (Join-Path $_ "core\module\main3_v_140.swf") -PathType Leaf
} | Select-Object -First 1
if (-not $pluginRoot) {
  throw "QQ Farm 7.0 plugin root was not found below $SourceRoot"
}

$moduleRoot = Join-Path $pluginRoot "core\module"
$farmUi = Join-Path $moduleRoot "ui\main\farmui_full_v_32.swf"
$farmUi2 = Join-Path $moduleRoot "ui\main\farmui2_v_34.swf"
$farmWater = Join-Path $moduleRoot "ui\water_v_5.swf"
$pastureUi = Join-Path $moduleRoot "mc\main\farmui1_v_40.swf"
$farmDiyRoot = Join-Path $moduleRoot "ui\farm\diy"
$pastureDiyRoot = Join-Path $moduleRoot "mc\farm\diy"
$frameExporter = Join-Path $PSScriptRoot "ManorSwfFrameExporter.java"

$requiredSources = @(
  $farmUi,
  $farmUi2,
  $farmWater,
  $pastureUi,
  $frameExporter,
  (Join-Path $pastureDiyRoot "z1_105_1.swf"),
  (Join-Path $pastureDiyRoot "z1_224_1.swf")
)
$requiredSources += 1..4 | ForEach-Object { Join-Path $farmDiyRoot "$_.swf" }
$requiredSources += 1..8 | ForEach-Object { Join-Path $pastureDiyRoot "z2_102_$_.swf" }
$requiredSources += 1..8 | ForEach-Object { Join-Path $pastureDiyRoot "z3_103_$_.swf" }
foreach ($path in $requiredSources) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Required QQ Farm 7.0 source was not found: $path"
  }
}

$workRoot = Join-Path $repositoryRoot "data\manor-asset-work\v7-runtime-shell"
$farmUiExport = Join-Path $workRoot "farm-ui"
$farmUi2Export = Join-Path $workRoot "farm-ui-2"
$farmWaterExport = Join-Path $workRoot "farm-water"
$pastureUiExport = Join-Path $workRoot "pasture-ui"
$farmSceneSource = Join-Path $workRoot "farm-scene-source"
$farmSceneFrames = Join-Path $workRoot "farm-scene-frames"
$farmSceneContent = Join-Path $workRoot "farm-scene-content"
$pastureSceneSource = Join-Path $workRoot "pasture-scene-source"
$pastureSceneContent = Join-Path $workRoot "pasture-scene-content"
$pastureDefaultMedia = Join-Path $workRoot "pasture-default-media"
$publicRoot = Join-Path $repositoryRoot "apps\web\public\assets\manor\v7-runtime"

New-Item -ItemType Directory -Force -Path @(
  $farmUiExport,
  $farmUi2Export,
  $farmWaterExport,
  $pastureUiExport,
  $farmSceneSource,
  $farmSceneFrames,
  $farmSceneContent,
  $pastureSceneSource,
  $pastureSceneContent,
  $pastureDefaultMedia,
  $publicRoot
) | Out-Null

function Invoke-JpexsExport {
  param(
    [Parameter(Mandatory)] [string]$Source,
    [Parameter(Mandatory)] [string]$Destination,
    [Parameter(Mandatory)] [string]$CharacterIds
  )

  $arguments = @(
    "-jar", $JpexsJar,
    "-onerror", "abort",
    "-ignorebackground",
    "-selectid", $CharacterIds,
    "-export", "sprite,button",
    $Destination,
    $Source
  )
  & java @arguments
  if ($LASTEXITCODE -ne 0) {
    throw "JPEXS export failed for $Source with exit code $LASTEXITCODE"
  }
}

function Get-RelativeV7SourcePath {
  param([Parameter(Mandatory)] [string]$Path)

  return (Resolve-Path -LiteralPath $Path).Path.Substring($moduleRoot.Length + 1).Replace("\", "/")
}

function New-AssetDescriptor {
  param(
    [Parameter(Mandatory)] [string]$Destination,
    [Parameter(Mandatory)] [string]$ExportedFile,
    [Parameter(Mandatory)] [string]$SourceFile,
    [Parameter(Mandatory)] [string]$Strategy,
    [string]$Symbol = "",
    [string]$Frame = "1"
  )

  return [pscustomobject]@{
    destination = $Destination
    exported_file = $ExportedFile
    source_file = $SourceFile
    strategy = $Strategy
    symbol = $Symbol
    frame = $Frame
  }
}

Invoke-JpexsExport -Source $farmUi -Destination $farmUiExport -CharacterIds "35,100,105,108,111,114,123,271,454,456,461,467,469,471,486,489,491,493,495,497,502,506,529,537,510"
Invoke-JpexsExport -Source $farmUi2 -Destination $farmUi2Export -CharacterIds "5,6,184,193,268,274,275,286,287,292"
Invoke-JpexsExport -Source $farmWater -Destination $farmWaterExport -CharacterIds "27,30"
Invoke-JpexsExport -Source $pastureUi -Destination $pastureUiExport -CharacterIds "76,160,164,175,179,181,212,214,216,218,220,223,225,227,255,258,283,289,336,396,399"
Invoke-JpexsExport -Source $farmUi -Destination $farmUiExport -CharacterIds "170,173,176,179,182,185,189,192,193,196,201,204,225"

foreach ($id in 1..4) {
  Copy-Item -LiteralPath (Join-Path $farmDiyRoot "$id.swf") -Destination (Join-Path $farmSceneSource "$id.swf") -Force
}

$backgroundArguments = @(
  "-jar", $JpexsJar,
  "-onerror", "abort",
  "-ignorebackground",
  "-select", "0:1",
  "-export", "frame",
  $farmSceneFrames,
  (Join-Path $farmSceneSource "1.swf")
)
& java @backgroundArguments
if ($LASTEXITCODE -ne 0) {
  throw "JPEXS default farm background export failed with exit code $LASTEXITCODE"
}

$farmRows = & java --class-path $JpexsJar $frameExporter $farmSceneSource $farmSceneContent |
  ConvertFrom-Csv -Delimiter "`t"
if ($LASTEXITCODE -ne 0 -or @($farmRows | Where-Object error).Count -gt 0) {
  throw "Content-bound QQ Farm 7.0 farm scene export failed"
}

Copy-Item -LiteralPath (Join-Path $pastureDiyRoot "z1_224_1.swf") -Destination (Join-Path $pastureSceneSource "cinema.swf") -Force
foreach ($level in 1..8) {
  Copy-Item -LiteralPath (Join-Path $pastureDiyRoot "z2_102_$level.swf") -Destination (Join-Path $pastureSceneSource "hutch-$level.swf") -Force
  Copy-Item -LiteralPath (Join-Path $pastureDiyRoot "z3_103_$level.swf") -Destination (Join-Path $pastureSceneSource "shed-$level.swf") -Force
}
$pastureRows = & java --class-path $JpexsJar $frameExporter $pastureSceneSource $pastureSceneContent |
  ConvertFrom-Csv -Delimiter "`t"
if ($LASTEXITCODE -ne 0 -or @($pastureRows | Where-Object error).Count -gt 0) {
  throw "Content-bound QQ Farm 7.0 pasture scene export failed"
}

$mediaArguments = @(
  "-jar", $JpexsJar,
  "-onerror", "abort",
  "-export", "image",
  $pastureDefaultMedia,
  (Join-Path $pastureDiyRoot "z1_105_1.swf")
)
& java @mediaArguments
if ($LASTEXITCODE -ne 0) {
  throw "JPEXS default pasture media export failed with exit code $LASTEXITCODE"
}

$assets = [System.Collections.Generic.List[object]]::new()
function Add-Asset {
  param(
    [Parameter(Mandatory)] [string]$Destination,
    [Parameter(Mandatory)] [string]$ExportedFile,
    [Parameter(Mandatory)] [string]$SourceFile,
    [Parameter(Mandatory)] [string]$Strategy,
    [string]$Symbol = "",
    [string]$Frame = "1"
  )
  $assets.Add((New-AssetDescriptor @PSBoundParameters))
}

Add-Asset "shell/common/head-bg.png" (Join-Path $farmUiExport "sprites\DefineSprite_35_HeadBg\1.png") $farmUi "symbol" "35:HeadBg"
Add-Asset "shell/common/friend-bg.png" (Join-Path $farmUiExport "sprites\DefineSprite_271_FriendBg\1.png") $farmUi "symbol" "271:FriendBg"
Add-Asset "shell/common/level-blue.png" (Join-Path $farmUiExport "sprites\DefineSprite_100_LevelBlue\1.png") $farmUi "symbol" "100:LevelBlue"
Add-Asset "shell/common/farm-toolbar-bg.png" (Join-Path $farmUiExport "sprites\DefineSprite_461_ToolBarBg\1.png") $farmUi "symbol" "461:ToolBarBg"
Add-Asset "shell/common/window-bg.png" (Join-Path $farmUiExport "sprites\DefineSprite_537_WindowBg\1.png") $farmUi "symbol" "537:WindowBg"
Add-Asset "shell/common/item-bg.png" (Join-Path $farmUiExport "sprites\DefineSprite_510_ItemBg\1.png") $farmUi "symbol" "510:ItemBg"
Add-Asset "shell/common/close.png" (Join-Path $farmUiExport "sprites\DefineSprite_529_CloseButton\1.png") $farmUi "symbol" "529:CloseButton"

$farmNavigation = [ordered]@{
  "decorate" = @(105, "ButtonDecorate")
  "shop" = @(108, "ButtonShop")
  "farm" = @(111, "ButtonFarm")
  "pasture" = @(114, "ButtonMC")
  "warehouse" = @(123, "ButtonWarehouse")
}
foreach ($entry in $farmNavigation.GetEnumerator()) {
  $id = $entry.Value[0]
  $name = $entry.Value[1]
  Add-Asset "shell/nav/$($entry.Key).png" (Join-Path $farmUiExport "sprites\DefineSprite_${id}_${name}\1.png") $farmUi "symbol" "${id}:${name}"
}

$farmTools = [ordered]@{
  "pack" = @(454, "ToolPack")
  "arrow" = @(456, "ToolArrow")
  "hand" = @(467, "ToolHand")
  "weed" = @(469, "ToolWeed")
  "water" = @(471, "ToolWater")
  "toolbox" = @(486, "ToolBox")
  "steal" = @(489, "ToolTheft")
  "pesticide" = @(491, "ToolPesticide")
  "insect" = @(493, "ToolInsect")
  "hook" = @(495, "ToolHook")
  "hoe" = @(497, "ToolHoe")
  "zoom-out" = @(502, "ToolZoomOut")
  "zoom-in" = @(506, "ToolZoomIn")
}
foreach ($entry in $farmTools.GetEnumerator()) {
  $id = $entry.Value[0]
  $name = $entry.Value[1]
  Add-Asset "shell/farm-tools/$($entry.Key).png" (Join-Path $farmUiExport "buttons\DefineButton2_${id}_${name}\1_up.png") $farmUi "button-up" "${id}:${name}"
}

$pastureTools = [ordered]@{
  "hand" = @(212, "Cursor")
  "animal" = @(214, "ButtonSeed")
  "flapper" = @(216, "FlapperButton")
  "fly" = @(218, "FlyButton")
  "produce" = @(220, "ShengChanButton")
  "steal" = @(164, "ButtonTheft")
  "whistle" = @(160, "WhistleButton")
  "poop" = @(76, "BBButton")
}
foreach ($entry in $pastureTools.GetEnumerator()) {
  $id = $entry.Value[0]
  $name = $entry.Value[1]
  Add-Asset "shell/pasture-tools/$($entry.Key).png" (Join-Path $pastureUiExport "buttons\DefineButton2_${id}_${name}\1_up.png") $pastureUi "button-up" "${id}:${name}"
}
Add-Asset "shell/pasture-tools/toolbar-bg.png" (Join-Path $pastureUiExport "sprites\DefineSprite_225_ToolBarBg\1.png") $pastureUi "symbol" "225:ToolBarBg"
Add-Asset "shell/pasture-tools/feed-1.png" (Join-Path $pastureUiExport "sprites\DefineSprite_336_Grass\1.png") $pastureUi "symbol" "336:Grass" "1"

Add-Asset "scene/farm/background.png" (Join-Path $farmSceneFrames "1.png") (Join-Path $farmDiyRoot "1.swf") "root-frame" "root" "1"
Add-Asset "scene/farm/house.png" (Join-Path $farmSceneContent "2.swf.png") (Join-Path $farmDiyRoot "2.swf") "content-bounds" "root" "1"
Add-Asset "scene/farm/fence.png" (Join-Path $farmSceneContent "3.swf.png") (Join-Path $farmDiyRoot "3.swf") "content-bounds" "root" "1"
Add-Asset "scene/farm/doghouse.png" (Join-Path $farmSceneContent "4.swf.png") (Join-Path $farmDiyRoot "4.swf") "content-bounds" "root" "1"
Add-Asset "scene/farm/pool-water.png" (Join-Path $farmWaterExport "sprites\DefineSprite_27_WaterLand3\1.png") $farmWater "symbol" "27:WaterLand3" "1"
Add-Asset "scene/farm/pool-frame.png" (Join-Path $farmWaterExport "sprites\DefineSprite_30_StoneFrame1\1.png") $farmWater "symbol" "30:StoneFrame1" "1"

$defaultPastureMediaMap = [ordered]@{
  "grass-tile.jpg" = "1.jpg"
  "horizon.jpg" = "2.jpg"
  "ground-tile.jpg" = "4.jpg"
  "plant-1.png" = "13.png"
  "plant-2.png" = "14.png"
  "ground-patch.png" = "15.png"
  "plant-3.png" = "16.png"
  "plant-4.png" = "17.png"
  "plant-5.png" = "18.png"
  "fence.png" = "20.png"
}
$defaultPastureSource = Join-Path $pastureDiyRoot "z1_105_1.swf"
foreach ($entry in $defaultPastureMediaMap.GetEnumerator()) {
  Add-Asset "scene/pasture/default/$($entry.Key)" (Join-Path $pastureDefaultMedia $entry.Value) $defaultPastureSource "embedded-image" $entry.Value ""
}
Add-Asset "scene/pasture/cinema.png" (Join-Path $pastureSceneContent "cinema.swf.png") (Join-Path $pastureDiyRoot "z1_224_1.swf") "content-bounds" "root" "1"
foreach ($level in 1..8) {
  Add-Asset "scene/pasture/hutch/$level.png" (Join-Path $pastureSceneContent "hutch-$level.swf.png") (Join-Path $pastureDiyRoot "z2_102_$level.swf") "content-bounds" "root" "1"
  Add-Asset "scene/pasture/shed/$level.png" (Join-Path $pastureSceneContent "shed-$level.swf.png") (Join-Path $pastureDiyRoot "z3_103_$level.swf") "content-bounds" "root" "1"
}

$landSymbols = [ordered]@{
  "normal-wet.png" = @(173, "com.qzone.ui.FarmlandS", $farmUi)
  "normal-wet-alt.png" = @(176, "com.qzone.ui.FarmlandS2", $farmUi)
  "normal-dry-alt.png" = @(179, "com.qzone.ui.FarmlandG2", $farmUi)
  "normal-dry.png" = @(182, "com.qzone.ui.FarmlandG", $farmUi)
  "locked.png" = @(185, "com.qzone.ui.Wasteland", $farmUi)
  "red-wet.png" = @(189, "com.qzone.ui.red.FarmlandS", $farmUi)
  "red-wet-alt.png" = @(192, "com.qzone.ui.red.FarmlandS2", $farmUi)
  "red-dry-alt.png" = @(193, "com.qzone.ui.red.FarmlandG2", $farmUi)
  "red-dry.png" = @(196, "com.qzone.ui.red.FarmlandG", $farmUi)
  "black-wet.png" = @(184, "com.qzone.ui.black.FarmlandS", $farmUi2)
  "black-wet-alt.png" = @(193, "com.qzone.ui.black.FarmlandS2", $farmUi2)
  "black-dry-alt.png" = @(286, "com.qzone.ui.black.FarmlandG2", $farmUi2)
  "black-dry.png" = @(287, "com.qzone.ui.black.FarmlandG", $farmUi2)
}
foreach ($entry in $landSymbols.GetEnumerator()) {
  $id = $entry.Value[0]
  $name = $entry.Value[1]
  $source = $entry.Value[2]
  $exportRoot = if ($source -eq $farmUi) { $farmUiExport } else { $farmUi2Export }
  Add-Asset "scene/land/$($entry.Key)" (Join-Path $exportRoot "sprites\DefineSprite_${id}_${name}\1.png") $source "symbol" "${id}:${name}"
}
Add-Asset "scene/land/weed.png" (Join-Path $farmUiExport "sprites\DefineSprite_170_Weed\1.png") $farmUi "symbol" "170:Weed"
Add-Asset "scene/land/reclaim.png" (Join-Path $farmUiExport "sprites\DefineSprite_201_Reclaim\1.png") $farmUi "symbol" "201:Reclaim"
Add-Asset "scene/land/insect.png" (Join-Path $farmUiExport "sprites\DefineSprite_204_Insect\1.png") $farmUi "symbol" "204:Insect"
Add-Asset "scene/land/can-pick.png" (Join-Path $farmUiExport "sprites\DefineSprite_225_canPickIcon\1.png") $farmUi "symbol" "225:canPickIcon"

$manifestRows = foreach ($asset in $assets) {
  if (-not (Test-Path -LiteralPath $asset.exported_file -PathType Leaf)) {
    throw "Expected exported asset was not found: $($asset.exported_file)"
  }

  $destination = Join-Path $publicRoot $asset.destination.Replace("/", "\")
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
  Copy-Item -LiteralPath $asset.exported_file -Destination $destination -Force
  [pscustomobject]@{
    path = $asset.destination
    category = $asset.destination.Split("/")[0..1] -join "/"
    source = Get-RelativeV7SourcePath $asset.source_file
    source_sha256 = (Get-FileHash -LiteralPath $asset.source_file -Algorithm SHA256).Hash.ToLowerInvariant()
    export_strategy = $asset.strategy
    symbol = $asset.symbol
    frame = $asset.frame
    output_sha256 = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
    bytes = (Get-Item -LiteralPath $destination).Length
  }
}

$manifestPath = Join-Path $publicRoot "shell-manifest.json"
$manifestRows | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $manifestPath -Encoding utf8
$manifestRows | Export-Csv -LiteralPath (Join-Path $repositoryRoot "docs\manor-v7-source\runtime-shell-assets.csv") -NoTypeInformation -Encoding utf8

Write-Host "Exported $($manifestRows.Count) QQ Farm V7 runtime shell assets to $publicRoot"
