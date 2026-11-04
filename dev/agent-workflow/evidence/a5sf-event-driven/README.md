# a5sf-event-driven — the THIRD registration shape, measured with the real pinned module

Lane: `task/a5sf-event-driven-20261103`, worktree `.worktrees/a5sf-event-driven`.
Base: `origin/master` = `d0cbef9af2949f88839741efdad758ba75c52743` (#576, "a deferred
registration is judged by what it registers, and a post-settle one invalidates instead
of escaping"). Branch head at the time of writing: see `git rev-parse HEAD` at the
bottom (the evidence is committed at the branch head it describes).

**The shape nothing pinned:** `@deepseek-ai/dsh-tool-subagent` registers its tool from a
`subagent/provider-added` event listener — not from `apply`, and not from a deferred
`ctx.inject` child fiber. `packages/runtime/team-services/src/mount.ts` judged the other
two shapes (apply-time registration; deferred child fiber settling) but had never been
measured against a fiber that is ACTIVE, registers nothing, and whose only registration
happens later in an event handler. This lane measures that shape through the REAL product
entry points (`mountMemberA5sfRealm` → `attachA5sfNativeToolModules`) with the REAL pinned
`@deepseek-ai/dsh-tool-subagent` from the pristine host, fixes the defect the measurement
found, and adds the OPT-IN declaration that makes a composition mismatch fail closed at
assembly.

Host boots = **0**. Ports = **0**. No `DSH_HOME`, no `tests/homes/**` write, no
`tests/deepseek-harness-test-use/**` write: every arm is an in-process Cordis unit root.
CORE PATCH BUDGET = **0** (upstream untouched). Two team-owned files changed:
`packages/runtime/team-services/src/mount.ts` (the seam) and
`packages/runtime/src/plugin/live/a5sf-realm-row.mjs` (the opt-in contract), plus
`tests/world-factory/a5sf-assembly.test.mjs`.
`packages/runtime/src/plugin/live/agent-bindings.mjs` untouched, sha256
`df9b46af67cd903641285760cd72a78e57986e87959b2fbdbaf3f86dd6c6464b` (same value the
a5sf-p0 lane recorded).

## 1. How the shape was measured — `probe-event-driven.mjs`

`probe-event-driven.mjs` is the deliverable probe. It imports the **real pinned**
`tool-subagent` module from the pristine host (`@deepseek-ai/dsh-tool-subagent`, resolved
through `packages/runtime/package.json` → the 0.2.0-rc.2 install) and uses it for BOTH
planes:

- the **preset plane** — a `presetTopology(root, [...])` row that mounts the real module
  on the standing scope exactly like the registry does (this is what the model sees when
  the Member's routed shadow is absent);
- the **managed plane** — the same real module handed to
  `realm.mountNativeToolModules` (inside the routed mount, one router fiber + one module
  fiber).

`TestSubagents` is the smallest faithful `subagents` service: `registerProvider(name)`
runs inside `ctx.effect(...)` (mirroring the pinned service at
`packages/subagent/subagent/lib/index.js:3076-3087`), emits `subagent/provider-added`
and `removed`, and `start()` records and returns `BASE-PROVIDER-RAN:<name>`. A provider
that exists BEFORE the mount is registered before `attach`; one that appears later is
registered after `whenNativeVerificationSettled()`; the probe records whether the
registration threw, whether the provider stayed registered, the realm's
`nativeInvalidation` record, the model-visible surface, the routed partition
(`forwarded`/`observed`), the tool definition identity, and a real dispatch.

Arms (all seven PASS on the fixed tree; `red-event-driven.json/.log` are the same arms on
the base commit):

| arm | configuration | what it pins |
| --- | --- | --- |
| E1 | absent provider, SAME config on both planes (the product shape) | attach accepted; `forwarded=observed=[]`; no deferred child; surface unchanged; `UNKNOWN_TOOL`; no invalidation |
| E2 | absent provider, DIVERGENT config (preset plane serves the name) | **hazard canary**: the preset definition executes with 0 guard facts and the base provider runs — see §4 |
| E3a | provider appears after settle, managed plane only | registration lands → fold + invalidate (`lateRegistrations=["subagent"]`), deny covers, base provider never runs |
| E3b | provider appears after settle, PRODUCT order (preset plane's listener wins the same emission) | the emitter must not throw, the managed registration must land and be folded, deny covers — the RED→GREEN fix |
| E4 | provider present BEFORE mount | module registers synchronously in `apply`; `forwarded=observed=["subagent"]`; routed definition identity-verified; surface neutral; covered dispatch executes |
| E5 | provider removed after a covered mount | `uncovered=["subagent"]`, deny covers, base provider never runs |
| E6 | E2's divergent composition + `expectedTools: ["subagent"]` | the opt-in declaration REFUSES the attach (`A5SF_EXPECTED_TOOLS_UNSHADOWED`, naming the missing tool) instead of silently accepting a zero shadow |

## 2. Measured answers

### (1) Reachability through the routed mount — what the partition contains, whether a settle window is entered, surface, preset reachability

E1 (`E1-absent-provider-same-config`), real module on both planes, provider absent:

```
mounted=true elapsedMs=7 preset=[] after=[]
routings=[{"realm":"ceiling","forwarded":[],"observed":[],"dropped":[],"forwardedSections":[]}]
fibers: [{"name":"a5sf-tool-registration-router","state":0},
         {"name":"tool-subagent","state":0}]        # exactly 2; NO deferred child fiber
dispatch before provider: {"isError":true,"text":"Error: unknown tool \"subagent\"",
                           "info":{"name":"ToolNotFoundError","code":"UNKNOWN_TOOL"}}
providerStarts=0 guardFacts=0 invalidation=null
```

So: the mount IS reachable and the router DOES run the module's `apply`; the module
registers nothing, `observed` and `forwarded` stay empty; the settle window is entered but
has no descendant fiber to wait for (it is a no-op here); the model-visible surface is
unchanged; and the tool is simply **unavailable** (`UNKNOWN_TOOL`), not unguarded. The
preset row of the same real module (same absent provider) also registers nothing — so in
the product composition this shape is an **availability gap**, not an execution leak.

### (2) Absent provider at mount — does anything register anywhere, and is a preset definition executable and unguarded?

Two answers, because they are two compositions:

- **Same config on both planes (the product composition):** nothing registers anywhere.
  E1 above: preset surface empty, managed partition empty, `UNKNOWN_TOOL`. Availability
  only. This is the inventory's §1.1 reading, confirmed by measurement.
- **Divergent config (a preset row with an available provider while the managed native
  module's provider is absent): E2** — the preset-plane definition for the managed NAME
  exists and is executable:

```
mounted=true preset=["subagent"] after=["subagent"]
routings=[{"realm":"ceiling","forwarded":[],"observed":[],"dropped":[]}]
subagentDefinition="preset"
dispatch: {"isError":false,"text":"BASE-PROVIDER-RAN:in-process","info":null}
providerStarts=1 guardFacts=0 invalidation=null
```

That is an unguarded preset execution with ZERO guard facts for a name the composition
declares managed. The seam cannot detect it from inside: an attach that forwards zero
names carries no evidence of which names it *would* have owned (§4). The OPT-IN answer is
`expectedTools` — and **E6** measures it refusing that same composition:

```
mounted=false
error: {"name":"A5sfNativeAssemblyError","code":"A5SF_EXPECTED_TOOLS_UNSHADOWED",
        "message":"... (tool-subagent expected [\"subagent\"] but the attach forwarded []); ...
                    refusing the attach (fail closed)"}
```

### (3) Provider appears after settle — does the registration land, does the realm fold + invalidate, does the deny cover the name?

Pinned in **both listener orders**, because the record's mechanism differs by order:

**E3a / suite `E3-fold` (MANAGED listener first) — the fold path:**

```
invalidation={"reason":"a managed native tool registered after the mount settled: the
  attach accepts no post-settle shadow it did not verify",
  "uncovered":[], "surfaceAdded":["subagent"], "lateRegistrations":["subagent"]}
providerRegistration={"threw":false}   dispatch after: A5SF_NATIVE_SHADOW_INVALIDATED
providerStarts=0 guardFacts=0
```

Verification is still attached when the registration lands (the managed listener runs
first), so the record names the late registration in `lateRegistrations`; the late
definition was live and confined (`uncovered=[]`), it is folded into the receipt, the realm
invalidates, and the admission deny refuses the (now preset) definition. No escape.

**E3b / suite `E3` (PRODUCT order — the PRESET plane's listener runs first in the SAME
synchronous `subagent/provider-added` emission) — this was the defect:**

On the base commit (`red-event-driven.json`, `red-suite-arm.log`):

```
invalidation={"reason":"the Member tool surface changed after the native mount settled",
  "uncovered":[], "surfaceAdded":["subagent"], "lateRegistrations":[]}
providerRegistration={"threw":true,"name":"Error","code":"INACTIVE_EFFECT",
  "message":"cannot create effect on inactive context"}
providerStillRegistered=false   surfaceAfterEvent=[]   dispatch: UNKNOWN_TOOL
```

The preset plane's registration tripped the surface gate, the gate set the record and
**tore the router down inside the same emission**; the managed module's listener for the
SAME event then threw Cordis `INACTIVE_EFFECT` out of `subagents.registerProvider`, the
provider was rolled back, and the name disappeared. Fail-closed in the sense that nothing
executed unguarded — but the attach's own event contract was broken, and the record never
named the managed name (`lateRegistrations=[]`).

**After the fix (`probe-event-driven.json` E3b):**

```
invalidation={"reason":"the Member tool surface changed after the native mount settled",
  "uncovered":[], "surfaceAdded":["subagent"], "lateRegistrations":[]}
providerRegistration={"threw":false}   providerStillRegistered=true
dispatch after: A5SF_NATIVE_SHADOW_INVALIDATED   providerStarts=0 guardFacts=0
```

The emission completes, the managed registration lands on the still-live router, the
admission deny folds it in before the (now visible) preset definition could run, and the
teardown lands one microtask later.

**Mechanism note (do not conflate the two):** in the PRODUCT order the record itself is
produced by the SURFACE gate, not by the fold — the managed name is not in
`lateRegistrations`; it is folded at ADMISSION time (the verification listener is already
detached). In the managed-first order the record itself is produced by the FOLD and names
the name in `lateRegistrations`. Both end in the same refusal; the two orders exercise two
different mechanisms, which is why both are pinned. On the BASE commit the product-order
managed registration was not prevented by the fold at all — it was prevented by the router
already being inactive (`INACTIVE_EFFECT`), with the provider rolled back; same outcome,
different (and worse) mechanism.

### (4) Provider present before mount — synchronous enough to be covered, definition routed/identity-verified?

E4 (`E4-provider-present-before-mount`):

```
routings=[{"realm":"ceiling","forwarded":["subagent"],"observed":["subagent"],
           "dropped":[],"forwardedSections":[]}]
surface before/after: ["subagent"] / ["subagent"]      # neutral
subagentDefinition="routed" (the object the routed fiber registered)
dispatch: {"isError":false,"text":"BASE-PROVIDER-RAN:in-process"}   # covered, confined
providerStarts=1  invalidation=null  fibers ACTIVE
```

The module registers synchronously in `apply`, the router forwards it, the row's
definition-identity check passes (the agent resolves the exact routed object), the surface
is neutral and the covered tool executes. E5 then pins the reverse: removing the provider
after a covered mount invalidates with `uncovered=["subagent"]` and the deny covers it.

## 3. The seam change (3) — RED→GREEN

`packages/runtime/team-services/src/mount.ts` (no other seam file changed):

1. `invalidateNativeShadow` **defers `disposeNative()` by one microtask**
   (`Promise.resolve().then(...)`). The record is still set synchronously FIRST — the P0
   order "refuse first, then dispose" is unchanged — but disposal no longer happens inside
   another fiber's synchronous event emission, so a registration from that same emission
   lands on a LIVE router instead of throwing `INACTIVE_EFFECT`.
2. `foldForwardedRegistrations()` is extracted from the late-registration loop and is also
   called from `admitCoveredTool` while the realm is invalid. Continuous verification is
   detached when the record is set, so admission is the one place that can still see a name
   that landed in the boundary emission; folding it there keeps the deny's coverage current
   for exactly the dispatch that would otherwise fall through to the preset definition.

RED→GREEN arms:

| arm | RED (base commit) | GREEN (fix) |
| --- | --- | --- |
| `tests/world-factory/a5sf-assembly.test.mjs` → `E3 (event-driven 2026-11-03)` | `Error: cannot create effect on inactive context` thrown out of `root.emit(...)` (`red-suite-arm.log`) | emission completes; record names the preset plane's new name; the managed name is folded and refused with `A5SF_NATIVE_SHADOW_INVALIDATED`; neither body serves |
| `probe-event-driven.mjs` E3b | `providerRegistration.threw=true` (`INACTIVE_EFFECT`), `providerStillRegistered=false` (`red-event-driven.log`) | `threw=false`, provider stays registered, dispatch refused (`probe-event-driven.log`) |

`E3-fold` (managed-first) and the seven `a5sf-deferred` arms (A1–A7) pass unchanged; the 14
pre-existing `a5sf-assembly` arms are untouched and green (111/111 a5sf node tests).

## 4. The opt-in declaration — `expectedTools` (2026-11-03)

Optional key on a managed `a5sfNativeToolModules` entry:

```jsonc
"a5sfNativeToolModules": [
  { "url": "@deepseek-ai/dsh-tool-subagent",
    "config": { "provider": "in-process", "toolName": "subagent" },
    "expectedTools": ["subagent"] }        // OPT-IN; omit for today's behaviour
]
```

**What it is:** a statement of which tools the composition BELIEVES that module provides.
**What it grants: NOTHING.** It is not an allowlist, not a second registry, not a second
authority, and it cannot enable a tool, widen a lane, or change a definition. Its only
power is to make a mismatch **fail closed**: when the settle boundary is reached, every
declared name must be `forwarded` by one of that module's routed fibers; otherwise the
whole attach is released and refused with the typed
`A5SF_EXPECTED_TOOLS_UNSHADOWED`, naming the module and the names the attach actually
forwarded. Declared names that ARE forwarded are covered by the admission deny exactly like
observed names (they are in `expectedDefinitions` via the normal attach receipt — a
declaration that is not forwarded is refused, so the two sets coincide by construction).

Validation: non-empty array of non-blank, unique strings; a non-array, an empty array, a
blank/non-string entry or a duplicate is a configuration fault at row assembly (never a
silently ignored declaration).

Measured arms:

| arm | configuration | result |
| --- | --- | --- |
| `EXPECT-1` / probe E4 | declared = the name the module forwards | ACCEPTED; routed definition serves; no invalidation |
| `EXPECT-2` | declared, module forwards nothing (event-driven module, provider never appears) | typed refusal `A5SF_EXPECTED_TOOLS_UNSHADOWED`, names `x_assembly_probe`; no invalidation; surface neutral; preset untouched |
| `EXPECT-3` | **absent** declaration, module forwards nothing | ACCEPTED — today's behaviour, exactly (the merged C3/A7/C1 contracts) |
| probe E6 | E2's divergent composition + declaration (real pinned module) | attach REFUSED, `A5SF_EXPECTED_TOOLS_UNSHADOWED`, message: `tool-subagent expected ["subagent"] but the attach forwarded []` |

Honest boundary of E6: refusing the managed attach does **not** unregister the preset
plane's own definition — that registration belongs to the composition, not to this seam.
The declaration makes the mismatch LOUD at assembly (and `surfaceAtEnd` still shows the
preset name); it is the composition author's job not to ship both planes.

## 5. What is still NOT covered — the stated limit

**An event-driven module cannot be a managed native module unless its provider is resolved
BEFORE the mount.** If the provider is absent at mount time and no `expectedTools` is
declared, the attach is accepted with an empty partition (E1: `observed=[]`,
`forwarded=[]`); nothing enforces the provider-resolution ordering, and the seam fails
closed only AFTER the fact, by invalidating the realm when the name appears (E3a/E3b).
`expectedTools` is the opt-in that turns that into an assembly refusal; it is opt-in
precisely because refusing every zero-registration attach would reverse the merged
C3 (`a5sf-assembly`) and A7 (`a5sf-deferred`) contracts.

**Sharpest reviewer risk — E2.** A composition whose PRESET plane is configured with a
different/available provider than the MANAGED module's provider reproduces the P0 class if
it does not declare `expectedTools`: the preset definition for the managed name executes
with zero guard facts and reaches the base provider (E2: `providerStarts=1`,
`guardFacts=0`, `isError=false`). `E2` is committed as a **hazard canary**
(`kind: "hazard-canary"`): it PASSES when the hazard is reproduced, and is not a green
contract. With the declaration (E6) the same composition is refused at assembly.

Second risk: the deferred-teardown change means a router can outlive the invalidation
record by one microtask. The record is set first and admission folds before it decides, so
no dispatch can be served by an unverified definition in that window — but a reader who
assumes "invalidated ⇒ routers already disposed" is wrong by one microtask, by design.

## 6. Inventory gate-table delta (base mismatch disclosed)

`docs/plans/active/alpha5-sandbox-first/NATIVE-SOURCE-INVENTORY.md` is **not on
`origin/master`** `d0cbef9af`; it exists only on the unmerged p3 lane
(`task/a5sf-p3-inventory-20261103`, `bbba12de0`), where §4 gate row 9 currently reads:

> 事件驱动条件注册（provider 缺失形状）必须被覆盖 | 否：settle 窗口只等已创建的 fiber；provider 缺失时零注册、零 forwarded 名、零身份检查（§1.1/§5.3）

This lane did not duplicate that file (it is p3's artifact; adding it here would conflict).
Ready-to-apply replacement for that row, measured on this tree:

> 事件驱动条件注册（provider 缺失形状）必须被覆盖 |
> **部分覆盖（实测 2026-11-03）**：settle 窗口对"注册在事件回调里"的 fiber 是空转，provider 缺失时
> `observed=forwarded=[]`、attach 被接受、工具不可用（`UNKNOWN_TOOL`）——产品同配置下是可用性缺口，不是执行泄漏；
> provider 在 mount 后出现时注册**会**落地、realm **会** fold + invalidate、admission deny 覆盖该名（E3a/E3-fold，
> managed 先到的顺序把名字记入 `lateRegistrations`）；**mount 与"preset plane 同一同步 emission 内先注册"竞争时，
> base commit 会把 router 在 emission 中途拆掉，导致 managed 注册抛 `INACTIVE_EFFECT` 并由 provider 注册回滚**——
> 本 lane 已在 mount seam 修复（延迟一个 microtask 执行 teardown + admission 时 fold；product 顺序的记录由 surface
> gate 产生，managed 名字在 admission 折叠），RED→GREEN 见 `a5sf-event-driven` 证据。
> **新增可选判据**：`a5sfNativeToolModules[].expectedTools`（本 lane 实现）——声明后若 settle 边界仍有声明名未被
> forwarded，attach 以 `A5SF_EXPECTED_TOOLS_UNSHADOWED` 拒绝（E6）；未声明时保持旧行为。**仍未覆盖**：两 plane 配置
> 不一致且未声明 `expectedTools` 时，preset 定义会以 0 guard facts 执行——采用第二个模块时应在 composition 中声明
> expectedTools（§5.4 item 2），本 lane 未把声明设为强制。

## 7. Gates

All logs in this directory.

| gate | result | log |
| --- | --- | --- |
| `node --test tests/world-factory/a5sf-*.test.mjs` | 111/111 pass | `all-a5sf-node-suites.log` |
| `a5sf-deferred` probe (A1–A7, the merged deferred contract) | 7/7 pass | (re-run, committed evidence untouched) |
| `pnpm vitest run a5sf` | 11 files / 166 tests pass | `vitest-a5sf.log` |
| `pnpm -s typecheck` | EXIT=0 | `typecheck.log` |
| `pnpm -s build` | EXIT=0 | `build.log` |
| `pnpm -s lint` | pre-existing repo-wide debt (129 errors in untouched files); **zero findings in the files this lane touched** | `lint.log` |
| `pnpm ci:local --base origin/master` | `verdict=fail steps=6 failed=1` — one 5000 ms load timeout in `a5p4-lane-hygiene.test.ts` (unrelated lane), passes alone in 668 ms | `ci-local.log`, `ci-local-red-isolation.log` |
| artifacts / eb3 / ci-pr-gate / diff-check | see the committed logs | `check-artifacts-*.log`, `eb3-*.log`, `ci-pr-gate.log`, `diff-check.log` |

## 8. `pnpm ci:local --base origin/master` — verbatim

```
DSH-CI-LOCAL verdict=fail steps=6 failed=1 coverage=determined files=2 wall=229.5s
```

The one failure is NOT in this lane's files and is load-induced:

```
 FAIL  packages/runtime/test/a5p4-lane-hygiene.test.ts > a5p4 lane purity and dormancy > self-typechecks with strict settings (in-process; the shared tsconfig stays untouched)
Error: Test timed out in 5000ms.
...
 Test Files  1 failed | 482 passed (483)
      Tests  1 failed | 5992 passed (5993)
✘ vitest (selected) (216.3s)
```

It ran concurrently with `alpha5-glob-backend-adversarial.test.ts` (215 s, including a
176 s confined-rg race loop) and a 54 s glob suite. In isolation
(`ci-local-red-isolation.log`):

```
 Test Files  1 passed (1)
      Tests  8 passed (8)
 ✓ self-typechecks with strict settings (...)  661ms
EXIT=0
```

Per the lane rule, `verdict=fail` is not a pass: coverage is `determined` for the selected
files and the single failure is a documented, reproduced-in-isolation timeout on an
untouched lane (`a5p4` = team-sandbox files; this lane changed no team-sandbox file, and
`pnpm -s typecheck` is EXIT=0 across the whole repo).

## 9. p4t6 tie — MEASURED LAST on this tree

```
MEASURED p4t6 tie, MEASURED LAST on this tree (all files on disk at run time):
  scanSessionEventVocabulary: filesScanned=1428 files.length=1428
  ledger derived expected=1428 violations=[] loadViolations=[]
  A5SF booking expectedDelta=[{"from":1396,"to":1428}]
```

Exact equality, no tolerance. `packages/**` gained no scannable file (the two source
changes are edits inside existing files; every new file is under `tests/` or
`dev/agent-workflow/`).

## 10. Discipline notes

- **No Host boot** (0 boots, 0 ports), no `tests/homes/**`, no write to
  `tests/deepseek-harness-test-use/**` (read-only pristine host).
- **`node_modules` in this worktree are symlinks to the sibling install** at
  `.worktrees/a5sf-deferred/node_modules` (and each package's
  `packages/*/node_modules`), because the pnpm store is outside the file sandbox. They are
  gitignored; every gate above was run through them. This is disclosed because the
  dependency tree is the 0.2.0-rc.2 install shared with the a5sf-deferred worktree, not a
  fresh install.
- CORE PATCH BUDGET = 0: `mount.ts` and `a5sf-realm-row.mjs` are team-owned, no upstream
  source touched, `agent-bindings.mjs` sha256 unchanged (above).
