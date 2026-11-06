# Isolated Alpha.6 trial conclusion

Date: 2026-11-05. Gate HEAD: `212c4fba2` (9/9 local, 375.9 s, census 677/8830;
`gate.md`); docs after this file are docs-only. Evidence HEAD at the gate:
`212c4fba2`. Branch `alpha6/int-20261103`, rollback tag
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
| Human leg is discoverable over the remote-only ledger/projection | PASS | `a6-human-r12`, A6-21 |
| User Stop leaves a durable marker that survives restart and re-delivery | PASS | `a6-sticky-stop-r3`, A6-22/23 |
| Normal Officer allow closes the loop once on the current line | PASS | `a6-normal-r5`, A6-2..6 |
| Handoff wakes the successor and closes the loop once (queued wake) | PASS | `a6-handoff-r7`, A6-8 |
| Reconcile the consumed but unexecuted allow | **FAIL** | same run: `consBefore=1`, `consAfter=1`, file 0; the spent allow's command is lost |

Full local gate: 9/9, census 677/8830, identity set identical to
`nine-root-u7-1-old-reds.md`; independent review of the product delta
**PASS WITH NOTES**, no P0/P1.

## What is not proven

- **Host human PUSH delivery**: `human-current-leg` routes to `native-human`, a
  deliberate no-op. Discovery/resolution is remote-only (`a6-human-r12`); no
  active Host notification is claimed.
- **Cancel racing the guard**: not injected; timeout and Stop are proven.
- **Recovery of an approved call after crash (availability)**: the after-allow
  window leaves an unconsumed allow and the after-consume window leaves a spent
  allow with no execution. Neither is replayed or resumed, by design (Scheme A),
  so the approved call is lost rather than duplicated.
- **Durable invalidation settlement**: crash recognition is fail-closed and no
  replay occurs, but no new non-authorizing settlement row was added this round
  to mark the original call invalid after restart.
- **Explicit resume delivering a new wake**: the marker is cleared by an
  explicit user message, but a post-resume WorkChanged delivery is not E2E
  proven.
- **Native Inbox cold-start replay**: not injected.
- **Sink unit test**: not added; the E2E plus the code argument are the evidence.

## Decision

**NO-GO for production enablement, master merge, or release.** The isolated
line is accepted for continued isolated internal trial / E2E under the opt-in
`alpha6ReviewRouting` flag and a non-production workspace. It is a DRAFT
candidate and must not be treated as an authority switch. The remaining
limitations are availability/recovery and one resume-delivery proof, not a
newly found authority violation: no double execution, no repeat consumption,
no replay of an invalidated call, and no stale Grant reuse was observed.

## Conditions to revisit

1. Ratify the two crash availability windows as accepted losses or add a
   non-authorizing settlement row that marks the original call invalid.
2. Prove explicit resume delivers a new WorkChanged wake.
3. Exercise native Inbox cold-start reconciliation.
4. Either wire a real Host human delivery path or explicitly ratify remote-only
   as v1 (RULING 5 already allows remote-only for v1).
5. Add the sink wiring unit test and re-run hosted CI, not only the local 9/9
   gate.
