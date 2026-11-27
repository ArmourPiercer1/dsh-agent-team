# ROUND 122 — the ONE product tool-dispatch entry: host-declared shape, and a typed refusal for the wrong shape

Round 122 (2026-11-26). Branch `vnext/a1-cut`, start head `08e0201cc`, feature commit `507623eef`.
Two deliverables, both requested by the owner's review of round 121:

- **A.** `executeTool` (`packages/runtime/src/plugin/vnext/agent-bindings.mjs`) emitted the rc.2
  single-call shape while rc.5's public dispatch is the batch `selectExecutor(agent).execute({calls…})`.
  Trace every caller, decide reachability, and either ROUTE it through round 121's capability-detected
  seam or REFUSE it typed — plus controls, and either way new arms.
- **B.** The three remaining client test reds: establish mechanically whether they are pre-existing on
  the A0 base, and either fix them (branch-caused) or disclose them with their exact red commit
  (pre-existing), never deleting or skipping.

Everything below is measured in this worktree. No version string is read anywhere in the product or in
the tests; no upstream file is patched (`CORE PATCH BUDGET = 0`).

---

## A. The call graph of `executeTool` — and why the answer is ROUTE, not refuse

`executeTool` is defined at `packages/runtime/src/plugin/vnext/agent-bindings.mjs:4086` (pre-round-122:
`:4058`) and returned on the live object at `:4322` as `live.executeTool`. **Every caller in the tree:**

| # | caller | file:line | on rc.5? | kind |
| --- | --- | --- | --- | --- |
| 1 | harness HTTP route `POST /__p6t6/tool` | `packages/tools/harness/plugin.mjs:377` (`teamRoot.live.executeTool(as, {name, args, callId})`) | **YES** — this row is mounted by the next-host compositions (`tests/homes/*-next/profiles/web/cordis.patch.yml` → `packages/tools/harness/plugin.mjs`) | the only in-repo production-ish caller |
| 2 | the kits that POST that route | `tests/kits/**` (12 call sites: mcp-initial-grant-smoke:395, joint-acceptance:1494, pr-e:630, pr-c:408, rc2-real-host-smoke:380, pr-f:622, a1-bash-governance:1493, a6-cold-wake-nudge:1579, model-preference-routing-smoke:788, wp2:780, a6-cold-wake:1487, f15:390) | they reach the route, so the shape question is the same | harness only |
| 3 | `tcm-d4-root-context.test.ts` | `packages/runtime/test/tcm-d4-root-context.test.ts:241` (`world.binding.executeTool(N, …)`), asserted at `:362` | host-free; NOT in the 44-file host-coupled population | collected suite |
| 4 | archived evidence arms | `dev/agent-workflow/evidence/a5sf-archived-gate/{row6-rejudge:113, archive-race-arms:168}.test.mjs`, `dev/agent-workflow/evidence/a5sf-boot-seam/boot-seam-arms.test.mjs:195` | tracked evidence; **not collected by any leg** and not executable here (see §G) | archived evidence |
| 5 | this round's new controls | `packages/runtime/test/vnext-tool-dispatch-shape.test.ts` | host-free | new |

The shipped product (`packages/runtime/src/plugin/vnext/root.ts`) exposes **no** route that calls it —
`grep -rn executeTool packages/*/src` finds only type declarations (`plugin/types.ts:1475`,
`plugin/types.ts:1275`) and prose. But row 1 decides the question: the harness row IS mounted on rc.5
homes, so the entry **is reachable on rc.5** and a refusal would be a product regression dressed as a
contract. **Disposition: ROUTE through the seam.** (Had the only callers been rows 3–5, the round's
instruction was to refuse typed; that is not the measured situation.)

## B. What changed

1. **`agent-bindings.mjs` — `executeTool` delegates instead of open-coding a shape.** Order is
   load-bearing and asserted: `assertSingleCallDispatchShape(request)` runs **first**, before
   `ensureLiveAgent`, so a wrong shape is refused even when the session has no live agent; then the
   unchanged live-agent/boundary/late-admission logic; then
   `dispatchGovernedToolCall(handle.agent.ctx.tools, {callId, name, arguments, agent, signal})`.
   Seam refusals are re-raised with their own `A5SF_*` code (`toolRouteError`), not flattened into
   `TOOLS_EXECUTE`.
2. **`tool-executor-mount.mjs` — the shape is validated, not coerced.** New
   `TOOL_DISPATCH_SHAPE_UNSUPPORTED = 'A5SF_TOOL_DISPATCH_SHAPE_UNSUPPORTED'` and
   `assertSingleCallDispatchShape(call)`: a `call` that is not an object, carries `calls`, or has no
   non-empty string `name` is refused with a message naming the expected
   `{ callId, name, arguments, agent, signal }`. Called at the top of `dispatchGovernedToolCall`. The
   module doc now lists all four typed refusals in one table. `.d.mts` declares both new exports.
3. **`packages/tools/harness/plugin.mjs` — the route maps the codes.** Every `A5SF_*` code gets an
   explicit response (400 for the shape refusal, 500 otherwise) with `{error, code}`; previously a seam
   refusal fell into the generic 500 and was indistinguishable from a tool fault.
4. **`packages/runtime/test/t12a-live-bridge.mjs` — the tools double declares its contract.** It
   dispatches one call per `execute`, i.e. rc.2 registry dispatch, so it now carries
   `defaultMode: 'native'` (capability declaration only; recorded shape and return value unchanged). A
   service that dispatches must say which contract it implements — otherwise the seam refuses by name.

**How the host's shape is chosen (unchanged from round 121, restated because it is the whole point):**
`hostToolDispatchShape(tools)` probes the LIVE object for `setExecutor` (rc.5 executor mount) versus
`modeFor`/`defaultMode` (rc.2 registry). rc.5 ⇒ one batch
`{calls:[{type:'tool-call', id: callId, name, arguments: JSON.stringify(args)}], signal, agent}` and the
settlement is `batch.results[0].result` (missing ⇒ `A5SF_TOOL_EXECUTOR_RESULT_MISSING`). rc.2 ⇒ one
`{signal, callId, name, arguments, agent}`. Neither ⇒ `A5SF_TOOL_EXECUTOR_CAPABILITY_MISSING`. rc.5
without a selected executor ⇒ `A5SF_TOOL_EXECUTOR_UNAVAILABLE`.

## C. Controls — positive, negative, and the rc.2 arm, all falsifiable

New suite `packages/runtime/test/vnext-tool-dispatch-shape.test.ts` (host-free, 5 arms, one live world):

| arm | assertion | why it is falsifiable |
| --- | --- | --- |
| A (rc.2 positive) | a service declaring `defaultMode` receives `{callId, name, arguments, agent, signal}` with **no** `calls`, and its own settlement is returned unchanged | the round-122 mutation that keeps the seam but stops unwrapping/reshaping re-reds it |
| B (rc.5 positive) | a service declaring `setExecutor` + a selection receives the **batch**, `arguments` is the JSON **string**, `agent` is the live agent object, `signal` is an `AbortSignal`, and the binder returns `results[0].result` | reverting the binder to the old dispatch call re-reds it (measured) |
| C (negative, ORDER) | passing `{calls:[…]}` to the one-call entry rejects `A5SF_TOOL_DISPATCH_SHAPE_UNSUPPORTED` **on a session with no live agent** (so the code proves the gate precedes `ensureLiveAgent`), the refusal names `SINGLE-CALL`, and zero calls were dispatched | removing `assertSingleCallDispatchShape` re-reds it (measured) |
| D (negative) | rc.5 capability with no selected executor ⇒ `A5SF_TOOL_EXECUTOR_UNAVAILABLE`, zero dispatches (not a generic `TOOLS_EXECUTE`) | reverting the binder re-reds it (measured) |
| E (negative) | a service declaring NEITHER contract (the rc.2 property **removed**, not set to `undefined`) ⇒ `A5SF_TOOL_EXECUTOR_CAPABILITY_MISSING`, zero dispatches | reverting the binder re-reds it (measured) |

**Real-host arm.** `a5sf-bl16-grep-realm.test.ts` **C5** (new): on the pinned host, the same rc.5 batch
handed to `dispatchGovernedToolCall` is refused `A5SF_TOOL_DISPATCH_SHAPE_UNSUPPORTED`, the message names
the expected shape, the spawn count does not move, the centre records **zero** admission facts, and the
realm sink records nothing. **14/14 on rc.2 and 14/14 on rc.5.**

**Mutation transcript (both directions measured, then reverted):**

| mutation | result |
| --- | --- |
| restore the round-121 binder call (`tools.execute({callId, name, …})` instead of the seam) | A ✓, **B ×**, C ✓, **D ×**, **E ×** — 3 failed |
| remove the shape gate from `executeTool` | A ✓, B ✓, **C ×**, D ✓, E ✓ — 1 failed |
| (none — the committed tree) | **5/5 green** |

## D. B — the three client reds are PRE-EXISTING on master, measured, disclosed

Full method in `POPULATION.md` §4. Summary of the measurement, in order:

1. HEAD and A0 (`a19d1df01`, detached checkout in this worktree) both give
   `Test Files 2 failed (2)` / `Tests 3 failed | 46 passed (49)` for the same two spec files; the sorted
   failing-id sets are identical (empty `diff`). HEAD repeats it on rc.5 with the guard line naming the
   rc.5 tree.
   Honest disclosure: A0's client config predates the client-side host adapter
   (`git show a19d1df01:packages/client/vitest.config.ts` has no selector), so `TEAM_TEST_HOST=next` is
   **inert at A0**; `a0-client-next.log` is kept and labelled as the inert-selector duplicate, and the
   rc.5 half of the claim is HEAD's guarded run only.
2. In-place bisect (no second worktree): `aa8391ac1` (`dcf661468^`) = 47 passed; **`dcf661468`** reds the
   governance `override reset … pulls once on success` arm; **`4f07e2da9`** reds both creation-panel arms.
   Both are **ancestors of A0**.
3. `git diff --name-status a19d1df01..HEAD` over the two spec files and every product file behind them
   prints nothing — the branch did not touch them.

**Disposition: out of scope, disclosed, left red and collected.** Not skipped, not deleted, not
retried, no timeout widened. The disclosure lives in `CANDIDATE-REPORT.md` §8 item 4 and
`RC5-TEST-MATRIX.md` §11.7.1.

## E. Population (44 host-coupled files, both hosts) — `POPULATION.md` has the per-file table

| population | rc.2 | rc.5 | round 121 |
| --- | --- | --- | --- |
| 26 client suites | 24 files / 343 of 346 | 24 files / 343 of 346 | same |
| 18 runtime+testkit suites | **18 files / 190 of 190** | **18 files / 190 of 190** | 18 / 189 |
| **44 total** | **42 / 533 of 536** | **42 / 533 of 536** | 42 / 532 of 535 |

The population's size and membership did NOT change (the new suite is host-free and is not in this
population). The +1 test is BL-16 C5. Both hosts carry `HOST-VERSION-GUARD ok host=… resolved=… pin=…
tree=…` in the logs.

## F. Gates at this head (raw logs in this directory)

| gate | command | measured |
| --- | --- | --- |
| population rc.2 | `TEAM_TEST_HOST=legacy node node_modules/vitest/vitest.mjs run …` (18 files) | 18/18 files, 190/190, guard rc.2 |
| population rc.5 | `TEAM_TEST_HOST=next …` (18 files) | 18/18 files, 190/190, guard rc.5 |
| client rc.2 | `cd packages/client && TEAM_TEST_HOST=legacy …` (26 files) | 24/26 files, 343 passed / 3 pre-existing reds, guard rc.2 |
| client rc.5 | `cd packages/client && TEAM_TEST_HOST=next …` (26 files) | 24/26 files, 343 passed / 3 pre-existing reds, guard rc.5 |
| dispatch leg | `node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1` | `suites=8 files=8 exit=0`, tests 267 / pass 264 / skipped 3 |
| test catalog | `node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7` | tests=789, collected=737, excluded=14, uncollected=38, exit 0 |
| cut closure | `node scripts/ute-cut-closure.mjs --check` | `cut(0/148) prodRefs=0 distResiduals=0 findings=0` |
| P0 assets | `node scripts/ute-p0-assets.mjs --check` | `modules=37 files=180 lines=69512 cut(148/148) findings=0` |
| docs sync | `node scripts/docs-sync.mjs --check` | `docs=193 … findings=0 blocking=0` |
| dist glue | `node scripts/place-dist-glue.mjs` | `36 placement(s)`, byte-identical (no new module ⇒ count unchanged) |
| EB3 required | `node scripts/eb3-ci-required.mjs` | `pass workflows=11 findings=0` |
| bound vitest | `node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000` | `verdict=PASS suites=15 files=15 passed=238 failed=0 clock_ms=30000` |
| bound vitest, script default clock | same, no `--timeout` | `verdict=FAIL … passed=237 failed=1 clock_ms=20000` (import budget, not an assertion) — the leg's DECLARED argv is `--timeout 30000` (`dev/ci/eb3-ci-manifest.json:509-516`); both runs are kept |
| EB3 run manifest | `node scripts/eb3-run-manifest.mjs` | `pass records=662 strict=0 incomplete=11 findings=0` |
| UTE G1 argv | `node --import ./scripts/run-tests-hooks.mjs --test --test-concurrency=1 <the 9 G1 lane files>` | tests 89 / pass 89 / fail 0; verdicts `UTE-G1-FS-VERDICT GREEN`, `SEARCH … new-path=VERIFIED`, `PROCESS … unit=1/2`, `AGENTCTL RETIRED-BY-A0 rows=42` |
| PR gate | `node scripts/ci-pr-gate.mjs --full --census-captures 2` | `DSH-CI-VERDICT pass pass=10 fail=0 skip=0 refused=0 legs=10 seconds=288.8`; census leg: `verdict=pass … captured 600f/7433l, 600f/7433l vs baseline-declared 626 / 7936; 2 captures, identical identity sets — COUNTS MOVED, SET DID NOT` |

**A ledger delta was booked with its measurement.** Adding a test file to `packages/runtime/test/`
moves the p4t6 scannable-file ledger: the scanner measured **1324** files against a derived **1323**
(`expected 1323 to be 1324`, RED-first, and the census leg reported 7 new reds from the resulting ledger
arithmetic). From a corrupt state it would read as a product regression; from the tree it is this round's
one new file. `packages/testkit/test/p4t6-bookings/round122tooldispatchshape.json` books it 1323 → 1324
with the measurement and the RED log (`census-comparison-RED-prebooking.json` is the pre-booking census
sidecar, kept byte-for-byte). No other ledger or mirror moved: `place-dist-glue` stays at 36 placements
(two EXISTING placements were refreshed byte-identically — `agent-bindings.mjs` and
`tool-executor-mount.mjs`), and `ute-p0-assets` / `ute-cut-closure` counts are unchanged.

## G. What remains open (named, not hidden)

1. **The 3 client reds stay red** (pre-existing; exact commits in §D). Fixing them is a client
   panel/governance task. They are now published in the candidate report, so the aggregate "3 failed"
   can never be read as a green population.
2. **`tests/world-factory/lib/a5sf-fs-contract-world.mjs#executeToolDispatch`** (`:284`) still chooses a
   dispatch shape from `{hostMode}` — a version-keyed helper used by
   `packages/runtime/test/vnext-fs-slice.test.mjs`. It is test infrastructure, not the product entry, and
   it is the next honest candidate for the same treatment. Named; not touched this round (changing it
   would move a leg's world without a product defect to fix).
3. **The three archived evidence arms** that call `binding.executeTool` (`a5sf-archived-gate/*`,
   `a5sf-boot-seam/*`) are tracked but not collected by any leg, and they do not execute in this
   environment (`ERR_MODULE_NOT_FOUND packages/domain/blueprint/src/index.js` — their `.js` specifiers
   need a loader this bare `node --test` invocation does not install; pre-existing, unrelated to this
   round). They were NOT edited. Their shared t12a double now declares its rc.2 contract, which is what
   they need if they are ever revived.
4. **No capability row moves and nothing becomes PRODUCT-PROVEN.** The candidate acceptance gate is a
   VERSION gate and no version is frozen; this round is development evidence at two pinned hosts.
