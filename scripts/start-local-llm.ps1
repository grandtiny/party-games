param(
  [int]$Port = 18083,
  [string]$HostName = "127.0.0.1",
  [string]$DatabasePath = "",
  [string]$CpaConfigPath = "",
  [string]$CpaModel = "codex-auto-review",
  [int]$LlmTimeoutMs = 60000,
  [switch]$Build
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot

if ($Port -eq 18082) {
  throw "Port 18082 is reserved for Media Records Importer. Use Party Games port 18083."
}

function Get-FirstEnvironmentValue {
  param([string[]]$Names)

  foreach ($name in $Names) {
    $value = [Environment]::GetEnvironmentVariable($name, "Process")
    if (-not [string]::IsNullOrWhiteSpace($value)) {
      return [PSCustomObject]@{
        Name = $name
        Value = $value.Trim()
      }
    }
  }

  return [PSCustomObject]@{
    Name = ""
    Value = ""
  }
}

function Set-EnvironmentIfMissing {
  param(
    [string]$Name,
    [string]$Value
  )

  $current = [Environment]::GetEnvironmentVariable($Name, "Process")
  if ([string]::IsNullOrWhiteSpace($current) -and -not [string]::IsNullOrWhiteSpace($Value)) {
    [Environment]::SetEnvironmentVariable($Name, $Value, "Process")
  }
}

function Get-LocalCpaConfig {
  param(
    [string]$ConfiguredPath,
    [string]$PreferredModel
  )

  $candidatePath = $ConfiguredPath
  if ([string]::IsNullOrWhiteSpace($candidatePath)) {
    $candidatePath = "C:\Code\30_Tools\cli\CLIProxyAPI_6.10.9_windows_amd64\config.yaml"
  }
  if (-not (Test-Path -LiteralPath $candidatePath)) {
    return [PSCustomObject]@{
      Ready = $false
      Endpoint = ""
      ApiKey = ""
      Model = ""
      Source = ""
    }
  }

  $lines = Get-Content -LiteralPath $candidatePath
  $port = "8317"
  $cpaHost = "127.0.0.1"
  $apiKey = ""
  $models = New-Object System.Collections.Generic.List[string]
  $inApiKeys = $false
  $inCodexProvider = $false

  foreach ($line in $lines) {
    if ($line -match '^host:\s*"?([^"]*)"?\s*$') {
      $configuredHost = $Matches[1].Trim()
      if (
        -not [string]::IsNullOrWhiteSpace($configuredHost) -and
        $configuredHost -notin @("0.0.0.0", "::")
      ) {
        $cpaHost = $configuredHost
      }
      continue
    }
    if ($line -match '^port:\s*(\d+)\s*$') {
      $port = $Matches[1]
      continue
    }
    if ($line -match '^api-keys:\s*$') {
      $inApiKeys = $true
      continue
    }
    if ($inApiKeys -and $line -match '^[A-Za-z0-9_-].*:') {
      $inApiKeys = $false
    }
    if ($inApiKeys -and [string]::IsNullOrWhiteSpace($apiKey) -and $line -match '^\s*-\s*(.+?)\s*$') {
      $apiKey = $Matches[1].Trim().Trim('"').Trim("'")
      continue
    }
    if ($line -match '^codex-api-key:\s*$') {
      $inCodexProvider = $true
      continue
    }
    if ($inCodexProvider -and $line -match '^[A-Za-z0-9_-].*:' -and $line -notmatch '^codex-api-key:') {
      $inCodexProvider = $false
    }
    if ($inCodexProvider -and $line -match '^\s*-\s*name:\s*"?([^"#]+)"?') {
      $models.Add($Matches[1].Trim())
    }
  }

  $model = ""
  if (-not [string]::IsNullOrWhiteSpace($PreferredModel) -and $models.Contains($PreferredModel)) {
    $model = $PreferredModel
  } elseif ($models.Count -gt 0) {
    $model = $models[0]
  } elseif (-not [string]::IsNullOrWhiteSpace($PreferredModel)) {
    $model = $PreferredModel
  }

  return [PSCustomObject]@{
    Ready = -not [string]::IsNullOrWhiteSpace($apiKey) -and -not [string]::IsNullOrWhiteSpace($model)
    Endpoint = "http://${cpaHost}:${port}/api/provider/codex/v1"
    ApiKey = $apiKey
    Model = $model
    Source = $candidatePath
  }
}

$endpoint = Get-FirstEnvironmentValue @(
  "PARTY_GAMES_LLM_ENDPOINT",
  "OPENAI_BASE_URL",
  "OPENAI_API_BASE",
  "OPENAI_ENDPOINT",
  "CODEX_LLM_ENDPOINT",
  "CODEX_OPENAI_BASE_URL"
)
$apiKey = Get-FirstEnvironmentValue @(
  "PARTY_GAMES_LLM_API_KEY",
  "OPENAI_API_KEY",
  "CODEX_LLM_API_KEY",
  "CODEX_OPENAI_API_KEY"
)
$model = Get-FirstEnvironmentValue @(
  "PARTY_GAMES_LLM_MODEL",
  "OPENAI_MODEL",
  "CODEX_LLM_MODEL",
  "CODEX_MODEL",
  "CODEX_OPENAI_MODEL"
)
$storyModel = Get-FirstEnvironmentValue @(
  "PARTY_GAMES_LLM_STORY_MODEL",
  "OPENAI_STORY_MODEL",
  "CODEX_LLM_STORY_MODEL"
)
$judgeModel = Get-FirstEnvironmentValue @(
  "PARTY_GAMES_LLM_JUDGE_MODEL",
  "OPENAI_JUDGE_MODEL",
  "CODEX_LLM_JUDGE_MODEL"
)

if ([string]::IsNullOrWhiteSpace($endpoint.Value) -and $apiKey.Name -eq "OPENAI_API_KEY") {
  $endpoint = [PSCustomObject]@{
    Name = "default-openai-endpoint"
    Value = "https://api.openai.com/v1"
  }
}

$localCpa = Get-LocalCpaConfig $CpaConfigPath $CpaModel
if (
  $localCpa.Ready -and
  [string]::IsNullOrWhiteSpace($endpoint.Value) -and
  [string]::IsNullOrWhiteSpace($apiKey.Value) -and
  [string]::IsNullOrWhiteSpace($model.Value)
) {
  $endpoint = [PSCustomObject]@{
    Name = "local-cpa"
    Value = $localCpa.Endpoint
  }
  $apiKey = [PSCustomObject]@{
    Name = "local-cpa-api-keys"
    Value = $localCpa.ApiKey
  }
  $model = [PSCustomObject]@{
    Name = "local-cpa-model"
    Value = $localCpa.Model
  }
  if ([string]::IsNullOrWhiteSpace($storyModel.Value)) {
    $storyModel = [PSCustomObject]@{
      Name = "local-cpa-model"
      Value = $localCpa.Model
    }
  }
  if ([string]::IsNullOrWhiteSpace($judgeModel.Value)) {
    $judgeModel = [PSCustomObject]@{
      Name = "local-cpa-model"
      Value = $localCpa.Model
    }
  }
}

Set-EnvironmentIfMissing "PARTY_GAMES_LLM_ENDPOINT" $endpoint.Value
Set-EnvironmentIfMissing "PARTY_GAMES_LLM_API_KEY" $apiKey.Value
Set-EnvironmentIfMissing "PARTY_GAMES_LLM_MODEL" $model.Value
Set-EnvironmentIfMissing "PARTY_GAMES_LLM_STORY_MODEL" $storyModel.Value
Set-EnvironmentIfMissing "PARTY_GAMES_LLM_JUDGE_MODEL" $judgeModel.Value
Set-EnvironmentIfMissing "PARTY_GAMES_LLM_TIMEOUT_MS" ([string]$LlmTimeoutMs)

$effectiveEndpoint = [Environment]::GetEnvironmentVariable("PARTY_GAMES_LLM_ENDPOINT", "Process")
$effectiveApiKey = [Environment]::GetEnvironmentVariable("PARTY_GAMES_LLM_API_KEY", "Process")
$effectiveModel = [Environment]::GetEnvironmentVariable("PARTY_GAMES_LLM_MODEL", "Process")
$effectiveStoryModel = [Environment]::GetEnvironmentVariable("PARTY_GAMES_LLM_STORY_MODEL", "Process")
$effectiveJudgeModel = [Environment]::GetEnvironmentVariable("PARTY_GAMES_LLM_JUDGE_MODEL", "Process")
$effectiveTimeoutMs = [Environment]::GetEnvironmentVariable("PARTY_GAMES_LLM_TIMEOUT_MS", "Process")
$llmReady = -not [string]::IsNullOrWhiteSpace($effectiveEndpoint) -and
  -not [string]::IsNullOrWhiteSpace($effectiveApiKey) -and
  -not [string]::IsNullOrWhiteSpace($effectiveModel)

if ($llmReady) {
  [Environment]::SetEnvironmentVariable("PARTY_GAMES_LLM_ENABLED", "true", "Process")
}

if ([string]::IsNullOrWhiteSpace($DatabasePath)) {
  $dataPath = Join-Path $projectRoot "data"
  New-Item -ItemType Directory -Force -Path $dataPath | Out-Null
  $DatabasePath = Join-Path $dataPath "party-games-local-llm.sqlite"
}

[Environment]::SetEnvironmentVariable("PORT", [string]$Port, "Process")
[Environment]::SetEnvironmentVariable("HOST", $HostName, "Process")
[Environment]::SetEnvironmentVariable("DATABASE_PATH", $DatabasePath, "Process")

if ($Build) {
  & pnpm build
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$serverDist = Join-Path $projectRoot "apps/server/dist/index.js"
$webDist = Join-Path $projectRoot "apps/web/dist/index.html"
if (-not (Test-Path -LiteralPath $serverDist) -or -not (Test-Path -LiteralPath $webDist)) {
  throw "Build output is missing. Run 'pnpm build' first, or pass -Build."
}

[PSCustomObject]@{
  Url = "http://${HostName}:${Port}"
  DatabasePath = $DatabasePath
  LlmReady = $llmReady
  Endpoint = if ($effectiveEndpoint) { $effectiveEndpoint } else { "<missing>" }
  EndpointSource = if ($endpoint.Name) { $endpoint.Name } else { "<missing>" }
  Model = if ($effectiveModel) { $effectiveModel } else { "<missing>" }
  ModelSource = if ($model.Name) { $model.Name } else { "<missing>" }
  StoryModel = if ($effectiveStoryModel) { $effectiveStoryModel } else { "<model fallback>" }
  JudgeModel = if ($effectiveJudgeModel) { $effectiveJudgeModel } else { "<model fallback>" }
  TimeoutMs = if ($effectiveTimeoutMs) { $effectiveTimeoutMs } else { "<missing>" }
  ApiKey = if ($effectiveApiKey) { "<set>" } else { "<missing>" }
  ApiKeySource = if ($apiKey.Name) { $apiKey.Name } else { "<missing>" }
} | Format-List

if (-not $llmReady) {
  Write-Warning "LLM config is incomplete; turtle soup will use local fallback until endpoint, model, and API key are provided."
}

& pnpm --filter "@party-games/server" start
