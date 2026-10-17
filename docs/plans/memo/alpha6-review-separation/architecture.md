# Alpha.6 架构设计：Leader / Review 分离与单飞审查唤醒

> **状态：PROPOSED / DRAFT FOR REVIEW；仅架构设计，不授权实施、启用或合并。**  
> **阶段：Alpha.6（目标为最小可交付的职责剥离；工程纪律规则留待后续阶段）。**  
> **日期：2026-10-18。仓库：ArmourPiercer1/dsh-agent-team。**  
> **审阅基线：`master @ fe8290381d1518ff437b60fb72972e5742f0e40d`；DSH 接口引用采用可访问的上游仓库当前代码，实际实现须在 S0 固定宿主 commit 并做真实运行验证。**  
> **变更纪律：本文件提出新的架构候选，不修改 Alpha.4 已接受的权限法律、不宣布 Alpha.5 产品 GO、不默认修改 Blueprint v3、不暗示实现已交付。**

## 0. 决策摘要与优先级

Alpha.6 的两个硬目标：

1. **职责分离**：Leader 只承担团队工作状态整合、协调、用户对接和确实需要全局视角的审查；常规、已授权范围内的 `leader` 级审查由专职 Approval Officer 处理。
2. **消灭请求通知导致的多余模型轮次**：将当前“每个 `request-control` 各投递一条 `next-turn` 消息”变为“对每个目标审查执行体最多维持一个有效的审查唤醒票据，模型按需读取全部当前待办”。

推荐组成：`ControlService / ApprovalCase`（已有持久化权威） + `ReviewRouter`（分派） + `ReviewAssignment`（非授权的分派事实） + `ReviewMandate`（受限委托） + `SingleFlightReviewScheduler`（唤醒和恢复） + 独立 `ReviewAgent`（审查执行体）。

**不增加权限阶梯。** 现有 `member < leader < human-user < human-admin` 不变；Approval Officer 是“持有有限审查委托的 Member 实例”，不是第二个 Leader，也不是第五级权限。`handoff` 是同审批层级内的处理者转交，`escalate` 才是 Alpha.4 意义的权限层级升级。

**优先顺序**：P0-审批委托正确性、P0-单飞唤醒、P0-不丢任务/无过量唤醒、P0-同步依赖死锁负例；P1-可观测与 UI；纪律推理模型、规则语言、多审查委员会留待未来。

## 1. 现状与确切故障

### 1.1 关键源码事实

- `packages/runtime/control/service.ts` 中 `requestControl` 先提交持久化请求、释放 Team 锁，之后对“新建的 `leader-approval`”调用 `requestNotification.notifyLeaderRequest`，不等待 Leader 模型处理。
- `packages/runtime/control/leader-notification.ts` 把新请求渲染成逐请求的 `[team-control requestId=...]` 文本。
- `packages/runtime/src/plugin/root.ts` 将通知端口连接到 `live.deliverRootControlNotification`。
- `packages/runtime/src/plugin/live/agent-bindings.mjs` 的该通知最终通过 `deliverRootInput` 提交 `followup`，并等待 `whenIdle`；`followup` 在 DSH 中进入 `next-turn` Inbox。
- `packages/runtime/admission/resolve.ts` 仅保留的 LeaderInstance 被识别为 `leader`，其余普通 Agent 实例识别为 `member`。`packages/runtime/control/types.ts` 的 `CONTROL_RESOLVER_ROLES` 目前不允许 Member 解决 `leader-approval`。
- Alpha.4 的 `listOpenApprovalCases` / `readApprovalCaseState`、权限阶梯、升级 leg、执行时重检查已提供持久化的审批权威；Alpha.5 提供正在集成的 Admission / EffectSet / Grant 边界，但部分生产连接及验收尚未闭合，必须逐项核对。

### 1.2 P0 重现：ABC 三条独立通知已经排队

~~~text
Member A -> request a -> DSH next-turn notification(a)
Member B -> request b -> DSH next-turn notification(b)
Member C -> request c -> DSH next-turn notification(c)

Leader/Reviewer 首轮读取待办，已处理 a、b、c
但 next-turn 中 b、c 的通知仍未消费
-> 再运行两个无效模型轮次
~~~

**根因是独立、不可自动消失的多条入队唤醒消息，不是相同 ApprovalCase 被多次创建，也不是简单的“仍 pending 所以再通知”。** 仅靠 Reviewer 自己识别重复文本无法避免模型已被再次调用。本阶段必须在 `followup` 之前完成单飞合并，并可定向撤回已失效、尚未领取的通知。

### 1.3 正反成功定义

- 旧机制：`N` 个短时间到达的不同请求，可能产生 `N` 条 `next-turn` 通知，即使首轮已全部处理。
- 新机制：同一 Reviewer 在一个活跃通知/审查周期中最多一个 Scheduler 唤醒票据；首轮已解决所有有效待办时 **后续自动审查模型轮次为 0**。
- 首轮仍有新的可执行待办时可安排一条后续唤醒；无进度且无新状态的旧 pending 不允许形成无限重试。

## 2. 目标、非目标与法律边界

### 2.1 In scope

- 一名 Team Leader + 默认一名专职 Approval Officer（实现可以容纳按实例键分组，Alpha.6 产品不开放任意数量的 Reviewer）。
- 确定性、保守的 ReviewRouter；仅把明确可委托的 `leader` 层级审批交给 Officer；需要整体团队判断的同层级审批交给 Leader；`human-user/admin` 案件维持原始人类审批路径。
- Case-scoped / scope-bounded ReviewMandate、可审计同层级 Handoff、持续权限复核。
- 单飞通知、去重、连续处理、取消未领取的过期通知、重启恢复、暂停与故障退避。
- Agent 真轮次、真实 DSH Inbox、Alpha.5 工具 Admission 的交叉回归；最小 UI / 诊断。
- 为未来纪律体系预留泛型 ReviewTask / EvidenceReference 接口，但**不实现纪律规则**。

### 2.2 Out of scope

- 新的 Team RuntimeAuthority 层级；向 Member 直接授予完整 Leader 身份；修改 Human Admin 可信身份来源。
- 自动执行未获批准的操作、永续授权、跳过 Alpha.4 审批 leg / Alpha.5 ExecutionGrant 或外部硬边界。
- 完整工程纪律系统、跨项目科研真值库、通用 Workflow Engine、动态风险评分、通用委员会共识。
- 偷偷修改 Blueprint v3 schema 或自动迁移已运行 Team；更改 DSH Core 除非 S0 的公开接口 PoC 给出无法绕过的反证。
- 将 Alpha.5 DORMANT / PARTIAL 的能力描述为生产支持；不得借 Alpha.6 放宽未闭合的工具 IO 保障。

## 3. 架构分层与数据通道

~~~text
Member / Leader operation
       |
       v
Existing Operation Permission / Alpha.5 Admission
       |
       v
ControlService / ApprovalCase / TeamDomain  <-- authoritative case state
       |            ^
       | post-commit | final review action
       v            |
ReviewWorkChanged   |   (validate mandate + fresh case + shared commit)
       |            |
       v            |
ReviewRouter -> ReviewAssignment  (assignment only; not authorization)
       |
       v
SingleFlightReviewScheduler  (one logical wake per target at a time)
       |
       v
DSH Session Inbox -> Reviewer Agent turn -> team_list_assigned_reviews
       |                                     |
       |                                     +-> allow/deny via ControlService
       |                                     +-> handoff to Leader (same rung)
       |                                     +-> legitimate escalate (higher rung)
       |                                     +-> defer / blocked (no authorization)
       v
turn completion + fresh case reconciliation -> optional NEXT wake
~~~

| 层 | 唯一责任 | 禁止承担的责任 |
| --- | --- | --- |
| ControlService / ApprovalCase | Case/leg/decision/guard/consumption 的权威 | 直接启动模型、复制审批判断到调度器 |
| ReviewRouter | 根据 Case 的权威属性选择应处理的执行体 | 自行提高权限、提交 allow/deny |
| ReviewAssignment | 记录目标、转交、epoch、理由与审计 | 成为权限凭据或替代当前 leg |
| ReviewMandate validation | 依据可信配置为 **当前具体 Case** 验证委托是否覆盖 | 依据模型传入的角色或理由自行增权 |
| ReviewScheduler | 唤醒一次、合并通知、观察实际轮次、重试与恢复 | 维护第二套待审批事实、直接裁决 |
| Reviewer Agent | 读取必要证据，建议/提交受限动作 | 冒充 Leader/Human、凭消息内容获得授权 |
| Leader | 协调团队、接用户、处理需要全局信息的同级 Case | 承担全部日常 approval intake |
| Human | 现有合法人类权限入口 | 由模型伪造 `human-admin` |

只有 ControlService / TeamDomain 有审批事实权威；唤醒信息只说明“请查询最新待办”，不携带有效授权，也不将某个旧请求永远绑定为唯一处理对象。

## 4. Identity、Authority、Assignment 必须三分

1. **Authority Position**：案件最低需要哪一层审核，如 `leader`。继续由 Alpha.4 纯权限法律计算；`reviewAuthority`、`requiredAuthorityAtCreation` 等合法性语义不变。
2. **Execution Principal**：实际运行的 Agent 实例。Reviewer 有自己的 `instanceId` / `childSessionId`，身份仍是 `member`；不复用保留的 Leader ID，也不把 Member role 全局列入 `CONTROL_RESOLVER_ROLES`。
3. **Review Mandate / Assignment**：由可信运行时生成的有限委托，以及当前案件应交给哪个 Reviewer/Leader 处理。`assignment` 不能独立增加授权；`mandate` 是审查入口必须检查的上限。

默认路由决策：

| 场景 | 接收者 | 原因 |
| --- | --- | --- |
| 已明确归类的局部工具 `ask`，现有 review rung = `leader`，且属于委托范围 | Approval Officer | 最低权限已满足且不需团队全局协调 |
| 任务分派冲突、跨 Member 资源/计划取舍、改变团队优先级 | Leader | 权限仍可为 `leader`，但需要全局上下文 |
| 案件已有的 review rung = `human-user` | Human User | 不得因 Reviewer/Leader 不空闲而下放 |
| 案件需要 `human-admin`，当前无可信 resolver | 已有 typed unavailable/terminal 路径 | 不制造虚假 resolver |
| ExternalHard/host 或权限内核明确阻止执行 | 原判定拒绝 | 不走“请求 Reviewer 破例” |
| 未明确支持的 legacy Case 或无法判定的 ReviewPlan | Leader/已有入口，或明确停用新路由 | 不从不可判定中生成委托 |

特别说明：ReviewRouter 的 `handoff(Officer -> Leader)` **不调用** Alpha.4 `escalateApprovalLeg`。后者会终结当前 leg、将审批上升至更高权限；前者只修改同 leg 的处理者 Assignment，不改变 `approvalCaseId`、当前 `requestId`、`reviewAuthority` 或操作 scope。需要真正升阶时才调用既有升级操作，复用现有不可重签同一 Case 的法律。

## 5. 委托安全模型（提议的最小接口）

以下 TypeScript 仅用于定义语义，**不是现有已实现的 API**：

~~~ts
type ReviewAction = 'allow' | 'deny' | 'handoff' | 'defer';
// Alpha.4 的 'escalate' 保持由独立的既有权限升级入口管理。

interface ReviewMandate {
  mandateId: string;
  rootSessionId: string;
  reviewerInstanceId: string;
  reviewerSessionId: string;
  issuer: 'trusted-team-config';
  boundBlueprintContentHash: string;
  mandateGeneration: number;
  maximumReviewAuthority: 'leader';  // Alpha.6 的上限，不含 human
  allowedOperationClasses: readonly string[];
  allowedScopeMatchers: readonly unknown[];  // 使用已定义的规范化 matcher
  allowedActions: readonly ReviewAction[];
  expiresAt?: string;
}

interface ReviewAssignment {
  rootSessionId: string;
  approvalCaseId: string;
  currentLegRequestId: string;
  target: { kind: 'instance'; instanceId: string } | { kind: 'leader' };
  assignmentEpoch: number;
  reasonCode: string;
  basedOnCaseVersion: string;
}

interface ReviewEvidenceReference {
  kind: string;           // 预留 git / test / research / other provider
  immutableRef: string;   // 需要可定位/校验，不能只是模型复述
  contentHash?: string;
}
~~~

**写入裁决时的强制服务端检查**（每次重验证、拒绝时不写 allow）：

1. 通过可信的 session -> Team / Instance 映射确定实际 caller；任何模型参数中的 role、mandateId、issuer、reviewAuthority 都只是引用或声称，不是身份认证。
2. 读取当前 ApprovalCase 的最新完整 leg、当前 Assignment/epoch、绑定的 Blueprint hash、ReviewMandate generation；不接受已过期、跨 Team、跨 session generation、已转交或已决定的案件。
3. 检查该案件 current leg 确实需要 `leader`，所申请动作/资源/效果落在 Mandate 的交集，且实际 Reviewer ≠ 请求方、受益者（及其他被审议的冲突主体）。不允许自批或间接自批。
4. **调用现有且唯一的审批法律与持久化写入路径**，保留 Alpha.4 的同一 Case 不可二次行动、硬边界、实体 stale 检查和 Alpha.5 的整 EffectSet 覆盖。不要另造 `reviewerDecision` 的平行数据库。
5. `allow` 不是长效工具执行授权；最后执行关口继续进行 external hard / authority generation / effect-set / exact-scope / one-use grant 的原有重验证。

必须在 S0 做写入点 source audit：验证 `resolveControl`、`escalateApprovalLeg`、`appendTerminalOutcome` 当前对 Alpha.4 leg 的 rung 检查是否完全一致，Reviewer 新入口必须在同一写入事务中组合；不能只看 UI 上“谁可以批准”的 projection。

**配置建议**：Alpha.6 不在本 Draft 里擅自向不可变 Blueprint v3 添加 `reviewer` 字段。PoC 暂采用 Host 可信端绑定到 `(TeamSession, Blueprint contentHash)` 的冻结 `ReviewPlan`。如果要开放配置，应单独论证它进入新的 schema 版本还是独立版本化治理配置；任何 Mandate 变动都增加 generation 并使旧委托失效。没有可信入口时 fail closed，不能凭 Agent 自述角色开通。

## 6. ReviewTask / Assignment / Case 的数据模型与一致性

Alpha.6 的任务引用只用 **Case identity + current leg identity**，不复制审批 payload：

~~~ts
type ReviewTaskRef = {
  kind: 'approval';
  rootSessionId: string;
  approvalCaseId: string;
  currentLegRequestId: string;
  caseVersion: string;
};

type ReviewAvailability =
  | { kind: 'ready' }
  | { kind: 'deferred'; reasonCode: string; resumeOn: string }
  | { kind: 'blocked'; reasonCode: string }
  | { kind: 'closed' };
~~~

- `ReviewTaskRef` / `ReviewAssignment` 属于控制平面的非授权 projection。实际执行必须重新解引用 `readApprovalCaseState`；不能使用一条过期的 TaskRef 决策。
- `ApprovalCase` 的 open/decided/abandoned/terminal 与 `ReviewAvailability` 的 ready/deferred/blocked 彼此正交。“defer”不会生成 `ControlDecision`，也不会使待审操作自行执行。
- `ReviewAssignment` 建议采用 TeamDomain append-only 事实（`review-assignment-created` / `review-assignment-transferred` / `review-assignment-retired`，正式事件命名由 S0 核对 closed vocabulary），每次变更附前值 epoch / CAS，并检查旧目标不得再次提交。
- 同一个 Case 同一时刻只有一个默认处理者；Leader/Human 的合法覆盖裁决仍以 ControlService 权威为准。处理者占用不意味着可排除原始 Human 监督权。
- 从 `listOpenApprovalCases` 重建活跃 Case 时，对 corrupt leg 显式发出诊断；不得把“无法解析所以没待办”默认为许可或自动关闭。
- 对旧式无 `approvalCaseId` 的 `leader-approval` 不暗中伪造 Case；S0 决定是保留旧 Leader 通道还是做显式受测适配。

## 7. ReviewRouter：确定性路由及安全 Handoff

路由输入只能从可信侧得到：`rootSessionId`、当前 ApprovalCase/leg、required rung、操作类别和 canonical scope、冻结 ReviewPlan、Reviewer 当前生命周期和 Mandate 等。LLM 可提交“建议转交及理由”，但不能作为最终路由或权限事实。

首版优先静态白名单；未知/失配/证据不充分时交由 Leader 或合法 Human 路径，绝不对未知资源授予普通 Reviewer 审批能力。

每次路由决定保存 `(caseId, currentLegId, assignmentEpoch, target, reason)`，然后触发对应目标 mailbox reconcile。转交和裁决竞争时，先 CAS 确定当下 Assignment，再由 ControlService 在最新 Case 上执行；失败返回 typed stale/conflict，不重放旧 grant。

**Handoff 与 Escalation 测试硬边界：**

- Officer 认为需要 Leader 的全局信息 -> `handoff`，新的 target=Leader；原 `reviewAuthority=leader` 和 current leg 保持不变。
- 当前 leg 的批准权限不足 -> 只有既有 `escalateApprovalLeg` 能创建 higher-rung leg；不得借 `handoff` 提高权限。
- 已完成的 Case 不因晚到的 Router 事件重新开案；人类已决定的 Case 不允许 Reviewer 重签。

## 8. P0 单飞唤醒协议：替换逐请求 next-turn

### 8.1 核心不变量

**SF-1** 对每一 `(rootSessionId, reviewerInstanceId, sessionGeneration)`，最多有一个由 Scheduler 管理的未结算逻辑 wake；正常健康运行不得在 DSH Inbox 中积压多个该 Scheduler 的 `next-turn` 通知。

**SF-2** 来了新的审批请求，必须先提交 ControlService/TeamDomain 事实，再发出非权威的 `ReviewWorkChanged`。该通知可以丢，权威 Case 不可丢；启动/恢复/定期廉价 reconciliation 修复丢失的边沿信号。

**SF-3** 第一次请求 a 到来时入队“一条通用提醒”；b、c 在该 wake 排队或审查轮次进行期间到来，只标记 dirty / 记录新的权威版本，不再 `followup`。通知不绑定“只审 a”。

**SF-4** 只有当前 wake 对应的轮次真实结束、且调度者确认目标没有另一个在途 wake，才重新查询有效待办并决定下一次 wake。查询后仍无 ready 工作 => 绝对不唤醒。

**SF-5** 持久化 `pending` ≠ 有 `new/ready` 工作。已检查但因缺证据没有进展且输入版本未变的同一 Case，不得形成无限的 next-turn 循环。

**SF-6** 不让 Leader 与 Reviewer 同时接收同一个常规审批的两个独立自动 notifier。Alpha.6 一旦为一个 Team 启用 Scheduler，旧 `createLeaderControlNotifier` 的直接投递必须在生产装配层互斥禁用，所有同类唤醒统一由 Scheduler 驱动。

### 8.2 WakeSlot（调度状态，不是审批状态）

~~~ts
type WakePhase =
  | 'idle' | 'reserved' | 'queued'
  | 'running' | 'reconciling'
  | 'backoff' | 'suspended';

interface ReviewWakeSlot {
  rootSessionId: string;
  targetInstanceId: string;        // Leader 也可有同结构 slot
  targetSessionGeneration: string;
  phase: WakePhase;
  wakeId?: string;
  claimedTurn?: number;
  assignmentEpoch: number;
  eligibleWorkVersion: string;
  dirty: boolean;
  failureCount: number;
  nextEligibleAt?: string;          // 仅调度退避
  leaseEpoch: number;               // 用于进程/会话接管 fencing
}
~~~

`wakeId` 应是可审计、在同一预留周期稳定的身份（例如 Team + recipient + leaseEpoch + wakeSequence）；发送到 Agent 的通知只携带 token 与待办查询指引，**不附旧审批 payload、allow 标记或权限证书**：

~~~text
[team-review-wake wakeId=<opaque-id>]
Review work may be available.
Use team_list_assigned_reviews for current authorized cases.
This notification carries no approval authority.
~~~

### 8.3 状态迁移

~~~text
idle --eligible work + atomic reserve--> reserved
reserved --inbox acceptance--> queued
queued --agent/inbox/claimed(wakeId, turn)--> running
running --matching durable turn/end--> reconciling
reconciling --no ready work--> idle
reconciling --new ready work + wake budget--> reserved
reserved/queued/running --failure or timeout--> backoff/recovery
any --Team close/user Stop/reviewer disposed--> suspended
~~~

第一轮尚未领取时，如果全部案件已经由其他合法主体解决，应尝试通过精确消息 ID 调用 `Agent.inbox.remove(messageId)`；只撤销插件自己发出的未领取通知，不调用 `inbox.clear()`，不删除历史 Control facts。若消息已被领取，则 Agent 在执行前重新查状态并可空处理结束；旧通知文本永不成为审批来源。

### 8.4 与 DSH Session 轮次的关联

以 `agent/inbox/claimed` 中的消息 ID 与 `turn` 绑定，再以该 `turn` 对应的 Session `turn/end` 为轮次终结事实；`agent/status` 的 idle 转变可辅助确认没有活动 driver。

不能仅用 `whenIdle()` 推断某个特定 wake 已执行，也不能用 `agent/turn-stopping` 当作已完成——该钩子位于真正 `turn/end` 提交之前，可能还有 step。`whenIdle()` 只在 detached observer 中作为整 Agent 静止辅助检测，**绝不从 Agent 生命周期同步钩子、Team 锁或请求链 await 自己的 idle**。

当前 DSH driver 有队列自动执行后续 `next-turn` 的行为：实现必须保证第二个唤醒根本不入队，而非指望首轮之后有机会删除第二条消息。S0 需在固定宿主版本上验证 `claim` / `turn/end` / `status` / `remove` 的时序、事件订阅与 cancel/close 行为。

### 8.5 Acceptance-only 的投递入口

新增 `deliverReviewWake({recipientSessionId, wakeId, text})`：恢复目标 Session、通过必要的归属与生命周期检查、向 Inbox 提交一条明确标记 `source.kind='plugin:dsh-agent-team'` 的消息，**提交成功即返回，不 await Agent 模型完整轮次、whenIdle 或材化结果**。

初版醒来方式：目标空闲时用 `followup`；目标忙碌时最多排一条 `next-turn` followup，避免每条请求 `steer` 到当前运行轮次。若选择 busy `inject` 优化，只能单独 PoC 验证不漏最后一步及用户 Stop 语义，不作为本版依赖。插件来源消息不得伪装 `kind='user'` 来重置宿主关于真人输入的唤醒预算。

### 8.6 轮次结束的唯一补发规则

`reconcile` 必须基于“最新可执行任务集合”，包括 `caseId + currentLegId + assignmentEpoch + relevantEvidenceVersion` 的稳定指纹，不依赖 `pendingCount > 0`。

| 轮次结果 | 后续 |
| --- | --- |
| a/b/c 已全部决定或转交，无新 ready 工作 | 释放 slot；**0** 新 wake |
| 本轮处理了 a，b/c 仍 ready 且尚未检查 | 满足预算后 **1** 个新 wake（处理剩余批次） |
| 处理了 a/b/c，期间又增加 d | **1** 个新 wake 处理 d |
| 旧 a 未解决，本轮没有新事实或输入变化 | 标记 defer/blocked，停止立即重试 |
| 等 Human/Leader/外部证据，尚不能推进 | 等待相应状态变化事件，不空转 |
| Agent 错误/投递失败 | 有界指数退避，保留权威 Case，异常可观测 |

建议调试起点（**非写死的产品常量**）：事件合并 300 ms，自动轮次最小间隔 2 s；单轮目标 5–10 Case；连续轮次预算 3；投递失败 30 s 起指数退避。应该由真实指标决定阈值；节流永远只影响唤醒，不影响请求提交、用户直接批准或规则拦截。

### 8.7 原子边界和 ABA 保护

- `reserve/commit/reconcile` 针对单目标 slot 串行化，且以 `assignmentEpoch` / `leaseEpoch` / `sessionGeneration` 做 CAS fencing；异步网络/Agent 调用必须发生在 TeamDomain/slot 锁外。
- “查询待办为空、释放 slot”的读改写必须与到达事件共享同一串行化或版本比较机制；如果版本已变，立即重算，不丢 wake。
- 新 Router handoff 应将旧 slot 标记 dirty，旧执行体的 `wakeId` 即使回调滞后也不可恢复旧 Assignment。
- 恢复时不得以仅 `status==='idle'` 覆盖“此前入队但未 claimed”的事实，必须先核对 DSH Inbox 与 wake checkpoint。

## 9. 崩溃恢复与真正能保证的语义

**两个独立的持久化边界**：TeamDomain 的 ApprovalCase/调度元数据 与 DSH 的 Session Inbox/turn log。没有原子跨存储事务，不能宣称严格物理 exactly-once 消息投递。

目标保证：

- 健康单实例下 logical single-flight / at-most-one pending Scheduler wake per target；
- 崩溃恢复时至少一次 *工作发现*，不丢待办；通过 wakeId/messageId + Session 事件尽可能撤回/抑制重复；
- 即使因“入队成功但 checkpoint 未提交”的 crash 窗口产生两条物理消息，后领取者也必须先校验 wakeId、Assignment 和 Case 状态，不能造成二次有效批准或无界模型空转；
- 决策唯一性与单次执行仍由 ControlService/ExecutionGrant 的法律保证，而非依赖通知 exactly-once。

恢复规则：

1. 启动时从 TeamDomain 扫描 open Case 与 Assignment，核查 ReviewPlan/mandate generation。
2. 对每个 slot 查 Session Inbox/已领取和已结束的 wake 事件。能确定旧 wake 尚排队则复用；已被领取则观察/核对 turn；确定丢失后才允许同一代的有界重投。
3. Checkpoint 不一致、缺失或无法读取时进入 typed degraded/suspended，记录诊断；禁止在不知前态下批量重复 `followup`。
4. Session Agent 的显式 User Stop 应抑制自动重激活；其待办保持可见并支持人类合法接管。Team close/dispose 不允许后台通知复活 Agent。
5. 多个 Host/Worker 可能同时管理同一 Team 时，需要稳定的单写入 owner/lease 加 fencing token；仅进程内 Map/Mutex 不足以作生产级唯一性保证。若产品保证单实例，需写明并在启动/恢复处拒绝第二个 writer。
6. 低频、无模型消耗的 durable reconcile 可作为丢边沿事件的 repair path；不得通过定时生成模型轮次替代事件驱动。

## 10. 死锁与活性保障

### 10.1 技术死锁

`requestControl`/`requestApprovalLeg` 提交后释放 Team 锁，之后再向 Scheduler 发非权威变更事件；禁止“等 Reviewer 完成后才 ack 请求写入”。Scheduler 不应持锁调用 `ensureLiveAgent`、`followup`、`whenIdle` 或模型工具。审查工具返回当前可用状态，不等待同一审查轮次关闭。

### 10.2 业务依赖环

典型场景：`Leader 同步等待 Member 工作结束` -> `Member 需要 Leader 全局审批` -> `Router 分派 Leader` -> `Leader 当前轮次无法结束`。专职 Officer 可消除大多数日常审批等待，但同层级必须由 Leader 判断的特殊 Case 仍可能形成环。

需要至少有一个受测的依赖链 / typed deadlock indicator：若接收者正在同步等待请求者（或形成更长闭环），不得静默排队永远等待；应允许**明确批准的异步解耦**，或报告 `review-dependency-cycle` 并提供合法人工干预/Stop 入口。不得因 deadlock 自动批准、提升权限、强制中断有副作用操作或悄悄改变已承诺的同步调用语义。

Officer 审查自己的工具请求、审批自己的委托更新、借另一节点间接自批等必须拒绝；同样不能把 `handoff` 误写成 `escalateApprovalLeg` 来绕开环。

## 11. 审查工具、最小 UI 与可观测性

仅讨论候选接口，名字由 S0 确认：

- `team_list_assigned_reviews`：读当前可处理 Case 的最小投影和证据引用，服务端按实际 caller + Assignment + Mandate 过滤；不得读取其他 Member 不相关的敏感 payload。
- `team_review_decide`：提交 `allow/deny` 建议，经可信委托入口映射到同一个 ControlService 决策写入，并回传真实成功/失败；不让模型直接传 Leader principal。
- `team_review_handoff`：保持 current leg 不变，执行 Assignment CAS（Officer -> Leader）。
- `team_review_defer`：记录缺什么证据/恢复条件；只影响调度，不构造 ControlDecision。
- 正式 `escalate` 继续复用既有 Alpha.4 入口；对未授权的 Reviewer 不暴露该工具。

UI 至少区分：`approval open`、`assigned to reviewer`、`wake queued/running`、`blocked/deferred`、`handoff to leader`、`human required`；展示 caseId/current leg、受限审查者、最后醒来原因、最后一轮进度、告警。不要把 pending inbox 消息数当 pending Case 数。

指标：`review_wake_submitted`、`review_wake_claimed`、`review_turn_completed`、`review_wake_suppressed`、`review_stale_wake_removed`、`review_empty_turn_count`、`review_case_latency_p50_p95`、`review_no_progress_cycles`、`review_deadlock_alert`、`review_fallback_count`。观察后才能评价是否真正降低 Leader 负担。

## 12. Alpha.4 / Alpha.5 兼容与启用

- 不修改 Alpha.4 的四位置权限阶梯，保留 `ControlReviewAction = allow | deny | escalate` 及升级 leg 事实。`handoff` / `defer` 只能写专用的非审批决策记录，绝不能伪装 `deny/escalated`。
- 保持 `teamHardEnvelope`、`permissionMutationEnvelope`、`externalHard` 的原始含义和 fail-closed 逻辑；`Human Admin` 不可因为 ReviewPlan 出现而被构造。
- Alpha.5 的 `Operation Admission`、整 EffectSet ApprovalCase、ExecutionGrant 和实际 IO/Provider Assurance 路径各自闭合后，Reviewer 入口才能接它们的已批准生产面；每一种未打通的 surface 保留原拒绝行为。若 Alpha.5 改变 authority generation 或多效果 identity，ReviewTask 重新推导，不复制旧身份公式。
- 默认无 Alpha.6 ReviewPlan 的 Team **保留原行为**（可观察但不悄悄变更）；明确 opt-in 的 Team 用唯一 Scheduler 通道替代直接 C1 notifier，不允许两者同时生产。
- 切换时对旧 `[team-control requestId=...]` 残留 next-turn 通知，仅在可证明为插件所有、仍未被 claimed、且对应 Case 不再需要该通知时精确移除；不允许 `inbox.clear()` 破坏用户或工作消息。
- 功能未稳定、插件重启失败、委托失效、Reviewer 归档等情况进入 typed degraded；保持控制面可查询、已有 Human/Leader 合法入口可用，但不悄悄回退成双路 notifier 或默认允许。

## 13. 未来工程纪律系统兼容：只保留最小抽象

可复用：`ReviewTaskRef`（将来 kind 可扩展为 discipline）、`ReviewAssignment`、`ReviewWakeSlot`、`ReviewEvidenceReference`、去重/观察/调度的基础设施。

不可复用为同一种法律：权限批准的 `ControlDecision` 与未来对代码/文档/科学事实的 `DisciplineFinding`。后者可能产出证据不足、规范不符、需整改或上报等结论，但**不应被默认为一次工具授权**。未来纪律治理需要独立的规则来源、证据版本、整改状态和阻断动作接口；其权限动作仍由相应领域的确定性内核实施。

Alpha.6 不引入完整 `DisciplineContract`、规则 DSL、Assertion/Argument 真值库或科研语义检查。现在把唤醒机制抽象成“按执行体处理独立可查询任务”，已经足够兼容未来工作。

## 14. 实施切分（建议，不代表授权开工）

| 阶段 | 主要内容 | 实施/评审门 |
| --- | --- | --- |
| S0 | 固定上游宿主 commit、真实 Inbox / turn lifecycle PoC、确认 ReviewPlan 冻结入口及 Alpha.5 生产接口 | 真实 Host ABC 重现；两个存储边界；双 writer/Stop 语义；决策入口 source audit |
| PR0 | Reviewer 受限身份、ReviewPlan/Mandate 及负控 | 不能伪装 Leader、跨 Team、自批、超 Mandate 或凭角色字段增权 |
| PR1 | 受限 `team_review_decide` 到单一 ControlService 写入内核 | 与原 Leader/Human 决策路径同法律；并发/过期拒绝；不另建 allow |
| PR2 | Router + Assignment/Handoff（同 leg） | 全局性案件归 Leader；handoff 不升权；CAS 竞争受控 |
| PR3 | Single-flight WakeSlot + acceptance-only 投递及 Source 归属 | 100 请求最多一条在途通知；ABC 首轮全部处理后不再空转 |
| PR4 | 轮次 claim/end 关联、stale next-turn 清理、崩溃恢复和防空转 | Stop、busy、crash window、交叉消息、no-progress、租约恢复 |
| PR5 | Leader/Reviewer 回归、Alpha.5 Admission 组合及死锁负例 | 真 DSH Agent 运行与每种审批路径 zero-effect negative control |
| PR6 | 最小 UI/observability、部署/迁移 runbook 与验收收口 | 可观测、原 Team 未启用时不回归、审查者独立复核 |

更偏向尽快得到收益时，可把 PR2/PR3 做成紧邻、独立审查后连续落地；但 Reviewer 权限入口（PR1）未完成安全门之前，不得把其审查意见连接到 `allow`。粗略工程量：可用 MVP 约 8–15 个熟悉仓库的工程人日；可靠发布约 15–25 人日，Alpha.5 和宿主接口 PoC 可能改变估计。

## 15. 硬验收矩阵与负控

| ID | 输入 / 竞争条件 | 期望 |
| --- | --- | --- |
| A6-SF-01 | a、b、c 短时间创建；同一轮处理完 abc | **仅 1 次有意义的审查唤醒；无 b/c 剩余通知唤醒额外轮次** |
| A6-SF-02 | 100 个不同 Case 同时创建 | 同一目标至多 1 条在途逻辑 wake / 1 个有效 queued 通知 |
| A6-SF-03 | 首轮只处理 a、留下 b/c | 轮次结束只发 1 条新 wake，而不是 2 条 |
| A6-SF-04 | 首轮处理 abc，运行中又新增 d | d 最终被观察并获合法处理；不会漏唤醒或重复唤醒 |
| A6-SF-05 | a 在通知被领取前由 Human 决定 | 定向删除旧未领取 wake，或进入零业务动作空轮；无二次批准 |
| A6-SF-06 | a 无法处理、无新证据且仍 pending | 不存在无限轮次/高速重复投递；defer/blocked 可诊断 |
| A6-SF-07 | release slot 与新事件并发 | 无 lost wake、无双 wake；CAS/版本重查 |
| A6-SF-08 | 入队成功后 checkpoint 写入前崩溃 | 恢复重查 inbox/log；无重复权限效果；重投次数有界 |
| A6-SF-09 | queued 后 Host 重启/Agent resume | 待办保留并最终可处理；无批量重放风暴 |
| A6-SF-10 | Reviewer Stop/Dispose/Team close | 不自动复活 Agent；待办可见、合法接管 |
| A6-AUTH-01 | Member 试图伪造 Reviewer/Leader 身份 | typed 拒绝；零 ControlDecision/零 grant |
| A6-AUTH-02 | Reviewer 自批、跨 Team、过期 Mandate、跨 generation | 全部拒绝并保留审计 |
| A6-AUTH-03 | Reviewer 申请处理 Human User/Admin rung | 无下放、无虚构 Admin resolver |
| A6-AUTH-04 | Officer handoff 给 Leader | 保留当前 leg/requiredAuthority，不产生 Alpha.4 escalation fact |
| A6-AUTH-05 | Reviewer 与 Leader/Human 同时裁决同一 leg | 至多一条有效决定，败者 stale/decided typed 拒绝 |
| A6-AUTH-06 | Approval 后权限或 exact scope 漂移 | 执行前重验拒绝过期授权，不因消息处理成功放行 |
| A6-DEAD-01 | Leader 同步等 Member，Member 等 Leader 审批 | 明确可观测依赖循环与安全解耦/接管路径，不无限静默挂起 |
| A6-INT-01 | Alpha.5 多效果工具、一条 ask 包含多个 Effect | 仍遵守整体审批和一用 Grant，无“某部分被批就全部执行” |
| A6-COMP-01 | 既有未启用 Alpha.6 的 Team | 原 C1 路径行为不被静默改变；新模式绝无双 notifier |
| A6-METRIC-01 | 同一回放工作负载对比 | 对照 Leader 唤醒次数、空轮次、p50/p95 延迟、token 和故障成本 |

**不可用单测替代**：至少一组真实 DSH Agent + 持久化 Session/TeamDomain 的完整 ABC，覆盖 `followup` 队列、`inbox/claimed` / `turn/end` 时序、旧通知精确撤回、Stop/Resume、故障注入；以及安全负控中检查工具 body 真实零效果，不只看返回文本。

## 16. S0 待裁问题及选型分叉

| 问题 | 首选 | 若证据不支持 |
| --- | --- | --- |
| 是否能在插件层唯一关联 wakeId -> claimed turn -> turn/end？ | 公共事件 + Session 事件，零 Core patch | 采用可验证的代理层回执及 pre-step 过滤；如果仍无法闭合则不宣称零空轮，明确上游改动需求 |
| 冻结 ReviewPlan 从哪里进入？ | 可信 Host/Team 侧不可变绑定，不改 v3 | 必须单独审批 schema vNext 或独立版本化配置；不通过 unknown metadata 偷载权限 |
| 跨 TeamDomain / Inbox 的 crash 窗口怎样恢复？ | checkpoint + inbox 消息 id + session event + fencing | 无法辨认的状态 fail closed，并保留人工恢复路径 |
| 是否支持多写入进程？ | 若确有多进程，CAS lease + fencing | 若实际单进程，明确禁止双 writer，并留安全扩大接口 |
| Legacy `ControlRequest` 如何处理？ | 不路由到 Reviewer，保留现有 Leader | 有真实 Case identity / scoped authorization 的迁移 PoC 才开放 |
| Alpha.5 生产 Admission 尚未闭合怎么办？ | 保留原有工具拒绝语义，Alpha.6 只接已核准的生产入口 | 延后对应能力启用，不以文档或 DORMANT 单测冒充 GO |
| Reviewer 自身出错、卡死、无法处理？ | 显式 blocked/defer、有限退避、合法 Leader/Human 接管 | 无安全处理路径时保留 pending 和诊断，绝不自动 allow |
| 对旧 C1 队列做多大范围清理？ | 按 messageId 删除已确认是旧插件唤醒且 unclaimed 的消息 | 不可证明来源则不删除，只让接收方查询现态并空处理 |

本 Draft 的默认选型是：**不改权限阶梯、不复刻审批存储、不创建第二个 Leader、不按请求直接 `followup`、不假定物理 exactly-once、不预实现纪律系统**。需要运行时接口实证或更改冻结规范的事项，必须在 S0 记录结果后另行裁决。

## 17. 参考源码及权威文档

- [Alpha.4 ADR](../../active/alpha4-permission-governance/ADR-alpha4-hard-governance.md) 与 [Alpha.4 Spec](../../active/alpha4-permission-governance/alpha4-permission-governance-spec.md)。
- [Alpha.5 PoC 后技术设计](../alpha5-tool-io-governance/post-poc-technical-design.md) 与 [S0/PR0–PR8 计划](../alpha5-tool-io-governance/alpha5-s0-pr0-pr8-implementation-plan.md)：其产品可用性必须按实际验收矩阵，而非单个 PR 通过判断。
- [现有重复唤醒技术债 CTL-1](../post-alpha4-debt-register.md)。
- [ControlService](../../../../packages/runtime/control/service.ts)；[ControlTypes](../../../../packages/runtime/control/types.ts)；[Leader notifier](../../../../packages/runtime/control/leader-notification.ts)。
- [Caller 身份解析](../../../../packages/runtime/admission/resolve.ts)；[operation-approval-routing](../../../../packages/runtime/operation-permission/approval-routing.ts)；[plugin 生产装配](../../../../packages/runtime/src/plugin/root.ts)；[Agent live glue](../../../../packages/runtime/src/plugin/live/agent-bindings.mjs)。
- 上游 DSH：`packages/core/agent/src/runtime-types.ts`、`packages/core/agent-loop/src/agent.ts`、`packages/core/agent-loop/src/inbox.ts`（在 [ArmourPiercer1/deepseek-harness](https://github.com/ArmourPiercer1/deepseek-harness)；实现须在 S0 pin 确切版本）。
