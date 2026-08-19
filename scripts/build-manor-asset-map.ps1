param(
  [string]$LegacyRoot,
  [string]$JpexsJar = "C:\Code\30_Tools\jpexs\26.2.1\app\ffdec.jar",
  [string]$JavaExe = "java",
  [string]$OutputDirectory
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $LegacyRoot) {
  $LegacyRoot = Join-Path $repositoryRoot "..\..\20_ThirdParty\qqfarm\upload\home\qqfarm"
}
$LegacyRoot = (Resolve-Path $LegacyRoot).Path
if (-not $OutputDirectory) {
  $OutputDirectory = Join-Path $repositoryRoot "docs\manor-assets"
}
if (-not (Test-Path -LiteralPath $JpexsJar -PathType Leaf)) {
  throw "JPEXS jar not found: $JpexsJar"
}

$cropDirectory = Join-Path $LegacyRoot "module\nc\crops"
$animalDirectory = Join-Path $LegacyRoot "module\mc\main\animal"
$moduleDirectory = Join-Path $LegacyRoot "module"
$sourceDirectory = Join-Path $LegacyRoot "source"
$farmConfigPath = Join-Path $LegacyRoot "source\nc\config\farm.php"
$animalConfigPath = Join-Path $LegacyRoot "source\mc\config\animal.php"
$classicAssetDirectory = Join-Path $repositoryRoot "apps\web\public\assets\manor\classic"
$swfInspector = Join-Path $PSScriptRoot "ManorSwfInventory.java"

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

function Invoke-SwfInventory([string]$Directory) {
  $lines = & $JavaExe --class-path $JpexsJar $swfInspector $Directory
  if ($LASTEXITCODE -ne 0) {
    throw "SWF inventory failed for $Directory"
  }
  return @($lines | ConvertFrom-Csv -Delimiter "`t")
}

function Get-StringField([string]$Body, [string]$Name) {
  $pattern = '"' + [regex]::Escape($Name) + '"\s*=>\s*"(?<value>[^"]*)"'
  $match = [regex]::Match($Body, $pattern)
  return $match.Groups["value"].Value
}

function Get-NumberField([string]$Body, [string]$Name) {
  $pattern = '"' + [regex]::Escape($Name) + '"\s*=>\s*(?<value>-?\d+)'
  $match = [regex]::Match($Body, $pattern)
  if (-not $match.Success) { return $null }
  return [long]$match.Groups["value"].Value
}

function Get-Hash([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return "" }
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-RelativePath([string]$Root, [string]$Path) {
  return [IO.Path]::GetRelativePath($Root, $Path).Replace("\", "/")
}

function Get-StateId([string]$StateIds, [int]$Index) {
  if (-not $StateIds) { return "" }
  $ids = @($StateIds.Split(",", [StringSplitOptions]::RemoveEmptyEntries))
  if ($Index -ge $ids.Count) { return "" }
  return $ids[$Index]
}

function Get-SourcePurpose([string]$RelativePath) {
  $path = $RelativePath.Replace("\", "/")
  if ($path -match '^nc/mod/farmlandstatus_') { return "farm-action" }
  if ($path -match '^nc/mod/repertory_') { return "farm-inventory" }
  if ($path -match '^nc/mod/item_') { return "farm-decoration" }
  if ($path -match '^nc/mod/usertool_') { return "farm-tool" }
  if ($path -match '^nc/mod/(friend|chat_)') { return "farm-social" }
  if ($path -match '^nc/mod/task_') { return "farm-task" }
  if ($path -match '^nc/mod/dog_') { return "farm-dog" }
  if ($path -match '^nc/mod/feast_') { return "farm-event" }
  if ($path -match '^mc/mod/cgi_') { return "pasture-action" }
  if ($path -match '^mc/mod/(friend|chat_)') { return "pasture-social" }
  if ($path -match '/config/') { return "configuration" }
  if ($path -match '/mission/') { return "mission" }
  if ($path -match '^script/') { return "bootstrap-script" }
  if ($path -match '^admin/') { return "administration" }
  if ($path -match '^cron/') { return "scheduled-task" }
  if ($path -match '^tools/') { return "maintenance-tool" }
  return "support"
}

function Get-AssetCategory([string]$RelativePath) {
  $path = $RelativePath.Replace("\", "/")
  if ($path -match '^nc/crops/Crop_(\d+)\.swf$') { return "farm-crop" }
  if ($path -match '^nc/crops/') { return "farm-crop-support" }
  if ($path -match '^nc/farm/diy/board/') { return "farm-decoration-board" }
  if ($path -match '^nc/farm/diy/') { return "farm-decoration" }
  if ($path -match '^nc/main/') { return "farm-ui" }
  if ($path -match '^nc/flower/') { return "farm-flower" }
  if ($path -match '^mc/main/animal/') { return "pasture-animal" }
  if ($path -match '^mc/main/sound/') { return "pasture-sound" }
  if ($path -match '^mc/main/') { return "pasture-ui" }
  if ($path -match '^mc/farm/diy/') { return "pasture-decoration" }
  if ($path -match '^mc/farm/') { return "pasture-farm" }
  return "other"
}

function Get-CurrentAssetCategory([string]$FileName) {
  if ($FileName -match '^crop-') { return "crop" }
  if ($FileName -match '^nav-') { return "navigation" }
  if ($FileName -match '^tool-') { return "tool" }
  if ($FileName -match '^land-') { return "land" }
  if ($FileName -eq 'farm-background.png') { return "scene" }
  if ($FileName -match '^(can-harvest|insect|weed|sunny)\.png$') { return "farm-status" }
  return "ui"
}

function Get-PngSize([string]$Path) {
  $bytes = [IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -lt 24 -or $bytes[0] -ne 137 -or $bytes[1] -ne 80 -or $bytes[2] -ne 78 -or $bytes[3] -ne 71) {
    return [pscustomobject]@{ Width = 0; Height = 0 }
  }
  $width = (([int]$bytes[16]) -shl 24) -bor (([int]$bytes[17]) -shl 16) -bor (([int]$bytes[18]) -shl 8) -bor ([int]$bytes[19])
  $height = (([int]$bytes[20]) -shl 24) -bor (([int]$bytes[21]) -shl 16) -bor (([int]$bytes[22]) -shl 8) -bor ([int]$bytes[23])
  return [pscustomobject]@{ Width = $width; Height = $height }
}

$cropStructures = Invoke-SwfInventory $cropDirectory
$animalStructures = Invoke-SwfInventory $animalDirectory
$cropStructureByFile = @{}
foreach ($row in $cropStructures) { $cropStructureByFile[$row.source_file] = $row }
$animalStructureByFile = @{}
foreach ($row in $animalStructures) { $animalStructureByFile[$row.source_file] = $row }

$currentCropIds = @{
  2 = "radish"
  3 = "carrot"
  4 = "corn"
  5 = "potato"
  6 = "eggplant"
  7 = "tomato"
  8 = "pea"
  9 = "chili"
  10 = "pumpkin"
  59 = "cabbage"
  60 = "rice"
  61 = "wheat"
}

$currentAssetSourceSymbols = @{}
function Add-CurrentAssetSource([string]$FileName, [string]$Source, [string]$Character, [string]$Status = "verified-jpexs-export") {
  $currentAssetSourceSymbols[$FileName] = [pscustomobject]@{
    Source = $Source
    Character = $Character
    Status = $Status
  }
}

$farmUi1 = "module/nc/main/farmui1_v_12.swf"
$farmUi2 = "module/nc/main/farmui2_v_4.swf"
Add-CurrentAssetSource "farm-background.png" $farmUi1 "1:DefaultBg" "verified-embedded-image-source"
Add-CurrentAssetSource "can-harvest.png" $farmUi1 "138:canPickIcon" "verified-source-symbol-near-exact"
Add-CurrentAssetSource "close.png" $farmUi1 "306:CloseButton"
Add-CurrentAssetSource "exp-bg.png" $farmUi1 "267:ExpBlueBg"
Add-CurrentAssetSource "exp-fill.png" $farmUi1 "269:ExpBlue"
Add-CurrentAssetSource "fertilizer.png" $farmUi1 "157:Fertilizer"
Add-CurrentAssetSource "fertilizer-fast.png" $farmUi1 "164:FertilizerFast"
Add-CurrentAssetSource "fertilizer-instant.png" $farmUi1 "170:FertilizerVeryFast"
Add-CurrentAssetSource "head-bg.png" $farmUi1 "265:HeadBg"
Add-CurrentAssetSource "insect.png" $farmUi1 "257:Insect"
Add-CurrentAssetSource "item-bg.png" $farmUi1 "314:ItemBg"
Add-CurrentAssetSource "level-blue.png" $farmUi1 "271:LevelBlue"
Add-CurrentAssetSource "reclaim.png" $farmUi1 "261:Reclaim"
Add-CurrentAssetSource "sunny.png" $farmUi1 "286:Sunny"
Add-CurrentAssetSource "toolbar-bg.png" $farmUi1 "23:ToolBarBg"
Add-CurrentAssetSource "weed.png" $farmUi1 "259:Weed"
Add-CurrentAssetSource "window-bg.png" $farmUi1 "263:WindowBg"

$landSources = @{
  "land-grass.png" = "53:com.qzone.ui.Wasteland"
  "land-fertile.png" = "56:com.qzone.ui.FarmlandS2"
  "land-arid-fertile.png" = "59:com.qzone.ui.FarmlandG2"
  "land-soil.png" = "62:com.qzone.ui.FarmlandS"
  "land-arid.png" = "65:com.qzone.ui.FarmlandG"
}
foreach ($entry in $landSources.GetEnumerator()) {
  Add-CurrentAssetSource $entry.Key $farmUi2 $entry.Value
}

$buttonSources = @{
  "nav-pasture" = "292:aButtonMC"
  "nav-farm" = "295:ButtonFarm"
  "nav-warehouse" = "298:ButtonWarehouse"
  "nav-shop" = "301:ButtonShop"
  "tool-harvest" = "25:ButtonHand"
  "tool-move" = "231:Cursor"
  "tool-water" = "234:ButtonWater"
  "tool-seed" = "236:ButtonSeed"
  "tool-pesticide" = "247:ButtonPesticide"
  "tool-weed" = "251:ButtonHook"
  "tool-hoe" = "254:ButtonHoe"
}
foreach ($entry in $buttonSources.GetEnumerator()) {
  Add-CurrentAssetSource "$($entry.Key)-1_up.png" $farmUi1 $entry.Value
  Add-CurrentAssetSource "$($entry.Key)-2_over.png" $farmUi1 $entry.Value
  Add-CurrentAssetSource "$($entry.Key)-3_down.png" $farmUi1 $entry.Value
}

$farmConfig = Get-Content -LiteralPath $farmConfigPath -Raw
$cropPattern = '"(?<key>\d+)"\s*=>\s*array\((?<body>"cId"=>\d+,"cLevel"=>\d+,"cName"=>"[^"]+"[^\)]*)\)'
$cropMatches = [regex]::Matches($farmConfig, $cropPattern)
$crops = foreach ($match in $cropMatches) {
  $body = $match.Groups["body"].Value
  $cropId = [int](Get-NumberField $body "cId")
  $swfName = "Crop_$cropId.swf"
  $swfPath = Join-Path $cropDirectory $swfName
  $structure = $cropStructureByFile[$swfName]
  $currentId = if ($currentCropIds.ContainsKey($cropId)) { $currentCropIds[$cropId] } else { "" }
  $currentAssets = if ($currentId) {
    (0..3 | ForEach-Object { "assets/manor/classic/crop-$currentId-$_.png" }) -join ";"
  } else { "" }
  [pscustomobject][ordered]@{
    source_id = $cropId
    name = Get-StringField $body "cName"
    original_level = Get-NumberField $body "cLevel"
    crop_type = Get-NumberField $body "cType"
    seed_price = Get-NumberField $body "price"
    sale_price = Get-NumberField $body "sale"
    base_yield = Get-NumberField $body "output"
    experience = Get-NumberField $body "cropExp"
    growth_seconds = Get-NumberField $body "growthCycle"
    harvest_cycles = Get-NumberField $body "maturingTime"
    source_swf = "module/nc/crops/$swfName"
    source_bytes = if (Test-Path -LiteralPath $swfPath) { (Get-Item -LiteralPath $swfPath).Length } else { 0 }
    source_sha256 = Get-Hash $swfPath
    root_sprite_id = if ($structure) { $structure.root_sprite_id } else { "" }
    state_character_ids = if ($structure) { $structure.state_character_ids } else { "" }
    state_0_seed = if ($structure) { Get-StateId $structure.state_character_ids 0 } else { "" }
    state_1_sprout = if ($structure) { Get-StateId $structure.state_character_ids 1 } else { "" }
    state_2_young = if ($structure) { Get-StateId $structure.state_character_ids 2 } else { "" }
    state_3_growing = if ($structure) { Get-StateId $structure.state_character_ids 3 } else { "" }
    state_4_pre_mature = if ($structure) { Get-StateId $structure.state_character_ids 4 } else { "" }
    state_5_mature = if ($structure) { Get-StateId $structure.state_character_ids 5 } else { "" }
    state_6_withered = if ($structure) { Get-StateId $structure.state_character_ids 6 } else { "" }
    swf_parse_error = if ($structure) { $structure.error } else { "missing SWF inventory" }
    current_id = $currentId
    current_assets = $currentAssets
    processing_status = if ($currentId) { "integrated-4-stage" } else { "mapped-not-extracted" }
  }
}

$animalConfig = Get-Content -LiteralPath $animalConfigPath -Raw
$arrayPattern = '"(?<key>\d+)"\s*=>\s*array\((?<body>[^\)]*)\)'
$animalMatches = [regex]::Matches($animalConfig, $arrayPattern) | Where-Object {
  $_.Groups["body"].Value.Contains('"byproductprice"')
}
$animalNameRows = @{}
foreach ($match in [regex]::Matches($animalConfig, $arrayPattern)) {
  $body = $match.Groups["body"].Value
  if ($body.Contains('"name"') -and -not $body.Contains('"byproductprice"')) {
    $animalNameRows[[int]$match.Groups["key"].Value] = $body
  }
}
$animals = foreach ($match in $animalMatches) {
  $body = $match.Groups["body"].Value
  $animalId = [int](Get-NumberField $body "cId")
  $byproductBody = $animalNameRows[$animalId]
  $animalProductBody = $animalNameRows[$animalId + 10000]
  if (-not $byproductBody -or -not $animalProductBody) {
    throw "Animal $animalId is missing package sale metadata"
  }
  $swfName = "a$animalId.swf"
  $swfPath = Join-Path $animalDirectory $swfName
  $structure = $animalStructureByFile[$swfName]
  [pscustomobject][ordered]@{
    source_id = $animalId
    name = Get-StringField $body "cName"
    original_level = Get-NumberField $body "cLevel"
    purchase_price = Get-NumberField $body "price"
    product_price = Get-NumberField $body "productprice"
    byproduct_price = Get-NumberField $body "byproductprice"
    byproduct_name = Get-StringField $byproductBody "name"
    byproduct_sale_price = Get-NumberField $byproductBody "price"
    byproduct_harvest_experience = Get-NumberField $byproductBody "exp"
    byproduct_unit = Get-StringField $byproductBody "liangci"
    animal_sale_price = Get-NumberField $animalProductBody "price"
    animal_harvest_experience = Get-NumberField $animalProductBody "exp"
    animal_unit = Get-StringField $animalProductBody "liangci"
    production_action = Get-StringField $animalProductBody "act"
    base_yield = Get-NumberField $body "output"
    consume = Get-NumberField $body "consum"
    cub_seconds = Get-NumberField $body "cub"
    maturity_seconds = Get-NumberField $body "maturingTime"
    production_seconds = Get-NumberField $body "procreation"
    production_cycle_seconds = Get-NumberField $body "cycle"
    production_action_seconds = Get-NumberField $body "productime"
    description = Get-StringField $body "sinfo"
    source_swf = "module/mc/main/animal/$swfName"
    source_bytes = if (Test-Path -LiteralPath $swfPath) { (Get-Item -LiteralPath $swfPath).Length } else { 0 }
    source_sha256 = Get-Hash $swfPath
    primary_class = if ($structure) { $structure.class_name } else { "" }
    primary_sprite_id = if ($structure) { $structure.root_sprite_id } else { "" }
    symbol_classes = if ($structure) { $structure.symbol_classes } else { "" }
    swf_parse_error = if ($structure) { $structure.error } else { "missing SWF inventory" }
    processing_status = "mapped-not-extracted"
  }
}

$decorationTypes = @{
  1 = "background"
  2 = "house"
  3 = "fence"
  4 = "doghouse"
}
$decorationPattern = '"(?<key>\d+)"\s*=>\s*array\((?<body>"itemId"\s*=>[^\)]*)\)'
$decorationMatches = [regex]::Matches($farmConfig, $decorationPattern)
$decorationDirectory = Join-Path $LegacyRoot "module\nc\farm\diy"
$deferredDecorationIds = @(14, 54, 66, 76, 89, 93, 213, 409)
$decorations = foreach ($match in $decorationMatches) {
  $body = $match.Groups["body"].Value
  $itemId = [int](Get-NumberField $body "itemId")
  $itemType = [int](Get-NumberField $body "itemType")
  $swfPath = Join-Path $decorationDirectory "$itemId.swf"
  $previewPath = Join-Path $decorationDirectory "$itemId.jpg"
  $thumbnailPath = Join-Path $decorationDirectory "${itemId}b.jpg"
  $alternatePath = Join-Path $decorationDirectory "${itemId}f.jpg"
  $swfExists = Test-Path -LiteralPath $swfPath
  $alternateExists = Test-Path -LiteralPath $alternatePath
  $sourceCompleteness = if ($swfExists) {
    "complete-swf"
  } elseif ($alternateExists) {
    "full-image-fallback"
  } else {
    "preview-only-missing-runtime-art"
  }
  $knownIssue = switch ($itemId) {
    21 { "missing-swf-and-full-image" }
    95 { "source-files-reused-by-402" }
    402 { "conflicts-with-config-name-duplicates-95" }
    default { "" }
  }
  $extractionPolicy = if ($itemId -eq 21) {
    "blocked-missing-source"
  } elseif ($itemId -eq 402) {
    "blocked-conflicting-source"
  } elseif ($swfExists) {
    "extract-swf"
  } elseif ($alternateExists) {
    "use-full-image"
  } else {
    "blocked-missing-source"
  }
  $preferredRuntimeSource = if ($extractionPolicy -eq "extract-swf") {
    "module/nc/farm/diy/$itemId.swf"
  } elseif ($extractionPolicy -eq "use-full-image") {
    "module/nc/farm/diy/${itemId}f.jpg"
  } else {
    ""
  }
  $integrationPolicy = if ($extractionPolicy -like "blocked-*") {
    "excluded"
  } elseif ($itemId -in $deferredDecorationIds) {
    "deferred-validation"
  } else {
    "default"
  }
  [pscustomobject][ordered]@{
    source_id = $itemId
    name = Get-StringField $body "itemName"
    set_name = Get-StringField $body "itemDesc"
    item_type = $itemType
    item_type_name = $decorationTypes[$itemType]
    original_level = Get-NumberField $body "level"
    coin_price = Get-NumberField $body "price"
    premium_price = Get-NumberField $body "FBPrice"
    discounted_premium_price = Get-NumberField $body "YFBPrice"
    experience = Get-NumberField $body "exp"
    valid_seconds = Get-NumberField $body "itemValidTime"
    swf_file = if ($swfExists) { "module/nc/farm/diy/$itemId.swf" } else { "" }
    preview_file = if (Test-Path -LiteralPath $previewPath) { "module/nc/farm/diy/$itemId.jpg" } else { "" }
    thumbnail_file = if (Test-Path -LiteralPath $thumbnailPath) { "module/nc/farm/diy/${itemId}b.jpg" } else { "" }
    alternate_file = if ($alternateExists) { "module/nc/farm/diy/${itemId}f.jpg" } else { "" }
    source_files_present = @(@($swfPath, $previewPath, $thumbnailPath, $alternatePath) |
      Where-Object { Test-Path -LiteralPath $_ }).Count
    source_completeness = $sourceCompleteness
    known_issue = $knownIssue
    extraction_policy = $extractionPolicy
    integration_policy = $integrationPolicy
    preferred_runtime_source = $preferredRuntimeSource
    processing_status = "mapped-not-extracted"
  }
}

$moduleFiles = Get-ChildItem -LiteralPath $moduleDirectory -File -Recurse
$assetFiles = foreach ($file in $moduleFiles) {
  $relativePath = Get-RelativePath $moduleDirectory $file.FullName
  $category = Get-AssetCategory $relativePath
  $entityId = ""
  $status = "inventoried"
  $currentTarget = ""
  if ($relativePath -match '^nc/crops/Crop_(\d+)\.swf$') {
    $entityId = $Matches[1]
    $numericId = [int]$entityId
    if ($currentCropIds.ContainsKey($numericId)) {
      $status = "integrated-source"
      $currentTarget = "assets/manor/classic/crop-$($currentCropIds[$numericId])-*.png"
    } else {
      $status = "mapped-not-extracted"
    }
  } elseif ($relativePath -match '^mc/main/animal/a(\d+)\.swf$') {
    $entityId = $Matches[1]
    $status = "mapped-not-extracted"
  } elseif ($relativePath -match '^nc/farm/diy/(\d+)(?:b|f)?\.(?:swf|jpg|png)$') {
    $entityId = $Matches[1]
    $status = "mapped-not-extracted"
  }
  [pscustomobject][ordered]@{
    source_file = "module/$relativePath"
    area = $relativePath.Split('/')[0]
    category = $category
    entity_id = $entityId
    extension = $file.Extension.ToLowerInvariant()
    bytes = $file.Length
    sha256 = Get-Hash $file.FullName
    processing_status = $status
    current_target = $currentTarget
  }
}

$sourceFiles = Get-ChildItem -LiteralPath $sourceDirectory -File -Recurse
$sourceModules = foreach ($file in $sourceFiles) {
  $relativePath = Get-RelativePath $sourceDirectory $file.FullName
  [pscustomobject][ordered]@{
    source_file = "source/$relativePath"
    area = $relativePath.Split('/')[0]
    module_name = $file.BaseName
    purpose = Get-SourcePurpose $relativePath
    extension = $file.Extension.ToLowerInvariant()
    bytes = $file.Length
    sha256 = Get-Hash $file.FullName
  }
}

$duplicateAssets = $assetFiles |
  Group-Object sha256 |
  Where-Object Count -gt 1 |
  ForEach-Object {
    $files = @($_.Group | Sort-Object source_file)
    $sourceFileList = (@($files.source_file) -join ";")
    $reviewStatus = if ($sourceFileList -match 'module/nc/farm/diy/(?:95|402)') {
      "conflicting-decoration-identities"
    } elseif ([long]$files[0].bytes -eq 36 -and @($files.extension | Sort-Object -Unique) -join ";" -eq ".swf") {
      "blank-placeholder-duplicate"
    } else {
      "exact-duplicate-needs-review"
    }
    [pscustomobject][ordered]@{
      sha256 = $_.Name
      copy_count = $_.Count
      bytes_each = $files[0].bytes
      extensions = (@($files.extension | Sort-Object -Unique) -join ";")
      categories = (@($files.category | Sort-Object -Unique) -join ";")
      source_files = $sourceFileList
      review_status = $reviewStatus
    }
  }

$currentCropSourceIds = @{}
foreach ($entry in $currentCropIds.GetEnumerator()) {
  $currentCropSourceIds[$entry.Value] = $entry.Key
}
$classicAssets = Get-ChildItem -LiteralPath $classicAssetDirectory -File | Sort-Object Name
$currentAssets = foreach ($file in $classicAssets) {
  $category = Get-CurrentAssetCategory $file.Name
  $entityId = ""
  $entityName = ""
  $appStage = ""
  $appStageName = ""
  $sourceReference = ""
  $sourceCharacter = ""
  $mappingStatus = "source-file-needs-mapping"
  if ($file.Name -match '^crop-(?<id>[a-z0-9-]+)-(?<stage>[0-3])\.png$') {
    $entityId = $Matches["id"]
    $appStage = $Matches["stage"]
    $appStageName = @("seed", "sprout", "growing", "mature")[[int]$appStage]
    if ($currentCropSourceIds.ContainsKey($entityId)) {
      $sourceId = [int]$currentCropSourceIds[$entityId]
      $sourceCrop = $crops | Where-Object source_id -eq $sourceId | Select-Object -First 1
      $entityName = $sourceCrop.name
      $sourceReference = $sourceCrop.source_swf
      $mappingStatus = if ($appStage -eq "3") {
        "verified-single-mature-sprite"
      } else {
        "object-mapped-state-needs-contact-sheet"
      }
    }
  } elseif ($currentAssetSourceSymbols.ContainsKey($file.Name)) {
    $sourceMapping = $currentAssetSourceSymbols[$file.Name]
    $sourceReference = $sourceMapping.Source
    $sourceCharacter = $sourceMapping.Character
    $mappingStatus = $sourceMapping.Status
  }
  $size = Get-PngSize $file.FullName
  [pscustomobject][ordered]@{
    current_file = "assets/manor/classic/$($file.Name)"
    category = $category
    entity_id = $entityId
    entity_name = $entityName
    app_stage = $appStage
    app_stage_name = $appStageName
    width = $size.Width
    height = $size.Height
    bytes = $file.Length
    sha256 = Get-Hash $file.FullName
    source_reference = $sourceReference
    source_character = $sourceCharacter
    mapping_status = $mappingStatus
  }
}

$currentDuplicateAssets = $currentAssets |
  Group-Object sha256 |
  Where-Object Count -gt 1 |
  ForEach-Object {
    $files = @($_.Group | Sort-Object current_file)
    $fileNames = @($files.current_file | ForEach-Object { Split-Path -Leaf $_ })
    $reviewStatus = "needs-review"
    if (@($files | Where-Object { $_.category -ne "crop" -or $_.app_stage -ne "0" }).Count -eq 0) {
      $reviewStatus = "expected-shared-seed-art"
    } elseif (@($files | Where-Object { $_.category -ne "crop" -or $_.app_stage -ne "1" }).Count -eq 0) {
      $reviewStatus = if (($fileNames -join ";") -eq "crop-carrot-1.png;crop-radish-1.png") {
        "verified-shared-source-sprite"
      } else {
        "shared-early-growth-needs-visual-review"
      }
    } elseif ($files.Count -eq 2) {
      $firstStem = $fileNames[0] -replace '-[13]_(?:up|down)\.png$', ''
      $secondStem = $fileNames[1] -replace '-[13]_(?:up|down)\.png$', ''
      if ($firstStem -eq $secondStem -and $fileNames[0] -match '-1_up\.png$' -and $fileNames[1] -match '-3_down\.png$') {
        $reviewStatus = "legacy-control-up-down-identical"
      }
    }
    [pscustomobject][ordered]@{
      sha256 = $_.Name
      copy_count = $_.Count
      bytes_each = $files[0].bytes
      categories = (@($files.category | Sort-Object -Unique) -join ";")
      current_files = ($files.current_file -join ";")
      review_status = $reviewStatus
    }
  }

$crops | Sort-Object original_level, source_id | Export-Csv -LiteralPath (Join-Path $OutputDirectory "crops.csv") -NoTypeInformation -Encoding utf8
$animals | Sort-Object original_level, source_id | Export-Csv -LiteralPath (Join-Path $OutputDirectory "animals.csv") -NoTypeInformation -Encoding utf8
$decorations | Sort-Object set_name, item_type, source_id | Export-Csv -LiteralPath (Join-Path $OutputDirectory "decorations.csv") -NoTypeInformation -Encoding utf8
$assetFiles | Sort-Object source_file | Export-Csv -LiteralPath (Join-Path $OutputDirectory "files.csv") -NoTypeInformation -Encoding utf8
$sourceModules | Sort-Object source_file | Export-Csv -LiteralPath (Join-Path $OutputDirectory "source-modules.csv") -NoTypeInformation -Encoding utf8
$duplicateAssets |
  Sort-Object -Property @{ Expression = "copy_count"; Descending = $true }, sha256 |
  Export-Csv -LiteralPath (Join-Path $OutputDirectory "duplicates.csv") -NoTypeInformation -Encoding utf8
$currentAssets | Export-Csv -LiteralPath (Join-Path $OutputDirectory "current-assets.csv") -NoTypeInformation -Encoding utf8
$currentDuplicateAssets |
  Sort-Object -Property @{ Expression = "copy_count"; Descending = $true }, sha256 |
  Export-Csv -LiteralPath (Join-Path $OutputDirectory "current-duplicates.csv") -NoTypeInformation -Encoding utf8

$legacyRepository = (Get-Item -LiteralPath $LegacyRoot).Parent.Parent.Parent.FullName
$legacyCommit = (& git -c "safe.directory=$($legacyRepository.Replace('\', '/'))" -C $legacyRepository rev-parse HEAD).Trim()
$integratedCropCount = @($crops | Where-Object processing_status -eq "integrated-4-stage").Count
$cropParseErrors = @($crops | Where-Object swf_parse_error).Count
$animalParseErrors = @($animals | Where-Object swf_parse_error).Count

$readme = @"
# 怀旧庄园素材对应表

本目录是旧版 QQ 农场/牧场素材到当前 Party Games 庄园模块的可复核映射，不保存旧站部署配置、账号数据或聊天记录。

## 来源与生成

- 原仓库：``Boldcc/qqfarm``
- 原仓库提交：``$legacyCommit``
- 游戏根目录：``upload/home/qqfarm``
- 源台账生成：``pwsh -File scripts/build-manor-asset-map.ps1``
- 作物目录生成：``pwsh -File scripts/generate-manor-crop-catalog.ps1``
- 动物目录生成：``pwsh -File scripts/generate-manor-animal-catalog.ps1``
- 运行时作物导出：``pwsh -File scripts/export-manor-runtime-crops.ps1``
- 运行时牧场图像导出：``pwsh -File scripts/export-manor-runtime-pasture.ps1``
- 运行时牧场声音导出：``pwsh -File scripts/export-manor-runtime-pasture-audio.ps1``
- SWF 解析：JPEXS ``ffdec.jar``，由 ``scripts/ManorSwfInventory.java`` 在单个 JVM 内批量读取。

## 当前统计

| 范围 | 数量 | 当前状态 |
| --- | ---: | --- |
| 原版作物配置/SWF | $($crops.Count) | 602 个七阶段角色已导出并人工复核；430 张五阶段运行时 PNG 已接入；结构解析错误 $cropParseErrors |
| 原版动物配置/SWF | $($animals.Count) | 210 个六状态角色和 78 个内部辅助类已分离登记并人工复核；210 张运行时 PNG 已接入；结构解析错误 $animalParseErrors |
| 原版装饰配置 | $($decorations.Count) | 162 件允许默认接入，8 件延后到场景验收，ID 21/402 不接入 |
| UI、动作及辅助素材 | 130 个源文件 | 830 个可见映射已复核；28 个空轮廓和 2 个二进制类已分类 |
| 原版牧场声音 | 60 个容器/60 条音轨 | 按真实 DefineSound 登记，总时长 75.121 秒；8 种动物存在原版变体缺口 |
| 原版 module 素材文件 | $($assetFiles.Count) | 已逐文件登记 SHA-256、分类和处理状态 |
| 原版 source 源码文件 | $($sourceModules.Count) | 已按功能域登记，用于后续规则对应 |
| 原版 module 完全重复文件组 | $(@($duplicateAssets).Count) | 仅表示二进制完全相同，删除或合并前仍需人工判断用途 |
| 当前 classic 基础 PNG | $($currentAssets.Count) | 当前项目已使用的场景、控件和首批兼容作物素材 |
| 作物运行时 PNG | 430 | 86 种作物各含种子、发芽、生长、成熟、枯萎五阶段 |
| 动物运行时 PNG | 210 | 35 种动物各含幼年、成长、成熟待生产、生产阶段一、生产阶段二、生命周期结束六状态 |
| 牧场运行时 UI PNG | 24 | 原版牧场背景、顶部栏、工具栏、导航、饲料槽和核心工具控件 |
| 牧场运行时音频 | 60 | 33 种动物的真实可用变体均接入 MP3；59 条直接复制，1 条由 FLV 音频容器转码 |
| 当前 classic PNG 完全重复组 | $(@($currentDuplicateAssets).Count) | 已区分共享作物阶段、按钮状态复用和待复核项 |

## 文件说明

| 文件 | 用途 |
| --- | --- |
| ``crops.csv`` | 86 种作物的原版经济数据、SWF、七个状态角色和当前接入状态 |
| ``animals.csv`` | 35 种动物的原版配置值、实际 CGI 结算售价/经验、周期、产品名称、SWF SymbolClass 和接入状态 |
| ``decorations.csv`` | 172 件装饰的套装、类型、价格、源完整性、提取策略、接入策略和可用源文件 |
| ``files.csv`` | ``module`` 下 828 个素材文件的完整文件级台账 |
| ``source-modules.csv`` | ``source`` 下 124 个 PHP 配置/业务模块及功能分类 |
| ``duplicates.csv`` | ``module`` 内 SHA-256 完全相同的文件组，用于定位重复素材，不代表可以直接删除 |
| ``current-assets.csv`` | 当前项目 103 个 classic PNG 的尺寸、哈希、业务对象和源文件对应状态 |
| ``current-duplicates.csv`` | 当前 classic PNG 的完全重复组及初步复核分类 |
| ``crop-state-assets.csv`` | 86 种作物七阶段的 602 行角色、导出 PNG、尺寸、哈希和当前素材比对结果 |
| ``crop-current-assets.csv`` | 当前 48 张作物 PNG 到七阶段、实际源角色、导出文件和哈希的逐张映射 |
| ``crop-runtime-assets.csv`` | 86 种作物的 430 张运行时 PNG、源角色、阶段、哈希和视觉复核状态 |
| ``crop-contact-review.csv`` | 每种作物的联系表、角色复用数量和自动校验结果 |
| ``crop-visual-review.csv`` | 86 种作物联系表的人工视觉复核结论和专项备注，生成器只读取、不覆盖 |
| ``decoration-assets.csv`` | 172 件装饰的实际选源、导出图、可见范围、哈希和视觉复核状态 |
| ``decoration-runtime-assets.csv`` | 162 件已验收装饰的运行时原图、缩略图和逐文件哈希 |
| ``decoration-contact-review.csv`` / ``decoration-visual-review.csv`` | 装饰自动检查与人工视觉结论 |
| ``animal-state-assets.csv`` | 35 种动物六个运行时状态的 210 行角色、导出图、尺寸和哈希 |
| ``animal-runtime-assets.csv`` | 210 张动物运行时 PNG 到原角色、源哈希和人工复核结论的逐张映射 |
| ``animal-symbol-classes.csv`` | 288 个动物 SymbolClass，明确区分 210 个运行时状态和 78 个内部辅助类 |
| ``animal-contact-review.csv`` / ``animal-visual-review.csv`` | 动物联系表自动检查与人工视觉结论 |
| ``interface-media-assets.csv`` | UI、动作、花束、留言板、入口和声音等 130 个源文件的分类汇总 |
| ``interface-symbol-assets.csv`` | 860 个根舞台、SymbolClass 和 ExportAssets 映射及 830 个渲染结果 |
| ``pasture-runtime-ui-assets.csv`` | 24 张牧场运行时背景和控件 PNG 到原 UI 角色及源哈希的逐张映射 |
| ``sound-assets.csv`` | 60 个真实 DefineSound 音轨的格式、采样率、声道、样本数和时长 |
| ``animal-audio-policy.csv`` | 35 种动物的可用声音变体和运行时接入策略 |
| ``pasture-runtime-audio-assets.csv`` | 60 条牧场运行时 MP3 到原 SWF、DefineSound、变体策略、时长及源/运行时哈希的映射 |
| ``asset-review-issues.csv`` | 当前全部阻断项、接入前复核项和原版声音缺口的统一问题清单 |
| ``contact-sheets/crops/index.html`` | 86 份作物七阶段视觉联系表入口 |
| ``contact-sheets/decorations/index.html`` | 172 件装饰视觉联系表入口 |
| ``contact-sheets/animals/index.html`` | 35 种动物六状态视觉联系表入口 |
| ``contact-sheets/interface-media/index.html`` | 38 份 UI、动作和辅助素材联系表入口 |

## 状态定义

| 状态 | 含义 |
| --- | --- |
| ``integrated-4-stage`` | 首批 12 种兼容素材已提取到 classic 根目录；完整运行时状态以 ``crop-runtime-assets.csv`` 为准 |
| ``integrated-source`` | 该源 SWF 已有当前项目目标素材，但仍需保留来源核验 |
| ``mapped-not-extracted`` | 已确定原版业务对象和源文件，尚未批量导出/视觉验收 |
| ``inventoried`` | 已登记文件，仍需在对应 UI、声音或装饰批次中细分用途 |

## 接入策略

| 策略 | 含义 |
| --- | --- |
| ``default`` | 已有完整且验收通过的源素材，可以进入后续默认接入批次 |
| ``deferred-validation`` | 源素材存在，但必须先在实际场景验证裁剪、锚点、遮罩或层级，不进入默认批次 |
| ``available-only`` | 只接入台账明确列出的现有变体，不为缺失变体建立替代映射 |
| ``excluded`` | 当前没有可信可用源或存在身份冲突，不接入运行时 |

## SWF 状态口径

作物根精灵通常按深度放置七个状态角色。``crops.csv`` 将它们记录为 seed、sprout、young、growing、pre-mature、mature、withered。当前只把这套顺序作为提取索引；每种作物仍需生成联系表并肉眼确认，不能仅按“倒数第二个精灵”批量认定成熟图。

动物 SWF 每种都有 ``Animal_<id>_1`` 至 ``Animal_<id>_6`` 六个运行时状态，依次对应幼年、成长、成熟待生产、生产阶段一、生产阶段二、生命周期结束。该语义来自原 PHP 的状态跳转；联系表仍保留数字状态作为运行时契约。兔子、羊、袋鼠等额外内部类只登记在 ``animal-symbol-classes.csv``，不混入六状态。

UI 素材库的根舞台常为空，实际可见资源挂在 SymbolClass 或 ExportAssets 上。联系表同时记录空根舞台、运行时容器和不可视二进制配置，不把它们误报为丢图。``action-effect-candidate`` 仅是类名启发式分类，接入时仍应根据联系表和业务调用点确认。

牧场声音按 SWF 内真实 ``DefineSound`` 标签清点，而不是按容器文件数推测。当前 60 个容器各含 1 条音轨；采样率使用 JPEXS 解析后的 Hz 值计算时长。

## 已知缺口与重复

- 172 条装饰配置中有 169 条带 SWF。背景 ID 26 和 31 虽然没有 SWF，但分别带 1034x806、1024x768 的 ``f.jpg`` 全尺寸图，可作为运行时回退；背景 ID 21 只有 60x60 预览和 120x120 缩略图，既缺 SWF 也缺全尺寸图，是唯一无法从当前仓库恢复的农场装饰。背景 ID 11 同时带 SWF 和 1028x789 全尺寸图。
- 原版 ``module`` 有 4 组 SHA-256 完全重复文件。其中装饰 ID 95“浪漫栅栏”和 ID 402“新年围墙”的 SWF、预览图、缩略图三组文件分别完全相同，但业务身份和所属套装不同，应保留两个业务 ID、阻止 402 进入默认提取批次，不能静默合并。另有一组 36 字节牧场装饰 SWF 是可解析的空白占位文件，不作为可见素材处理。
- ``decorations.csv`` 的 ``extraction_policy`` 控制如何提取，``integration_policy`` 控制能否接入：162 件为 ``default``，ID 14/54/66/76/89/93/213/409 为 ``deferred-validation``，ID 21/402 为 ``excluded``。被延后或排除的素材不得进入默认批次。
- 当前 classic PNG 有 13 组完全重复：2 组为多种作物共享种子图，1 组白萝卜/胡萝卜早期图已确认分别精确来自两个原 SWF 的同一角色 4，10 组为原版按钮 normal/down 状态本身相同；当前没有错误重复或未分类重复。
- 当前 54 张场景/UI PNG 已全部追溯到 ``farmui1_v_12.swf`` 或 ``farmui2_v_4.swf``：52 张与 JPEXS 导出文件哈希一致，``can-harvest.png`` 对应 ``138:canPickIcon`` 且只有 1 个像素差异，背景对应 ``1:DefaultBg`` 内嵌图。
- 当前 12 种作物的 48 张 PNG 均已通过 SHA-256 反查到各自 SWF 的实际导出角色：47 张直接对应七阶段角色；水稻当前阶段 1 使用七阶段“幼苗”角色 15 内的纯植株子角色 14，以避免把原版水田底图重复叠到网页土地上。水稻和小麦当前阶段 2 均对应“成熟前”角色，而不是通用作物采用的“生长”角色。具体关系见 ``crop-current-assets.csv`` 和联系表蓝字。
- 完整 86 种作物已按统一五阶段接入 430 张运行时 PNG；水稻纯植株子角色以及水稻、小麦成熟前角色的特殊映射继续保留，逐项来源见 ``crop-runtime-assets.csv``。
- 35 种动物中有 8 种缺少一个或两个原版声音变体：乌龟、乌骨鸡、长颈鹿、美国短毛猫、穿山甲和貔貅只有变体 2，只允许接入现有变体；仓鼠和炫舞龟没有声音文件，声音保持 ``excluded``。动物视觉素材不受声音缺口影响。
- 装饰的阻断项、黑/白耕地占位、远端同帧元素和声音缺口统一维护在 ``asset-review-issues.csv``；正文不再复制易过期的分散待办。

## 当前边界

素材准备阶段已完成“批量导出 -> 联系表 -> 人工验收 -> 问题清单”。农场已消费作物台账并接入 86 种作物、原版生长阶段、多季、枯萎、照料收益/减产、三档化肥、土地开垦、新手礼包和升级奖励规则；三档化肥分别来自 ``157:Fertilizer``、``164:FertilizerFast`` 和 ``170:FertilizerVeryFast``，开垦木牌来自 ``261:Reclaim``。162 件通过视觉验收的装扮已导出为运行时原图和缩略图，并接入金币购买、原版有效期、同类启停和永久升级权益；20 件原活动赠品只保留素材，不开放购买，8 件延后项和 2 件排除项没有进入运行时。牧场已接入 35 种动物的 210 张六状态运行时 PNG、24 张原版场景和核心控件 PNG、60 条原版可用音频，并完成购买、喂养、生产、收获、出售、窝棚升级和经典页面。好友互动仍未接入。后续接入必须继续消费对应表并按 ``integration_policy`` 过滤，不直接把原 PHP/Flash 放进运行时，平台账号继续作为唯一账号体系。
"@
Set-Content -LiteralPath (Join-Path $OutputDirectory "README.md") -Value $readme -Encoding utf8

[pscustomobject]@{
  Crops = $crops.Count
  Animals = $animals.Count
  Decorations = $decorations.Count
  AssetFiles = $assetFiles.Count
  SourceFiles = $sourceModules.Count
  OutputDirectory = $OutputDirectory
}
