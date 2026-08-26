$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$patchScriptPath = Join-Path $repositoryRoot "scripts\patch-manor-v7-avatar-links.ps1"
$mallPatchPath = Join-Path $repositoryRoot "patches\manor-v7\scripts\qqshow\com\tencent\qqshow\atfarm\widgets\ToMallLinkButton.as"
$resultPatchPath = Join-Path $repositoryRoot "patches\manor-v7\scripts\qqshow\QShow_Step3.as"
$outputSwf = Join-Path $repositoryRoot "apps\web\public\assets\manor\v7-swf\module\ui\qqshow\qsplugin_20101119.swf"

$patchScript = Get-Content -LiteralPath $patchScriptPath -Raw -Encoding UTF8
$mallPatch = Get-Content -LiteralPath $mallPatchPath -Raw -Encoding UTF8
$resultPatch = Get-Content -LiteralPath $resultPatchPath -Raw -Encoding UTF8

if (-not $patchScript.Contains('"com.tencent.qqshow.atfarm.widgets.ToMallLinkButton"')) {
  throw "Avatar patch script does not replace the QQ Show mall button"
}
if (-not $patchScript.Contains('"QShow_Step3"')) {
  throw "Avatar patch script does not replace the QQ Show result window"
}
if (-not $mallPatch.Contains("visible = false") -or -not $mallPatch.Contains("mouseEnabled = false")) {
  throw "QQ Show mall button must be hidden and non-interactive"
}
if ($resultPatch.Contains("ExternalInterface") -or $resultPatch.Contains("paycenter.qq.com")) {
  throw "QQ Show result window still contains a payment link"
}
if (-not $resultPatch.Contains("toRed_btn.visible = false") -or -not $resultPatch.Contains("toRed_btn.mouseEnabled = false")) {
  throw "QQ Show payment button must be hidden and non-interactive"
}

$sourceHash = "1e8b6c5281bcbd0b9a85b0715369d06d90632e8eb2f907ddf5a215a20f66c264"
$expectedOutputHash = "162ddfc0f647616a743d2f98676bdcbf1db50624e3c8d73e55b7791b6655f36d"
$outputHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $outputSwf).Hash.ToLowerInvariant()
if ($outputHash -eq $sourceHash) {
  throw "QQ Show avatar plugin is still the unpatched source binary"
}
if ($outputHash -ne $expectedOutputHash) {
  throw "QQ Show avatar plugin output hash drifted: $outputHash"
}

Write-Host "QQ Farm V7 avatar-link patch verification passed: $outputHash"
