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

$crops = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "crops.csv"))
$animals = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "animals.csv"))
$decorations = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "decorations.csv"))
$files = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "files.csv"))
$sourceModules = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "source-modules.csv"))
$duplicates = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "duplicates.csv"))
$currentAssets = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "current-assets.csv"))
$currentDuplicates = @(Import-Csv -LiteralPath (Join-Path $OutputDirectory "current-duplicates.csv"))

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

$actualCurrentHashes = @{}
foreach ($file in $classicFiles) {
  $actualCurrentHashes["assets/manor/classic/$($file.Name)"] = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
}
foreach ($asset in $currentAssets) {
  Assert-True ($actualCurrentHashes.ContainsKey($asset.current_file)) "missing current file: $($asset.current_file)"
  Assert-Equal $asset.sha256 $actualCurrentHashes[$asset.current_file] "SHA-256 for $($asset.current_file)"
}

[pscustomobject]@{
  Crops = $crops.Count
  Animals = $animals.Count
  Decorations = $decorations.Count
  ModuleFiles = $files.Count
  SourceFiles = $sourceModules.Count
  CurrentAssets = $currentAssets.Count
  LegacyDuplicateGroups = $duplicates.Count
  CurrentDuplicateGroups = $currentDuplicates.Count
  Status = "ok"
}
