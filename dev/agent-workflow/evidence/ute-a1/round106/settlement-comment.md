[dated settlement, 2026-11-24T14:45:00Z]

Round 106 settlement for head `57b8924c83d816ee826cbfb276e6e71cae552c75` (branch `vnext/a1-cut`, PR #822 **DRAFT**, unmerged). Base `a19d1df018e772f20602f93bc726694524bdeb2f`. The parent is `563feac139e87e7cc3269d3d4d799afc0b676568` (round-105 post-commit logs). Evidence: `dev/agent-workflow/evidence/ute-a1/round106/`. Worktree `.worktrees/vnext-a1-cut` only; `:3080` and its DSH_HOME were never touched; no force-push, no merge, no history rewrite.

**Seat and model disclosure.** This round had **one writer**: the implementing agent that also posts this settlement. No independent review seat was convened; the deliverable is the implementation of two owner rulings plus test arms and documentation, and the machine-checked gate block below is the evidence seat. Model: the harness-assigned session model (disclosed as such; no model identifier is claimed beyond the harness route).

## Ruling 1 — `SCOPE-subprocess-ask.md` APPROVED BY OWNER (2026-11-24)

Owner review `20261124-2120` ruling 1 formally approved the product scope. The approved promise, verbatim:

> **This generation promises `allow`/`deny` for Subprocess/PTY. Per-call `ask` for process execution is NOT supported and remains fail-closed.**

- `SCOPE-subprocess-ask.md` now carries `STATUS: APPROVED BY OWNER (2026-11-24)`. **Process Ask is `UNSUPPORTED BY PRODUCT RULING`**, the same machine-visible class as PTC (`ADR-ptc-unsupported.md`) — not a defect, not a pending feature.
- PENDING → **APPROVED** in every document that names it: `CAPABILITY-MATRIX-C.md` (C-subprocess, C-pty, the `C-subprocess / C-pty (ask)` row), the single status table in `D-ACCEPTANCE-REPORT.md` (row 30, plus the process-face paragraph), `ADR-approved-ask-receipt.md` (status banner + process-face scope boundary), `OWNER-DECISIONS.md` (round 106), `PR-BODY-draft.md` (SCOPE section).
- `scripts/candidate-acceptance-gate.mjs`'s `knownRefuted` entry cites the **APPROVED** ruling (not "pending"), and stays a **literal id** — never a pattern.
- **The historical `d4:ask-execute-process` REFUTED evidence is preserved verbatim: 16/17 PROVEN, 1 REFUTED, zero process, zero bytes, settlement `FAILED`.** It is not rewritten as a positive test and it is **not** `REFUSED`/`not-started`: the real ask→approval→grant consumption **did occur**, and then the PTY spawn failed with `NO_BACKEND` **before any process existed**.
- `OWNER-DECISIONS.md` records that **future per-call process `ask` support requires a new product contract + a process boundary design** (a governed PTY backend on the binding realm, and a process-scoped receipt that cannot widen the kernel profile).

## Ruling 2 — P0-2 CLOSED: the lawful no-settlement boundary

The owner's formal law, recorded **verbatim** in `OWNER-DECISIONS.md` (round 106) and implemented as tested behaviour:

```
No Admission + No Body Start  =>  No UTE Settlement   (lawful)
Admission Exists              =>  Terminal Settlement Required
Body started + unconfirmable  =>  UNKNOWN (existing rule)
```

All five implementation requirements are met, with no upstream seam and no second authority:

1. The host's `ABORTED_BEFORE_DISPATCH` return is untouched; **no `tools/result` is fabricated** (`pre-dispatch-abort.mjs` is a reader of the host's returned value).
2. `LEDGER_EXECUTION_UNBOUND` keeps failing closed — `fact-ledger.mjs#recordExecution` refuses an execution fact with no admission **before** it appends.
3. `SETTLEMENT_NO_RECORD_BEFORE_ADMISSION` remains a **diagnostic report only**, never a settlement; it names the ExecutionId it could not settle and writes no record.
4. **New rc.5 negative controls** (`SLICE-40`, non-durable + durable halves): a pre-admission cancel leaves **no body, no provider call, no approval request, no minted/spent one-shot grant, no written byte and no centre state row**; the durable ledger holds zero rows and reports `LEDGER_EXECUTION_UNBOUND`.
5. **New rc.5 control** (`SLICE-41`): the exception cannot be used once an admission exists — an admitted-then-stopped call (real `AbortSignal` fired from the admission record's own sink) records the admission fact (`allow`), records the Stop with `phase: 'pre-dispatch'`, and reaches the **terminal `CANCELLED`** settlement (`dispatch`/`bodyOutcome` `not-started`); the no-record report is absent and re-stating the Stop is idempotent, so it is impossible to classify as "no settlement".
6. **Source-level pin** (`SLICE-42`): no code path can create an execution fact without an admission — one execution-row writer in the durable ledger, guarded before its append; one production `recordExecution(` call site; one `record(fact)` after `admissionOf`; one `tools/result` subscription.

P0-2 is **CLOSED** in the single status table (`D-ACCEPTANCE-REPORT.md` row 31) with the ruling cited; the observer still not being wired into a booted host's own agent loop is recorded as a **coverage limit, not an acceptance blocker**. **No refusal code was removed or renamed.** The new arms are green on **both** pinned hosts (rc.2 `639ed015…`, rc.5 `9c2670d3…`).

## Docs brought to this head

`PR-BODY-draft.md` (head + gate status + SCOPE + P0-2 + round-106 section), `D-ACCEPTANCE-REPORT.md` (status table baseline at round 106: row 30 APPROVED / `UNSUPPORTED BY PRODUCT RULING`, row 31 P0-2 CLOSED, the still-open list), `CAPABILITY-MATRIX-C.md` (ask rows APPROVED; P0-2 row CLOSED BY OWNER RULING), `OWNER-DECISIONS.md` (round 106: the law verbatim, the five requirements, ruling 1, future-contract requirement), `ADR-approved-ask-receipt.md`, `SCOPE-subprocess-ask.md`. The owner's still-open next items are **recorded, not attempted**: rc.5 re-runs of `d:remote-creation`/`d2:remote-delivery` including the round-105 rc.5 refutation, the full rc.5 test population, a real-model smoke test, C1–C18 sign-off.

## Gate block at this head (`round106/*-postcommit.log`, `ci-pr-gate-postcommit.log`)

| gate | measured |
| --- | --- |
| `dispatch-tests --run --leg ute-vnext-a1` | **251 tests / 248 pass / 0 fail / 3 skipped**, digest `sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975` (was 248 tests; +3 = the new arms, none deleted) |
| `test-catalog --max-uncollected 41 --max-excluded 7` | tests=785, uncollected=38, excluded=14, digest `sha256:da8a452d65130a3a7f62ef90b549a5289909e689e1ff619c4b3e0c45d5f5ed32`, refused=0 findings=0 |
| `ute-cut-closure --check` | **pass** deleted=148 references=3 prodRefs=0 distResiduals=0 `cut(0/148)` findings=0 |
| `ute-p0-assets --check` | **pass** modules=37 files=180 lines=69512 `cut(148/148)` findings=0 |
| `docs-sync --check` | docs=193 notes=4 plans=152 findings=0 blocking=0 (authority pointer verified) |
| `place-dist-glue` | **35 placements**, all byte-identical |
| `eb3-ci-required` | **pass** workflows=11 findings=0 |
| bound vitest (`ci-integration`, 15 suites) | **PASS** suites=15 files=15 describes=76 passed=238 failed=0 |
| UTE G1 nine-file argv | **89 tests / 89 pass / 0 fail** |
| `EB3-RUN-MANIFEST` | **pass** records=546 strict=0 incomplete=11 findings=0 |
| `ci-pr-gate --full --census-captures 2` | **PASS 10/10** (348.2 s), census **599f/7422l**, 2 captures with **identical identity sets** |
| `ute-a1-window --check` | **pass** red=0/0 `cut=(148/52)` findings=0 |

**No new scannable surface was added**: the round adds three arms **inside** the existing `ute-vnext-a1` slice file and edits one existing script; the test-catalog count and digest are unchanged, the census identity set is identical to the published baseline, and `ute-p0-assets`/`ute-cut-closure` deltas are zero.

**Still open (unchanged, owner's next list):** rc.5 `d:remote-creation` and `d2:remote-delivery` re-runs including the round-105 rc.5 refutation (`d2:remote-delivery` `archived-member-refused-typed`: `lifecycle=SETTLED code=null requestsAdded=0`); the full rc.5 test population; the real-model smoke test; C1–C18 sign-off. `ci-required` keeps reporting RED on this DRAFT while `ci-census` is skipped by the draft tier. **PR #822 stays DRAFT, auto-merge off; the coordinator flips it ready separately.**
