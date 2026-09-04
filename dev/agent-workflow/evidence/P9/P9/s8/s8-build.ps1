# S8-A build: P9 dists from tip 683e15a (sanctioned chain only: node tsc).
$wt = 'D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\P9'
$ev = 'D:\AgentDev\dsh-plugins\dsh-agent-team\dev\agent-workflow\evidence\P9\s8'
New-Item -ItemType Directory -Force $ev | Out-Null
Push-Location $wt
try {
  "=== S8 build $(Get-Date -Format o) ===" | Out-File $ev\build-00-header.log -Encoding utf8
  # 0. junction bridge (idempotent)
  node $ev\ensure-links.mjs 2>&1 | Tee-Object $ev\build-01-links.log | Out-Null
  $l0 = $LASTEXITCODE
  # 1. legacy dist (single shared dist tree with runtime)
  node node_modules\typescript\bin\tsc -p packages\legacy\tsconfig.build.json 2>&1 | Tee-Object $ev\build-02-legacy.log | Out-Null
  $l1 = $LASTEXITCODE
  # 2. runtime dist (fresh host.js)
  node node_modules\typescript\bin\tsc -p packages\runtime\tsconfig.build.json 2>&1 | Tee-Object $ev\build-03-runtime.log | Out-Null
  $l2 = $LASTEXITCODE
  # 3. glue: byte-identical .mjs copy at its dist location (tsc never emits .mjs)
  $gs = "packages\runtime\src\plugin\live\agent-bindings.mjs"
  $gd = "packages\runtime\dist\packages\runtime\src\plugin\live\agent-bindings.mjs"
  if (-not (Test-Path $gs)) { "GLUE_SRC_MISSING" | Out-File $ev\build-04-glue.log -Encoding utf8; $l3 = 99 }
  else {
    New-Item -ItemType Directory -Force (Split-Path $gd) | Out-Null
    Copy-Item $gs $gd -Force
    $h1 = (Get-FileHash $gs -Algorithm SHA256).Hash
    $h2 = (Get-FileHash $gd -Algorithm SHA256).Hash
    "glue sha256 src=$h1 dist=$h2 identical=$($h1 -eq $h2)" | Out-File $ev\build-04-glue.log -Encoding utf8
    $l3 = if ($h1 -eq $h2) { 0 } else { 98 }
  }
  # 4. import probe: dist host loads under plain node (junctions wired)
  $hostJs = "file:///D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P9/packages/runtime/dist/packages/runtime/src/plugin/host.js"
  node -e "import($([char]39)$hostJs$([char]39)).then(m => console.log('LOADED name=' + m.name)).catch(e => { console.error('PROBE_FAIL ' + e.message); process.exit(1) })" 2>&1 | Tee-Object $ev\build-05-probe.log | Out-Null
  $l4 = $LASTEXITCODE
  # 5. client dist (plain tsc ESM, the S8 composition input)
  node node_modules\typescript\bin\tsc -p packages\client\tsconfig.build.json 2>&1 | Tee-Object $ev\build-06-client.log | Out-Null
  $l5 = $LASTEXITCODE
  # 6. client dist layout (for the bundle adapter)
  Get-ChildItem packages\client\dist -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName.Substring($wt.Length + 1) } | Set-Content $ev\client-dist-layout.txt -Encoding utf8
  "links=$l0 legacy=$l1 runtime=$l2 glue=$l3 probe=$l4 client=$l5" | Out-File $ev\build-07-summary.log -Encoding utf8
  "DONE links=$l0 legacy=$l1 runtime=$l2 glue=$l3 probe=$l4 client=$l5"
} finally {
  Pop-Location
}
