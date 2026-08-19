param(
  [string]$OutputDirectory
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $OutputDirectory) {
  $OutputDirectory = Join-Path $repositoryRoot "docs\manor-assets"
}
$classicAssetDirectory = Join-Path $repositoryRoot "apps\web\public\assets\manor\classic"

function Assert-Equal($Actual, $Expected, [string]$Label) {
  if ($Actual -ne $Expected) {
    throw "$Label expected $Expected, got $Actual"
  }
}

function Assert-True([bool]$Condition, [string]$Label) {
  if (-not $Condition) {
    throw $Label
  }
}

function Get-PngSize([string]$Path) {
  $bytes = [IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -lt 24 -or $bytes[0] -ne 137 -or $bytes[1] -ne 80 -or $bytes[2] -ne 78 -or $bytes[3] -ne 71) {
    throw "Invalid PNG: $Path"
  }
  $width = (([int]$bytes[16]) -shl 24) -bor (([int]$bytes[17]) -shl 16) -bor (([int]$bytes[18]) -shl 8) -bor ([int]$bytes[19])
  $height = (([int]$bytes[20]) -shl 24) -bor (([int]$bytes[21]) -shl 16) -bor (([int]$bytes[22]) -shl 8) -bor ([int]$bytes[23])
  return [pscustomobject]@{ Width = $width; Height = $height }
}

$crops = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "crops.csv"))
$animals = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "animals.csv"))
$decorations = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "decorations.csv"))
$files = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "files.csv"))
$sourceModules = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "source-modules.csv"))
$duplicates = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "duplicates.csv"))
$currentAssets = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "current-assets.csv"))
$currentDuplicates = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "current-duplicates.csv"))
$cropStateAssets = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "crop-state-assets.csv"))
$cropCurrentAssets = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "crop-current-assets.csv"))
$cropContactReview = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "crop-contact-review.csv"))
$cropContactDirectory = Join-Path $OutputDirectory "contact-sheets\crops"

Assert-Equal $crops.Count 86 "crop rows"
Assert-Equal @($crops | Select-Object -ExpandProperty source_id -Unique).Count 86 "unique crop IDs"
Assert-Equal @($crops | Where-Object swf_parse_error).Count 0 "crop parse errors"
Assert-Equal @($crops | Where-Object processing_status -eq "integrated-4-stage").Count 12 "integrated crops"
Assert-Equal @($crops | Where-Object { @($_.state_character_ids -split "," | Where-Object { $_ }).Count -ne 7 }).Count 0 "crops without seven states"

Assert-Equal $animals.Count 35 "animal rows"
Assert-Equal @($animals | Select-Object -ExpandProperty source_id -Unique).Count 35 "unique animal IDs"
Assert-Equal @($animals | Where-Object swf_parse_error).Count 0 "animal parse errors"
Assert-Equal @($animals | Where-Object { -not $_.symbol_classes }).Count 0 "animals without SymbolClass mappings"

Assert-Equal $decorations.Count 172 "decoration rows"
foreach ($type in @("background", "house", "fence", "doghouse")) {
  Assert-Equal @($decorations | Where-Object item_type_name -eq $type).Count 43 "$type decorations"
}
Assert-Equal @($decorations | Where-Object source_files_present -eq "2").Count 1 "decorations with two files"
Assert-Equal @($decorations | Where-Object source_files_present -eq "3").Count 170 "decorations with three files"
Assert-Equal @($decorations | Where-Object source_files_present -eq "4").Count 1 "decorations with four files"
Assert-Equal @($decorations | Where-Object source_completeness -eq "complete-swf").Count 169 "decorations with SWF sources"
Assert-Equal @($decorations | Where-Object source_completeness -eq "full-image-fallback").Count 2 "decorations with full-image fallbacks"
Assert-Equal @($decorations | Where-Object source_completeness -eq "preview-only-missing-runtime-art").Count 1 "decorations missing runtime artwork"
Assert-Equal @($decorations | Where-Object known_issue -eq "conflicts-with-config-name-duplicates-95").Count 1 "conflicting decoration identities"
Assert-Equal @($decorations | Where-Object extraction_policy -eq "extract-swf").Count 168 "decorations eligible for SWF extraction"
Assert-Equal @($decorations | Where-Object extraction_policy -eq "use-full-image").Count 2 "decorations using full-image fallbacks"
Assert-Equal @($decorations | Where-Object extraction_policy -eq "blocked-missing-source").Count 1 "decorations blocked by missing sources"
Assert-Equal @($decorations | Where-Object extraction_policy -eq "blocked-conflicting-source").Count 1 "decorations blocked by conflicting sources"
Assert-Equal @($decorations | Where-Object { $_.extraction_policy -like "blocked-*" -and $_.preferred_runtime_source }).Count 0 "blocked decorations with runtime sources"

Assert-Equal $files.Count 828 "module file rows"
Assert-Equal @($files | Where-Object { -not $_.sha256 }).Count 0 "module files without SHA-256"
Assert-Equal $sourceModules.Count 124 "source module rows"
Assert-Equal @($sourceModules | Where-Object { -not $_.sha256 }).Count 0 "source modules without SHA-256"
Assert-Equal $duplicates.Count 4 "legacy duplicate groups"
Assert-Equal @($duplicates | Where-Object review_status -eq "conflicting-decoration-identities").Count 3 "conflicting decoration duplicate groups"
Assert-Equal @($duplicates | Where-Object review_status -eq "blank-placeholder-duplicate").Count 1 "blank placeholder duplicate groups"

$classicFiles = @(Get-ChildItem -LiteralPath $classicAssetDirectory -File)
Assert-Equal $currentAssets.Count 99 "current asset rows"
Assert-Equal $classicFiles.Count 99 "current classic files"
Assert-Equal @($currentAssets | Where-Object { [int]$_.width -le 0 -or [int]$_.height -le 0 }).Count 0 "current assets with invalid dimensions"
Assert-Equal @($currentAssets | Where-Object { -not $_.source_reference }).Count 0 "current assets without source references"
Assert-Equal @($currentAssets | Where-Object mapping_status -eq "source-file-needs-mapping").Count 0 "current assets awaiting source mapping"
Assert-Equal @($currentAssets | Where-Object mapping_status -eq "verified-single-mature-sprite").Count 12 "verified mature crop assets"
Assert-Equal $currentDuplicates.Count 13 "current duplicate groups"
Assert-Equal @($currentDuplicates | Where-Object review_status -eq "needs-review").Count 0 "unclassified current duplicate groups"
Assert-Equal @($currentDuplicates | Where-Object review_status -eq "verified-shared-source-sprite").Count 1 "verified shared crop sprite groups"

Assert-Equal $cropStateAssets.Count 602 "crop state asset rows"
Assert-Equal @($cropStateAssets | Group-Object source_id | Where-Object Count -ne 7).Count 0 "crops without seven state asset rows"
Assert-Equal @($cropStateAssets | Where-Object { [int]$_.width -le 0 -or [int]$_.height -le 0 }).Count 0 "crop state assets with invalid dimensions"
Assert-Equal @($cropStateAssets | Where-Object { -not $_.source_sha256 -or -not $_.source_export_file }).Count 0 "crop state assets without source evidence"
Assert-Equal @($cropStateAssets | Where-Object current_asset).Count 48 "linked current crop assets"
Assert-Equal @($cropStateAssets | Where-Object current_match_status -eq "mismatch").Count 0 "mismatched current crop state links"

Assert-Equal $cropCurrentAssets.Count 48 "current crop asset mappings"
Assert-Equal @($cropCurrentAssets | Select-Object -ExpandProperty current_asset -Unique).Count 48 "unique current crop asset mappings"
Assert-Equal @($cropCurrentAssets | Where-Object match_status -eq "exact").Count 48 "exact current crop asset mappings"
Assert-Equal @($cropCurrentAssets | Where-Object { [int]$_.source_hash_match_count -lt 1 }).Count 0 "current crop assets without source hash matches"
Assert-Equal @($cropCurrentAssets | Where-Object source_relationship -eq "state-character").Count 47 "current crop state-character mappings"
Assert-Equal @($cropCurrentAssets | Where-Object source_relationship -eq "nested-character-of-state").Count 1 "current crop nested-character mappings"
$riceNested = @($cropCurrentAssets | Where-Object { $_.source_id -eq "60" -and $_.current_stage -eq "1" })
Assert-Equal $riceNested.Count 1 "rice nested early-growth mapping"
Assert-Equal $riceNested[0].linked_state_index "2" "rice nested linked state"
Assert-Equal $riceNested[0].source_character_id "14" "rice nested source character"
foreach ($mapping in @(
  @{ SourceId = "60"; CurrentStage = "2"; LinkedState = "4"; Character = "44" },
  @{ SourceId = "61"; CurrentStage = "2"; LinkedState = "4"; Character = "22" }
)) {
  $match = @($cropCurrentAssets | Where-Object { $_.source_id -eq $mapping.SourceId -and $_.current_stage -eq $mapping.CurrentStage })
  Assert-Equal $match.Count 1 "special late-growth mapping $($mapping.SourceId)"
  Assert-Equal $match[0].linked_state_index $mapping.LinkedState "special late-growth linked state $($mapping.SourceId)"
  Assert-Equal $match[0].source_character_id $mapping.Character "special late-growth source character $($mapping.SourceId)"
}

Assert-Equal $cropContactReview.Count 86 "crop contact review rows"
Assert-Equal @($cropContactReview | Where-Object state_rows -ne "7").Count 0 "crop contact reviews without seven states"
Assert-Equal ($cropContactReview | Measure-Object current_assets_checked -Sum).Sum 48 "crop contact current assets checked"
Assert-Equal ($cropContactReview | Measure-Object current_assets_exact -Sum).Sum 48 "crop contact current assets exact"
Assert-Equal ($cropContactReview | Measure-Object current_assets_mismatch -Sum).Sum 0 "crop contact current assets mismatched"
$contactSheets = @(Get-ChildItem -LiteralPath $cropContactDirectory -File -Filter "crop-*.png")
Assert-Equal $contactSheets.Count 86 "crop contact sheet PNGs"
Assert-True (Test-Path -LiteralPath (Join-Path $cropContactDirectory "index.html") -PathType Leaf) "missing crop contact sheet index"
foreach ($sheet in $contactSheets) {
  $size = Get-PngSize $sheet.FullName
  Assert-Equal $size.Width 1264 "contact sheet width for $($sheet.Name)"
  Assert-Equal $size.Height 346 "contact sheet height for $($sheet.Name)"
}

$actualCurrentHashes = @{}
foreach ($file in $classicFiles) {
  $actualCurrentHashes["assets/manor/classic/$($file.Name)"] = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
}
foreach ($asset in $currentAssets) {
  Assert-True ($actualCurrentHashes.ContainsKey($asset.current_file)) "missing current file: $($asset.current_file)"
  Assert-Equal $asset.sha256 $actualCurrentHashes[$asset.current_file] "SHA-256 for $($asset.current_file)"
}
foreach ($asset in $cropCurrentAssets) {
  Assert-True ($actualCurrentHashes.ContainsKey($asset.current_asset)) "missing mapped crop file: $($asset.current_asset)"
  Assert-Equal $asset.current_sha256 $actualCurrentHashes[$asset.current_asset] "mapped crop SHA-256 for $($asset.current_asset)"
}

[pscustomobject]@{
  Crops = $crops.Count
  Animals = $animals.Count
  Decorations = $decorations.Count
  ModuleFiles = $files.Count
  SourceFiles = $sourceModules.Count
  CurrentAssets = $currentAssets.Count
  CropStateAssets = $cropStateAssets.Count
  CurrentCropAssetMappings = $cropCurrentAssets.Count
  CropContactSheets = $contactSheets.Count
  LegacyDuplicateGroups = $duplicates.Count
  CurrentDuplicateGroups = $currentDuplicates.Count
  Status = "ok"
}
