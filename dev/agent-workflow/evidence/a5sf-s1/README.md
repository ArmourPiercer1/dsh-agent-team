# a5sf S-1 — the SECOND AXIS is consumed by the execution path

**Lane:** `task/a5sf-s1-20261103` (worktree `.worktrees/a5sf-s1`), based on `origin/master` = `bb5315cd3`.
**Scope:** seam **S-1** of `dev/agent-workflow/evidence/a5sf-tool-axis/README.md` §4 — route each native tool
definition to the execution realm of its OWN `ToolBinding`, so the second axis holds:

```
EffectiveIo(member, tool, call) ⊆ MemberCeiling(member) ∩ ToolRestriction(member, tool)
```

**Answer: the axis now holds on the native path — after a REVIEW REPAIR.** A first cut (`8199b3ea0`) was
BLOCKED on a measured coverage hole: `read_image` registers from a DEFERRED `ctx.inject(['attachments'])`, escaped
the partition, and kept executing on the BASE definition with zero guard facts while every surface name stayed
equal. This tree closes it: the routed mount REFUSES a module whose deferred registration cannot run (§3.1), and
the row verifies COVERAGE by definition identity, not by name set. The mechanism itself was verified by the
reviewer independently (Proxy mutation → 7 red; tracker removal → TA10 red). The arm that used to measure the leak (TA2 / `red-arm.mjs`)
is inverted: a locator the CEILING allows but the `read` TOOL RESTRICTION denies is **REFUSED**, with exactly
one `a5sf-guard-consult/1` fact attributed to the **binding** realm (`realm:"binding"`,
`toolBindingIdentity:"dsh.fs/read"`). `EffectiveIo` is **consumed** (it is the lane of the realm that ran), never
recomputed, and a tool restriction never reaches a sibling tool.

**Discipline actually obeyed:** CORE PATCH BUDGET = 0 (upstream untouched, `tests/deepseek-harness-test-use/`
read-only); **zero Host boots**, zero ports, no `DSH_HOME`, no `tests/homes/**`; **no core file patched**;
`tests/deepseek-harness-test-use` is never written (symlinked only — see §7).

---

## 1. What S-1 changed

S-1 is the proposal the a5sf-tool-axis evidence §4 admitted and S-2/S-3 were rejected in favour of:

| | |
| --- | --- |
| **S-1 (landed)** | a binding-targeted native mount runs in the realm of that binding, behind a registration router that forwards only the definitions/prompt-sections whose tool name belongs to that binding |
| **S-2 (rejected, still rejected)** | a call-scoped multiplexer / `AsyncLocalStorage` tool identity: it changes the effect boundary and re-resolves policy per call |
| **S-3 (rejected, still rejected)** | one realm per tool: it widens the realm topology and only duplicates the problem |

### Files

| file | change |
| --- | --- |
| `packages/runtime/team-services/src/mount.ts` | `NativeToolModuleMount.toolBindingIdentity`; per-fiber **registration router** (`createRegistrationRouters` / `createRoutedService`); binding-targeted routing (`const target = binding?.ctx ?? memberTarget`); fail-closed validation (a binding-targeted mount that forwards none of its own tool is a typed `SERVICE_MOUNT_FAILED`); per-fiber partition receipt `a5sfRegistrationRouting`; rollback of created fibers on any failure |
| `packages/runtime/src/plugin/live/a5sf-realm-row.mjs` | `nativeToolMountsOf(nativeToolModules, realm)`: one mount per (module × binding) plus the ceiling mount; the surface-neutrality union check is unchanged |
| `tests/world-factory/a5sf-tool-axis.test.mjs` | the sentinel inverted (TA2) + siblings (TA6) + no-widening (TA7) + unbound fallback (TA8) + surface-per-fiber / refusal (TA9) + teardown (TA10); TA5 re-pinned from "never addresses a binding realm" to "addresses it behind the router and never compiles a lane" |
| `packages/runtime/dist/...` | the built mirrors of the two sources (place-dist-glue) |
| `dev/agent-workflow/evidence/a5sf-s1/**` | this evidence |

`install.ts` and `agent-bindings.mjs` were **not** touched (no glue change was needed: the attach already
receives the mounted realm).

### The mechanism, and the two traps it had to survive

`mountNativeToolModules` now computes the tool names owned by the mounted binding realms
(`toolNameOfBindingIdentity`: the last `/` segment, `dsh.fs/read` → `read`), and for each mount:

1. picks `target = binding?.ctx ?? memberTarget` (binding realm, ceiling fallback);
2. creates two **fresh isolate labels** so the shadow `tools`/`systemPrompt` services are visible only to this
   fiber's own subtree;
3. mounts a router plugin that `provide`s the routed services and THEN mounts the module as its child;
4. replaces each module registration with a per-partition forwarding decision;
5. awaits the inner module fiber, verifies the partition, and publishes the receipt;
6. on refusal/failure, disposes every fiber it created before rethrowing.

Two measured traps, both now pinned by tests:

* **Re-wrap (silent no-op).** `new Proxy(realTools, ...)` inherits the live service's tracker symbol, so
  Cordis re-wraps the proxy and reads `register`/`section` from the **prototype descriptor**, bypassing the
  interceptor: the first run registered the module wholesale and threw
  `prompt section "tool:read" is already registered in this scope`. Fix: the router target is
  `Object.create(null)`, every symbol resolves to the router's own state, non-overridden members are delegated
  to the real service. This is `createRoutedService`.
* **Effect ownership (leak on teardown).** A router WITHOUT the service tracker makes
  `tools.register()` run with the realm's ctx, so the registration effect belongs to the REALM fiber and the
  shadow survives the router teardown (measured: the preset `read` never came back after the fibers were
  disposed — TA10 caught it). Fix: the router carries the service tracker
  (`{ associate: 'a5sfRouter', property: 'ctx' }`) so Cordis binds it to the **accessing** context, and the
  forwarded call is `realRegister.call({ layers, ctx: owningContextOf(this, targetCtx) }, definition)` — the
  effect now belongs to the module fiber and disposal unregisters it. This is what makes arm 6 real.

---

## 2. RED → GREEN (the sentinel is inverted, not deleted)

The arm is `dev/agent-workflow/evidence/a5sf-tool-axis/red-arm.mjs` (unchanged, as the previous lane wrote it);
it drives the PRODUCT seam (`mountMemberA5sfRealm` + `attachA5sfNativeToolModules`) with the REAL pinned
`@deepseek-ai/dsh-tool-fs`, and asserts the INVARIANT.

`red-arm-red.log` — at `origin/master` sources (`git checkout origin/master -- <two sources>`, then restored):

```
RED-EXIT=1
RED-ARM: FAIL — DESIRED: a ceiling-allowed, restriction-denied read must be REFUSED
false !== true
```

`red-arm-green.log` — same command, this tree:

```
EXIT=0
dispatch isError=true text="Error: authored locator '…/ceiling-only.txt' is outside every allow subtree of the lane"
facts: {"schema":"a5sf-guard-consult/1","realm":"binding","memberIdentity":"member-red-arm-a","toolBindingIdentity":"dsh.fs/read","policyRevision":"a5sf1:member-red-arm-a:g1","method":"stat","locator":"…/ceiling-only.txt","decision":"deny","decidedBy":"IO_READ_DENIED","sequence":1,"observedAt":"…"}
RED-ARM: PASS — the tool axis is consumed by the execution path
```

The `a5sf-tool-axis` sentinel (TA2) that asserted the LEAK is replaced by the invariant assertion; the suite's
old structural pin (TA5: "the mount seam never addresses a binding realm") is re-aimed at the new mechanism
("it addresses it through the router, and never compiles a lane"). Nothing is deleted to make the suite green.

---

## 3. The acceptance arms, measured

`arm-probe.mjs` (this directory) drives the same product seam and prints one line per arm; the permanent gates are
`tests/world-factory/a5sf-tool-axis.test.mjs` (14/14, TA2/TA6…TA11). Raw: `six-arms.log` (`ARMS: PASS 8/8`).

| arm | what it measures | measured |
| --- | --- | --- |
| **1 — TA2 inverted** | ceiling allows, read restriction denies ⇒ REFUSED; ONE fact, `realm:"binding"`, `toolBindingIdentity:"dsh.fs/read"`, `IO_READ_DENIED`; the base Provider is never asked | `REFUSED … facts=[binding/dsh.fs/read/stat/deny/IO_READ_DENIED]` |
| **2 — siblings** | `read` restricted, `write` unbound ⇒ `write` runs on the CEILING: inside write ok, outside denied by the ceiling, and no fact carries the read binding identity | `ceilingFiber.forwarded=["write","edit"] readFiber.forwarded=["read"] insideWrite=ok outsideWrite=denied facts=[member/null/writeText/allow/ALLOW, member/null/writeText/deny/IO_WRITE_DENIED]` |
| **3 — no widening** | ceiling denies + a WIDER restriction ⇒ still DENIED (the lane is the compiled intersection) | `compiledReadAllow=["…/inside"] nativeRead=DENIED facts=[binding/dsh.fs/read/stat/deny/IO_READ_DENIED]` |
| **4 — unbound tool** | no binding ⇒ ceiling fallback: ONE `read`, surface unchanged, member-realm facts only | `fibers=1 forwarded=["read","write","edit"] read=ok facts=[member/null/stat/allow, member/null/readText/allow]` |
| **5 — surface neutrality per fiber** | the fibers PARTITION the module surface (no name/section registered twice, union = pre-mount surface); a module that would add a tool is refused and everything it mounted is disposed | `partition=[{ceiling:[write,edit] sections[tool:write,tool:edit]},{binding:[read] sections[tool:read]}] surfaceBefore=["read","write","edit"] surfaceAfter=["read","write","edit"]`; refusal: `would CHANGE the Member's model-visible tool surface`, surface unchanged, `factsDelta=0` |
| **6 — teardown** | router fibers disposed BEFORE the binding realms and the Member installation; ONE throwing fiber is reported and strands nothing (sibling disposed, confined provider gone, preset definition back) | `disposeOrder=[nativeFibers,bindingRealms,memberInstallation] fibers=2 throwingFiberReported=true siblingDisposed=true presetRestored=true` |
| **7 — DEFERRED (the review blocker)** | a world with `attachments` mounted makes the pinned module register `read_image` from a deferred `ctx.inject`; the attach REFUSES, the surface is restored, and the unshadowed path is shown to consult nothing (0 facts) — so the leak can never be the live path | `presetSurface=["read","write","edit","read_image"] refused="SERVICE_MOUNT_FAILED: native tool module null registers asynchronously …" shadowAfterRefusal=false baseReadFacts=0` |
| **8 — S-2 not used** | no call-scoped multiplexer, no `AsyncLocalStorage`, no `execute` wrapper: the effect boundary is untouched (`exec.signal` only) | structural pin TA5: `doesNotMatch(mountSource, /AsyncLocalStorage|compileEffectiveIo|\.execute[=(]/)`; the probe's readings come from `mount.ts`/the row, not from a tool-identity channel |

### 3.1 The review blocker: deferred registration (`read_image`) and what this tree does about it

MEASURED on `8199b3ea0` with the SAME pinned module, a world where `attachments` is mounted, and the ceiling +
`dsh.fs/read` binding:

```
before = ["read","write","edit","read_image"]      attach ACCEPTED, 2 fibers
ceiling fiber forwarded ["write","edit"]           binding fiber forwarded ["read"]
read_image: inAnyReceipt=false                     shadowed=false (same object as the preset row)
surface check: GREEN (name sets equal)             a read_image call: ZERO a5sf-guard-consult facts
```

ROOT CAUSE, measured: `@deepseek-ai/dsh-tool-fs`'s `apply` ends with
`ctx.inject(['attachments'], (imageCtx) => applyReadImageTool(imageCtx))`, i.e. a CHILD plugin whose
registration happens after `apply` returns. Under the router's isolated service scope that child either stays
PENDING forever (old structure) or starts and throws `cannot get property "tools" without inject` (module
mounted from the active router fiber) — either way `read_image` is NEVER registered through the router, so the
preset definition keeps serving it, unguarded, while `a5sfAgentToolSurface` compares only NAMES and stays green.

WHAT THIS TREE DOES — **refuse, not route** (the reviewer's fallback, chosen deliberately):

* `mount.ts` records every fiber created while a mount runs (Cordis `internal/plugin`), filters it to the
  router fiber's own subtree, settles one macrotask after `await inner`, and refuses with a typed
  `SERVICE_MOUNT_FAILED` if a descendant fiber did not reach ACTIVE **and** one of its inject names is
  resolvable in the surrounding Member scope. That second condition is what keeps the pinned module mountable:
  it ALWAYS declares `ctx.inject(['attachments'])`, and when the Member genuinely has no image store the
  deferred registration is an optional capability that never existed — benign. When the Member DOES have
  `attachments` (the dangerous shape: the preset would have registered `read_image`), the mount is refused.
  Refusal disposes the router fiber, so the surface is restored exactly and no half-shadow survives.
* `a5sf-realm-row.mjs` adds a COVERAGE invariant on top of the name-set check: for every name a router reports
  as forwarded, `tools.get(name, scope)` MUST be a definition this attach created, not the pre-attach one (or
  absent). Name equality alone cannot see a tool that "registered" without shadowing.

**Why not support it.** Making the deferred child run inside the routed scope would require the shadow
services to behave like real `Service` instances for an inject child that never declares them — a different
S-2-style mechanism (per-call identity) rather than a routing tweak, and we could not do it honestly inside
this seam. So: **refused**. Consequence, stated plainly: a Member that mounts the native `dsh-tool-fs` **and**
has an `attachments` store cannot use S-1's native re-mount — the attach fails closed at setup. That is the
honest trade: an unguarded `read_image` is worse than a refused mount, and the Team tool plane's own governed
`read_image` row (GLUE-7) does not take this path.

Key point for a reviewer: the partition is derived from `toolBindingIdentity` (P1's compiled answer) and the
tool NAME. No lane, blueprint or ceiling is read at the mount seam — the router only asks "does this name belong
to this binding?".

---

## 4. Gates

| gate | result | raw |
| --- | --- | --- |
| RED arm (before / after) | FAIL → **PASS** | `red-arm-red.log`, `red-arm-green.log` |
| all a5sf node suites (8 files) | **89/89 pass** (12+9+10+8+14+9+13+14) | `all-a5sf-node-suites.log` |
| `a5sf-tool-axis` specifically | **14/14** (TA1–TA11) | `tool-axis-suite.log` |
| `npx vitest run a5sf` | **166/166, 11 files** | `vitest-a5sf.log` |
| p4t6 + law suites (`u6-arc-a-fitness`, `u6-pr6-arc-d-adversarial`, `a4p3-intervention-lane-hygiene`) | **54/54** (20+12+13+9) | `law-and-p4t6.log` |
| `pnpm typecheck` (all packages) | pass | `typecheck.log` |
| `pnpm build` | pass | `build.log` |
| `node scripts/place-dist-glue.mjs` | 101 placements, byte-identical; dist mirrors regenerated | `place-dist-glue.log` |
| `node scripts/check-artifacts-committed.mjs` | pass (after the commit) | `check-artifacts-committed.log` |
| `node scripts/check-artifacts-at-head.mjs` | pass (after the commit) | `check-artifacts-at-head.log` |
| `node scripts/eb3-evidence-guard.mjs` | pass, `added=… findings=0` | `eb3-evidence-guard.log` |
| `node scripts/eb3-ci-required.mjs` | pass | `eb3-ci-required.log` |
| `node scripts/eb3-ci-negative-controls.mjs` | **26/26 controls** behaved as required | `eb3-negative-controls.log` |
| `git diff --check` | clean | `git-diff-check.log` |
| `pnpm ci:local` | **`DSH-CI-LOCAL verdict=pass steps=6 failed=0 coverage=determined files=2 wall=234.0s`** (483 files, 5993 tests) AT THIS HEAD (pre-repair: 240.2 s, see §4.1) | `ci-local.log` (derived summary; raw 1.2 MB capture not committed) |

No `eb3-run-manifest` record was added: this lane boots no Host and produces no run record (the manifest binds
run records to `as20261102r1`; adding one without a boot would be a false record).

### 4.1 The `pnpm ci:local` verdict, quoted verbatim — and the two red attempts before it

Reported verdict ON THIS HEAD (`ci-local.log`) — the repair did not need a re-run of the flake ladder:

```
DSH-CI-LOCAL verdict=pass steps=6 failed=0 coverage=determined files=2 wall=234.0s
 Test Files  483 passed (483)
      Tests  5993 passed (5993)
  14/14 a5sf-tool-axis arms pass inside the same run (TA1…TA11)
```

The earlier run on the pre-repair tree (attempt 3 after two flake reds, 240.2 s) and the two red attempts
remain below as the flake record; they are unchanged history, not this head's measurement.

**This lane does NOT report a pass it did not measure, and it does not hide the reds.** The first two attempts
returned `verdict=fail` (exit 1, coverage DETERMINED — never the exit 2 "undetermined" case):

| attempt | red | measured |
| --- | --- | --- |
| 1 | `a3p4-pr4-production-entry-regression` E3 — "Test timed out in 5000ms" | `verdict=fail steps=6 failed=1 … wall=255.5s`; the SAME file alone: **20/20 pass** (`flake-isolation-a3p4-e3.log`) |
| 2 | `a5g6-install-face-render` GLUE-6 LEG B (5 s timeout) and `alpha5-glob-backend` X3 | `verdict=fail steps=6 failed=1 … wall=233.9s` (`ci-local-flake-run2.log`); both files alone: **58/58 pass** (`flake-isolation-a5g6-and-glob.log`) |

Diagnosis is measured, not assumed (`ci-local-flake-note.txt`): ci-local selects the WHOLE `packages/runtime`
vitest tree (483 files in ONE in-process `threads` pool) which contains deliberately CPU-heavy adversarial
suites (one file alone burns 217 s), while `vitest.config.ts` leaves `testTimeout` at vitest's 5 s default — on a
loaded box a 5-s default timeout fires in an unrelated test. The three failures landed in three DIFFERENT files
across two attempts (never the same one twice), each passed in isolation, and none is touched by this lane
(`agent-bindings.mjs` is byte-identical to `origin/master`, sha256 `df9b46af…`; neither `a5g6-install-face-render`
nor `alpha5-glob-backend` reads `mount.ts`).

---

## 5. p4t6 — MEASURED LAST on this tree

`p4t6-measured-tie.log` (measured after every file in this directory was on disk):

```
MEASURED p4t6 tie on THIS tree (all files on disk, before commit):
  scanSessionEventVocabulary: filesScanned=1428 files.length=1428
  ledger derived expected=1428 violations=[]
  A5SF booking expectedDelta={"from":1396,"to":1428}
```

The booking (`packages/testkit/test/p4t6-bookings/a5sf.json`) is **unchanged**: this lane adds no scannable
`packages/**` path (the new test arms live in `tests/**`, the evidence in `dev/**`), and an edit to an
already-counted file is not an increment. Exact equality stays (ADR A5-17): no tolerance, no skip, no exclusion.

---

## 6. Protected center

**None touched.** `dev/agent-workflow/ledgers/arc-a-protected-center.json` protects, under
`packages/runtime/src/plugin/live/`, only `agent-bindings.mjs` and `pa-mount-registry.mjs`:

| file | sha256 | status |
| --- | --- | --- |
| `packages/runtime/src/plugin/live/agent-bindings.mjs` | `df9b46af67cd903641285760cd72a78e57986e87959b2fbdbaf3f86dd6c6464b` | unchanged — matches the standing ARC-A override (PR #558) |
| `packages/runtime/src/plugin/live/pa-mount-registry.mjs` | `fa1d831d559d1016f6ee99e43436d3155b3f0c493a76fda021cc228f4c14510d` | unchanged |

`mount.ts`, `install.ts` and `a5sf-realm-row.mjs` are NOT in the protected center (the ARC-A fitness suite
passes unchanged). No ARC-A override was booked.

---

## 7. Residual limits and the single biggest risk

Stated so no reader over-claims:

1. **Host-free only.** This lane proves the seam against the real tool runtime + the real pinned native package
   in an in-process unit root. It does NOT boot a Host, does NOT prove a model-visible turn, and does NOT
   prove OS/kernel enforcement (that is the OS half, still `NOT_REACHED` in
   `dev/agent-workflow/evidence/a5sf-live-native3/`).
2. **Surface check is tool-NAME based.** `a5sfAgentToolSurface` compares tool names; prompt sections are
   asserted separately (TA9a counts `tool:read`/`tool:write` exactly once and compares the assembled section
   list). A module naming a section not of the form `tool:<toolname>` is forwarded to the ceiling fiber exactly
   once — that is the intended rule, but it is a rule a future module could violate.
3. **The sharp edge (single biggest risk for the reviewer): per-fiber teardown and duplicate-section
   invariants.** A module is now `apply`-ed once per partition (ceiling + each binding), not once. Any module
   that does more than register tools/sections — provisions a service, installs event hooks, mutates shared
   state — runs that side effect N+1 times, and its teardown must be correct per fiber. Today's native
   `dsh-tool-fs` is NOT "pure registration": it also defers `read_image` behind `ctx.inject(['attachments'])`
   (measured, §3.1) — that shape is now REFUSED rather than silently left on BASE, and the router refuses any
   partition that would duplicate a name or a section. The discipline is still a contract on module authors,
   not an enforced property of the loader. A module whose section name does not follow `tool:<name>` would register that section only on the
   ceiling fiber (once, by design) yet its tool body would run in two realms. The next lane that admits a second
   native tool module should re-run TA9/TA10 with that module, not assume this proof transfers.
4. **Deferred registration is refused, not supported.** Any module that registers from `ctx.inject(...)` is
   refused when the dependency is resolvable in the Member scope (§3.1). A future module that defers a
   BINDING-OWNED tool would therefore make the Member fail closed at setup rather than execute — correct, but
   it is a capability limit of this seam, not a bug to be papered over.
5. **The tracker contract is measured, not documented upstream.** The router depends on the Cordis `Service`
   tracker (`{associate, property:'ctx'}`) to bind registrations to the module fiber. It is the same public
   mechanism the tool runtime itself relies on, but a Cordis major upgrade could change it — TA10 (preset
   restoration after disposing ONLY the binding fiber) is the guard that would go red.

---

## 8. Reproduce

```bash
cd .worktrees/a5sf-s1
node dev/agent-workflow/evidence/a5sf-tool-axis/red-arm.mjs                      # GREEN (exit 0)
node --test tests/world-factory/a5sf-tool-axis.test.mjs                         # 13/13
node dev/agent-workflow/evidence/a5sf-s1/arm-probe.mjs                          # SIX-ARMS: PASS 7/7
npx vitest run a5sf                                                             # 166/166
```

RED: `git checkout origin/master -- packages/runtime/team-services/src/mount.ts \
  packages/runtime/src/plugin/live/a5sf-realm-row.mjs` then the arm (exit 1), then restore.

## 9. Raw index

| file | what |
| --- | --- |
| `arm-probe.mjs`, `six-arms.log` | the six acceptance arms, driven through the product seam |
| `red-arm-red.log`, `red-arm-green.log` | the sentinel before/after |
| `ta11-red.log`, `ta11-green.log` | the DEFERRED arm on the pre-fix sources (Missing expected rejection) and on this tree |
| `tool-axis-suite.log`, `all-a5sf-node-suites.log` | the regression suites |
| `vitest-a5sf.log`, `law-and-p4t6.log`, `p4t6-measured-tie.log` | vitest, law, the measured tie |
| `typecheck.log`, `build.log`, `place-dist-glue.log` | build chain |
| `check-artifacts-committed.log`, `check-artifacts-at-head.log` | artifact discipline |
| `eb3-*.log`, `git-diff-check.log` | EB3 gates + whitespace |
| `ci-local.log` | the `pnpm ci:local` verdict (pass, §4.1) |
| `ci-local-flake-run2.log`, `ci-local-flake-note.txt`, `flake-isolation-*.log` | the two red attempts, the failure-mode diagnosis and the isolation re-runs |

## The two `ci:local` logs are derived summaries

Both raw captures exceeded the evidence guard's 1 MiB bound, so what is committed is the
**verbatim verdict and aggregate lines plus the failing lines**, not the 1.2 MB capture.
That is the guard's intended remedy ("commit the derived numbers instead") rather than an
allowlist entry, and it means the full per-test output of those two runs is not preserved —
stated here so nobody assumes the raw transcript is in the tree.
