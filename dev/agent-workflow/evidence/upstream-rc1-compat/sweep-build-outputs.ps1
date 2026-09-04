# R122: clean-equivalent sweep of stale build outputs in the pristine TU tree.
# Only build outputs are removed (lib/, dist/, *.tsbuildinfo, .typecheck, .dsh-build).
# Mirrors the intent of `pnpm run clean` (scripts/clean.ts), which cannot run under
# Node strip-mode (TS parameter property in scripts/ts-project.ts:94).
$ErrorActionPreference = 'Stop'
$tu = 'D:\AgentDev\dsh-plugins\dsh-agent-team\references\deepseek-harness-test-use'
$libDirs = @()
$distDirs = @()
$tsbiFiles = @()
$typecheckDirs = @()

foreach ($base in @("$tu\packages", "$tu\apps", "$tu\vendor")) {
  if (-not (Test-Path $base)) { continue }
  foreach ($l1 in (Get-ChildItem $base -Directory -ErrorAction SilentlyContinue)) {
    $p1lib = Join-Path $l1.FullName 'lib'
    if (Test-Path $p1lib) { $libDirs += $p1lib }
    $p1dist = Join-Path $l1.FullName 'dist'
    if (Test-Path $p1dist) { $distDirs += $p1dist }
    if ($base -like '*\packages') {
      foreach ($l2 in (Get-ChildItem $l1.FullName -Directory -ErrorAction SilentlyContinue)) {
        $p2lib = Join-Path $l2.FullName 'lib'
        if (Test-Path $p2lib) { $libDirs += $p2lib }
        $p2dist = Join-Path $l2.FullName 'dist'
        if (Test-Path $p2dist) { $distDirs += $p2dist }
        $tsbiFiles += Get-ChildItem $l2.FullName -Filter '*.tsbuildinfo' -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName }
        $tc = Join-Path $l2.FullName '.typecheck'
        if (Test-Path $tc) { $typecheckDirs += $tc }
      }
    }
  }
}

foreach ($l1 in (Get-ChildItem "$tu\apps" -Directory -ErrorAction SilentlyContinue)) {
  $tsbiFiles += Get-ChildItem $l1.FullName -Filter '*.tsbuildinfo' -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName }
}
$tsbiFiles += Get-ChildItem $tu -Filter '*.tsbuildinfo' -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName }
$nltsb = Join-Path $tu 'native\landlock-run\tsconfig.tsbuildinfo'
if (Test-Path $nltsb) { $tsbiFiles += $nltsb }
$rootlib = Join-Path $tu 'lib'
if (Test-Path $rootlib) { $libDirs += $rootlib }
$wb = Join-Path $tu 'website\.vitepress\dist'
if (Test-Path $wb) { $distDirs += $wb }

Write-Output ("lib dirs: " + $libDirs.Count)
foreach ($d in $libDirs) { Remove-Item $d -Recurse -Force -ErrorAction SilentlyContinue }
Write-Output ("dist dirs: " + $distDirs.Count)
foreach ($d in $distDirs) { Remove-Item $d -Recurse -Force -ErrorAction SilentlyContinue }
Write-Output ("tsbuildinfo: " + $tsbiFiles.Count)
foreach ($f in $tsbiFiles) { Remove-Item $f -Force -ErrorAction SilentlyContinue }
foreach ($d in $typecheckDirs) { Remove-Item $d -Recurse -Force -ErrorAction SilentlyContinue; Write-Output ("removed typecheck: " + $d) }
foreach ($d in @("$tu\.dsh-build", "$tu\.typecheck")) {
  if (Test-Path $d) { Remove-Item $d -Recurse -Force; Write-Output ("removed " + $d) }
}

# Verification: re-enumerate the same depth-bounded surface; grep residue.
$remainLib = @()
foreach ($base in @("$tu\packages", "$tu\apps", "$tu\vendor")) {
  if (-not (Test-Path $base)) { continue }
  foreach ($l1 in (Get-ChildItem $base -Directory -ErrorAction SilentlyContinue)) {
    $p1lib = Join-Path $l1.FullName 'lib'
    if (Test-Path $p1lib) { $remainLib += $p1lib }
    if ($base -like '*\packages') {
      foreach ($l2 in (Get-ChildItem $l1.FullName -Directory -ErrorAction SilentlyContinue)) {
        $p2lib = Join-Path $l2.FullName 'lib'
        if (Test-Path $p2lib) { $remainLib += $p2lib }
      }
    }
  }
}
if ($remainLib) {
  Write-Output 'REMAINING LIB DIRS:'
  foreach ($r in $remainLib) { Write-Output $r }
} else {
  Write-Output 'REMAINING LIB DIRS: none'
}
Write-Output ('ui-deliverables lib present: ' + (Test-Path "$tu\packages\client\ui-deliverables\lib"))
Write-Output 'SWEEP-DONE'
