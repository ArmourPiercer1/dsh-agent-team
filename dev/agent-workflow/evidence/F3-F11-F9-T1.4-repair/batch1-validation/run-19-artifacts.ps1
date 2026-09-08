# batch1-validation artifact/upstream cleanliness (repair-r1)
# 1) the committed gate script (node scripts/check-artifacts-committed.mjs) —
#    attempted verbatim; its git spawn is EPERM-expected in this sandbox
#    (f9/run-recipe.md constraint: "check-artifacts-committed.mjs spawns git (EPERM here)").
# 2) pwsh-level three-way reproduction of that gate (A tracked-but-absent /
#    B produced-but-untracked / C content-drift) for packages/runtime/dist +
#    packages/client/composition-shim — pwsh->git spawns are allowed.
# 3) upstream/cleanliness statuses: test-use checkout (must be empty),
#    stable D:\deepseek-harness (read-only status only), team worktree status
#    + git diff --check.
$root = 'D:\AgentDev\dsh-plugins\dsh-agent-team'
$ev = Join-Path $root 'dev\agent-workflow\evidence\F3-F11-F9-T1.4-repair\batch1-validation'
Set-Location $root
$out = Join-Path $ev '19-artifacts-cleanliness.txt'
$sb = New-Object System.Text.StringBuilder
function Section([string]$title) { [void]$sb.AppendLine(''); [void]$sb.AppendLine('=== ' + $title + ' ===') }

# ---- 1) committed gate script (verbatim attempt) ----
Section 'node scripts/check-artifacts-committed.mjs (verbatim attempt)'
& node (Join-Path $root 'scripts/check-artifacts-committed.mjs') 2>&1 | ForEach-Object { [void]$sb.AppendLine(("$_")) }
[void]$sb.AppendLine('exit: ' + $LASTEXITCODE)

# ---- 2) three-way reproduction ----
Section 'three-way reproduction (pwsh-level)'
$paths = @('packages/runtime/dist', 'packages/client/composition-shim')
# tracked set (index)
$trackedLines = git ls-files -s -- $paths
$tracked = @{}
foreach ($line in $trackedLines) {
  $line = $line.Trim()
  if (-not $line) { continue }
  $tab = $line.IndexOf([char]9)
  if ($tab -lt 0) { continue }
  $meta = $line.Substring(0, $tab).Split(' ')
  $tracked[$line.Substring($tab + 1)] = $meta[1]
}
# disk walk
$disk = New-Object System.Collections.Generic.List[string]
foreach ($p in $paths) {
  $full = Join-Path $root $p
  if (-not (Test-Path $full)) { [void]$sb.AppendLine('ERROR: path missing on disk: ' + $p); continue }
  Get-ChildItem $full -Recurse -File | ForEach-Object { $disk.Add(($_.FullName.Substring($root.Length + 1) -replace '\\', '/')) }
}
# ignored set
$ignored = @{}
git ls-files --ignored --exclude-standard -o -- $paths 2>&1 | ForEach-Object { $line = ("$_").Trim(); if ($line) { $ignored[$line] = $true } }
$produced = @{}
foreach ($f in $disk) { if (-not $ignored.ContainsKey($f)) { $produced[$f] = $true } }
# A) tracked-but-absent
$stale = @($tracked.Keys | Where-Object { -not $produced.ContainsKey($_) } | Sort-Object)
# B) produced-but-untracked
$untracked = @($produced.Keys | Where-Object { -not $tracked.ContainsKey($_) } | Sort-Object)
# C) drift via git hash-object --stdin-paths (same clean filters as git add)
$toHash = @($produced.Keys | Where-Object { $tracked.ContainsKey($_) } | Sort-Object)
$workShas = @{}
if ($toHash.Count -gt 0) {
  $hashOut = ($toHash -join "`n" | git hash-object --stdin-paths 2>&1)
  $shas = @($hashOut | ForEach-Object { ("$_").Trim() } | Where-Object { $_ })
  if ($shas.Count -ne $toHash.Count) {
    [void]$sb.AppendLine('ERROR: hash-object count mismatch (' + $shas.Count + ' vs ' + $toHash.Count + ')')
  } else {
    for ($i = 0; $i -lt $toHash.Count; $i++) { $workShas[$toHash[$i]] = $shas[$i] }
  }
}
$drifted = @($toHash | Where-Object { $workShas[$_] -ne $tracked[$_] } | Sort-Object)
[void]$sb.AppendLine('tracked (index): ' + $tracked.Count)
[void]$sb.AppendLine('produced on disk (minus ignored): ' + $produced.Count)
[void]$sb.AppendLine('A tracked-but-absent: ' + $stale.Count)
$stale | ForEach-Object { [void]$sb.AppendLine('    ' + $_) }
[void]$sb.AppendLine('B produced-but-untracked: ' + $untracked.Count)
$untracked | ForEach-Object { [void]$sb.AppendLine('    ' + $_) }
[void]$sb.AppendLine('C content-drift: ' + $drifted.Count)
$drifted | ForEach-Object { [void]$sb.AppendLine('    ' + $_) }
if ($stale.Count -eq 0 -and $untracked.Count -eq 0 -and $drifted.Count -eq 0) {
  [void]$sb.AppendLine('REPRO OK: committed install-surface artifacts match the on-disk state')
} else {
  [void]$sb.AppendLine('REPRO FAIL: see A/B/C lists above')
}

# ---- 3) upstream / worktree statuses ----
Section 'references/deepseek-harness-test-use status --porcelain (MUST BE EMPTY)'
git -C (Join-Path $root 'references/deepseek-harness-test-use') status --porcelain 2>&1 | ForEach-Object { [void]$sb.AppendLine(("$_")) }
[void]$sb.AppendLine('exit: ' + $LASTEXITCODE)

Section 'D:\deepseek-harness (stable deployment) status --porcelain (READ-ONLY status; no operation on :3080)'
git -C 'D:\deepseek-harness' status --porcelain 2>&1 | ForEach-Object { [void]$sb.AppendLine(("$_")) }
[void]$sb.AppendLine('exit: ' + $LASTEXITCODE)

Section 'team worktree (int/repair-r1) status --short --branch'
git status --short --branch 2>&1 | ForEach-Object { [void]$sb.AppendLine(("$_")) }
[void]$sb.AppendLine('exit: ' + $LASTEXITCODE)

Section 'team worktree git diff --check'
git diff --check 2>&1 | ForEach-Object { [void]$sb.AppendLine(("$_")) }
[void]$sb.AppendLine('exit: ' + $LASTEXITCODE)

[void]$sb.AppendLine('finished: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'))
Set-Content -Path $out -Value $sb.ToString() -Encoding utf8
Write-Host ('wrote ' + $out)
