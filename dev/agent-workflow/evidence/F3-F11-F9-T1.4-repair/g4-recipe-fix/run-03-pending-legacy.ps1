# run-03-pending-legacy.ps1 — pre-state check of the LEGACY G4 filter (pre-fix behavior).
#
# Driver for run-03-wrapper.mjs, which spawns f9-check.mjs with an exact
# argv array (PowerShell native-argument passing would strip the JSON quotes).
# Runs the REAL phasePending against the same persistent residual world with
# the committed G4 recipe's filter {kind, target, action} — exactly what the
# old recipe would have passed. Shows the ambiguity the fix resolves:
# every residual pending request is leader-approval / W1 / actionName=write
# and NONE carries a toolName, so the legacy selection (first by sequence)
# again lands on a toolName-less request (seq 5, v2-l2) — the same failure
# class as r2 (where it landed on seq 4, v2-l1).
#
# Expected: exit 0, 3 matches (seq 5/6/14), chosen = seq 5; the vars file is
# written to the local scratch dir (NOT the shared state dir).
$ErrorActionPreference = 'Continue'

$wrapper = Join-Path $PSScriptRoot 'run-03-wrapper.mjs'
New-Item -ItemType Directory -Force -Path (Join-Path $PSScriptRoot 'scratch') | Out-Null
$buf = & node $wrapper 2>&1 | ForEach-Object { $_.ToString() }
$code = $LASTEXITCODE

$capture = Join-Path $PSScriptRoot '03-pending-prestate-legacy.txt'
Set-Content -Path $capture -Value ($buf -join "`n") -Encoding utf8
Add-Content -Path $capture -Value "EXIT_CODE=$code (expected 0: legacy filter still matches the toolName-less residuals; chosen = first by sequence)" -Encoding utf8
Write-Host "captured -> $capture"
exit $code
