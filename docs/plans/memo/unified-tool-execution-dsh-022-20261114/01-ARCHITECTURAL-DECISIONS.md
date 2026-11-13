# 一、总体架构裁决

> **状态：DRAFT DESIGN / DOCUMENTS ONLY / DO NOT MERGE WITHOUT OWNER REVIEW。** 本目录记录下一版本的拟议架构，不是现行实施计划、权限裁决、生产配置或发布保证。批准本 PR 不等于授权开发或变更当前 Authority。
> 
> **技术基线**：DSH `dsh-v0.2.2-rc.3`（tag commit `38a6a5c965aa99ab525161efb7cc5cf1fe62fced`，2026-11-13）；Team 文档基线 `master@6361185d878ab2617193d51dd419e6dfe521a2ad`。当前 Team 实际仍使用 DSH `0.2.0-rc.2@639ed015397290b3745d163aafe02ffee4aa3f84`，新版接口未在 Team 上集成或验收。
> 
> **发布边界**：仅在 PR #758 被合并、另行完成既定 v0.1.6 受限内部试用版冻结后，才规划下一版本的主机升级与代码迁移；此提案不更改 `AGENTS.md`、`docs/ROUTER_RULES.md`、`dev/engineering/current-authority.json`、任何 active plan、产品代码、测试基线或 PR #758。

## 1. 主张
采用 **Native-First / Boundary-Centric / Single-Settlement**。上游 `ToolsService` 保持模型可见 ToolDefinition、可见工具集、Executor 选择的唯一注册/调度权威；Team 仅负责可信绑定、既有准入、I/O Boundaries、Provider 和执行事实。新版 DSH 已拆出 `ToolExecutor`、`ToolExecutionPipeline`、`NativeToolExecutor`、`PtcExecutor` 和 `executeToolBatch`，应复用而不重复实现。见 [第 2 节](./02-MODULES-AND-AUTHORITY.md)、[第 3 节](./03-EXECUTION-FLOW.md)。

## 2. 适用范围
受治理的所有 Team Agent，包括 Leader/Root、Officer、普通 Member；包括原生 FS/Search/Web、Shell/PTY、PTC 内层调用、本地 MCP/LSP/CLI、Team 自有业务工具。文件读取/写入路径与网络布尔准入为本期 I/O 轴。真实 Host 控制面、远端服务内部、第三方非受信同进程 JS 的恶意绕过不在同一强制保证内。纯 Host 状态工具保留领域约束，不能以名称豁免真实 I/O。

## 3. 明确非目标
1. 不重做工具算法、Schema、Render、Spill、Session 日志、PTY 状态机或 PTC 执行器。
2. 不采用 whole-tool worker 隔离作为本期通用机制。
3. 不重设 Alpha.4/Alpha.6 权限决定、Reviewer 路由、Grant 消费规则；多个既有审批腿先关联，不擅自合并。
4. 不把同名 Definition 的最终解析 A/B 窗口作为本期修复任务；由部署者可信插件纪律承担余留风险，保留既有 change/Guard/撤销检测。
5. 不承诺事务回滚、无副作用取消、任意主机系统调用强隔离、端点级网络 ACL、远端 MCP 约束。
6. 不在本 PR 修改 Host checkout、Team 产品运行时、当前权威指针、测试固定版本或 v0.1.6 发布流程。

## 4. 安全/保证模型
- `trusted-service`：工具来源受信，依赖绑定的 `ctx.fs/web/subprocess`；不防同进程 JS 直接 `node:fs/net`。
- `os-confined`：对真正经过受限 launcher 的子进程及其后代实施限制；Landlock/bwrap/netns 的实际能力逐 OS/ABI 检测。两种方式可组合。
- 被批准的一次调用**不会扩大** Agent × Tool 的硬上界；要求无法兑现时明确 UNSUPPORTED/fail-closed。
- 保障标签：`TRUSTED_ONLY`、`TESTED_NO_BYPASS_OBSERVED`（注明平台、Host SHA、路径和真实副作用证据）、`NOT_TESTED`、`ENV_BLOCK`、`UNSUPPORTED`；不得把不同级别混称完全隔离。

## 5. 依据与迁移原则
原 [2026-11-03 Sandbox-First 架构](../alpha5-sandbox-first-20261101/ARCHITECTURE.md) 已定义 `MemberCeiling ∩ ToolRestriction`、受信服务与 OS 叶进程，PoC 支持路线而非已兑现全部轴。此次改变的是使用较新 DSH 的公共工具执行架构，减少旧 ToolPlane/Family Body 与 Native 的双轨维护。

硬约束的集中规范见 [第 11 节](./11-INVARIANTS.md)，治理事实归属见 [第 2 节](./02-MODULES-AND-AUTHORITY.md)。

---

**文档导航**：[总索引](./README.md) · [一、总体架构裁决](./01-ARCHITECTURAL-DECISIONS.md) · [二、总体模块架构与权威归属](./02-MODULES-AND-AUTHORITY.md) · [三、最新 DSH 下的一次完整工具调用](./03-EXECUTION-FLOW.md) · [四、统一数据模型与信息流](./04-CONTRACTS-AND-DATAFLOW.md) · [五、各工具族如何通过同一架构接入](./05-TOOL-ADOPTION.md) · [六、四套关键状态机](./06-STATE-MACHINES.md) · [七、审批、执行与持久化之间的权威状态管理](./07-SETTLEMENT-RECOVERY.md) · [八、现有代码的重构与退役方案](./08-LEGACY-MIGRATION.md) · [九、基础设施 Fork 边界](./09-INFRASTRUCTURE-FORKS.md) · [十、迁移实施顺序与验收门禁](./10-IMPLEMENTATION-GATES.md) · [十一、统一执行架构不变量](./11-INVARIANTS.md)
