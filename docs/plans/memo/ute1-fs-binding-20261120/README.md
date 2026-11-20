# UTE-1 — native FS binding: from prototype to a product module (2026-11-20)

**Work package.** UTE-1 of the UTE G1 "Native Execution Consolidation" gate — "完善 FS 原生
Binding". Branch `task/ute1-fs-binding-20261120`, base `origin/master` =
`ef7e3af0088bf3af8fc765ce27951f9dbad92892` (PR #791). One branch, one writer, one worktree
(`.worktrees/ute1-fs-binding-20261120`). CORE PATCH BUDGET = 0: no upstream or host source is
touched, no patch mechanism is used, and no production traffic is routed here.

**This memo is the honest close-out of one work package, not a release note.** It records what
moved, how it was proven, what is still `blocking=yes`, what the module deliberately still cannot
do, and which facts were NOT observed in this environment.

---

## 1. What moved: test → product

The G1-S1 prototype (`tests/ute-g1-fs/lib/prototype-provider.mjs`) proved a lane decision on the
**legacy governed route** (`0.2.0-rc.2 @ 639ed01539`, route-C product path). That was a prototype
inside the test tree: it could not be mounted by anything shipped, and it carried no lifetime.

UTE-1 ports the decision itself into a reviewed product module:

| | G1-S1 (PR #792) | UTE-1 (this change) |
| --- | --- | --- |
| the lane decision | `tests/ute-g1-fs/lib/prototype-provider.mjs` | `packages/tools/src/native-fs-binding.ts` |
| public surface | none (test-only import) | barrel export in `packages/tools/src/index.ts` (additive) |
| lifetime | per-run helper object | named `scope`: mount → use → dispose (once) |
| host pin | legacy `0.2.0-rc.2 @ 639ed01539` | next `0.2.2-rc.5 @ 9c2670d3bce5275e0d1610272958121af87787bb` |
| grading | 10 old-path golden vectors | the same 10 vectors **+** a real Team-Agent assembly proof on rc.5 |

The module is **dependency-free** (zero imports; the suite asserts it) because it subclasses the
provider class the host hand it. It adds exactly one decision in front of every target-bearing
operation:

1. `this.processPath(target)` (the HOST's own path resolution), then
2. `laneAdmits(lane, hostPath, access)` — the binding's declared read/write lane, and
3. `super.<method>(target, …)` — the host's own effect.

It is **not** an authorisation or approval decision maker: the Alpha.4 authority/approval kernel and
the P1 `EffectiveIo` compiler remain the only permission decision makers. The lane is a service-level
containment bound chosen by the assembly, not a verdict about the user.

### The one pre-existing product file that changed

`packages/tools/src/index.ts` gains a value + type re-export block (33 added lines, no removed
line). This is the required "public export" and it changes no behaviour: nothing in
`packages/runtime`, no shipped assembly and no production row imports the module. The suite's static
scan asserts that the ONLY referrers in `packages/**` are the barrel and the module file itself
(`git grep` transcript in `evidence/isolation.txt` §3).

The only other pre-existing file changed under `packages/` is a **test pin**, and it was widened, not
weakened: `packages/tools/test/p6t6-bypass-scan.test.ts` pinned the tool-layer scan to exactly 7
source files. The new module is inside that boundary, so the pin now says 8 and the scan **covers**
the module (it produces zero hits on the three bypass rules). Leaving it at 7 would have kept the
scanned set closed by excluding the new file — the opposite of the rule's intent. This is disclosed
here, in the commit body and in the PR body; it is not a product-behaviour edit.

---

## 2. The assembly path that was actually exercised

The suite does not simulate the assembly. `tests/ute1-fs/lib/assembly.mjs` builds a real Member world
on the pinned rc.5 tree and mounts the **product route-C path**:

```
real host.Context (tests/deepseek-harness-next, 0.2.2-rc.5 @ 9c2670d3…)
  ├─ mountAgentLoopTestDependencies(ctx)        — the host's own testkit seam
  ├─ ctx.plugin(observationPolicy), preset host.toolFs
  ├─ mountAgentLoopTestHarness(ctx) → harness.create(sessionId)   → a real agent
  └─ agent.ctx:
       mountMemberA5sfRealm({ root, members, bindings, providerClass: <module class> })
         └─ providerClass = createNativeFsBindingScope(...).providerClass
            (the realm wraps it with the product P1 guard `createConfinedFileSystemClass`;
             the guard's ceiling is kept WIDE so a refusal is provably the LANE's, not the ceiling's)
       attachA5sfNativeToolModules(realm, agent.ctx, config, agent)
```

The realm and the attach must sit on `agent.ctx` (mounting them at the root ctx makes the host
refuse the second prompt-section registration — the host's own `SERVICE_MOUNT_FAILED`, not a test
workaround). Because this row imports the repo's own packages, the assembly arms require an
`pnpm install`-ed (and built) checkout; the suite's CI step therefore sits after the build (§7a).

Dispatch goes through `executeModelToolFixture` → the host's `ToolsService` → the host's real
ToolExecutor → the tool body → the realm's provider. Observed in `evidence/suite.txt`:

* in-lane `write` → `isError: false`, bytes on disk;
* out-of-lane `write` → `isError: true`, typed `FS_PERMISSION_DENIED`, message names
  `lane-write`, and **no file exists** afterwards;
* the module's facts carry `bindingId` = this mount's id and `generation` = the pinned generation;
* `realm.installation.members[0].fs instanceof scope.providerClass` (the provider that served the
  call is the module's class, wrapped by the product guard);
* `attachA5sfNativeToolModules` returns a non-null attach record.

### The assembly-path control (the anti-vacuity arm)

With the **same** assembly, the **same** lane, the **same** call and `withProviderClass: false`, the
out-of-lane write **succeeds** and the file lands (`evidence/suite.txt`, "assembly control"). That is
the proof that the deny arm measured the binding and not the harness, the testkit, or an ambient
sandbox: remove the product class and the refusal disappears.

---

## 3. Scope invariants

A binding has an explicit lifetime. The invariants are enforced by the module and graded host-free
and inside the assembly:

| invariant | mechanism | graded by |
| --- | --- | --- |
| mount pins the host generation | `mountNativeFsBinding` compares `expectedGeneration` with `host.generation` **before** any scope/service is created; mismatch throws `FS_BINDING_HOST_GENERATION_MISMATCH` naming BOTH generations | arms `a7`, suite test 7 |
| a scope is created with its lane | `createNativeFsBindingScope({ctx, host, lane, id, cwd})` normalizes roots, registers the provider under the isolated `fs` service | arms `a1`, `a2` |
| disposal is monotonic and idempotent | first `dispose(reason)` marks the scope disposed and returns `{status:'disposed', changed:true, alreadyDisposed:false, reason, disposedAt}`; later calls are named no-ops (`changed:false, alreadyDisposed:true`) and keep the FIRST reason | arms `a4`, suite lifecycle test |
| every later target-bearing call is refused by name | `assertLive()` throws `NativeFsBindingError(FS_PERMISSION_DENIED)` whose message contains `scope-disposed`; it runs before any `super` call | arms `a3`, suite lifecycle test (tool path AND a held provider reference) |
| scopes do not share a lane | each scope closes over its own normalized roots; crossing another scope's root is refused | arm `a5` |
| replacing the provider does not resurrect the old lane | the old provider's scope is disposed with the swap; calls through the previous lane are refused | arm `a6` |
| teardown order | scope marked disposed → tool fiber → provider fiber; the realm's `dispose()` then tears the rest down | suite lifecycle test + realm dispose in `finally` |

---

## 4. The two `blocking=yes` semantic differences, carried forward UNRESOLVED

These are unchanged from `tests/ute-g1-fs/golden/SEMANTIC-DIFFERENCES.md` (G1-S1) and must **not** be
read as resolved by this work package. The suite imports `semanticDifferenceLines()` and fails if
either row disappears or loses `blocking=yes`.

| id | class | old (legacy route) | new (product module) | why it is still blocking |
| --- | --- | --- | --- | --- |
| `lane-refusal-code` | `refusal-code` | `FS_SANDBOX_DENIED` | `FS_PERMISSION_DENIED` | rc.5 `tool-fs` dereferences `policy.mode` at `packages/fs/tool-fs/src/sandbox.ts:139-143`; the typed code a model observes differs between the two paths. Choosing one is a product decision about the refusal vocabulary, not a binding detail. |
| `refusal-observation-shape` | `observation-shape` | prose refusal | typed `FsError` code | the legacy path reports a prose reason; the new path reports a typed code (and our scope reason). Consumers that pattern-match prose vs code see different shapes. |

Retiring the governed route while these differ would silently change what a model reads on a denied
call. They stay declared and graded as differences.

---

## 5. Capability limits (deliberately not claimed)

* **Read confinement is NOT claimed.** The module enforces a lane on reads too, but this work package
  has no old-path vector for a read refusal, so no parity claim is made; the read lane is a
  declared bound, not a graded equivalence.
* **`deleteFile` / `moveFile`** are lane-guarded but have **no old-path golden vector**, so their
  refusal parity is unproven (they are covered only as "inside the boundary, delegates to super").
* **Streaming, byte-range reads and `read_image`** are not exercised by this suite. The G1-S1 corpus
  covered `read_image` at the FACE level; UTE-1 grades text/bytes writes and a read-back only.
* **The lane is not a security boundary against a hostile member process.** It is a provider-level
  containment bound in the same process; the OS sandbox remains the OS-level bound.
* **No Authority / approval semantics change.** `team_grant_permission`, `ask` decisions and the
  approval kernel are untouched and are not modelled here.

---

## 6. UNKNOWNs (not observed in this environment)

1. **The legacy host tree is not in a fresh checkout.** `tests/deepseek-harness-test-use` is
   gitignored. For the before/after legacy FS comparison it was copied from a sibling pristine
   worktree at the pinned commit `639ed015397290b3745d163aafe02ffee4aa3f84` (porcelain empty,
   verified in `evidence/isolation.txt` §5). The comparison itself is real; the tree's PROVENANCE in
   this worktree is a copy, not a fresh provision. The pin is verified by commit id, not re-derived.
2. **No `unshare` / kernel-namespace isolation was used** for the assembly arm; it runs in-process in
   the same workspace sandbox as the rest of the host-free suites. The OS-level claim of the lane is
   therefore not exercised here.
3. **The full census leg (`scripts/ci-pr-gate.mjs`) was not run locally.** What was run is what the
   work package lists: the catalog gates, dispatch/eb3 guards, docs-sync, identities, tsc, the suite,
   the legacy FS before/after pair, and the census POPULATION (712 files / 12 roots). Whether the
   hosted CI census leg is green on this branch is measured by CI after the draft PR is pushed, not
   by this memo.
4. **The hosted runner's reachability of GitHub + npm for the rc.5 provisioning step** is not
   measured here (it was measured reachable from the authoring box). If that step fails, the
   next-host lane goes red by name (`NEXT-HOST-REFUSED`), not by skip.
5. **`pnpm install` could not run in this worktree** (the pnpm store is outside the workspace-write
   sandbox; `[ERR_SQLITE_ERROR] unable to open database file`). `node_modules` was copied from a
   sibling worktree; the `tsc`/`vitest` results are real, but the dependency graph was not re-resolved
   from the lockfile in this environment.

---

## 7. Gates — what was run, and what it said (verbatim excerpts)

Full transcripts: `dev/agent-workflow/evidence/ute1-fs-binding-20261120/`.

| gate | result |
| --- | --- |
| new suite | `tests 9 / pass 9 / fail 0 / skipped 0` (`suite.txt`) |
| mutation transcript | `MUTATION-BASELINE-VERDICT GREEN arms=7`, `MUTATION-TRANSCRIPT-VERDICT GREEN mutations=6 arms=7`, every arm `verdict=RED-AS-REQUIRED` (`mutation-transcript.txt`) |
| `test-catalog --max-uncollected 41 --max-excluded 7` | `tests=881 … UNCOLLECTED 41 … refused=0 findings=0`, the new suite `DISCOVERED_AND_COLLECTED` (`gates.txt`, `isolation.txt` §6) |
| `test-catalog.test.mjs` | `tests 28 / pass 28 / fail 0` |
| `dispatch-tests --check` | `DSH-TEST-DISPATCH-CHECK mode=inspect PASS legs=18 bad=0` |
| `eb3-ci-required` | `EB3-CI-REQUIRED pass workflows=10 findings=0` |
| `eb3-ci-negative-controls` | `33/33 control(s) behaved as required` (incl. C-NH1 byte-identical lane argv) |
| `docs-sync --check` | `docs=177 notes=4 plans=136(0 declaring) findings=0 blocking=0` (the merged #793/#794 plans and this memo included) |
| `lint-identities --diff <a4 baseline>` | `76 distinct; new 0, resolved 0` |
| `tsc --noEmit -p packages/tools` | exit 0 |
| `packages/tools` vitest | `15 files / 179 tests` pass (the bypass scan now covers the new module) |
| `git diff --check` | clean |
| legacy FS suites (before/after) | `35 tests / 34 pass / 0 fail / 1 skip` on BOTH; verdict sets `identical=True` (`legacy-fs-before-after.txt`) |
| census population | `file_count 712`, `roots 12` (`isolation.txt` §4) |
| CI wiring — the suite's own leg | a NEW post-build census step (`UTE G1 — FS binding: product module + real assembly`) runs the suite after `pnpm install && pnpm run build`; its `run:` line and the manifest leg's `cmd[]+check[]` agree byte for byte (`isolation.txt` §7) |
| CI wiring — the next-host lane | the rc.5 lane keeps `f10-contract-identity` + `ute-retirement-gate` and no longer carries this suite (it runs before the build; `evidence/prebuild-failure.txt` shows why) |
| host trees | legacy `0 entries @ 639ed01539…`, next `0 entries @ 9c2670d3…` — never edited |

Commands are echoed verbatim above each output in `gates.txt` / `isolation.txt`; every one of them
can be re-run from the worktree root.

### 7a. Hosted correction (run `2ec811f6f`, 7 m 45 s): the assembly arms need the repo build

The first wiring appended the suite to the **next-host lane** step, which runs *before* `Build this
repo`. That was wrong, and the hosted run measured it:

```
✖ assembly: a real Member on rc.5 writes inside the lane and is refused outside it
  Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@deepseek-ai/dsh-scope'
  imported from …/packages/runtime/src/plugin/live/a5sf-realm-row.mjs
ℹ fail 3
```

The two host-free arms families pass there; the three assembly tests cannot, because the product
route-C row imports this repo's own packages and a fresh job has no repo `node_modules` until
`pnpm install` runs. The suite now has its own step **after** the build:

* `.github/workflows/census-runtime.yml` → `UTE G1 — FS binding: product module + real assembly
  (pinned rc.5 host)`, `timeout-minutes: 10`, running
  `node --test --test-force-exit --test-timeout=480000 --test-reporter=spec tests/ute1-fs/native-fs-binding.test.mjs`;
* `dev/ci/eb3-ci-manifest.json` → a matching `ci-census` leg
  `UTE G1 FS binding product lane (node:test: the product module + a REAL assembly on the pinned rc.5 host, AFTER the repo build)`
  with `cmd` = the same `node --test … --test-timeout=480000 …`, `check` = the suite;
* `480000` is used by no other leg, so the whole-trailing-argv reader can attribute the step to this
  leg alone (the earlier `600000` collided with B4/1 and `eb3-ci-required` refused the ambiguity with
  `CI_LAYER_LEG_ENV_MISSING` — observed, then fixed);
* `scripts/eb3-ci-negative-controls.mjs` **C-NH1 was extended**, because a leg the controls do not
  cover is a leg nobody grades: `UTE G1 FS binding` joined its derivation set and three workflow
  mutations (`ute-lane-suite-dropped` → `CI_LAYER_LEG_ARGUMENT_MISSING`, `ute-lane-echo` →
  `CI_LAYER_LEG_UNPROVEN`, `ute-lane-continue-on-error` → `CI_LAYER_CONTINUE_ON_ERROR`) plus one
  manifest mutation (`ute-manifest-suite-dropped` → `CI_LAYER_LEG_EXTRA_ARGUMENT`) now grade it.

**Reproduced locally, not assumed.** A standalone copy of the tree outside the repo (so Node's upward
resolution walk cannot reach a parent checkout's `node_modules`) with the rc.5 host copied in as a
real directory and **zero** `node_modules`:

* `evidence/prebuild-failure.txt` — `MODULE_NOT_FOUND: Cannot find package '@deepseek-ai/dsh-scope'`,
  then `tests 9 / pass 6 / fail 3`, the three assembly tests failing with exactly the hosted
  `ERR_MODULE_NOT_FOUND` from `a5sf-realm-row.mjs`;
* `evidence/postbuild-pass.txt` — the SAME tree with the repo's installed deps present:
  `tests 9 / pass 9 / fail 0`.

---

## 8. Evidence map

| file | content |
| --- | --- |
| `evidence/suite.txt` | the whole `node --test … tests/ute1-fs/native-fs-binding.test.mjs` transcript, 9/9 |
| `evidence/mutation-transcript.txt` | the 6 mutations + 7 baseline arms, each with its verdict line |
| `evidence/gates.txt` | catalog, dispatch, eb3 required/negative controls, docs-sync, identities, tsc, vitest, diff-check — command + output + exit code |
| `evidence/isolation.txt` | `git diff` vs master, importer census, pin block, census population, host-tree porcelain, catalog entry, CI byte-match |
| `evidence/prebuild-failure.txt` | the suite in a standalone checkout with NO repo `node_modules`: the three assembly tests die with the hosted `ERR_MODULE_NOT_FOUND` (`@deepseek-ai/dsh-scope` from `a5sf-realm-row.mjs`), host-free arms pass |
| `evidence/postbuild-pass.txt` | the SAME tree plus the built repo's `node_modules`: 9/9 pass — where the new census step runs |
| `evidence/legacy-fs-before-after.txt` | the legacy FS suites on a pristine `origin/master` worktree vs this branch, verdict-set diff |

Scratch (untracked, gitignored): mutation copies and assembly worlds under
`.artifacts/tmp/ute1-fs-*`.

---

## 9. Branch / PR

* branch: `task/ute1-fs-binding-20261120`
* module commit (the original change, before the memo/CI-log commit):
  `296793c32ed0f7ebafa33e86b14521459a61e493`
* merge of `origin/master` (#793 + #794, lane argv rebuilt from the manifest):
  `d510523d6f7e3b0547e6836312b41491202588b9`
* wiring correction (§7a, hosted failure on `2ec811f6f`): the commit that carries this memo
  revision; the PR body states its exact 40-hex head at push time.
* original base: `origin/master` = `ef7e3af0088bf3af8fc765ce27951f9dbad92892`
* PR: a DRAFT pull request against `master` is created from this branch; the PR body carries the
  exact 40-hex head at push time. It is intentionally **not** marked ready: UTE-1 is one work
  package of the gate, and the two `blocking=yes` differences above are unresolved.

---

## 10. What this work package does NOT decide

* It does not retire the governed route-C path; that path is unchanged and still serves production.
* It does not wire the module into any shipped assembly; the barrel export is additive and unused.
* It does not pick the final refusal vocabulary (see §4), the read-confinement contract, or the
  delete/move semantics.
* It does not claim the next-host lane or the census leg is green on the hosted runner; that is the
  PR's CI to measure.
