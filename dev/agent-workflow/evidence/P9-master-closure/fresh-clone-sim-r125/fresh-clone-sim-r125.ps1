# R125 fresh-clone simulation (commit ad0a869) — the reviewer-6 B1 scenario, end to end.
#
# Method: git archive <sha> => pristine tree in an out-of-product-surface temp dir
# (equivalent to `git clone <repo> && git checkout <sha>` minus .git), then run the
# EXACT documented fresh-machine chain (docs/INSTALL.md §2) and assert:
#   A1. install succeeds and produces no broken junctions / no link targets outside the sim dir
#   A2. hermetic resolution: all 7 former link: devDeps (now registry pins) + the 6
#       row-owned runtime deps resolve INSIDE the sim dir (walk-up to the main tree's
#       node_modules farm would mask a leak -> this assertion prevents that)
#   A3. per-package tsc 9/9 (client types come from the published registry packages)
#   A4. composition chain (place-dist-glue + build-client-composition) produces the 4
#       install-surface artifacts byte-identical to the R122-verified world
#   A5. root node_modules contains no @deepseek-ai directory (no junction farm)
#
# Usage (from anywhere):  powershell -File fresh-clone-sim-r125.ps1 [-Sha <sha>]
# The sim dir is references/.fresh-clone-r125-<sha8> (gitignored area, references/).

param(
  [string]$Sha = 'ad0a869'
)
$ErrorActionPreference = 'Continue'
$main = 'D:\AgentDev\dsh-plugins\dsh-agent-team'
$ref = 'D:\AgentDev\dsh-plugins\dsh-agent-team\references\.dsh-test-s8-2026-09-04T12-26-59\s8-client-row'
$sim = Join-Path $main ('references\.fresh-clone-r125-' + $Sha)
$log = Join-Path $main ('.worktrees\P9-MC\dev\agent-workflow\evidence\P9-master-closure\fresh-clone-sim-r125\sim-' + $Sha + '.log')
New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null
if (Test-Path $sim) { Remove-Item $sim -Recurse -Force }
New-Item -ItemType Directory -Force -Path $sim | Out-Null

function Say([string]$s) { Write-Host $s; Add-Content -Path $log -Value $s -Encoding utf8 }

Say ('FRESH-CLONE SIMULATION - sha ' + $Sha + ' - ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
Say ('sim dir: ' + $sim)

Say '=== step 0: git archive (pristine tree, no .git) ==='
Set-Location $main
$tmpTar = Join-Path $env:TEMP ('fresh-clone-r125-' + $Sha + '.tar')
git -C $main archive --format=tar $Sha -o $tmpTar
$gitArchExit = $LASTEXITCODE
Say ('git archive -o exit=' + $gitArchExit + ' tar=' + $tmpTar)
if ($gitArchExit -ne 0) { Say 'SIM-FAIL at git archive'; exit 1 }
tar -xf $tmpTar -C $sim
$tarExit = $LASTEXITCODE
Say ('tar extract exit=' + $tarExit)
$fileCount = (Get-ChildItem $sim -Recurse -File).Count
Say ('extracted files: ' + $fileCount)
if ($tarExit -ne 0 -or $fileCount -lt 1000) { Say 'SIM-FAIL at extract'; exit 1 }

Say '=== A5-pre: root node_modules must not pre-exist in the sim ==='
if (Test-Path (Join-Path $sim 'node_modules')) { Say 'SIM-FAIL: node_modules pre-existed'; exit 1 }
Say 'ok (absent)'

Say '=== step 1 (INSTALL.md 2.1): pnpm install --ignore-scripts ==='
Set-Location $sim
pnpm install --ignore-scripts 2>&1 | ForEach-Object { Say ('  ' + $_) } | Select-Object -Last 3
$installExit = $LASTEXITCODE
Say ('pnpm install exit=' + $installExit)
if ($installExit -ne 0) { Say 'SIM-FAIL at install'; exit 1 }

Say '=== A5: root node_modules has no @deepseek-ai dir (no farm) ==='
$dkRoot = Join-Path $sim 'node_modules\@deepseek-ai'
if (Test-Path $dkRoot) { Say ('SIM-FAIL: ' + $dkRoot + ' exists'); exit 1 }
Say 'ok (absent)'

Say '=== broken-junction sweep (the B1 failure mode) ==='
$bad = 0
foreach ($nm in @((Join-Path $sim 'node_modules'), (Join-Path $sim 'packages\client\node_modules'), (Join-Path $sim 'packages\runtime\node_modules'))) {
  if (-not (Test-Path $nm)) { continue }
  foreach ($e in Get-ChildItem $nm -Force) {
    if (-not $e.LinkType -and -not $e.Attributes.HasFlag([System.IO.FileAttributes]::ReparsePoint)) { continue }
    $target = $e.Target
    $ok = ($null -ne $target -and $target.StartsWith($sim, [System.StringComparison]::OrdinalIgnoreCase))
    if (-not $ok) { $bad++; Say ('  BROKEN/EXTERNAL junction: ' + $e.FullName + ' -> ' + $target) }
  }
}
Say ('external/broken junctions: ' + $bad)
if ($bad -gt 0) { Say 'SIM-FAIL: junction farm present'; exit 1 }

Say '=== A2: hermetic resolution probe (13 specifiers, createRequire anchored in sim) ==='
$probe = Join-Path $sim 'sim-hermetic-probe.mjs'
$probeBody = @'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { existsSync } from 'node:fs'
const ROOT = process.env.SIM_ROOT
const checks = [
  ['client', path.join(ROOT, 'packages', 'client', 'package.json'), ['@deepseek-ai/cordis','@deepseek-ai/dsh-client-locale','@deepseek-ai/dsh-client-store','@deepseek-ai/dsh-client-test-runtime','@deepseek-ai/dsh-client-ui-conversation','@deepseek-ai/dsh-client-ui-primitives','@deepseek-ai/dsh-client-ui-slots']],
  ['runtime', path.join(ROOT, 'packages', 'runtime', 'package.json'), ['@deepseek-ai/dsh-agent','@deepseek-ai/dsh-llm','@deepseek-ai/dsh-mcp-client','@deepseek-ai/dsh-session','@deepseek-ai/dsh-storage-domain','zod']],
]
let fail = 0
for (const [pkg, anchor, specs] of checks) {
  const req = createRequire(anchor)
  for (const s of specs) {
    let resolved
    try { resolved = req.resolve(s) } catch (e) { console.log('RESOLVE-FAIL ' + pkg + ' ' + s + ' ' + e.message); fail++; continue }
    const inside = resolved.startsWith(ROOT + path.sep) || resolved.startsWith(ROOT + '/')
    const file = inside && !s.includes('zod') ? existsSync(resolved.replace(/\.js$/, '')) || existsSync(resolved) : true
    if (!inside) { console.log('LEAKED ' + pkg + ' ' + s + ' -> ' + resolved); fail++ }
    else console.log('INSIDE ' + pkg + ' ' + s + ' -> ' + path.relative(ROOT, resolved))
  }
}
console.log(fail === 0 ? 'HERMETIC PASS (13/13 inside sim dir)' : 'HERMETIC FAIL (' + fail + ')')
process.exit(fail === 0 ? 0 : 1)
'@
Set-Content -Path $probe -Value $probeBody -Encoding utf8
$env:SIM_ROOT = $sim
node $probe 2>&1 | ForEach-Object { Say ('  ' + $_) }
$probeExit = $LASTEXITCODE
Remove-Item $probe -Force
Say ('hermetic probe exit=' + $probeExit)
if ($probeExit -ne 0) { Say 'SIM-FAIL: resolution leak'; exit 1 }

Say '=== A3: per-package tsc 9/9 ==='
$pkgs = @('contracts','domain','storage','runtime','tools','remote','client','legacy','testkit')
foreach ($p in $pkgs) {
  node (Join-Path $sim 'node_modules\typescript\bin\tsc') -p ("packages/$p/tsconfig.build.json") 2>&1 | ForEach-Object { Say ('  [tsc ' + $p + '] ' + $_) }
  $ex = $LASTEXITCODE
  Say ('tsc ' + $p + ' exit=' + $ex)
  if ($ex -ne 0) { Say 'SIM-FAIL at tsc ' + $p; exit 1 }
}

Say '=== step 4-5 (INSTALL.md 2.4/2.5): place-dist-glue + build-client-composition ==='
node (Join-Path $sim 'scripts\place-dist-glue.mjs') 2>&1 | ForEach-Object { Say ('  ' + $_) }
if ($LASTEXITCODE -ne 0) { Say 'SIM-FAIL at place-dist-glue'; exit 1 }
node (Join-Path $sim 'scripts\build-client-composition.mjs') packages/client packages/client/composition-shim 2>&1 | ForEach-Object { Say ('  ' + $_) }
if ($LASTEXITCODE -ne 0) { Say 'SIM-FAIL at build-client-composition'; exit 1 }

Say '=== A4: SHA-256 vs R122-verified world ==='
$pairs = @(
  @('packages/client/composition-shim/client-bundle.js', (Join-Path $ref 'client-bundle.js'), '2097CE5E'),
  @('packages/client/composition-shim/index.js', (Join-Path $ref 'index.js'), 'D385C065'),
  @('packages/client/composition-shim/package.json', (Join-Path $ref 'package.json'), 'B4509233'),
  @('packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs', 'packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs', 'D50D3B3F')
)
$allMatch = $true
foreach ($pair in $pairs) {
  $newPath = Join-Path $sim $pair[0]
  $newHash = (Get-FileHash $newPath -Algorithm SHA256).Hash.Substring(0, 8)
  $size = (Get-Item $newPath).Length
  $refSide = (Get-FileHash $pair[1] -Algorithm SHA256).Hash.Substring(0, 8)
  $tag = if ($newHash -eq $pair[2]) { 'MATCH' } else { 'MISMATCH' }
  if ($tag -eq 'MISMATCH') { $allMatch = $false }
  Say ('  ' + $pair[0] + ' : sim=' + $newHash + ' expected=' + $pair[2] + ' (' + $size + ' B) -> ' + $tag)
}
Say ('  ref world sanity: ' + (Get-FileHash (Join-Path $ref 'client-bundle.js') -Algorithm SHA256).Hash.Substring(0, 8) + ' (expect 2097CE5E)')
if (-not $allMatch) { Say 'SIM-FAIL: byte mismatch'; exit 1 }

Say ''
Say 'FRESH-CLONE SIMULATION: ALL ASSERTIONS PASS (A1 install+junctions / A2 hermetic 13/13 / A3 tsc 9/9 / A4 byte-identical 4/4 / A5 no farm)'
exit 0
