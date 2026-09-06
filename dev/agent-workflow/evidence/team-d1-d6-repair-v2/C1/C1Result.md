# C1 — D2 minimal structured delivery-result CONTRACT (frozen, v2)

- task_id: C1
- attempt: 1
- model_route: qiyuan-self/qwen3.8-27b
- base_sha: `9b74fa091bff4c957c2a5a58ce3a95b78fa40dd2` (master @ G2 PASS)
- head_sha: (see commit; branch `task/team-d1-d6-v2-C1`, worktree `.worktrees/team-d1-d6-v2-C1`)
- scope: single contract writer of Wave C (C2 consumes the frozen DTO from this commit)
- elapsed_minutes: 15

## Model-route verification (ROUTER_RULES §1.4)

- Runtime declaration (session persona, resolved at session start): "You are a coding agent
  powered by the **qwen3.8-27b** model, running on the DeepSeek Harness".
- Deployment default agent route (`C:\Users\user\.dsh\settings.yaml`, `agent-default-model`):
  provider `qiyuan-self`, model `qwen3.8-27b`; subagent spawn inherits the main agent's route
  (ROUTER_RULES §1.3; no override present in the session header or preset).
- **Route verified: `qiyuan-self/qwen3.8-27b`** — matches the required route. No mismatch; no stop.

## Context pack consumed

- `dev/agent-workflow/evidence/team-d1-d6-repair-v2/A4/A4Result.md` — A4 characterization
  (transcript read seam = public YES; contract delta Team-owned only; per-case semantics;
  single-writer plan). C1 follows A4 Q2/Q3/Q4.
- `dev/agent-workflow/evidence/team-d1-d6-repair/C2/C2Result.md` — v1 C2: completion-only seam,
  Team-owned contract change required, no remote/storage schema identified.
- `docs/local-issues/team-work-result-not-delivered-to-leader.md` — D2 diagnosis.
- `packages/runtime/admission/types.ts`, `packages/runtime/action-router/work-execution.ts`,
  `packages/runtime/action-router/effects.ts` (READ ONLY — C2 owned),
  `packages/runtime/test/p8s3-work-chain.test.ts` (all in this worktree @ 9b74fa0).

---

## FROZEN CONTRACT (task C1 = the single contract writer of Wave C)

### DTO (defined in `packages/runtime/admission/types.ts`; exported via `admission/index.ts`)

```ts
export const WORK_DELIVERY_STATUSES = ['succeeded', 'failed', 'unavailable'] as const
export type WorkDeliveryStatus = (typeof WORK_DELIVERY_STATUSES)[number]

export interface WorkDeliveryResult {
  /** The requestToken the result correlates to, verbatim (echoed, never re-mapped). */
  readonly requestToken: string
  readonly status: WorkDeliveryStatus
  /** Present ONLY for `succeeded`: the delivered turn's readable non-empty assistant text. */
  readonly body?: string
  /** Present for `failed`/`unavailable`: stable code + user-visible message. */
  readonly error?: { readonly code: string; readonly message: string }
}
```

### Port signature change (frozen)

`WorkDeliveryPort.deliver(args)` : `Promise<void>` → `Promise<WorkDeliveryResult>`.
Delivery failure still MUST throw (fail-closed settlement, R6) — on throw NO result is formed;
the throw IS the signal. `signal?` remains accepted (unchanged).

### Chain carriers (frozen)

- `WorkChainResult.memberResult?: WorkDeliveryResult`
  - `full`/`resume`: the port's normalized result for THIS execution (at-least-once: a resume
    re-delivers and carries the FRESH result);
  - `replay`: the synthesized replay result (below);
  - absent only on the fail-closed delivery-failure path (the chain throws instead of returning).
- `RuntimeActionEffect['work-admitted'].memberResult?` and
  `RuntimeActionEffect['member-activated'].memberResult?` — DECLARED by C1, POPULATED by C2
  (`effects.ts` is C2-owned and is NOT touched in this commit; the fields are optional, so the
  package typechecks with effects.ts unchanged).

### REPLAY synthesis (defined and pinned in `work-execution.ts`)

When the requestToken is already durably settled (dedup scan finds the `to: 'SETTLED'`
fact), the chain synthesizes the SAME result for every replay — existing durable state only
(the settlement fact's presence), no re-delivery, no second business report, no storage schema
change, zero durable writes:

```ts
{
  requestToken,                       // the token the Leader used, verbatim
  status: 'unavailable',
  error: {
    code: 'WORK_REPLAYED',            // WORK_RESULT_CODE_REPLAYED (exported)
    message: 'work unit already settled (settlement fact present); original result not re-reported',
  },
}
```

The original business result is deliberately NOT re-served (plan §1.3: replay 不重复 delivery、
不重复业务报告; full transcript explicitly out of scope).

### FROZEN PER-CASE SEMANTICS

| Case | Frozen semantics | Pinned by (C1 tests, `p8s3-work-chain.test.ts`, work-execution level, fake ports) |
|---|---|---|
| **succeeded** | the member turn completed AND a readable non-empty business body exists; `body` present; `error` absent | C1-S1 (full mode, armed succeeded result carried verbatim) |
| **failed** | delivery/turn failed explicitly (turn reason error / aborted / max-tokens / blocked — A4 Q3 mapping: `WORK_TURN_ERROR` / `WORK_TURN_ABORTED` / `WORK_TURN_MAX_TOKENS` / `WORK_TURN_BLOCKED`, code from `LlmFailure` when carried) with stable `error.code` + user-visible message; `body` absent | C1-S2 (`WORK_TURN_ERROR` case), C1-S4 (`WORK_TURN_ABORTED` case on resume) |
| **unavailable** | turn completed but no readable body is available, or the seam cannot determine it (`WORK_NO_ASSISTANT_BODY`; defensive `WORK_TURN_INTERRUPTED` — cold-read synthesizer only, never live) | C1-S2 (`WORK_NO_ASSISTANT_BODY` case) |
| **replay** | already-settled token → the SAME synthesized `unavailable`/`WORK_REPLAYED` result, identical for every replay; exactly-once semantics preserved (zero re-delivery, zero writes) | C1-S3 (first=succeeded with body; 2nd/3rd replays deep-equal the frozen literal; 1 delivery total; ledger byte-unchanged across both replays) |
| **settled separation** | the control-plane `settled` flag stays SEPARATE: `settled: true` alone must NEVER map to `succeeded` | C1-S2 (`settled: true` with `failed` AND with `unavailable`), C1-S3 (replay `settled: true` with `unavailable`) |
| **delivery fault (throw)** | boot fault / `whenIdle` rejection / abort during delivery → fail-closed settlement (`workOutcome: 'delivery-failed'`) + `WORK_DELIVERY_FAILED` rejection; NO `memberResult` is formed (no effect is formed) | existing W4 (unchanged, still green) |
| **cancel/timeout** | no timeout mechanism exists in the chain (A4 risk #2 — scope creep); only caller-side abort through the existing `request.signal`; abort stays explicit failure, never disguised success | A4 Q3 (documented); C2 signal propagation (below) |

### Consumers (C2 follow-up — the frozen interface, A4 Q4 single-writer plan)

1. `packages/runtime/src/plugin/live/agent-bindings.mjs` (C2): `workDelivery.deliver` performs
   the A4 Q1 read after `whenIdle()` + materialization (token-prefixed user message →
   `turn/end` reason → last non-empty `assistant/message`) and RETURNS the normalized
   `WorkDeliveryResult`; the signal race and the fail-closed throw contract are unchanged.
   (Untyped ESM: the C1 type change does not touch it; it will return `undefined` at runtime
   until C2 lands — inert, see remaining risks.)
2. `packages/runtime/action-router/effects.ts` (C2): `runWorkChainOn` copies
   `chain.memberResult` into the `work-admitted` effect; `runDelegate`'s activate path copies it
   into the `member-activated` effect alongside `workSequence`/`workSettled`.
3. **Signal propagation decision (A4 risk #1 — C1's frozen note for C2): PROPAGATE.**
   `runWorkChainOn` must pass `ctx.request.signal` into the chain deps (one-line, contract-
   neutral: `WorkDeliveryPort.deliver` already accepts `signal?`). Today delegate-create
   propagates it (`effects.ts:620`) but the follow-up path drops it — an abort mid-follow-up-
   delivery is not honored until the next boundary. Propagating it keeps abort an explicit
   failure (`WORK_DELIVERY_FAILED` rejection + fail-closed settlement), never a disguised
   success, and needs no schema/wire change. Implementation is C2's (effects.ts is C2-owned);
   C1 freezes the expectation.
4. `packages/tools/src/tools.ts` and `packages/remote/` need ZERO changes (lossless
   pass-through verified by A4 Q2: `toExecutedResult` copies the effect verbatim; the remote
   handler has no field allowlist).

### NO storage schema / NO ledger category / NO remote wire change (verified)

- Settlement fact payload keeps its closed shape (`workOutcome: 'settled' | 'delivery-failed'`
  + `failure?`); the structured result is a transient action-outcome value, not durable state.
- No new fact family; the existing `member-lifecycle-changed` settlement fact remains the
  control-plane truth.
- `memberResult` rides the existing lossless envelopes unchanged (additive optional field).
- No upstream change, no private API: all reads C2 will add use public exported surfaces (A4 Q1).

---

## Tests (TDD: red first, then green)

Seam: `executeWorkChain` (work-execution level) with fake `WorkDeliveryPort`s, driven directly
(`runChainDirect` helper in the test) — the effect mapping is C2-owned, so C1 pins the contract
on the chain's own `WorkChainResult`. House pattern kept: top-level async scenario blocks,
synchronous `it` assertions. The existing 8 scenarios keep their exact assertions (their fake
port now returns a default succeeded result — inert for their control-plane assertions).

### RED (before implementation) — `dev/.../C1/red-transcript-1.txt`

Command: `pnpm exec vitest run test/p8s3-work-chain.test.ts` in `packages/runtime`
(exit 1; full transcript in the file):

```
 ❯ test/p8s3-work-chain.test.ts (12 tests | 4 failed) 9ms
     ✓ R3: work admission fails closed without the lifecycle commit port (zero writes)
     ✓ partial install (commit port only) never runs the chain — the P6-T2 evidence path stands
     ✓ W4: a failed delivery settles fail-closed — no fake RUNNING, a delivery-failed settlement fact
     ✓ W6: the work unit opens and closes its activity interval (subject work-unit, correlation = token)
     ✓ W9: a same-token retry is a durable REPLAY — no re-delivery, no duplicate member/session; a new token still executes
     ✓ resume: a pre-seeded admission fact redelivers exactly once and converges to SETTLED without re-admitting
     ✓ R1 (package-level vertical): a delegate-create runs the full chain on the NEW instance and leaves it durably SETTLED
     ✓ R2: the delivered prompt is the explicit request prompt (no default inheritance), with attachedContext when provided
     × C1: full mode carries the port result — succeeded with the business body, requestToken verbatim
     × C1: failed/unavailable are carried verbatim, and settled=true never maps to succeeded
     × C1: a replay of an already-settled token synthesizes the SAME unavailable result — no re-delivery, no re-report
     × C1: resume mode carries the fresh this-attempt result (at-least-once, visible dedup)

 FAIL ... > C1: full mode carries the port result ...
AssertionError: expected undefined to be 'succeeded' // Object.is equality
- Expected: "succeeded"  + Received: undefined
 ❯ test/p8s3-work-chain.test.ts:1110:25   (expect(c1s1.status).toBe('succeeded'))

 Test Files  1 failed (1)
      Tests  4 failed | 8 passed (12)
```

### GREEN (after implementation) — `dev/.../C1/green-transcript-1.txt`

Command: same (exit 0):

```
 ✓ test/p8s3-work-chain.test.ts (12 tests) 5ms

 Test Files  1 passed (1)
      Tests  12 passed (12)
```

### Full runtime suite — `dev/.../C1/green-full-suite.txt`

Command: `pnpm exec vitest run` in `packages/runtime` (exit 0):

```
 Test Files  129 passed (129)
      Tests  1187 passed (1187)
   Duration  20.18s
```

(The interleaved `stderr | ...` "bootstrap FAILED: ..." lines are EXPECTED negative-path log
output of the fail-closed tests; every suite line is `✓`.)

### Typecheck + build + hygiene

- `pnpm run typecheck` (`tsc -p tsconfig.json`, covers `src` + `test`): **exit 0**.
- `pnpm run build` (`tsc -p tsconfig.build.json`): exit 0. Tracked `packages/runtime/dist`
  was verified IN SYNC at baseline (rebuild at base would be a no-op); the post-change rebuild
  diffs exactly the 12 artifacts of the 3 changed modules
  (`admission/types.{js,d.ts,*.map}`, `admission/index.{js,d.ts,*.map}`,
  `action-router/work-execution.{js,d.ts,*.map}`) — committed for consistency.
- `git diff --check`: clean.

### Install record

- `pnpm install --ignore-scripts` in the worktree: 1m 1.5s, exit 0 (pnpm v11.7.0).

---

## Changed files

Owned (task card):
- `packages/runtime/admission/types.ts` — `WorkDeliveryResult` + status vocabulary (frozen
  DTO); `WorkDeliveryPort.deliver` → `Promise<WorkDeliveryResult>` (doc + signature);
  `memberResult?` on `work-admitted` + `member-activated` effect variants.
- `packages/runtime/action-router/work-execution.ts` — module docs (result propagation);
  `WORK_RESULT_CODE_REPLAYED` + frozen replay message; `WorkChainResult.memberResult?`;
  replay synthesis; full/resume carry the port's result.
- `packages/runtime/test/p8s3-work-chain.test.ts` — fake port returns the frozen result
  (`armResult`); `runChainDirect` helper; C1-S1..S4 scenarios + 4 contract `it`s; header
  coverage note.

Required type-level sites (forced by requirement 1 "repo typechecks"; documented deviation):
- `packages/runtime/admission/index.ts` — 2-line barrel export of the frozen DTO
  (`WORK_DELIVERY_STATUSES`, `WorkDeliveryResult`, `WorkDeliveryStatus`) so C2 can consume it
  from the public surface.
- `packages/runtime/test/tcm-m3-root-initial-work.test.ts`,
  `packages/runtime/test/p8s4a-entrypoints.test.ts`,
  `packages/runtime/test/p8s5b-operation-fencing.test.ts`,
  `packages/runtime/test/p8s7r1-initial-work.test.ts` — these four NON-owned test files
  implement `WorkDeliveryPort` in typed TS; the frozen port signature makes their old
  `Promise<void>` fakes fail the package typecheck. Minimal mechanical adaptation: each fake
  `deliver` now returns the test-neutral
  `{ requestToken, status: 'unavailable', error: { code: 'TEST_FAKE_NO_BODY', message: 'test
  fake delivery: no member body produced' } }`. No assertion in any of them reads the result
  (all still green in the 1187-test run). Flagged for the main agent's awareness.
- `packages/runtime/dist/...` — 12 rebuilt artifacts of the 3 changed modules (tracked in the
  repo; baseline in sync verified by the diff footprint).

NOT touched (C2-owned / forbidden): `packages/runtime/action-router/effects.ts`,
`packages/runtime/src/plugin/live/agent-bindings.mjs`, `packages/tools/`, `packages/remote/`.

## Verification of no storage/remote/schema change

- No durable write path changed: `executeWorkChain` still writes exactly the same facts
  (admission fact, interval facts, settlement fact); the replay branch still writes nothing
  (C1-S3 asserts the ledger is byte-unchanged across two replays).
- No new fact family; settlement fact payload shape unchanged (`workOutcome` closed vocabulary).
- No remote method / subscription added; `memberResult` is an additive optional field on the
  lossless JSON envelopes.

## Infrastructure note (transient, not a code regression)

The first GREEN attempt hit a known Windows `rmSync` ENOTEMPTY race while a scenario's
`finally` destroyed its scratch world (`packages/testkit/test/.tmp-fault/p8s3wc-w4` was left
half-deleted), which poisoned the immediate re-run with `malformed-medium`. Manual cleanup of
the stale `.tmp-fault` entry + re-run → green. The RED runs and the full-suite run destroyed all
worlds cleanly.

## Blocker section

None. No storage/remote/schema need (→ no `CONTRACT_CHANGE_REQUEST`); no upstream change /
private API (→ no `CORE_SEAM_BLOCKER`); no spec conflict; no test-infra blocker (the ENOTEMPTY
flake was cleaned within the task).

## Remaining risks / open items for C2 and G3

1. **Live glue still returns `undefined` until C2**: in this commit a live (non-fake)
   `deliver` resolves to `undefined`, so `WorkChainResult.memberResult` is `undefined` on live
   chains; effects.ts (C2) does not read it yet either — no observable behavior change for any
   host in this commit (no host instances were run in this wave, per the task card).
2. **Chain trusts the port's result (pass-through)**: the chain does NOT validate port results
   (e.g. `succeeded` without `body`, or a mismatched `requestToken`) — no new error-code path
   was added (`admission/errors.ts` untouched). The verbatim-echo and shape obligations are
   producer duties pinned by the DTO/port docs, the C1 chain-level correlation tests (the fake
   echoes the token; the chain must not alter it), and C2's glue tests. If G3 wants a
   fail-closed chain-level validator, that is a follow-up decision (needs a closed code).
3. **Replay non-re-reporting is lossy by design** (A4 risk #4): if the Leader's original
   observation was lost (e.g. context compaction), the body cannot be recovered via replay —
   accepted limitation of the minimal contract (plan §1.3).
4. **Body size: no cap in v2** (A4 risk #3): one member message, not a transcript — compliant;
   documented, not implemented.
5. **Signal propagation (frozen decision = PROPAGATE)** is C2's one-line effect; until it
   lands, an abort mid-follow-up-delivery is not honored until the next boundary (A4 Q3
   asymmetry) — delegate-create is already covered.
6. **Windows test-infra flake**: the `rmSync` ENOTEMPTY race can leave a half-cleared
   `.tmp-fault` world that poisons the next run until manually cleaned (known, pre-existing).

## TaskResult

- task: C1
- attempt: 1
- elapsed_minutes: 15
- base_sha: `9b74fa091bff4c957c2a5a58ce3a95b78fa40dd2`
- head_sha: (this commit)
- changed_files: 3 owned source/test + 1 barrel + 4 forced test-fake adaptations + 12 dist
  artifacts + this evidence dir (see "Changed files")
- tests: red `4 failed | 8 passed (12)` → green `12 passed (12)`; full runtime suite
  `129 files / 1187 tests passed (exit 0)`; typecheck `exit 0`; build `exit 0`;
  `git diff --check` clean
- verdict: PASS
- blocker: none
- remaining_risks: see "Remaining risks / open items for C2 and G3"
