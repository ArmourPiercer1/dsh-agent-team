# Stop after human allow, before consumption (real Host)

Run: `a6-stop-r3`. Env:
`C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1 C1_A6_STOP=1`.
Root: `session-c1-smoke-a6-2026-11-05T19-19-59`.

The scenario reuses the human-escalation shape: the Officer escalates the PA
leg, the human resolves the `human-user` leg with `allow`, and **then** the
member child Session is stopped through the Host's production
`/api/session/cancel` (`session/cancel`, `{request:{sessionId}}`) before the
allow can be consumed.

Observed:

- human leg `ctrl-1yhummg0nhfgjb0w7l6qe1kk` / `case-0i8helo15r4yun1gjq0qa1pk`,
  `reviewAuthority:'human-user'`.
- `control-decision-recorded` seq 14, `allow`, decider
  `{kind:'human', humanId: root}`.
- `session/cancel` accepted (`{accepted:true}`); no wait/decision is left open
  (`afterCancelPending=0`).
- **No** `control-allow-consumed` for that leg, **no** execution file, and the
  member turn does not complete.
- A second human allow after Stop is rejected with
  `CONTROL_REQUEST_DECIDED` ("the first decision is authoritative").
- `A6-11 PASS`, `A6-12 PASS`.

This is the execution-time non-revival case: the approval exists, but Stop
before the last-mile guard consumed it means the command does not run, and a
later approval cannot revive the same leg.

Not covered here: an approval that arrives after a **wait timeout** (no timeout
injection yet), or a cancel racing the guard itself.
