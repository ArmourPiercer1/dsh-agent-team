# ADR-A6-1 — ReviewCapability：真实 Principal 身份与 Case-scoped 审批能力的分离

> **状态：ACCEPTED（2026-11-03 真实 UTC，用户裁决）。** 用户选择“先完成架构裁决
> 与 ADR，再修改 Control/PA 代码”，并明确授权对 Alpha.6 审批授权模型作必要、
> 系统性的架构调整。本 ADR 只定契约与数据流，**不修改任何生产代码**；实施由
> A6-PR2a…2c + A6-PR5 按本契约推进。
>
> 关联：[PR #536 设计正本](./alpha6-blueprint-router-wake-rebase-20261103.md)、
> [执行计划](./alpha6-execution-plan-20261102.md)、
> [P-AUTH 证据](../../../../dev/agent-workflow/evidence/alpha6-rebase-poc-20261102/P-AUTH/RESULTS.md)。

## 1. 背景：被证伪的假设

首轮 P-AUTH 只验证了 Control 角色闭集接缝，结论“一个 case-scoped 谓词即可走完
同一账本与 guard”**不成立**。2026-11-02 的完整 PA 链实验（真实 strict PA
manifest + 真实 `createPaEffectsVerifier` + 真实 `createPaControlLeg`）显示：

- Leader 决议 → 全链 `approve`，grant mint，guard 消费恰好一次；
- 仅加 Control 角色接缝时，member Officer 的 allow 在 `resolve` 即被 durable
  DENY `pa-authority-drift`，零 grant、零消费；
- 只有把一个 throwaway 的 reviewer-authority 映射加进 `deciderAuthority()`，
  同一 durable decider（`role:'member'`）才完成 allow + mint + guard。

源码事实：

| 位置 | 事实 |
| --- | --- |
| `packages/runtime/control/service.ts` role closure | `CONTROL_RESOLVER_ROLES['leader-approval'] = ['leader','human']`，Member 永远不是 resolver |
| `packages/runtime/operation-permission/pa-control-bridge.ts` `deciderAuthority()` | `{role:'member'}` 固定解释为 `member` |
| `packages/runtime/governance/authority-ceiling.ts` `mayReview()` | `reviewerRank > beneficiaryRank && reviewerRank >= requiredRank`，member 对 member/leader 恒假 |
| `packages/runtime/tool-admission/approval-case.ts` `verifyEffectSetApproval()` | 逐 effect 用 reviewerAuthority 走 `mayReview` + `grantCeiling` |
| `pa-control-bridge.ts` `issueApprovedGrant()` / `ControlService.guardOperation()` | 同一 presenter 结论，grant 与 guard 一致拒绝 |

**根因不是“少一个 if”，而是模型把“Principal 的真实身份”与“该 Principal 在当前
Case 中的有效审批能力”压成了一个 `role` 字段。** 只改任一入口都会造成跨层不一致；
必须统一契约。

## 2. 决策

### D1. 身份与能力分离

- `Principal`：真实调用者，保持 `{kind:'instance', instanceId, role:'member'}` 或
  `{kind:'human', humanId}`；**永不伪造 Leader 身份**。
- `ReviewCapability`：该 Principal 在**当前 Case/leg/操作作用域**内可行使的审批
  能力，独立求值、独立持久化快照、独立验证。
- Durable decision 的 `decider` 仍是真实 Principal；`ReviewCapability` 是附加的
  授权能力事实，不是身份替换。

### D2. 一个纯求值器，不在入口硬编码

新增纯模块（建议 `packages/runtime/review-authority/`，只依赖 contracts/domain
类型，不 I/O、不读时钟、不写账本）：

```ts
export type ReviewCapabilitySource =
  | 'principal-role'          // leader / human 的自身能力
  | 'blueprint-officer'       // 冻结 Blueprint 的静态委托
  | 'current-leg-handoff'     // 显式 Handoff 后的当前 leg 覆盖

export interface ReviewCapabilityInput {
  readonly principal: ControlCallerRef
  readonly approvalCaseId: string
  readonly legOrdinal: number
  readonly reviewAuthority: ProposalAuthorityPosition   // 该 leg 要求谁可决
  readonly beneficiaryAuthority: ProposalAuthorityPosition
  readonly scope: ControlOperationScope
  readonly member: { teamSessionId: string; instanceId: string; templateId: string }
  readonly blueprint: {
    readonly revision: string
    readonly contentHash: string
    readonly reviewRouting?: ReviewRouting              // 冻结 Blueprint 的静态委托
  }
  readonly handoff?: { readonly toInstanceId: string }   // 当前 leg 的最小接管事实
  readonly authorityGeneration: number
}

export type ReviewCapabilityVerdict =
  | { readonly ok: true; readonly capability: ReviewCapability }
  | { readonly ok: false; readonly reason: ReviewCapabilityRefusal }

export interface ReviewCapability {
  readonly principal: ControlCallerRef
  readonly approvalCaseId: string
  readonly legOrdinal: number
  readonly scope: ControlOperationScope
  readonly effectiveReviewAuthority: RuntimeAuthority   // 仅提升“审批能力”，不改身份
  readonly source: ReviewCapabilitySource
  readonly blueprintRevision: string
  readonly blueprintContentHash: string
  readonly authorityGeneration: number
}
```

求值顺序（固定、可测试）：

1. Human principal：只对 Human 可决的 kind 返回 `human-*`；永不被委托覆盖。
2. Leader principal：返回自身 `leader`；治理/持久权限类仍只走 Leader。
3. Member principal：
   a. 该 leg 的 `reviewAuthority` 不是 `leader` → 返回自身 `member`（普通同层
      审批，`mayReview` 仍会拒绝同层，不由本 ADR 放宽）。
   b. 是 `leader` → 检查 `current-leg-handoff`；若当前 leg 已 Handoff 给他人，
      只有被指定者可决。
   c. 否则检查 Blueprint 静态委托：principal 的 `templateId ==
      reviewRouting.officerTemplateId`、scope 属于可委托的普通工具审批、且不是
      Officer 自审/自请求。满足则返回 `effectiveReviewAuthority:'leader'`，
      `source:'blueprint-officer'`。
   d. 否则拒绝（`not-a-reviewer` / `self-review` / `out-of-scope` /
      `officer-self-ask` / `human-only` / `governance`）。
4. 任何输入缺失、generation 漂移、Blueprint 版本不匹配 → 拒绝（fail closed）。

### D3. Durable decision 携带能力快照

`ControlDecisionRecord` 新增**可选**字段（additive；旧行缺席 = 旧行为）：

```ts
readonly reviewCapability?: ReviewCapability
```

写入方只能是 `ControlService`，值来自 D2 求值器；它随既有 durable decision 行
一起持久化/读取，受既有 append-only 与解析约束。**它不是新账本**：每个 decision
本来就有一条 durable 行，能力快照只是该行的加法字段。

### D4. PA 链只读同一快照

- `pa-control-bridge.ts` 的 `deciderAuthority()` 保留为**legacy fallback**；
  新路径是 `reviewAuthorityOf(decision)`：
  - 有 `reviewCapability` → 返回 `effectiveReviewAuthority`；
  - 无 → 维持旧的角色映射（旧行、旧 Team、未启用 Alpha.6）。
- `PresentedApproval.reviewerAuthority` 使用有效能力，不读 Principal 的 `role`。
- `PaEffectsVerifierInput` 新增可选 `reviewCapability`（或 `reviewerAuthority`），
  由 `ControlService` 在 resolve/guard 两门从对应 decision 行传入；verifier 先校验
  快照的 `approvalCaseId`、`authorityScope`、`authorityGeneration` 与 manifest 一致
  （leg 由 requestId/decision 行绑定），再交给 `verifyEffectSetApproval()`。
- `issueApprovedGrant()` 与 `guardOperation()` 使用同一有效能力；**不允许**桥接层、
  verifier、grant、guard 各自再解释一次角色。

### D5. 静态委托来自冻结 Blueprint，不建 per-case Mandate

- 普通案件的能力只由 `reviewRouting`（Officer 模板 + 例外）派生；**不为每个 Case
  写 Mandate/Assignment 账本**。
- 只有显式 Handoff/异常接管，才写一条最小 current-leg 事实（见 D6）。
- Blueprint 的 `reviewRouting` 属于加法版本边界（见执行计划 §2.1）；旧版本无该
  字段 = 无委托 = 旧行为。

### D6. Handoff 是唯一必要的新事实

Handoff 改变“谁处理当前 leg”，发生在 decision 之前，无法从 decision 行反推；因此
需要一条最小持久事实（建议 `review-handoff-recorded`）：

```ts
{
  rootSessionId, approvalCaseId, legOrdinal,
  from: ControlCallerRef, to: ControlCallerRef,
  reason?, createdAt
}
```

约束：只允许 Officer → Leader；只影响当前 leg；不改变 rung/请求身份/工具授权；
新 leg 重新按 Blueprint 求值；不抢回；不是 Escalation，不建通用 Assignment Ledger。

### D7. 失败关闭

能力缺失、快照与当前 case/scope/generation/Blueprint 不一致、verifier 无法读取
事实、grant/guard 无法配对 → 一律拒绝或 `authority-undetermined`，绝不降级为
allow，绝不静默回退到“member 也可以”。

## 3. 数据流

```
冻结 Blueprint (reviewRouting) ─┐
当前 Member/Instance (template) ─┼─> ReviewCapabilityEvaluator (pure)
ApprovalCase/leg (reviewAuthority)┘        │
当前 leg Handoff 事实（可选）──────────────┘
                                            │
                                            ▼
                              ReviewCapability { principal, case, leg,
                                                 scope, effectiveAuthority,
                                                 source, generation }
                                            │
                    ┌───────────────────────┴───────────────────────┐
                    ▼                                               ▼
        ControlService decision gate                     Durable ControlDecision
        (role closure → capability)                      (decider + reviewCapability)
                    │                                               │
                    └───────────────────────┬───────────────────────┘
                                            ▼
                          PA Presenter / Verifier / Grant / Guard
                          (same capability; no second interpretation)
```

- **写入点**：`ControlService.resolveControl` / `escalateApprovalLeg` /
  `appendTerminalOutcome` / 零审查关闭共用 `evaluateReviewCapability`；决议行写快照。
- **读取点**：`pa-control-bridge` presenter；`createPaEffectsVerifier` 两门；
  `issueApprovedGrant`；`guardOperation`。全部读同一 `reviewCapability`。
- **不写入点**：Router/Blueprint 解析器只决定“谁应处理”，不写授权事实；模型/客户端
  不得提供 capability。

## 4. 对既有不变量的修订

| 不变量 | 修订后 |
| --- | --- |
| **A6-AUTHORITY** | 保留既有**非委托**审批语义、权限层级、Hard Ceiling、工具执行约束、一次性 Grant/Guard/Consumption；**允许对 ReviewAuthority、Control、PA、Grant 的委托授权契约作统一扩展**。仍禁止：全局扩大 Member 角色、伪造 Leader 身份、改工具执行体系、跳过 Human/Leader 专属类 |
| **A6-LEDGER** | 不建 per-case Mandate/Assignment 账本；允许 decision 行携带 `reviewCapability` 快照；Handoff 仅一条最小 current-leg 事实 |
| **A6-BLUEPRINT** | 静态委托只来自冻结 Blueprint；路由仍不是授权裁决 |
| **A6-NATIVE / A6-INBOX / A6-LEGACY / A6-SCOPE** | 不变 |

## 5. 兼容与迁移

- 旧 decision 行无 `reviewCapability` → PA 链走 legacy `deciderAuthority`，行为
  逐字节不变。
- 旧 Team/旧 Blueprint 无 `reviewRouting` → 求值器返回“无委托”，Member 仍不可
  决 leader 级审批。
- 新 Team 的 vNext Blueprint 才启用；不迁移旧行、不改旧哈希。
- 紧急停用：运行时 kill switch 关闭后不再求值/写入新委托；已有 decision 行仍按
  其快照完成或由 Leader/Human 合法接管。

## 6. 扩展性（本轮不建通用引擎）

- 新审批者/新路由策略 = 新增一个 `ReviewCapabilitySource` 实现 + 路由选择器；
  消费者（Control/PA/Grant/Guard）不变。
- 不支持任意表达式、工作流、第二套授权账本、per-case 动态角色。
- 若未来需要多 Officer/负载均衡，仍只扩展“选择哪个 Principal”，不改变能力契约。

## 7. 后果

- **受保护中心变更**：`packages/runtime/control/**`、`operation-permission/pa-control-bridge.ts`、
  `tool-admission/approval-case.ts`（可能）、`governance/**`（新增纯模块）。每个
  Center-Interface PR 需 ARC-A override + 安全复审。
- **新增纯模块** `review-authority`，零 I/O，先于任何消费者落地并有完整拒绝矩阵。
- **测试**：真实 PA manifest 全链（leader 正例、member 无委托拒绝、委托通过、
  grant/guard 恰好一次、legacy 行不变、Handoff、staleness）。
- **不重复**三模式 PoC；已有证据只作为回归基线。

## 8. 实施切片（映射到执行计划）

| 切片 | 内容 | 中心 |
| --- | --- | --- |
| **A6-ADR** | 本文件 + 计划/设计正本修订 | 否 |
| **A6-PR2a** | 纯 `ReviewCapability` 求值器 + 拒绝矩阵 + 单测；零消费者 | 否 |
| **A6-PR2b** | Control 写快照 + PA presenter/verifier/grant/guard 读快照（一个契约 PR；legacy fallback） | 是 |
| **A6-PR2c** | Handoff current-leg 事实 + 生产事件接线 + 纵向测试 | 是 |
| **A6-PR5** | Officer 受限访问/工具面（复用 ControlService） | 视落点 |

## 9. 验收（ADR 层）

1. 单一求值器是唯一能力来源；grep 不出现第二处 Officer→Leader 硬编码。
2. 真实 PA 链：leader 正例、member 无委托拒绝、委托通过、grant/guard 恰好一次。
3. durable decider 始终是真实 Principal；无伪造 Leader 行。
4. legacy decision/旧 Team 行为逐字节不变。
5. Human/Leader 专属/治理/持久权限/自审均不可被委托覆盖。
6. Handoff 只影响当前 leg，不抢回。
7. 快照漂移（case/scope/generation/Blueprint）→ 拒绝，零消费。
