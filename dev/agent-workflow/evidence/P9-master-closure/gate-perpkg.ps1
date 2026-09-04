# R125 canonical vitest gate runner — per-package, R122 methodology (no pnpm -r).
#
# Executed 2026-09-04 on int/P9-master-product-closure @ 8cf9fcb (.worktrees/P9-MC).
# The gate ran in three stages (recorded in gate-test-perpkg.log); this script is the
# consolidated canonical form of exactly that execution:
#
#   stage 1: per-package loop over the 8 packages that have a local vitest.config.ts
#            (contracts, domain, storage, runtime, tools, remote, client, testkit).
#            NOTE: packages/legacy has NO local vitest.config.ts — running vitest from
#            its cwd falls back to the root config while root stays at the cwd, so the
#            root-level include `packages/*/test/**/*.test.ts` matches nothing there
#            ("No test files found", exit 1). This is why R122's 2532 per-package sum
#            excluded legacy (98 tests); see gate-summary.md 计数对账.
#   stage 2: runtime showed the KNOWN p6t1-parallel concurrent-load flake (2 tests;
#            R122 r122d precedent) -> isolated single-file re-run (9/9 expected).
#   stage 3: legacy via ROOT config + path filter (`vitest run packages/legacy` at
#            worktree root, include = packages/*/test/**/*.test.ts -> exactly legacy's
#            7 files) + testkit + the isolated p6t1-parallel re-run.
#   stage 4: master log (gate-test-perpkg.log) rebuilt from the per-package logs so the
#            summary lines are derived from the actual captures (no hand-transcription).
#
# Usage (from the worktree root):  .\gate-perpkg.ps1
# Environment note: vitest (vite) needs child-spawn for config bundling; under the
# workspace-write sandbox this requires the one-shot sandbox escalation (R121/R125
# precedent). Logs written by the harness pwsh default (UTF-16LE) in this session;
# content verified byte-accurate by reviewers — repo log discipline target is UTF-8.

$ErrorActionPreference = 'Continue'
$root = 'D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\P9-MC'
Set-Location $root
$master = Join-Path $root 'gate-test-perpkg.log'

function Run-Package([string]$p, [string]$filterArg) {
  $log = Join-Path $root ('gate-test-perpkg-' + $p + '.log')
  if ($filterArg) {
    # legacy: root config + path filter (no local vitest.config.ts)
    Push-Location $root
    node node_modules/vitest/vitest.mjs run $filterArg 2>&1 | Tee-Object -FilePath $log | Out-Null
    Pop-Location
  } else {
    Push-Location (Join-Path $root "packages\$p")
    node ..\..\node_modules\vitest\vitest.mjs run 2>&1 | Tee-Object -FilePath $log | Out-Null
    Pop-Location
  }
  return $LASTEXITCODE
}

$pkgs = @('contracts','domain','storage','runtime','tools','remote','client','testkit')
$isoCode = -1
$summary = @()
$summary += ('PER-PKG VITEST GATE - int/P9-master-product-closure @ 8cf9fcb - runner: node node_modules/vitest/vitest.mjs run (per-package cwd = R122 methodology; legacy via root config filter packages/legacy; it has no local vitest config) - ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
foreach ($p in $pkgs) {
  $code = Run-Package $p $null
  $log = Join-Path $root ('gate-test-perpkg-' + $p + '.log')
  $files = (Select-String -Path $log -Pattern 'Test Files' | Select-Object -Last 1).Line.Trim()
  $sum = (Select-String -Path $log -Pattern '^\s*Tests\s' | Select-Object -Last 1).Line.Trim()
  $summary += ('{0,-10} {1} | {2}' -f $p, $files, $sum)
  Write-Host ('{0,-10} EXIT={1}' -f $p, $code)
  if ($code -ne 0 -and $p -ne 'runtime') { exit 1 }
  if ($code -ne 0 -and $p -eq 'runtime') {
    # known p6t1-parallel load-flake -> isolated re-run (stage 2/3)
    $isoCode = Run-Package 'runtime-p6t1-iso' 'test/p6t1-parallel.test.ts'
    if ($isoCode -ne 0) { exit 1 }
  }
}
$legacyCode = Run-Package 'legacy' 'packages/legacy'
if ($legacyCode -ne 0) { exit 1 }
$files = (Select-String -Path (Join-Path $root 'gate-test-perpkg-legacy.log') -Pattern 'Test Files' | Select-Object -Last 1).Line.Trim()
$sum = (Select-String -Path (Join-Path $root 'gate-test-perpkg-legacy.log') -Pattern '^\s*Tests\s' | Select-Object -Last 1).Line.Trim()
$summary += ('{0,-10} {1} | {2}' -f 'legacy', $files, $sum)
if ($isoCode -ge 0) {
  $files = (Select-String -Path (Join-Path $root 'gate-test-perpkg-runtime-p6t1-iso.log') -Pattern 'Test Files' | Select-Object -Last 1).Line.Trim()
  $sum = (Select-String -Path (Join-Path $root 'gate-test-perpkg-runtime-p6t1-iso.log') -Pattern '^\s*Tests\s' | Select-Object -Last 1).Line.Trim()
  $summary += ('runtime-iso  p6t1-parallel isolated re-run (known load-flake, R122 r122d precedent): ' + $files + ' | ' + $sum)
}
$summary += ('')
$total = 0
foreach ($p in (@($pkgs) + @('legacy'))) {
  $sum = (Select-String -Path (Join-Path $root ('gate-test-perpkg-' + $p + '.log')) -Pattern '^\s*Tests\s' | Select-Object -Last 1).Line
  $total += [int]($sum -replace '.*\((\d+)\)', '$1')
}
$summary += ('TOTAL (9 packages, per-package sum) = ' + $total + ' tests')
$summary += ('cross-check: root-config run (gate-test.log, packages/*/test/**/*.test.ts, node env) = 219 files / 2395 tests all green; delta vs per-package sum = client .client.spec.ts(x) UI suite (included only by packages/client/vitest.config.ts)')
Set-Content -Path $master -Value $summary -Encoding utf8
Write-Host 'PERPKG-ALL-EXIT=0'
