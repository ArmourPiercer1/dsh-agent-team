# P0-T2 commit-provenance manifest validator.
# Checks: JSON parses; 39 commits; each entry has all 5 fields (non-empty);
# classification within the 5-value enum; sha set == git log set of
# UPSTREAM_SHA..LEGACY_SHA in the frozen legacy checkout.
# Exit 0 on success, 1 on any failure.
[CmdletBinding()]
param(
    [string]$ManifestPath = (Join-Path $PSScriptRoot 'commit-manifest.json'),
    [string]$LegacyRepo = 'D:\AgentDev\dsh-plugins\dsh-agent-team\references\deepseek-harness',
    [string]$UpstreamSha = 'cd5ef8148158c3a752a658978873241fdf8e2bbc',
    [string]$LegacySha = 'a3ab31992762c5d6560797eabc7e0885a9320ade'
)

$ErrorActionPreference = 'Stop'
$failures = [System.Collections.Generic.List[string]]::new()

$allowed = @('TEAM_OWNED', 'GENERIC_FORK_CAPABILITY', 'UNRELATED_FORK_FEATURE', 'GENERATED_FROM_TEAM', 'MIXED')
$fields = @('sha', 'date', 'subject', 'classification', 'rationale')

# 1) JSON parseable
$raw = Get-Content -Raw -Encoding utf8 $ManifestPath
try {
    $manifest = $raw | ConvertFrom-Json
} catch {
    Write-Host "FAIL: manifest is not parseable JSON: $($_.Exception.Message)"
    exit 1
}
Write-Host "OK: JSON parsed ($ManifestPath)"

# 2) baseline block sanity
if ($manifest.baseline.upstream_sha -ne $UpstreamSha) {
    $failures.Add("baseline.upstream_sha mismatch: manifest=$($manifest.baseline.upstream_sha) expected=$UpstreamSha")
}
if ($manifest.baseline.legacy_sha -ne $LegacySha) {
    $failures.Add("baseline.legacy_sha mismatch: manifest=$($manifest.baseline.legacy_sha) expected=$LegacySha")
}

# 3) commits count == 39
$commits = @($manifest.commits)
if ($commits.Count -ne 39) {
    $failures.Add("commits count is $($commits.Count), expected 39")
}

# 4) per-entry fields
foreach ($i in 0..($commits.Count - 1)) {
    $c = $commits[$i]
    foreach ($f in $fields) {
        $v = $c.$f
        if ($null -eq $v -or "$v".Trim() -eq '') {
            $failures.Add("commits[$i] (sha=$($c.sha)) missing/empty field '$f'")
        }
    }
    if ($c.classification -and $allowed -notcontains $c.classification) {
        $failures.Add("commits[$i] (sha=$($c.sha)) invalid classification '$($c.classification)'")
    }
}
Write-Host "OK: field/enum checks run over $($commits.Count) entries"

# 5) sha set == git log set
$gitLines = git -C $LegacyRepo log --format='%H' "$UpstreamSha..$LegacySha"
if ($LASTEXITCODE -ne 0) {
    $failures.Add("git log failed (exit $LASTEXITCODE)")
} else {
    $gitSet = @{}
    foreach ($s in ($gitLines | Where-Object { $_ -ne '' })) { $gitSet[$s] = $true }
    $manifestSet = @{}
    foreach ($c in $commits) {
        if ($c.sha) { $manifestSet[$c.sha] = $true }
    }
    foreach ($s in $gitSet.Keys) {
        if (-not $manifestSet.ContainsKey($s)) { $failures.Add("sha in git log but not in manifest: $s") }
    }
    foreach ($s in $manifestSet.Keys) {
        if (-not $gitSet.ContainsKey($s)) { $failures.Add("sha in manifest but not in git log: $s") }
    }
    if ($gitSet.Count -ne 39) { $failures.Add("git log returned $($gitSet.Count) commits, expected 39") }
    Write-Host "OK: git log sha set has $($gitSet.Count) entries"
}

# 6) duplicate shas within manifest
$seen = @{}
foreach ($c in $commits) {
    if ($c.sha) {
        if ($seen.ContainsKey($c.sha)) { $failures.Add("duplicate sha in manifest: $($c.sha)") }
        $seen[$c.sha] = $true
    }
}

if ($failures.Count -gt 0) {
    Write-Host "FAIL: $($failures.Count) problem(s):"
    $failures | ForEach-Object { Write-Host "  - $_" }
    exit 1
}
Write-Host "PASS: commit-manifest.json valid (39 commits, sha set matches git log)"
exit 0
