# PR-F F.6 Final test battery — real-host record（20-scenario floor + long-ish smoke）

**Tree**: folded = `feat/pre-alpha3-prf-closure`. The three fresh real-host runs below
executed with `packages/` @ `3b7039e8` (increment-1 tip) — `git diff 3b7039e8 830e7aae
-- packages/` = **EMPTY** (verified), so the tested product code is byte-identical to
the branch tip `830e7aae`; the PR-F kit itself was uncommitted at rerun-2 time and
committed as `830e7aae` (kit + evidence + record only).

**Evidence sets (all fresh, all 2026-09-30, sequential single-writer host runs,
ports 3182-3186/3491-3493/3497 released after each run, :3080/:3180 zero-touch,
test-use pristine @ `46a7f68b0922` before+after in every run)**:

| run | world / evidence | verdict | world state |
|---|---|---|---|
| E.12 kit 16/16 | `dev/agent-workflow/evidence/pre-alpha3-refactor/pr-e/prereq-2026-09-30T03-07-57/` (run.log + 28 scenario captures + api-transcript + git-pre/post) | `VERDICT: PASS — all 16 criteria green (14 scenarios + hygiene)` | cleaned per PASS protocol |
| F15 kit 10/10 | `dev/agent-workflow/evidence/f15-mcp-live-loss/f15-2026-09-30-03-12-56/` (run.log + 15 captures) | `VERDICT PASS — passed [PREF, C0, C1, C2, R1, R2, R4, R5, R3, H1] failed []` (scrubbedFiles=4) | cleaned per PASS protocol |
| PR-F kit rerun-2 11/11 | `dev/agent-workflow/evidence/pre-alpha3-refactor/pr-f/prf-2026-09-30T06-09-07/` + `prf-rerun2.log` | `VERDICT: PASS — all 11 criteria green (G1-G9 + H1/H2); world cleaned` | cleaned per PASS protocol |

(Rerun-1 `prf-2026-09-30T05-58-47` = the FAIL of record [G2+G4 kit-side, both
root-caused + fixed in `830e7aae`]; its world is RETAINED inspect-only at
`tests/homes/prf-2026-09-30T05-58-47/` [gitignored]; evidence retained in
`pr-f/prf-2026-09-30T05-58-47/`.)

Static / package + full unit-integration half of F.6: increment-1 record
(static 8 gates green; full root suite = exact 9F|19F baseline identity; p6t1
isolated reruns ≥5 per F.6 独立多次复跑 — see `p6t1-ab-attribution/AB-ATTRIBUTION.md`).
This record covers the **real-host** half (plan F.6 L1087-1122).

## 20-scenario mapping (plan F.6 L1089-1110, verbatim scenario labels)

| # | scenario (plan text) | fresh folded-tree evidence |
|---|---|---|
| 1 | normal Alpha.2-style team create/delegate | E.12 S1 (post-consent create PROCEEDS; delegate EXECUTED doneWitness=true, pendingControlRequests=0) + F15 C1 (v1 envelope + initialWork, path=fresh-root, 200) + prf G1 (v2 team create; delegate g1 EXECUTED, worker web pong + DONE) |
| 2 | Governance mutation + restart | prf G2 (v7 override two-writer guard: g1=2 → g2=3; FIRST writer stale expectedGeneration=g1 → typed OVERRIDE_GENERATION_CONFLICT + zero write; **restart durable**: override.get after restart = still gen 3 with the second writer's 4-item values) + F15 R4 (human-override record admitted, team scope; policy deny disposes fiber, surface WITHDRAWN, delegate still admitted — policy deny is not loss) |
| 3 | PolicyState + restart | prf G3 (policyState.get bound team: stateId default, availableTransitions = bound blueprint CLOSED SET [paused] — not the boot anchor; set(paused): changed transition entryId=ps-paused-0 + durable policy-state-transitioned fact, read=paused; set(bogus-state): typed POLICY_STATE_UNKNOWN zero write; get(foreign root): typed TEAM_REMOTE_FOREIGN_TEAM) |
| 4 | multi-MCP A/B healthy C down | prf G4 all-up (g4a EXECUTED, real web pong + DONE) + C-down pre-boot stop (probe: team.mcp.repo + team.mcp.leaderreq still PASS — A/B isolation; delegate ADMITTED at the team-scope gate [W3-A cold-member not-applicable] then CLOSED TYPED TEAM_RUNTIME_COMPATIBILITY_BLOCKED, zero durable effect [members 0→0, incidents 0→0, deny decision recorded]; web slot {materialization failed, attempts 1, reason "mcp-client(mcp_web): initial connection or tool synchronization failed"} — exact E.12 S7 shape) |
| 5 | MCP restore | prf G4c (restore: g4c EXECUTED — web auto-mounted at the fresh reconcile; NO recovery incident at the restored boundary; pendingSeen=0 incidents=0) + E.12 S8 (next boundary NORMAL: follow-up EXECUTED with no recovery correlation/dispatch; mcp_web MOUNTED attempts=1 + wire pong; recovery-incident-closed fact; **no durable recovery flag** — session row + ledger carry no stored recovery state) + F15 R3 (mount-failure recovery: B1 single mount attempt [failOnStartupError production path]; B2 30s cooldown skip — no hot retry; B3 remount attempts=2, mount-restored telemetry EXACTLY once, gate OPEN, worker settles) |
| 6 | startup optional consent | E.12 S1 (pre-consent team.create REFUSED typed COMPATIBILITY_BLOCKED {outcome consentRequired, consentRequiredRequirementIds [lead.mcp.signal]} + ZERO durable effect [no row]; B1 durable consent grant with host stopped; post-consent create in the SAME world PROCEEDS — the grant decides) + S2 (auto-degraded: optional mcp MISSING [unconfigured supply axis] → delegate EXECUTED, no control request; durable consent fact readable with exact payload) |
| 7 | startup required template disable | E.12 S3 (template disable → gateReason templateDisabled — availability, not a policy denial [negative #9]) + S4 (disable cannot bypass: admitInitialWork STILL blocked requiredScopeDown [team] — team scope independent of template availability) + S11 (disable persists after 8 restarts on fresh evaluation) |
| 8 | Team-level required outage Recovery | E.12 S5 (leader required MCP down → team scope BLOCKED [blockedScopes [team], downedCapabilitySubjects [mcp_leaderreq]] → recovery-incident-opened scope team) + S4 post-boundary (the settled outage is typed FATAL {COMPATIBILITY_BLOCKED, BLOCKED_FATAL, gateReason requiredScopeDown, source requirement-gate, controlDecision deny}) |
| 9 | Leader Recovery + Human reviewed dispatch | E.12 S9 (exact reviewed payload recovery-dispatch/v1: reducedAuthority + effect + kind + inline + correlation; reviewPayloadDigest == sha256(canonicalJson(reviewPayload)) recomputed) + S6 (human-reviewed recovery ALLOW → work EXECUTED on the reduced original authority [W3 helper created]; incident-opened scope team) |
| 10 | affected Member controlled bash recovery | E.12 S7 (degraded member: read + bash tool calls witnessed in the worker turn; recovery KEEPS bash ASK [negative #2] — a non-recovery approval request opened, kit allowed it, work completed) |
| 11 | cancel approval → durable abandoned | E.12 S10 abort leg (zero-effect block after the 120s host tool-timeout seam — AbortError envelope, elapsed 120413ms; control-request-abandoned durable fact [reason wait-aborted]; later ALLOW on the abandoned request REJECTED as terminal [CONTROL_REQUEST_ABANDONED — "can never become an allow"]) |
| 12 | v1 frozen Blueprint cold resume | E.12 S13 (frozen v1 under PR-E code: registry contentHash AND team_sessions blueprint hash == pre-PR-E constant sha256:6a7fba9f… [byte-exact]; B2 cold resume: T13 listed + projection works, projErr=none) |
| 13 | v2 Blueprint create/resume | F15 C0 (catalog.get resolves the v2 blueprint; intent.probe req-f15-mcp outcome=PASS status=OPEN — row environmentFacts seed feeds the pre-create unknown live verdict) + C1 (v2 create) + prf G1 (v2 team create runs; per-template requirements honored) + E.12 S1 (v2 create under the consent gate) |
| 14 | persona `ptc` regression | E.12 S12 (live standard observed → HONEST OPEN: probe(T9) persona PASS + T9 created + delegate EXECUTED; live bare preset → NO false open: admitInitialWork BLOCKED, fresh evaluation FATAL PERSONA_INCOMPATIBLE [the PR #22 typing, no `complete` fact present]; ptc absent → durable team-scope aggregate BLOCKED_FATAL counts.fatal=1) + prf G5 (ptc mounted: probe lane PASSES [status OPEN, team.persona.standard PASS — U5 caller-only lane]; GATE lane: team.create REFUSED typed TEAM_RUNTIME_COMPATIBILITY_BLOCKED outcome fatal fatalRequirementIds [team.persona.standard] — the PR-F-G5 finding of record) |
| 15 | dual Team isolation | E.12 S14 (fresh world T2: per-root state initialized disjoint, delegate EXECUTED; under T's outage: T2 delegate STILL EXECUTED while T is in a blocked-scope incident — the probe is host-wide, the durable gate state is per-root) |
| 16 | spill ArtifactReadGrant regression | prf G6 (the real spill, PR#35 pattern: v1 team.create + initialWork on the leader-only spill team [bash allow-lane + exec token + permissions policy + 19-unmanaged deny] runs one 300KB-stdout bash → 64KiB early-spill → stdoutSpillPath → **artifact-read-granted durable fact** grants=1 settleMs=3 shape=true) |
| 17 | Remote v1–v6 compatibility [v1–v7 per the corrected wording] | prf G7 (v1..v7 × stable read set all accepted; projection v<6 base vs v>=6 durableGeneration+liveToken; gated methods served at their own version [listRoots v3, getReadState v6, resolveControl v4]; the v7-only expectedGeneration param rejected on the v6 wire, typed) |
| 18 | browser Team tab / ledger / pending review | prf G8 (the tab data surface: GET / 200; v6 getReadState (worker session) = the member read state; v6 getProjection = durableGeneration+liveToken; the bash ASK opens a durable control request [the pending-review surface] → resolveControl allow → work DONE; askFacts=1 allowDecision=true pendingBash=1) |
| 19 | current surface includes possible `subagent` but forbidden runtime action remains fail-closed where applicable | prf G9 (strict worker WITHOUT the unmanaged deny set: team.create proceeds, the first delegate FAILS CLOSED typed [the A2C-2 coverage gate], the uncovered-tool witness carries `subagent_fork`, zero durable member instance) + E.12 S10 (terminal abandoned control request — the control plane fails closed on the abandoned lane) |
| 20 | no upstream modification | zero-core: H1 in ALL THREE runs (test-use pristine @ `46a7f68b0922` before AND after — porcelain empty, diff empty, head unchanged) + F15 PREF/H1 (same, plus stable instances probed unchanged, kit ports free at preflight) + static 8 gates (increment-1) + explicit product scope: increment-1 delta = F11/A'/admission-typed (recorded); increment-2 `git diff` packages/ = EMPTY |

Coverage: **20/20 scenarios each have fresh folded-tree evidence** (no scenario is
served by pre-fold evidence alone; the pre-fold runs remain the no-move reference,
this set is the on-tree proof).

## Long-ish unattended smoke (plan F.6 L1112-1122, verbatim bullets)

The plan marks this "建议至少运行一个模拟长期 Team" (recommendation floor). The
**single E.12 fresh world** (`prereq-2026-09-30T03-07-57`) IS one simulated long
team — boots B1→B8 (8 restarts), one world, ~4-minute real-host window: consent
refusal → grant → create → delegate → optional-missing auto-degrade → worker-down
outage → human-reviewed recovery (ALLOW + DENY + abort) → restore → 8× restart
with seeded facts → persona lanes. Each of the 7 bullets maps to fresh evidence:

| plan bullet | evidence |
|---|---|
| optional MCP 在运行中 down/recover | F15 R1 (transient blip mid-run: zero mcp-client supervisor lines in the outage window [the streamable-http signature]; post-restore tool call succeeds pong:beta through the SAME fiber; surface visible throughout; fiber NOT recycled [attempts=1]; zero capability facts) + E.12 S2 (optional mcp missing [supply axis] → auto-degrade, work executes) |
| normal work 不中断 | F15 R1 (work continues through the blip; model-facing surface visible throughout) + E.12 S14 (T2 work executes while T is in a blocked-scope incident) |
| telemetry 完整 | F15 R3-B3 (mount-restored telemetry EXACTLY once + the mount-restored observation) + R2 (the permanent-loss finding captured verbatim — zero spurious lines, ghost call model-visible) + E.12 S8 (incident-closed durable fact + NO durable recovery flag — telemetry = durable facts, nothing fabricated) + prf G2/G3 (governance mutation + policy transition both land durable facts with entryIds) |
| required MCP down → Recovery | E.12 S5 (team scope BLOCKED → recovery-incident-opened [team, team.mcp.leaderreq]) + F15 R3-B1 (mount-time failure on the production failOnStartupError path — single attempt, one mount-failed telemetry line) |
| Human recovery | E.12 S9 (human-reviewed dispatch payload + digest recomputation) + S6 (ALLOW → reduced-authority work executed) + S10 (both other human lanes: DENY → typed zero-effect; abort → durable abandoned — the review surface is exercised in all three outcomes) |
| restore → Normal | E.12 S8 (next boundary NORMAL, MOUNTED + wire pong, incident closed, no flag) + F15 R3-B3 (remount succeeds, gate OPEN, delegate admitted, worker settles, final leader ping proves pong:delta end-to-end) |
| restart 后恢复 durable consent/governance，但 readiness fresh probe | E.12 S11 (BOTH seeded facts [consent + disable] readable in the T ledger after all 8 restarts; readiness RESET — no mounted mcp slot survives the boot [live state ephemeral, unknown until the next boundary re-probes]; the team-scope compatibility aggregate RECOMPUTED across boots [fresh recordedAt, status matches the B8 world]) + prf G2 (the governance override is still gen 3 with the second writer's values after the restart) + F15 R5 (restart before the first boundary: NO fabricated mcp slot, witness+slots ephemeral, zero new capability facts) |

## Evidence roles (the three distinct read-sets, as required)

1. **FULL set** (what the zero-new gate reads): the full root suite run on the
   folded tree = failure set exactly the 9F|19F recorded baseline (no new
   failures); real-host = the three fresh runs above (all green).
2. **ISOLATED set** (what the known-debt rule reads): p6t1-parallel isolated
   reruns (≥5 per F.6 独立多次复跑) — failures confined to the P1/P2/P3 debt
   families; datasets 1/2/3/3b in `p6t1-ab-attribution/`.
3. **DATASET-3/3B** (what the A/B exoneration reads): base-tree `0a0a19a6`
   loops — base-run05 (ds3b) = P2 by direct observation ⇒ exoneration; P3
   base-only (ds3 base-run2).

Red lines for this battery: sequential host runs with port release between runs;
FAIL worlds retained inspect-only; evidence token-scrubbed (F15 scrubbedFiles=4;
kit finalizer scrubs each world); :3080/:3180 read-only probes only (401/401 ==
401/401 in the prf run); single writer; zero product diff in increment-2.
