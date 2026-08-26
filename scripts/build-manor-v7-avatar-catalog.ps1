param(
  [string]$ModuleRoot,
  [string]$OutputPath
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $ModuleRoot) {
  $ModuleRoot = Join-Path $repositoryRoot "apps\web\public\assets\manor\v7-swf\module"
}
if (-not $OutputPath) {
  $OutputPath = Join-Path $repositoryRoot "docs\manor-v7-source\catalog-avatars.csv"
}

$ModuleRoot = (Resolve-Path -LiteralPath $ModuleRoot).Path
$xmlPath = Join-Path $ModuleRoot "ui\qqshow\happyfarm.xml"
if (-not (Test-Path -LiteralPath $xmlPath -PathType Leaf)) {
  throw "QQ Farm avatar XML was not found: $xmlPath"
}

[xml]$catalog = Get-Content -LiteralPath $xmlPath -Raw -Encoding UTF8
Add-Type -AssemblyName System.Drawing
$rows = @()
foreach ($query in @($catalog.QQSHOW.query | Where-Object { $_.style -eq "1" })) {
  $sex = [string]$query.sex
  if ($sex -notin @("M", "F")) {
    throw "Unexpected avatar sex group: $sex"
  }
  $displayOrder = 0
  foreach ($node in @($query.node)) {
    $id = [int]$node.id
    $bucket = [Math]::Floor(($id % 1000) / 100)
    $slot = $id % 100
    $relativePath = "ui/qqshow/$bucket/$slot/${id}_0_0.png"
    $assetPath = Join-Path $ModuleRoot ($relativePath.Replace("/", "\"))
    if (-not (Test-Path -LiteralPath $assetPath -PathType Leaf)) {
      throw "Avatar asset was not found: $relativePath"
    }

    $image = [System.Drawing.Image]::FromFile($assetPath)
    try {
      $width = $image.Width
      $height = $image.Height
    } finally {
      $image.Dispose()
    }
    if ($width -ne 140 -or $height -ne 226) {
      throw "Unexpected avatar dimensions for ${id}: ${width}x${height}"
    }

    $rows += [pscustomobject]@{
      source_id = $id
      sex = $sex
      display_order = $displayOrder
      item_type = [int]$node.type
      source_status = [int]$node.status
      asset_path = $relativePath
      width = $width
      height = $height
      asset_status = "complete"
      integration_policy = "core-candidate"
    }
    $displayOrder += 1
  }
}

if ($rows.Count -ne 326) {
  throw "Expected 326 farm avatars, found $($rows.Count)"
}
if (@($rows.source_id | Sort-Object -Unique).Count -ne $rows.Count) {
  throw "Farm avatar IDs must be unique"
}
if (@($rows | Where-Object sex -eq "M").Count -ne 167) {
  throw "Expected 167 male farm avatars"
}
if (@($rows | Where-Object sex -eq "F").Count -ne 159) {
  throw "Expected 159 female farm avatars"
}

$outputDirectory = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $outputDirectory -PathType Container)) {
  New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}
$rows | Export-Csv -LiteralPath $OutputPath -NoTypeInformation -Encoding UTF8
Write-Output "Generated $($rows.Count) QQ Farm V7 avatar definitions: $OutputPath"
