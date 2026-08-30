# P6-T5 Run Log — activity ledger (Class B)

Task: P6-T5 activity-ledger — telemetry (subject / status / summary /
correlation / last action / RUNNING intervals) as a **projection feed only**;
never workflow authority.
Branch: `task/P6-T5-activity-ledger` (worktree `.worktrees/P6-T5`).
Base HEAD: `4fa5d1254d2ba9f1b5afface40c76963177271b2` (clean at start).

## STEP 0 — environment (COMPLETE)

- Worktree created at `.worktrees/P6-T5` on `task/P6-T5-activity-ledger`;
  `git status` clean at base.
- `pnpm install --ignore-scripts` — completed (41 s).
- Stable dev instance self-check (BEFORE): `http://127.0.0.1:3080` → HTTP 200
  (recorded in `baseline-run-0.txt` header; `D:/deepseek-harness/` untouched).
- Ports 3180/3181 and 3491-3495 left free (no real-instance harness started).

## STEP 1 — baseline (COMPLETE)

- `node scripts/run-tests.mjs` full run: **1080 passed, 0 failed, 1080 total,
  2729 ms** — `RESULT: PASS run-tests (0 failures)`. Full output in
  `baseline-run-0.txt`.
- `node node_modules/typescript/bin/tsc -p packages/runtime/tsconfig.json` →
  exit 0 (baseline).

## STEP 2 — frozen docs provenance (COMPLETE)

- Verified the 4 frozen 20260829 plan docs' sha256 against the task-given
  values: **ALL MATCH** (Architecture / UI Design / Development Plan / Task
  Decomposition). See `provenance` notes in this evidence dir; the cross-check
  of `file-manifest.json` frozen_docs hashes was completed — all match.
- Read (frozen, read-only): TaskDoc §11.7 (P6-T5 card), DevPlan §19.5
  (telemetry field set; MUST NOT become WorkflowState/DAG/completion
  authority), Architecture §1.4/§14 (TeamDomain authority; member record
  carries activity summary/version), §18 (crash consistency), §42 invariants
  (18/19 instanceId-first, 26 ActivationProvider sole creation, 36/37
  envelope/self-escalation, 41 TeamDomain authority, 42 no legacy Team
  SessionEvent vocabulary, 44 TeamLedger order), UI Design §15 (timeline:
  bar = RUNNING activity interval, multiple bars per lane, archive keeps
  history) and §25 (activity/progress: structured progress, current/last
  action, correlation; does not own DAG/completion).

## STEP 3 — research findings (COMPLETE)

Key facts established from the read-only sibling surfaces:

1. **Facade** (`runtime/action-router/router.ts`):
   `createTeamRuntime(options).performAction(request)`, documented order:
   validate → instanceId-first target → caller identity+role → authority+
   envelope → compat gate (new work only) → quota (ActivationProvider only) →
   durable effects under the runtime's own per-team lock.
   `report-progress` spec: category COORDINATION, ops `[report-progress]`,
   `instanceTargeted: true`, factType `team-coordination-recorded`, NO
   `roles` restriction (every live caller role passes the role gate; the
   fixture's team envelope allows `report-progress` for the leader, and the
   worker/scout template envelopes allow it too).
   The REPORT_PROGRESS effect persists ONLY the known payload fields
   (`progress`, `decision`, `reason`, `summary`) into the audit fact —
   extension fields ride the documented payload extension seam
   (`admission/actions.ts` L332-334) but are not persisted by P6-T2.
2. **Leader role derivation** (`admission/resolve.ts` L250): role is the
   fixed identity — `instanceId === LEADER_INSTANCE_ID` (`'inst-leader'`,
   `contracts/src/identity.ts`) → `leader`, else `member`; humans are `human`.
   Stale (DISPOSED/ARCHIVED) caller records → CALLER_ROLE_STALE.
3. **Envelopes** (router docs L26-29): leader → team envelope; member →
   template ∩ team ∩ instance overlay; human → not team-envelope-bound.
4. **TeamLedger** (`storage/repositories/ledger.ts`): `allocateSequence()`
   (atomic counter row, serialized on the domain write chain), `put(entry)`
   requires a pre-allocated `sequence <= counter` (duplicate → error),
   `list()` synchronous durable read.
5. **Frozen contracts**: `MemberInstanceRecordDto` carries `activityVersion`
   (positive integer); member records are append-only, written once by the
   ActivationProvider — P6-T5 READS member records only and writes ONLY
   ledger facts. No `activityVersion` bump is attempted (nothing rewrites a
   member record; that is the P7-T3 lifecycle surface).
6. **Test infra**: plain-node runner; shim matchers `toBe`/`toEqual`/
   `toBeGreaterThan`/`toThrow` (+ `.not`); NO async `it()` — module-scope
   top-level-await setup, synchronous assertions. `restartP6T1World` closes
   the domain and re-opens the repositories on the same scratch dir (unit-
   level restart semantics).
7. **p4t6 scanner**: scans all `.ts/.mts/.mjs` under `packages/**`; baseline
   count 286; my 12 new files (6 modules + 6 tests) → 298.

## STEP 4 — design decisions (DOCUMENTED SEMANTICS)

1. **Rows**: activity rows ARE TeamLedger entries with the closed fact
   vocabulary `activity-progress-recorded` / `activity-interval-opened` /
   `activity-interval-closed` (kebab-case, scanner-safe, ≤128 chars).
2. **Subject**: `(rootSessionId, instanceId, subject-string)`.
3. **Out-of-order guard — REJECT policy** (chosen, documented, tested):
   every write carries a claimed per-subject `sequence`; the durable head =
   max sequence among the subject's durable activity facts; the write
   admits `claimed === head + 1` exactly and rejects otherwise with
   `ACTIVITY_SEQUENCE_STALE`, `details.kind` = `'stale'` (claimed ≤ head) or
   `'gap'` (claimed > head+1). A stale update can never overwrite newer
   state; a gap is never silently filled.
4. **RUNNING interval model** (multiple simultaneous intervals): at most ONE
   open interval per `(instanceId, subject, correlation)`; DIFFERENT
   correlations (and different subjects) coexist simultaneously → multiple
   bars per lane (UI Design §15). open-while-open →
   `ACTIVITY_INTERVAL_ALREADY_OPEN` (typed); close-without-open →
   `ACTIVITY_INTERVAL_NOT_OPEN` (fail closed, typed). Re-open after close is
   a new work unit under the same correlation (both pairs kept for history).
5. **Status vocabulary**: the closed P6-T2 `PROGRESS_VALUES`
   (`in-progress | completed | blocked`) — no invented authority fields.
   A subject's `status` in the projection is the latest PROGRESS fact's
   value ONLY; interval facts never change status (their `progress` field is
   audit context carried in the durable payload).
6. **Write path** (`createActivityLedger({teamDomain, runtime, now?})`):
   (a) input validation (typed `ActivityError`); (b) reporter rule
   pre-check (zero side effects, BEFORE the facade); (c)
   `runtime.performAction({action: 'report-progress', ...})` — the facade
   enforces addressing / caller identity / envelope / live target and
   commits its `team-coordination-recorded` audit fact (authorization
   evidence); (d) under the ledger's OWN per-team lock
   (`withTeamLock` from `action-router/effects.js`), re-read the durable
   head + interval state, enforce the sequence guard + interval guards,
   `ledger.allocateSequence()` + `ledger.put(...)` the structured activity
   row.
7. **Reporter rule** (documented + enforced pre-facade): a member caller
   may report ONLY for its own instance; the leader (fixed id
   `inst-leader`) may report for ANY live instance; a human caller is
   rejected (`ACTIVITY_UNAUTHORIZED_REPORTER`). Full caller identity /
   role-staleness / target liveness remain the facade's enforcement (no
   duplication): unknown caller → CALLER_NOT_FOUND, stale caller →
   CALLER_ROLE_STALE, unknown target → INSTANCE_NOT_FOUND, non-work-
   accepting target → WORK_STATE_REJECTED.
8. **Crash window** (documented): the facade audit commit and the activity
   row commit are two serialized critical sections with a window between
   them. A crash there leaves a `team-coordination-recorded` audit fact
   (carrying action/caller/target/progress/summary/at) without its
   structured row — detectable (audit count vs durable head) and repairable
   (re-report at the re-read head+1; the guard admits it because the head
   never moved).
9. **Projection seeds** (pure, deterministic): `projectSubjectFromRows` /
   `projectTeamFromRows` map durable rows → the frozen UI Design field
   names (status / summary / correlation / lastAction / openIntervals /
   closedIntervals / sequence). Ordering is ALWAYS by the durable TeamLedger
   sequence (invariant 44); `createdAt` timestamps are display labels only
   (startedAt / closedAt / lastProgressAt / lastFactAt).
10. **No workflow authority** (structural): the module imports nothing that
    mutates lifecycle; its public API is the closed set
    `{recordProgress, openInterval, closeInterval, listActivityFacts}`;
    a dedicated negative test asserts the API surface and projection key
    sets are closed and expose no lifecycle-mutating call. Old legacy task
    rows are a PRESENTATION reference only (see `projection.ts` header) —
    no legacy vocabulary is re-imported.

## STEP 5 — implementation (COMPLETE)

Wrote `packages/runtime/activity/` (types, errors, facts, projection,
ledger, index — 6 module .ts) + `packages/runtime/test/p6t5-*.ts`
(p6t5-helpers + 5 suites — 6 test .ts) + the p4t6 count update
286 → 298 (title + enumeration comment + both count assertions).

Test fixes made during the first tsc/test iterations (all in my owned
surface only):
- TS2540 batch: conditional-spread refactors in `facts.ts`
  (parseActivityFact row build) and `projection.ts` (closed/open interval
  note fields, subject projection, instance label/templateId); `readonly`
  dropped from the top-level fields of the five test `*Results`
  interfaces (nested types unchanged).
- TS2322: `buildActivityEntry` payload typed `RemoteSafeRecord` (from
  `../../contracts/src/index.js`).
- TS2532: `audits[0]?.payload['caller']` under noUncheckedIndexedAccess.
- Shim matcher: `toBeUndefined()` → `toBe(undefined)` (the plain-node shim
  only ships toBe/toEqual/toBeGreaterThan/toThrow).
- Global-sequence model corrected in the tests: the P6-T2 facade audit
  fact commits BEFORE the activity row, so activity rows sit at EVEN
  global sequences (restart suite: pre-restart rows [2,4,6,8,10]; the
  post-restart close row is global 12, its audit 11). Per-subject
  `sequence` semantics unchanged (the guard uses activity rows only).
- Facade error-code values are prefixed: `TEAM_RUNTIME_INSTANCE_NOT_FOUND`,
  `TEAM_RUNTIME_CALLER_ROLE_STALE` (asserted values corrected).
- The unknown-instance MUST-TEST now uses the LEADER caller (leader-any
  passes the pre-facade reporter rule; the facade's own target resolution
  then rejects). A member reporting for an unknown other-instance is
  caught earlier by the reporter rule (ACTIVITY_UNAUTHORIZED_REPORTER) —
  documented ordering.
- Frozen subject key set assertion sorted (`subject` before `summary`).

Actual new-test count: **49** (progress 14 + intervals 9 + restart 6 +
authority 12 + projection 8) — the earlier 47 estimate was low by 2
(progress suite carries 14 `it` blocks, not 12).

## STEP 6 — verification round 1 (end of implementation, COMPLETE)

All steps executed in the worktree; exact outputs captured:

1. `pnpm install --ignore-scripts` — done in STEP 0 (no manifest changes
   since; node_modules current).
2. `node scripts/run-tests.mjs` (all 9 packages):
   **1129 passed, 0 failed, 1129 total, 2345 ms** —
   `RESULT: PASS run-tests (0 failures)` (1080 baseline + 49 new).
   Full output: `tests-run-1.txt`.
3. `node node_modules/typescript/bin/tsc -p packages/runtime/tsconfig.json`
   → exit 0; `... -p packages/testkit/tsconfig.json` → exit 0
   (the only two packages touched; contracts/storage/etc. untouched).
4. Self-check diff (vs base `4fa5d12`): `git status --porcelain` shows
   ONLY — M `packages/testkit/test/p4t6-session-event-scan.test.ts`,
   ?? `packages/runtime/activity/`, ?? `packages/runtime/test/p6t5-*.test.ts`
   (6 files), ?? `dev/agent-workflow/evidence/P6-T5/`. Zero-core,
   owned-boundary clean; no sibling surface (messaging*/control*),
   no frozen path, no forbidden file touched.
5. Stable dev instance self-check (AFTER): `http://127.0.0.1:3080` →
   HTTP 200.

## STEP 7 — commits (COMPLETE)

- Commit 1 `61644c811c4940f4e7cd2231b5a39230d335264e`
  `feat(runtime): P6-T5 activity ledger — durable per-member telemetry
  with RUNNING intervals, out-of-order REJECT guard, and pure UI
  projection seeds (no workflow authority)` — 13 files (12 new + p4t6
  glue), 3415 insertions.
- Commit 2 `02246a5b232b79d1e10d4f3e7b8484d4388b422c`
  `docs(evidence): P6-T5 evidence (baseline, verification round 1, run
  log)` — 3 files. No push (task branch stays local).

## STEP 8 — verification round 2 (after the final commit, COMPLETE)

1. `pnpm install --ignore-scripts` → exit 0.
2. `node scripts/run-tests.mjs` (all 9 packages): **1129 passed, 0
   failed, 1129 total, 2392 ms** — `RESULT: PASS run-tests (0
   failures)`. Full output: `tests-run-2.txt`.
3. `tsc -p packages/runtime/tsconfig.json` → exit 0;
   `tsc -p packages/testkit/tsconfig.json` → exit 0.
4. Self-check diff vs base: 16 files, all inside the owned surface
   (6 activity modules + 6 p6t5 test files + 1 p4t6 glue + 3 evidence
   files); zero-core, no sibling surface, no frozen path. The p4t6
   scanner `session-event-scan.mjs` and
   `contracts/src/legacy-vocabulary.ts` verified BYTE-IDENTICAL to the
   base via git blob hash
   (`5c026f57…` / `252210a3…` on both sides).
5. Stable dev instance self-check (END): `http://127.0.0.1:3080` →
   HTTP 200. Ports 3180/3181 and 3491-3495 were never occupied (no
   real-instance harness run).

Note: this final append (plus `tests-run-2.txt`, produced after
commit 2) is left UNCOMMITTED by design — the final commit cannot
contain its own SHA.

## FINDINGS (for the main agent)

- Orphan audit facts: a guard rejection (stale/gap/already-open/
  not-open) occurs AFTER the P6-T2 facade has already committed its
  `team-coordination-recorded` audit fact, so the durable ledger can
  hold audit facts without a matching activity row. This is the
  documented crash-window shape — detectable via fact-type scan,
  repairable by re-reporting at re-read head+1. Such orphans DO count
  in `entryCount()`; pre-facade rejections (input validation, reporter
  rule) have ZERO side effects.
- Ordering is serialized in two critical sections (facade audit commit,
  then the activity guard+commit) under the same per-team lock — no
  interleaving between members.
- Display labels: `createdAt` comes from each fact's own injected
  clock; across a restart the clock resets, so a spanning interval can
  show `closedAt` earlier than `startedAt` while the durable order
  (globalSequence) is always correct. Tested in the restart suite.
- Extension-seam usage: `op/subject/sequence/note/closeNote` ride the
  P6-T2 documented REPORT_PROGRESS payload extension seam; P6-T2
  persists only its known fields in the audit record.
- Reporter-rule ordering (pre-facade): member self-report / leader-any /
  human rejected; a member reporting for an unknown other-instance is
  ACTIVITY_UNAUTHORIZED_REPORTER (never reaches the facade); the
  unknown-instance facade code is reachable via a leader report.


