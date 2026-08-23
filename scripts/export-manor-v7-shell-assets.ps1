param(
  [string]$SourceRoot = $env:MANOR_AUTHORIZED_SOURCE_PATH,
  [string]$JpexsJar = "C:\Code\30_Tools\jpexs\26.2.1\app\ffdec-cli.jar"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $SourceRoot) {
  throw "Pass -SourceRoot or set MANOR_AUTHORIZED_SOURCE_PATH"
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
$pastureUi = Join-Path $moduleRoot "mc\main\farmui1_v_40.swf"
$farmDiyRoot = Join-Path $moduleRoot "ui\farm\diy"
$pastureDiyRoot = Join-Path $moduleRoot "mc\farm\diy"
$defaultDiyPaths = 1..4 | ForEach-Object { Join-Path $farmDiyRoot "$_.swf" }
$defaultPastureScenePath = Join-Path $pastureDiyRoot "z1_105_1.swf"
$pastureHousePaths = @(
  1..8 | ForEach-Object { Join-Path $pastureDiyRoot "z2_102_$_.swf" }
  1..8 | ForEach-Object { Join-Path $pastureDiyRoot "z3_103_$_.swf" }
)
$contentExporter = Join-Path $PSScriptRoot "ManorSwfFrameExporter.java"
foreach ($path in @($farmUi, $farmUi2, $pastureUi, $contentExporter, $defaultPastureScenePath) + $defaultDiyPaths + $pastureHousePaths) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Required QQ Farm 7.0 UI bundle was not found: $path"
  }
}

$workRoot = Join-Path $repositoryRoot "data\manor-asset-work\v7-shell-export"
$farmExport = Join-Path $workRoot "farmui_full_v_32"
$farm2Export = Join-Path $workRoot "farmui2_v_34"
$pastureUiExport = Join-Path $workRoot "pasture-ui-v40"
$defaultSceneSource = Join-Path $workRoot "default-scene-source"
$defaultSceneStageExport = Join-Path $workRoot "default-scene-stage"
$defaultSceneContentExport = Join-Path $workRoot "default-scene-content"
$pastureSceneSource = Join-Path $workRoot "pasture-scene-source"
$pastureSceneExport = Join-Path $workRoot "pasture-scene-content"
$publicRoot = Join-Path $repositoryRoot "apps\web\public\assets\manor\v7"
New-Item -ItemType Directory -Force -Path $farmExport, $farm2Export, $pastureUiExport, $defaultSceneSource, $defaultSceneStageExport, $defaultSceneContentExport, $pastureSceneSource, $pastureSceneExport, $publicRoot | Out-Null

function Invoke-JpexsExport {
  param(
    [string]$Source,
    [string]$Destination,
    [string]$CharacterIds
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

Invoke-JpexsExport -Source $farmUi -Destination $farmExport -CharacterIds "35,100,105,108,111,114,123,271,454,456,461,467,469,471,486,489,491,493,495,497,502,506"
Invoke-JpexsExport -Source $farmUi2 -Destination $farm2Export -CharacterIds "5,6,268,274,275,292"
Invoke-JpexsExport -Source $pastureUi -Destination $pastureUiExport -CharacterIds "76,160,164,179,181,212,214,216,218,220,223,225,227,255,258,283,289,336,396,399"

foreach ($id in 1..4) {
  Copy-Item -LiteralPath (Join-Path $farmDiyRoot "$id.swf") -Destination (Join-Path $defaultSceneSource "$id.swf") -Force
}
Copy-Item -LiteralPath $defaultPastureScenePath -Destination (Join-Path $pastureSceneSource "default-background.swf") -Force
foreach ($level in 1..8) {
  Copy-Item -LiteralPath (Join-Path $pastureDiyRoot "z2_102_$level.swf") -Destination (Join-Path $pastureSceneSource "hutch-$level.swf") -Force
  Copy-Item -LiteralPath (Join-Path $pastureDiyRoot "z3_103_$level.swf") -Destination (Join-Path $pastureSceneSource "shed-$level.swf") -Force
}

$backgroundArguments = @(
  "-jar", $JpexsJar,
  "-onerror", "abort",
  "-ignorebackground",
  "-select", "0:1",
  "-export", "frame",
  $defaultSceneStageExport,
  (Join-Path $defaultSceneSource "1.swf")
)
& java @backgroundArguments
if ($LASTEXITCODE -ne 0) {
  throw "JPEXS default farm background export failed with exit code $LASTEXITCODE"
}

$contentRows = & java --class-path $JpexsJar $contentExporter $defaultSceneSource $defaultSceneContentExport |
  ConvertFrom-Csv -Delimiter "`t"
if ($LASTEXITCODE -ne 0 -or @($contentRows | Where-Object error).Count -gt 0) {
  throw "Content-bound QQ Farm 7.0 default scene export failed"
}

$pastureRows = & java --class-path $JpexsJar $contentExporter $pastureSceneSource $pastureSceneExport |
  ConvertFrom-Csv -Delimiter "`t"
if ($LASTEXITCODE -ne 0 -or @($pastureRows | Where-Object error).Count -gt 0) {
  throw "Content-bound QQ Farm 7.0 pasture scene export failed"
}

$assets = [ordered]@{
  "chrome\head-bg.png" = Join-Path $farmExport "sprites\DefineSprite_35_HeadBg\1.png"
  "chrome\level-blue.png" = Join-Path $farmExport "sprites\DefineSprite_100_LevelBlue\1.png"
  "chrome\friend-bg.png" = Join-Path $farmExport "sprites\DefineSprite_271_FriendBg\1.png"
  "chrome\toolbar-bg.png" = Join-Path $farmExport "sprites\DefineSprite_461_ToolBarBg\1.png"
  "nav\farm.png" = Join-Path $farmExport "sprites\DefineSprite_111_ButtonFarm\1.png"
  "nav\pasture.png" = Join-Path $farmExport "sprites\DefineSprite_114_ButtonMC\1.png"
  "nav\warehouse.png" = Join-Path $farmExport "sprites\DefineSprite_123_ButtonWarehouse\1.png"
  "nav\shop.png" = Join-Path $farmExport "sprites\DefineSprite_108_ButtonShop\1.png"
  "nav\decorate.png" = Join-Path $farmExport "sprites\DefineSprite_105_ButtonDecorate\1.png"
  "nav\left-up.png" = Join-Path $farm2Export "buttons\DefineButton2_5_NLeftArrow\1_up.png"
  "nav\left-over.png" = Join-Path $farm2Export "buttons\DefineButton2_5_NLeftArrow\2_over.png"
  "nav\right-up.png" = Join-Path $farm2Export "buttons\DefineButton2_6_NRightArrow\1_up.png"
  "nav\right-over.png" = Join-Path $farm2Export "buttons\DefineButton2_6_NRightArrow\2_over.png"
  "pool\info-up.png" = Join-Path $farm2Export "buttons\DefineButton2_292_PoolInfoBtn\1_up.png"
  "pool\info-over.png" = Join-Path $farm2Export "buttons\DefineButton2_292_PoolInfoBtn\2_over.png"
  "pool\net-up.png" = Join-Path $farm2Export "buttons\DefineButton2_275_ToolFishNet\1_up.png"
  "pool\net-over.png" = Join-Path $farm2Export "buttons\DefineButton2_275_ToolFishNet\2_over.png"
  "pool\net-all-up.png" = Join-Path $farm2Export "buttons\DefineButton2_274_ToolFishNetAll\1_up.png"
  "pool\net-all-over.png" = Join-Path $farm2Export "buttons\DefineButton2_274_ToolFishNetAll\2_over.png"
  "scene\default-background.png" = Join-Path $defaultSceneStageExport "1.png"
  "scene\default-house.png" = Join-Path $defaultSceneContentExport "2.swf.png"
  "scene\default-fence.png" = Join-Path $defaultSceneContentExport "3.swf.png"
  "scene\default-doghouse.png" = Join-Path $defaultSceneContentExport "4.swf.png"
  "pasture\default-background.png" = Join-Path $pastureSceneExport "default-background.swf.png"
  "pasture\ui\toolbar-bg.png" = Join-Path $pastureUiExport "sprites\DefineSprite_225_ToolBarBg\1.png"
  "pasture\ui\window-bg.png" = Join-Path $pastureUiExport "sprites\DefineSprite_223_WindowBg\1.png"
  "pasture\ui\close.png" = Join-Path $pastureUiExport "sprites\DefineSprite_255_CloseButton\1.png"
  "pasture\ui\item-bg.png" = Join-Path $pastureUiExport "sprites\DefineSprite_258_ItemBg\1.png"
  "pasture\ui\trough-buy.png" = Join-Path $pastureUiExport "sprites\DefineSprite_399_MucaoGoumai\1.png"
  "pasture\ui\tool-hand.png" = Join-Path $pastureUiExport "buttons\DefineButton2_212_Cursor\1_up.png"
  "pasture\ui\tool-animal.png" = Join-Path $pastureUiExport "buttons\DefineButton2_214_ButtonSeed\1_up.png"
  "pasture\ui\tool-poop.png" = Join-Path $pastureUiExport "buttons\DefineButton2_76_BBButton\1_up.png"
  "pasture\ui\tool-fly.png" = Join-Path $pastureUiExport "buttons\DefineButton2_218_FlyButton\1_up.png"
  "pasture\ui\tool-produce.png" = Join-Path $pastureUiExport "buttons\DefineButton2_220_ShengChanButton\1_up.png"
  "pasture\ui\tool-steal.png" = Join-Path $pastureUiExport "buttons\DefineButton2_164_ButtonTheft\1_up.png"
  "pasture\ui\tool-whistle.png" = Join-Path $pastureUiExport "buttons\DefineButton2_160_WhistleButton\1_up.png"
}

foreach ($level in 1..8) {
  $assets["pasture\hutch-$level.png"] = Join-Path $pastureSceneExport "hutch-$level.swf.png"
  $assets["pasture\shed-$level.png"] = Join-Path $pastureSceneExport "shed-$level.swf.png"
}
foreach ($frame in 1..4) {
  $assets["pasture\feed-$frame.png"] = Join-Path $pastureUiExport "sprites\DefineSprite_336_Grass\$frame.png"
}

foreach ($entry in $assets.GetEnumerator()) {
  if (-not (Test-Path -LiteralPath $entry.Value -PathType Leaf)) {
    throw "Expected exported symbol was not found: $($entry.Value)"
  }
  $destination = Join-Path $publicRoot $entry.Key
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
  Copy-Item -LiteralPath $entry.Value -Destination $destination -Force
}

$manifest = $assets.GetEnumerator() | ForEach-Object {
  $destination = Join-Path $publicRoot $_.Key
  [pscustomobject]@{
    path = $_.Key.Replace("\", "/")
    sha256 = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
    source = (Resolve-Path -LiteralPath $_.Value).Path.Substring($repositoryRoot.Length + 1).Replace("\", "/")
  }
}
$manifest | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $publicRoot "manifest.json") -Encoding utf8

Write-Host "Exported $($assets.Count) QQ Farm 7.0 shell assets to $publicRoot"
