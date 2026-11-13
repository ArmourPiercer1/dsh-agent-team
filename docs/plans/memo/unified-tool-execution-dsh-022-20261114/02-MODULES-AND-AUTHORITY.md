# 二、总体模块架构与权威归属

> **状态：DRAFT DESIGN / DOCUMENTS ONLY / DO NOT MERGE WITHOUT OWNER REVIEW。** 本目录记录下一版本的拟议架构，不是现行实施计划、权限裁决、生产配置或发布保证。批准本 PR 不等于授权开发或变更当前 Authority。
> 
> **技术基线**：DSH `dsh-v0.2.2-rc.3`（tag commit `38a6a5c965aa99ab525161efb7cc5cf1fe62fced`，2026-11-13）；Team 文档基线 `master@6361185d878ab2617193d51dd419e6dfe521a2ad`。当前 Team 实际仍使用 DSH `0.2.0-rc.2@639ed015397290b3745d163aafe02ffee4aa3f84`，新版接口未在 Team 上集成或验收。
> 
> **发布边界**：仅在 PR #758 被合并、另行完成既定 v0.1.6 受限内部试用版冻结后，才规划下一版本的主机升级与代码迁移；此提案不更改 `AGENTS.md`、`docs/ROUTER_RULES.md`、`dev/engineering/current-authority.json`、任何 active plan、产品代码、测试基线或 PR #758。

## 1. 五层责任
| 层 | 责任 | 主要来源 | 明确不负责 |
|---|---|---|---|
| A Team Control & Identity | Team/Agent 生命周期、Blueprint、Approval/Grant/Stop | 现有 TeamDomain、ControlService、Policy Compiler | 不直接运行工具 Body |
| B DSH Native Tool Plane | ToolDefinition、ToolSet、Scoped Executor、Pipeline、Batch、Session | v0.2.2-rc.3 ToolsService/Executor/Pipeline | 不拥有 Team 权限或硬 I/O Ceiling |
| C Binding & Execution Boundary | Scope、可信来源、Binding Receipt、Guard、执行租约、EffectiveIO | 收敛 team-services/mount、tool-dispatch、member-io-policy | 不复刻 ToolRegistry/审批 |
| D Enforcement Providers | FS、Web、Subprocess、PTY 与 OS 沙箱/进程生命周期 | team-services、sandbox-provider、DSH Providers | 不发放新权限 |
| E Observability & Settlement | 正规化执行观察、ExecutionId 关联、追加式唯一事实 | ControlService 持久化适配 | 不推断授权、不过度推断副作用 |

依赖应保持 A→C→D、B→C/D（运行调用）、D/B→E（观察）。C/D/E 不得回调 A 以签发新的授权；提供只读权威引用即可。详见 [调用流](./03-EXECUTION-FLOW.md)、[契约](./04-CONTRACTS-AND-DATAFLOW.md)。

## 2. 权威登记表
| 事实/对象 | 唯一权威 | 允许的消费者 | 冲突处置 |
|---|---|---|---|
| Team/Agent identity、role、生命周期 | Team Domain | Scope、Guard、Control | 不推断或静默默认身份 |
| 生效 Blueprint/revision | 现有 Blueprint authority | Policy compiler | 不复制第二解析器 |
| EffectiveIO | 既有纯 Policy compiler + 有效身份 | Scoped Provider/OS Profile | 未编译/不满足即拒绝 |
| 真实 ToolDefinition / toolSet / Executor | 上游 ToolsService | Binder/Guard/Presentation | Team 自建 Registry 仅保留核验收据 |
| Source digest/Scope/binding generation | Team Trusted Binding authority | Guard、装配 | 漂移导致退役/拒绝 |
| ApprovalCase、ReviewCapability、Grant、Stop | 既有 ControlService/对应 Host Domain | Guard/Settlement | 不生成第二授权账本 |
| OS 子进程、PTY、process lease 实际状态 | 对应 Process/Terminal provider | Settlement/Scope lifecycle | 未确认终止不得报已停止 |
| 被执行的读写/网络效果 | 实际受控 Provider/OS | Observation | 不用 display 文本冒充副作用证明 |
| 单次物理执行事实 | ExecutionSettlement 一份按 ID 幂等 Journal | 多个 Control Request/UI | 多腿共享结果 |
| 模型可见 ToolResult | DSH Pipeline 与 Session log | UI/Agent | 不从 isError 反推无副作用 |

`BindingAuthority` 的“权威”仅指身份来源核验，不是工具可见性/Definition 选择；`ExecutionSettlement` 仅有事实归属，不是授权决定。权威区分的目标是消除**对同一个问题**的重复权威，不否定防御性多重检查。

## 3. 三个不同的判定
- **Tool Authority**：当前 Agent Scope 里真正的 ToolDefinition/Executor 是什么？以 `ToolsService` 实时解析及 `ResolvedToolSet` 为事实。
- **Invocation Authority**：此身份此次调用能不能运行？由现有审批/Guard/Grant 决定。
- **Execution Boundary**：即使调用已批准，实际 I/O 仍受什么上界？由 Policy Compiler 给出，Provider/OS 实施。

以上三者不可在 ToolPlane、Realm、Kernel、执行器里彼此复制。Realm 仅指 Cordis 服务隔离 Context，不等于 OS 进程隔离；Agent Scope 是身份绑定与服务视图，ExecutionBoundary 是有效 I/O 规则，SandboxInstance 是实际 OS 资源。

## 4. Root/Leader 与 Officer
所有执行身份都应有有效 Boundary；Leader 不应被迫“只能委派 I/O”，但其直接 I/O 不能等于 Host ControlService 内部无边界访问；Officer 审批领域与其本人执行领域分离，同一执行实例不能批准自己的操作。参阅 [AER 旧设计工作包](../../active/alpha5-sandbox-first/WP-AGENT-EXECUTION-REALM.md) 和 [第 6 节](./06-STATE-MACHINES.md)。此为待评审方案，不冒称 v0.1.6 已完成。

---

**文档导航**：[总索引](./README.md) · [一、总体架构裁决](./01-ARCHITECTURAL-DECISIONS.md) · [二、总体模块架构与权威归属](./02-MODULES-AND-AUTHORITY.md) · [三、最新 DSH 下的一次完整工具调用](./03-EXECUTION-FLOW.md) · [四、统一数据模型与信息流](./04-CONTRACTS-AND-DATAFLOW.md) · [五、各工具族如何通过同一架构接入](./05-TOOL-ADOPTION.md) · [六、四套关键状态机](./06-STATE-MACHINES.md) · [七、审批、执行与持久化之间的权威状态管理](./07-SETTLEMENT-RECOVERY.md) · [八、现有代码的重构与退役方案](./08-LEGACY-MIGRATION.md) · [九、基础设施 Fork 边界](./09-INFRASTRUCTURE-FORKS.md) · [十、迁移实施顺序与验收门禁](./10-IMPLEMENTATION-GATES.md) · [十一、统一执行架构不变量](./11-INVARIANTS.md)
