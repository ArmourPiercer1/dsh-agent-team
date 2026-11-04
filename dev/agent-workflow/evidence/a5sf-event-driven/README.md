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

There are two compositions, and from the seam they are **indistinguishable** (measured,
E7 below). Both are handled by the same decidable rule.

**The decidable rule (review C2, 2026-11-03):** a managed entry that carries a `config` is
a CONDITIONAL module — the composition configured the thing its registration depends on.
When such a module forwards NOTHING at the settle boundary, the attach is **refused by
default** with the typed `A5SF_MANAGED_FRONTIER_EMPTY` (the refusal names the module and
both escapes). The row cannot read the preset plane's module config, so it cannot tell
"absent everywhere" from "the preset serves this name on its own provider"; the honest
default is fail closed. Two explicit opt-outs exist, and both are the composition saying
"yes, I know": `expectedTools` (the precise contract, §4) and `allowEmpty: true` (accept an
unverified empty frontier).

- **Same config on both planes (product shape) — E1/`E1-REFUSED`:** refused at assembly.
  With the explicit opt-out (`E1b`) the old state is reproducible and is availability only:

```
mounted=true preset=[] after=[]
routings=[{"realm":"ceiling","forwarded":[],"observed":[],"dropped":[]}]
dispatch: {"isError":true,"info":{"code":"UNKNOWN_TOOL"}} providerStarts=0 guardFacts=0
```

- **Divergent config (preset serves the name, managed provider absent) — E2/`E2-REFUSED`:**
  refused at assembly (no preset definition ever executes). The old hazard is preserved as
  the **canary** `E2b`, which is what the explicit `allowEmpty: true` buys:

```
mounted=true preset=["subagent"] after=["subagent"]
routings=[{"realm":"ceiling","forwarded":[],"observed":[],"dropped":[]}]
subagentDefinition="preset"
dispatch: {"isError":false,"text":"BASE-PROVIDER-RAN:in-process","info":null}
providerStarts=1 guardFacts=0 invalidation=null
```

  An unguarded preset execution with ZERO guard facts for a name the composition declares
  managed. `E2b` PASSES when it reproduces the hazard (`kind: "hazard-canary"`); it is not a
  green contract, it is the documented cost of opting out.
- **Declared (E6):** the same divergent composition with `expectedTools: ["subagent"]` is
  refused with `A5SF_EXPECTED_TOOLS_UNSHADOWED`, naming the mismatch:

```
mounted=false
error: {"name":"A5sfNativeAssemblyError","code":"A5SF_EXPECTED_TOOLS_UNSHADOWED",
        "message":"... (tool-subagent expected [\"subagent\"] but the attach forwarded []); ...
                    refusing the attach (fail closed)"}
```

### (2b) WHY the row cannot decide this by inspection — E7, the undecidability measurement

Two worlds were built with an **identical row input** (same entry, same `config`, same
`allowEmpty: true`; `rowConfigJson` byte-equal, recorded in the JSON) and differ ONLY in the
preset plane's module config — which is not an input of `a5sfRealmConfigOf` /
`attachA5sfNativeToolModules`:

| world | preset plane config | measured outcome with the SAME row input |
| --- | --- | --- |
| `E7a` | provider `ghost` (absent) | surface `[]`, `subagentDefinition="absent"`, dispatch `UNKNOWN_TOOL` |
| `E7b` | provider `in-process` (present) | surface `["subagent"]`, `subagentDefinition="preset"`, dispatch `BASE-PROVIDER-RAN:in-process`, `guardFacts=0` |

`result.undecidability.identicalRowInput = true`. That is why the "config divergence
comparison" the review asked for is not implementable at this seam in this lane: the only
components that see the preset plane's module config are the preset registry and the glue
that mounts it (`agent-bindings.mjs`, frozen here — sha256 in §10), and its public API
(`composedPreset()` returns an id; `compositionInventory()` exposes `moduleName`/`enabled`
but **not** the row config) does not carry it. So the decidable unit is the entry's own
shape (`config` present + empty frontier ⇒ refuse unless opted out), and `allowEmpty: true`
is the explicit statement that the composition has checked the two planes agree.

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

Two forms, same semantics (review C2/C6, 2026-11-03). The OBJECT form needs an object
entry; the TOP-LEVEL MAP exists because a STRING entry — the form most fixtures use — could
not declare at all, and a mitigation reachable only on a form nobody uses is not a
mitigation.

```jsonc
// form 1 — on the object entry
"a5sfNativeToolModules": [
  { "url": "@deepseek-ai/dsh-tool-subagent",
    "config": { "provider": "in-process", "toolName": "subagent" },
    "expectedTools": ["subagent"],   // OPT-IN
    "allowEmpty": false }            // OPT-OUT of the empty-frontier refusal (default false)
]

// form 2 — keyed by module specifier, works for STRING entries too
"a5sfNativeToolModules": ["@deepseek-ai/dsh-tool-subagent"],
"a5sfExpectedTools": { "@deepseek-ai/dsh-tool-subagent": ["subagent"] }
```

A specifier in `a5sfExpectedTools` that no entry names is a configuration fault (a typo
must not silently declare nothing). When both forms are present their union is required.
`allowEmpty: true` is NOT a safety feature: it accepts that a configured module may shadow
nothing, which is exactly the state the canary `E2b` measures.

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
| `EXPECT-3` | **absent** declaration, module forwards nothing, entry carries NO config | ACCEPTED — today's behaviour, exactly (the merged C3/A7/C1 contracts; the C2 rule only bites CONFIGURED entries) |
| `C2-c` | top-level map on a STRING entry, declared name forwarded | ACCEPTED; routed definition serves |
| `C2-d` | top-level map on a STRING entry, nothing forwarded | refused `A5SF_EXPECTED_TOOLS_UNSHADOWED` |
| `C2-e` | map key that no entry names | `TypeError` at row assembly |
| `C3-a…f` | non-array / empty / blank / non-string / duplicate / map faults | each a `TypeError` at row assembly (mutation-tested: deleting the validation turns all five red) |
| probe E6 | E2's divergent composition + declaration (real pinned module) | attach REFUSED, `A5SF_EXPECTED_TOOLS_UNSHADOWED`, message: `tool-subagent expected ["subagent"] but the attach forwarded []` |
| probe `E1` / `E2` | product shape / divergent shape, no declaration | refused `A5SF_MANAGED_FRONTIER_EMPTY` (the C2 default) |
| probe `E1b` / `E2b` | same shapes + `allowEmpty: true` | accepted; `E2b` reproduces the unguarded preset execution (canary) |

Honest boundary of E6: refusing the managed attach does **not** unregister the preset
plane's own definition — that registration belongs to the composition, not to this seam.
The declaration makes the mismatch LOUD at assembly (and `surfaceAtEnd` still shows the
preset name); it is the composition author's job not to ship both planes.

## 5. What is still NOT covered — the stated limit

**An event-driven module cannot be a managed native module unless its provider is resolved
BEFORE the mount.** A CONFIGURED module (entry carries a `config`) that forwards nothing at
the settle boundary is refused by default (`A5SF_MANAGED_FRONTIER_EMPTY`, E1/E2); a
composition that knows the empty frontier is intended opts out with `allowEmpty: true`, and
the seam then fails closed only AFTER the fact, by invalidating the realm when the name
appears (E3a/E3b). This is deliberately narrower than "refuse every zero-registration
attach": entries WITHOUT a config keep the merged C3 (`a5sf-assembly`) and A7
(`a5sf-deferred`) contracts byte-for-byte (EXPECT-3), because those fixtures register
nothing unconditionally and there is no configured condition to be unverified.

**Still NOT covered, stated plainly:** (a) an UNCONFIGURED module (string entry, no
`config`) that forwards nothing while the preset plane serves its name is accepted — the
C3/A7 contract, and the row has no input that names the module's tools; declare
`expectedTools` (form 2 works on string entries) to close it. (b) The intra-emission
dispatch window measured by `E8` (§5, second risk). (c) A refusal never unregisters the
preset plane's definition — that belongs to the composition.

**Sharpest reviewer risk — E2.** A composition whose PRESET plane is configured with a
different/available provider than the MANAGED module's provider reproduces the P0 class if
it does not declare `expectedTools`: the preset definition for the managed name executes
with zero guard facts and reaches the base provider (E2: `providerStarts=1`,
`guardFacts=0`, `isError=false`). `E2` is committed as a **hazard canary**
(`kind: "hazard-canary"`): it PASSES when the hazard is reproduced, and is not a green
contract. With the declaration (E6) the same composition is refused at assembly.

Second risk: the deferred-teardown change means a router can outlive the invalidation
record by one microtask (by design: the record is set first, the disposal waits for the
turn to end). **Measured residual window (probe `E8`, review C1 2026-11-03):** a dispatch
issued from ANOTHER listener inside the SAME boundary emission — after the record is set
and before the managed registration lands — is **ADMITTED** (the admission deny folds only
names the attach knows, and the managed name is not in `expectedDefinitions` yet), and it
then executes the definition visible at that instant. Measured body:
`{"isError":false,"text":"BASE-PROVIDER-RAN:in-process"}` with `guardFacts=0`, while the
record already read `surfaceAdded:["subagent"]`. So in that microtask-sized window the name
can be served by the **PRESET** definition, not the confined one — the exact definition the
record exists to refuse. The window is reachable only by code running inside the
composition's own synchronous emission (a model turn is a separate task; by the time it
runs, the deny covers the name — `E3a`/`E3b` measure that). Closing it would mean denying
*every* post-settle surface addition, which the merged `E3-fold` contract explicitly does
not do (an unmanaged plane name must stay servable).

## 6. Inventory gate-table delta — APPLIED in this lane (base moved to `3bee414ef`)

`docs/plans/active/alpha5-sandbox-first/NATIVE-SOURCE-INVENTORY.md` was **not** on the
base this lane started from (`d0cbef9af`); it landed on `origin/master` with #577
(`3bee414ef`), which this branch merged forward (**merge, not rebase** — the branch carries
committed run records). The measured row delta is therefore applied **in this lane**, in the
merged file, not delivered as a patch:

- §4 gate row 9: `否` → **部分覆盖** with the measured mechanism (E3a/E3b both listener
  orders, the `INACTIVE_EFFECT` repair, the new default refusal, `expectedTools` in both
  forms, `allowEmpty`, and the two residual gaps: the unconfigured zero-registration attach
  and the `E8` intra-emission window).
- §5.3: the five measured facts, including the undecidability (E7) and the conclusion for
  adopting a second module (provider resolved before mount + declare `expectedTools`).

## 7. Gates

All logs in this directory.

| gate | result | log |
| --- | --- | --- |
| `node --test tests/world-factory/a5sf-*.test.mjs` | 122/122 pass (30 assembly arms incl. C2-a…e / C3-a…f) | `all-a5sf-node-suites.log` |
| `a5sf-deferred` probe (A1–A7, the merged deferred contract) | 7/7 pass | (re-run, committed evidence untouched) |
| `pnpm vitest run a5sf` | 11 files / 166 tests pass | `vitest-a5sf.log` |
| `pnpm -s typecheck` | EXIT=0 | `typecheck.log` |
| `pnpm -s build` | EXIT=0 | `build.log` |
| `pnpm -s lint` | pre-existing repo-wide debt (129 errors in untouched files); **zero findings in the files this lane touched** | `lint.log` |
| `pnpm ci:local --base origin/master` | `verdict=fail steps=6 failed=1` — one 5000 ms load timeout in an UNRELATED lane; **the failing file's identity is load-dependent and unstable** (see §8), passes alone in 668 ms | `ci-local.log`, `ci-local-red-isolation.log` |
| `node scripts/check-artifacts-committed.mjs` | `verdict=ok` (1916 compared, drift 0) | `check-artifacts-committed.log` |
| `node scripts/check-artifacts-at-head.mjs` | `verdict=ok` — HEAD carries its own build | `check-artifacts-at-head.log` |
| `node scripts/eb3-evidence-guard.mjs --new-since origin/master` | pass, added=22 at this head, findings=0 (the file count is a property of the HEAD, re-measured here — an older log quoted 17) | `eb3-evidence-guard.log` |
| `node scripts/eb3-ci-required.mjs` | pass, workflows=9, findings=0 | `eb3-ci-required.log` |
| `node scripts/eb3-ci-negative-controls.mjs` | 26/26 controls behaved as required | `eb3-negative-controls.log` |
| `node scripts/ci-pr-gate.mjs --only graph-parse,state-freshness,blueprint-fence,lint-identities` | `DSH-CI-VERDICT pass pass=4 fail=0` | `ci-pr-gate.log` |
| `git diff --check origin/master..HEAD` | clean (exit 0) | `diff-check.log` |

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

`ci-local.log` is a bounded EXCERPT (7 KiB) of the 1.2 MiB transcript: it keeps the
invocation, the failing block, both step verdicts and the final verdict verbatim (the full
transcript exceeds the evidence bound; re-run `pnpm ci:local --base origin/master` to
reproduce it).

**C4 (review 2026-11-03) — the flake's identity is NOT stable.** This lane's run timed out
in `a5p4-lane-hygiene.test.ts > self-typechecks with strict settings`; the reviewer's runs
timed out in `a5g6-install-face-render` and `alpha5-glob-backend` (×3) — different files,
same class (a 5000 ms per-test timeout hit while a 200 s+ suite saturates the box). So
"which file" is load-dependent and must NOT be read as a property of that file: the
reproducible fact is the class (one timeout under load, green in isolation), not the name.
The isolation evidence below is for THIS run's file only.

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

- **Review round (2026-11-03, conditions C1–C6) — what moved:**
  - **C1 (honesty):** the absolute "no dispatch can be served in that window" claim is
    replaced by the measured `E8` shape (a same-emission dispatch executes the PRESET
    definition with 0 guard facts while the record is set). The claim was false as written.
  - **C2 (the substantive one):** the declaration is now reachable on STRING entries
    (`a5sfExpectedTools` map, C2-c/d/e) and the natural composition fails closed by default
    (`A5SF_MANAGED_FRONTIER_EMPTY`, E1/E2; `allowEmpty: true` is the explicit opt-out whose
    cost is the E2b canary). The undecidability of the "compare preset config" alternative
    is measured (E7) — its inputs are not part of this seam.
  - **C3:** the validation faults are pinned (C3-a…f) and mutation-tested (deleting the
    validation turns all five red).
  - **C4:** §8 now states the flake's identity is load-dependent and unstable
    (`a5p4-lane-hygiene` here; `a5g6-install-face-render` / `alpha5-glob-backend` for the
    reviewer) — the class is the fact, not the file.
  - **C5:** the evidence-guard log is re-measured at this head (`added=22`).
  - **C6:** both declaration forms are documented (§4).

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

## 11. Head

Base `origin/master` at the start of this lane = `d0cbef9af2949f88839741efdad758ba75c52743`;
the review round merged `origin/master` `3bee414efd659b86f979ef01cd50c49c6045e791` (#577)
**forward (merge, not rebase — the branch carries committed run records)**. The branch head
this evidence describes is the commit that last touched this directory:

```
git log -1 --format='%H %s' -- dev/agent-workflow/evidence/a5sf-event-driven
```

(`git diff --stat origin/master..HEAD` includes: the row's own diff (expectedTools in two
forms, `allowEmpty`, the configured-empty-frontier refusal, validation), the assembly
suite's new C2/C3 arms, the seam change from the first round, the rebuilt
`mount.js`/`types.d.ts`/row composition copies, the merged #577 inventory with the applied
gate row, and this evidence directory.)
