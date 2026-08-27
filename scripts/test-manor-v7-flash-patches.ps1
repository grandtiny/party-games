$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$patchScriptPath = Join-Path $repositoryRoot "scripts\patch-manor-v7-wild-click.ps1"
$seedPagePath = Join-Path $repositoryRoot "patches\manor-v7\scripts\§_-W§\§_-Qq§.as"
$wildToolPath = Join-Path $repositoryRoot "patches\manor-v7\scripts\§_-Gt§\Tool_Wild.as"
$profileDataPath = Join-Path $repositoryRoot "patches\manor-v7\scripts\§_-42§\§_-5R§.as"
$giftWindowPath = Join-Path $repositoryRoot "patches\manor-v7\scripts\common\view\window\GiftWindow.as"
$giftItemPath = Join-Path $repositoryRoot "patches\manor-v7\scripts\common\view\window\GiftItem.as"
$bagControllerPath = Join-Path $repositoryRoot "patches\manor-v7\scripts\§_-1T§\§_-D3§.as"

$patchScript = Get-Content -LiteralPath $patchScriptPath -Raw -Encoding UTF8
$seedPage = Get-Content -LiteralPath $seedPagePath -Raw -Encoding UTF8
$wildTool = Get-Content -LiteralPath $wildToolPath -Raw -Encoding UTF8
$profileData = Get-Content -LiteralPath $profileDataPath -Raw -Encoding UTF8
$giftWindow = Get-Content -LiteralPath $giftWindowPath -Raw -Encoding UTF8
$giftItem = Get-Content -LiteralPath $giftItemPath -Raw -Encoding UTF8
$bagController = Get-Content -LiteralPath $bagControllerPath -Raw -Encoding UTF8

if ($patchScript.Contains('"framework.base.§_-Eh§"')) {
  throw "The shared farm tile base must not be recompiled because it breaks protected members in original subclasses"
}
if ($patchScript.Contains('$farmTileBasePatchSource')) {
  throw "The shared farm tile base patch must not be part of the JPEXS replacement chain"
}
if (-not $seedPage.Contains("private var _pageTile:TileList;")) {
  throw "The patched seed page must own its TileList instead of accessing protected base members"
}
if (-not $seedPage.Contains("private var _pageWidth:int;")) {
  throw "The patched seed page must retain its own width instead of accessing the obfuscated base width"
}
if ($seedPage.Contains("this.tile") -or $seedPage.Contains("§_-0x§")) {
  throw "The patched seed page still depends on accessors that require recompiling the shared base"
}
if ($seedPage.Contains('ExternalInterface.call("window.open"')) {
  throw "The patched seed page must not restore the legacy VIP payment link"
}
if (-not $patchScript.Contains('"§_-Gt§.Tool_Wild"')) {
  throw "The farm wild-animal tool patch must be part of the JPEXS replacement chain"
}
if (-not $wildTool.Contains('addEventListener(MouseEvent.CLICK,this.onWildIconClick')) {
  throw "The wild-animal icon must listen for the click event used by the toolbar"
}
if (-not $wildTool.Contains('dispatchEvent(new MouseEvent(MouseEvent.CLICK,true));')) {
  throw "The wild-animal icon must forward a bubbling click to the toolbar"
}
if (-not $patchScript.Contains('"§_-42§.§_-5R§"')) {
  throw "The farm profile data patch must be part of the JPEXS replacement chain"
}
if (-not $profileData.Contains('if(this.m_data["fish"] != undefined)')) {
  throw "The fish profile tab must use the fish cache key"
}
if (-not $profileData.Contains('_loc2_ = {"uId":Session.getInstance().currentUser._uId};')) {
  throw "The fish profile tab must request the selected friend's user ID"
}
if (-not $profileData.Contains('_loc2_["ownerId"] = _loc2_["uId"];')) {
  throw "The fish profile tab must pass ownerId for the selected profile"
}
if (-not $profileData.Contains('NetHelper.sendRequest(§_-99§.§_-Fl§,_loc2_,this.onDataLoaded,this.onNetError);')) {
  throw "The fish profile request must send the selected profile parameters"
}
if (-not $patchScript.Contains('"common.view.window.GiftItem"')) {
  throw "The compact farm gift item patch must be part of the JPEXS replacement chain"
}
if (-not $giftWindow.Contains('_loc8_.x = _loc7_ % 3 * _loc5_')) {
  throw "The daily gift window must wrap rewards into three columns"
}
if (-not $giftWindow.Contains('_loc8_.y = Math.floor(_loc7_ / 3) * _loc6_')) {
  throw "The daily gift window must create additional reward rows"
}
if ($giftWindow.Contains('new HBox(390,140)')) {
  throw "The daily gift window must not use the overflowing single-row reward lists"
}
if (-not $giftItem.Contains('new TextFormat("SimSun",13')) {
  throw "The daily gift item label must use the compact text format"
}
if (-not $giftItem.Contains('this.§_-a5§.wordWrap = true;')) {
  throw "The daily gift item label must wrap long reward names"
}
if (-not $bagController.Contains('this.bagView.addEventListener(§_-SF§.§_-ZN§,this.onBagItemClick,false,1000,true);')) {
  throw "The farm bag controller must intercept fertilizer package clicks before the normal tool cursor"
}
if (-not $bagController.Contains('"openPackage":1')) {
  throw "The farm bag controller must request an explicit package-open transaction"
}
if (-not $bagController.Contains('this.model.dirty = true;') -or -not $bagController.Contains('this.model.reload();')) {
  throw "The farm bag controller must reload inventory after opening a package"
}

Write-Host "QQ Farm V7 Flash patch verification passed"
