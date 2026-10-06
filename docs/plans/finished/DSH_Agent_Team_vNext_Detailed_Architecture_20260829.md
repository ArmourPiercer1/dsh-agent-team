# DSH Agent Team vNext 详细架构设计

**文档性质**：下一主版本架构权威基线（Architecture Baseline）  
**状态**：已归档｜Architecture Frozen（语义基线已完成冻结；实现已推进至 P9/T12，未执行 P10）  
**真正执行进度**：作为 vNext 架构权威基线完成；2026-09-02 随冻结文档移入 `docs/plans/finished/`，后续实现按本文件语义执行。  
**完成时间**：2026-09-02（冻结归档节点；冻结语义继续作为只读权威）  
**日期**：2026-08-29  
**目标产品**：DSH Agent Team vNext  
**目标宿主**：`deepseek-ai/deepseek-harness`  
**目标交付形态**：独立外部插件 `dsh-team-vnext`  
**核心约束**：`CORE PATCH BUDGET = 0`

> 本文规定下一版 Team 的对象模型、所有权、持久化边界、运行时语义、信息流、权限模型、生命周期、兼容性、恢复与 fork 语义。  
> 本文**不规定**文件路径、package 拆分、具体类名、函数签名、Phase、提交顺序或 coding task；这些内容属于后续《详细开发计划》和《任务分包与审查方法》。

---

## 0. 规范性说明与权威关系

### 0.1 规范词

本文使用以下词义：

- **MUST / 必须**：违反即属于架构错误；实现不得自行降级。
- **MUST NOT / 禁止**：任何实现均不得采用。
- **SHOULD / 应**：默认要求；只有出现经验证的宿主限制时才可调整接线，但不能改变用户可观察语义。
- **MAY / 可以**：允许的实现或产品扩展，不构成 vNext 必备语义。

### 0.2 本文的输入基线

本文综合并重新核对了：

1. `DSH_Agent_Team_vNext_Architecture_Baseline_20260827.md`；
2. `DSH_Agent_Team_vNext_Compatibility_Design_20260828.md`；
3. `DSH_Agent_Team_vNext_UI_Interaction_Design_20260828.md`；
4. `DSH_Agent_Team_vNext_Unattended_Execution_Spec_20260829.md`；
5. 本轮 0-core 架构重审与用户确认的最终决策；
6. DSH upstream 当前代码基线；
7. fork 中最新 Team 相关分支的现有实现。

代码审计点：

```text
deepseek-ai/deepseek-harness
master = cd5ef8148158c3a752a658978873241fdf8e2bbc

ArmourPiercer1/deepseek-harness
feat/team-vnext-integration-20260829 = a3ab31992762c5d6560797eabc7e0885a9320ade
feat/agent-teams                  = 506191ba893ac55980dd09680c438710ab24095b
```

### 0.3 本文明确取代的旧语义

若旧文档、旧代码或旧开发计划与下列条目冲突，以本文为准。

| 旧语义 | vNext 最终语义 |
|---|---|
| Root Session log 保存 Team control-plane state | **TeamDomain sidecar 是 Team control-plane durable authority** |
| child Team event 保存 Member self-binding | **TeamDomain 保存 Team membership/binding；child Session 只保存该 Agent 的第一人称执行历史** |
| 为 Team 新增 `team-session/*`、`team-instance/*` 等 DSH SessionEvent | **禁止新增 Team-specific DSH SessionEvent vocabulary** |
| Member = continuable subagent activation | **MemberInstance = Team-owned Agent + Session；ordinary subagent 只是 Member 的后代能力** |
| `memberId` 同时充当定义和运行时 identity | **`templateId` 是静态定义；`instanceId` 是运行时 identity** |
| 一个 teammate 定义最多一个 activation | **一个 MemberTemplate 可产生 0..N 个 persistent MemberInstance** |
| workspace/cwd 驱动当前 roster | **Team identity session-bound；workspace 只是 instance 的运行位置** |
| `ctx.team` mutable current roster | **不可存在跨 Session 的 mutable current-team authority** |
| Team = AgentPreset | **TeamSession 与 AgentPreset 正交** |
| 通过修改 `dsh-persona` 加 persona override seam | **0-core；`complete:true` AgentPreset 对 Team 为 structural FATAL** |
| `ARCHIVED -> restore -> RUNNING` | **`ARCHIVED -> Restore -> SETTLED`；新 work 才 Resume/activate -> RUNNING** |
| 自动升级旧 Team Session | **旧 Team Session 只读；不自动迁移** |
| 在 upstream Host/SessionController/Client owner 中接 Team wiring | **外部插件仅消费公开 seam；Team-required upstream diff 必须为 0** |

### 0.4 核心开发原则

```text
CORE PATCH BUDGET = 0
```

Team vNext 必须能够从一个 upstream-clean DSH 上通过外部插件加载。

如果某项冻结的用户行为确实无法经现有公开 seam 实现，实现阶段必须输出：

```text
CORE_SEAM_BLOCKER
```

并停止该行为的实现；不得先打临时 core patch 再“以后清理”。

---

# 1. 架构目标

Team vNext 的目标不是为现有 Team Mode 增加更多工具，而是重新建立**身份、所有权、持久化和运行时边界**。

最终系统必须满足四个基本目标。

## 1.1 静态定义与动态实体分离

```text
TeamBlueprint / LeaderTemplate / MemberTemplate
                │
                │ instantiate / bind
                ▼
TeamSession / LeaderInstance / MemberInstance
```

静态定义说明“团队和角色是什么”；动态实体说明“这次实际运行的是谁”。

## 1.2 Team 与普通 DSH Agent 基础设施正交

Team 不创造第二套 LLM runtime、Session、Conversation、Trajectory、Tool 或 AgentPreset 系统。

它建立的是：

```text
DSH Agent/Session substrate
        +
Team-owned aggregate control plane
```

## 1.3 Durable Team identity 不依赖进程内 registry

进程内 cache、live Agent handle、UI store、当前 cwd 都不能成为 Team identity 或 roster 的权威来源。

## 1.4 运行时可变性必须有明确 authority 和生命周期

model、tools、permissions、skills、MCP、workspace、context policy 等字段不能用一个模糊的 `mutable=true` 表示。任何运行时变化都必须回答：

1. 谁可以改变；
2. 在什么边界改变；
3. 允许改变到什么范围；
4. 是否持久；
5. 对当前 in-flight work 还是 future work 生效；
6. 是否会被 PolicyState 或 External Hard Policy 抑制。

---

# 2. 明确不属于 vNext 的内容

为避免 Team vNext 膨胀成 workflow engine，本版本明确**不实现**：

```text
formal WorkstreamInstance
WorkflowState
automatic workflow transition
automatic task-completion inference
DAG scheduler
router-driven automatic activation
arbitrary transition effects
Git branch/worktree lifecycle management
cross-route mandatory information-flow control
Blueprint hot upgrade / rebind
per-member AgentPreset
instance conversation cloning
cross-Session live memory/history search
Team-specific DSH SessionEvent vocabulary
core/host/client patch dependency
official private experimental Agent Teams runtime dependency
```

未来 Router / Workflow / Workstream 可以建立在本文保留的扩展缝之上，但不能反向污染本版本的核心对象模型。

---

# 3. 系统边界与所有权

## 3.1 DSH upstream 拥有

DSH 继续拥有：

```text
Agent factory / Agent lifecycle primitive
Session and first-person durable execution history
AgentPreset composition
ModelSelection / provider-model-effort routing
System Prompt assembly infrastructure
Tools registry and execution pipeline
Skills registry
MCP capability substrate
Permission / hard restriction substrate
Generic Subagent
StorageDomain infrastructure
Remote/Typert infrastructure
Client module graph
Conversation
Trajectory
Native Session fork primitive
```

Team 只能消费这些公开能力，不复制其内部实现。

## 3.2 Team plugin 拥有

Team plugin 拥有：

```text
TeamBlueprint catalog and immutable snapshot semantics
TeamIntent
TeamSession binding
LeaderTemplate / MemberTemplate
LeaderInstance / MemberInstance
TeamDomain durable state
Team activation / admission
Team policy resolution
Team compatibility state
Team lifecycle
Team coordination messages
Team control/approval state
Team progress/activity coordination facts
Team ledger
Team aggregate projection
Team Remote API
Team UI
legacy Team adapters
```

## 3.3 AgentPreset 与 TeamSession 正交

根对象关系：

```text
Root DSH Session
├─ AgentPreset binding
├─ ModelSelection
└─ optional TeamSession binding
```

两者回答不同问题：

- **AgentPreset**：这个 Agent 的 ordinary model-facing composition 是什么？
- **TeamSession**：这个 Root Session 是否属于某支具体 Team，并拥有哪些 Team runtime 语义？

因此：

```text
TeamSession != AgentPreset
TeamBlueprint != AgentPreset
```

一个名为 `team` 的 AgentPreset 可以存在，但它只是一份推荐的 Team-friendly ordinary composition，不是 Team Mode 开关，也不是 Team runtime 依赖。

---

# 4. 总体对象模型

```text
                       TeamBlueprintCatalog
                               │
                     resolves immutable revision
                               │
                               ▼
                        TeamBlueprint@R
                 ┌─────────────┼─────────────┐
                 │             │             │
          LeaderTemplate  MemberTemplates  Policy/Quota/
                                      ...  Requirement defs
                 │             │
                 │             └──────────────┐
                 ▼                            │ instantiate 0..N
          LeaderInstance                     ▼
        (= Root Agent/Session)          MemberInstance
                 │                     ├─ instanceId
                 │                     ├─ childSessionId
                 │                     ├─ workspace
                 │                     ├─ context
                 │                     ├─ overlays
                 │                     └─ lifecycle
                 └──────────┬─────────────────┘
                            │
                            ▼
                       TeamSession
                 id = RootSessionId
                 immutable Blueprint snapshot
                 policy state / overrides
                 compatibility / admission
                 Team ledger / membership
                            │
                            ▼
                        TeamDomain
                    durable authority
```

运行时还存在三个与 durable object 不同的概念：

```text
MemberInstance (durable Team identity)
        │
        ├── DSH Session (durable first-person history)
        │
        └── live Agent residency (ephemeral process object)
```

这三层必须始终分开。

---

# 5. TeamBlueprint

## 5.1 定义

**TeamBlueprint** 是一个完整、稳定、可复用、可版本化的团队定义。

它回答：

> “这支团队是谁，它允许怎样产生和治理运行实例？”

它不是某次运行，也不是某个 workspace 的 roster。

## 5.2 Blueprint identity

概念上至少包含：

```text
blueprintId      stable logical identity
displayName      human-facing name
revision         human-readable revision
contentHash      machine content identity
source           source/provenance
metadata
```

以下内容不能定义 Blueprint identity：

```text
filesystem path
workspace path
current cwd
displayName
AgentPreset id
```

移动 Blueprint 文件或重命名显示名不得自动改变其 `blueprintId`。

## 5.3 Blueprint 必须完整包含 Leader

一个有效 Blueprint 必须有**恰好一个完整的 LeaderTemplate**。

禁止：

```text
Blueprint only defines teammates
+ root Agent identity comes from unrelated preset persona
```

这种结构会重新引入“UI 看起来是某支 Team，但 Leader 实际 persona 没加载”的静默失效。

## 5.4 Blueprint 包含的语义类别

至少包括：

```text
LeaderTemplate
MemberTemplates
capability requirements
Team autonomy/mutation envelope
Member mutation envelopes
PolicyState definitions (optional)
instance/team quotas
Team-owned ordinary capability policy
metadata
```

Blueprint **不包含**：

```text
raw Cordis composition
plugin package graph
DSH AgentPreset implementation
live Agent handles
Session history
runtime MemberInstance roster
```

## 5.5 强校验

Blueprint 在进入可用 catalog 前必须整体通过强校验。

必须至少验证：

- identity/revision/contentHash 合法；
- exactly one LeaderTemplate；
- MemberTemplate identity 唯一；
- template 引用可解析；
- requirement domain 可被系统真实 probe；
- mutation envelope 自洽；
- PolicyState 不引用不存在的字段；
- quota 合法；
- 不声明明显违反不可越过 External Hard Policy 的行为。

不允许“部分 Member 解析失败，剩余成员继续登记”为正常成功路径。

## 5.6 Blueprint snapshot

TeamSession 创建时必须冻结一个**resolved Blueprint snapshot**。

冻结范围包括所有 Blueprint-owned semantics，例如：

```text
LeaderTemplate
MemberTemplates
base model declarations
requirements
Team/member policy
mutation envelopes
PolicyState definitions
quota
Blueprint-owned permission defaults
metadata needed to interpret runtime state
```

不冻结外部环境，例如：

```text
actual model/provider availability
actual tool availability
current MCP availability
current skill availability
system/managed hard policy
workspace/project hard policy
```

因此旧 TeamSession 可以继续解释自己的 Blueprint，但不能用旧 snapshot 绕过后来变严格的外部安全策略。

## 5.7 Revision 语义

TeamSession 创建：

```text
Blueprint rev17
        ↓ snapshot
TeamSession T -> rev17
```

之后 catalog 更新：

```text
Blueprint rev18
```

结果：

```text
existing TeamSession T -> remains rev17
new TeamSession         -> may use rev18
```

vNext 不支持运行中 TeamSession hot-upgrade 或 rebind。

---

# 6. LeaderTemplate 与 MemberTemplate

## 6.1 LeaderTemplate

LeaderTemplate 是 Blueprint 中对唯一 Leader 的静态定义。

它与普通 MemberTemplate 共享尽可能多的语义字段，例如：

```text
identity / display metadata
persona
base model preference/policy
tools policy
permission policy
skills policy
MCP policy
approval/control policy
context policy
mutation envelope
```

但其实例化结果只能是 TeamSession 的 Root LeaderInstance。

## 6.2 MemberTemplate

MemberTemplate 描述一种**可以被实例化多次的团队角色/能力模板**。

概念上包含：

```text
templateId
role/name/description
persona
base model/provider preference
requirements
tools policy
permissions policy
skills policy
MCP policy
approval policy
context policy
member mutation envelope
instance quota
metadata
```

## 6.3 Template 不是 runtime actor

MemberTemplate：

- 不运行；
- 不拥有 Agent；
- 不拥有 Session；
- 不拥有 conversation；
- 不拥有 workspace；
- 不拥有 lifecycle；
- 不接受 follow-up；
- 不参与 message addressing。

所有运行时行为必须指向 `MemberInstance`。

---

# 7. TeamIntent：创建前的暂态对象

## 7.1 目的

0-core 架构下，新 Team 的配置和 compatibility acknowledgement 不应伪装成一个普通 blank DSH Session。

因此引入：

```text
TeamIntent
```

作为 Team plugin 自己拥有的**创建前 staging object**。

## 7.2 TeamIntent 可以包含

概念上可包含：

```text
intentId
selected Blueprint revision
selected AgentPreset
default workspace
staged runtime/user configuration
compatibility result
warning acknowledgements for this creation attempt
optional Start-Team-from-Here handoff provenance
```

## 7.3 TeamIntent 不是什么

TeamIntent：

```text
!= TeamSession
!= Root Session
!= Agent
!= durable Team runtime identity
```

它是否跨浏览器刷新持久化属于 UI/product persistence 选择，不影响 TeamSession 架构；任何 TeamIntent storage 都不得成为已创建 TeamSession 的 authority。

## 7.4 创建边界

只有在创建条件满足后，才建立真实 Root Session 与 TeamSession binding。

概念流：

```text
New Team
  ↓
TeamIntent
  ↓
Blueprint + AgentPreset selection
  ↓
compatibility probe
  ├─ FATAL -> cannot create operational Team
  ├─ WARNING -> explicit acknowledgement required
  └─ PASS
  ↓
create Root DSH Agent/Session
  ↓
bind TeamSession
```

---

# 8. TeamSession

## 8.1 定义

**TeamSession** 表示：

> 某个 Root DSH Session 对某一个确定 Blueprint revision 的不可变 Team runtime binding。

基数：

```text
Root Session -> 0 or 1 TeamSession
TeamSession  -> exactly 1 Blueprint snapshot
```

## 8.2 Identity

不建立额外 TeamSession UUID：

```text
TeamSessionId = RootSessionId
```

因为 TeamSession：

- 不可 detach 后转移；
- 不可绑定到第二个 root；
- 生命周期与该 Root Session 的历史身份一致。

## 8.3 TeamSession 主要拥有

概念上：

```text
rootSessionId
immutable Blueprint snapshot
defaultWorkspace
currentPolicyState
TeamSession-local template overrides
explicit human session overrides
compatibility/admission state
LeaderInstance identity
MemberInstance membership
quota counters / consumed creation budget
Team ledger
handoff provenance, if any
```

## 8.4 Blueprint binding 不可原地替换

一旦 TeamSession 已正式绑定：

```text
AIUED-ALGO@17
```

不能原地切成：

```text
AIEO@4
```

即使 Root 尚未执行第一 turn，也应通过新 TeamIntent / 新 Root Session 更换 Blueprint。

## 8.5 AgentPreset 的切换窗口

TeamSession 与 AgentPreset 正交，但 AgentPreset 不能在运行历史任意阶段变化。

兼容旧设计的最终规则：

```text
PresetSwitchAllowed
=
RootHasNoTurn
AND
NoMemberProvisioningEverStarted
```

若在这一窗口切换 AgentPreset，必须重新执行 compatibility probe。

一旦：

```text
first Root turn
OR
first Member provisioning
```

发生，AgentPreset 对该 TeamSession 锁定。

在 0-core UI 中，最常见路径仍应是在 TeamIntent 阶段完成 AgentPreset 选择；上述规则用于定义已经创建但尚未开始工作的边界语义。

## 8.6 TeamSession 没有独立“Member式 lifecycle”

`CREATED/RUNNING/SETTLED/ARCHIVED/DISPOSED` 是 MemberInstance lifecycle，不是 TeamSession lifecycle。

TeamSession 本身是 Root Session 的 durable Team binding。其“是否允许产生新 Team work”由 **Admission State** 管理，而不是把 TeamSession 塞入 Member lifecycle FSM。

---

# 9. LeaderInstance

## 9.1 定义

LeaderInstance 是 MemberInstance 对象模型中的唯一特殊成员。

```text
LeaderTemplate
      ↓
LeaderInstance
      = Root Agent + Root Session
```

## 9.2 固定约束

每个 TeamSession：

```text
exactly one LeaderInstance
```

LeaderInstance：

```text
is root Agent/Session
has no childSessionId
cannot spawn another leader
cannot archive independently
cannot dispose independently
lifecycle/residency follows Root Agent/Session behavior
```

## 9.3 为什么 Leader 仍纳入统一成员模型

虽然 Leader 不是 child Member，但以下信息应使用同一套 identity/projection/policy 语义：

- persona identity；
- effective model metadata；
- effective Team policy；
- runtime overrides；
- message attribution；
- Team ledger actor identity；
- UI member presentation；
- audit provenance。

这避免“Leader 是一个外部特殊物体，而 Member 又是另一套对象”的长期不对称。

---

# 10. MemberInstance

## 10.1 定义

**MemberInstance** 是团队中真正可以长期运行、继续对话、被寻址和被治理的执行实体。

一个 MemberTemplate 可以生成：

```text
0..N MemberInstances
```

## 10.2 Instance identity

运行时 identity 必须使用系统生成的稳定 `instanceId`。

概念 identity：

```text
(rootSessionId, instanceId)
```

`instanceId` 在一个 TeamSession 内唯一；组合键保证跨 TeamSession 不混淆。

`templateId`、`label`、`groupId` 均不是运行时 identity。

允许：

```text
templateId = researcher
label = Fourier
instanceId = inst-A

same templateId = researcher
same label = Fourier
instanceId = inst-B
```

二者仍是完全不同的 persistent MemberInstance。

## 10.3 MemberInstance 概念属性

至少包括：

```text
instanceId
templateId
label
groupId?
workspace
childSessionId
creation-time effective configuration
contextPolicy
runtime/autonomy overlay
explicit user instance override
lifecycle
createdAt / activity metadata
current compatibility/admission impact
```

## 10.4 MemberInstance = Team-owned Agent + Session

vNext 中：

```text
MemberInstance
!= DSH continuable subagent activation
```

而是：

```text
MemberInstance
  ├─ durable Team identity in TeamDomain
  ├─ one durable DSH child Session
  └─ zero or one currently resident live Agent handle
```

Team runtime 通过 DSH 公开 Agent factory 生命周期管理其 live Agent。

## 10.5 Generic Subagent 与 MemberInstance 并存

Member Agent 仍可以使用普通 DSH subagent/workflow 能力：

```text
TeamSession
└─ MemberInstance
   └─ ordinary generic subagent
      └─ ordinary descendant ...
```

这些 generic subagent：

- 不进入 Team membership；
- 没有 MemberInstance identity；
- 不继承独立 MemberTemplate；
- 仍由 DSH ordinary subagent 语义管理；
- 在所属 Member Archive/Dispose 时，若仍 resident，必须参与 descendant drain。

---

# 11. `contextPolicy` 的最终消歧

旧实现存在：

```text
persistent
fresh_per_delegation
```

但旧的 `fresh_per_delegation` 是建立在“一个 member definition 对应一条可替换 activation”的模型上；这与 vNext 的 persistent MemberInstance identity 冲突。

vNext 采用以下最终解释。

## 11.1 Persistent instance invariant

一旦 `MemberInstance` 创建，它绑定一个 durable child Session；对该 `instanceId` 的后续 follow-up / work 必须继续同一 Session 与同一身份历史。

禁止：

```text
same instanceId
→ silently replace child Session
→ pretend history is fresh
```

## 11.2 `persistent`

含义：

> 对同一 MemberInstance 的后续 work 继续该 instance 的原 child Session。

这是默认行为。

## 11.3 `fresh_per_delegation`

在 vNext 中解释为**实例创建策略**而不是“重置实例上下文策略”：

> 当 leader 以“新 delegation”方式调用某个采用 `fresh_per_delegation` 的 MemberTemplate 时，默认创建一个新的 MemberInstance；新的 instance 获得新的 child Session 和独立上下文。

因此：

```text
Delegation #1 -> inst-A -> Session A
Delegation #2 -> inst-B -> Session B
```

而不是：

```text
inst-A -> Session A
inst-A -> Session B  # forbidden identity break
```

对已经明确寻址 `inst-A` 的 follow-up 永远继续 Session A。

这使旧配置的“每次委派希望干净上下文”意图与 vNext “一个 instance 是 persistent identity”同时成立。

---

# 12. groupId

`groupId` 是可选 opaque grouping metadata。

例如：

```text
researcher#A
developer#A
reviewer#A

groupId = route-fourier
```

vNext 中 group：

```text
has no identity
has no owner semantics
has no state machine
has no permission semantics
has no lifecycle
has no automatic activation
has no completion semantics
```

它只用于表达：

> “这些 MemberInstance 在逻辑展示上属于同一组/路线。”

未来若引入正式 WorkstreamInstance，`groupId` 可以作为迁移线索，但 vNext 不预先赋予其 workflow 含义。

---

# 13. AgentPreset、persona 与 ModelSelection

## 13.1 AgentPreset 的职责

AgentPreset 继续提供 ordinary Agent composition，例如：

```text
tools
skills
MCP consumers
prompt sections
persona assembly semantics
compaction
planning/delegation ordinary capability
other Agent-scoped plugins
```

MemberInstance 默认继承 Root AgentPreset 的 composition substrate。

vNext 不支持 per-member AgentPreset selector。

## 13.2 ModelSelection 独立于 AgentPreset

provider/model/reasoning effort 属于 per-Agent ModelSelection route，而不是 AgentPreset identity。

因此：

```text
Agent substrate = AgentPreset composition
Model route     = ModelSelection
Team semantics  = TeamSession/Member overlay
```

三者是不同维度。

## 13.3 Persona ownership

Team Blueprint 拥有：

```text
LeaderTemplate.persona text
MemberTemplate.persona text
```

AgentPreset / persona subsystem 拥有：

```text
persona assembly semantics
complete semantics
runtime-context assembly behavior
other future persona semantics
```

## 13.4 `complete:false`

对于可被 scoped persona shadow/Team identity 正常组合的 AgentPreset：

```text
Blueprint persona text
+
AgentPreset assembly semantics
```

形成最终 Team identity。

## 13.5 `complete:true`：结构性不兼容

DSH 的 `PromptSection.complete=true` 表示该 section 是唯一 system prompt；其完整 section 在 assemble waterfall 后仍被恢复，因此外部 middleware 不能可靠地只替换 text 而保留完整语义。

在 0-core 条件下，Team 不实现通用 persona-text override core seam。

因此最终规则：

```text
AgentPreset effective persona complete=true
→ TEAM_PERSONA_COMPLETE_PRESET_CONFLICT
→ Structural FATAL
```

用户不能 Continue Anyway。

普通非 Team Session 继续可以正常使用该 AgentPreset。

## 13.6 禁止的 workaround

禁止：

- Team 强制把 `complete:true` 改成 false；
- Team 忽略 Blueprint persona；
- Team 解析并复制 `dsh-persona` 私有语义；
- patch upstream persona package；
- post-first-prompt 再补 Team identity。

---

# 14. TeamDomain：Team control-plane durable authority

## 14.1 定义

TeamDomain 是 Team plugin 自己拥有的 durable sidecar domain，优先建立在 DSH `StorageDomain` 之上。

它不是第二套 Agent Session 数据库，而是：

> 与 DSH Session 并列、按 Session/instance 关联的 Team aggregate control-plane store。

## 14.2 为什么必须独立于 DSH SessionEvent

Team control-plane state 如果继续写成 Team-specific SessionEvent，会重新产生：

```text
Team event vocabulary
→ core known-events/types
→ session persistence generators
→ Chat/Trajectory special integration
→ generated docs/catalogs
→ upstream coupling
```

这与 0-core 目标直接冲突。

因此：

```text
Team control plane -> TeamDomain
Agent first-person execution -> native DSH Session
```

## 14.3 TeamDomain 的逻辑数据类别

本文不规定最终 table 名或 schema 细节，但必须能够表达以下逻辑实体。

### A. TeamSessionRecord

至少保存：

```text
rootSessionId
Blueprint snapshot identity/content
Team default workspace
PolicyState
TeamSession-level overrides
compatibility/admission state
handoff provenance
version/generation
```

### B. MemberInstanceRecord

至少保存：

```text
rootSessionId
instanceId
templateId
label / groupId
childSessionId
workspace
creation config/context policy
runtime overlays
explicit human overrides
lifecycle
activity summary/version
```

### C. SessionBinding

必须能从任意相关 DSH Session 反查：

```text
SessionId -> ordinary / team-root / team-member
```

member binding 至少提供：

```text
childSessionId
→ rootSessionId
→ instanceId
```

这是 cold resume、member navigation、fork discrimination 和 integrity check 的基础。

### D. Governance / Override state

必须区分：

```text
TeamSession template autonomy overlay
MemberInstance autonomy overlay
explicit human TeamSession override
explicit human MemberInstance override
PolicyState
```

不得把 agent autonomy mutation 与 human override 混成一个不可追溯 patch。

### E. Compatibility / Acknowledgement

必须记录：

```text
current compatibility facts/fingerprint
warning acknowledgement
acknowledgement provenance
staleness/generation
```

### F. Provisioning / Operation journal

用于处理跨 TeamDomain 与 DSH Agent/Session creation 的 crash window。

必须能够表达：

```text
operation identity
idempotency identity
intent
phase
external child Session identity, if allocated
commit/reconciliation state
failure diagnostics
```

### G. TeamLedger

保存 Team-wide coordination facts，例如：

```text
Member created / restored / archived / disposed
work admitted
message coordination
control request / decision
PolicyState transition
override mutation
compatibility warning/acknowledgement
model mutation request/effective boundary
handoff/fork provenance
progress/activity coordination facts
```

它是 Team Tab 的跨 Session coordination authority。

## 14.4 TeamDomain 不是跨表 ACID 数据库

当前 DSH StorageDomain：

- 每次单 record write 在 resolve 前 durable；
- 具有 domain 内 write serialization；
- 但没有 cross-table transaction；
- 没有内建 schema migration；
- 没有 secondary index；
- cross-process change push 也不是其当前保证。

因此 Team architecture 必须假设：

```text
multi-record Team operation can crash between durable boundaries
```

不能假设“多个 Team table + child Session create”是一个 ACID transaction。

---

# 15. DSH Session 与 TeamDomain 的职责分离

## 15.1 Root DSH Session

Root Session 保存 Leader 的第一人称执行历史：

```text
user prompts
assistant/model messages
tool calls/results
injected/relay context
turn/step/request facts
native Session lineage
```

它不保存 Team membership/control-plane 的第二套权威副本。

## 15.2 Member child Session

Member child Session 保存该 Member Agent 的第一人称执行历史。

它不需要 Team-specific SessionEvent 来证明自己是谁；其 Team binding authority 在 TeamDomain `SessionBinding`。

Native Session history仍然可以包含普通来源归因，例如“这条输入来自 coordinator relay”，但那是**执行历史中的消息来源**，不是 Team membership authority。

## 15.3 双向 integrity

TeamDomain 必须能够检查：

```text
MemberInstance.childSessionId
<->
SessionBinding(childSessionId -> rootSessionId, instanceId)
```

若 TeamDomain 内部绑定自相矛盾：

```text
fail closed for new Team work
```

不得猜测“更可能是哪一边对”。

DSH Session 的历史读取仍应尽可能保持可用；Team corruption 不应抹除已有 Chat/Trajectory。

---

# 16. Live Agent residency 与 durable identity

必须明确区分：

```text
MemberInstance lifecycle state
DSH Session existence
live Agent residency
current turn activity
```

例如：

```text
MemberInstance = SETTLED
child Session = exists
live Agent = not resident
```

这是完全合法的状态。

收到新 work 后：

```text
SETTLED MemberInstance
→ ensure/resume live Agent residency
→ admit work
→ RUNNING
```

因此运行时内存 registry 永远不能成为 Member 是否存在的权威。

---

# 17. ActivationProvider

## 17.1 角色

所有新 MemberInstance 创建必须通过一个统一的**ActivationProvider** 概念边界。

```text
ActivationRequest
       │
       ▼
ActivationProvider
       ├─ resolve TeamSession
       ├─ resolve Blueprint snapshot
       ├─ resolve MemberTemplate
       ├─ validate caller authority
       ├─ validate quota
       ├─ resolve policy/requirements
       ├─ validate compatibility
       ├─ freeze creation-time fields
       ├─ allocate instanceId
       ├─ provision child Agent/Session
       ├─ persist TeamDomain binding
       └─ publish committed MemberInstance
```

## 17.2 vNext 的调用来源

本版本支持：

```text
leader explicit create
leader delegate + implicit create
human/UI explicit create, where product exposes it
```

未来可以有：

```text
router
workflow activator
automation
```

但未来 producer 不获得额外 authority；仍必须经过同一 Provider。

## 17.3 ActivationRequest

概念上可携带：

```text
templateId
label?
groupId?
workspace?
initial work prompt?
explicit attached context?
allowed creation-time overlay?
idempotency/correlation identity
caller identity/authority
```

## 17.4 创建提交点

在以下事实都准备好之前，新 MemberInstance 不应作为正式可用成员暴露：

```text
instanceId stable
child Session known
TeamDomain binding durable
creation config frozen
initial context/work admission consistency established
```

若中途 crash，需要由 provisioning recovery 重建或收敛，而不是留下半个可运行 Member。

---

# 18. Provisioning 与 crash consistency

## 18.1 问题形式

创建 Member 涉及至少两个 durable system：

```text
TeamDomain
DSH Session persistence
```

它们没有跨系统 ACID transaction。

因此必须存在 internal provisioning state。

概念状态：

```text
PROVISIONING
   ├─ success -> committed MemberInstance / CREATED
   └─ failure -> PROVISIONING_FAILED (internal only)
```

`PROVISIONING_FAILED` 不是用户可见 Member lifecycle。

## 18.2 稳定 operation identity

重试同一次 logical create 必须能识别：

```text
same logical operation
```

防止 crash/reconnect 后重复创建两个 MemberInstance。

## 18.3 Recovery 必须处理

至少包括：

```text
operation recorded / child absent
child allocated / Team binding absent
binding exists / Member commit absent
Member committed / ledger update absent
commit marker absent after effective completion
```

最终结果必须收敛为：

```text
one committed MemberInstance
OR
no committed MemberInstance + diagnostic/recoverable orphan handling
```

---

# 19. Runtime policy 模型

## 19.1 Requirement 与 Policy 严格分离

```text
Requirement
= Blueprint expects a capability to exist

Policy
= if the capability exists, whether this Team role may use it
```

例如：

```text
requires MCP server: abtem
```

与：

```text
allow MCP server: abtem
```

是两个不同事实。

Requirement 不表示“请 Team plugin 自动安装这个 capability”。

## 19.2 External Hard Policy

属于 DSH/宿主环境的不可越过上限，例如：

```text
system policy
managed policy
project/workspace hard policy
capability actual existence
security restriction
```

任何 Team actor，包括 human override，都不能越过真正的 external hard policy。

## 19.3 Team Autonomy Boundary

由：

```text
Blueprint envelope
MemberTemplate envelope
PolicyState envelope
```

共同定义：

> Team 内 agent 自主改变配置时允许走多远。

## 19.4 Autonomy Overlay

由 Leader、经授权 Member request、未来 Router/Workflow 等产生。

它必须处于 Team autonomy boundary 内。

PolicyState 变严时，已经记录的 autonomy overlay 可以：

```text
stored but suppressed
```

而不是 destructive delete。

未来 PolicyState 放宽后，仍可重新成为 effective value。

## 19.5 Explicit Human Override

由用户通过明确 UI/API 设置。

它：

```text
may override Team autonomy restrictions
must remain durable and auditable
cannot create unavailable capability
cannot override External Hard Policy
```

PolicyState 变化不得自动压制明确的 human override。

## 19.6 Effective Team Policy

所有 Team-owned 层先在 Team domain 内 resolve：

```text
P_TeamResolved = Resolve(
    Blueprint,
    MemberTemplate,
    PolicyState,
    TemplateAutonomyOverlay,
    InstanceAutonomyOverlay,
    ExplicitHumanOverride
)
```

然后：

```text
P_effective
=
P_externalHard
∩ P_capabilityExists
∩ P_TeamResolved
```

禁止将 Blueprint deny、PolicyState deny、User allow 等分别 materialize 成多个不可逆 monotonic restriction，否则 human override 将无法按设计放宽 Team 自己的限制。

---

# 20. PolicyState

## 20.1 定义

PolicyState 是：

> TeamSession 当前的运行治理模式。

它回答：

```text
“当前允许怎样修改运行配置？”
```

而不是：

```text
“任务进行到哪一步？”
```

合理示例：

```text
research
locked-validation
```

不应把：

```text
coding
review
testing
```

仅因为它们是任务阶段就包装成 PolicyState。

## 20.2 Scope

```text
PolicyState belongs to TeamSession
```

不是每个 MemberInstance 各自一个 PolicyState。

Member 间差异由 MemberTemplate envelope 与 instance-specific overlay 表达。

## 20.3 可选性

简单 Blueprint 可以只有隐含 `default` state，不必为了架构完整性强制定义多个状态。

## 20.4 Transition authority

vNext 只允许：

```text
explicit human transition
explicit authorized leader transition
```

普通 Member 不自动推进；任务完成也不自动切换。

未来 Workflow engine 若加入 transition source，必须作为新版本设计。

---

# 21. 字段 mutation 语义

## 21.1 通用 mutation modes

架构至少区分：

```text
immutable
creation-mutable
immutable-after-start
turn/step-mutable
runtime-mutable-for-future-operations
bounded
tighten-only
inherit
```

具体 schema 以后决定，但这些语义差异必须保留。

## 21.2 workspace

默认：

```text
creation-mutable
immutable after first RUNNING
```

未指定时继承：

```text
TeamSession.defaultWorkspace
```

一旦 instance 已经在 workspace A 建立 conversation/context，就不能简单把 filesystem 根切到 B 并宣称仍是同一干净执行身份。

需要新路线时创建新 MemberInstance。

## 21.3 model/provider/reasoningEffort

默认：

```text
turn/step-boundary mutable if envelope allows
```

同一个 MemberInstance 可以：

```text
turn 1 -> model A
turn 2 -> model B
turn 3 -> model A
```

identity 与 conversation 不变。

正在 in-flight 的 request 不因 concurrent override 被改成另一 model；新选择在下一可安全 request/step boundary 生效。

## 21.4 tools / permissions

在 policy 允许时可以 runtime mutation，但：

```text
change affects future operations
```

不能事后让已经执行的 tool call “变成未授权”。

对当前即将 dispatch、尚未真实执行的 operation，应在 DSH 公开 pre-execute/guard 边界重新检查 effective policy。

## 21.5 skills / MCP

与 tools 类似，Team 可以定义可见/可用范围与 future-operation mutation，但最终受：

```text
actual substrate availability
external hard policy
```

限制。

如果某项 capability 被移除，Team 不能通过 stored override 把它“创造回来”；应进入 compatibility drift。

## 21.6 contextPolicy

创建 MemberInstance 后 immutable。

原因是 context policy 定义这个 instance 的历史怎样被解释；运行中改变会破坏 continuation identity。

---

# 22. Workspace 与 context isolation

## 22.1 默认 context inheritance

新 MemberInstance 的初始 model-facing Team context 默认来自：

```text
MemberTemplate persona
+
ActivationRequest prompt
+
explicitly attached context
+
necessary structural Team identity/context
```

默认不自动继承：

```text
Leader full transcript
sibling transcript
other group transcript
other MemberInstance context
```

## 22.2 显式信息共享

Leader/Member 可以通过明确 message/relay/context attachment 分享必要信息。

原则：

```text
default isolate
explicitly share when needed
```

## 22.3 不承诺强制 noninterference

vNext 的隔离目标是：

```text
filesystem/workspace isolation
tool/permission isolation
default context isolation
```

不是完整信息流安全系统。

Leader 已经知道多个路线时，可以主动把 B 的结果告诉 A；Team plugin 不分析自然语言是否“泄露 sibling 信息”。

---

# 23. Team coordination 信息模型

Team 有两种不同的信息：

```text
A. Team-wide coordination fact
B. Agent first-person execution fact
```

二者必须关联，但不能混成一个 storage authority。

## 23.1 Team-wide coordination fact

进入 TeamDomain/TeamLedger，例如：

```text
leader assigned work to inst-A
inst-A reported result to leader
control request opened
control decision resolved
Member lifecycle changed
PolicyState changed
warning acknowledged
model override requested
progress/activity update
```

## 23.2 First-person execution fact

进入实际 Root/Member DSH Session，例如：

```text
Agent received relay text
Agent/model read an injected context
Agent emitted answer
Agent called tool
Tool returned result
```

## 23.3 Correlation

同一逻辑 coordination 可以在两侧产生相关但不同的记录。

例如：

```text
TeamDomain:
  TeamMessage messageId=M, from=leader, to=inst-A

Member Session:
  admitted relay/context message carrying correlation=M
```

这不是“重复 authority”：

- TeamDomain 说明 Team 协调发生了什么；
- Member Session 说明该 Agent 实际看到了什么。

---

# 24. Team Message

## 24.1 地址

任何运行时 Team message 使用 instance-first addressing。

```text
fromInstanceId
toInstanceId
```

Leader 可以使用 reserved LeaderInstance identity；UI 可以展示名称，但 transport/audit 不依赖 label/templateId。

## 24.2 Delivery

概念流：

```text
sender
  ↓
Team runtime validates membership/authority/admission
  ↓
TeamDomain records coordination intent
  ↓
target Agent inbox/session receives attributed relay/context
  ↓
delivery/result correlation updates Team ledger as needed
```

## 24.3 Message 不授予共享历史权限

收到一条 relay 不代表目标 Member 获得 source Session 的 live read/search 能力。

---

# 25. Control / Approval

## 25.1 目的

Member 可能遇到超出其 autonomy boundary、但可以由更高 authority 决定的操作。

例如：

```text
request leader approval
request explicit user approval
request mutation inside leader-authorized envelope
```

## 25.2 ControlRequest

概念上至少具有：

```text
requestId
rootSessionId
requesterInstanceId
kind
target authority
requested operation summary/payload reference
createdAt
status
correlation
```

## 25.3 Decision

决策必须 durable、instance-addressed、可在 reconnect/cold projection 后恢复。

决定本身不等同于 tool execution。

```text
ControlDecision
  ↓ grants/rejects a pending operation
actual tool/model/runtime operation
  ↓ remains recorded in the acting Agent's first-person Session
```

## 25.4 不允许借 approval 绕过 External Hard Policy

Leader/User 的 Team control decision 只能改变 Team-owned admission/autonomy；最终 operation 仍必须通过 DSH external hard guard。

---

# 26. Progress 与 Activity

## 26.1 Activity

Activity 是可观察 telemetry，例如：

```text
current/last action
running interval
last activity time
resident/non-resident
current admitted work correlation
```

## 26.2 Progress

Progress 可以是 Member 主动报告的结构化协调事实，例如：

```text
subject/status/summary/correlation
```

但它不是 authoritative WorkflowState。

因此 Progress **不得自动**：

```text
transition PolicyState
activate reviewer
archive member
mark workstream complete
advance DAG
```

UI 可以展示 progress，但不能把它提升为本版本不存在的 task engine。

---

# 27. Compatibility model

## 27.1 Typed requirement domains

Blueprint requirement 只允许声明可真实 probe 的 domain，例如：

```text
tools
skills
MCP servers
model/provider routes
persona/runtime-context compatibility
Team structural runtime capabilities
```

未知 requirement domain = Blueprint validation error。

## 27.2 Compatibility result

至少三类：

```text
PASS
WARNING
FATAL
```

### WARNING

ordinary capability mismatch，例如预期 tool/MCP/model route 当前不可用。

用户可以：

```text
Continue Anyway
```

之后 Team 进入 acknowledged degraded 状态。

### FATAL

结构性 Team contract 无法成立，例如：

```text
Team durable persistence unavailable
Agent lifecycle public seam unavailable
intrinsic Leader/Member Team surface cannot be established
persona identity cannot be installed safely
AgentPreset complete:true persona conflict
```

FATAL 不允许 Continue Anyway。

## 27.3 Compatibility acknowledgement

Acknowledgement 必须对应**具体 mismatch/environment generation**，而不是一个永久“忽略所有 warning”的 flag。

概念上与：

```text
requirement fingerprint
capability/environment fingerprint
```

绑定。

如果环境或 selected AgentPreset 变化产生新的 mismatch，旧 acknowledgement 不自动覆盖新问题。

---

# 28. Admission State

Compatibility 与生命周期分离。

TeamSession 需要一个逻辑 **Admission State** 来决定“能否接收新的 Team work”。

概念状态可表达：

```text
OPEN
BLOCKED_WARNING
BLOCKED_FATAL
DEGRADED_ACKNOWLEDGED
```

具体 enum 名可在实现设计中调整，但语义固定。

## 28.1 Gate 的范围

当有未处理 warning/fatal 时，阻止新的 Team work admission，例如：

```text
Root new prompt
Leader new delegate/create
new Member activation
existing Member new follow-up
SETTLED Member new work
Team-sensitive mutation requiring current compatibility
```

## 28.2 不回滚 in-flight work

若 work 在 warning 被发现前已经 admitted：

```text
allow it to settle
```

Compatibility drift 不自动取消正在执行的 model/tool operation。

## 28.3 Last-mile guard

即使上层入口漏检，真正进入下一 Agent step 或关键 Team mutation 前仍应经公开 guard seam 进行最终检查。

这是 architecture safety property，不要求修改 AgentLoop。

---

# 29. Member lifecycle

vNext 最终 MemberInstance FSM：

```text
              new admitted work
CREATED --------------------------> RUNNING
                                      │
                                      │ turn/work settles
                                      ▼
                                   SETTLED
                                   │     │
                     new work      │     │ Archive
                    / Resume       │     ▼
                         ┌─────────┘  ARCHIVED
                         │               │
                         ▼               │ Restore
                      RUNNING            ▼
                                      SETTLED

CREATED / RUNNING / SETTLED / ARCHIVED
                └───────────────> DISPOSED
                                  terminal
```

## 29.1 CREATED

Member identity、binding 和 creation config 已 durable commit，但尚未进入第一有效 work turn。

## 29.2 RUNNING

该 MemberInstance 存在 active admitted execution/turn。

`RUNNING` 描述 logical work activity，不要求 UI 把每个底层 micro-step 变成 lifecycle transition。

## 29.3 SETTLED

当前 admitted work 已结束；instance 仍可继续：

```text
child Session preserved
conversation preserved
identity preserved
future follow-up allowed
live Agent may or may not be resident
```

## 29.4 ARCHIVED

退出主要活跃工作集，但保留：

```text
instanceId
Team membership history
child Session/transcript
context history
restore capability
```

默认 UI 可以折叠/隐藏，但不能删除。

## 29.5 DISPOSED

终态：

```text
cannot restore
cannot receive new Team work
not treated as recoverable runtime entity
historical Session/Trajectory remains readable
Team ledger history remains
```

---

# 30. Archive、Restore、Resume、Dispose

## 30.1 Archive

Archive 不是只改 enum。

如果 Member 正在运行：

```text
close new admission
↓
cancel/interrupt current Member activity
↓
drain resident generic descendants
↓
wait for quiescence
↓
release resident Agent handle as appropriate
↓
commit ARCHIVED
```

必须先 quiesce，再 durable transition。

禁止：

```text
write ARCHIVED
then try to stop Agent
```

## 30.2 Restore：最终冻结语义 3A

```text
ARCHIVED
   ↓ Restore
SETTLED
```

Restore 只恢复 durable availability。

Restore **不得**：

```text
call model
send prompt
start turn
create/resume live Agent residency merely for restore
transition directly to RUNNING
```

## 30.3 Resume / new work

真正有新 work 被 admitted 时：

```text
SETTLED
↓
ensure child Agent residency (resume if cold)
↓
deliver/admit work
↓
RUNNING
```

因此 Restore 与 Resume 是两个不同动作。

## 30.4 Dispose

RUNNING 状态 Dispose 同样必须：

```text
close admission
interrupt
quiesce/drain descendants
release live resources
commit DISPOSED
```

Dispose 不删除历史。

---

# 31. Runtime eviction

SETTLED 的 persistent MemberInstance 可以为了资源回收而失去 live Agent residency。

```text
SETTLED MemberInstance
child Session durable
live Agent evicted
```

这**不改变 lifecycle**。

下一次 work：

```text
cold resume Agent
→ rehydrate Team scoped runtime
→ admit work
```

因此：

```text
lifecycle != residency
```

---

# 32. Concurrency 与 quota

一旦一个 template 可以生成 N instances，必须有显式资源边界。

Blueprint 至少能够表达：

```text
per-template maxConcurrent
per-template maxTotal
team maxConcurrent
possibly unlimited
```

语义：

- `maxConcurrent`：同时处于活动运行/占用定义范围内的实例上限；
- `maxTotal`：该 TeamSession 生命周期内从该 template 成功创建的 MemberInstance 总预算；
- Team-level quota 对所有 templates 聚合。

Quota 是 Team autonomy boundary 的组成部分。

Human override 是否可放宽某个 Team quota，遵循 human authority 规则，但不能越过宿主的真实资源/hard limit。

并发 create 必须以 durable/idempotent 方式避免 race 超额。

---

# 33. Model mutation 与 in-flight isolation

当前 DSH 的公开 ModelSelection 语义允许“当前 selection”在 prompt assembly 时被捕获，并在相应 request 上保持一致；并发切换在后续 step 生效。

Team vNext 应保持：

```text
request N assembly captures model A
user/leader changes effective model to B while N is running
request N stays on A
next safe request/step uses B
```

TeamDomain 保存的是 Member runtime override / intended effective selection provenance；真正 model call 仍由 DSH ModelSelection/agent request contract 执行。

Team 不建立第二套 LLM dispatcher。

---

# 34. Start Team from Here

## 34.1 目标

允许从普通 meaningful AgentSession A 创建一个新的 TeamIntent/TeamSession B，并带入一次性上下文。

## 34.2 One-shot handoff

```text
Source Session A
↓
read frozen current canonical surface
↓
one-shot summarize/compress
↓
frozen sourced handoff context
↓
TeamIntent / new TeamSession B
```

## 34.3 明确禁止 live link

创建后：

```text
B cannot history_read(A)
B cannot search A
B does not share A live memory
B does not reread A later
changes in A do not mutate B handoff
```

`sourceSessionId` 可以作为 provenance/navigation metadata，但不是读取授权。

## 34.4 Handoff summarizer

Handoff summarization route 不应依赖 Blueprint Leader model 或 Member model；它是 Host/Team creation 辅助能力。

失败必须显式暴露，例如：

```text
Retry
Continue without handoff
Cancel
```

不能静默假装 handoff 成功。

---

# 35. Fork 语义

## 35.1 Root TeamSession fork

对 Team Root P 执行 DSH native fork 后：

```text
Parent Root P
  TeamSession P
  Blueprint snapshot R
  Members A/B/C
        │
        │ native Session fork
        ▼
Child Root C
  new TeamSession C
  same immutable Blueprint snapshot R
  MemberInstances = empty
```

不复制 runtime MemberInstances、Policy runtime activity 或 child execution trees。

需要保留普通 DSH fork 的 history/lineage 语义，但 Team runtime current state 在新的 TeamDomain aggregate 中重新建立。

## 35.2 Root fork 的 0-core 边界

不得 patch `session.fork`。

Team plugin 依据公开 Session lineage/parent information 与 TeamDomain binding 做 idempotent sidecar recognition/reconciliation。

若必要 lineage 对外不可观察并导致该冻结行为无法实现，属于：

```text
CORE_SEAM_BLOCKER: FORK_LINEAGE_VISIBILITY
```

而不是修改 upstream fork core。

## 35.3 Member child Session fork

对某个 MemberInstance 的 child Session 执行普通 fork：

```text
Member child Session
↓ native fork
ordinary independent AgentSession
```

新 Session：

```text
is NOT new MemberInstance
is NOT member of original Team
is NOT new TeamSession
is NOT Leader
```

它只保留 DSH ordinary fork 的历史/lineage 语义。

---

# 36. Cold resume

## 36.1 Team identity 从 TeamDomain 恢复

对一个 DSH Session resume 时，Team plugin 首先根据 SessionBinding 判断：

```text
ordinary session
team root
team member
```

### ordinary

不安装 Team scoped surface。

### team root/member

读取 TeamDomain：

```text
TeamSession snapshot
Member binding, if applicable
PolicyState
runtime/user overrides
compatibility/admission state
```

然后在 Agent 开始第一 Team-sensitive step 前恢复 Team scoped behavior。

## 36.2 不依赖 live Blueprint catalog

历史 TeamSession 的语义来自其 durable snapshot。

Catalog 中源 Blueprint 被修改/移动不改变已有 TeamSession identity。

## 36.3 仍要 re-probe 外部环境

Cold resume 不冻结：

```text
provider availability
model availability
tool/skill/MCP availability
External Hard Policy
```

因此 resume 后必须重新评估 compatibility/effective policy。

---

# 37. Team Projection 与 Chat / Trajectory 边界

## 37.1 Team Tab

Team Tab 表示：

```text
TeamSession aggregate control-plane projection
```

来源：

```text
TeamDomain
```

典型展示对象：

```text
Blueprint identity
Leader/Member hierarchy
Member lifecycle
activity intervals
messages/control/progress coordination
PolicyState
overrides/effective config provenance
compatibility/admission
Team ledger
```

## 37.2 Chat

Chat 仍是：

> 当前 DSH Session 的 human-readable first-person conversation surface。

Root Chat = Leader first-person Session。  
Member Chat = 该 Member child Session。

## 37.3 Trajectory

Trajectory 仍是：

> 当前 DSH Session 的完整 first-person durable execution trace。

Team control-plane 不需要伪造成 DSH SessionEvent 才能在 Team Tab 可观察。

## 37.4 禁止跨 child log timestamp 合并总序

不能把：

```text
Root Session log
+ child A log
+ child B log
```

按 wall-clock timestamp 硬 merge 成 authoritative Team total order。

跨 Session Team coordination 顺序来自 TeamLedger；每个 Session 内的执行顺序由该 Session 自己定义。

## 37.5 Navigation

TeamDomain 持有：

```text
instanceId <-> childSessionId
```

因此 Team UI 可以从 MemberInstance 导航到原生 Session Chat/Trajectory，而不复制 Conversation UI。

---

# 38. Legacy 模型

## 38.1 `.dsh/teammates/`

旧 workspace teammate files 可以保留为 legacy Blueprint source：

```text
.dsh/teammates/*
↓ parse once
LegacyWorkspaceTeamBlueprint
↓ validate
resolved immutable snapshot
↓
new TeamSession
```

关键：

```text
snapshot once
```

禁止恢复旧 `team-local` 的：

```text
live cwd watcher as runtime authority
shared mutable ctx.team roster
home fallback that silently reanchors current Team
stale-empty roster retention
cross-Session reload mutation
```

## 38.2 旧 role AgentPreset

例如旧的某个 `*-team` role preset 只作为：

```text
ordinary AgentPreset
or migration input
```

不再定义 Team identity。

## 38.3 Existing legacy Team Sessions：最终冻结 2A

旧 Team Session：

```text
READ-ONLY LEGACY
```

允许：

```text
open historical Session
read native Chat/Trajectory
show legacy Team metadata where old data can be decoded without core patch
export/import as data where explicitly requested
```

禁止：

```text
automatic in-place migration
resume as vNext Team
restore old teammate as MemberInstance
continue Team mutations
silently synthesize vNext identity continuity
```

如果旧 Team metadata 无法通过公开 seam 完整读取，允许只保留 native historical Session 可读性；legacy fidelity 不是 vNext release blocker。

---

# 39. 旧代码概念的保留与淘汰边界

本文不是代码迁移计划，但为了避免实现 agent 错误理解，必须明确哪些**概念**值得保留。

## 39.1 应保留的用户价值/设计思想

当前 Team 实现中值得保留：

- teammate 不是一次性 function call，而是有持续上下文的执行体；
- follow-up；
- leader/member messaging；
- approval/control；
- progress/activity telemetry；
- Team aggregate projection；
- Timeline；
- Member Session navigation；
- cold recovery 的严谨性；
- policy snapshot/provenance 的思想；
- workspace/tool/permission isolation。

## 39.2 必须淘汰的旧结构

当前代码中的以下概念不能成为 vNext runtime authority：

```text
TeamRegistry current definitions[]
TeamOrchestrator keyed by (leaderSessionId, memberId)
one member definition = one activation
team-local live cwd watcher authority
SubagentRuntime.startContinuable as MemberInstance identity primitive
TeamMemberBoundData as Team membership authority in child SessionEvent
Team-specific SessionEvent control plane
Team = AgentPreset
```

---

# 40. 当前 DSH public seam 对本架构的可实现性约束

本节只记录**架构事实与后果**，不是开发计划。

## 40.1 Agent lifecycle

当前 upstream 公开 `ctx.agents.create()` / `ctx.agents.resume()`，并支持 pre-publication `setup(agentCtx)`。

Agent 创建事务是：

```text
construct private Session + Agent + scoped Context
↓
setup
↓
publish registries
↓
session/agent created notifications
↓
agent/session-start
↓
driver starts
```

架构后果：

> Team-owned Member Agent 可以在不修改 AgentLoop 的情况下，在首次运行前安装 scoped Team behavior。

## 40.2 `agent/pre-step`

公开 waterfall 可以拒绝 proposed step。

架构后果：

> Compatibility/Admission 可以拥有 last-mile“禁止新 Team work 进入模型 step”的安全边界，而无需修改 core loop。

## 40.3 ModelSelection

公开 model-selection mechanism 在 prompt assembly 时捕获 selection，并将 provider/model/effort 应用于对应 request；并发切换影响后续 step。

架构后果：

> vNext 的 model turn/step-boundary mutation 与 upstream 正式语义一致。

## 40.4 System Prompt / Persona

公开 scoped prompt section 支持同名 scope shadow；`deployment:persona` 是公开 slot。

但 `complete=true` section 在 assemble waterfall 后仍被恢复为唯一 prompt。

架构后果：

> 普通 Team persona 可以 scoped 安装；`complete:true` 必须 FATAL，除非未来 upstream 自己提供通用 persona-text override seam。

## 40.5 StorageDomain

StorageDomain 适合 host-side session sidecar metadata；单 write durable，但没有 cross-table transaction / built-in migration。

架构后果：

> TeamDomain 可成立，但必须自带 logical journal/reconciliation；不能假设 ACID aggregate write。

## 40.6 External Web client

DSH client module graph 可动态发现声明 `dsh.client` 且导出 `./client` 的外部包。

架构后果：

> Team UI 可以成为独立外部 client package，不需要进入 upstream bundle。

## 40.7 Conversation public slots

当前公开 slots 包括：

```text
conversation.view
conversation.session.header.actions/utilities
conversation.input/composer docks
...
```

架构后果：

> Team Tab、Session actions、Team Dock 可以 additive 接入；不需要修改 upstream Conversation owner。

---

# 41. 典型端到端信息流

## 41.1 创建 Team

```text
User
↓
TeamIntent
↓
select Blueprint R
select AgentPreset P
select default workspace
↓
Compatibility Resolver
├─ structural FATAL -> stop
├─ warning -> AWAITING_ACK
└─ pass/acknowledged
↓
create Root DSH Agent/Session
↓
TeamDomain creates TeamSession binding
↓
LeaderInstance = Root Agent/Session
↓
Team scoped identity/policy/tools active
↓
Admission OPEN/DEGRADED_ACKNOWLEDGED
```

## 41.2 Leader 创建两个相同 template 的路线

```text
LeaderInstance
↓ ActivationRequest(template=researcher, label=Fourier, workspace=A)
ActivationProvider
↓
inst-A / child Session A

LeaderInstance
↓ ActivationRequest(template=researcher, label=Neural, workspace=B)
ActivationProvider
↓
inst-B / child Session B
```

两者：

```text
same template
independent instanceId
independent Session
independent context
independent workspace
independent runtime overlay
```

## 41.3 Follow-up

```text
Leader -> inst-A follow-up
↓
TeamDomain records coordination
↓
ensure inst-A Agent residency
↓
message admitted to Session A
↓
inst-A RUNNING
↓
work settles
↓
inst-A SETTLED
```

不会创建新 instance。

## 41.4 `fresh_per_delegation`

```text
Leader delegates template=researcher (fresh policy)
→ inst-A

later leader performs NEW delegation to template=researcher
→ inst-B
```

若 Leader 明确 follow-up `inst-A`：

```text
continue inst-A
```

## 41.5 Model override

```text
inst-A RUNNING request uses Model X
↓
Human/authorized leader stores model override = Y
↓
current request remains X
↓
next request boundary resolves Y
↓
Team ledger records provenance
```

## 41.6 Archive / Restore

```text
inst-A RUNNING
↓ Archive
close admission -> cancel -> drain -> quiesce
↓
ARCHIVED
↓ Restore
SETTLED (no Agent resume)
↓ new follow-up
cold resume Agent if needed
↓
RUNNING
```

## 41.7 Compatibility drift

```text
Team running normally
↓ MCP/model/tool disappears
compatibility generation changes
↓
new Team admission BLOCKED
already admitted work may settle
↓
User repairs config or acknowledges warning if allowed
↓
new admission reopens
```

## 41.8 Root fork

```text
Team Root P @ Blueprint R
Members A/B
↓ native fork
Root C
↓ TeamDomain lineage recognition
TeamSession C @ same snapshot R
Members = empty
```

## 41.9 Member fork

```text
inst-A child Session
↓ native fork
ordinary independent AgentSession
```

No Team membership is inferred.

---

# 42. Architecture invariants

以下清单应成为后续 UI、API、开发计划、测试与 code review 的硬约束。

1. **CORE PATCH BUDGET = 0。**
2. **Team runtime 必须可作为独立外部插件加载。**
3. **Team-required upstream source diff 必须为 0。**
4. **Team Mode != AgentPreset。**
5. **TeamBlueprint != AgentPreset。**
6. **AgentPreset 与 TeamSession 是 Root Session 上的正交绑定。**
7. **ModelSelection 独立于 AgentPreset 与 Team identity。**
8. **一个 Root Session 最多一个 TeamSession。**
9. **TeamSessionId = RootSessionId。**
10. **一个 TeamSession 恰好绑定一个 immutable Blueprint snapshot。**
11. **Blueprint bind 后不可原地换 Blueprint。**
12. **Blueprint snapshot 冻结 Blueprint-owned semantics，不冻结 external environment。**
13. **Blueprint 必须包含恰好一个完整 LeaderTemplate。**
14. **LeaderInstance 是 Root Agent/Session，是唯一特殊 MemberInstance。**
15. **LeaderInstance 不可独立 archive/dispose。**
16. **MemberTemplate 不是 runtime actor。**
17. **一个 MemberTemplate 可以产生 0..N persistent MemberInstance。**
18. **Member runtime identity 使用 `(rootSessionId, instanceId)`。**
19. **label/templateId/groupId 都不是运行时 identity。**
20. **groupId 无 state/permission/lifecycle/activation 语义。**
21. **MemberInstance = Team-owned Agent + Session，不是 continuable subagent activation。**
22. **Generic DSH subagent 与 Team Member additive 共存。**
23. **每个 MemberInstance 绑定一个 durable child Session。**
24. **对既有 instance 的 follow-up 永远继续同一 child Session。**
25. **`fresh_per_delegation` 通过创建新 MemberInstance 获得 fresh context，不重置既有 instance。**
26. **所有新 MemberInstance 创建统一经过 ActivationProvider。**
27. **workspace 不定义 Team identity。**
28. **Member workspace 默认 creation-mutable、first RUNNING 后冻结。**
29. **contextPolicy 在 instance creation 后冻结。**
30. **model 在 policy 允许时于安全 request/step 边界变化；in-flight request 不变。**
31. **tools/permissions/skills/MCP mutation 只影响 future operations。**
32. **Requirement != Policy。**
33. **Team-owned policy 必须先在 Team domain resolve，再 materialize 到 DSH guard。**
34. **Human override 可以超过 Team autonomy boundary，但不能超过 External Hard Policy。**
35. **Human override 不能创造不存在的 capability。**
36. **Leader/router/automation 永远不能越过 Team autonomy envelope。**
37. **Member 不能 unrestricted self-escalate。**
38. **PolicyState 属于 TeamSession。**
39. **PolicyState 只治理 runtime mutation，不表示 workflow progress。**
40. **vNext PolicyState 只由 user/authorized leader 显式切换。**
41. **Team control-plane durable authority = TeamDomain。**
42. **禁止新增 Team-specific DSH SessionEvent vocabulary。**
43. **DSH Session 只承担对应 Agent 的 first-person durable execution history。**
44. **Team-wide coordination order 来自 TeamLedger，不跨 child logs 按 timestamp 伪造 total order。**
45. **进程内 registry/cache/live Agent 不是 durable authority。**
46. **Provisioning 必须能够处理跨 TeamDomain/Session crash window 和 idempotent retry。**
47. **Compatibility structural FATAL 不可 Continue Anyway。**
48. **AgentPreset effective persona `complete:true` 对 Team 为 structural FATAL。**
49. **Compatibility warning 可明确 acknowledgement，但新 mismatch 必须重新评估。**
50. **Compatibility gate 阻止 new Team work admission，不 retroactively cancel 已 admitted work。**
51. **Member lifecycle = CREATED/RUNNING/SETTLED/ARCHIVED/DISPOSED。**
52. **Archive/Dispose 必须先 close admission + quiesce/drain，再提交状态。**
53. **Restore = ARCHIVED -> SETTLED。**
54. **Restore 不 resume Agent、不启动 turn、不调用 model。**
55. **新 work 才把 SETTLED Member 恢复 residency 并进入 RUNNING。**
56. **DISPOSED terminal，但历史 Session/Trajectory/Team ledger 不删除。**
57. **Agent residency 与 Member lifecycle 独立。**
58. **默认 Member context 不继承 Leader full transcript 或 sibling transcript。**
59. **跨 Member 信息共享必须是显式 relay/context transfer。**
60. **Start Team from Here 是 one-shot frozen handoff，不授予 source Session live retrieval。**
61. **Root Team fork = same Blueprint snapshot + zero MemberInstances。**
62. **Member child fork = ordinary independent AgentSession。**
63. **`.dsh/teammates` 只能作为 snapshot-on-create legacy Blueprint input。**
64. **不得恢复 live cwd-driven mutable TeamRegistry。**
65. **Existing legacy Team Sessions = READ-ONLY；不自动迁移。**
66. **vNext 不依赖官方 private experimental Agent Teams。**
67. **缺失必需 public seam 时输出 CORE_SEAM_BLOCKER，不扩大 core patch scope。**

---

# 43. 架构状态与后续文档边界

在当前 upstream/fork 审计点上，没有发现必须重新打开用户决策的架构冲突。

仍需要在**开发计划阶段通过 characterization test 证明**、但不改变本文产品语义的技术事实包括：

```text
cold Root resume 能否保证 Team hydration 早于第一个 Team-sensitive step
skills/MCP 的精确 scoped filtering/mutation 接线
fork lineage 的外部可观察时序与 sidecar reconciliation
StorageDomain 上 TeamDomain journal/recovery 的具体布局
external Remote/UI slot 的最终 API/slot 名称
```

这些属于“如何实现”的问题，不属于“系统是什么”的问题。

如果 characterization 发现其中某一项缺失公开 seam：

```text
CORE_SEAM_BLOCKER
```

必须阻塞相应功能，而不是修改本文架构定义或偷偷 patch upstream。

本文应作为后续三份文档的上游约束：

1. **Team vNext UI 设计文档**：只决定如何把本文对象和状态清晰呈现给用户；
2. **Team vNext 详细开发计划**：决定如何从当前代码迁移到本文架构；
3. **Team vNext 任务分包与审查方法**：决定主 Agent / subagent 如何执行开发计划。

后续文档不得以实现便利为理由重新定义本文对象关系、authority、lifecycle、persistence 或 compatibility 语义。

---

# 附录 A：当前代码事实与架构判断摘要

## A.1 Upstream Agent lifecycle

审计路径：

```text
packages/core/agent-loop/README.md
packages/core/agent/src/runtime-types.ts
```

事实：公开 Agent factory 支持 create/resume + scoped setup；setup 在 publication 与 driver start 前完成；Agent 提供 cancel/whenIdle/inbox operations；`agent/pre-step` 是公开 waterfall。

结论：Team-owned Agent lifecycle 与 admission guard 有公开宿主基础，不需要 AgentLoop core patch。

## A.2 Upstream ModelSelection

审计路径：

```text
packages/core/agent/src/model-selection.ts
```

事实：selection 在 assembly 捕获并应用于相应 request，并发切换作用于后续 step。

结论：Member model turn/step mutation 与 upstream 正式语义一致。

## A.3 Upstream Persona

审计路径：

```text
packages/core/system-prompt/src/index.ts
```

事实：`deployment:persona` 是 scoped section；`complete` section 在 waterfall 后恢复为唯一 system prompt。

结论：普通 scoped Team persona 可行；`complete:true` 必须按 1A 判 FATAL。

## A.4 Upstream AgentPreset

审计路径：

```text
packages/preset/agent-presets/src/index.ts
```

事实：AgentPreset 是 standing composition，Agent 通过 scope parent join；setup 是支持的 pre-publication join point。旧 roster drift 的问题来自 Team 自己的 mutable shared registry/cwd reload，而不是“AgentPreset 天生等于一个共享 Team”。

结论：AgentPreset 可以继续作为 substrate，但 Team durable state 不能放进其 mutable shared realm。

## A.5 Upstream StorageDomain

审计路径：

```text
packages/storage/storage-domain/README.md
```

事实：适合 typed session sidecar metadata；单 write durable；没有 cross-table transaction / built-in migration。

结论：TeamDomain 是合适的 authority，但 Team 自己必须定义 journal/recovery/version upgrade strategy。

## A.6 Upstream client modules / slots

审计路径：

```text
docs/subsystems/client-modules.md
packages/client/ui-conversation/src/client/contract/slots.ts
```

事实：外部 `dsh.client` package 可进入 Web module graph；Conversation 暴露 additive `conversation.view`、header actions、composer/input docks 等 slots。

结论：外部 Team UI 与 Team Tab 不需要 upstream client source patch。

## A.7 当前 fork Team model

审计路径：

```text
packages/team/team/src/types.ts
packages/team/team-runtime/src/orchestrator.ts
packages/team/team-local/src/index.ts
packages/team/tool-team/src/tool-delegate.ts
```

当前事实：

- `TeamMemberDefinition` 同时承担静态 role 和运行参数；
- `TeamOrchestrator` 按 `(leaderSessionId, memberId)` 保存一条 activation；
- `team-local` 根据 live cwd watch/reload `ctx.team`；
- delegation 以 continuable subagent 为 Member primitive；
- `persistent` 重用 settled child；`fresh_per_delegation` 启动新 child；
- message/control/progress 已有用户价值，但 identity 仍是 memberId-centric。

架构结论：

- messaging/control/progress/Timeline/navigation 等价值应保留；
- mutable TeamRegistry、cwd authority、memberId runtime identity、one-member-one-activation、subagent-as-Member 等结构必须被替换；
- `fresh_per_delegation` 的用户意图迁移为“每次新 delegation 创建新 MemberInstance”。

---

# 附录 B：术语表

| 术语 | 含义 |
|---|---|
| **TeamBlueprint** | 可复用的静态团队定义及版本化语义 |
| **Blueprint snapshot** | 某 TeamSession 创建时冻结的 Blueprint-owned semantics |
| **TeamIntent** | 真实 TeamSession 创建前的 Team-owned staging object |
| **TeamSession** | Root Session 对一个 Blueprint snapshot 的 Team binding；ID 等于 RootSessionId |
| **LeaderTemplate** | Blueprint 中唯一 Leader 的静态定义 |
| **MemberTemplate** | 可被实例化 0..N 次的静态成员角色模板 |
| **LeaderInstance** | Root Agent/Session，对统一 Member 模型的特殊实例 |
| **MemberInstance** | 拥有持久 identity、child Session、workspace、context、overlay、lifecycle 的执行实体 |
| **instanceId** | MemberInstance 的稳定运行时 identity |
| **templateId** | MemberTemplate 静态 identity，不用于 runtime addressing |
| **groupId** | 无状态/权限/lifecycle 语义的 opaque grouping metadata |
| **AgentPreset** | DSH ordinary Agent composition substrate，与 TeamSession 正交 |
| **ModelSelection** | per-Agent provider/model/reasoningEffort route |
| **ActivationRequest** | 请求创建新 MemberInstance 的统一输入 |
| **ActivationProvider** | 所有 MemberInstance creation 的统一 authority/validation seam |
| **TeamDomain** | Team control-plane durable sidecar authority |
| **TeamLedger** | Team-wide coordination facts 的 durable chronological ledger |
| **SessionBinding** | DSH SessionId 与 Team root/member identity 的 TeamDomain 关联 |
| **Autonomy Overlay** | agent/leader 在 Team envelope 内产生的 runtime override |
| **Explicit Human Override** | 用户明确设置、可越过 Team autonomy 但不可越过 external hard policy 的 durable override |
| **PolicyState** | TeamSession-level runtime governance mode，不是 workflow progress |
| **External Hard Policy** | Team 和用户都不能越过的宿主安全/能力上限 |
| **Compatibility** | Blueprint requirements 与当前实际 substrate/environment 的匹配状态 |
| **Admission** | 是否允许新的 Team work 进入执行系统 |
| **Residency** | 某 durable MemberInstance 当前是否有 live Agent object 驻留在进程内 |
| **Restore** | `ARCHIVED -> SETTLED`，仅恢复可用性，不 resume Agent |
| **Resume** | 在有新 work 时恢复 cold Agent residency 并继续同一 Session |
| **Legacy Team Session** | 旧架构产生的 Team Session；vNext 中只读，不自动迁移 |

---

**End of Architecture Baseline**
