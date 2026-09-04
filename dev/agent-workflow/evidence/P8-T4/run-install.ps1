$ErrorActionPreference = 'Continue'
# worktree root = 3 parents up from this evidence dir (dev/agent-workflow/evidence/P8-T4)
$root = $PSScriptRoot
$root = Split-Path $root -Parent   # evidence
$root = Split-Path $root -Parent   # agent-workflow
$root = Split-Path $root -Parent   # dev
$root = Split-Path $root -Parent   # worktree root
Set-Location $root
$log = Join-Path $PSScriptRoot 'install.log'
$out = @()
$out += '=== P8-T4 install.log ==='
$out += 'ts: ' + (Get-Date).ToString('o')
$out += 'cmd: pnpm install --ignore-scripts'
$out += 'worktree: ' + (git rev-parse --show-toplevel)
$out += 'head: ' + (git rev-parse HEAD)
$out += '--- git status --porcelain ---'
$out += (git status --porcelain)
$out += '----------------------------------------'
$out += (pnpm install --ignore-scripts 2>&1 | ForEach-Object { "$_" })
$out += "exit: $LASTEXITCODE"
$out | Out-File -Encoding utf8 $log
Write-Host "install done, exit $LASTEXITCODE, log lines: $($out.Count)"
