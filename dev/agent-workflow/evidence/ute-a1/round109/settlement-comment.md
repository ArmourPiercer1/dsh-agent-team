[dated settlement, 2026-11-24T18:56:04Z]

Settlement for `c297e7dbe51a9e3b6071ec3f22d9db4724408363` (round 109 — full typed replies, the dual-host candidate gate, and workflow HEAD binding). Parent chain: `41d579119` (round-108 post-commit logs) → `6ef5394b3` (round-109 feature + docs + evidence) → `c297e7dbe` (post-commit gate logs). Fast-forward push `41d579119..c297e7dbe`; no history rewrite, no merge, **PR #822 stays DRAFT**.

**Why this round exists.** Review `20261125-0058` left five Stage-A items: (1) make the `d2:remote-delivery` driver record the FULL typed `member.archive`/`member.send`/`member.restore` replies; (2) a dual-host Candidate Gate PASS; (3) bind the candidate workflow to every candidate HEAD; (4) disclose the dual-host cost; (5) refresh the PR body to the current head. All five are closed; nothing is upgraded.

## Disposition

| item | result |
| --- | --- |
| Full typed replies | `archiveReply` / `sendReply` (archived) / `restoreReply` / `sendReply` (restored) now carry `httpStatus`, answered **`rpcId`**, `envelopeType`, `ok`, the **verbatim `result.error`** (incl. `details.cause.lifecycle`/`accepting`) and the full `result.value`. **Observation only: 61 inserted / 0 changed lines**, judge untouched, no clause relaxed, no judge skipped, no timeout widened, no retry, `KNOWN_REFUTED` not edited. Committed driver bytes = the gate's own `driver-digest` (`sha256 389b3343f642c0da8156257971c73a28520cfe0e586133003dd8254296949187`). |
| rc.5 live sequence | `member.archive` accepted (`rpcId d2rd-t7wbdnj5y7`, `lifecycle=ARCHIVED`, steps `close-admission/interrupt/drain-descendants/wait-quiescence/release-residency/commit-archive`) → send to ARCHIVED refused `TEAM_RUNTIME_WORK_STATE_REJECTED` (`details.cause.lifecycle=ARCHIVED`, `accepting=CREATED/RUNNING/SETTLED`, `requestsAdded=0`) → `member.restore` accepted (`lifecycle=SETTLED`) → send after restore accepted (`ok=true`, `delivered`). Boot 2 identical except the RPC ids. `d2:remote-delivery` PASS 20/20 clauses each boot. |
| Dual-host Candidate Gate | **PASS on both hosts in one run** (`--hosts both`): rc.2 **31 / 30 / 1 / 0**, rc.5 **31 / 30 / 1 / 0**, totals **62 / 60 / 2 / 0**; the only non-PROVEN id is the single enumerated `d4:ask-execute-process` (per host). 8 RUN records per host, two-boot agreement. `KNOWN_REFUTED` untouched. |
| Workflow HEAD binding | `pull_request: [labeled, synchronize, reopened]` (branches `[master]`) + `workflow_dispatch`; the JOB is gated on the `candidate-acceptance` label being PRESENT (`contains(github.event.pull_request.labels.*.name, …)`), not on the label event alone. Check name `candidate-acceptance (NOT Required) head=<github.sha>`; checkout pinned to `github.sha`; artifact name carries it; a `Bind the graded head` step asserts checkout == verdict `head` == `github.sha` **and** that the artifact is fresh (`-newer` marker), so a stale verdict cannot answer for a new HEAD. **Still `knownNonRequired`**: `ci-required`'s layer list untouched, not a branch-protection context. |
| Cost | One dual-host run measured **83 m 48 s** (17:17:46 → 18:41:34), vs a few minutes for the whole daily Required set. Disclosed in the workflow header, the manifest reason, `D-ACCEPTANCE-REPORT.md` and `CAPABILITY-MATRIX-C.md`. |
| PR body | Refreshed from the round-95 text to this head: rounds 106–108 rulings, the all-green hosted set **with census** (`a4a00fc81`: `ci-required` 45429461306 green incl. `ci-census`), the candidate gate's current state, and the remaining open items. |

## Gate block at `c297e7dbe` (logs `dev/agent-workflow/evidence/ute-a1/round109/`)

```
candidate-acceptance-gate --hosts both   PASS 62 judges / 60 proven / 2 known-refuted / 0 env-limited
                                         83 m 48 s; head 41d579119 + arm
dispatch-tests --run --leg ute-vnext-a1  251 tests / 248 pass / 0 fail / 3 skipped (sha256:edd4f1c4… unchanged)
test-catalog --max-uncollected 41 --max-excluded 7   tests=785 / uncollected 38 / excluded 14 / findings 0
                                          digest sha256:da8a452d… UNCHANGED — measured delta 0, no new scannable file
ute-cut-closure --check                  pass cut(0/148) deleted=148 references=3 prodRefs=0 distResiduals=0
ute-p0-assets --check                    pass 37 modules / 180 files / 69,512 lines cut(148/148)
docs-sync --check                        docs=193 notes=4 plans=152 findings=0 blocking=0 contracts=20
place-dist-glue                          done (35 placement(s)), byte-identical
eb3-ci-required                          pass workflows=11 findings=0
bound vitest leg (ci-integration)        PASS 15 suites / 76 describes / 238 passed / 0 failed
UTE G1 nine-file argv                    89 tests / 89 pass / 0 fail / 0 skipped
ute-a1-window --check                    pass red=0/0 cut=(148/52)
eb3-run-manifest                         pass records=600 strict=0 incomplete=11 findings=0
ci-pr-gate --full --census-captures 2    PASS 10/10 (283.3 s; census 599f/7424l, identical identity sets)
```

## What this settlement does and does not mean

- **The candidate gate stays NON-REQUIRED by owner ruling.** A green dual-host gate is still `DEV-LIVE` evidence: **no row becomes PRODUCT-PROVEN until the gate is REQUIRED by branch protection AND green at the final head.** The single acceptance table and `CAPABILITY-MATRIX-C.md` say exactly that.
- No row moved. No `KNOWN_REFUTED` entry added. No judge weakened, no driver skipped, no timeout widened, no retry loop, no upstream patch.
- PR #822 remains **DRAFT** and unmerged; `:3080` and its DSH_HOME were not touched; no other worktree was touched; no force-push.
- Remaining open items are unchanged: the `D-ACCEPTANCE-REPORT.md` §10 register (root-work commands G4, rc.5 pre-dispatch-abort wiring G5, `member.create`/`member.followup` live evidence G6, ENV-LIMITED census arms G7, operator model G8, scripted model G9) and the enumerated `d4:ask-execute-process` scope.
