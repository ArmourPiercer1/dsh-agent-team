# H3 — closure verification: full matrix, wiring, legacy, live proof, DoD (alpha.2 hardening)

> Task: `task/alpha2-h3-closure` · worktree: `.worktrees/alpha2-h3` (create from the int tip AFTER H2 is integrated; run `pnpm install` first) · 1 writer = you.
> Authority: `docs/plans/active/dsh-agent-team-alpha2-permission-boundary-hardening.md` (§14 adversarial matrix, §15 control-plane regression, §16 production wiring, §17 legacy/alpha.1 non-regression, §18 diagnostics, §19 DoD, §20 closure report, §21 final criterion) — H1 (P0 end-cap) and H2 (P1 contracts) are ALREADY integrated into your base tree; your job is verification + the live adversarial proof + the closure report. You do NOT re-implement the fixes; you prove them and, where a leg is genuinely uncovered, add the missing verification leg (test-only additions; product changes only if a gap is PROVEN, with a deviation record).

## 1. What already exists (do not duplicate)

- **h1a** (`packages/runtime/test/h1a-pre-execute-endcap.test.ts`, 40 tests, real upstream composition): covers review §14 legs A1/A2/A3 (P0-A/B/C), P0-D, P0-E, P0-F, A5 (P0-G), P0-H, A9, P0-J, A15, A16, plus nested-dispatch P0-I, the composite-disposer pin, and the fail-closed install.
- **H2 suites** (your base tree): bash schema ruling + parse tests, bash commandHash fingerprint + preview, deny-rule canonicalization fail-closed DR-A..DR-D.
- **a5a** (adapter unit, fake ctx), **a6a** (production glue over t12a doubles, incl. w1 exactly-one-guard-per-lifecycle + dispose drain + fs-seam legs), **a4a** (control plane C1-C5), **a2/a3** (canonical/resolver), **t12a** bridge doubles (guard recording seam present since H1).
- **V1 live kit** (reuse, do not rewrite): `dev/agent-workflow/evidence/alpha2-permission/v1/` — `a2perm-check.mjs` (84KB check driver) + `a2perm-setup.mjs` / `a2perm-boot.mjs`; world = `references/.dsh-test-a2perm-<stamp>` (ephemeral, NEVER committed); host :3181 + mock :3493 (mock = self-resolving import from test-use `packages/tools/harness/mock-deepseek.mjs`); `/tool` direct route `POST /__p6t6/tool {name,args,as,callId}`; `/state` route is chain-held during active member turns (PF-1) — use the raw ledger (`team.getLedgerPage`) for member-phase assertions; V1 official v17 = live 115/115 + cold-resume 26/26 + legacy 12/12.

## 2. Your deliverables

### 2.1 The §14 adversarial matrix ledger (A1–A16)
Build `dev/agent-workflow/evidence/alpha2-hardening/h3/matrix-ledger.md`: one row per A1–A16 with (leg → covering evidence: h1a test name / H2 test name / H3 new leg / live probe id, + one-line console excerpt or file pointer). Every leg must point at REAL executed evidence. Gaps: if a leg has no covering evidence, add the minimal leg (unit where possible; live where the leg is inherently live — A10/A11 PTC nested + A12/A14 cold-resume are the expected live legs) and record it.

### 2.2 §16 production wiring — four bind paths
Verify over the a6a suite (extend if a path is missing): fresh-root create, cold-root resume, member create, and dispose each install BOTH the listener and the guard (recording doubles: exactly one of each per active lifecycle; zero after dispose), and a template WITHOUT a permissions block installs NOTHING (no listener, no guard, no error). Report per-path evidence.

### 2.3 §15 + §17 regression
- a4a C1-C5 green; targeted 258-baseline suites green; domain 373/10 shape (same 10 tests); the H1-declared flaky files (p5t3-restart, p6t1-parallel) re-confirmed stable in a final full runtime run.
- Legacy/alpha.1: legacy blueprints (no permissions) → zero installs (a6a leg + live legacy probe if the kit's legacy scenario is cheap to re-run); the ten team tools + d1 spec (7/7) unchanged.

### 2.4 THE live adversarial proof (review §21 final criterion)
In the LIVE production composition (real world, real glue, real upstream), a hostile `tools/pre-execute` prepend-allow listener must NOT let any alpha.2 managed tool execute without Team permission authorization. Design choice (record your ruling):
- **Primary (recommended)**: an env-gated test-only route in `packages/tools/harness/plugin.mjs` (the p6t6 test-route precedent), e.g. `POST /__hardening/hostile-prepend { agent }` that registers `agentCtx.on('tools/pre-execute', () => Promise.resolve({kind:'allow'}), {prepend:true})` on the named live agent's scope ctx — enabled ONLY when the kit sets `DSH_HARDENING_PROBE=1` (route returns 503 otherwise). Clearly documented as test-only in the route doc-comment + the kit. Then live legs: hostile prepend-allow on a leader with a file-op default-deny policy → the `/tool` direct route (or a member turn) triggers a managed tool → DENIED with the end-cap reason, body never ran (ledger/diagnostics), ZERO control rows; cold-resume repeat (A12/A14); a nested/PTC leg if the live agent loop's parallel tool calls are reachable from the drill (A10/A11 — if not reachable without an agent-model change, record the ruling and rely on h1a P0-I + the unit evidence).
- **Fallback**: a local test-only plugin package in the world's DSH_HOME + a cordis row registering the hostile listener per agent scope (a true external third party — no production file touched at all). Use if the route is infeasible.
- EITHER way: the world is ephemeral (never committed); the production-side artifact (if the route) stays gated, minimal, and documented; record it in the closure report as a known test seam (V2 candidate to remove before RC if it remains).
- Run the full fresh-world live matrix (the V1 kit's 115-check plan §12 suite as-is + your new hostile legs) AND the cold-resume suite (26-check shape). The hostile legs run INSIDE the world run (kit extension: a new check group `h3-hostile-*`).

### 2.5 §18 diagnostics
Confirm the end-cap denial observation row is emitted in the live world (diagnostics channel/ledger per the kit's observation readout) with the stable reason text; pin an excerpt in the report.

### 2.6 Gates (final)
Focused: a2/a3/a4a/a5a/a6a/h1a + H2's suites all green. Full runtime parity (6 failing files | 8 failing tests, no new failures). domain 373/10. testkit 124/0 at the pin value H2 left (if YOU add scannable test files, continue the DEC-1 chain with an `(h3)` entry + scanner-verify). typecheck 0, build 0, `build:composition` 0 + `check-artifacts`, dist EOL pure LF (restore if churn — check BOTH agent-bindings.mjs and any touched package dists). references/ porcelain 0 @ a66e470204 (world homes are under references/.dsh-test-* — they are gitignored/ephemeral, but verify `git -C references/deepseek-harness-test-use status --porcelain` = 0 and note any world homes created).

### 2.7 §19 DoD + §20 closure report
`dev/agent-workflow/evidence/alpha2-hardening/h3/closure-report.md`: (1) the §21 criterion stated and PROVEN (live evidence pointer); (2) the full matrix ledger; (3) gate table with actuals; (4) the P2 debt register (READ_LIMIT_DEFAULT=2000 read-window drift — record, deferred per review §9; PF-1 /state chain-hold + PF-2 redelivery — already V2 backlog; any new findings); (5) the live hostile seam (route or DSH_HOME plugin) documented; (6) deviations with evidence; (7) commit list.

## 3. Red lines
CORE PATCH BUDGET = 0 (references/ trees read-only; test-use @ a66e470204 porcelain 0 at your end); :3080 + :3180 zero-touch; live work on 3181/3493 only (verify free before boot; if busy, STOP and report — do NOT kill foreign processes); no push; worktree porcelain-clean at end (delete h3-brief.md + .tmp-*); the hostile route/plugin, if any, is the ONLY production-file delta allowed, gated + documented + deviation-recorded.

## 4. Report to parent
GO/NO-GO for closure, SHAs, gate table with actuals, matrix ledger path, live probe excerpt (the §21 proof), pin (H2's value → yours), deviations, world home name + stamp. Fixed router blocker format if blocked after 3 attempts.
