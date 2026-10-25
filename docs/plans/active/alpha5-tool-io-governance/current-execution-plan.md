# Alpha.5 工具 IO 治理 — 当前执行计划（current-execution-plan）

> **Status banner (2026-10-26, FIX-D):** **Superseded as implementation plan by PR #364** (user ruling
> 2026-10-25: "PR #364 merged = the sole implementation plan" — `docs/plans/memo/unified-baseline-alpha5-20261025/execution-plan.md`).
> This file is **retained for backlog/matrix context** (its `ALPHA5-EFFECTIVE-BACKLOG.md` / `TOOL-CAPABILITY-MATRIX-9b2.md`
> stay the effective entry points); the machine pointer still resolves here until the switch blocked in
> `dev/agent-workflow/evidence/u6-fixd-20261026/BLOCKED-D1.md` is unblocked by ruling.

<!-- phase-baseline-ref: dev/engineering/current-authority.json — 基线唯一权威=该指针解析到的快照 baseline；本文件禁 SHA 副本 -->
<!-- phase-identity: alpha5-tool-io-governance -->

<!-- historical-carriers: dev/agent-workflow/evidence/alpha5/ALPHA5-CURRENT-STATE.md / ALPHA5-ACCEPTANCE-STATUS.md / dev/agent-workflow/PENDING-GATES.md / docs/plans/memo/alpha5-tool-io-governance/* = historical 正本（只追加不改写），本文件为其当前态唯一执行入口 -->

## 0. 阶段与红线状态

- **当前阶段**：Alpha.5 工具 IO 治理 — 实施 / 生产集成与验收（含本 docs-realignment 轮与逐工具矩阵复验轮）。
- **release 状态 = BLOCKED：全工具审批未达**（矩阵中 `BLOCKED-FOR-RELEASE` 行清零 + 全行复验达级之前，不得宣布 Alpha.5 完成或发布）。
- 统一事实基线：只引用 `dev/agent-workflow/graph.yaml#current_contract.baseline`，本文件与 backlog / 矩阵 / AGENTS.md 一律不复刻 SHA。

## 1. 与历史正本的引用关系（不做全局替换）

- `docs/plans/memo/alpha5-tool-io-governance/`（S0 选型矩阵 / ADR / 实施计划 / architecture / post-poc / tool-fork-debt）= **设计需求正本**。其中 `PROPOSED` / 选型提案**不是命令**；执行以本文件为准，设计与本文件冲突时按 AGENTS.md 权威序裁决并留痕。
- `evidence/alpha5/ALPHA5-CURRENT-STATE.md`、`ALPHA5-ACCEPTANCE-STATUS.md`、`dev/agent-workflow/PENDING-GATES.md` = **历史台账正本**（登记、红线、裁决原文仍有效）；其"当前态"字段按记录时点过期，当前待办唯一入口 = `ALPHA5-EFFECTIVE-BACKLOG.md`。
- 历史红线（PENDING-GATES 各行、D-1 延期语义、G-f census 纪律、G-g 双维度禁合并措辞等）**继续有效**，不因 banner 失效。

## 2. 本轮（docs realignment）执行范围

1. 三件当前态文档入 active/（本文件 + `ALPHA5-EFFECTIVE-BACKLOG.md` + `TOOL-CAPABILITY-MATRIX-9b2.md`）。
2. `graph.yaml` 单一 `current_contract` 块成为唯一当前指针；L64/L84/L114-L115 旧指针降级（详见分支 commit message）。
3. AGENTS.md 三处指入口；历史载体顶部 dated banner（一行，正文零改写）。
4. `scripts/ci-pr-gate.mjs` 的 `state-freshness` 腿扩检（Q1-Q8；实现=同文件 `checkCurrentContract`，fixtures=`packages/testkit/test/a5-current-contract.test.ts`（正控 P1-P3 + 负控 N1-N5，含 baseline==HEAD 合法正控与"缺 current_contract 必红"的 N5）；legacy s7 检原位保留、fixture 钉 legacy-only；生产路径缺 current_contract=FAIL，不回落）。
5. 逐工具能力矩阵实填（26 行预计，行集以实际治理面为准；含 R2 release-blocker 行）。

**范围外（本分支禁做）**：产品 src/dist 改动、新 Host 运行、全套测试、依赖安装、历史文件改写/删除、push。

## 3. 验收线

- 本分支验收 = 文档/CI 有限实现 + 定向自测（fixture 级 Q1-Q8 正负控，`node scripts/ci-pr-gate.mjs` 定向腿实跑 stdout/rc 入账）。**不承诺全 Alpha.5 完成。**
- **阶段完成判据 = 原 PR8 验收结构与用户全工具审批标准，继续有效**（S0/实施计划与 ACCEPTANCE-STATUS 裁决原文为正本，本轮不另裁、不替代）。矩阵"无 `BLOCKED-FOR-RELEASE` 行 + 各生产行达声明等级"是**必要非充分**条件：自声明等级与矩阵状态**不能代替**完整发布 gate（发布需用户全工具审批，逐 SHA 逐项）。

## 4. 本窗口目标与产品冻结

- **原目标（历史）= 10-24 前完成 Alpha5 交付**（用户此前的期望，非当前承诺，当前口径见下一条；**不是**本 docs 窗口的完成范围）。本 docs-realignment 轮=该目标的**前置**：冻结 diff（patch+manifest+对照表）+ 两审闭环 + `state-freshness` 扩展腿绿。本文件**不重定义** Alpha5 交付的完成范围（判据见 §3）。
- **日期口径（2026-10-22 更新）**："10-24 前完成 Alpha.5" = **历史期望来源**（用户此前目标），不再是当前承诺。当前安排 = **按 PR #355 后续**组织——PR #355 事实口径：**draft/open、未合并**（head=`8f84a7845944964ef17e167aebfde8e2d9617570`、base=9b2、仅计划 1 文件；不得称已入主分支）；其 §7 **建议** 10/23=M0、10/24=M1 控制点（建议值，非承诺）；M2/M3 预算 = 按工具能力矩阵估完整工期后**交用户确认**。本文件不写"10-24 全完成"类当前承诺，亦**不称"新最终日期已批"**。
- **M0 前置依赖顺序（锁定）**：**先**将工具能力矩阵提交为独立可引用的冻结 commit/version（基线仍 9b2，引用=精确矩阵 commit，矩阵验证级别不因此改动）→ **该确定矩阵作 M0 输入冻结契约** → 之后才按 #355 设计原则组织后续。矩阵未冻结前，不启动 M0/M1 或任何新架构。
- **产品冻结**：docs 完成后**待根解冻**；graph `ready` 列出的 backlog ID **不构成产品侧开工授权**（复验轮/复跑轮均需根显式指令）。
