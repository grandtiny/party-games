param(
  [int]$Port = 3000,
  [string]$HostName = "127.0.0.1",
  [string]$DatabasePath = "",
  [switch]$Build
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot

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

Set-EnvironmentIfMissing "PARTY_GAMES_LLM_ENDPOINT" $endpoint.Value
Set-EnvironmentIfMissing "PARTY_GAMES_LLM_API_KEY" $apiKey.Value
Set-EnvironmentIfMissing "PARTY_GAMES_LLM_MODEL" $model.Value
Set-EnvironmentIfMissing "PARTY_GAMES_LLM_STORY_MODEL" $storyModel.Value
Set-EnvironmentIfMissing "PARTY_GAMES_LLM_JUDGE_MODEL" $judgeModel.Value

$effectiveEndpoint = [Environment]::GetEnvironmentVariable("PARTY_GAMES_LLM_ENDPOINT", "Process")
$effectiveApiKey = [Environment]::GetEnvironmentVariable("PARTY_GAMES_LLM_API_KEY", "Process")
$effectiveModel = [Environment]::GetEnvironmentVariable("PARTY_GAMES_LLM_MODEL", "Process")
$effectiveStoryModel = [Environment]::GetEnvironmentVariable("PARTY_GAMES_LLM_STORY_MODEL", "Process")
$effectiveJudgeModel = [Environment]::GetEnvironmentVariable("PARTY_GAMES_LLM_JUDGE_MODEL", "Process")
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
  ApiKey = if ($effectiveApiKey) { "<set>" } else { "<missing>" }
  ApiKeySource = if ($apiKey.Name) { $apiKey.Name } else { "<missing>" }
} | Format-List

if (-not $llmReady) {
  Write-Warning "LLM config is incomplete; turtle soup will use local fallback until endpoint, model, and API key are provided."
}

& pnpm --filter "@party-games/server" start
