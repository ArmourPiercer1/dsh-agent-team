# G8-R1 brief SS4.3 chain: pnpm install + run-tests.mjs (all packages) + tsc x6
# Proof headers: git toplevel + HEAD written to chain-rerun.log first.
$w = 'D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\G8-R1'
$ev = Join-Path $w 'dev\agent-workflow\evidence\G8-REVIEW\reviewer-1'
$log = Join-Path $ev 'chain-rerun.log'
function W([string]$s) { Add-Content -Path $log -Value $s -Encoding utf8 }
Set-Content -Path $log -Value '=== G8-R1 chain rerun (brief SS4.3) ===' -Encoding utf8
W ('started: ' + (Get-Date -Format 'o'))
W ('proof: toplevel=' + (git -C $w rev-parse --show-toplevel).Trim())
W ('proof: head=' + (git -C $w rev-parse HEAD).Trim())

W '--- step A: pnpm install --ignore-scripts ---'
Push-Location $w
try {
  $inst = & pnpm install --ignore-scripts 2>&1
  foreach ($l in $inst) { W $l.ToString() }
  W ('install exit code: ' + $LASTEXITCODE)
  if ($LASTEXITCODE -ne 0) { W 'CHAIN ABORT: install failed'; exit 1 }

  W '--- step B: node scripts/run-tests.mjs (all 9 packages) ---'
  $tests = & node scripts/run-tests.mjs 2>&1
  foreach ($l in $tests) { W $l.ToString() }
  $testsExit = $LASTEXITCODE
  W ('run-tests exit code: ' + $testsExit)

  W '--- step C: tsc x6 (separate -p per package) ---'
  $tscBin = Join-Path $w 'node_modules\typescript\bin\tsc'
  foreach ($pkg in @('contracts', 'domain', 'storage', 'runtime', 'testkit', 'remote')) {
    $tscOut = & node $tscBin -p "packages/$pkg/tsconfig.json" 2>&1
    $tscExit = $LASTEXITCODE
    W ("tsc -p packages/$pkg/tsconfig.json -> exit $tscExit")
    foreach ($l in $tscOut) { W ('    ' + $l.ToString()) }
  }
} finally {
  Pop-Location
}
W ('finished: ' + (Get-Date -Format 'o'))
W 'CHAIN-DONE'
exit 0
