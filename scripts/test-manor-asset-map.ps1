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
$runtimeCropAssetDirectory = Join-Path $classicAssetDirectory "crops"
$runtimePastureAssetDirectory = Join-Path $classicAssetDirectory "pasture"
$runtimeAnimalAssetDirectory = Join-Path $runtimePastureAssetDirectory "animals"
$runtimePastureUiAssetDirectory = Join-Path $runtimePastureAssetDirectory "ui"
$runtimePastureAudioAssetDirectory = Join-Path $runtimePastureAssetDirectory "audio"
$runtimeDecorationAssetDirectory = Join-Path $classicAssetDirectory "decorations"
$runtimeDecorationImageDirectory = Join-Path $runtimeDecorationAssetDirectory "items"
$runtimeDecorationThumbnailDirectory = Join-Path $runtimeDecorationAssetDirectory "thumbnails"

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
$cropRuntimeAssets = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "crop-runtime-assets.csv"))
$cropCurrentAssets = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "crop-current-assets.csv"))
$cropContactReview = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "crop-contact-review.csv"))
$cropVisualReview = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "crop-visual-review.csv"))
$cropContactDirectory = Join-Path $OutputDirectory "contact-sheets\crops"
$decorationAssets = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "decoration-assets.csv"))
$decorationRuntimeAssets = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "decoration-runtime-assets.csv"))
$decorationContactReview = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "decoration-contact-review.csv"))
$decorationVisualReview = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "decoration-visual-review.csv"))
$decorationContactDirectory = Join-Path $OutputDirectory "contact-sheets\decorations"
$animalStateAssets = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "animal-state-assets.csv"))
$animalRuntimeAssets = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "animal-runtime-assets.csv"))
$animalSymbolClasses = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "animal-symbol-classes.csv"))
$animalContactReview = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "animal-contact-review.csv"))
$animalVisualReview = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "animal-visual-review.csv"))
$animalContactDirectory = Join-Path $OutputDirectory "contact-sheets\animals"
$interfaceMediaAssets = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "interface-media-assets.csv"))
$interfaceSymbolAssets = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "interface-symbol-assets.csv"))
$soundAssets = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "sound-assets.csv"))
$animalAudioPolicies = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "animal-audio-policy.csv"))
$pastureRuntimeUiAssets = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "pasture-runtime-ui-assets.csv"))
$pastureRuntimeAudioAssets = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "pasture-runtime-audio-assets.csv"))
$interfaceMediaContactReview = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "interface-media-contact-review.csv"))
$interfaceMediaVisualReview = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "interface-media-visual-review.csv"))
$interfaceMediaContactDirectory = Join-Path $OutputDirectory "contact-sheets\interface-media"
$assetReviewIssues = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "asset-review-issues.csv"))

Assert-Equal $crops.Count 86 "crop rows"
Assert-Equal @($crops | Select-Object -ExpandProperty source_id -Unique).Count 86 "unique crop IDs"
Assert-Equal @($crops | Where-Object swf_parse_error).Count 0 "crop parse errors"
Assert-Equal @($crops | Where-Object processing_status -eq "integrated-4-stage").Count 12 "integrated crops"
Assert-Equal @($crops | Where-Object { @($_.state_character_ids -split "," | Where-Object { $_ }).Count -ne 7 }).Count 0 "crops without seven states"
$runtimeCropAssets = @(Get-ChildItem -LiteralPath $runtimeCropAssetDirectory -Recurse -File -Filter "*.png")
Assert-Equal $runtimeCropAssets.Count 430 "runtime crop assets"
Assert-Equal @(Get-ChildItem -LiteralPath $runtimeCropAssetDirectory -Directory).Count 86 "runtime crop asset directories"
Assert-Equal $cropRuntimeAssets.Count 430 "runtime crop asset mappings"
Assert-Equal @($cropRuntimeAssets | Select-Object -ExpandProperty runtime_asset -Unique).Count 430 "unique runtime crop asset mappings"
Assert-Equal @($cropRuntimeAssets | Group-Object source_id | Where-Object Count -ne 5).Count 0 "crops without five runtime mappings"
Assert-Equal @($cropRuntimeAssets | Where-Object visual_review_status -ne "reviewed-ok").Count 0 "runtime crops without approved visual review"
Assert-Equal @($cropRuntimeAssets | Where-Object processing_status -ne "ready").Count 0 "runtime crops not ready"
foreach ($crop in $crops) {
  $directory = Join-Path $runtimeCropAssetDirectory $crop.source_id
  foreach ($stage in @("seed", "sprout", "growing", "mature", "withered")) {
    $asset = Join-Path $directory "$stage.png"
    Assert-True (Test-Path -LiteralPath $asset -PathType Leaf) "missing runtime crop asset: $($crop.source_id)/$stage.png"
    $size = Get-PngSize $asset
    Assert-True ($size.Width -gt 0 -and $size.Height -gt 0) "invalid runtime crop asset: $($crop.source_id)/$stage.png"
  }
}

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
Assert-Equal @($decorations | Where-Object integration_policy -eq "default").Count 162 "decorations eligible for default integration"
Assert-Equal @($decorations | Where-Object integration_policy -eq "deferred-validation").Count 8 "decorations deferred for scene validation"
Assert-Equal @($decorations | Where-Object integration_policy -eq "excluded").Count 2 "decorations excluded from runtime integration"
Assert-Equal (@($decorations | Where-Object integration_policy -eq "deferred-validation" | Sort-Object { [int]$_.source_id }).source_id -join ",") "14,54,66,76,89,93,213,409" "deferred decoration IDs"

Assert-Equal $files.Count 828 "module file rows"
Assert-Equal @($files | Where-Object { -not $_.sha256 }).Count 0 "module files without SHA-256"
Assert-Equal $sourceModules.Count 124 "source module rows"
Assert-Equal @($sourceModules | Where-Object { -not $_.sha256 }).Count 0 "source modules without SHA-256"
Assert-Equal $duplicates.Count 4 "legacy duplicate groups"
Assert-Equal @($duplicates | Where-Object review_status -eq "conflicting-decoration-identities").Count 3 "conflicting decoration duplicate groups"
Assert-Equal @($duplicates | Where-Object review_status -eq "blank-placeholder-duplicate").Count 1 "blank placeholder duplicate groups"

$classicFiles = @(Get-ChildItem -LiteralPath $classicAssetDirectory -File)
Assert-Equal $currentAssets.Count 103 "current asset rows"
Assert-Equal $classicFiles.Count 103 "current classic files"
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
Assert-Equal @($cropStateAssets | Where-Object visual_review_status -ne "reviewed-ok").Count 0 "crop state assets awaiting visual review"

Assert-Equal $cropCurrentAssets.Count 48 "current crop asset mappings"
Assert-Equal @($cropCurrentAssets | Select-Object -ExpandProperty current_asset -Unique).Count 48 "unique current crop asset mappings"
Assert-Equal @($cropCurrentAssets | Where-Object match_status -eq "exact").Count 48 "exact current crop asset mappings"
Assert-Equal @($cropCurrentAssets | Where-Object { [int]$_.source_hash_match_count -lt 1 }).Count 0 "current crop assets without source hash matches"
Assert-Equal @($cropCurrentAssets | Where-Object source_relationship -eq "state-character").Count 47 "current crop state-character mappings"
Assert-Equal @($cropCurrentAssets | Where-Object source_relationship -eq "nested-character-of-state").Count 1 "current crop nested-character mappings"
Assert-Equal @($cropCurrentAssets | Where-Object visual_review_status -ne "reviewed-ok").Count 0 "current crop assets awaiting visual review"
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
Assert-Equal $cropVisualReview.Count 86 "crop visual review rows"
Assert-Equal @($cropVisualReview | Where-Object review_status -ne "reviewed-ok").Count 0 "crop visual reviews not approved"
Assert-Equal @($cropContactReview | Where-Object state_rows -ne "7").Count 0 "crop contact reviews without seven states"
Assert-Equal @($cropContactReview | Where-Object visual_review_status -ne "reviewed-ok").Count 0 "crop contact sheets awaiting visual review"
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

Assert-Equal $decorationAssets.Count 172 "decoration asset rows"
Assert-Equal @($decorationAssets | Where-Object selected_source_kind -eq "swf-stage-frame").Count 40 "decoration stage-frame assets"
Assert-Equal @($decorationAssets | Where-Object selected_source_kind -eq "swf-content-frame").Count 128 "decoration content-frame assets"
Assert-Equal @($decorationAssets | Where-Object selected_source_kind -eq "full-image").Count 2 "decoration full-image assets"
Assert-Equal @($decorationAssets | Where-Object selected_source_kind -like "blocked-*").Count 2 "blocked decoration assets"
Assert-Equal @($decorationAssets | Where-Object integration_policy -eq "default").Count 162 "default decoration asset integrations"
Assert-Equal @($decorationAssets | Where-Object integration_policy -eq "deferred-validation").Count 8 "deferred decoration asset integrations"
Assert-Equal @($decorationAssets | Where-Object integration_policy -eq "excluded").Count 2 "excluded decoration asset integrations"
Assert-Equal @($decorationAssets | Where-Object automated_status -eq "ready-for-visual-review").Count 170 "decoration assets ready for review"
Assert-Equal @($decorationAssets | Where-Object { $_.selected_source_kind -notlike "blocked-*" -and [int]$_.visible_pixels -le 0 }).Count 0 "empty usable decoration assets"
Assert-Equal $decorationRuntimeAssets.Count 162 "runtime decoration mappings"
Assert-Equal @(Get-ChildItem -LiteralPath $runtimeDecorationImageDirectory -File).Count 162 "runtime decoration images"
Assert-Equal @(Get-ChildItem -LiteralPath $runtimeDecorationThumbnailDirectory -File -Filter "*.jpg").Count 162 "runtime decoration thumbnails"
foreach ($asset in $decorationRuntimeAssets) {
  $runtimePath = Join-Path $repositoryRoot $asset.runtime_asset.Replace("/", "\")
  $thumbnailPath = Join-Path $repositoryRoot $asset.runtime_thumbnail.Replace("/", "\")
  Assert-True (Test-Path -LiteralPath $runtimePath -PathType Leaf) "missing runtime decoration: $runtimePath"
  Assert-True (Test-Path -LiteralPath $thumbnailPath -PathType Leaf) "missing runtime decoration thumbnail: $thumbnailPath"
  Assert-Equal (Get-FileHash -LiteralPath $runtimePath -Algorithm SHA256).Hash.ToLowerInvariant() $asset.runtime_sha256 "runtime decoration hash for $($asset.source_id)"
  Assert-Equal (Get-FileHash -LiteralPath $thumbnailPath -Algorithm SHA256).Hash.ToLowerInvariant() $asset.runtime_thumbnail_sha256 "runtime decoration thumbnail hash for $($asset.source_id)"
}
Assert-Equal $decorationContactReview.Count 172 "decoration contact review rows"
Assert-Equal $decorationVisualReview.Count 172 "decoration visual review rows"
Assert-Equal @($decorationVisualReview | Where-Object review_status -eq "reviewed-ok").Count 162 "approved decoration reviews"
Assert-Equal @($decorationVisualReview | Where-Object review_status -eq "reviewed-with-note").Count 8 "noted decoration reviews"
Assert-Equal @($decorationVisualReview | Where-Object review_status -like "blocked-*").Count 2 "blocked decoration reviews"
$decorationContactSheets = @(Get-ChildItem -LiteralPath $decorationContactDirectory -File -Filter "decoration-*.png")
Assert-Equal $decorationContactSheets.Count 172 "decoration contact sheet PNGs"
Assert-True (Test-Path -LiteralPath (Join-Path $decorationContactDirectory "index.html") -PathType Leaf) "missing decoration contact sheet index"
foreach ($sheet in $decorationContactSheets) {
  $size = Get-PngSize $sheet.FullName
  Assert-Equal $size.Width 1000 "decoration contact sheet width for $($sheet.Name)"
  Assert-Equal $size.Height 390 "decoration contact sheet height for $($sheet.Name)"
}

Assert-Equal $animalStateAssets.Count 210 "animal state asset rows"
Assert-Equal @($animalStateAssets | Group-Object source_id | Where-Object Count -ne 6).Count 0 "animals without six runtime states"
Assert-Equal @($animalStateAssets | Where-Object { [int]$_.visible_pixels -le 0 }).Count 0 "empty animal state assets"
Assert-Equal @($animalStateAssets | Where-Object { -not $_.source_sha256 -or -not $_.source_export_file }).Count 0 "animal states without source evidence"
Assert-Equal @($animalStateAssets | Where-Object visual_review_status -notlike "reviewed-*").Count 0 "animal states awaiting visual review"
Assert-Equal $animalSymbolClasses.Count 288 "animal SymbolClass rows"
Assert-Equal @($animalSymbolClasses | Where-Object role_kind -eq "runtime-state").Count 210 "animal runtime-state SymbolClasses"
Assert-Equal @($animalSymbolClasses | Where-Object role_kind -eq "internal-helper").Count 78 "animal internal helper SymbolClasses"
Assert-Equal $animalContactReview.Count 35 "animal contact review rows"
Assert-Equal @($animalContactReview | Where-Object runtime_state_rows -ne "6").Count 0 "animal contacts without six states"
Assert-Equal @($animalContactReview | Where-Object empty_state_frames -ne "0").Count 0 "animal contacts with empty states"
Assert-Equal @($animalContactReview | Where-Object visual_review_status -notlike "reviewed-*").Count 0 "animal contacts awaiting visual review"
Assert-Equal $animalVisualReview.Count 35 "animal visual review rows"
Assert-Equal @($animalVisualReview | Where-Object review_status -eq "reviewed-ok").Count 34 "approved animal reviews"
Assert-Equal @($animalVisualReview | Where-Object review_status -eq "reviewed-with-note").Count 1 "noted animal reviews"
$runtimeAnimalFiles = @(Get-ChildItem -LiteralPath $runtimeAnimalAssetDirectory -Recurse -File -Filter "*.png")
Assert-Equal $runtimeAnimalFiles.Count 210 "runtime animal assets"
Assert-Equal @(Get-ChildItem -LiteralPath $runtimeAnimalAssetDirectory -Directory).Count 35 "runtime animal asset directories"
Assert-Equal $animalRuntimeAssets.Count 210 "runtime animal asset mappings"
Assert-Equal @($animalRuntimeAssets | Select-Object -ExpandProperty runtime_asset -Unique).Count 210 "unique runtime animal asset mappings"
Assert-Equal @($animalRuntimeAssets | Group-Object source_id | Where-Object Count -ne 6).Count 0 "animals without six runtime asset mappings"
Assert-Equal @($animalRuntimeAssets | Where-Object visual_review_status -notlike "reviewed-*").Count 0 "runtime animals without approved visual review"
Assert-Equal @($animalRuntimeAssets | Where-Object processing_status -ne "ready").Count 0 "runtime animals not ready"
foreach ($animal in $animals) {
  $directory = Join-Path $runtimeAnimalAssetDirectory $animal.source_id
  foreach ($state in @("cub", "growing", "ready_to_produce", "production_early", "production_late", "lifecycle_complete")) {
    $asset = Join-Path $directory "$state.png"
    Assert-True (Test-Path -LiteralPath $asset -PathType Leaf) "missing runtime animal asset: $($animal.source_id)/$state.png"
    $size = Get-PngSize $asset
    Assert-True ($size.Width -gt 0 -and $size.Height -gt 0) "invalid runtime animal asset: $($animal.source_id)/$state.png"
  }
}
$runtimePastureUiFiles = @(Get-ChildItem -LiteralPath $runtimePastureUiAssetDirectory -File -Filter "*.png")
Assert-Equal $runtimePastureUiFiles.Count 24 "runtime pasture UI assets"
Assert-Equal $pastureRuntimeUiAssets.Count 24 "runtime pasture UI mappings"
Assert-Equal @($pastureRuntimeUiAssets | Select-Object -ExpandProperty runtime_asset -Unique).Count 24 "unique runtime pasture UI mappings"
Assert-Equal @($pastureRuntimeUiAssets | Where-Object processing_status -ne "ready").Count 0 "runtime pasture UI assets not ready"
foreach ($asset in $runtimePastureUiFiles) {
  $size = Get-PngSize $asset.FullName
  Assert-True ($size.Width -gt 0 -and $size.Height -gt 0) "invalid runtime pasture UI asset: $($asset.Name)"
}
$runtimePastureAudioFiles = @(Get-ChildItem -LiteralPath $runtimePastureAudioAssetDirectory -Recurse -File -Filter "*.mp3")
Assert-Equal $runtimePastureAudioFiles.Count 60 "runtime pasture audio assets"
Assert-Equal @(Get-ChildItem -LiteralPath $runtimePastureAudioAssetDirectory -Directory).Count 33 "runtime pasture audio animal directories"
Assert-Equal $pastureRuntimeAudioAssets.Count 60 "runtime pasture audio mappings"
Assert-Equal @($pastureRuntimeAudioAssets | Select-Object -ExpandProperty runtime_asset -Unique).Count 60 "unique runtime pasture audio mappings"
Assert-Equal @($pastureRuntimeAudioAssets | Where-Object processing_method -eq "copied").Count 59 "copied runtime pasture sounds"
Assert-Equal @($pastureRuntimeAudioAssets | Where-Object processing_method -eq "transcoded-flv-to-mp3").Count 1 "transcoded runtime pasture sounds"
Assert-Equal @($pastureRuntimeAudioAssets | Where-Object processing_status -ne "ready").Count 0 "runtime pasture audio assets not ready"
Assert-Equal @($pastureRuntimeAudioAssets | Select-Object -ExpandProperty animal_id -Unique).Count 33 "animals with runtime pasture audio"
Assert-Equal @($pastureRuntimeAudioAssets | Where-Object animal_id -in @("1010", "1017")).Count 0 "excluded animals with runtime pasture audio"
$animalContactSheets = @(Get-ChildItem -LiteralPath $animalContactDirectory -File -Filter "animal-*.png")
Assert-Equal $animalContactSheets.Count 35 "animal contact sheet PNGs"
Assert-True (Test-Path -LiteralPath (Join-Path $animalContactDirectory "index.html") -PathType Leaf) "missing animal contact sheet index"
foreach ($sheet in $animalContactSheets) {
  $size = Get-PngSize $sheet.FullName
  Assert-Equal $size.Width 1136 "animal contact sheet width for $($sheet.Name)"
  Assert-Equal $size.Height 358 "animal contact sheet height for $($sheet.Name)"
}

Assert-Equal $interfaceMediaAssets.Count 130 "interface/media source rows"
foreach ($categoryCount in @(
  @{ Category = "farm-crop-support"; Count = 4 },
  @{ Category = "farm-decoration-board"; Count = 16 },
  @{ Category = "farm-flower"; Count = 28 },
  @{ Category = "farm-ui"; Count = 6 },
  @{ Category = "other"; Count = 7 },
  @{ Category = "pasture-sound"; Count = 60 },
  @{ Category = "pasture-ui"; Count = 9 }
)) {
  Assert-Equal @($interfaceMediaAssets | Where-Object category -eq $categoryCount.Category).Count $categoryCount.Count "$($categoryCount.Category) source rows"
}
Assert-Equal @($interfaceMediaAssets | Where-Object processing_status -eq "parse-error").Count 0 "interface/media parse errors"
Assert-Equal @($interfaceMediaAssets | Where-Object processing_status -eq "no-define-sound").Count 0 "sound containers without DefineSound"
Assert-Equal @($interfaceMediaAssets | Where-Object { $_.inventory_kind -eq "sound-swf" -and $_.define_sound_count -ne "1" }).Count 0 "sound containers without exactly one track"
Assert-Equal $interfaceSymbolAssets.Count 860 "interface symbol asset rows"
Assert-Equal @($interfaceSymbolAssets | Where-Object render_status -eq "rendered").Count 830 "rendered interface symbol assets"
Assert-Equal @($interfaceSymbolAssets | Where-Object render_status -eq "empty-outline").Count 28 "empty interface symbol outlines"
Assert-Equal @($interfaceSymbolAssets | Where-Object render_status -eq "not-drawable").Count 2 "non-drawable interface symbols"
Assert-Equal @($interfaceSymbolAssets | Where-Object visual_role -eq "action-effect-candidate").Count 20 "action effect candidates"
Assert-Equal @($interfaceSymbolAssets | Where-Object { $_.render_status -notin @("rendered", "empty-outline", "not-drawable") }).Count 0 "unclassified interface render failures"
Assert-Equal $soundAssets.Count 60 "DefineSound rows"
Assert-Equal @($soundAssets | Select-Object -ExpandProperty source_file -Unique).Count 60 "unique sound containers"
Assert-Equal @($soundAssets | Where-Object sound_format -eq "WAV").Count 55 "WAV sound rows"
Assert-Equal @($soundAssets | Where-Object sound_format -eq "MP3").Count 5 "MP3 sound rows"
Assert-Equal @($soundAssets | Where-Object { [int]$_.sound_rate -notin @(5512, 11025, 22050, 44100) }).Count 0 "invalid decoded sound rates"
Assert-Equal ([Math]::Round([double](($soundAssets | Measure-Object sound_duration_seconds -Sum).Sum), 3)) 75.121 "total sound duration"
Assert-Equal $animalAudioPolicies.Count 35 "animal audio policy rows"
Assert-Equal @($animalAudioPolicies | Where-Object integration_policy -eq "default").Count 27 "animals with complete audio variants"
Assert-Equal @($animalAudioPolicies | Where-Object integration_policy -eq "available-only").Count 6 "animals using available audio only"
Assert-Equal @($animalAudioPolicies | Where-Object integration_policy -eq "excluded").Count 2 "animals with audio excluded"
Assert-Equal (@($animalAudioPolicies | Where-Object integration_policy -eq "available-only" | Sort-Object animal_id).animal_id -join ",") "1007,1015,1016,1018,1510,1512" "available-only animal audio IDs"
Assert-Equal (@($animalAudioPolicies | Where-Object integration_policy -eq "excluded" | Sort-Object animal_id).animal_id -join ",") "1010,1017" "excluded animal audio IDs"
foreach ($policy in $animalAudioPolicies) {
  Assert-Equal @($soundAssets | Where-Object animal_id -eq $policy.animal_id).Count ([int]$policy.available_variant_count) "audio source count for animal $($policy.animal_id)"
}
Assert-Equal $interfaceMediaContactReview.Count 38 "interface/media contact review rows"
Assert-Equal @($interfaceMediaContactReview | Where-Object visual_review_status -notlike "reviewed-*").Count 0 "interface/media contacts awaiting visual review"
Assert-Equal @($interfaceMediaContactReview | Where-Object render_errors -ne "0").Count 0 "interface/media contact render errors"
Assert-Equal $interfaceMediaVisualReview.Count 38 "interface/media visual review rows"
Assert-Equal @($interfaceMediaVisualReview | Where-Object review_status -eq "reviewed-ok").Count 30 "approved interface/media reviews"
Assert-Equal @($interfaceMediaVisualReview | Where-Object review_status -eq "reviewed-with-note").Count 8 "noted interface/media reviews"
$interfaceMediaContactSheets = @(Get-ChildItem -LiteralPath $interfaceMediaContactDirectory -File -Filter "media-*.png")
Assert-Equal $interfaceMediaContactSheets.Count 38 "interface/media contact sheet PNGs"
Assert-True (Test-Path -LiteralPath (Join-Path $interfaceMediaContactDirectory "index.html") -PathType Leaf) "missing interface/media contact sheet index"
foreach ($sheet in $interfaceMediaContactSheets) {
  $size = Get-PngSize $sheet.FullName
  Assert-Equal $size.Width 1128 "interface/media contact sheet width for $($sheet.Name)"
  Assert-True ($size.Height -gt 0) "invalid interface/media contact sheet height for $($sheet.Name)"
}

Assert-Equal $assetReviewIssues.Count 18 "asset review issue rows"
Assert-Equal @($assetReviewIssues | Where-Object severity -eq "blocking").Count 2 "blocking asset issues"
Assert-Equal @($assetReviewIssues | Where-Object severity -eq "warning").Count 16 "warning asset issues"
Assert-Equal @($assetReviewIssues | Where-Object status -eq "integration-check-required").Count 8 "decoration integration checks"
Assert-Equal @($assetReviewIssues | Where-Object status -eq "source-gap").Count 8 "pasture sound source gaps"
Assert-Equal @($assetReviewIssues | Where-Object integration_policy -eq "excluded").Count 4 "issues excluded from integration"
Assert-Equal @($assetReviewIssues | Where-Object integration_policy -eq "deferred-validation").Count 8 "issues deferred for validation"
Assert-Equal @($assetReviewIssues | Where-Object integration_policy -eq "available-only").Count 6 "issues limited to available variants"

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
$actualRuntimeCropHashes = @{}
foreach ($file in $runtimeCropAssets) {
  $relativePath = [IO.Path]::GetRelativePath($repositoryRoot, $file.FullName).Replace("\", "/")
  $actualRuntimeCropHashes[$relativePath] = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
}
foreach ($asset in $cropRuntimeAssets) {
  Assert-True ($actualRuntimeCropHashes.ContainsKey($asset.runtime_asset)) "missing runtime crop file: $($asset.runtime_asset)"
  Assert-Equal $asset.runtime_sha256 $actualRuntimeCropHashes[$asset.runtime_asset] "runtime crop SHA-256 for $($asset.runtime_asset)"
}
$actualRuntimePastureHashes = @{}
foreach ($file in @($runtimeAnimalFiles) + @($runtimePastureUiFiles)) {
  $relativePath = [IO.Path]::GetRelativePath($repositoryRoot, $file.FullName).Replace("\", "/")
  $actualRuntimePastureHashes[$relativePath] = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
}
foreach ($asset in @($animalRuntimeAssets) + @($pastureRuntimeUiAssets)) {
  Assert-True ($actualRuntimePastureHashes.ContainsKey($asset.runtime_asset)) "missing runtime pasture file: $($asset.runtime_asset)"
  Assert-Equal $asset.runtime_sha256 $actualRuntimePastureHashes[$asset.runtime_asset] "runtime pasture SHA-256 for $($asset.runtime_asset)"
}
$actualRuntimePastureAudioHashes = @{}
foreach ($file in $runtimePastureAudioFiles) {
  $relativePath = [IO.Path]::GetRelativePath($repositoryRoot, $file.FullName).Replace("\", "/")
  $actualRuntimePastureAudioHashes[$relativePath] = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
}
foreach ($asset in $pastureRuntimeAudioAssets) {
  Assert-True ($actualRuntimePastureAudioHashes.ContainsKey($asset.runtime_asset)) "missing runtime pasture audio file: $($asset.runtime_asset)"
  Assert-Equal $asset.runtime_sha256 $actualRuntimePastureAudioHashes[$asset.runtime_asset] "runtime pasture audio SHA-256 for $($asset.runtime_asset)"
  $policy = @($animalAudioPolicies | Where-Object animal_id -eq $asset.animal_id)
  Assert-Equal $policy.Count 1 "audio policy for runtime animal $($asset.animal_id)"
  Assert-True ($asset.variant -in @($policy[0].available_variants -split ";")) "disallowed runtime sound variant for animal $($asset.animal_id)"
}

[pscustomobject]@{
  Crops = $crops.Count
  Animals = $animals.Count
  Decorations = $decorations.Count
  ModuleFiles = $files.Count
  SourceFiles = $sourceModules.Count
  CurrentAssets = $currentAssets.Count
  CropStateAssets = $cropStateAssets.Count
  RuntimeCropAssets = $runtimeCropAssets.Count
  CurrentCropAssetMappings = $cropCurrentAssets.Count
  CropContactSheets = $contactSheets.Count
  DecorationContactSheets = $decorationContactSheets.Count
  RuntimeDecorationAssets = $decorationRuntimeAssets.Count
  AnimalStateAssets = $animalStateAssets.Count
  RuntimeAnimalAssets = $runtimeAnimalFiles.Count
  RuntimePastureUiAssets = $runtimePastureUiFiles.Count
  RuntimePastureAudioAssets = $runtimePastureAudioFiles.Count
  AnimalContactSheets = $animalContactSheets.Count
  InterfaceSymbolAssets = $interfaceSymbolAssets.Count
  DefineSounds = $soundAssets.Count
  InterfaceMediaContactSheets = $interfaceMediaContactSheets.Count
  AssetReviewIssues = $assetReviewIssues.Count
  LegacyDuplicateGroups = $duplicates.Count
  CurrentDuplicateGroups = $currentDuplicates.Count
  Status = "ok"
}
