# F3-C verification helper — isolate the p7t3-descendant-drain scratch
# collision (a pre-existing hygiene gap: that suite destroys its worlds at
# TOP LEVEL, not in finally blocks, so one interrupted/failed evaluation
# leaves a partial scratch dir that breaks the next run of the same
# deterministic basename). This script:
#   1. deletes the stale p7t3-* scratch dirs (gitignored test scratch);
#   2. runs p7t3-descendant-drain.test.ts in isolation (fresh scratch);
#   3. reports the leftover scratch state after a PASSING run
#      (proves a green run leaves no stale dir behind).
# Usage: from the worktree root:  & 'dev/.../p7t3-verify.ps1'
param(
  [string]$Runner = 'dev/agent-workflow/evidence/F3-F11-F9-T1.4-repair/f3c/run-file.mjs'
)
$scratchBase = Join-Path (Get-Location) 'packages/testkit/test/.tmp-fault'
Write-Host '--- stale scratch dirs before:'
Get-ChildItem $scratchBase -ErrorAction SilentlyContinue | ForEach-Object { Write-Host ('  ' + $_.Name) }
Get-ChildItem $scratchBase -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'p7t3-*' } | ForEach-Object {
  Remove-Item $_.FullName -Recurse -Force
}
Write-Host '--- run p7t3-descendant-drain (fresh scratch):'
& node (Join-Path (Get-Location) $Runner) (Join-Path (Get-Location) 'packages/runtime/test/p7t3-descendant-drain.test.ts') 2>&1 | ForEach-Object { Write-Host $_ }
Write-Host ("run exit: " + $LASTEXITCODE)
Write-Host '--- leftover scratch dirs after the run:'
Get-ChildItem $scratchBase -ErrorAction SilentlyContinue | ForEach-Object { Write-Host ('  ' + $_.Name) }
exit 0
