param(
  [string]$InventoryDirectory
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $InventoryDirectory) {
  $InventoryDirectory = Join-Path $repositoryRoot "docs\manor-v7-source"
}

$rows = @(Import-Csv -LiteralPath (Join-Path $InventoryDirectory "swf-audio.csv"))
$summary = @{}
Import-Csv -LiteralPath (Join-Path $InventoryDirectory "swf-audio-summary.csv") | ForEach-Object {
  $summary[$_.key] = $_.value
}

if ($rows.Count -ne 89) { throw "Expected 89 dedicated audio SWFs, found $($rows.Count)" }
if (@($rows | Where-Object { -not $_.relative_path -or -not $_.sha256 -or -not $_.animal_id -or -not $_.sound_stage }).Count -gt 0) {
  throw "Every audio SWF must retain source identity, animal ID and sound stage"
}
if (@($rows | Where-Object audit_status -eq "valid-audio").Count -ne 88) { throw "Expected 88 valid audio SWFs" }
if (@($rows | Where-Object swf_codecs -eq "mp3").Count -ne 87) { throw "Expected 87 MP3 audio SWFs" }
if (@($rows | Where-Object swf_codecs -eq "adpcm").Count -ne 1) { throw "Expected one ADPCM audio SWF" }
if (@($rows | Where-Object audit_status -eq "inspection-error").Count -ne 0) { throw "Dedicated audio SWFs must have no inspection errors" }
if (@($rows | Where-Object sound_stage -eq "1").Count -ne 33) { throw "Expected 33 primary animal sound SWFs" }
if (@($rows | Where-Object sound_stage -eq "2").Count -ne 56) { throw "Expected 56 secondary animal sound SWFs" }

$placeholders = @($rows | Where-Object audit_status -eq "source-placeholder")
if ($placeholders.Count -ne 1 -or $placeholders[0].relative_path -ne "mc/main/sound/animal/2/s1038.swf") {
  throw "The only source audio placeholder must remain stage 2 animal 1038"
}
if ($summary.minimum_duration_seconds -ne "0.275" -or $summary.maximum_duration_seconds -ne "4.284") {
  throw "SWF structural duration bounds drifted"
}
if ([int]$summary.distinct_animals -ne 57) { throw "Expected audio files for 57 distinct animals" }

$runtimeModuleRoot = Join-Path $repositoryRoot "apps\web\public\assets\manor\v7-swf\module"
foreach ($row in $rows) {
  $runtimePath = Join-Path $runtimeModuleRoot $row.relative_path.Replace("/", "\")
  if (-not (Test-Path -LiteralPath $runtimePath -PathType Leaf)) {
    throw "Runtime audio SWF is missing: $($row.relative_path)"
  }
  $runtimeHash = (Get-FileHash -LiteralPath $runtimePath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($runtimeHash -ne $row.sha256) {
    throw "Runtime audio SWF differs from the audited source: $($row.relative_path)"
  }
}

$runtimeConfigPath = Join-Path $repositoryRoot "apps\web\public\assets\manor\v7-swf\config\mcdata_zh_CN_v_20120209.xml"
[xml]$runtimeConfig = Get-Content -LiteralPath $runtimeConfigPath -Raw -Encoding utf8
$animals = @($runtimeConfig.SelectNodes("//animal"))
$audioByPath = @{}
$rows | ForEach-Object { $audioByPath[$_.relative_path] = $_ }
$brokenSoundButtons = @($animals | Where-Object { $_.sound -eq "1" } | Where-Object {
  $path = "mc/main/sound/animal/1/s$($_.id).swf"
  -not $audioByPath[$path] -or $audioByPath[$path].audit_status -ne "valid-audio"
})
if ($brokenSoundButtons.Count -gt 0) {
  throw "Runtime animals enable missing primary sounds: $($brokenSoundButtons.id -join ', ')"
}

foreach ($animalId in @("1010", "1497", "1498", "1499")) {
  $animal = $animals | Where-Object id -eq $animalId | Select-Object -First 1
  if (-not $animal -or $animal.sound -ne "0") {
    throw "Animal $animalId must disable its missing primary sound"
  }
}

Write-Host "QQ Farm V7 audio inventory verification passed: $($rows.Count) files, 88 valid sounds, one source placeholder"
