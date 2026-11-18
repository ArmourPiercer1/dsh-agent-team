# 06 — 需要主 Agent 执行的精确补丁（worker 不改 active plan / AGENTS.md）

**[updated 2026-11-16 UTE-Prep]** 本文件**不修改**任何受保护文件；只给出可逐字应用的补丁文本。按 `AGENTS.md` 目录约定，`docs/plans/active/**` 是"用户/主 Agent 产物，禁 worker 改动"，`AGENTS.md` 是权威文档，两者都只能由主 Agent（+ owner）执行。本文的两份补丁**都不是 G0/G1 的前置**——未应用时 [01](./01-BASELINE-REFRESH.md)–[05](./05-SCOPE-FENCE.md) 仍然成立；应用它们是让**别处的 agent 不会把围栏挪走**。

## 补丁 A — `docs/plans/active/alpha5-sandbox-first/ALPHA5-SANDBOX-BACKLOG.md`（新增 §0.4）

**为什么需要**：本 memo 的 [05](./05-SCOPE-FENCE.md) §1 裁定"B5–B9 归档不是 G1 前置"。但**backlog 里没有这句话**，而 backlog 是"有效待办唯一入口"。下一个 agent 读 backlog 时会看到 `B5 = G2–G5 未达成`，与本 memo 的 `B5 = 3 个未收编套件` **同名不同义**——这不是措辞问题，是两个编号体系撞车：

- backlog §0.3.2 的 `B1–B7` = **发布门具名阻塞**（B5 = "G2–G5 未达成"）。
- 收集批次的 `B1–B9`（`docs/plans/memo/b3-collect-20261116/README.md`，`SESSION_ROUTER_LOG:9000`）= **未收编套件批次**（B5 = 3 个套件）。

**插入位置**：在 `### 0.3.3 BL-17 / BL-18 的真实状态（一句话各一条）` 的两条 bullet **之后**、下一个 `## 1. Face: FS Provider` **之前**。

```diff
@@ after the BL-17 / BL-18 bullets, before "## 1. Face: FS Provider"
+
+## 0.4 下一宿主（DSH 0.2.2-rc.5 / UTE）工作不在本阶段待办内（2026-11-16，只追加）
+
+> 本阶段（Alpha.5 Sandbox-First）的待办仍是 §1–§7 的 BL/BR 条目；下一版本统一工具执行
+> （UTE，`docs/plans/memo/unified-tool-execution-dsh-022-20261114/`）及其 rc.5 宿主切换
+> **不是本阶段的待办，也不是本阶段任何条目的前置**。设计与围栏见
+> `docs/plans/memo/ute-prep-20261116/`。
+
+1. **不阻塞**：B1–B9 的**收集批次**（48 个未收编套件；B5 3 / B6 3 / B7 3 / B8 3 / B9 13）、
+   hosted census 调优（761 s 基线）、host 构建缓存身份修复、L3 evals——都不阻塞 rc.5 的
+   G0/G1 纵切。门禁只要求未收编数**不增长**（`test-catalog --max-uncollected 48`）。
+2. **前置只有三条**：新宿主可复现运行；M7-B1 最小可信 FS 窗口；旧路径可运行回归基线。
+3. **编号消歧（2026-11-16）**：§0.3.2 的 `B1–B7` 是**发布门具名阻塞**；收集批次的
+   `B1–B9` 是**未收编套件批次**。两者同名不同义。今后引用收集批次一律加前缀
+   `COL-`（`COL-B5`…），引用发布门阻塞保持 `B1–B7`；本行之前的既有文字不改写。
+4. **退役禁令**：任何工具族都不得在新路径被证明等价、或语义变化已记录并获 owner 批准之前退役；
+   FS 的 PASS 不外推到 Bash/PTC/PTY。
```

**副作用声明**：纯追加（4 条 + 一个 `## 0.4` 标题），不改任何既有 BL/BR 编号或文字；不复制等级/V@B；不移动 Authority 指针。应用后需跑 `node scripts/docs-sync.mjs --check` 与 `git diff --check`。

**若主 Agent 不采纳**：本 memo 的 [05](./05-SCOPE-FENCE.md) 仍是权威围栏，但**必须**在 backlog 里留一条指向它的行，否则围栏只存在于一个 memo 里，下一个 agent 不会读到。

## 补丁 B — `AGENTS.md` 红线段落（最小基础设施 Fork 例外）

**为什么需要**：[03](./03-RULINGS-AUTHORITY-BINDING-SETTLEMENT.md) R3.1 的例外条文如果不进 `AGENTS.md`，它只是一段 memo 文字；而 `AGENTS.md` 现在是**类别禁令**（"不得 vendored 修改过的 upstream 副本"），任何 Fork 都直接撞红线。#765 §九 自己也写明"本 Draft 仅记录提议，不能自行覆盖现行规则"。

**插入位置**：`## 红线（全局禁止 block）` 列表**之后**、`## 等待纪律…` **之前**。

```diff
@@ after the red-line bullet list, before "## 等待纪律"
+
+### 最小基础设施 Fork 例外（2026-11-16 owner 裁决；`CORE PATCH BUDGET = 0` 的唯一例外）
+
+`CORE PATCH BUDGET = 0`、"不得修改 upstream 源码 / 不得 patch upstream 工作树 / 不得 vendored
+修改过的 upstream 副本"**全部继续有效**。允许的**唯一**动作是：把一个**基础设施插件**的受审
+文件复制进本仓库、按 Team 包管理、在 Team Scope 下与对应上游插件排他装配——且必须**同时**满足：
+
+1. **可复现的公开 API 缺口**：最小脚本在钉住的 host tag+commit 上稳定复现（≥2 次），且公开
+   seam 已逐条排除（`apply()` / `ctx.isolate()` / Service 代理 / `tools.register(definition,{when})` /
+   公开 `ToolExecutor` / `ToolExecutionPipeline` 扩展点 / `tools/pre-execute` / `tools/post-execute`）。
+   排除表须给出每条的命令与失败原文。
+2. **范围最小**：只复制一份基础设施插件的受审文件。**禁止**复制任何模型可见 `ToolDefinition`
+   业务体，**禁止**复制或修改 `@deepseek-ai/dsh-tools` 的 Registry/Core，**禁止**借 Fork 夹带
+   同名 Definition A/B 最后解析窗口的修复。
+3. **首次实例逐个批准**：每个 Fork 是一条具名 owner 裁决（包名、文件、diff 行数、缺口编号）；
+   不是预授权、不是类别授权、不是"反正要升级所以先 fork 一份"。第二个实例重新申请。
+4. **证据随请求提交**：pin 身份（tag+commit+文件 blob sha256）、最小复现器（命令+输出 ×2）、
+   公开 seam 排除表、范围声明（文件清单 + `git diff --stat` + "未复制业务体"声明）、
+   来源与许可、验证计划（原生等价/OS 正负效果/错误与 teardown/非 Team 无回归/包可独立安装）、
+   升级 Owner 与退役条件。证据只用 `.md` / `.txt` / `.tsv`。
+5. **可退役**：登记"上游哪个公开接口出现即删除本 Fork"；上游提供等价接口后优先退役。
+
+不满足任一条 ⇒ 该路径仍是 `CORE_SEAM_BLOCKER`，按 `docs/ROUTER_RULES.md` §5 固定格式阻塞上报，
+**不是待办**。**顺序不可颠倒**：先证明公开面不可达，再申请例外；先 fork 后补证据一律退回。
+设计上下文与逐条理由见 `docs/plans/memo/ute-prep-20261116/03-RULINGS-AUTHORITY-BINDING-SETTLEMENT.md`。
```

**副作用声明**：只增不改；`CORE PATCH BUDGET = 0` 的默认仍是阻塞，例外是**具名、最小、逐个批准**的。应用后需跑 `node scripts/lint-identities.mjs --diff …`（`new 0, resolved 0`）与 `git diff --check`；`AGENTS.md` 若被任何 gate 解析（docs-sync 的 authority 绑定），需跑 `node scripts/docs-sync.mjs --check`。

## 应用顺序与责任人

| 补丁 | 责任人 | 何时 | 阻塞谁 |
|---|---|---|---|
| A（backlog §0.4） | 主 Agent（`docs/plans/active/**` 禁 worker 写） | 任意时间；建议与本 memo 同轮 | 不阻塞 G0/G1；阻塞"围栏可被发现" |
| B（AGENTS.md 例外） | owner 裁决 + 主 Agent 落笔 | **仅在**真的要提 Fork 请求时；不提前落 | 不阻塞 G0/G1；阻塞任何 Fork 申请 |

两个补丁都**不**在本 PR 内执行。本 PR 的边界是"提出、可逐字应用、可被拒绝"。

---

**文档导航**：[本目录索引](./README.md) · [01 基线刷新](./01-BASELINE-REFRESH.md) · [02 接口差量](./02-INTERFACE-DELTA-RC3-RC5.md) · [03 三条裁决](./03-RULINGS-AUTHORITY-BINDING-SETTLEMENT.md) · [04 首批纵切](./04-FIRST-SLICES-G0-G1.md) · [05 范围围栏](./05-SCOPE-FENCE.md) · [06 待主 Agent 执行的补丁](./06-PROPOSED-ACTIVE-PLAN-PATCH.md)
