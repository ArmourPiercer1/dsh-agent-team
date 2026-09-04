param([string]$Tree, [string]$Label)
"=== ${Label}: manifest-less package dirs ==="
$found = $false
foreach ($group in (Get-ChildItem (Join-Path $Tree 'packages') -Directory -ErrorAction SilentlyContinue)) {
  foreach ($p in (Get-ChildItem $group.FullName -Directory -ErrorAction SilentlyContinue)) {
    if (-not (Test-Path (Join-Path $p.FullName 'package.json'))) {
      $found = $true
      $contents = (Get-ChildItem $p.FullName -Force -ErrorAction SilentlyContinue | Select-Object -First 8 | ForEach-Object { $_.Name }) -join ', '
      Write-Output ('  ' + $p.FullName.Substring($Tree.Length) + '  [contents: ' + $contents + ']')
    }
  }
}
foreach ($base in @('vendor', 'apps')) {
  $b = Join-Path $Tree $base
  if (-not (Test-Path $b)) { continue }
  foreach ($d in (Get-ChildItem $b -Directory -ErrorAction SilentlyContinue)) {
    if (-not (Test-Path (Join-Path $d.FullName 'package.json'))) {
      $found = $true
      $contents = (Get-ChildItem $d.FullName -Force -ErrorAction SilentlyContinue | Select-Object -First 8 | ForEach-Object { $_.Name }) -join ', '
      Write-Output ("  " + $base + ': ' + $d.Name + '  [contents: ' + $contents + ']')
    }
  }
}
if (-not $found) { Write-Output '  none' }
