# RC.5 TEST MATRIX — the honest population, measured

Round **110** (2026-11-25). Review `20261125-0058` Stage B, first item: *"rc.5 完整测试矩阵：不仅是四个
D Driver，还包括更广泛的 Vitest、Node Test 群"*.

Branch `vnext/a1-cut`, start head `fc170f929060133b3897cb1f0b769c20a928c893`.
Hosts: rc.2 `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84`
(`0.2.0-rc.2`); rc.5 `tests/deepseek-harness-next` @ `9c2670d3bce5275e0d1610272958121af87787bb`
(`dsh-v0.2.2-rc.5`). One selector: `TEAM_TEST_HOST=next`, authority
`tests/next-host/host-select.mjs`.

This document replaces narration with a population. Every "rc.5" cell below is a run on the rc.5 pin
through the existing selector (or, where a suite is rc.5-pinned by construction, through its own
`NEXT_HOST` import); every "N/A" cell carries the reason and the measured evidence for that reason. No
suite was skipped to make the table green: the red cells are listed with their disposition.

---

## 1. How the population was enumerated (from code, not docs)

Source: `test-catalog --json` (785 catalog entries: **733 collected, 38 uncollected, 14 excluded**;
by runner at this head `node=146`, `vitest=632`, `none=7`). The classification below scanned the **771
non-excluded** entries (630 vitest + 141 `node:test`); the 14 excluded files are outside every run by
definition. Each file was classified by four independent signals read from the file itself:

| signal | what was read | count |
| --- | --- | --- |
| `host-import` | a **value** import of a bare `@deepseek-ai/*` specifier (type-only imports are erased and do **not** count) | 47 |
| `host-tree` | a reference to a host tree path (`tests/deepseek-harness-test-use/`, `tests/deepseek-harness-next/`, `NEXT_HOST`, `TEST_USE_BASELINE_SHA`, `selectedHostTree`, `hostTree`) | 41 |
| `boot` | the booted-host preload (`tests/next-host/host-loader.mjs`), `TEAM_TEST_HOST`, `resolveSelectedHostModule`, `world.startHost()`/`TestWorldFactory` | 13 |
| `selector-read` | `testHostMode()` explicitly consulted | 9 |

93 of the 771 classified entries carry at least one host signal (a file may carry more than one). The remaining 678 have
no host dependency at all: one run on either host grades them identically, and this document does
**not** count them as rc.5 coverage.

**Three distinctions the table keeps apart**, because collapsing them is how a matrix lies:

1. **host-generic** — the suite boots or imports *the selected host*; running it under
   `TEAM_TEST_HOST=next` is a real rc.5 measurement.
2. **rc.2-subject** — the suite pins the legacy host *as its subject* (`createRequire` of the repo's
   rc.2 install, a hardcoded `tests/deepseek-harness-test-use/.../lib/index.js`, an explicit
   `hostTree: HOST_TREE`, a census home at the rc.2 base). Running it under the next selector builds a
   *mixed* world (rc.2 modules inside an rc.5 product) or is refused by the host-base guard. Its rc.5
   cell is **N/A**, with that reason — it is not evidence either way.
3. **rc.5-pinned** — the suite imports `NEXT_HOST` directly (`tests/ute-g1-*`, `tests/next-host/*`);
   it measures rc.5 only, and its rc.2 cell is **N/A**.

## 2. Population by area (771 files)

`host-coupled` = files carrying any host signal. "Executed on rc.5" is filled in §3.

| area | files | host-coupled | signal mix | executed on rc.5? |
| --- | ---: | ---: | --- | --- |
| `packages/client` (vitest, jsdom) | 59 | 26 | import 26 | runner-limited (§4.3) |
| `packages/runtime` | 421 | 22 | import 18, tree 5, boot 4 | partly (selector + pinned) |
| `tests/world-factory` | 71 | 31 | tree 26, import 2, boot 5 | partly (leg suites) |
| `packages/testkit` | 34 | 4 | tree 3, import 1 | no (pure + rc.2 helper) |
| `packages/contracts` | 13 | 0 | — | one run suffices |
| `packages/domain` | 50 | 0 | — | one run suffices |
| `packages/storage` | 23 | 0 | — | one run suffices |
| `packages/remote` | 16 | 0 | — | one run suffices |
| `packages/tools` | 14 | 0 | — | one run suffices |
| `packages/legacy` | 7 | 0 | — | one run suffices |
| `scripts/` | 20 | 2 | tree 1, boot 1 | yes (ci-local, host-cache-key) |
| `tests/next-host` | 3 | 2 | tree 2, boot 1 | yes (rc.5-pinned) |
| `tests/ute-g1-fs` | 3 | 2 | boot 2 | yes (rc.5-pinned) |
| `tests/ute-g1-uistate`, `ute-g1-web`, `ute1-fs` | 3 | 3 | tree 3 | yes (rc.5-pinned) |
| `tests/ute-g1-agentctl/process/search` | 3 | 0 | — | yes in the G1 argv |
| `tests/s2-authority`, `tests/kits`, `tests/checks`, `tests/ute2-settlement` | 15 | 0 | — | one run suffices |
| single-file dirs (`a5sf-diag`, `diag-call-chain`, `evidence-store`, `poc-web-native-reuse`, `u7-3-devex`) | 7 | 1 | tree 1 | yes (poc probe) |

## 3. Executed population on rc.5 (the measured matrix)

| # | population | files | tests | rc.2 result | rc.5 result | rc.2-only reason / rc.5 note |
| --- | --- | ---: | ---: | --- | --- | --- |
| A | `ute-vnext-a1` dispatch leg (selector; 6 non-ladder suites + ladder) | 7 | 251 | **251 / 248 pass / 0 fail / 3 skip** (exit 0) | **251 / 232 pass / 18 fail / 1 skip** | the 18 failures are the B-ladder arms only (§4 item 4) |
| A1 | ├ `vnext-realm-lane` | 1 | 12 | 12/12 | **12/12** | — |
| A2 | ├ `vnext-fs-slice` | 1 | 42 | 42/42 | **42/42** | SLICE-21/30 were fixed in earlier rounds; this round confirms 36→42 |
| A3 | ├ `vnext-admission` | 1 | 163 | 162/1 skip | **162/1 skip** (0 fail) | ADM-96/97 fixed this round (§5.1) |
| A4 | ├ `vnext-os-probe` | 1 | 3 | 3/3 | **3/3** | — |
| A5 | ├ `vnext-work-turn-reader` | 1 | 7 | 7/7 | **7/7** | — |
| A6 | ├ `vnext-template-binding` | 1 | 6 | 6/6 | **6/6** | — |
| A7 | └ `vnext-b-probe-ladder` | 1 | 18 | 18/18 | **0/18** | **OPEN (b)**: `mode` config removed upstream (§4 item 4) |
| B | UTE G1 exact CI argv (rc.5-pinned; 9 files) | 9 | 89 | N/A | **89 / 89 / 0 / 0** (exit 0) | rc.2 N/A: files import `NEXT_HOST` directly; the argv must not carry `TEAM_TEST_HOST` (double selection) |
| C | next-host/settlement/closure lane exactly as CI (11 files) | 11 | 184 | N/A | **184 / 184 / 0 / 0** | rc.2 N/A (pinned rc.5 + pure script tests) |
| C1 | └ `tests/next-host` (boot 2, native-api 4, provisioning-controls 13) — **included in C** | 3 | 19 | N/A | **19 / 19** | rc.2 N/A: provisioning is rc.5-only |
| E | leg-declared `node:test` suites under the selector | 14 | 235 | green in the `ci-integration` leg (rc.2 lane) | **232 pass / 3 fail / 0 skip** | the 3 failures are rc.2-subject suites (§4 items 5–6) |
| F | vitest bound migration set (`ci-integration`, 15 suites) | 15 | 238 | **238 / 238** | **N/A** | runner-limited: Vite resolves the repo install, not the selector (§4.3); 14 of 15 are host-free anyway |
| G | vitest root population (one run) | 599 | 7424 | **7424 / 7424 pass** (599 files) | **N/A** | host-free by construction (678/771 files); the 40 host-importing vitest suites are §4.3 |
| H | uncollected `node:test` files (catalog ratchet) | 38 | — | governed by the 38-uncollected baseline | **not counted** | outside the executed population; §4.4 |

Executed rc.5 tests: **A+B+C+D+E = 759 tests, 737 pass, 21 fail, 1 skip**. Every one of the 21 failures
is dispositioned in §4; none is skipped.

The rc.2 column for A/E/F/G is a real run at this head (`ute-a1-rc2.log`,
`vitest-root-rc2.log`, bound log), not a historical citation. Round-78 per-suite rc.5 numbers are
**stale** and were not reused: `fs-slice` moved 34/36 → 42/42 and `admission` moved 124/119 → 162/1 skip
at this head.

## 4. Every rc.5 failure, with disposition

Disposition vocabulary: **(a)** genuine rc.5 product incompatibility → fixed with an arm; **(b)** the
test/environment assumes rc.2 → observation adapted, assertion unchanged; **(c)** capability absent →
ENV-LIMITED with a probe, never PASS.

### 4.1 Fixed this round — (b), observation adapted, assertions untouched

| # | suite / arm | rc.5 error (exact) | root cause (file:line) | adaptation |
| --- | --- | --- | --- | --- |
| 1 | `vnext-admission` ADM-96, ADM-97 | `TypeError: signals[0] is not of type AbortSignal.` (`ERR_INVALID_ARG_TYPE`) at `mcp-client/lib/index.js:496` ← `:596` ← `vnext-admission.test.mjs:4516` | rc.5 MCP client calls `AbortSignal.any([execution.signal, opts.signal])`; the two arms fabricate an `exec` frame without a `signal` | `packages/runtime/test/vnext-admission.test.mjs`: ADM-96 fabricated `exec` gains `signal: new AbortController().signal`; ADM-97 `execOf` returns `{name, callId, arguments, agent, turn, step, signal}`. Nothing else changed; same arms, same judges. Result: 163 tests / 162 pass / 1 skip / **0 fail on both hosts** |
| 2 | `a5sf-harness` "fixed candidate: the pin is READ from tests/paths.mjs" | `AssertionError: + '9c2670d3…' - '639ed015…'` at `a5sf-harness.test.mjs:248` | the arm bound the candidate pin to the **rc.2 constant** (`TEST_USE_BASELINE_SHA`) instead of the selected pin, while `candidate().pin` correctly returns `factory.hostPin.sha` (the selected authority) | `tests/world-factory/a5sf-harness.test.mjs:243–261`: compare against `selectedHostPin(REPO_ROOT).sha` (the same authority the harness reads) and assert the 40-hex **literal** is absent from the harness source. Same law ("read from the authority, never copied"), host-independent. Result: **10/10 on rc.2 and rc.5** |
| 3 | `a5sf-native-route-c` N2–N8 (6 arms) | first `TypeError: agent-bindings: the a5sf native tool re-mount needs a SCOPED agent Context` at `a5sf-realm-row.mjs:782`; after that `cannot get property "tools" without inject` at `tool-executor-native/lib/index.js:10` ← `pipeline.js:258` | two rc.2 assumptions in the unit world: (i) `createRequire(packages/runtime/package.json)` pinned the **rc.2** `@deepseek-ai/*` modules while the product resolved the **rc.5** copies → two `dsh-scope` namespaces → the module-private scope Symbol missed → `scopeOf(root) === undefined` (the exact duplicate-instance hazard the product comment names); (ii) rc.2's single-call `tools.execute` and no executor service | `tests/world-factory/a5sf-native-route-c.test.mjs`: host modules now resolve through `resolveSelectedHostModule` under the selector (`hostEntry()`), the rc.5 executor is mounted as its exported plugin `{name, inject, apply}` (mounting the bare class skips `inject`), and dispatch goes through the **existing** `executeToolDispatch(..., {hostMode})` helper (rc.2 single call / rc.5 batch). Assertions unchanged. Result: **8/8 on rc.2 and rc.5** |

### 4.2 Still red — (b) open: the B Ladder

| # | suite / arms | rc.5 result | diagnosis (file:line) | why it is not fixed this round |
| --- | --- | --- | --- | --- |
| 4 | `vnext-b-probe-ladder` — all 18 `ARMS` fail in the `before` hook | `TypeError [ValidationError]: invalid config: - $.mode expected nullable but got both (at mode)` — deterministic, ~505 ms | `vnext-b-probe-ladder.test.mjs:273` mounts `ToolRuntime` with `{ mode: 'both', ptc: {} }`; rc.5 `packages/core/tools/lib/index.js:407` declares `mode: z.never()` ("Removed. Mount a native or PTC tool executor instead."). The hook rejects before any arm runs, so all 18 are red, not 18 independent findings | The adaptation is a **rewrite of the world**, not a config rename: rc.5 selects an executor service (`NativeToolExecutor` / `PtcExecutor`, one per scope — `tools.setExecutor` refuses a second), dispatch is a batch (`{calls:[{type:'tool-call',…}], signal, agent}`), and the `run_code` identity/retention arms (ADM-63/69/76/79/80) rely on rc.2's registry `Transport`, which rc.5 moved into `PtcExecutor.requirePtcTransport()`. That is its own arm design, not a drive-by edit; doing it in this round would have been an unreviewed rewrite of 18 judged arms |

**The historical "hang" is explained, not waved away.** Round 78 recorded
`vnext-b-probe-ladder.test.mjs` as hanging on rc.5. This round it does not hang when given a
per-test timeout: the bundled leg with `--test-timeout=45000` completes with **251 tests / 232 pass /
18 fail / 1 skip** in one run, and the ladder alone fails in ~0.5 s. Without a timeout the bundled
invocation never settles (the `before` rejection leaves the runner waiting). Locus: the `before` hook at
`vnext-b-probe-ladder.test.mjs:1028–1050` → `buildLadderWorld` → `:273`. The correct next step is the
world rewrite above, **not** a larger timeout; no gate timeout was changed.

### 4.3 Not rc.5 coverage — runner-limited (disclosed, not excused)

| # | population | measured | why rc.5 cannot grade it through the ONE selector |
| --- | --- | --- | --- |
| 5 | 40 vitest suites that load host code at runtime (26 `packages/client/test/*.client.spec.tsx` via `@deepseek-ai/dsh-client-test-runtime`, 14 `packages/runtime/test/*` via `dsh-tools`/`dsh-scope`/`dsh-system-prompt`/`dsh-mcp`/`cordis`) | rc.2: PASS inside the 599-file / 7424-test root run | Vite resolves `@deepseek-ai/*` from the repo install **before** Node's ESM loader runs. Measured: with `TEAM_TEST_HOST=next NODE_OPTIONS=--import=tests/next-host/host-loader.mjs`, a probe suite still imported `@deepseek-ai/dsh-scope/package.json` version **`0.2.0-rc.2`**. A `resolve.alias` in `vitest.config.ts` would make the matrix greener but would be a **second host-selection mechanism** (explicitly forbidden), and it would move the whole root population. So these 40 are **rc.2-only by mechanism**, and are *not* counted as rc.5 coverage; the 590 host-free vitest files are graded once, on either host |

The 15-suite bound migration set (238 tests) is a subset of this runner limit; 14 of its 15 suites have
no host dependency at all, and the one host import (`f15-mcp-live-loss.test.ts` → `scopeOf` from
`@deepseek-ai/dsh-scope`) is a shallow unit use. Its rc.5 cell stays N/A for the same measured reason.

### 4.4 rc.2-subject suites that failed in the mixed run — **not** rc.5 findings

These were run under `TEAM_TEST_HOST=next` to *test the classification*, and the mixed world is exactly
what the failures show. Each is N/A for rc.5 with the stated pin; the rc.2 lane grades them (green in
the `ci-integration` leg at this head).

| suite | rc.5-selected run | the rc.2 pin that makes it N/A |
| --- | --- | --- |
| `a5sf-fs-contract` (FSB-IMG-1b) | 21 tests / 20 pass / 1 fail | imports the real **rc.2** `packages/fs/tool-fs/lib/index.js` from `tests/deepseek-harness-test-use` (`:297`); the withheld-continuation arm measures the rc.2 tool package, not the product |
| `m7a-real-slice-host-state` (2 arms) | 4 / 2 / 2 | the arm boots `m7a-real-slice` in a subprocess whose world passes `hostTree: HOST_TREE` (rc.2 census base) — the child refuses under the next pin (`NextHostMissingError`) and the parent's exit-message assertion misses |
| `a5sf-tool-axis`, `a5sf-pd17-fs-read-axis` | 17/7/10, 15/2/12 | `BASELINE_TOOL_FS = …/deepseek-harness-test-use/packages/fs/tool-fs/lib/index.js` (`:132`, `:91`) |
| `a5sf-pd19-fact-attribution`, `a5sf-pd18-web-ptc`, `a5sf-pd27-confined-web` | 7/2/5, 6/4/1, 10/0/9 | rc.2 fixture tool modules / a product module that no longer exists (`confined-web-tool.mjs` → `ERR_MODULE_NOT_FOUND`, host-independent staleness) |
| `host-sandbox-assets` | 42/25/17 | grades the **rc.2** asset manifest; the rc.5 tree has its own native assets |
| `world-factory.test` (self-test) | 45/41/4 | 2 of the 4 are pre-existing rc.2 failures (45/43/2 on rc.2: `RUN record` fixture, `u6-arc-a` probe file missing); the other 2 are the synthetic `repoRoot` in `owned-path guard` / `host-base guard` — `selectedHostPin(repoRoot,'next')` looks for `<repoRoot>/tests/deepseek-harness-next`. Uncollected (not in a leg), so not counted |
| `a5sf-sub-contract`, `a5sf-native-bash-preservation`, `a5sf-pd14-sandbox-root` | 17/16/1, 1/0/1, 1/0/1 | uncollected; rc.2 tool/subprocess surfaces |

**Note for whoever makes these host-generic**: the failures are *not* proof of rc.5 defects. Where the
error is thrown by product code (`agent-bindings`, `TEAM_SERVICE_INSTALL`/`SERVICE_MOUNT_FAILED`
"prompt section `tool:write` is already registered"), it is thrown because the world mixed an rc.2
module with the rc.5 registry — the rc.5 duplicate-section law is per-scope, and the live rc.5 drivers
pass route C (this round: `a5sf-native-route-c` 8/8 after selecting consistently). If those suites are
ever moved into the rc.5 lane, adapt them the way §4.1 item 3 did.

### 4.5 ENV-LIMITED / (c) — none claimed

No failure in this round was classified ENV-LIMITED; no capability probe was needed. The rc.5 tree's
native assets are present
(`tests/deepseek-harness-next/native/system/packages/linux-x64`), so the absent-capability lane did not
apply.

## 5. Product fixes

**None.** The three code changes are test-observation adaptations (§4.1). No file under `packages/`
product source (`packages/*/src`) was touched; the only `packages/` edit is a test file
(`packages/runtime/test/vnext-admission.test.mjs`), and no assertion was weakened. CORE PATCH BUDGET
stays 0; `tests/deepseek-harness-next` and `tests/deepseek-harness-test-use` are unmodified
(`git -C … status --porcelain` empty for both, verified by the harness guard on every boot).

## 6. What is NOT covered (stated plainly)

1. **18 B-ladder arms** (rc.5) — red, §4.2.
2. **40 host-importing vitest suites** (rc.5) — runner-limited, §4.3. This is the single largest
   uncovered block; closing it requires either a runner change driven by the *same* selector (a
   `resolve.alias` in `vitest.config.ts` that calls `testHostMode()`), or a decision that these units
   are host-version-agnostic. That is a design decision, not a green cell.
3. **38 uncollected files** — governed by the catalog ratchet `--max-uncollected 41`; not executed, not
   counted.
4. **350 leg-declared node suites not in the rc.5-selected run** (the 51-suite `tinf-instruments` leg
   and others remain rc.2-lane by design). The D-driver population (31 judges / 4 drivers, rc.5 PASS in
   round 109) is unchanged by this round.
5. **No live boot deltas** were re-measured beyond the 4 drivers; this round is a test-population
   round, not a new capability round. `CAPABILITY-MATRIX-C.md` gains no PRODUCT-PROVEN row.

## 7. Reproduction

```bash
# A. selector lane (rc.2 default, rc.5 under TEAM_TEST_HOST=next)
TEAM_TEST_HOST=next A5SF_REQUIRE_PINNED_HOST=1 node --test --test-force-exit \
  --test-timeout=45000 --test-reporter=spec \
  packages/runtime/test/vnext-realm-lane.test.mjs packages/runtime/test/vnext-fs-slice.test.mjs \
  packages/runtime/test/vnext-admission.test.mjs packages/runtime/test/vnext-os-probe.test.mjs \
  packages/runtime/test/vnext-work-turn-reader.test.mjs packages/runtime/test/vnext-template-binding.test.mjs \
  packages/runtime/test/vnext-b-probe-ladder.test.mjs

# B. UTE G1 exactly as CI (rc.5-pinned; do NOT set TEAM_TEST_HOST)
node --test --test-reporter=spec --test-force-exit --test-timeout=1500000 \
  tests/ute-g1-fs/lib/index.test.mjs … (9 files, see .github/workflows/eb3-ci.yml)
# → 89/89

# C/D. next-host lane exactly as CI → 184/184

# E. leg-declared node suites under the selector (14 files, see round110/hostnoderuns/summary.tsv)

# F. bound vitest migration set
node scripts/eb3-security-run.mjs --layer ci-integration \
  --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000

# G. vitest root, one run
node node_modules/vitest/vitest.mjs run
```

Evidence directory: `dev/agent-workflow/evidence/ute-a1/round110/`
(`ute-a1-rc2.log`, `ute-a1-rc5-bundled-timeout.log`, `ute-g1-rc5-argv.log`, `next-host-lane-rc5.log`,
`admission-rc5-afterfix.log`, `harness-rc5-afterfix.log`, `routec-rc5-afterfix.log`,
`vitest-root-rc2.log`, `hostnoderuns/`, `catalog.json`).

## 8. Gate evidence at this head

Filled by the round-110 gate run (`MIGRATED-SUITE-STATUS.md` carries the same numbers):

| gate | result |
| --- | --- |
| `dispatch-tests --run --leg ute-vnext-a1` | **251 / 248 pass / 0 fail / 3 skip**, exit 0, digest `sha256:edd4f1c4…` (unchanged) |
| `test-catalog --max-uncollected 41 --max-excluded 7` | **tests=785, collected=733, uncollected=38, excluded=14, findings=0**, digest `sha256:da8a452d…` (unchanged from round 109) |
| `ute-cut-closure --check` | **pass** `deleted=148 references=3 prodRefs=0 cut=cut(0/148) dupNames=0 retiredSurfaces=12 findings=0` |
| `ute-p0-assets --check` | **pass** `modules=37 files=180 lines=69512 cut(148/148) findings=0` |
| `docs-sync --check` | **pass** `docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20` |
| `place-dist-glue` | **35 placements byte-identical** |
| `eb3-ci-required` | **pass** `workflows=11 findings=0` |
| bound vitest (`ci-integration`, 15 suites) | **PASS 238 / 238**, `clock_ms=30000` |
| `ci-pr-gate --full --census-captures 2` | **PASS 10/10** (293.5 s), census **599f/7424l twice**, identical identity sets |
| UTE G1 argv (9 files) | **89 / 89 / 0 / 0**, exit 0 |
| `EB3-RUN-MANIFEST` | **pass** `records=600 strict=0 incomplete=11 findings=0` |

The first `ci-pr-gate` run at this head was **RED on `blueprint-fence`** (`1 NEW offending path`:
`packages/runtime/test/vnext-admission.test.mjs :: L4721=v5, L7780=v5`) because the ADM-96/97
adaptation shifted the two pre-existing v5 fixture literals by +12 lines. The baseline
(`dev/agent-workflow/evidence/a4-pr7/ci-gate/blueprint-fence-baseline-606a0be7.txt`) was re-recorded
**from the gate's own report** with a dated comment: no blueprint document was authored, edited or
resolved. The re-run is the PASS 10/10 above.

No new scannable test file was added (the three edits are existing files; the evidence is markdown), so
there is no p4t6 booking delta: the catalog is **byte-identical** to round 109
(`tests=785`, digest `sha256:da8a452d65130a3a7f62ef90b549a5289909e689e1ff619c4b3e0c45d5f5ed32`).
