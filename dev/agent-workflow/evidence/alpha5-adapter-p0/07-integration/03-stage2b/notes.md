# stage2b notes (running log, append-only)

## run 2026-10-15T22-13-21 — attempt 0 (preflight)
- FATAL preflight: kit WORKTREE resolved 5 levels up instead of 6 (03-stage2b sits
  under dev/agent-workflow/evidence/alpha5-adapter-p0/07-integration). Error:
  `test-use not at baseline: undefined` (git ran in a non-existent dir). Fixed in
  p06-stage2b-kit.mjs (`resolve(KIT_DIR, up x6)`). No host was started.

## run 2026-10-15T22-13-33 — I1 PASS; I2 FAIL (blueprint), increments tail killed
- I1 PASS: cold boot :3185 (boot line x1, no-token GET / = 401, auth 303,
  p6t6 health ok=true, row state well-formed). DSH_HOME=tests/homes/a5p0-s2b-2026-10-15T22-13-33.
- I2a FAIL — original error (i2-team-create.json):
  MALFORMED_DTO: "permission rule $.members[0].capabilities.permissions.allow[1]
  (lane 'allow') is rejected: alpha.2 grants no positive whole-tool permission
  for bash — the allow lane must not carry a bash rule (no parameter-level allow
  for shell commands; use the ask or deny lane for { tool: bash, resource:
  { kind: 'any' } }) (source: a5p0-main.yaml)"
- I2b PASS (catalog.list). I2c/I2d/I3..I5 = never reached (create rejected; the
  waiting tail was terminated deterministically, job killed at ~4min into the L1 wait).
- FIX (kit-side, no product change): member allow lane = read:any only;
  ARM/DISPOSE token carriers ride the allowed `read` name via token-bearing
  file paths (a5p0-arm-<ARM_TOKEN>.txt / a5p0-dispose-<DISPOSE_TOKEN>.txt).
  Marker expectations shifted 1->2 (the arming call itself lands on the Adapter
  because assembly completes inside its pre-execute pass, before its dispatch).
- IMPACT RECORD: world `tests/homes/a5p0-s2b-2026-10-15T22-13-33` deleted after
  the run was killed (host pid was inside the job sandbox; port 3185 re-verified
  free = no response before re-run).
- Wait discipline (coordinator directive): every mock wait bounded 180s (was
  300s); timeouts land in run.log.

## mechanism pins (this round, for the report)
- Preset subtree CANNOT host the same-name assembly (same-layer registration
  collision + restrict() only names inherited names) — assembly rides the
  public `agent/created` event and lands on each agent's OWN scope
  (restrict-first -> register; the p01-fixture topology), sibling-inert.
- Model: mock staticModel provider=deepseek-official model=a5p0-model; harness
  session model = qwen3.8-flash-next (this agent).

## run 2026-10-15T22-21-48 — I2a FAIL (denyList team_* names)
- Typed error (i2-team-create.json, verbatim): "tools.restrict() names unknown
  global tools \"team_archive_member\", \"team_grant_permission\",
  \"team_revoke_permission\"; known global tools: bash, edit, read, read_image,
  write" → builtinToolDeny is scoped to the INHERITED surface; team tools are
  own-layer. Kit fix: denyList drops all `team_*`. World removed after kill.

## run 2026-10-15T22-32-37 — I1 PASS again; I2 loop → KIT OOM (exit 134)
- ROOT CAUSE (probe-wire-shape.mjs + wire-capture.json, this host generation):
  the model-request message array is ANTHROPIC-style: assistant tool calls are
  content blocks {type:'tool_use', id, name, input}; tool results ride a
  role='user' message as {type:'tool_result', tool_use_id, content:[…],
  is_error}. NO role='tool' messages exist. The c1-shaped oracle
  (role==='tool' counting) therefore stuck at count 0 and replayed
  create_member 1747 times (leader session step/start=1747; harness
  repeat-tool-call reminders fired but the ORACLE, not the model, drove the
  loop). Kit OOMed at the 2GB heap storing the corpus.
- Also pinned: the title-generation request prompt on this generation starts
  "Generate the session title from this JSON array of human messages:" (the
  c1 kit's "Create a concise title" guard does NOT match — oracle must guard
  on /session title/).
- Native read output characteristic (probe): "<path>…</path> <type>file</type>
  <content> 1: <line> … (End of file - total N lines) </content>".
- FIXES: toolMsgsOf→tool_result-block scan; toolResultText→block text; title
  guard 'session title'; discoverReadArgKey reads input_schema.properties;
  mock storm fuse (>300 requests fails the wait instead of looping to OOM).
- IMPACT RECORD: stray detached kit start (shell-& mistake) + its world
  a5p0-s2b-2026-10-15T22-40-12 killed/removed; sandbox pid1 kill affected only
  the ephemeral bwrap wrapper. Port 3185 re-verified free (000) before rerun.

## run 2026-10-15T22-44-01 — VERDICT PASS 10/10 (KIT_EXIT=0)
- Single boot: I1 | I2a-d | I3 | I4a/I4b | I5/I5z all PASS (summary.json).
  instanceIds inst-1kagruf11p51 / inst-03aqhii0jjnv; M1 agent
  session-team-child-8eda9cdaf455a3b8d5a264a6031e5f01.
- I5 typed result verbatim (turn tool_result + member session events seq38/47
  archived in i5-member-session-events.json): Error: unknown tool "read" —
  no native fallback (seed absent), marker file stays at 2 lines, plugin log
  "DISPOSED adapter=unregistered restrict=KEPT (safe-unload)".
- I5 kit fix this round = oracle off-by-one only (results ride the DONE
  request; pinned by run 22-40-27 artifacts — see run-*/i5-unknown-read.json).
- WORLD CLEANUP RECORD (TEST_METHODS §7): removed a5p0-s2b-2026-10-15T22-32-37,
  -22-40-27, -22-44-01 (all hosts already dead; full evidence retained in
  run-*/ dirs; i5-member-session-events.json extracted from the PASS world
  before removal). Pre-existing a5p0-boot/smoke/stage2 worlds (other steps,
  earlier today) left untouched.
- Post-run gates: port 3185 no response (curl 000); :3080 stable instance
  untouched (401 pre AND post, never connected otherwise); :3180 unreachable;
  test-use porcelain=0 @ 639ed015397290b3745d163aafe02ffee4aa3f84.

## h6 round 2026-10-15T23-00-51 — P0-6 GO-clauses legs (attempt 0 FAIL, attempt 1)
- New tooling: h6-kit.mjs + h6-adapter-plugin.mjs (single boot; legs H-A/H-B/H-C/H-D;
  mock decision table extended for 4 members + leader approval loop via
  [team-control requestId=] notifications -> team_list_pending_control ->
  team_resolve_control, all on the PUBLIC model-facing surface).
- attempt 0 (run-h6-2026-10-15T23-00-51) FATAL-by-legs: ALL 4 team_create_member
  calls rejected verbatim:
  `activation: child-session creation failed for member 'inst-...': RemoteError:
  h6-adapter (file:///.../h6-adapter-plugin.mjs): never started`
  ROOT CAUSE: h6-adapter-plugin.mjs imported `spawnSync` from 'node:fs' (it lives
  in 'node:child_process') -> module instantiation threw -> preset row fiber
  "never started" (agent-preset-registry/lib/invariant.js auditRows). node --check
  does not catch ESM named-export mismatches; the standalone `import()` repro did.
  Kit-side fix (no product change); host killed, world a5p0-h6-2026-10-15T23-00-51
  removed, port 3185 re-verified 000.
- attempt-0 side finding (kept): H2d sampled p6t6 liveSessions immediately after
  the leader DONE; async members join later -> now POLLED (<=180s cap).
- Verified BEFORE attempt 1 (recorded): @deepseek-ai/dsh-tool-fs-search is NOT in
  the smoke preset of the stage2b kit -> the h6 presets ADD the pinned package row
  { id: 'tool-fs-search', name: '@deepseek-ai/dsh-tool-fs-search' } (public row,
  same mount as the host's own standard preset) so native grep EXISTS as the
  control body; grep/glob are NOT managed names and the closed SAFE_UNMANAGED
  registry is ['todo_write'] only -> every strict template carries builtinToolDeny
  [glob,grep] (computed from the live L0 surface), and the Adapter registers
  same-name 'grep' on the agent's OWN layer ON TOP of the setup-time builtinToolDeny
  mask (the intended R1+R3 composition). The legacy (no-capabilities) control
  template carries the UNMASKED native grep.
- attempt 0 also pinned: leader chain 4x create+4x delegate completes in ~1.2s of
  mock time (in-process host+mock); member chains are what needs the 180s waits.
- attempt 1 (run-h6-2026-10-15T23-07-21) = 15/18 PASS (KIT_EXIT=2). Verbatims of the
  three failures + root causes (all kit-side; NO product issue found):
  1) HA-neg FAIL `wireSecretHits=5`: SELF-POLLUTION, not a leak — the kit's own M3
     step-4 grep PATTERN was the secret content marker, so the marker rode the
     wire as a tool_use INPUT (replayed in that chain's history 5x). The Adapter
     denied both private paths (neg1/neg2 verbatim `H6_ADAPTER_DENY ... outside-allowedRoot`,
     symlink included) and zero content bytes appeared as RESULTS. Fix (coordinator
     directive 1 adopted): script pattern -> query token; oracle layered:
     CONTENT-marker hits (must be 0) vs path-name echoes (disclosed, never FAIL);
     auto-dump ha-wire-secret-hunt.json on any content hit.
  2/3) HD-ask/HD-onshot FAIL `bashOutLines=-1`, results verbatim
     `Error: sandbox mode "workspace-write" is requested but no sandbox backend is
     usable on this host; refusing to run the command unconfined. Install
     bubblewrap or run a Landlock-enforcing kernel (Linux) ...` — the ask lane ITSELF
     fully worked (durable ledger: 2 bash control-request-recorded + 2 allow
     decisions + 2 control-allow-consumed; approvals driven browserlessly via the
     PUBLIC model-facing team_list_pending_control/team_resolve_control on leader
     notifications). Only the native bash BODY fail-closes on this host (no kernel
     bwrap/landlock — the known TEST_METHODS env constraint). EXECUTES-ONCE evidence
     therefore moves to the EDIT ask lane (in-process fs fence): MEM1 steps 9/10
     edit-chain (EDIT_APPLIED_1 can only be replaced after approval #1 EXECUTED it;
     file must end at EDIT_APPLIED_2), bash lane kept as consumed+env-disclosed.
     notif requestId capture switched to a notifOf() history sweep.
  Extra verbatims worth pinning (attempt 1): HC2 bash-call guard rejection
     `Error: permission denied: exec fingerprint sha256:5ad414cf... answered deny from the
     fallback` (self-registered bash NOT reachable; zero markers);
  HC3 register("run_code") rejection
     `tool name "run_code" is reserved for the PTC mode presentation transport and cannot be registered or shadowed`;
  HD-deny write rejection `Error: permission denied: write[...h6-deny-target.txt...]`
     (bytes unchanged, sha equal).
- attempt 2 (run-h6-2026-10-15T23-11-03) = 13/18. Ask-lane GOOD NEWS verbatim:
  durable ledger shows FOUR distinct requestIds (2 bash ctrl-0pjqk8r0gybi340nziynd02s /
  ctrl-1gkdjtx14qywk20n3t7sr16y, 2 edit ctrl-1n1xgl71u6q6fw16sd3rh1w0 /
  ctrl-17cvzc81wwsb8f0iqbm8u1wq), 4 allow decisions, consumed=4, 4 leader
  notifications captured — one-shot consumption per call CONFIRMED; the ask lane
  is fully drivable over the public model-facing approval tools (no browser).
  Two kit-side bugs (no product issue):
  1) self-inflicted case-shift: the pattern-fix edit accidentally renumbered M3
     cases 2/3 -> 3/4, so step (3) fell through and killed the M3 chain
     (`A5P0_M3_FALLTHROUGH tools=2`); cases restored to 0..4 (grep legs
     HB-adapter/HB-equiv/HB-neg were green in attempt 1 with exactly these steps).
  2) edit bodies returned verbatim `Error: cannot modify "....h6-edit-target.txt":
     file has not been read — read the file, then retry` — the host edit tool
     enforces a read-before-edit observation precondition (same discipline this
     harness itself applies). Fix: MEM1 reads EDIT_TARGET natively (step 2,
     PRE-arm, before the Adapter masks read); chain re-indexed to 11 results.
- attempt 3 (run-h6-2026-10-15T23-15-50) = **VERDICT PASS 18/18, KIT_EXIT=0**.
  Single boot @639ed01539 :3185, world a5p0-h6-2026-10-15T23-15-50 (deleted at
  teardown), assembly order OBSERVED without competition: preset mount(+pinned
  tool-fs-search row) -> builtinToolDeny setup restrict -> Coverage/Guard pass ->
  own-layer restrict-first + same-name registration inside the ARM call's own
  pre-execute pass -> dispatchable-coverage diffs -> Policy/Guard decisions.
  Leg summary (all PASS): H-A (R1 shadow, realpath+name fail-closed deny x2,
  wire CONTENT hits=0 vs path echoes=60 disclosed, ledger 2 OPEN / 2 DENY);
  H-B (grep Adapter impl=package-root over ctx.subprocess; multiset equality
  4==4 vs native control; deny-before-spawn x2); H-C (surface diff {bash};
  self-registered bash call guard-denied verbatim `Error: permission denied:
  exec fingerprint sha256:7c3a7728... answered deny from the fallback`, zero
  markers; run_code register rejected verbatim `tool name "run_code" is reserved
  for the PTC mode presentation transport and cannot be registered or
  shadowed`); H-D (write deny lane typed reject + bytes unchanged; ask lane:
  4 durable requests/decisions/consumptions through PUBLIC
  team_list_pending_control/team_resolve_control; EDIT executed exactly once per
  approval — file ends at EDIT_APPLIED_2 whose old-text only existed after
  approval #1 EXECUTED; one-shot CONFIRMED).
- Disclosed observations (NOT clause gates, per judgment contract):
  1) undeclared dynamic tool: register ok=true and BODY RAN (hc-dyn-observation
     .dynRan=true, dynCallResult='H6_DYN_RAN'; h6-result.json
     dynMarkerExists=false only because the marker lived in the deleted world and
     the qual existsSync ran post-teardown — hc-dyn-observation.json is the
     authoritative record). Runtime guard ABSTAINS on unmanaged names; the
     fail-closed line for undeclared names is the setup Coverage Gate
     (UNKNOWN_UNMANAGED is FATAL unless builtinToolDeny'd).
  2) own-layer same-name register of a builtinToolDeny-shielded name succeeds at
     the RUNTIME layer and re-lights the NAME on that member's own dispatchable
     surface (hc-m4-results m4Surfaces hasBash=true after registration); the
     CALL is still typed-denied by the guard (default-deny lane, exec fingerprint
     verdict) with zero execution — built-in body unreachable; name-level
     re-light is recorded as a finding.
  3) bash BODY env-block on this host: `sandbox mode "workspace-write" ... no
     sandbox backend is usable` (known TEST_METHODS env constraint); bash ask
     lane still recorded->allowed->consumed.
- Cleanup verified: :3185 curl=000; world a5p0-h6-2026-10-15T23-15-50 removed;
  tests/deepseek-harness-test-use porcelain=0 @639ed01539; :3080 pre==post=401
  (probe-only, never touched); zero product/host file writes; all evidence under
  03-stage2b/run-h6-* + h6-result.json + h6-KIT_EXIT.
