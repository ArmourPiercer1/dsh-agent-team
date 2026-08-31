# P7-T7 G7 gate report — Legacy Team Session read-only reader

Task: P7-T7 (R48), branch `task/P7-T7-legacy-session-reader`,
worktree `.worktrees/P7-T7` (HEAD at attempt start
`c53f1b008d59b803f51d2c107ffffb7846a8bb9c`).

Deliverables under test:

- **A** — `packages/legacy/session-reader/**` (types.ts, errors.ts,
  format.ts, inspect.ts, index.ts): pure-TypeScript, zero-core
  (no `node:` import in any `.ts`), strictly read-only legacy Team
  Session metadata reader behind an injected `LegacyHomePort`
  (`listDir`/`readFile` only); best-effort (absent metadata degrades to
  native Chat/Trajectory — never throws); every non-`inspect` action
  rejected with the typed error `LEGACY_READER_MUTATION_REJECTED`.
- **B** — in-process suites `packages/legacy/test/p7t7-*.test.ts`
  (78 tests) covering all nine G7 criteria (DevPlan §20.7), each with
  the reader threaded through as an isolated observer so every suite
  also proves read-only isolation (legacy home snapshot + port-op audit
  `assertOnlyReadOps`).
- **C** — real-instance E2E `packages/legacy/session-reader/e2e/**`
  (run.mjs, plugin.mjs, mini-mcp.mjs, fs-seam.mjs, ts-loader.mjs):
  boots the PRISTINE test-use DSH (pin `cd5ef814`), mounts the reader
  as one cordis row, and drives three scenarios (L1 legacy view,
  L2 mutation rejection, L3 native degradation) against the live home.

## Evidence chain (shared by all criteria)

| item | result | evidence |
| --- | --- | --- |
| baseline full suite | 1510/1510 | `attempt1-baseline.log` |
| post full suite (in-process, final) | **1588/1588, 0 failures** (+78 p7t7) | `attempt1-post.log` |
| tsc | contracts=0 domain=0 storage=0 runtime=0 testkit=0 | `attempt1-post.log` |
| testkit focus (incl. p4t6 legacy-vocabulary scanner, 10 tests) | 124/124 | `attempt1-post.log`, re-verified on final tree: `final-testkit-rerun.log` |
| p4t6 file counts | 394 → 411 countable files (legacy 4 → 21; 17 new) | p4t6 suite in testkit run |
| zero-core (`node:`/`require(` in `packages/legacy/**/*.ts`) | 4 hits, all comments, no imports → PASS | `zero-core-log.md` (+ final-tree re-grep) |
| real-instance e2e, run #3 | **PASS** — L1 17/17, L2 11/11, L3 7/7 | `harness-output/summary.json`, per-scenario JSON, `run.log`, `e2e-run3.log` |
| e2e collateral safety | ports 3180+3491 released; `:3080` 200 before AND after; test-use tree pristine (head `cd5ef814…`, status/diff empty) before AND after | `harness-output/summary.json` |

E2E run history (all within attempt 1; details in `attempt-ledger.md`):
run #1 exposed harness bug A (fixture-planting tuple destructuring in
this task's own driver); run #2 exposed harness bug B (host's
zstd-configured session backend rejects pre-existing plain `.jsonl`
artifacts at cordis init → fixtures now planted post-boot). Both fixed
in owned harness files; run #3 fully green.

---

## 1. `warning/fatal admission semantics`

Evidence: `packages/legacy/test/p7t7-integrated-drift-ack.test.ts`,
scenario S1 — "P7-T7 G7 criterion 1: warning/fatal admission semantics
(integrated, P7-T1 real prober)", 4 tests, all PASS in the 1588/1588
run:

- an unacked WARNING blocks new work (`BLOCKED_WARNING`);
- acknowledging the warning reopens admission (`DEGRADED_ACKNOWLEDGED`);
- a FATAL (required requirement down) blocks new work (`BLOCKED_FATAL`);
- read-only isolation: the legacy home and the reader view are
  untouched by the suite.

The scenario drives the REAL P7-T1 compatibility prober world:
web-down produces a NEW_ACTIVATION warning (admission stays
BLOCKED_WARNING until acked, then DEGRADED_ACKNOWLEDGED admits),
skill-base-down produces a fatal block.

**PASS**

## 2. `ack fingerprint invalidation`

Evidence: `p7t7-integrated-drift-ack.test.ts`, scenario S2 — "P7-T7 G7
criterion 2: ack fingerprint invalidation (integrated, P7-T1 real
prober)", 4 tests, all PASS:

- an ack under fingerprint A admits work (`DEGRADED_ACKNOWLEDGED`);
- drift changes the environment fingerprint (capability-generation
  bump → CAPABILITY_GENERATION_CHANGE probe);
- the stale ack covers nothing: new work is blocked again
  (`BLOCKED_WARNING`);
- read-only isolation: legacy home + reader view untouched.

**PASS**

## 3. `human override precedence`

Evidence: `packages/legacy/test/p7t7-integrated-override-admission.test.ts`
— "P7-T7 G7 criterion 3: human override precedence (integrated, P7-T2
real service)", 7 tests, all PASS. The frozen layer order is
blueprint < policyState < template < templateOverlay < instanceOverlay
< humanOverride, proven against the P7-T2 real resolve service:

- step 1: the member grant is the effective cell (instanceOverlay);
- step 2: on alpha the member grant still wins (instanceOverlay is
  above the leader's team grant in templateOverlay);
- step 2: the team grant applies to members without their own grant
  (beta);
- step 3: the human override is the highest Team layer
  (humanOverride, invariant 34);
- step 3: the lower layers remain visible as `overriddenLower`
  (transparent precedence — full ascending candidate chain asserted);
- step 3: the team-scoped human override applies to every member
  (beta);
- read-only isolation: legacy home + reader view untouched.

**PASS**

## 4. `lifecycle quiescence`

Evidence: `packages/legacy/test/p7t7-integrated-lifecycle-restore.test.ts`,
criterion-4 block — "(integrated, P7-T3 real service)", 5 tests, all
PASS:

- archiving a RUNNING run executes the full quiescence-first step
  sequence;
- descendants are drained and quiescence awaited BEFORE residency
  release / any commit;
- the member settles then archives; residency is dropped; +2 activity;
- the live-contact and commit channels match the sequence (numeric
  fake call counters asserted exactly);
- read-only isolation: legacy home + reader view untouched.

**PASS**

## 5. `Restore does not create/resume Agent`

Evidence: `p7t7-integrated-lifecycle-restore.test.ts`, criterion-5
block, 4 tests, all PASS:

- restoring an ARCHIVED member commits exactly `[COMMIT_RESTORE]`
  (ARCHIVED → SETTLED, +1 activity);
- zero live contact: no admission, interrupt, drain, or residency drop;
- the resume-Agent / create-Agent probe surfaces are never touched
  (fake counters stay at 0);
- read-only isolation: legacy home + reader view untouched.

**PASS**

## 6. `Root fork exact semantics`

Evidence: `packages/legacy/test/p7t7-integrated-fork-handoff.test.ts`,
criterion-6 block — "(integrated, P7-T4 real reconciler)", 4 tests, all
PASS:

- a root fork resolves as a root fork: a NEW TeamSession is created
  for the child (invariant 9);
- the child binds the SAME immutable Blueprint snapshot and the
  inherited `defaultWorkspace`;
- the child team is left EMPTY (no member copy) with exactly 2
  crash-safe durable writes;
- read-only isolation: legacy home + reader view untouched.

**PASS**

## 7. `Member fork ordinary semantics`

Evidence: `p7t7-integrated-fork-handoff.test.ts`, criterion-7 block,
4 tests, all PASS:

- a member fork resolves as a plain member fork: 0 durable writes;
- NOTHING is created for the child (no TeamSession record, no binding
  row);
- the child is NOT adopted into the parent team (parent still has
  exactly 1 member);
- read-only isolation: legacy home + reader view untouched.

**PASS**

## 8. `handoff one-shot/no-live-link`

Evidence: `p7t7-integrated-fork-handoff.test.ts`, criterion-8 block —
"(integrated, P7-T5 real service)", 7 tests, all PASS:

- the handoff completes as a one-shot: the source is read exactly
  ONCE, one summary, one creation call;
- the frozen context is deep-frozen pure data;
- source mutations AFTER capture never reach the frozen context (no
  live link);
- a same-token replay re-reads NOTHING and returns the SAME context
  object;
- the staged TeamIntent carries the one-shot handoff provenance and
  the team identity is the new root;
- a fresh token starts a FRESH operation that sees the mutated live
  surface;
- read-only isolation: legacy home + reader view untouched.

**PASS**

## 9. `legacy old Team cannot mutate/resume`

Evidence (in-process, 39 tests, all PASS):

- `packages/legacy/test/p7t7-legacy-read.test.ts` (28 tests) — the
  reader's best-effort read contract: S1 the full legacy-team view
  (roster merge + workspace overlay, session evidence, team-event
  counts, leader selection `team-events` vs `roster-only`, member
  child lineage); S1b the own-suffix (seed boundary) counting rule
  (numeric seq < seedLength excluded, seq-less tolerated); S2 metadata
  absent ⇒ native Chat/Trajectory fallback (`status:
  "native-fallback"`, `reason: "no-legacy-metadata"`, `degradedTo:
  "native-chat-trajectory"`) — the required degradation; S3 invalid
  requests rejected with a closed vocabulary; S4 port faults are
  re-typed (`LEGACY_READER_PORT_FAILURE`), never swallowed.
- `packages/legacy/test/p7t7-mutation-reject.test.ts` (11 tests) — the
  no-mutate/no-resume/no-restore surface: M1 `inspect` is the only
  accepted action (dispatch returns the identical frozen view; the
  reads are real); M2 every one of the eleven mutation-style verbs
  (`mutate`, `resume`, `restore`, `fork`, `create`, `delete`,
  `update`, `archive`, `activate`, `rebind`, `import`) throws the
  typed `LEGACY_READER_MUTATION_REJECTED` with `details.action` echo,
  case-sensitive exact matching, malformed tokens typed; M3 a
  rejected attempt is a NO-OP (nothing touched — port-op audit);
  M4 the port surface exposes exactly `listDir` + `readFile` (there is
  no write method to call).

Evidence (real-instance E2E, run #3 — the only P7 task with a
real-instance e2e, all 35 assertions PASS):

- **L1 (17/17)**: against the LIVE booted home (row-mounted reader,
  real-FS port, mini-MCP tool `p7t7_legacy_read`), the planted legacy
  team (2 roster files with a workspace overlay + leader session with
  `team/progress` + `team/control-request` + subagent child with
  `team/member-bound`) yields the exact expected legacy-team view:
  `status legacy-team`, `leaderSelection team-events`,
  `leaderSessionId/teamId sess-leader`, roster 2 members with the
  workspace overlay winning per id (`Alpha WS` / `source: workspace`),
  session evidence (headers, `eventCount` 3, `teamEventTotal` 2 for
  the leader; subagent origin + `parentSession` for the child;
  `memberChildSessionIds [sess-alpha]`), and the home fixture tree is
  **byte-identical after inspect** (read-only proof on the real FS).
- **L2 (11/11)**: the same live tool rejects `resume` / `restore` /
  `mutate` with `isError` + code `LEGACY_READER_MUTATION_REJECTED` and
  the `details.action` echo, while the `inspect` control still
  succeeds; the home snapshot is byte-identical after the rejected
  actions.
- **L3 (7/7)**: after the driver wipes all roster sources + the legacy
  session project and plants a native-only session, the view degrades
  to `native-fallback` / `no-legacy-metadata` /
  `native-chat-trajectory` with the planted native session listed and
  zero team events.

**PASS**

---

## Conclusion

**9/9 G7 criteria PASS.** In-process: 1588/1588 (0 failures), tsc
0×5, testkit 124/124 (p4t6 394→411, legacy 4→21), zero-core PASS.
Real-instance e2e (run #3): L1 17/17, L2 11/11, L3 7/7, ports
released, `:3080` untouched, test-use tree pristine before and after.

Documented deviations from frozen legacy behavior (design-note.md §3):
D1 lenient roster parse, D2 lenient header recognition, D3 no legacy
leader-demotion, D4 seq-less team-event lines tolerated.
