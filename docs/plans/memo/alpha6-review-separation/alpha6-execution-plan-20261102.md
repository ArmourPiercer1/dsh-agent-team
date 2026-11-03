# Alpha.6 修正版执行计划：Blueprint-first ReviewRouter + 轻量唤醒

> **状态：CONDITIONAL PLAN / DESIGN-ONLY（2026-11-02 复审后修订）。** 本计划
> 细化 PR #536 的设计裁决，不授予实现、启用或合并权限；不改变 Alpha.5 的
> 当前权威。**复审判定：方向保留，原七切片顺序不直接开工；四个 P0 必须先
> 闭合。**
>
> **设计正本**：[`alpha6-blueprint-router-wake-rebase-20261103.md`](./alpha6-blueprint-router-wake-rebase-20261103.md)
> （PR #536 head `659f617b7`；该文件日期是既有的会话日历标签，本计划的新锚点
> 一律取书写时的 `date -u`）。
>
> **PoC 证据**：[`alpha6-rebase-poc-20261102/`](../../../../dev/agent-workflow/evidence/alpha6-rebase-poc-20261102/README.md)。
> 复审后的重定级见 §1。

## 0. 目标、边界与不变量继承

**G1 职责分离**：专职 Officer 处理日常工具 `ask`；Leader 保留 Team 调度/
治理/持久权限变更/蓝图例外；Human 永不下放。
**G2 重复消息修复**：已 resolve 不再产生新无效通知；同一接收者同一时间
最多一个在途 Review Wake，事件合并，收到唤醒后重读权威待办。

按 **ADR-A6-1 §4 修订后**的边界完整继承 PR #536 的 **A6-NATIVE / A6-AUTHORITY / A6-BLUEPRINT /
A6-LEDGER / A6-INBOX / A6-LEGACY / A6-SCOPE**。旧版的窄义“不得调整审批法”不再约束统一委托契约。每个 PR 描述必须逐条回答
“触碰了哪条、为什么最小接缝足够”。

**非目标**：通用动态路由/调度系统、路由 LLM/subagent、Jev、自动风险评分、
定时 defer、多 Officer 负载均衡、实例级持久路由编辑器、工具执行体系或基础
权限体系改造、恶意插件/提示词注入专项防御。

## 1. 复审后的 PoC 定级（取代首轮自评）

| PoC | 复审定级 | 依据 / 计划后果 |
| --- | --- | --- |
| **P-AUTH** | **简单 Control 决议接缝 PASS；完整 PA 工具审批链 FAIL（base law）；委托原型 PASS；生产契约已由 ADR-A6-1 裁决（未实施）** | 真实 PA manifest + 真实 verifier 下，Officer（member）在 `resolve` 就被判 `pa-authority-drift`；`mayReview(member, member, leader)` 恒假，`deciderAuthority()` 把 member 固定解释为 `member`，`verifyEffectSetApproval()` / `issueApprovedGrant()` / guard 是同一结论。**2026-11-03 用户裁决 ADR 先行并授权统一 ReviewCapability；实施从 PR2a 开始，不再重复 PoC。** |
| **P-BP** | **原型层 PASS（12/12）** | Template × Tool 确定、同模板一致、instance 选择器拒绝、哈希必须移动。复审新增两项已落：Officer 必须是 MemberTemplate；**Officer 自己的 ask 默认 Leader**（防自等待）。生产 schema 仍需与 Alpha.5 协调。 |
| **P-INBOX** | **公开接缝 PASS；模型 PASS（11/11，已修复三处 P0）；Host ENV_BLOCK** | 旧模型把“未变化”误当“无待办”，会撤销唯一有效 wake；`recover()` 无条件重投；投递失败会永久卡 `queued`。已拆分 `pending`/`changed`，恢复前查询持久 wake，失败释放队列。Host 三请求/claim/崩溃/Stop 仍未跑。 |

**不再为三项分别组织开放式架构 PoC。** P-AUTH 完整 PA 链已完成并被复审确认；
2026-11-03 ADR 接受后，实施从 PR2a（纯求值器）开始，已有三模式实验作为回归基线。

## 2. schema、身份、委托与通知的最小方案

### 2.1 Blueprint 加法版本边界（版本号与 Alpha.5 协调，不预占 v5）

- 必须走**新版本边界**：旧 v3/v4 文档不获得 `reviewRouting`，解析与哈希
  零移动；family 进入新版本的哈希投影，禁止 metadata/sidecar 旁路。
- **版本号不预先钉死为 5**：Alpha.5 的最终实施也可能需要最小 Blueprint
  扩展；由工程在 PR1 评审时与 Alpha.5 当前实施协调后确定，避免两条开发线
  各自定义不同的 v5。原则（加法、旧版零移动、family 进哈希）不变。
- 作者面保持：仅 Template × 可信 Tool 坐标、无 instanceId/label 选择器、
  默认 Officer、`whenOfficerUnavailable ∈ {hold, leader}`、无隐式默认。
- **Officer 必须是 MemberTemplate**：Leader 模板是合法蓝图模板但不是合法
  Officer；引用 Leader 作为 Officer 直接拒绝（`officer-not-member`）。

### 2.2 一个 Team 唯一 Officer：区分“配置非法”与“临时不可用”

- Team 创建/启用时恰好创建一个 `officerTemplateId` 对应的 MemberInstance；
  admission 拒绝第二个同模板实例。运行时按“当前未归档的唯一同模板实例”
  解析，不新增 binding ledger。
- **求值器也必须消费这个解析结果**：`currentOfficer` 缺失、实例 ID 不匹配
  或出现多个同模板实例时，Member 委托 fail closed；不能只看 Template 就放行。
- **配置非法**（模板缺失、引用 Leader、重复声明、路由字段越界）：拒绝启用/
  拒绝创建，typed error，不静默回退 Leader。
- **合法 Officer 临时不可用**：仅 `TeamDomain lifecycle ∈ {ARCHIVED, DISPOSED}` 或 member row 缺失；不是 Team 启动失败。按 Blueprint 的 `hold`（默认）或 `leader`（显式）处理；`ARCHIVED` 可恢复，`DISPOSED` 不可恢复；恢复后不得抢回已转交 leg。
- **crash / “未恢复” / 无 live agent / Busy（active turn、pending backlog）**：一律按 degraded/Busy 处理，默认 `hold`，**不自动触发 Leader 接管**。若未来要支持 crash 接管，必须先有具名 durable exit fact 并另立决策，不能把“进程不在了”当作生命周期事实。
- 不存在“先建团队、后补 Officer”的隐式成功路径；补建必须是一次显式的
  enable 操作并重新校验。

### 2.3 通知身份（按 DSH 公开事实修正）

`agent.followup()` 返回 `void`。因此：

1. 先用 `createUserMessage()` 构造消息，保存其 `message.id`；
2. 把同一条消息交给 `agent.followup()`；
3. 后续 `remove`/`replace` 用保存的 id，不依赖 `followup()` 返回值；
4. 去重键是“接收者 + 逻辑 wake 代际 + 该 id”，不是
   `source.kind=plugin:dsh-agent-team`。

PR4 必须在真实 Host 适配上验证 claim 后不可撤回、未 claim 可撤。

### 2.4 ReviewCapability：统一资格、提交前验证、原子记录、提交后重验

[ADR-A6-1](./ADR-alpha6-review-capability-20261103.md) 的 2026-11-03 收口版本是唯一契约正本，不再采用先前的“resolve 从尚未存在的 decision 行读能力”的循环设计。本节把它映射到实施所有权：

1. **PR1 交付唯一的共享 `BlueprintReviewPolicy`**：固定 Leader/Human 类别、Officer self-ask、MemberTemplate × 可信 Tool 的 Leader 例外、默认 Officer；Router 和 PR2a 的委托求值器共同消费。显式 Leader 例外**既禁止通知 Officer，也禁止 Officer 在该 Case 取得有效委托审批权**。
2. **可信独立身份与闭集**：PR2a 的输入分别表示 Reviewer/Decider、Requester、OperationOwner（持有实际调用的 MemberTemplate）、工具定义身份。路由与授权不能误用请求代发者、Officer 本人的 Template、工具 owner 或自由文本摘要代替 OperationOwner。Member 委托只对 **closed ordinary tool ask** 生效：`kind='leader-approval'`、无 `requestedEffect`/`mutationProposalFingerprint`、`operationTool` 可确认、所有 per-effect `requiredAuthority ≤ leader`，且非固定 Leader/Human 类别；`user-approval` 与 `envelope-mutation` 永不委托。该判断由 PR1 唯一的 `isDelegableOrdinaryToolAsk()` 实现（属于共享 `BlueprintReviewPolicy`），PR2a 求值器与 Router 共用；事实不全即 fail closed。
3. **提交前**：ControlService 在现有 Team 锁内读取当前 Case/leg、冻结 Blueprint、operation/effect/authorityGeneration、唯一 `currentOfficer` 和 current-leg transfer；使用 PR2a 单一求值器产生**不可伪造的 nominal 候选**。候选与 PA Verifier 必须共享同一可信事实来源：PR2a 定义唯一只读 `ReviewCallFactsProvider` 端口，ControlService、求值器与 PA Verifier 都从该端口取 `PaCallFacts`；若实现仍分两次读取，必须比较 Blueprint hash、authorityGeneration、OperationOwner/Tool、EffectSet fingerprint，不一致即拒绝。不得让 Router、求值器、verifier 各自复制一份事实读取。此时**没有新的 durable decision**，严禁从不存在的行取能力，也严禁 verifier 接受裸 `reviewerAuthority` 字段。
4. **提交时**：确认本次审批及 PA allow 合法后，真实 `decider` + decision + 规范化 DecisionCapabilityEvidence **同一 durable decision 写入**。旧行仍然没有新字段，保持 native 旧语义；不能先写 allow 后补证据。入口能力按 ADR D3 表执行：`resolveControl` 的 allow/deny 可在委托内；Officer 在合法委托下可直接 Escalate 至 Human，但不能批准 Human leg；`appendTerminalOutcome` / 零审查关闭仍不得由 Officer 执行。**Escalation 的授权落点**：`escalateApprovalLeg` 现有 role gate 仍用 `CONTROL_RESOLVER_ROLES`，member 被排除；PR2b 必须在 role gate 前用同一 evaluator 的 `entry='escalate'` 候选放行，禁止把 member 加入全局 resolver 表；terminal escalate deny 携带 `entry=escalate` 证据，不 mint/consume Grant。
5. **提交后**：Presenter/PA/Grant/Guard 读取已持久决议的证据以及本次可信调用事实并进行统一重验：Case/leg、操作 Owner/Tool、scope、EffectSet、Blueprint 内容哈希、authorityGeneration 与既有 Hard Ceiling/one-shot 规则；不得把证据当作跨 Case 可转移 token。纯路由/Inbox、Officer Busy/Unavailable 不改变已签署合法决议的效力。**证据解析必须 fail closed 且不丢行**：PR2b 为 `reviewCapability` 增加独立子解析；证据损坏时保留 `ControlDecisionRecord`、将 evidence 视为 omitted，让 PA/Grant/Guard 返回明确的 `authority-undetermined` 类失败，不得让整条 decision 消失、不得重开审批、不得写第二份决议；`parseDecisionPayload`/`toDecisionRecord` 同步更新并覆盖 malformed/unknown/legacy 三组 round-trip。
6. **Handoff 不提供审批能力**：`ReviewCapabilitySource` 仅 native/blueprint-officer；显式 Handoff 与可信 Runtime 发起的不可用接管共用一个最小 `CurrentLegTransfer` 路由事实，后者必须由 Blueprint `whenOfficerUnavailable:leader` 明确允许；Busy 不触发；Unavailable 仅来自 `ARCHIVED`/`DISPOSED`/member row 缺失，crash/未恢复按 Busy/degraded 处理。`CurrentLegTransfer` 的写入必须复用 ControlService 同一 `withTeamLock(teamLocks,…)` 链或受控端口，不能由另一服务/TeamDomain 事务直接写。TransferActor 是独立类型（instance 或 trusted-team-runtime），不是 `ControlCallerRef`、永不作为 reviewer。Leader 以原生能力决定；已转交同一 leg 的 Officer 不再有**未来**签署资格，但不追溯否定已持久 decision。
7. **校验时点分别负责不同问题，但不重复实现规则**：PR1 规则只实现一次；PR2a 提供统一候选/证据验证函数；PR2b 在提交前/后使用同一授权合同。原有合法 Reviewer 因 PA 漂移产生 durable DENY 的语义保持，不得把无资格成员提交的请求伪装成授权拒绝后关闭整个案件。

**本轮不重复三模式 PoC。** PR2b 直接进行真实 strict PA manifest 全链回归和上述负控。需要改 Control/PA/Grant 接口时允许在同一连贯 Center-Interface PR 修改必要的受保护文件，不另做权限引擎或 Mandate 账本。

### 2.4a 转交事实写入与消费的责任边界

`CurrentLegTransfer` 至少绑定 Team、Case、currentLegRequestId、legOrdinal、target=Leader、cause（`officer-handoff | officer-unavailable`）及可信 Actor/Blueprint 来源。在当前 leg 仍 `pending` 时原子追加或幂等返回；新 leg 重新计算。PR2c 拥有事实写入、旧 Officer 失去该 leg 的**未来**委托资格、Leader 唤醒触发，PR5 只提供 Officer 交接操作工具面；绝不另造完整 Assignment 状态机。写入必须复用 ControlService 同一 `withTeamLock(teamLocks,…)` 链（或 ControlService 暴露的同一 per-team lock 端口），PR2c 不得在另一 service/TeamDomain 事务里直接写 transfer。若 transfer 在 precommit 与 commit 之间发生，commit 同锁重查并拒绝；decision 之后的 transfer 不使已签 evidence 失效。

### 2.4b PA 工具原调用与多 leg Escalation（方案 A，ADR D6a/D6b）

- **已批准行为**：Leader 可主动代决普通 Officer 路由案件，但不因此收到常规自动 Wake；Officer 可从其合法受托的当前 leader leg 直接升到 Human successor，不经 Leader Handoff，也绝不能自行批准升后的 Human leg。
- **现行桥接缺口**：PA Bridge 的 requestControl/awaitControlDecision(initialRequestId) 不是完整的 Control ApprovalCase 升级通道。实现必须将 PA 逻辑 ID 与服务端派生 Control Case ID 可信关联，**改用 `requestApprovalLeg`（或同一合法 Case/leg 创建路径）创建首 leg**，不得 legacy `requestControl` 后再补 leg；并在 successor 上保持原始 EffectSet、ToolBinding、operation fingerprint、scope、authority generation 与完整严格 PA manifest 的可验证来源。
- **身份关联（禁止第二账本）**：Control 既有 request/leg 行加 `paApprovalCaseId?: string`（值=`plan.approvalCaseId`，PA adapter 写入）；PA 既有 approval-case/bridge 记录加**可选加法式** `controlApprovalCaseId?: string`（Control leg 创建后回写；若落在 `PaControlManifest`，用加法版本且旧字段/摘要不变，缺失按 legacy 解释）。两侧一一对应、可读回；缺失/冲突 fail closed；不得新建 mapping table/association ledger，若确需新表先停。
- **Case-aware wait**：中间 leg 的 deny/escalated 表示转入下一审核位置，**不等于工具最终拒绝**。等待最终合法 Case 结果，Human allow 时使用最终批准 leg 的 requestId 与 decisionSequence 完成一次性 Grant/Guard；不能以 initialRequestId 作为最终身份继续校验。复用既有 durable polling/AbortSignal，不新增 timer/调度器/执行引擎。
- **严格 manifest**：successor 必须保留原始 `reviewPayload`/`reviewPayloadDigest`（具体字段由 PR2b 类型审查固定）；digest 漂移即拒绝，不能只复制一个不可核验的摘要。
- **调用存活性**：原工具调用保持待决；只有在 Human allow 且调用仍存活、未 Stop/Abort/超时、执行前全部硬上界与权限检查通过时才继续。否则不执行、不自动重新发起调用。重启可恢复审批历史，不自动恢复已消失的执行上下文。
- **施工边界**：上述属于 PR2b 的 Control/PA 审批接缝重构，不改 DSH 原生 ToolDefinition、原生工具执行器或 Alpha.5 OS/I/O 沙箱。PR2c 负责 Escalation 后 Human current-leg 的可见性**事件**，PR4/PR7 负责实际 Human 通知；PR5 负责 Officer 合法升级工具面，PR7 验证真实 Host 全链。
- **现有事实**：旧 PA 逻辑 ID 与 Control Case 身份域不同；升级前后的可验证清单和最终 Grant 绑定均须有服务层测试证明。不要仅以“escalateApprovalLeg 返回成功”作为验收通过。

### 2.5 Officer 自身 ask 的路由

固定规则：**实际 OperationOwner 的 templateId == `officerTemplateId` 时，普通工具 ask
默认交 Leader，绝不交回 Officer。** 理由：当前 Officer turn 等待审批，审批
又需要下一个 Officer turn，形成正常运行的依赖环；同层自审本身也不合法。
这是一条职责隔离规则，不是通用死锁检测器。Blueprint 的 Leader 例外仍然
有效；优先级见设计正本 §3。

## 3. PR 切分、所有权与依赖

> 纪律：1 PR = 1 branch = 1 worktree = 1 writer；一个 Center-Interface PR
> 只落地**一个连贯契约**并列出全部受保护文件，禁止并行写者；每个 PR 独立可
> 回滚。Dormant PR 必须有 lane-hygiene 证明与零新权威写路径声明。

| PR | 内容 | 主要路径 | 受保护中心 | 依赖 | 完成判据 |
| --- | --- | --- | --- | --- | --- |
| **A6-PR1** | 加法版本 grammar + **唯一共享 `BlueprintReviewPolicy`**（含 `isDelegableOrdinaryToolAsk()`）+ `BlueprintRoutingStrategy` 纯解析器 | `packages/domain/blueprint/**`、`packages/domain/test/**`、`packages/runtime/review-router/**`（纯） | 否 | 无 | 旧版哈希零移动；新版解析/拒绝矩阵；同模板一致、例外/默认；**Officer 必须是 MemberTemplate**；**Officer 自问 → Leader**；instance 选择器拒绝；`user-approval`/`envelope-mutation`/非普通 ask 不委托；零消费者 |
| **A6-ADR** | ReviewCapability 契约、身份/能力分离、数据流、修订后的不变量 | 本目录 ADR | 否 | 用户已裁决 | 本 ADR 接受；计划/设计正本同步；零生产代码 |
| **A6-PR2a** | **消费 PR1 共享 BlueprintReviewPolicy / `isDelegableOrdinaryToolAsk()`** 的纯 `ReviewCapability` 求值器 + 独立身份/完整拒绝矩阵；零消费者 | `packages/runtime/review-authority/**`（纯） | 否 | **ADR + PR1** | 单一能力来源；Leader 例外禁止 Officer 委托；`user-approval`/`envelope-mutation`/非普通 ask 不委托；Reviewer/Requester/OperationOwner 不混淆；handoff 撤销该 leg 委托；无 I/O |
| **A6-PR2b** | **统一委托契约和多 leg 连续性**：precommit 能力核验、原子决议证据、证据 fail-closed 解析；PA→Control durable Case/leg/双向身份字段、升级后严格 manifest、Case-aware waiter、最终 leg Grant/Guard 配对（legacy fallback）；Officer escalation 的 case-scoped 授权落点 | `packages/runtime/control/{types,service}.ts`、`operation-permission/pa-control-bridge.ts`、`tool-admission/approval-case.ts`（必要处）、`governance/authority-ceiling.ts`（必要处）、ARC-A override | **是**（Center-Interface，多文件同一契约） | PR2a | 真实 PA manifest 全链：**precommit 不读尚不存在的 decision**；`ReviewCallFactsProvider` 单一事实源；leader 正例、member 无委托/Leader 例外拒绝、委托通过、grant/guard 恰好一次；durable decider 仍 member；旧行逐字节不变；`isDelegableOrdinaryToolAsk()` 闭集；证据损坏不丢 decision 且 fail closed；入口按 ADR D3：Officer 可对合法当前 leader leg 升级但不能批准 Human successor，也不能 terminal-close；**不得把 member 加入 `CONTROL_RESOLVER_ROLES`**；原调用继续等待最终有效 leg |
| **A6-PR2c** | Officer Handoff / 可信 Runtime Unavailable Takeover / Escalation 后 Human successor 可见性事件：共用 current-leg transfer 事实 + 生产事件 + 纵向测试 | `packages/runtime/control/**`（中心） | **是** | PR2b | Officer 主动 Handoff 或 Runtime 在 `ARCHIVED`/`DISPOSED`/member row 缺失时按 Blueprint 显式 leader 策略发起接管 → 校验当前 case/leg → 共用幂等 transfer 事实 → 原 Officer 失去**未来**签署资格 → Leader 合并 wake；Busy/crash/未恢复不触发；不抢回；decision 后 transfer 不追溯否定已签 allow；Escalation 后发出 Human current-leg 可见性事件，由 PR4/PR7 完成实际 Human 通知；不建通用 Assignment Ledger |
| **A6-PR3** | 纯 `ReviewWakeCoordinator`：activation/poll/latch、generation、no-progress 守卫 | `packages/runtime/review-wake/**`（纯） | 否 | 无（可与 PR1 并行） | 3 请求→≤1 wake；running 只 dirty；resolved/无进展不 re-wake；**pending-unchanged 不 cancel**；**恢复前查持久 wake，不重复**；**投递失败释放 queued**；零 I/O、零 timer |
| **A6-PR4** | 投递接缝：通用 Review Wake 入 DSH Inbox；旧 Leader notifier 互斥替换 | `packages/runtime/control/leader-notification.ts`、`live/agent-bindings.mjs` | **是**（一次一个文件） | PR3 | 在可控 Host 适配环境实际投递一条 wake；`createUserMessage().id` 可 remove/replace；claim 后不可撤；未启用 Team 逐字节旧行为 |
| **A6-PR5** | Officer 受限访问 + Handoff/直接 Escalate 工具面：读自己应审待办、执行当前合法 leg 决议/转交/升级 | `packages/tools/**`、访问适配器、契约 | 视落点 | PR2c | Officer 不能读全 Team 管理面；决议、Handoff、合法升级均复用 ControlService；不能批准 Human successor；负控完整 |
| **A6-PR6** | 生产接线与 opt-in：唯一 Officer admission、蓝图绑定、旧 notifier 切换、观测 | `packages/runtime/root*`、plugin 组装、GUI 邻接 | 可能 | PR1/2b/2c/4/5 | **第一条真实消费纵切在此闭合**（含 Handoff 与通知出口）；创建/启用时唯一 Officer，第二个同模板实例被 admission 拒绝；未启用 Team 零变化；指标可读 |
| **A6-PR7** | 组合回归、故障/压力、性能指标与发布验收 | 测试套件/证据，不改生产语义 | 否 | PR6 | 最终行为矩阵回归；**不再承担第一次生产接线**；Host 核心行为必须通过，ENV_BLOCK 只能出现在设计/模块阶段 |

**阶段验收前移（复审 P1）**：

| 里程碑 | 必须证明 |
| --- | --- |
| PR1 / PR3 | 纯函数正确性；误取消/恢复重复/投递失败三处 P0 已修 |
| PR1 + PR2a + PR2b | 共享资格规则、precommit PA 候选、原子 decision/evidence；真实工具 ask → Control Case/leg → Officer 升级 → Human 最终决议 → 活跃原调用的 Grant/Guard 完整服务链 |
| PR4 | 可控 Host 适配环境真实投递一条 wake，验证 claim/去重/取消 |
| PR2c / PR5 / PR6 | Officer 受限读取、合法 Escalation、Handoff、Human successor 可见性与通知出口的纵向闭环 |
| PR7 | 只做组合回归、压力/故障、性能指标与发布验收 |

**并行 lane**：Lane D（PR1）、Lane W（PR3）可并行；Lane C（**PR1 + ADR → PR2a → PR2b → PR2c → PR5**）串行；Integration（PR4→PR6→PR7）串行，不与中心 PR 并行改同一文件。

## 4. 验收矩阵（复审修订）

| # | 可观察要求 | Owner | 层级 |
| --- | --- | --- | --- |
| 1 | 三条普通 **非 Officer** Member 常规 ask → Officer ≤1 在途 Wake；Leader 常规审批唤醒 0 | PR3/PR4/PR7 | 单元 + Host |
| 2 | 三件首轮完成或投递前 resolve → 不因旧通知额外启动模型 | PR3/PR7 | 单元 + Host |
| 3 | Officer 执行中 B/C 到达 → 只标 dirty，结束后重读，不逐条 followup | PR3/PR7 | 单元 + Host |
| 4 | 模板 A 指定 Leader、模板 B 未指定 → A→Leader、B→Officer；同模板实例初始一致 | PR1/PR7 | 单元 + Host |
| 5 | 调度/治理/持久权限变更 → Leader；Human-only → Human，不被 Officer 接管 | PR2b/PR6/PR7 | 单元 + Host |
| 6 | Officer 主动 handoff → 当前 leg 归 Leader；合并唤醒；不抢回 | PR2c/PR5/PR7 | 单元 + Host |
| 7 | Busy/crash/未恢复保持排队；`ARCHIVED`/`DISPOSED` 分别验证 hold / leader，且普通 ask 绝不投给不可用 Officer | PR1/PR3/PR6/PR7 | 单元 + Host |
| 8 | 插件审批通知与工作完成通知共存 → 不互相覆盖/不误去重 | PR4/PR7 | Host |
| 9 | claim 后崩溃、恢复、用户 Stop → 可恢复权威未决；无重复 allow；Stop 不被复活 | PR3/PR7 | Host |
| 10 | 未启用 Alpha.6 的 Team → 旧 notifier/角色/权限/审批行为不变 | PR4/PR6/PR7 | 单元 + Host |
| 11 | 路由不改变 allow/deny；Officer 决议后 guard 独立验证 | PR1/PR2b/PR7 | 单元 + Host |
| 12 | 指标：Leader/Officer 模型请求数、token、通知数、审批可达性、等待时间 | PR7 | Host |
| **13** | **Officer 自己的普通 ask → Leader，不产生等待自身下一轮审批的死锁** | **PR1/PR7** | **单元 + Host** |
| **14** | **完整 PA 链：leader 正例；member 无委托被拒；ReviewCapability 委托下 grant mint + guard 恰好一次** | **PR2a/PR2b** | **真实服务对象** |
| **15** | **Officer Handoff 和 Runtime Unavailable Takeover 共用 current-leg transfer 事实，原 Officer 失去当前 leg 委托，Leader 合并唤醒** | **PR2c/PR7** | **单元 + Host** |
| **16** | **Latch：pending-unchanged 不 cancel；恢复不重复已有 wake；投递失败释放 queued** | **PR3** | **单元** |
| **17** | **Blueprint Leader 例外同时阻断 Officer 路由和委托签署；Reviewer/Requester/OperationOwner 三种主体可信区分** | **PR1/PR2a/PR2b/PR7** | **单元 + 真实 PA** |
| **18** | **precommit PA 验证不读取未产生的 decision；同行持久能力证据并在 Grant/Guard 检查其 Case/leg/scope/generation** | **PR2b/PR7** | **真实 PA + Host** |
| **19** | **OperationOwner 与 Requester 不同（代发/Leader 代理）时，自问与 Leader 例外仍按 OperationOwner 判定** | **PR1/PR2a/PR7** | **单元 + Host** |
| **20** | **多 Officer 同模板实例时 Member 委托 fail closed；唯一实例正常** | **PR2a/PR2b/PR7** | **单元 + 真实 PA** |
| **21** | **Unavailable 判断先于默认 Officer：`ARCHIVED`/`DISPOSED`/member row 缺失 → hold/leader；Busy/crash/未恢复仍排队** | **PR1/PR2c/PR7** | **单元 + Host** |
| **22** | **transfer 只影响未来签署；decision 后 transfer 不阻止 guard；precommit 与 commit 之间 transfer 被同锁拒绝** | **PR2b/PR2c/PR7** | **单元 + 真实 PA** |
| **23** | Leader 对普通 Officer 路由 leg 可主动 native 代决，不产生第二个常规 Wake；并发只生效一项合法决议 | PR2b/PR4/PR7 | 服务 + Host |
| **24** | Officer 仅对合法委托 current leader leg 可直接 Escalate 至 Human；Human successor 不被 Officer 批准；普通 Member 被拒且全局 resolver 表不变 | PR2b/PR2c/PR5/PR7 | 服务 + Host |
| **25** | PA 逻辑 ID 与 Control durable Case/leg 有可信关联；升级的严格 manifest 与原 Tool/EffectSet/Scope/代际保持一致 | PR2b/PR7 | 真实 PA |
| **26** | 旧 leg deny/escalated 不结束原工具调用；Human allow 时只有原调用仍有效且全链复核成功才继续 | PR2b/PR7 | 真实 PA + Host |
| **27** | Human deny 或原调用 Stop/取消/超时后零执行、零自动重放；最终 leg 的 requestId+decisionSequence 精确配对 Grant/Guard | PR2b/PR7 | 真实 PA + Host |
| **28** | Escalation 后 Human current-leg 经既有 Human 入口可见/唤醒；Officer/Leader 不代决该 Human leg | PR2c/PR4/PR7 | Host |
| **29** | A6 启用后承接 Control/PA 故障时 fail-closed 回退 Alpha.5 路径；不静默降级为全局角色放宽或伪造 allow | PR1/PR2b/PR4/PR6/PR7 | 单元 + Host |

## 5. 测试与证据策略

- **L1 纯单元**：路由/拒绝矩阵（含 Officer 自问、Officer=Leader 拒绝）、
  latch 三处 P0 回归、schema 哈希零移动。
- **L2 真实服务对象**：ControlService + 真实 TeamDomain world；**PA 用例必须
  带严格 manifest 与真实 verifier，断言 grant mint、guard 消费次数与 durable
  decision reason**；负控含非指定 Member、跨 Team、已决、Human-only、治理。
- **L3 真实 Host/适配环境**：PR4 起在可控适配环境投递真实 wake；PR7 用
  `tests/world-factory` 的预算租约与 pristine Host `639ed01539`，端口只用
  `tests/paths.mjs` 测试带，绝不碰 `:3080`。
- **L4 发布**：矩阵 + 指标 + 回滚演练。**ENV_BLOCK 只允许作为设计/模块阶段的
  披露；宣称 Alpha.6 可用/可正式验收时，核心真实 Host 行为必须通过。**
- 每个 PR 的 `RESULTS.md` 必须写清“跑了什么、没跑什么、为什么”。

## 6. 风险、紧急停用与回滚

| 风险 | 触发点 | 缓解 |
| --- | --- | --- |
| PA 委托被扩大成全局角色放宽 | PR2b | 契约限定 case/scope/generation；durable 身份保持 member；四入口能力表；安全复审 |
| Officer 自审/自等待 | PR1 | Officer 自问固定 Leader；Host 用例 |
| 误撤唯一有效 wake | PR3 | pending 与 changed 分离；单测回归 |
| 恢复重复投递 | PR3 | 恢复前查询持久 wake；单测 + Host 崩溃用例 |
| 投递失败永久卡 queued | PR3 | 失败释放 + 无 timer 的后续激活重试；单测 |
| 双 notifier / 重复唤醒 | PR4/PR6 | 每 Team 互斥开关；通知数/模型轮次指标 |
| Blueprint v5 与 Alpha.5 冲突 | PR1 | 版本号协调；旧版零移动；不预占 5 |
| 回滚假设冻结配置可改 | 发布 | 见下 |

**紧急停用与回滚（修正）**：

- 启用状态来自不可变 Blueprint，**不能假设改 Blueprint 关闭**；旧二进制也
  可能不认识新版本。
- 因此必须有**运行时 kill switch**（部署/root 配置，默认关）：关闭后
  (a) 不再产生新的 Officer 决议与委托；(b) 新工作按 Leader 路径处理；
  (c) 已有 pending leg 仍可由 Leader/Human 合法决议，不因停用变成孤儿；
  (d) 已 mint 的 grant 不被回滚，交由既有 guard/消费法律处理。
- 回滚 = 关闭 kill switch，**不是**回退二进制、不是编辑冻结蓝图；对已启用
  新版本 Blueprint 的 Team，不得降级到不识别该版本的二进制。
- PR6 必须演练一次“停用后已有 Case 仍可完成”。

## 7. 评审组成与门禁

- 每个 PR：lane 自检 → 独立 code-review（未参与实现）→ 中心/投递/PA 面追加
  security reviewer；修复只复审本轮 findings。
- PR2b/PR2c/PR4：ARC-A override + 具名 Center-Interface 说明 + “无新增绕过
  规范服务的权威写路径”声明。
- ADR 契约先于 PR2b；PR2a 的求值器单测先于任何消费者；不允许“先写再接”。
- 合并前通过 `docs-sync --check`、typecheck、lint、相关测试；Host 证据与
  CI 证据分开陈述。

## 8. 决策归属（ADR 接受后）

**用户已裁决（2026-11-03）**：选择“ADR 先行”；授权对 Alpha.6 审批授权模型作
必要、系统性的调整（身份/能力分离、统一 ReviewCapability、贯通 Control/PA/
Grant/Guard），同时保留既有非委托语义、权限层级、Hard Ceiling、工具执行约束、
一次性 Grant 与 Human/Leader 专属边界。ADR 见 §2.4 链接。

以下由工程决定，不再上升为用户裁决：

1. 加法版本的具体版本号：与 Alpha.5 当前实施协调后由工程定（原则不变）。
2. 唯一 Officer 的存在性不变量：产品已裁决，工程采用；不建绑定账本。
3. 配置非法 vs 临时不可用：工程按 §2.2 区分；`hold` 默认、`leader` 显式。
4. 指标首版只进日志/证据；长期 UI 不是本轮完成前提。
5. `ReviewCapability` 的具体模块落点、快照字段名、legacy fallback 细节：
   在 PR2a/PR2b 评审中定，但不得偏离 ADR 的单一来源与失败关闭。

**只有实施证明必须扩大 Human/基础工具权限、或无法在 ADR 边界内实现时**，
才停止并提交新的架构裁决；不以“尽量少改代码”为由绕过契约。

## 9. 完成定义

- 验收矩阵 1–29 全部有真实证据；Host 不可用项在设计/模块阶段可标 ENV_BLOCK，
  但**发布 PASS 必须包含核心 Host 行为**。
- 未启用 Team 的旧行为有回归证据；紧急停用演练通过。
- 无第二份审批/授权账本、无七相位调度器、无新 timer、无 Core patch。
- 中心变更均有具名 PR 与 ledger override。
- 发布说明明确 Officer 能做什么、不能做什么，以及 Busy/Unavailable/Handoff/
  Officer 自问的边界。

## 10. 修订记录

### 2026-11-02（真实 UTC，复审修订）

- 接受复审对 P-AUTH 的重定级：简单 Control 接缝通过不等于 PA 工具审批链
  通过；曾新增 PR2 Gate 0 与 §2.4 委托契约（2026-11-03 由 ADR 取代）。
- 新增 Officer 自问 → Leader 规则与负控。
- 修复 latch 三处 P0：pending/changed 分离、恢复查持久 wake、投递失败释放。
- 新增 A6-PR2b 承接 Handoff/接管事实，补齐原计划缺失的 Owner。
- 七个原切片保留为代码所有权切分；另增完整 PA 链前置验证与 Handoff 纵向
  闭环。阶段验收前移：PR2 验跨层，PR4 验真实投递，PR6 闭纵向，PR7 只做
  回归/发布。
- v5 版本号改为与 Alpha.5 协调；回滚改为运行时 kill switch；发布判据明确
  ENV_BLOCK 不等于 PASS。

### 2026-11-03（真实 UTC，ADR 接受）

- 用户选择“ADR 先行”，并授权系统性 ReviewCapability 扩展；新增
  [`ADR-alpha6-review-capability-20261103.md`](./ADR-alpha6-review-capability-20261103.md)。
- 原 PR2/Gate 0/PR2b 重排为：ADR → PR2a（纯求值器）→ PR2b（Control+PA 统一
  契约，中心）→ PR2c（Handoff 与接线）→ PR5（Officer 访问）。不重复三模式
  PoC；已有证据作回归基线。
- A6-AUTHORITY 修订为“保留非委托语义，允许统一委托契约”；A6-LEDGER 明确
  decision 能力快照不是新账本、Handoff 只需一条最小事实。

### 2026-11-03（ReviewCapability ADR 一致性修订）

- 不再组织独立 PoC。按 ADR-A6-1 的 D2–D6 修正跨层先后时序、Blueprint 例外授权、身份归属及 Handoff/Runtime 接管。
- PR1 负责唯一共享 BlueprintReviewPolicy；PR2a 显式依赖 PR1；PR2b 的提交前 PA 候选、durable 同行写入与提交后验证是一个闭环。
- PR2c 同时涵盖 Officer 主动 Handoff 与可信 Team Runtime 不可用接管，均仅影响当前 leg 的归属。
- 新增验收 17–18；PR4/PR6/PR7 原有真实 Host Gate 不变。未增加新的权限台阶、Mandate 账本或 Timer。

### 2026-11-03（用户确认与契约收口）

- 用户明确确认：Leader 保留普通 Officer 路由案件的原生主动代决权；Officer 可对合法委托的普通 leader leg 直接 Escalate 至 Human，但不得批准后继 Human leg。
- 文档收口：增加 `ReviewCapability.entry`（allow/deny/escalate）、`isDelegableOrdinaryToolAsk()` 闭集、escalation 的 case-scoped 授权落点（不扩大 `CONTROL_RESOLVER_ROLES`）、PA↔Control 双向可选身份字段、Case-aware waiter 复用既有等待端口、证据 fail-closed 解析、同一 `teamLocks` 链、`ARCHIVED`/`DISPOSED` 的 Unavailable 定义。
- PR2c 补入 Escalation 后 Human successor 可见性事件，实际通知由 PR4/PR7 完成；验收矩阵扩至 1–29。
