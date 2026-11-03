# a5sf-deferred — let a satisfiable deferred registration RUN, refuse only what it becomes

**Lane:** unblock the live half of Alpha.5 (the P0 admission gate was unreachable on a live
Host because the whole `dsh-tool-fs` mount was refused whenever `attachments` was resolvable).
**Branch:** `task/a5sf-deferred-20261103`
**Base:** `origin/master` @ `cfdf87267ef4d020f71071950cfc3cabf9cbaa02`
("docs(alpha5, dated 2026-11-03): record the assembly-complexity ruling … (#572)").
**Worktree:** `.worktrees/a5sf-deferred`. No Host boot; no `agent-bindings.mjs` change
(`CORE PATCH BUDGET = 0`, `git diff origin/master..HEAD -- '*agent-bindings*'` empty).

## 1. The bug this lane removes

`#561` added a *deferred-registration* refusal to `mountNativeToolModules`
(`packages/runtime/team-services/src/mount.ts`). The pinned `dsh-tool-fs` module registers
`read_image` from `ctx.inject(['attachments'])` **after** `apply` returns. Under the mount's
isolated router that child could not reach the routed `tools` service at all (measured:
`cannot get property "tools" without inject`), so `#561` refused the **entire mount** whenever
`attachments` was resolvable. Consequence: no `a5sf`-wired Member could activate on a live
Host, and the P0 admission gate (`A5SF_NATIVE_SHADOW_INVALIDATED`, deny-at-admission) was
unreachable in practice — the seam killed the Member before the gate could ever deny.

`#561`'s instinct was right about the DANGER (a tool left on the unshadowed preset definition
runs on the BASE provider with zero guard facts while the model-visible name set stays equal),
but wrong about the CURE: "cannot run under the router" is a bug in the child's environment,
not a property of the module. The fix makes the child able to run **through the same router**
and then judges what it actually did.

## 2. What the seam does now — settle → inspect → accept/refuse

A deferred registration is no longer refused for being deferred. The mount now runs this state
machine (all in `mountNativeToolModules`, no second policy system, no lane evaluation in the
seam):

1. **Give the child a router-shaped environment.** `routedModuleContext(routerCtx)` extends the
   router fiber's context with its OWN `inject` that merges the two services the router
   provides (`ROUTED_SERVICE_NAMES = ['tools', 'systemPrompt']`) into every child the module
   creates. This is public `ctx.plugin`/`inject` composition (no upstream patch, no private
   API). Measured root cause: Cordis's `ReflectService.handler.get` computes the isolation key
   from the **root** context object (`target[symbols.isolate][prop]` → `Symbol('tools')`), while
   the child's parent chain carries the router's `Symbol(a5sf-router:tools:…)` label; without
   the merged inject the child's `ctx.tools` is unresolvable even though the router serves it.
2. **Settle a bounded window.** `settleDeferredRegistrationWindow(descendants, target)` waits at
   most `DEFERRED_SETTLE_ROUNDS = 20` macrotask rounds for every descendant fiber created by the
   mount to leave the transient states (PENDING 0 / LOADING 1 / UNLOADING 5).
3. **Inspect the outcome, then decide.**
   - child became ACTIVE and registered **only names this mount forwards** → **ACCEPT**: the
     deferred definition is recorded in `forwardedDefinitions`, identity-tracked by
     `expectedDefinitions`/`managedRealmOf` and verified by `tools.get` exactly like a
     synchronous one (surface-name neutrality still enforced);
   - child **FAILED** → **REFUSE**, typed `SERVICE_MOUNT_FAILED` ("started a DEFERRED
     registration that failed …");
   - child still **transient after the bound** → **REFUSE**, typed ("did not settle within N
     macrotasks") — never hang, never accept an unverifiable shadow;
   - child PENDING only because a declared dependency is **absent everywhere** (the pinned
     module's optional `attachments`) → benign: the child never ran and registered nothing
     (the pre-#561 behaviour for modules without the optional capability);
   - a name registered through any fiber of the attach that **no fiber of the attach forwards**
     (the cross-mount coverage judgment, run once after all mounts) → **REFUSE**, typed, reason
     **names the name(s)**, then roll back. This is #561's protection, reframed: the refusal is
     about the *resulting definition* being uncovered, not about the child being deferred.
4. **Rollback on refusal.** Every fiber the mount created is disposed; a child that never
   settles keeps its own `inertia` pending upstream, so the refusal uses
   `disposeFiberBounded()` (bounded wait) instead of an unbounded `await fiber.dispose()` that
   would make the refusal itself hang. The preset surface comes back; no half shadow survives.

**Why this is not a second policy system:** the seam never evaluates a Member/ToolBinding lane,
never compiles a policy, never touches `EffectiveIo` (it is consumed downstream exactly as
before), and adds no new authority over tool *names* — the same `forwarded` predicate decides
who owns a name; the new code only asks, after settling, whether the result is inside that
predicate's coverage. `agent-bindings.mjs` is untouched.

## 3. RED — the pre-fix behaviour, quoted (host-free, real product entry points)

`probe-deferred-settle.mjs` drives `mountMemberA5sfRealm` → `attachA5sfNativeToolModules`
(product calls; `data:` module URLs for the synthetic shapes) with the pinned
`tests/deepseek-harness-test-use/packages/fs/tool-fs/lib/index.js`.
Baseline archived as `red-base.log` / `red-base.json` / `red-base-head.txt` at base
`cfdf87267…`: **4 FAIL / 1 PASS**.

Arm 1 (the headline: a routed mount **+** resolvable `attachments` **+** pinned module):

```
A1-accept-routed-read: mounted=false elapsedMs=9
{"name":"TeamServiceInstallError","code":"SERVICE_MOUNT_FAILED","detail":"native tool module null registers asynchronously and its deferred registration cannot run inside the routed mount (deferred registration failed, waiting on [attachments]); refusing the mount instead of leaving those tools on the unshadowed preset path"}
A1-accept-routed-read: FAIL — mounted: attach refused; surface unchanged: preset=["edit","read","read_image","write"] after=undefined; one read on the surface: false
```

Arm 2 (uncovered name must be refused *and named*) — the old code refused for the blanket
reason, so the assertion that the reason names the uncovered name failed:

```
A2-uncovered-deferred-refused: FAIL — reason NAMES the uncovered name: detail did not name the uncovered name: native tool module null registers asynchronously and its deferred registration cannot run inside the routed mount (deferred registration failed, waiting on [attachments]); …
```

Arm 3 (**control that already held**: a FAILED child was refused) — `PASS` at baseline.

Arm 4 (never-settling child must be refused *as not settled*, not by luck):

```
A4-unsettled-deferred-refused: FAIL — reason says it did not settle: detail: native tool module null registers asynchronously and its deferred registration cannot run inside the routed mount (deferred registration failed, waiting on [attachments]); …
```

Arm 5 (an ACCEPTED deferred shadow must be covered by the post-settle invalidation) could not
be reached at all: `A5-accepted-shadow-invalidates: FAIL — mounted: attach refused …`.

`red-base.log` also records the exact tree (`red-base-head.txt`:
`cfdf87267ef4d020f71071950cfc3cabf9cbaa02`).

## 4. GREEN — measured on this branch

### 4.1 The probe: 6/6 (`green-probe.log`, `probe-deferred-settle.{json,log}`)

```
A1-accept-routed-read: mounted=true elapsedMs=10 surface=["edit","read","read_image","write"]
A1-accept-routed-read: PASS
A6-absent-attachments-mounts: mounted=true elapsedMs=27 surface=["edit","read","write"]
A6-absent-attachments-mounts: PASS
A2-uncovered-deferred-refused: mounted=false elapsedMs=2
  … registered UNCOVERED name(s) ["x_a5sf_uncovered"] through a deferred registration: no fiber of this mount forwards them, so they would stay on the unshadowed preset definition with zero guard facts; refusing the mount (fail closed)
A2-uncovered-deferred-refused: PASS
A3-failed-deferred-refused: mounted=false elapsedMs=5
  … started a DEFERRED registration that failed inside the routed mount (deferred registration failed, waiting on [attachments,tools,systemPrompt]); …
A3-failed-deferred-refused: PASS
A4-unsettled-deferred-refused: mounted=false elapsedMs=51
  … started a DEFERRED registration that did not settle within 20 macrotasks (deferred registration state 1, waiting on [attachments,tools,systemPrompt]); refusing the mount instead of hanging on it or accepting a shadow it cannot verify
A4-unsettled-deferred-refused: PASS
A5-accepted-shadow-invalidates: mounted=true elapsedMs=6 surface=["edit","read","read_image","write"]
A5-accepted-shadow-invalidates: PASS
RESULT arms=6 PASS:6 FAIL:0
```

A1 asserts the routed `read` and the **deferred** `read_image` are both the routed definitions
(`!==` the preset ones), the surface name set is unchanged, and the routed read is confined.
A5 disposes every fiber the attach returned and observes
`realm.nativeInvalidation = {"schema":"a5sf-native-invalidation/1", "reason":"a managed native
tool is no longer shadowed …", "uncovered":["edit"], …}` — the accepted deferred shadow is
covered by the invalidation path, not just by the mount-time check, and admission then denies
every managed name.

### 4.2 The suite arms: TA11 rewritten, TA12–TA14 added

`tests/world-factory/a5sf-tool-axis.test.mjs` (17/17):

```
✔ TA11 DEFERRED ACCEPT: a module registering read_image from ctx.inject([attachments]) mounts, and BOTH the synchronous and the deferred definitions are the routed ones
✔ TA12 DEFERRED FAILED: a deferred child that throws is REFUSED, typed, and the surface is restored
✔ TA13 DEFERRED UNSETTLED: a deferred child that never resolves is REFUSED within the bound (no hang, no accept)
✔ TA14 DEFERRED UNCOVERED: a deferred name no fiber of the mount forwards is REFUSED and the reason NAMES it (#561 protection kept)
ℹ tests 17  ℹ pass 17  ℹ fail 0
```

TA11 proves, on the REAL pinned package, that the deferred `read_image` is the routed
definition (not the preset), that the ceiling router's `a5sfRegistrationRouting.forwarded`
contains `read_image` (the deferred name went through the same partition machinery), and that
the routed `read` still enforces the compiled intersection: in-lane `stat`+`readText` allow,
out-of-lane `stat` denies with `IO_READ_DENIED`, every guard fact attributed to the **binding**
realm (no fact from the preset path).

### 4.3 Everything else this lane re-ran

| gate | result | raw |
| --- | --- | --- |
| all a5sf node suites (9 files) | **105/105 pass** (assembly 13/13, tool-axis 17/17, route-c 8/8, p2-seam 14/14, p2-wiring 9/9, f1-ctx 9/9, read-gate 13/13, harness 10/10, evidence 12/12) | `all-a5sf-node-suites.log` |
| `npx vitest run a5sf` | **166/166, 11 files** | `vitest-a5sf.log` |
| laws (`u6-arc-a-fitness`, `u6-pr6-arc-d-adversarial`, `a4p3-intervention-lane-hygiene`) | **34/34** | `laws.log` |
| `pnpm typecheck` | pass | `typecheck.log` |
| `pnpm build` | pass | `build.log` |
| `node scripts/place-dist-glue.mjs` | 101 placements, byte-identical | `place-dist-glue.log` |
| `node scripts/check-artifacts-committed.mjs` | verdict=ok | `check-artifacts-committed.log` |
| `node scripts/check-artifacts-at-head.mjs` | verdict=ok, drift=0 | `check-artifacts-at-head.log` |
| `node scripts/eb3-evidence-guard.mjs --new-since origin/master` | pass | `eb3-evidence-guard.log` |
| `node scripts/ci-pr-gate.mjs --only graph-parse,state-freshness,blueprint-fence,lint-identities` | pass | `ci-pr-gate.log` |
| `node scripts/eb3-ci-required.mjs` | pass | `eb3-ci-required.log` |
| `node scripts/eb3-ci-negative-controls.mjs` | pass (all controls) | `eb3-negative-controls.log` |
| `git diff --check origin/master..HEAD` | clean | `diff-check.log` |
| `pnpm ci:local --base origin/master` | see §5 | `ci-local.log` |

**#561's protections that stay green:** the assembly suite's 13 arms are unchanged and pass,
including `A5SF_NATIVE_SHADOW_INVALIDATED` admission-deny, the late-name/removed-shadow
invalidations, the one-shot module refusal (`A5SF_MODULE_OBSERVATION_UNREPRODUCED`), the
binding-owner ambiguity refusal, the probe-disposal pin, and P0-2 (unattachable verification
listener refuses the attach). The deferred-specific protections are TA12/TA13/TA14 above.

## 5. p4t6 tie — MEASURED LAST on this tree

(`p4t6-measured-tie.log`, produced after every other gate in this lane; the scanner walks
`packages/**` only, so test/evidence files cannot move it.)

```
MEASURED p4t6 tie, MEASURED LAST on this tree (all files on disk at run time):
  scanSessionEventVocabulary: filesScanned=1428 files.length=1428
  ledger derived expected=1428 violations=[] loadViolations=[]
  A5SF booking expectedDelta={"from":1396,"to":1428}
```

Exact equality, no tolerance; nothing under `packages/**` was added.

## 6. `pnpm ci:local --base origin/master` — verbatim

The full transcript was 1.2 MiB (over the evidence bound); `ci-local.log` keeps the verdict
block and the failing test verbatim, and the isolation run at the SAME tree.

```
DSH-CI-LOCAL verdict=fail steps=6 failed=1 coverage=determined files=2 wall=238.3s

Test Files  1 failed | 482 passed (483)
     Tests  1 failed | 5992 passed (5993)        # a5g6-install-face-render GLUE-6 LEG B

 FAIL  packages/runtime/test/a5g6-install-face-render.test.ts > GLUE-6 LEG B — the plane renders ContentBlock[], not a String > the four definitions all carry a render that returns an array of typed text blocks
Error: Test timed out in 5000ms.
```

**It is the pre-existing ci-local load/timeout flake that `a5sf-assembly` documented at the
same 483-file tree, not this diff**: the file alone at THIS tree passes 5/5 in 2.36 s
(`ci-local-red-isolation.log`). The file is untouched by this branch (`git diff --stat
origin/master..HEAD` lists only `mount.ts` + `a5sf-tool-axis.test.mjs`); its 5 s default
timeout is eaten by the single `threads` pool importing 483 files. `coverage=determined`
(never the exit-2 case). The selected `node --test` leg ran TA1–TA14 **17/17 pass** inside
this same ci:local run.

## 7. Biggest risk for the reviewer

**The bound is a timing judgement.** `DEFERRED_SETTLE_ROUNDS = 20` macrotask rounds is not a
semantic promise: a module that registers its tools from a timer/IO callback slower than that
is now REFUSED (fail closed) instead of uploading an unverifiable shadow — which is the safe
direction, but it means "satisfiable deferred registration" is defined as "settles within 20
macrotasks on this machine". The pinned `dsh-tool-fs` settles in **one** macrotask
(`elapsedMs=10–50` for the whole attach in the probe), so the margin is ~20×; CI machines with
pathological scheduling could still trip it, and the refusal message names the macrotask bound
so a future lane can raise or replace the bound without changing the judgment. Two smaller
risks: (a) the identity check for a deferred definition is `tools.get(name, scope) ===
forwardedDefinitions.get(name)` — a module that re-registers the same name twice would make the
last definition the live one while `forwardedDefinitions` holds the first, which the
`tools/change` re-verification turns into a typed invalidation rather than a silent pass;
(b) the deferred name appears in **both** the ceiling's `observed` and its `forwarded` set
(after the settle re-read), so `expectedDefinitions`/`managedRealmOf` can be written twice for
the same name — idempotent for identical definitions, but a reviewer should confirm no
duplicate-accounting arm regresses (assembly 13/13 and TA9 cover the partition union).

## 8. Files changed

- `packages/runtime/team-services/src/mount.ts` — `routedModuleContext`, `isTransientFiber`,
  `settleDeferredRegistrationWindow`, `disposeFiberBounded`, `DEFERRED_SETTLE_ROUNDS`,
  `ROUTED_SERVICE_NAMES`; the old "registers asynchronously … refusing" block replaced by
  settle→inspect with typed FAILED/UNSETTLED refusals and the post-loop cross-mount UNCOVERED
  check; doc comments updated. (dist mirrors regenerated by `pnpm build` + `place-dist-glue`.)
- `tests/world-factory/a5sf-tool-axis.test.mjs` — TA11 rewritten to ACCEPT, TA12/13/14 added,
  header contract updated.
- `dev/agent-workflow/evidence/a5sf-deferred/` — this README, probe (five arms + the
  absent-optional control), archived RED baseline, GREEN logs, gate logs.

## 9. Deviations stated honestly

- **Arm 2 (UNCOVERED) is driven at the realm seam, not through
  `attachA5sfNativeToolModules`.** The row's expander (`nativeToolMountsOf`) ALWAYS emits a
  ceiling mount per module whose predicate forwards every name not owned by a mounted binding,
  plus a binding mount that must forward its own tool — so every name a fiber drops is
  delegated to a sibling fiber **by construction**, and an uncovered name cannot be produced
  through the row entry point. The invariant still belongs to the seam (direct callers, and any
  future routing change). The arm uses the object `mountMemberA5sfRealm` returns and calls
  `realm.mountNativeToolModules([{module, toolBindingIdentity:'dsh.fs/read'}], {scope})`
  (binding-only mount) with a synthetic `data:` module; TA14 pins the same shape in the suite.
  The row-level acceptance path is covered by A1/TA11 and the assembly suite.
- **No Host boot.** The P2-01 boot budget is spent; this lane proves the seam host-free and
  re-runs the existing suites. Re-booting the live Member is the coordinator's call.
- **A6 (absent `attachments`) was added in GREEN** (it is the benign-optional control for the
  new settle logic); the archived RED run has five arms, so its log shows 4 FAIL / 1 PASS rather
  than the six-arm GREEN shape.
