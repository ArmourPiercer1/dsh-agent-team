# alpha.2 permission-boundary-hardening closure report (H3)

**Task**: H3 — closure verification of the alpha.2 permission-boundary
hardening (plan `docs/plans/active/dsh-agent-team-alpha2-permission-boundary-hardening.md`),
per `h3-brief.md` (deleted before the final commit). H3 **verifies** the
already-integrated H1 (P0) + H2 (P1) work on top of the int tip, adds the
§16 four-bind-path wiring legs, the DEC-1 pin 667→668, and — the core of
this task — the **LIVE §21 adversarial proof** over real agent ctxs through
the env-gated test-only hostile seam.

## 1. Baseline

- base commit: `635ba9d` (int tip: H1 P0 monotonic end-cap + H2 P1 bash contract / fingerprint / deny-canonicalization)
- final commit: the tip of `task/alpha2-h3-closure` at closure (the evidence commit (c) containing this directory; no push)
- H3 commits:
  - `667bea6` (a) — the live adversarial-proof seam: TEST-ONLY `POST /__hardening/hostile-prepend {agent}` in `packages/tools/harness/plugin.mjs` (DSH_HARDENING_PROBE-gated, removal candidate before RC) + `packages/tools/test/h3-hostile-seam.test.ts` (10/10 hermetic) + the H3 live kit (`a2permh3-{setup,boot,check,legacy}.mjs`).
  - `0625488` (b) — §16 four-bind-path wiring legs (a6a 50→52) + p4t6 DEC-1 pin 667→668.
  - `d6b7fe3` (kit fixes, deviation D1) — boot dump-config P6T6_URL → H3 worktree; `/tool` raw-reason surface + PTC per-sibling mock-log observability (diagnosed from the first live run, whose raw evidence is kept in this directory).
- upstream DSH pin: `references/deepseek-harness-test-use` @ `a66e470204` — porcelain-clean, CORE PATCH BUDGET 0 (never touched).
- world homes (ephemeral, never committed):
  - fresh: `references/.dsh-test-a2permh3-2026-09-11T08-35-35`
  - legacy: `references/.dsh-test-a2permh3legacy-2026-09-11T08-35-35`
  - (a first live world `...-08-10-09` was discarded dirty after the kit dump-config bug — its boot/setup evidence is kept here as D1 provenance)

## 2. Findings closed

### P0 pre-execute bypass (H1 — verified by H3, not re-implemented)

- old behavior: any competing `tools/pre-execute` listener could force-allow (`{kind:'allow'}` without calling `next()`) and an alpha.2 managed tool would EXECUTE without Team permission authorization — the pre-dispatch policy was bypassable by a single extra listener.
- RED proof: h1a unit suite (40 tests) RED legs over the REAL upstream composition (cordis Context + ToolRuntime + dsh-scope agent scope + real A4 durable control service) — e.g. `P0-B (A2/A15)`: hostile prepend-allow on the ask lane, no fix ⇒ body runs.
- root cause: the pre-dispatch policy was consulted per-listener along the chain; a force-allow listener short-circuited the chain before any Team authorization could be checked, and nothing marked "this execution is authorized" monotonically at the two final-allow points.
- fix (H1, in base): the **monotonic end-cap** — a public `tools.guard` seam + an install-scoped `WeakSet<object>` over the exec object, marked ONLY at the two final-allow points; after the chain, any managed tool whose exec object is unmarked is denied pre-dispatch with the stable reason, regardless of what the chain returned.
- GREEN proof (H3): h1a 40/40 green on this branch; **the §21 live proof (below)** — hostile `() => Promise.resolve({kind:'allow'})` prepended to the live leader/worker ctxs: policy-ALLOWED ops (the end-cap is the only decider), default-ask ops, static-deny ops, ASK-lane writes, parallel-tool-call siblings, cold-resumed ctxs — ALL denied with the byte-exact stable reason, zero control-plane effect, no body executed.

### P1 Bash contract / fingerprint / deny-rule canonicalization (H2 — verified by H3)

- selected rulings (H2, recorded in `dev/agent-workflow/evidence/alpha2-hardening/h2/summary.md`): P1-1 the bash contract — the A1 schema is the enforcement point; P1-2 the bash fingerprint binds the command (no shell parsing, `sha256(raw command)`); P1-3 an exact deny rule whose canonicalization fails ⇒ operation DENY (option A, fail-closed — the lane asymmetry: only the deny lane flips, because a failed deny downgrade could let an approval authorize what the policy forbade).
- H3 verification: H2 unit suites green on this branch (a2-canonical-operation 31, a3-permission-resolver 28, a5a-pre-execute 50 incl. DR-A..DR-D, a4a-control-exact-scope 28, a6a 52); live regression: the V1 115-check matrix (the bash/deny-lane legs run inside it) + the hostile legs show the end-cap denies even where the H2 static rules would decide (the hostile legs re-pin the SAME operations with the end-cap reason — the discriminator flip is in one battery).

## 3. Adversarial matrix (plan §14, A1–A16)

Full ledger with per-row unit + live evidence: `matrix-ledger.md`. Condensed:

| Probe | Result | Evidence |
|---|---|---|
| A1 static deny / none | deny (policy) | V1 `live-L2`/`live-M2`/`live-B1` + h1a P0-A |
| A2 static deny / prepend allow | **deny by end-cap** §21-CORE | live `live-H3-2c` (exact end-cap reason, not policy reason) + h1a P0-B/P0-H |
| A3 default ask / prepend allow | **deny by end-cap; no body** §21-CORE | live `live-H3-2` + `live-H3-2b` (zero requests) + `live-H3-3` + `live-H3-3-file-unchanged` + h1a P0-B |
| A4 static allow / none | execute once | V1 `live-L1`/`live-M1` + cold `cold-cA` + h1a P0-C |
| A5 static allow / outer deny | deny | RULING (seam force-ALLows only; deny listener strictly less dangerous) + h1a P0-F/P0-H |
| A6 ask→allow / none | execute once | V1 `live-L3a-human-allow`/`live-L5` + cold `cold-policy-rebuilt-*` + h1a P0-G |
| A7 ask→deny / none | deny | V1 `live-N6-fp2-denied` + h1a markerless-denial pins |
| A8 ask→allow / second execution | fresh authorization | V1 `live-N5-*` + cold `cold-double-consumption-still-blocked` + h1a P0-F |
| A9 unsupported / prepend allow | pass-through unchanged | live `live-H3-2d` (team_list_members ok:true) + h1a P0-E + A9 group |
| A10 nested PTC static deny / prepend allow | **deny** §21-CORE | live `live-H3-6-*` (ONE model response, TWO managed reads, BOTH end-cap-denied, ptc2 exact end-cap reason, zero requests, turn settles) + h1a P0-I |
| A11 nested PTC ask→allow / none | execute once | RULING (unit-pinned P0-I + P0-G; the live hostile A10 covers the security core) |
| A12 cold-resume deny / prepend allow | **deny** §21-CORE | cold `cold-H3-0`..`cold-H3-2b` (exact end-cap reasons on the COLD-RESUMED ctxs) + a6a §16 cold legs + h1a P0-J |
| A13 cold-resume allow / none | execute once | cold `cold-cA` + `cold-policy-rebuilt-executes` + a6a W3 |
| A14 cold-resume ask / none | normal approval | cold `cold-policy-rebuilt-ask*` (scope-exact + fingerprint-bound) + a6a W3 |
| A15 guard disposer after close | no leaked guard | h1a S15-ext + fail-closed install + a6a W1 + LIVE N4 residency drop (H3-0 lands on the RE-RESOLVED ctx and is denied by that ctx's guard) |
| A16 sibling agent / one authorized | no cross-agent reuse | live `live-H3-5` (worker-a executes while leader + worker-b are hostile) + `live-H3-8`/`cold-H3-3` (durable plane unchanged) + h1a A9 group + P0-J/A16 |

§21-CORE rows: A2, A3, A10, A12 (+ no-over-deny companions A4/A13/A16) — all live-proven on the fresh AND cold worlds.

## 4. Control-plane regression

| Property | Result |
|---|---|
| exact scope | PASS (V1 `live-L3a-scope-exact` raw-ledger + `cold-policy-rebuilt-scope-exact`) |
| fingerprint | PASS (`live-L3a-fingerprint-bound` + `cold-policy-rebuilt-fingerprint-bound`) |
| allow-once | PASS (`live-N5-*` + `cold-double-consumption-still-blocked`) |
| stale | PASS (V1 N-series stale legs in the 115 battery) |
| external hard | PASS (V1 N-series + p8s3b unit plane) |
| abort | PASS (`live-N4-abort-deny` residency drop → abort denial; H3-0 re-resolve proof) |
| hostile zero-effect | PASS (`live-H3-2b`/`live-H3-6-zero-requests`/`live-H3-8` + cold `cold-H3-2b`/`cold-H3-3` — requests/decisions/consumptions UNCHANGED across the whole hostile phase) |

## 5. Lifecycle

- fresh root: A2-READY world `a2root` live, hostile legs H3-0..H3-8 all pass on the fresh leader ctx (and the post-N4 RE-RESOLVED leader ctx — the prepend lands on `ensureLiveAgent`'s current ctx).
- fresh member: worker-a `session-a2a-a` (hostile prepend + PTC leg H3-6) and worker-b `session-a2b-b` (H3-4 exact end-cap reason) — both fresh.
- cold root: cold-resume battery (26 V1 checks) + hostile legs `cold-H3-0`..`cold-H3-3` on the COLD-RESUMED leader ctx (the re-installed guard denies the hostile force-allow — A12 live).
- cold member: cold battery member legs (V1 26-check set) — pass.
- dispose: N4 residency drop mid-run (leader agent disposed, re-resolved by the N-legs); row-stop backstop drains every parked hostile force-allow disposer before `teamRoot.live.close()` (unit-pinned h3-hostile-seam "row-stop drain"; live world teardown clean — ports free after `stop`).

## 6. Legacy / alpha.1

- legacy: the R1 legacy probe (12 checks) against the `...a2permh3legacy-2026-09-11T08-35-35` world (shipped bundle row `my-team-bp-1`, NO capabilities — alpha.1 default; the hostile route is NEVER called there — the probe predates it by design). Result: **R1 LEGACY PASS (12/12)** — shipped blueprint stands, leader-only live set, ALL TEN team tools registered (no capability selection), legacy write/read EXECUTE (no permission listener vetoes), ZERO control rows after the live write+read (the alpha.2 permission plane is absent for the legacy blueprint).
- alpha.1 selective without permissions: a6a §16 zero-install leg (52/52) — the alpha.1 world installs ZERO end-cap guards (leader=0, A=0, B=0): no partial install of the security surface.

## 7. Gates (actuals)

| Gate | Result |
|---|---|
| focused: h3-hostile-seam | 10/10 (349ms, hermetic) |
| focused: a6a-production-wiring | 52/52 (incl. the two H3 §16 legs) |
| focused: testkit (15 files) | 124/124 @ DEC-1 pin 668 |
| runtime parity (full) | 147 files: 139 passed / 8 failed; 1526 tests: 1517 passed / 9 failed — failing set = H1 baseline (d3-4 1 test; p6t3-mediation 5 tests; p6t3-restart 2 tests; + p8s3b/t12a-b2/t12a-glue module-load, 0 tests each). Two EXTRA failures appeared only in the run that overlapped the world-setup load — `rmr-remote-mount-race` (Windows ENOTEMPTY in the testkit fault-injection teardown, `destroyDir` rmSync race) and `p6t1-parallel` (2 of 5 parallel activations errored) — BOTH pass in isolation on this branch (2 files / 16 tests, see `h3-parity-flake-rerun.txt`): concurrent-load flakes, NOT H3 regressions (H3 touches no runtime/parallel/testkit code) |
| domain | 388 tests: 378 passed / 10 failed — the SAME 10 pre-existing failures as the H2 baseline (no new) |
| typecheck | 0 errors, all 9 packages (tsc -p --noEmit; the seam test's untyped `plugin.mjs` import got a documented `@ts-expect-error TS7016` — first .mjs import in the repo's tests, no declaration file, no new scannable file so the DEC-1 pin stays 668; p4t6 re-run 10/10 @ 668) |
| build | `pnpm -r run build` — all 9 packages Done |
| build:composition + check-artifacts-committed | OK: 1080 files, committed install-surface artifacts match the fresh build; agent-bindings.mjs placement byte-identical; NO dist content delta (plugin.mjs is not in dist — the hostile seam is not installed anywhere) |
| dist EOL | pure LF — 363 dist files scanned (runtime/client/domain), 0 CRLF. Platform note (G-RMR F-2, documented in .gitattributes): on this core.autocrlf=true machine a fresh `build:composition` re-pollutes the LF-pinned dist glue file with CRLF from the working-tree src (content identical); the committed LF canonical was restored post-build and the artifacts gate re-verified OK 1080 |
| references porcelain | 0 @ a66e470204 (deepseek-harness-test-use, pristine) |
| live smoke (fresh) | **LIVE PASS 135/135** (V1 115-check matrix + hostile group H3-0..H3-8 incl. ptc-shape) — `h3-live-perm-2026-09-11T08-35-35.json` |
| live smoke (cold) | **COLD PASS 32/32** (V1 26-check cold battery + hostile cold group cold-H3-0..cold-H3-3) — `h3-cold-resume-2026-09-11T08-35-35.json` |
| legacy probe | **R1 LEGACY PASS 12/12** — `h3-legacy-probe-2026-09-11T08-35-35.json` |

## 8. Scope compliance

- dynamic grants introduced: NO
- durable grants introduced: NO
- teamHardDeny introduced: NO
- permission admin UI introduced: NO
- remote protocol bump: NO
- upstream core patch: NO (references/ untouched; CORE PATCH BUDGET 0)
- production delta this task: ONE test-only, env-gated route in `packages/tools/harness/plugin.mjs` (inert without `DSH_HARDENING_PROBE=1`, 503 self-describing otherwise; removal candidate before the first RC) + the live kit (evidence directory).

## 9. Remaining known debt

- **READ_LIMIT fingerprint drift** — deferred per review §9 (V2): the read-limit projection is not part of the A2 fingerprint; approvals across a read-limit change are not re-bound. Not a bypass (no escalation path); recorded for V2.
- **PF-1 (chain-hold)** — the raw-ledger (`team.getLedgerPage`) requester-scoped reads are the workaround for `/state` blocking during an active member turn; the durable projection should expose the same facts (V2).
- **PF-2** — (as recorded in the V1/v12 notes; no H3 change) — V2.
- **vitest 4 threads-pool silent hang** (V2 backlog, from the seam-test first version): a module-level uncaught exception (a `Readable` fixture emitting STRING chunks into `Buffer.concat`) inside the worker is swallowed — the file import waits forever (0 CPU, process alive); no file-level import timeout exists. The H3 test is now fully hermetic (Buffer chunks + 5s wall-clock race in `post()`); the runner-side fix (surface worker uncaughtException / file-import timeout) belongs upstream.
- **the hostile seam itself** — removal candidate before the first RC (it exists to prove §21 live; the gate makes it inert in every non-probe deployment, and the row-stop drain removes any installed force-allow at row stop).
- **parity flakes under concurrent load** — rmr-remote-mount-race (Windows testkit teardown ENOTEMPTY) and p6t1-parallel (2/5 activation errors) failed only in the run that overlapped the world-setup load; both pass in isolation. No action; noted so the alpha.3 gate runner does not re-attribute them.

## 10. Verdict

- **§21 criterion (verbatim)**: "一个任意 competing tools/pre-execute listener 即使直接 force-allow 且不调用 next() 也无法让任一 alpha.2 managed tool 绕过 Team permission policy 执行" — **PROVEN LIVE** on the fresh world (H3-1 policy-allowed read denied by the end-cap with the exact stable reason; H3-2 default-ask; H3-2c static-deny lane; H3-3 ASK-lane write, file byte-unchanged; H3-4 worker-b default-deny; H3-6 parallel-tool-call siblings; H3-5 cross-agent non-leak; H3-8 durable plane unchanged) and on the cold-resumed world (cold-H3-0..cold-H3-3).
- **SECURITY CLOSURE**: PASS — the §21 criterion is proven LIVE on both the fresh and the cold-resumed worlds: no competing `tools/pre-execute` force-allow (with or without `next()`) lets any of the six alpha.2 managed tools execute without Team permission authorization — policy-allowed, default-ask, static-deny, ASK-lane-write, and parallel-tool-call legs all denied pre-dispatch with the byte-exact stable reason, zero control-plane effect, no body executed, while no-hostile lanes (allow/ask/deny, cold, legacy) behave exactly as the policy dictates.
- **Ready to branch alpha.3**: YES — all plan §20 sections closed, all gates at baseline or better, CORE PATCH BUDGET 0, scope compliance intact. Follow-ups for the alpha.3 gate: the §9 debt list (READ_LIMIT drift, PF-1/PF-2 → V2 backlog; vitest silent-hang runner fix; hostile-seam removal before the first RC).
