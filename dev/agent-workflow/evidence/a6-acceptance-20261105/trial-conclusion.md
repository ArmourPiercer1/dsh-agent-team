# Isolated Alpha.6 trial conclusion

Date: 2026-11-05. Gate HEAD: `a1868f878` (9/9 local, `gate.md`); evidence HEAD
after this file: docs-only. Branch `alpha6/int-20261103`, rollback tag
`a6-int-pre-585-20261105` (peeled `ccc9294f4e37c230841924713a9624e1553c545a`).
No master merge, no un-draft, no production switch.

## What is proven on the real Host

| Path | Verdict | Anchor |
| --- | --- | --- |
| Member bash → Guard allow → Plane PA allow → one execution | PASS | `a6-officer-host-r2`, durable seqs 8/9 and 11/12 |
| Two approvals are distinct layers, each consumed once | PASS | `duplicate-approvals.md` |
| Leader exception (plane PA leg) | PASS | `a6-exception-r2`, `A6-10` |
| Officer self-review routes to the Leader | PASS | `a6-recipients-r6/r12` |
| Handoff transfer wakes the successor | PASS | `a6-handoff-only-r6`; fix `fd7a5d6c1` |
| Escalation reaches the human leg; human allow consumed once then executes | PASS (authority) | `a6-human-r9` |
| Stop after human allow, before consumption: no execution, second allow rejected | PASS | `a6-stop-r3`, `CONTROL_REQUEST_DECIDED` |
| Crash after PA request write, restart: request durable, human allow fails closed, no execution | PASS (fail-closed) | `a6-crash-r4`, A6-13/14 |
| Crash after PA allow, before consumption: no duplicate consumption/execution | PASS (no duplicate) | `a6-crash-allow-r1`, A6-15 |
| Reconcile the orphaned allow after that crash | **FAIL** | same run: allow seq 11, `consAfter=0`, no file; the approved call is lost |
| Crash after the allow is consumed, before the result: no duplicate consumption/execution | PASS (no duplicate) | `a6-crash-consume-r2`, A6-16 |
| Crash before the PA request write: no phantom request/consumption/execution | PASS | `a6-crash-before-r1`, A6-17 |
| Bounded wait expires: request stays pending, late allow cannot revive | PASS | `a6-timeout-r4`, A6-19/20 |
| Reconcile the consumed but unexecuted allow | **FAIL** | same run: `consBefore=1`, `consAfter=1`, file 0; the spent allow's command is lost |

Full local gate: 9/9, census 677/8830, identity set identical to
`nine-root-u7-1-old-reds.md`; independent review of the product delta
**PASS WITH NOTES**, no P0/P1.

## What is not proven

- **Host human delivery**: `human-current-leg` routes to `native-human`, a
  deliberate no-op. The human resolution above used the remote
  `team.resolveControl` entry, not a Host wake.
- **Cancel racing the guard**: not injected; timeout and Stop are proven.
- **Same-session queued wake**: after a direct prompt to the Officer,
  `followup` reports running but no model turn consumes the queued wake
  (`a6-recipients-r22`, row 15).
- **Recovery of an approved call after crash**: the after-allow window leaves
  an unconsumed allow, and the after-consume window leaves a spent allow with no
  execution; neither is replayed/resumed. This is safe against duplicates but
  loses the approved call (availability gap).
- **Sticky Stop**: the coordinator semantics are implemented and unit-tested,
  but production never dispatches `stop`/`resume`; Host `session/cancel` does
  not reach the wake plane (`sticky-stop.md`). NOT_WIRED.
- **Native Inbox reconciliation**: not injected.
- **Sink unit test**: not added; the E2E plus the code argument are the evidence.

## Decision

**NO-GO for trial enablement, production enablement, master merge, or release.**
The isolated line is accepted for the paths above and remains a DRAFT candidate.
The blockers are liveness/recovery evidence, not a newly found authority
violation: no double execution, no repeat consumption, and no lost approved call
was observed in the runs that were executed.

## Conditions to revisit

1. Fix or formally classify the same-session queued-wake gap, with a real Host
   turn.
2. Exercise the four crash windows and cold-start Inbox reconciliation, showing
   no duplicate execution and no lost pending leg.
3. Decide Sticky Stop semantics and exercise it.
4. Either wire a real Host human delivery path or explicitly ratify remote-only
   human resolution.
5. Add the sink wiring unit test and re-run the hosted CI, not only the local
   9/9 gate.
