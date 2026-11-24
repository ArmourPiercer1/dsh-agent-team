# Round 106 — the owner approved the three pending decisions; rulings 1 and 2 implemented

**Dated**: 2026-11-24 (real UTC) · branch `vnext/a1-cut` · PR #822 (DRAFT, unmerged) · measured at
`563feac139e87e7cc3269d3d4d799afc0b676568` (this documentation commit is its child). Worktree
`.worktrees/vnext-a1-cut` only; `:3080` and its DSH_HOME untouched. **Sole writer this round.**

## What this round is

The owner's review `20261124-2120` approved all three pending decisions. This round implements
**rulings 1 and 2** and brings the current documents to the current head:

* **Ruling 1** — `SCOPE-subprocess-ask.md` is **APPROVED BY OWNER (2026-11-24)**. The approved promise:
  `allow`/`deny` for Subprocess/PTY supported; per-call `ask` for process execution NOT supported and
  fail-closed. Process Ask is now **`UNSUPPORTED BY PRODUCT RULING`**, the same class as PTC.
* **Ruling 2** — **P0-2 is CLOSED** by the lawful no-settlement boundary. No upstream seam, no second
  authority.
* **Ruling 3** is approved but **not implemented this round** (the coordinator's round).

It changes **no product behaviour beyond ruling 2**, which is a tested-law implementation: no second
authority, no upstream patch, no weakened assertion, no widened timeout, no retry loop, and no rewritten
historical evidence.

## Ruling 2 — the law, and the arms that drive it

The owner's formal law, recorded verbatim in `../OWNER-DECISIONS.md` (round 106):

```
No Admission + No Body Start  =>  No UTE Settlement   (lawful)
Admission Exists              =>  Terminal Settlement Required
Body started + unconfirmable  =>  UNKNOWN (existing rule)
```

Three arms were added to the `ute-vnext-a1` leg's rc.5 slice
(`packages/runtime/test/vnext-fs-slice.test.mjs`), and they are green on **both** pinned hosts:

| arm | what it proves |
| --- | --- |
| **`SLICE-40`** | A pre-admission cancel leaves **no body** (provider counters 0), **no provider call**, **no approval request**, **no minted or spent one-shot grant**, **no written byte**, and **no centre state row** (0 admission facts, 0 settlement records; the durable ledger holds 0 rows and reports `LEDGER_EXECUTION_UNBOUND`). `SETTLEMENT_NO_RECORD_BEFORE_ADMISSION` is a **diagnostic report** naming each ExecutionId — never a settlement — and the host's own pre-dispatch result is what the observer recognised (no fabricated `tools/result`). |
| **`SLICE-41`** | The exception **cannot be used once an admission exists**: a Stop fired from the admission record's own sink (a real `AbortSignal`) is admitted-then-stopped — the admission fact exists (`decision: 'allow'`), the Stop is recorded with `phase: 'pre-dispatch'`, the record reaches the **terminal `CANCELLED`** settlement (`dispatch`/`bodyOutcome` `not-started`), the no-record report is **absent**, and re-stating the Stop is idempotent instead of producing a second/no settlement. |
| **`SLICE-42`** | **Source-level pin**: no code path can create an execution fact without an admission — exactly one execution-row writer in the durable ledger, guarded by the admission check **before** its append; exactly one production `recordExecution(` call site (`member-execution.mjs`, on the member's own ledger); exactly one `record(fact)` in the fact builder, after `admissionOf`; exactly one `tools/result` subscription, calling the one host-result writer. |

No existing refusal code was removed or renamed. `ABORTED_BEFORE_DISPATCH` is read, never replaced.

## Ruling 1 — the approval, and the evidence that is NOT rewritten

`SCOPE-subprocess-ask.md` now carries `STATUS: APPROVED BY OWNER (2026-11-24)` and the exact approved
promise. Every document that named the scope moved PENDING → APPROVED:

* `CAPABILITY-MATRIX-C.md` — C-subprocess, C-pty, the `C-subprocess / C-pty (ask)` proof-table row;
  Process Ask is `UNSUPPORTED BY PRODUCT RULING`;
* `D-ACCEPTANCE-REPORT.md` — the single status table row 30 and the process-face paragraph;
* `ADR-approved-ask-receipt.md` — the status banner and the process-face scope boundary;
* `OWNER-DECISIONS.md` — ruling 1 recorded with the future-requirement statement;
* `PR-BODY-draft.md` — the SCOPE section;
* `scripts/candidate-acceptance-gate.mjs` — the `knownRefuted` citation now names the APPROVED ruling;
  the entry stays a **literal id**, never a pattern.

**The historical `d4:ask-execute-process` REFUTED evidence is preserved verbatim**: 16/17 PROVEN,
1 REFUTED, **zero process, zero bytes, settlement `FAILED`**. The real ask→approval→grant consumption
**did occur**; the PTY spawn then failed with `NO_BACKEND` **before any process existed**. It is not a
positive test and it is **not** `REFUSED`/`not-started`.

## Files

| file | what it is |
| --- | --- |
| `../../../../packages/runtime/test/vnext-fs-slice.test.mjs` | the slice world gains two test-only counters (approval requests, grant mint/spend) and the "abort after admission" signal; adds `SLICE-40`/`SLICE-41`/`SLICE-42` |
| `../../../../scripts/candidate-acceptance-gate.mjs` | `knownRefuted` citation now names the APPROVED ruling (literal id unchanged) |
| `../SCOPE-subprocess-ask.md` | STATUS: APPROVED BY OWNER (2026-11-24) |
| `../OWNER-DECISIONS.md` | round 106: the law verbatim, the five implementation requirements, ruling 1, ruling 3 not implemented |
| `../D-ACCEPTANCE-REPORT.md` | status table at round 106: row 30 APPROVED/`UNSUPPORTED BY PRODUCT RULING`, row 31 **P0-2 CLOSED**, the still-open list the owner wants next |
| `../CAPABILITY-MATRIX-C.md` | C-subprocess/C-pty/ask rows APPROVED; P0-2 row CLOSED BY OWNER RULING |
| `../ADR-approved-ask-receipt.md` | scope boundary APPROVED |
| `../PR-BODY-draft.md` | SCOPE APPROVED, P0-2 CLOSED, round-106 section, head at `563feac13` |
| `*.log` | this round's required-gate outputs (pre-commit at `563feac13`, post-commit at the new head) |
| `settlement-comment.md` | the settlement comment posted for the new head |

## Required-gate outputs at `57b8924c8` (`*-postcommit.log`)

| gate | measured |
| --- | --- |
| `dispatch-tests --run --leg ute-vnext-a1` | **251 tests / 248 pass / 0 fail / 3 skipped**, digest `sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975` |
| `test-catalog --max-uncollected 41 --max-excluded 7` | tests=785, uncollected=38, excluded=14, digest unchanged, refused=0 findings=0 |
| `ute-cut-closure --check` | **pass** deleted=148 prodRefs=0 distResiduals=0 `cut(0/148)` |
| `ute-p0-assets --check` | **pass** modules=37 files=180 lines=69512 `cut(148/148)` |
| `docs-sync --check` | docs=193 findings=0 blocking=0 (authority pointer verified) |
| `place-dist-glue` | **35 placements** byte-identical |
| `eb3-ci-required` | **pass** workflows=11 findings=0 |
| bound vitest (`ci-integration`, 15 suites) | **PASS** describes=76 passed=238 failed=0 |
| UTE G1 nine-file argv | **89 tests / 89 pass / 0 fail** |
| `EB3-RUN-MANIFEST` | **pass** records=546 strict=0 incomplete=11 findings=0 |
| `ci-pr-gate --full --census-captures 2` | **PASS 10/10** (348.2 s), census 599f/7422l, 2 captures with identical identity sets |
| `ute-a1-window --check` | **pass** red=0/0 `cut=(148/52)` |

## What moved, and what did not

* **Moved**: ruling 1 recorded as an owner-approved product scope; P0-2 closed with the ruled law and
  three tested controls; the `ute-vnext-a1` leg grew 248 → **251** tests (3 new arms, zero deleted);
  the documents that named either decision now read consistently.
* **Did not move**: no capability level; no PRODUCT-PROVEN row; no product byte of behaviour beyond the
  ruled law; Required CI's layer set; the `ute-vnext-a1` leg's file set (7 files); the test catalog's
  file set (785, digest unchanged); PR #822 stays **DRAFT** with auto-merge off.

## Still open — the owner's next list (NOT done this round)

Recorded so the candidate does not read as finished; none was attempted:

* rc.5 re-runs of `d:remote-creation` and `d2:remote-delivery` through the candidate gate, **including
  the round-105 rc.5 refutation** (`archived-member-refused-typed`: `lifecycle=SETTLED code=null
  requestsAdded=0`, both boots);
* the **full rc.5 test population** (the candidate gate runs the four live drivers, not the whole map);
* a **real-model smoke test** (every live row still uses the scripted mock);
* **C1–C18 sign-off**.
