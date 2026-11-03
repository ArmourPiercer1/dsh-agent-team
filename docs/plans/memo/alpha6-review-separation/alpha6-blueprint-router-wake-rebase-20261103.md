# Alpha.6 重设计草案：Blueprint-driven ReviewRouter 与轻量审批唤醒

> **状态：DRAFT / DESIGN-ONLY / NOT IMPLEMENTATION AUTHORIZATION。** 2026-11-03。
>
> 本文件记录用户在 Alpha.6 重设计讨论中已作出的**产品语义裁决**、**仅约束本轮 Alpha.6 开发的工程不变量**、架构方向及有限 PoC。它不修改任何生产路径、工具执行体系或已有 Blueprint；审批授权契约的修订以 ADR 为准且尚未实施；不得将本文描述的功能报告为已实现。
>
> **基线**：仓库 master（建分支时）、DSH 0.2.0-rc.2（对接核验目标）；Alpha.5 的 Sandbox-first 方案以 PR #531 的正式实施版本为协调对象，具体生产接口须按最终已批准实现复核。

> **2026-11-02（真实 UTC）PoC 执行记录（append-only）**：本文件 §4 的三项 P0 已执行，证据与复现入口 =
> [`dev/agent-workflow/evidence/alpha6-rebase-poc-20261102/`](../../../../dev/agent-workflow/evidence/alpha6-rebase-poc-20261102/README.md)。
> 结果：**P-AUTH PASS-with-qualification**（角色闭集是唯一基础权限 gate；一个 case-scoped 谓词即可走完同一账本与 guard；该接缝属 ARC-A 受保护中心，需具名 Center-Interface PR + override + 用户授权）；**P-BP PASS**（v3/v4 哈希零移动；当前入口拒绝 `reviewRouting`；加法面可确定解析 Template × Tool；family 进哈希，故需版本边界）；**P-INBOX seam PASS / 模型 PASS / 真 Host ENV_BLOCK**（Host Inbox 公开接缝足够；三请求/崩溃/Stop 端到端未运行）。

> **2026-11-02 复审更正（append-only，取代上一行的 P-AUTH 定级）**：上一行把“角色闭集接缝通过”写成了 P-AUTH 通过，**定级过强**。复审后的完整 PA 链证据（`evidence/alpha6-rebase-poc-20261102/P-AUTH/pa-chain.test.ts`）显示：真实 strict PA manifest + 真实 verifier 下，member 身份的 Officer 在 `resolve` 即被判 `pa-authority-drift`，`mayReview(member, member, leader)` 恒假，零 grant、零消费；只有加入一个 throwaway 的 reviewer-authority 映射，同一链才 mint + guard 成功，且 durable decider 身份仍是 member。故重定级为：**简单 Control 决议接缝 PASS；完整 PA 工具审批链在 base law 下 FAIL；委托原型 PASS（仅证明插入点）；生产委托契约曾 OPEN；2026-11-03 已由 ADR-A6-1 裁决（见下）。** P-BP 修订为 12/12（新增 Officer 必须是 MemberTemplate、Officer 自问 → Leader）；P-INBOX 模型修订为 11/11（pending/changed 分离、恢复查持久 wake、投递失败释放）。

>
> **2026-11-03（真实 UTC）ADR 接受（append-only）**：用户裁决“ADR 先行”，并授权对 Alpha.6 审批授权模型作必要、系统性的调整：真实 Principal 身份与 Case-scoped `ReviewCapability` 分离；单一求值器贯通 Control/PA/Presenter/Verifier/Grant/Guard；保留非委托语义、rung、Hard Ceiling、工具执行约束与一次性 Grant。契约正本 = [`ADR-alpha6-review-capability-20261103.md`](./ADR-alpha6-review-capability-20261103.md)。A6-AUTHORITY / A6-LEDGER 已据此修订；零生产代码改动。
>
> **旧计划定位**：#319、#501、#503、#507、#509、#513、#517、#520、#522 是可评估和回收的历史设计/实验资产，不是新方案必须逐项实施的前置条件。未另行批准前，它们不自动获得合并/启用授权。

> **2026-11-03 ADR 一致性修订**：本文件的早期 PoC 记录作为历史证据保留，不能覆盖新结论。现行实施契约为 [ADR-A6-1](./ADR-alpha6-review-capability-20261103.md) 与 [实施计划 §2.4/§3](./alpha6-execution-plan-20261102.md)。已收口 precommit/decision 依赖、Blueprint Leader 例外限制 Officer 委托、Handoff 非权限来源、真实参与主体分离、Unavailable Takeover 可信 Runtime 入口。**不追加独立 PoC，零生产代码改动。**

## 0. 唯一产品目标、边界

**目标 G1：职责分离。** 一名专职 Approval Officer 承担团队中日常运行产生的审批；Leader 保留团队调度与治理、持久权限变更和蓝图指定的全局决策/特殊例外。Leader 不再被普通工具审批打断。

**目标 G2：修复重复消息。** 已 resolve 的审批请求不再触发新的多余审批通知；多件同时/连续到达的审批只产生必要的合并唤醒，而不是每个请求投递一轮 next-turn。收到通用唤醒的 Agent 再读取当前权威待办。

**本轮非目标**：通用动态路由/调度系统、路由 LLM/subagent、Jev 策略实现、自动风险评分、复杂定时 defer、多个 Officer 的分布式负载均衡、外部恶意插件/提示词注入的专门防御、实例级持久路由策略编辑器、改造工具执行或非委托基础权限法律（ADR-A6-1 已授权统一扩展审批委托能力）。只预留未来 RoutingStrategy 扩展点。

**信任模型**：本阶段假设各 Member 与 Officer 可信、Officer 足以识别并拒绝不合理请求。仍须遵守现有权限层级、审批范围与终态规则；不因忽略复杂恶意主体威胁而允许未经授权的操作。

## 1. 已裁决的关键产品语义

### S1. 默认 Officer、例外 Leader，但只处理合法的运行审批

1. 有效操作权限结果为 **allow**：无需审批；为 **deny**：不得通过 Router 重新制造一个可批准请求。Router 不负责把 allow/ask/deny 相互转换。
2. 对于合法、需要 **ask** 且当前审批权限允许走普通 Leader 层级的 Member 工具运行审批：**默认 Officer**。
3. **Team 调度/管理/组织治理/权限管理工具，以及申请持久权限改变的请求，仍由 Leader 持有并处理**；若底层权限法律要求 Human，则 Human 优先，Leader 不得替代 Human。
4. 其他明确需要 Leader 的工具审批，按 Blueprint 中的例外规则送 Leader；无该例外则默认 Officer。
5. Router 根据现有审批权威（当前 ApprovalCase/leg、权限要求）决定可路由性，**不得根据 request.kind='leader-approval' 直接等同为通知 Leader**；请求种类、有效审批层级、实际接收者三者不同。
6. 对不能合法路由或没有有效接收者的案件保留权威待办、报告异常；绝不默许 allow，也不把未知权限要求当成 Officer 权限。
7. **实际 OperationOwner 是 Officer 的普通工具 ask 默认交 Leader，绝不交回 Officer。** 当前 Officer turn 等待审批、审批又需要下一个 Officer turn，是正常运行中的依赖环；同层自审也不合法。这是职责隔离规则，不是通用死锁检测器。

### S2. Blueprint 的作者负责制定例外；Router 首版只执行确定性规则

1. **自动路由策略完全从 Team 当前绑定的、校验且哈希冻结的 Blueprint 解析**，不得以 Host 配置、运行时 sidecar ReviewPlan、环境变量、任意 metadata 字符串或模型自述替代产品配置。
2. 首版的规则粒度是 **MemberTemplate × Tool**：针对每个实际运行 Member、每个有效 ask 的工具分别计算，但**作者规则只定义在 Template 上**。可以显式指定 Leader，否则默认 Officer。
3. 同一 MemberTemplate 创建的多个 MemberInstance 必须继承**完全相同的初始审批路由配置**；不得在 Blueprint 内按实例 ID、标签或人为构造的“逻辑实例标识”产生差异。需要不同初始路由时，蓝图作者应创建两个 Template。
4. 将来若增加运行时路由调整，可对**具体 MemberInstance × Tool** 生效，并区别于 Template 默认值；**本轮不实施**这一通用修改能力。
5. 工具选择器必须匹配可信、已解析的实际工具身份；优先重用 Alpha.5 已确定的工具登记/身份坐标，不把 tool authoringOwner 混同 Member 身份。工具 displayName、自由文本 summary、LLM 猜测不得直接成为权威规则。
6. 不要求 Blueprint 作者穷举所有未知的未来工具；**默认 Officer**语义对所有合法的常规工具 ask 一致。管理/权限类工具作为固定 Leader 归属，不需要用户在例外表重复填写。
7. Blueprint 的例外规则只声明“谁接收”；它们不授予工具执行权、不扩展 Officer 的基础权限，也不定义新的授权策略语言。

### S3. 一个 Team 的专职 Officer

1. Blueprint 声明一个专用 **Approval Officer MemberTemplate**。Officer 必须是 MemberTemplate，引用 Leader 模板作为 Officer 直接拒绝（不是“复用 Leader 身份”的合法写法）。每个启用 Alpha.6 的 Team 仅绑定一个具体 Officer Instance；不增加第五级 RuntimeAuthority，不复用 Leader Instance 身份。
2. Agent 的运行中/空闲状态与它是否被绑定为 Officer 是两回事。Officer 可以按需激活，不必常驻运行模型。
3. 相同 Officer 模板的能力、persona、模型偏好与初始路由配置遵循现有 Template 机制。实例如何被唯一绑定、恢复与重建属于工程设计，不能通过重新解释 Template/Instance 身份解决。
4. 为 Officer 提供读取其当前合法待办和提交审批的最小入口；不得直接给它全部 Leader-only Team 管理/读取权限。

### S4. Handoff 与 Escalation 不混淆

1. Officer 判断单件案件确需 Leader 的全局视角，可以将**当前 Case 当前 leg** Handoff 给 Leader：只变更处理者，不变更当前 leg 的权限层级、请求身份或工具授权。
2. 该转交要跨重启生效，直至当前 leg 完成。Router 重新计算不得把已转交的同一 leg 自动抢回 Officer；新 leg 重新按其有效权限与 Blueprint 决策。
3. **Escalation** 与 Handoff 不同：Officer 可对当前合法委托的普通 leader leg 直接沿既有阶梯升级至 Human，不需要先 Handoff Leader，也不得自己审批后继 Human leg。原工具调用按方案 A 保持待决，只有 Human 批准、调用仍有效且执行前全部验证通过才继续；取消或超时后不得复活或自动重试。
4. 默认路由不为每个 Case 写 Assignment；仅显式 Handoff 或选定的异常接管等改变默认归属的事件，才需要最小 Case/leg-scoped 持久事实。现有最终 decider 记录不能替代**决策之前**的 Handoff 事实。

### S5. 忙碌、阻滞与不可用

1. **Busy 不是故障**。Officer 正常运行中、正在处理其他请求或当前没有空闲轮次时，维持归属，排队并合并唤醒；不得仅凭 status=running 重新路由给 Leader。
2. Backlog/阻滞可作为可观测诊断。**本轮不默认增加等待时间定时器**，也不把无进展的 pending 当作无限重唤醒理由。若将来需要 backlog 阈值转交，作为独立可选路由策略扩展。
3. 真正不可用（身份/会话/运行能力不可恢复或无法建立合法接收者）时，由 Blueprint 选择 **hold**（保留待办、报告异常，默认）或 **leader**（合法接管受影响当前 leg）。两种策略都必须保留；不能静默把不可用与 Busy 混同。
4. 若发生接管，记录当前 leg 的最小转交覆盖；Officer 恢复后不得在相同 leg 重新争抢。用户显式 Stop/Team close 不被低频检查自行复活。

### S6. Blueprint 快照、兼容与扩展

1. Team 使用已有的 **不可变 Blueprint Snapshot**（blueprintId / revision / contentHash）。修改源 Blueprint 不改变已运行 Team 的路由；运行时只改变当前 Case/leg 的显式处理状态，而非 Blueprint。
2. 未启用 Alpha.6 的现有 Team 保持原有路由与可观察行为；启用新路由要显式配置，旧通知器与新通知通道不得双重生产。
3. Router 保留稳定的 RoutingStrategy 输入输出接口。首版仅实现 **BlueprintRoutingStrategy**，不实现 Router Agent、Jev、规则 DSL 或通用工作流。将来的新策略仍须经过当前权限和 Case 状态检查。
4. 正式 Blueprint grammar 已对 v3/v4 使用封闭字段/哈希契约；**必须使用合法的、最小加法式 schema 演进并与 Alpha.5 的 Blueprint 工作协调**，不能靠 v3/v4 不受支持的字段静默扩展、改变既有哈希或建立平行配置文件。具体字段和版本号由实施设计确定。

## 2. 本轮工程不变量（**仅约束 Alpha.6 当前迭代**）

| ID | 禁止或必须保持的边界 | 允许的最小接缝 |
| --- | --- | --- |
| **A6-NATIVE** | **不触碰工具执行体系**：不修改 DSH 原生 ToolDefinition、原生 read/bash/web 等工具算法、工具执行器、Provider、FS/OS Sandbox、PTY、Alpha.5 原生执行/受限调用链；不自研替代工具实现 | 读取既有可信 Member × Tool × Call 身份和已生成的审批事件；仅在通知/审批编排侧接线 |
| **A6-AUTHORITY** | **保留既有非委托审批语义**：不改普通 allow/ask/deny 判定、Authority rung/继承、Envelope/Hard Ceiling、工具执行约束、一次性 Grant/Guard/Consumption、持久权限变更法律；不扩大原有 Member 的全局角色权限；Human 审批与 Leader 专属管理不下放 | **允许对 ReviewAuthority、Control、PA、Grant 的委托授权契约作统一扩展**（ADR-A6-1）：真实 Principal 身份不变，case/leg/scope 内的 `ReviewCapability` 统一求值并贯通全部审批入口；禁止各入口分别硬编码、禁止全局放宽 CONTROL_RESOLVER_ROLES、禁止冒充 Leader |
| **A6-BLUEPRINT** | **自动路由完全由 Blueprint 解析**：不使用运行时 sidecar、ReviewPlan 平行作者系统或任意模型裁量作为默认路由来源；不引入实例级 Blueprint 特例 | 权威 Case 当前状态、显式当前-leg Handoff/接管事实，以及 Host 的运行可用性，是决策时的事实输入而非第二套可编辑路由策略 |
| **A6-LEDGER** | 不建第二套审批授权事实、第二份 GrantStore、第二份未决审批数据库，也不建 per-case Mandate/Assignment 账本 | 原有 ControlService/TeamDomain 为唯一审批事实；durable decision 可携带 `reviewCapability` 快照（不是新账本）；Handoff 仅追加一条当前 leg 的最小接管事实，不把它升级为新的权限权威 |
| **A6-INBOX** | 不复制 DSH 原生 Inbox/Agent Loop，不预设新 Core patch、持久七阶段调度器、租约/fencing 及可靠定时服务 | 使用 DSH 公开的 Inbox、claim、turn/lifecycle 事实，必要时在插件侧做轻量协调 |
| **A6-LEGACY** | 未启用 Alpha.6 的 Team 保持旧行为；Human / Admin 审批与原有用户权限不下放 | 新模式的明确 opt-in 与按 Team 的互斥通知出口 |
| **A6-SCOPE** | 本轮不承诺处理恶意插件/提示词注入、复杂多 Officer、跨进程分布式调度及通用规则语言 | 对现有权限/审批终态做正常兼容验证，不主动扩建威胁模型 |

**A6-AUTHORITY 的可行性与边界（ADR 已接受）**：master 的 CONTROL_RESOLVER_ROLES 当前使普通 Member 不可直接 resolve leader-approval；完整 PA 链的 `deciderAuthority()` / `mayReview()` / `verifyEffectSetApproval()` / `issueApprovedGrant()` 也把 member 解释为不能覆盖 leader 级审批。**“角色闭集接缝”只解决 Control 入口，不等于 PA 工具审批可用。** 2026-11-02 的完整 PA 链实验证实：真实 PA manifest 下 Officer 的 allow 在 resolve 阶段即被判 `pa-authority-drift`。

用户 2026-11-03 裁决：保留非委托语义与全部执行约束，**允许对审批授权契约作统一扩展**。契约正本 = [`ADR-alpha6-review-capability-20261103.md`](./ADR-alpha6-review-capability-20261103.md)：真实 Principal 身份与 Case-scoped `ReviewCapability` 分离；单一纯求值器；提交前以可信能力候选完成 PA 验证、提交时在同一 decision 写入能力依据、提交后 PA/Grant/Guard 依凭据重验；不建 per-case Mandate。若实施证明必须扩大 Human/基础工具权限或无法在 ADR 边界内实现，才停止并申请新的架构裁决。

## 3. 架构方向（不提前冻结具体 API / schema）

### 3.1 主通路与三个组件

~~~text
Trusted Blueprint Snapshot + operation-owner Template + real Tool
                              |
                   Shared BlueprintReviewPolicy
                  /                            \
                 v                              v
  ReviewRouter (current recipient)   ReviewCapabilityEvaluator
             |                              ^
             v                              |
   ReviewWakeCoordinator         trusted Principal/Requester/Owner
       (poll/latch)              current Case/leg/scope/generation
             |                              |
        DSH Inbox                 ControlService PRECOMMIT
             |                    PA verifies trusted candidate
      Officer / Leader                       |
             |                               v
             +---- review action ----> same-row durable decision
                                      + capability evidence
                                               |
                                               v
                                      PA/Grant/Guard revalidation
                               (Alpha.5 Tool/IO hard ceilings unchanged)
~~~

1. **ReviewRouter**：一个可扩展而首版确定性的处理者决策节点；**与 ReviewCapabilityEvaluator 共用唯一 BlueprintReviewPolicy**，输入来自冻结 Blueprint、实际 OperationOwner 的 MemberTemplate/可信 Tool、当前 leg、少量显式转交事实；输出唯一当前处理者/无待办/不可路由及原因。不得接管消息排队或 allow。
2. **ReviewWakeCoordinator**：对接收者的待办变化进行激活、实时权威状态重读、单飞锁存和必要通知；不持有审批权威或新的路由配置。
3. **ReviewAccessAdapter（薄适配层）**：让专职 Officer 仅读取其合法待办，并由 ReviewCapabilityEvaluator/ControlService 在提交前验证可信候选、决议时同行写能力证据、执行时通过既有 PA/Grant/Guard 重新检查。首版不提供 Leader 的完整管理能力。

### 3.2 路由决定优先级

| 顺序 | 条件 | 结果 |
| --- | --- | --- |
| 1 | 当前审批已完成、已废弃或无有效待审 leg | no-work |
| 2 | 现有权限法律要求 Human（或无合法 resolver） | 原有人类/不可处理路径，禁止下放 |
| 3 | Team 调度/管理/权限变更类固定 Leader 职责 | Leader（但不高于 Human） |
| 4 | 当前 leg 已有有效的 Handoff/合法故障接管覆盖 | 已覆盖接收者 |
| 5 | **实际 OperationOwner** 的 templateId == `officerTemplateId`（Officer 自己的普通 ask） | Leader（防自等待；不交回 Officer） |
| 6 | Blueprint 中**实际 OperationOwner** 的 MemberTemplate × 可信 Tool 显式 Leader 例外 | Leader |
| 7 | **Officer 不可用**（仅 archived/crashed/未恢复；Busy 不算） | 依该 Blueprint 的 hold / leader 策略；不自动 allow；`hold` 时保留待办并报异常 |
| 8 | 其余可委托的日常工具 ask（且 Officer 可用） | 专职 Officer |

实现应分别绑定 Reviewer/Decider、Requester、OperationOwner，并以**实际 OperationOwner** 的 Template × 可信 Tool 同时判定第 5、6 行的自问与 Leader 例外；禁止用 Requester、消息发送者、displayName 或 tool owner 代替。Leader 例外同时禁止 Officer 接收通知与取得该 leg 的委托审批权；使用 Alpha.5 最终可信调用身份。Unavailable 判定必须先于默认 Officer，否则第 8 行会吞掉第 7 行。

接口建议维持一个策略端口（签名与类型仅示意）：

~~~ts
type ReviewRoute =
  | { kind: 'recipient'; target: 'officer' | 'leader' | 'human'; reason: string; currentLegId: string }
  | { kind: 'no-work' }
  | { kind: 'unroutable'; reason: string };

interface RoutingStrategy {
  route(authoritativeContext: ReviewRouteContext): ReviewRoute | Promise<ReviewRoute>;
}
~~~

设计此接口是为了未来更换路由策略，**不是**要求本轮开发抽象策略注册中心、跨进程 RPC、Agent 编排器或多级策略优先级系统。

### 3.3 Blueprint 作者面：语义示例（**不是现有合法 YAML**）

~~~yaml
reviewRouting:
  enabled: true
  officerTemplateId: approval-officer
  ordinaryToolApprovals:
    default: officer
    leaderExceptions:
      - memberTemplateId: researcher
        tool: { owner: dsh.shell, name: bash }
      - memberTemplateId: analyst
        tool: { owner: dsh.fs, name: write }
  whenOfficerUnavailable: hold  # also permitted: leader
~~~

- 同模板实例在启动时规则完全一致；不允许 instanceId / label 选择器。
- 示例中的 owner/name 坐标仅表达需要受信工具身份，不宣称这些具体键已被产品接受；应优先复用 Alpha.5 工具身份定义。
- 既有 Blueprint 解析器与历史 v3/v4 内容哈希必须保持原义。真正实现前先核对 Alpha.5 当前定稿 schema 的最小可扩展位置；选择一次明确的加法式变更。
- 当路由配置无效时，不启用新模式并输出明确错误，不悄悄回退到平行 Host 配置。

### 3.3a 当前授权与路由的清晰边界

- **共享 BlueprintReviewPolicy** 是 Router 和 ReviewCapabilityEvaluator 对 MemberTemplate × 可信 Tool、固定 Leader 管理类别、Human rung、Officer 自问及显式 Leader 例外的唯一静态策略实现。Router 决定归属；委托求值器决定 Actor 当前能否签署。路由为 Leader 的显式例外不得同时允许 Officer 有效审批。
- **三种主体必须区别**：Reviewer/Decider（审批者）、Requester（提出请求的人）、OperationOwner（真正执行工具调用的 Member）；按 OperationOwner 的 Template 而非 Officer 或 Requester 的 Template 进行规则匹配。工具身份来自受信工具登记/调用绑定。唯一 Officer 由 TeamDomain 的未归档唯一同模板实例解析；求值器必须校验该实例，歧义时 fail closed。
- **Handoff 与不可用接管不是审批能力来源**。仅保存一种当前-leg `CurrentLegTransfer`，分别由 Officer 或符合 Blueprint 条件的可信 Team Runtime 发起；Leader 使用其原生权限，旧 Officer 不再能**未来**签署该 leg（已持久 decision 不追溯失效）。
- **正确授权时序**：ControlService 在写决议前计算可信 ReviewCapability 候选并经 PA precommit 验证；成功后同一 durable decision 行记录真实 decider 与能力证据；后续 PA/Grant/Guard 从该行及现行有效调用事实重验。不得在 precommit 读取不存在的 decision，也不得在各层各写一套特例。
- 这些只是审批委托模型的扩展，不修改原生工具、原有角色 rung、非委托权限法律或 Alpha.5 I/O 硬上界。权威接口细节见 [ADR-A6-1](./ADR-alpha6-review-capability-20261103.md) 和 [执行计划 §2.4](./alpha6-execution-plan-20261102.md)。

**跨 leg 工具审批**：见 [ADR D6a/D6b](./ADR-alpha6-review-capability-20261103.md) 和 [执行计划 §2.4b](./alpha6-execution-plan-20261102.md)。现有 PA Bridge 仅等待初始 requestId，须先接入正式 Control Case/leg、保留严格 manifest，等待最终 Human 决议后才按原调用存活状态、实际终态 requestId/decisionSequence 与全部执行前检查决定是否继续；中间 deny/escalated 不是最终工具拒绝。Leader 可主动代决而不被自动双投。

### 3.4 轻量通知：Activation + Poll + Latch

- **激活（Activation）**：只发出 WorkChanged 提示，不按 requestId 注入模型消息。新 Case、resolve/abandon、leg 升级、Handoff、故障接管等都是需要**重查当前待办**的触发源；通知失败不回滚权威 Case。
- **轮询（Poll/Reconcile）**：按接收者查看最新有效的审批待办（Case + current leg + route），并非轮询 LLM。没有有效工作时绝不新发 Wake；已 resolve 的案件不能继续成为新 Wake 的依据。该规则由查询权威状态实现，而不是相信旧事件 payload。
- **锁存（Latch）**：同一接收者/Session 同一时间只管理一个在途 Review Wake，逻辑状态可压缩为 idle / queued / running 和一个 dirty 或工作版本标记。queued/running 期间的新事件只合并，不额外 followup；turn 真实结束后再扫描，若仍有新/未处理的有效工作才补一条。
- **避免无进展死循环**：pending ≠ fresh actionable work。相同有效工作版本反复无进展，不得无限启动模型。可复用现有 Case/leg 状态与本轮处理结果判断，不新增第二个持久任务模型。
- **共享 Inbox**：利用 DSH 既有 durable next-turn、消息 ID、remove/replace、claim、turn/end、Agent 恢复。专用 Review Wake 标识必须与插件工作完成消息区分，不能仅凭共同的 source.kind=plugin:dsh-agent-team 视为同一类通知。不能依赖未公开的用户消息确定性 ID 注入。
- **并发**：每 Team/接收者的查队列与投递判重应被串行化；ControlService 写入路径不得等待 Reviewer 的完整模型轮次，不调用会造成互等的 await whenIdle。必须考虑 claim 后消息已不在 pending Inbox、但 Reviewer 仍运行的窗口。
- **恢复**：Agent/Team 恢复时根据权威未决 Case、显式 Handoff 与 Host Inbox 重查；已 claim 但中途崩溃的通知不应假设 Host 自动完整重投。无必要持久化七阶段 WakeSlot、writerToken、leaseEpoch、独立 Timer Service；如观察到真实缺口再以最低成本补强。
- **准确的完成定义**：若在最终权威查询时已解决且接收者没有其他 ready 工作，则不发送新 Review Wake；尽可能撤销尚未 claim 且已失效的通用 Wake。已经 claim/进入 Agent turn 的消息无法通过删除排队项追溯取消；消息不是授权，最后决策仍重新校验当前 Case。不要承诺 Control Store 与 Host Inbox 跨存储严格原子 exactly-once。

### 3.5 生产接线必须是纵向闭环，而不是全 dark 模块堆积

先交付真实、默认 Leader 的合并通知路径，再切换到 Blueprint-driven Officer；随后验证 Officer 的读取、合法审批、Handoff、Human 路径和恢复。一个阶段的 GREEN 必须包含至少一条**真实消费**路径；纯模块的 ALLOWED_CONSUMERS=[] 只能证明休眠隔离，不是产品完成证据。

旧 Leader notifier 在启用 Alpha.6 的 Team 上必须由唯一归属路由入口替换，而不是和新 Officer notifier 同时发送。不能仅凭 request.kind 触发 Leader 通知。Handoff/Escalation 必须真正提供新接收者的 WorkChanged 唤醒源。

## 4. 有限 PoC：只证明会改变路线的接缝，不建设第二套实验工程

**当前状态：NOT RUN。本 PR 不宣称执行或验收了这些实验。**

> **2026-11-02（真实 UTC）更新（append-only）**：三项 PoC 已执行。P-AUTH/P-BP 有可复现证据；P-INBOX 只完成公开接缝见证与纯 latch 模型，真 Host 三请求/claim/崩溃/Stop 仍为 **ENV_BLOCK**（本工作区无 pristine Host checkout，且路由/唤醒接线尚未实现）。本节原文保留，作为本轮开始前的状态记录。

PoC 只针对真实不确定的三个问题；已经由固定源码明确支持的简单功能不重复做独立实验。若证明可行，直接纳入实现计划；若失败，给出最薄替代方案和明确阻塞，不允许为继续 PoC 再自增“必须支持”的产品语义。

| PoC | 需回答的具体问题 | 最小可验证对象 | PASS 判据 | FAIL/BLOCK 的处理 |
| --- | --- | --- | --- | --- |
| **P-AUTH（P0）** | 在不改基础权限法律、也不冒充 Leader 的情况下，普通 Member 身份的专职 Officer 能否合法完成当前 Case 的受限审批？ | 当前 ControlService + 真实 caller/session 绑定 + 一件 leader-level 普通 ask；正例 Officer 有效，负例普通 Member、跨 Team、已 resolved、Human/治理事项 | 存在最小可信 Case-scoped 入口，真实决议进入**同一** Control ledger，之后现有执行 guard/grant 仍独立验证 | 不得修改全局角色闭集、绕过审查或冒充 Leader；若确无接缝，产出最小权限兼容改动的具名 BLOCK，等待用户授权后再实施 |
| **P-BP（P0）** | 能否从冻结 Blueprint 按 MemberTemplate × 受信 Tool 解析确定路由，且不破坏 v3/v4 历史哈希、不制造另一套配置源？ | 2 Templates（同模板 2 Instances）× 2 Tools × Leader 例外的最小 Blueprint、schema/hash 对照；与 Alpha.5 最新作者配置并读 | 同模板同默认；不同模板可不同；未显式 Leader 为 Officer；不匹配的旧配置原样；新字段只有受支持版本/明确迁移路径 | 提出最小加法式 schema 修改与交叉协调，不以 metadata 或 sidecar 绕过；不能在已有旧 schema 偷增字段 |
| **P-INBOX（P0）** | 在 DSH 0.2.0-rc.2 的真实 Inbox/Agent 生命周期下，轻量激活+轮询+锁存能否防止多余模型轮次而不丢当前待办？ | 一次受控真 Host：3 个请求并发、投递前 resolve、Reviewer claim 后新请求、handoff、Stop/冷恢复；读取真实 session/inbox/turn/request 事实 | 收件者只收到必要的通用 Wake；常规 ask 不再唤醒 Leader；resolved 不能单独新唤醒；claim/running 与崩溃恢复后当前 Case 可再次发现；无双 notifier | 若 Host 某一公开接缝不可用，只针对该接缝提交最小替代/基础设施改动建议；不自动引入七阶段 scheduler、可靠 Timer 或 Core patch |

**真实 Host 与发布 Gate 分开**：PoC 证明基础接缝是否成立；实现后的端到端回归验证生产代码。设计/模块阶段真实 Host 不可运行时可标 ENV_BLOCK，不冒充 PASS；但**宣称 Alpha.6 可用于正式验收/发布时，核心真实 Host 行为必须通过，ENV_BLOCK 不得作为发布 PASS**。针对固定 DSH 源码事实可直接读码并辅以单个见证，不再为已证明的 Inbox API 设计重复 PoC。

### 最终行为验收（实现阶段）

| 测例 | 可观察要求 |
| --- | --- |
| 同时有三条来自普通 Member 的常规 ask | Officer 最多一条有效在途 Review Wake；Leader 的常规审批唤醒轮次为 0 |
| 三件在首轮全部完成，或投递前已全部 resolve | 不出现因为旧审批通知而额外启动的模型请求 |
| Officer 正在执行时 B/C 又到达 | 新激活只标记 dirty；结束后读取最新状态，按需继续，不为每件新消息逐条 followup |
| 一个工具在模板 A 被指定 Leader、模板 B 未指定 | A 的实例归 Leader；B 的实例归 Officer；同模板不同实例初始路由完全一致 |
| Team 调度/治理/持久权限变更；Human-only leg | 仍分别走 Leader / Human 既有路径，不被 Officer 接管 |
| Officer 主动 handoff | 当前 leg 归 Leader；Leader 得到合并唤醒；Officer 不重新获取同一 leg |
| Officer 正常忙碌与真正不可用 | Busy 保持排队；Unavailable 分别验证 hold 和 leader 配置 |
| 插件审批通知与已有工作完成通知同时存在 | 消息不相互覆盖、不按共同 source.kind 错误去重 |
| 已 claim 后崩溃、Agent 恢复、用户 Stop | 仍可恢复权威未决工作；无已决定重复 allow；Stop 不因自动轮询被复活 |
| 未启用 Alpha.6 的 Team | 原 notifier、已有角色/权限/审批功能行为不变 |

度量必须包括 **Leader 和 Officer 各自的模型请求数、总 token 消耗、通知数、审批可达性与等待时间**，而不仅是内部测试或 Inbox 计数。不要将模块全部被测试覆盖误认为实际生产已接线。

## 5. 建议实施次序与旧成果回收

**阶段 0 — 本 Draft 评审与限量 PoC**：固定用户语义，获得三项 P0 接缝结论。PoC 不产生自动合并或实现授权。

**阶段 1 — Blueprint → Router 的最小可用纵切**：在 Alpha.5 最新可用 Blueprint 方案上实现专职 Officer 模板绑定、每 Template × Tool 默认/例外解析；保留既有权限和工具识别，真实生产消费者应尽早出现。

**阶段 2 — 替代旧 notifier 的通用合并 Wake**：先对现有 Leader 通路使用，再按 Blueprint 接到 Officer；已有 Case 的 post-commit 通知与 resolve/handoff/escalate 变化合并处理，避免双投与额外 turn。

**阶段 3 — Officer 受限读取、审批与 Handoff**：仅复用既有 ControlService 权威写入与权限重检查，保留合法 Human/Leader 访问；实现不可用时 hold/leader 的蓝图配置与当前-leg 覆盖。

**阶段 4 — 真 Host 回归与发布**：把上述矩阵作为完整纵向验收，消除 ALLOWED_CONSUMERS=[] 时代的“全绿但没接线”。

**回收候选（不自动合并）**：

- #501、#522：可复用身份/作用域/审批入口的测试和纯检查；不以完整 ReviewMandate 代际账本作为必要交付。
- #507、#517：复用有价值的 Router 谓词、最小当前-leg Handoff 事实；不默认每 Case 创建 Assignment。
- #503：保留并发、claim/turn、恢复等可用测试用例；不要求沿用七相位持久状态机。
- #509、#520：defer/timed-wake 不属于本轮两项目标，不再构成 Alpha.6 立即实施的阻塞。
- 与 Alpha.5 PR #531：仅协调 Blueprint 作者面和既有可信执行身份/审批接口，**不修改** Alpha.5 已冻结工具执行架构，不用 Alpha.6 重新设计其权限或沙箱。

## 6. 证据及交叉核验入口

- [现行 Blueprint 类型：Template、Team 快照与 v4 工具绑定](../../../../packages/domain/blueprint/src/types.ts)
- [v4 Blueprint 封闭校验与工具绑定 grammar](../../../../packages/domain/blueprint/src/blueprint-v4.ts)
- [Control 请求 kind、resolver roles、当前 leg 和决议身份](../../../../packages/runtime/control/types.ts)
- [ControlService 请求后的旧 C1 notifier 接线](../../../../packages/runtime/control/service.ts)
- [现行 Leader notifier（每请求一条）](../../../../packages/runtime/control/leader-notification.ts)
- [Agent live delivery / 工作完成通知](../../../../packages/runtime/src/plugin/live/agent-bindings.mjs)
- [Alpha.5 新架构方案 PR #531](https://github.com/ArmourPiercer1/dsh-agent-team/pull/531)
- [旧 Alpha.6 架构提案 PR #319](https://github.com/ArmourPiercer1/dsh-agent-team/pull/319)
- [DSH 0.2.0-rc.2 Inbox 固定源码](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/packages/core/agent-loop/src/inbox.ts)
- [DSH 0.2.0-rc.2 Agent Loop 固定源码](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/packages/core/agent-loop/src/agent.ts)

**本 Draft 的完成标准仅是“产品裁决、ADR 与实施计划一致，历史 PoC 状态准确披露”。** 不得把该文档视为实现完成、全面权限复核通过或默认允许修改任何已冻结的生产权限/执行代码。
