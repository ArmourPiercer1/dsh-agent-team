# 七、审批、执行与持久化之间的权威状态管理

> **状态：DRAFT DESIGN / DOCUMENTS ONLY / DO NOT MERGE WITHOUT OWNER REVIEW。** 本目录记录下一版本的拟议架构，不是现行实施计划、权限裁决、生产配置或发布保证。批准本 PR 不等于授权开发或变更当前 Authority。
> 
> **技术基线**：DSH `dsh-v0.2.2-rc.3`（tag commit `38a6a5c965aa99ab525161efb7cc5cf1fe62fced`，2026-11-13）；Team 文档基线 `master@6361185d878ab2617193d51dd419e6dfe521a2ad`。当前 Team 实际仍使用 DSH `0.2.0-rc.2@639ed015397290b3745d163aafe02ffee4aa3f84`，新版接口未在 Team 上集成或验收。
> 
> **发布边界**：仅在 PR #758 被合并、另行完成既定 v0.1.6 受限内部试用版冻结后，才规划下一版本的主机升级与代码迁移；此提案不更改 `AGENTS.md`、`docs/ROUTER_RULES.md`、`dev/engineering/current-authority.json`、任何 active plan、产品代码、测试基线或 PR #758。

## 1. 唯一权威写入路径
```text
Bound Blueprint + Team Agent identity
 → Existing ControlRequest / ReviewCapability / Grant consumption
 → ExecutionAttempt(executionId, hostCallId, binding, boundary)
 → Native Tool body / Trusted Service / OS Provider
 → ExecutionObservation (physical effects + backend exit + Host result)
 → ONE append-only ExecutionFact(executionId)
 → many ControlRequest projections + DSH Session tool/result
```
审批/Grant/Stop 仍由既有 ControlService/Host Domain 掌握；Team `ExecutionSettlement` 不 mint/revoke Grants。执行事实只有一个写入权威；可以由多个 Provider 上报，必须按相同 ExecutionId 合并、保留证据来源与时序。

## 2. 多个审批 leg：并列要求，不是多个执行
某 ToolCall 可能分别拥有 `parameter-permission` 与 `team-tool-execute` 审批腿；此设计**不裁定二者是否合并、哪条可跳过**。多个已生效 ControlRequest → 同一个 ExecutionAttempt → 一个规范 ExecutionFact → 每个 Request 引用同一事实。两个审批腿的准入仍须遵照既有合法性；不可自动复用另一腿的 Grant 或据一个 leg 成功而断言另一个合法。

## 3. Journal 最小事件与 Idempotency
拟采用 ControlService 持久化适配/同一受信底座记录：
| 事件 | 用途 |
|---|---|
| EXECUTION_PREPARED | 分配全局执行身份；不能解读为已发起 |
| EXECUTION_ADMITTED | 所有需要的现有权限条件满足；不可扩大 Boundary |
| EXECUTION_DISPATCH_ENTERED | Host 分发进入阶段；Body 是否已启动仍需独立观察 |
| EXECUTION_OBSERVED | Provider/Tool/Host 可追溯观察，不强推成成功 |
| EXECUTION_SETTLED | 按 ExecutionId 写入规范终态 |
| EXECUTION_UNCONFIRMED | 崩溃/终止不明/事实不足，副作用未知 |
| EXECUTION_RECOVERY_RECONCILED | 基于新的证据补充，不能覆盖旧事实 |
`ExecutionId` 用于 exactly-one **规范事实归属** 而非 exactly-once OS 副作用；后者未经分布式事务与幂等外部资源不可保证。重复回调不生成第二个终态，异步持久化写入应可重试或 recovery reconcile；不能默默吞掉错误。对既有 `recordExecutionResult({callId,outcome})` 提供兼容读取/投影，迁移后不再多个工具体自行解析退出尾文本。

## 4. Host vs effect outcome
`Host ToolResult.isError`、原生 Bash text trailer、实际退出码/信号、文件是否已写、网络是否已连均分别记录。命令非零退出仍可能已写文件；工具被后处理阻止展示并不等于物理失败；取消后副作用可存在；没有 OS 效果证明不得填 `none-confirmed`。一切推断需明确所使用的受信机制与检验范围。

## 5. 新 DSH Hook 的保证边界
- `tools/post-execute` 是可等待的 waterfall，通常可以接入结果审查/业务结算，但异常路径可能跳过。
- `tools/result` 是最终结果 `emit`；Host 不等待异步 handler，因此不能将其当作 durable-commit-before-return 保障。
- `ToolExecutionPipeline.complete()` 先完成结果规范化与通知；`executeToolBatch` 再按模型序列提交 `tool/result` 到 Session。
- 基本保证（下一版本必选）：有已消费 Grant 的 ExecutionAttempt 最终形成一条可查的终态或保守 `unknown`；崩溃重启不会自动副作用重放。
- 强化保证（单独门禁）：模型/Host 最终通知前 ExecutionFact 已持久化。若 public Hook 不足，可在最新版公开 `ToolExecutor` / `ToolExecutionPipeline` / Batch 旁增加薄 Adapter 或最小基础设施 Fork，**不得声称现成 `tools/result` 自动保证顺序**。
- 不能无意让自定义 Executor 重写 ToolTool 的 batch ordering、PTC nested 或 Session log；异常分支和内部 Host 事件要 C2 验证。

## 6. Stop / cancellation / crash
**Stop**：先持久控制状态 → 阻止所有受影响 Scope 新调用 → 请求中断与排空 → 真实进程/PTY 终止证明 → 记录已完成/不确定事实。写 Stop 不能追溯撤回已产生的文件/网络影响。

**崩溃**：恢复 Agent/Blueprint/Grant/Stop/Execution Journal；对已消费且无终态的调用记录 `unknown`，不自动 replay、复用旧 process domain 或重唤醒 Officer。与 [PR #758](https://github.com/ArmourPiercer1/dsh-agent-team/pull/758) 的“用户/Leader 主动恢复”防御模型一致；#758 已于本轮文档审查期间合并，但 v0.1.6 内部版的正式冻结与发布状态须另行核实，不由此设计 PR 宣告完成。

**自批限制**：ReviewAuthority 独立于执行者；某 Agent 在别的请求中可获 Reviewer 身份，但其不得批准自己的执行。具体 Scope/Reviewer 规则仍由既有权限域裁决，不在本文件重写。

---

**文档导航**：[总索引](./README.md) · [一、总体架构裁决](./01-ARCHITECTURAL-DECISIONS.md) · [二、总体模块架构与权威归属](./02-MODULES-AND-AUTHORITY.md) · [三、最新 DSH 下的一次完整工具调用](./03-EXECUTION-FLOW.md) · [四、统一数据模型与信息流](./04-CONTRACTS-AND-DATAFLOW.md) · [五、各工具族如何通过同一架构接入](./05-TOOL-ADOPTION.md) · [六、四套关键状态机](./06-STATE-MACHINES.md) · [七、审批、执行与持久化之间的权威状态管理](./07-SETTLEMENT-RECOVERY.md) · [八、现有代码的重构与退役方案](./08-LEGACY-MIGRATION.md) · [九、基础设施 Fork 边界](./09-INFRASTRUCTURE-FORKS.md) · [十、迁移实施顺序与验收门禁](./10-IMPLEMENTATION-GATES.md) · [十一、统一执行架构不变量](./11-INVARIANTS.md)
