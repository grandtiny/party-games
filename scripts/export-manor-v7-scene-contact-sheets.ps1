param(
  [string]$SourceRoot = $env:MANOR_V7_SOURCE_PATH,
  [string]$InventoryDirectory,
  [string]$OutputDirectory
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.Drawing

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $SourceRoot) { throw "Pass -SourceRoot or set MANOR_V7_SOURCE_PATH" }
$SourceRoot = (Resolve-Path -LiteralPath $SourceRoot).Path
if (-not $InventoryDirectory) { $InventoryDirectory = Join-Path $repositoryRoot "docs\manor-v7-source" }
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $InventoryDirectory "contact-sheets\scenes" }

$pluginRoot = @(
  $SourceRoot
  (Join-Path $SourceRoot "wwwroot\source\plugin\qqfarm")
  (Join-Path $SourceRoot "source\plugin\qqfarm")
) | Where-Object { Test-Path -LiteralPath (Join-Path $_ "core\module") -PathType Container } | Select-Object -First 1
if (-not $pluginRoot) { throw "QQ Farm V7 plugin root was not found below $SourceRoot" }

$farmRoot = Join-Path $pluginRoot "core\module\ui\farm\diy"
$pastureRoot = Join-Path $pluginRoot "core\module\mc\farm\diy"
$catalog = @(Import-Csv -LiteralPath (Join-Path $InventoryDirectory "catalog-decorations.csv"))
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

function Get-PreviewPath($Row) {
  $id = [int]$Row.source_id
  if ($Row.area -eq "pasture") {
    return Join-Path $pastureRoot "z1_${id}_1_shop.jpg"
  }
  $preferred = Join-Path $farmRoot "${id}b.jpg"
  if (Test-Path -LiteralPath $preferred -PathType Leaf) { return $preferred }
  return Join-Path $farmRoot "${id}.jpg"
}

function New-ContactSheet([string]$Area, [array]$Rows, [int]$Page) {
  $columns = 5
  $cellWidth = 190
  $cellHeight = 154
  $headerHeight = 44
  $bitmap = [Drawing.Bitmap]::new($columns * $cellWidth, $headerHeight + (5 * $cellHeight))
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.Clear([Drawing.Color]::FromArgb(236, 240, 235))
  $titleFont = [Drawing.Font]::new("Microsoft YaHei", 14, [Drawing.FontStyle]::Bold)
  $labelFont = [Drawing.Font]::new("Microsoft YaHei", 9, [Drawing.FontStyle]::Regular)
  $brush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(31, 42, 37))
  $border = [Drawing.Pen]::new([Drawing.Color]::FromArgb(180, 188, 182), 1)
  try {
    $graphics.DrawString("$Area V7 backgrounds - page $Page", $titleFont, $brush, 12, 10)
    for ($index = 0; $index -lt $Rows.Count; $index += 1) {
      $row = $Rows[$index]
      $column = $index % $columns
      $line = [Math]::Floor($index / $columns)
      $x = $column * $cellWidth
      $y = $headerHeight + ($line * $cellHeight)
      $graphics.DrawRectangle($border, $x + 4, $y + 4, $cellWidth - 8, $cellHeight - 8)
      $path = Get-PreviewPath $row
      if (Test-Path -LiteralPath $path -PathType Leaf) {
        $image = [Drawing.Image]::FromFile($path)
        try {
          $targetWidth = $cellWidth - 20
          $targetHeight = 112
          $scale = [Math]::Min($targetWidth / $image.Width, $targetHeight / $image.Height)
          $width = [Math]::Max(1, [int]($image.Width * $scale))
          $height = [Math]::Max(1, [int]($image.Height * $scale))
          $graphics.DrawImage($image, $x + [int](($cellWidth - $width) / 2), $y + 9, $width, $height)
        } finally {
          $image.Dispose()
        }
      }
      $label = "#$($row.source_id) $($row.name)"
      $graphics.DrawString($label, $labelFont, $brush, $x + 10, $y + 123)
    }
    $path = Join-Path $OutputDirectory ("{0}-{1:D2}.png" -f $Area, $Page)
    $bitmap.Save($path, [Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $border.Dispose(); $brush.Dispose(); $titleFont.Dispose(); $labelFont.Dispose()
    $graphics.Dispose(); $bitmap.Dispose()
  }
}

foreach ($area in @("farm", "pasture")) {
  $rows = @($catalog | Where-Object {
    $_.area -eq $area -and (($area -eq "farm" -and $_.item_type -eq "1") -or $area -eq "pasture")
  } | Sort-Object { [int]$_.source_id })
  $page = 0
  for ($offset = 0; $offset -lt $rows.Count; $offset += 25) {
    $page += 1
    $end = [Math]::Min($offset + 24, $rows.Count - 1)
    New-ContactSheet $area @($rows[$offset..$end]) $page
  }
}

Write-Host "Generated V7 farm and pasture scene contact sheets in $OutputDirectory"

