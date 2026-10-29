# dsh-agent-team Pre-Alpha.3 重构后系统设计

> 目标：在不改 upstream DSH、不升级 TeamDomain v2 的前提下，将 Alpha.2 之后分散的 governance / policy / compatibility / MCP / Control / Recovery 语义收敛为单一 authority graph，为 Alpha.3 和长期无人值守 Team 运行提供稳定基础。

---

## 1. 设计目标

重构后的系统必须满足：

1. 每一类 durable truth 只有一个 writer authority。
2. runtime、inspect、projection、UI 不再各自拼装同一政策。
3. “允许使用”“必须存在”“部署提供”“当前可达”“当前已挂载”互不混淆。
4. 所有安全相关变更 durable-before-ack。
5. restart 后能够精确恢复已确认的 durable intent；ephemeral runtime fact 重启后重新观测。
6. 故障只能缩小 Agent 能力，不能造成任何权限扩张。
7. required dependency failure 有明确 Recovery 路径，且 Team 不会因 recovery gate 自锁死。
8. 每次重要 outage/recovery/retry 都可审计。
9. wire compatibility 与内部 architecture 解耦。
10. master 在每个重构 PR 合并点仍可运行。

---

## 2. 总体模块图

```text
                         ┌──────────────────────────┐
                         │     Blueprint Authority   │
                         │  v1 reader / v2 reader    │
                         │ immutable bound snapshot  │
                         └────────────┬─────────────┘
                                      │
                  ┌───────────────────┼───────────────────┐
                  │                   │                   │
                  ▼                   ▼                   ▼
      ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────┐
      │ Governance        │  │ Requirement /    │  │ Runtime Substrate  │
      │ Mutation Service  │  │ Readiness Auth.  │  │ Resolver           │
      └─────────┬────────┘  └─────────┬────────┘  └─────────┬──────────┘
                │                     │                     │
                ▼                     │                     │
      ┌──────────────────┐            │                     │
      │ EffectivePolicy  │            │                     │
      │ Reader            │            │                     │
      └─────────┬────────┘            │                     │
                │                     │                     │
       ┌────────┼────────┐            │                     │
       ▼        ▼        ▼            ▼                     ▼
     model     MCP     inspect   CapabilityReadiness   actual preset/model/
     derive    policy    view       Provider           host supply facts
       │        │                       │
       │        └──────────┬────────────┘
       │                   ▼
       │          ┌─────────────────────┐
       │          │ Runtime Materializer │
       │          │ MCP per-server       │
       │          │ request boundaries   │
       │          └──────────┬──────────┘
       │                     │
       └─────────────────────┼─────────────────────────┐
                             ▼                         ▼
                   ┌───────────────────┐      ┌──────────────────┐
                   │ Requirement Gate  │      │ Runtime Status    │
                   │ normal/recovery   │      │ ephemeral current│
                   └─────────┬─────────┘      └─────────┬────────┘
                             │                          │
                             ▼                          ▼
                    ┌─────────────────┐       ┌────────────────────┐
                    │ Control Service │       │ Durable Telemetry   │
                    │ generalized     │       │ Team Ledger         │
                    └─────────────────┘       └────────────────────┘
```

独立 plane：

```text
ArtifactReadGrant ── system-minted narrow resource capability
External Hard      ── absolute ceiling
Remote adapters    ── wire compatibility only
Projection/UI      ── read-only derived views
```

---

## 3. Authority Map

### 3.1 Blueprint Authority

**Authority：immutable Blueprint snapshot。**

Blueprint source 支持：

- v1：旧 closed schema，按旧规则读取；
- v2：新增 per-template requirements。

禁止在 v1 中“悄悄收紧”已有字段语义，避免 frozen v1 source 在 cold resume 时无法重新 parse/hash。

目标 v2 概念结构：

```yaml
schemaVersion: 2

requirements:                  # Team-level
  - domain: persona
    name: standard
    optional: false

leader:
  templateId: leader
  persona: ...
  requirements:               # Leader-level
    - domain: mcp
      name: planner
      optional: false

members:
  - templateId: infra
    persona: ...
    requirements:             # Template-level
      - domain: mcp
        name: planner
        optional: false
```

v1 normalization：

```text
template.requirements = []
```

---

### 3.2 GovernanceMutationService

负责“谁能改变什么治理状态”。

输入：

```text
actor
team / instance scope
desired mutation
expectedGeneration?
```

统一执行：

```text
resolve identity
→ read Blueprint/autonomy envelope
→ read current PolicyState
→ External Hard validation
→ actor escalation validation
→ desired-state no-op check
→ expectedGeneration check
→ shared TeamOperationChain
→ durable commit
→ return committed result
```

canonical durable families：

- autonomy/human override：override store；
- PolicyState：ledger；
- creation-frozen fields：既有 canonical home。

禁止 Remote/Tools 直接调用 override persistence primitive。

---

### 3.3 EffectivePolicyReader

唯一 production read path：

```text
resolveMemberPolicy(rootSessionId, instanceId)
```

读取：

```text
bound Blueprint
current PolicyState
current durable overrides
external policy facts
```

返回：

```text
effective cells
provenance
committed generation
```

consumer 只允许派生：

```text
ModelSelection     = derive(effectivePolicy)
McpPolicyView      = derive(effectivePolicy)
InspectConfig      = derive(effectivePolicy)
ActivationPolicy   = derive(effectivePolicy)
```

不允许 consumer 再自行 assemble precedence。

---

### 3.4 Requirement / Readiness Authority

负责“当前环境是否满足 Team/Template 运行条件”。

输入：

- Blueprint requirements；
- template availability durable decisions；
- DegradationConsent；
- RuntimeSubstrateResolver；
- CapabilityReadinessProvider；
- materialization status。

输出至少包含：

```text
scope: team | leader | template | instance
requirement
requiredness
supply
readiness
materialization
startupDisposition
normalWorkAllowed
recoveryAllowed
reason
```

它不负责 governance authorization。

---

### 3.5 RuntimeSubstrateResolver

解决 PR #22 暴露的事实源分叉。

原则：

> preflight、post-create compatibility、actual mount、persona overlay 必须消费同一个“实际将运行的 substrate plan”。

当前 deployment 若仍以 row `rootPresetId/memberPresetId` 为实际 mount authority，则这些值必须成为 server-side RuntimeSubstrateResolver 的输入；UI 不能再把一个不会进入 creation/mount 的 arbitrary `presetId` 表现成“Team 将实际使用的 preset”。

在未来真正支持 per-Team preset selection 前，UI 对 runtime preset 应是**读取实际 plan**，而不是产生第二个 authority。

Persona 建模：

```text
ObservedPersonaKind =
  absent | standard | complete | unresolved

RequiredPersonaKind =
  与 observed kind 分离
```

当前目标 recommendation：

```text
Blueprint Team persona requirement = standard/composable substrate
```

`unresolved` 必须 typed fail，不得包装成普通 `PERSONA_INCOMPATIBLE`。

动态 `disabled` 无法求值时不得猜 `standard`；优先读取 DSH 已求值后的 effective composition，否则 `unresolved` fail closed。

---

## 4. Capability 五层模型

以 MCP `abtem` 为例：

```text
Policy
  allowed / denied

Requirement
  none / optional / required

Supply
  configured / missing

Readiness
  unknown / reachable / unreachable
  + source + observedAt + reason

Materialization
  not-applicable / pending / mounted / failed
```

### 4.1 示例：cold member

```text
Policy          allowed
Requirement     required
Supply          configured
Readiness       unknown
Materialization not-applicable
```

这是健康状态，不应 block Team。

### 4.2 示例：resume 失败

```text
Policy          allowed
Requirement     required
Supply          configured
Readiness       reachable
Materialization failed
```

表示服务本身可达，但 Agent-local mount 失败；该 applicable work boundary 被 block。

### 4.3 示例：optional outage

```text
Policy          allowed
Requirement     optional
Supply          configured
Readiness       unreachable
Materialization failed
```

startup 时要求 consent；运行中自动 degraded。

---

## 5. MCP Runtime

`reconcileMcpSet()` 改为 per-server independent convergence：

```text
deny-first:
  先卸载 durable policy 已禁止的 server

for each target server:
  already mounted → keep
  retry cooldown active → keep failed status
  attempt mount:
    success → commit this fiber
    failure → record only this server failure
```

禁止：

```text
A mount success
B mount success
C mount failure
→ rollback A/B
```

Retry：

- setup/request boundary 自动触发；
- bounded cooldown/backoff；
- manual recheck 可绕过普通 cooldown；
- 当前 retry state ephemeral；
- 每次重要 attempt/result 写 durable `capability-runtime-event`。

---

## 6. Durable Telemetry

统一 capability fact：

```text
factType: capability-runtime-event
payload:
  event:
    readiness-lost |
    readiness-restored |
    retry-attempted |
    retry-failed |
    mount-started |
    mount-succeeded |
    mount-failed |
    unmounted
  capabilityType
  capabilityName
  scope
  instanceId?
  source
  observedAt
  reasonCode?
  reasonDetail?
  attempt?
  consecutiveFailures?
```

每条 fact 正常推进 `team_sessions.generation`。

其他独立 durable facts：

```text
optional-requirement-accepted
template-availability-set
recovery-incident-opened
recovery-incident-closed
control-request-abandoned   # 或等价 additive close fact
```

当前 readiness/materialization 不能从历史 fact 直接恢复为 current truth；process restart 后重新置为 `unknown/not-applicable`，再 fresh probe。

---

## 7. Startup Preflight

面向无人值守，创建/进入运行前预检：

```text
Team-level requirements
Leader requirements
ALL MemberTemplate requirements
```

### Optional unavailable

必须存在 `DegradationConsent`：

```text
rootSessionId
blueprintContentHash
scope(team/template)
templateId?
domain
name
acceptedBy
acceptedAt
```

同一 immutable Blueprint requirement restart 不重复询问。

### Required unavailable

- Team-level：必须修复，不能通过 disable template 绕过；
- Template-level：必须修复，或 Human 显式 disable template。

template disable 是 durable environment disposition，不是 governance deny。

运行中恢复后：

```text
recheck PASS
→ Human explicit enable
```

不会自动 re-enable。

---

## 8. Normal / Degraded / Recovery

Recovery **不存 durable mode flag**。

派生：

```text
RecoveryState =
  f(
    Blueprint requirements,
    template availability,
    fresh readiness,
    applicability/materialization
  )
```

### Team-level required failure

```text
all normal work admission = paused
recovery/control/diagnostic/lifecycle = available
```

### Template-level required failure

```text
normal work for affected template = blocked
unaffected templates = normal
affected template may run recovery turn
```

### Optional runtime failure

```text
normal work continues
runtime status = degraded
durable outage telemetry written
```

---

## 9. Recovery Authority

安全不变量：

```text
RecoveryAuthorizedSurface
  ⊆ NormalAuthorizedSurface - unavailableCapabilities
```

进入 Recovery 不得：

- 把 deny 变 ask；
- 把 ask 变 allow；
- 扩 filesystem scope；
- 绕过 mutation envelope；
- 绕过 External Hard；
- 获得原来没有的 bash/write/MCP。

Recovery 只是允许 Agent **在剩余原授权能力上继续取证/修复**。

---

## 10. Requirement Impact 与 Team actions

不能只依赖 `READ/WORK/CREATION/COORDINATION/LIFECYCLE` category 推断 requirement gate。Action registry 增加明确的 requirement/execution impact metadata。

目标矩阵：

| Operation | Requirement scope | Recovery behavior |
|---|---|---|
| Leader normal model turn | Team + Leader template | required failure → Recovery turn |
| Member normal model turn | Team + own template | required failure → block normal / allow recovery |
| `follow-up(target)` | target template | normal gate；Recovery dispatch requires Human |
| `delegate(template/instance)` | target template | normal gate；Recovery dispatch requires Human |
| `create-member(template)` | target template | startup/template availability gate；Recovery 下 Human review |
| `send-message` that wakes execution | target template | classify as cross-agent work effect |
| pure durable coordination | none | keep available |
| inspect/list/collect | none | keep available |
| control resolution | none | keep available |
| archive/restore/dispose | none | keep available |
| Human recheck/governance | none | keep available |

effect classification 是 authority；不能仅靠 tool name。

---

## 11. Control Plane vNext

现有 Control 保留并泛化。

### 11.1 Canonical subject

```text
ControlSubject =
  { kind: instance, instanceId }
| { kind: template, templateId }
| { kind: team }
```

legacy row：

```text
targetInstanceId
```

read adapter：

```text
→ {kind: instance, instanceId: targetInstanceId}
```

旧 Remote v4 不变。

### 11.2 两种 approval coupling

#### Deferred Guarded Approval

用于 parameter permission：

```text
request
→ wait
→ decision
→ guard exact scope + fingerprint
→ consume allow
→ execute
```

保留现有 exactly-once semantics。

#### Inline Reviewed Invocation

用于 Recovery cross-Agent work：

```text
normalize tool call once
→ freeze reviewed payload
→ durable Control request
→ await human-only decision
→ allow: continue THIS invocation
→ deny: zero effect
→ disconnect/abort: durable-close/abandon + zero effect
```

这里 `operationFingerprint` 不是 authorization requirement。

### 11.3 Review payload

至少包含完整 normalized：

```text
toolName
rootSessionId
requestToken
subject
arguments / work prompt / attachedContext
execution mode
workspace/group/label when applicable
payloadDigest
```

UI 展示的 payload 与实际执行使用同一个 frozen object。

每次 Recovery dispatch attempt 都重新审批；不做 approval replay。

---

## 12. Recovery Incident

Incident 是 audit，不是 authority：

```text
recovery-incident-opened
  incidentId
  requirement/scope
  detectedAt
  trigger

... capability-runtime-event ...
... control/review records ...

recovery-incident-closed
  incidentId
  recoveredAt
  duration
```

是否退出 Recovery 仍由 fresh requirement evaluation 决定。

当前 turn 保持冻结；恢复只从下一 request/work boundary 生效。

---

## 13. Committed / Applied

所有 dynamic surface 统一使用：

```text
Desired
Committed
Application:
  pending | applied | blocked/failed
```

例如 governance MCP allow 已提交但当前 Agent cold：

```text
Committed = allow
Materialization = not-applicable
```

Agent resume：

```text
pending
→ mounted
→ applied
```

若 mount fail：

```text
Committed = allow
Materialization = failed
Requirement gate = block/degrade according to requiredness
```

不能因为 materialization 失败回滚 durable policy；也不能继续使用旧的更宽 surface。

---

## 14. Read / Projection 架构

- TeamDomain：durable authority；
- `EffectivePolicyReader`：policy canonical read；
- `RequirementAuthority`：requirements canonical read/evaluation；
- `CapabilityRuntimeStatusPort`：ephemeral current runtime status；
- Projection：只 fold/read；
- Remote：wire adapter；
- Client：presentation。

v6 freshness 继续使用：

```text
durableGeneration + liveToken
```

telemetry fact 进入 ledger，因此推进 durableGeneration。

不新增 telemetryGeneration。

---

## 15. Wire / Compatibility

### Remote

外部保留 v1–v6。

内部统一为语义 API：

```text
listRoots()
ensureRootLive()
resolveControl()
prepareOrdinaryOpen()
getReadState()
getProjection()
...
```

版本判断集中在 transport adapter。

### Blueprint

```text
v1 reader → legacy exact semantics
v2 reader → per-template requirements + new semantics
```

旧 frozen v1 source/hash 必须继续 cold-resume。

### Control

旧 instance rows/API 可读可用；内部 canonical subject 做 additive normalization。

---

## 16. PR #22 Persona 修复的目标落点

不 cherry-pick #22 实现。

必须迁移的回归：

1. composable `ptc` 不能因 preset id 非 `standard` 被判 complete conflict；
2. complete persona 与 composable substrate 要能正确区分；
3. unresolved host/preset service failure 必须 typed fail，不伪装成 capability incompatibility；
4. preflight 与 actual mount 使用同一个 RuntimeSubstrateResolver；
5. old frozen Blueprint v1 bespoke preset requirement 必须仍可按 v1 reader 解析/恢复；
6. v2 persona requirement 与 observed persona kind 分离。

---

## 17. 本轮非目标

- 不解决 own-layer `subagent` 的最终 model-visible surface contraction；
- 不拼新的 recovery-specific preset；
- 不实现 full Alpha.3 dynamic operation permission mutation；
- 不升级 TeamDomain；
- 不改 upstream DSH；
- 不做后台常驻 MCP health loop；
- 不做 telemetry retention/flap suppression；
- 不实现一般化异步 Recovery continuation。

对于 model-visible 但 recovery 不允许执行的工具，runtime 返回明确 typed error + model guidance，例如：

```text
The Team is currently in Recovery mode.
This operation cannot run until the blocking requirement is restored.
Do not retry this operation in the current recovery state.
Continue with recovery-safe work or another operation that does not depend on it.
```
