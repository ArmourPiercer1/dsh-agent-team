# TINF 信任收口（F-01…F-06）— 修复记录与残余风险

**日期**：2026-11-15
**分支**：`task/tinf-trust-fix-20261115`（base `origin/master 7e3b6532a`，M6 已合并）
**范围**：外部专家对 M6 合并点 `7e3b6532a` 的评审所列 2 个 P0 + 3 个 P1；**F-06 明确不在本 PR 范围**。
**结论先行**：F-01/F-02/F-04 已修且有负控；F-03/F-05 已修且有负控；**F-06 未修，本文不做任何“已覆盖”暗示**；**L2 P50 ≤ 10 min 未达成，本 PR 不声称达成**。

## 一张表

| 发现 | 改了什么 | 会拒绝的负控 | 仍然开放 |
| --- | --- | --- | --- |
| **F-01** `--run --json` 只打印计划、exit 0、不 spawn；`eb3-ci-required` 只 grade cmd 前缀 | `dispatch-tests.mjs`：`--run` 与 `--json/--list/--check/--parity/--run-args/--help` 互斥，先于 manifest 读取/输出/spawn 抛 `DISPATCH_MODE_CONFLICT` exit 2；`--run` 无 `--leg` → `DISPATCH_NO_LEG`；spawn 前断言解析 argv 非空；token `mode=run … exit=N` 只在 spawn 返回后打印；inspect 输出带 `mode=inspect`；返回 runner 自身 exit。`eb3-ci-required.mjs`：整个 argv 逐 token 精确 grade（`check[]` 文法，`<value>` 只吃一个非选项 token），dispatch leg 的 `cmd` 尾部白名单恰为 `[]`，任何多余 token（`--json`/`--list`/第二个 `--leg`/env 赋值）→ `CI_LAYER_LEG_EXTRA_ARGUMENT`，fail closed | `scripts/dispatch-tests.test.mjs`：全部冲突对、`--run` 缺 leg、真实 spawn 正控（先看到 `ℹ tests` 再看到 run token）、inspect 不 spawn；`scripts/eb3-ci-required.test.mjs`：给 manifest 的 `tinf-instruments` 追加 `--json`/`--list` → `CI_LAYER_LEG_EXTRA_ARGUMENT`，未改 manifest 仍 `pass workflows=10 findings=0` | 旧 `check[]` 从“前缀”收紧为“精确尾部”；真实 10 个 workflow + manifest 的 leg 已逐条审计并声明尾部 token（未走 grandfather）。若未来 leg 需要新尾部 token，必须写进 `check[]`，否则红 |
| **F-02** 计划只记 root/capture 计数，report 的 collected 文件集从未与计划的 per-root 期望集比较 | `census-plan.mjs`：每个 root 记录排序后的 `files_expected[]`、`file_count`、`file_digest`（sha256 over 排序换行拼接），顶层 `file_count`；人口进入 `plan_digest`（同数换文件也会移动身份）。`census-execution.mjs`：`resultsFromReport()` 双向比较——缺失 → `INCOMPLETE` + `FILE_MISSING`（点名文件），多出 → `INCOMPLETE` + `FILE_UNPLANNED`，零断言的文件级失败 → `INCOMPLETE` + `COLLECTION_ERROR`；结果携带 `files_expected/files_observed/file_digest`；不可枚举的计划 → `PLAN_POPULATION_MISSING`。`census-aggregate.mjs`：逐结果 digest 不等 → `RESULT_FILE_SET_MISMATCH`；观测总数不等 → `INCOMPLETE` + `SUMMARY_FILE_TOTAL_MISMATCH`。`dev/ci/census-population-baseline.json`（11 roots / 705 files）为已评审基线；root 少文件或同数换文件 → `POPULATION_SHRANK`，增长允许；缩小必须在同一 PR 更新基线 | `scripts/tinf-trust-closeout.test.mjs`：**评审给的原例**（计划 100 文件、report 只有 1 个且 `success=true`）→ 断言 `INCOMPLETE/FILE_MISSING`，并再走 CLI 聚合断言输出 `DSH-CENSUS-SUMMARY INCOMPLETE`、绝不是 PASS；另有多出文件、collection error、digest 不一致、总数不一致、不可枚举计划。`census-cutover.test.mjs` 的 report fixture 改为枚举计划人口（原先每 root 一个文件在新法下等于 704 个缺失） | 基线是“评审可见的缩小闸门”，不是“人口永远不缩”：确实要删测试时，同一 PR 改基线即可，diff 是可见的。计划 digest 覆盖人口意味着任何人口变更都需要重建计划（预期行为） |
| **F-03** `test-contracts.json` 的 `required_tiers` 从未与实际执行层比对；`required_oracles` 为空，规则 5 检查零个 | **两层修复。** (a) `scripts/contract-tiers.mjs` 只从既有权威推导执行层：L1 = 非 census 的 dispatch leg 用 `--run` 真正执行的 node:test 套件，以及 manifest 里 `contract-tiers --run --tier L1` leg 真正执行的契约文件；L2 = `census-plan.mjs deriveRoots()` 的 census 人口。对每个 contract：绑定文件的执行层并集必须包含 `required_tiers`；缺层 → `CONTRACT_TIER_UNMET`。(b) **让 L1 真的执行**：`contract-tiers --run --tier L1` 从 `dev/ci/test-contracts.json` 的 `test_refs` 解析出所有要求 L1 的契约文件（无新清单），用仓库自己的 `vitest.config.ts` spawn `pnpm exec vitest run …`，原样传播 vitest exit，打印 `DSH-CONTRACT-TIERS-RUN tier=L1 contracts=6 files=12 exit=0`；零文件 → `CONTRACT_TIER_RUN_NO_FILES`，文件缺失 → `CONTRACT_TIER_RUN_FILE_MISSING`。新 manifest leg `contracts-l1` 落在 **ci-product**（该 job 先 `pnpm install` + `pnpm run build` + `build:composition`），workflow 新增同名步骤；`deriveExecutedTiers` 读这个 leg 的 `--run --tier L1` 声明作为 L1 执行集，删步骤/去掉 `--run` 都会让契约回到 UNMET。`required_oracles` 今天无人声明，且 census plan 不记录 oracle 结果 → 不伪造覆盖；`CONTRACT_ORACLE_UNPLANNED`（今天真空绿，契约一声明就生效）。| `scripts/contract-tiers.test.mjs`：inspect-only leg 不授予 L1、L1 绑到 L2 文件 → UNMET、绑到真正 L1 文件 → met、manifest run leg 使 L1 进入 executed 集、`runTierContracts` 用注入 spawn 断言精确文件集与 raw exit、零文件/缺失文件拒绝、有效/过期/无 owner 例外、oracle gate、真实树 `--check` = `contracts=6 met=6 excepted=0 unmet=0 findings=0`；`--run --tier L1` 实测 `12 files / 162 tests / exit 0`，vitest 2.65 s、进程墙钟 3.6 s（本机 worktree 用 root 的 package `node_modules` 链接；CI 里由 `pnpm install` 提供） | **无残余例外**：6 个 contract 的 L1 现在都由真实执行覆盖，`dev/ci/contract-tier-exceptions.json` 为空。`contracts-l1` 的本地实测成本约 3.6 s（CI 未实测，标记 UNVERIFIED），对 ci-product 60 min 预算可忽略；若未来变大，报告数字后再决定 |
| **F-04** `census-execution.mjs` 无论 vitest 结果都写 `exit_code: 0`；`censusPlanLeg()` 从不要求进程退出码与 report 判决一致 | `resultsFromReport()` 接收真实 exit 并写进每条结果；`buildShardArtifacts()` 写真实 `exit_code/exit_signal`，不再有字面 0；`censusPlanLeg()` 在“进程非 0 且所有派生结果 PASS”时拒绝 `CENSUS_EXIT_NONZERO`（点名 code）；非 0 且 report 本身已红则继续走到 aggregator，由它同时 grade exit。`scripts/census-exit-policy.mjs` 是版本化 seam：`exitTolerances: []`，条目必须点名精确 code/signal + owner + reason + 未过期日期；shard 不能自声明容忍，aggregator 校验冻结策略的 digest 与条目 | `scripts/tinf-trust-closeout.test.mjs`：默认策略不容忍任何非 0；shard 携带真实 `exit_code=1` 且全 PASS → `INFRA_ERROR` + `SHARD_EXIT_NONZERO`；容忍条目必须精确/未过期/有 owner。`census-cutover.test.mjs` 的退出码负控仍绿 | 容忍 seam 今天为空，等价于“非 0 恒红”。真正的 flake 容忍需要一次显式策略变更（owner/期限），本 PR 不预置任何条目。多 capture 时 shard 只记第一个非 0（生产 shard 数=1；逐 capture 的真实 exit 仍在每条 result 上） |
| **F-05** 未收集套件是**计数**闸门（`--max-uncollected 91`）；修一个旧的 + 加一个新的，总数不变即通过 | `dev/ci/uncollected-baseline.json` 记录精确**路径集合**（path + reason + M1 classification），由 `node scripts/test-catalog.mjs --write-uncollected-baseline` 生成。每次调用（含 `--max-uncollected`）都跑集合差：基线外的新未收集 → `UNCOLLECTED_NEW`（阻塞、点名）；基线内已变收集 → `UNCOLLECTED_FIXED`（警告，要求同 PR 重生成基线）；基线内文件已不存在 → `UNCOLLECTED_BASELINE_STALE`（警告）；基线缺失 → `UNCOLLECTED_BASELINE_MISSING`。修复后从基线删除、日后再出现 → 仍是 NEW（基线不再记得它）。计数棘轮保留为更弱的第二界 | `scripts/tinf-trust-closeout.test.mjs`：新路径 RED；“修一个 + 加一个、总数不变”同时得到 NEW+FIXED；文件消失为 stale；删除基线后重现为 NEW；基线缺失 RED。真实树：`--max-uncollected 91` exit 0，`UNCOLLECTED=91`，`findings=0` | 计数棘轮仍在，`UNCOLLECTED_FIXED` 不阻塞（修好不该变红），但要求账本更新；如果只修不加而忘记重生成基线，会持续看到 warning 而不是红——这是有意的非阻塞设计。真正把 91 降到 0 仍是后续工作 |
| **F-06** effect witness 的真实性（无 PTY/进程/网络观测；`instrumented` 由调用方自报；没有真 host 的 E2 负控） | **未修。本 PR 不包含任何 F-06 改动**。原因：要证明“effect 真的发生/没发生”需要 pristine host + World Factory 接线（真实进程/PTY/网络观测），并需要一条真 host 的 E2 负控；当前 TINF 测试面没有这些设施，伪造一个 `instrumented` 标记只会把“调用方自报”包装成“证据”。正确做法是单独里程碑：真实 effect 探针 + 真 host 负控 + 允许失败的隔离环境 | **无**（没有实现就没有负控；不把 F-02 的文件集相等当成 effect 证据） | 整个 F-06：effect witness 现实性、PTY/process/network 观测、`instrumented` 的独立性、真 host E2 负控。需要 pristine host 与 World Factory 接线，超出本分支范围 |

## 证明与门禁（本分支实测）

- `node scripts/dispatch-tests.mjs --check` → `DSH-TEST-DISPATCH-CHECK mode=inspect PASS legs=18 bad=0`
- `node scripts/eb3-ci-required.mjs` → `EB3-CI-REQUIRED pass workflows=10 findings=0`
- `node scripts/test-catalog.mjs --max-uncollected 91` → `tests=867 … UNCOLLECTED 91 … refused=0 findings=0`，exit 0
- `node scripts/contract-tiers.mjs --check` → `DSH-CONTRACT-TIERS contracts=6 met=6 excepted=0 unmet=0 findings=0`
- `node scripts/contract-tiers.mjs --run --tier L1` → `DSH-CONTRACT-TIERS-RUN tier=L1 contracts=6 files=12 exit=0`；本机 vitest `12 passed / 162 tests`，`Duration 2.65 s`，进程墙钟 `3.6 s`（CI 里的实际步骤耗时标记 UNVERIFIED；该 leg 在 ci-product 的 build 之后运行）
- `node scripts/docs-sync.mjs --check` → `findings=0 blocking=0`；`node scripts/lint-identities.mjs` exit 0；eslint 改动/新增文件 0 problems；`node --check` 全部脚本通过
- 本分支四文件套件加入同一 `tinf-instruments` leg 后：`suites=10 files=10`，`293/293`，exit 0
- 七文件 CI 命令 + 四个新套件：`306/306`，exit 0

### 两个评审反例的 CLI 行为

1. **F-01**：`node scripts/dispatch-tests.mjs --run --json --leg tinf-instruments` → `REFUSED DISPATCH_MODE_CONFLICT: modes run + json are mutually exclusive …`，exit 2，**stdout 无计划、无 spawn**（由 `dispatch-tests.test.mjs` 断言子进程输出与“没有 `ℹ tests`”）。
2. **F-02**：计划 root A 期望 100 个文件、report 只收集 1 个且 `success: true` → 派生结果为 `INCOMPLETE` + `FILE_MISSING`；CLI 聚合输出 `DSH-CENSUS-SUMMARY INCOMPLETE …`，**绝不出现 `PASS` 令牌**（`tinf-trust-closeout.test.mjs` 的 “F-02 CLI” 用例断言退出码 1 且输出无 `DSH-CENSUS-SUMMARY PASS`）。

## 偏差与必须知道的事

1. **parity 25 → 29（有意）**。任务书要求“四个负控文件接进同一个 ci-integration manifest leg”，同时要求 `--parity` 得到 `IDENTICAL 25/25`。两者不可同时成立：任何新 suite 都会改变解析集合。本分支选择**满足负控接线**，并把证据文件 `dev/agent-workflow/evidence/tinf-m6-dispatch-parity/old-vs-new-argv.txt` 按 M6 memo 允许的流程重生成：对最后一个 pre-M6 workflow（`e5bf05670`）比较，**每行 `missing=none`、`problems=0`**，`added=` 恰为四个新文件，union `25→29`。`scripts/test-catalog.test.mjs` 现在同时钉住 digest 和允许的 added 集合，未来不能借这次重生成偷加文件。
2. **`--old-ref 7e3b6532a` 本身无法得到 25/25**：该 commit 是 M6 合并点，workflow 已经没有任何 `node --test` 旧 argv，parity 只能报 `DIFFERS … problems=18`（“UNCONVERTED … had no node --test argv on the old side”）。这不是本分支造成；正确的 old-ref 是 M5/M6 之前（本文件头一贯写的 `e5bf05670`）。
3. **契约例外已清零，但 L1 执行是“新增的验证成本”**：`contracts-l1` 每次 ci-product 都跑 12 个契约文件（本机 3.6 s，CI 未实测）。这不是免费：它把 L1 从“声明/例外”变成真实执行；如果未来测试变慢或需要 host，必须把该 leg 迁到有相应设施的位置，而不是把 `--run` 删掉。`dev/ci/contract-tier-exceptions.json` 当前为空，保留空文件是为了让“出现新缺口”时仍走同一套 owner/expiry 规则。
4. **F-06 未做**，也不以 F-02 的文件集相等冒充 effect 证据；如上表所述需要 pristine host + World Factory。
5. **L2 P50 ≤ 10 min 未达成**：本 PR 没有性能改动，不声称达成；M5/M6 的实测仍是 ~22 min 量级（job 墙钟），性能工作另列。
6. 计划 digest 覆盖人口后，任何真实人口变更都需要重建计划与（如缩小）更新基线；这是 F-02 的预期成本，不是回归。

## 回滚

每个 commit 独立可回滚：F-05 集合基线、F-02/F-04 census 人口与退出、F-03 契约层、CI 接线。回滚 F-02 时必须同时回滚 `dev/ci/census-population-baseline.json` 与 aggregator 的人口规则，否则计划/结果形状不匹配；回滚 F-05 必须同时删除 `dev/ci/uncollected-baseline.json`，否则 CLI 会把缺失基线当作 `UNCOLLECTED_BASELINE_MISSING`（这是有意的 fail-closed）。

## 2026-11-15 追加 — PR #775 对抗审查（同 class 更深一层）

评审确认上一轮的修复方向，但指出四个“名字/声明仍然冒充执行”的残余。本分支在同一分支追加修复，未开新 PR。

1. **F-02：文件枚举 ≠ 执行。** 报告可以枚举全部 705 个文件却对某个 root 产出 `assertionResults: []`，旧代码给出 `PASS`。现在 `rootsFromReport` 把“已收集但零断言”的文件标为 `no_assertions`，`resultsFromReport` 对该 root 返回 `INCOMPLETE` + `NO_ASSERTIONS`（点名文件）。边界写死：**vitest 报告无法区分“整文件被有意跳过”和“文件根本没跑”，所以拒绝而不是猜**。aggregator 对 `assertions: 0` 的 result 追加 `RESULT_NO_ASSERTIONS` 并降为 `INCOMPLETE`；summary 增加 `assertions_total=`，capture token 继续携带 `assertions=`。负控：空 `assertionResults`、`status: pending` 无断言、`status: passed` 无断言三种形状全部 INCOMPLETE；N 文件 N>0 断言正控 PASS。
2. **F-04 replay 不再伪造 exit 0。** `resultsFromReport` 的 LIVE 路径要求显式数字 `exitCode`，缺失即 `EXIT_CODE_UNRECORDED`；dry-run/replay 显式传 `exitCode: null, mode: 'replay'`。shard 无 exit 时 `status=REPLAY`、`exit_code=null`；aggregator 接受 `REPLAY`（不伪造 COMPLETED），但 `REPLAY` 携带数字 exit 会 `SHARD_REPLAY_WITH_EXIT`。dry-run 的 FAIL 仍从 recorded states 得出，不靠 exit。
3. **F-03 “executed” 只能是 cmd 本身。** 只从 **`cmd`** 中同时含 `--run` 与 `--tier <X>` 的 leg 授予层；`check[]` 里的同名 token 不再算数（负控：check-only leg → 无 L1，契约回到 `CONTRACT_TIER_UNMET`）。并交叉校验 eb3 的 step binding：用 `gradeLeg(job, leg)` 对该 layer 的 workflow step 求值，manifest-only claim / 被弱化的 step 不会授予层，记入 `contract_runs_rejected`。manifest 的 `contracts-l1` 已把 `--run --tier L1` 移入 `cmd`（`check: []`）。
4. **F-02 baseline 防洗白。** 重新生成必须给 `--accept-population-change <reason>`，否则 `POPULATION_BASELINE_REASON_MISSING`；baseline 记录 `generated_at` / `catalog_digest` / `accepted_reason` / `accepted_by`。census 侧当当前 catalog digest 与 baseline 记录不同即 `POPULATION_BASELINE_UNREVIEWED`（要求重新生成并给出新理由），所以“删配置 + 重生成”至少是两个可见、带署名的动作。负控：无 reason 拒绝；有 reason 通过且理由写入文件；digest 漂移拒绝。

**追加门禁（本机）**：11 套件 `317/317`；`eb3-ci-required` = `pass workflows=10 findings=0`；`dispatch-tests --check` = `PASS legs=18 bad=0`；`test-catalog --max-uncollected 91` = exit 0（869/91）；`contract-tiers --check` = `contracts=6 met=6 excepted=0 unmet=0 findings=0`；`contract-tiers --run --tier L1` = `tier=L1 contracts=6 files=12 exit=0`，vitest `12 passed / 162 tests`、Duration 2.50 s、进程墙钟 3.4 s（CI 未实测，UNVERIFIED）；`docs:sync --check` findings=0；`lint-identities` exit 0；eslint 0 problems。

**未验证**：CI 上该步骤的实际墙钟；REPLAY 的宽容是否应改为非 PASS（当前 dry-run 仍可 PASS，因为它重放的是 recorded 判决，不是新执行）；`NO_ASSERTIONS` 对“整文件 skip”的拒绝是刻意的 fail-closed，若未来要允许整文件 skip，需要报告里出现可区分的字段，而不是放宽这里。
