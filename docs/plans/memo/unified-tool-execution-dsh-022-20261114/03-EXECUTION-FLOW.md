# 三、最新 DSH 下的一次完整工具调用

> **状态：DRAFT DESIGN / DOCUMENTS ONLY / DO NOT MERGE WITHOUT OWNER REVIEW。** 本目录记录下一版本的拟议架构，不是现行实施计划、权限裁决、生产配置或发布保证。批准本 PR 不等于授权开发或变更当前 Authority。
> 
> **技术基线**：DSH `dsh-v0.2.2-rc.3`（tag commit `38a6a5c965aa99ab525161efb7cc5cf1fe62fced`，2026-11-13）；Team 文档基线 `master@6361185d878ab2617193d51dd419e6dfe521a2ad`。当前 Team 实际仍使用 DSH `0.2.0-rc.2@639ed015397290b3745d163aafe02ffee4aa3f84`，新版接口未在 Team 上集成或验收。
> 
> **发布边界**：仅在 PR #758 被合并、另行完成既定 v0.1.6 受限内部试用版冻结后，才规划下一版本的主机升级与代码迁移；此提案不更改 `AGENTS.md`、`docs/ROUTER_RULES.md`、`dev/engineering/current-authority.json`、任何 active plan、产品代码、测试基线或 PR #758。

## 1. 两阶段，而非混合时序
**装配阶段（Agent 出生/新代际）**：① 从 TeamDomain/Blueprint Authority 获取身份与已生效策略；② 编译 Agent × Tool Boundary；③ 为需治理的服务创建 Scope 和受限 Provider；④ 使用上游插件 `apply()` 在受控 Context 注册原生 ToolDefinition；⑤ 读取 `ToolsService` 的实际 Definition/Scope/受信来源；⑥ 在验证成功后发布 Binding Generation 为 ACTIVE；失败 rollback 和 fail-closed。不允许安装时展示的是受限工具，执行时却从 inherited unconfined service 解析 Body。

**单次调用阶段（与 DSH 对齐）**：
```text
AgentLoop prepares model step
  → ToolsService.resolve() → ResolvedToolSet
  → LLM tool-call batch
  → ToolsService selects scope ToolExecutor
  → executeToolBatch (model-order start/commit, parallel/exclusive)
  → ToolExecutionPipeline.prepare
      → tools/pre-execute (Team existing admission/ask; async)
      → monotonic tools.guard (Binding, Stop, Scope)
  → ToolExecutionPipeline.dispatch
      → tools/execute (around wrapper; timeout/cancel)
      → native ToolDefinition.execute
           → scoped fs/web/subprocess/terminal → OS launcher as needed
  → body/backend observation
  → ToolExecutionPipeline.complete (post-execute where reachable)
      → ToolDefinition.projectContent
      → tools/post-execute (async waterfall)
      → finalizeContent, materialization, tools/result (emit)
  → batch Session tool/result (model-ordered)
  → next model step
```
**校正**：`projectContent` 在 `tools/post-execute` 之前；有异常分支直接进入最终规范化而跳过 post-execute；`tools/result` 并不等待监听器异步落账。实际 `tools/execute` listener 与 Host Body 解析的最后时间窗口按受信运行时环境责任处理，保留现有防御，不引入 Core 修改。DSH [官方流水线图](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.3/docs/tool-execution-pipeline.zh.md)。

## 2. 新宿主重要接口
- `ToolsService.register(definition,{when})`：可带条件激活；`resolve({agent,modelSelection,signal})` 产生单步骤 `ResolvedToolSet`，同一步骤模型可见 Schema 与 PTC 内层调用共享该集合；这是可用性而非权限准入。
- `ToolsService.setExecutor(executor)`：按 Scope 选择 Native/PTC；卸载后选择不可用，不静默切换为更宽 Executor。
- `ToolExecutionPipeline`：公用输入快照、Guard、分发、取消、结果处理，不能再在 Team 私有 Family 重写它。
- `executeToolBatch`：`isConcurrencySafe` 的并发与独占屏障、已启动调用排空、模型顺序 commit。Team 不重排工具回执或重复写 Session 事件。
- `ToolDefinition` 保留原生 schema/output/render/timeout/present；Team 受控 Provider 不应修改工具的业务语义。
- 共享 Pipeline 的 Result 是 Host/模型的最终观察；真实 OS 退出、PTY 生存与副作用另由 Provider 报告，见 [第 7 节](./07-SETTLEMENT-RECOVERY.md)。

## 3. Team 插入位置
- 在装配发布前：统一 NativeBindingAssembler 验证注册源、ToolSet/Scope 和 Provider。
- 在 pre-execute/Guard：现有 Control/OperationPermission 和执行身份 gate；**不要增加一条新的授权链**。
- 在工具 Body I/O 服务：实施 EffectiveIO；ToolDefinition 只看到正常公共服务。
- 在 Provider/Host 回执：单次 ExecutionId 聚合并结算；不在每个工具族内自行判读结果。

## 4. 两个必须明确的先后关系
**模型可见结果 vs 事实落账**：`post-execute` 可等待，但后续可能仍发生结果变更、最终同步 `tools/result` 通知不 await；将“最终结果先落账再发给模型”当作已由 Hook 满足是错误声明。需依据 [第 7 节](./07-SETTLEMENT-RECOVERY.md) 的基本/强化保证分别实现。

**审批允许 vs I/O 允许**：Call Admission 可以通过，但 Provider 检查出 Boundary 不允许时，工具仍须拒绝。两个失败来自不同责任层，并以相同 ExecutionId 关联，不是权限冲突。

---

**文档导航**：[总索引](./README.md) · [一、总体架构裁决](./01-ARCHITECTURAL-DECISIONS.md) · [二、总体模块架构与权威归属](./02-MODULES-AND-AUTHORITY.md) · [三、最新 DSH 下的一次完整工具调用](./03-EXECUTION-FLOW.md) · [四、统一数据模型与信息流](./04-CONTRACTS-AND-DATAFLOW.md) · [五、各工具族如何通过同一架构接入](./05-TOOL-ADOPTION.md) · [六、四套关键状态机](./06-STATE-MACHINES.md) · [七、审批、执行与持久化之间的权威状态管理](./07-SETTLEMENT-RECOVERY.md) · [八、现有代码的重构与退役方案](./08-LEGACY-MIGRATION.md) · [九、基础设施 Fork 边界](./09-INFRASTRUCTURE-FORKS.md) · [十、迁移实施顺序与验收门禁](./10-IMPLEMENTATION-GATES.md) · [十一、统一执行架构不变量](./11-INVARIANTS.md)
