# dsh-agent-team：异步 Work Completion 可控唤醒机制
## 具体代码实施方案

> 基线：
>
> - `dsh-agent-team`：`master @ 9ec0d1f`
> - DeepSeek Harness：`v0.1.5-rc.2 @ fb2c4b9e`
>
> 目标：以最小改动补齐 async work completion → Leader wakeup，不扩大到通用 scheduler / durable notification / wake budget。

---

# 1. 实施目标

完成以下行为：

```text
team_delegate(..., async:true)
或
team_follow_up(..., async:true)

→ Phase A durable admission
→ Leader 立即得到 receipt
→ detached Phase B/C
→ durable settlement
→ runtime observer 重新读取 durable work status
→ terminal 时发送 completion notification
→ Leader idle: followup
→ Leader running: steer
→ Leader 使用 team_collect(requestToken) 读取完整 durable result
```

Sync 默认行为必须保持不变。

---

# 2. 改动范围总览

建议变更：

```text
packages/runtime/
├── admission/types.ts                         [修改]
├── action-router/router.ts                    [修改]
├── work-completion-notification/              [新建]
│   ├── types.ts
│   ├── notification.ts
│   └── index.ts
├── src/plugin/types.ts                        [修改]
├── src/plugin/root.ts                         [修改]
└── src/plugin/live/agent-bindings.mjs         [修改]

packages/runtime/test/
├── issue1-async-delegation.test.ts            [补充]
├── work-completion-notification.test.ts       [新建]
└── work-completion-notification-glue.test.ts  [新建]

tests/kits/
└── work-completion-wakeup-smoke/              [建议新建最小 real-host kit]
```

原则：

- 不改 DSH core；
- 不改 TeamDomain schema；
- 不改 Blueprint schema；
- 不改 Remote contract；
- 不改现有 C1 notification；
- 不改 `team_collect` 对外 contract。

---

# 3. 新建：`packages/runtime/work-completion-notification/types.ts`

## 3.1 Target 类型

```ts
export type WorkCompletionNotificationTarget =
  | {
      readonly kind: 'leader'
    }
```

当前只支持 `leader`。

注意：

- API 必须是 union；
- consumer 必须接受 `targets[]`；
- 不允许直接设计成 `notifyLeader()`。

---

## 3.2 Notification DTO

```ts
export interface WorkCompletionNotification {
  readonly rootSessionId: string
  readonly requestToken: string
  readonly instanceId: string
  readonly taskSummary?: string
  readonly targets: readonly WorkCompletionNotificationTarget[]
}
```

---

## 3.3 Delivery port

建议拆成：

```ts
export interface WorkCompletionNotificationDeliveryPort {
  deliver(args: {
    readonly rootSessionId: string
    readonly target: WorkCompletionNotificationTarget
    readonly text: string
  }): Promise<void>
}
```

以及 runtime-facing port：

```ts
export interface WorkCompletionNotificationPort {
  notifyWorkCompletion(
    notification: WorkCompletionNotification
  ): Promise<void>
}
```

这样未来 target resolver 扩展时不改 router。

---

# 4. 新建：`notification.ts`

职责只做：

1. render deterministic text；
2. iterate targets；
3. 调用 delivery port；
4. 不写 durable state。

---

## 4.1 Renderer

建议：

```ts
export function renderWorkCompletionNotification(
  notification: Pick<
    WorkCompletionNotification,
    'requestToken' | 'instanceId' | 'taskSummary'
  >
): string
```

输出：

```text
[team-work-settled requestToken=<token>]

An asynchronous Team work unit has settled.
instanceId: <instance>
taskSummary: <summary>    # optional
requestToken: <token>

Use team_collect with this requestToken to read the durable result.
```

要求：

- deterministic；
- 不包含 member result；
- 不包含 transcript；
- 不包含 unbounded text；
- `taskSummary` 使用现有 512 字符 bound，不再加复杂 truncation。

---

## 4.2 Factory

```ts
export function createWorkCompletionNotifier(options: {
  readonly deliver: WorkCompletionNotificationDeliveryPort
}): WorkCompletionNotificationPort
```

内部：

```text
for target of targets:
    render
    deliver
```

当前 target only leader。

不要在这里：

- scan TeamDomain；
- retry；
- 写 ledger；
- 判断 terminal；
- 读取 member result。

这些不是该模块职责。

---

# 5. 新建：`index.ts`

导出：

```ts
export {
  createWorkCompletionNotifier,
  renderWorkCompletionNotification,
} from './notification.js'

export type {
  WorkCompletionNotification,
  WorkCompletionNotificationPort,
  WorkCompletionNotificationTarget,
  WorkCompletionNotificationDeliveryPort,
} from './types.js'
```

---

# 6. 修改：`packages/runtime/admission/types.ts`

在 `TeamRuntimeOptions` 中增加：

```ts
readonly workCompletionNotification?:
  import('../work-completion-notification/index.js').WorkCompletionNotificationPort
```

必须 optional。

原因：

- unit/fake world 不一定有 live Leader；
- liveness feature 不能成为 durable work execution 的硬依赖。

语义：

```text
port absent
→ work 仍完整执行和 durable settle
→ 只是没有 wake notification
```

---

# 7. 修改：`packages/runtime/action-router/router.ts`

这是本轮核心改动。

---

## 7.1 保持 sync path 不变

现有：

```ts
effect = await staged.complete(request.signal)
```

不要增加 notification。

不要改变：

- returned effect；
- signal ownership；
- error propagation；
- memberResult；
- settlement path。

---

## 7.2 Async path 增加 completion observer

当前：

```ts
const task = staged.complete(undefined)
inFlightDetachedWork.add(task)

void task.then(
  () => {
    inFlightDetachedWork.delete(task)
  },
  () => {
    inFlightDetachedWork.delete(task)
  },
)

effect = staged.receipt
```

目标结构：

```ts
const task = staged.complete(undefined)
inFlightDetachedWork.add(task)

const observeCompletion = (): void => {
  inFlightDetachedWork.delete(task)
  void notifyAsyncWorkCompletion(...)
}

void task.then(
  observeCompletion,
  observeCompletion,
)

effect = staged.receipt
```

注意：

```text
notification Promise 绝不能放进 inFlightDetachedWork
```

---

# 8. Router 内新增 helper：durable terminal observation

建议 router 内部私有 helper，或者放到同目录单独文件：

```ts
async function notifyAsyncWorkCompletionIfTerminal(args: {
  repositories: TeamDomainRepositories
  rootSessionId: string
  requestToken: string
  instanceId: string
  taskSummary?: string
  notifier?: WorkCompletionNotificationPort
}): Promise<void>
```

执行：

```text
if notifier absent:
    return

entry = scanWorkStatus(
    repositories,
    rootSessionId,
    [requestToken]
)[0]

if entry?.settledSequence === undefined:
    return

notifyWorkCompletion({
    rootSessionId,
    requestToken,
    instanceId,
    taskSummary?,
    targets: [{ kind:'leader' }],
})
```

---

# 9. `instanceId` / `taskSummary` 从哪里取

不要重新扫描 arbitrary payload。

已有信息：

```text
staged.receipt.instanceId
request.payload.taskSummary
request.requestToken
rootSessionId
```

推荐 router 在 async branch 直接捕获：

```ts
const instanceId = ...
const taskSummary = ...
const requestToken = request.requestToken
```

`taskSummary` 已在 action payload 中经过现有 closed-schema / bound validation。

---

# 10. Terminal 判断

唯一允许通知的条件：

```ts
entry.settledSequence !== undefined
```

不要使用：

```text
Promise fulfilled
Promise rejected
member lifecycle === SETTLED
memberResult exists
```

作为 terminal authority。

---

# 11. `WORK_DELIVERY_FAILED` 路径

已有：

```text
deliverWork throws
→ failClosedSettle
→ settlement fact durable
→ throw WORK_DELIVERY_FAILED
```

所以：

```text
task rejects
→ observer still runs
→ scanWorkStatus
→ settledSequence exists
→ notify
```

必须测试。

---

# 12. Durable write failure 路径

若：

```text
settlement fact not durable
```

则：

```text
scanWorkStatus → no settledSequence
```

因此不通知。

必须测试。

---

# 13. Notification failure isolation

Router observer 中：

```ts
void notifyAsyncWorkCompletionIfTerminal(...).catch(error => {
  // diagnostic only
})
```

不要：

```text
rethrow
mutate work
retry member
change task settlement
```

推荐添加局部 logger / diagnostic hook。

若当前 router 没有 logger 依赖，不要为了一个 log 引入大规模 logging architecture。

可以通过 optional failure callback：

```ts
readonly onWorkCompletionNotificationFailure?: ...
```

也可以先由 notifier / production glue logger 负责。

优先选择改动最小者。

---

# 14. 修改：`packages/runtime/src/plugin/types.ts`

在 `TeamAgentBindings` 增加：

```ts
readonly deliverRootWorkCompletionNotification?: (input: {
  readonly rootSessionId: string
  readonly text: string
}) => Promise<void>
```

或者更明确：

```ts
readonly deliverWorkCompletionNotification?: ...
```

建议名字包含 `Root`，因为当前唯一 recipient 是 Leader root。

但不要把上层 notification service 命名成 Leader-only。

---

# 15. 修改：`agent-bindings.mjs`

新增独立函数，不复用 C1 的 `deliverRootInput()`。

建议：

```js
async function deliverRootWorkCompletionNotification(input) {
  const sid = String(input?.rootSessionId ?? '')
  const text = String(input?.text ?? '')

  if (sid === '') throw ...
  if (text === '') throw ...

  const handle = await ensureLiveAgent(sid)

  await prepareAgentForRequest(sid, sid)

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
}
```

---

# 16. Agent glue 明确不要做的事

不要：

```js
await handle.agent.whenIdle()
```

不要：

```js
await sessionPersistence.ensureMaterialized(...)
```

作为 delivery success 条件。

Notification success boundary：

```text
followup/steer accepted
```

即可。

---

# 17. Busy/idle race

不要额外加锁。

采用 DSH 原生 semantics：

```text
if status === idle:
    followup
else:
    steer
```

若检查后状态变化：

- running → idle 后调用 `steer`：DSH `steer` 可启动 idle agent；
- idle → running 后调用 `followup`：消息进入 next-turn queue。

不需要为这个 race 创建 Team-side state machine。

---

# 18. 修改：`packages/runtime/src/plugin/root.ts`

新增 notifier wiring：

```ts
const workCompletionNotifier =
  live.deliverRootWorkCompletionNotification !== undefined
    ? createWorkCompletionNotifier({
        deliver: {
          async deliver(args) {
            // 当前只有 leader target
            await live.deliverRootWorkCompletionNotification({
              rootSessionId: args.rootSessionId,
              text: args.text,
            })
          },
        },
      })
    : undefined
```

然后：

```ts
const runtime = createTeamRuntime({
  ...
  workDelivery: live.workDelivery,
  workActivity,
  ...(workCompletionNotifier !== undefined
    ? { workCompletionNotification: workCompletionNotifier }
    : {}),
})
```

---

# 19. 不修改 C1

不要改：

```text
packages/runtime/control/leader-notification.ts
deliverRootControlNotification
deliverRootInput
```

不要把 approval notification 切换到新 completion notifier。

本轮两个系统并存。

---

# 20. 不修改 `team_collect`

`team_collect` 已经是正确的 durable result read-back。

不需要：

- 新字段；
- 新 status；
- 新参数；
- notification ACK。

---

# 21. 不新增 TeamDomain durable records

不要新增：

```text
team-work-notification-pending
team-work-notification-delivered
```

也不要修改 schema。

原因：

本轮明确接受 best-effort notification。

---

# 22. 推荐测试：纯 notification 模块

新建：

```text
packages/runtime/test/work-completion-notification.test.ts
```

至少覆盖：

### N1 deterministic render

同一输入：

```text
byte-identical output
```

### N2 required fields

包含：

```text
requestToken
instanceId
team_collect guidance
```

### N3 optional taskSummary

有 summary 时包含。

无 summary 时不生成：

```text
taskSummary: undefined
```

### N4 no member result

message 不含：

```text
member body
member error
transcript
```

### N5 targets array

当前：

```text
[{kind:'leader'}]
```

可以正常迭代。

---

# 23. 推荐测试：Router

补充或新建 focused suite。

## R1 async success notification

```text
async work admission
→ release member
→ durable terminal
→ notifier called exactly once
```

断言：

```text
requestToken exact
instanceId exact
taskSummary exact
targets = [{kind:'leader'}]
```

---

## R2 sync work zero notification

```text
sync delegate
→ normal result
→ notifier call count = 0
```

这是最重要 regression pin 之一。

---

## R3 `WORK_DELIVERY_FAILED` still notifies

构造：

```text
delivery reject
→ fail-closed settlement
→ staged.complete rejects
```

断言：

```text
settledSequence exists
notifier called once
```

---

## R4 durable settlement fault does not notify

注入：

```text
settlement fact write failure
```

断言：

```text
settledSequence absent
notifier call count = 0
```

---

## R5 notification rejection isolated

notifier：

```text
throw/reject
```

断言：

```text
durable work status remains terminal
inFlightDetachedWork eventually size === 0
no unhandled rejection
```

---

## R6 notification not tracked as detached work

让 notifier Promise 长时间 pending。

断言：

```text
work Phase B/C settles
→ inFlightDetachedWork.size === 0
```

即使 notification 仍 pending。

这直接固定 issue #1 原语义。

---

# 24. 推荐测试：production glue

新建：

```text
packages/runtime/test/work-completion-notification-glue.test.ts
```

使用 fake Agent/handle。

---

## G1 idle Leader

Agent：

```text
status = idle
```

调用 delivery。

断言：

```text
followup called exactly once
steer called 0
whenIdle called 0
```

---

## G2 busy Leader

Agent：

```text
status = running
```

断言：

```text
steer called exactly once
followup called 0
whenIdle called 0
```

---

## G3 message source

断言：

```ts
source.kind === 'plugin'
source.plugin === 'dsh-agent-team'
```

---

## G4 missing root id

clear rejection。

---

## G5 missing text

clear rejection。

---

## G6 delivery throw propagates to notifier

`followup` / `steer` throw 时 glue Promise reject。

上层 notifier/router 负责 swallow。

---

# 25. Real-host smoke

建议新建最小 kit：

```text
tests/kits/work-completion-wakeup-smoke/
```

不要复制 C1 的大 kit。

只需要 4 个核心场景。

---

## L1 single async completion wakes idle Leader

流程：

```text
Leader turn:
    team_delegate(async:true)
    stop current work / return

Member:
    completes

Expected:
    Leader automatically gets new model request
```

Leader wake 后执行：

```text
team_collect([requestToken])
```

断言 member result 正确。

---

## L2 two async members

Leader 同 turn：

```text
delegate A async
delegate B async
```

Member A/B staggered completion。

验证：

```text
first completion can wake idle Leader
second completion reaches Leader without manual user input
```

不要求严格证明只产生一个 Leader turn，但记录 model-call count。

---

## L3 failed member completion wakes

让 child：

```text
max-tokens / controlled model error / failed result
```

只要 durable terminal，Leader 应 wake。

Leader collect 后看到 failed/unavailable。

---

## L4 sync regression

普通：

```text
team_delegate(async absent)
```

仍然：

```text
tool call blocks to terminal result
```

且没有独立 completion notification turn。

---

# 26. 不要求的测试

本轮不做：

- restart notification replay；
- notification ACK；
- wake budget；
- arbitrary recipients；
- caller target；
- instance target；
- Blueprint config；
- UI config；
- C1 notification unification；
- large topology；
- PTC mode；
- DSH core modification。

---

# 27. 实施顺序

推荐严格按以下顺序。

## Step 1 — pure DTO + renderer

新建：

```text
work-completion-notification/types.ts
notification.ts
index.ts
```

先写纯 unit tests。

---

## Step 2 — production glue waking primitive

在：

```text
agent-bindings.mjs
plugin/types.ts
```

新增 delivery port。

先用 fake Agent pin：

```text
idle → followup
running → steer
```

---

## Step 3 — root wiring

在：

```text
root.ts
```

创建 notifier 并注入 TeamRuntime。

此时 notifier 还不会被调用。

---

## Step 4 — router observer

修改：

```text
router.ts
```

为 async detached task 增加：

```text
post-settlement durable scan
→ terminal notification
```

保持 sync branch byte-for-byte 近似不变。

---

## Step 5 — focused router tests

覆盖：

```text
success
delivery-failed
durability-failed
notification-failed
sync-no-notify
detached-set semantics
```

---

## Step 6 — real-host smoke

最后验证真实：

```text
idle Leader auto wake
team_collect works
```

---

# 28. Regression gates

最低建议：

```bash
pnpm typecheck
pnpm build
pnpm build:composition
pnpm check:artifacts
```

注意仓库已发现：

```text
pnpm build
```

不会刷新 `.mjs` dist glue。

所以必须：

```bash
pnpm build
pnpm build:composition
```

两步都执行。

---

## Focused tests

至少：

```text
runtime work completion notifier tests
router async delegation tests
production glue tests
existing issue1 async delegation tests
existing C1 tests
```

C1 不应行为变化。

---

## Full test

最后运行：

```bash
pnpm test
```

与当前已知 baseline 比较失败集合。

不要要求“绝对 0 failure”作为本任务独立判据，如果仓库 baseline 本身已有已知失败；但：

```text
不得新增 deterministic failure
```

---

# 29. 完成判据

功能完成必须同时满足：

1. `async:true` work 成功 terminal 后 Leader 自动收到 completion notice；
2. Leader idle 时无需人工输入即可被唤醒；
3. Leader running 时 completion 用 `steer`；
4. sync work 无 completion notification；
5. notification 不携带 member body；
6. Leader 可用 `team_collect` 获取完整 durable result；
7. `WORK_DELIVERY_FAILED` terminal path 仍通知；
8. durable settlement 缺失时不假报 completion；
9. notification failure 不影响 work durability；
10. `inFlightDetachedWork` 仍只追踪 Phase B/C；
11. 无 TeamDomain schema 变化；
12. 无 Blueprint / Remote / UI contract 变化；
13. 无 DSH core patch；
14. `pnpm build + pnpm build:composition` 后 artifacts 一致；
15. real-host smoke 证明 idle Leader 被自动唤醒。

---

# 30. 明确禁止的 scope creep

本任务实现 agent 不应擅自加入：

- generic TeamNotificationService；
- notification retry queue；
- notification ledger；
- background scheduler；
- wake budget；
- autonomous epoch；
- arbitrary recipient configuration；
- topology manager；
- C1 rewrite；
- Blueprint 新字段；
- Remote version bump；
- UI；
- DSH source patch。

---

# 31. 最终接线图

```text
team_delegate(async:true)
        │
        ▼
Action Router
        │
        ├── Phase A durable admission
        │
        ├── return receipt
        │
        └── staged.complete(undefined)
                │
                ▼
          Phase B/C detached
                │
                ▼
         Promise settle/reject
                │
        remove inFlightDetachedWork
                │
                ▼
        scanWorkStatus(token)
                │
        ┌───────┴────────┐
        │                │
   no settlement      terminal
        │                │
      stop               ▼
                  WorkCompletionNotifier
                         │
                  targets=[leader]
                         │
                         ▼
                  Agent live glue
                         │
               ┌─────────┴─────────┐
               │                   │
           Leader idle         Leader running
               │                   │
           followup()             steer()
               │                   │
               └─────────┬─────────┘
                         ▼
                  Leader sees token
                         │
                         ▼
                  team_collect(token)
                         │
                         ▼
                 durable member result
```

这就是本轮应实现的完整最小闭环。
