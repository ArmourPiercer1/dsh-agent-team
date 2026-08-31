param()
Set-Location D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/G7-1
$root = (Get-Location).Path
$ev = 'dev/agent-workflow/evidence/G7-REVIEW/reviewer-1'
$log = "$ev/boundary-checks.log"
function Add-Log($m) { Add-Content -Path $log -Value $m -Encoding utf8 }

$patNode = "from\s+['""]node:|require\(\s*['""]node:|import\(\s*['""]node:|import\s+type\b[^;]*['""]node:"
$patUp   = 'deepseek-harness|references/|deepseek-ai|@deepseek/'

Set-Content -Path $log -Value "=== G7-REVIEW reviewer-1 boundary checks (round R49) ===" -Encoding utf8
Add-Log ("(start) " + (Get-Date).ToString('o'))
Add-Log 'git rev-parse --show-toplevel:'
Add-Log (git rev-parse --show-toplevel)
Add-Log 'git rev-parse HEAD:'
Add-Log (git rev-parse HEAD)
Add-Log ''

Add-Log '########## 1. ZERO-CORE: node: builtin imports in packages/**/*.ts (and .mts/.cts) ##########'
$files = Get-ChildItem packages -Recurse -File -Include *.ts,*.mts,*.cts | Where-Object { $_.FullName -notmatch 'node_modules' }
$hits = @()
foreach ($f in $files) {
  $m = Select-String -Path $f.FullName -Pattern $patNode -AllMatches
  foreach ($x in $m) { $hits += ("{0}:{1}: {2}" -f $f.FullName.Replace($root + '\',''), $x.LineNumber, $x.Line.Trim()) }
}
if ($hits.Count -gt 0) { $hits | ForEach-Object { Add-Log "HIT: $_" } } else { Add-Log 'NO node: builtin imports found in any .ts/.mts/.cts under packages/' }
Add-Log ("(zero-core ts scan: files scanned=" + $files.Count + ", hits=" + $hits.Count + ")")
Add-Log ''

Add-Log '########## 2. ZERO-CORE: patch-package / pnpm patch / postinstall mutation of upstream ##########'
Add-Log '--- root package.json:'
Add-Log ((Get-Content package.json -Raw))
$pkgs = Get-ChildItem -Recurse -File -Include package.json -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch 'node_modules' }
$patchHits = @()
foreach ($f in $pkgs) {
  $m = Select-String -Path $f.FullName -Pattern 'patch-package|"patch"\s*:|postinstall|preinstall'
  foreach ($x in $m) { $patchHits += ("{0}:{1}: {2}" -f $f.FullName.Replace($root + '\',''), $x.LineNumber, $x.Line.Trim()) }
}
if ($patchHits.Count -gt 0) { $patchHits | ForEach-Object { Add-Log "HIT: $_" } } else { Add-Log 'no patch-package / pnpm patch / postinstall / preinstall references in any package.json (excl. node_modules)' }
Add-Log '--- lockfile diff vs base 673260198e2f90474678087fa7518bdd241403b8:'
$ld = @(git diff --stat 673260198e2f90474678087fa7518bdd241403b8..HEAD -- pnpm-lock.yaml)
if ($ld.Count -gt 0) { $ld | ForEach-Object { Add-Log $_ } } else { Add-Log 'pnpm-lock.yaml UNCHANGED vs base' }
$pdc = @(Select-String -Path pnpm-lock.yaml -Pattern 'patchedDependencies|patched_deps')
if ($pdc.Count -gt 0) { $pdc | ForEach-Object { Add-Log ("HIT line {0}: {1}" -f $_.LineNumber, $_.Line.Trim()) } } else { Add-Log 'no patchedDependencies/patched_deps in pnpm-lock.yaml' }
Add-Log ''

Add-Log '########## 3. PRIVATE-IMPORT: upstream references in packages/** source ##########'
$up = @()
$srcFiles = Get-ChildItem packages -Recurse -File -Include *.ts,*.mts,*.cts,*.mjs,*.cjs | Where-Object { $_.FullName -notmatch 'node_modules' }
foreach ($f in $srcFiles) {
  $m = Select-String -Path $f.FullName -Pattern $patUp
  foreach ($x in $m) { $up += ("{0}:{1}: {2}" -f $f.FullName.Replace($root + '\',''), $x.LineNumber, $x.Line.Trim()) }
}
if ($up.Count -gt 0) { $up | ForEach-Object { Add-Log "REF: $_" } } else { Add-Log 'NO references to deepseek-harness / references/ / deepseek-ai / @deepseek/ in any packages/** source file (ts/mts/cts/mjs/cjs)' }
Add-Log ("(upstream-ref scan: files scanned=" + $srcFiles.Count + ", hits=" + $up.Count + ")")
Add-Log ''

Add-Log '########## 4. OWNED-BOUNDARY: diff base..HEAD -- packages/ (summary) ##########'
Add-Log 'git diff --name-status 673260198e2f90474678087fa7518bdd241403b8..HEAD -- packages/'
$diff = @(git diff --name-status 673260198e2f90474678087fa7518bdd241403b8..HEAD -- packages/)
Add-Log ("entries: " + $diff.Count + " (A=" + (@($diff | Where-Object { $_ -match '^A' })).Count + " M=" + (@($diff | Where-Object { $_ -match '^M' })).Count + " D=" + (@($diff | Where-Object { $_ -match '^D' })).Count + ")")
Add-Log 'full list: owned-boundary-diff.txt (94 lines); per-glob mapping in report.md'
Add-Log ''

Add-Log '########## 5. CONTEXT: non-packages paths changed base..HEAD ##########'
$np = @(git diff --name-only 673260198e2f90474678087fa7518bdd241403b8..HEAD | Where-Object { $_ -notmatch '^packages/' })
if ($np.Count -gt 0) { $np | ForEach-Object { Add-Log $_ } } else { Add-Log '(none)' }
Add-Log ''
Add-Log ("(end) " + (Get-Date).ToString('o'))
Write-Host 'BOUNDARY-DONE'
