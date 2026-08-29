# validate-file-manifest.ps1 — P0-T3 file-manifest.json structural validator.
# Exit 0 = pass, 1 = fail. Self-contained: reads the manifest beside this script,
# re-derives the authoritative file set from git, and checks enums/shape.
param(
  [string]$ManifestPath,
  [string]$LegacyCheckout
)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $ManifestPath) { $ManifestPath = Join-Path $here 'file-manifest.json' }

$failures = New-Object System.Collections.Generic.List[string]
$notes = New-Object System.Collections.Generic.List[string]

if (-not (Test-Path $ManifestPath)) { throw "manifest not found: $ManifestPath" }
$m = Get-Content $ManifestPath -Raw | ConvertFrom-Json
$baseline = $m.baseline
$files = $m.files

$CLASS_ENUM = @('TEAM_OWNED', 'GENERIC_FORK_CAPABILITY', 'UNRELATED_FORK_FEATURE', 'GENERATED_FROM_TEAM', 'MIXED')
$DISP_ENUM = @('DELETE', 'MIGRATE', 'REPLACE', 'KEEP', 'SPLIT', 'REFERENCE_ONLY', 'GENERATED_REVERT')
$KIND_ENUM = @('TEAM', 'PERMISSION', 'MODEL_UI', 'GENERATED', 'OTHER')
$STATUS_ENUM = @('A', 'M')

# 1. baseline block
foreach ($field in @('upstream_sha', 'legacy_sha', 'legacy_checkout', 'file_count')) {
  if ([string]::IsNullOrWhiteSpace([string]$baseline.$field)) { $failures.Add("baseline.$field missing") }
}
if (-not $LegacyCheckout) { $LegacyCheckout = [string]$baseline.legacy_checkout }
$U = [string]$baseline.upstream_sha
$L = [string]$baseline.legacy_sha
if ($U.Length -ne 40 -or $L.Length -ne 40) { $failures.Add('baseline shas must be 40-hex') }

# 2. authoritative file set from git (bidirectional equality)
$gitOut = git -C $LegacyCheckout diff --name-status -M $U $L
if ($LASTEXITCODE -ne 0) { throw "git diff failed (legacy checkout: $LegacyCheckout)" }
$gitSet = @{}
$gitStatus = @{}
foreach ($line in $gitOut) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  $tab = $line.IndexOf([char]9)
  $st = $line.Substring(0, $tab)
  $path = $line.Substring($tab + 1)
  $first = $st.Substring(0, 1)
  if ($first -eq 'R' -or $first -eq 'C') { $first = 'M' }
  $gitSet[$path] = $true
  $gitStatus[$path] = $first
}
$notes.Add("git diff file count: $($gitSet.Count)")

$manifestPaths = @{}
foreach ($f in $files) { $manifestPaths[[string]$f.path] = $true }

$missing = foreach ($p in $gitSet.Keys) { if (-not $manifestPaths.ContainsKey($p)) { $p } }
$extra = foreach ($p in $manifestPaths.Keys) { if (-not $gitSet.ContainsKey($p)) { $p } }
if ($missing.Count -gt 0) { $failures.Add("paths missing from manifest ($($missing.Count)): " + (($missing | Select-Object -First 10) -join ', ')) }
if ($extra.Count -gt 0) { $failures.Add("paths extra in manifest ($($extra.Count)): " + (($extra | Select-Object -First 10) -join ', ')) }
if ($files.Count -ne $gitSet.Count) { $failures.Add("file count mismatch: manifest=$($files.Count) git=$($gitSet.Count)") }
if ($null -ne $baseline.file_count -and $files.Count -ne [int]$baseline.file_count) {
  $failures.Add("baseline.file_count=$($baseline.file_count) but files has $($files.Count) entries")
}

# 3. per-file field checks
$seenPaths = @{}
foreach ($f in $files) {
  $p = [string]$f.path
  if ($seenPaths.ContainsKey($p)) { $failures.Add("duplicate path: $p") }
  $seenPaths[$p] = $true

  if ($p -ne $p.Trim() -or $p -notmatch '^[\w./\\-]+$') { $failures.Add("bad path shape: $p") }

  $st = [string]$f.status
  if ($st -notin $STATUS_ENUM) { $failures.Add("$p : bad status '$st'") }
  elseif ($gitStatus.ContainsKey($p) -and $gitStatus[$p] -ne $st) { $failures.Add("$p : status '$st' but git says '$($gitStatus[$p])'") }

  $c = [string]$f.classification
  if ($c -notin $CLASS_ENUM) { $failures.Add("$p : bad classification '$c'") }
  $d = [string]$f.disposition
  if ($d -notin $DISP_ENUM) { $failures.Add("$p : bad disposition '$d'") }
  $r = [string]$f.reason
  if ([string]::IsNullOrWhiteSpace($r)) { $failures.Add("$p : empty reason") }

  $hunks = $f.mixed_hunks
  $hunkCount = 0
  if ($null -ne $hunks) { $hunkCount = @($hunks).Count }
  if ($c -eq 'MIXED') {
    if ($hunkCount -eq 0) {
      # escape hatch: reason must state why a hunk split is impossible
      if ($r -notmatch '(?i)(single hunk|one hunk|hunk split (not |is )?impossible)') {
        $failures.Add("$p : MIXED but no mixed_hunks and reason does not justify it")
      }
    }
  } else {
    if ($hunkCount -ne 0) { $failures.Add("$p : non-MIXED file has $hunkCount mixed_hunks") }
  }
  if ($hunkCount -gt 0) {
    $expectedKinds = 0
    foreach ($h in $hunks) {
      $hn = $h.hunk
      if ($null -eq $hn -or "$hn" -notmatch '^\d+$' -or [int]$hn -lt 1) { $failures.Add("$p : bad hunk index '$hn'") }
      $k = [string]$h.kind
      if ($k -notin $KIND_ENUM) { $failures.Add("$p : bad hunk kind '$k'") }
      if ([string]::IsNullOrWhiteSpace([string]$h.note)) { $failures.Add("$p : hunk $hn has empty note") }
    }
    # hunk indices must be 1..N (no gaps, no extras)
    $idx = @($hunks | ForEach-Object { [int]$_.hunk } | Sort-Object -Unique)
    for ($i = 1; $i -le $idx.Count; $i++) {
      if ($idx[$i - 1] -ne $i) { $failures.Add("$p : hunk indices are not a contiguous 1..N sequence"); break }
    }
  }
}

# 4. classification/disposition consistency heuristics (report-only)
$gen = $files | Where-Object { $_.classification -eq 'GENERATED_FROM_TEAM' -and $_.disposition -ne 'GENERATED_REVERT' }
if (@($gen).Count -gt 0) { $notes.Add("note: GENERATED_FROM_TEAM files not marked GENERATED_REVERT: $(@($gen).Count)") }
$mixed = $files | Where-Object { $_.classification -eq 'MIXED' }
$notes.Add("MIXED files: $(@($mixed).Count)")

# report
$notes | ForEach-Object { Write-Host "  $_" }
if ($failures.Count -gt 0) {
  Write-Host "FAIL: $($failures.Count) problem(s)"
  $failures | Select-Object -First 50 | ForEach-Object { Write-Host "  - $_" }
  exit 1
}
Write-Host "PASS: file-manifest.json is structurally valid ($($files.Count) files, bidirectional equality with git diff -M $U..$L holds)"
exit 0
