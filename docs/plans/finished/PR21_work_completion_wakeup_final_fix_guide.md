# PR #21 Work Completion Wake-up：最终收束修复指引

> 目标仓库：`ArmourPiercer1/dsh-agent-team`
>
> 目标 PR：#21 `feat/work-completion-wakeup`
>
> 当前审查结论：**保留 teardown 修复；撤销 busy→inject；恢复 busy→steer；明确 wake provenance contract；不扩大 scope。**

---

## 1. 本轮目标

当前 PR #21 的主体架构保持不变：

```text
async work
→ detached Phase B/C
→ durable terminal settlement
→ router observer re-read durable work status
→ completion notification
→ Leader
```

本轮只收束上一轮审查修复中引入的行为偏差：

```text
busy Leader → inject
```

恢复为：

```text
idle Leader    → followup
running Leader → steer
```

产品语义冻结为：

- 用户 Stop 只负责结束**当前 Leader turn**；
- 本版本**不实现强 Stop-priority**，不要求 Stop 后抑制未来 Team runtime wake；
- 如果之后审批请求、member relay、member settle 等 Team event 到达，可以再次激活 Leader；
- 每一种 Team-originated activation 必须携带稳定、可读的 model-visible provenance envelope，让 Leader 明确知道“为什么被再次激活”。

---

## 2. Wake provenance contract

当前 Alpha 阶段直接冻结已有三类 leading envelope：

### Approval

```text
[team-control requestId=<id>]
```

### Member relay

```text
[team-relay] from=<sender> to=<recipient>
```

或：

```text
[team-relay:mediated via leader] ...
```

### Async work completion

```text
[team-work-settled requestToken=<token>]
```

这些 leading envelope 就是本版本的 **wake provenance contract**。

不要新增：

- `[team-notification type=...]`
- `TeamNotificationService`
- notification registry
- generic notification bus

当前三个领域分别维护自己的 envelope 更简单、更清楚。

---

## 3. 必须保留的上一轮 teardown 修复

以下内容正确，全部保留。

### 3.1 `closing` lifecycle gate

`agent-bindings.mjs` 保留：

```js
let closing = false
```

`close()` 开始时同步：

```js
if (closing) return
closing = true
```

### 3.2 `ensureLiveAgent()` entry gate

保留：

```js
if (closing) {
  throw ...
}
```

目的：

```text
close 已开始
→ completion 不得再 cold-resume Leader
```

### 3.3 post-resume closing re-check

保留：

```text
await agents.resume(...)
        ↓
if closing:
    dispose late handle
    reject
    never liveAgents.set(...)
```

这是一个真实 teardown race 修复。

### 3.4 completion delivery closing checks

`deliverRootWorkCompletionNotification()` 保留：

```text
entry closing check
await ensureLiveAgent
await prepareAgentForRequest
post-await closing check
```

### 3.5 G8a / G8b

保留：

```text
G8a:
completion delivery starts after close
→ reject
→ no wake

G8b:
resume suspended
→ close completes
→ resume returns late
→ late handle disposed
→ never enters liveAgents
```

---

## 4. 必须撤销：busy → inject

当前代码：

```js
if (handle.agent.status === 'idle') {
  handle.agent.followup(message)
} else {
  handle.agent.inject(message)
}
```

改回：

```js
if (handle.agent.status === 'idle') {
  handle.agent.followup(message)
} else {
  handle.agent.steer(message)
}
```

DSH `v0.1.5-rc.2`：

```ts
followup(input) {
  this.send(input, 'next-turn', true)
}

steer(input) {
  this.send(input, 'next-step', true)
}

inject(input) {
  this.send(input, 'next-step', false)
}
```

本版本不要求 Stop 后压制后续 completion wake，所以没有必要为 abort-convergence 的狭窄窗口牺牲 liveness。

`steer` 更符合本功能的核心目标：

```text
completion event
→ Leader 最终应看到
```

普通 running 时它进入 next-step；若恰逢 retirement/aborted convergence，waking 语义也比 non-waking inject 更能避免“消息已入 inbox 但 Leader idle 不再醒”的窗口。

---

## 5. Stop 行为的正式说明

相关注释/设计记录中使用下面的语义：

> A user Stop terminates the current Leader turn. A later asynchronous Team event may legitimately activate the Leader again. Every Team-originated activation must carry an explicit model-visible provenance envelope so the Leader can determine why it resumed.

删除或改写上一轮新增的：

```text
Stop wins over completion wake
```

因为当前版本不冻结 strong/weak Stop-priority。

---

## 6. 修改文件

### 6.1 `packages/runtime/src/plugin/live/agent-bindings.mjs`

必须：

```diff
if (handle.agent.status === 'idle') {
  handle.agent.followup(message)
} else {
- handle.agent.inject(message)
+ handle.agent.steer(message)
}
```

同步修改所有相关注释：

```diff
- idle → followup / running → inject
+ idle → followup / running → steer
```

删除：

- Stop-priority
- non-waking next-step
- inject retirement race
- “Stop wins”相关说明

保留：

- best-effort
- acceptance-only success boundary
- no `whenIdle`
- no materialize requirement
- closing gate
- durable settlement authority
- `team_collect` recovery
- plugin source provenance

### 6.2 `packages/runtime/src/plugin/types.ts`

把 completion port 文档：

```diff
- otherwise → inject
- Stop-priority
+ otherwise → steer
```

加入或保留：

```text
A later Team runtime event may activate the Leader after a user Stop;
the leading envelope identifies the activation source.
```

不新增类型或配置。

### 6.3 `packages/runtime/src/plugin/root.ts`

只改 completion wiring 注释：

```diff
- idle → followup / running → inject
+ idle → followup / running → steer
```

删除 Stop-priority 措辞。

wiring 代码结构不改。

### 6.4 `packages/runtime/work-completion-notification/types.ts`

文档改回：

```diff
- idle → followup / running → inject
+ idle → followup / running → steer
```

保留：

```text
at-most-once best-effort notification attempt
no ledger
no ack
no retry
```

“at-most-once”只描述 notifier 没有 redelivery，不要再和 inject/Stop 绑定。

### 6.5 `packages/runtime/work-completion-notification/notification.ts`

主体实现预计不改。

检查并清理残留：

```text
Stop-priority
inject
```

Renderer 不改。

---

## 7. 修改测试

### 7.1 `work-completion-notification-glue.test.ts`

#### G1 保持

```text
idle Leader
→ followup exactly once
→ steer 0
→ inject 0
→ whenIdle 0
```

#### G2 改回 busy → steer

```text
busy Leader
→ steer exactly once
→ followup 0
→ inject 0
→ whenIdle 0
```

#### G6 改回 steer throw

当前若是：

```text
inject throw propagates
```

改为：

```text
steer throw propagates
```

语义仍然是：

```text
glue rejects
router observer owns swallow
```

#### 删除当前 G7 Stop-priority pin

当前 G7：

```text
cancelled-converging Leader
→ inject
→ Stop wins
```

删除。

原因：

- 本版本不冻结 Stop-priority；
- 当前 double 只有 `status='running'`，没有真正构造 `abort.signal.aborted===true`；
- 这是 implementation pin，不是实际 Stop 行为证明。

如果测试编号必须连续，可以不保留 G7；不要为了编号重新造一个行为。

### 7.2 Renderer / provenance tests

确保已有测试分别 pin：

```text
approval:
startsWith("[team-control requestId=")

relay:
startsWith("[team-relay")
或 mediated variant

completion:
startsWith("[team-work-settled requestToken=")
```

不要为此重构 messaging/control。

### 7.3 G8 保持

teardown tests 不改。

---

## 8. Real-host smoke

现有 smoke 保留。

若描述中出现：

```text
inject / fresh followup / merged
```

改成：

```text
steer / fresh followup / merged
```

双 async 场景不要要求 exactly one wake turn。

只要求：

```text
both completion tokens reach the Leader without manual input
```

继续验证：

```text
L1 idle Leader completion wake
L2 two async completions
L3 failed completion wake
L4 sync path no extra notification
```

---

## 9. 不修改的主体逻辑

### Router

保持：

```text
async-only notification
Promise fulfill/reject → same observer
remove inFlightDetachedWork first
scanWorkStatus durable re-read
settledSequence !== undefined → notify
notification failure swallow
```

### Settlement

不改：

```text
settleAdmittedWork
failClosedSettle
WorkDeliveryResult
```

### `team_collect`

不改。

### Notification DTO

不改：

```text
requestToken
instanceId
taskSummary?
targets[]
```

不加入：

```text
memberResult
status
body
error detail
```

### Recipient

继续：

```ts
targets: [{ kind: 'leader' }]
```

不开放配置。

---

## 10. `source.kind` 本轮不统一

当前不同路径的 source metadata 不完全一致。

本轮不要为了“统一 provenance”去修改：

- approval source
- member relay source
- control/root input path

Leader 判断 wake 来源以稳定 leading envelope 为准：

```text
[team-control]
[team-relay]
[team-work-settled]
```

source-kind 全局一致性是独立后续任务。

---

## 11. closing 注释要缩窄，不要扩大实现范围

上一轮 closing gate 主要证明：

```text
ensureLiveAgent / work-completion notification
```

不会在 row teardown 后 cold-resume / wake Leader。

不要声称：

> close 开始后，整个 `agent-bindings` 所有 create/resume 路径都不可能再 `liveAgents.set`。

当前 `boot`、`childFactory`、`createRootAgent` 等还有独立路径。

本轮不要顺手统一这些路径。

建议注释限定为：

```text
The closing gate protects ensureLiveAgent and work-completion delivery
from resurrecting / waking a Leader during row teardown.
```

---

## 12. 禁止 scope creep

本轮禁止新增：

- strong Stop-priority
- Stop epoch
- wake suppression
- wake budget
- scheduler
- retry
- durable notification ledger
- notification ACK
- generic TeamNotificationService
- unified notification event type
- Blueprint notification config
- Remote notification config
- UI configuration
- DSH core patch
- C1 rewrite
- member relay rewrite
- source-kind global cleanup

---

## 13. 推荐实施顺序

```text
Step 1
agent-bindings.mjs:
inject → steer
清理 Stop-priority 注释

Step 2
plugin/types.ts / root.ts / notification types:
同步 running → steer

Step 3
glue tests:
G2 steer
G6 steer throw
删除 G7 inject pin
保留 G8

Step 4
smoke 注释:
inject → steer

Step 5
记录 wake provenance contract
不新增架构

Step 6
build + tests
```

---

## 14. 必须执行的验证

### Focused tests

至少：

```text
work-completion-notification.test.ts
work-completion-notification-glue.test.ts
work-completion-async-wakeup.test.ts
issue1-async-delegation.test.ts
```

以及已有 C1 focused tests，确保 approval liveness 未受影响。

### Build

必须：

```bash
pnpm build
pnpm build:composition
```

然后执行仓库当前 artifact consistency gate，例如：

```bash
pnpm check:artifacts
```

原因：普通 `pnpm build` 不刷新 `.mjs` glue。

### Full suite

```bash
pnpm test
```

判据：

```text
不新增 deterministic failure
失败集合与当前 baseline 一致
```

### Real-host smoke

work-completion smoke 至少运行两次。

检查：

```text
idle → followup
busy → steer
completion envelope = [team-work-settled ...]
```

---

## 15. 完成判据

修复完成必须同时满足：

1. async work 仅在 durable terminal settlement 后通知；
2. sync work 零 completion notice；
3. idle Leader → `followup`；
4. running Leader → `steer`；
5. completion delivery 不等待 `whenIdle`；
6. notification failure 不影响 durable work；
7. closing 中不 cold-resume / wake Leader；
8. late resumed Leader handle 被 dispose，不写入 `liveAgents`；
9. completion 通过 `[team-work-settled requestToken=...]` 明确标识 provenance；
10. approval 保持 `[team-control requestId=...]`；
11. member relay 保持 `[team-relay...]`；
12. 不引入 Stop epoch / scheduler / ledger / retry / wake budget；
13. 无 DSH core patch；
14. `pnpm build + pnpm build:composition` 后 artifact gate 通过；
15. focused + full baseline + real-host smoke 通过。

---

## 16. 最终预期代码形态

```js
async function deliverRootWorkCompletionNotification(input) {
  ...

  if (closing) throw ...

  const handle = await ensureLiveAgent(sid)

  await prepareAgentForRequest(sid, sid)

  if (closing) throw ...

  const message = createUserMessage({
    content: [{ type: 'text', text }],
    source: {
      kind: 'plugin',
      plugin: 'dsh-agent-team',
    },
  })

  if (handle.agent.status === 'idle') {
    handle.agent.followup(message)
  } else {
    handle.agent.steer(message)
  }

  // success boundary = inbox acceptance
  // no whenIdle
  // no materialize requirement
}
```

---

## 17. 最终架构摘要

```text
Team runtime event
        │
        ├─ [team-control ...]
        ├─ [team-relay ...]
        └─ [team-work-settled ...]
        │
        ▼
Leader
        │
   idle ? followup
        : steer
```

用户 Stop 结束当前 turn。

之后如果新的 Team runtime event 合法到达，Leader 可以再次运行；leading envelope 必须明确告诉模型：

```text
WHY it was activated.
```

这就是本轮应冻结的最终 Alpha 行为。
