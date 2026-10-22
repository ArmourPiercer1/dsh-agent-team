# Alpha.5 工具 IO 治理 — 当前执行计划（current-execution-plan）

<!-- phase-baseline-ref: dev/agent-workflow/graph.yaml#current_contract — 基线唯一权威=该块 baseline；本文件禁 SHA 副本 -->
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
4. `scripts/ci-pr-gate.mjs` 的 `state-freshness` 腿扩检（Q1-Q8，定义见矩阵头部与 PLAN-v3 §B；legacy s7 检原位保留、fixture 钉 legacy-only；生产路径缺 current_contract=FAIL，不回落）。
5. 逐工具能力矩阵实填（26 行预计，行集以实际治理面为准；含 R2 release-blocker 行）。

**范围外（本分支禁做）**：产品 src/dist 改动、新 Host 运行、全套测试、依赖安装、历史文件改写/删除、push。

## 3. 验收线

- 本分支验收 = 文档/CI 有限实现 + 定向自测（fixture 级 Q1-Q8 正负控，`node scripts/ci-pr-gate.mjs` 定向腿实跑 stdout/rc 入账）。**不承诺全 Alpha.5 完成。**
- 阶段完成判据另行裁决；当前唯一 gate 事实 = 矩阵无 `BLOCKED-FOR-RELEASE` 行且各生产行达声明等级（人工/矩阵轮复验触发，非 CI 自动过期）。
