param(
  [string]$LegacyRoot,
  [string]$JpexsJar = "C:\Code\30_Tools\jpexs\26.2.1\app\ffdec.jar",
  [string]$JavaExe = "java",
  [string]$InventoryDirectory,
  [string]$OutputDirectory
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $LegacyRoot) {
  $LegacyRoot = Join-Path $repositoryRoot "..\..\20_ThirdParty\qqfarm\upload\home\qqfarm"
}
$LegacyRoot = (Resolve-Path $LegacyRoot).Path
if (-not $InventoryDirectory) {
  $InventoryDirectory = Join-Path $repositoryRoot "data\manor-asset-work\interface-media-export"
}
if (-not $OutputDirectory) {
  $OutputDirectory = Join-Path $repositoryRoot "docs\manor-assets\contact-sheets\interface-media"
}

$moduleRoot = Join-Path $LegacyRoot "module"
$fileTablePath = Join-Path $repositoryRoot "docs\manor-assets\files.csv"
$animalTablePath = Join-Path $repositoryRoot "docs\manor-assets\animals.csv"
$assetTablePath = Join-Path $repositoryRoot "docs\manor-assets\interface-media-assets.csv"
$symbolTablePath = Join-Path $repositoryRoot "docs\manor-assets\interface-symbol-assets.csv"
$soundTablePath = Join-Path $repositoryRoot "docs\manor-assets\sound-assets.csv"
$reviewTablePath = Join-Path $repositoryRoot "docs\manor-assets\interface-media-contact-review.csv"
$visualReviewTablePath = Join-Path $repositoryRoot "docs\manor-assets\interface-media-visual-review.csv"
$mediaExporter = Join-Path $PSScriptRoot "ManorSwfMediaExporter.java"

if (-not (Test-Path -LiteralPath $JpexsJar -PathType Leaf)) {
  throw "JPEXS jar not found: $JpexsJar"
}
if (-not (Test-Path -LiteralPath $fileTablePath -PathType Leaf)) {
  throw "File table not found: $fileTablePath. Run build-manor-asset-map.ps1 first."
}

New-Item -ItemType Directory -Force -Path $InventoryDirectory, $OutputDirectory | Out-Null
. (Join-Path $PSScriptRoot "manor-asset-review-tools.ps1")

$targetCategories = @(
  "farm-ui",
  "farm-crop-support",
  "farm-flower",
  "farm-decoration-board",
  "pasture-ui",
  "pasture-sound",
  "other"
)
$visualSwfCategories = @("farm-ui", "farm-crop-support", "farm-flower", "pasture-ui", "other")
$files = @(Import-Csv -LiteralPath $fileTablePath)
$targetFiles = @($files | Where-Object category -In $targetCategories | Sort-Object category, source_file)
$filesBySource = @{}
foreach ($file in $targetFiles) { $filesBySource[$file.source_file] = $file }

$animalsById = @{}
foreach ($animal in @(Import-Csv -LiteralPath $animalTablePath)) { $animalsById[$animal.source_id] = $animal.name }

$swfTargets = @($targetFiles | Where-Object extension -eq ".swf")
$relativeSwfPaths = @($swfTargets | ForEach-Object { $_.source_file.Substring("module/".Length).Replace("/", "\") })
$javaArguments = @("--class-path", $JpexsJar, $mediaExporter, $moduleRoot, $InventoryDirectory) + $relativeSwfPaths
$mediaLines = & $JavaExe @javaArguments
if ($LASTEXITCODE -ne 0) { throw "SWF interface/media inventory failed" }
$mediaRows = @($mediaLines | ConvertFrom-Csv -Delimiter "`t")
foreach ($row in $mediaRows) { $row.source_file = "module/$($row.source_file)" }

$fallbackErrors = @($mediaRows | Where-Object {
  $_.error -and $_.error -notin @("empty-outline", "not-drawable") -and
  $_.entry_kind -in @("root-frame", "symbol-class", "export-asset")
})
foreach ($sourceGroup in @($fallbackErrors | Group-Object source_file)) {
  $sourceFile = $sourceGroup.Name
  $sourcePath = Join-Path $LegacyRoot ($sourceFile.Replace("/", "\"))
  $slug = $sourceFile.Substring("module/".Length) -replace "[\\/]", "__"
  $spriteDirectory = Join-Path $InventoryDirectory "jpexs-fallback\$slug\sprites"
  $frameDirectory = Join-Path $InventoryDirectory "jpexs-fallback\$slug\frames"

  $spriteErrors = @($sourceGroup.Group | Where-Object entry_kind -In @("symbol-class", "export-asset"))
  if ($spriteErrors.Count -gt 0 -and -not (Test-Path -LiteralPath $spriteDirectory -PathType Container)) {
    New-Item -ItemType Directory -Force -Path $spriteDirectory | Out-Null
    & $JavaExe -jar $JpexsJar -onerror abort -export sprite $spriteDirectory $sourcePath | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "JPEXS sprite fallback failed for $sourceFile" }
  }
  foreach ($entry in $spriteErrors) {
    $pattern = "^DefineSprite_" + [regex]::Escape($entry.character_id) + "(?:_|$)"
    $directories = @(Get-ChildItem -LiteralPath $spriteDirectory -Directory | Where-Object Name -Match $pattern)
    if ($directories.Count -ne 1) { continue }
    $frames = @(Get-ChildItem -LiteralPath $directories[0].FullName -File -Filter "*.png" | Sort-Object { [int][IO.Path]::GetFileNameWithoutExtension($_.Name) })
    if ($frames.Count -eq 0) { continue }
    $entry.output_file = Get-ManorAssetRelativePath $InventoryDirectory $frames[0].FullName
    $entry.frame_count = $frames.Count
    $entry.error = ""
  }

  $rootErrors = @($sourceGroup.Group | Where-Object entry_kind -eq "root-frame")
  if ($rootErrors.Count -gt 0 -and -not (Test-Path -LiteralPath $frameDirectory -PathType Container)) {
    New-Item -ItemType Directory -Force -Path $frameDirectory | Out-Null
    & $JavaExe -jar $JpexsJar -onerror abort -ignorebackground -select 1 -export frame $frameDirectory $sourcePath | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "JPEXS frame fallback failed for $sourceFile" }
  }
  $rootFrame = Join-Path $frameDirectory "1.png"
  if (Test-Path -LiteralPath $rootFrame -PathType Leaf) {
    foreach ($entry in $rootErrors) {
      $entry.output_file = Get-ManorAssetRelativePath $InventoryDirectory $rootFrame
      $entry.frame_count = 1
      $entry.error = ""
    }
  }
}

function Get-VisualRole([string]$Category, [string]$EntryKind, [string]$EntryName) {
  if ($EntryKind -eq "root-frame") { return "root-stage" }
  if ($Category -eq "farm-crop-support") { return "crop-support" }
  if ($Category -eq "farm-flower") { return "flower-effect" }
  if ($EntryName -match "(?i)(effect|animation|animate|spark|star|glow|smoke|rain|snow|water|fly|heart|bubble|fertiliz|harvest|pick|spray|weed|worm)") {
    return "action-effect-candidate"
  }
  if ($Category -in @("farm-ui", "pasture-ui")) { return "ui-component" }
  return "runtime-shell"
}

function Draw-ImageFit($Graphics, [string]$Path, [Drawing.Rectangle]$Target) {
  $summary = Get-ManorAssetImageSummary $Path
  $image = [Drawing.Image]::FromFile($Path)
  try {
    $source = if ($summary.VisibleWidth -gt 0 -and $summary.VisibleHeight -gt 0) {
      [Drawing.Rectangle]::new($summary.VisibleX, $summary.VisibleY, $summary.VisibleWidth, $summary.VisibleHeight)
    } else {
      [Drawing.Rectangle]::new(0, 0, $image.Width, $image.Height)
    }
    $scale = [Math]::Min(1.0, [Math]::Min($Target.Width / $source.Width, $Target.Height / $source.Height))
    $width = [Math]::Max(1, [int][Math]::Round($source.Width * $scale))
    $height = [Math]::Max(1, [int][Math]::Round($source.Height * $scale))
    $destination = [Drawing.Rectangle]::new(
      $Target.X + [int](($Target.Width - $width) / 2),
      $Target.Y + [int](($Target.Height - $height) / 2),
      $width,
      $height
    )
    $Graphics.DrawImage($image, $destination, $source, [Drawing.GraphicsUnit]::Pixel)
  } finally {
    $image.Dispose()
  }
}

function Get-ShortLabel([string]$Value, [int]$MaximumLength = 24) {
  if (-not $Value -or $Value.Length -le $MaximumLength) { return $Value }
  return $Value.Substring(0, $MaximumLength - 3) + "..."
}

function New-MediaContactSheet([string]$Title, [string]$Subtitle, [array]$Items, [string]$Path) {
  $columns = 6
  $cellWidth = 184
  $cellHeight = 174
  $headerHeight = 76
  $rows = [Math]::Max(1, [int][Math]::Ceiling($Items.Count / $columns))
  $bitmap = [Drawing.Bitmap]::new(($columns * $cellWidth) + 24, $headerHeight + ($rows * $cellHeight) + 16)
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear([Drawing.Color]::FromArgb(237, 241, 238))

  $titleFont = [Drawing.Font]::new("Microsoft YaHei", 15, [Drawing.FontStyle]::Bold)
  $subtitleFont = [Drawing.Font]::new("Microsoft YaHei", 8)
  $labelFont = [Drawing.Font]::new("Microsoft YaHei", 8, [Drawing.FontStyle]::Bold)
  $infoFont = [Drawing.Font]::new("Microsoft YaHei", 7)
  $titleBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(31, 42, 37))
  $mutedBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(87, 101, 94))
  $alertBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(151, 58, 48))
  $panelBrush = [Drawing.SolidBrush]::new([Drawing.Color]::White)
  $borderPen = [Drawing.Pen]::new([Drawing.Color]::FromArgb(193, 202, 196), 1)

  try {
    $graphics.DrawString($Title, $titleFont, $titleBrush, 14, 12)
    $graphics.DrawString($Subtitle, $subtitleFont, $mutedBrush, 14, 42)
    for ($index = 0; $index -lt $Items.Count; $index += 1) {
      $item = $Items[$index]
      $column = $index % $columns
      $row = [int][Math]::Floor($index / $columns)
      $x = 12 + ($column * $cellWidth)
      $y = $headerHeight + ($row * $cellHeight)
      $panel = [Drawing.Rectangle]::new($x + 3, $y + 3, $cellWidth - 7, $cellHeight - 7)
      $graphics.FillRectangle($panelBrush, $panel)
      $graphics.DrawRectangle($borderPen, $panel)
      $graphics.DrawString((Get-ShortLabel $item.Label), $labelFont, $titleBrush, $x + 10, $y + 10)
      $graphics.DrawString((Get-ShortLabel $item.Info 30), $infoFont, $mutedBrush, $x + 10, $y + 29)

      if ($item.Path -and (Test-Path -LiteralPath $item.Path -PathType Leaf)) {
        Draw-ImageFit $graphics $item.Path ([Drawing.Rectangle]::new($x + 10, $y + 48, $cellWidth - 21, 98))
      } else {
        $message = if ($item.Error) { Get-ShortLabel $item.Error 28 } else { "无可见首帧" }
        $graphics.DrawString($message, $infoFont, $alertBrush, $x + 10, $y + 88)
      }
      $graphics.DrawString((Get-ShortLabel $item.Footer 28), $infoFont, $mutedBrush, $x + 10, $y + 148)
    }
    $bitmap.Save($Path, [Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $borderPen.Dispose()
    $panelBrush.Dispose()
    $titleBrush.Dispose()
    $mutedBrush.Dispose()
    $alertBrush.Dispose()
    $titleFont.Dispose()
    $subtitleFont.Dispose()
    $labelFont.Dispose()
    $infoFont.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

function Get-ContactFileName([string]$SourceFile) {
  $name = $SourceFile.Substring("module/".Length) -replace "[\\/]", "__"
  return "media-$name.png"
}

$visualReviews = @{}
if (Test-Path -LiteralPath $visualReviewTablePath -PathType Leaf) {
  foreach ($review in @(Import-Csv -LiteralPath $visualReviewTablePath)) { $visualReviews[$review.review_key] = $review }
}

$symbolRows = [Collections.Generic.List[object]]::new()
$soundRows = [Collections.Generic.List[object]]::new()
$reviewRows = [Collections.Generic.List[object]]::new()
$galleryRows = [Collections.Generic.List[object]]::new()

foreach ($target in $swfTargets) {
  $rows = @($mediaRows | Where-Object source_file -eq $target.source_file)
  $sourceErrors = @($rows | Where-Object entry_kind -eq "source" | Where-Object error)
  $visualRows = @($rows | Where-Object entry_kind -In @("root-frame", "symbol-class", "export-asset"))

  if ($target.category -in $visualSwfCategories) {
    $contactItems = [Collections.Generic.List[object]]::new()
    foreach ($entry in $visualRows) {
      $outputPath = if ($entry.output_file) { Join-Path $InventoryDirectory ($entry.output_file.Replace("/", "\")) } else { $null }
      $summary = if ($outputPath -and (Test-Path -LiteralPath $outputPath -PathType Leaf)) { Get-ManorAssetImageSummary $outputPath } else { $null }
      $role = Get-VisualRole $target.category $entry.entry_kind $entry.entry_name
      $symbolRows.Add([pscustomobject][ordered]@{
        source_file = $target.source_file
        category = $target.category
        entry_kind = $entry.entry_kind
        source_character_id = $entry.character_id
        entry_name = $entry.entry_name
        tag_type = $entry.tag_type
        visual_role = $role
        classification_basis = if ($role -eq "action-effect-candidate") { "class-name-heuristic" } else { "source-category" }
        frame_count = $entry.frame_count
        content_rect = $entry.content_rect
        source_export_file = $entry.output_file
        source_export_sha256 = if ($outputPath) { Get-ManorAssetHash $outputPath } else { "" }
        width = if ($summary) { $summary.Width } else { "" }
        height = if ($summary) { $summary.Height } else { "" }
        visible_pixels = if ($summary) { $summary.VisiblePixels } else { 0 }
        render_status = if ($outputPath) { "rendered" } elseif ($entry.error) { $entry.error } else { "not-rendered" }
      })
      $contactItems.Add([pscustomobject]@{
        Label = if ($entry.entry_kind -eq "root-frame") { "根舞台首帧" } else { "#$($entry.character_id) $($entry.entry_name)" }
        Info = "$($entry.entry_kind) | $role"
        Path = $outputPath
        Error = $entry.error
        Footer = if ($entry.frame_count) { "$($entry.tag_type) | $($entry.frame_count) 帧" } else { $entry.tag_type }
      })
    }

    if ($target.category -eq "farm-flower") {
      $gifSource = [IO.Path]::ChangeExtension($target.source_file, ".gif")
      if ($filesBySource.ContainsKey($gifSource)) {
        $gifPath = Join-Path $LegacyRoot ($gifSource.Replace("/", "\"))
        $contactItems.Add([pscustomobject]@{
          Label = "GIF 商店预览"
          Info = "paired-static-preview"
          Path = $gifPath
          Error = ""
          Footer = [IO.Path]::GetFileName($gifSource)
        })
      }
    }

    $contactFileName = Get-ContactFileName $target.source_file
    $contactPath = Join-Path $OutputDirectory $contactFileName
    New-MediaContactSheet $target.source_file "$($target.category) | 映射 $($visualRows.Count) | 声音标签 $(@($rows | Where-Object entry_kind -eq 'define-sound').Count)" $contactItems.ToArray() $contactPath

    $renderedCount = @($visualRows | Where-Object output_file).Count
    $unexpectedErrors = @($visualRows | Where-Object { $_.error -and $_.error -notin @("empty-outline", "not-drawable") })
    $reviewKey = $target.source_file
    $visualReview = if ($visualReviews.ContainsKey($reviewKey)) { $visualReviews[$reviewKey] } else { $null }
    $reviewRows.Add([pscustomobject][ordered]@{
      review_key = $reviewKey
      category = $target.category
      source_file = $target.source_file
      contact_sheet = "contact-sheets/interface-media/$contactFileName"
      mapped_entries = $visualRows.Count
      rendered_entries = $renderedCount
      empty_outline_entries = @($visualRows | Where-Object error -eq "empty-outline").Count
      non_drawable_entries = @($visualRows | Where-Object error -eq "not-drawable").Count
      render_errors = $unexpectedErrors.Count
      action_effect_candidates = @($symbolRows | Where-Object { $_.source_file -eq $target.source_file -and $_.visual_role -eq "action-effect-candidate" }).Count
      automated_status = if ($sourceErrors.Count -gt 0 -or $unexpectedErrors.Count -gt 0) { "render-error" } elseif ($renderedCount -eq 0) { "no-rendered-visual" } else { "ready-for-visual-review" }
      visual_review_status = if ($visualReview) { $visualReview.review_status } else { "pending-contact-sheet-review" }
      visual_review_note = if ($visualReview) { $visualReview.review_note } else { "" }
    })
    $galleryRows.Add([pscustomobject]@{ FileName = $contactFileName; Name = $target.source_file; Category = $target.category })
  }

  foreach ($sound in @($rows | Where-Object entry_kind -eq "define-sound")) {
    $animalId = ""
    $variant = ""
    if ($target.source_file -match "^module/mc/main/sound/animal/(?<variant>[12])/s(?<id>\d+)\.swf$") {
      $animalId = $Matches["id"]
      $variant = $Matches["variant"]
    }
    $soundRows.Add([pscustomobject][ordered]@{
      source_file = $target.source_file
      category = $target.category
      animal_id = $animalId
      animal_name = if ($animalId -and $animalsById.ContainsKey($animalId)) { $animalsById[$animalId] } else { "" }
      variant = $variant
      source_character_id = $sound.character_id
      entry_name = $sound.entry_name
      sound_format = $sound.sound_format
      sound_rate = $sound.sound_rate
      sound_channels = $sound.sound_channels
      sound_sample_count = $sound.sound_sample_count
      sound_data_bytes = $sound.sound_data_bytes
      sound_duration_seconds = $sound.sound_duration_seconds
      container_sha256 = $target.sha256
    })
  }
}

$boardFiles = @($targetFiles | Where-Object { $_.category -eq "farm-decoration-board" -and $_.extension -eq ".png" } | Sort-Object { [int][IO.Path]::GetFileNameWithoutExtension($_.source_file) })
if ($boardFiles.Count -gt 0) {
  $boardItems = @($boardFiles | ForEach-Object {
    [pscustomobject]@{
      Label = "留言板 #$([IO.Path]::GetFileNameWithoutExtension($_.source_file))"
      Info = "farm-decoration-board"
      Path = Join-Path $LegacyRoot ($_.source_file.Replace("/", "\"))
      Error = ""
      Footer = [IO.Path]::GetFileName($_.source_file)
    }
  })
  $boardFileName = "media-farm-decoration-board.png"
  New-MediaContactSheet "农场装饰留言板" "15 张 PNG；Thumbs.db 仅登记元数据，不作为素材" $boardItems (Join-Path $OutputDirectory $boardFileName)
  $reviewKey = "farm-decoration-board"
  $visualReview = if ($visualReviews.ContainsKey($reviewKey)) { $visualReviews[$reviewKey] } else { $null }
  $reviewRows.Add([pscustomobject][ordered]@{
    review_key = $reviewKey
    category = "farm-decoration-board"
    source_file = "module/nc/farm/diy/board/*.png"
    contact_sheet = "contact-sheets/interface-media/$boardFileName"
    mapped_entries = $boardFiles.Count
    rendered_entries = $boardFiles.Count
    empty_outline_entries = 0
    non_drawable_entries = 0
    render_errors = 0
    action_effect_candidates = 0
    automated_status = "ready-for-visual-review"
    visual_review_status = if ($visualReview) { $visualReview.review_status } else { "pending-contact-sheet-review" }
    visual_review_note = if ($visualReview) { $visualReview.review_note } else { "" }
  })
  $galleryRows.Add([pscustomobject]@{ FileName = $boardFileName; Name = "农场装饰留言板"; Category = "farm-decoration-board" })
}

$assetRows = foreach ($target in $targetFiles) {
  $rows = if ($target.extension -eq ".swf") { @($mediaRows | Where-Object source_file -eq $target.source_file) } else { @() }
  $visualRows = @($rows | Where-Object entry_kind -In @("root-frame", "symbol-class", "export-asset"))
  $sounds = @($rows | Where-Object entry_kind -eq "define-sound")
  $sourceErrors = @($rows | Where-Object entry_kind -eq "source" | Where-Object error)
  $sourcePath = Join-Path $LegacyRoot ($target.source_file.Replace("/", "\"))
  $staticSummary = if ($target.extension -in @(".png", ".gif")) { Get-ManorAssetImageSummary $sourcePath } else { $null }
  $reviewKey = if ($target.category -eq "farm-decoration-board" -and $target.extension -eq ".png") { "farm-decoration-board" } else { $target.source_file }
  $visualReview = if ($visualReviews.ContainsKey($reviewKey)) { $visualReviews[$reviewKey] } else { $null }
  $soundDurationTotal = if ($sounds.Count -gt 0) {
    [double](($sounds | Measure-Object sound_duration_seconds -Sum).Sum)
  } else { 0.0 }
  [pscustomobject][ordered]@{
    source_file = $target.source_file
    category = $target.category
    extension = $target.extension
    bytes = $target.bytes
    sha256 = $target.sha256
    inventory_kind = if ($target.extension -eq ".swf" -and $target.category -eq "pasture-sound") { "sound-swf" } elseif ($target.extension -eq ".swf") { "visual-swf" } elseif ($target.extension -in @(".png", ".gif")) { "static-image" } else { "metadata-only" }
    width = if ($staticSummary) { $staticSummary.Width } else { "" }
    height = if ($staticSummary) { $staticSummary.Height } else { "" }
    mapped_visual_entries = $visualRows.Count
    rendered_visual_entries = @($visualRows | Where-Object output_file).Count
    define_sound_count = $sounds.Count
    sound_duration_seconds = [Math]::Round($soundDurationTotal, 6)
    processing_status = if ($sourceErrors.Count -gt 0) { "parse-error" } elseif ($target.category -eq "pasture-sound" -and $sounds.Count -eq 0) { "no-define-sound" } elseif ($target.extension -eq ".swf") { "inventoried" } elseif ($target.extension -in @(".png", ".gif")) { "visual-inventoried" } else { "metadata-inventoried" }
    visual_review_status = if ($visualReview) { $visualReview.review_status } else { if ($target.category -eq "pasture-sound" -or $target.extension -notin @(".swf", ".png", ".gif")) { "not-applicable" } else { "pending-contact-sheet-review" } }
  }
}

$assetRows | Export-Csv -LiteralPath $assetTablePath -NoTypeInformation -Encoding utf8
$symbolRows | Export-Csv -LiteralPath $symbolTablePath -NoTypeInformation -Encoding utf8
$soundRows | Export-Csv -LiteralPath $soundTablePath -NoTypeInformation -Encoding utf8
$reviewRows | Export-Csv -LiteralPath $reviewTablePath -NoTypeInformation -Encoding utf8

$htmlRows = foreach ($item in $galleryRows) {
  $name = [Net.WebUtility]::HtmlEncode($item.Name)
  @"
      <article data-category="$($item.Category)">
        <a href="$($item.FileName)" target="_blank" rel="noreferrer"><img src="$($item.FileName)" alt="$name 联系表" loading="lazy"></a>
        <div><strong>$name</strong><span>$($item.Category)</span></div>
      </article>
"@
}

$html = @"
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>庄园 UI、动作特效与辅助素材联系表</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; color: #1f2a25; background: #eef2ee; font-family: "Microsoft YaHei", sans-serif; }
    header { padding: 22px 24px; border-bottom: 1px solid #ccd5cf; background: #fff; }
    h1 { margin: 0 0 6px; font-size: 24px; letter-spacing: 0; }
    p { margin: 0; color: #5b6961; }
    main { display: grid; grid-template-columns: repeat(auto-fill, minmax(520px, 1fr)); gap: 14px; padding: 18px; }
    article { min-width: 0; border: 1px solid #cbd4ce; border-radius: 6px; overflow: hidden; background: #fff; }
    img { display: block; width: 100%; max-height: 620px; object-fit: contain; object-position: top; background: #eef2ee; }
    article div { display: flex; justify-content: space-between; gap: 12px; padding: 10px 12px; }
    span { color: #637068; }
  </style>
</head>
<body>
  <header><h1>庄园 UI、动作特效与辅助素材联系表</h1><p>逐 SWF 展示根舞台、SymbolClass、ExportAssets 和静态预览；声音另见 sound-assets.csv。</p></header>
  <main>
$($htmlRows -join "`n")
  </main>
</body>
</html>
"@
Set-Content -LiteralPath (Join-Path $OutputDirectory "index.html") -Value $html -Encoding utf8

[pscustomobject]@{
  SourceFiles = $assetRows.Count
  VisualSymbolRows = $symbolRows.Count
  RenderedVisualRows = @($symbolRows | Where-Object render_status -eq "rendered").Count
  ActionEffectCandidates = @($symbolRows | Where-Object visual_role -eq "action-effect-candidate").Count
  DefineSounds = $soundRows.Count
  SoundContainers = @($assetRows | Where-Object inventory_kind -eq "sound-swf").Count
  ContactSheets = $reviewRows.Count
  VisualReviews = @($visualReviews.Values | Where-Object review_status -like "reviewed-*").Count
  OutputDirectory = $OutputDirectory
}
