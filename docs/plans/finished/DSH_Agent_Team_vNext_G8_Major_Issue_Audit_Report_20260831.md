# DSH Agent Team vNext — G8 重大问题专项审查报告

**状态：已归档｜G8 重大问题审计已完成，作为 P8-S 修复输入，不再是当前执行计划。**  
**真正执行进度：** 报告发现的问题已在 P8-S1A/S1B/S1C 复核并形成 CR-1..CR-14；S0/S1 修复分别进入 P8-S2～S6，后续 P8-S7 完成 coverage closure。该报告本身不代表所有问题均已修复。  
**完成时间：** 2026-09-02（P8-S 审计重分类与修复清单归档节点）。  
**文档用途**：供本地 DSH 主 Agent / Reviewer 在 G8 补充轮次中进行问题复核、修复规划、测试补强与 Gate 判定。  
**审查对象**：`ArmourPiercer1/dsh-agent-team`  
**公开仓库审查基线**：GitHub `master` 约为 `959e36358ee7244ff8c7e1e0b8396e70dfef4562`  
**审查时间**：2026-08-31  
**重要限制**：用户说明当前本地 Agent 已进入 G8 的第一个补充轮次，GitHub 提交可能略落后于本地开发进度。因此，本报告中的每一条问题都应先在**最新本地工作树**上复核，不得机械重复修复已经完成的内容。

---

# 0. 文档定位

本报告不是新的架构设计文档，也不是新的 Phase 计划。

其目标是回答：

1. 当前实现是否已经偏离冻结的 Architecture / Development Plan；
2. 是否存在明显的功能、权限、生命周期、durable-state 或并发漏洞；
3. 是否存在本应在 P5–P8 闭合、但当前仍为空白，而且无法合理留给 P9/P10 填补的内容；
4. 为什么此前多个 Gate 可以通过，而 production backend 仍可能存在明显闭环缺失；
5. G8 补充轮次应当如何验证、修复和重新建立 production-level evidence。

本报告尤其关注一种目前已经多次出现的失败模式：

```text
Component A is correct
Component B is correct
Component C is correct

does NOT imply

A -> B -> C production composition is correct
```

当前代码的总体特征不是“模块实现质量差”，而是：

> **模块内部测试非常强，但跨 Phase、跨 authority、跨 durable/live boundary 的 production composition 没有受到同等级的验证。**

这是本轮最重要的系统性结论。

---

# 1. 冻结设计基线

除非当前最新本地代码证明存在真实 public seam blocker，否则以下内容不应重新打开讨论。

## 1.1 Team 基础 ownership

```text
DSH Agent / Session substrate
        +
Team-owned aggregate control plane
```

Team 不重新实现：

- LLM runtime；
- Session；
- Conversation；
- Trajectory；
- ordinary AgentPreset；
- generic subagent infrastructure。

Team 自己拥有：

- TeamBlueprint；
- TeamIntent；
- TeamSession；
- MemberTemplate / MemberInstance；
- TeamDomain；
- activation / admission；
- Team policy；
- compatibility；
- Team lifecycle；
- messaging / control / activity；
- TeamLedger；
- Team projection；
- Remote；
- UI；
- legacy read-only adapter。

## 1.2 Identity

```text
TeamSessionId = RootSessionId

Member runtime identity =
(rootSessionId, instanceId)
```

以下都不是 runtime identity：

```text
templateId
label
groupId
```

## 1.3 Member model

```text
MemberTemplate
    -> 0..N persistent MemberInstances
```

每个真正的普通 MemberInstance：

```text
instanceId
templateId
label
groupId?
childSessionId
workspace
runtime overlay
Member lifecycle
Agent residency
```

并且：

```text
MemberInstance
!= continuable subagent activation

MemberInstance
= Team-owned Agent + durable child Session
```

## 1.4 Leader model

Leader 是统一 Team actor 模型中的特殊对象：

```text
LeaderInstance
= Root Agent + Root Session
```

Frozen semantics：

```text
exactly one LeaderInstance per TeamSession
reserved stable Team identity
no independent child Session
no independent Member lifecycle
cannot archive independently
cannot restore independently
cannot dispose independently
residency follows Root Agent/Session
```

Leader 可以在 projection / policy / messaging / audit 中使用统一 actor identity，但不能被伪装成普通 MemberInstance。

## 1.5 Context

默认 Member 初始 model-visible context：

```text
MemberTemplate persona / system identity
+
ActivationRequest.prompt
+
explicit attached context
```

不会自动继承：

```text
leader full transcript
sibling transcript
other group context
```

## 1.6 Lifecycle

普通 Member：

```text
CREATED
  -> RUNNING
  -> SETTLED
       -> RUNNING
       -> ARCHIVED
            -> SETTLED  (Restore)

active/settled/archived
  -> DISPOSED
```

关键区别：

```text
Restore != Resume
```

Restore：

```text
ARCHIVED -> SETTLED
```

只修改 durable availability。

不得：

- create Agent；
- resume Agent；
- 发起 model turn。

新 work 到来时，SETTLED Member 才需要：

```text
ensure/resume residency
-> RUNNING
```

## 1.7 Compatibility

每次新的 Team work admission 前必须确保：

```text
current environment
-> compatibility freshness validation
-> durable compatibility state
-> warning ACK validity
-> one authoritative admission result
```

已经 admitted 的 in-flight work 不因 environment drift 被强制取消。

## 1.8 0-core

```text
CORE PATCH BUDGET = 0
```

禁止：

- 修改 deepseek-harness upstream source；
- private/unexported imports；
- patch-package / pnpm patch；
- Team-specific SessionEvent；
- SessionController Team mirror；
- upstream AgentPreset/subagent/session/fork patches。

---

# 2. Severity 定义

本报告使用：

## S0 — STOP-SHIP

满足任一：

- 核心功能语义不成立；
- control plane 与实际 Agent execution 不一致；
- durable truth 可以进入明显错误状态；
- authority 可以绕过；
- DTO/object model 已经把冻结架构表达错误；
- P9/UI 一旦基于它继续开发，会固化错误 contract。

G8 不应 PASS。

## S1 — MUST-FIX BEFORE P9

当前不是必然立即破坏所有流程，但：

- production backend 尚不闭合；
- 并发/恢复边界有高风险；
- P8 Remote/Projection freeze 后再修成本显著提高；
- UI 无法合理代替后端完成。

## S2 — FOLLOW-UP / HARDENING

可以留给 P10，但不能影响 backend semantic correctness。

---

# 3. Executive Summary

当前公开代码审查得到以下主要问题：

| ID | Severity | 问题 | 后续 P9 能否补 |
|---|---:|---|---|
| A | S0 | `delegate` / `follow-up` 可能只完成 admission/ledger，没有真正把工作提交给 Member Agent | 否 |
| B | S0 | CompatibilityProber 与 Runtime/Activation admission 存在 authority 分裂，可能信任 stale OPEN 或忽略 durable ACK | 否 |
| C | S0 | Leader durable/object model 与冻结架构矛盾；fresh root 正式路径可能不创建 Runtime 所依赖的 Leader identity | 否 |
| D | S0 | shipped production plugin composition root 仍近似空壳，大量真实 wiring 只存在 harness | 否 |
| E | S0/S1 | work admission 允许 required lifecycle transition 未落盘但仍成功 | 否 |
| F | S1 | P7 mutation 可能只完成 Team-side effective state，没有真正改变下一次 DSH request/operation | 否 |
| G | S1 | Activation/Runtime/Lifecycle/Compatibility/Mutation 等各自独立 per-team lock，跨模块 race 可能穿透 | 否 |
| H | Security MUST-CHECK | P8 Remote 若直接接受客户端自报 `caller.kind=human`，会构成权限提升 | P8 必须闭合 |

除此之外，还需要重点检查：

- work completion -> SETTLED 是否存在正式 production bridge；
- archive/dispose 的 admission close 是否有真实 production implementation；
- lifecycle durable update 是否具备 CAS / optimistic version semantics；
- production E2E 是否真正 mount shipped plugin，而不是重新手工组装一套 harness runtime；
- Projection 是否完全来自 TeamDomain，而不是 Session log/mirror。

---

# 4. 系统性问题：测试拓扑与产品拓扑不一致

这是本轮审查最重要的问题。

当前多个 Phase 已经构造出质量很高的独立组件：

```text
TeamDomain
ActivationProvider
TeamRuntime
CompatibilityProber
Lifecycle
MutationService
Messaging
Control
Activity
Fork reconciliation
Handoff
Legacy reader
```

大量 unit/integration/harness tests 也确实充分。

但目前审查看到多处：

```text
module exists
tests pass
production path does not call it
```

典型例子：

```text
CompatibilityProber.ensureFreshGeneration()
exists and is well tested

but

new Team work admission
may not actually call it
```

又如：

```text
Lifecycle quiescence algorithm
exists and is strong

but

TeamRuntime production lifecycle port
may not be assembled
```

又如：

```text
MutationService
can compute next-step effective state

but

actual DSH Agent request may never consume it
```

因此后续 Gate 不得继续采用：

```text
A passed
B passed
C passed
=> integration passed
```

必须改为：

```text
shipped plugin entrypoint
-> instantiate production objects
-> authority path
-> durable writes
-> live Agent effect
-> completion/recovery
-> TeamDomain projection
```

逐链审查。

---

# 5. Issue A — Delegate / Follow-up 可能没有真正执行工作

**Severity：S0 / STOP-SHIP**

## 5.1 预期语义

对一个 persistent Member：

```text
Leader / human
    ↓
TeamRuntime work admission
    ↓
compatibility / policy / lifecycle checks
    ↓
ensure Member Agent residency
    ↓
submit model-visible task input
    ↓
Member child Session
    ↓
Agent executes
    ↓
turn finishes
    ↓
Member RUNNING -> SETTLED
    ↓
activity interval closes
```

对 fresh-per-delegation：

```text
new delegation
-> new MemberInstance
-> new child Session
-> submit this delegation's task
```

## 5.2 当前公开代码迹象

重点文件：

```text
packages/runtime/action-router/effects.ts
packages/runtime/activation/*
packages/runtime/messaging/*
packages/tools/harness/plugin.mjs
```

`runWorkAdmission()` 当前核心行为可概括为：

```text
resolve target
validate lifecycle
maybe transition to RUNNING
write team-work-admitted fact
return
```

当前 durable fact 会记录：

```text
targetInstanceId
childSessionId
fromLifecycle
lifecycleCommitted
taskSummary?
requestToken
```

但审查没有看到这个函数继续执行：

```text
Agent.followup()
SessionInputPort.submit...
Agent.steer()
or equivalent real DSH input
```

`runDelegate()` 构造的 `MemberActivationRequest` 当前明显包含：

```text
rootSessionId
source
template / explicit instance
label
groupId?
workspace?
requestToken
callerId
```

但没有发现冻结设计中的：

```text
prompt
attached context
```

相反，MessagingCoordinator 已经存在真正的：

```text
SessionInputPort
-> submitAttributedInput
```

而真实 harness 把它绑定到：

```text
agent.followup(createUserMessage(...))
agent.whenIdle()
```

因此当前公开代码呈现出：

```text
send-message
    -> target Agent can actually receive text

delegate/follow-up
    -> Team control plane records work
    -> target Agent may receive nothing
```

这不是 UI 缺失，而是 runtime execution chain 缺失。

## 5.3 为什么严重

如果这个问题真实存在，会产生 control-plane / data-plane split：

```text
TeamDomain:
work admitted
Member RUNNING

actual DSH:
no task input was ever submitted
```

UI 以后可能显示：

```text
RUNNING
```

但 Member 根本没有工作。

这会进一步污染：

- activity intervals；
- lifecycle；
- progress；
- recovery；
- metrics；
- Timeline；
- debugging；
- Remote semantics。

## 5.4 同一问题的第二部分：work settlement

还必须确认是否有正式 production chain：

```text
actual Member turn completed
-> observed by Team runtime
-> RUNNING work settled
-> durable lifecycle SETTLED
-> activity interval closed
```

当前 P7 compatibility 中出现的 `settleWork()` 不能代替 Member Agent execution settlement。

本地 Agent 应明确回答：

> 哪一个 production file / function 监听或等待实际 Member work completion，并最终更新 Member durable lifecycle？

如果没有，这是与 work delivery 同等级的 S0 缺口。

## 5.5 推荐修复边界

不要在 Remote/UI 直接补：

```text
agent.followup(...)
```

必须维持：

```text
one Team work authority
```

推荐形成类似：

```text
MemberWorkRequest
├─ targetInstanceId
├─ prompt
├─ attachedContext?
├─ attribution
├─ requestToken
└─ work metadata

TeamRuntime
    ↓
MemberWorkExecution/Delivery
    ↓
MemberResidency.ensure
    ↓
real DSH Agent input
    ↓
execution observation
    ↓
settlement
```

命名可变，ownership 不应变。

## 5.6 必须测试

### A-1 fresh creation + task delivery

```text
delegate("Return TOKEN_A")
```

验证：

- MemberInstance 真创建；
- child Session 真创建；
- child Session 的真实 input/history 中存在 `TOKEN_A`；
- Team lifecycle 进入 RUNNING；
- execution 完成后 SETTLED。

不能只验证 ledger 有 `taskSummary=TOKEN_A`。

### A-2 persistent follow-up

```text
SETTLED Member A
follow-up("TOKEN_B")
```

验证：

- instanceId 不变；
- childSessionId 不变；
- Session 收到 `TOKEN_B`；
- RUNNING -> SETTLED。

### A-3 fresh_per_delegation

连续两次：

```text
TOKEN_C
TOKEN_D
```

验证：

- 两个不同 instance；
- 两个不同 child Session；
- 各自收到自己的任务。

### A-4 delivery failure

验证：

```text
durable admission
but input submission fails
```

不能留下假 RUNNING。

必须定义并测试 retry/idempotency。

### A-5 crash after input acceptance

重点检查：

```text
input accepted by DSH
process crashes
Team completion marker not yet written
```

需要明确：

- exactly-once？
- at-least-once？
- stable requestToken dedupe？

不能让 logical work 静默重复执行。

---

# 6. Issue B — Compatibility authority 分裂

**Severity：S0 / STOP-SHIP**

## 6.1 预期语义

所有 new Team work：

```text
follow-up
delegate continue
delegate create
explicit create
future Remote mutation that admits work
```

都必须经过同一个 compatibility truth。

逻辑：

```text
current environment facts
-> environment fingerprint
-> compare durable generation/fingerprint
-> reprobe if stale
-> evaluate durable WARNING/FATAL/PASS
-> validate warning ACK against same mismatch + environment
-> return one admission result
```

## 6.2 当前代码迹象

重点：

```text
packages/runtime/compatibility/probe.ts
packages/runtime/admission/gate.ts
packages/runtime/activation/*
```

P7 CompatibilityProber 已经实现：

- fresh environment facts；
- generation；
- mismatch fingerprint；
- environment fingerprint；
- warning ACK；
- `ensureFreshGeneration()`；
- drift classification。

但当前 P6 admission gate 对 durable compatibility state 的消费，看起来更像：

```text
read durable compatibility state

BLOCKED_FATAL / BLOCKED_WARNING
    -> reject

OPEN / DEGRADED_ACKNOWLEDGED
    -> admit
```

而不是：

```text
ensure current fingerprint first
```

同时 ActivationProvider 又可能直接：

```text
environmentFacts()
evaluateActivationCompatibility(...)
```

形成第二套 live compatibility evaluation。

## 6.3 可能的错误 A：stale OPEN

```text
T0:
environment complete
durable compatibility = OPEN

T1:
required capability disappears

T2:
follow-up()
```

如果 runtime 只读旧 durable OPEN：

```text
new work incorrectly admitted
```

这与 frozen rule 直接冲突。

## 6.4 可能的错误 B：ACK 语义不一致

```text
WARNING
-> human ACK
-> DEGRADED_ACKNOWLEDGED
```

然后：

```text
follow-up
```

可能读取 durable ACK 并 PASS。

但：

```text
delegate-create
```

若 ActivationProvider 又自行重新 evaluate：

```text
warning appears unacknowledged
-> block
```

于是同一个 Team 状态：

```text
same warning
same environment
same valid ACK
```

不同 new-work path 得出不同结果。

这说明存在两套 authority。

## 6.5 为什么此前 Gate 可能没抓到

G7 reviewer 已经分别证明：

```text
CompatibilityProber freshness logic is correct
```

以及：

```text
P6 gate consumes durable compatibility
```

但这不等于：

```text
P6 gate calls P7 freshness before every real new-work admission
```

这是典型的“两个正确模块没有实际闭合”。

## 6.6 推荐修复

收敛为一个内部 authority，例如概念上：

```text
CompatibilityAdmissionPort
```

对所有 new work：

```text
ensureFresh()
-> durable state
-> ACK validation
-> final result
```

ActivationProvider 不应自己维护第二套 WARNING/ACK 解释。

## 6.7 必须测试

### B-1 stale OPEN

```text
OPEN
-> environment drift
-> next follow-up
```

必须 block/reprobe。

### B-2 stale ACK

ACK 绑定 E0。

环境变成 E1。

旧 ACK 必须失效。

### B-3 ACK path consistency

同一个：

```text
DEGRADED_ACKNOWLEDGED
```

分别测试：

- follow-up；
- delegate continue；
- delegate create；
- explicit create。

结果必须一致。

### B-4 in-flight drift

已经 admitted 的 work：

```text
E0 admitted
E1 drift
```

允许当前 work settle，但下一次 admission 必须重新 gate。

---

# 7. Issue C — Leader object model 偏航

**Severity：S0 / STOP-SHIP**

## 7.1 冻结模型

Leader：

```text
LeaderInstance
= root Agent + root Session

no independent child Session
no ordinary Member lifecycle
cannot archive
cannot restore
cannot dispose
```

## 7.2 当前 DTO 矛盾

重点：

```text
packages/contracts/src/dto/member-instance-record.ts
```

`MemberInstanceRecordDto` 当前要求：

```text
childSessionId: ChildSessionId
lifecycle: MemberLifecycleState
```

为必填。

但同一份文件的注释又承认：

```text
Leader has no childSessionId
```

这说明当前 durable DTO 本身无法正确表达冻结的 Leader 模型。

## 7.3 Harness workaround

真实 P6 harness 为 Leader 人工 seed：

```text
instanceId = inst-leader
childSessionId = rootSessionId
lifecycle = RUNNING
```

这是明显的 representation hack：

```text
root Session
```

被塞入了语义叫：

```text
childSessionId
```

的字段。

## 7.4 更严重的问题：fresh root 正式路径可能没有 Leader row

重点：

```text
packages/runtime/root-binding/fresh-root.ts
packages/runtime/admission/resolve.ts
```

`bindFreshTeamRoot()` 当前大致只：

```text
put TeamSession
put team-root binding
bind overlays
```

没有看到它自然创建：

```text
inst-leader
```

对应的 member row。

但 `resolveCaller()` 对 Leader caller 又会：

```text
memberInstances.get(root, inst-leader)
```

不存在则：

```text
CALLER_NOT_FOUND
```

因此可能出现：

```text
real production fresh root
-> TeamSession exists
-> root binding exists
-> no fake leader member row

Leader calls team_delegate
-> resolveCaller(inst-leader)
-> CALLER_NOT_FOUND
```

而 harness 没暴露，是因为 harness 自己手工 seed 了 Leader row。

## 7.5 lifecycle 风险

当前：

```text
archive-member
restore-member
dispose-member
```

是 generic instance-targeted action。

必须确认：

```text
targetInstanceId = inst-leader
```

会在 authority/lifecycle 层 fail closed。

如果没有专门 guard，fake Leader row 可能被当普通 Member：

```text
archive leader
dispose leader
```

这与 frozen architecture 冲突。

## 7.6 推荐修复方向

不建议继续维护：

```text
Leader =
MemberInstanceRecordDto
+ fake childSessionId
+ fake lifecycle
```

可采用：

```text
TeamActorProjection =
  LeaderActor
  | MemberActor
```

durable 层也可以：

```text
Leader identity derived from TeamSession/team-root binding
MemberInstance stored in memberInstances
```

Runtime 的 Leader caller resolution 应由：

```text
TeamSession
+
team-root SessionBinding
```

建立，而不是依赖伪造 child-member record。

如果确实需要 durable Leader-specific overlay/metadata，可设计 Leader-owned record，但不要强行套 Member lifecycle DTO。

## 7.7 必须测试

### C-1 fresh root

通过 production root create：

```text
Team created
-> Leader identity immediately valid
-> Leader can delegate
```

测试不得手工 seed Leader member row。

### C-2 lifecycle rejection

```text
archive(inst-leader)
restore(inst-leader)
dispose(inst-leader)
```

全部 reject。

### C-3 Projection

Remote/Projection 必须将 Leader 表达为：

```text
Leader
```

而不是：

```text
ordinary Member
childSessionId = rootSessionId
lifecycle = RUNNING
```

---

# 8. Issue D — production plugin composition 尚未闭合

**Severity：S0 / STOP-SHIP**

## 8.1 当前迹象

重点：

```text
packages/runtime/src/plugin/host.ts
```

公开审查时该文件仍然写着：

```text
P1-T4 empty skeleton
```

`apply()` 近似：

```ts
export function apply(...) {
  // intentionally empty
}
```

然而 P5–P7 已经实现大量 subsystem。

大量“真实 DSH 集成”存在于：

```text
packages/**/harness/plugin.mjs
```

尤其 P6 harness 自己手工完成：

```text
open/create TeamDomain
parse Blueprint
construct ActivationProvider
construct TeamRuntime
construct ControlService
construct MessagingCoordinator
construct ActivityLedger
construct Team tools
register tools
create/resume root
create/resume members
```

## 8.2 为什么这不是普通“稍后 assembly”

到了 G8，P8 的职责已经是：

```text
Projection / Remote / reconnect / pagination
```

也就是说 backend 应当成为：

```text
production-closed
```

然后 P9 才能纯消费。

如果 shipped plugin 仍为空：

```text
P5/P6/P7 modules
```

只是 library components，不是可安装工作的 Team plugin。

## 8.3 Harness 不能代替 production root

测试代码可以：

```text
mount production plugin
inject static model
inject test observability
```

但不应：

```text
rebuild another Team runtime graph
```

否则测试通过的实际上是：

```text
harness composition
```

而不是：

```text
user-installed composition
```

## 8.4 要求

必须存在唯一正式 production assembly：

```text
plugin apply()
   ↓
TeamDomain
   ↓
Blueprint/catalog
   ↓
Root/member binding
   ↓
Compatibility
   ↓
ActivationProvider
   ↓
TeamRuntime
   ├─ work execution
   ├─ lifecycle
   ├─ mutation
   ├─ messaging
   ├─ control
   └─ activity
   ↓
Projection
   ↓
Remote
```

本地 Agent 应为每一条边列出：

```text
actual file
actual factory/constructor
actual injected dependency
```

缺失的边必须标：

```text
MISSING
```

不能只画理想架构图。

---

# 9. Issue E — work admission 允许 lifecycle 未落盘

**Severity：S0/S1**

## 9.1 当前迹象

重点：

```text
packages/runtime/action-router/effects.ts
```

`EffectContext` 当前：

```text
lifecycleCommit?: LifecycleCommitPort
```

是 optional。

对：

```text
SETTLED -> RUNNING
CREATED -> RUNNING
```

`admitWorkOn()` 会调用：

```text
commitTransition(...)
```

但如果 port 不存在，当前行为可能：

```text
return false
```

然后继续：

```text
commit team-work-admitted
return work-admitted success
```

并在 ledger 中记录：

```text
lifecycleCommitted: false
```

## 9.2 错误状态

于是可能出现：

```text
durable Member = SETTLED

follow_up()
-> success
-> team-work-admitted
-> lifecycleCommitted=false

durable Member still SETTLED
```

这不是可以接受的 degraded mode。

如果 work 已真正进入 Agent，更严重：

```text
actual work running
durable state SETTLED
```

## 9.3 正确 invariant

对一个当前非 RUNNING 的 work-accepting Member：

```text
required lifecycle transition
must commit
before successful work admission can be exposed
```

如果 required port 不存在：

```text
fail closed
```

## 9.4 Repository mutation 也需要检查

如果 `memberInstances` repository 主要支持：

```text
put-if-absent
get
list
delete
```

而没有稳定的 lifecycle update/CAS，则 lifecycle 模块即使算法正确，也无法保证真实 durable concurrency correctness。

建议具备类似：

```text
updateMember(
  identity,
  expectedActivityVersion,
  expectedLifecycle,
  nextRecord
)
```

语义。

需要防：

```text
lost update
stale writer
archive vs follow-up
double settle
restore vs new work
```

## 9.5 必须测试

### E-1 no lifecycle port

必须证明：

```text
SETTLED follow-up
+ missing commit capability
=> reject
```

不能成功。

### E-2 CAS race

两个并发 lifecycle mutation：

```text
same expected version
```

只能一个提交。

### E-3 restart

RUNNING/SETTLED truth 在 restart 后必须与最后 durable commit 一致。

---

# 10. Issue F — Mutation control plane 可能未作用于 live Agent

**Severity：S1 / MUST-FIX BEFORE P9**

## 10.1 当前实现的优点

P7 mutation 语义已经包含：

- HumanOverride；
- TemplateOverlay；
- InstanceOverlay；
- PolicyState；
- future-boundary；
- `effectiveFromStep`；
- per-step frozen resolution；
- external hard policy；
- leader envelope；
- member self-escalation denial。

这些本身方向正确。

## 10.2 需要验证的核心

必须区分：

```text
TeamDomain/effective config says model=B
```

与：

```text
next actual DSH model request uses model=B
```

同理：

```text
Team says tool denied
```

不等于：

```text
next actual tool execution is denied
```

## 10.3 需要追踪的 production chain

### Model

```text
authorized mutation
-> durable override
-> future step boundary
-> ModelSelection.current / relevant public seam
-> actual next request assembled
-> actual provider/model route = new value
```

### Tool/permission

```text
authorized mutation
-> durable effective policy
-> future operation
-> DSH tool filtering/pre-execute/guard
-> operation really blocked/removed
```

### Skill/MCP

只对已经通过 G2 public-seam proof 的能力进行正式 wiring。

## 10.4 冷恢复

restart 后：

```text
TeamDomain durable override
-> cold bind
-> next actual Agent step
-> same effective mutation
```

不能只恢复 UI projection。

## 10.5 必须测试

### F-1 Model A -> B

```text
current request uses A
authorized mutation to B
current in-flight remains A
next real request uses B
restart
next resumed request still uses B
```

测试必须观测真实 selected route。

### F-2 Capability

选择一个已证明 public seam 的能力：

```text
allowed
-> future-operation deny
-> next actual operation fails/absent
-> restart
-> remains denied
```

---

# 11. Issue G — 跨模块 concurrency fence 风险

**Severity：S1 / MUST-CHECK**

当前还不足以断言所有 race 已经真实可复现，但风险很高。

## 11.1 当前模式

多个模块各自可能维护：

```text
Map<rootSessionId, Promise<...>>
```

例如：

```text
ActivationProvider
TeamRuntime
Lifecycle
CompatibilityProber
Mutation/Control
```

各自模块内部是串行。

但是：

```text
Runtime lock A
!=
Lifecycle lock B
```

不能形成 TeamSession-level atomic boundary。

## 11.2 典型 race

### G-1 follow-up || archive

```text
A follow-up:
read SETTLED
pass admission

B archive:
close admission
quiesce
commit ARCHIVED

A:
continue work commit/delivery
```

最终可能：

```text
ARCHIVED + admitted work
```

### G-2 compatibility drift || admission

如果：

```text
freshness check
```

和：

```text
work durable admission
```

不在同一个 logical operation fence，中间 environment/generation 可能变化。

### G-3 mutation || step begin

未来边界语义要求：

```text
in-flight uses old config
next boundary uses new config
```

如果 beginStep 与 mutation commit 没有明确 ordering，则可能 nondeterministic。

## 11.3 推荐原则

若 race test 证明问题成立：

不要再增加：

```text
another local lock
```

而应考虑共享：

```text
TeamOperationCoordinator
```

至少统一需要 atomic read-decision-commit 的 Team operations。

同时区分：

### 单进程

```text
shared in-process serialization
```

### durable/crash

```text
generation / optimistic CAS / journal
```

不能依赖进程内 promise-chain 解决 crash consistency。

---

# 12. Issue H — Remote human authority trust boundary

**Severity：Security MUST-CHECK**

目前不能直接称为公开 exploitable vulnerability，因为 P8 Remote 可能尚未完全 push。

但必须在 G8 解决。

## 12.1 内部 Runtime

内部 `ActionCaller`：

```text
{ kind: human, humanId }
```

可以被视为 trusted principal。

`resolveCaller()` 当前会直接赋予：

```text
role = human
```

这在 internal API 中可以成立。

## 12.2 External Remote 不得照搬

浏览器不能自由发送：

```json
{
  "caller": {
    "kind": "human",
    "humanId": "anything"
  }
}
```

然后 Runtime 信任。

否则可绕过：

- Team autonomy envelope；
- member self-escalation；
- leader-only transitions；
- human override restrictions；
- control resolution authority。

## 12.3 正确 trust boundary

```text
browser
   ↓
DSH authenticated / host-known connection/session principal
   ↓
server-side principal derivation
   ↓
internal ActionCaller
   ↓
TeamRuntime
```

Member/Leader caller 也应从：

```text
bound DSH Session
+
TeamDomain SessionBinding
```

推导，而不是客户端自报 instanceId + role。

## 12.4 必须测试

攻击场景：

```text
ordinary client sends human caller payload
```

不得获得：

- human mutation；
- human create-member；
- user-approval resolution；
- PolicyState human transition。

---

# 13. Lifecycle 模块本身：当前值得保留的正确部分

本轮不应误判为“整个 lifecycle 都错了”。

当前：

```text
packages/runtime/lifecycle/quiesce.ts
```

所体现的 Archive/Dispose live-side 顺序是健康的：

```text
1. close new admission
2. interrupt current activity
3. drain generic descendants
4. verify quiescent
5. release Agent residency
6. only then durable lifecycle commit
```

其 fail-closed 处理方向正确：

```text
live step fault
-> no durable transition
```

尤其：

```text
non-quiescent
-> no release
-> no durable archive/dispose
```

这是应保留的。

真正问题在于：

> **这套正确算法是否被正式 production runtime 注入并调用。**

---

# 14. Control/Approval 模块：当前基本方向健康

P6 control plane 当前设计值得保留：

```text
ControlRequest durable
ControlDecision durable
allow consumption durable
actual operation remains in DSH execution pipeline
```

exact-scope + correlation + exactly-once consumption 的思路是正确的。

需要额外检查的是：

```text
packages/tools/src/guard.ts
```

当前对：

```text
NO_REQUEST
```

采用：

```text
proceed
```

这个语义本身未必错误——普通 autonomy path 不应要求所有操作都先建立 approval request。

但必须保证：

```text
operation that REQUIRES approval
```

不会因为没有 request 而走普通 path。

即：

```text
"no request means uncontrolled/ordinary allowed path"
```

和：

```text
"this operation requires approval"
```

之间必须存在 authoritative classification。

否则：

```text
no request -> proceed
```

会成为 approval bypass。

本轮应增加一个 targeted security review，但除非复核证明确实能绕过，否则先不列为独立 S0。

---

# 15. Fork / Handoff / Legacy：目前未发现需要推翻的方向

公开 G7 证据显示：

## Root fork

目标仍是：

```text
same immutable Blueprint snapshot
+
new TeamSession
+
zero MemberInstances
```

没有修改 `session.fork`。

方向健康。

## Member fork

```text
ordinary independent AgentSession
```

不成为 Member。

方向健康。

## Handoff

one-shot frozen snapshot：

```text
source Session
-> snapshot once
-> summarize once
-> create Team
```

之后无 live source read grant。

方向健康。

## Legacy

existing legacy Team：

```text
READ-ONLY
```

无 resume/mutate/restore。

方向健康。

因此本轮不要趁机重构这些已经正确的部分。

---

# 16. P8 Projection freeze 前的强制检查

P8 是当前非常关键的边界。

一旦 Projection DTO freeze，P9 会大量依赖它。

所以以下后端语义必须先正确。

## 16.1 Projection authority

必须：

```text
TeamDomain
-> Projection
```

不得：

```text
scan root Session events
scan child messages
SessionController mirror
```

来重建 Team current state。

Session history 只用于：

- selected Session Chat；
- selected Session Trajectory；
- navigation；
- actual first-person execution evidence。

## 16.2 Leader representation

Projection 不能固化：

```text
Leader =
ordinary Member
childSessionId = rootSessionId
lifecycle = RUNNING
```

应明确区分：

```text
Leader actor
Member actor
```

## 16.3 至少需要暴露

```text
TeamSession
Blueprint snapshot
Leader
MemberTemplates
MemberInstances
lifecycle
residency if exposed
workspace
activity intervals
compatibility/admission
effective overrides/config
control state
coordination facts
Team ledger/events
legacy read-only status
```

---

# 17. Production Closure Gate 应新增的核心 E2E

本轮最重要的测试不是再加几百个 module unit tests。

需要一条：

```text
canonical production-path E2E
```

而且必须经过：

```text
actual shipped plugin entrypoint
```

## 17.1 推荐 scenario

```text
1. mount production dsh-agent-team plugin

2. create Team using production creation entry

3. assert:
   TeamSession exists
   Blueprint snapshot is bound
   Leader identity valid
   no fake leader-member seeding required

4. Leader delegates:
   "Return TOKEN_A"

5. assert:
   Member created
   child Session created
   actual DSH Session receives TOKEN_A
   Member durable lifecycle RUNNING

6. allow actual Agent turn to finish

7. assert:
   durable lifecycle SETTLED
   activity interval closed

8. follow-up same Member:
   "Return TOKEN_B"

9. assert:
   same instanceId
   same childSessionId
   actual Session receives TOKEN_B
   RUNNING -> SETTLED

10. archive

11. assert:
    admission closed
    work interrupted if needed
    descendants drained
    residency released
    ARCHIVED committed

12. restore

13. assert:
    ARCHIVED -> SETTLED
    zero Agent create
    zero Agent resume

14. follow-up restored Member

15. assert:
    same child Session cold-resumed
    task delivered

16. authorized model mutation A -> B

17. assert:
    in-flight stays A
    next actual request uses B

18. compatibility environment drift

19. new work

20. assert:
    stale state detected
    block/reprobe as defined

21. valid ACK if warning

22. verify:
    follow-up/create/delegate consume same ACK semantics

23. process restart

24. production plugin reopens Team

25. assert:
    TeamDomain reconstructed
    Members preserved
    bindings preserved
    mutation state preserved
    compatibility state correct
    no duplicate instances

26. read Projection/Remote

27. assert:
    projection matches TeamDomain
    Leader semantics correct
```

可以使用 static model provider，但：

```text
DSH Agent/Session runtime must be real.
```

---

# 18. Race Matrix

G8 supplemental 至少应执行：

| Race | 预期 |
|---|---|
| follow-up || archive | 不出现 ARCHIVED + newly admitted work |
| follow-up || dispose | 不允许 terminal target 后继续 work |
| restore || follow-up | restore 本身不 resume；follow-up 才可触发 resume |
| create || create same quota boundary | 不 oversubscribe |
| compatibility drift || admission | 新 work 不越过 stale generation |
| warning ACK || environment drift | 旧 ACK 失效 |
| mutation || begin next step | future-boundary deterministic |
| two lifecycle commits same expected version | 最多一个成功 |
| work delivery retry same requestToken | 不静默重复 logical work |

---

# 19. Crash Matrix

由于：

```text
TeamDomain
+
DSH Session persistence
```

没有跨系统 ACID transaction，必须明确 crash windows。

## 19.1 Member creation

检查：

```text
journal recorded
child not created

child created
session binding absent

session binding committed
Member row absent

Member row committed
ledger finalization absent
```

重启必须收敛为：

```text
one logical MemberInstance
one durable child Session
```

## 19.2 Work delivery

这是目前尤其需要补设计/测试的地方。

检查：

```text
work admission intent durable
input not delivered

input delivered
completion not observed

input delivered
process dies before Team work state finalization

retry same logical work
```

必须明确：

```text
exactly-once
or
at-least-once
```

不能隐含。

## 19.3 Lifecycle

检查：

```text
quiesce completed
before durable commit crash

durable commit done
ledger fact absent
```

recovery 必须 deterministic。

---

# 20. Production Topology Audit 要求

本地 Agent 在修代码前，应先生成实际 topology。

推荐文件：

```text
dev/agent-workflow/evidence/G8-PRODUCTION-CLOSURE/production-topology.md
```

必须逐边写：

```text
component
actual production factory
actual owner
actual injected ports
actual durable dependency
actual live-Agent dependency
```

例如：

```text
Plugin apply()
  -> TeamDomain
     file:
     factory:
  -> Compatibility
     file:
     factory:
  -> ActivationProvider
     file:
     factory:
  -> TeamRuntime
     file:
     factory:
...
```

如果一条边只存在于：

```text
harness/plugin.mjs
```

则标：

```text
HARNESS_ONLY
```

如果不存在：

```text
MISSING
```

这是本轮比测试计数更重要的 evidence。

---

# 21. 对 Gate 审查方法的修正

新的 G8 reviewer 不应只问：

```text
Did tests pass?
```

必须对每个 architecture-critical subsystem 回答：

1. **Where is it instantiated in production?**
2. **Who owns authority?**
3. **What durable state changes?**
4. **What real Agent effect occurs?**
5. **What happens on process restart?**
6. **Which production E2E proves it?**

如果一个模块：

```text
exists
tests pass
```

但 reviewer 无法回答：

```text
Where is it instantiated by the shipped plugin?
```

则应判：

```text
NOT PRODUCTION-CLOSED
```

---

# 22. 建议本轮代码修复顺序

为了减少 contract churn，推荐：

```text
Step 1
Actual production topology audit

Step 2
Fix Leader object-model contradiction

Step 3
Fix durable Member lifecycle update/CAS path

Step 4
Fix actual work request contract:
prompt + attachedContext + attribution + requestToken

Step 5
Wire work delivery + residency + settlement

Step 6
Unify compatibility freshness/admission authority

Step 7
Wire mutation to actual DSH request/operation seams

Step 8
Resolve proven cross-module race/fence issues

Step 9
Complete canonical production plugin composition

Step 10
Freeze corrected Projection/Remote

Step 11
Run production E2E + race + crash + security matrix

Step 12
Independent supplemental G8 review
```

如果本地最新代码已经修改其中若干部分，可跳过，但必须保留验证。

---

# 23. G8 Supplemental PASS 条件

以下应全部闭合：

```text
[ ] shipped production plugin entrypoint not empty

[ ] fresh Team root naturally yields a valid Leader actor identity

[ ] no fake Leader childSessionId required

[ ] Leader cannot archive / restore / dispose independently

[ ] delegate delivers real model-visible work to Member Session

[ ] follow-up delivers real work to same child Session

[ ] fresh_per_delegation delivers each task to a new Member + new Session

[ ] required lifecycle transition cannot silently remain uncommitted

[ ] work enters durable RUNNING consistently

[ ] actual work completion settles lifecycle/activity

[ ] Restore only ARCHIVED -> SETTLED and never creates/resumes Agent

[ ] new work on cold SETTLED Member resumes same Agent Session identity

[ ] one compatibility authority covers every new-work path

[ ] stale OPEN cannot admit new work

[ ] warning ACK semantics are identical across follow-up/create/delegate

[ ] mutation changes actual future DSH model/capability behavior

[ ] mutation survives restart

[ ] race matrix passes

[ ] Remote cannot self-assert human authority

[ ] TeamDomain remains control-plane truth

[ ] Projection comes from TeamDomain

[ ] Remote does not become a second authority

[ ] canonical E2E mounts shipped production plugin rather than reconstructing harness runtime

[ ] process restart reconstructs Team correctly

[ ] no upstream core patch

[ ] no private upstream import

[ ] no Team-specific SessionEvent

[ ] no SessionController Team mirror
```

任一 architecture-critical 条件失败：

```text
G8 SUPPLEMENTAL = BLOCKED
```

不要因为“原 Phase 已经 PASS”而拒绝回补 P5/P6/P7。

---

# 24. 当前看起来健康、不应无谓推翻的部分

为了避免 remediation 变成新的大重构，以下方向目前应优先保留：

- 独立 `dsh-agent-team` repository；
- zero-core；
- TeamDomain sidecar；
- immutable Blueprint snapshot；
- instance-first addressing；
- one template -> N instances；
- `fresh_per_delegation = new instance`；
- Team Member != generic subagent；
- restore/resume 分离；
- lifecycle quiescence 顺序；
- durable control request/decision；
- exactly-once approval consumption 思路；
- fork sidecar reconciliation；
- one-shot handoff；
- legacy read-only；
- no SessionController Team mirror；
- no Team SessionEvent authority；
- Projection 基于 TeamDomain 的方向。

本轮不是重写项目。

真正目标是：

> **把已经做得不错的 subsystem 第一次严密地接成一个 production-closed backend。**

---

# 25. 本地 Agent 应优先审查的文件清单

以下路径来自当前公开代码审查。

## Contracts / object model

```text
packages/contracts/src/dto/member-instance-record.ts
packages/contracts/src/dto/team-session-record.ts
packages/contracts/src/identity.ts
packages/contracts/src/index.ts
```

重点：

- Leader representation；
- childSessionId；
- lifecycle；
- Remote DTO freeze。

## Root / Member Agent binding

```text
packages/runtime/root-binding/fresh-root.ts
packages/runtime/root-binding/*
packages/runtime/member-residency/*
packages/runtime/agent-setup/binder/*
packages/runtime/agent-setup/persona/*
packages/runtime/agent-setup/model/*
packages/runtime/agent-setup/capability/*
```

重点：

- production instantiation；
- Root leader identity；
- cold resume；
- actual overlay application。

## Activation / Runtime

```text
packages/runtime/activation/*
packages/runtime/admission/*
packages/runtime/action-router/*
```

重点：

- work prompt/context；
- one authority；
- lifecycle commit；
- compatibility freshness；
- caller resolution；
- Leader lifecycle exclusion。

## Messaging / work delivery

```text
packages/runtime/messaging/*
```

重点：

- 已有 SessionInputPort 能否作为统一 work delivery substrate；
- 不要建立第二 authority。

## Lifecycle

```text
packages/runtime/lifecycle/*
```

重点：

- real commit port；
- CAS；
- production assembly；
- admission-close implementation。

## Compatibility

```text
packages/runtime/compatibility/*
packages/runtime/admission/gate.ts
packages/runtime/activation/checks.ts
```

重点：

- `ensureFreshGeneration` 是否被真实 new-work path 调用；
- ACK 是否只有一套 truth。

## Mutation / policy

```text
packages/runtime/mutation/*
packages/runtime/policy-adapter.ts
packages/runtime/agent-setup/model/*
packages/runtime/agent-setup/capability/*
```

重点：

- durable；
- actual future Agent effect；
- restart。

## Control

```text
packages/runtime/control/*
packages/tools/src/guard.ts
```

重点：

- NO_REQUEST semantics；
- approval-required classification；
- Remote trust boundary。

## Production plugin

```text
packages/runtime/src/plugin/host.ts
packages/client/src/plugin/client.ts
```

重点：

- 是否仍是 skeleton；
- production assembly；
- Remote registration；
- client-only consumption。

## Harness

```text
packages/tools/harness/plugin.mjs
packages/runtime/root-binding/harness/*
packages/runtime/member-residency/harness/*
```

重点：

- 哪些能力只存在 harness；
- production code 是否真正复用同一 assembly；
- 禁止 harness 成为事实上的产品 root。

---

# 26. 公开仓库审查的已知局限

必须特别注意：

用户明确说明：

> 当前本地 Agent 已经执行到 G8 第一个补充轮次，提交内容可能略落后开发进度。

因此本报告不应被当作：

```text
"these defects definitely exist in local HEAD"
```

而应理解为：

```text
"these defects are present or strongly indicated in the audited GitHub snapshot,
and each one must be independently revalidated against the latest local HEAD."
```

建议本地 Agent 给每项标记：

```text
CONFIRMED
ALREADY_FIXED
PARTIALLY_FIXED
FALSE_POSITIVE
```

然后再决定修改。

---

# 27. 建议最终 evidence 目录

```text
dev/agent-workflow/evidence/G8-PRODUCTION-CLOSURE/
├─ audit-report.md
├─ production-topology.md
├─ confirmed-defects.md
├─ false-positives.md
├─ remediation-plan.md
├─ production-e2e-report.md
├─ crash-matrix.md
├─ race-matrix.md
├─ security-review.md
├─ zero-core-review.md
└─ final-g8-supplemental-verdict.md
```

---

# 28. `audit-report.md` 建议格式

每项：

```text
ID:
Severity:
Local status:
  CONFIRMED
  ALREADY_FIXED
  PARTIALLY_FIXED
  FALSE_POSITIVE

Frozen requirement:

Audited GitHub behavior:

Latest local behavior:

Actual production call path:

Why this is / is not a defect:

Can P9 legitimately fill it?
YES / NO

Required remediation:

Tests added:

Production E2E evidence:

Reviewer verdict:
```

---

# 29. 最终 reviewer 必须回答的 10 个问题

G8 supplemental 最终报告必须给出具体 file/function/test。

## Q1

Leader：

```text
delegate("do X")
```

之后，`X` **具体在哪个 production function 被送进哪个 DSH Agent/Session？**

## Q2

Member 完成 turn 后：

```text
RUNNING -> SETTLED
```

由谁观察、谁提交 durable state？

## Q3

SETTLED + evicted Member follow-up 时：

谁 resume Agent？

为什么仍是同一个 child Session？

## Q4

Environment drift 后：

所有 new-work paths 在哪里统一做 freshness/ACK admission？

## Q5

为什么 durable warning ACK 不会被 ActivationProvider 的另一套兼容逻辑重新拒绝？

## Q6

fresh root 的 Leader identity 如何成立？

为什么无需：

```text
childSessionId = rootSessionId
```

workaround？

## Q7

archive 与 concurrent follow-up 为什么不能最终产生：

```text
ARCHIVED + admitted work
```

？

## Q8

Remote human authority 从哪里得到？

为什么 browser 无法伪造？

## Q9

Model/capability mutation 从：

```text
TeamDomain
```

到：

```text
actual next DSH request/tool operation
```

的完整路径是什么？

## Q10

用户实际安装运行的 production plugin entrypoint 是哪个？

canonical E2E 是否只通过该 entrypoint 构造 Team runtime？

---

# 30. 最终结论

从当前公开 GitHub 快照看，项目没有出现“整体架构方向已经失败”的迹象。

相反，P3–P7 已经构造出许多质量较高的 subsystem。

真正危险的是：

```text
correct pieces
+
incomplete production composition
```

造成的“看起来都通过了测试，但真实产品路径没有闭合”。

所以当前不建议：

```text
rollback
rewrite from scratch
reopen architecture
```

也不建议直接进入：

```text
P9 UI implementation
```

更合理的是把 G8 补充轮次升级为：

```text
Production Closure Gate
```

要求：

```text
Frozen Architecture
        ↓
one durable TeamDomain truth
        ↓
one authority model
        ↓
real DSH Agent/Session execution
        ↓
correct lifecycle / compatibility / mutation
        ↓
crash + race + restart correctness
        ↓
stable Projection / Remote
        ↓
P9 UI becomes a pure consumer
```

只有达到这个状态，G8 才应该 PASS。

---

# Appendix A — 一页式问题索引

## A — Work delivery missing

```text
delegate/follow-up
-> admission/ledger
-> ?
-> actual Member Agent
```

检查是否中间为空。

## B — Compatibility dual authority

```text
CompatibilityProber
vs
Runtime gate
vs
ActivationProvider
```

必须收敛为一套。

## C — Leader fake member

```text
inst-leader
childSessionId=root
lifecycle=RUNNING
```

与 frozen architecture 冲突。

## D — Production apply empty

```text
harness works
!=
plugin works
```

## E — lifecycleCommitted=false success

不得作为成功 new-work admission。

## F — Mutation only in Team control plane

必须证明 actual Agent future request/operation 变化。

## G — independent locks

模块内串行不等于 Team-level atomicity。

## H — Remote human spoofing

External caller identity 必须 server-side derive。

---

# Appendix B — 不应再出现的反模式

```text
"test says work admitted"
but no real Agent input

"effective model = B"
but actual request still A

"compatibility module is correct"
but runtime never invokes freshness

"lifecycle module is correct"
but production runtime never injects it

"harness E2E passes"
but shipped plugin apply() is empty

"Leader is unified with Member"
implemented as fake childSessionId

"all modules have locks"
but different locks

"Remote receives caller"
and trusts browser-declared human
```

---

# Appendix C — 本轮修复成功的判据

成功不是：

```text
more tests
more abstractions
more reports
```

而是：

```text
production entrypoint
-> real Team creation
-> real Leader authority
-> real Member task delivery
-> real Agent execution
-> durable lifecycle convergence
-> unified compatibility
-> real runtime mutation
-> restart recovery
-> TeamDomain projection
-> secure Remote
```

这条链必须能被一个独立 Reviewer 从代码和 E2E evidence 中逐步追踪出来。
