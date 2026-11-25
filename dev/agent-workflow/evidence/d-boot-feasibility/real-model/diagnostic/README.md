# diagnostic/ — the recorder passes behind the 2026-11-26 real-model attempt

**Nothing in this directory is a judge, a gate, or acceptance evidence.** The 20 judges in the driver were
never reached (see `../REAL-MODEL-ACCEPTANCE.md` §0.3). These files exist because the drivers' real branch
aborts at its mock-only surface read, and the question "is the PRODUCT route sound on a real model?" had to
be answered without changing the driver.

| path | what it is | verdict it supports |
| --- | --- | --- |
| `real-request-capture.json` | request **bodies** and SSE replies seen by a pass-through recorder at the provider boundary (headers are never recorded, so no `x-api-key`) | two real `POST /anthropic/v1/messages`, both **200**; model `deepseek-v4-flash`; **43 tools** on the second request, including all six required `team_*` tools |
| `console-capture.log` | the driver run that produced the capture (1 boot, legacy, host pointed at the recorder) | probe `REAL-ROUTE-AVAILABLE`; `turn settled=true`; then the driver's own `PROBE FAILED: the Leader surface lost 'team_delegate'` |
| `proxy.log` | recorder log | forwarding target and per-request status |
| `attempt1-proxy-missing-console.log` | the first recorder attempt | the host pointed at a dead port because the recorder file was written under shell `/tmp`, which the sandboxed shell could not see at run time — **no provider contact** |
| `diagnostic3-root-artifacts/` | the root artifacts the third recorder run left behind (`probe.json`, `results.json`, `agreement.*`, `run.log`, `run-ledger.jsonl`, `runs/boot01`) | the **same** `REAL-ROUTE-AVAILABLE` probe and the same 20× `FAIL` / `not-run` result, preserved here because the root `probe.json`/`runs/` remain the **round-111 scripted** record (`../probe.json` is still `ENV-LIMITED`) |
| `d4-rec-proxy.mjs` | the recorder itself (diagnostic-only; not wired into any driver or CI leg) | reproducibility of the capture |

The **second** recorder attempt (the 404) left one boot of driver-archived working state at
`../archive/2026-11-25T16-21Z-diagnostic-attempt2-proxy404/`. Its capture showed a 404 because the recorder
forwarded `/v1/messages` instead of `/anthropic/v1/messages` — a **recorder** bug, not a model error. It is
kept as history, not as evidence of the route. The **first** attempt (dead port) left no run record: the
host pointed at a port nothing listened on, and its console log is `attempt1-proxy-missing-console.log`.

Endpoint probe (values never recorded, names only): `GET /models` advertises `deepseek-flash` and
`deepseek-v4-pro`; `POST /anthropic/v1/messages` returns 200 for `deepseek-flash`, `deepseek-v4-flash` and
`deepseek-v4-pro`, and 400 for `deepseek-v4.1-flash-1017` ("supported API model names are deepseek-flash,
deepseek-v4-pro"). The session that the host records names its own route:
`provider deepseek-official, model deepseek-v4-flash`.
