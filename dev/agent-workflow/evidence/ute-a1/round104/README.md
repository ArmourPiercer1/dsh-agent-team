# Round 104 — the Subprocess/PTY scope statement (review `20261124-1341` §3.1)

**Dated**: 2026-11-24 (real UTC) · branch `vnext/a1-cut` · PR #822 (DRAFT, unmerged) · measured at
`f3b306e87f75694201bff286d93652e93249d56a`. Worktree `.worktrees/vnext-a1-cut` only; `:3080` and its
DSH_HOME untouched.

## What this round is

The external architecture review (`docs/reviews/20261124-1341.txt` §3.1) asked for the **declared scope**
of the Subprocess/PTY `ask` path to be written down, because the candidate already refuses it but its
prose still implied the leg was a pending fix. This round answers with **one document and four
cross-references**. It is documentation only: **zero product behaviour changed, no test assertion
touched, no upstream patch, no history rewrite.**

Deliverable: `dev/agent-workflow/evidence/ute-a1/SCOPE-subprocess-ask.md` (**PENDING OWNER
CONFIRMATION**).

**The declared promise, verbatim:**

> **This generation promises `allow`/`deny` for Subprocess/PTY. Per-call `ask` for process execution is
> NOT supported and remains fail-closed.**

The behaviour does not change either way the owner rules; only the declared promise does.

## Files

| file | what it is |
| --- | --- |
| `../SCOPE-subprocess-ask.md` | the scope statement: the promise, what is explicitly NOT promised, the process behaviours that ARE proven (live persistent `bash` under the OS sandbox, out-of-lane refusal, PTY confinement, Stop), the exact current refusal evidence on both hosts (zero bytes, `FAILED`), the R3-receipt boundary, the two preconditions a future generation would need, and the two visible P0-2 lines |
| `../CAPABILITY-MATRIX-C.md` | cross-referenced from the C-subprocess row, the C-pty row, and the C-subprocess/C-pty `ask` row |
| `../D-ACCEPTANCE-REPORT.md` | cross-referenced from the single current acceptance-status table (row 30) plus the two P0-2 lines and the process-face scope note added directly under the table |
| `../ADR-approved-ask-receipt.md` | cross-referenced from the Status banner and the process-face paragraph ("Scope boundary", `PENDING OWNER CONFIRMATION`) |
| `../PR-BODY-draft.md` | new "SCOPE — the Subprocess/PTY promise" section before ROUND 102 |
| `dispatch-tests.log` | `dispatch-tests --run --leg ute-vnext-a1` — 248 tests / 245 pass / 0 fail / 3 skipped, digest `sha256:edd4f1c4…` unchanged |
| `test-catalog.log` | `test-catalog --max-uncollected 41 --max-excluded 7` — tests=785 refused=0 findings=0 (uncollected 38 / excluded 14) |
| `ute-cut-closure.log` | `ute-cut-closure --check` — pass, `cut(0/148)`, deleted=148 prodRefs=0 distResiduals=0 |
| `ute-p0-assets.log` | `ute-p0-assets --check` — pass, 37 modules / 180 files / 69512 lines, `cut(148/148)` |
| `docs-sync.log` | `docs-sync --check` — docs=193 findings=0 blocking=0, authority pointer verified |
| `place-dist-glue.log` | `place-dist-glue` — done, **35 placements byte-identical** |
| `eb3-ci-required.log` | `eb3-ci-required` — pass workflows=10 findings=0 |
| `bound-vitest.log` | bound vitest leg `eb3-security-run --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000` — PASS 15 suites / 238 passed / 0 failed |
| `ute-g1-argv.log` | UTE G1 `node --test` nine-file argv — 89 tests / 89 pass / 0 fail |
| `eb3-run-manifest.log` | `eb3-run-manifest` — records=520 strict=0/148 incomplete=11 findings=0 |
| `ci-pr-gate.log` | `ci-pr-gate --full --census-captures 2` — **PASS 10/10** (284.9 s), census 2 captures identical |
| `ute-a1-window.log` | `ute-a1-window --check` — pass red=0/0 `cut=(148/52)` |
| `head-at-start.txt` | the parent HEAD this round was written against |

Post-commit reruns (`docs-sync-postcommit.log`, `test-catalog-postcommit.log`, `ute-cut-closure-postcommit.log`,
`ute-p0-assets-postcommit.log`, `place-dist-glue-postcommit.log`, `ute-a1-window-postcommit.log`) re-assert
the same verdicts with the documentation commit staged, so the committed tree — not just the working tree —
is what the gates saw.

## What was actually established

1. **The promise is now explicit and narrow.** `allow`/`deny` only; per-call process `ask` is not
   supported. The refusal is the promise, not a pending fix.
2. **The refusal is documented with both hosts' exact evidence.** `Error: no PTY backend registered for
   "a5sf-governed-shell"` (`NO_BACKEND`) at the tool's backend lookup; zero bytes, no process, settlement
   `FAILED`, receipt verifier never reached — rc.2 and rc.5 alike.
3. **The proven process behaviours are separated from the unproven one.** Live persistent `bash` under the
   OS sandbox (two turns on one shell), out-of-lane OS refusal (`Read-only file system`, 0 bytes), PTY
   confinement (`OWNER_NOT_LIVE` / `PTY_PROCESS_DENIED` / `PTY_PROCESS_RECEIPT_REFUSED`), and Stop
   (`d2:stop`; `d4:ask-stopped`) stand; `d4:ask-execute-process` does not.
4. **The receipt boundary is stated.** R3 stays FS-scoped as a live promise; a file-operation receipt is
   never permission to bypass the OS sandbox, and no approval may widen the kernel profile. The round-99
   process-face receipt is MECHANISM only.
5. **The future precondition is concrete.** A governed PTY backend on the binding realm (so the backend
   lookup resolves before the verifier) **and** a process-scoped receipt that cannot widen the kernel
   profile. Neither is scheduled.
6. **P0-2 is visible in the status table** as the review asked: OPEN TARGET-HOST ACCEPTANCE BLOCKER —
   pre-dispatch Stop observation not production-wired — plus what closes it.

## Still open (unchanged by this round)

`d4:ask-execute-process` REFUTED (now **declared scope**, PENDING OWNER CONFIRMATION); P0-2 OPEN
target-host acceptance blocker; the rc.5 column of `d:remote-creation` and `d2:remote-delivery` is not
recorded; the wider vitest/node:test population is still not re-run on rc.5; `ci-required` keeps
reporting RED on this DRAFT while `ci-census` is skipped by the draft tier. **PR #822 stays DRAFT and
unmerged.**
