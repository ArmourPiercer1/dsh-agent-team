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
