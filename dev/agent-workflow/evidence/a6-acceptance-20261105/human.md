# Human escalation to final approval (real Host)

Run: `a6-human-r8` at `5b7381a34` + the human probe (test-only delta committed with
this evidence). Env: `C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1 C1_A6_HUMAN=1`.
Root: `session-c1-smoke-a6-2026-11-05T18-13-09`.

The base A6 member ask is handled exactly as before through the Leader **guard**
leg, then the plane PA leg is escalated by the Officer instead of allowed:

| seq | fact | identity |
| --- | --- | --- |
| 10 | `control-request-recorded` PA leg 1 | `ctrl-1ry3h4c12ghth31mng60204m`, `reviewAuthority:'leader'` |
| 11 | `control-decision-recorded` deny(reason escalated) | decider = Officer `inst-17o924x03ooj`, `role:'member'` |
| 12 | `control-escalation-recorded` | `escalatedBy` = that Officer; `previousRequestId` = PA leg 1; case `case-193yfpm1am6dcd0uewtl01yq` |
| 13 | `control-request-recorded` PA leg 2 | `ctrl-1ss2a7912qhf621mdgkb303s`, `reviewAuthority:'human-user'` |
| 14 | `control-decision-recorded` allow | decider `{kind:'human', humanId: root}` |
| 15 | `control-allow-consumed` | leg 2 |

The remote human resolution used the production `team.resolveControl` entry
(`teamSessionId`, `requestId`, `decision:'allow'`); response is in
`a6-human-response.json`. After consumption the plane executed the original
command **once**; `c1-a6-allow-2026-11-05T18-13-09.txt` contains the marker, and
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
