# Human escalation to final approval (real Host)

Run: `a6-human-r9` at `a723f3d47` (the human probe and its gate). Env: `C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1 C1_A6_HUMAN=1`.
Root: `session-c1-smoke-a6-2026-11-05T18-36-47`.

The base A6 member ask is handled exactly as before through the Leader **guard**
leg, then the plane PA leg is escalated by the Officer instead of allowed:

| seq | fact | identity |
| --- | --- | --- |
| 10 | `control-request-recorded` PA leg 1 | `ctrl-05lrt9i0q7db3p1fl4jvk1hb`, `reviewAuthority:'leader'` |
| 11 | `control-decision-recorded` deny(reason escalated) | decider = Officer `inst-1x3arpt1rbpk`, `role:'member'` |
| 12 | `control-escalation-recorded` | `escalatedBy` = that Officer; `previousRequestId` = PA leg 1; case `case-06ikalu1u2r3310hd12500yf` |
| 13 | `control-request-recorded` PA leg 2 | `ctrl-05bs7kj0pdei0s1gf3cyh1hl`, `reviewAuthority:'human-user'` |
| 14 | `control-decision-recorded` allow | decider `{kind:'human', humanId: root}` |
| 15 | `control-allow-consumed` | leg 2 |

The remote human resolution used the production `team.resolveControl` entry
(`teamSessionId`, `requestId`, `decision:'allow'`); response is in
`a6-human-response.json`. After consumption the plane executed the original
command **once**; `c1-a6-allow-2026-11-05T18-36-47.txt` contains the marker, and
the worker turn completed (`C1_A6_MEMBER_DONE`). The ledger ends 3 requests /
3 decisions / 2 consumptions / 0 undecided (pending is now computed as
"request with no decision", not the optional `status` field).

## What this does and does not prove

- Proves: the successor ladder reaches `human-user`; the human is the decider;
  the human allow is separately consumed; the call executes once after it.
- Does **not** prove: Stop/cancel/timeout while the human leg is pending, or
  that a human approval arriving after the original call became invalid is
  refused. Those remain NOT_REACHED (row 14).
- The human-current-leg production `reviewEvents` consumer still routes to the
  notifier, whose `native-human` recipient is a deliberate no-op; this run
  drives the human through the remote control entry, not through a Host wake.

## Remote-only discoverability (this round)

RULING 5 permits v1 without Host push, but requires the pending human leg to be
discoverable/readable/resolvable over the real remote interface.

Run `a6-human-r12` (root `session-c1-smoke-a6-2026-11-06T06-51-15`) proves the
first half before any model turn names the id:

- `team.getLedgerPage` (real remote RPC) returns the
  `control-request-recorded` fact carrying the human leg `requestId`
  (`requestFactVisible=true`, exactly one occurrence).
- `team.getProjection` reports `ledger.pendingControlCount=1`.
- `team.resolveControl` then resolves that id; the human allow executes once.

`A6-21` PASS. This is *remotely discoverable*; it is not an active push
notification, which v1 deliberately does not require.
