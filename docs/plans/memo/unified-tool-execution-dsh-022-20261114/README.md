# Unified Tool Execution / DSH 0.2.2 下一代架构设计（Draft）

> **状态：DRAFT DESIGN / DOCUMENTS ONLY / DO NOT MERGE WITHOUT OWNER REVIEW。** 本目录记录下一版本的拟议架构，不是现行实施计划、权限裁决、生产配置或发布保证。批准本 PR 不等于授权开发或变更当前 Authority。
> 
> **技术基线**：DSH `dsh-v0.2.2-rc.3`（tag commit `38a6a5c965aa99ab525161efb7cc5cf1fe62fced`，2026-11-13）；Team 文档基线 `master@6361185d878ab2617193d51dd419e6dfe521a2ad`。当前 Team 实际仍使用 DSH `0.2.0-rc.2@639ed015397290b3745d163aafe02ffee4aa3f84`，新版接口未在 Team 上集成或验收。
> 
> **发布边界**：仅在 PR #758 被合并、另行完成既定 v0.1.6 受限内部试用版冻结后，才规划下一版本的主机升级与代码迁移；此提案不更改 `AGENTS.md`、`docs/ROUTER_RULES.md`、`dev/engineering/current-authority.json`、任何 active plan、产品代码、测试基线或 PR #758。

## 阅读顺序与文件分工

1. [一、总体架构裁决](./01-ARCHITECTURAL-DECISIONS.md) — 设计决策与非目标、证据边界
2. [二、总体模块架构与权威归属](./02-MODULES-AND-AUTHORITY.md) — 五层架构、唯一权威状态与模块依赖
3. [三、最新 DSH 下的一次完整工具调用](./03-EXECUTION-FLOW.md) — ToolSet、Executor、Pipeline、结果通知的真实时序
4. [四、统一数据模型与信息流](./04-CONTRACTS-AND-DATAFLOW.md) — Binding/Boundary/Attempt/Observation 的字段与流转
5. [五、各工具族如何通过同一架构接入](./05-TOOL-ADOPTION.md) — FS/Web/Search/Shell/PTY/PTC/MCP/Host Domain 的接入
6. [六、四套关键状态机](./06-STATE-MACHINES.md) — Agent Scope、Binding、Invocation、Process 域状态机
7. [七、审批、执行与持久化之间的权威状态管理](./07-SETTLEMENT-RECOVERY.md) — 审批关联、幂等落账、Stop 与冷启动
8. [八、现有代码的重构与退役方案](./08-LEGACY-MIGRATION.md) — 保留/收敛/拆分/退役源代码清单
9. [九、基础设施 Fork 边界](./09-INFRASTRUCTURE-FORKS.md) — 零上游补丁与有限基础设施 Fork 的授权边界
10. [十、迁移实施顺序与验收门禁](./10-IMPLEMENTATION-GATES.md) — G0–G5 Gate 与独立效果负控
11. [十一、统一执行架构不变量](./11-INVARIANTS.md) — UTE-01…UTE-20 不变量、保证和审查矩阵

## 设计在什么边界内成立

- **用户已裁决**：v0.1.6 在 #758 合并后冻结为受限内部试用版；新版本面向较新 DSH；工具 I/O 采用受信服务 + OS 子进程两种混合机制；不实现完整 Tool Worker；同名 Definition A/B 最后解析窗口属于受信运行环境管理问题，暂不深入解决；可在 Team 仓库维护经审查的少量基础设施插件 Fork，但不直接修改上游仓库工作树。
- **本 PR 的设计提案而非先验事实**：ExecutionBoundary、BindingReceipt、ExecutionAttempt、ExecutionObservation、统一 Settlement/Execution Journal、跨角色 Agent Scope、模块退役的目标依赖等，需由 Owner Review 后进入新的实施计划。
- **旧版已验证但非新版保证**：Alpha.5 Sandbox-First 服务代理、原生搜索子进程、PTY 接缝、bwrap 子集及相关负控；严格文件级 Landlock 读写隔离在早期 WSL2 为 ENV_BLOCK；不能将旧版 PASS 投射到最新版本。
- **最新版源码事实**：DSH v0.2.2-rc.3 有 `ToolsService.resolve()/ResolvedToolSet`、`setExecutor()`、`ToolExecutionPipeline`、`executeToolBatch`、`NativeToolExecutor` 和 `PtcExecutor`；`tools/result` 为不等待异步监听器的 emit；`tools/post-execute` 是可等待 waterfall，但异常可能绕过。

## 范围与明确不做的事

只设计下一版本的工具执行与 I/O/Web 控制子系统以及必要的身份、授权和持久化接缝。暂不重构 Blueprint 作者语法、Alpha.4/Alpha.6 决策规则、Goal 领域授权、A6 Reviewer 路由、UI 业务；不承诺恶意同进程 JS 隔离；不承诺远端服务内部沙箱；不把对 Profile 的静态检查冒称真实执行负控。文中不变量是**目标验收合同**，当前实测情况必须另附版本及平台证据。

## 主要来源（本 PR 仅引用，不修改）

- [DSH v0.2.2-rc.3 release](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.2-rc.3) / [tools](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.2.2-rc.3/packages/core/tools) / [Native Executor](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.3/packages/core/tool-executor-native/src/index.ts) / [PTC Executor](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.3/packages/core/tool-executor-ptc/src/index.ts).
- [原 Sandbox-First ADR](../alpha5-sandbox-first-20261101/ADR.md)、[ARCHITECTURE](../alpha5-sandbox-first-20261101/ARCHITECTURE.md)、[TOOL-ADOPTION-MATRIX](../alpha5-sandbox-first-20261101/TOOL-ADOPTION-MATRIX.md)。
- [Agent Execution Realm 设计工作包](../../active/alpha5-sandbox-first/WP-AGENT-EXECUTION-REALM.md)、[F-2 Goal Domain 设计工作包](../../active/alpha5-sandbox-first/WP-F2-GOAL-DOMAIN-AUTHORITY.md)、[#758](https://github.com/ArmourPiercer1/dsh-agent-team/pull/758)。

## 决策来源、效力与审核

每篇区分 **已确认约束**、**上游/仓库源码观察**、**拟议架构**、**待实证缺口**；只有经过另行 Authority Migration 审查，才可将设计变成新的实施与发布合同。旧计划与历史证据保持不可变；不能通过文档标题、索引或 PR 合并自动切换当前权威。
---

**文档导航**：[总索引](./README.md) · [一、总体架构裁决](./01-ARCHITECTURAL-DECISIONS.md) · [二、总体模块架构与权威归属](./02-MODULES-AND-AUTHORITY.md) · [三、最新 DSH 下的一次完整工具调用](./03-EXECUTION-FLOW.md) · [四、统一数据模型与信息流](./04-CONTRACTS-AND-DATAFLOW.md) · [五、各工具族如何通过同一架构接入](./05-TOOL-ADOPTION.md) · [六、四套关键状态机](./06-STATE-MACHINES.md) · [七、审批、执行与持久化之间的权威状态管理](./07-SETTLEMENT-RECOVERY.md) · [八、现有代码的重构与退役方案](./08-LEGACY-MIGRATION.md) · [九、基础设施 Fork 边界](./09-INFRASTRUCTURE-FORKS.md) · [十、迁移实施顺序与验收门禁](./10-IMPLEMENTATION-GATES.md) · [十一、统一执行架构不变量](./11-INVARIANTS.md)
