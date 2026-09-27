# ws-diag — raw RFC6455 protocol diagnostic (run 8 follow-up)

Purpose: disprove/prove that the spike's run-8 `ws closed by host` (no close
frame) during `session/follow` is a client protocol fault (mask bit / PONG).

## Method
`ws-diag.mjs` boots a resume host on the run-8 world and connects a fully
instrumented raw WebSocket client (every frame logged: t, dir, opcode, fin,
len, payload head). Opens `$events`, then `session/follow`, holds 100s.

## Findings (frames.json, 106 frames)
1. **Mask bit + PONG are CORRECT.** Host heartbeat PING ≈ every 2000 ms;
   the client PONGed every one; the connection stayed OPEN for the full
   100 s with zero host-initiated closes. → the client protocol layer is
   sound; run 5/6's 1002 closes (unmasked frames) are fixed and no longer
   the cause of any close.
2. **The ONLY error frame** was on the `session/follow` stream:
   `{"code":"session/not-found","message":"session \"session-rst017-dyn-...\""}`
   — because this standalone boot did **not** re-adopt the dynamic team root
   (the team plugin's `bootPhase: resume` re-adoption did not run here), so
   the dyn session was not live in this host's lifetime.
3. An error frame on a stream does **not** close the mux socket (the
   connection kept PING/PONG after the `not-found`).

## Conclusion
The run-8 `ws closed by host` (TCP close, no WS close frame) during
`session/follow` is therefore **host-side behavior tied to actually
streaming a live session/follow** — not a client mask/PONG fault. To capture
the host's exact frames around that close, run 9 enables `RST017_WS_TRACE=1`
in the spike's own socket (the real repro, where the dyn root IS live),
dumping every rx/tx frame (incl. control frames) to `<leg>/ws-traces.json`.

## Side observation (separate, non-blocking)
A standalone `dsh web` boot with `DEEPSEEK_BASE_URL` pointed at a DEAD port
hung pre-URL-line (no skill/mount log lines) — a model-provider init path
that retries against the unreachable base URL. The spike always runs a LIVE
mock, so this does not affect the spike; noted for completeness.
