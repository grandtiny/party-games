[CmdletBinding()]
param(
  [string]$Server = $env:PARTY_GAMES_DEPLOY_HOST,
  [string]$SshUser = $(if ($env:PARTY_GAMES_DEPLOY_USER) { $env:PARTY_GAMES_DEPLOY_USER } else { "ubuntu" }),
  [string]$SshKeyPath = $env:PARTY_GAMES_SSH_KEY,
  [string]$RemotePath = $(if ($env:PARTY_GAMES_REMOTE_PATH) { $env:PARTY_GAMES_REMOTE_PATH } else { "/opt/party-games" }),
  [string]$BaseCommit,
  [switch]$PrepareOnly,
  [switch]$SkipValidation
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path

function Invoke-Native {
  param(
    [Parameter(Mandatory)] [string]$FilePath,
    [Parameter(Mandatory)] [string[]]$ArgumentList,
    [string]$WorkingDirectory = $repoRoot
  )

  Push-Location -LiteralPath $WorkingDirectory
  try {
    & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) {
      throw "$FilePath exited with code $LASTEXITCODE"
    }
  }
  finally {
    Pop-Location
  }
}

function Get-NativeLines {
  param(
    [Parameter(Mandatory)] [string]$FilePath,
    [Parameter(Mandatory)] [string[]]$ArgumentList,
    [string]$WorkingDirectory = $repoRoot
  )

  Push-Location -LiteralPath $WorkingDirectory
  try {
    $output = & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) {
      throw "$FilePath exited with code $LASTEXITCODE"
    }
    return @($output)
  }
  finally {
    Pop-Location
  }
}

function Get-GitLine {
  param([Parameter(Mandatory)] [string[]]$ArgumentList)
  $lines = @(Get-NativeLines -FilePath "git" -ArgumentList $ArgumentList)
  if ($lines.Count -ne 1) {
    throw "Expected one git output line, got $($lines.Count)"
  }
  return [string]$lines[0]
}

function New-ObjectPack {
  param(
    [Parameter(Mandatory)] [string[]]$ObjectIds,
    [Parameter(Mandatory)] [string]$OutputPath
  )

  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = "git"
  $startInfo.WorkingDirectory = $repoRoot
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardInput = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  foreach ($argument in @(
      "-c", "safe.directory=$($repoRoot.Replace('\', '/'))",
      "pack-objects", "--stdout", "--no-reuse-delta", "--no-reuse-object", "--window=0"
    )) {
    [void]$startInfo.ArgumentList.Add($argument)
  }

  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  [void]$process.Start()
  $output = [System.IO.File]::Create($OutputPath)
  try {
    $copyTask = $process.StandardOutput.BaseStream.CopyToAsync($output)
    $errorTask = $process.StandardError.ReadToEndAsync()
    foreach ($objectId in $ObjectIds) {
      $process.StandardInput.WriteLine($objectId)
    }
    $process.StandardInput.Close()
    [void]$copyTask.GetAwaiter().GetResult()
    $process.WaitForExit()
    $errorText = $errorTask.GetAwaiter().GetResult()
    if ($process.ExitCode -ne 0) {
      throw "git pack-objects failed: $errorText"
    }
  }
  finally {
    $output.Dispose()
    $process.Dispose()
  }
}

function Test-ReleasePatch {
  param(
    [Parameter(Mandatory)] [string]$OldCommit,
    [Parameter(Mandatory)] [string]$NewCommit,
    [Parameter(Mandatory)] [string]$PatchPath,
    [Parameter(Mandatory)] [string]$TemporaryIndex
  )

  $previousIndex = $env:GIT_INDEX_FILE
  try {
    $env:GIT_INDEX_FILE = $TemporaryIndex
    Invoke-Native -FilePath "git" -ArgumentList @("read-tree", $OldCommit)
    Invoke-Native -FilePath "git" -ArgumentList @("apply", "--check", "--cached", $PatchPath)
    Invoke-Native -FilePath "git" -ArgumentList @("apply", "--cached", $PatchPath)
    $actualTree = Get-GitLine -ArgumentList @("write-tree")
    $expectedTree = Get-GitLine -ArgumentList @("rev-parse", "$NewCommit`^{tree}")
    if ($actualTree -ne $expectedTree) {
      throw "Release patch tree $actualTree does not match $expectedTree"
    }
  }
  finally {
    if ($null -eq $previousIndex) {
      Remove-Item Env:GIT_INDEX_FILE -ErrorAction SilentlyContinue
    }
    else {
      $env:GIT_INDEX_FILE = $previousIndex
    }
  }
}

$branch = Get-GitLine -ArgumentList @("symbolic-ref", "--short", "HEAD")
$status = @(Get-NativeLines -FilePath "git" -ArgumentList @("status", "--short"))
if ($status.Count -ne 0) {
  throw "Working tree must be clean before preparing a release"
}

$newCommit = Get-GitLine -ArgumentList @("rev-parse", "HEAD")
if (-not $PrepareOnly) {
  if ($branch -ne "main") {
    throw "Deployments must run from main; current branch is $branch"
  }
  $originMain = Get-GitLine -ArgumentList @("rev-parse", "origin/main")
  if ($originMain -ne $newCommit) {
    throw "HEAD must be pushed to origin/main before deployment"
  }
  if (-not $Server -or $Server -notmatch '^[A-Za-z0-9.:-]+$') {
    throw "Set PARTY_GAMES_DEPLOY_HOST or pass a valid -Server"
  }
  if ($SshUser -notmatch '^[A-Za-z0-9._-]+$') {
    throw "Invalid SSH user"
  }
  if (-not $SshKeyPath) {
    throw "Set PARTY_GAMES_SSH_KEY or pass -SshKeyPath"
  }
  $SshKeyPath = (Resolve-Path -LiteralPath $SshKeyPath).Path
  if ($RemotePath -notmatch '^/[A-Za-z0-9._/-]+$') {
    throw "Invalid remote path"
  }
  if (-not $BaseCommit) {
    $remoteTarget = "$SshUser@$Server"
    $remoteLines = @(Get-NativeLines -FilePath "ssh" -ArgumentList @(
      "-i", $SshKeyPath,
      "-o", "BatchMode=yes",
      "-o", "ConnectTimeout=10",
      $remoteTarget,
      "cd '$RemotePath' && git rev-parse HEAD"
    ))
    $matchingCommits = @($remoteLines | Where-Object { $_ -match '^[0-9a-f]{40}$' })
    $BaseCommit = $matchingCommits | Select-Object -Last 1
  }
}

if (-not $BaseCommit -or $BaseCommit -notmatch '^[0-9a-f]{40}$') {
  throw "Pass a full 40-character -BaseCommit when using -PrepareOnly"
}

Invoke-Native -FilePath "git" -ArgumentList @("merge-base", "--is-ancestor", $BaseCommit, $newCommit)
if ($BaseCommit -eq $newCommit) {
  Write-Host "Server already matches $newCommit"
  return
}

if (-not $SkipValidation) {
  $previousCi = $env:CI
  try {
    $env:CI = "true"
    Invoke-Native -FilePath "pnpm" -ArgumentList @("install", "--frozen-lockfile")
    Invoke-Native -FilePath "pnpm" -ArgumentList @("typecheck")
    Invoke-Native -FilePath "pnpm" -ArgumentList @("test")
    Invoke-Native -FilePath "pnpm" -ArgumentList @("build")
  }
  finally {
    if ($null -eq $previousCi) {
      Remove-Item Env:CI -ErrorAction SilentlyContinue
    }
    else {
      $env:CI = $previousCi
    }
  }
}

$shortCommit = $newCommit.Substring(0, 7)
$artifactRoot = Join-Path ([System.IO.Path]::GetTempPath()) "party-games-release-$shortCommit-$([guid]::NewGuid().ToString('N'))"
[void](New-Item -ItemType Directory -Path $artifactRoot)
$patchPath = Join-Path $artifactRoot "release.patch"
$reversePatchPath = Join-Path $artifactRoot "reverse.patch"
$objectsPath = Join-Path $artifactRoot "objects.pack"
$objectsIndexPath = Join-Path $artifactRoot "objects.idx"
$temporaryIndex = Join-Path $artifactRoot "validation.index"

Invoke-Native -FilePath "git" -ArgumentList @(
  "-c", "core.autocrlf=false",
  "diff", "--binary", "--full-index", "--no-color", "--no-ext-diff", "--no-renames",
  "--output=$patchPath", $BaseCommit, $newCommit, "--"
)
Invoke-Native -FilePath "git" -ArgumentList @(
  "-c", "core.autocrlf=false",
  "diff", "--binary", "--full-index", "--no-color", "--no-ext-diff", "--no-renames",
  "--output=$reversePatchPath", $newCommit, $BaseCommit, "--"
)

$objectIds = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
foreach ($line in Get-NativeLines -FilePath "git" -ArgumentList @(
    "rev-list", "--objects", "--no-object-names", $newCommit, "--not", $BaseCommit
  )) {
  if ($line -match '^[0-9a-f]{40}$') {
    [void]$objectIds.Add([string]$line)
  }
}

$changedPaths = @(Get-NativeLines -FilePath "git" -ArgumentList @(
  "-c", "core.quotepath=false",
  "diff", "--name-only", "--no-renames", "--diff-filter=ACMRTD", $BaseCommit, $newCommit, "--"
))
foreach ($path in $changedPaths) {
  $oldObject = & git -C $repoRoot rev-parse --verify "$BaseCommit`:$path" 2>$null
  if ($LASTEXITCODE -eq 0 -and $oldObject -match '^[0-9a-f]{40}$') {
    [void]$objectIds.Add([string]$oldObject)
  }
}

New-ObjectPack -ObjectIds @($objectIds) -OutputPath $objectsPath
Invoke-Native -FilePath "git" -ArgumentList @(
  "index-pack", "--index-version=2", "-o", $objectsIndexPath, $objectsPath
)
Test-ReleasePatch -OldCommit $BaseCommit -NewCommit $newCommit -PatchPath $patchPath -TemporaryIndex $temporaryIndex

$artifactBytes = (Get-Item -LiteralPath $patchPath, $reversePatchPath, $objectsPath | Measure-Object Length -Sum).Sum
Write-Host "Prepared release $BaseCommit -> $newCommit"
Write-Host "Changed paths: $($changedPaths.Count)"
Write-Host "Transfer payload: $artifactBytes bytes"
Write-Host "Artifacts: $artifactRoot"

if ($PrepareOnly) {
  return
}

$remoteTarget = "$SshUser@$Server"
$remoteRelease = "/tmp/party-games-release-$shortCommit-$([DateTimeOffset]::Now.ToUnixTimeSeconds())"
$sshBase = @("-i", $SshKeyPath, "-o", "BatchMode=yes", "-o", "ConnectTimeout=10")
Invoke-Native -FilePath "ssh" -ArgumentList @($sshBase + @($remoteTarget, "mkdir '$remoteRelease'"))
Invoke-Native -FilePath "scp" -ArgumentList @($sshBase + @(
  $patchPath,
  $reversePatchPath,
  $objectsPath,
  (Join-Path $PSScriptRoot "deploy-server.sh"),
  "$remoteTarget`:$remoteRelease/"
))
Invoke-Native -FilePath "ssh" -ArgumentList @($sshBase + @(
  $remoteTarget,
  "bash '$remoteRelease/deploy-server.sh' '$RemotePath' '$BaseCommit' '$newCommit' '$remoteRelease'"
))
