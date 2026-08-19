param(
  [string]$LegacyRoot,
  [string]$JpexsJar = "C:\Code\30_Tools\jpexs\26.2.1\app\ffdec.jar",
  [string]$JavaExe = "java",
  [string]$InventoryDirectory,
  [string]$OutputDirectory,
  [switch]$SkipJpexsExport
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $LegacyRoot) {
  $LegacyRoot = Join-Path $repositoryRoot "..\..\20_ThirdParty\qqfarm\upload\home\qqfarm"
}
$LegacyRoot = (Resolve-Path $LegacyRoot).Path
if (-not $InventoryDirectory) {
  $InventoryDirectory = Join-Path $repositoryRoot "data\manor-asset-work\crop-export"
}
if (-not $OutputDirectory) {
  $OutputDirectory = Join-Path $repositoryRoot "docs\manor-assets\contact-sheets\crops"
}

$cropDirectory = Join-Path $LegacyRoot "module\nc\crops"
$cropTablePath = Join-Path $repositoryRoot "docs\manor-assets\crops.csv"
$stateTablePath = Join-Path $repositoryRoot "docs\manor-assets\crop-state-assets.csv"
$currentTablePath = Join-Path $repositoryRoot "docs\manor-assets\crop-current-assets.csv"
$reviewTablePath = Join-Path $repositoryRoot "docs\manor-assets\crop-contact-review.csv"
$visualReviewTablePath = Join-Path $repositoryRoot "docs\manor-assets\crop-visual-review.csv"
$currentAssetDirectory = Join-Path $repositoryRoot "apps\web\public\assets\manor\classic"

if (-not (Test-Path -LiteralPath $JpexsJar -PathType Leaf)) {
  throw "JPEXS jar not found: $JpexsJar"
}
if (-not (Test-Path -LiteralPath $cropTablePath -PathType Leaf)) {
  throw "Crop table not found: $cropTablePath. Run build-manor-asset-map.ps1 first."
}

New-Item -ItemType Directory -Force -Path $InventoryDirectory, $OutputDirectory | Out-Null

if (-not $SkipJpexsExport) {
  & $JavaExe -jar $JpexsJar -onerror abort -export sprite $InventoryDirectory $cropDirectory
  if ($LASTEXITCODE -ne 0) {
    throw "JPEXS crop sprite export failed"
  }
}

Add-Type -AssemblyName System.Drawing

$stateDefinitions = @(
  [pscustomobject]@{ Index = 0; Key = "seed"; Label = "种子" },
  [pscustomobject]@{ Index = 1; Key = "sprout"; Label = "发芽" },
  [pscustomobject]@{ Index = 2; Key = "young"; Label = "幼苗" },
  [pscustomobject]@{ Index = 3; Key = "growing"; Label = "生长" },
  [pscustomobject]@{ Index = 4; Key = "pre_mature"; Label = "成熟前" },
  [pscustomobject]@{ Index = 5; Key = "mature"; Label = "成熟" },
  [pscustomobject]@{ Index = 6; Key = "withered"; Label = "枯萎" }
)

$currentStageNames = @("seed", "sprout", "growing", "mature")
$defaultCurrentStateIndexes = @(0, 1, 3, 5)
$currentStageOverrides = @{
  # Rice's top-level early states include a field tile. The web scene needs the plant-only child sprite.
  "60:1" = [pscustomobject]@{ StateIndex = 2; SourceCharacterId = 14; Relationship = "nested-character-of-state" }
  "60:2" = [pscustomobject]@{ StateIndex = 4; SourceCharacterId = 44; Relationship = "state-character" }
  "61:2" = [pscustomobject]@{ StateIndex = 4; SourceCharacterId = 22; Relationship = "state-character" }
}

function Get-Hash([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-RelativePath([string]$Root, [string]$Path) {
  return [IO.Path]::GetRelativePath($Root, $Path).Replace("\", "/")
}

function Get-StateSpritePath([string]$CropExportDirectory, [string]$CharacterId) {
  $spriteDirectory = Join-Path $CropExportDirectory "sprites"
  if (-not (Test-Path -LiteralPath $spriteDirectory -PathType Container)) {
    $spriteDirectory = $CropExportDirectory
  }
  $pattern = '^DefineSprite_' + [regex]::Escape($CharacterId) + '(?:_|$)'
  $matches = @(Get-ChildItem -LiteralPath $spriteDirectory -Directory | Where-Object Name -Match $pattern)
  if ($matches.Count -ne 1) {
    throw "Expected one sprite directory for character $CharacterId in $spriteDirectory, found $($matches.Count)"
  }
  $frames = @(Get-ChildItem -LiteralPath $matches[0].FullName -File -Filter "*.png" | Sort-Object Name)
  if ($frames.Count -ne 1) {
    throw "Expected one PNG frame for character $CharacterId in $($matches[0].FullName), found $($frames.Count)"
  }
  return $frames[0].FullName
}

function Get-CropSpriteIndex([string]$CropExportDirectory) {
  $spriteDirectory = Join-Path $CropExportDirectory "sprites"
  if (-not (Test-Path -LiteralPath $spriteDirectory -PathType Container)) {
    $spriteDirectory = $CropExportDirectory
  }

  return @(Get-ChildItem -LiteralPath $spriteDirectory -Directory | ForEach-Object {
    if ($_.Name -notmatch '^DefineSprite_(?<id>\d+)(?:_|$)') { return }
    $frames = @(Get-ChildItem -LiteralPath $_.FullName -File -Filter "*.png" | Sort-Object Name)
    if ($frames.Count -ne 1) { return }
    [pscustomobject]@{
      CharacterId = [int]$Matches["id"]
      Path = $frames[0].FullName
      Hash = Get-Hash $frames[0].FullName
    }
  })
}

function New-CropContactSheet($Crop, [array]$States, [string]$Path) {
  $margin = 16
  $panelWidth = 176
  $panelTop = 58
  $panelHeight = 272
  $canvasWidth = ($margin * 2) + ($panelWidth * $States.Count)
  $canvasHeight = $panelTop + $panelHeight + $margin

  $bitmap = [Drawing.Bitmap]::new($canvasWidth, $canvasHeight)
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear([Drawing.Color]::FromArgb(239, 242, 238))

  $titleFont = [Drawing.Font]::new("Microsoft YaHei", 16, [Drawing.FontStyle]::Bold)
  $labelFont = [Drawing.Font]::new("Microsoft YaHei", 11, [Drawing.FontStyle]::Bold)
  $infoFont = [Drawing.Font]::new("Microsoft YaHei", 8)
  $titleBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(31, 42, 37))
  $mutedBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(92, 104, 98))
  $currentBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(24, 91, 142))
  $panelBrush = [Drawing.SolidBrush]::new([Drawing.Color]::White)
  $defaultPen = [Drawing.Pen]::new([Drawing.Color]::FromArgb(190, 198, 193), 1)
  $maturePen = [Drawing.Pen]::new([Drawing.Color]::FromArgb(52, 130, 74), 3)
  $witheredPen = [Drawing.Pen]::new([Drawing.Color]::FromArgb(173, 73, 61), 3)

  try {
    $title = "#$($Crop.source_id)  $($Crop.name)  |  原等级 $($Crop.original_level)  |  七阶段源角色与当前四阶段映射"
    $graphics.DrawString($title, $titleFont, $titleBrush, 18, 15)

    foreach ($state in $States) {
      $x = $margin + ($state.state_index * $panelWidth)
      $panelRectangle = [Drawing.Rectangle]::new($x + 4, $panelTop, $panelWidth - 8, $panelHeight)
      $graphics.FillRectangle($panelBrush, $panelRectangle)
      $borderPen = if ($state.state_key -eq "mature") {
        $maturePen
      } elseif ($state.state_key -eq "withered") {
        $witheredPen
      } else {
        $defaultPen
      }
      $graphics.DrawRectangle($borderPen, $panelRectangle)
      $graphics.DrawString("$($state.state_index)  $($state.state_label)", $labelFont, $titleBrush, $x + 14, $panelTop + 10)
      $graphics.DrawString("角色 #$($state.source_character_id)", $infoFont, $mutedBrush, $x + 14, $panelTop + 36)

      $image = [Drawing.Image]::FromFile($state._image_path)
      try {
        $maximumWidth = $panelWidth - 28
        $maximumHeight = 180
        $scale = [Math]::Min(1.0, [Math]::Min($maximumWidth / $image.Width, $maximumHeight / $image.Height))
        $drawWidth = [int][Math]::Round($image.Width * $scale)
        $drawHeight = [int][Math]::Round($image.Height * $scale)
        $drawX = $x + [int](($panelWidth - $drawWidth) / 2)
        $drawY = $panelTop + 62 + [int](($maximumHeight - $drawHeight) / 2)
        $graphics.DrawImage($image, $drawX, $drawY, $drawWidth, $drawHeight)
      } finally {
        $image.Dispose()
      }

      $footerY = $panelTop + 230
      if ($state.duplicate_character) {
        $graphics.DrawString("七阶段中复用角色", $infoFont, $mutedBrush, $x + 14, $footerY - 18)
      }
      if ($state.current_match_status -eq "exact") {
        $relationship = if ($state.current_source_relationship -eq "nested-character-of-state") { "嵌套角色" } else { "状态角色" }
        $graphics.DrawString("当前 #$($state.current_stage)：$relationship #$($state.current_source_character_id)", $infoFont, $currentBrush, $x + 14, $footerY)
        $graphics.DrawString("SHA-256 完全匹配", $infoFont, $currentBrush, $x + 14, $footerY + 18)
      } elseif ($state.current_match_status -eq "mismatch") {
        $graphics.DrawString("当前 #$($state.current_stage)：来源不匹配", $infoFont, [Drawing.Brushes]::DarkRed, $x + 14, $footerY)
      }
    }

    $bitmap.Save($Path, [Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $defaultPen.Dispose()
    $maturePen.Dispose()
    $witheredPen.Dispose()
    $panelBrush.Dispose()
    $titleBrush.Dispose()
    $mutedBrush.Dispose()
    $currentBrush.Dispose()
    $titleFont.Dispose()
    $labelFont.Dispose()
    $infoFont.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

$crops = @(Import-Csv -LiteralPath $cropTablePath | Sort-Object original_level, source_id)
$visualReviews = @{}
if (Test-Path -LiteralPath $visualReviewTablePath -PathType Leaf) {
  foreach ($review in @(Import-Csv -LiteralPath $visualReviewTablePath)) {
    $visualReviews[$review.source_id] = $review
  }
}
$stateRows = [Collections.Generic.List[object]]::new()
$currentRows = [Collections.Generic.List[object]]::new()
$reviewRows = [Collections.Generic.List[object]]::new()
$galleryRows = [Collections.Generic.List[object]]::new()

foreach ($crop in $crops) {
  $visualReview = if ($visualReviews.ContainsKey($crop.source_id)) { $visualReviews[$crop.source_id] } else { $null }
  $visualReviewStatus = if ($visualReview) { $visualReview.review_status } else { "pending-contact-sheet-review" }
  $visualReviewNote = if ($visualReview) { $visualReview.review_note } else { "" }
  $cropExportDirectory = Join-Path $InventoryDirectory "Crop_$($crop.source_id).swf"
  if (-not (Test-Path -LiteralPath $cropExportDirectory -PathType Container)) {
    throw "Missing JPEXS export directory: $cropExportDirectory"
  }
  $characterIds = @($crop.state_character_ids -split ",")
  if ($characterIds.Count -ne 7) {
    throw "Crop $($crop.source_id) expected seven state character IDs, found $($characterIds.Count)"
  }
  $characterCounts = @{}
  foreach ($characterId in $characterIds) {
    if (-not $characterCounts.ContainsKey($characterId)) { $characterCounts[$characterId] = 0 }
    $characterCounts[$characterId] += 1
  }

  $currentMappingsByStateIndex = @{}
  if ($crop.current_id) {
    $cropSpriteIndex = Get-CropSpriteIndex $cropExportDirectory
    foreach ($currentStage in 0..3) {
      $mappingKey = "$($crop.source_id):$currentStage"
      $stateIndex = $defaultCurrentStateIndexes[$currentStage]
      $sourceCharacterId = [int]$characterIds[$stateIndex]
      $relationship = "state-character"
      if ($currentStageOverrides.ContainsKey($mappingKey)) {
        $override = $currentStageOverrides[$mappingKey]
        $stateIndex = $override.StateIndex
        $sourceCharacterId = $override.SourceCharacterId
        $relationship = $override.Relationship
      }

      $definition = $stateDefinitions[$stateIndex]
      $sourceImagePath = Get-StateSpritePath $cropExportDirectory $sourceCharacterId
      $sourceHash = Get-Hash $sourceImagePath
      $currentAssetName = "crop-$($crop.current_id)-$currentStage.png"
      $currentAssetPath = Join-Path $currentAssetDirectory $currentAssetName
      if (-not (Test-Path -LiteralPath $currentAssetPath -PathType Leaf)) {
        throw "Missing current crop asset: $currentAssetPath"
      }
      $currentHash = Get-Hash $currentAssetPath
      $hashMatches = @($cropSpriteIndex | Where-Object Hash -eq $currentHash)
      $matchingCharacterIds = @($hashMatches.CharacterId | Sort-Object -Unique)
      $selectedSourceFound = $matchingCharacterIds -contains $sourceCharacterId
      $matchStatus = if ($currentHash -eq $sourceHash -and $selectedSourceFound) { "exact" } else { "mismatch" }

      $mapping = [pscustomobject][ordered]@{
        source_id = [int]$crop.source_id
        name = $crop.name
        current_id = $crop.current_id
        current_stage = $currentStage
        current_stage_name = $currentStageNames[$currentStage]
        linked_state_index = $stateIndex
        linked_state_key = $definition.Key
        linked_state_label = $definition.Label
        source_character_id = $sourceCharacterId
        source_relationship = $relationship
        source_export_file = Get-RelativePath $InventoryDirectory $sourceImagePath
        source_sha256 = $sourceHash
        source_hash_match_count = $hashMatches.Count
        source_hash_matching_character_ids = $matchingCharacterIds -join ","
        current_asset = "assets/manor/classic/$currentAssetName"
        current_sha256 = $currentHash
        match_status = $matchStatus
        visual_review_status = $visualReviewStatus
        _source_image_path = $sourceImagePath
      }
      if ($currentMappingsByStateIndex.ContainsKey($stateIndex)) {
        throw "Crop $($crop.source_id) maps more than one current stage to state $stateIndex"
      }
      $currentMappingsByStateIndex[$stateIndex] = $mapping
      $currentRows.Add($mapping)
    }
  }

  $states = [Collections.Generic.List[object]]::new()
  foreach ($definition in $stateDefinitions) {
    $characterId = $characterIds[$definition.Index]
    $imagePath = Get-StateSpritePath $cropExportDirectory $characterId
    $image = [Drawing.Image]::FromFile($imagePath)
    try {
      $width = $image.Width
      $height = $image.Height
    } finally {
      $image.Dispose()
    }

    $currentMapping = if ($currentMappingsByStateIndex.ContainsKey($definition.Index)) {
      $currentMappingsByStateIndex[$definition.Index]
    } else { $null }

    $state = [pscustomobject][ordered]@{
      source_id = [int]$crop.source_id
      name = $crop.name
      original_level = [int]$crop.original_level
      state_index = $definition.Index
      state_key = $definition.Key
      state_label = $definition.Label
      source_character_id = [int]$characterId
      source_export_file = Get-RelativePath $InventoryDirectory $imagePath
      source_sha256 = Get-Hash $imagePath
      width = $width
      height = $height
      duplicate_character = $characterCounts[$characterId] -gt 1
      current_stage = if ($currentMapping) { $currentMapping.current_stage } else { "" }
      current_asset = if ($currentMapping) { $currentMapping.current_asset } else { "" }
      current_source_character_id = if ($currentMapping) { $currentMapping.source_character_id } else { "" }
      current_source_export_file = if ($currentMapping) { $currentMapping.source_export_file } else { "" }
      current_source_relationship = if ($currentMapping) { $currentMapping.source_relationship } else { "" }
      current_sha256 = if ($currentMapping) { $currentMapping.current_sha256 } else { "" }
      current_match_status = if ($currentMapping) { $currentMapping.match_status } else { "not-current" }
      visual_review_status = $visualReviewStatus
      _image_path = $imagePath
    }
    $states.Add($state)
    $stateRows.Add($state)
  }

  $fileName = "crop-{0:D3}.png" -f [int]$crop.source_id
  $contactSheetPath = Join-Path $OutputDirectory $fileName
  New-CropContactSheet $crop $states.ToArray() $contactSheetPath
  $currentStates = @($states | Where-Object current_asset)
  $mismatches = @($currentStates | Where-Object current_match_status -ne "exact")
  $reviewRows.Add([pscustomobject][ordered]@{
    source_id = [int]$crop.source_id
    name = $crop.name
    original_level = [int]$crop.original_level
    contact_sheet = "contact-sheets/crops/$fileName"
    state_rows = $states.Count
    unique_character_count = @($characterIds | Sort-Object -Unique).Count
    duplicate_character_count = 7 - @($characterIds | Sort-Object -Unique).Count
    current_assets_checked = $currentStates.Count
    current_assets_exact = @($currentStates | Where-Object current_match_status -eq "exact").Count
    current_assets_mismatch = $mismatches.Count
    automated_status = if ($mismatches.Count -eq 0) { "ready-for-visual-review" } else { "current-asset-mismatch" }
    visual_review_status = $visualReviewStatus
    visual_review_note = $visualReviewNote
  })
  $galleryRows.Add([pscustomobject]@{
    FileName = $fileName
    SourceId = [int]$crop.source_id
    Name = $crop.name
    Level = [int]$crop.original_level
    Status = if ($mismatches.Count -eq 0) { "待视觉复核" } else { "当前素材不匹配" }
  })
}

$stateRows |
  Select-Object source_id,name,original_level,state_index,state_key,state_label,source_character_id,source_export_file,source_sha256,width,height,duplicate_character,current_stage,current_asset,current_source_character_id,current_source_export_file,current_source_relationship,current_sha256,current_match_status,visual_review_status |
  Export-Csv -LiteralPath $stateTablePath -NoTypeInformation -Encoding utf8
$currentRows |
  Select-Object source_id,name,current_id,current_stage,current_stage_name,linked_state_index,linked_state_key,linked_state_label,source_character_id,source_relationship,source_export_file,source_sha256,source_hash_match_count,source_hash_matching_character_ids,current_asset,current_sha256,match_status,visual_review_status |
  Export-Csv -LiteralPath $currentTablePath -NoTypeInformation -Encoding utf8
$reviewRows | Export-Csv -LiteralPath $reviewTablePath -NoTypeInformation -Encoding utf8

$htmlRows = foreach ($item in $galleryRows) {
  $name = [Net.WebUtility]::HtmlEncode($item.Name)
  @"
      <article class="crop-sheet" data-status="$($item.Status)">
        <a href="$($item.FileName)" target="_blank" rel="noreferrer">
          <img src="$($item.FileName)" alt="#$($item.SourceId) $name 七阶段联系表" loading="lazy">
        </a>
        <div><strong>#$($item.SourceId) $name</strong><span>等级 $($item.Level) · $($item.Status)</span></div>
      </article>
"@
}

$html = @"
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>QQ 农场作物七阶段联系表</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; color: #1f2a25; background: #eef2ee; font-family: "Microsoft YaHei", sans-serif; }
    header { position: sticky; top: 0; z-index: 2; padding: 16px 24px; border-bottom: 1px solid #c7d0ca; background: rgba(255,255,255,.96); }
    h1 { margin: 0 0 6px; font-size: 22px; letter-spacing: 0; }
    p { margin: 0; color: #5c6862; font-size: 14px; }
    main { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 14px; padding: 18px; }
    .crop-sheet { overflow: hidden; border: 1px solid #c7d0ca; border-radius: 6px; background: #fff; }
    .crop-sheet a { display: block; aspect-ratio: 1264 / 346; overflow: auto; background: #eef2ee; }
    .crop-sheet img { display: block; width: 100%; height: auto; }
    .crop-sheet div { display: flex; justify-content: space-between; gap: 12px; padding: 10px 12px; font-size: 13px; }
    .crop-sheet span { color: #637069; text-align: right; }
    @media (max-width: 600px) { main { grid-template-columns: 1fr; padding: 10px; } header { padding: 12px; } }
  </style>
</head>
<body>
  <header>
    <h1>QQ 农场作物七阶段联系表</h1>
    <p>共 $($galleryRows.Count) 种作物；绿色边框为成熟，红色边框为枯萎，蓝字标出当前四阶段的精确来源。点击联系表查看原尺寸。</p>
  </header>
  <main>
$($htmlRows -join "`n")
  </main>
</body>
</html>
"@
Set-Content -LiteralPath (Join-Path $OutputDirectory "index.html") -Value $html -Encoding utf8

$mismatchCount = @($stateRows | Where-Object current_match_status -eq "mismatch").Count
if ($mismatchCount -gt 0) {
  throw "$mismatchCount current crop assets do not match their selected source sprites"
}

[pscustomobject]@{
  Crops = $crops.Count
  StateRows = $stateRows.Count
  ContactSheets = $galleryRows.Count
  CurrentAssetsExact = @($currentRows | Where-Object match_status -eq "exact").Count
  CurrentAssetsMismatch = $mismatchCount
  VisualReviews = @($visualReviews.Values | Where-Object review_status -eq "reviewed-ok").Count
  OutputDirectory = $OutputDirectory
}
