# T12 §13 re-validation at the final T12-int tip (post cherry-picks of 13 T12-V commits).
# Sanctioned chain only: node scripts/run-tests.mjs + node node_modules/typescript/bin/tsc -p ...
# (NEVER pnpm run/exec, vitest CLI, tsx, esbuild, vite.)
$ErrorActionPreference = 'Continue'
$int = 'D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\T12-int'
$ev  = 'D:\AgentDev\dsh-plugins\dsh-agent-team\dev\agent-workflow\evidence\T12'
Set-Location $int
$section = "$ev\t12-13b-section.log"
"=== T12 section 13b re-validation at tip $(git log --oneline -1 | Split-Path -Leaf) started $(Get-Date -Format s) ===" | Out-File $section -Encoding utf8

# 1. full test suite (once)
"--- [1/4] full run-tests.mjs" | Out-File $section -Append -Encoding utf8
$t0 = Get-Date
node scripts/run-tests.mjs 2>&1 | Out-File "$ev\t12-13b-full-tests.log" -Encoding utf8
$testsExit = $LASTEXITCODE
$tail = (Get-Content "$ev\t12-13b-full-tests.log" | Select-Object -Last 4) -join ' | '
"full-tests exit=$testsExit in $((Get-Date) - $t0)s tail: $tail" | Out-File $section -Append -Encoding utf8

# 2. tsc typecheck 8-set
"--- [2/4] tsc typecheck 8-set" | Out-File $section -Append -Encoding utf8
$pkgs = @('client','contracts','domain','remote','runtime','storage','testkit','tools')
$out = "T12 section 13b: tsc typecheck 8-set at $(Get-Date -Format s)`n"
$fail = 0
foreach ($p in $pkgs) {
  $r = & node node_modules/typescript/bin/tsc -p "packages/$p/tsconfig.json" 2>&1
  $code = $LASTEXITCODE
  if ($code -ne 0) { $fail++ }
  $out += "$p : exit $code`n"
  if ($code -ne 0) { $out += (($r | Select-Object -First 6) -join "`n") + "`n" }
}
$out += "DONE fail=$fail`n"
$out | Out-File "$ev\t12-13b-tsc-typecheck.log" -Encoding utf8
"typecheck fail=$fail" | Out-File $section -Append -Encoding utf8

# 3. tsc build 8-set
"--- [3/4] tsc build 8-set" | Out-File $section -Append -Encoding utf8
$out = "T12 section 13b: tsc build 8-set at $(Get-Date -Format s)`n"
$fail = 0
foreach ($p in $pkgs) {
  $r = & node node_modules/typescript/bin/tsc -p "packages/$p/tsconfig.build.json" 2>&1
  $code = $LASTEXITCODE
  if ($code -ne 0) { $fail++ }
  $out += "$p : exit $code`n"
  if ($code -ne 0) { $out += (($r | Select-Object -First 6) -join "`n") + "`n" }
}
$out += "DONE fail=$fail`n"
$out | Out-File "$ev\t12-13b-tsc-build.log" -Encoding utf8
"build fail=$fail (pre-existing tools TS6059 expected)" | Out-File $section -Append -Encoding utf8

# 4. composition-smoke (official, pre-existing stale-path fail expected) + corrected-path diag
"--- [4/4] composition-smoke official + corrected-path diag" | Out-File $section -Append -Encoding utf8
node scripts/composition-smoke.mjs 2>&1 | Out-File "$ev\t12-13b-composition-smoke.log" -Encoding utf8
$smokeExit = $LASTEXITCODE
"official composition-smoke exit=$smokeExit (pre-existing stale-path fail expected)" | Out-File $section -Append -Encoding utf8
node "$ev\t12-13-smoke-diag.mjs" $int 2>&1 | Out-File "$ev\t12-13b-smoke-diag.log" -Encoding utf8
$diagExit = $LASTEXITCODE
"corrected-path smoke-diag exit=$diagExit (PASS expected now that yaml dep is in the tip)" | Out-File $section -Append -Encoding utf8

"=== section 13b done $(Get-Date -Format s) ===" | Out-File $section -Append -Encoding utf8
Get-Content $section
