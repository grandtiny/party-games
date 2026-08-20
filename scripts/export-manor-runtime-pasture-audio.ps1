param(
  [string]$LegacyRoot,
  [string]$JpexsJar = "C:\Code\30_Tools\jpexs\26.2.1\app\ffdec.jar",
  [string]$JavaExe = "java",
  [string]$FfmpegExe = "ffmpeg",
  [string]$InventoryDirectory,
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
if (-not $InventoryDirectory) {
  $InventoryDirectory = Join-Path $repositoryRoot "data\manor-asset-work\pasture-sound-export"
}
if (-not $RuntimeAssetDirectory) {
  $RuntimeAssetDirectory = Join-Path $repositoryRoot "apps\web\public\assets\manor\classic\pasture\audio"
}
if (-not $MappingOutputPath) {
  $MappingOutputPath = Join-Path $repositoryRoot "docs\manor-assets\pasture-runtime-audio-assets.csv"
}

$soundTablePath = Join-Path $repositoryRoot "docs\manor-assets\sound-assets.csv"
$audioPolicyPath = Join-Path $repositoryRoot "docs\manor-assets\animal-audio-policy.csv"
foreach ($path in @($soundTablePath, $audioPolicyPath, $JpexsJar)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Required pasture audio source not found: $path"
  }
}

function Get-Hash([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-RelativePath([string]$Root, [string]$Path) {
  return [IO.Path]::GetRelativePath($Root, $Path).Replace("\", "/")
}

$policies = @{}
foreach ($policy in Import-Csv -LiteralPath $audioPolicyPath) {
  $policies[$policy.animal_id] = $policy
}

New-Item -ItemType Directory -Force -Path $InventoryDirectory, $RuntimeAssetDirectory | Out-Null
$runtimeRows = [Collections.Generic.List[object]]::new()
$sounds = @(Import-Csv -LiteralPath $soundTablePath | Sort-Object { [int]$_.animal_id }, { [int]$_.variant })
foreach ($sound in $sounds) {
  $policy = $policies[$sound.animal_id]
  if (-not $policy -or $policy.integration_policy -eq "excluded") {
    throw "Sound table contains an excluded or unknown animal: $($sound.animal_id)"
  }
  $allowedVariants = @($policy.available_variants -split ";" | Where-Object { $_ })
  if ($sound.variant -notin $allowedVariants) {
    throw "Sound variant $($sound.variant) is not allowed for animal $($sound.animal_id)"
  }

  $sourceSwf = Join-Path $LegacyRoot $sound.source_file.Replace("/", "\")
  if (-not (Test-Path -LiteralPath $sourceSwf -PathType Leaf)) {
    throw "Pasture sound container not found: $sourceSwf"
  }
  if ((Get-Hash $sourceSwf) -ne $sound.container_sha256) {
    throw "Pasture sound container hash mismatch: $sourceSwf"
  }

  $exportDirectory = Join-Path $InventoryDirectory "$($sound.animal_id)-$($sound.variant)"
  New-Item -ItemType Directory -Force -Path $exportDirectory | Out-Null
  $characterPattern = "$($sound.source_character_id)_*"
  $exports = @(Get-ChildItem -LiteralPath $exportDirectory -File | Where-Object {
    $_.BaseName -like $characterPattern -and $_.Extension -in @(".mp3", ".wav", ".flv")
  })
  if ($exports.Count -eq 0) {
    & $JavaExe -jar $JpexsJar -onerror abort -export sound $exportDirectory $sourceSwf | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "JPEXS sound export failed for $sourceSwf"
    }
    $exports = @(Get-ChildItem -LiteralPath $exportDirectory -File | Where-Object {
      $_.BaseName -like $characterPattern -and $_.Extension -in @(".mp3", ".wav", ".flv")
    })
  }
  if ($exports.Count -ne 1) {
    throw "Expected one DefineSound export for animal $($sound.animal_id) variant $($sound.variant), found $($exports.Count)"
  }

  $sourceAudio = $exports[0]
  $runtimeDirectory = Join-Path $RuntimeAssetDirectory $sound.animal_id
  New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null
  $sourceAudioHash = Get-Hash $sourceAudio.FullName
  $processingMethod = "copied"
  if ($sourceAudio.Extension -eq ".flv") {
    $runtimePath = Join-Path $runtimeDirectory "$($sound.variant).mp3"
    $ffmpegArguments = @(
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-i", $sourceAudio.FullName,
      "-vn",
      "-codec:a", "libmp3lame",
      "-q:a", "4",
      $runtimePath
    )
    & $FfmpegExe @ffmpegArguments
    if ($LASTEXITCODE -ne 0) {
      throw "FFmpeg pasture sound conversion failed for $($sourceAudio.FullName)"
    }
    $processingMethod = "transcoded-flv-to-mp3"
  } else {
    $runtimePath = Join-Path $runtimeDirectory "$($sound.variant)$($sourceAudio.Extension.ToLowerInvariant())"
    Copy-Item -LiteralPath $sourceAudio.FullName -Destination $runtimePath -Force
  }
  $runtimeHash = Get-Hash $runtimePath
  if ($processingMethod -eq "copied" -and $runtimeHash -ne $sourceAudioHash) {
    throw "Runtime sound copy hash mismatch for $runtimePath"
  }

  $runtimeRows.Add([pscustomobject][ordered]@{
    animal_id = [int]$sound.animal_id
    animal_name = $sound.animal_name
    variant = [int]$sound.variant
    integration_policy = $policy.integration_policy
    source_file = $sound.source_file
    container_sha256 = $sound.container_sha256
    source_character_id = [int]$sound.source_character_id
    source_export_file = Get-RelativePath $repositoryRoot $sourceAudio.FullName
    source_audio_sha256 = $sourceAudioHash
    runtime_asset = Get-RelativePath $repositoryRoot $runtimePath
    runtime_sha256 = $runtimeHash
    duration_seconds = $sound.sound_duration_seconds
    processing_method = $processingMethod
    processing_status = "ready"
  })
}

$runtimeRows | Export-Csv -LiteralPath $MappingOutputPath -NoTypeInformation -Encoding utf8
if ($runtimeRows.Count -ne 60) {
  throw "Expected 60 runtime pasture sounds, found $($runtimeRows.Count)"
}

[pscustomobject]@{
  AnimalsWithAudio = @($runtimeRows | Select-Object -ExpandProperty animal_id -Unique).Count
  RuntimeAudioAssets = $runtimeRows.Count
  MappingOutput = $MappingOutputPath
  RuntimeAssetDirectory = $RuntimeAssetDirectory
}
