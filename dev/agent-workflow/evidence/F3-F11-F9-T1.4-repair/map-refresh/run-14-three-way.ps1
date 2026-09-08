# map-refresh — three-way A/B/C reproduction of scripts/check-artifacts-committed.mjs
# at the pwsh level (pwsh->git spawns are sandbox-allowed; node->git are not).
#   A) tracked-but-absent      B) produced-but-untracked      C) content-drift
# Usage: & run-14-three-way.ps1 <output-file>  (run pre-commit and post-commit)
param([Parameter(Mandatory=$true)][string]$OutFile)
$root = 'D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\repair-r1-map-refresh'
Set-Location $root
$sb = New-Object System.Text.StringBuilder
function Section([string]$title) { [void]$sb.AppendLine(''); [void]$sb.AppendLine('=== ' + $title + ' ===') }
[void]$sb.AppendLine('three-way reproduction of node scripts/check-artifacts-committed.mjs (pwsh-level)')
[void]$sb.AppendLine('worktree: ' + $root)
[void]$sb.AppendLine('HEAD: ' + (git rev-parse HEAD))
[void]$sb.AppendLine('started: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'))

$paths = @('packages/runtime/dist', 'packages/client/composition-shim')
$tracked = @{}
git ls-files -s -- $paths | ForEach-Object {
  $line = ($_).Trim(); if (-not $line) { return }
  $tab = $line.IndexOf([char]9); if ($tab -lt 0) { return }
  $meta = $line.Substring(0, $tab).Split(' ')
  $tracked[$line.Substring($tab + 1)] = $meta[1]
}
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
$stale = @($tracked.Keys | Where-Object { -not $produced.ContainsKey($_) } | Sort-Object)
$untracked = @($produced.Keys | Where-Object { -not $tracked.ContainsKey($_) } | Sort-Object)
$toHash = @($produced.Keys | Where-Object { $tracked.ContainsKey($_) } | Sort-Object)
$workShas = @{}
if ($toHash.Count -gt 0) {
  $shas = @(($toHash -join "`n" | git hash-object --stdin-paths 2>&1) | ForEach-Object { ("$_").Trim() } | Where-Object { $_ })
  if ($shas.Count -ne $toHash.Count) { [void]$sb.AppendLine('ERROR: hash-object count mismatch (' + $shas.Count + ' vs ' + $toHash.Count + ')') }
  else { for ($i = 0; $i -lt $toHash.Count; $i++) { $workShas[$toHash[$i]] = $shas[$i] } }
}
$drifted = @($toHash | Where-Object { $workShas[$_] -ne $tracked[$_] } | Sort-Object)
Section 'results'
[void]$sb.AppendLine('tracked (index): ' + $tracked.Count)
[void]$sb.AppendLine('produced on disk (minus ignored): ' + $produced.Count)
[void]$sb.AppendLine('A tracked-but-absent: ' + $stale.Count)
$stale | ForEach-Object { [void]$sb.AppendLine('    ' + $_) }
[void]$sb.AppendLine('B produced-but-untracked: ' + $untracked.Count)
$untracked | ForEach-Object { [void]$sb.AppendLine('    ' + $_) }
[void]$sb.AppendLine('C content-drift: ' + $drifted.Count)
$drifted | ForEach-Object { [void]$sb.AppendLine('    ' + $_) }
if ($stale.Count -eq 0 -and $untracked.Count -eq 0 -and $drifted.Count -eq 0) {
  [void]$sb.AppendLine('GATE OK: committed install-surface artifacts match the on-disk state (== node gate would exit 0)')
} else {
  [void]$sb.AppendLine('GATE FAIL: see A/B/C lists above (== node gate would exit 1)')
}
Section 'worktree git status --short --branch'
[void]$sb.AppendLine((git status --short --branch 2>&1 | Out-String).Trim())
Section 'git diff --check'
[void]$sb.AppendLine((git diff --check 2>&1 | Out-String).Trim())
[void]$sb.AppendLine('')
[void]$sb.AppendLine('finished: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'))
Set-Content -Path $OutFile -Value $sb.ToString() -Encoding utf8
Write-Host ('wrote ' + $OutFile + ' (A=' + $stale.Count + ' B=' + $untracked.Count + ' C=' + $drifted.Count + ')')
