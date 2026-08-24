param(
  [string]$SourceRoot = $env:MANOR_V7_SOURCE_PATH,
  [string]$JpexsJar = "C:\Code\30_Tools\jpexs\26.2.1\app\ffdec.jar"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $SourceRoot -and (Test-Path -LiteralPath "D:\QQnc" -PathType Container)) {
  $SourceRoot = "D:\QQnc"
}
if (-not $SourceRoot) {
  throw "Pass -SourceRoot or set MANOR_V7_SOURCE_PATH"
}

$SourceRoot = (Resolve-Path -LiteralPath $SourceRoot).Path
$pluginRoot = @(
  $SourceRoot
  (Join-Path $SourceRoot "wwwroot\source\plugin\qqfarm")
  (Join-Path $SourceRoot "source\plugin\qqfarm")
) | Where-Object {
  Test-Path -LiteralPath (Join-Path $_ "core\module\Master2_v_86.swf") -PathType Leaf
} | Select-Object -First 1
if (-not $pluginRoot) {
  throw "QQ Farm 7.0 plugin root was not found below $SourceRoot"
}

$inputSwf = Join-Path $pluginRoot "core\module\Master2_v_86.swf"
$outputSwf = Join-Path $projectRoot "apps\web\public\assets\manor\v7-swf\module\Master2_v_86.swf"
$farmInputSwf = Join-Path $pluginRoot "core\module\main3_v_140.swf"
$farmOutputSwf = Join-Path $projectRoot "apps\web\public\assets\manor\v7-swf\module\main3_v_140.swf"
$farmConfigPath = Join-Path $projectRoot "apps\web\public\assets\manor\v7-swf\config\load_main_v_20120209.xml"
$pastureConfigPath = Join-Path $projectRoot "apps\web\public\assets\manor\v7-swf\config\mcini_main_v_20120209.xml"
$patchSource = Join-Path $projectRoot "patches\manor-v7\scripts\wild\com\comm\ModuleManager.as"
$shopSeedPatchSource = Join-Path $projectRoot "patches\manor-v7\scripts\mc\view\main\window\shop\ShopSeedWindow.as"
$leftInfoPatchSource = Join-Path $projectRoot "patches\manor-v7\scripts\mc\view\main\leftInfo\LeftInfo.as"
$pastureGiftIconPatchSource = Join-Path $projectRoot "patches\manor-v7\scripts\mc\view\main\leftInfo\MyIconBar.as"
$dailyPackagePatchSource = Join-Path $projectRoot "patches\manor-v7\scripts\§_-Gt§\§_-VT§.as"
$dailyPackageModelPatchSource = Join-Path $projectRoot "patches\manor-v7\scripts\§_-VB§\§_-2S§.as"
$farmFriendPatchSource = Join-Path $projectRoot "patches\manor-v7\scripts\module\friend\§_-OE§.as"
$profileWindowPatchSource = Join-Path $projectRoot "patches\manor-v7\scripts\§_-42§\§_-1D§.as"
$bagControllerPatchSource = Join-Path $projectRoot "patches\manor-v7\scripts\§_-1T§\§_-D3§.as"
$warehouseModulePatchSource = Join-Path $projectRoot "patches\manor-v7\scripts\module\warehouse\ModuleWarehouse.as"
$farmShopPatchSource = Join-Path $projectRoot "patches\manor-v7\scripts\module\shop\§_-OZ§.as"
$farmApplicationPatchSource = Join-Path $projectRoot "patches\manor-v7\scripts\module\FarmApplication.as"
$farmBuyItemPatchSource = Join-Path $projectRoot "patches\manor-v7\scripts\§_-W§\BuyItemWindow.as"
$farmBuyDiyPatchSource = Join-Path $projectRoot "patches\manor-v7\scripts\§_-W§\BuyDiyWindow.as"
$farmLandWindowPatchSource = Join-Path $projectRoot "patches\manor-v7\scripts\common\view\window\§_-LI§.as"
$farmFriendVipPatchSource = Join-Path $projectRoot "patches\manor-v7\scripts\module\friend\§_-Zk§.as"
$temporarySwf = Join-Path ([System.IO.Path]::GetDirectoryName($outputSwf)) "Master2_v_86.wild-module-patched.swf"
$temporaryFarmSwf = Join-Path ([System.IO.Path]::GetDirectoryName($farmOutputSwf)) "main3_v_140.daily-package-patched.swf"

foreach ($path in @($JpexsJar, $inputSwf, $farmInputSwf, $farmConfigPath, $pastureConfigPath, $patchSource, $shopSeedPatchSource, $leftInfoPatchSource, $pastureGiftIconPatchSource, $dailyPackagePatchSource, $dailyPackageModelPatchSource, $farmFriendPatchSource, $profileWindowPatchSource, $bagControllerPatchSource, $warehouseModulePatchSource, $farmShopPatchSource, $farmApplicationPatchSource, $farmBuyItemPatchSource, $farmBuyDiyPatchSource, $farmLandWindowPatchSource, $farmFriendVipPatchSource)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Required patch input is missing: $path"
  }
}

$arguments = @(
  "-jar",
  (Resolve-Path -LiteralPath $JpexsJar).Path,
  "-replace",
  $inputSwf,
  $temporarySwf,
  "wild.com.comm.ModuleManager",
  $patchSource,
  "mc.view.main.window.shop.ShopSeedWindow",
  $shopSeedPatchSource,
  "mc.view.main.leftInfo.LeftInfo",
  $leftInfoPatchSource,
  "mc.view.main.leftInfo.MyIconBar",
  $pastureGiftIconPatchSource
)
$farmArguments = @(
  "-jar",
  (Resolve-Path -LiteralPath $JpexsJar).Path,
  "-replace",
  $farmInputSwf,
  $temporaryFarmSwf,
  "§_-Gt§.§_-VT§",
  $dailyPackagePatchSource,
  "§_-VB§.§_-2S§",
  $dailyPackageModelPatchSource,
  "module.friend.§_-OE§",
  $farmFriendPatchSource,
  "§_-42§.§_-1D§",
  $profileWindowPatchSource,
  "§_-1T§.§_-D3§",
  $bagControllerPatchSource,
  "module.warehouse.ModuleWarehouse",
  $warehouseModulePatchSource,
  "module.shop.§_-OZ§",
  $farmShopPatchSource,
  "module.FarmApplication",
  $farmApplicationPatchSource,
  "§_-W§.BuyItemWindow",
  $farmBuyItemPatchSource,
  "§_-W§.BuyDiyWindow",
  $farmBuyDiyPatchSource,
  "common.view.window.§_-LI§",
  $farmLandWindowPatchSource,
  "module.friend.§_-Zk§",
  $farmFriendVipPatchSource
)

try {
  & java @arguments
  if ($LASTEXITCODE -ne 0) {
    throw "JPEXS script replacement failed with exit code $LASTEXITCODE"
  }
  if (-not (Test-Path -LiteralPath $temporarySwf -PathType Leaf)) {
    throw "JPEXS did not produce the patched SWF"
  }
  Move-Item -LiteralPath $temporarySwf -Destination $outputSwf -Force
  & java @farmArguments
  if ($LASTEXITCODE -ne 0) {
    throw "JPEXS daily-package script replacement failed with exit code $LASTEXITCODE"
  }
  if (-not (Test-Path -LiteralPath $temporaryFarmSwf -PathType Leaf)) {
    throw "JPEXS did not produce the daily-package patched SWF"
  }
  Move-Item -LiteralPath $temporaryFarmSwf -Destination $farmOutputSwf -Force
} finally {
  if (Test-Path -LiteralPath $temporarySwf -PathType Leaf) {
    Remove-Item -LiteralPath $temporarySwf -Force
  }
  if (Test-Path -LiteralPath $temporaryFarmSwf -PathType Leaf) {
    Remove-Item -LiteralPath $temporaryFarmSwf -Force
  }
}

$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $outputSwf).Hash
$pastureVersion = $hash.Substring(0, 12).ToLowerInvariant()
$farmHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $farmOutputSwf).Hash
$farmVersion = $farmHash.Substring(0, 12).ToLowerInvariant()
$farmConfig = [xml](Get-Content -LiteralPath $farmConfigPath -Raw)
$mainModule = $farmConfig.data.moduleList.module | Where-Object { $_.name -eq "main" } | Select-Object -First 1
if ($null -eq $mainModule) {
  throw "Main farm module was not found in $farmConfigPath"
}
$mainModule.url = "__MANOR_ORIGIN__/module/main3_v_140.swf?v=$farmVersion"
$farmConfig.Save($farmConfigPath)
$pastureConfig = [xml](Get-Content -LiteralPath $pastureConfigPath -Raw)
$pastureMainModule = $pastureConfig.main.moduleList.module | Where-Object { $_.name -eq "main" } | Select-Object -First 1
if ($null -eq $pastureMainModule) {
  throw "Pasture main module was not found in $pastureConfigPath"
}
$pastureMainModule.url = "__MANOR_ORIGIN__/module/Master2_v_86.swf?v=$pastureVersion"
$pastureConfig.Save($pastureConfigPath)
Write-Output "Patched Manor V7 Ruffle compatibility: $hash"
Write-Output "Patched Manor V7 daily package: $farmHash (cache version $farmVersion)"
