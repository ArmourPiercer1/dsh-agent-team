# dsh-agent-team：异步 Work Completion 可控唤醒机制
## 系统架构设计与未来扩展点

> 基线：
>
> - `dsh-agent-team`：`master @ 9ec0d1f`
> - DeepSeek Harness：`v0.1.5-rc.2 @ fb2c4b9e`
>
> 本文只描述本轮已经冻结的设计，不引入 Alpha.3 / Alpha.4 额外能力。

---

## 1. 问题定义

当前 `team_delegate(..., async:true)` / `team_follow_up(..., async:true)` 的执行链为：

```text
Leader
  │
  │ async work admission
  ▼
Phase A: durable admission
  │
  ├── Leader 立即得到 admission receipt
  │
  ▼
detached Phase B/C
  │
  ├── Phase B: member turn
  └── Phase C: durable settlement
```

Phase B/C 通过 `staged.complete(undefined)` 在后台运行。

当前 detached Promise 完成后只执行：

```text
remove from inFlightDetachedWork
```

不会向 Leader 发送任何 completion notification。

因此存在稳定复现的 liveness failure：

```text
Leader 发出 async work
→ Leader 当前 turn 结束
→ Leader idle
→ Member 完成 work
→ settlement 已 durable
→ 没有任何 waking edge
→ Leader 永久不知道 work 已完成
```

最终需要人工输入才能继续。

---

# 2. 设计目标

本轮只解决：

> 当 `async:true` 的 Team work unit 达到 durable terminal settlement 后，runtime 自动向 Leader 发送一条 best-effort completion notification；若 Leader idle，则唤醒一个新 turn；若 Leader 已 running，则注入当前 turn 的最近 step boundary。

不解决：

- 通用 workflow scheduler；
- restart-safe notification replay；
- wake budget；
- 任意团队拓扑；
- 多 recipient 的实际启用；
- Blueprint 配置；
- UI 配置；
- durable notification ledger；
- notification ACK；
- C1 notification 重构。

---

# 3. 已冻结的设计决策

## 3.1 只有 async work 产生 completion notification

### Sync work

```text
team_delegate / team_follow_up
→ 当前 tool call await Phase B/C
→ memberResult 直接作为 tool result 返回
```

不额外通知。

### Async work

```text
Phase A durable admission
→ tool 立即返回 receipt
→ Phase B/C detached
→ durable terminal settlement
→ completion notification
```

所以 notification 是 `async:true` 的补充 continuation channel。

---

## 3.2 Completion identity 是 work unit，不是 Member lifecycle

通知身份：

```text
(rootSessionId, requestToken)
```

不是：

```text
Member RUNNING → SETTLED
```

原因：同一 Member 当前允许多个 work unit overlap。

例如：

```text
work A ─────────────┐
work B ────────┐    │
                ▼    │
          Member SETTLED
                     ▼
              work A settlement
```

后完成的 work A 仍会写自己的 settlement fact，但不一定再次产生 Member lifecycle transition。

因此可靠 completion source 必须是：

```text
requestToken 对应的 durable settlement fact
```

---

## 3.3 当前只通知 Leader，但 recipient API 不写死为 Leader-only

当前 production 默认：

```ts
targets: [
  { kind: 'leader' }
]
```

内部类型预留：

```ts
type WorkCompletionNotificationTarget =
  | { kind: 'leader' }
```

当前阶段：

- 不公开配置；
- 不允许 Blueprint 设置；
- 不允许 plugin config 设置；
- 不允许模型指定 recipient；
- 不支持 caller / member recipient。

但 service 必须以：

```text
targets[]
```

而不是：

```text
notifyLeader(...)
```

作为内部模型。

这样未来可扩：

```ts
type WorkCompletionNotificationTarget =
  | { kind: 'leader' }
  | { kind: 'caller' }
  | { kind: 'instance'; instanceId: string }
```

而不必重构 completion notification 的主链。

---

## 3.4 Notification 只携带最小元数据，不携带业务结果

通知内容：

```text
[team-work-settled requestToken=<token>]

An asynchronous Team work unit has settled.
instanceId: <instanceId>
taskSummary: <taskSummary>   # optional
requestToken: <token>

Use team_collect with this requestToken to read the durable result.
```

包含：

- `requestToken`
- `instanceId`
- `taskSummary?`

不包含：

- `memberResult.body`
- `memberResult.error`
- transcript
- tool output
- child reasoning

完整结果仍由：

```text
team_collect([requestToken])
```

读取。

---

# 4. Authority 与 liveness 分离

整个设计的核心不变量：

> Durable TeamDomain settlement 是 authority；notification 只是 liveness hint。

因此：

```text
notification failure
≠ work failure
≠ settlement rollback
≠ work retry
```

通知不能：

- 改写 work 状态；
- 回滚 settlement；
- 重新执行 member；
- 自动 re-admit work；
- 写 fake success；
- 写 fake failure。

---

# 5. Completion trigger

## 5.1 Trigger owner：Action Router

Trigger 放在：

```text
packages/runtime/action-router/router.ts
```

原因：

只有 router 明确知道：

```text
request.execution === 'async'
```

Settlement 层只应该负责：

```text
durable completion fact
```

不应该知道 work 是 sync 还是 async。

因此职责分离：

```text
Settlement layer
    → completion truth

Router
    → async scheduling / completion observation

Notification module
    → liveness projection

Agent glue
    → actual DSH wake delivery
```

---

## 5.2 不直接根据 Promise fulfill/reject 判断 terminal

不能：

```text
staged.complete fulfilled → notify
staged.complete rejected → don't notify
```

因为：

### `WORK_DELIVERY_FAILED`

路径为：

```text
delivery throws
→ failClosedSettle()
→ durable settlement fact written
→ WORK_DELIVERY_FAILED thrown
```

Promise reject，但 work 已 terminal。

应该通知。

### `DURABLE_WRITE_FAILED`

可能发生：

```text
state/fact settlement durability fault
```

此时 requestToken 可能仍表现为：

```text
running
resumePossible = true
```

不应该声称 work 已 settled。

---

## 5.3 Authoritative terminal check

Detached task settle 后：

```text
scanWorkStatus(
  repositories,
  rootSessionId,
  [requestToken]
)
```

只有：

```text
settledSequence !== undefined
```

才允许发送：

```text
team-work-settled
```

因此 durable state 仍然是唯一 authority。

---

# 6. DSH delivery semantics

复用 `v0.1.5-rc.2` continuable subagent 的核心 waking 语义：

```text
target idle
    → followup(message)
    → start new turn

target running
    → steer(message)
    → nearest step boundary
```

---

## 6.1 Leader idle

```text
Member A completes
→ Leader.status === idle
→ followup(notification)
→ Leader starts new turn
```

---

## 6.2 Leader running

```text
Member B completes
→ Leader.status !== idle
→ steer(notification)
```

不会额外排一个完整 future turn。

---

## 6.3 自然 coalescing

例如并行 4 个 work：

```text
A completes
→ Leader idle
→ followup(A)
→ Leader running

B completes
→ steer(B)

C completes
→ steer(C)

D completes
→ steer(D)
```

通常形成：

```text
1 个 waking turn
+ N 个 current-turn completion inputs
```

而不是：

```text
N 个 queued future turns
```

因此本轮不做 wake budget 仍然可以接受。

---

# 7. Notification delivery 成功边界

成功定义：

> 消息成功被 `followup()` 或 `steer()` 接受。

不等待：

```text
Leader.whenIdle()
```

也不要求：

```text
Leader 整个新 turn 成功
```

Notification lifecycle 不应该与 Leader 新 turn 的生命周期耦合。

正确：

```text
completion settlement
→ enqueue/steer notification
→ completion notifier returns
```

错误：

```text
completion settlement
→ wake Leader
→ await Leader entire turn
→ completion notifier returns
```

---

# 8. Message provenance

Completion notification 使用：

```ts
source: {
  kind: 'plugin',
  plugin: 'dsh-agent-team'
}
```

不要伪装为：

```ts
source: { kind: 'user' }
```

原因：

- notification 不是 user-authored；
- DSH 已支持 plugin source；
- 不需要新增 Team-specific SessionEvent vocabulary；
- provenance 与 authority 更清晰。

---

# 9. Notification durability

本轮选择 best-effort。

允许 crash window：

```text
settlement fact durable
→ process crashes
→ notification not delivered
```

重启后：

```text
team_collect(requestToken)
```

仍然可以读取结果。

但不会：

- 自动扫描历史 settlement；
- 自动补发 notification；
- 创建 notification ledger；
- 创建 notification-delivered ACK。

这是明确接受的本版本 limitation，不是未定义行为。

---

# 10. Replay 语义

如果同一个 requestToken 已 terminal：

```text
same-token replay
→ zero work redelivery
→ zero completion notification replay
```

原因：

本轮 notification 没有 durable ACK / retry contract。

不能通过 terminal replay 暗中实现一套不完整的 retry notification 机制。

---

# 11. Notification failure

例如：

- Leader live agent 无法 ensure；
- root session 无法 resume；
- `followup` throw；
- `steer` throw；
- target resolution fault。

处理：

```text
diagnostic/log
→ swallow
```

不能传播回：

```text
staged.complete()
```

不能改变：

```text
inFlightDetachedWork
work settlement
team_collect
```

的结果。

---

# 12. `inFlightDetachedWork` 的语义必须保持不变

它继续只表示：

> Detached Phase B/C 正在执行。

不能变成：

> Phase B/C + completion notification + Leader new turn。

因此：

```text
task settles
→ remove task from inFlightDetachedWork
→ launch fire-and-forget notification observer
```

而不是：

```text
task = staged.complete().then(notifyLeader)
→ inFlightDetachedWork holds combined task
```

否则会破坏 issue #1 的现有 contract 和测试语义。

---

# 13. 与现有 C1 notification 的关系

现有 C1：

```text
leader approval request
→ deliverRootControlNotification
→ deliverRootInput
→ followup
→ whenIdle
```

本轮不修改。

虽然它和新的 completion notification 有：

- provenance 不同；
- busy/idle scheduling 不同；
- success boundary 不同；

但本轮不要为了统一而重构 C1。

原因：

- C1 已完成单独闭环；
- 有 real-host smoke；
- approval notification 与 work completion notification 的语义不同；
- 当前只有两种 notification，不值得引入通用 TeamNotificationService。

---

# 14. 推荐模块边界

建议新增：

```text
packages/runtime/work-completion-notification/
├── types.ts
├── notification.ts
└── index.ts
```

职责：

```text
types.ts
    notification DTO / target DTO / port

notification.ts
    deterministic text renderer
    target iteration
    best-effort delivery policy

index.ts
    public exports
```

模块不得：

- 读取/写入 TeamDomain authority；
- 直接操作 Agent；
- 直接做 settlement；
- 直接 retry；
- 做 restart recovery。

---

# 15. Production dependency flow

```text
TeamRuntime
  │
  └─ optional WorkCompletionNotificationPort
        │
        ▼
WorkCompletionNotification module
        │
        └─ targets[{kind:'leader'}]
              │
              ▼
production glue delivery port
              │
              ▼
ensureLiveAgent(rootSessionId)
              │
              ▼
prepareAgentForRequest(...)
              │
              ▼
createUserMessage(plugin source)
              │
         ┌────┴────┐
         │         │
       idle      running
         │         │
     followup     steer
```

---

# 16. 未来扩展点

## 16.1 Multiple recipients

未来可以增加：

```ts
type WorkCompletionNotificationTarget =
  | { kind: 'leader' }
  | { kind: 'caller' }
  | { kind: 'instance'; instanceId: string }
```

然后：

```text
target resolver
→ session identity
→ waking policy
```

当前版本不实现。

---

## 16.2 Topology-aware notification

未来更复杂团队拓扑可能出现：

```text
Leader
├── Manager A
│   ├── Worker A1
│   └── Worker A2
└── Manager B
```

work completion 可以未来配置为：

```text
notify original caller
notify direct manager
notify root leader
notify supervisory chain
```

但必须等拓扑 authority 设计完成后再决定。

---

## 16.3 Wake budget

未来可以增加：

```text
maxConsecutiveWakes
wake epoch
autonomous work epoch
```

但不应该在本轮加入。

一个较合理的未来方向：

```text
user-authored turn
→ open autonomous epoch
→ async completions consume wake credits
→ epoch closes on final answer / approval / explicit stop
```

当前版本：

```text
no budget
```

---

## 16.4 Durable notification retry

如果以后要求 crash-safe：

```text
work settlement
+
notification-pending record
```

成功后：

```text
notification-delivered
```

重启：

```text
pending - delivered
→ replay notification
```

这需要明确：

- notification identity；
- ACK；
- at-least-once semantics；
- duplicate handling；
- GC；
- retention；
- boot recovery。

当前不实现。

---

## 16.5 Result preview

当前 notification 只带 token。

未来可以增加 bounded preview：

```text
status
short result preview
truncated marker
```

但完整结果仍应以 durable settlement + `team_collect` 为 authority。

---

## 16.6 Notification unification

当出现至少第三类稳定 notification 时，再考虑：

```text
TeamNotificationService
```

统一：

- work completion；
- approval；
- topology events；
- failure alerts；
- lifecycle events。

当前阶段不做 premature abstraction。

---

# 17. 本轮明确非目标

禁止 scope creep 到：

- DSH core patch；
- Blueprint UI；
- new Team SessionEvent vocabulary；
- TeamDomain schema migration；
- notification ledger；
- restart replay；
- wake budget；
- arbitrary recipients；
- caller notification；
- member-to-member automatic wake；
- C1 rewrite；
- PTC support；
- generic task scheduler。

---

# 18. 最终架构摘要

本轮机制可以压缩为：

> Router owns async completion observation; TeamDomain owns completion truth; a narrow work-completion notifier projects that truth into a best-effort Leader wake, using DSH v0.1.5-rc.2 semantics `idle → followup / running → steer`, while `team_collect` remains the durable result channel.

这是一个最小增量：

```text
现有 async execution
+
一个 completion observer
+
一个小 notification module
+
一个 production wake delivery port
```

不改变现有：

- durable work authority；
- TeamDomain schema；
- sync execution semantics；
- `team_collect` contract；
- Blueprint contract；
- Remote contract；
- DSH core。
