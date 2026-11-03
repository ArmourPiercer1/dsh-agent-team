# a5sf assembly — closing the two S-1 routing gaps (reconciled onto merged S-1)

Lane: close the two assembly gaps found by external review of S-1, reconciled onto the **merged**
S-1 (#561). **No Host boot** (the double-axis acceptance boot is queued separately), no run
manifest, **CORE PATCH BUDGET = 0** (no upstream file touched, `agent-bindings.mjs` byte-identical).

| fact | value |
| --- | --- |
| branch | `task/a5sf-assembly2-20261103` (fresh branch in the same worktree) |
| worktree | `.worktrees/a5sf-assembly` |
| base | `origin/master` = **`474a8d46d`** — the MERGED S-1 squash (#561), verified with `git fetch origin` + `git log --oneline -1 origin/master` |
| code head | `aae43e45c` — `474a8d46d` + one cherry-picked lane commit; the only later commit is this evidence |
| merge strategy | **fresh branch from `origin/master` + `git cherry-pick c0ea4f44b`** (the previous single code commit), NOT a rebase of the pre-squash S-1 train. One source conflict (`mount.ts` deferred-registration block) resolved by KEEPING merged S-1's public-state-only refusal and wrapping it in `if (!observeOnly)`; the four `dist/**` conflicts were resolved by regeneration (`pnpm build` + `place-dist-glue`), never hand-merged. Row/tool-axis/route-c applied cleanly. |
| evidence | only `dev/agent-workflow/evidence/a5sf-assembly/**`; merged `a5sf-s1/**` is history and was NOT re-added |

---

## 0. Reconciliation with the merged S-1 review changes (red-line check)

Merged S-1 differs from the pre-merge tip **only** in `mount.ts` (±19/3 lines): it replaced the
private `_error` read with public `Fiber.state` (`FIBER_ACTIVE = 2`, `FIBER_FAILED = 3`) and the
refusal now reports `deferred registration failed|state N, waiting on [deps]` without quoting
upstream error text. This lane:

- **keeps that version verbatim** (the merged comment about `CORE PATCH BUDGET = 0`/AGENTS is
  preserved) and only wraps it in `if (!observeOnly)`;
- adds **no `_error`**, no `as any` private cast, no new `internal/*` event use. `grep -n "_error"`
  over the lane's changed sources is empty;
- the only `internal/` reference in `mount.ts` is the pre-existing `internal/plugin` window
  tracker from merged S-1 — unchanged by this lane, not introduced here;
- `agent-bindings.mjs` is untouched: sha256 `df9b46af67cd903641285760cd72a78e57986e87959b2fbdbaf3f86dd6c6464b` (same as S-1/master).

Merged S-1's README states plainly that its forwarded-only identity check **cannot** catch a
deferred registration and that the single-macrotask settle is the only net. This lane is what
turns that "only net" into a real one: the realm now re-verifies after the settle AND continuously
through the public `tools/change` event (§3), and records an invalidation instead of leaving a
live unconstrained shadow. The honest limits remain (agent-scope-only, in-process record,
degrade-to-two-rounds if `ctx.on` fails, first-macrotask baseline — §3.4).

---

## 1. Gap 1 — a binding may only be assigned to the module that OWNS its tool

### What was wrong

`nativeToolMountsOf()` built the CARTESIAN PRODUCT: one ceiling mount per module plus one
binding-targeted mount per `(module × mounted ToolBinding)`. The mount seam then (correctly)
refuses a binding-targeted mount whose module does not register the binding's tool (fail closed).
So configuring module A (owns `read`) plus module B (does not) with binding `dsh.fs/read` refused
the WHOLE multi-module attach: the product demanded B's binding fiber register A's tool.

### What it does now (the ownership mechanism)

1. **Observe, do not guess.** For each configured module, the row mounts it ONCE in the ceiling
   partition with `observeOnly: true`. An observe-only mount executes the module's real `apply`
   behind the registration router with EVERY forward predicate false: the module registers
   nothing, the router's `partition.observed` records every name it attempted, and the receipt
   (`a5sfRegistrationRouting.observed`) is the module's own answer. The probe fibers are disposed
   before the real mounts.
2. **Assign by observed ownership.** For each mounted ToolBinding identity, the tool name is the
   last `/` segment (`dsh.fs/read` → `read`); exactly one module must have observed it.
   - 0 owners → typed **`A5SF_BINDING_OWNER_UNRESOLVED`** (never a silent fallback onto the
     wider ceiling lane).
   - >1 owners → typed **`A5SF_BINDING_OWNER_AMBIGUOUS`** (assigning would be a guess).
3. **Mount the resolved set.** One ceiling mount per module (which drops every binding-owned
   name) + one binding mount ONLY for the owner of each binding's tool. Observation leaves no
   registry effect, so the pre-attach `beforeDefinitions` baseline stays valid and the existing
   surface/definition-identity gates are unchanged. `EffectiveIo` is still consumed, never
   recomputed (TA5 pins no `compileEffectiveIo` in either file).

No mounted binding short-circuits to one ceiling mount per module (no probe): with no binding
there is no partition to learn.

### The three assembly arms (`green-arms.log`)

```
✔ GAP1a a binding is assigned to the module that OWNS its tool; the composition mounts and routes
✔ GAP1b module B is ceiling-only, its tool still executes, and it never takes the binding lane
✔ GAP1c a binding whose tool NO module owns is REFUSED with a typed error and mounts nothing
```

- **1a** — modules A (`read`+`write`) and B (`x_assembly_probe`) in one composition, binding
  `dsh.fs/read`: 3 fibers, the binding fiber forwards exactly `['read']`, `read` on the ceiling
  target is refused with exactly ONE binding fact.
- **1b** — B's fiber routes `realm:'ceiling', toolBindingIdentity:null`, `x_assembly_probe`
  executes (`'probe-ok'`), surface neutral.
- **1c** — binding `dsh.fs/archive` no module registers: `A5SF_BINDING_OWNER_UNRESOLVED`, message
  names `archive`, preset `read` unchanged, nothing mounted, `nativeInvalidation === null`.

## 2. Gap 2a — a `get()`-less tools row must not silently skip coverage

If `a5sfNativeToolModules` is declared and the tools row cannot answer definition identity, the
attach refuses BEFORE import/mount with typed **`A5SF_COVERAGE_UNDEFINED`** (no name-set-only
degradation on the product path). N8's surface-only double now answers `get` and its fake mount
swaps the resolved definition — N8 still measures SCOPE resolution. `GAP2a` proves the refusal
happens with `mountCalls === 0`.

## 3. Gap 2b — post-settle re-verification, continuous verification, late-new-name

### 3.1 Continuous verification without a loader seam

`@deepseek-ai/dsh-tools` (pinned upstream) emits the PUBLIC `tools/change` event after every scoped
layer mutation. After a successful attach the realm attaches a listener on the Member ctx and
re-checks, for every name this attach forwarded:

```
tools.get(name, scope) === the exact definition object this attach registered
```

on (a) every `tools/change`, and (b) two additional bounded macrotask rounds after the existing
0 ms settle. The check is scoped to the agent key (`options.scope` from the row), so another
agent's traffic on the same root cannot invalidate this realm.

### 3.2 Late NEW / DISAPPEARED names — S-1's measured +30 ms escape now invalidates

Merged S-1 recorded two measured time-escapes: (a) a ceiling-owned tool registered at +30 ms was
accepted but unaccounted in the receipt; (b) a brand-new name at +30 ms escaped the surface gate
entirely. This lane answers (b) directly and makes (a) moot:

- at the first verification macrotask the realm captures the model-visible NAME SET;
- on every later verification it compares the current set and records
  **`surfaceAdded` / `surfaceRemoved`** on the invalidation;
- a late new name (or a disappeared name) **invalidates**: fibers disposed, preset surface
  restored, further mounts refused. It is never accepted silently.

`GAP2b-late-new-name` is deliberately **unbound** (the escape is a surface-gate hole, not a
routing one) and registers the late tool on a LATER macrotask (+10 ms). Real output, RED on the
merged tree vs GREEN on this tree:

```
# merged S-1 (pre-lane) — the hole, measured for 1500 ms:
✖ GAP2b-late-new-name ... AssertionError: a late NEW name is a surface change and must invalidate
# this lane:
✔ GAP2b-late-new-name a tool that APPEARS after the settle window invalidates (S-1 +30 ms escape)
  record: schema=a5sf-native-invalidation/1 uncovered=[] surfaceAdded=["x_assembly_late_unrelated"]
```

### 3.3 Invalidation record and fail-closed behaviour

Frozen record on the realm (`realm.nativeInvalidation`):

```ts
{ schema: 'a5sf-native-invalidation/1', reason, uncovered, surfaceAdded, surfaceRemoved, observedAt }
```

On mismatch: record set, stable `console.error`, native fibers disposed (preset surface restored),
`whenNativeVerificationSettled()` resolves only after teardown, further native mounts rejected
(`/invalidated/i`). The row's OWN coverage/surface refusal calls
`realm.disposeNativeToolModules()` (detaches verification, disposes fibers, records NO
invalidation) so a corrected composition can attach later and the refusal is not mislabelled.
Realm `dispose()` detaches the listener before its own teardowns.

### 3.4 The baseline timing, stated honestly

The name-set baseline is taken on the **FIRST macrotask** after the attach, not at arm time. WHY:
the product glue registers the Team tools **synchronously in the same setup turn** immediately
after `attachA5sfNativeToolModules` returns (`agent-bindings.mjs`: native attach ~line 2809,
Team-tool loop ~2834). Absorbing that same-turn setup is correct; treating it as a late change
would invalidate every Member that has Team tools. `GAP2b-control same-turn setup additions (the
Team tools) do not invalidate` pins this. A genuine +30 ms registration on a later turn is caught
(`GAP2b-late-new-name`). **Limit:** if a legitimate setup path registered tools *asynchronously
beyond the first macrotask*, it would look late and invalidate; the measured product path does not
do that, and making it tolerate arbitrary late additions would reopen the S-1 hole.

### 3.5 What remains unverified

- **Scope key is the limit.** Verification asks the agent's scope; a managed name registered
  under a DIFFERENT scope key is not this realm's shadow (and does not shadow this agent).
- **No durable stream.** The record is in-process plus a log line. This lane is budget-frozen on
  `agent-bindings.mjs`, so the glue does not forward it to the a5sf evidence stream; a later lane
  should consume the record at the row/glue boundary.
- **Listener attachment failure degrades to the two bounded rounds** (the code catches a `ctx.on`
  fault). If the public `tools/change` contract ever disappears upstream, only those rounds verify.
- **A registry read fault is not evidence of loss** (caught, retried on the next event/round); the
  row's attach-time identity gate still refuses a mount it cannot verify.
- **Same-turn surface mutations are absorbed by design** (§3.4) — the baseline cannot distinguish
  a legitimate setup registration from a same-turn hostile one. The +30 ms shape that S-1 measured
  is on a later turn and is caught.

## 4. TDD: RED first on the MERGED tree, then GREEN

`red-arms.log`: the 8 arms run against **merged `474a8d46d` sources** (`mount.ts` +
`a5sf-realm-row.mjs`) with this lane's test file — exit 1, **6 fail / 2 controls pass**.
`green-arms.log`: this lane — exit 0, **8/8 pass**.

RED (measured, not paraphrased):

```
✖ GAP1a … Error [TeamServiceInstallError]: SERVICE_MOUNT_FAILED: native tool module "dsh.fs/read"
  registers no tool named 'read'; a binding-targeted mount must own its tool (fail closed)
✖ GAP1c … AssertionError: expected the typed ownership refusal, got TeamServiceInstallError: …
✖ GAP2a … AssertionError: Missing expected rejection: a name-set-only check cannot prove the
  router shadowed each forwarded tool
✖ GAP2b … (same cartesian refusal — the healthy attach this arm needs cannot be built)
✖ GAP2b-late-new-name … AssertionError: a late NEW name is a surface change and must invalidate
  (after 1500 ms with no record: the +30 ms escape, reproduced)
✔ GAP2b-control same-turn setup additions (the Team tools) do not invalidate
✔ GAP2b-control a tool already on the surface at arm time does not invalidate the routed shadow
```

GREEN: `ℹ tests 8  ℹ pass 8  ℹ fail 0`.

## 5. Gates (all on code head `aae43e45c`)

| gate | result | raw |
| --- | --- | --- |
| new assembly arms | **RED 6 fail/2 controls → GREEN 8/8** | `red-arms.log`, `green-arms.log` |
| all a5sf node suites (9 files) | **97/97 pass** | `all-a5sf-node-suites.log` |
| `a5sf-tool-axis` (TA1–TA11 + updated TA5) | **14/14** | inside `all-a5sf-node-suites.log` |
| `pnpm vitest run a5sf` | **166/166, 11 files** | `vitest-a5sf.log` |
| p4t6 + laws (`u6-arc-a-fitness`, `u6-pr6-arc-d-adversarial`, `a4p3-intervention-lane-hygiene`) | **54/54** | `law-and-p4t6.log` |
| `pnpm typecheck` | pass | `typecheck.log` |
| `pnpm build` | pass | `build.log` |
| `node scripts/place-dist-glue.mjs` | 101 placements, byte-identical | `place-dist-glue.log` |
| `node scripts/check-artifacts-committed.mjs` | `verdict=ok compared=1916 glue=101` | `check-artifacts-committed.log` |
| `node scripts/check-artifacts-at-head.mjs` | `verdict=ok compared=1916 drift=0` | `check-artifacts-at-head.log` |
| `node scripts/eb3-evidence-guard.mjs` | pass | `eb3-evidence-guard.log` |
| `node scripts/eb3-ci-required.mjs` | pass | `eb3-ci-required.log` |
| `node scripts/eb3-ci-negative-controls.mjs` | 26/26 controls | `eb3-negative-controls.log` |
| `git diff --check` | clean | (working tree) |
| `pnpm ci:local` | **FAIL — see §5.1**, known flake, all reds green in isolation | `ci-local.log`, `ci-local-red-isolation.log` |

### 5.1 The `pnpm ci:local` verdict, verbatim

```
DSH-CI-LOCAL verdict=fail steps=6 failed=1 coverage=determined files=4 wall=260.6s
Test Files  3 failed | 480 passed (483)
Tests  3 failed | 5990 passed (5993)        # a5g6 GLUE-6 LEG B, alpha5-glob X3, alpha5-search P8b
```

Isolation at the SAME head: the three files together → **100/100 pass (3 files), 24.98 s**
(`ci-local-red-isolation.log`). None is touched by this diff; they are the pre-existing
ci-local load/timeout flake S-1 documented (the whole 483-file `packages/runtime` tree, one
`threads` pool, vitest's 5 s default). No unmeasured pass is claimed; coverage was `determined`
(never the exit 2 case).

## 6. p4t6 — MEASURED LAST on this tree

```
MEASURED p4t6 tie, MEASURED LAST on this tree (all files on disk at run time):
  scanSessionEventVocabulary: filesScanned=1428 files.length=1428
  ledger derived expected=1428 violations=[]
  A5SF booking expectedDelta={"from":1396,"to":1428}
```

No scannable `packages/**` path added (test arms in `tests/**`, evidence in `dev/**`); booking
unchanged; exact equality, no tolerance.

## 7. Protected center / hashes to book

| file | sha256 | note |
| --- | --- | --- |
| `packages/runtime/src/plugin/live/agent-bindings.mjs` | `df9b46af67cd903641285760cd72a78e57986e87959b2fbdbaf3f86dd6c6464b` | **unchanged** |
| `packages/runtime/src/plugin/live/a5sf-realm-row.mjs` | `632b7597dba0dc14db361321e836e16b8dc44e94f65556311a00954579f9cf13` | changed |
| `packages/runtime/team-services/src/mount.ts` | `7218a9477b8c1bf0b3ea5b11207e310f328c27d2ed88096ca7b602329731015c` | changed |
| `tests/world-factory/a5sf-assembly.test.mjs` | `a0d3bef1f5ae1672c2d8ed048a736f32820e12a5f7020a3db5b841c3c910d686` | new |
| `tests/world-factory/a5sf-native-route-c.test.mjs` | `0baf27123a7011ba116561424fdd6ce2ca6e606c2976e46a459794f60ee9c780` | N8 double |
| `tests/world-factory/a5sf-tool-axis.test.mjs` | `9a055ddf9a5b034e8e00b18444093dbeaf7569e09d9c16616098e64a02f0cc12` | TA5 pins |

`pa-mount-registry.mjs` untouched.

## 8. Evidence index

| file | what |
| --- | --- |
| `red-arms.log` / `green-arms.log` | 8 arms on merged S-1 vs this lane |
| `all-a5sf-node-suites.log` | 9 a5sf node suites, 97/97 |
| `vitest-a5sf.log` | 166/166 |
| `law-and-p4t6.log` | laws + p4t6, 54/54 |
| `typecheck.log`, `build.log`, `place-dist-glue.log` | build chain |
| `check-artifacts-committed.log`, `check-artifacts-at-head.log`, `eb3-*.log` | artifact/EB3 gates |
| `ci-local.log`, `ci-local-red-isolation.log` | failing run + isolation (raw 1.2 MB not committed) |
| `p4t6-measured-tie.log` | the measured tie |

## 9. Biggest risk for a reviewer who read the S-1 review thread

**1. `observeOnly` double-`apply`.** Each configured module's `apply` now runs twice per attach
(observe-only probe, then real). The probe forwards nothing and is disposed before real mounts
(surface-neutrality arms prove the resulting surface), but a module whose `apply` does anything
besides `tools.register`/`systemPrompt.section` — timers, sockets, globals, counters — now does it
twice, and probe disposal does not generally undo it. The honest alternatives are mounting once
before knowing the target realm (the chicken-and-egg the cartesian product papered over) or a
declaration contract (a guess unless validated). This lane chose behavioural observation; the
native-module contract may need to become side-effect-free/idempotent, or a future loader seam may
need a register-only probe.

**2. The `tools/change` dependency and the baseline heuristic.** Continuous verification is real
for the pinned upstream (public event, no loader seam), but it is a dependency: if the event
contract changes, only the two bounded rounds remain. And the first-macrotask baseline (§3.4)
absorbs same-turn setup by design; a legitimate asynchronous setup path beyond that turn would be
mislabelled late. The measured product path registers Team tools synchronously in the setup turn,
which is what the control pins. Both limits are stated in `mount.ts` and here rather than hidden.
