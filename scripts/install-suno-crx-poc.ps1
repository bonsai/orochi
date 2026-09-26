[CmdletBinding()]
param(
  [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot),
  [switch]$InstallDeno,
  [switch]$RunTests,
  [switch]$StartRuntime
)

$ErrorActionPreference = "Stop"

function Stop-WithMessage([string]$Message) {
  Write-Error $Message
  exit 1
}

if ($env:OS -ne "Windows_NT") {
  Stop-WithMessage "このスクリプトはWindows PowerShell用です。Windows上で実行してください。"
}

$RepoRoot = (Resolve-Path $RepoRoot).Path
$DenoJson = Join-Path $RepoRoot "deno.json"
$Manifest = Join-Path $RepoRoot "crx\manifest.json"
if (!(Test-Path $DenoJson) -or !(Test-Path $Manifest)) {
  Stop-WithMessage "Orochiリポジトリを認識できません: $RepoRoot"
}

function Get-DenoCommand {
  $command = Get-Command deno -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  $candidate = Join-Path $env:USERPROFILE ".deno\bin\deno.exe"
  if (Test-Path $candidate) { return $candidate }
  return $null
}

$Deno = Get-DenoCommand
if (!$Deno -and $InstallDeno) {
  Write-Host "Denoを公式インストーラーからインストールします..."
  irm https://deno.land/install.ps1 | iex
  $denoBin = Join-Path $env:USERPROFILE ".deno\bin"
  if (Test-Path $denoBin) { $env:Path = "$denoBin;$env:Path" }
  $Deno = Get-DenoCommand
}
if (!$Deno) {
  Stop-WithMessage "Denoが見つかりません。再実行: .\scripts\install-suno-crx-poc.ps1 -InstallDeno"
}

Write-Host "[1/4] Deno: $(& $Deno --version | Select-Object -First 1)"
Write-Host "[2/4] TypeScriptチェック"
& $Deno task check
if ($LASTEXITCODE -ne 0) { Stop-WithMessage "Deno checkに失敗しました。" }

if ($RunTests) {
  Write-Host "[3/4] Denoテスト"
  & $Deno task test
  if ($LASTEXITCODE -ne 0) { Stop-WithMessage "Deno testに失敗しました。" }
} else {
  Write-Host "[3/4] Denoテスト: 未実行（実行する場合は -RunTests）"
}

$chromeCandidates = @(
  (Join-Path ${env:ProgramFiles} "Google\Chrome\Application\chrome.exe"),
  (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
  (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe")
)
$chrome = $chromeCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
Write-Host "[4/4] CRX: $Manifest"
if ($chrome) {
  Write-Host "Chrome: $chrome"
} else {
  Write-Warning "Chromeの実行ファイルを自動検出できませんでした。"
}

Write-Host ""
Write-Host "Chromeで chrome://extensions を開き、Developer mode → Load unpacked → 次を選択してください:"
Write-Host (Join-Path $RepoRoot "crx")
Write-Host ""
Write-Host "POC実行コマンド:"
Write-Host "  deno task dev"
Write-Host "  deno task cli session open https://github.com/bonsai/orochi suno"
Write-Host "  deno task cli browser open <session-id> https://suno.com/create"
Write-Host "  deno task cli suno gen auto <session-id>"
Write-Host "  deno task cli debug logs"
Write-Host ""
Write-Host "注意: suno gen autoはダミーpromptを入力するだけで、Generate/Createはクリックしません。"

if ($StartRuntime) {
  Write-Host "runtimeを起動します。"
  Start-Process -FilePath $Deno -ArgumentList @("task", "dev") -WorkingDirectory $RepoRoot
}
