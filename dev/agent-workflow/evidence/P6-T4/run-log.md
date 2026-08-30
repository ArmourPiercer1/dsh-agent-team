# P6-T4 run log (incremental)

Worker: P6-T4 leaf worker (attempt 1 of 3). Task: P6-T4 Control/approval (Class A).
Branch: task/P6-T4-control-approval (worktree .worktrees/P6-T4).

## STEP 0 — first reads (done)
- Read docs/ROUTER_RULES.md in full (156 lines).
- Read docs/TEST_METHODS.md in full (68 lines).
- Pre-start stable-instance self-check: `Invoke-WebRequest http://127.0.0.1:3080` -> `PRE_START_3080_STATUS=200`.

## STEP 1 — worktree (done)
- `git worktree add .worktrees/P6-T4 -b task/P6-T4-control-approval 4fa5d1254d2ba9f1b5afface40c76963177271b2` -> exit 0, "HEAD is now at 4fa5d12 docs(evidence): P6-T2 evidence chain-2 outputs + run-log final append (left uncommitted by worker, R40 main-agent close)".
- `git -C .worktrees/P6-T4 rev-parse HEAD` -> `4fa5d1254d2ba9f1b5afface40c76963177271b2` (matches required base).
- `git -C .worktrees/P6-T4 status --short` -> empty (clean), exit 0.
- `pnpm install --ignore-scripts` -> exit 0 ("Done in 23.3s using pnpm v11.7.0", resolved 150, reused 150, downloaded 0).
- Baseline `node scripts/run-tests.mjs` (full, 9 packages):
  `run-tests (plain-node vitest-equivalent): 1080 passed, 0 failed, 1080 total, 28068 ms` / `RESULT: PASS run-tests (0 failures)` / TESTS_EXIT=0.
  (Full tail captured in baseline-tests.txt.)

## STEP 2 — frozen docs hash verification (done)
Computed (PowerShell Get-FileHash SHA256, lowercase) vs required vs frozen_docs in
dev/agent-workflow/evidence/provenance/file-manifest.json (lines 44-47):
- TaskDoc  DSH_Agent_Team_vNext_Task_Decomposition_and_Review_Method_20260829.md
  2b457cc033ca1b72aa781e072e0ef7fe55bc05d2f7ea25cc03c827d257e888a3  == required == manifest  OK
- DevPlan  DSH_Agent_Team_vNext_Detailed_Development_Plan_20260829.md
  a05d237f8515fd6467373632849afe0c6a1ae63bc0ec298de63b9d124d881d0f  == required == manifest  OK
- Arch     DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md
  030dfb8ec55bae30f35c2826c7e4e659c0e0b742d836018ce502f34017870c53  == required == manifest  OK
- UI       DSH_Agent_Team_vNext_Detailed_UI_Design_20260829.md
  3ef3ab69ed2bd7879e4c15079a16c8dae456b572690246a5c1f9cbb0c8c4981e  == required == manifest  OK
All four match the task-specified hashes AND the tracked file-manifest.json frozen_docs section. No DOCS_HASH_MISMATCH.

## Frozen sections read (full reads)
- TaskDoc 11.7 (P6) incl. P6-T2/P6-T4 cards and G6 method (lines 1438-1562).
- DevPlan 19 (19.1-19.7) + 19.6 tool contract + §14/15 Public Seam Characterization
  (seam table: pre-execute -> "future operation 可 last-mile veto" ->
  CORE_SEAM_BLOCKER:TOOL_GUARD) — the characterized TOOL_GUARD seam my guard
  composes with in P6-T6.
- Architecture: §1.4 (runtime mutability authority/lifecycle), §14 (TeamDomain
  durable authority, 14.3 A-G incl. G TeamLedger "control request / decision",
  14.4 no cross-table ACID), §18 (provisioning crash consistency, 18.2 stable
  operation identity, 18.3 recovery), §25 (Control: 25.1 purpose, 25.2
  ControlRequest fields, 25.3 Decision durable/instance-addressed/not tool
  execution, 25.4 no approval bypass of External Hard Policy), §42 invariants
  1-67 (esp. 18/19 instance identity, 26 provider, 34/36/37 authority, 41
  TeamDomain durable authority, 45 in-process registry not durable authority,
  46 crash windows, 51-56 lifecycle).

## Existing surfaces studied (read-only)
- packages/runtime/admission/** (P6-T2): closed action vocabulary incl.
  request-control / resolve-control (COORDINATION, ops request-control /
  resolve-control, instanceTargeted, fact team-coordination-recorded);
  resolveTeamAndTarget(repositories, catalog, request, spec),
  resolveCaller(repositories, root, caller),
  callerEnvelope(blueprint, caller, overrides) (human -> ALL_MUTATION_OPS;
  leader/member intersect team/template/overlay, fail closed),
  enforceEnvelope(spec, envelope) -> ENVELOPE_OUT_OF_BOUNDS,
  RUNTIME_OPS (request-control / resolve-control op names),
  TeamRuntimeError + TEAM_RUNTIME_ERROR_CODES (facade raises these during
  resolution; my module surfaces them unchanged).
- packages/runtime/action-router/effects.ts: request-control/resolve-control
  effects are GENERIC coordination facts (payload: action/caller/
  targetInstanceId/decision/reason/requestToken/at) — the durable typed
  ControlRequest/ControlDecision rows + allow-once + stale + external hard
  policy + tool guard are P6-T4's job (documented division of labor).
- packages/storage/repositories: TeamDomain facade (8 repos);
  LedgerRepository: allocateSequence()/put({schemaVersion, sequence,
  rootSessionId, factType (1..128 chars, no ws/control), payload
  (RemoteSafeRecord), operationId?, createdAt})/get/list/gaps/entryCount —
  the append-only durable fact ledger is the persistence vehicle for the
  control rows (no new store: packages/storage is not owned by P6-T4 and the
  P4 schema is frozen; Architecture 14.3 G lists "control request / decision"
  as TeamLedger coordination facts).
- packages/domain/policy: ExternalPolicyFacts { hard:
  Partial<Record<CapabilityName, PolicyEntry>>, capabilityExists:
  Partial<Record<CapabilityName, boolean>> }; PolicyEntry =
  {kind:'allow',items} | {kind:'deny'}; capability domains model/tools/
  permissions/skills/mcp (closed); capabilityExists:false denies the cell for
  every layer (invariant 35); stage-2 external intersection is the hard
  boundary human overrides may not exceed (invariant 34).
- packages/runtime/test/p6t1-helpers.ts: P6T1World (real TeamDomain over
  scratch dir FileStorageSeam, real catalog, mock-first ports, seedMembers
  with lifecycle override), restartP6T1World (close + new seam over same
  dir + openTeamDomain + fresh provider = the unit restart model),
  destroyP6T1World.
- packages/testkit/fault-injection/session-event-scan.mjs (frozen; NOT
  modified): walks packages/*/ for .ts/.mts/.mjs (skips node_modules/dist),
  excludes only the scanner + p4t6-*.test.ts; exact-quoted-literal denylist
  (team/control-request etc.) — my kebab factType strings and type names are
  denylist-safe (no `team/` quoted literals, no Team*Data symbols).
- packages/testkit/test/p4t6-session-event-scan.test.ts: current assertion
  filesScanned === 286 (title "286 files scanned", enumeration comment
  lines 66-79). My branch adds 11 new .ts files -> 297 (verified by re-run
  before committing; the two sibling P6 workers update the same test from the
  same base; main agent converges at integration).

## Design decisions (documented; see packages/runtime/control/index.ts)
1. Durable rows: ledger facts control-request-recorded /
   control-decision-recorded / control-allow-consumed (append-only;
   state-first/evidence roll-forward recovery per Architecture 18.3).
2. Scope model: (rootSessionId, targetInstanceId, actionName,
   toolName?, capabilityDomain?, correlation) — correlation is the stable
   logical-operation token (the requestToken); request idempotency key =
   (root, targetInstanceId, actionName, toolName|absent, correlation)
   (Architecture 18.2; a retried/duplicate request returns the existing row;
   a NEW attempt after an allow is consumed needs a NEW correlation -> a new
   request, no reuse).
3. Stale semantics: RESOLVE-time staleness (target DISPOSED/terminal or
   team session vanished when the decision is being recorded) records a
   durable stale-denied decision and throws CONTROL_REQUEST_STALE — the
   request is closed and can never become an allow (fail closed; the
   append-only ledger has no "mark" primitive, so the decision row IS the
   mark, with a distinct closed value). REQUEST-time unknown target is the
   facade's typed addressing/team error (INSTANCE_NOT_FOUND /
   TEAM_SESSION_NOT_FOUND / ...), zero durable rows; request-time DISPOSED
   target is CONTROL_TARGET_STALE (zero rows). No side effects in either
   stale path.
4. External hard policy: an `allow` resolution first probes live
   externalPolicyFacts; the operation's capability cell
   (capabilityDomain ?? (toolName ? 'tools' : none)) is deny- or
   allow-list-checked (capabilityExists:false denies; hard deny denies;
   hard allow-list must contain the toolName; no named item under an
   allow-list denies — fail closed). External deny records a durable
   decision 'deny' with reason 'external-policy' and throws
   CONTROL_EXTERNAL_POLICY_DENIED — even a human/leader allow fails closed
   (Architecture 25.4, invariant 34).
5. Tool pipeline last-mile guard: exported `guardOperation` on the service
   (and re-exported as a plain function `checkControlToolGuard`); the
   control module NEVER executes tool operations. P6-T6 wiring: the tool
   registration for a control-gated operation must call the guard BEFORE
   the DSH tool pipeline executes the operation (the characterized
   pre-execute / TOOL_GUARD seam, DevPlan §15), with the operation scope +
   the correlation of the pending control request; execution proceeds only
   on verdict allowed:true (the guard atomically consumes the allow under
   the per-team lock — check-and-reserve). No upstream private seam
   needed: the guard is Team-side composition over public surfaces
   (public-seam alternative realized; no CORE_SEAM_BLOCKER).
6. Facade integration (never around): requestControl/resolveControl reuse
   the P6-T2 facade's exported authority steps verbatim —
   resolveTeamAndTarget (instanceId-first, invariant 18/19), resolveCaller
   (identity+role, invariant 37), callerEnvelope+enforceEnvelope over the
   closed RUNTIME_OPS request-control / resolve-control ops, the
   TeamRuntimeError vocabulary, and withTeamLock per-team serialization.
   Resolver role closure: leader-approval -> {leader, human};
   user-approval -> {human} (the leader cannot stand in for the user);
   envelope-mutation -> {leader, human}; a MEMBER resolver is rejected
   (CONTROL_RESOLVER_NOT_AUTHORIZED) even when the template envelope
   allows resolve-control (no self-approval, invariant 37). A leader
   resolver still needs resolve-control in the team envelope (enforced via
   the facade envelope). The facade's own request-control/resolve-control
   actions remain the admission-evidence path; the control tools (P6-T6)
   route the durable control plane through this module.

## STEP 3 — implementation complete (done)

- Control module `packages/runtime/control/` implemented per the design
  decisions above: `errors.ts`, `types.ts`, `service.ts`, `index.ts`.
  Public seam = the exported `guardOperation(scope)` verdict method; the
  module NEVER executes tool operations; no upstream private seam needed
  (public composition suffices — NO CORE_SEAM_BLOCKER).
- Test harness `packages/runtime/test/p6t4-helpers.ts` (world/service/
  callers/scope/fake-pipeline/raw-fact/external-policy fixtures) plus
  SIX suites, 32 `it`s total:
  - p6t4-allow-once.test.ts (4)
  - p6t4-deny.test.ts (3)
  - p6t4-stale.test.ts (5)
  - p6t4-restart.test.ts (3)
  - p6t4-external-policy.test.ts (6)
  - p6t4-negatives.test.ts (11)
- Test pattern of this repo (the plain-node shim): async scenarios at
  MODULE level (top-level await, captured into `let` vars), `it` bodies
  pure SYNC assertions. Shim constraints confirmed: `it` must be strictly
  synchronous (thenable → recorded failure); matchers exactly
  toBe / toEqual / toBeGreaterThan / toThrow (each .not).
- p4t6 minimal glue: `packages/testkit/test/p4t6-session-event-scan.test.ts`
  expected count 286 → 297, verified by an actual scan run
  (eventString 15, all quarantined; payloadSymbol 0; declarationMerge 0).
  The scanner script itself is byte-identical (unmodified).
- No changes to contracts, read-only deps, core, or any non-owned path.

## STEP 4 — debugging and fixes (done)

1. Shim fold logic (root-caused the phantom +19 tests of the first full
   run): assertions recorded INSIDE an `it` fold into that one `it`
   record; assertions recorded OUTSIDE any `it` (module-level `expect`)
   remain standalone counted entries named `<assertion>`. Rule for this
   repo: NEVER call `expect` at module level.
2. Latent control-service bug: `deterministicToken` was used in
   `requestIdOf` but never imported → `ReferenceError` on the first
   `requestControl` (masked in earlier runs because async `it` bodies
   swallowed the rejection into a dangling promise). Fixed: import from
   `../../storage/provisioning/index.js`.
3. Scratch-dir leak: crashed async tests left `.tmp-fault/p6t4-rs-{1,2,3}`
   → next `createTeamDomain` over the stamped dir throws
   `team_domain already exists`. Deleted the three dirs; rule: after any
   mid-scenario crash, clean `.tmp-fault/p6t4-*` before re-running.
4. `FakeToolPipeline` blocked branch now propagates verdict identity
   (`requestId` / `decisionSequence`) exactly as the service verdict
   matrix returns them.
5. stale scenario 2: the guard checks TARGET LIVENESS BEFORE request
   state, so a still-DISPOSED target yields `target-stale` (not
   `request-stale`) even when a stale-denied row exists; `request-stale`
   is observable once the target is live again (scenario 3). Test
   corrected to assert TARGET_STALE (title + comment updated).
6. negatives scenario 11: the `executedAfterDrift` capture was taken
   AFTER the exact-scope execution (measured 1 instead of 0). Moved the
   capture to immediately after the drifted execution. A temporary debug
   suite had already proven the SERVICE correct (drifted →
   scope-mismatch block, no consumption; exact → allowed, 1 execution);
   the debug suite was deleted after use and its scratch dir verified
   gone.
7. tsc strictness (runtime tsconfig: strict + noUncheckedIndexedAccess +
   verbatimModuleSyntax) — first `tsc -p` run found 9 errors, all fixed:
   - `service.ts`: `actionSpecOf` returns `ActionSpec | undefined` →
     `closedActionSpecOf()` narrowing helper (same fail-closed semantics,
     per-spec message); `unconsumedAllows[0]` → explicit `undefined`
     guard (unreachable invariant throw).
   - tests: five raw `guardOperation` verdict captures were typed
     `FakeToolExecution` → `ControlGuardVerdict`; `.reason` access
     narrowed through the discriminated union (`if (v.allowed === false)`).
   - Result: tsc runtime exit 0, testkit exit 0 (evidence files
     `tsc-runtime-final.txt`, `tsc-testkit-final.txt`; the pre-fix output
     kept as `tsc-runtime-before-fix.txt`).
8. No module-level `expect` remains in any p6t4 file; no temp/debug file
   remains in the tree.

## STEP 5 — verification pass 1 (end of implementation) (done)

- `node scripts/run-tests.mjs runtime` → 332 passed, 0 failed, 332 total
  (runtime-tests-final.txt)
- `node scripts/run-tests.mjs` → 1112 passed, 0 failed, 1112 total
  (baseline 1080 + 32 new; full-tests-final.txt)
- `tsc -p packages/runtime/tsconfig.json` → exit 0;
  `tsc -p packages/testkit/tsconfig.json` → exit 0
- `node scripts/verify-zero-core.mjs --host
  …/references/deepseek-harness-test-use --json` → RESULT: PASS
  (findings: 0; zero-core-verify.txt)
- git audit: only owned paths (`packages/runtime/control/`, the six
  `p6t4-*` test files + helper) and the declared p4t6 glue are modified;
  zero changes under references/, packages/contracts/, read-only deps,
  docs/plans, graph.yaml (git-status.txt, git-diff-stat.txt)
- stable instance self-check: http://127.0.0.1:3080 → 200
  (selfcheck-3080-post.txt)

## STEP 6 — commits + verification pass 2 (after final code commit) (done)

- Commit 1 (code + tests + declared p4t6 glue):
  `72cfdc5b37f314d37da3db1e3b5527a3705bf862`
  `feat(runtime): P6-T4 durable ControlRequest/Decision + last-mile tool guard`
  (12 files, +4924/−4; nothing outside the owned paths).
- Verification pass 2 on the committed tree (post-Commit-1):
  - `node scripts/run-tests.mjs` → 1112 passed, 0 failed, 1112 total
    (full-tests-pass2.txt)
  - tsc runtime exit 0 (tsc-runtime-pass2.txt), tsc testkit exit 0
    (tsc-testkit-pass2.txt)
- Commit 2 (this evidence directory): `docs(evidence): P6-T4 evidence` —
  SHA recorded below after creation.
- Post-final-commit verification pass 3 (full chain re-run after
  Commit 2) is performed AFTER this commit is created and is recorded in
  the uncommitted final append (the final commit cannot contain its own
  SHA); see leftover_uncommitted in the structured report.

## STEP 7 — final state + verification pass 3 (post final commit) (done)

- Commit 2 (this evidence): `c9330d7cf8d56f7049eead2d2f7a1172a13248be`
  `docs(evidence): P6-T4 evidence` (15 files, +550).
- Branch `task/P6-T4-control-approval` now: `72cfdc5` (code+tests) →
  `c9330d7` (evidence). Working tree clean after Commit 2.
- Verification pass 3, executed AFTER the final commit on the committed
  tree:
  - `node scripts/run-tests.mjs` → 1112 passed, 0 failed, 1112 total
    (full-tests-pass3.txt)
  - tsc runtime exit 0 (tsc-runtime-pass3.txt), tsc testkit exit 0
    (tsc-testkit-pass3.txt)
  - stable instance self-check: http://127.0.0.1:3080 → 200
    (selfcheck-3080-final.txt)
- This STEP 7 block, the pass-3 evidence files, and the two new
  self-check/tsc pass-3 files are necessarily UNCOMMITTED (a commit
  cannot contain its own SHA); the main agent may fold them into the
  Gate record as-is (they are append-only evidence, no code).
