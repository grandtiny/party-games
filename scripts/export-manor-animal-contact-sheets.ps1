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
  $InventoryDirectory = Join-Path $repositoryRoot "data\manor-asset-work\animal-export"
}
if (-not $OutputDirectory) {
  $OutputDirectory = Join-Path $repositoryRoot "docs\manor-assets\contact-sheets\animals"
}

$animalDirectory = Join-Path $LegacyRoot "module\mc\main\animal"
$animalTablePath = Join-Path $repositoryRoot "docs\manor-assets\animals.csv"
$stateTablePath = Join-Path $repositoryRoot "docs\manor-assets\animal-state-assets.csv"
$symbolTablePath = Join-Path $repositoryRoot "docs\manor-assets\animal-symbol-classes.csv"
$reviewTablePath = Join-Path $repositoryRoot "docs\manor-assets\animal-contact-review.csv"
$visualReviewTablePath = Join-Path $repositoryRoot "docs\manor-assets\animal-visual-review.csv"

if (-not (Test-Path -LiteralPath $JpexsJar -PathType Leaf)) {
  throw "JPEXS jar not found: $JpexsJar"
}
if (-not (Test-Path -LiteralPath $animalTablePath -PathType Leaf)) {
  throw "Animal table not found: $animalTablePath. Run build-manor-asset-map.ps1 first."
}

New-Item -ItemType Directory -Force -Path $InventoryDirectory, $OutputDirectory | Out-Null

if (-not $SkipJpexsExport) {
  & $JavaExe -jar $JpexsJar -onerror abort -export sprite $InventoryDirectory $animalDirectory
  if ($LASTEXITCODE -ne 0) {
    throw "JPEXS animal sprite export failed"
  }
}

. (Join-Path $PSScriptRoot "manor-asset-review-tools.ps1")

# These labels follow the status transitions emitted by the legacy PHP service.
# The contact sheets retain the numeric status because it is the runtime contract.
$stateDefinitions = @(
  [pscustomobject]@{ Status = 1; Key = "cub"; Label = "幼年" },
  [pscustomobject]@{ Status = 2; Key = "growing"; Label = "成长" },
  [pscustomobject]@{ Status = 3; Key = "ready_to_produce"; Label = "成熟待生产" },
  [pscustomobject]@{ Status = 4; Key = "production_early"; Label = "生产阶段一" },
  [pscustomobject]@{ Status = 5; Key = "production_late"; Label = "生产阶段二" },
  [pscustomobject]@{ Status = 6; Key = "lifecycle_complete"; Label = "生命周期结束" }
)

function ConvertFrom-SymbolClasses([string]$Value) {
  if (-not $Value) { return @() }
  return @($Value -split "," | ForEach-Object {
    if ($_ -notmatch "^(?<id>\d+):(?<name>.+)$") {
      throw "Invalid SymbolClass mapping: $_"
    }
    [pscustomobject]@{
      CharacterId = [int]$Matches["id"]
      ClassName = $Matches["name"]
    }
  })
}

function Get-StateSpritePath([string]$AnimalExportDirectory, [int]$CharacterId) {
  $pattern = "^DefineSprite_" + [regex]::Escape($CharacterId) + "(?:_|$)"
  $matches = @(Get-ChildItem -LiteralPath $AnimalExportDirectory -Directory | Where-Object Name -Match $pattern)
  if ($matches.Count -ne 1) {
    throw "Expected one sprite directory for character $CharacterId in $AnimalExportDirectory, found $($matches.Count)"
  }
  $frames = @(Get-ChildItem -LiteralPath $matches[0].FullName -File -Filter "*.png" | Sort-Object { [int][IO.Path]::GetFileNameWithoutExtension($_.Name) })
  if ($frames.Count -lt 1) {
    throw "Expected at least one PNG frame for character $CharacterId in $($matches[0].FullName)"
  }
  return [pscustomobject]@{
    Path = $frames[0].FullName
    FrameCount = $frames.Count
  }
}

function Draw-ImageFit($Graphics, [string]$Path, [Drawing.Rectangle]$Target, $Summary) {
  $image = [Drawing.Image]::FromFile($Path)
  try {
    $source = if ($Summary.VisibleWidth -gt 0 -and $Summary.VisibleHeight -gt 0) {
      [Drawing.Rectangle]::new($Summary.VisibleX, $Summary.VisibleY, $Summary.VisibleWidth, $Summary.VisibleHeight)
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

function New-AnimalContactSheet($Animal, [array]$States, [string]$Path) {
  $margin = 16
  $panelWidth = 184
  $panelTop = 62
  $panelHeight = 280
  $canvasWidth = ($margin * 2) + ($panelWidth * $States.Count)
  $canvasHeight = $panelTop + $panelHeight + $margin

  $bitmap = [Drawing.Bitmap]::new($canvasWidth, $canvasHeight)
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear([Drawing.Color]::FromArgb(237, 241, 238))

  $titleFont = [Drawing.Font]::new("Microsoft YaHei", 16, [Drawing.FontStyle]::Bold)
  $labelFont = [Drawing.Font]::new("Microsoft YaHei", 10, [Drawing.FontStyle]::Bold)
  $infoFont = [Drawing.Font]::new("Microsoft YaHei", 8)
  $titleBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(31, 42, 37))
  $mutedBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(87, 101, 94))
  $panelBrush = [Drawing.SolidBrush]::new([Drawing.Color]::White)
  $defaultPen = [Drawing.Pen]::new([Drawing.Color]::FromArgb(190, 198, 193), 1)
  $readyPen = [Drawing.Pen]::new([Drawing.Color]::FromArgb(52, 130, 74), 3)
  $completePen = [Drawing.Pen]::new([Drawing.Color]::FromArgb(173, 73, 61), 3)

  try {
    $graphics.DrawString("#$($Animal.source_id)  $($Animal.name)  |  原等级 $($Animal.original_level)  |  六个运行时状态", $titleFont, $titleBrush, 18, 16)
    foreach ($state in $States) {
      $index = [int]$state.runtime_status - 1
      $x = $margin + ($index * $panelWidth)
      $panelRectangle = [Drawing.Rectangle]::new($x + 4, $panelTop, $panelWidth - 8, $panelHeight)
      $graphics.FillRectangle($panelBrush, $panelRectangle)
      $borderPen = if ($state.runtime_status -eq 3) {
        $readyPen
      } elseif ($state.runtime_status -eq 6) {
        $completePen
      } else {
        $defaultPen
      }
      $graphics.DrawRectangle($borderPen, $panelRectangle)
      $graphics.DrawString("状态 $($state.runtime_status)  $($state.state_label)", $labelFont, $titleBrush, $x + 14, $panelTop + 10)
      $graphics.DrawString("角色 #$($state.source_character_id)", $infoFont, $mutedBrush, $x + 14, $panelTop + 36)

      $target = [Drawing.Rectangle]::new($x + 14, $panelTop + 60, $panelWidth - 28, 176)
      Draw-ImageFit $graphics $state._image_path $target $state._summary
      $graphics.DrawString("$($state.width)x$($state.height) | 可见 $($state.visible_width)x$($state.visible_height)", $infoFont, $mutedBrush, $x + 14, $panelTop + 242)
      $graphics.DrawString("导出帧 $($state.exported_frame_count) | $($state.source_class)", $infoFont, $mutedBrush, $x + 14, $panelTop + 258)
    }
    $bitmap.Save($Path, [Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $defaultPen.Dispose()
    $readyPen.Dispose()
    $completePen.Dispose()
    $panelBrush.Dispose()
    $titleBrush.Dispose()
    $mutedBrush.Dispose()
    $titleFont.Dispose()
    $labelFont.Dispose()
    $infoFont.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

$animals = @(Import-Csv -LiteralPath $animalTablePath | Sort-Object original_level, source_id)
$visualReviews = @{}
if (Test-Path -LiteralPath $visualReviewTablePath -PathType Leaf) {
  foreach ($review in @(Import-Csv -LiteralPath $visualReviewTablePath)) {
    $visualReviews[$review.source_id] = $review
  }
}

$stateRows = [Collections.Generic.List[object]]::new()
$symbolRows = [Collections.Generic.List[object]]::new()
$reviewRows = [Collections.Generic.List[object]]::new()
$galleryRows = [Collections.Generic.List[object]]::new()

foreach ($animal in $animals) {
  $animalExportDirectory = Join-Path $InventoryDirectory ("a$($animal.source_id).swf")
  if (-not (Test-Path -LiteralPath $animalExportDirectory -PathType Container)) {
    throw "Missing JPEXS export directory: $animalExportDirectory"
  }

  $symbols = @(ConvertFrom-SymbolClasses $animal.symbol_classes)
  $symbolsByClass = @{}
  foreach ($symbol in $symbols) {
    if ($symbolsByClass.ContainsKey($symbol.ClassName)) {
      throw "Duplicate SymbolClass $($symbol.ClassName) in animal $($animal.source_id)"
    }
    $symbolsByClass[$symbol.ClassName] = $symbol
  }

  foreach ($symbol in $symbols) {
    $expectedPrefix = "Animal_$($animal.source_id)_"
    $runtimeStatus = if ($symbol.ClassName.StartsWith($expectedPrefix) -and $symbol.ClassName.Substring($expectedPrefix.Length) -match "^[1-6]$") {
      [int]$symbol.ClassName.Substring($expectedPrefix.Length)
    } else { "" }
    $symbolRows.Add([pscustomobject][ordered]@{
      source_id = [int]$animal.source_id
      name = $animal.name
      source_character_id = $symbol.CharacterId
      symbol_class = $symbol.ClassName
      role_kind = if ($runtimeStatus) { "runtime-state" } else { "internal-helper" }
      runtime_status = $runtimeStatus
    })
  }

  $visualReview = if ($visualReviews.ContainsKey($animal.source_id)) { $visualReviews[$animal.source_id] } else { $null }
  $visualReviewStatus = if ($visualReview) { $visualReview.review_status } else { "pending-contact-sheet-review" }
  $visualReviewNote = if ($visualReview) { $visualReview.review_note } else { "" }
  $states = [Collections.Generic.List[object]]::new()

  foreach ($definition in $stateDefinitions) {
    $className = "Animal_$($animal.source_id)_$($definition.Status)"
    if (-not $symbolsByClass.ContainsKey($className)) {
      throw "Animal $($animal.source_id) is missing SymbolClass $className"
    }
    $symbol = $symbolsByClass[$className]
    $sprite = Get-StateSpritePath $animalExportDirectory $symbol.CharacterId
    $summary = Get-ManorAssetImageSummary $sprite.Path
    $state = [pscustomobject][ordered]@{
      source_id = [int]$animal.source_id
      name = $animal.name
      original_level = [int]$animal.original_level
      runtime_status = $definition.Status
      state_key = $definition.Key
      state_label = $definition.Label
      source_class = $className
      source_character_id = $symbol.CharacterId
      source_export_file = Get-ManorAssetRelativePath $InventoryDirectory $sprite.Path
      source_sha256 = Get-ManorAssetHash $sprite.Path
      exported_frame_count = $sprite.FrameCount
      width = $summary.Width
      height = $summary.Height
      visible_pixels = $summary.VisiblePixels
      visible_x = $summary.VisibleX
      visible_y = $summary.VisibleY
      visible_width = $summary.VisibleWidth
      visible_height = $summary.VisibleHeight
      automated_status = if ($summary.VisiblePixels -gt 0) { "ready-for-visual-review" } else { "empty-state-frame" }
      visual_review_status = $visualReviewStatus
      _image_path = $sprite.Path
      _summary = $summary
    }
    $states.Add($state)
    $stateRows.Add($state)
  }

  $fileName = "animal-{0:D4}.png" -f [int]$animal.source_id
  New-AnimalContactSheet $animal $states.ToArray() (Join-Path $OutputDirectory $fileName)
  $emptyStates = @($states | Where-Object visible_pixels -eq 0)
  $helperCount = @($symbols | Where-Object { -not $_.ClassName.StartsWith("Animal_$($animal.source_id)_") }).Count
  $reviewRows.Add([pscustomobject][ordered]@{
    source_id = [int]$animal.source_id
    name = $animal.name
    original_level = [int]$animal.original_level
    contact_sheet = "contact-sheets/animals/$fileName"
    runtime_state_rows = $states.Count
    internal_helper_classes = $helperCount
    empty_state_frames = $emptyStates.Count
    automated_status = if ($emptyStates.Count -eq 0) { "ready-for-visual-review" } else { "empty-state-frame" }
    visual_review_status = $visualReviewStatus
    visual_review_note = $visualReviewNote
  })
  $galleryRows.Add([pscustomobject]@{
    FileName = $fileName
    SourceId = [int]$animal.source_id
    Name = $animal.name
    Level = [int]$animal.original_level
    Status = $visualReviewStatus
  })
}

$stateRows |
  Select-Object source_id,name,original_level,runtime_status,state_key,state_label,source_class,source_character_id,source_export_file,source_sha256,exported_frame_count,width,height,visible_pixels,visible_x,visible_y,visible_width,visible_height,automated_status,visual_review_status |
  Export-Csv -LiteralPath $stateTablePath -NoTypeInformation -Encoding utf8
$symbolRows | Export-Csv -LiteralPath $symbolTablePath -NoTypeInformation -Encoding utf8
$reviewRows | Export-Csv -LiteralPath $reviewTablePath -NoTypeInformation -Encoding utf8

$htmlRows = foreach ($item in $galleryRows) {
  $name = [Net.WebUtility]::HtmlEncode($item.Name)
  @"
      <article data-status="$($item.Status)">
        <a href="$($item.FileName)" target="_blank" rel="noreferrer"><img src="$($item.FileName)" alt="#$($item.SourceId) $name 六状态联系表" loading="lazy"></a>
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
  <title>QQ 牧场动物六状态联系表</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; color: #1f2a25; background: #eef2ee; font-family: "Microsoft YaHei", sans-serif; }
    header { padding: 22px 24px; border-bottom: 1px solid #ccd5cf; background: #fff; }
    h1 { margin: 0 0 6px; font-size: 24px; letter-spacing: 0; }
    p { margin: 0; color: #5b6961; }
    main { display: grid; grid-template-columns: repeat(auto-fill, minmax(520px, 1fr)); gap: 14px; padding: 18px; }
    article { min-width: 0; border: 1px solid #cbd4ce; border-radius: 6px; overflow: hidden; background: #fff; }
    img { display: block; width: 100%; height: auto; }
    article div { display: flex; justify-content: space-between; gap: 12px; padding: 10px 12px; }
    span { color: #637068; }
  </style>
</head>
<body>
  <header><h1>QQ 牧场动物六状态联系表</h1><p>35 种动物的运行时状态 1 至 6；内部辅助 SymbolClass 不混入状态序列，另见 animal-symbol-classes.csv。</p></header>
  <main>
$($htmlRows -join "`n")
  </main>
</body>
</html>
"@
Set-Content -LiteralPath (Join-Path $OutputDirectory "index.html") -Value $html -Encoding utf8

[pscustomobject]@{
  Animals = $animals.Count
  StateRows = $stateRows.Count
  SymbolClasses = $symbolRows.Count
  InternalHelperClasses = @($symbolRows | Where-Object role_kind -eq "internal-helper").Count
  EmptyStateFrames = @($stateRows | Where-Object visible_pixels -eq 0).Count
  VisualReviews = @($visualReviews.Values | Where-Object review_status -like "reviewed-*").Count
  OutputDirectory = $OutputDirectory
}
