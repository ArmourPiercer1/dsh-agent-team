# dsh-agent-team Mock 测试问题修复建议

> 适用基线  
> - `dsh-agent-team`: 最近一次 Playwright mock 全量测试所对应源码，审查基准提交 `9b582a1c4e7195c0078b8f228565713efb85cdd8`  
> - `deepseek-harness`: `stable` 分支，版本 `0.1.2-rc.1`  
> - 目标问题：**F3、F11、F9、T1.4**  
> - 约束：优先在 `dsh-agent-team` 内修复；除非明确裁决，否则不修改 DSH core；冻结协议与架构原则如需变更，必须显式版本化并记录影响。

---

## 1. 结论摘要

| 问题 | 根因层 | 是否可不改冻结协议修复 | 是否可不改 DSH core 修复 | 建议 |
|---|---|---:|---:|---|
| F3 `report_progress` 挂起 | Runtime 并发控制 / 锁作用域 | 是 | 是 | 直接修复 |
| F11 Ledger UI 静默截断 | Client pagination / completeness | 是 | 是 | 直接修复 |
| F9 `user-approval` 无 human 裁决通道 | Remote command surface / authority boundary | **否，若当前 Remote method catalog 继续视为冻结闭集** | 是 | 先做协议裁决，再实现 |
| T1.4 UI 建团结构性阻断 | Pre-create environment fact assembly | **有条件可以** | 是 | 先裁决事实来源位置，再实现 |

总体判断：

1. **四个问题都没有证据表明必须修改 `deepseek-harness 0.1.2-rc.1` core。**
2. F3、F11 是实现错误，不需要重新讨论架构目标。
3. F9 的领域规则本身是正确的：`user-approval` 只能由 human 裁决；缺失的是 human 到 control service 的可信命令通道。
4. T1.4 的 compatibility 规则本身也是正确的：required requirement 缺失必须 fail-closed；错误发生在 pre-create probe 收到的是一个不完整环境世界。
5. 因此，**不得通过放宽 resolver role、放宽 required/FATAL 规则或绕过 compatibility gate 来“修复” F9/T1.4。**

---

# 2. F3 — `team_report_progress` 非确定性挂起

## 2.1 问题定位

Mock 测试中，合法的 `team_report_progress` 在部分成员工作流中出现：

- 调用无返回；
- durable progress 事实未落账；
- root action 长时间保持等待；
- 同类非法参数仍能得到 typed rejection。

这说明问题并非 tool schema、参数解析或统一 tool wrapper 失效，而更接近执行路径上的 liveness 问题。

源码链路显示这是一个**同一 per-team promise chain 上的不可重入自死锁**。

## 2.2 代码证据

### 2.2.1 New-work action 持有共享 per-team lock 直到 effect 完成

文件：

```text
packages/runtime/action-router/router.ts
```

当前核心结构：

```ts
const effect = isNewWorkAdmission(spec)
  ? await withTeamLock(teamLocks, rootSessionId, async () => {
      const environmentFacts = await options.environmentFacts()
      await enforceCompatibilityGate(
        repositories,
        blueprint,
        rootSessionId,
        environmentFacts,
        options.now,
      )
      return executeEffectLocked(ctx)
    }, asAbortLike(request.signal))
  : await executeEffect(teamLocks, ctx)
```

这里的 `withTeamLock(...)` 不只是保护 admission 的状态变更，而是覆盖了 `executeEffectLocked(ctx)` 的完整异步生命周期。

### 2.2.2 `executeWorkChain` 会等待成员整个 turn 完成

文件：

```text
packages/runtime/action-router/work-execution.ts
```

关键路径：

```ts
delivered = await deps.workDelivery.deliver({
  rootSessionId,
  instanceId,
  childSessionId,
  requestToken,
  prompt: deps.prompt,
  ...
})
```

随后才执行：

```text
close interval
→ settle admitted work
→ return
```

因此：

```text
team_delegate / team_follow_up
```

在成员模型 turn 完成前不会释放其外层 action。

### 2.2.3 TeamOperationCoordinator 明确声明“不可重入”

文件：

```text
packages/runtime/coordination/index.ts
```

当前注释已经明确规定：

```text
Chains are NEVER re-entrant
```

并说明：

```text
a second run for the same team from INSIDE a held critical section
queues behind the caller's own pending tail and deadlocks
```

这与 F3 的运行时现象完全一致。

## 2.3 实际死锁链

```text
Leader
  |
  | team_delegate / team_follow_up
  v
ActionRouter
  |
  | acquire coordination.chains[root]
  v
executeWorkChain
  |
  | await workDelivery.deliver(...)
  v
Member turn starts
  |
  | team_report_progress(...)
  v
runtime.performAction(report-progress)
  |
  | tries acquire coordination.chains[same root]
  v
WAIT
```

与此同时：

```text
outer action
  waits member turn complete
```

于是形成：

```text
Parent waits Member
Member waits Parent-held Team lock
```

即：

```text
deadlock
```

所谓“非确定性”实际上来自执行上下文差异：

- 当 progress 发生在仍处于 new-work 父调用的 member turn 内：容易死锁；
- 当 progress 发生在不被该父调用持锁包围的后续路径中：可以成功。

## 2.4 修复建议

### 2.4.1 将 work execution 拆成三段

推荐模型：

```text
Phase A — admission / reservation
  [WITH TEAM LOCK]

Phase B — external member execution
  [WITHOUT TEAM LOCK]

Phase C — settlement / commit
  [WITH TEAM LOCK]
```

伪代码：

```ts
const admitted = await withTeamLock(teamLocks, rootSessionId, async () => {
  const environmentFacts = await options.environmentFacts()

  await enforceCompatibilityGate(
    repositories,
    blueprint,
    rootSessionId,
    environmentFacts,
    options.now,
  )

  return admitWorkLocked(ctx)
})

// Important: no shared per-team lock here.
let delivered
try {
  delivered = await workDelivery.deliver({
    ...
  })
} catch (error) {
  return await withTeamLock(teamLocks, rootSessionId, async () => {
    return failClosedSettleLocked(admitted, error)
  })
}

return await withTeamLock(teamLocks, rootSessionId, async () => {
  return settleDeliveredWorkLocked(admitted, delivered)
})
```

### 2.4.2 不要采用以下补丁

不建议：

```text
- 让 report-progress 绕过 TeamOperationCoordinator
- 为 report-progress 增加单独第二把锁
- 将 coordinator 改成“自动可重入”但不区分 execution phase
- 让 member progress 异步 fire-and-forget
```

这些方案都会破坏当前“同一 team durable mutation 统一排序”的设计目标，并可能重新引入此前已经试图消除的跨模块竞态。

## 2.5 冻结协议与架构影响

### 需要变更的冻结协议

**无。**

不需要修改：

- Remote contract；
- Team tool schema；
- `requestToken` 语义；
- compatibility semantics；
- activity ledger schema；
- control protocol；
- DSH session/core。

### 架构影响

这是**锁作用域修正**，不是 architecture rewrite。

冻结原则：

```text
same-team durable mutations must serialize
```

仍然保留。

调整的是：

```text
“模型/子代理执行本身”不再被视为 durable mutation critical section 的一部分
```

推荐将该原则明确写入 runtime coordination 文档：

> Per-team serialization covers authoritative state transitions, not the lifetime of external/model execution. No shared TeamOperationCoordinator lock may be held across a member turn.

## 2.6 用户视角行为变化

修复前：

```text
成员在执行任务时汇报进度
→ 有时永久挂起
→ leader 也等待
→ UI / ledger 看不到 progress
```

修复后：

```text
成员在任务执行过程中可以实时 report progress
→ progress 正常落账
→ leader delegate/follow_up 继续等待成员最终完成
→ 两者可以并行存在而不死锁
```

用户不需要改变任何操作方式。

## 2.7 对未来开发的影响

正面影响：

1. 允许真正的 streaming / intermediate progress。
2. 为未来 member turn 内的其他协调操作提供正确并发模型。
3. 明确“状态事务”和“长耗时外部执行”边界。
4. 降低未来添加 nested team operation 时重复死锁的概率。

需要新增一个设计约束：

```text
No await of agent/model/network long-running execution while holding
TeamOperationCoordinator for the same root.
```

建议在代码评审 checklist 中加入该项。

## 2.8 回归测试要求

至少新增：

### F3-R1：同 turn progress

```text
leader delegate W1
→ W1 在本次被 delegate 的 turn 中调用 report_progress
→ report_progress 必须在成员 turn 结束前返回
→ durable progress fact 存在
→ delegate 最终正常 settle
```

### F3-R2：多次 progress

```text
W1 progress 10%
W1 progress 50%
W1 progress 100%
→ 三次均成功
→ sequence 有序
→ 无死锁
```

### F3-R3：并发其他 team mutation

验证锁缩短后：

```text
archive / control / lifecycle / progress
```

仍满足已有 CAS / durable ordering 不变式。

---

# 3. F11 — Ledger UI 静默截断

## 3.1 问题定位

这是一个明确的**量纲错误**。

客户端将：

```text
最高已加载 sequence
```

与：

```text
当前 team 的 ledger entry 总数
```

直接比较，导致 pagination 过早结束。

## 3.2 代码证据

文件：

```text
packages/client/src/state/team-ledger-store.ts
```

关键代码：

```ts
if (entry.sequence > frontier) frontier = entry.sequence

const total = check.total
const nextComplete = total !== null && frontier >= total
```

其中：

```text
frontier
= highest loaded sequence number

total
= per-team fact-entry count
```

二者单位不同。

## 3.3 Mock 世界中的实际失败

Mock 中 dtestp6：

```text
team entries = 68 条
sequence range = 69 ... 136
```

第一页：

```text
50 条
sequence = 69 ... 118
```

于是：

```text
frontier = 118
total = 68

118 >= 68
=> true
```

客户端错误认为：

```text
pagination complete
```

实际剩余：

```text
sequence 119 ... 136
= 18 条
```

永远不会继续获取。

## 3.4 为什么是“静默”截断

另一个 completeness projection 使用了同样的错误量纲：

```text
completeThrough < total
```

于是 store 错误停止分页后，UI 又错误标记：

```text
completeness = complete
```

因此：

- 没有 partial badge；
- 没有 remaining count；
- 没有 loading；
- 用户无法知道 ledger 已被截断。

## 3.5 修复建议

### 3.5.1 completion 按 entry count 判断

维护：

```ts
loadedUniqueEntryCount
```

而不是用 `frontier` 判断总量完成：

```ts
const countComplete =
  total !== null &&
  loadedUniqueEntryCount >= total
```

同时保留 cursor 终止信息：

```ts
const tailReached =
  page.nextAfterSequence === null
```

推荐最终逻辑：

```ts
const complete =
  tailReached ||
  (total !== null && loadedUniqueEntryCount >= total)
```

前提是 contract 保证：

```text
nextAfterSequence === null
```

表示服务端确认已经到该 team ledger 尾部。

如果 contract 将 cursor-null 仅定义为“当前页面没有更多”，则应以 count 为主；实现前应统一 contract 注释，但**不需要改变 wire schema**。

## 3.6 冻结协议与架构影响

### 需要变更的冻结协议

**无。**

保留：

```text
total = per-team entry count
nextAfterSequence = sequence cursor
```

仅修正 client 使用方式。

### 架构影响

无架构级变化。

建议补充一条类型/命名纪律：

```text
Sequence / Offset / Count must never share a generic numeric “frontier”
comparison without an explicit conversion or invariant.
```

可以考虑未来使用 branded type：

```ts
type LedgerSequence = number & { __brand: 'LedgerSequence' }
type LedgerEntryCount = number & { __brand: 'LedgerEntryCount' }
```

但这属于后续 hardening，不是本次修复必需项。

## 3.7 用户视角行为变化

修复前：

```text
ledger 较长或 sequence 起点较大
→ UI 只显示前一部分
→ UI 仍声称完整
```

修复后：

```text
UI 自动继续拉取
→ 到真正 tail 才结束
→ 所有 ledger 行可见
```

无需增加新的用户操作。

## 3.8 对未来开发的影响

主要是正向：

1. ledger pagination 可用于跨 restart / 跨 root 的全局 sequence。
2. 后续调整 page size 不再改变 completeness 正确性。
3. ledger UI 可以可靠承载更多长期 team history。

## 3.9 回归测试要求

至少覆盖：

```text
sequence starts at 1
sequence starts at 69
sequence starts at 10000
total < first sequence
multiple pages
overlapping page replay
duplicate sequence dedupe
cursor null
total known / total null
```

关键断言：

```text
loaded unique entries == server total
```

而不是：

```text
highest sequence >= total
```

---

# 4. F9 — `user-approval` 无 human 裁决通道

## 4.1 问题定位

F9 不是 resolver rule 错误。

当前领域模型明确规定：

```ts
'user-approval': ['human']
```

并且 runtime control service 会在 envelope 之前检查 resolver role closure。

因此：

```text
leader 不能代替 human
member 不能代替 human
```

是正确且有意的安全不变式。

真正缺失的是：

> UI 中的真实用户没有一条可信的 host command path，将一次按钮点击转换为 `caller.role = human` 的 control resolution。

## 4.2 代码证据

文件：

```text
packages/runtime/control/types.ts
```

核心规则：

```ts
export const CONTROL_RESOLVER_ROLES = {
  'leader-approval': ['leader', 'human'],
  'user-approval': ['human'],
  'envelope-mutation': ['leader', 'human'],
}
```

文件：

```text
packages/runtime/control/service.ts
```

核心检查：

```ts
const allowedRoles = CONTROL_RESOLVER_ROLES[request.payload.kind]

if (!allowedRoles.includes(caller.role)) {
  throw ...
}
```

因此修改：

```ts
'user-approval': ['leader', 'human']
```

不是修复，而是破坏原有 authority model。

## 4.3 当前产品为什么无法完成 user approval

Agent 侧工具：

```text
team_resolve_control
```

其 caller 来源是当前 tool caller：

```text
ctx.caller
```

所以：

```text
member 调用 → member principal
leader 调用 → leader principal
```

永远不可能自然变成：

```text
human principal
```

而 client/UI 当前只有：

- pending badge；
- TeamDock 计数；
- ledger 展示；
- lifecycle 操作。

没有：

```text
human allow / deny command endpoint
```

---

# 5. F9 待决策变更项

## 5.1 当前冻结内容

文件：

```text
packages/remote/src/contracts/catalog.ts
```

当前设计明确写明：

```text
The CLOSED method catalog
```

以及：

```text
Adding a method or category is a remote contract change
(a version bump), never a silent edit.
```

当前 v1/v2/v3 catalog 中没有 human control-resolution endpoint。

因此，若该闭集继续视为冻结协议，则 F9 无法在 A 条件下完整修复。

## 5.2 推荐决策：新增版本化 human control resolution Remote 方法

### 建议

新增 Remote contract 新版本，例如：

```text
Remote v4
```

新增方法建议：

```text
control.resolve
```

如果不希望新增 category，也可放入现有适当 category，但从领域含义看独立 `control` category 更清晰。

推荐参数：

```ts
interface RemoteControlResolveParams {
  readonly rootSessionId: string
  readonly requestId: string
  readonly decision: 'allow' | 'deny'
}
```

可选增加：

```ts
reason?: string
```

但不要允许 client 传：

```ts
callerRole: 'human'
resolverRole: 'human'
principal: ...
```

## 5.3 应如何建立 human authority

推荐链：

```text
User clicks Allow / Deny in trusted Team UI
  ↓
Team client calls control.resolve
  ↓
Team host remote adapter receives trusted UI command
  ↓
Host constructs HumanPrincipal
  ↓
existing control service
  ↓
CONTROL_RESOLVER_ROLES validation
  ↓
durable decision fact
```

原则：

> “human” 必须由 host-side trust boundary 赋予，而不能由远端参数自报。

## 5.4 变动了哪些之前冻结的协议

### 明确发生变化

1. **Remote method catalog 闭集变化**
   - 当前 26 methods 的闭集增加新方法；
   - 必须 version bump；
   - 旧版本继续拒绝该新 method。

2. **Remote category set**
   - 若新增 `control` category，则 9-category closed set 也发生变化；
   - 这是比单纯新增 method 更大的协议变更。

### 推荐尽量保持不变

以下协议应继续冻结：

```text
CONTROL_RESOLVER_ROLES
user-approval → human only
leader/member caller identity semantics
control request / decision durable model
external hard-policy gate
exactly-once allow consumption
```

## 5.5 对架构的影响

### 正向变化

正式补齐：

```text
Agent control plane
+
Human control plane
```

当前 control domain 已有：

```text
human
```

这一 principal 类型，但产品架构缺少 human command ingress。

修复后 authority model 才真正闭合：

```text
member → request
leader → allowed resolver for selected kinds
human → allowed resolver for human-capable kinds
```

### 新增边界

需要新增明确的：

```text
trusted UI → host human principal
```

这是一个安全边界，应单独测试，避免未来任意 remote caller 伪造 human。

## 5.6 从用户视角看到的行为变化

修复前：

```text
成员请求 user approval
→ UI 显示“待裁决”
→ 用户实际上没有 Allow / Deny 按钮
→ 请求永久 pending
```

修复后：

```text
成员请求 user approval
→ Team UI 显示请求详情
→ 用户点击 Allow / Deny
→ ledger 立即记录 human decision
→ allow 后成员可在既有 exactly-once 规则下继续
```

建议最小 UI：

```text
Request type
Requester
Requested operation
Reason
External-policy status
[Allow] [Deny]
```

## 5.7 对未来开发的影响

### 正面影响

1. `user-approval` 真正可用。
2. `envelope-mutation` 等允许 human 的控制类型可共享同一路径。
3. 后续可以扩展 human rationale / audit metadata。
4. 用户操作不需要伪装成 agent call。

### 维护成本

1. Remote contract 增加新版本。
2. 需要兼容老 client/host。
3. 需要增加 human command 的鉴权/来源测试。
4. UI control details 将从纯 read model 升级为 command surface。

## 5.8 备选决策

### 方案 F9-B：维持冻结 Remote contract，不实现 human resolution

结果：

```text
user-approval 保留为 domain capability
但当前产品版本不可完成该流程
```

必须同时：

- UI 明确显示“当前版本不支持人工裁决”；
- 不允许生成永远无法完成的 user-approval 请求，或在 request admission 时 typed reject；
- 文档明确 capability deferred。

优点：

```text
零协议变化
```

缺点：

```text
产品能力与领域模型不闭合
```

不推荐作为长期方案。

## 5.9 推荐裁决

**推荐允许一次明确的 Remote contract version bump。**

不应为了守住“method 数量冻结”而牺牲已有 authority model 的完整性。

建议裁决文本：

> 允许为 human control resolution 新增一个版本化 Remote command surface；不修改 `CONTROL_RESOLVER_ROLES`、不允许 client 自报 human principal、不修改现有 control durable semantics。DSH core 保持不变。

---

# 6. T1.4 — UI 新建团队被 compatibility preflight 结构性阻断

## 6.1 问题定位

当 blueprint 包含 required 非-persona requirement，例如：

```text
mcp
tool
skill
modelRoute
```

UI 的 pre-create probe 只传入 persona fact。

compatibility engine 对缺失 fact 按 unavailable 判断；required requirement 又会被映射为 complete requirement，因此变成 FATAL。

结果：

```text
合法环境下本可满足 requirement
但 pre-create probe 看不到该事实
→ 错误 FATAL
→ Create button 永久禁用
```

## 6.2 代码证据

### Client 只组装 persona fact

文件：

```text
packages/client/src/model/team-intent-model.ts
```

函数：

```ts
intentEnvironmentFacts(...)
```

当前设计只根据所选 runtime preset 产生 persona environment fact。

TeamCreationPanel：

```text
packages/client/src/ui/TeamCreationPanel.tsx
```

调用：

```ts
probeCompatibility({
  ...
  environmentFacts: intentEnvironmentFacts(draftRef.current, presets),
})
```

### Host probe 不补全环境

文件：

```text
packages/runtime/src/plugin/s6-remote.ts
```

当前：

```ts
const result = evaluateCompatibility({
  requirements: compatibilityRequirementsOf(resolved),
  environmentFacts:
    environmentFacts as readonly EnvironmentFact[],
})
```

即 client 传什么 world，engine 就评估什么 world。

### Required requirement 必须 FATAL

文件：

```text
packages/runtime/compatibility/blueprint.ts
```

映射：

```ts
complete: requirement.optional !== true
```

冻结语义：

```text
optional=true
→ complete=false
→ unmet WARNING / ack-able

required
→ complete=true
→ unmet FATAL / no downgrade
```

这个规则本身没有问题。

## 6.3 不应该采用的“修复”

禁止以下方案：

### 方案 X1：missing fact 不再视为 unavailable

会破坏 fail-closed compatibility model。

### 方案 X2：pre-create required requirement 也降级为 WARNING

会使：

```text
preflight
```

与：

```text
live admission gate
```

产生不同的安全语义。

### 方案 X3：pre-create 只检查 persona，忽略其他 requirements

同样会造成 semantic fork：

```text
UI says ready
→ create
→ runtime immediately refuses
```

### 方案 X4：FATAL 增加“Continue anyway”

直接破坏 required requirement 的冻结含义。

---

# 7. T1.4 待决策变更项

核心问题不是：

```text
compatibility 怎么判
```

而是：

```text
pre-create 的 authoritative environment facts 应由谁组装
```

当前有两个合理方案。

## 7.1 方案 T1-A：Client composition 获取 host facts，再走现有 `intent.probe`

### 数据流

```text
DSH/native/client-visible environment inventory
  ↓
Team client composition
  ↓
tool / skill / mcp / modelRoute / teamStructure facts
  +
selected persona fact
  ↓
existing environmentFacts[]
  ↓
existing intent.probe
```

### 变动了哪些冻结协议

**Remote wire contract 不变。**

仍然是：

```ts
{
  blueprintId,
  blueprintRevision?,
  environmentFacts: RemoteSafeRecord[]
}
```

compatibility semantics 不变。

`intent.probe` 仍然保持：

```text
purely evaluates caller-provided facts
```

因此它是最保守的协议方案。

### 架构影响

会让 client composition 承担更多环境汇总职责。

当前：

```text
client owns persona selection fact
```

变为：

```text
client composition owns all pre-create probe facts
```

这要求 DSH client/plugin seam 能可靠暴露：

- MCP availability；
- relevant tool availability；
- skill availability；
- model route；
- team structure；
- 其他 blueprint requirement domains。

### 用户视角行为变化

以前：

```text
机器实际上已有 MCP
→ UI 仍显示 FATAL
```

以后：

```text
机器已有 MCP
→ preflight PASS
→ 可以创建

机器确实没有 MCP
→ 仍 FATAL
```

这是期望行为。

### 对未来开发的影响

优点：

1. `intent.probe` 函数语义完全不变。
2. Remote contract 无 version bump。
3. compatibility engine 无改动。

缺点：

1. client 必须同步宿主 environment inventory。
2. 每增加 requirement domain，都要扩展 client fact composition。
3. 宿主能力若存在仅 server-side 可知状态，client seam 可能变复杂。
4. 可能出现 host live environment 与 client snapshot 有短时漂移。

### 当前待确认事项

需要继续确认 `deepseek-harness 0.1.2-rc.1` 是否已有足够稳定、插件可消费的 client-facing inventory/feed，覆盖所需 requirement domains。

若某些能力只有 host runtime 可权威获取，则该方案会产生额外桥接成本。

## 7.2 方案 T1-B：Host `intent.probe` 合并 authoritative environment facts

### 数据流

```text
client:
selected persona fact
  ↓
intent.probe

host:
caller-provided facts
  +
runtime authoritative environmentFacts()
  ↓
merge / normalize
  ↓
evaluateCompatibility
```

伪代码：

```ts
async probe(
  blueprintId,
  blueprintRevision,
  callerFacts,
) {
  const hostFacts = await environmentFacts()

  const facts = mergeEnvironmentFacts(
    hostFacts,
    callerFacts,
  )

  return evaluateCompatibility({
    requirements: compatibilityRequirementsOf(resolved),
    environmentFacts: facts,
  })
}
```

其中 persona 的来源与 precedence 必须显式定义。

## 7.3 方案 T1-B 变动了哪些冻结协议

### Wire schema

**不变。**

`environmentFacts` 仍存在，没有新增字段。

### 语义协议

这里存在一个必须显式裁决的变化：

当前语义实际上是：

> `intent.probe` 对 caller supplied `environmentFacts` 进行纯评估。

修改后变成：

> `intent.probe` 把 caller facts 作为 override/input，再与 host authoritative environment 合并后评估。

也就是说：

```text
same request bytes
```

在相同 blueprint 下，可能因为 host 状态不同得到不同结果。

从 architecture 角度这通常更合理，但它确实改变了 `intent.probe` 的函数语义。

如果此前“pure domain probe over exactly caller facts”已经被定义为冻结 contract semantic，则该变更必须记为协议裁决，尽管 wire shape 没变。

## 7.4 T1-B 的架构影响

优点：

1. 环境事实的权威来源留在 host。
2. 与 runtime admission 使用同类 environment provider，更容易保持一致。
3. 新增 requirement domain 时主要改 host bridge，不需要 client 追随所有能力。
4. 减少 client snapshot 与 host live environment 的双真源。

风险：

1. `intent.probe` 不再是严格的纯 caller-facts evaluator。
2. 必须定义 fact merge precedence。
3. 必须避免 client 能通过伪造 fact 覆盖 host 的 security-sensitive unavailable state。
4. persona 等用户选择事实与 host observed facts 需要区分 provenance。

## 7.5 推荐的事实合并规则

如果采用 T1-B，建议不要做通用“last-write-wins”。

应区分 provenance：

```text
Host-authoritative domains:
  tool
  skill
  mcpServer
  modelRoute
  teamStructure
  ...

Client-authoritative draft domains:
  persona selection
  user-selected creation intent
```

规则示意：

```text
persona
→ client selected value authoritative for this draft

host capability availability
→ host authoritative

client must not be able to assert:
  mcp X available=true
when host says unavailable
```

更稳妥的内部模型可以是：

```ts
type EnvironmentFactProvenance =
  | 'host-observed'
  | 'client-intent'
```

不过这可以只存在 host 内部，不必扩展 wire schema。

## 7.6 用户视角行为变化

两种正确方案对用户应保持同样行为：

### 环境满足 required MCP

```text
新建团队
→ 选择 blueprint
→ compatibility PASS
→ Create enabled
```

### 环境不满足 required MCP

```text
新建团队
→ 选择 blueprint
→ 显示明确 FATAL
→ Create disabled
```

### optional MCP 缺失

```text
WARNING
→ 用户显式 acknowledge
→ 可继续
```

不得改变这些产品语义。

## 7.7 对未来开发的影响对比

| 维度 | T1-A Client composition | T1-B Host merge |
|---|---|---|
| Remote wire schema | 不变 | 不变 |
| `intent.probe` 纯函数语义 | 保持 | 改变 |
| Host authority 集中度 | 较低 | 高 |
| Client 复杂度 | 高 | 低 |
| 新 requirement domain 扩展 | client + host seam | 主要 host |
| 状态漂移风险 | 较高 | 较低 |
| 安全事实伪造风险 | 取决于 client seam | 更易 fail-closed |
| 对已有冻结 semantic 的冲击 | 最小 | 中等 |

## 7.8 推荐裁决

### 首选

如果 DSH 0.1.2-rc.1 已经有完整、稳定、插件可消费的 client-side environment inventory：

> 选择 **T1-A**，以最小协议变化修复。

### 否则

如果能力事实本质上只在 host runtime 权威存在：

> 选择 **T1-B**，并正式裁决：`intent.probe` 的 authority 是“host-completed environment”，而不是“client-provided partial world”。

从长期架构看，**T1-B 更干净**；从当前冻结协议最小变更看，**T1-A 更保守**。

---

# 8. 推荐的最终修复包

建议把这一轮工作分成两个 implementation batch。

## Batch 1 — 无协议争议修复

包含：

```text
F3
F11
```

### F3

实施：

```text
admit under lock
→ release
→ deliver member turn
→ reacquire
→ settle
```

### F11

实施：

```text
entry-count based completeness
+
cursor tail check
```

Batch 1 不应改任何 public contract。

## Batch 2 — 先裁决再实现

包含：

```text
F9
T1.4
```

### F9 推荐裁决

```text
允许 Remote contract version bump
新增 human control-resolution command
host 赋予 human principal
不修改 resolver role closure
```

### T1.4 推荐裁决

优先检查 DSH 0.1.2-rc.1 environment inventory 能力：

```text
若 client 可完整拿到
→ T1-A

若不能
→ T1-B
```

无论哪种：

```text
不得修改 required → FATAL
不得允许 Continue-anyway
不得让缺失 capability 静默 PASS
```

---

# 9. 建议写入冻结设计文档的新不变式

本轮问题暴露出几个值得正式冻结的规则。

## 9.1 Runtime lock invariant

> The shared per-team operation coordinator serializes authoritative state transitions only. It MUST NOT be held across model execution, member turns, network calls, or other long-running external execution that can re-enter Team runtime.

## 9.2 Numeric domain invariant

> Ledger sequence, log offset, entry count, page size, and loaded-count are distinct numeric domains and MUST NOT be compared as interchangeable scalar values.

## 9.3 Human authority invariant

> Human authority is stamped only at a trusted host/UI boundary. Remote/client payloads MUST NOT be able to self-declare `caller.role = human`.

## 9.4 Compatibility completeness invariant

> A compatibility verdict is authoritative only when every required requirement domain is represented by an authoritative environment fact source. Missing required facts remain fail-closed; the fix for incomplete observation is to complete the observation, not weaken the verdict.

---

# 10. 验收标准

本轮修复完成后，必须至少满足：

## F3

```text
member 在 delegate/follow_up 对应的同一 turn 内
可以多次调用 team_report_progress
所有调用均返回
delegate/follow_up 最终正常 settle
durable ledger 有完整 progress
```

## F11

```text
ledger sequence 起点与 total 无关
分页直到真实 tail
UI 不遗漏条目
UI completeness 与服务端真实状态一致
```

## F9

若批准协议变更：

```text
user-approval:
member request
→ UI visible
→ human Allow
→ durable human decision
→ member 可继续

leader resolve same user-approval
→ typed unauthorized

member resolve
→ typed unauthorized
```

## T1.4

```text
required MCP present
→ pre-create PASS

required MCP absent
→ FATAL

optional MCP absent
→ WARNING / explicit ack

persona mismatch
→ 保持原有冻结行为
```

---

# 11. 建议给实现 Agent 的决策输入

在实施 Batch 2 前，只需要用户/架构负责人明确回答两项。

## Decision F9

是否允许：

```text
Remote contract 新版本
+ 新增 human control-resolution command surface
```

建议：**允许。**

## Decision T1.4

pre-create environment fact 的 authority 放在哪里？

### A

```text
client composition 构造完整 facts
host probe 保持纯 caller-facts evaluator
```

### B

```text
host probe 合并 authoritative runtime facts
client 只提供 draft/user-intent facts
```

建议：

```text
先确认 DSH 0.1.2-rc.1 是否提供完整 client inventory；
若否，选择 B。
```

---

# 12. 最终建议

本轮不要把四个 finding 当成同一种“兼容性问题”一起修。

它们分别代表四类缺陷：

```text
F3   = transaction boundary / lock lifetime bug
F11  = numeric-domain / pagination bug
F9   = missing authority ingress
T1.4 = incomplete environment observation
```

其中：

```text
F3、F11
→ 直接实现修复

F9
→ 需要一次明确 Remote protocol version decision

T1.4
→ 需要一次 environment-fact authority placement decision
```

`deepseek-harness 0.1.2-rc.1` core 在这四项中都应保持不动，除非后续对 T1-A 的 API 审查发现宿主完全没有任何插件可访问的环境 inventory seam；即便如此，优先方案也应是 Team plugin host-side fact completion，而不是修改 DSH core。
