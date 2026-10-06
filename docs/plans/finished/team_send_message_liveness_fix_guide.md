# `team_send_message` 工作流卡死修复指引

> 仓库：`ArmourPiercer1/dsh-agent-team`  
> 目标基线：当前 `master`（本指引形成时最新已合并 PR #21，HEAD 线含 `d63cb714`）  
> 适用宿主基线：DSH `0.1.5-rc.2`，`tests/deepseek-harness-test-use @ fb2c4b9e69`  
> 核心原则：**CORE PATCH BUDGET = 0**。只修改插件仓库，不修改 upstream DSH。

---

## 0. 执行前必读与边界

开始修改前，先按仓库规则读取：

1. `AGENTS.md`
2. `docs/ROUTER_RULES.md`
3. `docs/TEST_METHODS.md`
4. `dev/agent-workflow/graph.yaml`
5. `dev/agent-workflow/SESSION_ROUTER_LOG.md` 最近相关条目

本任务是一个**有界 liveness 修复**，不是重新设计 Team messaging。

### 本任务明确允许解决的问题

当前 `team_send_message` 在发送消息后，会等待接收方 Agent 整个 turn 完成，导致：

- Leader 的 `team_send_message` 长时间不返回；
- 接收方长推理 / 长工具调用 / approval 等都会把发送方一起挂住；
- 如果接收方在该 turn 中再通过 `team_send_message` 回复发送方，可形成跨 Agent 循环等待：
  - Leader 等 Member `whenIdle()`
  - Member 又等 Leader `whenIdle()`
  - 双方永久等待。

### 本任务明确不做

不要借本任务顺手实现以下内容：

- 不新增 `team_send_message async:true`
- 不新增 scheduler / retry queue / background worker
- 不修改 TeamDomain schema
- 不修改 Blueprint schema
- 不修改 Remote/UI 协议，除非测试证明产品接口必须同步
- 不修改 DSH core
- 不修改 work-completion wake-up 的 steer/followup 策略
- 不修改 `team_delegate` / `team_follow_up` 默认同步语义
- 不把普通 message 改成 `steer` 或 `inject`
- 不重构整个 MessagingCoordinator
- 不重新定义 at-least-once / exactly-once 总体模型

---

# 1. 已确认根因

当前调用链：

```text
Leader model turn
  ↓
team_send_message
  ↓
packages/tools/src/tools.ts
  ↓
await messaging.sendTeamMessage(...)
  ↓
packages/runtime/messaging/coordinator.ts
  ↓
sendTeamMessage()
  ↓
deliverOne()
  ↓
await submitDeliveryInput(...)
  ↓
await sessionInput.submitAttributedInput(...)
  ↓
packages/runtime/src/plugin/live/agent-bindings.mjs
  ↓
handle.agent.followup(message)
  ↓
await handle.agent.whenIdle()
```

关键问题在生产版 `SessionInputPort`。

当前 `packages/runtime/src/plugin/live/agent-bindings.mjs` 的 messaging session input 逻辑大致为：

```js
const sessionInput = {
  async submitAttributedInput(input) {
    const handle = await ensureLiveAgent(String(input.sessionId))
    await prepareAgentForRequest(...)

    const message = createUserMessage(...)

    handle.agent.followup(message)

    try {
      await handle.agent.whenIdle()
    } catch (error) {
      ...
      throw error
    }
  },
}
```

因此当前实际语义是：

> `team_send_message` 成功  
> = 接收方收到消息  
> + 接收方完整执行完这一轮  
> + 接收方重新进入 idle。

这不是普通 messaging 应有的完成边界。

仓库源码自身注释已经把 `followup` 描述为 **inbox acceptance commit point**。  
刚合并的 work-completion wake-up 也已经采用：

```text
Success boundary = acceptance
NO whenIdle
NO ensureMaterialized
```

所以这次修复应当让 `team_send_message` 与该 liveness 原则一致。

---

# 2. 正确目标语义

修复后：

```text
team_send_message
  ↓
durable team-coordination-recorded intent
  ↓
resolve fresh delivery target / relay plan
  ↓
recipient session accepts attributed input
  ↓
durable team-message-delivered confirmation
  ↓
tool returns
```

接收方自己的模型 turn：

```text
recipient followup accepted
  ↓
recipient model turn runs independently
  ↓
may call tools / send messages / wait approval / continue work
```

**发送方不再等待接收方 turn 完成。**

---

# 3. 必须保持不变的其他 primitive

这一点是本任务最重要的范围约束。

## 3.1 `team_send_message`

成功边界：

```text
recipient input accepted
```

不等待 recipient idle。

---

## 3.2 同步 `team_delegate` / `team_follow_up`

成功边界仍然应为：

```text
work admitted
→ delivered to member
→ member turn completed
→ result read back
→ durable settlement
→ result returned to Leader
```

因此 work-delivery 路径中的：

```js
handle.agent.followup(...)
await handle.agent.whenIdle()
await sessionPersistence.ensureMaterialized(...)
```

**不要因为本任务删除。**

---

## 3.3 异步 delegate/follow-up

继续保持：

```text
durable admission committed
→ tool returns
→ member work detached
→ later team_collect
```

---

## 3.4 work-completion wake-up

继续保持 PR #21 当前语义：

```text
idle Leader → followup
running Leader → steer
success boundary = acceptance
NO whenIdle
```

不要修改。

---

# 4. 推荐修改范围

优先把产品代码修改控制在以下文件。

## 4.1 必改：`packages/runtime/src/plugin/live/agent-bindings.mjs`

定位 messaging 的：

```js
const sessionInput = {
  async submitAttributedInput(input) {
    ...
  },
}
```

当前逻辑：

```js
handle.agent.followup(message)

try {
  await handle.agent.whenIdle()
} catch (error) {
  const note = ...
  observations.push(note)
  throw error
}
```

目标逻辑：

```js
handle.agent.followup(message)
// success boundary = inbox acceptance.
// The recipient turn runs independently.
// Do NOT await whenIdle here.
```

注意：

- 保留 `ensureLiveAgent`
- 保留 `prepareAgentForRequest`
- 保留 attributed message 构造
- 保留 `followup`
- 删除 messaging path 上的 `whenIdle`
- 不增加 `ensureMaterialized`
- 不换成 `steer`
- 不换成 `inject`

### 关于 `followup()` 异常

如果 `handle.agent.followup(message)` 本身同步 throw，则应继续向上传播：

```text
SessionInputPort reject
→ MessagingCoordinator maps to MESSAGING_DELIVERY_FAILED
→ durable intent remains pending
→ no team-message-delivered confirmation
```

不要吞掉该异常。

---

## 4.2 建议同步修改：`packages/runtime/messaging/types.ts`

当前 `SessionInputPort` 文档应明确：

> `submitAttributedInput()` resolve 表示目标 Session 已接受该 ordinary attributed input。

并明确否定：

> 它不表示接收方 Agent 已完成对输入的模型处理。

建议写成类似：

```ts
/**
 * Submit one ordinary attributed input to a session.
 *
 * Success boundary: the target session/agent has accepted the input
 * into its normal input path. The recipient turn may still be running
 * after this Promise resolves.
 *
 * A rejection means the input was not accepted.
 */
submitAttributedInput(input: AttributedSessionInput): Promise<void>
```

不要改接口形状。

---

## 4.3 建议同步修改：`packages/runtime/messaging/coordinator.ts`

目前模块注释多处把 Phase B 描述成：

```text
recipient's ENTIRE model execution
```

修复后这已经不再成立。

必须修正文档，避免以后再次因为错误注释重引入 `whenIdle`。

Phase B 应描述成：

```text
recipient session input acceptance
```

并保留核心结构：

```text
Phase A: coordinator private chain held
Phase B: no coordinator chain held
Phase C: coordinator private chain re-acquired
```

**F3-C 的 private-chain split 仍然有效，不要回退。**

---

# 5. 为什么不能只在 tool 层“不要 await”

不要做这种修复：

```ts
ctx.options.messaging.sendTeamMessage(...)
return ...
```

或 fire-and-forget。

原因：

`sendTeamMessage()` 仍负责：

1. durable intent；
2. live input acceptance；
3. `team-message-delivered` confirmation；
4. typed failure / recovery correlation。

tool 应该等待 messaging coordinator 完成这三个阶段。

真正错误的只是 Phase B 把：

```text
input acceptance
```

扩大成了：

```text
recipient turn completion
```

所以必须修在 `SessionInputPort` 成功边界，不是在 tool 层绕开 coordinator。

---

# 6. 为什么不能删除 MessagingCoordinator 的 Phase C

不要因为“希望快速返回”而把 `team-message-delivered` confirmation 改成后台写。

当前设计：

```text
intent
→ accepted input
→ confirmation
→ tool return
```

是合理的。

`team_send_message` 返回 `status: delivered` 时，应当已经具有 durable confirmation。

本任务只把：

```text
accepted input + recipient full turn
```

缩回：

```text
accepted input
```

不要改变 durable confirmation 的同步性。

---

# 7. 必须新增的回归测试

现有 `f3c-messaging-sibling.test.ts` 不足以覆盖本 bug。

它主要证明：

> recipient turn 中 nested `team_send_message` 可以重新进入 MessagingCoordinator，而不会被 coordinator 自己的 private lock 卡住。

这解决的是 **lock-cycle**。

本次问题是：

> Agent A 等 Agent B `whenIdle()`，Agent B 又等 Agent A `whenIdle()`。

这是 **agent-lifecycle wait-cycle**。

需要新增专门测试。

---

## T1：Messaging acceptance boundary

构造 live bridge double：

- `followup(message)` 正常记录消息；
- `whenIdle()`：
  - 要么永远 pending；
  - 要么设置调用计数并抛错，确保任何调用都立即暴露。

执行：

```text
sessionInput.submitAttributedInput(...)
```

断言：

```text
resolved == true
followupCalls == 1
whenIdleCalls == 0
```

这是本次修复最核心的 regression pin。

---

## T2：发送方不等待长运行 recipient

模拟：

```text
Leader → team_send_message(Member)
Member 接受 input 后保持 running
```

断言：

```text
team_send_message resolves
status == delivered
team-message-delivered fact exists
Member 仍可保持 running
```

也就是说：

> recipient 是否 idle 不应影响 sender tool completion。

---

## T3：双 Agent reply cycle

尽量使用比纯 coordinator fake 更接近 Agent bridge 的测试。

场景：

```text
Leader turn:
  team_send_message(Member)

Member message-triggered turn:
  team_send_message(Leader)
```

断言：

```text
Leader send resolves
Member send resolves
two coordination intents exist
two confirmations exist
no permanent wait
```

测试重点不是 private coordinator lock，而是：

```text
sending Agent tool completion does not depend on receiving Agent reaching idle
```

---

## T4：input acceptance failure 仍 fail closed

令：

```js
handle.agent.followup = () => {
  throw new Error('controlled acceptance failure')
}
```

断言：

```text
team-coordination-recorded intent exists
team-message-delivered confirmation does NOT exist
send rejects/maps to MESSAGING_DELIVERY_FAILED
pending delivery remains recoverable
```

确保移除 `whenIdle` 没有把真实 acceptance failure 吞掉。

---

# 8. 现有测试必须继续通过的关键语义

至少重点重跑：

```text
packages/runtime/test/f3c-messaging-sibling.test.ts
```

它保证：

- Phase B 不持 coordinator private chain；
- nested messaging re-entry 不 self-deadlock；
- confirmation convergence 保持；
- recovery exactly-once-on-ledger / at-least-once-input 语义没有被破坏。

还应重跑所有与以下模块相关的 tests：

```text
runtime messaging
agent live bridge / agent bindings
team tools
T12 messaging / remote member.send
work-completion wake-up glue
```

尤其不要让本次修复误伤 PR #21 的 wake-up 逻辑。

---

# 9. 一个推荐的最小实现形状

概念上应接近：

```diff
 const sessionInput = {
   async submitAttributedInput(input) {
     const handle = await ensureLiveAgent(String(input.sessionId))

     await prepareAgentForRequest(
       String(input.sessionId),
       teamRootOfSession(input.sessionId),
     )

     const message = createUserMessage({
       content: [{ type: 'text', text: input.text }],
       source: { kind: 'user' },
     })

     handle.agent.followup(message)
-
-    try {
-      await handle.agent.whenIdle()
-    } catch (error) {
-      const note = `...`
-      observations.push(note)
-      throw error
-    }
+    // Messaging completion boundary = input acceptance.
+    // The recipient turn executes independently; waiting for whenIdle here
+    // couples the sender tool lifetime to the recipient turn and can create
+    // a Leader ↔ Member lifecycle wait cycle.
   },
 }
```

这只是设计形状，不要求逐字照抄。  
应根据当前代码和 lint/style 做最小补丁。

---

# 10. 不要误改的相邻代码

`agent-bindings.mjs` 里有多个：

```js
handle.agent.followup(message)
await handle.agent.whenIdle()
```

不能全局替换。

至少以下几类仍可能合理等待 `whenIdle`：

- `workDelivery.deliver`
- root initial-work delivery
- handoff/root context 需要明确完成语义的路径
- lifecycle drain/quiescence

本任务只针对：

```text
MessagingCoordinator 的 SessionInputPort
```

也就是 `const sessionInput = { submitAttributedInput(...) }`。

---

# 11. 与现有 F3-C 修复的关系

不要撤销 F3-C。

F3-C 解决的是：

```text
Coordinator private lock
  ↓
recipient turn
  ↓
nested send
  ↓
same private lock
```

修复方式是：

```text
Phase A: lock
Phase B: unlocked
Phase C: lock
```

这是正确的。

本次修复解决的是另一层：

```text
Leader Agent turn
  ↓
wait Member.whenIdle

Member Agent turn
  ↓
wait Leader.whenIdle
```

因此两者应同时存在：

1. **coordinator 不跨 recipient execution 持锁**；
2. **sender 不等待 recipient execution 完成**。

---

# 12. 测试与门禁

完成 focused tests 后，按仓库现行要求执行至少：

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm build:composition
pnpm check:artifacts
```

如仓库当前 lint/gate SOP 要求，再执行：

```bash
pnpm lint
```

以及当前规定的 real-host / smoke kit。

注意：

- 测试 runtime 必须使用 `tests/deepseek-harness-test-use`
- 当前基线 = `0.1.5-rc.2 @ fb2c4b9e69`
- 不要使用旧的 `0.1.2-rc.1` 作为本任务验收依据
- 不触碰稳定开发实例 `:3080`
- 按 `docs/TEST_METHODS.md` 使用测试端口和 `tests/homes/<world>`

---

# 13. Real-host 最小复现 / 验收场景

至少做一次真实 host 验证。

## 场景 A：Leader 发消息给 Member

Leader：

```text
team_send_message(Member, "please inspect X and reply")
```

预期：

1. `team_send_message` 很快得到 `status: delivered`；
2. Leader 不需要等 Member 推理结束；
3. Member 随后独立处理消息。

---

## 场景 B：Member 回消息给 Leader

Member 收到 Leader message 后调用：

```text
team_send_message(Leader, "ack / result / question")
```

预期：

- Member 的 send 同样快速返回；
- Leader / Member 不形成相互 `whenIdle` 等待；
- 两边可以继续自己的 turn。

---

## 场景 C：Recipient 故意长运行

让 Member 在收到消息后执行明显较长的工作。

预期：

```text
Leader 的 team_send_message 已经完成
Member 仍处于 running
```

这是判断本 bug 是否真正关闭的关键场景。

---

# 14. 验收标准

本任务只有在以下全部成立时才算完成。

### 产品行为

- [ ] `team_send_message` 不再等待 recipient `whenIdle`
- [ ] sender tool completion boundary = recipient input acceptance
- [ ] recipient turn 可以在 tool 返回后继续独立运行
- [ ] Leader→Member→Leader reply 不再产生 lifecycle wait cycle

### Durable semantics

- [ ] `team-coordination-recorded` 仍先于 delivery
- [ ] acceptance 成功后仍同步写 `team-message-delivered`
- [ ] acceptance failure 时 intent 保持 pending
- [ ] recovery 语义不变
- [ ] confirmation convergence 不变

### 不回归

- [ ] F3-C private-chain tests 继续通过
- [ ] sync delegate/follow-up 仍等待 Member work completion
- [ ] async delegate/follow-up 语义不变
- [ ] PR #21 work-completion wake-up 语义不变
- [ ] 没有新增 scheduler/retry/background worker
- [ ] 没有修改 DSH core

### 测试

- [ ] acceptance-boundary test
- [ ] long-running recipient test
- [ ] two-Agent reply-cycle test
- [ ] acceptance-failure test
- [ ] focused messaging/live-bridge tests green
- [ ] full repository gate 无新增 deterministic failure
- [ ] build/composition/artifacts fresh

---

# 15. 建议提交信息

建议单独一个有界修复提交，例如：

```text
fix(runtime): make team messaging complete on input acceptance
```

提交说明应明确：

```text
- team_send_message no longer waits for the recipient Agent to become idle
- SessionInputPort success boundary is ordinary input acceptance
- durable intent + delivered confirmation semantics are unchanged
- sync delegate/follow-up completion semantics are unchanged
- closes the cross-Agent lifecycle wait cycle:
  Leader waits Member idle ↔ Member waits Leader idle
```

---

# 16. 最终设计判据

如果实现过程中出现设计分歧，用下面这一条裁决：

> **Messaging 是 input delivery primitive，不是 work execution primitive。**

因此：

```text
team_send_message:
  accepted → return

team_delegate / team_follow_up (sync):
  work completed → return
```

不要让这两个 completion boundary 再次混在一起。
