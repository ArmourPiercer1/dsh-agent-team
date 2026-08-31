$ErrorActionPreference = 'Stop'
$wt = 'D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\G8-R3'
$ev = "$wt\dev\agent-workflow\evidence\G8-REVIEW\reviewer-3"
$log = "$ev\boundary-checks.log"
$out = New-Object System.Collections.Generic.List[string]
$nodePattern = "from\s+['`"]node:|require\(['`"]node:|import\(['`"]node:"
$tsFiles = Get-ChildItem "$wt\packages" -Recurse -Filter *.ts -File | Where-Object { $_.FullName -notmatch 'node_modules|dist' }
$out.Add("== boundary checks ==")
$out.Add((Get-Date).ToString('o'))
$out.Add("toplevel=$(git -C $wt rev-parse --show-toplevel)")
$out.Add("HEAD=$(git -C $wt rev-parse HEAD)")
$out.Add("ts files scanned: $($tsFiles.Count)")
$out.Add("")
$out.Add("== A. zero-core: node: builtin imports in packages/**/*.ts (mjs/cjs excluded) ==")
$hits = $tsFiles | Select-String -Pattern $nodePattern
if ($hits) { $hits | ForEach-Object { $out.Add("HIT: $($_.Path):$($_.LineNumber): $($_.Line.Trim())") } } else { $out.Add("none (no node: imports in .ts under packages/)") }
$out.Add("")
$out.Add("== A2. zero-core: node: imports in .mjs/.cjs (excluded by rule, listed for the record) ==")
$msFiles = Get-ChildItem "$wt\packages" -Recurse -Include *.mjs,*.cjs -File | Where-Object { $_.FullName -notmatch 'node_modules|dist' }
$hitsA2 = $msFiles | Select-String -Pattern $nodePattern
if ($hitsA2) { $hitsA2 | ForEach-Object { $out.Add("EXCLUDED-HIT: $($_.Path):$($_.LineNumber)") } } else { $out.Add("none") }
$out.Add("")
$out.Add("== B. patch-package / pnpm patch / postinstall in package.json (excl node_modules) ==")
$pj = Get-ChildItem "$wt" -Recurse -Filter package.json -File | Where-Object { $_.FullName -notmatch 'node_modules' }
$foundB = $false
foreach ($f in $pj) {
  $c = Get-Content $f.FullName -Raw
  $rel = $f.FullName.Substring($wt.Length + 1)
  foreach ($pat in @('patch-package', 'pnpm patch', 'postinstall')) {
    if ($c.Contains($pat)) { $out.Add("HIT: $rel contains '$pat'"); $foundB = $true }
  }
}
if (-not $foundB) { $out.Add("none") }
$out.Add("")
$out.Add("== C. pnpm-lock.yaml diff vs 959e36358ee7244ff8c7e1e0b8396e70dfef4562 (P7 int tip) ==")
$ld = git -C $wt diff --stat 959e36358ee7244ff8c7e1e0b8396e70dfef4562..HEAD -- pnpm-lock.yaml
if ($ld) { $out.Add($ld) } else { $out.Add("(no diff)") }
$out.Add("")
$out.Add("== D. imports/refs of references/deepseek-harness-test-use from packages/* ==")
$hits2 = $tsFiles | Select-String -Pattern 'deepseek-harness-test-use'
if ($hits2) { $hits2 | ForEach-Object { $out.Add("HIT: $($_.Path):$($_.LineNumber)") } } else { $out.Add("none") }
$msRefs = $msFiles | Select-String -Pattern 'deepseek-harness-test-use'
if ($msRefs) { $msRefs | ForEach-Object { $out.Add("EXCLUDED-HIT(mjs): $($_.Path):$($_.LineNumber)") } }
$out.Add("")
$out.Add("== E. private-import: upstream internals / frozen legacy fork refs in packages/**/*.ts ==")
$privPattern = "deepseek-harness['`"/]|packages/team[/'`"]|references/deepseek-harness"
$hits3 = $tsFiles | Select-String -Pattern $privPattern
if ($hits3) { $hits3 | ForEach-Object { $out.Add("HIT: $($_.Path):$($_.LineNumber): $($_.Line.Trim())") } } else { $out.Add("none") }
$out.Add("")
$out.Add("== F. owned-boundary: git diff --name-only 959e36358ee7244ff8c7e1e0b8396e70dfef4562..HEAD -- packages/ ==")
$files = @(git -C $wt diff --name-only 959e36358ee7244ff8c7e1e0b8396e70dfef4562..HEAD -- packages/)
$files | ForEach-Object { $out.Add($_) }
$out.Add("(total files in diff: $($files.Count))")
$out.Add("")
$out.Add("== F2. classification against P8 owned globs (TaskDoc 11.9 + brief step 4) ==")
$owned = New-Object System.Collections.Generic.List[System.Management.Automation.ScriptBlock]
$owned.Add({ param($f) $f -match '^packages/contracts/src/projection/' })                       # T1
$owned.Add({ param($f) $f -eq 'packages/contracts/src/index.ts' })                             # T1 additive
$owned.Add({ param($f) $f -match '^packages/runtime/projection/' })                            # T2
$owned.Add({ param($f) $f -match '^packages/remote/src/contracts/' })                          # T3
$owned.Add({ param($f) $f -match '^packages/remote/src/handlers/' })                           # T3
$owned.Add({ param($f) $f -eq 'packages/remote/src/index.ts' })                                # T3 additive
$owned.Add({ param($f) $f -match '^packages/remote/test/p8t3-' })                              # T3
$owned.Add({ param($f) $f -match '^packages/remote/src/push/' })                               # T4
$owned.Add({ param($f) $f -match '^packages/remote/test/p8t4-' })                              # T4
$owned.Add({ param($f) $f -eq 'packages/remote/test/p8t3-negative.test.ts' })                  # T4 standing exception (layout pin 22->28)
$owned.Add({ param($f) $f -eq 'packages/testkit/test/p4t6-session-event-scan.test.ts' })       # DEC-1 standing exception
$violation = $false
foreach ($f in $files) {
  $ok = $false
  foreach ($m in $owned) { if (& $m $f) { $ok = $true; break } }
  if ($ok) { $out.Add("OK      $f") } else { $out.Add("VIOLATION $f"); $violation = $true }
}
$out.Add("")
if ($violation) { $obResult = 'FAIL (violations listed)' } else { $obResult = 'PASS (all diff files inside owned globs + standing exceptions)' }
$out.Add("owned-boundary result: $obResult")
$out | Set-Content $log
Write-Output ($out -join "`n")
