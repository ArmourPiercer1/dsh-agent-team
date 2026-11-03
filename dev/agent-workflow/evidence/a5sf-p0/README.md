# a5sf P0 — `NoStaleShadow ≠ NoUnconfinedExecution`

**Lane:** close the P0 an independent review found in the merged assembly lane (#569, `84e9348fc`): after a
managed Member's native shadow is **invalidated**, the Member's next tool call resolved the **preset**
definition and executed with **zero guard facts** — a silent fallback to unconstrained execution for a
Member declared managed.

| fact | value |
| --- | --- |
| branch | `task/a5sf-p0-20261103` |
| worktree | `.worktrees/a5sf-p0` |
| base | `origin/master` = **`84e9348fc`** (verified `git fetch origin` + `git log --oneline -1 origin/master`) |
| code head | `bacd07284` (later commits are evidence-only and change no source) |
| authority bound | `dev/engineering/current-authority.json` → `as20261102r1`, content digest `sha256:0f730fada65b8d393f0450729dc94d79ef05c3be83c94d2c590b514f7164eae4` (`node scripts/current-authority.mjs`, ok) |
| Host boots | **ZERO** (the reservation stands: the P2-01 boot is the acceptance run *after* this fix) |
| CORE PATCH BUDGET | **0** — no upstream file touched; `packages/runtime/src/plugin/live/agent-bindings.mjs` byte-identical (`sha256 df9b46af…6464b`, same as S-1/assembly/master); `packages/runtime/tsconfig.build.json` untouched (comment-free) |

---

## 1. The defect, stated exactly

Before this lane, invalidation: recorded `a5sf-native-invalidation/1`, detached verification, disposed the
native fibers, restored the preset surface, refused **re-mounting**. It did **not** refuse the already-running
Member's next call: with the shadow gone, `tools.get(name, scope)` returned the **preset** definition, and the
call executed on the BASE provider with **zero** `a5sf-guard-consult/1` facts. The merged assembly test even
asserted that path as expected (`definitionOf(read) === presetRead` **and** the call returning
`CEILING_ONLY`). That is the leak this lane closes.

## 2. RED first (against the base tree, before any source edit)

The new/updated arms were written first, then run on unmodified `84e9348fc` sources
(`red-assembly.log`, exit 1, **9 pass / 2 fail**):

```
✖ P0-1 the SAME out-of-lane read is REFUSED after invalidation, never served by the visible preset
  AssertionError [ERR_ASSERTION]: the SAME out-of-lane read must be REFUSED after invalidation: CEILING_ONLY
  false !== true

✖ GAP2b a routed shadow removed AFTER the settle window is detected, disposed and RECORDED
  AssertionError [ERR_ASSERTION]: managed 'read' must be REFUSED after invalidation, not served by the preset: CEILING_ONLY
```

Both RED messages are the leak itself: the **forbidden bytes are returned** (`CEILING_ONLY`) with
`isError: false` — no typed refusal, zero facts. The GAP2b arm previously **pinned the leak as expected**
(preset definition restored ⇒ preset serves); it now pins the opposite.

## 3. The seam that was gated — `tools/pre-execute` admission (not a second policy system)

`packages/runtime/team-services/src/mount.ts` already owns the realm. On a successful native attach it now
arms **two** listeners on the Member ctx (the same ctx that carries `tools/change`):

1. `tools/change` — continuous re-verification (unchanged semantics, now fail-closed, §5).
2. **`tools/pre-execute`** — the existing Member **admission stage** every `tools.execute` call passes through
   (`ToolRuntime.prepareExecution` → `ctx.waterfall(carrier, 'tools/pre-execute', exec, fallback)` → guards).
   While `nativeInvalidation !== null`, a covered name returns
   `{ kind: 'deny', reason, info: { name: 'A5sfNativeShadowInvalidatedError', code: 'A5SF_NATIVE_SHADOW_INVALIDATED' } }`;
   every other call falls through to `next()`.

**Why the admission check and not a “refusing definition” forwarded by the registration router.**
The router *can* forward definitions, but the tool registry rejects two registrations of one name **inside one
scope layer** (`NamedEntries` duplicate law). A refusing definition therefore cannot coexist with the live
shadow in that layer: it could only be installed *after* the shadow's fiber is disposed, which would leave a
real dispatch window (and would still need a second registration to keep the name). The admission deny has no
registration, no lifecycle, and flips **synchronously** with the record. It is the existing admission check the
task explicitly allows, and it is typed through the same `error.info` channel the registry already materializes.

**Why it is not a second policy system.** The listener reads exactly two in-memory facts — the invalidation
record (one boolean/record) and the set of names this attach covered. It evaluates **no** lane, calls **no**
compiler, does **not** touch `EffectiveIo` (TA5's structural pin `doesNotMatch(mountSource,
/AsyncLocalStorage|compileEffectiveIo|\.execute[=(]/)` still passes), and has no write path.

## 4. Order: refuse first, then dispose

In `invalidateNativeShadow` the record is assigned **before** the teardown is started
(`invalidation = record` → log → `disposeNative()`). Consequences, by construction:

- a call that arrives *during* teardown is denied at admission (the deny is armed before any fiber goes away);
- a call already **in flight** has passed admission and continues on its **confined** body — the pre-existing
  cancellation/drain path owns it; there is no window in which an unguarded definition serves the Member;
- eligibility is **never** restored on this path: `mountNativeToolModules` refuses an invalidated realm
  (`/invalidated/i`), and the admission deny lives until the whole realm is disposed.

## 5. `tools/change` unavailability — REFUSED (fail-closed, typed)

`armVerification` used to catch a `ctx.on` fault and silently degrade to the two bounded rounds. It now
**refuses the managed attach**: if `ctx.on` is absent/throws/returns no disposer for `tools/change` **or**
`tools/pre-execute`, it throws `TeamServiceInstallError('SERVICE_MOUNT_FAILED', …)`, the caller rolls the
just-created fibers back, and the Member's setup fails closed (message names the listener and states that a
silent bounded-round fallback is not taken). Arm **P0-2** pins this by making `ctx.on('tools/change')` throw:
the attach rejects typed, the preset definition is untouched, and `nativeInvalidation` stays `null` (a refusal is
not an event).

## 6. P1 probe cost — searched, no trusted-source registry exists; `observeOnly` left as-is

The reviewer asked to avoid the `observeOnly` probe when ownership is already known from an existing trusted
source (`source/version/digest + declared tools`). Searched this repo:

| candidate | what it carries | can it answer native-module → tool ownership? |
| --- | --- | --- |
| `packages/tools/families/manifest.json` (`u7-family-manifest/1`) | module basenames + reviewed **sha256**, kernel capability backings | **No** — no declared tool list; covers the governed *family* modules, not `a5sfNativeToolModules` |
| `@deepseek-ai/dsh-agent-preset-registry` `PresetDefinition` (upstream, pinned) | plugin composition / display | **No** — no tool-name inventory |
| row config `a5sfNativeToolModules` (`packages/runtime/src/plugin/types.ts`) | `{ url, config? }` per entry | **No** — no `source/version/digest/declaredTools` |
| the mounted binding identities | `<owner>/<tool>` | only the **binding-owned** names, not a module's full surface |

**No such registry exists**, so `observeOnly` remains the explicit trusted fallback for modules whose ownership
is unknown, and native modules are still **not required to be idempotent** (C1's `A5SF_MODULE_OBSERVATION_UNREPRODUCED`
reconciliation is unchanged and still GREEN). Cost is not reduced by invention; it is reduced only if a real
trusted-source registry is added later.

## 7. GREEN — every arm on this tree

`green-assembly-2.log` (final run after the last hardening edit): **12/12 pass**.

```
✔ GAP1a a binding is assigned to the module that OWNS its tool; the composition mounts and routes
✔ GAP1b module B is ceiling-only, its tool still executes, and it never takes the binding lane
✔ GAP1c a binding whose tool NO module owns is REFUSED with a typed error and mounts nothing
✔ GAP2a a get()-less tools row REFUSES the configged native mount (coverage is never silently skipped)
✔ GAP2b a routed shadow removed AFTER the settle window is detected, disposed and RECORDED   (now: every managed name REFUSED)
✔ GAP2b-late-new-name a tool that APPEARS after the settle window invalidates (S-1 +30 ms escape)
✔ GAP2b-control same-turn setup additions (the Team tools) do not invalidate
✔ GAP2b-control a tool already on the surface at arm time does not invalidate the routed shadow
✔ C1 a ONE-SHOT module is REFUSED when the probe consumed its only registration
✔ C2 the ownership probes are disposed before the real mounts (live-effect count)
✔ P0-1 the SAME out-of-lane read is REFUSED after invalidation, never served by the visible preset
✔ P0-2 a managed attach whose verification listener cannot attach is REFUSED (fail closed, typed)
```

### P0-1 (the acceptance) — what it actually proves, in order

1. attach; post-settle verification green; confined in-lane `read` → `'INSIDE\n'` (the shadow works);
2. the same `read` **out of lane** → refused **before** invalidation (the binding lane is real);
3. a **late name** (`x_p0_late_unrelated`, +10 ms) → `a5sf-native-invalidation/1`
   (`surfaceAdded` names it); after teardown the **preset read definition is visible**;
4. the **same out-of-lane read** → `isError: true`, `info.code === 'A5SF_NATIVE_SHADOW_INVALIDATED'`,
   `CEILING_ONLY` **not** in the text, message names `member-assembly-a`, `dsh.fs/read` and carries the
   record's `reason` verbatim;
5. an **in-lane** read → also `A5SF_NATIVE_SHADOW_INVALIDATED`, `INSIDE` **not** returned (out of service, not
   “silently less governed”);
6. a ceiling-partition managed tool (`write`) → typed refusal naming the **ceiling** realm;
7. the same realm **refuses** `mountNativeToolModules` (`/invalidated/i`) — no partial re-attach;
8. **full re-assembly**: dispose the realm, mount a **new** realm and attach again on the SAME agent/tool plane
   → verification green, confined in-lane read returns `INSIDE`, and the out-of-lane read is still refused
   (eligibility returned only through a verified full assembly, and the lane did not widen).

## 8. Gates

| gate | result | raw |
| --- | --- | --- |
| RED arms on base `84e9348fc` | **9 pass / 2 fail** (leak reproduced, bytes returned) | `red-assembly.log` |
| assembly suite (final tree) | **12/12** | `green-assembly-1.log`, `green-assembly-2.log` |
| all a5sf node suites (9 files) | **101/101** (12+12+9+10+8+14+9+13+14) | `all-a5sf-node-suites.log` |
| `pnpm exec vitest run a5sf` | **166/166, 11 files** | `vitest-a5sf.log` |
| p4t6 + laws (`u6-arc-a-fitness`, `u6-pr6-arc-d-adversarial`, `a4p3-intervention-lane-hygiene`) | **54/54** | `law-and-p4t6.log` |
| `pnpm typecheck` | pass | `typecheck.log` |
| `pnpm build` | pass | `build.log` |
| `node scripts/place-dist-glue.mjs` | done, 101 placements | `place-dist-glue.log` |
| `node scripts/check-artifacts-committed.mjs` | `verdict=ok compared=1916 glue=101` | `check-artifacts-committed.log` |
| `node scripts/check-artifacts-at-head.mjs` | `verdict=ok compared=1916 drift=0` — HEAD carries its own build | `check-artifacts-at-head.log` |
| `node scripts/eb3-evidence-guard.mjs` | `pass added=18 bound=1048576 exempted=0 findings=0 base=origin/master` | `eb3-evidence-guard.log` |
| `node scripts/eb3-ci-required.mjs` | `pass workflows=9 findings=0` | `eb3-ci-required.log` |
| `node scripts/eb3-ci-negative-controls.mjs` | `26/26 control(s) behaved as required` | `eb3-negative-controls.log` |
| `git diff --check origin/master..HEAD` | clean | committed tree |
| `pnpm ci:local` | **FAIL — whole-tree load/timeout flake; §10.1, red green in isolation** | `ci-local-summary.log` (derived; the 1.2 MB raw capture was NOT committed), `ci-local-red-isolation.log` |

## 9. p4t6 — MEASURED LAST on this tree

```
MEASURED p4t6 tie, MEASURED LAST on this tree (all files on disk at run time):
  scanSessionEventVocabulary: filesScanned=1428 files.length=1428 hits={"eventString":15,"payloadSymbol":0,"declarationMerge":0,"total":15}
  ledger derived expected=1428 violations=[]   (p4t6 suite asserts filesScanned === ledger.expected: 20/20 pass)
  A5SF booking expectedDelta=none (no scannable packages/** path added: code edit rides the already-counted mount.ts; arms ride the already-counted tests/world-factory/a5sf-assembly.test.mjs; evidence is dev/**)
```

Exact equality, no tolerance. Raw: `p4t6-scanner-count.log`, `law-and-p4t6.log`.

## 10. Committed artifacts, guards, and `pnpm ci:local`

Filled from the committed tree; verdicts are copied verbatim from the logs, never paraphrased as “pass” when
the tool said otherwise.

| file | sha256 |
| --- | --- |
| `packages/runtime/team-services/src/mount.ts` | `39a2e04866adc7a91323eb969f2152c485b258e5da6f45db11029f6cd26104e2` |
| `packages/runtime/dist/packages/runtime/team-services/src/mount.js` | `07769a1c5e01cd6937c610490ae4327b953a45a548df7c31e15c7546acc7efa8` |
| `packages/runtime/dist/packages/runtime/team-services/src/mount.js.map` | `8af134a0cd32e8c2f72ac62de2f39367835b57f3ea73454a12a826cd194de14a` |
| `packages/runtime/dist/packages/runtime/team-services/src/mount.d.ts` | `23add3e7b6e61358bc42d73c8ff93084fb08d2c6a89c026bffe2d0955f696240` |
| `packages/runtime/dist/packages/runtime/team-services/src/mount.d.ts.map` | `568b6b238eee6c945c2dff9d4b3964edb2cfb7336a3c942534c590228eea0491` |
| `tests/world-factory/a5sf-assembly.test.mjs` | `d13b4a3330cca3e3c35fcc329119a955d3f9bfc3ad591a5a8753d48eb768ea8d` |
| `packages/runtime/src/plugin/live/agent-bindings.mjs` (UNCHANGED) | `df9b46af67cd903641285760cd72a78e57986e87959b2fbdbaf3f86dd6c6464b` |

## 10.1 `pnpm ci:local` — the verdict, verbatim

```
DSH-CI-LOCAL verdict=fail steps=6 failed=1 coverage=determined files=2 wall=275.9s
[ELIFECYCLE] Command failed with exit code 1.
```

Exit **1** (a selected check failed), **not 2** — coverage was `determined`. The failing step is the selected
`vitest` leg: under the whole 483-file `packages/runtime` tree in one `threads` pool, **9 files / 8 tests**
timed out (`Hook timed out in 10000ms` / `Test timed out in 5000ms`; `alpha5-glob-backend` alone took 80 s).
This is the pre-existing ci-local load/timeout flake that S-1 and the assembly lane documented, not a
behavioural red: the same 9 files run **alone on the SAME tree** → exit 0, **9 files / 147 tests passed**
(`ci-local-red-isolation.log`). This diff touches `team-services/src/mount.ts` (+ its built mirror) and one
`tests/world-factory` suite; none of the timed-out files attaches a native shadow or imports the changed
admission path. No unmeasured pass is claimed — the L0 red stands as red, with the isolated mechanism measured.

**Evidence bound:** the full run's raw capture is **1 201 771 B** (> the 1 MiB evidence bound), so only
`ci-local-summary.log` (5 099 B, derived: selected steps, failing test identities, counts, verdict) is
committed. No allowlist entry was added — the guard rejects an oversized raw capture and it stays rejected.

The selected node leg on the same run is green and includes every P0 arm
(`✔ P0-1 …`, `✔ P0-2 …`, `✔ GAP2b …`, 12/12).

```
EB3-EVIDENCE-GUARD pass added=18 bound=1048576 exempted=0 findings=0 base=origin/master
DSH-ARTIFACT-VERDICT script=check-artifacts-committed subject=index verdict=ok compared=1916 glue=101
DSH-ARTIFACT-VERDICT script=check-artifacts-at-head subject=commit rev=HEAD verdict=ok compared=1916 drift=0
EB3-CI-REQUIRED pass workflows=9 findings=0
26/26 control(s) behaved as required
```

## 11. Residual limits and the biggest risk

1. **In-process admission only.** The deny rides `tools/pre-execute` on the Member's isolated ctx. A caller
   that reaches a tool definition object and invokes `.execute` directly bypasses every guard in the harness,
   including this one; the product path always dispatches through `tools.execute`. The refusal is not durable
   (no persisted out-of-service marker) — by design this lane is budget-frozen on `agent-bindings.mjs` and does
   not forward the record to a stream.
2. **Scope visibility.** The listener is registered on the same ctx as the (measured, working) `tools/change`
   listener and the P0-1 arm proves it fires for the agent key in the routed world. A managed name registered
   under a DIFFERENT scope key was already outside the shadow's scope (S-1 limit) and is likewise outside this
   admission check.
3. **`tools/change` must exist for a managed attach.** This is now a hard setup-time requirement (by design,
   fail closed). If a future host removes that public event, managed native assembly refuses at setup instead
   of degrading — the intended direction, but it is a compatibility cliff to know about.
4. **Biggest risk for the reviewer:** the deny is keyed on the **name set this attach forwarded**
   (`expectedDefinitions`). If a covered tool is later REMOVED from the surface before invalidation, the
   admission deny still names it (harmless: the tool is invisible). If a tool the attach **never forwarded**
   (an unmanaged preset tool) is the one that becomes dangerous, it is out of scope by construction — this lane
   closes the fallback for **managed** names only, which is exactly the reviewed defect.
