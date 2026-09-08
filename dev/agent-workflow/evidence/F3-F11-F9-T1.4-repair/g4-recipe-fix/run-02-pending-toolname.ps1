# run-02-pending-toolname.ps1 — pre-state check of the NEW toolName filter.
#
# Driver for run-02-wrapper.mjs, which spawns f9-check.mjs with an exact
# argv array (PowerShell native-argument passing would strip the JSON quotes).
# The scan is a durable, READ-ONLY pass over
# <DSH_HOME>/storages/team_domain.json (the persistent residual world of the
# main checkout, tests/mock/.dsh-home-repair-r1); zero world mutation.
#
# Expected PRE-LIVE state (the re-run has not delivered the new request yet):
#   exactly 0 matches -> f9-check prints the no-match error (now naming
#   toolName + b6-req.md) and exits 2.
# This proves the discriminator is empty before the live round: no residual
# pending request carries a toolName, so the filter cannot select a stale one.
$ErrorActionPreference = 'Continue'

$wrapper = Join-Path $PSScriptRoot 'run-02-wrapper.mjs'
New-Item -ItemType Directory -Force -Path (Join-Path $PSScriptRoot 'scratch') | Out-Null
$buf = & node $wrapper 2>&1 | ForEach-Object { $_.ToString() }
$code = $LASTEXITCODE

$capture = Join-Path $PSScriptRoot '02-pending-prestate-toolname.txt'
Set-Content -Path $capture -Value ($buf -join "`n") -Encoding utf8
Add-Content -Path $capture -Value "EXIT_CODE=$code (expected 2 pre-live: zero pending requests carry toolName=write)" -Encoding utf8
Write-Host "captured -> $capture"
exit $code
