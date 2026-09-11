# H1 probe log — P0 end-cap probes on the REAL upstream composition

Spec: `packages/runtime/test/h1a-pre-execute-endcap.test.ts` (40 tests, 13 probe groups).
Mount: real cordis `Context` + real `ToolRuntime` + dsh-scope agent scope + the real A4 durable control service (the only doubles: counting tool bodies, and the S15-ext recording ctx double).
RED capture: `h1-red-console.log` (unfixed tree, timestamped PRE-fix) — **17 failed | 23 passed (40)**.
GREEN capture: `h1-green-console.log` §[1/3] — **40 passed (40)**.

Legend: **DISCRIMINATING** = fails RED, passes GREEN (pins the bypass / the fix). **NON-DISCRIMINATING** = passes on both trees (pins behavior that must not change).

| # | Probe group | Tests | RED | GREEN | Discriminating assertions (RED failure ⇒ bypass reproduced) |
|---|---|---|---|---|---|
| 1 | P0-A (A1) hostile prepend-allow, default-deny policy | 3 | 2 fail / 1 pass | 3/3 | body NEVER runs (RED: body executed — **bypass**); DENIED with the stable end-cap reason (RED: allowed) |
| 2 | P0-B (A2/A15) the ask lane is not hijackable | 3 | 2 fail / 1 pass | 3/3 | body NEVER runs (RED: executed); DENIED, no marker (RED: allowed) |
| 3 | P0-C (A3) statically-authorized call unaffected | 3 | 3 pass | 3/3 | — (no over-deny: executes once, zero control rows, no diagnostics) |
| 4 | P0-E unsupported tools abstain | 2 | 2 pass | 2/2 | — (guard abstains on names outside the six; executes even under hostile prepend-allow) |
| 5 | P0-F hostile DENY honored verbatim | 3 | 3 pass | 3/3 | — (hostile deny registered `{prepend:true}` = outermost; final = hostile reason, end-cap NOT the decider, zero end-cap rows) |
| 6 | P0-H prepend-allow AND append-deny (monotonicity pin) | 3 | 2 fail / 1 pass | 3/3 | body NEVER runs (RED: executed); DENIED by the end-cap (RED: allowed); append-deny 0 calls (ordering pin, both trees) |
| 7 | P0-I nested dispatch = different exec object | 3 | 1 fail / 2 pass | 3/3 | NESTED managed read DENIED + error in parent result (RED: nested executed — **bypass inside dispatch**) |
| 8 | A9 install-scoped marker + agent-scoped guard | 4 | 2 fail / 2 pass | 4/4 | agent A DENIED (RED: executed); per-agent body counts A 0 / B 1 (RED: A 1) |
| 9 | P0-D pre-seeded identical-scope row | 3 | 2 fail / 1 pass | 3/3 | hijacked call STILL DENIED (RED: executed); body NEVER runs (RED: ran); seeded row NOT consumed (both trees) |
| 10 | P0-G (A5) full ask→allow chain, no hostile | 3 | 3 pass | 3/3 | — (durable leader allow → executes once; request+decision+consumption exactly-once; no diagnostics) |
| 11 | P0-J / A16 end-cap denial zero-effect on durable plane | 2 | 1 fail / 1 pass | 2/2 | exactly ONE diagnostics observation row with the end-cap reason (RED: zero rows — no denial happened); zero control rows (both trees) |
| 12 | S15-ext composite disposer (recording double) | 6 | 3 fail / 3 pass | 6/6 | install registers listener AND guard (RED: guard 0); dispose removes BOTH, listener FIRST guard LAST (RED: no guard); second install independent (RED: no guard) |
| 13 | fail-closed install: ctx WITHOUT `tools.guard` | 2 | 2 fail | 2/2 | throws typed `alpha2-permission-guard-unavailable` (RED: installed silently); ZERO partial state (RED: listener registered) |

Totals: RED 17 failed / 23 passed → GREEN 0 failed / 40 passed.

## Console excerpts

RED (from `h1-red-console.log`, unfixed tree — the bypass visible in the console):

```
× is DENIED by the end-cap (the stable reason text in the result) 5ms
× the tool body NEVER runs (the bypass is closed) 1ms
× is DENIED by the end-cap (no marker — the listener never ran) 0ms
× the tool body NEVER runs 0ms
× the body NEVER runs (the secure property) 0ms
× is DENIED by the end-cap (the prepend-allow short-circuits the chain to allow; no marker) 0ms
× the NESTED managed read is DENIED by the end-cap (unmarked) and the parent result carries the nested error 0ms
× agent A (hostile prepend-allow) is DENIED 0ms
× per-agent body counts: A 0, B 1 0ms
× the hijacked call is STILL DENIED by the end-cap 0ms
× the tool body NEVER runs 0ms
× exactly ONE diagnostics observation row with the end-cap reason (review §18) 0ms
× the install registers the waterfall listener AND the end-cap guard (one each) 0ms
× disposing removes BOTH (listener 0, guard 0 active) — listener disposed FIRST, guard LAST 0ms
× a second install on the SAME double works independently (one listener + one fresh guard, next once) 0ms
× throws the typed alpha2-permission-guard-unavailable error at install 0ms
× ZERO partial state (no listener registered, no guard registered) 0ms
...
Test Files  1 failed (1)
      Tests  17 failed | 23 passed (40)
```

GREEN (from `h1-green-console.log` §[1/3], fixed tree):

```
✓ test/h1a-pre-execute-endcap.test.ts (40 tests)
Test Files  1 passed (1)
      Tests  40 passed (40)
```
