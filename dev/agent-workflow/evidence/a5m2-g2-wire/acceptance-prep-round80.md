# A5M2-G2-WIRE round-80 — minimal REAL source-Host acceptance PREPARATION (root signed 8cafba959; no Browser launch GO)

Status law (root, this card's premise): wiring CLOSED at
8cafba9593d526dcaa2b8320b98d4dafd807e7fc (armed skips the old browser
loader; SDK Client independent; pair/half-pair/provenance cards not
reopened). UNTESTED-over-Host = wiring-not-yet-exercised-on-a-live-host,
47/73 author-controls are non-Host. What follows is ONLY what the real
acceptance window needs — reused facts, zero new harness, zero installs,
zero launch.

## 1. Fixed candidates for the window (pick one deployment condition — LAW: they are DIFFERENT conditions, never mixed)
(A) SOURCE-639 source-Host window — the full public chain, native TS:
- instance: 639 root `package.json:202` `node --import tsx/esm
  apps/cli/src/bin.ts` (entry bin.ts:1); port 3180-family (TEST_METHODS;
  :3080 DEV instance untouchable).
- browser worker then takes the TS branch IN-TREE
  (worker-client.ts:27-31 registers tsx/esm/api then imports worker.ts) —
  the exact environment the one-time no-boot probe proved (PROBE_RC=0:
  public './src/*' specifiers resolve to src/launch.ts + src/worker-client.ts).
- DSH_HOME: `tests/homes/<world>` INSIDE the workspace (workspace-write
  law); profile must enable the experimental stagehand plugin BEFORE the
  window (registration = ctx.tools census of the six names,
  A5_G2_BROWSER_MOUNT_NAMES @team-tool-plane.mjs:180).
(B) NPM-STYLE fixture window:
- `tests/homes/a5m2-sched-c2-dry-2026-10-23T22-56-05-203ZZ/install-c8dd3f07b`
  — center-audited FACT (final lock sha256 dad670ae74…b35217a; cold import
  of `dsh-agent-team/host` NODE_RC=0; 12-peer 0.2.0-rc.2 closure).
  CONDITION TO CONFIRM AT WINDOW TIME (center owns the audit; this lane
  does NOT re-audit): whether the experimental browser plugin + its SDK
  deps are present in that fixture's node_modules; if absent, condition
  (A) is the only Browser-capable window.

## 2. Approved config the window must carry (REAL shape, native.ts:34-48 @639ed01539 — VALUES are root/user approvals, never minted by this lane)
`planeCfg.g2BrowserEnabled=true` + `planeCfg.g2Browser={mode,
nativeConfig}` with NativeBrowserConfig fields: `model:
StagehandModelConfig` (explicit model credentials — the ONLY credentials
crossing workerData, worker-client.ts:20 law), `mode:'launch'|'attach'`,
`cdpEndpoint?` (attach: REQUIRED string, port refuses to invent),
`extensionId?`, `executablePath?` (launch: the recorded Chrome fact
`/usr/bin/google-chrome` = Google Chrome 154.0.8037.92 is the ONLY
host-verified candidate; playwright chromium-1228 exists as workspace
fact, never launched by this lane), `headless`, `operationTimeoutMs`.
Plus `g2Mount.browser` arming (producer ask) and, for MCP co-arm,
optionally `sdkClientEntry` (independent load law, 8cafba959).

## 3. What the window exercises end-to-end (all legs CODE-COMPLETE, legs' laws cited in browser-prep-round73/source-entry-round74)
producer resolve (public './src/*' or approved entryPaths, provenance
RECORDED) -> assembly SINGLE SOURCE (identity) -> mount port
(createG2TeamBrowserPort entries law) -> lease -> launchChromium/
openBrowserWorker REAL acquisition -> execute(method,args,signal) rows ->
per-session PA approval (consumedProof edge). Census pre-check: the six
stagehand_* via public `agentCtx.tools.get` (bindings readG2Native
pattern @agent-bindings.mjs:3690).

## 4. The ONLY remaining blockers (no code gap in this lane)
1. Host window GO (boot + launch licenses) — root currently: none.
2. Window condition choice (A)/(B) with (B)'s plugin-presence confirmation
   (center-side, this lane won't re-audit).
3. Approved nativeConfig VALUES (model creds + mode/headless/timeout
   decisions) — approval act, not engineering.
Nothing else is missing: no installs, no harness, no clones needed or
performed. All fixtures/facts above are EXISTING and cited.
