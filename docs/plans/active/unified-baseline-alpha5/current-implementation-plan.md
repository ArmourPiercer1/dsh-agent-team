# Alpha.5 当前实施计划入口（carrier）

<!-- phase-baseline-ref: dev/engineering/current-authority.json — 基线唯一权威=该指针解析到的快照 baseline；本文件禁 SHA 副本 -->
<!-- phase-identity: alpha5-tool-io-governance -->

- **当前阶段**：Alpha.5 工具 IO 治理 — PR #364 统一计划执行中（U0–U3 完成；U4 G1-F / U5 G3 投机通过；**U6 中心重构按切片全部并入，K1–K5 内核安全修复已落地并通过评审（FIX-K #371 MERGED；enforcement flip 仍以 [`u6/conditions.md`](../../memo/unified-baseline-alpha5-20261025/u6/conditions.md) 十条件为门，flip 本身是独立受门事件**）。当前执行重心 = **U7 逐工具验收**：U7-R1/R2 加固与修复波次已合并（轮次事实见 `dev/agent-workflow/SESSION_ROUTER_LOG.md` 2026-10-29/30 条目），U7-R3 缺口矩阵与逐格验收进行中（[`gates/U7-R3-GAP-MATRIX-20261029.md`](../../../../dev/agent-workflow/gates/U7-R3-GAP-MATRIX-20261029.md) + 用户裁决 [`USER-RULING-20261029.md`](../../memo/unified-baseline-alpha5-20261025/gates/USER-RULING-20261029.md) / [`USER-RULING-20261029B.md`](../../memo/unified-baseline-alpha5-20261025/gates/USER-RULING-20261029B.md)；逐格状态唯一账本 = [`dev/agent-workflow/ledgers/u7-tool-acceptance.json`](../../../../dev/agent-workflow/ledgers/u7-tool-acceptance.json)）。本行只指权威、不复制进度细节（2026-10-30 对齐轮，R123 先例；外部审计 #3 P2 项）。
- **唯一实施计划正本** = [`docs/plans/memo/unified-baseline-alpha5-20261025/execution-plan.md`](../../memo/unified-baseline-alpha5-20261025/execution-plan.md)（PR #364；用户 2026-10-25 裁决："PR #364 合并 = 唯一实现计划正本"）。本文件只是机器 `active_plan` 的载体（`docs/plans/active/` 前缀为冻结 schema 与 ci-pr-gate Q2 要求），**不复制计划内容**；冲突时以正本为准。
- 有效待办 / 逐工具验收仍为 [`../alpha5-tool-io-governance/ALPHA5-EFFECTIVE-BACKLOG.md`](../alpha5-tool-io-governance/ALPHA5-EFFECTIVE-BACKLOG.md) 与 [`../alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md`](../alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md)。
- U6 设计与切片：[`../../memo/unified-baseline-alpha5-20261025/u6/`](../../memo/unified-baseline-alpha5-20261025/u6/)；门禁记录：[`../../memo/unified-baseline-alpha5-20261025/gates/GATE-LEDGER.md`](../../memo/unified-baseline-alpha5-20261025/gates/GATE-LEDGER.md)。
- release 状态 = BLOCKED（全工具审批未达）。
