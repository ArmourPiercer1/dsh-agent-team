# issue2-build-direct.ps1 — I2 (issue #2 permission repair) direct build chain.
#
# The workspace-write sandbox EPERMs piped-stdio spawns FROM node (the pnpm
# lifecycle: node -> pnpm -r -> tsc; also node -> node), so `pnpm run setup`
# cannot run here. pwsh -> node spawns are allowed. This script executes the
# SAME build the repo gates use, driven from pwsh:
#
#   1. per-package `tsc -p tsconfig.build.json` in dependency order
#      (contracts, domain, storage, tools, runtime, remote, client, legacy,
#       testkit) — the same invocations as `pnpm -r run build`;
#   2. the exact `pnpm run build:composition` chain:
#      node scripts/place-dist-glue.mjs
#      node scripts/build-client-composition.mjs packages/client packages/client/composition-shim
#      node scripts/check-artifacts-committed.mjs
#
# Usage: pwsh -File issue2-build-direct.ps1
# Exit 0 = whole chain green (check-artifacts-committed is the last step; a
# dirty tree after the build fails it).

param(
  [switch]$SkipTsc
)

$ErrorActionPreference = 'Stop'
$w = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..\..')).Path
$tsc = Join-Path $w 'node_modules\typescript\lib\tsc.js'
if (-not (Test-Path $tsc)) {
  Write-Error "issue2-build: tsc not found at $tsc (pnpm install --ignore-scripts first)"
  exit 2
}

$order = @('contracts', 'domain', 'storage', 'tools', 'runtime', 'remote', 'client', 'legacy', 'testkit')
if (-not $SkipTsc) {
  foreach ($pkg in $order) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    node $tsc -p (Join-Path $w "packages\$pkg\tsconfig.build.json")
    $code = $LASTEXITCODE
    $sw.Stop()
    Write-Host "[$pkg] tsc exit=$code ($([int]$sw.ElapsedMilliseconds)ms)"
    if ($code -ne 0) { Write-Error "issue2-build: tsc FAILED for $pkg (exit $code)"; exit 1 }
  }
}

$steps = @(
  @{ Name = 'place-dist-glue';            Args = @('scripts\place-dist-glue.mjs') },
  @{ Name = 'build-client-composition';   Args = @('scripts\build-client-composition.mjs', 'packages/client', 'packages/client/composition-shim') },
  @{ Name = 'check-artifacts-committed';  Args = @('scripts\check-artifacts-committed.mjs') }
)
foreach ($step in $steps) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $rest = @($step.Args | Select-Object -Skip 1)
  node (Join-Path $w ($step.Args[0])) @rest
  $code = $LASTEXITCODE
  $sw.Stop()
  Write-Host "[$($step.Name)] exit=$code ($([int]$sw.ElapsedMilliseconds)ms)"
  if ($code -ne 0) { Write-Error "issue2-build: $($step.Name) FAILED (exit $code)"; exit 1 }
}

Write-Host 'ISSUE2-BUILD-OK'
exit 0
