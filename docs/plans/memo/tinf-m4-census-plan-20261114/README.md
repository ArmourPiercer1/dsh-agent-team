# TINF M4 — Census 计划、分片聚合与不降级证明（**shadow**）

> Dated: 2026-11-14 · Status: **IMPLEMENTED (shadow, not wired)** · 设计正本：`docs/plans/memo/agent-testing-infrastructure-20261114/07-CENSUS-SHARDING-AND-AGGREGATOR.md`（§1 多重集不变量、§2 计划、§3 分片、§4 `census-summary/1`、§5 fail-closed 顺序 1–7、§6 shadow 迁移）与 `12-INVARIANTS-AND-NEGATIVE-CONTROLS.md`（TINF-12/13/14/19）
> 前置：M1（`scripts/test-catalog.mjs`，收集权威）与 M3（`scripts/tinf-timing.mjs`，`tinf-timing/1` 行；merged `b8496efc2`，PR #771）。本轮**新增三件工具、两个负控套件、一份真实数据摘录**，**不新增工作流、matrix、concurrency group 或 Required context**。

## 1. 一句话

M4 把「分片不能改变被验证的总体」从一句要求变成**两个可以拒绝的工具**：`scripts/census-plan.mjs` 从**当前收集权威**推导出计划（11 roots × 2 captures = 22 tasks，命令来自 runner 本身），`scripts/census-aggregate.mjs` 按 spec §5 顺序 1–6 判 shard 制品，**shard 退出码 0 不是判决**。两者都是 shadow：没有 gate 读它们，也没有任何「跑什么」因此改变。**真实 L2 数据同时给出一个反直觉结论：root 级分片在这份 census 上省不到墙钟**（见 §5）。

## 2. 保证什么 / 不能保证什么

| | 保证（有测试/数据） | 不能保证 |
| --- | --- | --- |
| 计划总体 | root 集合**派生**自根 `vitest.config.ts` 的 `include[]`（经 `test-catalog.mjs` 的匹配 + M3 的 `rootOf`），本树 = **11 roots / 705 files**，与上一次真实 census 打印的 `captured 705f/9213l` 及 11 个 `census-root` 名字一致 | 配置**读不出来**时只有拒绝，没有 fallback；但「配置说这些文件属于这个 root」本身不等于「这些测试会真正装载并运行」 |
| 任务枚举 | 每 (root, capture) 一个 task，`task_id` 稳定；命令由 `scripts/census-invocation.mjs` 产生，**同一个函数**被 `ci-pr-gate.mjs` 的 census leg 导入 | `multiset_union(S1..Sk) == C` **只和任务枚举一样强**：聚合器证明「制品覆盖了计划」，不证明「计划就是这个总体」 |
| 身份 | 5 个字段（merge_tree / host / plan / catalog / build）逐一严格比较，任一不等 → 命名拒绝；`build_digest: null` 也拒绝 | 身份是**记录**，不是重算：`merge_tree_sha` = 规划提交的 tree，`host_sha` = `tests/paths.mjs` 的 pin，`catalog_digest` = catalog 自己的 digest，`build_digest` 由操作者给（不给就拒绝 PASS）。没有任何东西重新合成 merge tree 或重算 build |
| 聚合 | spec §5 规则 1–6 **按序**执行，每步有命名 code；单 capture 计划、占位 build、截断制品、重复 id 一律拒绝 | 不做语义判断：不重跑测试、不读 vitest 报告、不验证 shard 执行者是否诚实；它信任 shard 制品自报的 task 终态 |
| Oracle | 每个 required oracle 必须在**每个** task 上可判定且 PASS，缺/不可判定/FAIL 各自命名 | 计划里的 `required_oracles` 目前是**空表**（没人声明 census 的必需 oracle），所以 oracle 规则在真实计划上「检查 0 条」——这是披露，不是通过 |
| 权威 | 文件头明写、summary 里 `scope_note` 也明写：不是权威、不被任何 Required context 读取、不写任何 gate 读的制品 | 没有分支保护含义；`census_verdict=PASS` 只描述「这些制品覆盖了这份计划」 |

## 3. `census-plan.mjs`（`census-plan/1`）

- **root 集合不硬编码、不回退**。拒绝码：`ROOT_CONFIG_MISSING`、`ROOT_CONFIG_UNREADABLE`、`CATALOG_UNREADABLE`、`GIT_READ_FAILED`、`ROOT_UNRESOLVED`（匹配到的文件落到没有 root 的路径）、`ROOTS_NOT_DERIVED`（`include[]` 一个都没匹配）。**没有**「九个 root」的常量，也没有任何录制计数。
- **每 root 一个不可拆组**：`capture-pair:<root>`（`kind=ordering-unproven`）。理由写在计划里：两次 capture 现在是**同一个进程里顺序执行**的，没有任何证据表明并发观察它们是无损的（spec §1 明确禁止假定）。**没有声称共享 World**——约束来自「缺证据」，不是虚构的资源。组只增加约束，从不减少任务。
- **`est_ms`**：优先取该 task **自己那次 attempt** 的 `census-root` 行，退化为该 root 的中位数（M3 的 nearest-rank 中位数）；没有测量 = `null`（不是 0）。它只用于负载均衡，**任何代码路径都不会因为估计值增删/重排任务**；`--balance` 在任一估计为 `null` 时**拒绝**（`ESTIMATES_UNKNOWN`），因为「按猜测排出来的表」正是 M3 要消灭的东西。
- **命令**：`censusVitestArgv()`（`scripts/census-invocation.mjs`）——`ci-pr-gate.mjs` 的 census leg 现在导入同一个函数，参数顺序与原来的内联字面量逐字一致（`exec vitest run [file] --reporter=default --reporter=json --outputFile.json=… [--testTimeout=…]`）。计划与 runner 不可能各说一套。
- **`plan_digest`** = sha256 over canonical JSON of `{schema, identity(4 字段), captures, test_timeout_ms, roots, groups, tasks}`。规范说的是「tasks + identity」，这里多带 root 列表 / capture 数 / 时钟：它们是**产生**任务集的东西，否则把 `captures` 从 2 改成 1 而任务不动，digest 不会变。
- **`--verify-plan FILE`**：先按文件自身字段重算 digest（改了任务没重算 → `PLAN_DIGEST_MISMATCH`），再从当前树重推：身份漂移 → `PLAN_IDENTITY_DRIFT`，任务集变化（双向）→ `PLAN_TASK_SET_CHANGED`，重复 id 即使 digest 重算过也拒绝（`PLAN_TASK_DUPLICATE`）。
- **`--balance K`**（额外便利入口，不是 spec 要求）：对 11 个不可拆单元做**穷举**最小 makespan（≤14 单元；更多则退化为 greedy LPT + 单点改进）。`matches_lower_bound` 与 `optimal_guarantee` 分开命名——穷举可以**证明**一个高于解析下界的最小值（k=2 就是：1,889,990 ms vs 下界 1,889,836 ms），把两件事混成一个 `optimal` 字段是错的（本 PR 内修过一次）。

## 4. `census-aggregate.mjs`（`census-summary/1`）

输入：一份计划 + 若干 `census-shard/1` 制品（每个 shard 自报 `policy_digest`、5 字段 identity、`status`、`exit_code`、`results[]`，每个 result 带终态与 oracles）。

| 规则（spec §5 顺序） | 行为 | 命名 code |
| --- | --- | --- |
| 1 policy + plan digest | shard 的 `policy_digest` 必须等于本模块的 `POLICY_DIGEST`；计划的 `plan_digest` 必须等于按计划自身字段重算的值；每个 shard 的 `identity.plan_digest` 必须等于计划的 | `POLICY_DIGEST_MISMATCH`、`PLAN_DIGEST_MISMATCH`、`PLAN_SCHEMA_UNKNOWN`、`PLAN_TASK_SET_EMPTY`、`PLAN_TASK_DUPLICATE`、`CAPTURES_INSUFFICIENT` |
| 2 结构 / id 唯一 / 可解析 | 制品必须能 parse、schema 已知、shard id 与 task id 唯一（**跨 shard 也查**）、status 已知、task 终态已知 | `SHARD_UNPARSEABLE`、`SHARD_UNREADABLE`、`SHARD_SCHEMA_UNKNOWN`、`SHARD_ID_MISSING/DUPLICATE`、`SHARD_TASK_ID_DUPLICATE`、`SHARD_STATUS_UNKNOWN`、`TASK_ID_MISSING`、`TASK_STATE_UNKNOWN` |
| 3 身份一致 | 5 字段逐一与计划严格相等；`build_digest=null` 拒绝 | `IDENTITY_MISMATCH_MERGE_TREE_SHA / _HOST_SHA / _CATALOG_DIGEST / _BUILD_DIGEST`、`IDENTITY_BUILD_UNRECORDED` |
| 4 多重集 + 终态 | 期望集合 vs 观察集合；缺失、多余、无终态、空 shard、exit 与 status 互相矛盾都不绿 | `TASK_MISSING`、`TASK_EXTRA`、`TASK_NO_TERMINAL_RESULT`、`SHARD_EMPTY`、`SHARD_EXIT_DISAGREES`、`SHARD_EXIT_NONZERO`、`SHARD_STATUS_*`、`TASK_STATE_*` |
| 5 必需 oracle | 每个 task 的每个 required oracle 必须可判定且 PASS | `ORACLE_MISSING`、`ORACLE_UNDECIDABLE`、`ORACLE_FAILED` |
| 6 verdict | 全绿才 `PASS`；否则按 **FAIL > INFRA_ERROR > CANCELLED > INCOMPLETE** 命名 | `census_verdict` |

- 退出码：`PASS` → 0；非 PASS → 1；**拒绝**（结构性问题，什么都没判）→ 2。判定与拒绝分离：`refusals` 一律 exit 2，`census_verdict` 一律 exit 1。
- 输出 `census-summary/1` 含 `expected_task_ids`、`observed_task_ids`、每 shard 的 `artifact_digest`（**原始字节的 sha256**，不是重新序列化后的摘要，有测试）、`counts`、`oracles`、`codes`、`detail`、`census_verdict`、`scope_note`。
- **`SHARD_EXIT_DISAGREES`**：`exit_code=0` 但 `status != COMPLETED`——exit 0 不是判决。这正是 spec §4「Aggregator 不能只看 shard exit 0」的反向那一半。

## 5. 真实数据：L2 census（22 tasks，1/2/4 分片负载）

数据来源：`gh run download 43638954936 -n census-runtime-transcripts-1195` → `art/census-transcripts/tinf-timing.tsv`（**25 data rows** = 1 leg + 2 `census-capture` + **22 `census-root`**，11 roots × 2 captures）。原始 224 KB artifact **不提交**；提交的摘录是 [`L2-20261114-MEASURED.txt`](L2-20261114-MEASURED.txt)（数字与命令行由工具本身生成，不是手抄）。

| 事实 | 值 |
| --- | --- |
| capture 1 / capture 2 | **550.8 s / 544.8 s**（census 墙钟 **1095.6 s**，gate 报 step `seconds=1095.9`，即 23m37s job 里的 77%） |
| 最重 root（每 capture 中位数） | `packages/runtime` **543.0 s**（545.3 / 543.0）、`packages/testkit` **539.2 s**（539.2 / 540.7） |
| 计划 | 22 tasks、11 roots、11 个 `capture-pair` 组、`captures=2`、`--test-timeout 90000` |
| 计划 identity | `merge_tree_sha=d023b1bb…`（M4 code tip tree）、`host_sha=639ed01539…`、`catalog_digest=sha256:ab4bd881…`、`build_digest=null`、`plan_digest=sha256:2e8ba7e5…` |

**分片负载（穷举最小 makespan，按实测估计；`work` = 该 shard 全部 task 估计之和）**

| K | work makespan | 预测墙钟 | 结论 |
| --- | --- | --- | --- |
| 1 | 5226.0 s | **1088.3 s**（实测 1095.9 s，模型误差 +0.7%） | 基准 |
| 2 | 2614.1 s（两 shard 2614.1 / 2611.9） | **1088.3 s** | **省 ~0 s** |
| 4 | 1315.9 s | **1088.3 s** | **省 ~0 s** |

`predicted_wall(shard) = Σ_c max(est(root,c))`，因为真实 census 是「每次 capture 一个 vitest 进程、root 在进程内并发」。

**这张表要说的结论（反直觉，但完全由实测中位数决定）**：**root 级分片不能缩短这份 census**。墙钟 ≈ 两次 capture × 最重 root（~543 s），而两个最重的 root（runtime / testkit）**本来就是并发的**，分到不同 shard 之后每个 shard 仍要 2 × ~543 s。工作量的确被均匀切开（5226.0 → 2614.1 s/shard），**但工作不是墙钟，而且工作量一点没减少**（同样 22 个 task）——这正是 §1 的「并行是执行布局变化，不是合同强度变化」的量化版本。此外分片**增加**固定成本：每个 shard 都要 host provision+build（M0 step 中位数 272 s）与 repo build（22 s），k=2 约 +294 s runner time、k=4 约 +882 s，换来 ~0 s 墙钟。要真的缩短，只能**在 root 内部按文件分片**（M4 不做）或**两次 capture 并发**（spec §1 禁止假定无损，所以计划把每对的两次 capture 锁成一个组）。M3 的 host 缓存键是唯一能改变这笔固定成本的东西，而它**未启用**。

## 6. 负控表（精确测试名）

`node --test scripts/census-plan.test.mjs scripts/census-aggregate.test.mjs` → **83 tests / 83 pass**（plan 36 + aggregate 47）。每条只断言 **code 或 verdict**，不靠消息文本。

| 负控 | 断言 | 测试名 |
| --- | --- | --- |
| 完整一致集合 → PASS（**正控**） | `verdict === PASS` | `positive control: the complete, consistent shard set aggregates to PASS` |
| 丢一个 shard | `TASK_MISSING` + `INCOMPLETE` | `an omitted shard is INCOMPLETE / TASK_MISSING, never a smaller PASS` |
| 重复 shard id | `SHARD_ID_DUPLICATE`（exit 2） | `a duplicate shard id refuses` |
| 重复 task id（shard 内 / 跨 shard） | `SHARD_TASK_ID_DUPLICATE` | `a duplicate task id within a shard refuses` / `a duplicate task id ACROSS shards refuses (a lost task hides as a double report)` |
| 任务集多出（extra） | `TASK_EXTRA` | `a shard that reports a task outside the plan is TASK_EXTRA (INCOMPLETE)` |
| 任务集缺失（missing） | `TASK_MISSING` | 见上「丢一个 shard」 |
| 每个身份字段各自不符 | `IDENTITY_MISMATCH_MERGE_TREE_SHA` / `_HOST_SHA` / `_CATALOG_DIGEST` / `_BUILD_DIGEST` | `a mismatched <field> refuses as <CODE>`（4 条） |
| plan 身份不符 | `PLAN_DIGEST_MISMATCH` | `a shard that ran a different plan refuses as PLAN_DIGEST_MISMATCH` |
| build 身份未记录 | `IDENTITY_BUILD_UNRECORDED` | `an unrecorded build identity refuses: equality of two nulls is not an identity` |
| exit 0 但含 FAIL | `verdict === FAIL` + `TASK_STATE_FAIL` | `a shard that exited 0 while carrying a FAIL aggregates to FAIL` |
| exit 0 与 status 矛盾 | `SHARD_EXIT_DISAGREES` | `exit 0 with a non-COMPLETED status is itself a red (the shard's two signals disagree)` |
| INCOMPLETE / CANCELLED / INFRA_ERROR | 同名 verdict + `SHARD_STATUS_*` | `a shard status INCOMPLETE aggregates to INCOMPLETE` / `…CANCELLED…` / `…INFRA_ERROR…` |
| 终态 FAIL/INCOMPLETE/INFRA_ERROR/CANCELLED | `TASK_STATE_<X>`，永不 PASS | `a task terminal state <X> is never PASS`（4 条） |
| 截断 / 不可解析制品 | `SHARD_UNPARSEABLE` | `a truncated shard artifact refuses as SHARD_UNPARSEABLE` |
| 只有 capture 1 的计划 | `CAPTURES_INSUFFICIENT` | `a plan with only capture 1 refuses (the missing second capture control)` |
| 改 task 后**重算** digest | `PLAN_DIGEST_MISMATCH`（shard 记的是旧 digest） | `a plan whose digest was RECOMPUTED after editing a task still refuses (the shards name the old digest)` |
| 改 task 但**不重算** digest | `PLAN_DIGEST_MISMATCH` | `a plan edited without a new digest refuses (PLAN_DIGEST_MISMATCH)` |
| 无终态 task | `TASK_NO_TERMINAL_RESULT` | `a task with no terminal result is INCOMPLETE / TASK_NO_TERMINAL_RESULT` |
| 空 shard 自称 COMPLETED | `SHARD_EMPTY` | `a COMPLETED shard with zero results is SHARD_EMPTY, not a vacuous pass` |
| oracle 缺 / 不可判定 / FAIL | `ORACLE_MISSING` / `ORACLE_UNDECIDABLE` / `ORACLE_FAILED` | `a missing required oracle is not PASS` / `an undecidable required oracle is INCOMPLETE, not green` / `a failed required oracle is FAIL even when the task says PASS` |
| 计划侧：root 集合推导不出来 | `ROOT_CONFIG_MISSING` / `ROOT_CONFIG_UNREADABLE` / `ROOT_UNRESOLVED` / `ROOTS_NOT_DERIVED` / `CATALOG_UNREADABLE` | `deriveRoots: …`（5 条 + 包级配置不算总体的 1 条） |
| 计划侧：digest / 身份 / 任务集漂移 | `PLAN_DIGEST_MISMATCH` / `PLAN_IDENTITY_DRIFT` / `PLAN_TASK_SET_CHANGED` / `PLAN_TASK_DUPLICATE` | `verifyPlan: …`（4 条） |
| 计划侧：估计未知仍要均衡 | `ESTIMATES_UNKNOWN` | `balance: unknown estimates refuse instead of guessing` |
| 制品摘要是**字节**的 sha256 | 与 `sha256(file bytes)` 相等 | `artifact_digest is the sha256 of the shard file bytes, not of a reserialisation` |
| CLI 退出码 0/1/2 | 三个分支各一条 | `cli: PASS exits 0 …` / `cli: a non-PASS verdict exits 1 …` / `cli: a truncated shard exits 2 …` |

## 7. Shadow 状态与 **spec §6 step-2 工作流延期**

- 本轮**没有**新增 workflow、matrix、concurrency group、Required context，也没有改 `dev/ci/eb3-ci-manifest.json` 的**形状**：只在 M1/M3 既有的那个 leg 的 `check[]` 里加了两个文件名，并把 leg 的**标签**（id/step name）补上 M4。
- **spec §6 step 2 要求的「独立非合并影子工作流」故意延期**，理由是可验证的：`scripts/eb3-ci-required.mjs` 会把 manifest 声明的每个 layer/job 与 workflow 文件中的实际 job 双向对齐（`CI_JOB_UNDECLARED` / `CI_REQUIRED_JOB_ABSENT`），并核对 `needs`/verdict 输出绑定；新增一个 workflow 文件会改变 `workflows=` 计数与 manifest 形状，这是**必须单独 review 的变更**，不是本 PR 顺手能做的事。替代方案（本 PR 实际做的）= spec §6 **step 3** 的离线对照：用**已记录的真实 L2 转录**推导同一棵树的 22-task 计划并计算 1/2/4 分片负载（§5），因此对照是**真实数据离线**，不是模拟。
- 同理：`census-aggregate.mjs` **不写**任何被 Required context 读取的制品（spec §5.7 的真实 seam 是 layer verdict token + `eb3-merge-tree.mjs --grade-needs`，不存在 aggregate artifact）。把它接成合并门会改 manifest 形状，必须另行受审。

## 8. 门禁（本 head 实测，逐个原文）

见 PR 描述与 `dev/agent-workflow/SESSION_ROUTER_LOG.md` 同日条目；摘要：

- `node --test scripts/census-plan.test.mjs scripts/census-aggregate.test.mjs` → **83 tests / 83 pass / 0 fail**
- `node scripts/census-plan.mjs --self-test` → `PASS cases=31 failed=0`；`node scripts/census-aggregate.mjs --self-test` → `PASS cases=24 failed=0`
- `node scripts/test-catalog.mjs --max-uncollected 91` → exit 0，`tests=864`、`UNCOLLECTED=91`、digest `sha256:ab4bd881…`
- `node --test scripts/test-catalog.test.mjs scripts/tinf-m0.test.mjs scripts/tinf-timing.test.mjs scripts/host-cache-key.test.mjs` → 78/78（与 M3 落地时相同）
- `node scripts/eb3-ci-required.mjs` → `pass workflows=10 findings=0`
- `node scripts/docs-sync.mjs --check` → `findings=0 blocking=0`
- `node scripts/lint-identities.mjs` → 162 identity lines / 76 distinct，exit 0
- `npx eslint` 六个文件 0 problems；`node --check` 五个新文件全过

## 9. 未做（明示）

1. **没有跑过任何分片运行**。§5 的负载全部由**记录的真实中位数离线计算**；每 shard 的 runner-minutes、host boot 次数、缓存命中共 **0 次实测**。
2. **没有独立影子工作流**（§7 理由）；没有 matrix、`fail-fast`、`continue-on-error`、artifact 上传的改动。
3. **没有内部分片**：一个 root 内的测试文件仍整体在一个 task 里；`packages/runtime` 的 543 s 因此不可再分（这是 §5 结论的直接原因）。
4. **没有并行化两次 capture**：计划把它们锁成组，因为无损并发**未被证明**。
5. **`required_oracles` 为空**：真实计划不声明 census 的必需 oracle，所以规则 5 在真实数据上「检查 0 条」。声明它需要一份 census 级合同登记（M5 的领域），本轮不发明。
6. **身份不重算**：`build_digest` 没有真实来源（本机无 build 制品摘要链路），所以真实计划里是 `null`，而聚合器对 `null` **拒绝 PASS**——这条严格性意味着真实使用前必须先有 build 摘要来源。
7. **`--balance` 是额外入口**，不在 spec 的 CLI 列表里；它不写文件、不被任何人消费。
8. `docs/ROUTER_RULES.md`/`TEST_METHODS.md`/Authority/Candidate/release **未改**；`packages/**` 零改动（CORE PATCH BUDGET = 0）。

## 10. 回滚

纯新增，无迁移状态：

1. 删除 `scripts/census-plan.mjs`、`scripts/census-aggregate.mjs`、`scripts/census-invocation.mjs` 与两个 `.test.mjs`；
2. `ci-integration.yml` 的 `node --test` 行去掉两个文件名、恢复注释与 step 标签；`dev/ci/eb3-ci-manifest.json` 的 `check[]` 去掉两个文件名、恢复 `why` 与 leg id；
3. `scripts/ci-pr-gate.mjs` 恢复内联 argv 并删除 `census-invocation` 导入（这一处是唯一**行为等价**的重构：argv 逐字相同，回滚不改变任何 transcript 或 verdict）；
4. 删除本 memo 目录与同日日志条目（日志只追加：回滚以**新条目**说明，不删旧行）。

回滚后 `eb3-ci-required` 仍应是 `pass workflows=10 findings=0`（没有 shape 变化，所以不需要配套改动）。
