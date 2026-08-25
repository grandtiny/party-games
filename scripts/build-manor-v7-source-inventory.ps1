param(
  [string]$SourceRoot = $env:MANOR_V7_SOURCE_PATH,
  [string]$OutputDirectory
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $SourceRoot) {
  throw "Pass -SourceRoot or set MANOR_V7_SOURCE_PATH"
}
$SourceRoot = (Resolve-Path -LiteralPath $SourceRoot).Path
if (-not $OutputDirectory) {
  $OutputDirectory = Join-Path $repositoryRoot "docs\manor-v7-source"
}

$pluginRoot = @(
  $SourceRoot
  (Join-Path $SourceRoot "wwwroot\source\plugin\qqfarm")
  (Join-Path $SourceRoot "source\plugin\qqfarm")
) | Where-Object {
  Test-Path -LiteralPath (Join-Path $_ "core\common.php") -PathType Leaf
} | Select-Object -First 1
if (-not $pluginRoot) {
  throw "QQ Farm V7 plugin root was not found below $SourceRoot"
}

$coreRoot = Join-Path $pluginRoot "core"
$moduleRoot = Join-Path $coreRoot "module"
$configRoot = Join-Path $coreRoot "config"
$commonPath = Join-Path $coreRoot "common.php"
$installSqlPath = Join-Path $pluginRoot "install\qfarm.sql"
$farmEntryPath = Join-Path $coreRoot "mync.php"
$pastureEntryPath = Join-Path $coreRoot "mymc.php"

$commonSource = Get-Content -LiteralPath $commonPath -Raw
$versionMatch = [regex]::Match($commonSource, "define\('FARM_VERSION',\s*'(?<version>[^']+)'\)")
if (-not $versionMatch.Success) {
  throw "FARM_VERSION was not found in core/common.php"
}
$sourceVersion = $versionMatch.Groups["version"].Value
if ($sourceVersion -ne "7.0 Beta1 Build 20120209.1000") {
  throw "Unexpected QQ Farm source version: $sourceVersion"
}

function Get-RelativePath([string]$BasePath, [string]$FullPath) {
  return $FullPath.Substring($BasePath.Length).TrimStart("\").Replace("\", "/")
}

function Get-AssetClassification([string]$RelativePath, [string]$Extension) {
  $path = $RelativePath.ToLowerInvariant()
  $domain = "shared"
  $category = "runtime-shell"
  $policy = "core-candidate"

  switch -Regex ($path) {
    '^mc/farm/animal/' { $domain = "pasture"; $category = "animal-model"; break }
    '^mc/farm/aswf/' { $domain = "pasture"; $category = "animal-animation"; break }
    '^mc/farm/diy/' { $domain = "pasture"; $category = "decoration"; break }
    '^mc/farm/icon/' { $domain = "pasture"; $category = "catalog-icon"; break }
    '^mc/farm/product/' { $domain = "pasture"; $category = "animal-product"; break }
    '^mc/main/sound/' { $domain = "pasture"; $category = "audio"; break }
    '^mc/main/updateden/' { $domain = "pasture"; $category = "building"; break }
    '^mc/main/(windows|outswf)/' { $domain = "pasture"; $category = "window-ui"; break }
    '^mc/(module|submodule)/' { $domain = "pasture"; $category = "runtime-module"; break }
    '^mc/main/' { $domain = "pasture"; $category = "runtime-shell"; break }
    '^mc/farm/(enemy|hunter|intel|wild)/' { $domain = "pasture"; $category = "live-event"; $policy = "deferred-liveops"; break }
    '^mc/farm/vipanimal/' { $domain = "pasture"; $category = "vip-content"; $policy = "excluded-monetization"; break }
    '^ui/allcrops/' { $domain = "farm"; $category = "crop-stage"; break }
    '^ui/farm/diy/' { $domain = "farm"; $category = "decoration"; break }
    '^ui/farm/fish/' { $domain = "fishpond"; $category = "fish-stage"; break }
    '^ui/farm/icon/' { $domain = "farm"; $category = "catalog-icon"; break }
    '^ui/dogs/' { $domain = "farm"; $category = "dog"; break }
    '^ui/flower/' { $domain = "farm"; $category = "flower"; break }
    '^ui/tools/' { $domain = "farm"; $category = "tool"; break }
    '^ui/main/' { $domain = "farm"; $category = "runtime-shell"; break }
    '^ui/qqshow/' { $domain = "social"; $category = "avatar"; $policy = "optional-social"; break }
    '^ui/npc/' { $domain = "shared"; $category = "live-event"; $policy = "deferred-liveops"; break }
    '^ui/(allcards|cardgames)/' { $domain = "shared"; $category = "live-event"; $policy = "deferred-liveops"; break }
    '^ui/vipseeds/' { $domain = "farm"; $category = "vip-content"; $policy = "excluded-monetization"; break }
    '^ui/wild/' { $domain = "farm"; $category = "live-event"; $policy = "deferred-liveops"; break }
    '^ui/farm/' { $domain = "farm"; $category = "scene-or-ui"; break }
    '^ui/' { $domain = "shared"; $category = "runtime-ui"; break }
    '^mc/farm/' { $domain = "pasture"; $category = "scene-or-ui"; break }
  }

  $kind = switch ($Extension.ToLowerInvariant()) {
    ".swf" { "flash-container" }
    ".png" { "raster-image" }
    ".jpg" { "raster-image" }
    ".jpeg" { "raster-image" }
    ".gif" { "animated-or-raster-image" }
    ".xml" { "structured-config" }
    default { "unknown" }
  }

  return [pscustomobject]@{
    Domain = $domain
    Category = $category
    Kind = $kind
    Policy = $policy
  }
}

function Get-ProtocolInventory(
  [string]$Area,
  [string]$EntryPath,
  [string]$HandlerDirectory
) {
  $entrySource = Get-Content -LiteralPath $EntryPath -Raw -Encoding utf8
  $allowlistMatch = [regex]::Match($entrySource, '(?s)\$mod_list\s*=\s*array\((?<body>.*?)\);')
  if (-not $allowlistMatch.Success) {
    throw "Protocol allowlist was not found in $EntryPath"
  }

  $declared = @([regex]::Matches($allowlistMatch.Groups["body"].Value, "'(?<module>[^']*)'") | ForEach-Object {
    $_.Groups["module"].Value
  } | Where-Object { $_ })
  $declarationCounts = @{}
  $declared | ForEach-Object { $declarationCounts[$_] = 1 + [int]$declarationCounts[$_] }
  $handlers = @(Get-ChildItem -LiteralPath $HandlerDirectory -File -Filter "*.php" | ForEach-Object BaseName)

  return @($declared + $handlers | Sort-Object -Unique | ForEach-Object {
    $moduleName = $_
    $allowlisted = $declarationCounts.ContainsKey($moduleName)
    $handlerExists = $moduleName -in $handlers
    $sourceCondition = if ($allowlisted -and $handlerExists) {
      "allowed-handler-present"
    } elseif ($allowlisted) {
      "allowed-handler-missing"
    } else {
      "handler-not-allowlisted"
    }
    [pscustomobject][ordered]@{
      area = $Area
      module_name = $moduleName
      declaration_count = if ($allowlisted) { $declarationCounts[$moduleName] } else { 0 }
      allowlisted = $allowlisted.ToString().ToLowerInvariant()
      handler_exists = $handlerExists.ToString().ToLowerInvariant()
      source_condition = $sourceCondition
    }
  })
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

$moduleFiles = @(Get-ChildItem -LiteralPath $moduleRoot -Recurse -File | Sort-Object FullName)
$fileRows = @($moduleFiles | ForEach-Object {
  $relativePath = Get-RelativePath $moduleRoot $_.FullName
  $classification = Get-AssetClassification $relativePath $_.Extension
  [pscustomobject][ordered]@{
    relative_path = $relativePath
    extension = $_.Extension.ToLowerInvariant()
    bytes = $_.Length
    sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    domain = $classification.Domain
    category = $classification.Category
    asset_kind = $classification.Kind
    integration_policy = $classification.Policy
    inventory_status = "inventoried"
  }
})

$duplicateRows = @($fileRows | Group-Object sha256 | Where-Object Count -gt 1 | ForEach-Object {
  $group = $_
  $index = 0
  $group.Group | Sort-Object relative_path | ForEach-Object {
    $index += 1
    [pscustomobject][ordered]@{
      duplicate_group = $group.Name.Substring(0, 12)
      member_index = $index
      member_count = $group.Count
      relative_path = $_.relative_path
      bytes = $_.bytes
      sha256 = $_.sha256
    }
  }
})

$configFiles = @(Get-ChildItem -LiteralPath $configRoot -Recurse -File | Sort-Object FullName)
$configRows = @($configFiles | ForEach-Object {
  $relativePath = Get-RelativePath $configRoot $_.FullName
  $domain = if ($relativePath.StartsWith("nc/")) { "farm" } elseif ($relativePath.StartsWith("mc/")) { "pasture" } else { "shared" }
  [pscustomobject][ordered]@{
    relative_path = $relativePath
    domain = $domain
    bytes = $_.Length
    sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    role = if ($_.Name -match "type|time|upgrade|hide") { "runtime-rule-source" } else { "runtime-configuration" }
  }
})

$databaseRows = @()
if (Test-Path -LiteralPath $installSqlPath -PathType Leaf) {
  $sql = Get-Content -LiteralPath $installSqlPath -Raw
  $databaseRows = @([regex]::Matches($sql, 'CREATE TABLE IF NOT EXISTS `(?:app_|pre_)?(?<name>qqfarm_[^`]+)`') | ForEach-Object {
    $name = $_.Groups["name"].Value
    [pscustomobject][ordered]@{
      table_name = $name
      data_class = if ($name -match 'logs$') { "player-log" } elseif ($name -eq "qqfarm_message") { "player-message" } elseif ($name -eq "qqfarm_market") { "player-market" } else { "player-state" }
      migration_policy = "do-not-migrate"
    }
  })
}

$categoryRows = @($fileRows | Group-Object domain, category, integration_policy | ForEach-Object {
  $sample = $_.Group[0]
  [pscustomobject][ordered]@{
    domain = $sample.domain
    category = $sample.category
    integration_policy = $sample.integration_policy
    files = $_.Count
    bytes = ($_.Group | Measure-Object bytes -Sum).Sum
    swf_files = @($_.Group | Where-Object extension -eq ".swf").Count
    image_files = @($_.Group | Where-Object { $_.extension -in @(".png", ".jpg", ".jpeg", ".gif") }).Count
  }
} | Sort-Object domain, category, integration_policy)

$protocolRows = @(
  Get-ProtocolInventory "farm" $farmEntryPath (Join-Path $coreRoot "source\nc\mod")
  Get-ProtocolInventory "pasture" $pastureEntryPath (Join-Path $coreRoot "source\mc\mod")
)
$allowedProtocolRows = @($protocolRows | Where-Object allowlisted -eq "true")

$summaryRows = @(
  [pscustomobject]@{ key = "source_version"; value = $sourceVersion }
  [pscustomobject]@{ key = "source_bundle_sha256"; value = ((Get-FileHash -LiteralPath $commonPath -Algorithm SHA256).Hash.ToLowerInvariant()) }
  [pscustomobject]@{ key = "module_files"; value = $fileRows.Count }
  [pscustomobject]@{ key = "module_bytes"; value = ($fileRows | Measure-Object bytes -Sum).Sum }
  [pscustomobject]@{ key = "swf_files"; value = @($fileRows | Where-Object extension -eq ".swf").Count }
  [pscustomobject]@{ key = "png_files"; value = @($fileRows | Where-Object extension -eq ".png").Count }
  [pscustomobject]@{ key = "jpg_files"; value = @($fileRows | Where-Object extension -eq ".jpg").Count }
  [pscustomobject]@{ key = "gif_files"; value = @($fileRows | Where-Object extension -eq ".gif").Count }
  [pscustomobject]@{ key = "xml_files"; value = @($fileRows | Where-Object extension -eq ".xml").Count }
  [pscustomobject]@{ key = "duplicate_groups"; value = @($fileRows | Group-Object sha256 | Where-Object Count -gt 1).Count }
  [pscustomobject]@{ key = "config_files"; value = $configRows.Count }
  [pscustomobject]@{ key = "database_tables"; value = $databaseRows.Count }
  [pscustomobject]@{ key = "source_protocol_rows"; value = $protocolRows.Count }
  [pscustomobject]@{ key = "farm_allowed_protocols"; value = @($allowedProtocolRows | Where-Object area -eq "farm").Count }
  [pscustomobject]@{ key = "pasture_allowed_protocols"; value = @($allowedProtocolRows | Where-Object area -eq "pasture").Count }
  [pscustomobject]@{ key = "allowed_handlers_missing"; value = @($protocolRows | Where-Object source_condition -eq "allowed-handler-missing").Count }
  [pscustomobject]@{ key = "handlers_not_allowlisted"; value = @($protocolRows | Where-Object source_condition -eq "handler-not-allowlisted").Count }
  [pscustomobject]@{ key = "duplicate_protocol_declarations"; value = @($protocolRows | Where-Object { [int]$_.declaration_count -gt 1 }).Count }
)

$fileRows | Export-Csv -LiteralPath (Join-Path $OutputDirectory "files.csv") -NoTypeInformation -Encoding utf8
$duplicateRows | Export-Csv -LiteralPath (Join-Path $OutputDirectory "duplicates.csv") -NoTypeInformation -Encoding utf8
$configRows | Export-Csv -LiteralPath (Join-Path $OutputDirectory "config-files.csv") -NoTypeInformation -Encoding utf8
$databaseRows | Export-Csv -LiteralPath (Join-Path $OutputDirectory "database-boundary.csv") -NoTypeInformation -Encoding utf8
$categoryRows | Export-Csv -LiteralPath (Join-Path $OutputDirectory "categories.csv") -NoTypeInformation -Encoding utf8
$protocolRows | Export-Csv -LiteralPath (Join-Path $OutputDirectory "source-protocols.csv") -NoTypeInformation -Encoding utf8
$summaryRows | Export-Csv -LiteralPath (Join-Path $OutputDirectory "summary.csv") -NoTypeInformation -Encoding utf8

Write-Host "Inventoried $($fileRows.Count) QQ Farm V7 module files from $sourceVersion"
