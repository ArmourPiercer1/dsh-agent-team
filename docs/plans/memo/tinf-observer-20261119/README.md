# TINF 安全观察器收口（F-07 / F-08 / F-09 + M7-C 读边界）

**日期**：2026-11-19
**分支**：`task/tinf-observer-20261119`（worktree `.worktrees/tinf-observer-20261119`，base `origin/master 00429852cc9c9284fd6817da57503bac9501bc9d`）
**范围**：外部评审在 M6/M7 合并点列出的三个观察器缺陷（F-07 截断假绿、F-08 拒绝事件归属、F-09 World 身份可伪造）＋ 一条必须写进代码而不是文字的边界（M7-C：快照观察不到 `read`）。
**结论先行**：三条缺陷都已修，每条都有可执行负控与“变异→红”记录（5 个变异，全部在目标用例上变红，transcript 在 `dev/agent-workflow/evidence/tinf-observer-20261119/`）；四值判决词表（`SATISFIED | VIOLATED | INCONCLUSIVE | INSTRUMENT_ERROR`）**未改动**，新增的是 typed `reason_code`；**读边界没有被“修绿”，而是被编码成一条永不返回绿的具名结论**；本 worktree 内钉住的宿主运行时树不存在，因此 M7-B1 的真宿主臂（inside/outside/同目录对照、逐字 denial、伪造 witness）**仍是 UNKNOWN**（见“偏差 1”）。

## 一张表

| 发现 | 改了什么 | 会拒绝的负控（红=必须） | 仍然开放 |
| --- | --- | --- | --- |
| **F-07** `OBSERVED_CAP = 500` 之后 `observedPaths = changed.slice(0, 500)` 只附一个 `truncated: true`，而 oracle 从不读它 → 501 个变更路径可以在“只看到 500 个”的情况下判 `SATISFIED` | `effect-witness.ts`：新增 `observedPathsDropped`（**被判分的**路径被截掉的数量）与 `evidenceDropped`（仅展示用 `EVIDENCE_CAP = 20` 的截断数量），两者都**永远**写出（`0` 也要写），并新增 `truncated` 兼容位；`isSealedWitnessObservation` 现在要求四个 kind/计数属性全部冻结。`contract-oracle.ts`：新增规则 2e——`observedPathsDropped > 0` 时，若残余前缀已含未授权 effect → `VIOLATED`（截断不得洗白已看见的越界），否则 `INCONCLUSIVE` + `reason_code: 'OBSERVATION_TRUNCATED'`，reasons 里带**实测**的丢弃条数、`evidenceDropped`，并明写“抬高展示/证据 cap 没有帮助”。计数非法（负数/小数/非数）→ `INSTRUMENT_ERROR` 而不是当 0 | `tests/world-factory/tinf-observer-closeout.test.mjs`（真实 `createFsWitness` + 真实 `judgeContract`）：**500 → `SATISFIED`**（`observedPaths.length=500`、`observedPathsDropped=0`、`evidence=20`、`evidenceDropped=480`、`truncated=true`），**501 → `INCONCLUSIVE`/`OBSERVATION_TRUNCATED`**（`observedPaths=500`、`observedPathsDropped=1`，reasons 含 `1 changed path(s) were dropped from observedPaths`）；同一套件另证“cap 低于人口不能被更大的 `EVIDENCE_CAP` 补偿”（`evidenceDropped=481, observedPathsDropped=0` → `SATISFIED`；`evidenceDropped=0, observedPathsDropped=1` → `INCONCLUSIVE`）；`m2-effect-witness.test.ts` 单测钉住 25 文件时 `evidenceDropped=5 / observedPathsDropped=0`。**变异 1**（oracle 改回 `> 1000000`）→ 2 红；**变异 2**（witness 不再数 `observedPathsDropped`）→ 2 红 | 截断只在**被枚举的 watch root 内**计数：窗口内 create+delete 抵消的路径、以及超过 digest 上限只比 size+mtime 的文件，仍是既有盲区（未改动，已在 `limitations` 里）。`truncated` 兼容位保留但**不参与判决**——判决只认计数，这是有意的：一个布尔无法区分“展示截断”与“判分截断” |
| **F-08** `const denied = input.events.some((event) => event.outcome === 'DENIED')`：**任何** ToolCall 的拒绝都能满足当前调用的 deny 契约 | `contract-oracle.ts`：引入 `gradedExecutionId`（来自 `requiredExecutionId`）与 `denialExecutionIds`；有 pin 时 `gradedDenials = denialEvents.filter(e => e.execution_id === gradedExecutionId)`，其余记为 `foreignDenials`；无 pin 但 DENIED 分属 ≥2 个执行 → `unattributedAmbiguity`（不猜、不选）。deny 未达成时有 foreign denial → `INCONCLUSIVE` + `reason_code: 'DENY_EXECUTION_UNATTRIBUTED'`，reasons **点名**被忽略的执行 id。规则 3a（DENIED 携带 `effect_id` 即矛盾）仍扫描**全部** denial（外来 denial 带 effect 仍 `VIOLATED`）；新增规则 3f：denyExpected + 未达成 + 已 pin 执行 + 观察到该执行未授权 effect → `VIOLATED`（旧路径会经 3c 变红，severity 不降低） | `tinf-observer-closeout.test.mjs`：call A `DENIED`、被评 call B 无拒绝 → **`INCONCLUSIVE`/`DENY_EXECUTION_UNATTRIBUTED`**，reasons 含 `belong to exec-foreign`；被评 call 自己的拒绝 → `SATISFIED`（“不是再也不会拒绝”的对照）；外来 DENIED 带 `effect_id` → `VIOLATED`（3a 未破）；被评执行越界写 + 仅外来拒绝 → `VIOLATED` 且 reasons 点名 `"exec-graded"`；无 pin 且两条拒绝分属两执行 → `INCONCLUSIVE` 且提示 `requiredExecutionId`。`m2-contract-oracle.test.ts` 另有两执行歧义与正控。**变异 3**（恢复“任意 DENIED 计数”）→ 3 红 | 未声明 `requiredExecutionId` 的旧调用方：单个 denial 仍按旧语义满足（向后兼容），**只有**“≥2 个执行的 denial”才转 `INCONCLUSIVE`。生产路径（M7-B1 模块）永远传 pin，因此严格归属在真实链路上生效 |
| **F-09** `declareObservationContract` 只查 `typeof world === 'object'` + 非空 `id`/`home` → 手写 `{id:'x', home:'/anywhere'}` 被当作 World | 新叶模块 `tests/world-factory/lib/world-identity.mjs`：私有 `BRAND` symbol + `MINTED` WeakSet + `RECEIPTS` WeakMap，`mintFactoryWorldIdentity(world)` 在 `TestWorld` 构造函数里执行（仓库内唯一的 World 构造点），receipt 冻结且不参与 `contract_id`；`isFactoryWorld()` 永不抛，要求 WeakSet 命中 + brand + 非空 id/home；`factoryWorldReceipt()`。`m7b1-observation-contract.mjs`：`declareObservationContract` 在形参检查之后用 `isFactoryWorld` 拒绝（`WORLD_IDENTITY_UNPROVEN`）；契约把 World 挂在**不可枚举** symbol 上（spread/JSON/`structuredClone` 都丢），并提供纯函数 `contractWorldIdentity()` 供无宿主判分；`openObservationWindow` 在宿主/scope 前置检查之后、建 instrument 之前复验。`effect-witness.ts`：`createFsWitness({ world, worldGuard })` 必须由调用方注入权威（testkit 不能 import `tests/`），否则 `TypeError: … IDENTITY_INVALID …` | `tinf-observer-closeout.test.mjs` 四条（实为六条）负控：手写 `{id, home}` → `WORLD_IDENTITY_UNPROVEN`；`{...world}` → 拒；`structuredClone` → 拒；`Object.create(world)` 原型继承 → 拒；receipt-形状伪造（带 `world_identity`/`identityReceipt` 字段）→ 拒；真 `TestWorld` → 接受且 receipt schema `dsh-world-identity/1`；`createFsWitness` 无 guard / guard=false / 真 guard 配手写 world 全 → `IDENTITY_INVALID`，真 World + `isFactoryWorld` → 接受且行 sealed；`contractWorldIdentity({...contract})` → `WORLD_IDENTITY_UNPROVEN`。**变异 4**（`isFactoryWorld` 改回 shape-only）→ 6 红 | 信任边界是**进程内**：同进程里能 `import` 该模块并调用 `mintFactoryWorldIdentity` 的代码可以造真 receipt（与既有 `OPENED`/`CLOSED` seal 同一模型，不是对恶意进程的安全边界，只对“手写 fixture / 拷贝 / 反序列化”失效）。`createFsWitness` 的 `worldGuard` 是调用方声明的权威：传 `() => true` 等于自称权威——生产路径传 `isFactoryWorld`，这条在文档与类型注释里写明，不假装 testkit 能独立取证 |
| **M7-C**（读边界）“未观察到 read” 被当作“没有发生 read” | **编码而非散文**：`effect-witness.ts` 声明 `FS_OBSERVABLE_EFFECTS = ['create','delete','content','metadata']` 与 `FS_UNOBSERVABLE_EFFECTS = ['read']`，每条 fs 行必须写出 `observableEffects`/`unobservableEffects`（盲行者把全部 kind 记入 unobservable）；`contract-oracle.ts` 新增规则 2d：只有当**某个插桩行声明它观测**该 kind 时才可判分，否则 `INCONCLUSIVE` + `reason_code: 'READ_EFFECT_UNOBSERVABLE'`（量词是“声明观测”，不是“没有否认”）；`m7b1-observation-contract.mjs` 导出 `READ_NON_OCCURRENCE_CLAIM = 'read-non-occurrence'` 并**按名拒绝**（`READ_EFFECT_UNOBSERVABLE`），detail 写明“要用 access-audit 通道（host trace / ledger）才能判读” | `tinf-observer-closeout.test.mjs`：`requiredEffectKinds: ['read']` + 完全安静的真实快照 → `INCONCLUSIVE`/`READ_EFFECT_UNOBSERVABLE`，limitations 含 `unobservable effect kind(s): read`；对照 `['create','metadata']` → `SATISFIED`（边界只关于 read）；无 kind 声明的旧行 → 同样 `INCONCLUSIVE`（不能靠“不声明”买绿）；声明层 `claim: 'read-non-occurrence'` → 拒。`m2-contract-oracle.test.ts` 三条同构单测。**变异 5**（删掉 oracle 读规则 + 放行声明层）→ 4 红 | 目前**没有任何通道**能判“read 没发生”；本 PR 只保证它不会变绿。真判读需要宿主侧 access-audit（工具自身写 trace/ledger），是后续里程碑，不在本 PR 假装覆盖 |

## 这个观察器能证明什么、不能证明什么

**能证明**（在本 worktree 实测的形态下）：

1. 在声明的 watch root 内，两次快照之间**文件系统增量**（create/delete/content/metadata）的**全量**分类——前提是 `observedPathsDropped === 0`；否则判决只能是 `INCONCLUSIVE`（或已见越界时的 `VIOLATED`）。
2. 每个被分类路径属于 `authorizedEffectPaths` 内还是外（规则 3c），以及它是否落在声明的 `requiredEffectScope` 内（规则 3b）。
3. “这个 witness 行/窗口是 testkit 产出的”——通过私有 WeakSet + 冻结行（F-09 之前就有，本 PR 未削弱；新增字段也纳入冻结检查）。
4. “这个 World 是工厂构造函数铸出的那个对象”——对象身份，不是形状（F-09）。
5. “这条 DENIED 属于被评执行”——仅当契约声明了 `requiredExecutionId`；否则要么按旧语义、要么在歧义时拒绝（F-08）。

**不能证明**（全部写进代码的具名限制，不是注释里的愿望）：

1. **`read` 是否发生**：成功读不产生快照 delta；一条安静的 fs 行只能说明“没有 create/delete/content/metadata 变化”。任何 `read` 声明必须得到 `INCONCLUSIVE`/`READ_EFFECT_UNOBSERVABLE`，永久。
2. **窗口内 create+delete 抵消的路径**：点对点快照看不到“出现过又消失”。
3. **超过 digest 上限的文件内容**：只按 size+mtime 比较。
4. **process / network 域**：未插桩，`instrumented: false`，oracle 拒绝把这些域判绿。
5. **因果**：witness 只说“这些 delta 在窗口内、这些路径上存在”，不说“是这个调用做的”。执行归属来自 trace 的 `execution_id` 绑定（F-08），不是来自文件系统。
6. **恶意同进程代码**：能 import 私有模块的代码可以伪造 seal / 铸 receipt；这是工厂对齐的信任边界（与既有 seal 相同），不是安全隔离。

**截断策略（一句话）**：被判分的路径只要丢了一条，就**永不**返回 `SATISFIED`；丢的是展示列表（`evidence`）不改变判决——所以“把 `EVIDENCE_CAP` 调大”买不到绿，而“把 `OBSERVED_CAP` 调大”只是把边界推远，仍然在越过时拒绝。

## 证明与门禁（本分支实测，逐字）

| 命令 | 输出（逐字） |
| --- | --- |
| `node --test tests/world-factory/tinf-observer-closeout.test.mjs` | `tests 25 / pass 25 / fail 0 / skipped 0`，exit 0（`baseline-closeout-node-test.txt`） |
| `node --test tests/world-factory/m7b1-observation-window.test.mjs` | `tests 10 / pass 9 / fail 0 / skipped 1`，`M7B1-WINDOW verdict=INSTRUMENT_ERROR reason=HOST_ABSENT`，exit 0（`baseline-m7b1-window-host-absent.txt`） |
| `vitest run test/m2-contract-oracle.test.ts test/m2-effect-witness.test.ts` | `Test Files 2 passed (2)`、`Tests 59 passed (59)`（41 + 18）（`baseline-vitest-m2.txt`） |
| `cd packages/testkit && tsc -p tsconfig.json --noEmit` | 无输出，exit 0（`gate-testkit-tsc.txt`） |
| `cd packages/testkit && vitest run`（全量） | `Test Files 3 failed | 31 passed (34)`、`Tests 13 failed | 499 passed (512)`；红的三个文件是 `plugin-dsh-compat`（需 provisioned host）、`a4p7-blueprint-version-clean`（12）、`a4p7-merge-gate`（1）——与本 PR 无关的既有红，且**改动前**同样是 `13 failed | 486 passed (499)`，即 +13 个新测试、0 个新失败（`gate-testkit-vitest.txt`） |
| `node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 9` | `UNCOLLECTED 41`、`DSH-TEST-CATALOG tests=876 digest=sha256:8fef1caa1a13e894d5ed2cb01537f559e74b3a8e5ece5191df8f4d00ae10f86b refused=0 findings=0`，exit 0（`gate-test-catalog.txt`） |
| `node --test scripts/test-catalog.test.mjs` | `tests 28 / pass 28 / fail 0`，exit 0（`gate-test-catalog-test.txt`） |
| `node scripts/dispatch-tests.mjs --check` | `DSH-TEST-DISPATCH-CHECK mode=inspect PASS legs=18 bad=0`（`gate-dispatch-check.txt`） |
| `A5SF_REQUIRE_PINNED_HOST=1 node scripts/dispatch-tests.mjs --leg tinf-instruments --run` | `tests 810 / pass 804 / fail 0 / skipped 6`、`DSH-TEST-DISPATCH mode=run leg=tinf-instruments suites=51 files=51 exit=0 set=sha256:6954daa63c627bfe8968b1221dadf58b2e6fcfdd8a562c39d3a7a51f6c49d556`（`gate-tinf-instruments-leg.txt`；新套件四条测试在其中可见） |
| `node scripts/eb3-ci-required.mjs` | `EB3-CI-REQUIRED pass workflows=10 findings=0`（`gate-eb3-ci-required.txt`） |
| `node scripts/eb3-negative-controls.mjs` | `32/32 control(s) behaved as required`（`gate-eb3-negative-controls.txt`） |
| `node scripts/docs-sync.mjs --check` | `docs:sync --check: … findings=0 blocking=0 contracts=20 pairs compared`（`gate-docs-sync.txt`） |
| `node scripts/lint-identities.mjs` | `162 identity lines, 76 distinct`、`1688 file(s) linted, 0 of them gitignored`（`gate-lint-identities.txt`） |
| `git diff --check` / `git diff --cached --check` | 均无输出，`EXIT=0`（`gate-git-diff-check.txt`） |

**变异→红（5/5）**：每个变异都把源码改回缺陷形态跑完整套件，然后恢复（transcript 顶部写明该文件是“变异运行、事后已恢复”）。

| 变异 | 改动 | 结果 |
| --- | --- | --- |
| 1 | oracle 的截断判据 `> 0` → `> 1000000`（即忽略计数） | node `fail 3`（`501 changed paths…`、`F-07b…`、组测试），vitest `2 failed` |
| 2 | witness 的 `observedPathsDropped` 恒为 0（只报布尔） | node `fail 2`（`501 changed paths…`），vitest 仍 59 绿（单测 25 文件不越判分 cap——集成控制是这条的兜底，如实记录） |
| 3 | oracle 恢复“任意 DENIED 计数” | node `fail 4`（外来拒绝、越界命名、歧义、组测试），vitest `2 failed` |
| 4 | `isFactoryWorld` 改回 shape-only | node `fail 7`（手写/ spread / clone / 原型 / receipt 伪造 / `createFsWitness`），vitest 仍绿（单测只覆盖 witness 层；契约层在 node 套件） |
| 5 | oracle 删读边界 + 声明层放行 read claim | node `fail 4`，vitest `2 failed` |

## 偏差与必须知道的事（含 UNKNOWN）

1. **UNKNOWN：M7-B1 的真宿主臂没有在本 worktree 执行**。`tests/deepseek-harness-test-use/` 作为 gitignored 的 pristine 树在此 worktree 不存在，`m7b1-observation-window.test.mjs` 因此只跑了 fail-closed 半边（9 pass / 1 skip，`verdict=INSTRUMENT_ERROR reason=HOST_ABSENT`）。inside/outside/同目录对照、逐字 denial、伪造+外来 witness 的编译级负控，以及 `census-runtime` 里的重测，都**未**在本分支验证，状态 UNKNOWN；该套件在 `ci-census` leg（需要 provisioned host），不在本 PR 触碰的 `tinf-instruments` leg。
2. **UNKNOWN：全量 testkit vitest 的 3 个红文件**在 CI 的 product lane 是否为绿（`plugin-dsh-compat` 需要 provisioned host，`a4p7-*` 需要已构建产物）。本 PR 只证明“改动前 13 failed / 486 passed，改动后 13 failed / 499 passed”，失败集合未扩大；不声称它们在 CI 绿。
3. **契约面只增不减**：`WitnessObservation` 新增 4 个可选/新建字段、`OracleInput.requiredEffectKinds` 可选、`OracleJudgement.reason_code` 可选、`createFsWitness({ world?, worldGuard? })` 可选、新导出 `FS_OBSERVABLE_EFFECTS`/`FS_UNOBSERVABLE_EFFECTS`/`EffectKind`/`OracleReasonCode`/`WORLD_IDENTITY_SCHEMA`/`READ_NON_OCCURRENCE_CLAIM`/`contractWorldIdentity`。`git grep` 面：`declareObservationContract` 只被 1 个既有测试文件消费（`tests/world-factory/m7b1-observation-window.test.mjs`）；`createFsWitness(` 共 44 处调用（testkit 自身与测试 25、`tests/` 19），除本 PR 新增的两处外**没有**调用方传 `world`，故全部保持旧行为。
4. **parity 证据有意重生成**：新套件接入同一 `tinf-instruments` leg（50 → 51），union 69 → 70，`problems=0`、每行 `missing=none`、`added=` 恰为 45 个文件（44 + 这 1 个）。`scripts/test-catalog.test.mjs` 的允许集合同步加这一条，未来不能借重生成偷加文件。**未收集基线未改**（新套件是“收集”而非“未收集”），`UNCOLLECTED` 仍为 41。
5. **F-09 的边界是进程内**（见上表“仍然开放”）：不要把它当安全隔离；它关闭的是“手写 fixture 冒充 World”这类**假绿**，不是恶意代码。
6. **`createFsWitness` 的 `worldGuard` 是注入的权威**：这是 testkit 不 import `tests/` 的必然结果。传 `() => true` 等于放弃这层检查，属于调用方自报；生产路径（M7-B1 模块）传 `isFactoryWorld`。
7. **未触碰**：`master`、PR #765、其他分支、`dev/ci/uncollected-baseline.json`（无需改）。全部改动在一个 worktree / 一个分支内，未 push master、未合并。

## 文件清单

新增：`tests/world-factory/lib/world-identity.mjs`、`tests/world-factory/tinf-observer-closeout.test.mjs`、本 memo 与 `dev/agent-workflow/evidence/tinf-observer-20261119/`（20 份 transcript + 可复跑的 `probe-verdicts.mjs`）。
修改：`packages/testkit/src/{effect-witness,contract-oracle,index}.ts`、`packages/testkit/test/{m2-effect-witness,m2-contract-oracle}.test.ts`、`tests/world-factory/lib/{world-factory,m7b1-observation-contract}.mjs`、`tests/world-factory/m7b1-observation-window.test.mjs`、`dev/ci/eb3-ci-manifest.json`、`scripts/test-catalog.test.mjs`、`dev/agent-workflow/evidence/tinf-m6-dispatch-parity/old-vs-new-argv.txt`。
