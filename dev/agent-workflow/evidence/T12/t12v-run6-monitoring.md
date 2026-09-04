# T12 run #6 — monitoring budget (job pwsh-126, nonce mtke5bxi426eb0)

Launched 2026-09-02T17:49:44Z. Phases: build, fresh1, fresh2, restart1, handoff.

## Computed worst-case (every 480 s budget fully consumed + boots)

| phase | worst case | expected (no gaps) |
| --- | --- | --- |
| build | ~30 s | ~10 s (observed: 4 s tsc + probe) |
| fresh1 (V1,V2-A,V3,V4,LIFECYCLE,V5) | ~52 min (V2-A 480 + V3 180 + V4 960 + LC 1440 + margins) | ~1–2 min |
| fresh2 (V2-B) | ~9 min (boot 180 + childAck 480 + margins) | ~30 s |
| restart1 (A2 resume — expected row-setup FAIL fast) | ~3 min | ~30–60 s |
| handoff (C1 boot + c1Ack 480 + b1 480 + c2Ack 480 + b2 480 + boots) | ~35 min | ~1–2 min |
| TOTAL | **~95 min** (deadline ≈ 19:25Z) | ~5–10 min |

## Hang rule

Treat silence as a hang ONLY beyond: (worst-case remaining for the current phase) + 3 min.
On hang: kill job pwsh-126, keep `t12v-*.log` + `instances/*` + durable homes, write
`t12v-hang-run6.log` (tail of runner log + state probe via t12v-live-probe.mjs).

## Observed so far

- 17:49:55.921 mock reply #2 = ROOT_FIRST_ACK (root turn immediate — no gap on root agent this run)
- 17:49:56.746 V1: pass=true (~1 s turn)
- ~17:52 live probe (t12v-live-probe.mjs 3181): state 200; worker child `inst-15jpyal0oe8w` /
  `session-team-child-d3684b24d63bbc72ef7b7f78d3ae9fbf` lifecycle=CREATED;
  `pendingDeliveries.recovered[0] = {requestToken:"t12v-v2-send-mtke5bxi426eb0", factSequence:2,
  deliveredToInstanceId:"inst-15jpyal0oe8w", deliveredSequence:3}`; `activity: []`;
  mock still shows NO CHILD_FIRST model request ⇒ gap in progress (same signature as run #5:
  admission done, child phase non-idle, turn not started).
- 17:50:45.404 mock reply 4 = CHILD_FIRST_ACK → **turn 1 took ~47 s** (short window this run);
  V2 (world A) pass=true.
- 17:53:47.232 mock reply 5 = tool-call mcp__t12vmini__ping (USE_MCP turn 2 took **~181 s**);
  17:53:47.333 reply 6 = MCP_DENIED_ACK; V3 pass=false — ack landed 1.3 s PAST the 180 s
  deadline (V3 budget fix applied post-hoc: 180 s→480 s + per-turn opener measurement).
- 17:53:47.844 mock reply 7 = TASK_ACK → **turn 3 (V4) took ~0.25 s** (immediate); V4 pass=true.
- 17:53:48 → 18:01:52: **NO mock requests at all** for 8 minutes; LIFECYCLE pass=false at
  18:01:52 (descendant discovery 480 s deadline ≈ 18:01:48). The SUBSPAWN turn (turn 4 on
  the same converged-looking agent) never reached the model ⇒ the non-idle window RECURRED
  on a later turn (longer than 480 s). Shipped-runtime behavior, not a runner bug — but the
  window's duration/convergence pattern is not fully modeled; post-run forensic check:
  did the SUBSPAWN turn settle later in the durable log (t12v-session-timeline.mjs)?
- 18:01:52 V5 pass=true (frozen-contract assertion fix confirmed).
- 18:01:56 B1 booted (world B), row ready 18:01:57 (toolCount=10); state route 500
  `Cannot read properties of null (reading 'name')` recorded as evidence + invariant 9 (as designed).

The 360 s gap (if it occurs at all this run) is most likely on V2-A's CHILD_FIRST
(first relayed turn on the freshly materialized world-A worker child) — V2-A's 480 s
wait is designed to absorb it before V3/V4/LIFECYCLE touch the same agent.
