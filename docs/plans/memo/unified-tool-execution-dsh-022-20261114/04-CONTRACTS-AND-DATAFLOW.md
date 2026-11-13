# 四、统一数据模型与信息流

> **状态：DRAFT DESIGN / DOCUMENTS ONLY / DO NOT MERGE WITHOUT OWNER REVIEW。** 本目录记录下一版本的拟议架构，不是现行实施计划、权限裁决、生产配置或发布保证。批准本 PR 不等于授权开发或变更当前 Authority。
> 
> **技术基线**：DSH `dsh-v0.2.2-rc.3`（tag commit `38a6a5c965aa99ab525161efb7cc5cf1fe62fced`，2026-11-13）；Team 文档基线 `master@6361185d878ab2617193d51dd419e6dfe521a2ad`。当前 Team 实际仍使用 DSH `0.2.0-rc.2@639ed015397290b3745d163aafe02ffee4aa3f84`，新版接口未在 Team 上集成或验收。
> 
> **发布边界**：仅在 PR #758 被合并、另行完成既定 v0.1.6 受限内部试用版冻结后，才规划下一版本的主机升级与代码迁移；此提案不更改 `AGENTS.md`、`docs/ROUTER_RULES.md`、`dev/engineering/current-authority.json`、任何 active plan、产品代码、测试基线或 PR #758。

本文件各类型均为**目标设计草图**，不是当前仓库已发布的 TypeScript API；具体实现以已有 Contract 复用为优先。字段如 `definitionIdentity` 必须由可信 Registry/Loader 获得，不能从工具名字符串推导。

## 1. 四个最小契约
```ts
interface BindingReceipt {
  agentInstanceId: string;
  agentGeneration: number;
  toolName: string;
  definitionIdentity: string;
  sourceDigest: string;
  dependencyDigest: string;
  scopeIdentity: string;
  bindingGeneration: number;
  serviceBindings: {
    fs?: string; web?: string; subprocess?: string; terminals?: string;
  };
  boundaryDigest: string;
}

interface ExecutionBoundary {
  agentInstanceId: string;
  toolBindingIdentity: string;
  policyRevision: string;
  read: PathRuleSet;
  write: PathRuleSet;
  network: { access: 'allow' | 'deny' };
  requiredEnforcement: {
    trustedServices?: readonly string[];
    osFilesystem?: boolean;
    osNetwork?: boolean;
  };
}

interface ExecutionAttempt {
  executionId: string;
  teamRootSessionId: string;
  agentInstanceId: string;
  bootEpoch: string;
  hostCallId: string;
  rootCallId: string;
  parentExecutionId?: string;
  binding: BindingReceipt;
  boundary: ExecutionBoundary;
  controlRequestIds: readonly string[];
}

interface ExecutionObservation {
  executionId: string;
  dispatch: 'not-started' | 'started' | 'quiesced' | 'termination-unconfirmed';
  bodyOutcome: 'completed' | 'failed' | 'unknown';
  effectEvidence: 'none-confirmed' | 'possible' | 'observed' | 'unknown';
  hostResult?: { isError: boolean; errorCode?: string };
  backendReceiptId?: string;
}
```

## 2. Effective IO 数学约束
对于 Agent `a` 和 Tool Binding `t`，`B(a,t) = C(a) ∩ R(a,t)`，三个轴（read / write / network）独立取交；`EffectiveIO(call) ⊆ B(a,t)`。Call 的一次性审批不扩大 `B`。未声明工具限制如何映射为“不额外收窄”需经过与旧版 Blueprint 兼容性核查；旧 `network: restricted` 不能在只有布尔 allow/deny 的后端静默降级。策略变化生成新 revision/代际，不原地扩权。

## 3. 身份与引用关系
- `ExecutionId` 唯一标识 Team 中的一次**物理执行尝试**；以 Team/Boot/Agent/Host Call 可信来源生成或绑定。一个请求可涉及多个 ControlRequest，但只有一个规范物理事实。
- `hostCallId` 为原生相关标识，`rootCallId` 关联 PTC 嵌套来源；`parentExecutionId` 建立父子依赖，不继承父调用未授权的新权限。
- 运行时可用 DSH `token` / exec-object WeakMap 关联；持久化不能只凭原始 `callId` 在重启、不同 Team/Session 中全局猜唯一。
- `BindingReceipt` 不是第二个 ToolRegistry；`ExecutionAttempt` 不重新签发 Grant；`ExecutionObservation` 不根据文本 tail 或 `isError` 单独断言外部副作用不存在。
- 可信 Node 服务与 OS 子进程不跨环境使用 JS 对象引用作为安全边界；进程侧必须传可验证的进程/策略收据，拒绝模型可伪造的 identity/path 签名。

## 4. 不可变与可变状态界限
不可变：已发布 BindingReceipt、EffectiveBoundary、ExecutionId 与审批关联、后端启动 Profile 的快照。可变但有唯一所有者：Agent 生命周期、Binding ACTIVE/DRAINING、执行租约、PTC/PTY live process、append-only execution facts。不得使用 process-global `currentMember`/同名配置开关作为并发身份载体。

## 5. 状态与证据不能压缩为一个 isError
Body 是否进入、是否 quiesced；实际文件/网络副作用是否可能发生；Host 是否最终返回错误，是三件独立事实。命令 `exit 1` 仍可能产生写入；结果被 post-execute block 也不等于 Body 没执行；SIGKILL/timeout 不可无证据认定无效果。详细投影与持久化见 [第 7 节](./07-SETTLEMENT-RECOVERY.md)。

## 6. 可审计链
```text
Team Domain + Bound Blueprint
  → EffectiveBoundary / BindingReceipt
  → Existing Admission & Grant Consumption
  → ExecutionAttempt
  → Real Provider / OS Effects
  → ExecutionObservation
  → One ExecutionFact
  → ControlRequest references + DSH Session result reference
```

---

**文档导航**：[总索引](./README.md) · [一、总体架构裁决](./01-ARCHITECTURAL-DECISIONS.md) · [二、总体模块架构与权威归属](./02-MODULES-AND-AUTHORITY.md) · [三、最新 DSH 下的一次完整工具调用](./03-EXECUTION-FLOW.md) · [四、统一数据模型与信息流](./04-CONTRACTS-AND-DATAFLOW.md) · [五、各工具族如何通过同一架构接入](./05-TOOL-ADOPTION.md) · [六、四套关键状态机](./06-STATE-MACHINES.md) · [七、审批、执行与持久化之间的权威状态管理](./07-SETTLEMENT-RECOVERY.md) · [八、现有代码的重构与退役方案](./08-LEGACY-MIGRATION.md) · [九、基础设施 Fork 边界](./09-INFRASTRUCTURE-FORKS.md) · [十、迁移实施顺序与验收门禁](./10-IMPLEMENTATION-GATES.md) · [十一、统一执行架构不变量](./11-INVARIANTS.md)
