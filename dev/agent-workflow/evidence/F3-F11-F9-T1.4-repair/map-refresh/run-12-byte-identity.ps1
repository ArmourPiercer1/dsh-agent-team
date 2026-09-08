# map-refresh byte-identity check (post-build, pre-commit)
# For every tracked file under the two install-surface paths, compare the
# worktree git blob SHA (git hash-object, same clean filters as git add)
# against the committed index blob SHA. Verdict:
#   - drifted set MUST be exactly the 4 reported-stale .map files
#   - every .js/.d.ts (and all other tracked artifacts) MUST be byte-identical
$wt   = $root = 'D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\repair-r1-map-refresh'
$ev   = Join-Path $root 'dev\agent-workflow\evidence\F3-F11-F9-T1.4-repair\map-refresh'
Set-Location $root
$sb = New-Object System.Text.StringBuilder
function Section([string]$title) { [void]$sb.AppendLine(''); [void]$sb.AppendLine('=== ' + $title + ' ===') }

$paths = @('packages/runtime/dist', 'packages/client/composition-shim')
$expectedDrift = @(
  'packages/runtime/dist/packages/runtime/src/plugin/root.js.map',
  'packages/runtime/dist/packages/runtime/src/plugin/root.d.ts.map',
  'packages/runtime/dist/packages/runtime/src/plugin/s6-remote.js.map',
  'packages/runtime/dist/packages/runtime/src/plugin/s6-remote.d.ts.map'
)

# index (committed at HEAD)
$tracked = @{}
git ls-files -s -- $paths | ForEach-Object {
  $line = ($_).Trim()
  if (-not $line) { return }
  $tab = $line.IndexOf([char]9)
  if ($tab -lt 0) { return }
  $meta = $line.Substring(0, $tab).Split(' ')
  $tracked[$line.Substring($tab + 1)] = $meta[1]
}
# disk walk (minus ignored)
$disk = New-Object System.Collections.Generic.List[string]
foreach ($p in $paths) {
  Get-ChildItem (Join-Path $root $p) -Recurse -File | ForEach-Object {
    $disk.Add((($_.FullName.Substring($root.Length + 1)) -replace '\\', '/'))
  }
}
$ignored = @{}
git ls-files --ignored --exclude-standard -o -- $paths 2>&1 | ForEach-Object { $l = ("$_").Trim(); if ($l) { $ignored[$l] = $true } }
$produced = @{}
foreach ($f in $disk) { if (-not $ignored.ContainsKey($f)) { $produced[$f] = $true } }

$all = @($produced.Keys | Where-Object { $tracked.ContainsKey($_) } | Sort-Object)
$workShas = @{}
if ($all.Count -gt 0) {
  $shas = @(($all -join "`n" | git hash-object --stdin-paths 2>&1) | ForEach-Object { ("$_").Trim() } | Where-Object { $_ })
  if ($shas.Count -ne $all.Count) { [void]$sb.AppendLine('ERROR: hash-object count mismatch (' + $shas.Count + ' vs ' + $all.Count + ')') }
  else { for ($i = 0; $i -lt $all.Count; $i++) { $workShas[$all[$i]] = $shas[$i] } }
}
$drifted = @($all | Where-Object { $workShas[$_] -ne $tracked[$_] } | Sort-Object)
$identical = @($all | Where-Object { $workShas[$_] -eq $tracked[$_] } | Sort-Object)
$jsdts = @($identical | Where-Object { $_ -match '\.(js|d\.ts)$' })

Section 'scope'
[void]$sb.AppendLine('tracked files on install surface (index @ HEAD ' + (git rev-parse --short HEAD) + '): ' + $tracked.Count)
[void]$sb.AppendLine('produced on disk (minus ignored): ' + $produced.Count)
[void]$sb.AppendLine('files compared (tracked AND on disk): ' + $all.Count)
[void]$sb.AppendLine('expected drifted set (the 4 reported-stale maps): ' + $expectedDrift.Count)
Section 'drifted files (worktree blob != committed blob)'
[void]$sb.AppendLine('count: ' + $drifted.Count)
foreach ($d in $drifted) { [void]$sb.AppendLine(("  {0}  {1} -> {2}" -f $d, $tracked[$d], $workShas[$d])) }
Section 'byte-identical files (worktree blob == committed blob)'
[void]$sb.AppendLine('count: ' + $identical.Count)
[void]$sb.AppendLine('  of which .js / .d.ts: ' + $jsdts.Count)
Section 'verdict'
$driftSorted = ($drifted | Sort-Object) -join "`n"; $expSorted = ($expectedDrift | Sort-Object) -join "`n"
if ($drifted.Count -eq 4 -and ($driftSorted -eq $expSorted) -and $produced.Count -eq $tracked.Count) {
  [void]$sb.AppendLine('BYTE-IDENTITY PASS: drifted set is EXACTLY the 4 reported-stale maps; all other tracked artifacts (every .js/.d.ts, ' + $jsdts.Count + ' js/d.ts files) are byte-identical to HEAD; no untracked/absent files in either install-surface path.')
} else {
  [void]$sb.AppendLine('BYTE-IDENTITY FAIL: see drifted list above and count comparisons (tracked=' + $tracked.Count + ' produced=' + $produced.Count + ' drifted=' + $drifted.Count + ')')
}
Section 'the 4 maps: committed vs rebuilt (blob SHA + sha256 of new bytes)'
foreach ($m in $expectedDrift) {
  $newSha = (Get-FileHash (Join-Path $root $m) -Algorithm SHA256).Hash.ToLowerInvariant()
  [void]$sb.AppendLine($m)
  [void]$sb.AppendLine('    committed: ' + $tracked[$m])
  [void]$sb.AppendLine('    rebuilt  : ' + $workShas[$m])
  [void]$sb.AppendLine('    sha256(new): ' + $newSha)
}
Section 'rebuilt maps: structural validation (JSON parse + source-map v3 fields)'
foreach ($m in $expectedDrift) {
  try {
    $j = Get-Content (Join-Path $root $m) -Raw | ConvertFrom-Json
    [void]$sb.AppendLine(($m + ' -> OK: version=' + $j.version + ' file=' + $j.file + ' sources=' + $j.sources.Count + ' mappings-len=' + $j.mappings.Length))
  } catch {
    [void]$sb.AppendLine(($m + ' -> INVALID JSON: ' + $_.Exception.Message))
  }
}
Section 'untracked or absent under the two paths (git status --porcelain)'
[void]$sb.AppendLine((git status --porcelain -- $paths 2>&1 | Out-String).Trim())
[void]$sb.AppendLine('')
[void]$sb.AppendLine('finished: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'))
Set-Content -Path (Join-Path $ev '12-byte-identity.txt') -Value $sb.ToString() -Encoding utf8
Write-Host ('wrote 12-byte-identity.txt (drifted=' + $drifted.Count + ', identical=' + $identical.Count + ')')
