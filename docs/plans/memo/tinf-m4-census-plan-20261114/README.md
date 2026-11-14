# TINF M4 — Census 计划、分片聚合与不降级证明（**shadow**）

> Dated: 2026-11-14 · Status: **IMPLEMENTED (shadow, not wired)** · 设计正本：`docs/plans/memo/agent-testing-infrastructure-20261114/07-CENSUS-SHARDING-AND-AGGREGATOR.md`（§1 多重集不变量、§2 计划、§3 分片、§4 `census-summary/1`、§5 fail-closed 顺序 1–7、§6 shadow 迁移）与 `12-INVARIANTS-AND-NEGATIVE-CONTROLS.md`（TINF-12/13/14/19）
> 前置：M1（`scripts/test-catalog.mjs`，收集权威）与 M3（`scripts/tinf-timing.mjs`，`tinf-timing/1` 行；merged `b8496efc2`，PR #771）。本轮**新增四件工具、两个负控套件、一份真实数据摘录**，**不新增工作流、matrix、concurrency group 或 Required context**。
> **评审轮次**：第 1 轮独立评审（PR #772）**CHANGES REQUIRED**，1 个阻断（`build_digest` 哨兵字符串绕过）+ 5 个缺口；本轮逐条关闭（§9 有映射表），并**因此收紧了能力边界：真实计划现在会拒绝 PASS**，§2/§9 明写这是 shadow 工具的正确状态。

## 1. 一句话

M4 把「分片不能改变被验证的总体」从一句要求变成**两个可以拒绝的工具**：`scripts/census-plan.mjs` 从**当前收集权威**推导出计划（11 roots × 2 captures = 22 tasks，命令来自 runner 本身），`scripts/census-aggregate.mjs` 按 spec §5 顺序 1–6 判 shard 制品，**shard 退出码 0 不是判决**。两者都是 shadow：没有 gate 读它们，也没有任何「跑什么」因此改变。**真实 L2 数据同时给出一个反直觉结论：root 级分片在这份 census 上省不到墙钟**（见 §5）。

## 2. 保证什么 / 不能保证什么

| | 保证（有测试/数据） | 不能保证 |
| --- | --- | --- |
| 计划总体 | root 集合**派生**自根 `vitest.config.ts` 的 `include[]`（经 `test-catalog.mjs` 的匹配 + M3 的 `rootOf`），本树 = **11 roots / 705 files**，与上一次真实 census 打印的 `captured 705f/9213l` 及 11 个 `census-root` 名字一致 | 配置**读不出来**时只有拒绝，没有 fallback；但「配置说这些文件属于这个 root」本身不等于「这些测试会真正装载并运行」 |
| 任务枚举 | 每 (root, capture) 一个 task，`task_id` 稳定；命令由 `scripts/census-invocation.mjs` 产生，**同一个函数**被 `ci-pr-gate.mjs` 的 census leg 导入 | `multiset_union(S1..Sk) == C` **只和任务枚举一样强**：聚合器证明「制品覆盖了计划」，不证明「计划就是这个总体」 |
| 身份（**形状**） | 5 个字段都必须**是 digest**：`sha256:<64 hex>` 或裸 `<40 hex>`（`scripts/census-digest.mjs` 唯一定义，计划与聚合器共用）。`null`、`"null"`、`"undefined"`、`""`、`" "`、大写 hex、39/65 hex 一律命名拒绝（`DIGEST_INVALID` / `PLAN_IDENTITY_UNRECORDED` / `IDENTITY_BUILD_UNRECORDED` / `PLAN_DIGEST_UNRECORDED`），**计划侧与 shard 侧都查** | 形状正确不等于来源可信：一个 40-hex 只是「看起来像 digest」，本工具不重算 git 树、不重算 build |
| 身份（相等） | 5 个字段（merge_tree / host / plan / catalog / build）逐一严格比较，任一不等 → 命名拒绝；`build_digest: null` 也拒绝 | 身份是**记录**，不是重算：`merge_tree_sha` = 规划提交的 tree，`host_sha` = `tests/paths.mjs` 的 pin，`catalog_digest` = catalog 自己的 digest，`build_digest` 由操作者给（不给就拒绝 PASS）。没有任何东西重新合成 merge tree 或重算 build |
| 每条 result 的身份 | 每个 result 必须带 `root` 与 `capture`，且必须等于**计划里那条 task** 的 root/capture（`RESULT_ROOT_MISMATCH` / `RESULT_CAPTURE_MISMATCH`），并带非空 `evidence` 引用（`RESULT_EVIDENCE_MISSING`）——只有 task_id 时，capture-2 的 id 可以携带 capture-1 的数据而聚合为 PASS（评审实测） | `evidence` 只要求**是一个非空字符串**（transcript 路径 / artifact 名 / digest 均可）：聚合器不打开它、不校验它指向的文件存在、不判断内容是否支持该终态 |
| 被 exclude 掉的 root | 计划列出 `roots_dropped: [{root, files_excluded, allowed}]` 并**默认拒绝**（`ROOT_DROPPED_BY_EXCLUDE`，exit 2）；`--allow-dropped-root <root>` 才降级为「记录在案、非静默」的 drop，记录进入 `plan_digest` 且出现在聚合器 summary 与人类报告里 | 只能发现「文件还在、但被根配置 exclude[] 全部排除」的 root；一个**整体消失**的目录（文件被删）没有任何残留可比对，仍然不可见 |
| 聚合 | spec §5 规则 1–6 **按序**执行，每步有命名 code；单 capture 计划、占位 build、截断制品、重复 id 一律拒绝 | 不做语义判断：不重跑测试、不读 vitest 报告、不验证 shard 执行者是否诚实；它信任 shard 制品自报的 task 终态 |
| Oracle | 每个 required oracle 必须在**每个** task 上可判定且 PASS，缺/不可判定/FAIL 各自命名 | 计划里的 `required_oracles` 目前是**空表**（没人声明 census 的必需 oracle），所以 oracle 规则在真实计划上「检查 0 条」——这是披露，不是通过 |
| 权威 | summary 里是**结构化字段** `scope: {shadow, wired_to_ci_required, writes_required_context_artifact, branch_protection_authority, decides_what_ci_runs}`（有测试逐个断言），不只是散文 | 没有分支保护含义；`census_verdict=PASS` 只描述「这些制品覆盖了这份计划」 |
| 现状 | 收紧后**真实计划今天不可能 PASS**：`build_digest` 无来源（`null` → `IDENTITY_BUILD_UNRECORDED`），也还没有任何 shard 制品带 per-result `root/capture/evidence` | 这不是回归，是 shadow 工具的**正确状态**：它现在拒绝的，正是「没有 build 身份 / 没有证据引用」的绿灯 |

## 3. `census-plan.mjs`（`census-plan/1`）

- **root 集合不硬编码、不回退**。拒绝码：`ROOT_CONFIG_MISSING`、`ROOT_CONFIG_UNREADABLE`、`CATALOG_UNREADABLE`、`GIT_READ_FAILED`、`ROOT_UNRESOLVED`（匹配到的文件落到没有 root 的路径）、`ROOTS_NOT_DERIVED`（`include[]` 一个都没匹配）、`ROOT_DROPPED_BY_EXCLUDE`、`DROPPED_ROOT_UNKNOWN`。**没有**「九个 root」的常量，也没有任何录制计数。
- **一个 root 被 `exclude[]` 抹掉 = 拒绝，不是更小的计划**（评审缺口 4）。`deriveRoots` 统计「有 test-like 文件但被**根配置** `exclude[]` 全部排除」的 root，计划写进 `roots_dropped: [{root, files_excluded}]`；默认 `ROOT_DROPPED_BY_EXCLUDE`（exit 2）。`--allow-dropped-root <root>` 才允许，且该记录以 `allowed: true` 留在计划里、**进入 `plan_digest`**、并在聚合器 summary/人类报告里打印。命名一个没被 drop 的 root 是笔误不是许可 → `DROPPED_ROOT_UNKNOWN`。
- **每 root 一个不可拆组**：`capture-pair:<root>`（`kind=ordering-unproven`）。理由写在计划里：两次 capture 现在是**同一个进程里顺序执行**的，没有任何证据表明并发观察它们是无损的（spec §1 明确禁止假定）。**没有声称共享 World**——约束来自「缺证据」，不是虚构的资源。组只增加约束，从不减少任务。
- **`est_ms`**：优先取该 task **自己那次 attempt** 的 `census-root` 行，退化为该 root 的中位数（M3 的 nearest-rank 中位数）；没有测量 = `null`（不是 0）。它只用于负载均衡，**任何代码路径都不会因为估计值增删/重排任务**；`--balance` 在任一估计为 `null` 时**拒绝**（`ESTIMATES_UNKNOWN`），因为「按猜测排出来的表」正是 M3 要消灭的东西。
- **命令**：`censusVitestArgv()`（`scripts/census-invocation.mjs`）——`ci-pr-gate.mjs` 的 census leg 现在导入同一个函数，参数顺序与原来的内联字面量逐字一致（`exec vitest run [file] --reporter=default --reporter=json --outputFile.json=… [--testTimeout=…]`）。计划与 runner 不可能各说一套。
- **digest 就是 digest**（评审阻断项 1）：`merge_tree_sha` / `host_sha` / `catalog_digest` / `build_digest` 全部按**同一个形状**校验（`scripts/census-digest.mjs`：`sha256:<64 hex>` 或裸 `<40 hex>`，正是真实生产者能发出的两种形状——`test-catalog.mjs` 的 catalog digest 与 `planDigest()` 用前者，sha1 仓库的 `git rev-parse HEAD^{tree}` 与 `tests/paths.mjs` 的 host pin 用后者）。`--build-digest null` 现在**不会**再把字符串 `"null"` 写进计划，而是 `DIGEST_INVALID` exit 2 且不打印计划；`"undefined"`/`""`/`" "`/大写 hex/39/65 hex 同样拒绝。计划里仍可记录 `build_digest: null`（= 未记录，聚合器拒绝 PASS），但**永远不会记录一个只是看起来像值的字符串**。`--verify-plan` 也先做形状校验（`PLAN_IDENTITY_UNRECORDED` / `DIGEST_INVALID` / `PLAN_DIGEST_UNRECORDED`）。
- **`plan_digest`** = sha256 over canonical JSON of `{schema, identity(4 字段), captures, test_timeout_ms, roots, roots_dropped, groups, tasks}`。规范说的是「tasks + identity」，这里多带 root 列表 / capture 数 / 时钟：它们是**产生**任务集的东西，否则把 `captures` 从 2 改成 1 而任务不动，digest 不会变。
- **`--verify-plan FILE`**：先按文件自身字段重算 digest（改了任务没重算 → `PLAN_DIGEST_MISMATCH`），再从当前树重推：身份漂移 → `PLAN_IDENTITY_DRIFT`，任务集变化（双向）→ `PLAN_TASK_SET_CHANGED`，重复 id 即使 digest 重算过也拒绝（`PLAN_TASK_DUPLICATE`）。
- **`--balance K`**（额外便利入口，不是 spec 要求）：对 11 个不可拆单元做**穷举**最小 makespan（≤14 单元；更多则退化为 greedy LPT + 单点改进）。`matches_lower_bound` 与 `optimal_guarantee` 分开命名——穷举可以**证明**一个高于解析下界的最小值——用**提交的 per-attempt 估计**（不是已被取代的「只用 root 中位数」模型）算出来的是 **k=2：2,614,139 ms，下界 2,613,010 ms**（下界 = 5,226,020/2）；k=4 的四个 shard 是 **1,306,747 / 1,315,867 / 1,292,147 / 1,311,259 ms**。把「命中下界」和「已证明最优」混成一个 `optimal` 字段是错的（本 PR 内修过一次，现为 `matches_lower_bound` + `optimal_guarantee` 两个字段）。

## 4. `census-aggregate.mjs`（`census-summary/1`）

输入：一份计划 + 若干 `census-shard/1` 制品（每个 shard 自报 `policy_digest`、5 字段 identity、`status`、`exit_code`、`results[]`；每个 result 带 `root`、`capture`、`evidence`、终态与 oracles）。

| 规则（spec §5 顺序） | 行为 | 命名 code |
| --- | --- | --- |
| 1 policy + plan digest | **先验计划的身份形状**（5 字段都要是 digest；null/缺席 → 拒绝，字符串哨兵 → `DIGEST_INVALID`），再验 `roots_dropped` 结构（必须是 `{root, files_excluded>0, allowed:true}`），最后才是 digest 相等；shard 的 `policy_digest` 必须等于本模块的 `POLICY_DIGEST`；计划的 `plan_digest` 必须等于按计划自身字段重算的值；每个 shard 的 `identity.plan_digest` 必须等于计划的 | `POLICY_DIGEST_MISMATCH`、`PLAN_DIGEST_MISMATCH`、`PLAN_SCHEMA_UNKNOWN`、`PLAN_TASK_SET_EMPTY`、`PLAN_TASK_DUPLICATE`、`CAPTURES_INSUFFICIENT`、`PLAN_IDENTITY_UNRECORDED`、`IDENTITY_BUILD_UNRECORDED`、`PLAN_DIGEST_UNRECORDED`、`DIGEST_INVALID`、`PLAN_ROOTS_DROPPED_MALFORMED` |
| 2 结构 / id 唯一 / 可解析 / 每条 result 的身份 | 制品必须能 parse、schema 已知、shard id 与 task id 唯一（**跨 shard 也查**）、status 已知、task 终态已知；每条 result 的 `root`/`capture` 必须等于计划里那条 task（查表，不靠字符串切分自创语义）、`evidence` 必须是非空字符串 | `SHARD_UNPARSEABLE`、`SHARD_UNREADABLE`、`SHARD_SCHEMA_UNKNOWN`、`SHARD_ID_MISSING/DUPLICATE`、`SHARD_TASK_ID_DUPLICATE`、`SHARD_STATUS_UNKNOWN`、`TASK_ID_MISSING`、`TASK_STATE_UNKNOWN`、`RESULT_ROOT_MISMATCH`、`RESULT_CAPTURE_MISMATCH`、`RESULT_EVIDENCE_MISSING` |
| 3 身份一致 | 先逐 shard 验形状（非 null 的非法值 → `DIGEST_INVALID`，早于任何「相等」判定），再 5 字段逐一与计划严格相等；`build_digest=null` 拒绝 | `IDENTITY_MISMATCH_MERGE_TREE_SHA / _HOST_SHA / _CATALOG_DIGEST / _BUILD_DIGEST`、`IDENTITY_BUILD_UNRECORDED`、`DIGEST_INVALID` |
| 4 多重集 + 终态 | 期望集合 vs 观察集合；缺失、多余、无终态、空 shard、exit 与 status 互相矛盾都不绿 | `TASK_MISSING`、`TASK_EXTRA`、`TASK_NO_TERMINAL_RESULT`、`SHARD_EMPTY`、`SHARD_EXIT_DISAGREES`、`SHARD_EXIT_NONZERO`、`SHARD_STATUS_*`、`TASK_STATE_*` |
| 5 必需 oracle | 每个 task 的每个 required oracle 必须可判定且 PASS | `ORACLE_MISSING`、`ORACLE_UNDECIDABLE`、`ORACLE_FAILED` |
| 6 verdict | 全绿才 `PASS`；否则按 **FAIL > INFRA_ERROR > CANCELLED > INCOMPLETE** 命名 | `census_verdict` |

- 退出码：`PASS` → 0；非 PASS → 1；**拒绝**（结构性问题，什么都没判）→ 2。判定与拒绝分离：`refusals` 一律 exit 2，`census_verdict` 一律 exit 1。
- 输出 `census-summary/1` 含 `expected_task_ids`、`observed_task_ids`、每 shard 的 `artifact_digest`（**原始字节的 sha256**，不是重新序列化后的摘要，有测试）、`counts`、`oracles`、`roots_dropped`、结构化 `scope`（5 个布尔字段）、`codes`、`detail`、`census_verdict`。
- **拒绝时 `summary: null`**：拒绝什么都没判，因此不存在一份「expected=22 observed=0」的摘要被误读成测量结果（有测试逐个断言）。
- **`SHARD_EXIT_DISAGREES`**：`exit_code=0` 但 `status != COMPLETED`——exit 0 不是判决。这正是 spec §4「Aggregator 不能只看 shard exit 0」的反向那一半。

## 5. 真实数据：L2 census（22 tasks，1/2/4 分片负载）

数据来源：`gh run download 43638954936 -n census-runtime-transcripts-1195` → `art/census-transcripts/tinf-timing.tsv`（**25 data rows** = 1 leg + 2 `census-capture` + **22 `census-root`**，11 roots × 2 captures）。原始 224 KB artifact **不提交**；提交的摘录是 [`L2-20261114-MEASURED.txt`](L2-20261114-MEASURED.txt)（数字与命令行由工具本身生成，不是手抄）。

| 事实 | 值 |
| --- | --- |
| capture 1 / capture 2 | **550.8 s / 544.8 s**（census 墙钟 **1095.6 s**，gate 报 step `seconds=1095.9`，即 23m37s job 里的 77%） |
| 最重 root（每 capture 中位数） | `packages/runtime` **543.0 s**（545.3 / 543.0）、`packages/testkit` **539.2 s**（539.2 / 540.7） |
| 计划 | 22 tasks、11 roots、11 个 `capture-pair` 组、`captures=2`、`--test-timeout 90000` |
| 计划稳定性复核 | 在评审修复后的 tip tree 上重跑：**22 个 task 与其 `est_ms`、`catalog_digest` 全部相同**，只有 `merge_tree_sha`（→ tip tree）与由它派生的 `plan_digest` 变化——这正是「身份是记录的、不是重算的」的可观察形式 |
| 计划 identity | `merge_tree_sha=674da11a…`（评审修复后的 tip tree）、`host_sha=639ed01539…`、`catalog_digest=sha256:ab4bd881…`、`build_digest=null`、`plan_digest=sha256:37c5a4fd…`（`roots_dropped=[]` 现在也是 digest 的一部分） |

**分片负载——两个模型必须分开命名，否则数字不可复现**（评审缺口 5：旧的 1,889,990 / 1,889,836 只在已被取代的「只用 root 中位数」模型下成立）：

- **模型 A（工作）**：`load_ms` = 该 shard 内全部 task 的**实测 per-attempt 估计之和**。这是均衡器真正最小化的量。
- **模型 B（墙钟）**：`predicted_wall(shard) = Σ_c max(est(root,c))`，因为真实 census 是「每次 capture 一个 vitest 进程、root 在进程内并发」。**只在 K=1 被实测验证过**。

| K | 模型 A：work makespan / 下界 | 模型 B：预测墙钟 | 结论 |
| --- | --- | --- | --- |
| 1 | **5,226,020 ms**（下界同值） | **1,088,254 ms**（实测 census 墙钟 1,095,606 ms，模型误差 **+0.7%**） | 基准 |
| 2 | **2,614,139 ms**（下界 2,613,010；两 shard 2,614,139 / 2,611,881） | **1,088,254 ms** | **省 ~0 s** |
| 4 | **1,315,867 ms**（下界 1,306,505；四 shard 1,306,747 / 1,315,867 / 1,292,147 / 1,311,259） | **1,088,254 ms** | **省 ~0 s** |

（K=2/K=4 的 `matches_lower_bound=false` 但 `optimal_guarantee` 说「穷举证明最小」——离散单元权重下二者本来就不同，这正是那两个字段分开命名的原因。）

**这张表要说的结论（反直觉，但完全由实测数据决定）**：**root 级分片不能缩短这份 census**。墙钟 ≈ 两次 capture × 最重 root（~543 s），而两个最重的 root（runtime / testkit）**本来就是并发的**，分到不同 shard 之后每个 shard 仍要 2 × ~543 s。工作量的确被均匀切开（5,226,020 → 2,614,139 ms/shard），**但工作不是墙钟，而且工作量一点没减少**（同样 22 个 task）——这正是 §1 的「并行是执行布局变化，不是合同强度变化」的量化版本。此外分片**增加**固定成本：每个 shard 都要 host provision+build（M0 step 中位数 272 s）与 repo build（22 s），k=2 约 +294 s runner time、k=4 约 +882 s，换来 ~0 s 墙钟。要真的缩短，只能**在 root 内部按文件分片**（M4 不做）或**两次 capture 并发**（spec §1 禁止假定无损，所以计划把每对的两次 capture 锁成一个组）。M3 的 host 缓存键是唯一能改变这笔固定成本的东西，而它**未启用**。

## 6. 负控表（精确测试名）

`node --test scripts/census-plan.test.mjs scripts/census-aggregate.test.mjs` → **136 tests / 136 pass**（plan 45 + aggregate 91）。每条只断言 **code 或 verdict 或精确计数**，不靠消息文本；每条规则另有「删掉这条规则就红」的强断言（见下表的 rule 1–6 行）。

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
| **digest 哨兵（计划侧）** | `DIGEST_INVALID` + exit 2 + **stdout 无计划** | `cli: --build-digest sentinels are DIGEST_INVALID exit 2, and no plan is printed` |
| **digest 哨兵（计划侧，`"null"`…9 种）** | `DIGEST_INVALID`，且 `verdict === null`（什么都没判） | `plan build_digest "<sentinel>" refuses as DIGEST_INVALID (never a recorded "value")`（9 条） |
| **digest 哨兵（shard 侧，9 种）** | `DIGEST_INVALID` | `shard merge_tree_sha "<sentinel>" refuses as DIGEST_INVALID`（9 条） |
| **形状正控**：合法 40-hex / sha256:64 不被形状规则拦下 | 只有 `IDENTITY_MISMATCH_*`，**无** `DIGEST_INVALID` | `the accepted digest shapes are exactly sha256:<64 hex> and <40 hex>` |
| **计划身份为 null（5 个字段各一条）** | `PLAN_IDENTITY_UNRECORDED` / `IDENTITY_BUILD_UNRECORDED` | `a plan whose <field> is null refuses as <CODE> even when every shard is null too`（4 条）+ `a plan with no plan_digest refuses as PLAN_DIGEST_UNRECORDED` |
| **计划身份字段缺席（4 个字段各一条）** | 同上 | `a plan whose <field> is ABSENT refuses as <CODE>`（4 条） |
| **capture-2 id 携带 capture-1 数据**（评审实测的绕过） | `RESULT_CAPTURE_MISMATCH`（exit 2） | `a capture-2 id carrying capture-1 data refuses (RESULT_CAPTURE_MISMATCH)` |
| **result 的 root 与计划 task 不符** | `RESULT_ROOT_MISMATCH` | `a result whose root disagrees with the plan task refuses (RESULT_ROOT_MISMATCH)` |
| **result 根本没有 root/capture 字段**（评审前的 shard 形状） | `RESULT_ROOT_MISMATCH` | `a result with no root/capture field at all refuses (the pre-review shard shape)` |
| **result 无 evidence**（缺/空/空白/非字符串） | `RESULT_EVIDENCE_MISSING` | `a result whose evidence is missing/empty/whitespace/non-string refuses (RESULT_EVIDENCE_MISSING)`（4 条） |
| **被 exclude 的 root 默认拒绝** | `ROOT_DROPPED_BY_EXCLUDE`（含文件名计数） | `deriveRoots: a root that exclude[] removes is REFUSED, not silently dropped` |
| **`--allow-dropped-root` 降级为记录** | 计划里 `roots_dropped[{allowed:true}]`，且进入 digest | `deriveRoots: --allow-dropped-root records the drop instead of hiding it` / `cli: --allow-dropped-root makes the drop explicit in the emitted plan` |
| **`--allow-dropped-root` 命名没被 drop 的 root** | `DROPPED_ROOT_UNKNOWN`（笔误不是许可） | `deriveRoots: --allow-dropped-root naming a root that was NOT dropped is refused` |
| **exclude 抹掉全部 root** | 仍是 `ROOTS_NOT_DERIVED`（空总体不因 opt-in 变成合法） | `deriveRoots: an exclude[] that empties the whole config is still ROOTS_NOT_DERIVED` |
| **drop 记录不可静默**：`allowed` 翻假改 digest / 聚合器拒绝畸形记录 | digest 变化；`PLAN_ROOTS_DROPPED_MALFORMED` | `editing a dropped-root record moves the digest` / `a dropped root that is not explicitly allowed/malformed refuses` |
| **drop 记录到达聚合器输出与人类报告** | `summary.roots_dropped` + `DROPPED ROOTS` 行 | `a dropped root recorded by the plan reaches the aggregator output (and the human report)` |
| **summary 结构上不是权威**（替代散文正则） | 5 个 `scope` 布尔逐个断言 | `the summary is STRUCTURALLY not an authority (fields, not prose)` |
| **规则 1 承重**：改计划 → 只此一码且 `summary === null` | `deepEqual(codes, ['PLAN_DIGEST_MISMATCH'])` | `rule 1 (plan digest): an edited plan refuses by code and grades NOTHING` |
| **规则 2 承重**：重复 id → 只此一码，不产出「missing=2」假测量 | `deepEqual(codes, ['SHARD_TASK_ID_DUPLICATE'])` | `rule 2 (uniqueness): one duplicate id refuses, and the delta is not reported as MISSING` |
| **规则 3 承重**：身份不符 → 只此一码 | `deepEqual(codes, ['IDENTITY_MISMATCH_HOST_SHA'])` | `rule 3 (identity): a mismatched host refuses and never reaches the multiset` |
| **规则 4 承重**：缺失+多余同时存在时的精确 delta | `expected=4 observed=4 missing=1 extra=1`、精确 id 列表 | `rule 4 (multiset): the EXACT expected/observed delta for missing and extra at once` |
| **规则 4 承重**：FAIL 同时出现在 `by_state` 与 verdict | `by_state.FAIL===1`、`PASS===3` | `rule 4 (terminal state): a FAIL is in by_state AND the verdict, not only a code` |
| **规则 5 承重**：oracle 失败计数与 verdict | `oracles.failed===2`、`checked===4` | `rule 5 (oracles): a failed oracle counts as failed AND is in the verdict` |
| **规则 6 承重**：优先级可观察 | INFRA_ERROR / CANCELLED / FAIL 三级 | `rule 6 (verdict): precedence FAIL > INFRA_ERROR > CANCELLED > INCOMPLETE is observable` |


## 7. Shadow 状态与 **spec §6 step-2 工作流延期**

- 本轮**没有**新增 workflow、matrix、concurrency group、Required context，也没有改 `dev/ci/eb3-ci-manifest.json` 的**形状**：只在 M1/M3 既有的那个 leg 的 `check[]` 里加了两个文件名，并把 leg 的**标签**（id/step name）补上 M4。
- **spec §6 step 2 要求的「独立非合并影子工作流」故意延期**，理由是可验证的：`scripts/eb3-ci-required.mjs` 会把 manifest 声明的每个 layer/job 与 workflow 文件中的实际 job 双向对齐（`CI_JOB_UNDECLARED` / `CI_REQUIRED_JOB_ABSENT`），并核对 `needs`/verdict 输出绑定；新增一个 workflow 文件会改变 `workflows=` 计数与 manifest 形状，这是**必须单独 review 的变更**，不是本 PR 顺手能做的事。替代方案（本 PR 实际做的）= spec §6 **step 3** 的离线对照：用**已记录的真实 L2 转录**推导同一棵树的 22-task 计划并计算 1/2/4 分片负载（§5），因此对照是**真实数据离线**，不是模拟。
- 同理：`census-aggregate.mjs` **不写**任何被 Required context 读取的制品（spec §5.7 的真实 seam 是 layer verdict token + `eb3-merge-tree.mjs --grade-needs`，不存在 aggregate artifact）。把它接成合并门会改 manifest 形状，必须另行受审。

## 8. 门禁（本 head 实测，逐个原文）

见 PR 描述与 `dev/agent-workflow/SESSION_ROUTER_LOG.md` 同日条目；摘要：

- `node --test scripts/census-plan.test.mjs scripts/census-aggregate.test.mjs` → **136 tests / 136 pass / 0 fail**
- `node scripts/census-plan.mjs --self-test` → `PASS cases=40 failed=0`；`node scripts/census-aggregate.mjs --self-test` → `PASS cases=33 failed=0`
- `node scripts/test-catalog.mjs --max-uncollected 91` → exit 0，`tests=864`、`UNCOLLECTED=91`、digest `sha256:ab4bd881…`
- `node --test scripts/test-catalog.test.mjs scripts/tinf-m0.test.mjs scripts/tinf-timing.test.mjs scripts/host-cache-key.test.mjs` → 78/78（与 M3 落地时相同）
- `node scripts/eb3-ci-required.mjs` → `pass workflows=10 findings=0`
- `node scripts/docs-sync.mjs --check` → `findings=0 blocking=0`
- `node scripts/lint-identities.mjs` → 162 identity lines / 76 distinct，exit 0
- `npx eslint` 七个文件 0 problems；`node --check` 六个新文件全过

## 9. 本轮评审映射 + 未做（明示）

| 评审条目 | 处置 | 证据 |
| --- | --- | --- |
| **1（阻断）`build_digest` 哨兵绕过** | `scripts/census-digest.mjs` 成为形状唯一定义（`sha256:<64 hex>` \| `<40 hex>`）；计划侧 `--build-digest` 先校验再记录，`makeIdentity` 再校验一次；聚合器对**每个**身份字段先验形状再比相等。`"null"`/`""`/`" "`/`"undefined"`/39-hex/65-hex/大写 hex 全部 `DIGEST_INVALID` | 新模块 + 9+9 条哨兵测试 + 形状正控 |
| **2 计划侧 null 也「相等」** | 计划身份 5 字段在 rule 1 **之前**校验；null/缺席 → `PLAN_IDENTITY_UNRECORDED` / `IDENTITY_BUILD_UNRECORDED` / `PLAN_DIGEST_UNRECORDED`；shard 侧同样先验形状 | 4+4+1 条测试 |
| **3 每条 result 没有身份** | 每条 result 必须有 `root`/`capture`（与计划 task 比对）与非空 `evidence`；三个命名 code | capture-1/2 交叉、错 root、无字段、4 种空 evidence |
| **4 掉一个 root 静默缩水** | `roots_dropped` + 默认 `ROOT_DROPPED_BY_EXCLUDE` + `--allow-dropped-root` 显式降级；记录进 `plan_digest` 与聚合器 summary/报告 | 5 条计划侧 + 2 条聚合侧 |
| **5 memo 旧算术** | 两个模型分开命名（A 工作 / B 墙钟），全部数字换成 per-attempt 模型：5,226,020 / 2,614,139（下界 2,613,010）/ 1,315,867（四 shard 四个值）/ 1,088,254 vs 1,095,606（+0.7%） | §5 表格 + 重建的 `L2-20261114-MEASURED.txt` |
| **6 测试强度 / 同义反复** | 散文正则 → 结构化 `scope` 5 布尔；round-trip → 逐 task 字段变异必须动 digest；self-verify → 用不同 root 输入顺序的重建计划验证；每条规则一条「只此一码 + 精确 delta」测试 | §6 表 rule 1–6 行 |

**未做**：

1. **没有跑过任何分片运行**。§5 的负载全部由**记录的真实中位数离线计算**；每 shard 的 runner-minutes、host boot 次数、缓存命中共 **0 次实测**。
2. **没有独立影子工作流**（§7 理由）；没有 matrix、`fail-fast`、`continue-on-error`、artifact 上传的改动。
3. **没有内部分片**：一个 root 内的测试文件仍整体在一个 task 里；`packages/runtime` 的 543 s 因此不可再分（这是 §5 结论的直接原因）。
4. **没有并行化两次 capture**：计划把它们锁成组，因为无损并发**未被证明**。
5. **`required_oracles` 为空**：真实计划不声明 census 的必需 oracle，所以规则 5 在真实数据上「检查 0 条」。声明它需要一份 census 级合同登记（M5 的领域），本轮不发明。
6. **身份不重算**：`build_digest` 没有真实来源（本机无 build 制品摘要链路），所以真实计划里是 `null`，而聚合器对 `null` **拒绝 PASS**。**评审后这一点更硬**：真实使用前必须同时有 (a) build 摘要生产者、(b) 带 `root`/`capture`/`evidence` 的 shard 产物。**今天一个真实计划 + 真实 shard 会拒绝，这是 shadow 工具的正确状态，不是缺陷。**
7. **`evidence` 只做「非空字符串」检查**：不打开文件、不校验路径存在、不校验内容是否支持终态——证据的可读性是 shard 生产者的责任，不是聚合器的。
8. **`roots_dropped` 只覆盖「文件仍在但被 exclude[] 排除」**：目录整体消失（文件被删除、git 不再跟踪）没有残留可比对，仍然不可见；那条路径要靠 catalog 的 `UNCOLLECTED_GREW` 棘轮与人工 review。
9. **`--balance` 是额外入口**，不在 spec 的 CLI 列表里；它不写文件、不被任何人消费。
10. `docs/ROUTER_RULES.md`/`TEST_METHODS.md`/Authority/Candidate/release **未改**；`packages/**` 零改动（CORE PATCH BUDGET = 0）。

## 10. 回滚

纯新增，无迁移状态：

1. 删除 `scripts/census-plan.mjs`、`scripts/census-aggregate.mjs`、`scripts/census-invocation.mjs` 与两个 `.test.mjs`；
2. `ci-integration.yml` 的 `node --test` 行去掉两个文件名、恢复注释与 step 标签；`dev/ci/eb3-ci-manifest.json` 的 `check[]` 去掉两个文件名、恢复 `why` 与 leg id；
3. `scripts/ci-pr-gate.mjs` 恢复内联 argv 并删除 `census-invocation` 导入（这一处是唯一**行为等价**的重构：argv 逐字相同，回滚不改变任何 transcript 或 verdict）；
4. 删除本 memo 目录与同日日志条目（日志只追加：回滚以**新条目**说明，不删旧行）。

回滚后 `eb3-ci-required` 仍应是 `pass workflows=10 findings=0`（没有 shape 变化，所以不需要配套改动）。
