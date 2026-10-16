# Alpha.5 PR1-residual — §12 evidence set (R-a native attribution, R-b validate→resolve window)

Branch `alpha5-pr1r-residual-boundaries`, base **`db5cb5f7`** (= merged PR1 on `master`).
Host: DSH `0.2.0-rc.2` @ `639ed015397290b3745d163aafe02ffee4aa3f84`, pins from
[`tests/paths.mjs`](../../../../tests/paths.mjs). CORE PATCH BUDGET = 0: every change here is
inside this repository's own plugin lane, reached through public Host seams; the pinned Host tree
was read, never written (`C7b`).

Two residuals from the PR1 review are closed or bounded here. Neither changes the threat model:
both scenarios — a normal third-party same-name registration, and a normal concurrent
re-registration — are **inside the supported scope**, and this round measures them instead of
filing them under the excluded "attacker rewrites Host memory" class.

## (a) decision delta — what this round decided that merged PR1 left open

| # | decision taken | why, and where it is pinned |
| --- | --- | --- |
| 1 | **R-a**: a name's native standing is earned by comparing TWO public reads, not by membership in a name list. `tools.get(name)` (no scope) is the registry's **global view** — the same view the trusted native list was read out of — and `tools.get(name, scope)` is what **this Agent** resolves. Agreement is the price of a verified `native:` Binding | the pinned `view()` puts a scope's own registrations last, "shadowing an inherited name and outside the filter above" (`packages/core/tools/src/index.ts` @ `639ed01539`), so a per-agent variant of a native name is admitted by the Host's own advice ("for a per-agent variant, register through that agent's agent.ctx"). Pinned by `a5p1r-shadow-attribution.test.ts` (8 tests), `a5p1-closed-world-guard.test.ts` R1R/R1R-b/R1R-c, and by the real-registry kit leg `R1R-SHADOW` |
| 2 | Disagreement, and an unreadable trusted side, are **typed and separate**: `native-shadowed` / `native-unreadable`, each with its own message; both bind the name **UNVERIFIED** (governed, loud, refused at dispatch) instead of crediting it | `GOVERNED_UNVERIFIED_REASONS` + `GUARD_DENIAL_REASONS.NATIVE_SHADOWED / NATIVE_UNREADABLE` in [`closed-world-guard.ts`](../../../../packages/runtime/tool-dispatch/closed-world-guard.ts); `guardDecision` now states the recorded fact instead of flattening every case into `binding-unverified` (pinned: R1R-c, D15/D16, `R2`) |
| 3 | **R-b**: the `tools/execute` door (the door nearest the Body) re-asks the whole closed-world question, not only "is the Dispatcher ACTIVE" | the Guard stage runs at `:1519`, i.e. after `pre-execute`, while `dispatchToolBody` → `resolveExecution` runs at `:1578`, after every listener: a re-registration between them used to be validated by nobody. Pinned by `a5p1r-validate-resolve.test.ts` and the kit runner's `RW-INNER-DOOR` arm |
| 4 | What still cannot be refused before it runs is refused **as early as it can be observed**: at the settled edge of the very call that carried it (`noteCallEdgeDefinition` at `tools/result`), so the exposure is one call and never a standing state | `scoped-dispatcher.ts` `noteCallEdgeDefinition` + `install.ts`'s settled-edge listener; pinned by the lane's `RECORDED BOUNDARY` test and by `RW-RESIDUAL-RECORDED`, which asserts the honest fact (the Body ran) plus the next call's refusal |
| 5 | An explicit re-bind by the trusted assembly now carries `revision = (in force ?? 0) + 1`. PR1's own law is "a change is a strictly higher immutable revision", but `bindAll` always wrote `revision: 1`, so the documented "refuse + re-bind" recovery could not actually re-bind a drifted name | `install.ts` `bindAll`; observable in the second half of `R1R-SHADOW` (the same world, bound explicitly, runs the Body) |
| 6 | The **kit's own** `pr1-*` arms take the documented `bindOwnTools` path for their adapter. Merged PR1 let them ride the very hole R-a closes — their adapter is a same-name shadow of a native name — so the legs measured what they claim *for the wrong reason* | `a5p1-order-hazard.mjs`'s pr1 branch. All nine `NEG1-*` legs pass unchanged with the explicit bind, which is what makes the count comparable: 22 → 23, one leg added, none weakened |
| 7 | `tools/change` is proven **not** to be a safety mechanism in this window: an arm of the runner makes that registration throw, and the refusal still happens with the same typed reason | `a5p1r-rereg-window.mjs`'s `guarded-pre-execute-no-change` arm ⇒ `RW-F2-ISOLATED` |

## (b) goal → source mapping

| residual (review `INFO-1` / `s12-evidence.md:253`) | implementation | tests / kit criteria |
| --- | --- | --- |
| R-a — a native name already shadowed at publish time entered governance as `verified` | [`closed-world-guard.ts`](../../../../packages/runtime/tool-dispatch/closed-world-guard.ts) `bindInheritedSurface(names, resolved, trusted)` (three facts, four cases) + `GovernedEntry.unverifiedReason`; [`install.ts`](../../../../packages/runtime/tool-dispatch/install.ts) `readTrustedDefinition` (the scope-less read) and the `published-surface-shadowed` / `published-surface-native-unreadable` observations | `a5p1r-shadow-attribution.test.ts` (RED-first), R1R / R1R-b / R1R-c in `a5p1-closed-world-guard.test.ts`, kit `R1R-SHADOW` (real registry, both halves) |
| R-a — explicit Team bind must still be the way a Team's own same-name Definition is admitted | unchanged entry points (`bindOwnTools` / `bindMcpTools`), plus decision 5's revision rule | `a5p1r-shadow-attribution.test.ts` "AN EXPLICIT Team Binding admits…", kit `R1R-SHADOW` second half, `NEG1-*` legs |
| R-b — validation→resolution window under a legal concurrent re-registration | `install.ts` inner door (re-`guard` at `tools/execute`), `scoped-dispatcher.ts` `noteCallEdgeDefinition` | `a5p1r-validate-resolve.test.ts` (5 tests), `a5p1r-rereg-window.mjs` (5 arms on the pinned registry), kit `RW-*` |
| Seam gap that no public seam can close | **recorded, not patched**: [`seam-record-post-door-resolution.md`](seam-record-post-door-resolution.md) in PoC-1 format | `RW-RESIDUAL-RECORDED` asserts the boundary every run instead of claiming a pass |
| Registry fidelity of the test doubles | [`a5p1r-scoped-registry-double.ts`](../../../../packages/runtime/test/a5p1r-scoped-registry-double.ts) (global layer + own layer, `get(name, scope?)` mirroring `view()`, measured stage order, Body resolved in the innermost step); the PR1 install double now answers the scope-less read (`globalDefinitions`) instead of feigning `undefined` | both doubles are the substrate of the 79-test lane |

## (c) RED-first record (verbatim first failures)

R-a, lane, against the merged lane (`runs/Ra-shadow-attribution-RED.log`, 7 failed / 1 passed):

```
FAIL packages/runtime/test/a5p1r-shadow-attribution.test.ts > … > RED (the residual finding):
     a per-agent same-name variant registered BEFORE assembly used to enter governance as a verified native
AssertionError: expected true to be false // Object.is equality
FAIL … > refuses the shadowed name at dispatch: neither the shadowing body nor the native one runs
AssertionError: expected [ 'THIRD_PARTY.read' ] to deeply equal []
```

The second line is the finding: the third-party Body **ran** under a `native:read` Binding.

R-a, real registry, against the merged build (`runs/order-hazard-PREFIX-RED.log`, 9 `NEG1-*`
legs passing, the new leg failing):

```
FAIL R1R-SHADOW: … — no-bind: nativeList=true verified=true reason=null
     bodies=[THIRD_PARTY.grep] text="ran:grep@THIRD_PARTY.grep" | explicit-bind: verified=true
     binding=team-own:A:grep bodies=[THIRD_PARTY.grep]
```

R-b, lane, against the merged lane (`runs/Rb-validate-resolve-RED.log`, 2 failed / 3 passed):

```
FAIL … > a re-registration AFTER the guard stage but BEFORE our inner door is refused AT THAT DOOR
AssertionError: expected [ 'V2.grep' ] to deeply equal []
FAIL … > RECORDED BOUNDARY: … and the lane withdraws the verification at that call edge so it cannot repeat
AssertionError: expected true to be false // Object.is equality
```

R-b, real registry with a deterministic park, against the merged build
(`runs/Rb-rereg-window-RED.log`, exit 2):

```
PASS RW-CONTROL: … without the lane, a legal re-registration inside the parked window decides
     which Body runs — v1=0 v2=1 resolution=V2 text=ran:grep@V2
PASS RW-F2-ISOLATED: … the per-call definition read alone refuses … — decideInWindow=deny/definition-drift
PASS RW-PRE-EXECUTE-COVERED: … with or without the tools/change channel — v1=0 v2=0
FAIL RW-INNER-DOOR: … the un-validated Body never runs — v1=0 v2=1 text=ran:grep@V2
PASS RW-RESIDUAL-RECORDED: boundary recorded … v1=0 v2=1 secondCall(v2=1 …)
```

GREEN after the fix: `runs/lane-GREEN.log` (79/79), `runs/Rb-rereg-window-GREEN.log` (5/5),
`runs/order-hazard-10-legs.log` (10/10), and the full kit 23/23 (§d).

## (d) real Host Run Receipt (required)

Kit [`tests/kits/a5-pr1-guard-dispatch/a5p1-kit.mjs`](../../../../tests/kits/a5-pr1-guard-dispatch/a5p1-kit.mjs),
evidence dir [`runs/kit-r1r/`](runs/kit-r1r/) (`run-receipt.md`, `summary.json`, `instance.log`,
`guard-observations.txt`, `order-hazard.json`).

* **23/23 criteria pass** — 13 Host legs (`C1a…C7b`) + **10** order legs (`NEG1-CONTROL`,
  `NEG1-SAFE`, `NEG1-PARKED`, `NEG1-BODY`, `NEG1-MASK`, `NEG1-SEAM`, `NEG1-R4`, `NEG1-STABLE`,
  `NEG1-LEAK`, **`R1R-SHADOW`**). Merged PR1's count was 22; exactly one leg was added and no
  existing leg was removed or loosened (`(g)` below records what the touched legs now assert).
* Port `3185`; world `tests/homes/a5p1-2026-10-16T08-40-31`, disposition **removed**.
* `C7a`: `:3080` read before and after (`before=401 after=401`), never operated.
* `C7b`: the pinned `tests/deepseek-harness-test-use` tree is porcelain-clean.
* Production-assembly facts worth stating: `C1d publishes=4 refused=0`, and across the whole
  run `guard-observations.txt` contains **no** `published-surface-shadowed` and **no**
  `dispatcher-native-unreadable` line — i.e. tightening R-a did not turn one real governed name
  into a refusal. `C3` (a governed allowed call still runs) and `C4`/`C4b` (zero interference on
  the permissions-less lane) pass as before.
* The R-b window runner (`a5p1r-rereg-window.mjs`) is a fixture-level real-registry runner over
  `p00-fixture.mjs`; it is not one of the kit's counted legs and is reported separately.

## (e) baseline-diff identity table

| gate | baseline (`db5cb5f7`, run in the `.worktrees/a5-pr1` tree) | this branch | identity |
| --- | --- | --- | --- |
| full vitest suite (final, committed tree) | 7 files / 24 tests failed, 6621 passed (522 files) | 5 files / 11 tests failed, 6678 passed (524 files) | **`only_in_after = []`** (the two entries that appeared in the first after-run were both real gaps and are fixed below, not explained away) |
| PR1 lane (`a5p1-*.test.ts`) | 63 tests | 66 tests (3 R1R pins added) | nothing removed |
| residual lane (`a5p1r-*.test.ts`) | — | 13 tests | added |
| typecheck (`tsc -p` × 9 packages) | clean | clean | equal |
| `eslint .` | 129 errors / 32 warnings (all pre-existing, none in a touched file) | 129 / 32 | equal (0 problems in the residual-touched files) |
| `node scripts/lint-identities.mjs` | 161 identity lines, 76 distinct, 1158 files | 161, 76, 1161 files | identity set unchanged; +3 scanned files (the two specs and the double) |
| `pnpm check:artifacts` | — | see §(f) note: dist rebuilt and committed in the same commit | fresh |
| `p4t6` scan inventory | 1073 files | 1076 (`SCANNED_PATHS_A5PR1R`) | registered |

Two `only_in_after` entries appeared in the first after-run and were resolved, not explained away:

1. `p4t6-session-event-scan.test.ts > coverage: … files scanned` — expected: the three new
   scannable files (two specs + the registry double) had to be registered as an increment.
   Registered with the reason in-file; the leg passes.
2. `a4p7-merge-gate.test.ts > … the committed install surface is fresh against the tree` —
   expected: that leg *is* `check:artifacts`, and the rebuilt `packages/runtime/dist` was not yet
   committed. Resolved by committing the artifacts with their sources in the same commit; the leg
   passes in the final run.

The remaining failures are pre-existing in the baseline (`p6t3-mediation`, `p6t3-restart`,
`t2-blueprint-hash`, `p6t6-actions`, and the two environment-dependent `a4p7-merge-gate` legs);
the baseline additionally carried 13 `a2c7-subtree-matcher` failures that do not recur here.

## (f) file hash manifest

Sources (sha256, this branch's working tree at the final run):

```
`9e337c2570b3b36e`  `packages/runtime/tool-dispatch/closed-world-guard.ts`
`a9e1b39902506192`  `packages/runtime/tool-dispatch/scoped-dispatcher.ts`
`55d0804f2533ac3a`  `packages/runtime/tool-dispatch/install.ts`
`cd4b60e53067b573`  `packages/runtime/tool-dispatch/index.ts`
`93a1dd9b460dc791`  `packages/runtime/test/a5p1r-shadow-attribution.test.ts`
`ec105a0d2c175658`  `packages/runtime/test/a5p1r-validate-resolve.test.ts`
`576373035ebedb19`  `packages/runtime/test/a5p1r-scoped-registry-double.ts`
`3a989610b7472a30`  `packages/runtime/test/a5p1-closed-world-guard.test.ts`
`833f8385ccfb7090`  `packages/runtime/test/a5p1-guard-install.test.ts`
`e9e2bde6ee299d10`  `packages/runtime/test/a5p1-scoped-dispatcher.test.ts`
`e453eca0d2d3982c`  `packages/testkit/test/p4t6-session-event-scan.test.ts`
`dddaf05fbe7ceba5`  `tests/kits/a5-pr1-guard-dispatch/a5p1-order-hazard.mjs`
`8018aab6cae0e385`  `tests/kits/a5-pr1-guard-dispatch/a5p1r-rereg-window.mjs`
```

(sha256, first 16 hex chars; rebuilt from the tree at the final gate run. The rebuilt
`packages/runtime/dist/packages/runtime/tool-dispatch/**` is committed in the same commit — the
install surface `a4p7-merge-gate` checks — and is outside the scanner's rules, so it is listed
here rather than in §(e)'s scan inventory.)

## (g) what the touched pre-existing legs assert now (so the count stays comparable)

| leg / test | merged PR1 asserted | this round asserts | why it is not a weakening |
| --- | --- | --- | --- |
| kit `NEG1-PARKED` … `NEG1-LEAK` (9 legs) | the shadowing adapter entered governance as `verified` native and the arms measured teardown around it | the same arms, with the adapter bound explicitly (`team-own:A:grep`) | identical measurements; the Binding family is now the honest one. The refusal-to-inherit that these arms accidentally relied on is measured on its own by `R1R-SHADOW` |
| `a5p1-guard-install.test.ts` fixture | `tools.get(name)` with no scope answers `undefined` | answers the global layer (same definition unless `globalDefinitions` says otherwise) | the pinned registry resolves the global view on that call; the fixture was unfaithful, and its unfaithfulness was one reason R-a stayed invisible |
| `a5p1-closed-world-guard.test.ts` S3/S5/S6, R1/R1b | `bindInheritedSurface(names, pin)` | `bindInheritedSurface(names, resolved, trusted)` with the two maps equal | the assertion means the same thing; the API no longer lets the third fact be omitted |
| `R2` / `D15` / `D16` refusal text | `… cannot be verified` | `… different ToolDefinition …` | a stricter substring: the permanent withdrawal now names the fact that caused it |
| kit `NEG1-SEAM`, `NEG1-R4`, `NEG1-MASK` | unchanged | unchanged | untouched |

## (h) unfinished capability, disclosed boundaries, residual status

**Closed by this round (asserted, not argued):**

* R-a pre-assembly shadow: a same-name shadow of a native name no longer inherits verification
  (`R1R-SHADOW`, `a5p1r-shadow-attribution`, R1R/R1R-b/R1R-c). The residual case recorded at
  `../alpha5-pr1-implementation/s12-evidence.md:253` is **retired** — the two-read comparison is
  now the rule, so the sentence "a native name ALREADY shadowed at publish time … enters
  governance as verified" no longer describes this lane.
* R-b's Guard→inner-door half: refused at the door nearest the Body (`RW-INNER-DOOR`).
* R-b's post-door half is **bounded** rather than closed: one call, withdrawn at that call's own
  settled edge, next call refused (`RW-RESIDUAL-RECORDED`).
* The `bindAll` revision defect that made the documented re-bind path unusable after a drift.

**Open, with the seam recorded:** the interval between the last `tools/execute` listener and
`resolveExecution` at `:1578` — see
[`seam-record-post-door-resolution.md`](seam-record-post-door-resolution.md) (PoC-1 format:
the seam asked for, where resolution actually happens, what the existing seams do and do not
give, what upstream would have to provide, and the fail-closed posture taken meanwhile).

**Disclosed consequences of choosing fail-closed over crediting:**

* A governed name whose **trusted (global) side** of the definition read is unavailable is bound
  UNVERIFIED and refused at dispatch, where merged PR1 would have verified it. On this Host's real
  Team lanes that condition did not occur (§d), but it is reachable in principle for any name the
  global view does not carry while the agent surface does — a plugin that registers a native name
  only into an agent scope, for instance. Such a name is now a coverage/observation problem
  (`published-surface-native-unreadable`), not a silent pass.
* Every unverified reason is now stated (`unattributed`, `native-shadowed`, `native-unreadable`,
  `definition-drift`, `definition-unreadable`), so a refusal is diagnosable without reading lane
  source. That is 5 distinct messages where PR1 had 1 for this class; `R1R-c` pins that they stay
  distinct.
* The kit's `pr1-*` arms now depend on `bindOwnTools`. A future reader must not "simplify" that
  away: without it those arms measure a lane that refuses their own adapter, and the arms would
  pass vacuously instead of measuring the drain.

**Unchanged from PR1 (still not done here):** MCP late-arriving servers beyond the publish-surface
snapshot, the Admission finite-clock law (PR2), any per-call budget/timeout — the lane still reads
no clock (`S7` pins it), and the kit is still not wired into CI; its Receipt is the artifact.
World cleanup covers success, FATAL and throw; a SIGKILL mid-run can still leave
`tests/homes/a5p1-*` or `host-stdout.raw`, and `sweep-worlds.mjs` (`--dry`, `--scrub-raw`) remains
the runner-side repair.

## (i) reviewer slots (left empty by design)

| slot | reviewer | verdict | notes |
| --- | --- | --- | --- |
| R1 — R-a attribution rule vs the PR1 threat model (no re-wording) | _(empty)_ | _(empty)_ | _(empty)_ |
| R2 — R-b posture: is "one call, then withdrawn" the honest claim, and is the seam record complete? | _(empty)_ | _(empty)_ | _(empty)_ |
| R3 — kit honesty: 22 → 23 legs, and whether the explicit-bind change weakened anything | _(empty)_ | _(empty)_ | _(empty)_ |
