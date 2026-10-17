# Alpha.5 PR1-residual — §12 evidence set (R-a native attribution, R-b validate→resolve window)

Branch `alpha5-pr1r-residual-boundaries`, base **`db5cb5f7`** (= merged PR1 on `master`).
Host: DSH `0.2.0-rc.2` @ `639ed015397290b3745d163aafe02ffee4aa3f84`, pins from
[`tests/paths.mjs`](../../../../tests/paths.mjs). CORE PATCH BUDGET = 0: every change here is
inside this repository's own plugin lane, reached through public Host seams; the pinned Host tree
was read, never written (`C7b`).

> **B3 RETRACTION (this round, by user ruling).** Rows and sections marked *retracted* below carried
> the posture "an un-validated Body runs exactly once, the verification is withdrawn at that call's
> settled edge, therefore fail-closed / exposure = one call". That posture is withdrawn: the kit
> criterion that asserted it (`RW-RESIDUAL-RECORDED`, `v2 === 1`) is replaced by
> `RW-AFTER-DOOR-BODY-ZERO` (body count must be 0), the lane now cancels the un-executed call
> through the Host's own wrapper-signal contract, and the RED/GREEN pair
> [`runs/B3-after-door-RED.json`](runs/B3-after-door-RED.json) → 
> [`runs/B3-after-door-GREEN.json`](runs/B3-after-door-GREEN.json) is the evidence. Historical RED
> excerpts further down this file are kept as measurements of the time and are not restated as
> posture. Neither version of this file moves the threat model.

Two residuals from the PR1 review are decided, recorded, or bounded here. Neither changes the threat model:
both scenarios — a normal third-party same-name registration, and a normal concurrent
re-registration — are **inside the supported scope**, and this round measures them instead of
filing them under the excluded "attacker rewrites Host memory" class.

## (a) decision delta — what this round decided that merged PR1 left open

| # | decision taken | why, and where it is pinned |
| --- | --- | --- |
| 1 | **R-a**: a name's native standing is earned by comparing TWO public reads, not by membership in a name list. `tools.get(name)` (no scope) is the registry's **global view** — the same view the trusted native list was read out of — and `tools.get(name, scope)` is what **this Agent** resolves. Agreement is the price of a verified `native:` Binding | the pinned `view()` puts a scope's own registrations last, "shadowing an inherited name and outside the filter above" (`packages/core/tools/src/index.ts` @ `639ed01539`), so a per-agent variant of a native name is admitted by the Host's own advice ("for a per-agent variant, register through that agent's agent.ctx"). Pinned by `a5p1r-shadow-attribution.test.ts` (8 tests), `a5p1-closed-world-guard.test.ts` R1R/R1R-b/R1R-c, and by the real-registry kit leg `R1R-SHADOW` |
| 2 | Disagreement, and an unreadable trusted side, are **typed and separate**: `native-shadowed` / `native-unreadable`, each with its own message; both bind the name **UNVERIFIED** (governed, loud, refused at dispatch) instead of crediting it | `GOVERNED_UNVERIFIED_REASONS` + `GUARD_DENIAL_REASONS.NATIVE_SHADOWED / NATIVE_UNREADABLE` in [`closed-world-guard.ts`](../../../../packages/runtime/tool-dispatch/closed-world-guard.ts); `guardDecision` now states the recorded fact instead of flattening every case into `binding-unverified` (pinned: R1R-c, D15/D16, `R2`) |
| 3 | **R-b**: the `tools/execute` door (the door nearest the Body) re-asks the whole closed-world question, not only "is the Dispatcher ACTIVE" | the Guard stage runs at `:1519`, i.e. after `pre-execute`, while `dispatchToolBody` → `resolveExecution` runs at `:1578`, after every listener: a re-registration between them used to be validated by nobody. Pinned by `a5p1r-validate-resolve.test.ts` and the kit runner's `RW-INNER-DOOR` arm |
| 4 | **B3 — 取消语义已获用户裁决（2026-10-16 17:52Z）；见 (i)/(k)**: what still cannot be refused at a seam is **cancelled before its Body** — where the mechanism can act, and only there. The door arms a watch on the Definition identity it validated; the `tools/change` notification moves that watch; the watch's cancellation is what the Host reads at `:1572`, ahead of `resolveExecution` (`:1578`) — so the call is refused without any Body being resolved or invoked, and `bodyInvoked` stays false. The rejected design (a door that never calls `next()`) is not used; the native execute chain still runs | `pending-calls.ts` + `install.ts` `armWrapperSignal` (signal-wrapper contract `index.ts:155-159`); pinned by `a5p1r-change-abort.test.ts` and by the kit's `RW-AFTER-DOOR-BODY-ZERO` (real registry, body count 0). **Supersedes the previous row 4**, which claimed the exposure was "one call … never a standing state" — see the retraction below; that claim and its criterion are withdrawn. **Qualification (follow-up round, docs only)**: "cancelled" here is conditional on the channel having spoken and on the call not already being past `:1572`; the mechanism rests on three Host implementation facts pinned in [seam-record 增补](seam-record-post-door-resolution.md) §增补 (`pending-calls.ts:148-157`, `:1576`, `:1580`) and not on a public seam |
| 5 | An explicit re-bind by the trusted assembly now carries `revision = (in force ?? 0) + 1`. PR1's own law is "a change is a strictly higher immutable revision", but `bindAll` always wrote `revision: 1`, so the documented "refuse + re-bind" recovery could not actually re-bind a drifted name | `install.ts` `bindAll`; observable in the second half of `R1R-SHADOW` (the same world, bound explicitly, runs the Body) |
| 6 | The **kit's own** `pr1-*` arms take the documented `bindOwnTools` path for their adapter. Merged PR1 let them ride the very hole R-a closes — their adapter is a same-name shadow of a native name — so the legs measured what they claim *for the wrong reason* | `a5p1-order-hazard.mjs`'s pr1 branch. All nine `NEG1-*` legs pass unchanged with the explicit bind, which is what makes the count comparable: 22 → 23, one leg added, none weakened |
| 7 | `tools/change` is proven **not** to be a safety mechanism in this window: an arm of the runner makes that registration throw, and the refusal still happens with the same typed reason | `a5p1r-rereg-window.mjs`'s `guarded-pre-execute-no-change` arm ⇒ `RW-F2-ISOLATED` |

## (b) goal → source mapping

| residual (review `INFO-1` / `s12-evidence.md:253`) | implementation | tests / kit criteria |
| --- | --- | --- |
| R-a — a native name already shadowed at publish time entered governance as `verified` | [`closed-world-guard.ts`](../../../../packages/runtime/tool-dispatch/closed-world-guard.ts) `bindInheritedSurface(names, resolved, trusted)` (three facts, four cases) + `GovernedEntry.unverifiedReason`; [`install.ts`](../../../../packages/runtime/tool-dispatch/install.ts) `readTrustedDefinition` (the scope-less read) and the `published-surface-shadowed` / `published-surface-native-unreadable` observations | `a5p1r-shadow-attribution.test.ts` (RED-first), R1R / R1R-b / R1R-c in `a5p1-closed-world-guard.test.ts`, kit `R1R-SHADOW` (real registry, both halves) |
| R-a — explicit Team bind must still be the way a Team's own same-name Definition is admitted | unchanged entry points (`bindOwnTools` / `bindMcpTools`), plus decision 5's revision rule | `a5p1r-shadow-attribution.test.ts` "AN EXPLICIT Team Binding admits…", kit `R1R-SHADOW` second half, `NEG1-*` legs |
| R-b — validation→resolution window under a legal concurrent re-registration | `install.ts` inner door (re-`guard` at `tools/execute`), `scoped-dispatcher.ts` `noteCallEdgeDefinition` | `a5p1r-validate-resolve.test.ts` (5 tests), `a5p1r-rereg-window.mjs` (5 arms on the pinned registry), kit `RW-*` |
| Seam gap that no public seam can close | **取消语义已获用户裁决（2026-10-16 17:52Z）**；机制按该裁决记录（route (ii)），严格『只取消未执行』属性延期为 **D-1**，静默通道另为 **G-g**（未被该裁决吸收）— PoC-1 format, retraction inline (the file says neither closed nor compliant): [`seam-record-post-door-resolution.md`](seam-record-post-door-resolution.md) | `RW-AFTER-DOOR-BODY-ZERO` asserts body count 0 every run; `RW-CHANGE-INERT-LOUD` asserts the one configuration that cannot be proven is reported, never covered over |
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

**Decided and measured this round (asserted, not argued):**

* R-a pre-assembly shadow: a same-name shadow of a native name no longer inherits verification
  (`R1R-SHADOW`, `a5p1r-shadow-attribution`, R1R/R1R-b/R1R-c). The residual case recorded at
  `../alpha5-pr1-implementation/s12-evidence.md:253` is **retired** — the two-read comparison is
  now the rule, so the sentence "a native name ALREADY shadowed at publish time … enters
  governance as verified" no longer describes this lane.
* R-b's Guard→inner-door half: refused at the door nearest the Body (`RW-INNER-DOOR`).
* R-b's post-door half: **取消语义已获用户裁决（2026-10-16 17:52Z）**——定义变化/撤回取消关联**未执行**
  调用，并向关联**已开始**调用传播 abort 请求；不保证立即终止、不回滚已发生副作用；结果三分类见 (k)。
  该裁决为**事后裁决**，不回填 17:02 合并时点。严格"只取消未执行"属性延期（D-1）；静默通道 G-g 未被关闭。
  The moved Definition
  cancels the un-executed call and the Host refuses it before dispatch — `RW-AFTER-DOOR-BODY-ZERO`,
  `v1=0 v2=0 secondCallV2=0`, RED pair `runs/B3-after-door-RED.json` (`v2=1`) →
  `runs/B3-after-door-GREEN.json` (`v2=0`). The previous sentence in this file — "bounded rather
  than closed: one call, withdrawn at that call's own settled edge" — is **retracted**; the
  measurement it cited came from the `tools/change` channel rather than the call edge
  (`callEdgeWithdrawal: 0`), and `secondCallV2` is a cumulative counter.
* what still cannot be *proven* is the liveness of the notification channel itself: an accepted-but-
  never-delivered `tools/change` subscription is undetectable at assembly time. It is disclosed, not
  covered over: `changeChannel: 'armed'` plus a per-call `dispatcher-call-executed-unvalidated`
  alarm (`RW-CHANGE-INERT-LOUD`), and the kit proves liveness on the real Host (`RW-CONTROL`,
  `RW-AFTER-DOOR-BODY-ZERO`).
* a **caller** cancellation raised while the Body is in flight is not visible at the result edge of a
  direct `ctx.tools.execute()` call on this Host (measured without any lane:
  `runs/probe-cancel.mjs` → success-shaped result, no code). The lane therefore makes its
  cancel/terminate distinction on the two canonical codes the Host does emit
  (`ABORTED_BEFORE_DISPATCH` vs `ABORTED`), and does not claim a cancellation it cannot observe.
* The `bindAll` revision defect that made the documented re-bind path unusable after a drift.

**Ruled, with two things still open:** the interval between the last `tools/execute` listener and
`resolveExecution` at `:1578` — cancellation semantics **ruled by the user at 2026-10-16 17:52Z**
(widened scope; three-way outcome reporting; boundaries: 不扩大为 provider 卸载自动杀全团队 /
G-g 不随之关闭 / 事后裁决不回填 17:02 合并时点); the strict cancel-only-un-executed property is
**deferred as D-1** ([../../PENDING-GATES.md](../../PENDING-GATES.md)); and the silent-subscription
configuration remains **G-g** ((j) below, 支持矩阵定位未收口). See
[`seam-record-post-door-resolution.md`](seam-record-post-door-resolution.md) (PoC-1 format: the
seam asked for, where resolution actually happens, what the existing seams do and do not give,
the seam demands registered inside this project, and the status wording — which is deliberately
not "closed" and not "compliant").

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

## (i) 增补（后续修复轮，文档 only）— 三事实 / 三个项目内登记的 seam 需求 / 两处口径收窄

**纪律（裁决后更新）：本节所述 (ii) 机制的取消语义**已获用户裁决（2026-10-16 17:52Z）**，G-a 就此结束
"解除待裁"。该裁决是**事后裁决**，不回填 17:02 合并时点；本节仍不改实现，只把口径与裁决及机制实际
所依赖之物对齐。本节不写 "closed"/"合规"：合同性主张仍只欠两项——D-1（延期的严格属性）与 G-g（静默通道）。三个候选修法一律以**项目内登记的 seam 需求**记：本轮**不向任何外部
（含 Host upstream）发起请求**；对外提交属将来须用户另行授权的动作，本仓库文档不得声称"已提交/将提交"。**

1. **`raise` 无 body 门槛** — `packages/runtime/tool-dispatch/pending-calls.ts:148-157`：
   `onRegistryChange` 对每个 `watched` 记录（身份移动或不可读）**统一 abort**，没有也不可能有
   "Body 是否已开始"的判据（见第 3 条）。因此"取消"与"终止"的分界不在 lane 手里，只由 Host 的
   `:1572` 检查决定。
2. **融合传播 `:1576`**（`exec.signal = signal`）：安装在 `:1572` 拒绝检查**之后**，且被检查的就是
   同一个融合信号。故本机制的成立完全系于 `:1572` 一处；若上游把该检查移到 Body 之后、或改为
   重新导出信号而非融合，所有"取消"会**静默退化为"终止"**，而 lane 仍会如实报告结果码——即性质
   消失而叙述仍真。此为无公开契约固定的实现依赖。
3. **body-start 无公开可观察性 `:1580`**（`state.bodyInvoked = true` 为私有字段）：无公开事件宣告
   Body 已开始。lane 的取消/终止区分因此是**结果形状**（settled edge 读两个规范码），不是事件形状；
   `dispatcher-call-outcome-unreadable` 正是为"码读不到时不把推断当事实"而存在。

**三个候选修法（= 项目内登记的 seam 需求/候选路线，非对外请求）**：
① **seam 需求（项目内登记，`CORE_SEAM_BLOCKER` 类）**：公开 pre-body 步骤（可拒绝、body 前缘可观察）；
需 Core 侧改动，本仓库仅登记入册，不外部提交，亦不绕行。
② **seam 需求（项目内登记，同类）**：resolution-pinned 执行（把已解析 Definition 钉进 execution，窗口整体
消失，并解除对 F2 复读的依赖）；需 Core 侧改动；对本威胁模型严格优于 ①（消除重解析而非在其前设门）。
③ **候选路线（本侧，不需 Core）**：裁决语义——把"定义已移动且 Body 可能已开始"上升为治理裁决（turn 级
中止/重投，或结果标记不可信后裁决）；代价是取消语义上移至 Session 层，且需 G-a 所候的用户裁决。

**口径（本记录不写 "closed"/"合规"）**：本节所载为"机制已按裁决记录"。就已量到的部分说：机制只作用于
"调用尚未被 dispatch 时定义移动"这一类，且其正确性依赖上述三条实现事实；它**不覆盖**静默通道（见 (j)：
独立开放项 **G-g**，不随 2026-10-16 17:52Z 裁决关闭），也**不覆盖**与已开始 Body 竞争的移动（后者按设计是终止、按已执行
上报）。`RW-AFTER-DOOR-BODY-ZERO` / `RW-CHANGE-INERT-LOUD` 是**测量**，不是验收：裁决 (17:52Z) 接受的是
"在此实现上按三分类如实上报取消/终止"，不是把测量升格为合同；合同性缺口由 D-1 与 G-g 承载。

**静默通道降级=名字级（精确表述）**：`tools/change` 已订阅但未投递时，实测（`RW-CHANGE-INERT-LOUD`：`v2=1` +
`dispatcher-call-executed-unvalidated` + alarm）在飞调用**未被取消**（没有任何东西能取消它）；lane 做的是在该
调用 settled edge **撤回该名字的 Binding**，于是该名字**后续**调用被拒，直到显式 re-bind。故可主张："被漂移的
名字在其下一次调用前被钉住"；**不可**主张："被漂移名字的进行中调用被取消"（后者仅在通道确实投递时成立）。
**该配置的支持矩阵定位未收口，作为独立开放项 G-g 记于 (j)，不随 G-a 默认关闭。**

## (j) G-g — 静默已订阅通道：独立开放项，**支持矩阵定位未收口**（不随 G-a 默认关闭）

**配置**：`tools/change` 的 `on` 存在且订阅成功，但该事件**永不投递**（订阅被接受而通道不发声）。
这与"订阅抛错/`on` 不存在"（→ 装配期 `IO_POLICY_UNSUPPORTED`，点名 `tools/change`）**不是同一配置**：
后者当场拒绝装配，前者在装配期**不可区分**。

**当前事实（本构建、本 Host 实现）**：该配置下机制**降级为名字级**，且仅带响亮 alarm——
在飞调用不被取消（无任何手段可取消它）；lane 在该调用 settled edge 撤回**该名字**的 Binding，
于是该名字后续调用被拒直到显式 re-bind；同时每调用发 `dispatcher-call-executed-unvalidated`
（severity `alarm`，`changeChannel:'armed'`）。

**证据原文位置**（可复核，非转述）：
- `runs/kit-r1r-fix1/rereg-window.json` 判据 `RW-CHANGE-INERT-LOUD` 原文
  `v2=1 unvalidated=1 issued=0 channel=armed verifiedAfter=false`；
- `runs/kit-r1r-fix1.log` 第 23 行同判据的 PASS 行（`the moved Body does run (nothing can cancel it)`）；
- 对照腿（通道确实发声时）：`runs/kit-r1r-fix1/rereg-window.json` 的 `RW-AFTER-DOOR-BODY-ZERO`
  原文 `v1=0 v2=0 code=ABORTED_BEFORE_DISPATCH issued=["grep:p00-c1"]`，及
  `runs/B3-after-door-GREEN.json` / `runs/B3-after-door-RED.json`（RED→GREEN 对）；
- lane 腿：`packages/runtime/test/a5p1r-change-abort.test.ts`（inert-channel 双腿）与
  `runs/B3-lane-GREEN.log`。

**支持矩阵定位：未收口（not settled）。** 上列是**事实**，不是"支持姿态"：该配置的验收状态按
**UNSUPPORTED / 待证**处理，且**不因 2026-10-16 17:52Z 裁决而关闭**（裁决原文即把该配置列为不随之关闭）
——G-g 需自己的契约收口动作（后续），
收口前不得在任何矩阵/文档中把它记为 supported、closed 或 compliant。

**该配置下允许的说法**："被漂移的名字在其下一次调用前被钉住（并响亮上报）"。
**不允许的说法**："被漂移名字的进行中调用被取消"（仅在通道确实投递时成立）。


## (k) 支持矩阵 — 取消语义按 2026-10-16 17:52Z 裁决标注（测量腿原文保留）

裁决内容（原文口径）：**定义变化/撤回 ⇒ 取消关联未执行调用 + 向关联已开始调用传播 abort 请求；
不保证立即终止；不回滚已发生副作用；结果三分类 = 未执行 / 已执行可能有副作用（原值保留）/ 终止未确认。**
边界：不扩大为 provider 卸载自动杀全团队；G-g 不随之关闭；事后裁决不回填 17:02 合并时点。
下表**验收依据**一列本轮由"G-a 冻结"改为"用户裁决（17:52Z）"；**测量腿原文一律不动**。

| 配置 | 本实现行为（三分类归属） | 测量腿原文（`runs/kit-r1r-fix1/rereg-window.json` 除注明外） | 验收依据 |
| --- | --- | --- | --- |
| A 定义变化/撤回，调用**尚未执行** | 取消；类别=未执行 | `RW-AFTER-DOOR-BODY-ZERO` `v1=0 v2=0 code=ABORTED_BEFORE_DISPATCH issued=["grep:p00-c1"]` | 用户裁决 2026-10-16 17:52Z |
| B 定义变化，Body **已开始** | 传播 abort 请求；类别=已执行可能有副作用（原值保留）；不保证立即终止 | `RW-ABORT-INSIDE-BODY-IS-TERMINATION` `v1=1 code=ABORTED terminated=1/1 cancelledBeforeBody=0 text=Error: tool call aborted` | 同上（裁决明文含"不保证立即终止/不回滚副作用"） |
| C 同一定义多调用并发（混合状态） | 未执行者取消、已开始者终止，均入账不误判 | `RW-MULTI-CALL-ALL-CANCELLED` `v1=1 v2=0 cancelled=1 terminated=1 late=0 issued=["grep:p00-c1","grep:p00-c2"]` | 同上 |
| D MCP 整代撤回+重注册 | 在飞未执行调用取消；名字撤回至 re-bind | `RW-MCP-RESYNC-CANCELS-AND-REBIND-RESTORES` `v1=0 cancelled=1 withdrawnThenRestored=false->true rebindOk=true thirdCallV2=1 rebindErr=null` | 同上 |
| E 终止无法确认 | 类别=终止未确认（不并入"未执行"，也不并入"已执行"） | `runs/kit-r1r-fix1/order-hazard.json` 的 `EXECUTION_TERMINATION_UNCONFIRMED`；lane 侧 `dispatcher-call-outcome-unreadable` | 同上（三分类之三即此） |
| F 通道**不可**订阅（`on` 缺失/订阅抛错） | 装配期拒绝，不装弱 | `RW-NO-CHANGE-CHANNEL-UNSUPPORTED` `refused=true code=IO_POLICY_UNSUPPORTED message=cannot subscribe to the public notification "tools/change"` | 既有裁决链（PR257 修复轮 ②/⑧） |
| G 通道**已订阅但永不投递**（=G-g） | 名字级撤回 + 响亮 alarm；在飞调用不受影响 | `RW-CHANGE-INERT-LOUD` `v2=1 unvalidated=1 issued=0 channel=armed verifiedAfter=false` | **未收口**：按 UNSUPPORTED/待证；**不因 17:52Z 裁决改变**（见 (j)） |
| H 无变更正控 | 正常执行，不发 abort | `RW-AFTER-NO-CHANGE` `v1=1 v2=0 text=ran:grep@V1 issued=0 verifiedAfter=true` | 正控，无需新验收 |
| I 隔离（邻工具） | 只点名被漂移者 | `RW-ISOLATION-NEIGHBOUR-TOOL` `r1=1 v1=0 v2=0 issued=["grep:p00-c1"] watched=[]` | 裁决未触及隔离方向，口径不变 |
| J 结果身份 / teardown | 两条边同 callId 同码；台账空、有序 teardown 到 RELEASED | `RW-HOOKS-RESULT-IDENTITY` `edges={"post":[{"callId":"p00-c1","code":"ABORTED_BEFORE_DISPATCH"}],"result":[{"callId":"p00-c1","code":"ABORTED_BEFORE_DISPATCH"}]} cancelled=1`；`RW-TEARDOWN-NO-LEAK` `pendingAfter=[] teardown={"ok":true,"code":null} state=RELEASED` | 不变 |

**延期项**：严格『只取消未执行』（不向已开始调用发 abort）= **D-1**，登记于
[../../PENDING-GATES.md](../../PENDING-GATES.md)：恢复须公开可信 body-start/pre-body 检查（候选三件见
seam-record DEFERRED 节），并须 a5p1r change-abort 的『已开始不取消』硬门腿 + 隔离反例先行通过。

## (l) 收尾必做 D-2 — skills 文档对齐（本轮只钉路径/owner/验收，不动文件）

- **路径（钉死）**：`.agents/skills/team-leader-operations/SKILL.md`；若 blueprint 侧语义受影响，一并
  `.agents/skills/team-blueprint-authoring/SKILL.md`。
- **执行时点**：本阶段（PR1r/PR258 文档线）完成**之后**的收尾轮执行；本轮**不触碰该文件**。
- **owner**：集成 owner 提名 → 用户确认（与 D-1 同一规则；本轮不自行指派）。
- **验收（先钉）**：skill 文本须与 (k) 的取消语义一致——三分类（未执行 / 已执行可能有副作用（原值保留）/
  终止未确认）、不保证立即终止、不回滚已发生副作用；且**不得**残留两种旧口径：『定义移动只影响后续调用』
  式的弱表述，或『已开始调用绝不收到 abort』这一尚未恢复（D-1）的强表述。
- **核验方式**：收尾轮 review 逐条比对本文 (k)/(j) 与 skill 文本；不一致即不通过（文档一致性属 review
  范围，不由写者自证）。
