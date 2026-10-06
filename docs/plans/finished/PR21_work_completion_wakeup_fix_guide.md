# PR #21 修复指引：work-completion wake-up 收束修复

> 仓库：`ArmourPiercer1/dsh-agent-team`  
> PR：#21 `feat(runtime): async work-completion wake-up（唤醒系统）`  
> 审查基线：`feat/work-completion-wakeup @ 325fbccb4842d33d0a554d1af6e32a287e8a29bc`  
> 目标 DSH：v0.1.5-rc.2 / `fb2c4b9e698e30edb738bca4cf0618587db7d203`
>
> 本文是**修复执行指引**，目标是以最小改动收束 PR #21。不要借此扩展 completion notification 的 durable 协议、重试系统、调度器或 UI。

---

## 1. 修复目标

PR #21 的核心架构保持不变：

```text
async work Phase B/C
    ↓
durable terminal settlement
    ↓
router observer re-read scanWorkStatus(...)
    ↓
best-effort Leader wake hint
    ↓
Leader 使用 team_collect(requestToken)
    ↓
读取 durable result
```

本轮只处理以下三项：

1. **P1：teardown / close 竞态**
   - plugin/live binding 开始关闭后，不允许 completion notification 再创建、resume 或唤醒 Leader Agent。
   - 特别防止 `close()` 已取得 `liveAgents` 快照后，notification 通过 `ensureLiveAgent()` 新建一个不在快照中的 handle，导致关闭后残留。

2. **P1：Stop 优先**
   - Leader `idle`：completion notification 使用 `followup()`，主动开启新 turn。
   - Leader `running`：completion notification 使用 **`inject()`**，而不是 `steer()`。
   - 因此，当用户已经 Stop / cancel 当前 turn 时，completion 不得通过 waking send 自动重开下一 turn。

3. **P2：修正文档语义**
   - 当前机制是 **at-most-once best-effort wake attempt**，不是 at-least-once delivery。
   - durable settlement + `team_collect` 才是恢复权威。

除此以外，不改变当前 PR #21 的 durable terminal 判定、async/sync 分流和 `team_collect` 语义。

---

## 2. 明确不做的事情

本修复不得引入以下内容：

- 不新增 TeamDomain schema；
- 不新增 notification ledger / intent fact；
- 不新增 retry / replay / scheduler；
- 不新增 completion acknowledgement；
- 不修改 Blueprint schema；
- 不修改 Remote / UI；
- 不修改 C1 control plane；
- 不修改 DSH core；
- 不把 notification promise 加入 `inFlightDetachedWork`；
- 不改变 `scanWorkStatus(...).settledSequence !== undefined` 作为 terminal authority 的判据；
- 不给 completion wake 新增 `maxConsecutiveWakes` 或其他 autonomy budget。

最后一项属于当前版本的**已接受行为**：异步团队工作可以形成无人干预的多-turn autonomous chain。若未来需要限制，应单独设计 Team-level autonomy budget，而不是在本 PR 临时复刻 DSH background-job 的 wake budget。

---

# 3. 修复 A：关闭态必须阻止 Agent resume / wake

## 3.1 问题

当前：

`packages/runtime/src/plugin/live/agent-bindings.mjs`

```js
async function deliverRootWorkCompletionNotification(input) {
  ...
  const handle = await ensureLiveAgent(sid)
  await prepareAgentForRequest(sid, sid)
  ...
  if (handle.agent.status === 'idle') {
    handle.agent.followup(message)
  } else {
    handle.agent.steer(message)
  }
}
```

而：

```js
async function close() {
  for (const [sid, handle] of [...liveAgents]) {
    liveAgents.delete(sid)
    await handle.dispose()
  }
  ...
}
```

`close()` 只遍历一次 `liveAgents` 快照，同时 `ensureLiveAgent()` 没有 closing gate。

竞态示例：

```text
T0  async member 仍在执行
T1  live.close() 开始，取得 liveAgents 快照
T2  close 删除并 dispose Leader handle
T3  member durable settle
T4  completion observer 调用 deliverRootWorkCompletionNotification
T5  ensureLiveAgent 发现 root durable，于是 agents.resume(root)
T6  新 handle 被重新写入 liveAgents
T7  close 继续旧快照并返回
T8  domain.close()
T9  新 Leader handle 残留在已关闭 plugin/domain 之后
```

这是本轮必须修复的 merge blocker。

---

## 3.2 推荐实现：live binding 生命周期 gate

在 `createAgentBindings(deps)` 闭包内增加一个简单生命周期状态。

推荐不要只在 completion delivery 入口加一个 boolean 检查，因为下面这种竞态仍然存在：

```text
delivery 检查 closing=false
    ↓
await ensureLiveAgent(...)
    ↓
此时 close() 开始
    ↓
agents.resume() 才完成并写入 liveAgents
```

因此至少要同时保护：

1. `ensureLiveAgent()` 的 resume 创建路径；
2. completion delivery 在异步边界后的实际发送。

可以采用：

```js
let closing = false
```

也可以使用更明确的闭包状态：

```js
let liveLifecycle = 'open' // 'open' | 'closing' | 'closed'
```

本轮追求最小改动，boolean 已足够。

---

## 3.3 `ensureLiveAgent()` 的要求

修改：

`packages/runtime/src/plugin/live/agent-bindings.mjs`

函数：

```js
async function ensureLiveAgent(sessionId)
```

### 要求一：关闭开始后不允许新 live handle

进入函数时：

```js
if (closing) {
  throw new Error('agent-bindings: live bindings are closing')
}
```

### 要求二：必须处理 resume 与 close 并发

不能只做入口检查。

在：

```js
const handle = await agents.resume(...)
```

之后、执行：

```js
liveAgents.set(sessionId, handle)
```

之前再次检查 `closing`。

如果此时已经进入关闭态：

1. **不要**把 handle 放入 `liveAgents`；
2. best-effort dispose 这个刚 resume 出来的 handle；
3. 抛出关闭态错误。

示意：

```js
const handle = await agents.resume(...)

if (closing) {
  try {
    await handle.dispose()
  } catch (error) {
    observations.push(
      `... resumed agent dispose failed during close ...`
    )
  }
  throw new Error('agent-bindings: live bindings began closing while resuming agent')
}

liveAgents.set(sessionId, handle)
return handle
```

### 注意

不要因为这次修改给 `ensureLiveAgent()` 引入新的 durable 状态或等待队列。

它只需要保证一个局部不变量：

> 一旦 `close()` 宣布开始，之后不能再有新的 live handle 成功加入 `liveAgents`。

---

## 3.4 `close()` 的要求

在 `close()` **最开头**设置关闭态：

```js
async function close() {
  if (closing) return
  closing = true

  ...
}
```

若已有现成的 close idempotency 状态，则复用，不要再创建第二套生命周期状态。

关键顺序必须是：

```text
mark closing
    ↓
禁止任何新 resume
    ↓
dispose 当前 liveAgents
    ↓
清理其他 binding state
```

而不是：

```text
先 dispose
    ↓
最后才 mark closing
```

---

## 3.5 completion delivery 也要做发送前 gate

函数：

```js
deliverRootWorkCompletionNotification(...)
```

在任何 `ensureLiveAgent()` 之前检查 closing。

此外，由于：

```js
await ensureLiveAgent(...)
await prepareAgentForRequest(...)
```

存在异步边界，建议在实际 `followup()` / `inject()` 之前再检查一次。

目的不是防止 handle 泄漏——handle 泄漏已经由 `ensureLiveAgent()` 自己负责——而是保证：

> close 已经开始时，不再向一个正在被 teardown 的 Agent 追加新的 model-visible input。

推荐结构：

```js
if (closing) throw closingError()

const handle = await ensureLiveAgent(sid)

if (closing) throw closingError()

await prepareAgentForRequest(sid, sid)

if (closing) throw closingError()

...
```

不要求每一行都重复；但至少要覆盖 `ensureLiveAgent` 和 `prepareAgentForRequest` 这两个 await 之后的发送边界。

notification fault 会向上传播给 router observer，再由 router 的 `.catch(() => {})` 吞掉，因此这里**应当 reject，而不是静默 return**。

这样职责保持清楚：

```text
live glue：明确报告“关闭中，不能投递”
router observer：把它降级为 best-effort liveness failure
durable work：完全不受影响
```

---

# 4. 修复 B：Stop 优先，busy path 使用 `inject()`

## 4.1 当前代码

`packages/runtime/src/plugin/live/agent-bindings.mjs`

当前：

```js
if (handle.agent.status === 'idle') {
  handle.agent.followup(message)
} else {
  handle.agent.steer(message)
}
```

修改为：

```js
if (handle.agent.status === 'idle') {
  handle.agent.followup(message)
} else {
  handle.agent.inject(message)
}
```

---

## 4.2 为什么必须这样改

DSH v0.1.5-rc.2 中：

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

其中 `steer()` 是 waking send。

如果当前 turn 已被用户 Stop，但 Agent 尚处于 cancelled-converging 状态：

```ts
const wakingAfterAbort =
  wakeup &&
  this.phase.kind !== 'idle' &&
  this.phase.abort.signal.aborted

const resolvedTarget =
  wakingAfterAbort ? 'next-turn' : target
```

此时 `steer()` 会被自动重定向到 `next-turn` 并重新 wake driver。

也就是说：

```text
用户 Stop
    ↓
Leader 当前 turn abort
    ↓
member completion
    ↓
steer()
    ↓
DSH 重定向 next-turn
    ↓
cancelled turn 收敛
    ↓
Leader 又自动启动新 turn
```

这与本轮确定的产品语义冲突：

> **Stop 优先于自动 completion wake。**

改为 `inject()` 后：

- 正常 running turn：消息进入 `next-step`，当前 driver 自然消费；
- cancelled-converging turn：消息不会自动 wake 下一 turn；
- 用户 Stop 不会被 completion notification “洗成”新的模型请求。

---

## 4.3 接受一个已知 race

采用 `inject()` 后，需要明确接受 DSH background-job 机制已经记录过的一个极小窗口：

```text
读取 status = running
    ↓
driver 恰好完成最后一次 inbox 检查
    ↓
inject(next-step, wakeup=false)
    ↓
driver 进入 idle
```

此时 notification 可能暂时留在 inbox 中，直到下一次其他输入唤醒 Leader。

**不要在本 PR 为这个 race 再造调度器或 retry。**

原因：

1. durable settlement 已存在；
2. `team_collect` 是权威恢复路径；
3. notification 本身就是 best-effort；
4. 修掉这个 race 需要 DSH core 提供更强的 retirement/send 原语，超出插件修复范围。

把这一点写入注释/设计说明即可。

---

# 5. 修复 C：统一 delivery guarantee 的措辞

当前实现没有 notification durable intent，也没有 retry/replay。

所以当前真实保证是：

> **at-most-once best-effort wake attempt per observed async settlement**

不是：

> at-least-once delivery

请搜索 PR #21 新增代码中的：

```text
at-least-once
at-least-once / best-effort
best-effort redelivery
```

重点检查：

- `packages/runtime/work-completion-notification/types.ts`
- `packages/runtime/work-completion-notification/notification.ts`
- `packages/runtime/src/plugin/types.ts`
- `packages/runtime/src/plugin/live/agent-bindings.mjs`
- PR / plan / workflow 文档中本轮新写的 completion wake 描述

推荐统一词汇：

```text
at-most-once best-effort wake attempt
```

以及：

```text
The notification is a liveness hint only.
The durable settlement fact + team_collect are the recovery authority.
```

确定性 token-leading 文本仍然保留，因为：

- 同一 token 的文本应稳定；
- 未来如果增加 retry，天然可 dedupe；
- 外部原因造成重复输入时，Leader 可以识别。

但**不要因为文本可识别就声称当前系统提供 at-least-once delivery**。

---

# 6. 测试修改

本轮不扩大测试矩阵，只补两个关键 regression，并更新现有 G2。

---

## 6.1 修改 G2：busy Leader 从 steer 改为 inject

文件：

`packages/runtime/test/work-completion-notification-glue.test.ts`

当前 G2 断言：

```text
busy Leader → steer exactly once
followup 0
```

改成：

```text
busy Leader → inject exactly once
followup 0
steer 0
```

`t12a-live-bridge.mjs/.d.mts` 若目前没有 recording `inject`，补一个与 `followup` / `steer` 同等级的 test double 记录面。

建议 G2 名称：

```text
G2: a busy Leader gets ONE inject — no followup/steer and no whenIdle await
```

同时 G3 的 source attribution 仍然检查：

```text
source.kind === 'plugin'
source.plugin === 'dsh-agent-team'
```

---

## 6.2 新增 G7：Stop 优先

需要测试真实的语义，而不是只检查调用了 `inject`。

可有两种实现层级。

### 首选：在 live-bridge double 中加入 cancelled-converging 行为

若 test double 足以表达：

```text
status = running
abort signal = aborted
```

则证明 completion delivery：

- 调用 `inject`;
- 不调用 `followup`;
- 不调用 `steer`;
- 不触发新的 wake / next-turn。

### 如果 double 无法诚实模拟 DSH send semantics

则不要伪造一个假的“Stop 语义证明”。

可以把 G7 降为接口级 pin：

```text
running path calls inject, never steer
```

并在测试注释中引用 rc.2 的 Agent contract：

```text
inject = next-step + wakeup:false
steer  = next-step + wakeup:true
```

如果项目允许针对 `test-use @ fb2c4b9e` 做一个很小的 real-host probe，再证明：

```text
Leader turn cancelled
member settles
no automatic replacement turn is opened
```

即可。

不要为了这一条测试修改 DSH core。

---

## 6.3 新增 G8：close race 不得 resurrect Leader

这是本轮必须有的回归测试。

至少覆盖：

```text
1. root 已经 durable；
2. Leader 当前 live；
3. 开始 live.close()；
4. 在关闭窗口触发 completion delivery；
5. delivery rejects；
6. close 完成后：
   - hasLive(root) === false
   - 没有新的 agents.resume 成功留存
   - 没有 followup/inject/steer
```

更强的版本应覆盖真正危险的 race：

```text
1. ensureLiveAgent 开始 agents.resume；
2. resume Promise 暂停；
3. live.close() 设置 closing 并完成旧 handle 清理；
4. 释放 resume Promise；
5. ensureLiveAgent 发现 closing：
   - dispose 新 handle；
   - 不执行 liveAgents.set；
   - reject；
6. close 后 hasLive(root) === false。
```

这条测试比“delivery 在 close 后直接调用会拒绝”更重要，因为它证明异步 resume 不会穿透 close 快照。

---

# 7. Router observer 不要改

文件：

`packages/runtime/action-router/router.ts`

以下核心逻辑应保持：

```ts
const entry =
  scanWorkStatus(repositories, rootSessionId, [requestToken])[0]

if (
  entry === undefined ||
  entry.settledSequence === undefined
) {
  return
}
```

仍然以 durable settlement fact 为 terminal authority。

以及：

```ts
void task.then(observeCompletion, observeCompletion)
```

仍然需要同时观察 fulfilled / rejected：

- success settlement → notify；
- persisted failed member result → notify；
- `WORK_DELIVERY_FAILED`：fail-closed settlement 先 durable，随后 promise reject → 仍 notify；
- settlement durable write fault → scan 看不到 `settledSequence` → 不 notify。

不要把 promise outcome 变成 terminal authority。

---

# 8. Notification DTO / renderer 不要扩展

保持：

```ts
{
  rootSessionId,
  requestToken,
  instanceId,
  taskSummary?,
  targets: [{ kind: 'leader' }]
}
```

保持通知仅携带 metadata：

```text
[team-work-settled requestToken=...]

An asynchronous Team work unit has settled.
instanceId: ...
taskSummary: ...
requestToken: ...

Use team_collect with this requestToken to read the durable result.
```

不要把以下内容塞进 notification：

- member result body；
- transcript；
- member error full body；
- durable work record 全量 projection。

通知仍然只是 wake hint。

---

# 9. Production wiring 不要改架构

`packages/runtime/src/plugin/root.ts`

继续保留：

```text
createWorkCompletionNotifier
    ↓
live.deliverRootWorkCompletionNotification
    ↓
TeamRuntimeOptions.workCompletionNotification
```

不要改成：

- MessagingCoordinator；
- C1 `deliverRootControlNotification`；
- durable messaging intent；
- Remote event；
- UI event。

这条专用 live wake seam 是合理的。

---

# 10. 建议的实施顺序

按以下顺序执行，避免扩大问题面：

### Step 1 — 修 live lifecycle gate

修改：

```text
packages/runtime/src/plugin/live/agent-bindings.mjs
```

实现：

```text
closing state
→ close() 最先置位
→ ensureLiveAgent() 拒绝 closing
→ resume await 后二次检查并 dispose late handle
→ completion delivery 发送前检查 closing
```

先写/跑 close race test。

### Step 2 — Stop 优先

同一文件把：

```js
running -> steer
```

改为：

```js
running -> inject
```

更新 live bridge test double 与 G2/G7。

### Step 3 — 文档措辞

全局搜索本轮 completion wake 的：

```text
at-least-once
steer
running → steer
```

更新为：

```text
at-most-once best-effort
running → inject
Stop wins
```

注意不要误改 C1 或其他 subsystem 自己真正拥有的 at-least-once 语义。

### Step 4 — build / dist

按照仓库现有约束执行：

```bash
pnpm typecheck
pnpm build
pnpm build:composition
```

确保 committed dist 与源码同步。

---

# 11. 最小验证集合

本轮不需要重新发明完整测试计划，但至少执行：

```bash
# 新模块 / glue / observer targeted
pnpm vitest run \
  packages/runtime/test/work-completion-notification.test.ts \
  packages/runtime/test/work-completion-notification-glue.test.ts \
  packages/runtime/test/work-completion-async-wakeup.test.ts
```

然后运行仓库已有相关 build / artifact gate：

```bash
pnpm typecheck
pnpm build
pnpm build:composition
pnpm check:artifacts
```

再跑 p4t6 scanner 对应既有命令，确认 pin 没有意外漂移。

最后运行：

```text
tests/kits/work-completion-wakeup-smoke/
```

至少重复两次。

---

# 12. Real-host smoke 需要怎样更新

现有 L1–L4 大部分可以保留。

重点修改 L2 描述：

旧：

```text
第二个 completion 可能通过 steer / followup / merge 到达
```

新：

```text
第二个 completion 可能通过 inject 到当前 turn 的下一 step，
或在 Leader 已 idle 时通过新的 followup 到达；
多个通知仍可能在同一 step/turn 中被合并观察。
```

不要把 “必须出现独立 wake turn” 写成验收条件。

新增一个很窄的 Stop regression 场景只有在 smoke kit 容易可靠实现时才做；若需要大量 mock hack，则保留为 unit/live-glue regression 即可。

teardown race 以 deterministic unit/live-glue test 为主，不建议依赖 real-host 时序碰撞来证明。

---

# 13. 验收标准

修复完成后必须满足：

## A. Durable work 语义

- async work durable settlement 判据不变；
- success / failed / delivery-failed terminal work 仍可被 `team_collect` 读取；
- settlement fault 不产生假 completion；
- sync work 仍无独立 completion notification。

## B. Stop 优先

- idle Leader：completion → `followup`;
- normal running Leader：completion → `inject`;
- running path 不再调用 `steer`;
- cancelled-converging Leader 不因 completion 自动启动替代 turn。

## C. Teardown

- `close()` 一旦开始，不再允许成功创建/resume 新 live handle；
- close 与 `agents.resume()` 并发时，late-resumed handle 被立即 dispose，不能写回 `liveAgents`;
- completion notification 在 closing 状态拒绝；
- notification failure 不改变 durable work settlement；
- close 完成后 root 不残留 live handle。

## D. Delivery guarantee

文档统一为：

```text
at-most-once best-effort wake attempt
```

并明确：

```text
durable settlement + team_collect = recovery authority
```

## E. 范围控制

确认没有：

- TeamDomain schema change；
- Blueprint schema change；
- DSH core patch；
- retry/scheduler/ledger；
- Remote/UI 改动；
- notification promise 进入 `inFlightDetachedWork`。

---

# 14. 建议提交结构

可以只做一个修复提交，也可以拆为两个。推荐：

```text
fix(runtime): make work-completion wake stop- and teardown-safe
```

内容：

- live lifecycle gate；
- `running -> inject`；
- G2/G7/G8 tests；
- 文档措辞更新；
- dist refresh。

若希望代码与文档分开：

```text
fix(runtime): make completion wake stop- and teardown-safe
docs(runtime): clarify completion wake delivery semantics
```

不需要新 PR；直接 push 到 PR #21 的现有 branch：

```text
feat/work-completion-wakeup
```

---

# 15. 给执行 Agent 的最终约束

执行时请遵守：

1. **先复现/写 regression，再改实现**，尤其是 teardown late-resume race。
2. 不把修复扩大为 notification subsystem 重构。
3. 不为了消除 `inject` 的 retirement microtask race 修改 DSH core。
4. 不新增 durable notification 状态。
5. 不重新设计 Team autonomy budget。
6. 若发现必须修改本文明确列为“不要改”的 authority / durability 路径才能完成修复，停止扩展实现，并把冲突作为新的 review finding 汇报。
7. 最终汇报必须给出：
   - 实际修改文件；
   - G2/G7/G8 的结果；
   - targeted tests；
   - typecheck/build/artifact gate；
   - real-host smoke；
   - 是否仍存在新增 baseline failure；
   - zero-core 证明。

---

## 预期最终语义

```text
async member work
    ↓
durable terminal settlement
    ↓
router observes terminal fact
    ↓
one best-effort wake attempt
    │
    ├─ plugin closing
    │      └─ drop/reject wake; never resurrect Agent
    │
    ├─ Leader idle
    │      └─ followup → new turn
    │
    └─ Leader running
           └─ inject → current turn next-step
                  │
                  └─ if user Stop/cancel wins:
                         no automatic replacement turn

Leader eventually:
team_collect(requestToken)
    ↓
durable result
```

这就是本轮修复应当收敛到的最终边界。
