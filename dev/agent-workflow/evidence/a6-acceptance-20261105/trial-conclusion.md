# Isolated Alpha.6 trial conclusion

Date: 2026-11-06. Gate HEAD: `fedd641ed` (9/9 local, gate log, census 677/8832;
`gate.md`); docs after this file are docs-only. Evidence HEAD at the gate:
`fedd641ed`. Branch `alpha6/int-20261103`, rollback tag
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
| Bounded wait expires: request stays pending, late allow is recorded fail-closed | PASS | `a6-timeout-r5`, A6-19/20 |
| Human leg discovered from the remote ledger page only, then resolved | PASS | `a6-human-r13`, A6-21 |
| User Stop leaves a durable marker that survives restart and re-delivery | PASS | `a6-sticky-stop-r12`, A6-22/23 |
| Explicit human message after restart clears the durable Stop and re-plans the ACTUAL pending leg; historical call not revived | PASS | `a6-sticky-stop-r13`, A6-24 |
| Native-Inbox crashed-wake reconciliation | NOT PROVEN | multi-root probe only reachable via BLOCKed cross-root recovery; `a6-inbox-r5..r8` |
| Normal Officer allow closes the loop once on the current line | PASS | `a6-normal-r6`, A6-2..6 |
| Handoff wakes the successor and closes the loop once (queued wake) | PASS | `a6-handoff-r8`, A6-8 |
| Reconcile the consumed but unexecuted allow | **FAIL** | same run: `consBefore=1`, `consAfter=1`, file 0; the spent allow's command is lost |

Full local gate: 9/9, census 677/8830, identity set identical to
`nine-root-u7-1-old-reds.md`. Independent review at `212c4fba2` returned
**BLOCK** (no P0): untrusted Stop/resume provenance (P1-1/P1-2), post-restart
resume no-op (P1-3), and an ungated tree (P1-4). The provenance and resume
findings are fixed and Host-proven in `f68dc137c`/`1e50d55fc`:
team-internal deliveries are plugin-sourced, internal cancels are `hook`-caused,
and resume rebuilds its latch from the durable marker. The worktree/gate finding
is closed by the clean 9/9 at `1e50d55fc`.

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
- **Explicit resume delivering a new wake**: proven with a real leg set
  (`a6-sticky-stop-r13`, A6-24). What is not chained in one run is a *new*
  call's allow→execute after resume; the ordinary path is proven separately by
  `a6-normal-r6`.
- **Inbox replacement wake**: `a6-inbox-r5` proves the crashed claim is not
  duplicated, the stale intent row is reconciled away and the durable pending
  request survives; a boot-time replacement wake is allowed but not required
  by the assertion (`pendingAfter>0` is the work guarantee).
- **Native Inbox cold-start replay**: a claimed-wake crash is covered
  (`a6-inbox-r5`); an *unclaimed accepted* wake crash is not injected.
- **Sink unit test**: not added; the marker surface now has unit tests
  (`a6-wake-intent-store.test.ts`).

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
   as v1 (RULING 5 already allows remote-only for v1; `a6-human-r13` now proves
   discovery of the leg id from the remote ledger page itself).
5. Add the sink wiring unit test and re-run hosted CI, not only the local 9/9
   gate.
