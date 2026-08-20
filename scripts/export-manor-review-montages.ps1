param(
  [Parameter(Mandatory = $true)]
  [string]$InputDirectory,
  [Parameter(Mandatory = $true)]
  [string]$OutputDirectory,
  [string]$Pattern = "*.png",
  [ValidateRange(1, 20)]
  [int]$ItemsPerSheet = 6
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$InputDirectory = (Resolve-Path $InputDirectory).Path
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

Add-Type -AssemblyName System.Drawing

$files = @(Get-ChildItem -LiteralPath $InputDirectory -File -Filter $Pattern | Sort-Object Name)
if ($files.Count -eq 0) {
  throw "No images matched $Pattern in $InputDirectory"
}

$outputs = [Collections.Generic.List[string]]::new()
for ($offset = 0; $offset -lt $files.Count; $offset += $ItemsPerSheet) {
  $lastIndex = [Math]::Min($offset + $ItemsPerSheet - 1, $files.Count - 1)
  $batch = @($files[$offset..$lastIndex])
  $images = [Collections.Generic.List[Drawing.Image]]::new()
  try {
    foreach ($file in $batch) {
      $images.Add([Drawing.Image]::FromFile($file.FullName))
    }
    $width = [int](($images | Measure-Object Width -Maximum).Maximum)
    $height = [int](($images | Measure-Object Height -Sum).Sum)
    $bitmap = [Drawing.Bitmap]::new($width, $height)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.Clear([Drawing.Color]::White)
      $y = 0
      foreach ($image in $images) {
        $graphics.DrawImageUnscaled($image, 0, $y)
        $y += $image.Height
      }
      $outputName = "review-{0:D3}.png" -f ([int]($offset / $ItemsPerSheet) + 1)
      $outputPath = Join-Path $OutputDirectory $outputName
      $bitmap.Save($outputPath, [Drawing.Imaging.ImageFormat]::Png)
      $outputs.Add($outputPath)
    } finally {
      $graphics.Dispose()
      $bitmap.Dispose()
    }
  } finally {
    foreach ($image in $images) { $image.Dispose() }
  }
}

[pscustomobject]@{
  InputImages = $files.Count
  ReviewSheets = $outputs.Count
  OutputDirectory = (Resolve-Path $OutputDirectory).Path
}
