# 03 — 三条边界裁决：Authority / Binding / Settlement 冻结文本

**[updated 2026-11-16 UTE-Prep]** #765 把这三件事写成了意图（"新 Host 基线必须独立…"、"是否提升为硬门 ⏳"、"本 Draft 仅记录提议"）。本文把它们冻结成**可引用、可否证、可被机器门检查**的条文。三条都不改变 UTE 的架构主张，只决定什么算达标。

记号：`MUST` = 违反即阻塞；`MUST NOT` = 违反即回滚。每条后面给出**可证伪现象**（怎么发现有人没照做）和**当前状态**（已达成 / 待 G0/G1）。

---

## 裁决 1 — 宿主基线：一个固定 tag+commit，第二棵并存树

**R1.1（MUST）** 每个宿主代际以 `dsh-v<version>` 固定 release tag + 其 peeled 40-hex commit 钉死，登记在 `tests/paths.mjs`（唯一来源）。禁浮动分支、禁 `latest`、禁 range、禁"实施时再确认"。本次钉：`dsh-v0.2.2-rc.5` = `9c2670d3bce5275e0d1610272958121af87787bb`。
**R1.2（MUST）** 新代际是**第二棵** pinned 树，与 legacy `0.2.0-rc.2@639ed015…` 并存：独立 checkout 路径、独立 `DSH_HOME` 根、**按代际分区的端口族**（legacy host 3181–3199 / mock 3491–3500；rc.5 host 13000–13049 / mock 13050–13099，分区写进 `tests/paths.mjs`）、独立 world 命名、**零共享可变世界状态**（不共享 home 目录 / mock 端口 / 工作区 / 运行中的 host 进程）。注意当前 `HOST_PORT_BANDS` 会让 legacy 溢出到 13000–13049——共存期间必须把它限制在 3181–3199，这是一次显式裁决 + G0-S1 改动，**不是**常量微调。禁止原地 `checkout` 换 tag。
**R1.3（MUST NOT）** 新 pin 的引入不得修改或删除 legacy 的 `(VERSION, SHA)` 对；替换代际 pin 属于退役动作，走 [05](./05-SCOPE-FENCE.md) §3。
**R1.4（MUST）** 宿主 pin 与资产 pin 是**两个 pin**。rc.5 今天没有匹配的发布资产包（npm 上 `@deepseek-ai/node-addon-system-linux-x64` 只有 `0.1.2`），因此宿主升级**必须先显式重建或显式记录资产 pin 的分歧**，其安全链才允许跑；机器规则 = `PACKAGE_PIN_DIVERGES_FROM_HOST_PIN`（`tests/world-factory/lib/host-sandbox-assets.mjs`），不得发明第二套机制、不得改 sha 去凑 runner 构建。

**可证伪现象**：两个 world 的 `port` 落在同一 band；两个代际的 `DSH_HOME` 解析到同一 realpath；某棵树的 HEAD 不是登记的 SHA；某份证据的 `RUN-SUMMARY` 没有 host tag+commit；`entries` 与 `packages` 的文件表不深相等却仍跑安全链。
**当前状态**：R1.1–R1.3 的**规则**在本 memo 成立；**实现**在 G0-S1（[04](./04-FIRST-SLICES-G0-G1.md)）。R1.4 的机制已存在于 master（hosted 证据 `M7A-STEP verdict=VERIFIED arms=5`，run `43804251634-1`），rc.5 的"分歧记录"待 G0-S2。

**为什么"独立 DSH_HOME + 独立端口"不够**:光隔离目录不隔离**证据归属**。legacy 的 home 里有 launch token、session log、profile bundle；跨代复用一个 home 目录，等于用未验证的 schema 假设去解释另一代的日志。所以规则写的是"一个 World 只归属一个代际"，不是"两个 World 别撞目录"。

---

## 裁决 2 — 结算保证：S1 是硬保证，S2 是独立的更强门

#765 的 §七 §5 把保证分成"基本（必选）"与"强化（单独门禁）"，但没给出可判定的边界；[十](../unified-tool-execution-dsh-022-20261114/10-IMPLEMENTATION-GATES.md) §6 甚至把它留成"是否提升为硬门"的待裁决项。**现在裁定：两条都保留，但改名、分离、各自可证伪。**

### S1 — 硬保证（G1 的验收条件，不满足即 FAIL）

> **每一次进入执行阶段（`EXECUTION_DISPATCH_ENTERED`）的调用，最终必须落成一条可查询的执行事实：要么是 `EXECUTION_SETTLED`（终态），要么是 `EXECUTION_UNCONFIRMED`（显式 `unknown`）。二者缺一 = S1 违约。**

配套条文：
- **S1.1** 事实按 `ExecutionId` 幂等：同一次物理执行只允许一条规范事实；重复回调不产生第二条终态。
- **S1.2** `unknown` 是**合法终态**，不是失败态。崩溃、`SIGKILL`、终止未确认、证据不足 → `EXECUTION_UNCONFIRMED`，**不得**写 `succeeded`，也**不得**写"从未执行"。
- **S1.3** 事实的写入触发条件**不得**是"模型回合正常结束"。rc.5 的 refusal 路径会先 `yield usage` 再 `throw CONTENT_REFUSED`（[02](./02-INTERFACE-DELTA-RC3-RC5.md) §1），任何"回合收尾 flush"的实现都会在此丢事实。事实必须在执行阶段内独立落账。
- **S1.4** `unknown` **不得**被自动重试或 replay：恢复只补事实（`EXECUTION_RECOVERY_RECONCILED`），不重放已消费的副作用。
- **S1.5** 可查询性有明确含义：给定 `ExecutionId`，在冷启动后的 Journal 里能读到该条事实（含 `dispatch` / `bodyOutcome` / `effectEvidence` / host result 引用），不需要活着的进程内 WeakMap。

**可证伪现象**：已消费 Grant 的调用在 Journal 里**没有**任何记录；`isError:false` 被当作"无副作用"；崩溃后同一调用消失而不是 `unknown`；`ExecutionId` 出现两条终态。
**当前状态**：设计已成型（[七](../unified-tool-execution-dsh-022-20261114/07-SETTLEMENT-RECOVERY.md) §3 的事件表），实现与负控在 G1-S3。

### S2 — 独立的更强门（不是 G1 的前置，也不能被 S1 冒充）

> **S2：持久化在宿主把结果返回给模型之前完成。** 即 `ExecutionFact` 的 durable commit 早于模型可见的 `tool/result`。

- **S2.1** `tools/result` 是 **emit，非 await**；`tools/post-execute` 是可等待 waterfall 但异常可绕过。**因此不得把"异步 `tools/result` 监听器"当作 S2 的实现**，也不得在文档/证据里暗示它已提供该顺序。这是 #765 §七 §5 已识别的危险，rc.5 **没有**修复它（`packages/core/tools` 源码零改动）。
- **S2.2** S2 只能由"宿主返回路径上的可等待点"实现：public `ToolExecutor` / `ToolExecutionPipeline` 的等待型扩展点，或在其旁边加**薄 Adapter**。
- **S2.3** 若在 rc.5 的**公开** API 上找不到这样的等待点，该 Gate 的正确产出是 **`CORE_SEAM_BLOCKER`**（固定格式，写明缺的是哪个等待点、试过哪些公开 seam、复现命令），**不是**现在就 fork。**先报阻塞，再谈例外**——顺序不可颠倒（见裁决 3）。
- **S2.4** S2 未达成**不阻塞** G1 的任何纵切；它阻塞的是"声称 commit-before-return"的发布声明。

**可证伪现象**：证据写"结果先落账再返回"但 cite 的是 `tools/result` handler；kill -9 落在 complete() 之后、返回之前，Journal 里没有 fact 却模型收到了结果；用自定义 Executor 重写 batch ordering 来"顺手"实现顺序（会破坏 UTE-01/02）。
**当前状态**：**未达成，且未验证是否可达**。这是设计上诚实的现状：S1 可做，S2 需要 G1 之后的一次专门探测。

### 两者关系（一句话）

S1 保证"**迟早**有一条可查事实或诚实的 `unknown`"；S2 保证"**模型看到结果时**事实已经在盘上"。S1 达标不能推出 S2 达标；S2 达标自动蕴含 S1。

---

## 裁决 3 — Fork 授权迁移：最小、具名、逐个批准、可退役

**现状（必须引用原文）**：`AGENTS.md` 红线写"不得修改 upstream 源码；…不得使用 patch-package / pnpm patch / postinstall 改写 upstream；不得 git apply Team patch 到 upstream/host 树；**不得 vendored 修改过的 upstream 副本**"，且 `CORE PATCH BUDGET = 0`、任何需要 upstream source patch 的路径是 `CORE_SEAM_BLOCKER` 而不是待办。这是**类别禁令**。#765 §九 只记录了"用户口头允许"，并明说"不能自行覆盖现行规则"。

### R3.1 — 例外条文（**建议插入 `AGENTS.md` 红线段落之后**，须 owner + 主 Agent 执行；本 PR 不改 `AGENTS.md`）

> **最小基础设施 Fork 例外（2026-11-16 owner 裁决；本条是 `CORE PATCH BUDGET = 0` 的唯一例外，不构成类别授权）**
>
> `CORE PATCH BUDGET = 0`、"禁止修改 upstream 源码 / 禁止 patch upstream 工作树 / 禁止 vendored 修改过的 upstream 副本"**全部继续有效**。允许的**唯一**动作是：把一个**基础设施插件**的受审文件复制进本仓库、按 Team 包管理、在 Team Scope 下与对应上游插件**排他装配**——且必须**同时**满足下列五条：
>
> 1. **缺口必须是可复现的公开 API 缺口**：同一缺口用一个最小脚本在**钉住的 host tag+commit** 上稳定复现（≥2 次），且**公开 seam 已被逐条排除**——至少覆盖 plugin `apply()`、`ctx.isolate()`、Service 代理、`tools.register(definition, {when})`、公开 `ToolExecutor` / `ToolExecutionPipeline` 扩展点、`tools/pre-execute` / `tools/post-execute` 钩子。排除表要给出每条的命令与失败原文；"我觉得做不到"不算排除。
> 2. **范围最小**：只复制**一份基础设施插件**的受审文件。**MUST NOT** 复制任何模型可见 `ToolDefinition` 业务体、**MUST NOT** 复制或修改 `@deepseek-ai/dsh-tools` 的 Registry/Core、**MUST NOT** 借 Fork 夹带 A/B 最后解析窗口的修复。
> 3. **首次实例逐个批准**：每个 Fork 是一条**具名** owner 裁决（写明包名、文件、diff 行数、缺口编号）。**不是**预授权，**不是**"同类以后都行"，**不是**"反正要升级所以先 fork 一份"。第二个实例必须重新申请。
> 4. **证据随请求提交**（缺一即退回，见 R3.2）。
> 5. **可退役**：登记升级 Owner 与**退役条件**（"上游哪个公开接口出现即删除本 Fork"）。上游提供等价接口后**优先退役**，不允许长期双轨。
>
> 不满足任一条 ⇒ 该路径仍是 **`CORE_SEAM_BLOCKER`**，按 §5 固定格式阻塞上报，**不是**待办、**不是**"先 fork 后补证据"。

### R3.2 — 随请求必须提交的证据包（七项，缺一退回）

| # | 证据 | 形态 |
|---|---|---|
| E1 | **pin 身份**：host tag + 40-hex commit；拟 Fork 文件在该 commit 的 blob sha256 | 文本，一行 |
| E2 | **最小复现器**：一个命令 + 完整输出，在 pin 上跑 ≥2 次，稳定给出同一失败 | `.txt`/`.md`，命令与输出原文 |
| E3 | **公开 seam 排除表**：每条候选 seam × 试过的调用 × 失败原文/typed code；结论必须是"公开面无法表达该要求" | 表格，逐行 |
| E4 | **范围声明**：文件清单、diff 行数、`git diff --stat`；并显式声明"未复制 ToolDefinition 业务体 / 未改 Registry" | 文本 + stat |
| E5 | **来源与许可**：包名、精确版本、license 文本、原始文件摘要 | 文本 |
| E6 | **验证计划**：原生输出/PTY 等价、OS 正负效果、错误/abort/teardown、非 Team 无回归、包可独立安装 | 计划表（每条对应 Gate 与负控） |
| E7 | **升级 Owner 与退役条件**：谁跟上游、哪个上游接口出现即退役 | 两行 |

**证据格式纪律**：证据文件只用 `.md` / `.txt` / `.tsv`。`dev/agent-workflow/evidence/**` 下的 `.json` 会撞 6000-candidate 配额，不要用 JSON 当当次证据载体（既有纪律）。

### R3.3 — 顺序不可颠倒

`CORE_SEAM_BLOCKER` 优先于 Fork 请求：**先**证明公开面不可达（E2+E3），**再**申请例外。反过来（先 fork 再补证据）一律退回，且该 Fork 期间产生的证据不计入任何 Gate。

**可证伪现象**：仓库里出现未登记来源的 `packages/**` 副本；`package.json` 里出现指向本仓库 infra 包的别名但无裁决记录；某 Fork 无退役条件；某个"缺口"其实用 `ctx.isolate()` + Service 代理就能解决（E3 缺失的直接后果）。
**当前状态**：**规则冻结，授权未行使**。截至本 memo，UTE 没有申请任何 Fork，也不预置任何 Fork 位。

---

## 附：三条裁决的相互约束（防"用一条掩盖另一条"）

- R1 的"第二棵树"不能被当成 R3 的"反正要独立维护"的理由去 fork（R1 只谈宿主隔离）。
- S2 未达成**不得**由 R3 的 Fork 直接补——R3.3 要求先报 `CORE_SEAM_BLOCKER`，由 owner 决定是等待上游、还是批准最小 Fork。
- S1 的 `unknown` **不得**被当作"证据不足所以先上线"的通行证：`unknown` 是**诚实终态**，不是"跳过验收"。
- 三条都不改变 UTE 的架构主张；它们只决定**什么算达标**。

---

**文档导航**：[本目录索引](./README.md) · [01 基线刷新](./01-BASELINE-REFRESH.md) · [02 接口差量](./02-INTERFACE-DELTA-RC3-RC5.md) · [03 三条裁决](./03-RULINGS-AUTHORITY-BINDING-SETTLEMENT.md) · [04 首批纵切](./04-FIRST-SLICES-G0-G1.md) · [05 范围围栏](./05-SCOPE-FENCE.md) · [06 待主 Agent 执行的补丁](./06-PROPOSED-ACTIVE-PLAN-PATCH.md)
