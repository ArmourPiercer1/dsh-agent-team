# Isolated Alpha.6 trial conclusion

Date: 2026-11-06 (closing round 2026-11-07). Gate HEAD: `28b61d4b2`
(9/9 local, 298.7 s, census 677 files / 8833 legs, identity set identical;
`gate.md`); docs after this file are docs-only. Product evidence for the closing
round is bound by per-run `run-manifest.json` at the same commit
`28b61d4b296c0648f365a24751f390524361fc0e`. Earlier full-arc runs were taken at
`fb6ccb4f4` and are retained as the prior evidence head. Branch
`alpha6/int-20261103`, rollback tag `a6-int-pre-585-20261105` (peeled
`ccc9294f4e37c230841924713a9624e1553c545a`). No master merge, no un-draft, no
production switch.

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
| Crash after PA allow, before consumption: Allow stays immutable, invocation abandoned, zero execution | PASS | `a6-crash-allow-r4` (28b61d4b2), A6-15 |
| Crash after consumption, body not started: execution-outcome-unknown, no replay | PASS | `a6-crash-consume-r8` (28b61d4b2), A6-16 |
| Body started, result not durable: outcome-unknown, no replay | **NOT PROVEN (real Host)** | kit mode exists, but the delaying command routes to the A5 parameter-permission lane; disclosed in `crash-and-inbox.md` |
| Crash before the PA request write: no phantom request/consumption/execution | PASS | `a6-crash-before-r1`, A6-17 |
| Bounded A6 wait expires: invocation abandoned (no decision rewrite), late allow refused | PASS | `a6-timeout-r9` (28b61d4b2), A6-19/20 |
| Human leg discovered from the remote ledger page only, then resolved | PASS | `a6-human-r15`, A6-21 |
| User Stop leaves a durable marker that survives restart and re-delivery | PASS | `a6-sticky-stop-r14`, A6-22/23 |
| Explicit human message after restart clears the durable Stop and re-plans the ACTUAL pending leg; historical call not revived | PASS | `a6-sticky-stop-r14`, A6-24 |
| A wake claimed by a crashed turn is reconciled without duplicate and the durable request is decided; exact replacement-delivery vs original-turn recovery is NOT isolated | **PARTIAL** | `a6-inbox-r14` (28b61d4b2), A6-25; metric defect disclosed |
| Normal Officer allow closes the loop once on the current line | PASS | `a6-normal-r9` (28b61d4b2), A6-2..6 |
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
- **Durable invalidation settlement**: now implemented (additive
  `control-request-abandoned`; Allow never rewritten). Proven for timeout,
  after-allow and after-consume-before-body. The body-started-result-unknown
  probe could not be produced on the real Host (see above); the settlement
  reason is shared with the proven consume case.
- **Explicit resume delivering a new wake**: proven with a real leg set
  (`a6-sticky-stop-r14`, A6-24). What is not chained in one run is a *new*
  call's allow→execute after resume; the ordinary path is proven separately by
  `a6-normal-r8`.
- **Inbox replacement wake**: `a6-inbox-r14` proves no duplicate and a
  completed decision after the crashed claim, but the kit's mixed metric
  (`1 -> 2 -> 1`) cannot show exactly one new delivery vs the original turn
  resuming. Liveness mechanism remains PARTIAL. An ACCEPTED-but-never-CLAIMED
  crash is still not injected.
- **Native Inbox cold-start replay**: a claimed-wake crash is covered
  (`a6-inbox-r9`); an *accepted but still queued* wake crash is not injected.
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
   as v1 (RULING 5 already allows remote-only for v1; `a6-human-r15` now proves
   discovery of the leg id from the remote ledger page itself).
5. Add the sink wiring unit test and re-run hosted CI, not only the local 9/9
   gate.
