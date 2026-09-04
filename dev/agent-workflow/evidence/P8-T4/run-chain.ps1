param(
  [Parameter(Mandatory = $true)][string]$Label
)
$ErrorActionPreference = 'Continue'
# worktree root = 3 parents up from this evidence dir (dev/agent-workflow/evidence/P8-T4)
$root = $PSScriptRoot
$root = Split-Path $root -Parent   # evidence
$root = Split-Path $root -Parent   # agent-workflow
$root = Split-Path $root -Parent   # dev
$root = Split-Path $root -Parent   # worktree root
Set-Location $root
$log = Join-Path $PSScriptRoot $Label
$out = @()
$out += "=== P8-T4 chain log: $Label ==="
$out += 'ts: ' + (Get-Date).ToString('o')
$out += 'worktree: ' + (git rev-parse --show-toplevel)
$out += 'head: ' + (git rev-parse HEAD)
$out += '--- git status --porcelain ---'
$out += (git status --porcelain)
$out += '========================================'
$out += ''
$out += '### node scripts/run-tests.mjs (all 9 packages)'
$tests = (node scripts/run-tests.mjs 2>&1 | ForEach-Object { "$_" })
$out += $tests
$out += "tests-exit: $LASTEXITCODE"
$out += ''
foreach ($pkg in @('contracts', 'domain', 'storage', 'runtime', 'testkit', 'remote')) {
  $out += "### tsc -p packages/$pkg/tsconfig.json"
  $tsc = (node (Join-Path $root 'node_modules/typescript/bin/tsc') "-p" "packages/$pkg/tsconfig.json" 2>&1 | ForEach-Object { "$_" })
  if ($tsc.Count -eq 0) { $out += '(no output)' } else { $out += $tsc }
  $out += "tsc-$pkg-exit: $LASTEXITCODE"
  $out += ''
}
$out += '=== end of log ==='
$out | Out-File -Encoding utf8 $log
$last = $out | Select-String 'exit:'
Write-Host "chain done: $Label"
$last | ForEach-Object { Write-Host $_.Line }
