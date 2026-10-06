# PR #20 收束修复任务：Caller-Root 绑定 + Notification Failure Closure

> **Repository:** `ArmourPiercer1/dsh-agent-team`  
> **Target PR:** `#20` — `fix(control): make leader approval requests discoverable and reachable`  
> **Current branch:** `fix/c1-leader-approval-reachability`  
> **Reviewed tip:** `0e533ccc24903646ed23b9ae1726ce7693f95d17`  
> **Base:** `master @ 040f4107b5fe4e19185327c3c6a6a1e99b48d891`  
> **Host baseline:** DSH `0.1.5-rc.2 @ fb2c4b9e698e30edb738bca4cf0618587db7d203`  
> **Core patch budget:** **0-core**  
> **Scope:** 只做 PR #20 的收束修复；不重做 C1 架构，不处理 C2，不并入 PR #19 的功能。

## 0. 本轮目标

PR #20 的 C1 主体设计已基本成立。本轮只处理两个收束问题：

### P0 — Caller 与 Team Root 未绑定（merge blocker）

当前 Team tool 的 caller identity 只保留：

```text
{ kind: 'instance', instanceId: ... }
```

而没有保留 calling session 实际属于哪个 `rootSessionId`。

所有 Team Leader 都使用：

```text
instanceId = inst-leader
```

因此可能发生：

```text
Leader A session
  ↓ resolveCaller()
{ kind: instance, instanceId: inst-leader }

工具参数：
rootSessionId = Team B

  ↓

Team tool 把 caller 视为 Leader
  ↓
对 Team B 执行 read / resolve / other operation
```

PR #20 新增 `team_list_pending_control` 后，这个旧的 root-identity confusion 形成了完整利用链：

```text
Leader A
  ↓
team_list_pending_control(root=B)
  ↓
得到 Team B 的 pending requestId
  ↓
team_resolve_control(root=B, requestId=B...)
  ↓
被 ControlService 解释为 Team B 的 inst-leader
  ↓
可替 Team B allow / deny
```

本轮必须在 **Team tool 公共入口**统一绑定 calling session → owning root，不能只给 pending-list 做局部检查。

### P1 — notifier 同步 throw 未被 non-fatal contract 覆盖

当前：

```ts
void port.notifyLeaderRequest(record).catch(...)
```

只能捕获 Promise rejection，不能捕获：

```ts
notifyLeaderRequest() {
  throw new Error(...)
}
```

这种返回 Promise 前的同步 throw。

虽然 production notifier 当前是 `async`，但既然 C1 契约明确规定 notification failure 不得改变 durable request path，就应一起闭合。

---

# 1. 本轮禁止事项

本轮不要：

- 重做 `team_list_pending_control` API；
- 改变 resolver roles；
- 改变 `leader-approval` / `user-approval` 语义；
- 改变 scope / fingerprint / correlation；
- 改变 allow-once consumption；
- 改变 notification fire-and-forget 设计；
- 新增 durable ledger vocabulary；
- 修改 DSH core；
- 处理 C2 / subagent permission inheritance；
- 增加硬 `subagent` deny；
- 混入 PR #19；
- 做 characterization-probe migration；
- 做大范围兼容性 cleanup。

---

# 2. P0 修复设计：CallerSession → OwningRoot

## 2.1 根因

`packages/runtime/src/plugin/live/agent-bindings.mjs` 中：

```js
resolveCaller(sessionId)
```

内部已经计算：

```js
const teamRoot = teamRootOfSession(sid)
```

但最终只返回：

```js
{ kind: 'instance', instanceId: ... }
```

丢掉了 `teamRoot`。

随后 `packages/tools/src/tools.ts::makeDefinition()` 使用：

```text
rootSessionId = tool 参数
caller = resolveCaller(exec.agent.id)
```

却从未检查：

```text
caller 实际 owning root
==
tool 参数 rootSessionId
```

---

# 3. 推荐最小统一修复

不要只给 `team_list_pending_control` 加：

```ts
callerSessionId === rootSessionId
```

而是提升 caller resolver contract。

推荐：

```ts
export interface ResolvedTeamToolCaller {
  readonly caller: ActionCaller
  readonly rootSessionId: string
}
```

并改为：

```ts
readonly resolveCaller: (
  sessionId: string
) => Promise<ResolvedTeamToolCaller>
```

随后在所有 Team tools 的公共入口 `makeDefinition()` 中统一校验：

```ts
if (resolved.rootSessionId !== requestedRootSessionId) {
  return {
    status: 'rejected',
    code: TEAM_TOOL_CALLER_ROOT_MISMATCH,
    message: ...,
    details: ...
  }
}
```

这个检查必须发生在：

- `spec.run()`
- `ControlService` read/write
- `TeamRuntime`
- Messaging
- Activity

之前。

---

# 4. 具体代码工作

## 4.1 `packages/tools/src/types.ts`

把：

```ts
readonly resolveCaller: (sessionId: string) => Promise<ActionCaller>
```

改为返回 caller + actual owning root。

推荐：

```ts
export interface ResolvedTeamToolCaller {
  readonly caller: ActionCaller
  readonly rootSessionId: string
}

readonly resolveCaller: (
  sessionId: string
) => Promise<ResolvedTeamToolCaller>
```

要求：

- `rootSessionId` 必须来自 calling session 的真实 Team ownership；
- 不能来自 tool args；
- 不能由 tool body 自己推断。

---

## 4.2 `packages/runtime/src/plugin/live/agent-bindings.mjs`

修改 `resolveCaller(sessionId)`。

Leader：

```js
if (teamRoot !== undefined && teamRoot === sid) {
  return {
    caller: {
      kind: 'instance',
      instanceId: String(LEADER_INSTANCE_ID),
    },
    rootSessionId: String(teamRoot),
  }
}
```

Member：

```js
return {
  caller: {
    kind: 'instance',
    instanceId: String(member.instanceId),
  },
  rootSessionId: String(teamRoot),
}
```

Unknown session 继续 fail closed。

继续复用现有：

```js
teamRootOfSession(sid)
```

不要建立第二套 root ownership 解析。

---

## 4.3 `packages/tools/src/tools.ts`

### `resolveToolCaller()`

返回：

```ts
type CallerResolution =
  | {
      readonly ok: true
      readonly caller: ActionCaller
      readonly rootSessionId: string
    }
  | {
      readonly ok: false
      readonly result: TeamToolsResult
    }
```

### `makeDefinition()`

顺序改为：

```text
parse requested rootSessionId
parse requestToken
resolve calling session -> actualRoot + caller

if actualRoot != requestedRoot:
    typed reject BEFORE ANY downstream effect

else:
    build ToolCallContext
    run spec
```

---

## 4.4 `packages/tools/src/tokens.ts`

新增：

```ts
export const TEAM_TOOL_CALLER_ROOT_MISMATCH =
  'TEAM_TOOL_CALLER_ROOT_MISMATCH'
```

推荐错误文本：

```text
team-tools: caller session belongs to Team root '<actual>',
but the tool request targets root '<requested>'
```

推荐 details：

```json
{
  "callerRootSessionId": "...",
  "requestedRootSessionId": "..."
}
```

---

## 4.5 所有 `createTeamTools(...)` 测试与 fixture

当前 fake resolver 多数只返回：

```ts
ActionCaller
```

全部改为：

```ts
{
  caller,
  rootSessionId
}
```

单-root fixture 可直接返回 fixture root，不需要复制复杂 root 解析逻辑。

---

# 5. P0 必须新增的测试

建议新建：

```text
packages/tools/test/c1-caller-root-binding.test.ts
```

优先使用真实 multi-root / production-like world，而不是仅靠人工 mock。

## R1 — Leader A 不能读取 Team B pending list

Team B 有 pending `leader-approval`。

Leader A 调：

```text
team_list_pending_control(root=B)
```

必须返回：

```text
status = rejected
code = TEAM_TOOL_CALLER_ROOT_MISMATCH
```

并证明 Team B 的 pending 数据没有被返回。

---

## R2 — Leader A 不能 resolve Team B request

Team B member 先创建 pending request。

Leader A 调：

```text
team_resolve_control(
  rootSessionId = Team B,
  requestId = Team B requestId,
  decision = allow
)
```

必须：

```text
TEAM_TOOL_CALLER_ROOT_MISMATCH
```

并证明：

```text
Team B request 仍 pending
Team B decisions = 0
Team B consumptions = 0
```

这是本轮最关键的 security regression test。

---

## R3 — Member A 不能跨 root 调用 Team B tool

例如：

```text
Member A
→ team_list_members(root=B)
```

必须 root mismatch reject。

---

## R4 — Same-root Leader 仍正常

```text
Leader A
→ team_list_pending_control(root=A)
```

正常返回。

---

## R5 — Same-root Member 仍正常

选一个原本允许的 member tool，确保 root-binding patch 不破坏正常路径。

---

## R6 — Cross-root reject 在 downstream effect 前发生

至少用 `team_resolve_control` 验证：

```text
ledger count unchanged
decision count unchanged
consumption unchanged
```

---

# 6. P1 修复：同步 notifier throw 也必须 non-fatal

## 6.1 当前缺口

当前：

```ts
void port
  .notifyLeaderRequest(outcome.record)
  .catch(...)
```

若 notifier 同步 throw：

```ts
notifyLeaderRequest() {
  throw new Error('sync boom')
}
```

则 `requestControl()` 会在 durable row 已写入后 reject。

这违反：

```text
notification failure never changes request authority/outcome
```

---

# 7. 推荐实现

建议抽一个本地 helper：

```ts
function reportNotificationFailure(
  request: ControlRequestRecord,
  error: unknown,
): void {
  const sink = options.onNotificationFailure
  if (sink === undefined) return
  try {
    sink({
      requestId: request.requestId,
      kind: request.kind,
      error,
    })
  } catch {
    // diagnostics must never alter request path
  }
}
```

然后：

```ts
if (
  outcome.created &&
  outcome.record.kind === CONTROL_REQUEST_KINDS.LEADER_APPROVAL
) {
  const port = options.requestNotification
  if (port !== undefined) {
    try {
      const pending = port.notifyLeaderRequest(outcome.record)
      void Promise.resolve(pending).catch((error: unknown) => {
        reportNotificationFailure(outcome.record, error)
      })
    } catch (error: unknown) {
      reportNotificationFailure(outcome.record, error)
    }
  }
}
```

等价方案也可以，但必须覆盖：

```text
async reject
sync throw
diagnostic sink throw
```

---

# 8. P1 测试

在：

```text
packages/runtime/test/c1-control-notification.test.ts
```

新增：

## N7 — synchronous notifier throw

```ts
const notifier = {
  notifyLeaderRequest() {
    throw new Error('sync injected failure')
  }
}
```

调用：

```text
requestControl(leader-approval)
```

必须：

```text
requestControl resolves
request.status == pending
durable request exists
decision count == 0
failure sink == 1
```

现有 async rejection case 保留。

---

# 9. PR body / 文档修正

## 9.1 `limit`

当前源码真实契约：

```text
default = 50
min = 1
max = 100
```

完成报告写成了 `1..50`。

PR body 改为：

```text
optional integer 1..100, default 50
```

不要改代码迎合错误报告。

## 9.2 Busy-Leader 限制

保留并明确：

```text
async delegation 是 Leader 自闭环审批路径
```

同步 delegation 下 notification 可能等当前 Leader turn 结束后才被处理；human resolver 仍是 breaker。

不要声称 synchronous topology 下 Leader 一定能自己即时审批。

---

# 10. 本轮门禁

## Level 1 — targeted

必须全绿：

```text
c1-list-pending-control
c1-caller-root-binding
c1-control-notification
c1-leader-notification-glue
c1-production-wiring
c1-restart-recovery
```

## Level 2 — tools regression

至少跑：

```text
packages/tools/test/**
```

重点检查：

- `resolveCaller` 新返回形状；
- 12-tool registration；
- typed result vocabulary。

## Level 3 — runtime focused

至少覆盖：

```text
control
tool registration
production wiring
live bridge
```

## Level 4 — real-host minimal smoke

不需要重跑完整探索矩阵。

### RH1 — same-root happy path

```text
member ask
→ leader list pending
→ leader resolve allow
→ operation executes
```

### RH2 — cross-root list reject

同一 production domain 中创建 Team A / Team B：

```text
Leader A
→ team_list_pending_control(root=B)
→ TEAM_TOOL_CALLER_ROOT_MISMATCH
```

### RH3 — cross-root resolve reject

Team B 有 pending request：

```text
Leader A
→ team_resolve_control(root=B, requestId=B)
→ reject
```

随后证明 Team B request 仍 pending。

### RH4 — busy-Leader regression

确认原 S6 不恶化：

```text
sync delegate
→ notification queues
→ 无 control-lock / row-level deadlock
```

---

# 11. 与 PR #19 的顺序

建议：

```text
1. 修完 PR #20
2. merge PR #20
3. PR #19 rebase onto new master
4. resolve conflicts
5. 再审 PR #19
```

不要为了减少 rebase 成本先合 PR #19。

---

# 12. 建议提交拆分

建议新增 2–3 个 commit：

```text
fix(tools): bind team tool callers to their owning root
test(tools): cover cross-team leader/member root isolation
fix(control): make synchronous notification faults non-fatal
```

---

# 13. 最终验收标准

PR #20 可 merge，当且仅当：

- [ ] `resolveCaller(session)` 返回 caller + actual owning root；
- [ ] `makeDefinition()` 在任何 tool body 前统一校验 actual root == requested root；
- [ ] cross-root mismatch 使用 typed rejection；
- [ ] Leader A 无法读取 Team B pending list；
- [ ] Leader A 无法 resolve Team B control request；
- [ ] Member A 无法跨 root 调用 Team B tool；
- [ ] same-root Leader/member 行为不变；
- [ ] cross-root reject 发生在 durable effect 前；
- [ ] async notification rejection 仍 non-fatal；
- [ ] sync notification throw 也 non-fatal；
- [ ] diagnostic sink throw 也不影响 request path；
- [ ] PR body 中 `limit` 改为 1..100，default 50；
- [ ] targeted/focused tests 绿；
- [ ] real-host cross-root list/resolve 负例通过；
- [ ] 0-core 保持；
- [ ] C2 未实现；
- [ ] PR #19 未混入。

---

# 14. 给本地 Agent 的执行指令

继续在：

```text
fix/c1-leader-approval-reachability
```

分支执行。

顺序：

1. 确认起点 `0e533cc`。
2. 修改 `TeamToolsOptions.resolveCaller` contract。
3. 修改 production `live.resolveCaller`，返回真实 owning root。
4. 在 `makeDefinition()` 增加统一 root equality gate。
5. 新增 `TEAM_TOOL_CALLER_ROOT_MISMATCH`。
6. 更新所有 fake/test resolver。
7. 新增 multi-root isolation suite。
8. 覆盖 cross-root pending-list / resolve-control / ordinary member tool。
9. 修复 notification sync throw。
10. 增加 sync-throw notifier regression。
11. 跑 C1 targeted + tools/runtime focused suites。
12. 跑最小 real-host RH1–RH4。
13. 更新 PR #20 body：
    - caller-root isolation；
    - limit 修正；
    - 保留 sync-delegate limitation。
14. 推送 PR #20。
15. 最终报告只需包含：
    - 新提交 SHA；
    - caller-root contract；
    - cross-root negative evidence；
    - sync notifier throw evidence；
    - focused test totals；
    - real-host RH1–RH4；
    - 当前 mergeable 状态。

不要开始 PR #19 rebase；等 PR #20 merge 后再做。
