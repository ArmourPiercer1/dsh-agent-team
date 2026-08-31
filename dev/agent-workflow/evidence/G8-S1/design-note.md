# G8-S1 design note — generation stamp write path (S1-A) + effect-sequence vocabulary (S1-B)

Task: G8-S1 (gate supplement 1 for G8-REVIEW), Team-mode vNext phase P8.
Base: `93d2a96e3ded6a92820f78ee9de94eac9ea6fffb`, branch `task/G8-S1-gate-supplement`.
Brief: `dev/agent-workflow/briefs/G8-S1-brief.md` (main repo; all 112 lines read).

## 1. S1-A verdict (up front)

**BLOCKER:SPEC** — storage-primitive gap that prevents commit-atomic stamp advance
(brief §4.2 req 2; §9 fixed format). No existing storage primitive can make a
cross-table state write and the `team_sessions.generation` increment atomic.
Per the brief's own decision procedure (req 2 escape clause, §4.4 last sentence,
§9 pre-written reason) the worker must stop and report, not invent a new table or
a two-phase workaround. S1-A ships no code and no tests. S1-B is DONE (code
commit `a5b418a`).

The analysis below is the full writer enumeration + commit-point choice +
crash-window argument required by brief §8.

## 2. S1-A writer enumeration (complete)

Projection-visible ground truth = the P8-T2 DTO field list (root / template /
instance / lifecycle / effective-config / activity / ledger-summary), i.e. the
TeamDomain stores `team_sessions`, `member_instances`, `overrides`,
`compatibility`, `ledger` (plus the template rows materialized from the bound
blueprint — see W-T). `session_bindings` and `operations` stores are NOT
projection-visible (absent from the DTO) and are excluded.

Every production call site that mutates a projection-visible store (33 sites
scanned in `packages/runtime/**` + `packages/storage/**`), grouped by writer:

| # | Store (projection field) | Production writer (module:line) | Write form | In tree? |
|---|---|---|---|---|
| W1 | `team_sessions` (root) | `runtime/root-binding/write-port.ts:35-39` (`putTeamSession`) | single put; creation seeds `generation = 1` (frozen behavior) | yes |
| W2 | `team_sessions` (root) | `runtime/root-binding/fresh-root.ts:152` | creation through the W1 write port | yes |
| W3 | `team_sessions` (root) | `runtime/fork-reconciliation/adapter.ts:49-50` | fork: new team-session record | yes |
| W4 | `team_sessions` (root) | `runtime/fork-reconciliation/reconciler.ts:303` | reconciler commit | yes |
| W5 | `member_instances` (instance) | `runtime/member-residency/write-port.ts:43` (`createMemberDomainWritePort`) | fresh member record put (host-wired adapter) | yes |
| W6 | `member_instances` (instance) | `storage/provisioning/coordinator.ts:540` (`ensureMemberRecord`) | check-then-apply put, BEFORE `journal.drive` | yes |
| W7 | `member_instances` (lifecycle) | injected `LifecycleCommitPort` (interface `runtime/admission/types.ts:227`; call sites `runtime/action-router/effects.ts:96`, P7-T3 `runtime/lifecycle/*` via `runtime/lifecycle/types.ts:218`) | durable transition commit (state first, evidence fact second) | NO production impl in tree (P9/P10 host wiring; router fails closed without the port) |
| W8 | `overrides` (effective-config) | `MutationStore` interface `runtime/mutation/types.ts:375` (`appendRecord` / `appendTransition` / `appendLedger` / `appendSuppression`); only impl = in-memory test fake `runtime/test/p7t2-helpers.ts:132` | future production impl = P9/P10 host wiring | NO production writer in tree |
| W9 | `compatibility` | `runtime/compatibility/probe.ts:239-240` | delete + put reprobe | yes |
| W10 | `ledger` (activity / ledger-summary) | `runtime/action-router/effects.ts:537/546` (`commitFact`) | `ledger.allocateSequence()` + `ledger.put` | yes |
| W11 | `ledger` | `runtime/activity/ledger.ts:346/367` | activity fact | yes |
| W12 | `ledger` | `runtime/control/service.ts:507/522` | control fact | yes |
| W13 | `ledger` | `runtime/messaging/coordinator.ts:302/448` | message fact | yes |
| W14 | `ledger` | `storage/operations/journal.ts:353` | journal fact (after all effects, before the COMMITTED terminal row) | yes |
| W-T | template rows (DTO `templates`) | no TeamDomain store: the P8-T2 read port materializes the rows from the bound **immutable** blueprint snapshot (invariant 10; `runtime/projection/types.ts:68-84`); the binding itself is recorded in `team_sessions` at creation/rebind (W1-W4) | n/a | n/a |

**Count: 14 enumerated writers — 12 in-tree production writer sites
(W1-W6, W9-W14) + 2 P9/P10 host-wired future writers (W7, W8).**
Non-journal writers (W9-W13) have NO re-drive mechanism: once their durable
write lands, nothing in the protocol re-executes or repairs it on recovery
(recovery = roll-forward/reconcile of journaled operations only; DevPlan §17.3).

## 3. S1-A commit-point analysis

### 3.1 The stamp's frozen location

`team_sessions.generation` (whole-projection monotonic, seed 1). Frozen
consumers: the contracts field, the P8-T1 DTO root, the frozen client guard
`decideFrameVerdict` (apply on strictly newer / duplicate on equal / stale on
older), and the P8-T2 read port (generation "carried verbatim from the
source"; `runtime/projection/fold.ts`). The stamp location cannot move.

### 3.2 The complete public storage primitive set (verified exhaustively)

- `StorageKvTable` = `get / entries / keys / size / put / delete / update`,
  where `update(key, fn)` is an **atomic read-modify-write on a single key of a
  single table** (the domain's write chain) — `packages/storage/schema/seam.ts`
  (130 lines, mirrors only the public surface).
- `DomainGlobal` = `get / set`; `Domain` = `name / global / table(name) / close()`.
- Upstream `DomainImpl` (`references/deepseek-harness-test-use/.../domain.ts`,
  read-only verification): one write chain per domain; **each write awaits
  backend durability FIRST and then mutates memory — every single write is its
  own durable boundary**.
- No batch, no transaction, no multi-record atomic durable write exists
  anywhere in the public StorageDomain surface. Verified by full-package grep
  for `transaction|batch|atomic|commit` across `packages/storage` (the journal's
  "COMMITTED" is an operation-ROW state machine, not a storage primitive) plus
  the upstream source read. Architecture §14.4: TeamDomain is explicitly NOT
  cross-table ACID — "no cross-table transaction"; DevPlan §17.3: a crash is
  possible between any of "TeamDomain write A / DSH Session creation /
  write B / ledger append"; protocol is PREPARED → idempotent effects →
  target records record lastAppliedOperationId → ledger → COMMITTED, with
  recovery as roll-forward/reconcile.

### 3.3 Consequence

A single durable write can pair a state-record write with the stamp increment
**only when both live in the same table** — i.e. only for the
`team_sessions` row itself (W1-W4; creation already seeds `generation = 1` in
the same put, which is frozen behavior). That is the complete atomizable
class. For every other writer (W5-W14), the state write and the stamp
increment are necessarily **two independent durable writes**, each its own
durability boundary. There is no commit point at which the pairing becomes
atomic.

## 4. S1-A crash-window argument (why no ordering works)

**Order A — state first, stamp after.** A crash between the two writes leaves
exactly the combination brief §4.2 forbids: **"new state durable + old stamp
durable."** A client re-pull under the old stamp sees an equal generation →
frozen verdict `duplicate` → the client **keeps the stale body forever**. For
non-journal writers (W9-W13) the stale stamp is not corrected by any
re-drive; it persists until some unrelated later operation advances the
stamp — an indefinitely long poisoned window for that client's view.

**Order B — stamp first, state after.** Never produces the §4.2 combination,
but is strictly worse in a second class:

- Crash between the stamp write and the state write leaves "new stamp durable
  + old state durable" (or, for a crashed non-journal writer, the state change
  **never durably written at all** while the stamp has already advanced).
- A client re-pull landing in that window sees a strictly newer generation →
  frozen verdict `apply` → the client applies a body that **does not yet
  contain the change the stamp covered**, and the stamp is now spent: every
  later re-pull at the same generation verdicts `duplicate`, so the client
  keeps the partial body until the next operation. Same failure class as
  Order A — a client permanently stuck on a body that does not match the
  stamp's promise — with the stamp additionally advancing for a change that
  may never materialize.

**Per-operation stamp reservation (the natural escape attempt).** To get
exactly-once advance + idempotent replay (brief §4.2 reqs 1+3) under crash
re-drive, an operation would have to durably reserve the specific
next-generation at or before its first state write. Impossible on the frozen
surfaces:

- The frozen v1 `OperationRecord` carries **no per-operation target field**
  (verified in `storage/operations/journal.ts` docstring +
  `storage/operations/types.ts`), so there is nothing to reserve against.
- The journal's dedup ledger fact is durable only **after all effects**
  (`applyPhase` order: effects → fact → COMMITTED row, `journal.ts:336-383`),
  so a reservation cannot piggyback on it without reordering the frozen
  journal protocol.
- A reservation at PREPARED time collides under concurrent prepares: two
  operations reading the same current generation can each claim
  generation+1; whichever state writes land, one operation's state is left
  unstamped or the stamp double-advances.

**Conclusion:** with the stamp frozen at `team_sessions.generation` and the
state visible to the projection spread over `member_instances` / `overrides` /
`compatibility` / `ledger`, no existing primitive satisfies brief §4.2 req 2
(commit atomicity) for any writer besides the `team_sessions` row itself.
Req 2 is ALL-mandatory; its escape clause, §4.4's last sentence, and §9's
pre-written reason all point to the same action: stop and raise
BLOCKER:SPEC. Done.

**Exact primitive gap (for the blocker line):** a multi-record (cross-table)
atomic durable write in the public StorageDomain seam — a batch of record
writes across the TeamDomain stores committing under ONE durability boundary
(every table write today is its own boundary) — or equivalently a durable
per-operation stamp reservation making the `team_sessions.generation`
increment idempotently tied to a single operation.

**Candidate future fixes (gate/main-agent adjudication — NOT implemented, and
both touch surfaces frozen to this task):**

1. Add a cross-table atomic write primitive to the public StorageDomain seam
   (upstream seam change — subject to the CORE PATCH BUDGET = 0 red line).
2. Add a durable per-operation stamp reservation (a field on the frozen v1
   operation record, or a new reservation row) — `packages/contracts/src/**`
   is frozen to this task, and inventing a new table is explicitly forbidden
   to the worker by §4.2.

## 5. S1-B canonical effect-sequence rule (implemented)

The P8-T4 handler read the stale fields `effect.factSequence` /
`effect.deliveredSequence`, which exist in **no** member of the real P6-T2
`RuntimeActionEffect` closed union (`packages/runtime/admission/types.ts:120-189`)
— so `provenance.effectSequence` was `null` for every admission outcome. The
canonical rule now implemented in `packages/remote/src/handlers/member.ts`
(`admissionEffectSequence`):

| P6-T2 effect `kind` | Canonical sequence field | Wire provenance |
|---|---|---|
| `fact-recorded` | `effect.sequence` (always written) | the number |
| `work-admitted` | `effect.sequence` (always written) | the number |
| `lifecycle-changed` | `effect.sequence` (always written) | the number |
| `member-activated` | `effect.ledgerSequence` (optional — "when carried") | the number when present, else `null` |
| `none` | — | `null` |
| `config-inspected` | — | `null` |
| `members-listed` | — | `null` |
| `templates-listed` | — | `null` |
| unknown/absent `kind`, non-object effect, non-safe-integer value | — | `null` (defensive at the lossless-JSON boundary) |

One-line form (for the result block):
`fact-recorded/work-admitted/lifecycle-changed → effect.sequence; member-activated → effect.ledgerSequence (null when absent); none/config-inspected/members-listed/templates-listed/unknown → null`.

Wire field `provenance.effectSequence: number | null` (frozen Remote contract
v1, `remote/src/contracts/response.ts:41-42`) is **unchanged** — only the
derivation and its documentation. Catalog, params schemas, error vocabulary:
untouched. The only remote src files that read effect vocabulary are
`handlers/member.ts` and `handlers/ports.ts` (verified by grep: all
11 stale-vocabulary hits in `packages/remote` were inside the four files
changed).

## 6. Finalized owned-path list

- `packages/remote/src/handlers/member.ts` — S1-B: `admissionEffectSequence`
  rewritten to the canonical rule; module doc kept accurate.
- `packages/remote/src/handlers/ports.ts` — S1-B: stale doc comment on
  `RemoteHandlerOutcome.effectSequence` replaced with the canonical rule.
- `packages/remote/test/p8t3-helpers.ts` — fixture
  `P8T3_ADMISSION_OUTCOME` moved to the real effect shape
  (`{ kind: 'fact-recorded', factType: 'fact', sequence: 3 }` — sequence 3 =
  the `fact` entry of the fake ledger).
- `packages/remote/test/p8t3-round-trip.test.ts` — fixture assertion updated;
  new S1-B suite (4 `it`s) appended; header documents the new coverage.
- `dev/agent-workflow/evidence/G8-S1/` — this design note + attempt log +
  saved run outputs.

No code changes for S1-A (BLOCKER:SPEC). No new files under `packages/`
(p4t6 file-count pin stays 482; the p8t3/p8t4 remote layout pins are
untouched because no file was added to `packages/remote/src`). No frozen
surface touched: `packages/contracts/src/**`, upstream, `references/**`,
`docs/**` all clean.

## 7. Test map (brief §7 → coverage)

| Mandate | Coverage |
|---|---|
| S1-A positive (seed 1 → strictly 1..N+1 → new-client re-pull verdict `apply`) | NOT IMPLEMENTED — BLOCKER:SPEC (no writable commit point exists to test) |
| S1-A negative (no double-advance on replay, never decreases, seed 1, non-state writes don't advance) | NOT IMPLEMENTED — BLOCKER:SPEC |
| S1-B positive (real effect kinds → non-null `provenance.effectSequence` = the real ledger/fact sequence) | `p8t3-round-trip.test.ts` new suite: `fact-recorded`→5, `work-admitted`→6, `lifecycle-changed`→7, `member-activated` (with `ledgerSequence`)→8; outcome pass-through asserted |
| S1-B negative (null-producing kinds documented; Remote v1 negative scan passes) | same suite: `member-activated` without `ledgerSequence`, `none`, `config-inspected`, `members-listed`, `templates-listed`, unknown kind, non-object effect, non-integer sequence → `null`; p8t3-negative-scan + p8t4-negative-scan PASS in the committed-tree chain (1758/1758) |
| p4t6 pin | 482 → 482 (no new `.ts`/`.mts`/`.mjs` under `packages/`; scanner byte-identical; no new denylist markers) |
| Full chain + tsc×6 | attempt log, RUN 2 (committed clean tree `a5b418a`): chain 1758/1758 failures 0; tsc contracts/domain/storage/runtime/testkit/remote all exit 0 |

New S1-A tests: **0** (blocker). New S1-B tests: 4 `it`s in one extended file
(existing file, no new file).

---

## Addendum — attempt 2 (R60 adjudication): S1-A as lag-tolerant stamp advance

Supersedes the §1 verdict. The BLOCKER:SPEC on §4.2 req 2 was adjudicated
(R60): implement S1-A as a **LAG-TOLERANT stamp advance**. The stamp is the
existing `team_sessions.generation` field (creation seed `1` frozen; **no new
field anywhere**, no new table). Code commit `18d1ce3` on
`task/G8-S1-gate-supplement` (base `cdd451c`).

### A.1 Hook placement decision and rationale

Two hooks, both placed AFTER the state write is durable:

- **Hook A (primary) — the ledger fact commit choke point.**
  `packages/storage/repositories/ledger.ts`, `LedgerRepository.put`: a
  pre-read `isNewEntry = readRow(key) === undefined` is taken BEFORE
  `putRecord`; after the durable `putRecord` succeeds,
  `if (isNewEntry) await this.teamSessions.advanceGeneration(record.rootSessionId)`.
  The advance is a single-row durable put, a separate write ordered after the
  fact write. `TeamSessionsRepository.advanceGeneration(rootSessionId)`
  (`packages/storage/repositories/team-sessions.ts`) deserializes the current
  row through `updateRaw` and returns
  `serializeTeamSessionRecord({...record, generation: record.generation + 1})`,
  yielding the next value; malformed id → `RECORD_INVALID`; missing row →
  `SEAM_FAILURE` carrying the public seam code `missing-key` — the closed v1
  error set has no `RECORD_MISSING`, and a missing team row is an invariant
  violation (the root row is seeded before any fact for that root can exist),
  so the loud seam failure is the intended surface.
- **Hook B — the compatibility re-probe.**
  `packages/runtime/compatibility/probe.ts`, `replaceState`: after the durable
  `delete` + `put` of the compat record,
  `await repositories.teamSessions.advanceGeneration(rootSessionId)`.
  `probe()` calls `replaceState` unconditionally on every probe, so every
  probe advances exactly once — the warning-ACK re-probe path is covered
  because it funnels through the same `replaceState`.

Why the fact choke point: in v1 every projection-visible state mutation flows
through the ledger — the journal protocol (PREPARED → idempotent effects →
dedup ledger fact → COMMITTED) plus the four direct fact writers (W10–W13).
One seam-level hook covers W10–W14, and any future fact writer inherits the
coverage automatically.

Why NOT at `allocateSequence` time (stamp-first — rejected): the sequence is
allocated BEFORE the operation's outcome is known; an aborted or
roll-forwarded operation would leave the stamp AHEAD of state — the exact
inversion of the ordering invariant (state write durable BEFORE stamp put).

Why not one hook per runtime call site: that would be five-plus hook sites
that could drift apart; the storage seam is the single point every fact
writer passes through.

### A.2 Concurrency argument

All 8 TeamDomain stores share one `team_domain` handle → ONE upstream Domain →
one write chain per domain (upstream `DomainImpl`: each write awaits backend
durability FIRST, then mutates memory; no batch, no transaction). The fact
write and the stamp advance that follows it both travel this single writer
chain, so they cannot interleave with a concurrent write of the same session:
no observer can see a state in which the stamp advanced while the fact is not
durable, because the stamp put is issued only after the fact write was acked
durable. The stamp row's own update is a single-key atomic read-modify-write
(`StorageKvTable.update` on the same chain), so two advances cannot merge or
reorder. The invariant this protects is monotonicity: `generation` never
decreases and never leads state beyond the accepted crash window (§A.4).
(Cross-session concurrency is out of v1 scope by the one-team-one-session
invariant; the per-domain single writer chain is the serialization argument.)

### A.3 Unified writer coverage (§2 table W1–W14 + W-T, with Hook B)

| Writer | Store | v1 stamp coverage | Mechanism |
|---|---|---|---|
| W1 / W2 | `team_sessions` (root) | seed | creation puts the row with `generation = 1` (frozen seed = stamp origin; no separate advance) |
| W3 | `team_sessions` (root) | seed | fork creates the new root row → seed 1 for the new team |
| W4 | `team_sessions` (root) | seed / no-op | a freshly created row seeds 1; an identical-bytes re-put is an idempotent no-op; a non-identical re-put is rejected `RECORD_DUPLICATE` — the ONLY post-creation mutation path of the row is `advanceGeneration` itself |
| W5 | `member_instances` | **uncovered direct write** | host-wired adapter puts the member record directly; no fact ⇒ no automatic advance → future-writer obligation (§A.5) |
| W6 | `member_instances` | covered indirectly | the put precedes `journal.drive`; the provisioning journal fact (W14) advances the stamp |
| W7 | `member_instances` (lifecycle) | no production impl in tree | P9/P10 host wiring → future-writer obligation |
| W8 | `overrides` | no production writer in tree | P9/P10 host wiring → future-writer obligation |
| W9 | `compatibility` | **Hook B** | `replaceState` advances after the durable delete+put |
| W10–W14 | `ledger` | **Hook A** | every fact writer goes through `LedgerRepository.put` → advance on each NEW fact (identical-bytes re-put: no advance) |
| W-T | template rows (DTO `templates`) | n/a | materialized from the immutable blueprint snapshot; no store write |

Negative surface (proven by the World-B tests): `allocateSequence` (boot +
bump), `operations` rows, `session_bindings` rows, and direct puts to the
other stores do NOT advance the stamp.

### A.4 Crash window — the v1 consistency-model decision (accepted)

Ordering invariant: the state write is durable BEFORE the stamp put. The crash
window between a durable fact (write W7 of the new 9-write provision chain)
and its stamp put (W8) is ACCEPTED as the v1 consistency model:

- The stamp is **monotonic and eventually consistent**; a crash in the window
  leaves it lagging the durable fact count by **exactly one change**.
- A re-pull at the equal stamp verdicts `duplicate` under the frozen P8-T4
  `assessProjectionSync` (equal-generation verdict) — one duplicate pull is
  the bounded cost. The projections are full states, not deltas, so the next
  strictly newer stamp delivers the complete latest durable state: no client
  can remain behind the durable state for more than one mutation, and any
  lagging client catches up at the next mutation.
- **Recovery does NOT replay a missed stamp advance**: the recovery paths
  (journal roll-forward, coordinator recovery) find the existing durable fact
  via `findFact(operationId)` and reuse it without re-appending — Hook A does
  not fire. A crash in the window therefore leaves the stamp lagging by
  exactly one for that team — each later new fact still advances the stamp by
  exactly one, and one advance was lost, so the residual lag stays at exactly
  one — and this residual is the accepted v1 window, documented here per the
  adjudication. The remapped crash matrix
  (p4t5 B9, the new fact/stamp boundary) proves the recovery side: recovery
  writes exactly 1 (fact reuse + COMMITTED row only, no stamp replay).

### A.5 Future-writer obligation (for the P9/P10 briefs)

Any new production writer that mutates a projection-visible TeamDomain store
must make the stamp advance observable for that change, by exactly one of two
means: (a) preferred — record a durable ledger fact through
`repositories.ledger.put`, where the stamp advance happens automatically via
Hook A; or (b) for a state change that genuinely carries no fact, call
`repositories.teamSessions.advanceGeneration(rootSessionId)` with a
single-row durable put AFTER the state write is durable. The stamp put must
NEVER precede the state write (stamp-first is rejected), a missing team row at
advance time is an invariant violation surfaced loudly as
`SEAM_FAILURE` (public seam `missing-key`), and root-row creation (W1/W3
style) seeding `generation = 1` is the only sanctioned stamp origin.

### A.6 Evidence (attempt 2)

- New tests `packages/storage/test/g8s1-stamp-advance.test.ts` (10 `it`s):
  fresh team seeds at 1 with an empty ledger; four committed operations via
  the REAL journal path advance the stamp strictly 1→2→3→4→5 in lockstep with
  the ledger count 1→2→3→4; a second operation on the same member (identical
  effects skipped) still advances exactly once — the advance tracks the FACT;
  a replay (fact reuse) advances nothing and writes nothing (0 seam writes);
  an identical-bytes re-put of a fact is a no-op that advances nothing;
  non-state writes (allocateSequence ×2, member/operations/overrides/
  compatibility/binding puts) leave the seed untouched with 0 writes; direct
  `advanceGeneration` works; a missing team row → `SEAM_FAILURE` with
  `details.seamCode = 'missing-key'`; a fact put for the teamless root
  rejects while the fact row is already durable (1 fact + counter, 0 team
  rows).
- New tests `packages/runtime/test/g8s1-generation-stamp.test.ts` (5 `it`s):
  a real P6-T2 runtime world walks three delegates through the real router
  (landing exactly on the P6T2 quota boundaries) with the stamp strictly
  1→2→3→4 in lockstep with the ledger count; the projection carries
  `generation = 4` verbatim and a NEW-client re-pull verdicts `apply` (NOT
  `duplicate`), an equal-stamp pull `duplicate`, a stale pull `stale`; the
  applied body equals the latest durable state (member ids, full ledger
  summary, and generation mirror the real rows; the DTO equals an
  independent fresh fold); a same-token replay advances nothing (0 new seam
  writes); Hook B: two durable compatibility probes on a fresh world advance
  1→2→3.
- Remapped existing suites to the new 9-write provision chain (+1 stamp
  write between the fact and the COMMITTED row): storage
  `p4-06-journal`, `p4t2-crash-recovery`, `p4t2-journal`, `p4t2-conflicts`,
  `p4t4-one-committed-invariant`, `p4t4-per-stage-retry`,
  `p4t4-orphan-detect` (+ `p4t2-helpers` / `p4t4-helpers` seeding the team
  row); testkit `p4t5-corrupt-version`, `p4t5-crash-matrix`,
  `p4t5-retry-restart` (+ `p4t5-helpers`: crash boundary B9 remapped to the
  fact/stamp boundary, `STAMP_WRITE_COUNT` unchanged); runtime
  `p6t1-explicit`, `p6t1-recovery`, `p6t3-send-delivery`; committed-world
  fixture `team_domain/team_sessions.json` (root-1 row, generation 2,
  canonical sorted-key JSON); p4t6 scanned-file pin DEC-1 style 482 → 484
  (scanner `.mjs` byte-identical; no new legacy markers).
- RUN 4 on the committed clean tree `18d1ce3` (proof header in
  `attempt-log.md`): chain **1773 passed / 0 failed / 1773 total**; tsc ×6
  (contracts, domain, storage, runtime, testkit, remote) all exit 0.
