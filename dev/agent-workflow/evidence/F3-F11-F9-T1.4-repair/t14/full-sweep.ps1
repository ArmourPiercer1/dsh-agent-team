# T14-H evidence runner — full runtime package sweep, ONE PROCESS PER
# TEST FILE (the d5-instance-contract top-level crash kills any
# single-process run — same house rule as F3-C's full-sweep.ps1).
#
# Usage:  pwsh -File full-sweep.ps1 [-Out <path>]
#         (run from the worktree root; uses t14/run-file.mjs)
# Exit:   always 0 (the per-file PASS/FAIL + SUMMARY lines are the data;
#         they land in the -Out file for the gate).
param(
  [string]$Out = 'dev/agent-workflow/evidence/F3-F11-F9-T1.4-repair/t14/postimpl-full-runtime.txt'
)
$runner = Join-Path (Get-Location) 'dev/agent-workflow/evidence/F3-F11-F9-T1.4-repair/t14/run-file.mjs'
$outPath = Join-Path (Get-Location) $Out
if (Test-Path $outPath) { Remove-Item $outPath }
$files = Get-ChildItem 'packages/runtime/test/*.test.ts' | Sort-Object Name | ForEach-Object { $_.FullName }
$ok = 0
$bad = @()
foreach ($f in $files) {
  $line = & node $runner $f 2>&1 | Out-String
  Add-Content -LiteralPath $outPath -Value ($line.TrimEnd())
  if ($LASTEXITCODE -ne 0) { $bad += (Split-Path $f -Leaf) } else { $ok++ }
}
Add-Content -LiteralPath $outPath -Value ''
Add-Content -LiteralPath $outPath -Value ("SUMMARY: files=" + $files.Count + " ok=" + $ok + " bad=" + $bad.Count)
Add-Content -LiteralPath $outPath -Value ("BAD: " + ($bad -join ', '))
Write-Host ("DONE ok=" + $ok + " bad=" + $bad.Count)
