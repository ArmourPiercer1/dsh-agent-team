# CONTRACT_CHANGE_REQUEST — no settlement state for "admitted, then refused before the body"

**Raised:** 2026-11-22 (round 28), from the adversarial centre review (P1-2) and the rerun of ADM-37.
**Escalation class:** a settlement invariant would have to be relaxed. Per `docs/ROUTER_RULES.md` this is
an owner decision, not something to work around.

## The situation

Two refusals exist, and the frozen settlement contract can only express one of them.

1. **Refused AT admission** (the lane says `deny`, or the lane says `ask` and this port has no approval
   binder, so the ask becomes `ADMISSION_ASK_UNWIRED`): the record's admission reference is `deny`, and
   `REFUSED` is legal and correct. **Fixed in this round**: the port used to settle the raw lane answer
   (`allow` with `decisionKind: 'ask'`), so a refused call was durably recorded as allowed and then
   recovered as UNKNOWN. It now settles the decision it actually enforced.

2. **Refused AFTER admission** (the post-approval recheck: admitted `allow`, the lane narrowed / the
   member was revoked / the policy was recompiled before the body): **the contract has no state for it.**
   Measured against `packages/runtime/settlement/execution-settlement.ts`:
   - `LEGAL_TRANSITIONS.ADMITTED = ['RUNNING', 'REFUSED', 'CANCELLED', 'UNKNOWN']` (`:483`);
   - `REFUSED` requires the cited decision not to be `allow` → `SETTLEMENT_ADMISSION_MISMATCH` (`:932`);
   - `CANCELLED` from ADMITTED requires a recorded `pre-dispatch` Stop → `STOP_EVIDENCE_MISSING` (`:1022`);
   - `FAILED` is unreachable from ADMITTED (`:483`);
   - `UNKNOWN` requires an observation whose `effectEvidence !== 'none-confirmed'` (`:1013`) — i.e. it
     asserts "the effect was not observed", when here the body provably never ran.

Fabricating a Stop to reach CANCELLED would invent an authority signal; writing UNKNOWN would report
ignorance about a call we know did not run. Both are the kind of unearned assertion this project exists
to refuse.

## What the centre does today (and why it is still honest)

- The **execution fact** is `admission-refusal` with `refusalCode: ADMISSION_RECHECK_*` — the precise,
  durable, greppable record of what happened.
- The **settlement** reports `SETTLEMENT_CONTRACT_GAP` through the fault sink and leaves the record in
  `ADMITTED`, so recovery marks it UNKNOWN rather than the centre lying about it.
- ADM-37 asserts exactly this, including that no terminal state is fabricated.

## Options for the owner

| Option | Change | Consequence |
| --- | --- | --- |
| **A (recommended)** | Allow `REFUSED` from `ADMITTED` when the observation is `dispatch: 'not-started'`, and let the record cite a SECOND decision reference (`admission-recheck:<callId>`, decision `deny`) recorded additively | The refusal becomes terminal and truthful; the admission history keeps both decisions instead of overwriting the first |
| **B** | Add a settlement state (e.g. `REFUSED_AFTER_ADMISSION`) | Truthful, but grows a frozen vocabulary and every consumer must learn it |
| **C** | Allow `CANCELLED` from `ADMITTED` with a machine-readable reason and no Stop | Cheapest, but conflates a security refusal with a user Stop in every report |
| **D** | Keep as is | No contract change; `UNKNOWN` stays the recorded outcome for these calls and the fact is the only precise record |

Nothing else in the centre depends on this choice, and no claim of "the settlement says REFUSED" is made
anywhere until the owner rules.

## RESOLVED — owner-approved Option A (round 73, 2026-11-23)

The owner ruled via `docs/reviews/20261122-1536.txt` §2: **approve Option A**, with the strict
conditions restated there (the original allow is never overwritten; a NEW durable deny decision is
appended for the same execution; trustworthy "body never started" evidence; Stop stays distinct; a
crash between the decision write and the termination recovers safely and never replays; persistence
failure is fail-closed). The centre no longer reports `SETTLEMENT_CONTRACT_GAP` for this case.

### What the implementation does

**1. The store records a second decision, append-only — and refuses the relaxation without it.**
`packages/runtime/settlement/execution-settlement.ts`:
- `RecheckDecisionReference` (`execution-settlement.ts:282`) — the decision's own fields: `decisionId`
  (`admission-recheck:<callId>`), `decisionDigest`, `decision: 'deny'`, `decisionKind`, `reasonCode`,
  `subjectExecutionId`, `callId`, **`policyGeneration`** (the generation that refused), `decidedAt`.
- `recordRecheckDecision` (`execution-settlement.ts:1823`) appends it to `record.recheckDecisions`; the record's
  `admission` reference is never touched. It refuses with `RECHECK_NOT_BEFORE_BODY` unless the record
  is still `ADMITTED`, so a `RUNNING` call cannot receive a back-filled pre-execution refusal.
- `assertAdmissionCoherence` (`execution-settlement.ts:1025`) keeps `SETTLEMENT_ADMISSION_MISMATCH` for `REFUSED` against
  an `allow` **unless** the store itself holds a durable recheck deny for this executionId. Without
  that deny the old invariant is exactly as before (negative 1 below).
- `settle` (`execution-settlement.ts:1981`, `terminalDecision` at `:2035`) names the deny on the terminal record as `terminalDecision` (the `admission`
  stays `allow`), and `enterRunning` (`execution-settlement.ts:1872`) refuses with `RECHECK_DENY_BLOCKS_DISPATCH` when a
  durable deny exists — the store, not one caller, is the bar.
- `recoverUnsettled` (`execution-settlement.ts:2058`) reconciles a record that is still `ADMITTED` **with a durable
  deny** to `REFUSED` / `dispatch=not-started` / `effectEvidence=none-confirmed`, citing the deny.
  Other open records keep the old UNKNOWN classification.

**2. The recheck writes the decision BEFORE the settlement terminates.**
`packages/runtime/src/plugin/vnext/admission-port.mjs` `refuseBeforeBody` (`:722`): every pre-body
refusal of an already-admitted call (lane/overlay drift at the guard, and a grant that cannot be spent)
appends the durable deny synchronously through the settlement writer. The original refusal reason is
unchanged, and the body is not run. A throw is reported through the fault sink and the refusal stands
(fail-closed); the eventual terminal write then reports the gap rather than settle a refusal it cannot
evidence.
`packages/runtime/src/plugin/vnext/settlement-port.mjs`: `recheckDenied` (`:151`) writes the
decision (same callId/executionId, its own `policyGeneration`); `refused` (`:201`) keeps the gap
path for the no-durable-deny case, and its message no longer claims the contract lacks a state.

**Why not a third store.** The durable home of the decision is the settlement record it terminates —
the same atomic, fsynced envelope as the admission — and the existing append-only fact ledger remains
the execution/provenance record (`refusalCode: ADMISSION_RECHECK_*`) and the no-replay authority. No
new store, no second authority, no new decision vocabulary: the decision's `reasonCode` is the
PRODUCT's existing composed recheck code (`ADMISSION_RECHECK_LANE_DENY`, …), the code the durable
execution fact already carries. (`ADMISSION_RECHECK_DENIED` is used only by a caller that supplies no
code.)

### Arms (real store + real port + real ledger, `ute-vnext-a1` leg)

| arm | question | verdict |
| --- | --- | --- |
| **ADM-119** | positive: allow (`gen-1`) → durable deny (`gen-2`) → `REFUSED`/`not-started`; `terminalDecision` IS the deny; admission reference and ledger allow fact byte-identical; no fault | PASS |
| **ADM-120** | negative 1: `REFUSED` against an allow with NO durable deny still throws `SETTLEMENT_ADMISSION_MISMATCH`; the port reports `SETTLEMENT_CONTRACT_GAP` and leaves the record `ADMITTED`; no decision invented | PASS |
| **ADM-121** | negative 2: a record in `RUNNING` refuses `recordRecheckDecision` (`RECHECK_NOT_BEFORE_BODY`) and `RUNNING → REFUSED` is `ILLEGAL_TRANSITION`; a durable deny blocks `enterRunning` (`RECHECK_DENY_BLOCKS_DISPATCH`) | PASS |
| **ADM-122** | negative 3: a Stop still settles `CANCELLED` with its `pre-dispatch` stop fact and no deny; a recheck refusal is `REFUSED` with no stop record (never laundered into CANCELLED) | PASS |
| **ADM-123** | crash window: deny written, no termination, fresh store over the same dir → recovery settles `REFUSED`/`not-started` from the durable deny; a fresh ledger refuses the callId as `ADMISSION_REPLAY` and the body is not re-run | PASS |
| **ADM-124** | fail-closed: when `recordRecheckDecision` throws, the guard STILL refuses, the body never runs, the persistence failure is surfaced, and the terminal write reports `SETTLEMENT_CONTRACT_GAP` with the record left `ADMITTED` | PASS |

ADM-37's recheck half was rewritten from "asserts the gap" to the Option A positive, because the old
expectation is now false by owner ruling, not because the assertion was weakened.

### What is still NOT proven

- This is an **in-process mechanism** result, not a live boot: no `D` live judge was added for the
  recheck path in this round, so the row stays MECHANISM (D report §6.1, §6.10).
- `CANCELLED` remains the only Stop state; no `REFUSED_AFTER_ADMISSION` state was added (Option B was
  not chosen).
