<#
.SYNOPSIS
  Guide the Suno CRX POC setup on Windows PowerShell.

.DESCRIPTION
  Run from the repository root. It:
    - Detects Deno (installs it with -InstallDeno)
    - Verifies crx/manifest.json and the crx/ directory, prints the Chrome
      "Load unpacked" path
    - Runs deno task check (exit code is propagated)
    - Runs deno task test when -RunTests is set (non-zero exit on failure)
    - Prints the POC commands
    - Starts the runtime when -StartRuntime is set

  Out of scope: song generation, mp3 download, mpv playback.

.NOTES
  Works when the repository lives on a UNC path (for example
  \\wsl.localhost\Ubuntu-24.04\home\<user>\orochi): native commands are run
  through `cmd /c pushd` so they get a real working directory.

.EXAMPLE
  .\scripts\install-suno-crx-poc.ps1 -InstallDeno -RunTests -StartRuntime
#>
[CmdletBinding()]
param(
    [switch]$InstallDeno,
    [switch]$RunTests,
    [switch]$StartRuntime,
    [string]$DenoTask = "dev"
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  OK  $msg" -ForegroundColor Green }
function Write-Note($msg) { Write-Host "  --  $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "  NG  $msg" -ForegroundColor Red; exit 1 }

# Repository root = parent of this script directory.
$RepoRoot = Split-Path -Parent $PSScriptRoot
Write-Step "Repo root: $RepoRoot"

# Run a command with the repository root as its working directory and
# return its exit code. Output is sent to the host so it is not mixed into
# the return value. A UNC path cannot be a process working directory, so use
# `cmd pushd`, which maps a temporary drive letter.
function Invoke-InRepo([string]$Command) {
    if ($RepoRoot.StartsWith("\\")) {
        cmd.exe /c "pushd `"$RepoRoot`" 2>nul && $Command" | Out-Host
    } else {
        Push-Location -LiteralPath $RepoRoot
        try { Invoke-Expression "$Command | Out-Host" } finally { Pop-Location }
    }
    return $LASTEXITCODE
}

$CrxDir   = Join-Path $RepoRoot "crx"
$Manifest = Join-Path $CrxDir "manifest.json"

# 1. Check the POC files.
Write-Step "Checking POC files"
if (-not (Test-Path -LiteralPath $CrxDir))   { Fail "crx/ not found: $CrxDir" }
if (-not (Test-Path -LiteralPath $Manifest)) { Fail "crx/manifest.json not found: $Manifest" }
if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot "deno.json"))) {
    Fail "deno.json not found (run this from the repository root)"
}
Write-Ok "crx/ and crx/manifest.json present"

# 2. Detect or install Deno.
Write-Step "Checking Deno"
$deno = Get-Command deno -ErrorAction SilentlyContinue
if (-not $deno) {
    if ($InstallDeno) {
        Write-Note "Deno not found. Installing."
        try {
            Invoke-Expression (Invoke-RestMethod https://deno.land/install.ps1)
        } catch {
            Fail "Deno install failed: $_"
        }
        $denoHome = Join-Path $env:USERPROFILE ".deno\bin"
        if (Test-Path -LiteralPath $denoHome) { $env:Path = "$denoHome;$env:Path" }
        $deno = Get-Command deno -ErrorAction SilentlyContinue
        if (-not $deno) { Fail "deno still not found after install. Open a new terminal and retry." }
    } else {
        Fail "deno not found. Re-run with -InstallDeno."
    }
}
$denoVersion = (& deno --version | Select-Object -First 1)
Write-Ok "deno: $denoVersion"

# 3. Chrome "Load unpacked" path.
Write-Step "Chrome extension (Load unpacked)"
Write-Host "  Open chrome://extensions, enable Developer mode," -ForegroundColor Gray
Write-Host "  click 'Load unpacked' and select:" -ForegroundColor Gray
Write-Host "    $CrxDir" -ForegroundColor White

# 4. deno task check.
Write-Step "deno task check"
$code = Invoke-InRepo "deno task check"
if ($code -ne 0) { Fail "deno task check failed (exit $code)" }
Write-Ok "check passed"

# 5. deno task test (optional).
if ($RunTests) {
    Write-Step "deno task test"
    $code = Invoke-InRepo "deno task test"
    if ($code -ne 0) { Fail "deno task test failed (exit $code)" }
    Write-Ok "test passed"
} else {
    Write-Note "tests skipped (use -RunTests)"
}

# 6. POC commands.
Write-Step "POC commands"
Write-Host "  # start the runtime (separate terminal)" -ForegroundColor Gray
Write-Host "  deno task dev" -ForegroundColor Gray
Write-Host "" -ForegroundColor Gray
Write-Host "  # open a Suno session (engine=suno)" -ForegroundColor Gray
Write-Host "  deno task cli -- session open https://suno.com/create suno" -ForegroundColor Gray
Write-Host "" -ForegroundColor Gray
Write-Host "  # inject a dummy prompt into /create via CRX (no Generate click)" -ForegroundColor Gray
Write-Host "  deno task cli -- suno gen auto <session-id>" -ForegroundColor Gray

# 7. Start runtime (optional).
if ($StartRuntime) {
    Write-Step "Starting runtime: deno task $DenoTask"
    $code = Invoke-InRepo "deno task $DenoTask"
    exit $code
}

Write-Step "Done"
