# RC.5 TEST MATRIX — the honest population, measured

Round **110** (2026-11-25). Review `20261125-0058` Stage B, first item: *"rc.5 完整测试矩阵：不仅是四个
D Driver，还包括更广泛的 Vitest、Node Test 群"*.

Branch `vnext/a1-cut`, start head `fc170f929060133b3897cb1f0b769c20a928c893`.
Hosts: rc.2 `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84`
(`0.2.0-rc.2`); rc.5 `tests/deepseek-harness-next` @ `9c2670d3bce5275e0d1610272958121af87787bb`
(`dsh-v0.2.2-rc.5`). One selector: `TEAM_TEST_HOST=next`, authority
`tests/next-host/host-select.mjs`.

> **ROUND 112 (2026-11-25): the only open red in this matrix — the 18 B-ladder arms — is CLOSED.** The
> ladder is host-selectable and measures **18/18 on rc.2 and 18/18 on rc.5** (16 pass + 2 declared
> non-runs each); the rc.5 A/A7 cells in §3 and the §4.2 entry are annotated in place, and the full
> replacement-API reading + the 18-row table are §9. Nothing else in the round-110 measurement moved;
> the remaining rc.5 non-green cells are the rc.2-subject suites in §4.4, which are N/A by pin.

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
| A | `ute-vnext-a1` dispatch leg (selector; 6 non-ladder suites + ladder) | 7 | 251 | **251 / 248 pass / 0 fail / 3 skip** (exit 0) | **251 / 248 pass / 0 fail / 3 skip** (round 112; was 232/18/1 in round 110) | the 18 B-ladder failures are **CLOSED** by the host-selectable world rewrite (§9); the 3 skips are the two declared ladder non-runs + ADM-147 |
| A1 | ├ `vnext-realm-lane` | 1 | 12 | 12/12 | **12/12** | — |
| A2 | ├ `vnext-fs-slice` | 1 | 42 | 42/42 | **42/42** | SLICE-21/30 were fixed in earlier rounds; this round confirms 36→42 |
| A3 | ├ `vnext-admission` | 1 | 163 | 162/1 skip | **162/1 skip** (0 fail) | ADM-96/97 fixed this round (§5.1) |
| A4 | ├ `vnext-os-probe` | 1 | 3 | 3/3 | **3/3** | — |
| A5 | ├ `vnext-work-turn-reader` | 1 | 7 | 7/7 | **7/7** | — |
| A6 | ├ `vnext-template-binding` | 1 | 6 | 6/6 | **6/6** | — |
| A7 | └ `vnext-b-probe-ladder` | 1 | 18 | 18/18 (16 pass + 2 declared skips) | **18/18 (16 pass + 2 declared skips, 0 fail)** — round 112 | **CLOSED (b)**: rc.5 mounts an executor service + batch dispatch instead of `mode`; the SAME 18 arms run on both hosts (§9) |
| B | UTE G1 exact CI argv (rc.5-pinned; 9 files) | 9 | 89 | N/A | **89 / 89 / 0 / 0** (exit 0) | rc.2 N/A: files import `NEXT_HOST` directly; the argv must not carry `TEAM_TEST_HOST` (double selection) |
| C | next-host/settlement/closure lane exactly as CI (11 files) | 11 | 184 | N/A | **184 / 184 / 0 / 0** | rc.2 N/A (pinned rc.5 + pure script tests) |
| C1 | └ `tests/next-host` (boot 2, native-api 4, provisioning-controls 13) — **included in C** | 3 | 19 | N/A | **19 / 19** | rc.2 N/A: provisioning is rc.5-only |
| E | leg-declared `node:test` suites under the selector | 14 | 235 | green in the `ci-integration` leg (rc.2 lane) | **232 pass / 3 fail / 0 skip** | the 3 failures are rc.2-subject suites (§4 items 5–6) |
| F | vitest bound migration set (`ci-integration`, 15 suites) | 15 | 238 | **238 / 238** | **N/A** | runner-limited: Vite resolves the repo install, not the selector (§4.3); 14 of 15 are host-free anyway |
| G | vitest root population (one run) | 599 | 7424 | **7424 / 7424 pass** (599 files) | **N/A** | host-free by construction (678/771 files); the 40 host-importing vitest suites are §4.3 |
| H | uncollected `node:test` files (catalog ratchet) | 38 | — | governed by the 38-uncollected baseline | **not counted** | outside the executed population; §4.4 |

Executed rc.5 tests: **A+B+C+D+E = 759 tests, 753 pass, 3 fail, 3 skip** (round 112; round 110 measured 737/21/1). The 3
remaining failures are the rc.2-subject suites in §4.4/E, not the ladder. Every one of the 3 failures
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

### 4.2 The B Ladder — **CLOSED in round 112** (was red in round 110; the diagnosis below is the historical record)

| # | suite / arms | rc.5 result | diagnosis (file:line) | why it is not fixed this round |
| --- | --- | --- | --- | --- |
| 4 | `vnext-b-probe-ladder` — all 18 `ARMS` fail in the `before` hook — **CLOSED round 112: 18/18 on both hosts** | `TypeError [ValidationError]: invalid config: - $.mode expected nullable but got both (at mode)` — deterministic, ~505 ms | `vnext-b-probe-ladder.test.mjs:273` mounts `ToolRuntime` with `{ mode: 'both', ptc: {} }`; rc.5 `packages/core/tools/lib/index.js:407` declares `mode: z.never()` ("Removed. Mount a native or PTC tool executor instead."). The hook rejects before any arm runs, so all 18 are red, not 18 independent findings | The adaptation is a **rewrite of the world**, not a config rename: rc.5 selects an executor service (`NativeToolExecutor` / `PtcExecutor`, one per scope — `tools.setExecutor` refuses a second), dispatch is a batch (`{calls:[{type:'tool-call',…}], signal, agent}`), and the `run_code` identity/retention arms (ADM-63/69/76/79/80) rely on rc.2's registry `Transport`, which rc.5 moved into `PtcExecutor.requirePtcTransport()`. That is its own arm design, not a drive-by edit; doing it in this round would have been an unreviewed rewrite of 18 judged arms. **Round 112 did that rewrite: §9.** |

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
| 5 | 40 vitest suites that load host code at runtime (26 `packages/client/test/*.client.spec.tsx` via `@deepseek-ai/dsh-client-test-runtime`, 14 `packages/runtime/test/*` via `dsh-tools`/`dsh-scope`/`dsh-system-prompt`/`dsh-mcp`/`cordis`) | rc.2: PASS inside the 599-file / 7424-test root run | Vite resolves `@deepseek-ai/*` from the repo install **before** Node's ESM loader runs. Measured: with `TEAM_TEST_HOST=next NODE_OPTIONS=--import=tests/next-host/host-loader.mjs`, a probe suite still imported `@deepseek-ai/dsh-scope/package.json` version **`0.2.0-rc.2`**. A `resolve.alias` in `vitest.config.ts` would make the matrix greener but would be a **second host-selection mechanism** (explicitly forbidden), and it would move the whole root population. So these 40 are **rc.2-only by mechanism**, and are *not* counted as rc.5 coverage; the 590 host-free vitest files are graded once, on either host. **Round 116 ran the bounded probe that this row asked for: ENV-LIMITED, layer = the Vite module runner — the one selector is correct (plain-Node control resolves rc.5) but Vite resolves before Node's loader, so `NODE_OPTIONS=--import` and `server.deps.inline` are both inert; a Vite-side redirect works but is a second selection mechanism and is refused. See §10 and `round116/VITEST-HOST-PROBE.md`.** |

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

**None.** The three code changes are test-observation adaptations (§4.1). **Round 112 adds a fourth
observation adaptation and still zero product changes** (§9): the ladder's world is host-selectable, the
18 arms are byte-identical in what they assert, and no file under `packages/*/src` was touched (the only
`packages/` edit remains `packages/runtime/test/vnext-b-probe-ladder.test.mjs`). CORE PATCH BUDGET is
still 0; `git -C tests/deepseek-harness-next status --porcelain` and the same command on
`tests/deepseek-harness-test-use` are empty (the harness guard verifies both pins on every boot). No file under `packages/`
product source (`packages/*/src`) was touched; the only `packages/` edit is a test file
(`packages/runtime/test/vnext-admission.test.mjs`), and no assertion was weakened. CORE PATCH BUDGET
stays 0; `tests/deepseek-harness-next` and `tests/deepseek-harness-test-use` are unmodified
(`git -C … status --porcelain` empty for both, verified by the harness guard on every boot).

## 6. What is NOT covered (stated plainly)

1. ~~**18 B-ladder arms** (rc.5) — red, §4.2.~~ **CLOSED in round 112: 18/18 on both hosts (§9).**
2. **40 host-importing vitest suites** (rc.5) — runner-limited, §4.3. Round 116 probed the two candidate
   one-mechanism paths and both failed: `NODE_OPTIONS=--import` (the SAME loader every `node:test` leg and
   live boot uses) is **not consulted** by Vite, and `server.deps.inline` is inert for resolution (measured:
   the modules stay `0.2.0-rc.2`). A Vite alias/plugin derived from the selector's own mapping **would** work
   (measured: `0.2.2-rc.5`) but is a **second host-selection mechanism** and is refused. This block therefore
   stays open as **ENV-LIMITED at the Vite layer** (§10), not as a green cell: closing it needs a
   runner/host capability (Vite delegating bare-specifier resolution to the registered Node loader, or a
   host-published Vite plugin parameterised by the selected tree), or an owner ruling that these 26 client +
   14 runtime suites are host-version-agnostic by contract.
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

**The block below is the round-110 run and is kept as history; the round-112 (current) block is §9.5.**
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

---

## 9. ROUND 112 — the B ladder closes on rc.5 (the 18 rows)

Round 110 recorded the ladder as **red on rc.5 for a structural reason** and deferred the rewrite. This
round performs it. The ladder is now **host-SELECTABLE, not host-doubled**: one arm set, one expectation
set, two host shapes, and the *same* 18 assertions run against whichever pristine tree
`TEAM_TEST_HOST` selects. No arm was added, deleted, split, skipped or weakened, and **no product file
changed**.

### 9.1 The rc.5 replacement API (read from the rc.5 pin, file:line)

| what rc.2 had | rc.5 (0.2.2-rc.5 @ `9c2670d3bc`) |
| --- | --- |
| `ToolRuntime`'s config carried `mode: 'native' \| 'both'` (+ `ptc`, `maxParallelSubCalls`) — `tests/deepseek-harness-test-use/packages/core/tools/lib/index.js:2666-2671` | `mode: z.never().description("Removed. Mount a native or PTC tool executor instead.")`, `maxParallelSubCalls: z.never().description("Moved to the PTC tool executor configuration.")` — `tests/deepseek-harness-next/packages/core/tools/lib/index.js:406-409` |
| dispatch lived in the registry; `tools.execute({callId,name,arguments,agent,signal})` ran one call | `tools.execute(input)` **delegates to a per-scope EXECUTOR**: `this.selectExecutor(input.agent).execute(input)` — `…/core/tools/lib/index.js:641-643`; selection is `selectExecutor` (`:624-635`), registration is `setExecutor` (`:577-620`, **one executor per scope**, `:590`) |
| `run_code` was registered by the registry as its reserved transport | the transport is the PTC executor's own object: `PtcExecutor.requirePtcTransport()` — `…/core/tool-executor-ptc/lib/index.js:1867-1870`; it is deliberately kept outside registered capabilities/restrictions (`:1823-1836`), and the PTC pipeline rejects direct non-`run_code` calls (`:1817-1820`) |
| one call in, one settled result out | a **BATCH** in (`{calls:[{type:'tool-call', id, name, arguments:<JSON string>}], signal, agent}`), per-call results out (`batch.results[].result`); `callId` is `block.id` — `…/core/tools/lib/pipeline.js:28-52`, pre-execute/guards at `:384-404` |
| native dispatch was the registry's default | the native executor is a PLUGIN PACKAGE exporting `{name, inject, apply}` — `…/core/tool-executor-native/lib/index.js:20-31`; the PTC executor likewise (`…/tool-executor-ptc/lib/index.js:1885-1888`), config `maxSubCallsPerMinute`/`maxParallelSubCalls` (`:1678-1683`) |

The mount mistake round 110 already paid for is not repeated: both executors are mounted as the exported
**plugin object**, never the bare class (mounting the class skips `inject`, and the pipeline then cannot
see `tools` — `tool-executor-native/lib/index.js:10` ← `pipeline.js:258`).

### 9.2 How the world mounts on each host

The ladder's world code resolves the shape through the **existing** selector/tree
(`tests/next-host/host-select.mjs` → `testHostMode`, `resolveSelectedHostModule`, `selectedHostPin`;
`loadFsContractSeams` already exposes `NativeToolExecutor` for `next`). Revealed by
`packages/runtime/test/vnext-b-probe-ladder.test.mjs`:

| piece | rc.2 | rc.5 |
| --- | --- | --- |
| host module resolution | `createRequire(packages/runtime)` + the pnpm virtual store (unchanged, byte-for-byte) | `resolveSelectedHostModule(spec, REPO_ROOT, 'next')` — every `@deepseek-ai/*` entry resolves INSIDE `tests/deepseek-harness-next` (mixing the repo's rc.2 install is the round-110 duplicate-instance hazard) |
| runtime | `root.plugin(ToolRuntime, {mode:'both', ptc:{}})` for the PTC world, `{mode:'native'}` for the shipped world | `root.plugin(ToolRuntime)` (no config) and the PRESENTATION is the executor: `PtcExecutor` at the deployment scope for the PTC world, `NativeToolExecutor` for the shipped world |
| native calls + the retained PTC entry in ONE world | `mode:'both'` gave both in one registry | one executor per scope, so the world composes them where the host allows: PTC executor at the DEPLOYMENT scope (the retained entry), `NativeToolExecutor` in a member-NESTED scope. Guards chain over ancestors and `tools/pre-execute` is dispatched over the scope chain, so every call is still judged by the ONE centre on the member scope |
| dispatch | `executeToolDispatch(..., {hostMode:'legacy'})` — the existing single-call shape | `executeToolDispatch(..., {hostMode:'next'})` — the existing batch shape (`a5sf-fs-contract-world.mjs:283-303`, re-used, not re-invented) |
| `run_code` resolution | `tools.get('run_code', scope)` (registry transport) | `tools.selectExecutor(scope).requirePtcTransport()` for the PTC presentation; `undefined` when the selected executor is native (the shipped presentation) |
| `workingDirectory` | not mounted (rc.2 has no such inject) | `provideWorkingDirectoryDouble(root, dir)` — rc.5 `tool-fs`/`tool-fs-search`/`tool-bash-persistent` statically inject it (`…/fs/tool-fs/lib/index.js:2003-2007`); without it Cordis defers the module and NO tool registers (a harness absence, not a refusal) |

### 9.3 The 18 rows (same arms, same assertions, both hosts)

Measured at this HEAD with the leg's own flag (`A5SF_REQUIRE_PINNED_HOST=1`), one run per host.
`✔` = PASS, `﹣` = the arm's OWN declared non-run (a skip that reports a machine-readable line; never a
pass).

| # | arm | what it proves | rc.2 | rc.5 |
| --- | --- | --- | --- | --- |
| 1 | `ADM-63` | every rung resolves the HOST module's own body (definition identity + `run_code` is one transport object) | ✔ | ✔ |
| 2 | `ADM-64` | READ positive: admitted, body runs on the member provider, fact allow, settlement `COMPLETED` | ✔ | ✔ |
| 3 | `ADM-65` | WRITE positive: admitted, bytes land, `COMPLETED` | ✔ | ✔ |
| 4 | `ADM-66` | GREP positive: admitted, runs on the confined face, `COMPLETED` (ENV-BLOCK with its probe on a host that cannot prove network-deny) | ✔ | ✔ |
| 5 | `ADM-67` | WEB_FETCH positive: admitted, one transport call, loopback body, `COMPLETED` | ✔ | ✔ |
| 6 | `ADM-68` | BASH positive: **NOT RUN** — the compiled answer declares no execution authorization (declared skip + machine line) | ﹣ | ﹣ |
| 7 | `ADM-69` | RUN_CODE positive: **NOT APPLICABLE — PRODUCT UNSUPPORTED** (ruled; declared skip + marker line) | ﹣ | ﹣ |
| 8 | `ADM-70` | ORDER (positive): durable facts re-read from disk in ladder order | ✔ | ✔ |
| 9 | `ADM-71` | READ negative: `LANE_DENY` before the body, zero provider calls, `REFUSED`/`not-started` | ✔ | ✔ |
| 10 | `ADM-72` | WRITE negative: `LANE_DENY`, file never created, zero provider calls | ✔ | ✔ |
| 11 | `ADM-73` | GREP negative: `LANE_DENY`, zero confined spawns | ✔ | ✔ |
| 12 | `ADM-74` | WEB_FETCH negative: `NETWORK_DENY`, zero transport calls | ✔ | ✔ |
| 13 | `ADM-75` | BASH negative: `ADMISSION_EXECUTION_UNAUTHORIZED`, zero spawns, zero confines | ✔ | ✔ |
| 14 | `ADM-76` | RUN_CODE negative: `ADMISSION_PTC_UNAVAILABLE` + ruling status, zero worker, `REFUSED`/`not-started` | ✔ | ✔ |
| 15 | `ADM-77` | ORDER (negative): six durable refusals in ladder order, one execution fact each | ✔ | ✔ |
| 16 | `ADM-78` | the binding is the COMPILED answer; absent axes stay absent (no second policy) | ✔ | ✔ |
| 17 | `ADM-79` | `run_code` absent from the shipped OFFERED set; the retained entry is a TYPED refusal with zero worker (both presentations) | ✔ | ✔ |
| 18 | `ADM-80` | the not-applicable marker is REPORTED (never a silent skip); the ruled arm list is CLOSED | ✔ | ✔ |

**rc.2: 18 / 16 pass / 0 fail / 2 declared skips.** **rc.5: 18 / 16 pass / 0 fail / 2 declared skips.**
Identical shape; the two skips are the same two arms for the same reasons on both hosts.

### 9.4 What could NOT hold, and why nothing was weakened

Nothing. Every one of the 18 assertions holds on both hosts with its original text. The only rc.5
difference is **where** the world mounts each piece (executor service, nested native scope, batch
dispatch, `workingDirectory`, transport lookup) — observation, not expectation. Ledger rows, refusal
codes, settlement states, worker/spawn/confine counters and ORDER are asserted unchanged.

Two properties this round did **not** get for free, recorded so a reader cannot mistake them:

- **`mode` was not replaced by a shim.** No `mode` polyfill, no `ToolRuntime` wrapper, no widened
  timeout, no retry, no skipped arm. rc.5's `ToolRuntime` is mounted with NO config at all; the
  oracle of dispatch is the host's executor.
- **The PTC retained entry is a separate executor scope, not a registry row.** That is the rc.5
  contract (`setExecutor`, one per scope); the arms that assert its identity (`ADM-63`) and its
  typed refusal through the real entry (`ADM-76`, `ADM-79`) pass by resolving the SAME
  `requirePtcTransport()` object the executor owns.

### 9.5 Evidence

`dev/agent-workflow/evidence/ute-a1/round112/`: `ladder-rc2.log`, `ladder-rc5.log`,
`dispatch-ute-vnext-a1-rc{2,5}.log` (precommit) and `*-postcommit.log` for every gate below, plus
`README.md`. Logs are plain captures; the verdict lines below are the machine-readable ones.

| gate (round 112, postcommit at `9bfa5053d` unless noted) | result |
| --- | --- |
| `dispatch-tests --run --leg ute-vnext-a1` | **rc.2 251/248/0/3 and rc.5 251/248/0/3**, `set=sha256:edd4f1c4…` both |
| `test-catalog --max-uncollected 41 --max-excluded 7` | `tests=785 collected=733 uncollected=38 excluded=14 refused=0 findings=0`, digest `sha256:da8a452d…` unchanged (booking delta **0**: no new scannable file) |
| `ute-cut-closure --check` | `pass deleted=148 references=3 prodRefs=0 cut=cut(0/148) findings=0` |
| `ute-p0-assets --check` | `pass modules=37 files=180 lines=69512 cut(148/148) findings=0` |
| `docs-sync --check` | `docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20` |
| `place-dist-glue` | `35 placement(s)` byte-identical |
| `eb3-ci-required` | `pass workflows=11 findings=0` |
| bound vitest (`ci-integration`, 15 migrated suites) | `EB3-LAYER … verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0 clock_ms=30000` |
| UTE G1 exact CI argv (9 files) | `tests 89 / pass 89 / fail 0`, exit 0 |
| `EB3-RUN-MANIFEST` | `pass records=602 strict=0 incomplete=11 findings=0` |
| `ci-pr-gate --full --census-captures 2` | `DSH-CI-VERDICT pass pass=10 fail=0 skip=0 legs=10` in **293.7 s**; census `599f/7424l` twice, identical identity sets |
| `pr-settlement-gate --pr 822` | `DSH-SETTLEMENT-VERDICT PASS marker=none matches=1 candidates=51` (after the dated comment for the settled head) |

The precommit `ci-pr-gate` was also PASS 10/10 (287.5 s) on the same tree; both runs' logs are in the
directory.

---

## 10. ROUND 116 — the vitest population probe: **ENV-LIMITED at the Vite layer** (0 of 40 counted)

Round 116 asked the §6/§4.3 question as an experiment instead of an assumption: *can the 40 vitest suites that
value-import `@deepseek-ai/*` be graded on rc.5 through the SAME one selector, without a second mechanism?*
Bounded: one throwaway probe + **5 representative suites** (2 client, 3 runtime), each run under rc.2 and under
`TEAM_TEST_HOST=next` + the same Node host loader. Full write-up: `round116/VITEST-HOST-PROBE.md`; raw logs in
`round116/probe-*.log` and `round116/suites-*.log`.

### 10.1 The measurement (versions are the probe's own output)

| # | setup | resolved `@deepseek-ai/*` | log |
| --- | --- | --- | --- |
| A | no env (baseline) | `0.2.0-rc.2` | `round116/probe-a-baseline-rc2.log` |
| B | `TEAM_TEST_HOST=next` + `NODE_OPTIONS=--import=…/host-loader.mjs` | **`0.2.0-rc.2`** | `round116/probe-b-rc5-node-loader.log` |
| B2 | same loader, **plain Node** import (control) | `0.2.2-rc.5` | `round116/probe-b2-plain-node-loader.log` |
| D | `server.deps.inline` + the same loader | **`0.2.0-rc.2`** | `round116/probe-d-rc5-inline-node-loader.log` |
| C | Vite `resolveId` redirect derived from `resolveSelectedHostModule` | `0.2.2-rc.5` | `round116/probe-c-rc5-vite-redirect.log` |

B2 is the load-bearing control: the selector and the loader are **correct and active**. B/D fail because Vite
resolves bare specifiers itself before Node's ESM loader is asked; the hook in `scripts/run-tests-hooks.mjs:68`
matches only bare `@deepseek-ai/*` specifiers and has no absolute-path rule. `--import` is load-bearing for
every `node:test` leg and live boot, and inert inside the Vite graph.

### 10.2 The representative suites are green — on rc.2 modules, so NOT coverage

| suites | rc.2 baseline | rc.5-selected + loader | reading |
| --- | --- | --- | --- |
| 3 runtime (`f15-mcp-live-loss`, `a5sf-service-install`, `mcp-blueprint-initial-grant`) | 62 / 62 pass | 62 / 62 pass | the modules imported were still rc.2 (probe B) |
| 2 client (`team-dock`, `team-members`) — package `vitest.config.ts` | 24 / 24 pass | 24 / 24 pass | same; the client config's own plugin redirects to the rc.2 **source** tree (`packages/client/vitest.config.ts:18-27,146-150`) |

The identical green is a **false green** if quoted as rc.5: it grades the legacy host inside an rc.5-selected
process. **0 of the 40 are counted as rc.5 coverage**; the population cell stays N/A.

### 10.3 The refusal, stated exactly

- `resolve.alias` / a Vite plugin derived from the selector's mapping **would work** (probe C). It is refused:
  it is a **second host-selection mechanism** in a different resolver, duplicating the decision (and its
  containment/subpath rules) into Vite, and it would move the whole root population.
- `server.deps.inline` changes *who transforms*, not *who resolves* (probe D) — inert.
- Extending the loader with an absolute-path `load` hook would still be a second path→tree mapping and would
  not reach the client package, whose `resolveId` plugin short-circuits first.

**Blocker to name to the host:** Vite/Vitest 8.2.2 / 4.1.11 expose no seam that delegates a bare-specifier
resolution to the registered Node loader; the host would need to publish a Vite-side resolution plugin
parameterised by the selected tree (a host capability the selector merely points at), or a runner option that
lets `--import` hooks own bare-specifier resolution. No timeout, retry, skip or assertion was touched by this
probe, and the probe lived only in gitignored `.scratch/` (the tree adds no test file; see §11 booking delta).

### 10.4 Gate block at this head

Round 116 gates are recorded in `round116/README.md` and `round116/` logs; the candidate report §5.5 carries
the same verdict lines.
