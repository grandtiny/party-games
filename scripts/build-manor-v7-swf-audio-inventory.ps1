param(
  [string]$SourceRoot = $env:MANOR_V7_SOURCE_PATH,
  [string]$JpexsJar = "C:\Code\30_Tools\jpexs\26.2.1\app\ffdec.jar",
  [string]$InventoryDirectory
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $SourceRoot) { throw "Pass -SourceRoot or set MANOR_V7_SOURCE_PATH" }
$SourceRoot = (Resolve-Path -LiteralPath $SourceRoot).Path
$JpexsJar = (Resolve-Path -LiteralPath $JpexsJar).Path
if (-not $InventoryDirectory) {
  $InventoryDirectory = Join-Path $repositoryRoot "docs\manor-v7-source"
}

$pluginRoot = @(
  $SourceRoot
  (Join-Path $SourceRoot "wwwroot\source\plugin\qqfarm")
  (Join-Path $SourceRoot "source\plugin\qqfarm")
) | Where-Object {
  Test-Path -LiteralPath (Join-Path $_ "core\module") -PathType Container
} | Select-Object -First 1
if (-not $pluginRoot) { throw "QQ Farm V7 plugin root was not found below $SourceRoot" }

$moduleRoot = Join-Path $pluginRoot "core\module"
$javaSource = Join-Path $PSScriptRoot "ManorSwfAudioInventory.java"
$fileInventoryPath = Join-Path $InventoryDirectory "files.csv"
foreach ($path in @($javaSource, $fileInventoryPath)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required audio inventory input not found: $path" }
}

$fileByPath = @{}
$audioSourceRows = @()
foreach ($row in Import-Csv -LiteralPath $fileInventoryPath) {
  $fileByPath[$row.relative_path] = $row
  if ($row.category -eq "audio") { $audioSourceRows += $row }
}

$lines = @(& java --class-path $JpexsJar $javaSource $moduleRoot)
if ($LASTEXITCODE -ne 0) { throw "JPEXS SWF audio inventory failed with exit code $LASTEXITCODE" }
$rawRows = @($lines | ConvertFrom-Csv -Delimiter "`t")
$audioOutsideCatalog = @($rawRows | Where-Object {
  -not $_.error -and (([int]$_.define_sound_count -gt 0) -or ([int]$_.sound_stream_head_count -gt 0)) -and
  $fileByPath[$_.relative_path].category -ne "audio"
})
if ($audioOutsideCatalog.Count -gt 0) {
  throw "Audio was found outside the dedicated audio catalog: $($audioOutsideCatalog.relative_path -join ', ')"
}

$scanByPath = @{}
$rawRows | ForEach-Object { $scanByPath[$_.relative_path] = $_ }
$rows = @($audioSourceRows | Sort-Object relative_path | ForEach-Object {
  $source = $_
  $scan = $scanByPath[$source.relative_path]
  $pathMatch = [regex]::Match($source.relative_path, '^mc/main/sound/animal/(?<stage>\d+)/s(?<animal>\d+)\.swf$')
  if (-not $pathMatch.Success) { throw "Unexpected dedicated audio path: $($source.relative_path)" }

  $status = if (-not $scan) {
    "source-placeholder"
  } elseif ($scan.error) {
    "inspection-error"
  } else {
    "valid-audio"
  }
  [pscustomobject][ordered]@{
    relative_path = $source.relative_path
    sha256 = $source.sha256
    animal_id = $pathMatch.Groups["animal"].Value
    sound_stage = $pathMatch.Groups["stage"].Value
    define_sound_count = if ($scan) { $scan.define_sound_count } else { "0" }
    sound_stream_head_count = if ($scan) { $scan.sound_stream_head_count } else { "0" }
    swf_codec_ids = if ($scan) { $scan.swf_codec_ids } else { "" }
    swf_codecs = if ($scan) { $scan.swf_codecs } else { "" }
    sample_rates_hz = if ($scan) { $scan.sample_rates_hz } else { "" }
    sample_counts = if ($scan) { $scan.sample_counts } else { "" }
    duration_seconds = if ($scan) { $scan.duration_seconds } else { "" }
    audit_status = $status
    error = if ($scan) { $scan.error } else { "" }
  }
})

$validRows = @($rows | Where-Object audit_status -eq "valid-audio")
$durations = @($validRows | ForEach-Object { $_.duration_seconds -split ',' } | Where-Object { $_ } | ForEach-Object { [double]$_ })
$summary = @(
  [pscustomobject]@{ key = "dedicated_audio_swf_files"; value = $rows.Count }
  [pscustomobject]@{ key = "valid_audio_swf_files"; value = $validRows.Count }
  [pscustomobject]@{ key = "source_placeholders"; value = @($rows | Where-Object audit_status -eq "source-placeholder").Count }
  [pscustomobject]@{ key = "inspection_errors"; value = @($rows | Where-Object audit_status -eq "inspection-error").Count }
  [pscustomobject]@{ key = "mp3_swf_files"; value = @($validRows | Where-Object swf_codecs -eq "mp3").Count }
  [pscustomobject]@{ key = "adpcm_swf_files"; value = @($validRows | Where-Object swf_codecs -eq "adpcm").Count }
  [pscustomobject]@{ key = "distinct_animals"; value = @($rows.animal_id | Sort-Object -Unique).Count }
  [pscustomobject]@{ key = "minimum_duration_seconds"; value = ($durations | Measure-Object -Minimum).Minimum.ToString("0.000", [cultureinfo]::InvariantCulture) }
  [pscustomobject]@{ key = "maximum_duration_seconds"; value = ($durations | Measure-Object -Maximum).Maximum.ToString("0.000", [cultureinfo]::InvariantCulture) }
)

$rows | Export-Csv -LiteralPath (Join-Path $InventoryDirectory "swf-audio.csv") -NoTypeInformation -Encoding utf8
$summary | Export-Csv -LiteralPath (Join-Path $InventoryDirectory "swf-audio-summary.csv") -NoTypeInformation -Encoding utf8

Write-Host "Inspected $($rows.Count) dedicated V7 audio SWFs; valid: $($validRows.Count), placeholders: $(@($rows | Where-Object audit_status -eq 'source-placeholder').Count)"
