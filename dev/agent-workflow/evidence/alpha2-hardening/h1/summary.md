# H1 summary — P0 RED probe + monotonic end-cap (alpha.2 hardening)

Branch `task/alpha2-h1-p0-endcap` (base `27a6c36`). Worker: H1. Task: prove the hostile `agentCtx.on('tools/pre-execute', allow, {prepend:true})` bypass on the REAL upstream composition, then close it with a monotonic end-cap on the same agent ctx via the public `tools.guard` seam + an install-scoped `WeakSet` over the exec object. CORE PATCH BUDGET = 0 throughout.

**Verdict: GO for H2.** The bypass reproduced (RED, 17 failing probes incl. body-execution under the prepend-allow), the fix closes it structurally (monotonic guard — deny-or-abstain only), and every gate is green/parity.

## 1. What was built

- **Fix** (`packages/runtime/operation-permission/pre-execute-adapter.ts` + `errors.ts` + `index.ts`):
  - install-scoped `WeakSet<object>` over the EXEC OBJECT (the `ToolExecutionToken` is a symbol — not WeakSet-able; the exec object is the identity of one execution, upstream L1458-1460);
  - marked at exactly the two final-allow points (static allow; ask→allow after `guardOperation` allowed), never on deny/abort/failure;
  - `endCapGuard` installed through `tools.guard` (public seam, L1092-1105, agent-scoped, exact disposer): sync, never throws, abstains on the six-tool-unset names and on marked execs, else `observe({stage:'end-cap-denial'})` + returns `END_CAP_DENIAL_REASON`;
  - fail-closed BEFORE any registration: no `tools.guard` on the ctx ⇒ `PermissionGuardUnavailableError` (code `alpha2-permission-guard-unavailable`), zero partial state;
  - composite disposer, pinned order listener→guard (R6).
- **Probe spec** `packages/runtime/test/h1a-pre-execute-endcap.test.ts` (40 tests, 13 groups) over real cordis `Context` + `ToolRuntime` + dsh-scope agent scope + the real A4 durable control service.
- **Doubles**: a5a S15 rewritten (guard recording, dispose order, second-install independence), a6a w1 guard counts (leader + A exactly one active, B zero, `close()` drains), t12a live bridge `tools.guard` recording seam (.mjs + .d.mts).
- **devDeps** (test-only): `@deepseek-ai/dsh-tools`, `@deepseek-ai/dsh-scope`, `@deepseek-ai/dsh-system-prompt` @ 0.1.2-rc.1 + `@deepseek-ai/cordis` @ 4.0.2 (D1).

## 2. RED → GREEN (mandatory sequence honored)

RED captured PRE-fix (`h1-red-console.log`, timestamped): **17 failed | 23 passed (40)** — the bypass reproduced: P0-A/B/H/I/A9/D/J tool bodies EXECUTED under the hostile prepend-allow. GREEN post-fix (`h1-green-console.log` §[1/3]): **40/40**. Full probe table + console excerpts: `h1-probe-log.md`.

## 3. Gate table (actuals)

| Gate | Target | Actual | Status |
|---|---|---|---|
| h1a RED (pre-fix, bypass reproduces) | failing probes show the bypass | 17 failed \| 23 passed (40) — bodies executed under prepend-allow (P0-A/B/H/I/A9/D/J); STOP NOT triggered | ✅ |
| h1a GREEN | 40/40 | **40/40** | ✅ |
| a5a (updated S15) | 40/40 | **40/40** | ✅ |
| a6a (updated w1) | 50/50 | **50/50** | ✅ |
| runtime full suite | parity with pre-fix baseline (6 failed files \| 140 (146); 8 failed \| 1468 (1476)) | **6 failed files \| 141 passed (147); 8 failed \| 1512 passed (1520)** — IDENTICAL failing set: d3-4 (1), p6t3-mediation (5: #1,3,4,5,7), p6t3-restart (2: #2,5), p8s3b/t12a-b2/t12a-glue (3 module-load); +44 passed = exactly the new tests (h1a 40 + a5a 1 + a6a 3) | ✅ parity |
| domain | 372/11 (earlier-session target) | **373 passed \| 10 failed (383)** — byte-identical to the stashed BASE tree (373/10, same 10 tests: t1-capability-schema ×9 + t2-blueprint-hash ×1) | ✅ identical-to-base (D6) |
| testkit | 124/0 @ pin 667 | **15 files, 124/124 @ 667** | ✅ |
| `pnpm -r run typecheck` | 0 | **9/9 packages clean** | ✅ |
| `pnpm run build` | 0 | **9/9 Done** | ✅ |
| `pnpm run build:composition` + check-artifacts | 0 + 1080+delta | **exit 0; `check-artifacts-committed OK: 1080 files`** (content-only drift committed; no new artifacts) | ✅ |
| dist glue (`agent-bindings.mjs`) | unchanged, pure LF | rebuilt output byte-identical to src modulo EOL and to the committed artifact — **zero diff** (0 CRLF) | ✅ |
| `references/deepseek-harness-test-use` | pristine, porcelain 0 | **porcelain 0 @ a66e470204** | ✅ |
| p4t6 scanner pin | 666 → 667 | **667** (ONE new scannable file: h1a spec; DEC-1 comment-chain entry (h); value+comment only; testkit 124/0) | ✅ |

## 4. Pin delta

**p4t6: 666 → 667.** One new scannable .ts file (`packages/runtime/test/h1a-pre-execute-endcap.test.ts`). DEC-1 chain: entry (h) appended in the existing A1-A6 style; final paragraph arithmetic updated `666 (642 + 10 + 1 + 7 + 1 + 2 + 2 + 1)` → `667 (… + 1)`, "twenty-four" → "twenty-five" files, evidence list extended with `alpha2-hardening/h1/`. Value + comment only — no scanner change.

## 5. Deviations (each with evidence)

- **D1 — cordis devDep 4.0.2, not 0.1.2-rc.1.** The registry has no `@deepseek-ai/cordis` 0.1.2-rc.1; the dsh packages pin 0.1.2-rc.1 but cordis itself is versioned on its own line. `@deepseek-ai/dsh-tools@0.1.2-rc.1` declares peer `@deepseek-ai/cordis ^4.0.2`; 4.0.2 installed and verified from `node_modules` (the mount works — h1a GREEN 40/40 proves the real `Context` + `ToolRuntime` resolve and behave).
- **D2 — P0-H real semantics: prepend-allow WINS, append-deny has 0 calls.** The brief's "final = deny" expectation is unreachable under the real waterfall: `vendor/cordis/src/events.ts` `cbs.shift()` = head-first (L234-243) and `prepend:true` = `unshift` (L255), so the prepended allow runs before every appended listener and its return-without-`next()` ends the chain. The probe pins the reachable secure property: final = DENIED by the end-cap (monotonic), append-deny 0 calls (ordering pin). NOT a STOP — the bypass reproduces on P0-A/B/D/I and A9 anyway.
- **D3 — P0-F hostile deny registered `{prepend:true}`.** The brief's intent is "the hostile is the decider"; appended, the hostile deny would sit INSIDE the adapter's own listener (registered first = head) and the adapter's static deny would win in RED (observed: `Error: permission denied by the stati…`). With prepend (outermost), RED shows final = `Error: hostile`, body 0, 0 end-cap rows — passes on both trees (correct non-discriminating pin, as designed).
- **D4 — p5t3-restart stale-scratch flake (environmental).** One full-suite run failed at module load with `ENOTEMPTY` on the test's own `rmSync` scratch cleanup (Windows handle timing), leaving a stamped residue dir; the next run's seed then failed `team_domain already exists (schema_meta holds 8 stamp row(s))`. My diff touches nothing in storage/seam/restart. Resolution: wiped the stale `.tmp-fault` scratch dirs; suite then passed with exact parity (the +3 hidden tests re-appeared: 1517+3 = 1520 = 1476 baseline + 44 new).
- **D5 — p6t1-parallel flake under full-suite load (environmental, pre-existing).** One full-suite run showed 2 extra failures in this timing-sensitive parallel test; re-run alone: 9/9 pass; the next full-suite run: full parity. Unrelated to the diff (admission/parallel-activation paths untouched).
- **D6 — domain "372/11" not reproducible; 373/10 on BOTH trees.** The earlier-session target of 372/11 is not reproducible on the current machine: the stashed BASE tree and my tree both show 373/10 with the identical failing set (one previously-failing test recovered — an environment/time-dependent flake). My diff cannot affect domain: domain's only dependency is `yaml`; the lockfile delta is +13 lines (runtime devDeps only); zero files under `packages/domain/` touched. Evidence: two runs on my tree + one run on the stashed base (`.tmp-gate-domain*.log`).
- **D7 — pre-existing stale dist surfaced by the rebuild.** The D1 v3 cherry-pick (`e877478`) committed the rebuilt glue dist but left the tsc-built dist (`host.js`, `types.d.ts` + maps) stale vs src. The H1 `build:composition` rebuild surfaced all of it as content drift; per repo convention ("rebuild output must be committed together with the source") the rebuilt dist (18 files) went into commit (b) alongside the fix. The rebuilt glue was byte-identical to the already-committed artifact (zero diff, pure LF).
- **D8 — p4t6 pin 666→667** (mandatory consequence of the new scannable file; §4).
- **D9 (carried) — AGENTS.md stale pin.** AGENTS.md names the test-use baseline `76fda72979`; the actual tree is @ `a66e470204` (parent's live fact). Not edited by H1 (parent/user-owned doc); noted for the doc-alignment pass.

## 6. Rulings

- **R6 (disposer order):** composite disposer = `disposeListener()` FIRST, `disposeGuard()` LAST — pinned in the module doc + a5a S15 (`disposeOrder` toEqual `['listener','guard']`) + h1a S15-ext + a6a w1 (close drains 0/0/0).
- **WeakSet ruling:** marker on the exec OBJECT, install-scoped (one set per install); token is a symbol (upstream L300) and cannot be the key.
- **Monotonicity is structural:** the end-cap rides the upstream `ToolGuard` contract (L696-704 — deny-or-abstain, never allow); no later stage can re-allow.
- **Mark-only-on-final-allow:** two mark sites (static allow; ask→allow after `guardOperation`); deny/abort/failure never mark (probed: P0-A/B/D/J zero durable effect).

## 7. Console evidence

- `h1-red-console.log` — timestamped, PRE-fix (predates the fix commit `cda0d30`): 17 failed | 23 passed (40), bypass visible.
- `h1-green-console.log` — §[1/3] h1a 40/40; §[2/3] a5a 40 + a6a 50; §[3/3] full-suite parity summary.
- `h1-probe-log.md` — 13 probe groups, RED→GREEN per test, console excerpts.
- `root-cause-and-seam-note.md` — verified upstream facts (line numbers), the WeakSet ruling, seam invariants.

## 8. Commit list

| # | SHA | Content |
|---|---|---|
| (a) | `012932b` | RED probe: devDeps + lockfile + h1a spec (failing) + p4t6 pin 667 + red console + root-cause/seam note |
| (b) | `cda0d30` | the fix: end-cap adapter + errors + index, a5a/a6a/t12a doubles, rebuilt dist (incl. D7 pre-existing staleness) |
| (c) | this commit | green evidence: green console, probe log, summary.md |

Final tree: worktree porcelain-clean (brief + all `.tmp-*` scratch deleted), `references/` porcelain 0 @ a66e470204, no push performed.
