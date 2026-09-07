# T14-H focused non-regression sweep (repair-r1).
#
# Runs the T14-H suite plus every suite that drives the two changed
# surfaces (the S6 remote ports/dispatcher — s6-remote.ts — and the
# production root assembly — root.ts —) plus the compatibility/admission
# suites (the gate parity half of the contract). Per-file plain-node
# runner (vitest cannot boot in the spawn-restricted sandbox — see
# f3/run-file.mjs header).
#
# Usage: pwsh -NoProfile -File focused-sweep.ps1 > focused.txt

$ErrorActionPreference = 'Continue'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..\..')).Path
$runner = Join-Path $PSScriptRoot 'run-file.mjs'

$files = @(
  't14h-probe-merge',
  'tcm-g1-s6-integration',
  'tcm-m1-s6-v2-routing',
  'tcm-m2-workspace-attach',
  'tcm-m3-root-initial-work',
  'p8s7r1-initial-work',
  'p8s7r1-create-params',
  'p8s6-pagination',
  'p8s6-principal',
  'p8s6-projection',
  'p8s6-push-reconnect',
  'p8s6-remote-commands',
  't12h4-s6-fail-closed',
  't12b4-principal-context',
  'p8s5a-production-assembly',
  'p8s5a-host-loadability',
  'p8s3-work-chain',
  'p8s3-work-request',
  'p8s3b-result-effects',
  'p8s5b-operation-fencing',
  'p7t1-ack-fingerprint',
  'p7t1-cold-resume',
  'p7t1-inflight-drift',
  'p7t1-probe-generation',
  'f3a-lock-scope',
  'f3b-root-initial-work-lock-scope',
  'f3c-messaging-sibling',
  'rmr-create-or-open-boot',
  'rmr-remote-mount-race'
)

$args = @()
foreach ($name in $files) {
  $args += Join-Path $repoRoot "packages\runtime\test\$name.test.ts"
}

Set-Location $repoRoot
node $runner @args
Write-Host "focused-sweep exit=$LASTEXITCODE"
exit $LASTEXITCODE
