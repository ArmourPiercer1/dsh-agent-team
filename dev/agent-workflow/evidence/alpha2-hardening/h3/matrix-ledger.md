# H3 — alpha.2 hardening §14 adversarial matrix ledger

**Scope**: the complete adversarial matrix of the hardening plan
(`docs/plans/active/dsh-agent-team-alpha2-permission-boundary-hardening.md`
§14, "完整 adversarial matrix") — one row per case A1–A16 with the
unit-level and LIVE evidence that pins it. **The §21 criterion is
covered in full by the rows marked §21-CORE (A2, A3, A10, A12 — the
force-allow legs) plus their lifecycle companions (A4/A13/A16 — the
no-over-deny legs).**

**Evidence locations**
- H1 unit suite: `packages/runtime/test/h1a-pre-execute-endcap.test.ts` (40 tests, 13 groups — the real upstream composition: cordis Context + ToolRuntime + dsh-scope agent scope + the real A4 durable control service).
- H2 unit suites: `packages/runtime/test/a2-canonical-operation.test.ts` (31), `a3-permission-resolver.test.ts` (28), `a5a-pre-execute.test.ts` (50 — incl. DR-A..DR-D), `a6a-production-wiring.test.ts` (52 after the H3 §16 legs), `a4a-control-exact-scope.test.ts` (28).
- V1 live kit (unchanged, run as-is inside the H3 battery): `dev/agent-workflow/evidence/alpha2-permission/v1/` — live 115-check matrix + 26-check cold battery + 12-check legacy probe (official v17 = 115/115 + 26/26 + 12/12).
- H3 live kit: `dev/agent-workflow/evidence/alpha2-hardening/h3/kit/` — the V1 battery + the `h3-hostile-*` groups (fresh world, phase 5) and `h3-hostile-cold` (cold world). Live evidence JSONs: `h3-live-perm-<stamp>.json`, `h3-cold-resume-<stamp>.json`, `h3-legacy-probe-<stamp>.json` (same directory).
- Live hostile device: `POST /__hardening/hostile-prepend {agent}` in `packages/tools/harness/plugin.mjs` — the DSH_HARDENING_PROBE-gated TEST-ONLY seam installing `ctx.on('tools/pre-execute', () => Promise.resolve({ kind: 'allow' }), { prepend: true })` on the CURRENT live agent ctx.

**World** (fresh + cold, same blueprint): team `team.a2perm`, root `a2root` (leader), `session-a2a-a` (inst-a2pa, worker-a), `session-a2b-b` (inst-a2pb, worker-b). Leader/worker-a policy: read perm-a ALLOW, read perm-b DENY, write perm-c ASK, default ASK. worker-b: default DENY, empty lanes.

**The stable end-cap reason (byte-pinned, h1a `END_CAP_REASON`)**:
`permission denied: no Team permission authorization for this execution (pre-dispatch policy not reached — monotonic end-cap)`
with observation stage `end-cap-denial` (plan §18; the plan's example row uses the illustrative names `permission-end-cap` / `permission-pipeline-not-observed` — the implemented stable values are these two; both are search-able, carry no sensitive content, and participate in no authority).

## The matrix

| Case | Permission | Competing listener | Expected | Unit evidence | Live evidence (H3 battery) | Status |
|---|---|---|---|---|---|---|
| A1 | static deny | none | deny | h1a **P0-A (A1)** group (denied by end-cap text only when unmarked; the static-deny lane itself is the pre-dispatch listener's job — h1a runs it under default-deny policy: denial, body never runs, ZERO control rows) | V1 legs `live-L2` (leader read perm-b, static policy reason) + `live-M2` (member-a) + `live-B1-*` (worker-b default deny); H3 leg `live-H3-2c-static-deny-lane` re-pins the SAME operation under the hostile prepend (the reason flips to the end-cap text — see A2) | PASS |
| A2 | static deny | prepend allow | **deny by end-cap** §21-CORE | h1a **P0-B (A2/A15)** (ask lane not hijackable: denied, body never runs, ZERO requests) + **P0-H** (prepend-allow AND append-deny monotonicity pin) | **`live-H3-2c-static-deny-lane`**: leader read perm-b (the static-DENY lane whose policy-reason the no-hostile `live-L2` leg pins in the same world) under the hostile prepend → `ok:false` with the EXACT stable end-cap reason (byte-equality asserted), not the policy-deny reason; `live-H3-1`/`live-H3-1-exact-reason` prove the same on the policy-ALLOWED lane (the sharpest form: even an allow-lane op cannot run) | PASS |
| A3 | default ask | prepend allow | **deny by end-cap; no body** §21-CORE | h1a **P0-B (A2/A15)** (the ask lane: no marker, end-cap denies, ZERO control requests — A16 for the ask lane) | **`live-H3-2-ask-op-denied`** (leader read perm-d, the default-ask lane: exact end-cap reason) + **`live-H3-2b-zero-requests`** (ZERO new control rows — the ask was never opened) + **`live-H3-3-write-denied`** + **`live-H3-3-file-unchanged`** (the ASK-LANE write with marker content is denied AND perm-c.txt is byte-unchanged — "no body") | PASS |
| A4 | static allow | none | execute once | h1a **P0-C (A3)** (a statically-authorized call is unaffected: EXECUTES, body ran exactly once, ZERO control rows, no end-cap row — the guard abstains) | V1 `live-L1`/`live-L4` (leader read perm-a executes once, consumed once) + `live-M1` (member-a readA) + cold `cold-cA` (read perm-a on the cold-resumed leader) | PASS |
| A5 | static allow | outer deny | deny | h1a **P0-G (A5)** — wait, P0-G is the no-hostile ask→allow chain; the OUTER-DENY leg is **P0-F** (a hostile DENY is honored verbatim: final decision ≠ allow → denied with the HOSTILE reason, the end-cap emits NO denial — it is not the decider) | RULING: the hostile-SEAM only force-ALLows (the §21 threat); an outer-DENY competing listener is not injectable through the test-only seam (a deny listener is strictly less dangerous — it can only deny). Unit coverage stands (h1a P0-F + P0-H's ordering pin); no live leg. | PASS (ruling recorded) |
| A6 | ask → allow | none | execute once | h1a **P0-G** (the full ask→allow chain: EXECUTES exactly once after the durable leader allow; request+decision+consumption exactly-once; no end-cap row) | V1 `live-L3a-human-allow` + `live-L5-human-allow` + `live-L7-turn-settled` (leader readC/writeC1 ask → remote human allow → executes; file = leader-payload-1) + `live-M3a..` (member-a leader-approval routing) + cold `cold-policy-rebuilt-ask-read` + `cold-policy-rebuilt-executes` (the rebuilt cold policy asks again and the allow executes) | PASS |
| A7 | ask → deny | none | deny | h1a P0-G's negative companion (the denial path leaves NO marker — P0-A/P0-B pin markerless denial) | V1 `live-N6-fp2-denied` (a2-fp2 resolved DENY → the operation is denied, `approval was denied` reason) + `live-N6-file-unchanged` (perm-d.txt unchanged) | PASS |
| A8 | ask → allow | second execution | fresh authorization required | h1a **P0-F** (approved request cannot authorize a second call — re-execution denied allow-consumed; marker bound to the exec object) | V1 `live-N5-*` (re-executing N5's operation after consumption is blocked `allow-consumed`) + cold `cold-double-consumption-still-blocked` (the property SURVIVES the restart) | PASS |
| A9 | unsupported tool | prepend allow | unchanged / pass-through | h1a **P0-E** (unsupported tools abstain: EXECUTES under the hostile prepend-allow — the guard abstains on unsupported names; body ran once, ZERO control rows) + **A9 group** (two agents: the unsupported-tool leg per agent) | **`live-H3-2d-unsupported-passthrough`**: `team_list_members` (unsupported class) under the leader's hostile prepend → `ok:true` (pass-through UNCHANGED, zero control rows — the closed set is the six managed tools) | PASS |
| A10 | nested PTC static deny | prepend allow | deny §21-CORE | h1a **P0-I** (nested dispatch — the nested exec is a DIFFERENT object: the NESTED managed read is DENIED by the end-cap (unmarked), the parent result carries the nested error, ZERO control rows) | **`live-H3-6-ptc1-denied`** + **`live-H3-6-ptc2-denied`**: worker-a hostile prepend + H3-PTC-TRIGGER member turn — ONE model response carrying TWO managed read calls (perm-a allow lane + perm-b static-DENY lane); BOTH end-cap-denied, ptc2 with the EXACT stable end-cap reason (not the policy-deny reason — the V1 no-hostile `live-M2` leg pins that reason on the same op earlier in the world); `live-H3-6-zero-requests` (ZERO control requests, requester-scoped raw ledger — PF-1-safe) + `live-H3-6-turn-settled` (the turn settles on its own) | PASS |
| A11 | nested PTC ask → allow | none | execute once | h1a **P0-I** (the marked nested exec path: the parent's authorization does not leak to the nested unmarked exec — the inverse proves the per-exec-object marking; the normal ask→allow per-exec path is P0-G) | RULING: the no-hostile PTC ask→allow live leg would need a scripted member turn whose parallel ask is approved mid-turn (the V1 member drill is single-call by design — one ask lane per turn); the per-exec-object authorization (each PTC call is its own exec object with its own marker) is unit-pinned by P0-I + P0-G, and the LIVE PTC proof under the hostile (A10) covers the security property the criterion asks for. | PASS (ruling recorded) |
| A12 | cold-resume deny | prepend allow | deny §21-CORE | a6a **H3 §16 cold-resume legs** (the re-install re-derives the end-cap guards on the FRESH ctxs: leader=1, member A=1, member B=0) + h1a P0-J (cold-resume: the hostile bypass is closed after a restart) | **`cold-H3-0-gate-live`** (hostile prepend on the COLD-RESUMED leader ctx) + **`cold-H3-1-allow-op-denied`** (policy-ALLOWED read perm-a — the V1 `cold-cA` leg just executed it on the same ctx — now end-cap-denied with the exact reason) + **`cold-H3-2b-static-deny-lane`** (read perm-b, the rebuilt static-DENY lane: EXACT end-cap reason, not the rebuilt policy's deny reason) + `cold-H3-2-ask-op-denied` (default-ask lane denied, zero requests) | PASS |
| A13 | cold-resume allow | none | execute once | a6a W3 (the listeners + guards RE-INSTALLED on fresh ctxs at cold resume) | cold `cold-cA` (read perm-a executes on the cold leader) + `cold-policy-rebuilt-ask-read-executes` + `cold-policy-rebuilt-executes` (perm-c.txt = a2-cold-c) | PASS |
| A14 | cold-resume ask | none | normal approval | a6a W3 (the rebuilt policy asks) | cold `cold-policy-rebuilt-ask-read` (kind=user-approval, EXACT scope + fingerprint-bound per `cold-policy-rebuilt-scope-exact`/`-fingerprint-bound`) + `cold-policy-rebuilt-ask` (the NEW write re-asks — consumed allows do not carry over) | PASS |
| A15 | guard disposer after agent close | n/a | no leaked guard | h1a **S15-ext** (the composite disposer removes listener AND guard — listener FIRST, guard LAST; after dispose no listener answers; a second independent install works) + **fail-closed install** (a ctx without the tools.guard seam → typed error, ZERO partial state); a6a W1 close drain (`w1*GuardsAfterClose = 0`) | LIVE: the N4 residency drop disposes the leader agent mid-run and the N0..N6 legs re-resolve it — the re-resolved install re-registers its guard (the H3-0 hostile prepend lands on the re-resolved ctx and is then DENIED by that ctx's guard — a leaked/unre-registered guard would have let the hostile force-allow execute) | PASS |
| A16 | sibling agent | one agent authorized | no cross-agent reuse | h1a **A9 group** (agent A hostile → DENIED; agent B, own scope ctx + own install + no hostile → UNAFFECTED, executes; per-agent body counts A=0 B=1; ZERO control rows) + **P0-J / A16** (an end-cap denial is zero-effect on the durable plane: exactly ONE diagnostics row, ZERO control rows of any kind) | **`live-H3-5-cross-agent-unaffected`**: worker-a (NO hostile prepend) read perm-a STILL EXECUTES while the leader AND worker-b are under hostile force-allow (agent-scoped install/guard — no cross-agent leak) + **`live-H3-8-control-unchanged`** (requests/decisions/consumptions UNCHANGED across the whole hostile phase — the durable plane is zero-effect) + **`cold-H3-3-control-unchanged`** (same invariant on the cold world) | PASS |

## Coverage notes (deviations from a naive 1:1 live mapping)

1. **A5 / A11 carry RULINGS** (recorded above): both are the no-escalation
   companions of legs the hostile seam cannot inject (outer DENY) or the
   V1 drill shape does not script (no-hostile PTC ask mid-turn). Both are
   unit-pinned on the REAL upstream composition (h1a P0-F/P0-I/P0-G over
   cordis Context + ToolRuntime + dsh-scope), which is the same plane the
   live proof exercises — the live kit adds the hostile legs the matrix's
   security core (A2/A3/A10/A12) demands.
2. **The reason-text discriminator is asserted by BYTE EQUALITY** on every
   hostile leg (not a pattern): the RAW `<END_CAP_REASON>` on the `/tool`
   route (the JSON `error.message` surface carries no wrapper — the
   `Error: ` prefix exists only in the MODEL-facing SSE tool-result
   content, which the PTC legs assert via inclusion), the exact reason in
   the model-facing PTC result content, and the exact reason in every
   `end-cap-denial` observation row (live
   `live-H3-7-observation-rows` requires ≥7 rows, all exact; cold
   `cold-H3-3-observation-rows` requires ≥2, all exact). The no-hostile
   V1 legs pin the POLICY reasons on the same operations in the same
   world, so the flip is visible in one battery.
3. **The PTC leg runs in whichever execution mode the upstream loop
   chooses** (true parallel or serialized continuation — the mock script
   supports both shapes: one response with two calls, or ptc1's result
   re-emitting ptc2). The security assertions (both calls end-cap-denied
   with the exact reason, ZERO control rows, turn settles) hold in both
   modes — parallelism is an execution-shape fact, not a security
   property; the per-exec-object marking (h1a P0-I) is the unit pin for
   the shape.
4. **PF-1 (chain-hold)**: all member-phase counts use the requester-scoped
   RAW ledger (`team.getLedgerPage`), never `/state` (which blocks during
   an active member turn); the hostile legs take `/state` snapshots only
   after the PTC turn settles.

## §18 observation rows (pinned from the live readout)

The `/state.observations` readout carries the guard's `onObserve` rows as
`alpha2-perm: {json}`. Every hostile denial observed in the battery
produces exactly ONE row with `stage: 'end-cap-denial'` and the byte-exact
stable reason (the kit asserts byte-equality on every row).

**Fresh world** (`h3-live-perm-2026-09-11T08-35-35.json` →
`h3Hostile.observations`, 7 rows — H3-1, H3-2, H3-3, H3-2c, H3-4, and both
PTC siblings):

```
alpha2-perm: {"stage":"end-cap-denial","tool":"read","reason":"permission denied: no Team permission authorization for this execution (pre-dispatch policy not reached — monotonic end-cap)"}
alpha2-perm: {"stage":"end-cap-denial","tool":"read","reason":"permission denied: no Team permission authorization for this execution (pre-dispatch policy not reached — monotonic end-cap)"}
alpha2-perm: {"stage":"end-cap-denial","tool":"write","reason":"permission denied: no Team permission authorization for this execution (pre-dispatch policy not reached — monotonic end-cap)"}
alpha2-perm: {"stage":"end-cap-denial","tool":"read","reason":"permission denied: no Team permission authorization for this execution (pre-dispatch policy not reached — monotonic end-cap)"}
alpha2-perm: {"stage":"end-cap-denial","tool":"read","reason":"permission denied: no Team permission authorization for this execution (pre-dispatch policy not reached — monotonic end-cap)"}
alpha2-perm: {"stage":"end-cap-denial","tool":"read","reason":"permission denied: no Team permission authorization for this execution (pre-dispatch policy not reached — monotonic end-cap)"}
alpha2-perm: {"stage":"end-cap-denial","tool":"read","reason":"permission denied: no Team permission authorization for this execution (pre-dispatch policy not reached — monotonic end-cap)"}
```

**Cold world** (`h3-cold-resume-2026-09-11T08-35-35.json` →
`h3HostileCold.observations`, 3 rows — cold-H3-1, cold-H3-2, cold-H3-2b,
all on the COLD-RESUMED leader ctx after the re-install):

```
alpha2-perm: {"stage":"end-cap-denial","tool":"read","reason":"permission denied: no Team permission authorization for this execution (pre-dispatch policy not reached — monotonic end-cap)"}
alpha2-perm: {"stage":"end-cap-denial","tool":"read","reason":"permission denied: no Team permission authorization for this execution (pre-dispatch policy not reached — monotonic end-cap)"}
alpha2-perm: {"stage":"end-cap-denial","tool":"read","reason":"permission denied: no Team permission authorization for this execution (pre-dispatch policy not reached — monotonic end-cap)"}
```

The plan's §18 example row used the illustrative names
`permission-end-cap` / `permission-pipeline-not-observed`; the implemented
stable values are `end-cap-denial` (stage) + the reason above — both are
search-able, carry no sensitive content, and participate in no authority.
