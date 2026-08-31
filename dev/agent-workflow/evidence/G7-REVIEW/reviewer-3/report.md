# G7-REVIEW — Reviewer 3 (N=3) Report

- **Gate**: G7-REVIEW (round R49), dsh-agent-team vNext, int branch `int/P7-advanced-semantics`
- **Reviewer**: N=3, provider/model `qiyuan-self/qwen3.8-27b` (as mandated; not re-routed)
- **My worktree**: `D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/G7-3`, detached at
  `298d6364d2ebcb03eff0073c352e2174b0fd433f` (verified via `git rev-parse HEAD` in this report's logs)
- **Diff base**: `673260198e2f90474678087fa7518bdd241403b8`
- **Frozen docs**: all four 20260829 docs hash-verified against the brief (Architecture
  `030dfb8e…`, UI `3ef3ab69…`, DevPlan `a05d237f…`, TaskDoc `2b457cc0…`). Docs are untracked/
  gitignored (live only on the main worktree disk) and were read there read-only, per brief §1.
- **Blinding**: nothing under `dev/agent-workflow/` in the main worktree was read; the only
  `dev/agent-workflow/` touch is writing my own files under `evidence/G7-REVIEW/reviewer-3/`
  inside my own worktree.

## 1. S4 — test chain and boundary checks (own disk)

| Item | Result | Evidence |
| --- | --- | --- |
| `node scripts/run-tests.mjs` (plain-node runner) | **1588 passed / 0 failed / 1588 total**, exit 0, `RESULT: PASS run-tests (0 failures)` | `chain-rerun.log` |
| tsc per package | contracts=0, domain=0, storage=0, runtime=0, testkit=0 (exit codes, no output) | `chain-rerun.log` (tsc section) |
| zero-core (no `node:` imports in any `.ts` under `packages/`) | PASS | `boundary-checks.log` CHECK 1. The only `node:` occurrence in `.ts` is a **string literal** inside `packages/runtime/test/p7t5-no-creation-scan.test.ts` (data for scan rule R5), verified by reading the file context. `.d.mts` hits are comment headers only. `.mjs` harness imports are rule-excluded (recorded). |
| private-import (no imports from `references/deepseek-harness-test-use`) | PASS | `boundary-checks.log` CHECK 2–3 |
| owned-boundary (`git diff base..HEAD -- packages/`) | PASS — 94 files (93 A + 1 M), **94/94** inside P7 task owned globs (TaskDoc §11.8) or the single named DEC-1 standing exception (`packages/testkit/test/p4t6-session-event-scan.test.ts`, M, count maintenance). 0 out-of-scope. | `owned-boundary-diff.txt`, `boundary-checks.log` CHECK 5 |

## 2. S4 — per-criterion source review (G7 nine criteria, DevPlan §20.7)

All paths relative to my worktree root. Line references are to the files as read.

### Criterion 1 — warning/fatal admission (PASS)
- `packages/runtime/compatibility/probe.ts` (474 L, fully read): `probe(trigger)` = fresh facts →
  `evaluateCompatibility` with durable acks → generation+1 → `replaceState` under a promise-chain
  lock (delete+put; crash window leaves the row ABSENT → treated stale → re-probe, fail-safe).
- `packages/runtime/compatibility/blueprint.ts`: blueprint→requirements bridge mirrors the P6-T1
  activation bridge **verbatim** (same closed domain mapping, same `req-<domain>-<name>` id
  derivation, `optional → complete:false` = ack-able WARNING, required → FATAL,
  `teamStructure`/`persona` FATAL at engine level, unknown domain fails loud per §27.1) — no
  semantics fork between probe and live activation evaluation.
- `packages/runtime/compatibility/drift.ts`: pure drift classification (ESTABLISHED /
  ENVIRONMENT_DRIFT / NONE) keyed on the environment fingerprint per §20.1.
- `packages/runtime/admission/gate.ts` (P6, unchanged in P7): step-4 compatibility gate — a
  **durable** compatibility state is authoritative for NEW WORK (`BLOCKED_FATAL` /
  `BLOCKED_WARNING` → `COMPATIBILITY_BLOCKED` reject; `OPEN` / `DEGRADED_ACKNOWLEDGED` admit);
  no durable state → live `evaluateActivationCompatibility` fallback (fail-closed); only
  WORK/CREATION categories are new-work admissions; work-state gate (CREATED/RUNNING/SETTLED
  accept, ARCHIVED needs restore, DISPOSED → `WORK_STATE_REJECTED`).
- **Cross-task combination verified**: P7 prober writes the durable row; P6 admission consumes it
  as authoritative. FATAL is not ack-able (criterion 2) so `BLOCKED_FATAL` can only be cleared by
  environment change + re-probe.

### Criterion 2 — ack fingerprint invalidation (PASS)
- `probe.ts::acknowledge` binds the **current** evaluation's `mismatchFingerprint` +
  `environmentFingerprint`; rejects FATAL (`FATAL_NOT_ACKNOWLEDGABLE`) and PASS
  (`ACK_TARGET_NOT_WARNING`).
- `ensureFreshGeneration()` forces `STALE_GENERATION_BEFORE_NEW_WORK` re-probe when the live
  fingerprint differs from the durable one (or is missing) — fail-closed `NEW_WORK_BLOCKED`;
  so an ack taken under environment E is invalidated by any environment drift before new work.
- `settleWork` **never** reads compat state (§28.2: in-flight work settles regardless);
  `enforceNewWorkAdmission` is the last-mile guard (§28.3).

### Criterion 3 — human override precedence (PASS)
- `packages/runtime/mutation/service.ts` (922 L, core methods read): `requestMutation` applies
  `checkExternalHard` for **every** origin (capabilityExists false or hard deny →
  `EXTERNAL_HARD_REJECTED`); agent origins are envelope-checked (member → `MEMBER_SELF_ESCALATION`,
  leader → `LEADER_OUT_OF_ENVELOPE` via the P3-T4 validator); **human is not envelope-bounded**.
  Records are deep-frozen (HUMAN_OVERRIDE / TEMPLATE_OVERLAY / INSTANCE_OVERLAY) with
  `effectiveFromStep = requestedAtStep + 1` (future boundary). `switchPolicyState` only for
  explicit human/authorized-leader (`UNAUTHORIZED_TRANSITION` otherwise).
- `beginStep` captures a **frozen per-step resolution** — in-flight steps are never re-pointed.
- `packages/runtime/policy-adapter.ts` (258 L, fully read): assembles the frozen P3-T4
  `EffectivePolicyInput` **from the durable mutation store** — `assembleHumanOverride` applies
  the frozen caller-selection rule (per capability, latest **instance-scoped** human override
  wins, else latest team-scoped; `effectiveFromStep <= atStep`, admission order monotone);
  `assembleOverlay` restricts overlay slots by kind/scope; `activePolicyState` selects the latest
  admitted transition with future boundary, else implicit `default`. The resolver is reused
  **verbatim** (no re-implementation); P_effective = externalHard ∩ capabilityExists ∩
  TeamResolved stays the P3-T4 composition. Override precedence is therefore visible at the
  admission boundary: the per-step frozen effective policy is what the step executes.

### Criterion 4 — lifecycle quiescence (PASS)
- `packages/runtime/lifecycle/quiesce.ts`: `quiesceMember` = the 5 live steps in **frozen order**
  close-admission → interrupt → drain-descendants → wait-quiescence → release-residency; any fault
  → `LIFECYCLE_LIVE_EFFECT_FAILED` (details.step) **before** remaining steps AND before any
  durable write; non-quiescent/malformed drain report → `LIFECYCLE_NOT_QUIESCENT`, zero writes,
  residency unreleased.
- `packages/runtime/lifecycle/archive.ts`: dry-run `planArchive` over the pure P3-T3 FSM
  (RUNNING ⇒ settle-then-archive, two commits; SETTLED ⇒ one commit; else
  `LIFECYCLE_ILLEGAL_STATE` pre-effect), **quiesce FIRST**, then commits the exact probed
  transitions.
- `packages/runtime/lifecycle/resolve.ts`: shared fail-closed prologue (identity → durable read →
  dry-run probe); `commitDurable` calls only the durable-only port `commit.commitTransition`.

### Criterion 5 — restore-no-agent (PASS)
- `packages/runtime/lifecycle/restore.ts`: `restoreMember` = **ARCHIVED→SETTLED only**, a single
  `commit-restore` durable step, **zero live-port code path by construction** (no create/resume
  Agent surface exists in the module). `disposeMember`: quiesce → one DISPOSE commit, history
  preserved. Both satisfy §29/§30 (quiesce-first, archive = close→interrupt→drain→quiesce→
  release→commit; restore 3A never creates/resumes an Agent; dispose keeps history).

### Criterion 6 — root fork exact (PASS)
- `packages/runtime/fork-reconciliation/reconciler.ts` (320 L, fully read) + `adapter.ts`
  (56 L) + `types.ts` (170 L, fully read):
  - recognition is READ-ONLY and precedes any effect; parent binding kind decides the branch
    (the cold-hydration resolution, §36.1).
  - **Root fork**: parent must carry its TeamSession record (else `FORK_STATE_CONFLICT`); the
    child must end with **EMPTY MemberInstances** (`childMemberCount > 0` → conflict, §35.1);
    the new TeamSession record carries `blueprint: parentRecord.blueprint` — the **SAME immutable
    Blueprint snapshot** (invariant 10); a mismatched existing child snapshot → conflict.
  - **Idempotent reconciliation**: existing child team-root binding → verify record exists,
    generation 1, same snapshot → `root-fork-already-reconciled`, **0 writes**; crash window
    (record committed, binding missing) → verify generation 1 + same snapshot → roll forward the
    binding, **1 write**; fresh sidecar → **record first, binding second** (crash-safe order),
    **2 writes**. Outcome vocabulary is closed; `durableWrites` is exact per outcome.
  - **No `session.fork` patch** (zero-core): the native fork is performed by DSH; this module
    only performs the sidecar recognition over the public TeamDomain binding surface fed by
    public Session lineage (§35.2). The adapter projects exactly the repository methods
    (`getTeamSession`, `getSessionBinding`, `listMemberInstances`, `putTeamSession`,
    `putSessionBinding`) — invariant 41 (TeamDomain sole durable control-plane authority).
  - Ports = `{ teamDomain, now }` (deterministic clock injected) — pure, no dynamic loading.

### Criterion 7 — member fork ordinary (PASS)
- Same module: `parentBinding.kind === 'team-member'` → outcome `member-fork`: the child stays an
  **ordinary independent AgentSession — NOT a new MemberInstance, NOT a member of the original
  Team, NOT a new TeamSession, NOT a Leader** (§35.3, invariant 62); **0 durable writes**; no Team
  binding is ever inferred; an existing child binding row is a contradiction
  (`FORK_STATE_CONFLICT`). Ordinary parent (unbound/ordinary) → `ordinary-fork`, 0 writes,
  likewise contradiction-checked.

### Criterion 8 — handoff one-shot / no live link (PASS)
- `packages/runtime/handoff/service.ts` (615 L, read: interface + full implementation +
  validators):
  - **snapshot once**: the source surface port is called exactly once per operation; concurrent
    same-token starts coalesce on the in-flight pipeline; same-token replay and summarization
    `retry` **re-use the frozen snapshot** and never re-read the source.
  - The snapshot is a **detached deep lossless-JSON copy, deep-frozen at materialization**
    (`deepFreeze(JSON.parse(canonicalJsonStringify(raw)))`); a non lossless-JSON surface fails
    with no trace left (`HANDOFF_SOURCE_SURFACE_UNAVAILABLE`).
  - Summarization is an injected auxiliary over the frozen snapshot; a non lossless-JSON summary
    is a failure; failure surfaces **explicitly** with the §34.4 triad (retry /
    continue-without-handoff / cancel) — never silently pretends success, no team created.
  - Team creation is **delegated** to the injected public Team creation entry with a stable
    `intentToken = handoff-intent-<requestToken>` (idempotency contract); the module owns no
    creation path of its own. `continue-without-handoff` creates with **no** handoff provenance.
  - **No live link**: `querySourceHistoryFromTarget` **ALWAYS** throws
    `HANDOFF_SOURCE_HISTORY_ACCESS_DENIED` (the context token is provenance/navigation metadata,
    NOT a read grant; the source surface port is never touched by that path).
  - `sourceSessionId` appears only as provenance (TeamIntent `handoff` block + context record).

### Criterion 9 — legacy no mutate / no resume (PASS)
- `packages/legacy/session-reader/` (T7):
  - Export surface (`index.ts`): the only operational entry is `inspectLegacyTeam`;
    `dispatchReaderAction` **rejects every non-`inspect` action** with the typed
    `LEGACY_READER_MUTATION_REJECTED` (inspect.ts L477–512: `if (action !== 'inspect') throw`).
  - Read-only **by construction**: `LegacyHomePort` declares exactly `listDir` / `readFile`
    (types.ts); `inspect.ts` never calls beyond them (`safeListDir`/`safeReadFile` wrap the
    best-effort contract, throwing `LEGACY_READER_PORT_FAILURE` only on port-contract violation,
    never for absence).
  - Real-FS seam (`e2e/fs-seam.mjs`, fully read): imports only `existsSync/readdirSync/
    readFileSync/statSync` — **zero write APIs**; `insideHome` rejects `..` segments and
    non-home prefixes (case-insensitive), returns the reader's absent-signal `undefined`
    out-of-home. The home root is `process.env.DSH_HOME` of the host.
  - Inspect semantics: leader = unbound session carrying team facts (deterministic tie-break:
    teamEventTotal desc, createdAt asc, id asc); members = bound sessions or subagent children
    of the leader; output deep-frozen; no legacy metadata → `native-fallback`
    (`degradedTo: 'native-chat-trajectory'`) — required behavior, not a blocker (§20.6).
  - T6 `packages/legacy/teammates-adapter.ts` (537 L, entry + flow read): **one-time** import —
    `importLegacyTeammates(entries, options)` is pure (parse once → validate → snapshot):
    sorted file order, last-wins dedup, last-leader-kept, all-or-nothing fail-loud,
    `blueprintId`+`revision` snapshot identity, contentHash + deepFreeze. No watcher, no
    re-read, no live runtime authority (§20.6, invariant 65). The FS seam
    (`teammates-adapter-fs.mjs`, fully read) reads one directory exactly once per call
    (`readdirSync` + `readFileSync`; missing dir → `[]`); its only write surface is the guarded
    `.scratch-p7t6-*` test fixture helper (always removed in `finally`), used solely by the
    p7t6 unit test's source-changes-after-snapshot case.
  - **Real-instance E2E (L2)** proves it live: `resume`/`restore`/`mutate` each return
    `isError=true` with `code: LEGACY_READER_MUTATION_REJECTED` and the echoed action, the
    inspect control still succeeds, and the sha256 snapshot of the fixture home is
    **byte-identical** before/after (see §3).

## 3. S5 — locked real-instance E2E rerun (own run, own disk)

- **Lock**: `references/.dsh-test-p7t7.lock` acquired at 2026-08-31T10:35:44+08:00 with content
  `G7-3 2026-08-31T10:35:44.5639324+08:00` (no prior lock; no contention). Released after the
  run only after re-verifying the content started with `G7-3`.
- **Command** (from my worktree root): `node packages/legacy/session-reader/e2e/run.mjs
  --report-dir dev/agent-workflow/evidence/G7-REVIEW/reviewer-3/harness-output --port 3182`
- **Result**: harness **PASS**, exit 0. `harness-output/summary.json` (runStamp
  `p7t7-1788143747524`):
  - L1: http 200, 34 ms, **pass=true, 17/17 assertions**, 0 failing
  - L2: http 200, 192 ms, **pass=true, 11/11 assertions**, 0 failing
  - L3: http 200, 59 ms, **pass=true, 7/7 assertions**, 0 failing
  - overall `pass: true`, `failures: []`; `rowMounted: true` (public `cordis.patch.yml` seam)
  - mini MCP on 127.0.0.1:3491 (auto-selected); boot port 3182; **ports released**
    (`released: {boot: true, mcp: true}`)
  - stable :3080 instance: reachable 200 **before and after** (probe-only, untouched)
  - test-use tree pristine per harness: before and after head
    `cd5ef8148158c3a752a658978873241fdf8e2bbc`, `statusEmpty: true`, `diffEmpty: true`
- **Independent re-verification (my own, post-run)**: `git -C references/deepseek-harness-test-use
  rev-parse HEAD` → `cd5ef8148158c3a752a658978873241fdf8e2bbc` (the pinned head);
  `git status --porcelain` → **empty**; ports 3182 and 3491 → **FREE** (Get-NetTCPConnection).
- Evidence files: `harness-output/{summary.json, run.log, dump-config.txt,
  harness-output/L1.json, harness-output/L2.json, harness-output/L3.json, logs/...}` — all under
  my evidence directory.
- Harness write-scope audit (source review): all writes are confined to (a) the shared
  harness-managed `references/.dsh-test-p7t7` DSH_HOME (fresh per run — this is exactly what the
  lockfile protocol serializes), (b) my `--report-dir` evidence directory, (c) fixture planting
  inside (a). No writes to the main worktree, the test-use tree, or the stable deployment.

## 4. Cross-task invariant combination review (S4 step 5)

1. **T1 (compat) ↔ P6 (admission)**: the prober's durable row is the authoritative input of the
   P6 new-work gate; the live-eval bridge is only the no-durable-state fallback and is
   semantics-identical to the prober's bridge (blueprint.ts verbatim mirror) — no divergent
   admission outcomes between probe-driven and activation-time evaluation.
2. **T2 (mutation) ↔ P3 (policy)**: the mutation service and the policy-adapter never
   re-implement resolution; the frozen P3-T4 resolver runs over adapter-assembled inputs
   sourced exclusively from the durable mutation store, with human override precedence
   (instance-scoped human > team-scoped human > agent overlays) visible in the per-step frozen
   effective policy that admission/execution consumes. External hard limits are checked at
   admission for every origin (including human), so overrides can never bypass them.
3. **T3 (lifecycle)**: quiescence is fail-closed before any durable write; archive/restore/
   dispose commit only the exact FSM transitions the dry-run probe produced, through the
   durable-only commit port — no live effects hide behind durable bookkeeping.
4. **T4 (fork-reconciliation)**: writes only the two sidecar seams over the P4 repositories
   (invariant 41); no admission gate, no policy surface, no live effects; recognition reads are
   read-only; idempotent and crash-safe (record-first ordering, exact `durableWrites` per
   outcome).
5. **T5 (handoff)**: the only team-adjacent effect is **delegated** to the injected public Team
   creation entry (which itself is admission-gated); the module owns no creation path, keeps no
   live link, and the target-side history/search guard is unconditional.
6. **T6/T7 (legacy)**: no module in the legacy package can mutate, resume, or restore a legacy
   Team Session — the reader's dispatch rejects everything but inspect, its port has no write
   methods, and the import adapter is a one-shot pure snapshot. The e2e row's single tool
   (`p7t7_legacy_read`, mini-mcp.mjs L63) routes exclusively through `dispatchReaderAction`.
7. **Rule R7 scan** (no dynamic module loading in P7 runtime `.ts`): the only `import(` matches
   are TS **type-level** inline imports (erased at compile time) and the p7t5 scan test's own
   fixture strings; no runtime `import(`/`require(`/`createRequire`/`import.meta` in any P7
   runtime module.

## 5. Concerns (all non-blocking)

1. **fs-seam containment is prefix-based** (`e2e/fs-seam.mjs::insideHome`): it rejects `..`
   segments and non-home prefixes but does not resolve symlinks, so a symlink *planted inside*
   DSH_HOME could in principle be followed outside it by `readFileSync`/`readdirSync`. Test-
   harness-only surface (the home is a fixture tree the harness itself plants; no symlinks are
   planted); no production path is affected. Informational.
2. **Shared DSH_HOME reset is lock-protocol dependent**: `run.mjs` does `rmSync(DSH_HOME)` per
   run; concurrency safety rests on the brief-mandated lockfile protocol, which was followed
   (acquired before, released after, ownership re-verified). A reviewer bypassing the lock would
   collide — a protocol property, not a code defect.
3. **Handoff operation registry is in-memory** (per service instance, by documented design):
   handoff operation state is not durable. This matches the §34 one-shot scope of P7-T5 (no
   persistence requirement in the frozen docs); recorded for completeness.

None of the above touches the nine criteria, the frozen specs, or the repo red lines.

## 6. Verdict

All nine criteria PASS on my own disk evidence (source-level read of every P7 module under
review + full chain rerun 1588/0 + five boundary checks PASS + locked real-instance E2E green
35/35 assertions with independent pristine/ports verification). No blocking concerns.

**Verdict: 通过 (pass)**
