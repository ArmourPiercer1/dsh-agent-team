param([string]$W)
$log = Join-Path $W 'dev/agent-workflow/evidence/G7-REVIEW/reviewer-2/boundary-checks.log'
$out = @()
$out += '--- [3e] tsc no-op guard: --listFilesOnly .ts input file counts ---'
foreach ($pkg in @('contracts','domain','storage','runtime','testkit')) {
  $files = & node (Join-Path $W 'node_modules/typescript/bin/tsc') '-p' (Join-Path $W "packages/$pkg/tsconfig.json") '--listFilesOnly' 2>$null
  $n = @($files | Where-Object { $_ -match '\.ts$' }).Count
  $out += "packages/$pkg : $n .ts input files"
}
$out += ''
$out += '--- [4] private-import: references to upstream / frozen legacy fork in packages/**/*.ts ---'
$pi = git -C $W grep -n -E 'deepseek-harness|references/|upstream|legacy-agent-team' -- 'packages' 2>&1 | Where-Object { $_ -match '\.ts:' }
if ($pi) { $out += $pi } else { $out += '(none found)' }
$out += ''
$out += '--- [4c] imports escaping package root (3+ ../ levels) in packages/**/*.ts ---'
$esc = git -C $W grep -n -E '\.\./\.\./\.\./' -- 'packages' 2>&1 | Where-Object { $_ -match '\.ts:' }
if ($esc) { $out += $esc } else { $out += '(none found)' }
$out | Add-Content -Path $log
$out | Out-Host
