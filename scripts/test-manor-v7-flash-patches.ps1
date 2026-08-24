$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$patchScriptPath = Join-Path $repositoryRoot "scripts\patch-manor-v7-wild-click.ps1"
$seedPagePath = Join-Path $repositoryRoot "patches\manor-v7\scripts\§_-W§\§_-Qq§.as"

$patchScript = Get-Content -LiteralPath $patchScriptPath -Raw -Encoding UTF8
$seedPage = Get-Content -LiteralPath $seedPagePath -Raw -Encoding UTF8

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

Write-Host "QQ Farm V7 Flash patch verification passed"
