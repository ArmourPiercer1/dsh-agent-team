# ROUND 123 — the two round-122 residues: no version-keyed dispatch shape in test infra, and route-level arms for the harness tool route

Round 123 (real UTC `2026-11-25T23:xxZ`). Branch `vnext/a1-cut`, start head `af2b03f20`, feature commit
`fe09d0dba` (the code, the declaration half and the ledger booking). **Scope: exactly the two gaps round 122
disclosed. Nothing else — no product behaviour, no refactor, no widened timeout, no retry, no skipped arm,
no version sniff left in test infrastructure.** PR #822 stays **DRAFT**; `:3080` and its DSH_HOME untouched;
`CORE PATCH BUDGET = 0` (no upstream file read, patched or imported).

All gate logs in this directory were measured at `fe09d0dba` unless a log's own header says otherwise.

---

## Gap 1 — test infrastructure chose a dispatch shape from a version flag

`tests/world-factory/lib/a5sf-fs-contract-world.mjs#executeToolDispatch` (`:284`) took `{ hostMode }` and
emitted `hostMode === 'next' ? batch : single`. Rounds 121/122 established the product rule: the shape is
chosen by the **public capability of the LIVE tools service** —

| the live object exposes | shape |
| --- | --- |
| `typeof tools.setExecutor === 'function'` | rc.5 **executor mount**, one BATCH `{calls:[{type:'tool-call', id, name, arguments: <JSON string>}], signal, agent}`, settlement `batch.results[0].result` |
| `typeof tools.modeFor === 'function'` or `'defaultMode' in tools` | rc.2 **registry dispatch**, one SINGLE CALL `{signal, callId, name, arguments, agent}` |
| neither | **typed refusal** `A5SF_TOOL_EXECUTOR_CAPABILITY_MISSING` (never a guessed shape) |

**What changed.** `hostMode` is DELETED from `executeToolDispatch`. A new exported
`worldToolDispatchShape(tools)` implements the same public-capability rule **independently** of the
product's `hostToolDispatchShape`, and a new `WorldToolDispatchRefusal` carries the product's own code.
The independence is deliberate: importing the product's probe into the World would make the drift control
a tautology.

**The four call sites dropped the flag** (no assertion changed): `vnext-fs-slice.test.mjs` (`:535`, keeps
`onCompletion` only), `vnext-b-probe-ladder.test.mjs` (`:643`), `a5sf-bl16-grep-realm.test.ts` (`:368`),
`a5sf-native-route-c.test.mjs` (`:356`), plus the World's own `open().dispatch` (`:854`).

**The declaration half moved with it.** `tests/world-factory/lib/a5sf-fs-contract-world.d.mts` is the
hand-written `tsc` view of that `.mjs` (the TypeScript population reaches the same one implementation
through it), so it still described `{ hostMode: 'legacy' | 'next' }`. It now declares
`worldToolDispatchShape`, `WORLD_NO_DISPATCH_CONTRACT`, `WorldToolDispatchRefusal` and the
`{ onCompletion }` options bag. **This was caught, not assumed:** the first full-gate run failed its
`typecheck` leg (`exit 2`, `TS2305` on the two new exports and `TS2554` at five call sites) because the
suite typechecked against the stale declaration; the file was fixed and `pnpm -r run typecheck` is green.
The same stale declaration is why a "tests are green" claim alone would have missed it — the runtime
`.mjs` path was already correct.

**New arms (F–I) — `packages/runtime/test/vnext-tool-dispatch-shape.test.ts`** (the round-122 suite, so
the catalog/scannable delta of Gap 1 is ZERO):

| arm | what it proves |
| --- | --- |
| **F** (world, batch) | a service exposing `setExecutor` receives the rc.5 BATCH — `calls[0]` is `{type:'tool-call', id, name, arguments}`, `arguments` is the JSON STRING `{"marker":"batch"}`, `signal`/`agent` are forwarded, and the return value is `results[0].result` |
| **G** (world, single) | a service exposing `modeFor` receives the SINGLE CALL and **no `calls` key** |
| **H** (world, refusal) | a service exposing NEITHER is refused typed with **zero dispatches**, and the code is asserted EQUAL to the product's exported `TOOL_EXECUTOR_CAPABILITY_MISSING` |
| **I** (drift control) | on ONE fake service object both probes must answer the same shape; and on the SAME input both engines must emit the **same dispatched call** and settle on the **same outcome** — across six selector combinations (`setExecutor`, `modeFor`, `defaultMode`, both registry selectors, both contracts at once (rc.5 wins), neither), plus three non-service values |

Suite result: **9/9 pass** (`5 round-122 arms + F–I`).

**Mutation transcript (both executed, then reverted; suite green again afterwards):**

| mutation | result |
| --- | --- |
| W1 — the World can never emit a batch (`if (shape === 'executor-mount-MUTATED')`) | **F red, I red**; 2 failed / 7 passed |
| W2 — the "neither" case falls back to the single call instead of refusing | **H red, I red**; 2 failed / 7 passed |

## Gap 2 — the `/__p6t6/tool` `A5SF_*` → HTTP mapping had no route-level arm

Round 122 added the mapping (400 only for `A5SF_TOOL_DISPATCH_SHAPE_UNSUPPORTED`, 500 for every other
`A5SF_*`) and disclosed that no arm drove the ROUTE. New suite
**`packages/tools/test/p6t6-tool-route-errors.test.ts`** (host-free) drives ONE real `plugin.apply()` over a
scratch `DSH_HOME` with the hostile-seam doubles (`h3-hostile-seam.test.ts` pattern: `makeCtx`,
`makeWebServer`, Buffer-chunk `Req`, recording `Res`, a 5 s handler wall-clock guard) and a
`teamRoot.live.executeTool` that answers per `body.name`. Every arm goes through the same registered
`POST /__p6t6/tool` handler; only the outcome below it changes.

**Status codes observed (measured, not asserted from the source):**

| arm | scenario below the route | observed |
| --- | --- | --- |
| R1 | `A5SF_TOOL_DISPATCH_SHAPE_UNSUPPORTED` | **400**, `body.code` = `A5SF_TOOL_DISPATCH_SHAPE_UNSUPPORTED`, message carried verbatim |
| R2a | `A5SF_TOOL_EXECUTOR_UNAVAILABLE` | **500**, typed code present, not 400 |
| R2b | `A5SF_TOOL_EXECUTOR_RESULT_MISSING` | **500**, typed code present |
| R3a | successful governed call (`isError:false`) | **200**, `{ok:true, value}` — the settlement value is carried through **unchanged** (no rebuild) |
| R3b | governed refusal (`isError:true`) | **200**, `{ok:false, error:{message, info}}` — an `isError` settlement is NOT an HTTP failure |
| R4a (negative) | untyped `Error` (no `code`) | **500**, and **no `code` key** — cannot be presented as a 400 |
| R4b (negative) | non-`A5SF_*` code (`TOOLS_EXECUTE`) | **500**, echoes no `A5SF_*` code |
| R4c (negative) | `A5SF_`-prefixed lookalike (`…_UNSUPPORTED_EXTRA`) | **500** — the 400 is selected by EXACT code equality, never by a widened prefix |

Suite result: **9/9 pass** (1 registration arm + 8 scenario arms).

**Mutation transcript (both executed on `packages/tools/harness/plugin.mjs`, then reverted byte-identically;
`git diff` on the file is empty at the end):**

| mutation | result |
| --- | --- |
| M1 — every `A5SF_*` mapped to 400 | **R2a red, R2b red, R4c red**; 3 failed / 6 passed |
| M2 — the explicit `A5SF_*` branch deleted (generic 500) | **R1 red, R2a red, R2b red, R4c red**; 4 failed / 5 passed |

No product change was needed for Gap 2: the route already maps correctly, which is exactly what the new
arms now hold.

---

## Both hosts, where the suites are host-coupled

Every run prints `HOST-VERSION-GUARD ok host=… resolved=… pin=… tree=…` naming the loaded tree
(`0.2.0-rc.2` / `tests/deepseek-harness-test-use` versus `0.2.2-rc.5` / `tests/deepseek-harness-next`).

| measurement | rc.2 | rc.5 |
| --- | --- | --- |
| population runtime+testkit, 18 files (`vitest-runtime-{legacy,next}.log`) | **18/18 files, 190/190** | **18/18, 190/190** |
| population client, 26 files (`vitest-client-{legacy,next}.log`) | 24/26 files, **343/346** (3 pre-existing reds) | 24/26, **343/346** (same 3) |
| **total, 44 files** | **42/44, 533/536** | **42/44, 533/536** |
| dispatch leg `ute-vnext-a1` (`gate-dispatch-ute-vnext-a1-{legacy,next}.log`) | `suites=8 files=8 exit=0`, tests **267 / pass 264 / fail 0 / skipped 3** | `suites=8 files=8 exit=1`, tests 267 / pass 261 / **fail 4** / skipped 2 — see the disclosure below |
| `a5sf native route C` leg (`gate-native-route-c-{legacy,next}.log`) | **8/8** | **8/8** |

The population's size and membership are unchanged (both new/extended suites are host-free and outside the
44-file population), and the counts are identical to round 122 on both hosts: **42/44 files, 533/536**.

### Disclosed: the rc.5 `ute-vnext-a1` leg has 4 pre-existing reds, measured at the parent head

`TEAM_TEST_HOST=next node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1` reds **4 of 267**:
`ADM-63`, `ADM-69`, `ADM-79`, `ADM-80` in `packages/runtime/test/vnext-b-probe-ladder.test.mjs`. They are
the ladder's PTC/`run_code`-transport identity arms: on this pinned rc.5 tree `PtcExecutor` never reaches
the member scope, so `selectExecutor(scope).requirePtcTransport()` answers `undefined` and the arms'
`notStrictEqual(undefined)` fails. **They are not caused by round 123 and are not on the dispatch path**
(they read definitions; no call is dispatched).

Measured control: with the six round-123-touched files checked out at the parent head `af2b03f20`
(`git checkout af2b03f20 -- <files>`), the SAME leg produced the SAME verdict — `tests 267 / pass 261 /
fail 4 / skipped 2`, the same four arm names (`parent-legacy-world-next.log` was written under
`.artifacts/tmp/r123/`, which is scratch and not committed). The files were then restored from HEAD and the
tree was clean. It is published here rather than skipped: no arm was disabled, no timeout widened, no
exclusion added. It does not touch the round's claim (the World's capability-detected dispatch), because
every dispatch-driving arm in that leg — `ADM-64/65/66/67/70/71/72/73/74/75/76/77/78`,
`SLICE-1/2/3/5/6` — passes on rc.5.

## Gates at this head (raw logs in this directory)

| gate | command | measured |
| --- | --- | --- |
| typecheck | `pnpm -r run typecheck` | **green** (after the `.d.mts` fix; the first run was the failure that found it) |
| test catalog | `node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7` | tests=**790** (was 789; +1 new suite), collected=**738**, excluded=14, uncollected=**38**, refused=0 findings=0 |
| cut closure | `node scripts/ute-cut-closure.mjs --check` | `pass … cut(0/148) prodRefs=0 distResiduals=0 findings=0` |
| P0 assets | `node scripts/ute-p0-assets.mjs --check` | `pass modules=37 files=180 lines=69512 cut(148/148) findings=0` |
| docs sync | `node scripts/docs-sync.mjs --check` | `docs=193 … findings=0 blocking=0` |
| dist glue | `node scripts/place-dist-glue.mjs` | `36 placement(s)`, every one byte-identical — **no placement delta** (no new product module) |
| EB3 required | `node scripts/eb3-ci-required.mjs` | `pass workflows=11 findings=0` |
| bound vitest (declared `--timeout 30000`) | `node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000` | `verdict=PASS suites=15 files=15 passed=238 failed=0 clock_ms=30000` |
| EB3 run manifest | `node scripts/eb3-run-manifest.mjs` | `pass records=662 strict=0 incomplete=11 findings=0` |
| UTE G1 argv | `node --import ./scripts/run-tests-hooks.mjs --test --test-concurrency=1 <the 9 declared G1 lane files>` | tests **89 / pass 89 / fail 0**; `FS-VERDICT GREEN`, `SEARCH … new-path=VERIFIED`, `PROCESS … unit=1/2`, `AGENTCTL RETIRED-BY-A0 rows=42` |
| p4t6 ledger | `packages/testkit/test/p4t6-session-event-scan.test.ts` | **20/20** after the booking |
| artifacts at head | `node scripts/check-artifacts-at-head.mjs` | `verdict=ok compared=1951 drift=0` |
| PR gate | `node scripts/ci-pr-gate.mjs --full --census-captures 2` | see `gate-ci-pr-gate.log` (verdict in the settlement comment) |

**Ledger delta, booked with its measurement.** One new scannable file
(`packages/tools/test/p6t6-tool-route-errors.test.ts`) moves the p4t6 scannable-file ledger: with the file on
disk and no booking the scanner measured **1325** against a derived **1324** (`expected 1324 to be 1325`,
RED-first, 6 reds in the ledger's arithmetic). From a corrupt state that would read as a product regression;
from the tree it is this round's one new suite.
`packages/testkit/test/p4t6-bookings/round123toolrouteerrors.json` books 1324 → 1325 with the measurement;
the law stays exact (no tolerance). **No other ledger, mirror or placement moved:** `place-dist-glue` stays
at 36 placements (every one byte-identical), `ute-p0-assets` (modules=37, files=180, lines=69512) and
`ute-cut-closure` (cut(0/148)) are unchanged, and the catalog's only movement is `tests 789 → 790`
(the new suite, collected) with uncollected/excluded unchanged.

## What remains open (named, not hidden)

1. **The 3 client reds stay red** — pre-existing on `master` (`dcf661468`, `4f07e2da9`, both ancestors of
   A0), unchanged in identity and count on both hosts, disclosed in `CANDIDATE-REPORT.md` §8 item 4.
2. **The rc.5 `ute-vnext-a1` leg's 4 PTC/`run_code` reds** — measured pre-existing at `af2b03f20` (above);
   they are the ladder's PTC presentation arms on this pinned rc.5 tree, not a dispatch defect.
3. **The three archived evidence arms** that call `binding.executeTool` remain tracked, collected by no leg
   and non-executable in this environment (pre-existing loader limitation, `ERR_MODULE_NOT_FOUND
   packages/domain/blueprint/src/index.js`); unedited.
4. **No capability row moves and nothing becomes PRODUCT-PROVEN.** The candidate acceptance gate is a
   VERSION gate and no version is frozen; this round is development evidence at two pinned hosts.
