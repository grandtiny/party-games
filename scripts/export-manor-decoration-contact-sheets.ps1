param(
  [string]$LegacyRoot,
  [string]$JpexsJar = "C:\Code\30_Tools\jpexs\26.2.1\app\ffdec.jar",
  [string]$JavaExe = "java",
  [string]$StageFrameDirectory,
  [string]$ContentFrameDirectory,
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
if (-not $StageFrameDirectory) {
  $StageFrameDirectory = Join-Path $repositoryRoot "data\manor-asset-work\decoration-stage-frames"
}
if (-not $ContentFrameDirectory) {
  $ContentFrameDirectory = Join-Path $repositoryRoot "data\manor-asset-work\decoration-content-frames"
}
if (-not $OutputDirectory) {
  $OutputDirectory = Join-Path $repositoryRoot "docs\manor-assets\contact-sheets\decorations"
}

$decorationSourceDirectory = Join-Path $LegacyRoot "module\nc\farm\diy"
$decorationTablePath = Join-Path $repositoryRoot "docs\manor-assets\decorations.csv"
$assetTablePath = Join-Path $repositoryRoot "docs\manor-assets\decoration-assets.csv"
$reviewTablePath = Join-Path $repositoryRoot "docs\manor-assets\decoration-contact-review.csv"
$visualReviewTablePath = Join-Path $repositoryRoot "docs\manor-assets\decoration-visual-review.csv"
$swfInspector = Join-Path $PSScriptRoot "ManorSwfInventory.java"
$contentExporter = Join-Path $PSScriptRoot "ManorSwfFrameExporter.java"

if (-not (Test-Path -LiteralPath $JpexsJar -PathType Leaf)) {
  throw "JPEXS jar not found: $JpexsJar"
}
if (-not (Test-Path -LiteralPath $decorationTablePath -PathType Leaf)) {
  throw "Decoration table not found: $decorationTablePath. Run build-manor-asset-map.ps1 first."
}

New-Item -ItemType Directory -Force -Path $StageFrameDirectory, $ContentFrameDirectory, $OutputDirectory | Out-Null

if (-not $SkipJpexsExport) {
  & $JavaExe -jar $JpexsJar -onerror abort -ignorebackground -select 1 -export frame $StageFrameDirectory $decorationSourceDirectory
  if ($LASTEXITCODE -ne 0) { throw "JPEXS decoration stage-frame export failed" }

  $contentRows = & $JavaExe --class-path $JpexsJar $contentExporter $decorationSourceDirectory $ContentFrameDirectory |
    ConvertFrom-Csv -Delimiter "`t"
  if ($LASTEXITCODE -ne 0 -or @($contentRows | Where-Object error).Count -gt 0) {
    throw "Content-bound decoration frame export failed"
  }
}

. (Join-Path $PSScriptRoot "manor-asset-review-tools.ps1")

function Get-SourcePath([string]$RelativePath) {
  if (-not $RelativePath) { return $null }
  return Join-Path $LegacyRoot ($RelativePath.Replace("/", "\"))
}

function Get-StageFramePath([string]$SourceId) {
  return Join-Path $StageFrameDirectory "$SourceId.swf\1.png"
}

function Get-ContentFramePath([string]$SourceId) {
  return Join-Path $ContentFrameDirectory "$SourceId.swf.png"
}

function Get-SwfStructures {
  $lines = & $JavaExe --class-path $JpexsJar $swfInspector $decorationSourceDirectory
  if ($LASTEXITCODE -ne 0) { throw "Decoration SWF inventory failed" }
  return @($lines | ConvertFrom-Csv -Delimiter "`t")
}

function Draw-Checkerboard($Graphics, [Drawing.Rectangle]$Rectangle) {
  $light = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(244, 246, 244))
  $dark = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(222, 226, 223))
  try {
    $size = 14
    for ($y = $Rectangle.Top; $y -lt $Rectangle.Bottom; $y += $size) {
      for ($x = $Rectangle.Left; $x -lt $Rectangle.Right; $x += $size) {
        $isDark = (([int](($x - $Rectangle.Left) / $size) + [int](($y - $Rectangle.Top) / $size)) % 2) -eq 1
        $brush = if ($isDark) { $dark } else { $light }
        $width = [Math]::Min($size, $Rectangle.Right - $x)
        $height = [Math]::Min($size, $Rectangle.Bottom - $y)
        $Graphics.FillRectangle($brush, $x, $y, $width, $height)
      }
    }
  } finally {
    $light.Dispose()
    $dark.Dispose()
  }
}

function Draw-ImageFit($Graphics, [string]$Path, [Drawing.Rectangle]$Target, $Summary, [bool]$CropToVisibleBounds) {
  $image = [Drawing.Image]::FromFile($Path)
  try {
    $source = if ($CropToVisibleBounds -and $Summary.VisibleWidth -gt 0 -and $Summary.VisibleHeight -gt 0) {
      [Drawing.Rectangle]::new($Summary.VisibleX, $Summary.VisibleY, $Summary.VisibleWidth, $Summary.VisibleHeight)
    } else {
      [Drawing.Rectangle]::new(0, 0, $image.Width, $image.Height)
    }
    $scale = [Math]::Min($Target.Width / $source.Width, $Target.Height / $source.Height)
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

function New-DecorationContactSheet($Item, $Asset, [string]$PreviewPath, [string]$ThumbnailPath, [string]$Path) {
  $bitmap = [Drawing.Bitmap]::new(1000, 390)
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear([Drawing.Color]::FromArgb(238, 242, 238))

  $titleFont = [Drawing.Font]::new("Microsoft YaHei", 16, [Drawing.FontStyle]::Bold)
  $labelFont = [Drawing.Font]::new("Microsoft YaHei", 10, [Drawing.FontStyle]::Bold)
  $infoFont = [Drawing.Font]::new("Microsoft YaHei", 8)
  $titleBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(31, 42, 37))
  $mutedBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(87, 101, 94))
  $alertBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(151, 58, 48))
  $borderPen = [Drawing.Pen]::new([Drawing.Color]::FromArgb(183, 193, 187), 1)

  try {
    $graphics.DrawString("#$($Item.source_id)  $($Item.name)", $titleFont, $titleBrush, 18, 14)
    $graphics.DrawString("$($Item.item_type_name) · $($Item.set_name) · $($Asset.selected_source_kind)", $infoFont, $mutedBrush, 20, 43)

    $sourceRect = [Drawing.Rectangle]::new(18, 72, 620, 270)
    Draw-Checkerboard $graphics $sourceRect
    $graphics.DrawRectangle($borderPen, $sourceRect)
    $graphics.DrawString("提取成品", $labelFont, $titleBrush, 28, 82)
    if ($Asset._selected_path) {
      $imageRect = [Drawing.Rectangle]::new(32, 108, 592, 214)
      Draw-ImageFit $graphics $Asset._selected_path $imageRect $Asset._summary $true
    } else {
      $graphics.DrawString("已阻止：$($Item.known_issue)", $labelFont, $alertBrush, 180, 190)
    }

    $previewRect = [Drawing.Rectangle]::new(660, 72, 150, 150)
    Draw-Checkerboard $graphics $previewRect
    $graphics.DrawRectangle($borderPen, $previewRect)
    $graphics.DrawString("商店预览", $labelFont, $titleBrush, 670, 82)
    if ($PreviewPath) {
      $previewSummary = Get-ManorAssetImageSummary $PreviewPath
      Draw-ImageFit $graphics $PreviewPath ([Drawing.Rectangle]::new(674, 110, 122, 96)) $previewSummary $false
    }

    $thumbnailRect = [Drawing.Rectangle]::new(830, 72, 150, 150)
    Draw-Checkerboard $graphics $thumbnailRect
    $graphics.DrawRectangle($borderPen, $thumbnailRect)
    $graphics.DrawString("缩略图", $labelFont, $titleBrush, 840, 82)
    if ($ThumbnailPath) {
      $thumbnailSummary = Get-ManorAssetImageSummary $ThumbnailPath
      Draw-ImageFit $graphics $ThumbnailPath ([Drawing.Rectangle]::new(844, 110, 122, 96)) $thumbnailSummary $false
    }

    $details = if ($Asset._summary) {
      "画布 $($Asset.width)x$($Asset.height) · 可见边界 $($Asset.visible_x),$($Asset.visible_y) $($Asset.visible_width)x$($Asset.visible_height)"
    } else {
      "无可用运行时成品"
    }
    $graphics.DrawString($details, $infoFont, $mutedBrush, 22, 354)
    $graphics.DrawString("策略 $($Item.extraction_policy) · 自动状态 $($Asset.automated_status)", $infoFont, $mutedBrush, 520, 354)
    $bitmap.Save($Path, [Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $borderPen.Dispose()
    $alertBrush.Dispose()
    $mutedBrush.Dispose()
    $titleBrush.Dispose()
    $infoFont.Dispose()
    $labelFont.Dispose()
    $titleFont.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

$visualReviews = @{}
if (Test-Path -LiteralPath $visualReviewTablePath -PathType Leaf) {
  foreach ($review in @(Import-Csv -LiteralPath $visualReviewTablePath)) {
    $visualReviews[$review.source_id] = $review
  }
}

$structures = Get-SwfStructures
$structureByFile = @{}
foreach ($structure in $structures) { $structureByFile[$structure.source_file] = $structure }

$items = @(Import-Csv -LiteralPath $decorationTablePath | Sort-Object @{ Expression = { [int]$_.source_id } })
$assetRows = [Collections.Generic.List[object]]::new()
$reviewRows = [Collections.Generic.List[object]]::new()
$galleryRows = [Collections.Generic.List[object]]::new()

foreach ($item in $items) {
  $selectedPath = $null
  $selectedSourceKind = ""
  $exportFile = ""
  $automatedStatus = ""

  switch ($item.extraction_policy) {
    "extract-swf" {
      if ($item.item_type_name -eq "background") {
        $selectedPath = Get-StageFramePath $item.source_id
        $selectedSourceKind = "swf-stage-frame"
        $exportFile = "stage-frame/$($item.source_id).swf/1.png"
      } else {
        $selectedPath = Get-ContentFramePath $item.source_id
        $selectedSourceKind = "swf-content-frame"
        $exportFile = "content-frame/$($item.source_id).swf.png"
      }
      $automatedStatus = "ready-for-visual-review"
    }
    "use-full-image" {
      $selectedPath = Get-SourcePath $item.preferred_runtime_source
      $selectedSourceKind = "full-image"
      $exportFile = $item.preferred_runtime_source
      $automatedStatus = "ready-for-visual-review"
    }
    "blocked-missing-source" {
      $selectedSourceKind = "blocked-missing-source"
      $automatedStatus = "blocked-missing-source"
    }
    "blocked-conflicting-source" {
      $selectedSourceKind = "blocked-conflicting-source"
      $automatedStatus = "blocked-conflicting-source"
    }
    default { throw "Unknown decoration extraction policy: $($item.extraction_policy)" }
  }

  $summary = $null
  if ($selectedPath) {
    if (-not (Test-Path -LiteralPath $selectedPath -PathType Leaf)) {
      throw "Missing selected decoration asset for $($item.source_id): $selectedPath"
    }
    $summary = Get-ManorAssetImageSummary $selectedPath
    if ($summary.VisiblePixels -eq 0) {
      $automatedStatus = "empty-selected-asset"
    }
  }

  $swfName = if ($item.swf_file) { [IO.Path]::GetFileName($item.swf_file) } else { "" }
  $structure = if ($swfName -and $structureByFile.ContainsKey($swfName)) { $structureByFile[$swfName] } else { $null }
  $visualReview = if ($visualReviews.ContainsKey($item.source_id)) { $visualReviews[$item.source_id] } else { $null }
  $visualReviewStatus = if ($visualReview) { $visualReview.review_status } else { "pending-contact-sheet-review" }
  $visualReviewNote = if ($visualReview) { $visualReview.review_note } else { "" }

  $asset = [pscustomobject][ordered]@{
    source_id = [int]$item.source_id
    name = $item.name
    set_name = $item.set_name
    item_type = [int]$item.item_type
    item_type_name = $item.item_type_name
    extraction_policy = $item.extraction_policy
    integration_policy = $item.integration_policy
    selected_source_kind = $selectedSourceKind
    source_origin_file = $item.preferred_runtime_source
    source_origin_sha256 = if ($item.preferred_runtime_source) { Get-ManorAssetHash (Get-SourcePath $item.preferred_runtime_source) } else { "" }
    source_export_file = $exportFile
    source_export_sha256 = if ($selectedPath) { Get-ManorAssetHash $selectedPath } else { "" }
    width = if ($summary) { $summary.Width } else { "" }
    height = if ($summary) { $summary.Height } else { "" }
    visible_pixels = if ($summary) { $summary.VisiblePixels } else { 0 }
    visible_x = if ($summary) { $summary.VisibleX } else { "" }
    visible_y = if ($summary) { $summary.VisibleY } else { "" }
    visible_width = if ($summary) { $summary.VisibleWidth } else { "" }
    visible_height = if ($summary) { $summary.VisibleHeight } else { "" }
    swf_display_rect = if ($structure) { $structure.display_rect } else { "" }
    swf_content_outline_rect = if ($structure) { $structure.outline_rect } else { "" }
    preview_file = $item.preview_file
    preview_sha256 = if ($item.preview_file) { Get-ManorAssetHash (Get-SourcePath $item.preview_file) } else { "" }
    thumbnail_file = $item.thumbnail_file
    thumbnail_sha256 = if ($item.thumbnail_file) { Get-ManorAssetHash (Get-SourcePath $item.thumbnail_file) } else { "" }
    known_issue = $item.known_issue
    automated_status = $automatedStatus
    visual_review_status = $visualReviewStatus
    _selected_path = $selectedPath
    _summary = $summary
  }
  $assetRows.Add($asset)

  $fileName = "decoration-{0:D3}.png" -f [int]$item.source_id
  $contactSheetPath = Join-Path $OutputDirectory $fileName
  $previewPath = Get-SourcePath $item.preview_file
  $thumbnailPath = Get-SourcePath $item.thumbnail_file
  New-DecorationContactSheet $item $asset $previewPath $thumbnailPath $contactSheetPath

  $reviewRows.Add([pscustomobject][ordered]@{
    source_id = [int]$item.source_id
    name = $item.name
    set_name = $item.set_name
    item_type_name = $item.item_type_name
    contact_sheet = "contact-sheets/decorations/$fileName"
    selected_source_kind = $selectedSourceKind
    automated_status = $automatedStatus
    visual_review_status = $visualReviewStatus
    visual_review_note = $visualReviewNote
  })
  $galleryRows.Add([pscustomobject]@{
    FileName = $fileName
    SourceId = [int]$item.source_id
    Name = $item.name
    Type = $item.item_type_name
    Status = $visualReviewStatus
  })
}

$assetRows |
  Select-Object source_id,name,set_name,item_type,item_type_name,extraction_policy,integration_policy,selected_source_kind,source_origin_file,source_origin_sha256,source_export_file,source_export_sha256,width,height,visible_pixels,visible_x,visible_y,visible_width,visible_height,swf_display_rect,swf_content_outline_rect,preview_file,preview_sha256,thumbnail_file,thumbnail_sha256,known_issue,automated_status,visual_review_status |
  Export-Csv -LiteralPath $assetTablePath -NoTypeInformation -Encoding utf8
$reviewRows | Export-Csv -LiteralPath $reviewTablePath -NoTypeInformation -Encoding utf8

$htmlRows = foreach ($entry in $galleryRows) {
  $name = [Net.WebUtility]::HtmlEncode($entry.Name)
  @"
      <article data-type="$($entry.Type)" data-status="$($entry.Status)">
        <a href="$($entry.FileName)" target="_blank" rel="noreferrer"><img src="$($entry.FileName)" alt="#$($entry.SourceId) $name 装饰联系表" loading="lazy"></a>
        <div><strong>#$($entry.SourceId) $name</strong><span>$($entry.Type) · $($entry.Status)</span></div>
      </article>
"@
}

$html = @"
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>QQ 农场装饰联系表</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; color: #1f2a25; background: #eef2ee; font-family: "Microsoft YaHei", sans-serif; }
    header { padding: 22px 24px; border-bottom: 1px solid #ccd5cf; background: #fff; }
    h1 { margin: 0 0 6px; font-size: 24px; }
    p { margin: 0; color: #5b6961; }
    main { display: grid; grid-template-columns: repeat(auto-fill, minmax(460px, 1fr)); gap: 14px; padding: 18px; }
    article { min-width: 0; border: 1px solid #cbd4ce; background: #fff; }
    img { display: block; width: 100%; height: auto; }
    article div { display: flex; justify-content: space-between; gap: 12px; padding: 10px 12px; }
    span { color: #637068; }
  </style>
</head>
<body>
  <header><h1>QQ 农场装饰联系表</h1><p>172 件配置项：完整提取、商店预览、缩略图与阻止项并排复核。</p></header>
  <main>
$($htmlRows -join "`n")
  </main>
</body>
</html>
"@
Set-Content -LiteralPath (Join-Path $OutputDirectory "index.html") -Value $html -Encoding utf8

[pscustomobject]@{
  Decorations = $assetRows.Count
  SwfStageFrames = @($assetRows | Where-Object selected_source_kind -eq "swf-stage-frame").Count
  SwfContentFrames = @($assetRows | Where-Object selected_source_kind -eq "swf-content-frame").Count
  FullImages = @($assetRows | Where-Object selected_source_kind -eq "full-image").Count
  Blocked = @($assetRows | Where-Object selected_source_kind -like "blocked-*").Count
  EmptySelectedAssets = @($assetRows | Where-Object automated_status -eq "empty-selected-asset").Count
  VisualReviews = @($visualReviews.Values | Where-Object review_status -like "reviewed-*").Count
  VisualReviewsWithNote = @($visualReviews.Values | Where-Object review_status -eq "reviewed-with-note").Count
  BlockedVisualReviews = @($visualReviews.Values | Where-Object review_status -like "blocked-*").Count
  OutputDirectory = $OutputDirectory
}
