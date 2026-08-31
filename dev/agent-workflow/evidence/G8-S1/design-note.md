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
