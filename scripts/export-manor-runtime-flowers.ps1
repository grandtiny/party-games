param(
  [string]$LegacyRoot,
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
if (-not $RuntimeAssetDirectory) {
  $RuntimeAssetDirectory = Join-Path $repositoryRoot "apps\web\public\assets\manor\classic\flowers"
}
if (-not $MappingOutputPath) {
  $MappingOutputPath = Join-Path $repositoryRoot "docs\manor-assets\flower-runtime-assets.csv"
}

$sourceDirectory = Join-Path $LegacyRoot "module\nc\flower"
New-Item -ItemType Directory -Force -Path $RuntimeAssetDirectory | Out-Null
$rows = foreach ($flowerId in 1..14) {
  $fileName = "$flowerId.gif"
  $source = Join-Path $sourceDirectory $fileName
  $destination = Join-Path $RuntimeAssetDirectory $fileName
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
    throw "Missing original flower asset: $source"
  }
  Copy-Item -LiteralPath $source -Destination $destination -Force
  $sourceHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
  $runtimeHash = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($sourceHash -ne $runtimeHash) { throw "Runtime flower asset hash mismatch: $destination" }
  [pscustomobject][ordered]@{
    flower_id = $flowerId
    source_file = "module/nc/flower/$fileName"
    source_sha256 = $sourceHash
    runtime_asset = [IO.Path]::GetRelativePath($repositoryRoot, $destination).Replace("\", "/")
    runtime_sha256 = $runtimeHash
    status = "ready"
  }
}

$rows | Export-Csv -LiteralPath $MappingOutputPath -NoTypeInformation -Encoding utf8
[pscustomobject]@{
  RuntimeAssets = $rows.Count
  MappingOutput = $MappingOutputPath
  RuntimeAssetDirectory = $RuntimeAssetDirectory
}
