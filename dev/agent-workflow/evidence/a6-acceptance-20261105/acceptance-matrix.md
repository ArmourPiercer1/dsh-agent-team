# Alpha.6 isolated integration + real-Host E2E — acceptance matrix

- **Integrated code HEAD under test:** `a1868f878` (product fix `fd7a5d6c1` plus the
  recipient/refusal probes; full gate 9/9 in `gate.md`).
- **Real Host runs:** the core run is `a6-officer-host-r2` (stamp
  `2026-11-05T13-22-47`); the recipient/refusal rows use the later gated runs
  `a6-exception-r2`, `a6-human-r9`, `a6-handoff-only-r6` and `a6-stop-r3`, whose
  raw logs are committed under `dev/agent-workflow/evidence/`.
- **Scope:** isolated integration and real Host E2E only. No master merge, no un-draft,
  no production enablement, no release.
- **Scope:** isolated integration and real Host E2E only. No master merge, no un-draft, no
  production enablement, no release.

## Core criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | v5 `team.create` admits a real Officer + review routing | **PASS** | `run.log` A6-1; created root `session-c1-smoke-a6-2026-11-05T13-22-47`, blueprint hash `sha256:fc0963…` |
| 2 | Real Member bash ask produces a model-visible Officer review wake | **PASS** | `a6-officer.json` `.wakes`: 3 Officer turns, wake text carries `requestId: - ctrl-1u2v1ph…`; `mock.log` wake seq 13 |
| 3 | Officer resolves through `team_resolve_control` | **PASS** | `mock.log` seq 14; durable decision sequence 11, `reviewCapability.source = blueprint-officer`, `effectiveReviewAuthority = leader` |
| 4 | The original Member command executes after the Officer allow | **PASS** | `executed=true`; workspace file `tests/homes/c1-smoke-2026-11-05T13-22-47/workspace/c1-a6-allow-2026-11-05T13-22-47.txt` contains the stamp |
| 5 | The Leader is not woken for a leg routed to the Officer | **PASS (scoped)** | `leaderWakeCount=0` means no **Officer review wake** went to the Leader. The separate legacy guard ask (row 1) did use the Leader notification path; see the duplicate report. |
| 6 | No durable request is left pending | **PASS** | 2 requests, 2 decisions, 2 consumptions, `pending=0` |
| 7 | One-shot consumption / no double execution | **PASS** | exactly one `control-allow-consumed` per request (sequences 9 and 12); one file write; no second execution |
| 8 | Two approvals for one bash invocation both settle and are consumed | **PASS** | `parameter-permission` allow+consumed seq 8/9; `team-tool-execute` allow+consumed seq 11/12; identities differ (see duplicate report) |
| 9 | Durable facts, not a unit substitute | **PASS** | `control-ledger.json` carries the full `control-request-recorded` / `control-decision-recorded` / `control-allow-consumed` payloads, including scope, fingerprints and generation |

## Recipient, refusal and extended criteria

| # | Required scenario | Result | Why |
|---|---|---|---|
| 10 | Leader exception routing | **PASS** | clean real Host `a6-exception-r2` (`c4a4e5616`): the declared `worker`/`dsh-agent-team:bash` exception discriminates on the **plane PA** leg — 0 Officer review wakes, PA allow decider `role:'leader'`, consumed, executed once. The guard reaches the Leader through the ordinary legacy path in every A6 run, so it is not the discriminator; see `leader-exception.md` |
| 11 | Officer self-review | **PASS** | real Host `a6-recipients-r6` / `r12`: Officer's own PA leg `ctrl-1lc9fk11mqfnfy168muob00k` decided by Leader seq 19, consumed seq 20, command executed; see `recipients.md` |
| 12 | Handoff successor notification / production `reviewEvents` consumer | **PASS** | clean real Host `a6-handoff-only-r6`: transfer seq 22 → Leader decision seq 23 → execution once. The missing production `reviewEvents` consumer was the defect; fixed in `fd7a5d6c1`; `recipients.md` |
| 13 | Human escalation authority / final approval | **PASS (authority); Host human wake NOT_REACHED** | clean real Host `a6-human-r9`: Officer escalate seq 12, human leg seq 13 (`reviewAuthority:'human-user'`), human allow seq 14 (`decider.kind:'human'`), consumed seq 15, command executed once; see `human.md`. The human is resolved through the remote `team.resolveControl` entry; `human-current-leg` routes to `native-human`, a deliberate no-op, so no Host human wake is claimed |
| 14 | Execution-time revalidation, Stop/cancel/timeout non-revival | **PASS (timeout/Stop); cancel-racing-guard NOT_REACHED** | Stop: allow seq 14, cancel accepted, no consumption/execution, second allow `CONTROL_REQUEST_DECIDED` (`a6-stop-r3`). Bounded wait: `alpha6WaitTimeoutMs=5000`, PA stays pending, no consumption/execution, late allow fail-closed `authority-undetermined` (`a6-timeout-r4`, A6-19/20). A cancel racing the guard is still not injected; see `timeout-and-queue.md` |
| 15 | queued / claim / release under crash, Sticky Stop, four crash windows, native Inbox reconciliation | **PARTIAL** | two real windows: post-write (`a6-crash-r4`: request durable, post-restart human allow fail-closed `authority-undetermined`, no execution) and after-allow-before-consume (`a6-crash-allow-r1`: allow seq 11 with `consBefore=0`, restart leaves `consAfter=0`, no duplicate consumption/execution, but the approved call is **not reconciled/replayed** — a lost approved call). after-consume-before-result (`a6-crash-consume-r2`: `consBefore=1`, restart keeps `consAfter=1`, no duplicate execution, but the consumed allow's command is never executed — a lost execution). before-PA-write (`a6-crash-before-r1`: kill at the Guard admission, restart leaves no phantom PA request/consumption and no execution). All four crash windows now have real-Host evidence; the two approval-window gaps above remain FAIL for recovery. Same-session queued wake still has no model turn; Sticky Stop is **NOT_WIRED** in production (no non-test `stop`/`resume` dispatch to the wake coordinator; see `sticky-stop.md`), and native inbox replay remains unreached; see `crash-and-inbox.md` |
| 16 | Duplicate-approval elimination | **NOT_IMPLEMENTED** | evidence collected; recommendation only (see duplicate report) |

## Gate

Full local gate **9/9 PASS, zero skips** on `4e569e757`; the evidence commits after
it change docs/evidence only. `gate.md` records the exact SHA and outputs:
`node scripts/ci-pr-gate.mjs --full`, `CI=true`,
`DSH_CI_STORE_DIR=$PWD/.drill/pnpm-store`, pristine host symlink present.

Census result on the passing final run: **677 files / 8830 legs**, `COUNTS MOVED, SET DID NOT`,
0 new reds / 0 collection errors. The earlier E2E HEAD `8ea3a05` had 8/9 legs green; its
census capture hit two pre-existing 1 ms race tests (`alpha5-glob-backend` X3 and
`alpha5-search-backend` P11), each passing standalone; the final integrated run passed.
See `gate.md` for the exact outputs and the flake disclosure.

## Independent review

Latest review of `b4d4d21e..8114db4b7`: **PASS WITH NOTES**; no P0/P1 in the
product change, P2 evidence/probe fixes tracked in `review-response.md`.

Earlier review at `8ea3a0517`: **BLOCK** (no P0; P1-1 notification-policy bypass,
P1-2 per-root router policy). Both P1s, P2-1 and the verifier-test gap are fixed
in `996427e3f`; P2-3 is covered by the rerun gate; P3 root/ledger items are
addressed. The real Host E2E was rerun at `c26a9a00` after the fixes and passed
6/6 again. A second independent review of the fix commit returned
**PASS_WITH_P2** (both P1s closed, no new P0/P1); the one non-discriminating
regression test was made leg-bearing in `90937099d`. See `review-response.md`.

## Verdict

**Isolated integration: PASS on the reached path; review P1s cleared.** A real Member call routed to the
assigned Officer, the Officer's durable allow was consumed, and the exact command executed
once. Rows 14-16 are partial/blocked as stated; they are not silently passed. The
isolated-trial decision is **NO-GO for enablement/release**; see
`trial-conclusion.md`. Production enablement and master merge remain blocked.
