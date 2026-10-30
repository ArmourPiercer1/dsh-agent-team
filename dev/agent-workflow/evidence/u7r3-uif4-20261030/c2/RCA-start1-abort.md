# RCA — start#1 (`p1`) run-control abort, before any cell reached a witness

Real UTC 2026-10-30 (post-mortem written between start#1 and start#2).

## What happened (the observable sequence, all from lane-owned evidence)

| time (UTC) | fact | source |
| --- | --- | --- |
| 12:47:29 | run `u5-u7r3-uif4-pos-p1-2026-10-30T12-47-29-667Z` started | `host-start-budget.jsonl` context |
| 12:48:29 | host booted, port 3191, `phase: uif4-boot1` recorded | `host-start-budget.jsonl` line 1 |
| 12:49:25–26 | team-domain stores stamped; anchored ROOT team session created (`team.uif4.anchor`, `inst-leader`) | `tests/homes/u5p1-20261030T12-47-29Z/storages/team_domain.json` |
| 12:49:26 | plane UI mount for the leader: `{"scope":"session-uif4-root-…:inst-leader","leg":"shadow-installed","published":true}` | `tests/homes/u5p1-…/uif4-shadow-ledger.jsonl` line 1 |
| 13:06:29 | `RUN CONTROL: aborted — hard run watchdog: 9.5 min exceeded` | `logs/../run-p1.stdout.log`, `…run-abort.json` |
| — | NO RUN record was ever written; the world and an open socket were still alive → the lane killed its own process group | evidence dir listing; port 3191 answered until the kill |

Post-mortem reads of the lane's own World (read-only, no product files touched):

- `sessions/…/session-uif4-root-…/session.v4.jsonl.zstd` = **1 line, the session header** —
  the ROOT session recorded **zero turns**, so the discovery prompt never ran.
- `storages/team_domain.json` → `team_sessions` has exactly one row (the anchored ROOT
  session); `blueprint_registry` contains only `team.uif4.anchor@1` (**`team.uif4.main`
  was never registered**); `member_instances` has only `inst-leader`; `ledger` has
  **0 rows**. The drive therefore stalled BEFORE `team.create`, i.e. between boot and
  the first prompt — long before any product law could be involved.
- Ports after the kill: 3191 closed; the stable dev instance `:3080` was never touched
  (401 before and after, read-only probe only). Host tree tracked-porcelain stayed 0.

## The defect (lane kit, not product)

`tests/world-factory/lib/u7r3-uif4-answer.mjs` (this lane's inlined answering client)
waited for the `$events` **ready** frame with

```js
while (facts.clientId === null && Date.now() - t0 < timeoutMs) {
  try { await socket.nextFrame() } catch { break }   // ← nextFrame() had NO deadline
}
```

`nextFrame()` resolved **only** when a frame arrived. The `$events` stream is silent
between events by design, so the await never settled, the time test was never
re-evaluated, and the whole drive parked there — before the discovery prompt. Two
secondary lane-kit faults made it unrecoverable: the early-exit paths of the suite
returned without closing that socket or stopping the child, and nothing bounded the
approver's join, so the run-control watchdog aborted the run while the lane process
was still stuck (hence no RUN record).

## The pinned predicate itself was also wrong — recorded as a wire finding

The Host's own mux protocol (`tests/deepseek-harness-test-use/packages/api/gateway/src/stream-protocol.ts:252-258`
and `stream-server.ts:176-235`, pristine 0.2.0-rc.2 @ `639ed01539`, read-only) admits
exactly these **transport** frames:

```
server → client:  {type:'item',  streamId, value?}
                  {type:'end',   streamId}
                  {type:'error', streamId, error:{code,message,details}}
client → server:  {type:'open'|'item'|'end'|'cancel', streamId, …}   // exactKeys enforced
```

The event envelope — `ready{clientId,host}` / `emit` / `waterfall{event,eventId,agentId,request}`
/ `cancel` (`RemoteEventDownlinkFrame`, stream-protocol.ts:33-73) — rides **inside
`value`**. LEG-0 (PR #489, unmerged at spawn) pinned the predicates against the inner
shape, so a client that tests the outer frame never sees a ready frame even when the
Host sent one immediately. `openEventsStreamFrame` (`{type,streamId,endpoint,payload}`,
`payload={args:{}}`) and the result envelope (`{args:{clientId,eventId,outcome}}`) were
verified correct against `parseRemoteStreamClientMessage` / `parseRemoteEventResultPayload`.

## Fix-forward applied on this lane branch (start#2, the single reserved retry)

1. `unwrapEventFrame()` / `isTransportErrorFrame()` — the pinned predicates are now
   applied to the envelope the transport carries, and BOTH layers are recorded
   (`facts.transportTypes`, `transportErrors`, `unwrappedFrames`, capped `rawFrames`).
2. `nextFrame(timeoutMs)` now has its own deadline (resolves `null`, rejects only when
   the socket dies); `waitReady` re-checks its budget every poll.
3. Suite: hoisted `cleanup()` in a `finally` — answerer socket closed, child stopped,
   World torn down, and the leak cell settled on **every** path (bail-out or throw);
   the approver's pages/calls/join all race short timers; a lane-level `HARD_STOP`
   sits inside the run-control watchdog so cells settle to honest verdicts instead of
   an abort with no record.
4. Drive deadlines retuned to finish inside the run-control budget.

Classification: **lane-kit (assembly) defect** — the World booted, the UI family mounted,
and no product-facing step was ever reached. No product law was implicated, so the
Q1 question stays open and is exactly what start#2 is for.
