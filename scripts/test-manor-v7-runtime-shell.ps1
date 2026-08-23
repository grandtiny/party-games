$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$publicRoot = Join-Path $repositoryRoot "apps\web\public\assets\manor\v7-runtime"
$manifestPath = Join-Path $publicRoot "shell-manifest.json"
$catalogManifestPath = Join-Path $repositoryRoot "docs\manor-v7-source\runtime-catalog-assets.csv"

if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
  throw "Missing V7 runtime shell manifest: $manifestPath"
}
if (-not (Test-Path -LiteralPath $catalogManifestPath -PathType Leaf)) {
  throw "Missing V7 runtime catalog inventory: $catalogManifestPath"
}

$catalogManifest = @(Import-Csv -LiteralPath $catalogManifestPath)
if (@($catalogManifest | Where-Object processing_status -eq "blocked").Count -gt 0) {
  throw "V7 runtime catalog inventory still contains blocked assets"
}
if (@($catalogManifest | Where-Object { -not $_.runtime_asset -or -not $_.runtime_sha256 }).Count -gt 0) {
  throw "V7 runtime catalog inventory contains incomplete output records"
}

$manifest = @(Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json)
if ($manifest.Count -lt 70) {
  throw "Expected at least 70 V7 shell assets, found $($manifest.Count)"
}

$required = @(
  "scene/farm/background.png",
  "scene/farm/house.png",
  "scene/farm/pool-water.png",
  "scene/farm/pool-frame.png",
  "scene/pasture/default/grass-tile.jpg",
  "scene/pasture/default/horizon.jpg",
  "scene/pasture/default/ground-tile.jpg",
  "scene/pasture/default/fence.png",
  "scene/pasture/cinema.png",
  "scene/pasture/hutch/1.png",
  "scene/pasture/shed/1.png",
  "scene/land/normal-wet.png",
  "scene/land/red-wet.png",
  "scene/land/black-wet.png",
  "shell/nav/farm.png",
  "shell/nav/pasture.png",
  "shell/farm-tools/water.png",
  "shell/pasture-tools/animal.png"
)
foreach ($path in $required) {
  if ($path -notin $manifest.path) {
    throw "Required V7 runtime shell asset is not in the manifest: $path"
  }
}

$duplicatePaths = @($manifest | Group-Object path | Where-Object Count -gt 1)
if ($duplicatePaths.Count -gt 0) {
  throw "V7 runtime shell manifest contains duplicate output paths"
}

foreach ($entry in $manifest) {
  if ($entry.source -match "^(?:[A-Za-z]:|/)|classic|authorized") {
    throw "Manifest source is not V7-relative: $($entry.source)"
  }
  $outputPath = Join-Path $publicRoot $entry.path.Replace("/", "\")
  if (-not (Test-Path -LiteralPath $outputPath -PathType Leaf)) {
    throw "Manifest output is missing: $($entry.path)"
  }
  $hash = (Get-FileHash -LiteralPath $outputPath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($hash -ne $entry.output_sha256) {
    throw "Manifest hash mismatch: $($entry.path)"
  }
  if ([long]$entry.bytes -le 0) {
    throw "Manifest output is empty: $($entry.path)"
  }
}

$pastureBackground = $manifest | Where-Object path -eq "scene/pasture/default/horizon.jpg"
if ($pastureBackground.source -ne "mc/farm/diy/z1_105_1.swf") {
  throw "Default pasture must be reconstructed from z1_105_1.swf"
}
if (($manifest | Where-Object path -eq "scene/pasture/cinema.png").source -ne "mc/farm/diy/z1_224_1.swf") {
  throw "Cinema pasture reference must come from z1_224_1.swf"
}

Write-Host "Validated $($manifest.Count) V7 runtime shell assets"
