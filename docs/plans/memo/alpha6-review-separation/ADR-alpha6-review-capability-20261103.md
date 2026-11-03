# ADR-A6-1 — ReviewCapability：真实 Principal 身份与 Case-scoped 审批能力的分离

> **状态：ACCEPTED（2026-11-03 真实 UTC，用户裁决）。** 用户选择“先完成架构裁决
> 与 ADR，再修改 Control/PA 代码”，并明确授权对 Alpha.6 审批授权模型作必要、
> 系统性的架构调整。本 ADR 只定契约与数据流，**不修改任何生产代码**；实施由
> A6-PR1、A6-PR2a…2c + A6-PR5 按本契约推进。2026-11-03 复审收口：已补齐提交前/提交后时序、Blueprint 例外资格、独立参与者身份，以及 Handoff 与故障接管的非授权语义；不追加独立 PoC。
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

## 2. 决策：身份、路由归属、审批能力、持久凭据四者分离

### D1. 身份不变；有效审批能力可被受限委托

- **Principal** 是真实调用者；Officer 在所有 durable decision、事件及日志中仍是 `{kind:'instance', instanceId, role:'member'}`。不得伪造 Leader 身份，亦不修改原有 role rung 的含义。
- **ReviewRoutingDecision** 只给出当前 Case/leg 的应通知处理者，不是授权；Leader 原有合法的人工/监督决议权限不因普通案件默认投递 Officer 而自动消失。自动路由仍只把普通 Case 投 Officer；Leader 对普通 Case 的主动介入是**显式监督性介入**，按 native 权限记录，不视为 Handoff，也不要求 CurrentLegTransfer。
- **ReviewCapability** 是在当前 Case/leg/准确操作作用域内，真实 Principal 可行使的有效审批能力；可以源于原生身份或冻结 Blueprint 的静态委托。没有委托时 `mayReview(member, member, leader)` 的既有拒绝行为不变。
- **DecisionCapabilityEvidence** 是成功决议时原子记录的、可核验的授权依据，不是可脱离 Case 使用的 bearer token，也不是新的权限台阶。
- Human 专属要求、Team 调度/管理/权限治理、持久权限变更、Officer 自身 ask、显式 Leader 例外均不属于 Officer 可委托范围。Alpha.5 的 Member/Tool I/O 硬上界与现有一次性 Grant/Guard 始终单独生效。

### D2. 统一 Blueprint 资格判定与 ReviewCapability 求值

**唯一静态策略来源**：当前 Team 绑定、校验并冻结的 Blueprint `reviewRouting`。A6-PR1 必须提供一个共享的纯 `BlueprintReviewPolicy` 判定，其结果同时被 `BlueprintRoutingStrategy` 与 `ReviewCapabilityEvaluator` 消费。禁止两处独立实现 MemberTemplate × Tool 例外匹配；RoutingStrategy 只选择接收者，Evaluator 负责授权，两者可以共用判定但不得互相冒充权威。

用于委托决策的可信输入必须显式区分不同主体（以下是**概念类型，不是冻结的 TypeScript ABI**）：

~~~ts
interface ReviewAuthorizationContext {
  reviewer: ControlCallerRef;  // 真正提交审批决议的 Principal
  reviewerMember?: { rootSessionId: string; instanceId: string; templateId: string };
  requester: ControlCallerRef; // 创建请求的 Principal（可能是代发者）
  /** TeamDomain 在可信解析中给出的唯一未归档 Officer 实例；不是新账本/绑定。 */
  currentOfficer?: { instanceId: string; templateId: string };
  operationOwner?: {
    rootSessionId: string;
    instanceId: string;
    templateId: string;       // 来自可信 TeamDomain/成员绑定，不是模型自述
  };
  operationTool?: {
    definitionIdentity: string; // 复用 Alpha.5 受信工具身份
    owner: string; name: string; // 供 Blueprint Template × Tool 例外匹配
  };
  currentCase: {
    approvalCaseId: string;
    currentLegRequestId: string;
    legOrdinal: number;
    kind: string;
    reviewAuthority: ProposalAuthorityPosition;
    status: 'pending' | 'decided' | 'abandoned';
  };
  operationScope: ControlOperationScope;
  effectSetFingerprint?: string; // 有 PA manifest 时必须与当前作用域绑定
  blueprint: { revision: string; contentHash: string; reviewRouting?: ReviewRouting };
  currentLegTransfer?: CurrentLegTransfer; // 路由覆盖，不是能力来源
  authorityGeneration: number;             // 来自可信权限事实
}

type ReviewCapabilitySource = 'native' | 'blueprint-officer';

interface ReviewCapability {
  principal: ControlCallerRef;
  source: ReviewCapabilitySource;
  effectiveReviewAuthority: RuntimeAuthority;
  approvalCaseId: string;
  currentLegRequestId: string;
  legOrdinal: number;
  scope: ControlOperationScope;
  effectSetFingerprint?: string;
  blueprintContentHash: string;
  blueprintRevision: string;
  authorityGeneration: number;
}
~~~

**可信事实取得规则**：

1. Reviewer 的真实实例、Template、Session 来自运行时可信身份绑定；`operationOwner` 来自本次工具操作对应的可信 Member/PA manifest；`requester` 仅表明谁提交了请求。三者可能不同，不得以 requester、tool owner、label、自由文本摘要替代操作所属 Member 的 Template。Member 委托还要求 `currentOfficer` 存在、`reviewerMember.instanceId === currentOfficer.instanceId`、`reviewerMember.templateId === currentOfficer.templateId`；缺失或有多个同模板实例时 fail closed，而不是任选一个。
2. 普通工具委托**必须**可确认实际 `operationOwner.templateId × operationTool`；若此事实在旧式行中无法可靠建立，Officer 委托 fail closed，而 Leader/现有 Human 路径仍按旧规则工作。Blueprint 作者面的 `{owner,name}` 由 `BlueprintReviewPolicy` 映射到可信 `ToolBinding` 的 `providerId` / `toolName` / `definitionIdentity`；无法唯一映射时 fail closed，不能靠字符串猜测。
3. Blueprint 的 Leader 例外、固定 Leader 专属管理类别、Human-only 和 Officer 自身 ask 是**委托资格排除项**。路由投给 Leader 的这些案件不得同时被 Officer 授权；若默认 Officer 的 Case 已有效 Handoff/接管至 Leader，则原 Officer 也不得再签该 leg。
4. 同一 MemberTemplate 的所有实例初始规则一致；当前 Blueprint 不定义 Instance 级规则。额外的运行时路由修改是未来功能，不在本轮实现。
5. `reviewCapability` 不接收任何由模型或客户端传入的证明字段作为权威。

求值规则：

- Human/Leader：在既有合法角色与权限规则下使用 native role 能力；保留既有 Human rung、Envelope/Hard Ceiling 语义，不建立新的“全局委托”。
- Member：只有真实 Reviewer 是 `currentOfficer` 指向的唯一有效 Officer、当前 Case 的 current leg 确实 `pending` 且 `reviewAuthority='leader'`、操作属于合法常规工具 ask、共享 BlueprintReviewPolicy **将该实际操作归属 Officer**、未触发任何排除项、当前 leg 未转交 Leader、并且 scope/generation/身份全部匹配，才返回 `source='blueprint-officer', effectiveReviewAuthority='leader'`。
- 其他 Member/其他权限 rung/不明事实：拒绝，不通过默认值隐式扩权。
- `current-leg-handoff`、`unavailable-takeover` **不是 ReviewCapabilitySource**；它们只是路由覆盖及静态委托有效性的限制。

### D3. 正确的授权与 durable decision 时序（解决提交前/提交后循环）

**入口能力表（必须由 PR2b 实现，不留白）**：

| 入口 | Officer | Leader | Human |
| --- | --- | --- | --- |
| `resolveControl`（allow / deny） | 仅在其 Case-scoped 委托内允许；deny 同样记录真实 decider + evidence | 按 native 权限 | 仅 Human 可决的 kind；不被委托覆盖 |
| `escalateApprovalLeg` | **禁止**；Officer 需要的是 Handoff，不是权限升级 | 允许，按既有规则 | 仅其可决范畴 |
| `appendTerminalOutcome` / 零审查关闭 | **禁止**；不得由 Officer 新建关闭案件 | 允许，按既有规则 | 仅其可决范畴 |
| `abandonControlRequest` | 不作为审批决议；沿用 requester/Leader 的既有规则 | 同左 | 同左 |

> 这里的“允许”只表示入口资格；实际 allow 仍须通过 PA effect/ceiling/grant/guard，实际 deny 仍写既有终态语义。不得用一个 `ReviewCapability` 同时打开四个入口。

**resolve 阶段不存在“本次 decision 行”，不得要求 verifier 从它读取能力。** 正确顺序如下，全部在现有的受保护 ControlService 决议/Team 锁边界下完成；允许 verifier 读取必要的可信调用事实，但不得绕过该决议序列：

1. 读取当前权威 Case/current leg、冻结 Blueprint、真实身份、当前转交事实、权限代际与准确操作/PA manifest。候选与 PA verifier 必须共享同一个可信调用事实来源（同一 provider 或同一 generation tuple）；若分两次读取，必须显式比较 Blueprint hash、authorityGeneration、OperationOwner/Tool、EffectSet fingerprint，不一致即拒绝，禁止 split-brain。
2. 用 **D2 唯一求值器**计算本次可信 `ReviewCapability` 候选，检查 Actor 此时是否有资格决定当前 leg。按上面的入口能力表分别核定 `allow/deny/escalate/terminal-close`；**同一资格来源不意味着所有入口开放相同能力**。
3. 对 allow，在实际提交决议**之前**把此候选能力作为由 ControlService 生成的、非 durable 的可信输入传给已有 PA Effects Verifier；verifier 在当前 EffectSet/Authority Ceiling 下重新验证，不能从不存在的 decision 行读数据。候选类型必须是求值器产生的 nominal/opaque `ReviewCapabilityCandidate`；PA verifier 只接受该类型，不得接受 `{reviewerAuthority:'leader'}` 之类的裸字段或模型/客户端提供的证明。
4. 所有门禁通过后，把真实 `decider`、决议和规范化 `DecisionCapabilityEvidence` **在同一 durable decision 写入中原子记录**；不得先写 allow 再补能力，也不得存一个尚未验证的凭据。
5. 后续 PA Presenter、Grant/Guard 从该已持久化的 decision 及其凭据读取，按 D4 在本次真实调用上下文中重新验证后再作一次性授权与消费。
6. 如果 preflight 能力不可用/失配，拒绝本次**无资格的审批动作**，不得把该 Member 的未授权提交写成有效 allow。底层既有“合法 Reviewer 的 PA 漂移 → durable DENY”行为继续由原有 PA 法律执行；不任意改变既有终态语义。

**不得重复求值三套独立规则**：D2 计算候选、PA 验证其覆盖、D4 验证已持久记录依据的当前适用性，使用同一规范化策略判定和授权评估函数。仅区分时点，不重复定义“谁算 Officer”。

### D4. 决议能力证据与消费时再次验证

`ControlDecisionRecord` 增加**可选且加法式** `reviewCapability?: DecisionCapabilityEvidence`；仅 ControlService 可根据已通过 D3 的候选生成并与该决议一起提交。具体序列化字段由 PR2a/PR2b 审查固定，应至少绑定：

- 原始真实 `decider`；Team/Blueprint content hash（与当前绑定的快照匹配）；
- `approvalCaseId` + **currentLegRequestId** + `legOrdinal`；
- 实际 Operation Owner/Template 与可信 Tool Definition 身份；
- 本次操作 scope、必要时完整 PA EffectSet fingerprint；authorityGeneration；
- 能力来源 `native` / `blueprint-officer` 与有效审批权限 rung。

消费者应遵循下面的**一致性矩阵**，避免“不用快照”与“快照永远有效”两种错误：

| 阶段 | 输入 | 必须验证 | 不应重新判定 |
| --- | --- | --- | --- |
| Control 决议前 | 当前权威事实 + D2 的可信候选 | 当前 leg pending、真实 Reviewer、共享 Blueprint 资格、准确 scope、合法 rung/委托 | 还不存在的 decision |
| Control 持久提交 | 已验证候选 + 原决议 | 与 decision 同一 durable 写入、真实 decider 不改变 | 第二份 Mandate/Grant 行 |
| PA/Grant/Guard | 既有 decision + 记录的能力证据 + 当前可信调用事实 | 身份、Case/current leg、scope/EffectSet、Blueprint snapshot、authorityGeneration、现有 PA/External Hard/one-shot 规则；必要事实漂移则拒绝/不消费 | 无关的 Inbox pending、Officer Busy/Unavailable、单纯的通知归属变更 |

- 对**旧 Team 与旧决议**：字段缺席时使用现有 `deciderAuthority()` 映射，旧语义不变；但**新型 Officer 的有效委托绝不能因字段缺席而走 legacy fallback 获得 allow**。
- 对新的原生 Leader/Human 决议：可记录 native 凭据或保留与当前同等的 legacy 路径，具体由 PR2b 保证等价；不得要求旧行迁移。
- 已合法签署的 decision 的审计依据不会因为通知撤销、Officer 繁忙或 Coordinator 状态改变而失效；只有与原授权有关的身份/Case/leg/scope/Blueprint/权限代际或现有硬上界漂移才能阻止兑现。
- **CurrentLegTransfer 只影响未来签署，不追溯否定已持久 decision**：decision 之后发生的 Handoff/Unavailable Takeover 不使已签 evidence 失效，guard 仍按签署时的 case/leg/scope 验证；若 transfer 发生在 precommit 与 commit 之间，commit 必须在同一锁内重查并拒绝本次新决议。禁止用“当前路由归属”替换“签署时的能力证据”。
- 紧急 kill switch 停止**新的** Officer 委托决议；已合法 durable allow 是否被继续消费，沿用现有执行时权限法律与已记录依据，不能因为关闭通知队列而默默更改结果。若未来要求撤销既发委托，必须新增明确的授权撤销语义与代际，不在本轮偷加。
- `reviewCapability` 是证明一次已授权决议为何有效的**证据**，不是可被跨请求转移的凭据。对同 Case 的旧 leg、别的 Member 或不同 Tool 不得重用。

### D5. 静态委托来自冻结 Blueprint，不建每案 Mandate 账本

- **共享 `BlueprintReviewPolicy`** 由冻结 Blueprint 静态派生，供 Router 与 D2 求值器调用；固定 Leader 专属、Human rung、Officer-self-ask 和 MemberTemplate × Tool Leader 例外必须得到一致结论。权限层级仍以 ControlService/PA 为权威，而非路由器的通知决定。
- 普通 Case 不写新 ReviewMandate/Assignment 账本，能力从现有可信身份、Blueprint、Case 和当前权限事实导出；durable decision 行仅记录其经过验证的来源。
- 只有改变当前路由归属的 Handoff/Unavailable Takeover 才写一次最小 current-leg transfer fact（D6）；不从是否投递过通知推导授权状态。
- `reviewRouting` 采用加法式 Blueprint 版本并参与 content hash，历史 v3/v4 不更改语义与哈希；若 Alpha.5 同时扩展 schema，工程中协调唯一版本路线。

### D6. Handoff 与故障接管属于路由覆盖，不属于审批授权来源

当前 leg 的持久转交事实建议统一为：

~~~ts
type TransferActor =
  | { kind: 'instance'; instanceId: string; role: 'leader' | 'member' }
  | { kind: 'trusted-team-runtime'; runtimeId: string }; // 不是 ControlCallerRef，永不作 reviewer

interface CurrentLegTransfer {
  rootSessionId: string;
  approvalCaseId: string;
  currentLegRequestId: string;
  legOrdinal: number;
  target: 'leader';                 // 首版只有这一目标
  cause: 'officer-handoff' | 'officer-unavailable';
  actor: TransferActor;
  reasonCode: string;
  blueprintContentHash: string;    // 记录配置来源
}
~~~

- **Officer-Handoff**：Officer 判断该 leg 需要 Leader 全局信息，主动请求，核实当前 leg/Actor 后记录。
- **Unavailable-Takeover**：Officer 不可用且绑定的 Blueprint 已显式配置 `whenOfficerUnavailable: leader`，**由可信 Team Runtime 发起**，不要求已经不可用的 Officer 签发 Handoff。Unavailable 只来自可信 TeamDomain 生命周期事实（成员 archived / crashed / 未恢复）；Busy（active turn、pending backlog）不是 Unavailable，不触发此路径；`hold` 保留待办并报告异常。
- 两者均在可信 Team/Control 锁下验证当前 leg 仍待审、起始归属与目标合法，**同一 leg 的重复转交幂等**；只影响当前 leg，不能自动抢回；新 leg 重新按 Blueprint/有效权限计算。转交成功后新接收者需得到合并唤醒，旧接收者不能再以 Blueprint 委托签署此 leg。
- Handoff/接管不改变 `reviewAuthority` rung，不增加任何 Principal 的 native role 能力，也不是 `escalateApprovalLeg`；Leader 按其已有原生合法权限审批。其唯一持久记录用于当前 leg 的路由覆盖与禁止旧 Officer 重签。
- 这可采用一个最小 TeamDomain/Control 事实，不要求通用 Assignment Ledger、定时工作流或二次授权事务。

### D7. 失败关闭与向后兼容

- 无可信 `operationOwner`/Tool/Reviewer Template、Blueprint 例外无法判定、当前 Case/leg 失配、权限代际漂移、PA effect/scope 失配、Handoff 已改变归属 → 对 Member 委托拒绝，零未经授权的 allow/grant/consumption。
- 对 native Leader/Human 的旧非委托路径，保留既有 `mayReview`、硬上界、逐 EffectSet 检查与 decision 写入顺序；不把“需要委托证据”强加给过去的旧数据。
- 不增全局 Member role 权限、不伪造 Leader、Human-only 不下放；不接受任何模型声称的 `reviewCapability` 当授权事实。
- 若委托模式无法对当前合法 Team 启用，保留待办并按 Blueprint `hold/leader` 策略或明确不可路由行为处理，不能因为不能投递而默认批准。

## 3. 跨层数据流与所有权

~~~text
Frozen Blueprint ──> BlueprintReviewPolicy (pure; ONE authoring matcher)
                               │
          ┌────────────────────┴────────────────────┐
          ▼                                         ▼
  ReviewRouter (recipient)           ReviewCapabilityEvaluator (authorization)
          │                                         ▲
          │                 trusted Case/leg,       │
          │                 actors, tool/scope,     │
          │                 generation, transfer ───┘
          │                                         │
          ▼                                         ▼
  ReviewWakeCoordinator             ControlService decision-in-lock
  (activation/poll/latch)            PRECOMMIT capability candidate
          │                                         │
          ▼                                         ▼
  DSH native Inbox               PA precommit verifier (candidate, not decision)
                                                    │
                                                    ▼
                                   Atomic ControlDecision(decider + evidence)
                                                    │
                                                    ▼
                                   PA Presenter / Grant / Guard
                                   (persisted evidence + fresh authority recheck)
~~~

- **写入权威**：ControlService 仍是唯一的审批决议持久写入口。Router、Coordinator、模型不写授权事实；只有 CurrentLegTransfer 是独立的**非授权路由事实**。
- **序列化边界**：`ReviewCapability` 候选是可信内部值，`DecisionCapabilityEvidence` 是 append-only decision 中的数据；格式一致由规范化评估器和受信验证函数确保。不得把已记录 evidence 直接解释为无条件允许执行的 token。
- **程序责任**：A6-PR1 拥有共享静态 BlueprintReviewPolicy；A6-PR2a 拥有统一 ReviewCapabilityEvaluator；A6-PR2b 接受两者并连接提交前、持久化和 PA 执行后的消费者；A6-PR2c 仅实现 current-leg transfer 事实与事件，A6-PR3/PR4 负责通知/Host Inbox，A6-PR5 负责受限 Officer 工具面。

## 4. 对本轮工程不变量的修订

| 不变量 | 本 ADR 的实际边界 |
| --- | --- |
| **A6-AUTHORITY** | 保留既有非委托审批语义、rung、Hard Ceiling、工具执行约束、一次性 Grant/Guard/Consumption；**允许在审批授权计算、Control/PA/Grant 中统一支持 Case-scoped ReviewCapability**。不允许全局扩大 Member role、伪造 Leader 身份或下放 Human / Leader 专属治理 |
| **A6-LEDGER** | 普通 Case 不建 Mandate/Assignment；准许已存在的 durable decision 加入最小可验证的能力证据；Handoff/不可用接管仅新增一种 current-leg 路由覆盖事实 |
| **A6-BLUEPRINT** | 唯一静态委托与自动路由来源是冻结 Blueprint；允许当前 leg transfer 作为当前事实输入，不建立第二套作者配置 |
| **A6-NATIVE / A6-INBOX / A6-LEGACY / A6-SCOPE** | 保持原禁区与信任假设，不新增执行器/OS Sandbox/Core patch/复杂 Scheduler |

## 5. 兼容、启停与后续扩展

- 旧 Blueprint（不含 `reviewRouting`）、旧 Team、旧 decision 行缺少能力证据时，维持既有原生审批和权限行为。新 Officer 决议必须有可验证委托证据，缺席不能按旧 Member 角色获批。
- `reviewRouting` 是 Blueprint 新版本的加法配置；任何运行时紧急停用开关只影响**新**路由/新委托，不能变更冻结 Blueprint 的历史审计依据。发布与回滚仍需保证存量 pending Case 有合法 Leader/Human 接管。
- 将来新增不同 Officer/路由策略时，可扩展共享 BlueprintReviewPolicy 与委托来源，但必须继续提供一个统一的 CapabilityVerifier。**不得把 Router 的目标直接当成授权**。
- 不预先建设授权撤销服务、通用工作流、多 Officer 集群调度器、独立 Mandate Store 或额外可靠 Timer。出现必要性必须由真实实现缺口证明。

## 6. PR 切分与验收要点

| PR | 必须交付的闭环 | 非目标 |
| --- | --- | --- |
| **A6-PR1** | 冻结 Blueprint 加法 grammar + 唯一共享 BlueprintReviewPolicy，Router/委托使用同一 Matcher | 实例级作者规则、路由 subagent、第二份配置系统 |
| **A6-PR2a** | 基于 PR1 的统一 CapabilityEvaluator 与测试，特别覆盖 Leader 例外、自审、不同主体、Handoff | 并行重写另一份 Blueprint matcher |
| **A6-PR2b** | Control precommit 候选 → PA precommit 验证 → durable 同行证据 → PA/Grant/Guard 可信重验，真实 strict PA manifest 正/负控 | 仅凭 role gate 的简单 Control PoC 宣称功能完成 |
| **A6-PR2c** | Officer Handoff / 可信 Runtime Unavailable Takeover，共用最小 current-leg fact、原 Officer 失权与 Leader Wake | 通用 assignment 账本、计时策略或动态路由 |
| **A6-PR5** | Officer 的合法待办读取与提交审批，不获取全 Team 管理权限 | 第二种审批写入机制 |

**主要测试必须覆盖**：precommit 不读取不存在的 decision；Officer 对 Blueprint Leader 例外不得审批；Reviewer/Requester/OperationOwner 互不混淆；接管由 Runtime 发起；持久快照不能跨 Case/leg/tool/Member 重用；非委托旧行不变；合法委托的 PA grant 只 mint/consume 一次；运行中 Handoff 对已提交决议的处理不误依赖通知状态。

**状态**：此 ADR 是 2026-11-03 实施前设计澄清，未执行新 PoC、未修改生产代码；后续真实服务/Host 行为仍须在 PR2b/PR4/PR6/PR7 的既定实施验收中确认。
