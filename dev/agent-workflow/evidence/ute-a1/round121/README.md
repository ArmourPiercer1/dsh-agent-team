# Round 121 — the rc.5 dispatch seam: the 11 red tests in 3 suites close, on BOTH hosts

Worktree `.worktrees/vnext-a1-cut`, branch `vnext/a1-cut`, base/HEAD-at-start `240352716`. Sole writer;
no history rewrite, no merge, no non-topic push. PR **#822 stays DRAFT**. `:3080` and its `DSH_HOME`
were never touched. **CORE PATCH BUDGET = 0**: both pinned hosts are read-only; nothing upstream was
patched (see §H — the seam is a Team module that MOUNTS the host's own public plugin).

**The one sentence:** the round-118 defect was REAL and is closed at the product level — a governed
Member realm on `0.2.2-rc.5` now dispatches through the HOST'S OWN mounted executor (identified by name,
not assumed), a composition that forgets the mount is REFUSED with a typed code that names the missing
capability, a denied lane is still denied with the executor mounted, and `0.2.0-rc.2` is byte-identical
because the seam detects the host by PUBLIC CAPABILITY and does nothing there.

## A. Reproduction first (before any edit)

Re-ran the exact round-118 reds on rc.5 `9c2670d3bc`: BL-16 **9 of 10 fail**, BL-17 **2 of 4 fail**,
issue2 **suite-level** (`ToolExecutorUnavailableError`), all with
`HOST-VERSION-GUARD ok host=next resolved=0.2.2-rc.5`. Reproduction matched `round118/POPULATION.md`
test-for-test, so the fix targets a measured defect, not a description of one.

## B. Diagnosis — and the correction of the round-118 attribution

Round 118 blamed the empty managed-tool forward on the executor. **That half was wrong, and the wording
mattered**: the `[]` came from Cordis SILENTLY DEFERRING the host's tool modules, because rc.5's
`dsh-tool-fs-search` statically injects a `workingDirectory` service the synthetic world never provided
(`inject: ['tools','systemPrompt','subprocess','workingDirectory']`). A deferred plugin registers
nothing — no error, no fiber, an empty forward. The executor gap is a SECOND, independent defect in the
same three suites:

1. **No dispatch.** rc.5 `ToolsService` has no built-in dispatch. `tools.execute` delegates to
   `selectExecutor(scope)`, which throws `ToolExecutorUnavailableError`
   (`code: 'TOOL_EXECUTOR_UNAVAILABLE'`) when the composition selected none. rc.2 never needed one:
   its registry dispatches itself (`mode`/`modeFor`/`defaultMode`).
2. **The empty forward** described above (fixed test-side with the labelled
   `provideWorkingDirectoryDouble` under `if (HOST_MODE === 'next')`, the precedent every other
   rc.5-adapted suite already uses — `vnext-fs-slice.test.mjs:128`, `vnext-admission.test.mjs:4993`).

## C. The mechanism: capability detection, one seam, no version sniffing

New product module `packages/runtime/src/plugin/vnext/tool-executor-mount.mjs` (+ `.d.mts`):

| probe on the LIVE tools service | answer | what the seam does |
| --- | --- | --- |
| `typeof tools.setExecutor === 'function'` | `'executor-mount'` (rc.5) | mounts the host's own exported plugin `{name, inject, apply}` of `@deepseek-ai/dsh-tool-executor-native` **on the Member's agent scope**; skips when a selection already exists (`one executor per scope` is the host's rule) |
| `typeof tools.modeFor === 'function' \|\| 'defaultMode' in tools` | `'registry-dispatch'` (rc.2) | mounts **nothing**; the registry dispatches, exactly as before |
| neither | `undefined` | the mount records `no-dispatch-contract`; the FIRST governed call refuses `A5SF_TOOL_EXECUTOR_CAPABILITY_MISSING` |

Why this is not version sniffing: no `package.json` read, no `semver`, no `try { rc5 } catch { rc2 }`.
The two hosts differ in a PUBLIC CONTRACT, and the probe reads that contract off the live object. The
one place the package name appears is the module specifier, and it is imported only AFTER the capability
that needs it has been detected; `import()` is non-literal so nothing resolves it on rc.2.

**The typed refusal is not softened.** `A5SF_TOOL_EXECUTOR_CAPABILITY_MISSING` (no dispatch contract /
package unloadable / neither dispatch shape) and `A5SF_TOOL_EXECUTOR_UNAVAILABLE` (the scope selects
none) both name the missing capability and travel as `A5sfToolExecutorSeamError` with a greppable
`code`. There is no legacy fallback: on a host that offers neither shape, dispatch REFUSES.

**Why the mount is not tolerant where it matters, and is where it does not:** a minimal tools DOUBLE
(the live bridge's permission-only handle in `t12a-live-bridge.mjs`, permission-only synthetic worlds)
answers `get`/`guard` and never dispatches. Refusing to MOUNT a realm for it would fail worlds for a
capability they do not use — and that regression was measured (`a3p4-pr4-production-entry-regression`
went red on the first draft). The absence is therefore RECORDED at mount and the refusal happens at the
first governed CALL. Silence remains impossible; nothing is quietly dispatched.

## D. Where admission still sits (the single centre)

Mounted on the Member's agent scope, the host executor runs the HOST's own pipeline, and the centre is
what that pipeline consults: `installMemberCentre` (`packages/runtime/src/plugin/vnext/centre-install.mjs`)
installs `tools/pre-execute` listeners and `tools.guard()` denials on the SAME scope
(`admission-port.mjs`). The seam adds a DISPATCH mechanism, not a decision path:

- both hosts dispatch `tools/pre-execute` (waterfall) and then `tools.checkGuards(exec)` before the body
  (rc.5 `pipeline.js:386,402`; rc.2 `index.js:3225`) — so an executor-dispatched call is admitted first;
- measured ordering (control C3): the centre's pre-execute denies FIRST, the body never runs (0 spawns),
  and the realm's own spawn-time guard is never asked — two authorities, neither skipped.

## E. The four required controls (positive AND negative), in `a5sf-bl16-grep-realm.test.ts`

| # | arm | rc.5 | rc.2 |
| --- | --- | --- | --- |
| **C1a** POSITIVE | a governed member-scope `grep` reaches the MOUNTED executor: record `{shape:'executor-mount', mounted:true, name:'native-tool-executor'}`, host `selectExecutor(agent).constructor.name === 'NativeToolExecutor'`, exactly ONE centre fact `{callId, toolName:'grep', decision:'allow', locator}`, spawns +1 | **PASS** | record `{shape:'registry-dispatch', mounted:false}` — **PASS** |
| **C2** NEGATIVE | the row's own `dispose()` removes the mount ⇒ the call is REFUSED with `A5SF_TOOL_EXECUTOR_UNAVAILABLE` (message carries the code), 0 spawns, 0 facts | **PASS** | no disposer exists; the registry still dispatches, +1 spawn, 1 allow fact — **PASS** |
| **C3** NEGATIVE | with the executor mounted, an OUT-OF-LANE `grep` is still DENIED: `isError`, secret absent, 0 spawns, centre fact `decision:'deny'`, realm sink has NO allow for it | **PASS** | **PASS** |
| **C4** rc.2 ARM | the whole file (13 arms) on rc.2 | — | **13/13 PASS** |

No assertion was weakened, no timeout widened (60 s file / 30 s arms were already the file's), no retry
added, nothing skipped. The three suites: BL-16 **13/13**, BL-17 **4/4**, issue2 **13/13** on BOTH hosts,
every run printing the matching `HOST-VERSION-GUARD ok host=… pin=…`.

## F. The population, re-measured (44 files, both hosts) — see `POPULATION.md`

| population | round 118 | round 121 |
| --- | --- | --- |
| rc.2 | 42/44 files, **529/532** | 42/44 files, **532/535** |
| rc.5 | 39/44 files, **505/519** | 42/44 files, **532/535** |

The three rc.5 reds are green; the 3 remaining reds are the SAME pre-existing, host-independent client
failures (team-creation-panel ×2, team-governance ×1), reproduced identically on both hosts. rc.2's test
total rises by exactly the 3 new control arms; rc.5's rises by 16 because 13 issue2 assertions that were
invisible behind a suite-level load failure are now collected.

## G. A second defect found while fixing the first: the population ran on a SPLIT module graph

Not a product bug — a MEASUREMENT bug, and it is why the BL-16 attach collided on
`prompt section "tool:glob" is already registered` after the mount worked. `resolve.preserveSymlinks:
true` (a Windows-sandbox requirement in `vitest.config.ts`) made Vite resolve a host-internal
`@deepseek-ai/*` import through the per-package `node_modules` SYMLINK path while the test adapter named
realpaths: **one file, two module instances**. Measured with a throwaway probe (deleted after use): the
host held one `@deepseek-ai/dsh-scope` copy for its own `systemPrompt` layers and a second for the
test's `createScope`, so `scopeOf(ctx)` (`Symbol("dsh.scope")`, not `Symbol.for`) did not match across
the split and a SCOPED `systemPrompt.section()` from a host module landed in the GLOBAL layer.

Fix (test infrastructure, `tests/next-host/host-select.mjs` + `host-vite-adapter.mjs`): the resolver's
documented contract is UNCHANGED (a host-internal importer is declined); the VITE ADAPTER now answers
the SAME realpath a Team importer gets — but only when the specifier resolves INSIDE the importer's OWN
pinned tree, and only for that one case. Every other host-internal import still declines, and a
containment violation is never swallowed. `host-resolution-consistency.test.mjs` gained the arm that
pins the new rule (12/12 green, both modes).

## H. Where the executor MODULE comes from (no host layout is guessed)

A real deployment's bundle mounts the executor (`tests/deepseek-harness-next/packages/bundle/base/cordis.patch.yml:519-520`),
so `selectExecutor(member)` already answers and the seam mounts nothing. A synthetic world assembles a
bare `ToolRuntime` with no bundle, and the repo install is rc.2 — the package is not visible to plain
Node resolution from here. The composition therefore SAYS where the module is:
`mountMemberA5sfRealm({ …, hostToolExecutorSpecifier })`, forwarded verbatim to the seam; the test
harness answers it with `tests/next-host/host-executor.mjs#hostToolExecutorSpecifier` (the pinned tree's
own `@deepseek-ai/dsh-tool-executor-native`, `file:` URL; `undefined` on rc.2 by design). Worlds wired
this round: `tests/ute-g1-search/lib/{world,new-path}.mjs`, `tests/ute1-fs/lib/assembly.mjs`,
`tests/world-factory/lib/a5sf-fs-contract-world.mjs`.

## I. Evidence index

| file | content |
| --- | --- |
| `POPULATION.md` + `population-files.txt` | the 44-file population, per-suite deltas, commands |
| `vitest-runtime-{legacy,next}.log` | 18 files / 189 tests, both hosts, guard lines |
| `vitest-client-{legacy,next}.log` | 26 files / 342+3, both hosts, guard lines |
| `gate-three-suites-{legacy,next}.log` | BL-16 13 + BL-17 4 + issue2 13 on each host |
| `gate-dispatch-ute-vnext-a1.log` | 8 suites, exit 0 |
| `gate-bound-vitest.log` | `ci-integration` 15 suites / 238 passed / 0 failed |
| `gate-test-catalog.log` | tests 788 / collected 736 / excluded 14 / uncollected 38, digest unchanged |
| `gate-ute-cut-closure.log` | `cut(0/148)` findings=0 |
| `gate-ute-p0-assets.log` | `modules=37 files=180 lines=69512 cut(148/148)` |
| `gate-docs-sync.log` | docs=193 findings=0 blocking=0 |
| `gate-place-dist-glue.log` | 36 placements, byte-identical |
| `gate-eb3-ci-required.log` | `pass workflows=11 findings=0` |
| `gate-eb3-run-manifest.log` | `pass records=662 strict=0 incomplete=11 findings=0` |
| `gate-ute-g1-argv.log` | the census G1 argv, 89/89 |
| `host-resolution-consistency.log` | 12/12 (the new one-instance arm included) |
| `gate-ci-pr-gate.log` | `ci-pr-gate --full --census-captures 2` |
| `gate-pr-settlement.log` | `pr-settlement-gate` at the new HEAD |
| `settlement-comment.md` | the posted comment body (dated) |

## J. What remains open (unchanged or newly named)

1. **`agent-bindings.mjs#executeTool` still emits the rc.2 SINGLE-CALL shape** (`:4058`). It is not on
   any measured red path this round (the 11 reds did not touch it) and was deliberately NOT changed
   inside this fix — changing it would alter the product's dispatch face for one call site while the
   host's own batch contract is what the executor expects. Named, not hidden.
2. **3 pre-existing client failures** (persona-fact probe ×2, override reset ×1) — host-independent,
   reproduced on rc.2 with unmodified client config in round 118; untouched.
3. **No PRODUCT-PROVEN row.** The candidate gate is a VERSION gate and no version is frozen; this round
   is development evidence on two pins. The rc.5 vitest population is now 42/44 with the two remaining
   reds file-identical to rc.2's, but that is coverage, not a freeze.
4. **Worlds outside the measured population that assemble a bare rc.5 tools service** and mount a realm
   will record `no-dispatch-contract` and refuse on their first governed call unless they pass
   `hostToolExecutorSpecifier`. The two next-host worlds that DO dispatch are wired and green (G1 search,
   UTE-1 FS assembly); the rest are not in the next-host legs, and their state is unchanged from before
   this round (they could not dispatch on rc.5 either). The typed code makes the gap visible instead of
   silent.
