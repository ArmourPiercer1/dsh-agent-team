# run-01-selftest.ps1 — deterministic preflight: f9-check.mjs offline selftest.
#
# Runs the 23-check pure-function selftest (no host, no boot state, no world).
# Proves the f9-check.mjs edit breaks no pure check.
# Expected: 23 PASS, 0 FAIL, exit 0.
#
# Path convention: this script lives in
#   <worktree>/dev/agent-workflow/evidence/F3-F11-F9-T1.4-repair/g4-recipe-fix/
# so the worktree root is five levels up.
$ErrorActionPreference = 'Continue'

$root = $PSScriptRoot
foreach ($i in 1..5) { $root = Split-Path -Parent $root }
$f9 = Join-Path $root 'tests/mock/scripts/f9-check.mjs'

$buf = & node $f9 selftest 2>&1 | ForEach-Object { $_.ToString() }
$code = $LASTEXITCODE

$out = Join-Path $PSScriptRoot '01-selftest.txt'
Set-Content -Path $out -Value ($buf -join "`n") -Encoding utf8
Add-Content -Path $out -Value "EXIT_CODE=$code" -Encoding utf8
Write-Host "captured -> $out"
exit $code
