# compare-blobs — raw byte comparison: committed git blobs vs worktree files.
# Extracts blobs with cmd /c (raw redirect, no PS re-encoding), compares via .NET.
param([string]$Worktree, [string]$Commit = '677b029')

$paths = @(
  'packages/runtime/dist/packages/contracts/src/identity.js',
  'packages/runtime/dist/packages/contracts/src/index.js',
  'packages/runtime/dist/packages/runtime/src/plugin/host.js',
  'packages/runtime/dist/packages/runtime/src/plugin/host.d.ts',
  'packages/runtime/dist/packages/runtime/src/plugin/host.js.map',
  'packages/runtime/dist/packages/runtime/src/plugin/types.d.ts',
  'packages/runtime/dist/packages/runtime/src/plugin/types.js.map',
  'packages/runtime/dist/packages/storage/repositories/team-domain.js',
  'packages/runtime/dist/packages/storage/repositories/team-domain.d.ts',
  'packages/runtime/dist/packages/remote/src/handlers/register.js',
  'packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs',
  'packages/client/composition-shim/client-bundle.js',
  'packages/client/composition-shim/index.js',
  'packages/client/composition-shim/package.json'
)

$diffs = 0
foreach ($p in $paths) {
  $tmp = Join-Path $env:TEMP ('blob-' + [guid]::NewGuid().ToString('N'))
  $spec = $Commit + ':' + $p
  cmd /c "git -C `"$Worktree`" show $spec > `"$tmp`"" 2>$null
  $blob = [System.IO.File]::ReadAllBytes($tmp)
  Remove-Item $tmp -ErrorAction SilentlyContinue
  $diskPath = Join-Path $Worktree ($p -replace '/', '\')
  $disk = [System.IO.File]::ReadAllBytes($diskPath)
  $same = ($blob.Length -eq $disk.Length)
  if ($same) {
    for ($i = 0; $i -lt $blob.Length; $i++) {
      if ($blob[$i] -ne $disk[$i]) { $same = $false; break }
    }
  }
  $verdict = if ($same) { 'IDENTICAL' } else { 'DIFFER' }
  if (-not $same) { $diffs++ }
  Write-Output ('{0}: blob={1} disk={2} {3}' -f $p, $blob.Length, $disk.Length, $verdict)
}
Write-Output ('TOTAL DIFFERING: {0}/{1}' -f $diffs, $paths.Count)
