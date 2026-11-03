# a5sf assembly — closing the two S-1 routing gaps (2026-11-03)

Lane: close the two assembly gaps found by external review of S-1. One worktree, one writer,
one branch. **No Host boot** (P2-01's last boot stays reserved for double-axis acceptance), no
run manifest, **CORE PATCH BUDGET = 0** (no upstream file touched, `agent-bindings.mjs` byte-identical).

| fact | value |
| --- | --- |
| branch | `task/a5sf-assembly-20261103` |
| worktree | `.worktrees/a5sf-assembly` |
| code head (gates + `ci:local` measured on it) | `c0ea4f44b` — the only later commit is this evidence file/logs |
| base used | `origin/master` = **`bb5315cd3`** (checked first: `git log --oneline -1 origin/master` → `bb5315cd3`; `47f26d6b2` was **not** an ancestor of `origin/master`, so #561 was not merged at fetch time), branch created there, then `git rebase origin/task/a5sf-s1-20261103` fast-forwarded to the S-1 tip **`47f26d6b2`** (S-1's `feat(a5sf S-1) … → fix(…coverage hole…) → evidence(…ci:local verdict…)` chain is its history). No force-push. |
| changed source | `packages/runtime/team-services/src/mount.ts`, `packages/runtime/src/plugin/live/a5sf-realm-row.mjs` (+ their `packages/runtime/dist/**` mirrors) |
| changed tests | `tests/world-factory/a5sf-assembly.test.mjs` (new, 6 arms), `a5sf-tool-axis.test.mjs` (TA5 pin), `a5sf-native-route-c.test.mjs` (N8 double now answers identity) |
| not touched | `packages/runtime/src/plugin/live/agent-bindings.mjs` (sha256 unchanged), `packages/runtime/tsconfig.build.json` (comment-free, unchanged), anything upstream, no allowlist entry, no p4t6 booking change |

---

## 1. Gap 1 — a binding may only be assigned to the module that OWNS its tool

### What was wrong

`nativeToolMountsOf()` built the CARTESIAN PRODUCT: one ceiling mount per module plus one
binding-targeted mount per `(module × mounted ToolBinding)`. The mount seam then (correctly)
refuses a binding-targeted mount whose module does not register the binding's tool (fail closed,
`SERVICE_MOUNT_FAILED: … registers no tool named 'read'`). So configuring module A (owns `read`)
plus module B (does not) with binding `dsh.fs/read` refused the WHOLE multi-module attach: the
product demanded that B's binding fiber register A's tool.

### What it does now (the ownership mechanism)

1. **Observe, do not guess.** For each configured module, the row mounts it ONCE in the ceiling
   partition with `observeOnly: true` (`mount.ts`'s new `NativeToolModuleMount.observeOnly`).
   An observe-only mount executes the module's real `apply` behind the registration router with
   EVERY forward predicate false: the module registers nothing, the router's `partition.observed`
   records every name it attempted, and the receipt (`a5sfRegistrationRouting.observed`) is the
   module's own answer. The probe fibers are disposed before the real mounts.
2. **Assign by observed ownership.** For each mounted ToolBinding identity, the tool name is the
   last `/` segment (`dsh.fs/read` → `read`); exactly one module must have observed it.
   - 0 owners → typed **`A5SF_BINDING_OWNER_UNRESOLVED`** refusal (never a silent fallback onto
     the wider ceiling lane).
   - >1 owners → typed **`A5SF_BINDING_OWNER_AMBIGUOUS`** refusal (assigning would be a guess).
3. **Mount the resolved set.** One ceiling mount per module (which drops every binding-owned
   name) + one binding mount ONLY for the owner of each binding's tool. Observing leaves no
   registry effect, so the pre-attach `beforeDefinitions` baseline stays valid and the existing
   surface/definition-identity gates are unchanged. `EffectiveIo` is still consumed, never
   recomputed (`TA5` pins no `compileEffectiveIo` in either file).

Why this is honest rather than a table: the answer comes from the module's own `apply` executed
in the real routing topology (same isolate labels, same partition predicates), not from a
hardcoded owner map, a package name, or the specifier. A module that registers its tool under a
`ctx.inject` child is observed exactly as it will later register. A module whose `apply` has side
effects beyond `tools.register` runs twice per attach — the risk in §9.

**No mounted binding** short-circuits to one ceiling mount per module (no observation mount): with
no binding there is no partition to learn.

### The three assembly arms (new suite, `green-arms.log`)

```
✔ GAP1a a binding is assigned to the module that OWNS its tool; the composition mounts and routes
✔ GAP1b module B is ceiling-only, its tool still executes, and it never takes the binding lane
✔ GAP1c a binding whose tool NO module owns is REFUSED with a typed error and mounts nothing
```

- **1a** — modules A (`read`+`write`) and B (`x_assembly_probe`) in one composition, binding
  `dsh.fs/read`: 3 fibers, the binding fiber forwards exactly `['read']`, `read` on the ceiling
  target is refused with exactly ONE binding fact (the binding lane is real, not widened).
- **1b** — B's fiber routes `realm:'ceiling', toolBindingIdentity:null`, `x_assembly_probe`
  executes (`'probe-ok'`), and the model-visible surface is neutral.
- **1c** — binding `dsh.fs/archive` that no module registers: `A5SF_BINDING_OWNER_UNRESOLVED`,
  message names `archive`, preset `read` unchanged, and nothing is mounted
  (`realm.nativeInvalidation === null`).

## 2. Gap 2a — a `get()`-less tools row must not silently skip coverage

`attachA5sfNativeToolModules` used to compute `beforeDefinitions` only when `tools.get` existed
and pass `coverage: []` otherwise: on the product path that degraded the definition-identity
gate to the NAME SET, which cannot see a tool left on the preset definition (same name, zero
guard facts). Now, if the composition declares `a5sfNativeToolModules` and the tools row cannot
answer identity, the attach refuses BEFORE importing or mounting anything with typed
**`A5SF_COVERAGE_UNDEFINED`**:

```
✔ GAP2a a get()-less tools row REFUSES the configged native mount (coverage is never silently skipped)
```

A test double may still be surface-only only if the test does not declare managed modules; N8
(scope-identity arm) declared one, so its double now answers `get` and its fake mount swaps the
resolved definition — the same positive signal a real router produces. That keeps N8 measuring
SCOPE resolution while honouring the new contract (`tests/world-factory/a5sf-native-route-c.test.mjs`).

## 3. Gap 2b — post-settle re-verification and invalidation

### The decision: continuous verification IS achievable without a loader seam

`@deepseek-ai/dsh-tools` (`ToolRuntime`, the pinned upstream) emits the PUBLIC `tools/change`
event after every scoped layer mutation (registration, restriction, disposal). The realm
therefore attaches a listener on the Member ctx after a successful attach and re-runs the
definition-identity check for every name this attach forwarded:

```
tools.get(name, scope) === the exact definition object this attach registered
```

on (a) every `tools/change` and (b) TWO additional bounded macrotask rounds after the existing
0 ms settle (so a registration that lands just after the window is caught even if the event is
missed). The check is scoped to the agent key (`options.scope` from the row), so another agent's
traffic on the same root cannot invalidate this realm.

### Invalidation, not a silent live shadow

If any managed name no longer resolves to the attach's definition:

1. a frozen **`a5sf-native-invalidation/1`** record is set on the realm
   (`nativeInvalidation = { schema, reason, uncovered, observedAt }`),
2. a stable line is written to `console.error`,
3. every router fiber is disposed (native shadow first), restoring the preset definitions,
4. the realm refuses further `mountNativeToolModules` calls (a partial shadow cannot be
   recreated), and
5. `whenNativeVerificationSettled()` resolves only after that teardown (so callers/tests can
   observe the restored surface).

A change that leaves every managed name resolving to the attach's definition does nothing
(`GAP2b-control`). A change after the caller's OWN refusal (coverage/surface gate) is not
recorded as an invalidation: the row calls `realm.disposeNativeToolModules()`, which detaches
verification and disposes the fibers without setting the record (the refusal is the report, and a
corrected composition can attach later). Realm `dispose()` detaches the listener before tearing
down, so its own disposals never invalidate.

```
✔ GAP2b a routed shadow removed AFTER the settle window is detected, disposed and RECORDED
✔ GAP2b-control an unrelated later tool registration does not invalidate the routed shadow
```

GAP2b disposes the binding fiber 20 ms after attach (after the settle window), then asserts the
record's schema/`uncovered:['read']`/`observedAt`, the restored preset definitions for `read`,
`write` and `x_assembly_probe`, and that a later mount rejects `/invalidated/i`.

### What remains unverified

- **Scope key is the limit.** Verification asks the agent's scope. A module that registers a
  managed name under a DIFFERENT scope key is not this realm's shadow and cannot be detected
  through this check (it also does not shadow this agent).
- **No durable stream.** The record is in-process (`realm.nativeInvalidation`) plus a log line.
  This lane is budget-frozen on `agent-bindings.mjs`, so the glue does not forward the event into
  the a5sf evidence stream; a future lane should consume the record at the row/glue boundary.
- **Listener attachment failure degrades to the two bounded rounds** (the code catches a `ctx.on`
  fault). If the public event ever disappears upstream, only those rounds verify; the mount is
  not marked verified-because-of-the-listener, but a change much later than two macrotasks would
  go unseen — the `tools/change` public contract is the load-bearing assumption.
- **A registry read fault is not evidence of loss** (caught and retried on the next event/round),
  so a permanently faulting `tools.get` after a successful attach would not invalidate; the row's
  own attach-time identity gate still refuses a mount it cannot verify.
- **Late registration can still change the model-visible surface** for names NOT managed by this
  attach (the S-1 §3.2 accounting gap). This lane closes the MANAGED-name shadow invariant only;
  an unrelated module adding a brand-new tool after the surface gate is unchanged behaviour
  (`GAP2b-control` deliberately proves an unrelated name does NOT invalidate).

## 4. TDD: RED first, then GREEN

`red-arms.log` is the run on the pre-implementation tree (exit 1, 6/6 arms red); `green-arms.log`
is the same file after the change (exit 0, 6/6).

RED, quoted (each is the measured failure, not a paraphrase):

```
✖ GAP1a … Error [TeamServiceInstallError]: SERVICE_MOUNT_FAILED: native tool module "dsh.fs/read"
  registers no tool named 'read'; a binding-targeted mount must own its tool (fail closed)
✖ GAP1c … AssertionError: expected the typed ownership refusal, got TeamServiceInstallError:
  SERVICE_MOUNT_FAILED: … "dsh.fs/archive" registers no tool named 'archive' …
✖ GAP2a … AssertionError: Missing expected rejection: a name-set-only check cannot prove the
  router shadowed each forwarded tool
✖ GAP2b … (same cartesian refusal — the healthy attach this arm needs could not be built)
```

GREEN:

```
ℹ tests 6   ℹ pass 6   ℹ fail 0
```

Every failure is the reviewed defect itself (cartesian refusal for 1a/1b/2b, wrong error type
for 1c, silent coverage skip for 2a), not an environment artefact.

## 5. Gates (all on `c0ea4f44b`, evidence-only commits follow)

| gate | result | raw |
| --- | --- | --- |
| new assembly arms | **6/6 pass** (RED 0/6 → GREEN 6/6) | `red-arms.log`, `green-arms.log` |
| all a5sf node suites (9 files) | **95/95 pass** | `all-a5sf-node-suites.log` |
| `a5sf-tool-axis` (TA1–TA11 + updated TA5 pins) | **14/14** | inside `all-a5sf-node-suites.log` |
| `pnpm vitest run a5sf` | **166/166, 11 files** | `vitest-a5sf.log` |
| p4t6 + law suites (`u6-arc-a-fitness`, `u6-pr6-arc-d-adversarial`, `a4p3-intervention-lane-hygiene`) | **54/54** (20+12+13+9) | `law-and-p4t6.log` |
| `pnpm typecheck` (all packages) | pass | `typecheck.log` |
| `pnpm build` | pass | `build.log` |
| `node scripts/place-dist-glue.mjs` | 101 placements, byte-identical | `place-dist-glue.log` |
| `node scripts/check-artifacts-committed.mjs` | `verdict=ok compared=1916 glue=101` | `check-artifacts-committed.log` |
| `node scripts/check-artifacts-at-head.mjs` | `verdict=ok compared=1916 drift=0` — HEAD carries its own build | `check-artifacts-at-head.log` |
| `node scripts/eb3-evidence-guard.mjs` | pass, `added=26 findings=0` | `eb3-evidence-guard.log` |
| `node scripts/eb3-ci-required.mjs` | pass, `workflows=9 findings=0` | `eb3-ci-required.log` |
| `node scripts/eb3-ci-negative-controls.mjs` | **26/26 controls** | `eb3-negative-controls.log` |
| `git diff --check` | clean | in `all-a5sf-node-suites.log` run bookkeeping; re-run clean before commit |
| `pnpm ci:local` | **FAIL on both runs** — `verdict=fail steps=6 failed=1 coverage=determined … wall=269.7s` and `… wall=260.0s`, reds in THREE different unrelated files, each green in isolation at this head | `ci-local.log`, `ci-local-red-isolation*.log` |

### 5.1 The `pnpm ci:local` verdict, verbatim

```
DSH-CI-LOCAL verdict=fail steps=6 failed=1 coverage=determined files=4 wall=269.7s
Test Files  2 failed | 481 passed (483)
Tests  2 failed | 5991 passed (5993)        # a3p4-pr4-production-entry-regression + alpha5-search-backend

DSH-CI-LOCAL verdict=fail steps=6 failed=1 coverage=determined files=4 wall=260.0s
Test Files  1 failed | 482 passed (483)
Tests  1 failed | 5992 passed (5993)        # a5g6-install-face-render GLUE-6 LEG B
```

Isolation at the same head: the two run-1 files together → **62/62 pass (2 files)**; the run-2
file alone → **5/5 pass** (`ci-local-red-isolation*.log`). Three different files red across two
runs, none in this diff, each green alone — the pre-existing ci-local load/timeout flake S-1
documented (`…/a5sf-s1/README.md` §4.1: the whole 483-file `packages/runtime` tree in one
`threads` pool against vitest's 5 s default). This lane does not report an unmeasured pass, and
never saw exit 2 (`coverage=determined` on both runs).

## 6. p4t6 — MEASURED LAST on this tree

`p4t6-measured-tie.log`, measured after every evidence file in this directory was on disk:

```
MEASURED p4t6 tie, MEASURED LAST on this tree (all files on disk at run time):
  scanSessionEventVocabulary: filesScanned=1428 files.length=1428
  ledger derived expected=1428 violations=[]
  A5SF booking expectedDelta={"from":1396,"to":1428}
```

The booking is **unchanged**: this lane adds no scannable `packages/**` path (new/changed test
arms live under `tests/**`, evidence under `dev/**`; edits to already-counted files are not an
increment). Exact equality stays (ADR A5-17): no tolerance, no skip, no exclusion.

## 7. Protected center / hashes the coordinator must book

| file | sha256 | note |
| --- | --- | --- |
| `packages/runtime/src/plugin/live/agent-bindings.mjs` | `df9b46af67cd903641285760cd72a78e57986e87959b2fbdbaf3f86dd6c6464b` | **unchanged** (must stay the S-1 value; no override booked) |
| `packages/runtime/src/plugin/live/a5sf-realm-row.mjs` | `632b7597dba0dc14db361321e836e16b8dc44e94f65556311a00954579f9cf13` | changed this lane |
| `packages/runtime/team-services/src/mount.ts` | `a68d4a7ee590b99b9c5b2c15969b939c1b71f9562d9309fb45751f00d06d3875` | changed this lane |
| `tests/world-factory/a5sf-assembly.test.mjs` | `9945899ca09685995b376a5ad73280265b7952a33cc65c0e349d81414206e895` | new |
| `tests/world-factory/a5sf-native-route-c.test.mjs` | `0baf27123a7011ba116561424fdd6ce2ca6e606c2976e46a459794f60ee9c780` | N8 double fixture only |
| `tests/world-factory/a5sf-tool-axis.test.mjs` | `e91538775669555d7ba5234aad151f88c86789ed95cd008b1b6b6225b15dd426` | TA5 pins only |

`pa-mount-registry.mjs` is untouched by this lane (no booking).

## 8. Evidence index

| file | what |
| --- | --- |
| `red-arms.log` | pre-implementation run of the 6 new arms (6 red) |
| `green-arms.log` | same suite green (6/6) |
| `all-a5sf-node-suites.log` | 9 a5sf node suites, 95/95 |
| `vitest-a5sf.log` | `vitest run a5sf`, 166/166 |
| `law-and-p4t6.log` | p4t6 + three law suites, 54/54 |
| `typecheck.log`, `build.log`, `place-dist-glue.log` | build chain |
| `check-artifacts-committed.log`, `check-artifacts-at-head.log`, `eb3-*.log` | artifact/EB3 gates |
| `ci-local.log` | derived summary of BOTH failing ci-local runs (raw 1.2 MB captures not committed) |
| `ci-local-red-isolation.log`, `ci-local-red-isolation-a5g6.log` | each red green alone at this head |
| `p4t6-measured-tie.log` | the measured tie |

## 9. Biggest risk for the reviewer

**Each configured module's `apply` now runs twice per attach** (once observe-only, once for real).
The observation is side-effect-free with respect to `tools`/`systemPrompt` registration, and the
probes are disposed before any real mount — proved by the surface-neutrality arms and by the fact
that GAP1a sees exactly three fibers with the expected partition. But a native module whose
`apply` does something ELSE (starts a timer, opens a connection, mutates a global, bumps a
counter) now does that twice, and the probe's disposal does not necessarily undo it. The mount
seam has no general "dry-run" seam in the pinned upstream, so the honest alternatives are
(a) run `apply` once and learn ownership from the same fiber before deciding the realm (that
requires mounting before knowing the target realm — the chicken-and-egg the cartesian product
papered over), or (b) require modules to declare their tool names (a new config contract, and a
guess unless validated). This lane chose observation because it is measured from behaviour, not
declarations; the residual is double-apply side effects. **The reviewer should decide whether the
native module contract must become side-effect-free/idempotent, or whether a future loader seam
should expose a register-only probe.** Second risk: continuous verification depends on the public
`tools/change` contract and only covers the agent scope (§3 "what remains unverified").
