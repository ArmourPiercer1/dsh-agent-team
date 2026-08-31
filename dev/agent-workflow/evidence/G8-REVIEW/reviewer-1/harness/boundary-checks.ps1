# G8-R1 brief SS4.4 boundary checks -> boundary-checks.log
$w = 'D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\G8-R1'
$ev = Join-Path $w 'dev\agent-workflow\evidence\G8-REVIEW\reviewer-1'
$log = Join-Path $ev 'boundary-checks.log'
$BASE = '959e36358ee7244ff8c7e1e0b8396e70dfef4562'
function W([string]$s) { Add-Content -Path $log -Value $s -Encoding utf8 }
Set-Content -Path $log -Value '=== G8-R1 boundary checks (brief SS4.4) ===' -Encoding utf8
W ('started: ' + (Get-Date -Format 'o'))
W ('proof: toplevel=' + (git -C $w rev-parse --show-toplevel).Trim())
W ('proof: head=' + (git -C $w rev-parse HEAD).Trim())
W ('base: ' + $BASE)

# ---- zero-core (a): node: builtin imports in .ts under packages/ ----
W ''
W '--- zero-core (a): node: builtin imports in packages/**/*.ts ---'
$tsFiles = Get-ChildItem (Join-Path $w 'packages') -Recurse -Include *.ts,*.mts -File | Where-Object { $_.FullName -notmatch 'node_modules' }
W ('ts file count scanned: ' + $tsFiles.Count)
$nodeImportRe = 'from\s+[''"]node:|require\(\s*[''"][^''"]*node:|import\(\s*[''"][^''"]*node:'
$hits = foreach ($f in $tsFiles) {
  $m = Select-String -Path $f.FullName -Pattern $nodeImportRe
  if ($m) { foreach ($mm in $m) { '{0}:{1}: {2}' -f $f.FullName.Substring($w.Length + 1), $mm.LineNumber, $mm.Line.Trim() } }
}
if ($hits.Count -eq 0) { W 'hits: 0  -> PASS' } else { W 'hits: ' + $hits.Count; $hits | ForEach-Object { W $_ }; W '-> FAIL' }

# ---- zero-core (b): patch-package / pnpm patch / postinstall mutation ----
W ''
W '--- zero-core (b): patch/postinstall mutation surface ---'
$pkgJsons = Get-ChildItem (Join-Path $w 'packages') -Recurse -Filter package.json -File | Where-Object { $_.FullName -notmatch 'node_modules' }
$mutHits = foreach ($f in $pkgJsons) {
  $txt = Get-Content $f.FullName -Raw
  foreach ($tok in @('patch-package', 'pnpm patch', 'postinstall')) {
    if ($txt -match [regex]::Escape($tok)) { '{0}: token "{1}"' -f $f.FullName.Substring($w.Length + 1), $tok }
  }
}
if ($mutHits.Count -eq 0) { W 'package.json mutation tokens (patch-package/pnpm patch/postinstall): 0' } else { $mutHits | ForEach-Object { W $_ }; W '-> REQUIRES REVIEW' }
# informational: any lifecycle script keys present (pre/post/prepare)
$lifecycle = @()
foreach ($f in $pkgJsons) {
  $obj = Get-Content $f.FullName -Raw | ConvertFrom-Json
  if ($obj.scripts) {
    $keys = $obj.scripts.PSObject.Properties.Name | Where-Object { $_ -match '^(pre|post)' -or $_ -eq 'prepare' }
    if ($keys) { $lifecycle += ('{0}: {1}' -f $f.FullName.Substring($w.Length + 1), ($keys -join ', ')) }
  }
}
if ($lifecycle.Count -eq 0) { W 'lifecycle script keys (pre*/post*/prepare): none' } else { $lifecycle | ForEach-Object { W ('INFO ' + $_) } }
$rootPkg = Get-Content (Join-Path $w 'package.json') -Raw
$rootTok = foreach ($tok in @('patch-package', 'pnpm patch', 'postinstall')) { if ($rootPkg -match [regex]::Escape($tok)) { $tok } }
if ($rootTok.Count -eq 0) { W 'root package.json mutation tokens: 0' } else { W ('root package.json tokens: ' + ($rootTok -join ', ')) }
$lockDiff = git -C $w diff $BASE 'HEAD' -- pnpm-lock.yaml package.json
if ([string]::IsNullOrWhiteSpace($lockDiff)) { W ('lockfile+root package.json diff vs base: EMPTY -> PASS') } else { W 'lockfile/root diff (first 40 lines):'; ($lockDiff -split "`n")[0..39] | ForEach-Object { W ('    ' + $_) }; W '-> REQUIRES REVIEW' }

# ---- zero-core (c): no import of references/deepseek-harness-test-use from packages/* ----
W ''
W '--- zero-core (c): references to test-use upstream from packages/* ---'
$upHits = Get-ChildItem (Join-Path $w 'packages') -Recurse -Include *.ts,*.mjs,*.cjs -File | Where-Object { $_.FullName -notmatch 'node_modules' } |
  Select-String -Pattern 'deepseek-harness-test-use'
if ($upHits.Count -eq 0) { W 'hits: 0  -> PASS' } else { $upHits | ForEach-Object { W ('{0}:{1}: {2}' -f $_.Path.Substring($w.Length + 1), $_.LineNumber, $_.Line.Trim()) }; W '-> FAIL' }

# ---- private-import: upstream internals / frozen legacy fork in packages/**/*.ts ----
W ''
W '--- private-import: upstream-internal / frozen-fork tokens in packages/**/*.ts ---'
$privRe = 'deepseek-harness-test-use|deepseek-harness/|references/deepseek-harness|from [''"]@deepseek-ai/'
$privHits = foreach ($f in $tsFiles) {
  $m = Select-String -Path $f.FullName -Pattern $privRe
  if ($m) { foreach ($mm in $m) { '{0}:{1}: {2}' -f $f.FullName.Substring($w.Length + 1), $mm.LineNumber, $mm.Line.Trim() } }
}
if ($privHits.Count -eq 0) { W 'hits: 0  -> PASS' } else { W 'hits: ' + $privHits.Count; $privHits | ForEach-Object { W $_ }; W '-> FAIL' }

# ---- owned-boundary: every added/modified packages/ file in a P8 owned glob ----
W ''
W '--- owned-boundary: git diff --name-only base..HEAD -- packages/ ---'
$files = (git -C $w diff --name-only $BASE 'HEAD' -- 'packages/').Trim() | Where-Object { $_ -ne '' }
W ('changed file count: ' + $files.Count)
function InOwned([string]$p) {
  $n = $p -replace '\\', '/'
  $owned = @(
    '^packages/contracts/src/projection/.+',
    '^packages/contracts/src/index\.ts$',
    '^packages/runtime/projection/.+',
    '^packages/remote/src/contracts/.+',
    '^packages/remote/src/handlers/.+',
    '^packages/remote/src/index\.ts$',
    '^packages/remote/test/p8t3-.+',
    '^packages/remote/src/push/.+',
    '^packages/remote/test/p8t4-.+',
    '^packages/remote/test/p8t3-negative\.test\.ts$',
    '^packages/testkit/test/p4t6-session-event-scan\.test\.ts$'
  )
  foreach ($g in $owned) { if ($n -match $g) { return $true } }
  return $false
}
$viol = @()
foreach ($f in $files) {
  if (InOwned $f) { W ('OK   ' + $f) } else { W ('VIOLATION ' + $f); $viol += $f }
}
if ($viol.Count -eq 0) { W 'owned-boundary: all files inside P8 owned globs -> PASS' } else { W ('owned-boundary violations: ' + $viol.Count) + ' -> FAIL' }
W ''
W ('finished: ' + (Get-Date -Format 'o'))
W 'BOUNDARY-DONE'
exit 0
