# P5-T6 DEFECT FIX (I1A crash-window) — fix note

**Task**: P5-T6 DEFECT FIX, attempt 3 of 3 (FINAL). **Worktree**: `.worktrees/P5-T6` (branch `task/P5-T6-member-residency`, base `3d59505a1c8161c2bb8b5257e072e1c94ccd59c0`).
**Incident note (attempt 3)**: a first worker instance produced all the code edits (uncommitted) and died before running any verification. This second (resuming) instance audited the uncommitted diff hunk-by-hunk against the locked design, corrected the ONE real deviation found (below, §6), and ran the complete verification chain to green in this single run.

## 1. Root cause

`createFreshMember` (packages/runtime/member-residency/fresh-member.ts) committed the durable
TeamDomain rows (MemberInstance `putMemberInstance`, then the `team-member` binding) while the
child DSH session's **on-disk artifact might not exist yet**:

- the upstream session persistence is lazy by construction — `createCore` records intent only,
  "No artifact until the first append" (references/deepseek-harness-test-use,
  `packages/session/session-persistence/src/coordinator.ts`, `createCore`);
- the first append lands through a **write-behind** queue whose publication of the final
  `session.jsonl.zstd` is asynchronous;
- the observed kill landed **~397 ms after the `putMemberInstance` fsync** (~1-in-5 runs),
  i.e. inside the window where the MemberInstance row was durable but the child artifact was
  not yet published.

A crash in that window leaves a durable MemberInstance referencing a child session with **no
on-disk artifact** — violating the DevPlan §18.5 settled state
(MemberInstance durable / Session durable / Agent residency ephemeral) and making cold resume
impossible (`resumeChildWithSetup` faithfully requires the persisted child).

## 2. The 18.5 invariant

DevPlan §18.5 settled state: **MemberInstance durable, Session durable, Agent residency
ephemeral**. The harness I1A precondition (`resumeChildWithSetup`: "child session is not
durable — a cold-resume scenario requires the persisted child") encodes exactly this and was
**NOT weakened** (byte-unchanged; verified by diff — the harness diff touches only
`makePorts` + the new `makeSessionDurability` + the new M1 must-assert).

## 3. Locked fix as implemented (per-file)

| File | Change |
| --- | --- |
| `packages/runtime/member-residency/types.ts` | New required port `SessionDurabilityPort` — single method `ensureDurable(childSessionId: string): Promise<void>`. Added to `MemberResidencyPorts` as **required** (`readonly sessionDurability`, not optional: a missing wiring is a type error — fail-loud). Interface docs pin the real public seam: upstream `sessionPersistence.ensureMaterialized(liveSession)` (the same call the upstream ACP row makes at session creation). |
| `packages/runtime/member-residency/fresh-member.ts` | New **unconditional step 3**: `await ports.sessionDurability.ensureDurable(childSessionId)` after the read-only root resolution (step 2) and **before the first durable write** (step 4 `putMemberInstance`). Unconditional on every path (fresh write, convergent replay, idempotent re-run). Fail-closed: a rejection propagates with ZERO durable writes (nothing has been put yet) and the binder never runs. Steps renumbered 1–6. Docstring CRASH-SAFE ORDERING now: **child artifact durable → MemberInstance → binding**, with the crash-point enumeration updated (a crash BEFORE the barrier leaves NO member rows — at most a possibly-orphaned EMPTY session artifact, diagnosable per DevPlan §17.4). |
| `packages/runtime/member-residency/harness/plugin.mjs` | (a) `makePorts` wires `sessionDurability: makeSessionDurability(ctx)`. (b) New `makeSessionDurability`: the REAL port over the upstream public seam — `ctx.get('sessionPersistence')` (fail loud when missing) + live agent resolution `svc.agents.get(SessionId(childSessionId))` (fail loud when absent; `agents.get` returns the bare `Agent`, whose `readonly session` IS the live session — verified in the upstream `AgentRegistry.get` / `Agent` contracts) → `await persistence.ensureMaterialized(agent.session)`. (c) **NEW M1 must-assert** (added by this resuming instance — see §6): after `createFreshMember` RESOLVES and BEFORE `modelSource.select`, the child's final artifact must exist **synchronously** on disk (`diskFilesFor`, no polling); a miss throws (the run cannot go green) and the report records the at-resolution evidence (projectDir + size). |
| `packages/runtime/member-residency/index.ts` | Exports `SessionDurabilityPort` (type-only re-export from `./types.js`); module doc updated. |
| `packages/runtime/member-residency/README.md` | `createFreshMember` behavior row now documents the barrier between root pre-check and the convergent durable commit. |
| `packages/runtime/test/p5t6-helpers.ts` | New shared mock `FakeSessionDurability` (`implements SessionDurabilityPort`): in-order `calls` recording + one-shot `failNextEnsureDurable(fault)`. `createMemberResidencyWorld`/`finishWorld` wire it into `world.ports.sessionDurability` and expose `world.durability` — so **every** fixture (fresh, cold, evict/readmit) gets complete ports through the shared helper; no cold/evict test builds its own ports object from scratch (all spread `world.ports` — audited). |
| `packages/runtime/test/p5t6-fresh-member.test.ts` | **S12** (3 tests): (a) fresh write — barrier strictly BEFORE the first durable write (call-order `barrier → putMemberInstance → putSessionBinding`); (b) idempotent re-run — barrier UNCONDITIONAL (awaited again, `wrote=false`, zero durable writes); (c) convergent replay — barrier BEFORE the record re-put (the recovery write). **S13** (1 test): barrier rejection ⇒ the error propagates, `writeCalls=[]`, member record count 0, `surfaceCallCount=0` (binder never runs). |

**Real-seam verification (upstream, read-only)**: `session-persistence/src/coordinator.ts`
`ensureMaterialized(session)`: `await this.flush(session)` (flushes ALL pending write-behind
batches) → if `state.materialized` return (idempotent no-op) → else
`backend.materializeHeader(meta)` (temp-write + fsync + publish of `session.jsonl.zstd`) and
mark materialized. The resume/load path (`commitPrepared`) sets `materialized: true`, so a
resumed session makes the barrier a pure flush no-op — which is why the I1A replay path
(resumed child) is unaffected. Upstream ACP row: `await persistence.ensureMaterialized(record.agent.session)` (packages/acp/acp/src/index.ts) — the identical call.

## 4. Why the harness was NOT weakened

- The I1A precondition in `resumeChildWithSetup` ("the persisted child") is **byte-unchanged**
  (not in the diff). It still fails loud when the child artifact is missing — it faithfully
  encodes 18.5.
- The new M1 must-assert is an **ADDITION**: it asserts the postcondition at the moment
  `createFreshMember` resolves (synchronous, no polling). Before the fix, M1's only durability
  evidence came from `waitForDurable` (250 ms polling up to 30 s) — which would MASK the
  publication race. The must-assert is what turns the ~1-in-5 flake into a deterministic red.
- The I1c assertion "the ONLY durable write is the binding put (the record pre-existed)" is
  unchanged and stays true: the barrier performs a sessionPersistence operation, NOT a
  TeamDomain write — `writeLog` (the TeamDomain audit channel) is untouched by it.

## 5. Verification highlights (full detail in run-log.txt + harness-runs/1..3)

- Unit suite: **929 passed / 0 failed** (925 pre-change + 4 new S12/S13 tests). p4t6 negative
  control green — **258** scannable files unchanged (no scannable file added; DEC-1 note not
  triggered, the one assertion left alone).
- tsc: storage/domain/contracts/runtime all EXIT=0.
- Harness x3 serialized (shared DSH_HOME `references/.dsh-test-p5t6` wiped+recreated per run;
  ports 3180/3181/3491–3495 free before each run and released after each):

| run | summary.pass | I1A | I1c (only write = binding put) | I1a window (waitMs) | I1B setup-fail code | M1 must-assert | ports released |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | true | pass (5/5) | pass (6/6) | observed, 555 | SCHEMA_VERSION_MISMATCH | pass (size 317) | odd+even+mcp = true |
| 2 | true | pass (5/5) | pass (6/6) | observed, 435 | SCHEMA_VERSION_MISMATCH | pass (size 321) | odd+even+mcp = true |
| 3 | true | pass (5/5) | pass (6/6) | observed, 401 | SCHEMA_VERSION_MISMATCH | pass (size 316) | odd+even+mcp = true |

- **I1B expected-fail confirmation** (unchanged, original reason): the I1B boot's row setup
  fails LOUD with `setup-failure.json` `code=SCHEMA_VERSION_MISMATCH`,
  `error="team_domain is persisted at schema version null; this TeamDomain supports version 1
  and has no built-in migration"` (persisted unit corrupted pre-boot, version 1 → 999; the
  corrupted file is byte-unchanged after the failed boot). This is the EXPECTED failure of the
  scenario — the harness asserts that exact code and goes green when it arrives.
- Frozen-doc SHA-256: all 4 MATCH (Architecture / UI / DevPlan / TaskDoc).
- Stable dev instance :3080 probed before AND after every leg: status 200, untouched.
- test-use tree pristine before/after every harness run (head `cd5ef8148158c3a752a658978873241fdf8e2bbc`).

## 6. Audit outcome (resuming instance)

Hunk-by-hunk audit of the uncommitted diff (7 files, +354/−27) against the locked design:

- **6 of 7 files matched the design exactly** (types.ts port; fresh-member.ts unconditional
  step-3 barrier + renumbered steps + CRASH-SAFE ORDERING; harness makePorts wiring +
  fail-loud makeSessionDurability; index.ts export; README row; test S12/S13 + shared
  FakeSessionDurability with failNextEnsureDurable; cold/evict fixtures covered by the shared
  helper — no self-built ports objects anywhere).
- **ONE real deviation found and fixed**: the locked design's **new M1 must-assert** (harness
  plugin.mjs — "after createFreshMember resolves and BEFORE modelSource.select, the child
  final artifact exists synchronously on disk (no polling)") was **missing** from the
  predecessor's edits (the diff there contained only the makePorts wiring +
  makeSessionDurability). Fixed minimally: the synchronous `diskFilesFor` check + throw
  inserted between `createFreshMember` resolution and `modelSource.select` in `runFreshMember`,
  plus one report assertions entry carrying the at-resolution evidence. No other line touched.
- Hygiene: erasable TS (no enums/namespaces/parameter properties), NodeNext `.js` extensions on
  all relative imports, no `node:` builtin imports in any `.ts`; `node --check` on plugin.mjs
  clean; the `residencyAgents`-vs-`svc.agents` wiring nuance: the predecessor resolves the live
  agent through the public `agents` service (`svc.agents.get(...)`, which returns the bare
  `Agent` whose `session` is the live session) rather than the harness-private
  `residencyAgents` map — functionally the same handle in every scenario (both registries are
  populated by `ensureFreshChild`/`resumeChildWithSetup`) and the public registry is the
  authoritative one; accepted as-is (documented, not a defect).

## 7. Flake closure

The defect was observed ~1-in-5 (kill ~397 ms after the `putMemberInstance` fsync). With the
barrier in place, `createFreshMember` cannot resolve until the child artifact is durable, so
the I1a kill window (record written, binding not) now ALWAYS co-exists with a durable child
artifact; the M1 must-assert additionally fails any run where the artifact is not on disk at
resolution. 3 green runs here + 2 independent main-agent reruns = 5 green runs closing the
flake window.
