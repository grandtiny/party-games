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
  Test-Path -LiteralPath (Join-Path $_ "core\module\ui\qqshow\qsplugin_20101119.swf") -PathType Leaf
} | Select-Object -First 1
if (-not $pluginRoot) {
  throw "QQ Farm 7.0 plugin root was not found below $SourceRoot"
}

$inputSwf = Join-Path $pluginRoot "core\module\ui\qqshow\qsplugin_20101119.swf"
$outputSwf = Join-Path $projectRoot "apps\web\public\assets\manor\v7-swf\module\ui\qqshow\qsplugin_20101119.swf"
$temporarySwf = Join-Path ([System.IO.Path]::GetDirectoryName($outputSwf)) "qsplugin_20101119.avatar-links-patched.swf"
$mallPatch = Join-Path $projectRoot "patches\manor-v7\scripts\qqshow\com\tencent\qqshow\atfarm\widgets\ToMallLinkButton.as"
$resultPatch = Join-Path $projectRoot "patches\manor-v7\scripts\qqshow\QShow_Step3.as"

foreach ($path in @($JpexsJar, $inputSwf, $outputSwf, $mallPatch, $resultPatch)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Required avatar patch input is missing: $path"
  }
}

$sourceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $inputSwf).Hash.ToLowerInvariant()
if ($sourceHash -ne "1e8b6c5281bcbd0b9a85b0715369d06d90632e8eb2f907ddf5a215a20f66c264") {
  throw "QQ Farm avatar plugin source hash drifted: $sourceHash"
}

$arguments = @(
  "-jar",
  (Resolve-Path -LiteralPath $JpexsJar).Path,
  "-replace",
  $inputSwf,
  $temporarySwf,
  "com.tencent.qqshow.atfarm.widgets.ToMallLinkButton",
  $mallPatch,
  "QShow_Step3",
  $resultPatch
)

try {
  & java @arguments
  if ($LASTEXITCODE -ne 0) {
    throw "JPEXS avatar-link replacement failed with exit code $LASTEXITCODE"
  }
  if (-not (Test-Path -LiteralPath $temporarySwf -PathType Leaf)) {
    throw "JPEXS did not produce the patched avatar plugin"
  }
  Move-Item -LiteralPath $temporarySwf -Destination $outputSwf -Force
} finally {
  if (Test-Path -LiteralPath $temporarySwf -PathType Leaf) {
    Remove-Item -LiteralPath $temporarySwf -Force
  }
}

$outputHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $outputSwf).Hash.ToLowerInvariant()
if ($outputHash -eq $sourceHash) {
  throw "The avatar plugin output is unchanged"
}
Write-Output "Patched QQ Farm avatar plugin links: $outputHash"
