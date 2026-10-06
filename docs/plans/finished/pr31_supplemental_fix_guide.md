# PR #31 补充修复指导：0.1.7-rc.1 Team Restart Recovery 收口轮

> 适用仓库：`ArmourPiercer1/dsh-agent-team`  
> 目标 PR：`#31 restart-017rc1`  
> 审查基线：PR head `449e1fce44c6a2f1530278b14840d3e12ea0a857`  
> Base：`master @ 7c2361058f6372e1cee1a038ce2917ae920d9b76`  
> DSH host baseline：`0.1.7-rc.1 @ 46a7f68b0922371ce7144b668b90e377d8e799f4`  
> 本轮性质：**补充修复，不推翻 C1 架构，不切换到 B+ SessionController replacement，除非 hard gate 证明当前 public seam 无法闭合。**

---

## 0. 本轮目标

PR #31 的主体方向可以保留：

- 使用 DSH 0.1.7-rc.1 awaited-serial `agent/created` 作为 Team Session activation fence；
- 使用 exact-Agent-object 的 `agent/disposed` 作为 rollback/writer-release barrier；
- 使用 public `SessionPersistence.stat()` 作为 durable existence authority；
- 保持 stock `SessionController`、`AgentLoop`、Session persistence，不做 core patch；
- 保留 `team.prepareOrdinaryOpen` 的 one-shot permit 语义；
- 保留普通非-Team Session upstream-equivalent 行为。

但在合并前必须补齐以下三个 **P1 blocker**：

1. **Team activation 缺少 per-session single-flight，且 `ownedDepth` 不是 causal ownership。**
2. **ownership resolver 尚未 ready 时 fence 直接放行，存在 startup race window。**
3. **同一页面经历 ordinary veto 后，单击“以 Team 模式打开 / 回到 Leader”仍不能直接恢复 composer；当前真实浏览器证据依赖“切走再切回来”。**

并补两个 P2 正确性问题：

4. completed rollback record 被过早删除，存在 recovery TOCTOU。
5. writer-conflict timeout 当前可能被分成两个完整窗口，最坏约 `2 × timeoutMs`。

以及一个较小 contract 问题：

6. `prepareOrdinaryOpen` 的 root wiring 在 armer 缺席时仍可能提供一个“成功 no-op” closure。

---

# 1. 目标代码架构

## 1.1 最终 activation ownership 模型

目标不是 eager-resume 全部 Team Session，而是保留当前 demand-driven activation，同时让每个 Team-owned Session 在进程内满足：

```text
                           ┌──────────────────────────────┐
                           │ Team Session ownership       │
                           │ durable classifier           │
                           │ resolveOwningTeamRoot(...)   │
                           └──────────────┬───────────────┘
                                          │
                                          ▼
              ┌─────────────────────────────────────────────┐
              │ TeamSessionActivationFence                  │
              │                                             │
              │ 1. ownershipReady barrier                   │
              │ 2. exact Team activation generation claim   │
              │ 3. foreign activation veto                  │
              │ 4. exact-generation rollback completion     │
              │ 5. completed rollback epoch/tombstone        │
              │ 6. one-shot ordinary permit                 │
              └─────────────────┬───────────────────────────┘
                                │
                                ▼
              ┌─────────────────────────────────────────────┐
              │ Team live activation coordinator            │
              │                                             │
              │ per-session single-flight                   │
              │ Map<sid, Promise<AgentHandle>>              │
              └─────────────────┬───────────────────────────┘
                                │
                      exactly one create/resume
                                │
                                ▼
                         stock ctx.agents
                                │
                                ▼
                         stock AgentLoop
                                │
                                ▼
                    stock SessionPersistence
```

核心 invariant：

### INV-1 — Durable ownership authority 唯一

Team root / member 的归属继续只由：

```ts
resolveOwningTeamRoot(domain, bootRootSid, sessionId)
```

决定。

禁止在其他模块重新实现第二套 ownership traversal。

---

### INV-2 — Team-side activation per SID 必须 single-flight

对于同一个 SessionId：

```text
ensureLiveAgent()
childFactory resume
createRootAgent()
boot resume
remote ensureRootLive
message/work delivery lazy ensure
```

无论多少调用并发，最终只能有：

```text
ONE in-flight Team create/resume
ONE surviving AgentHandle
```

其余调用必须 await 同一个 Promise，而不是各自进入 `ctx.agents.resume()`。

---

### INV-3 — Team-owned generation 用 exact object 识别，不用时间窗口识别

当前：

```ts
ownedDepthBySession.get(sid) > 0
```

只能说明“某个 Team activation 正在这个时间窗口里”，不能证明 `agent/created` 对应的 Agent 就是 Team 发起的那个 generation。

目标：

```text
Team resume/create
    ↓
AgentSetup(agentCtx, setupAgent)
    ↓
activationFence.claimOwnedGeneration(sid, setupAgent)
    ↓
agent/created({ agent: sameObject })
    ↓
exact match → Team-owned PASS
```

foreign ordinary activation 即便碰巧发生在另一个 Team activation 的时间窗口中，只要 Agent object 不匹配，就必须被 veto。

`ownedDepth` 可以保留作 nested lifetime/reference bookkeeping，但**不能继续作为 PASS authority**。

---

### INV-4 — ownership 未 ready 时不能把 Team Session 当普通 Session 放行

fence listener 可以在 domain open 前注册，但：

```text
ownership resolver not bound
```

必须解释成：

```text
classification pending
```

而不是：

```text
unmanaged
```

因此 `agent/created` 在 resolver 未 ready 时应：

```text
await ownershipReady
→ 再 classify
```

普通 Session 会在 ready 后判为 unmanaged 并继续；Team Session 会被正确 veto。

---

### INV-5 — rollback completion 必须可被“事后观察”

Team resume 可能在 ordinary activation 已经：

```text
veto
→ disposed
→ writer released
```

之后才拿到 `SessionAlreadyOwnedError`。

因此 fence 不能只保存“当前 pending rollback record”；还要能回答：

> 从本次 Team resume 尝试开始以后，是否已经发生过一个由 fence 拦截且 exact-generation disposed 完成的 foreign rollback？

推荐使用 per-SID monotonic epoch，而不是长期保留 Agent 对象：

```ts
interface RollbackState {
  current?: {
    agent: TeamActivationAgent
    epoch: number
    disposed: Deferred<void>
  }
  completedEpoch: number
}
```

Team resume 前读取：

```ts
const baseline = fence.rollbackEpoch(sid)
```

发生 writer-held 后：

```ts
await fence.recoverWriterConflict(sid, {
  afterEpoch: baseline,
  deadline,
})
```

只要：

```text
completedEpoch > baseline
```

即可证明本次冲突后已有 fence-confirmed foreign rollback 完成。

---

### INV-6 — timeout 是一个 absolute deadline

不得：

```text
10 s 等 record
+ 10 s 等 dispose
```

目标：

```ts
const deadline = now() + timeoutMs
```

两个阶段都只消费 `deadline - now()`。

---

### INV-7 — same-page Team takeover 必须直接恢复 Conversation generation

最终产品 hard gate：

```text
backend restart
→ 当前 page 打开 cold Team root
→ ordinary activation 被 fence veto
→ 页面出现 Session unavailable
→ 用户点击一次 “以 Team 模式打开 / 回到 Leader”
→ 不 reload
→ 不切到其他 Session
→ composer 立即 usable
→ prompt 成功
→ prompt 跑在 Team leader surface
```

“切走 New Session 再切回来”只能作为诊断手段，不能成为最终 acceptance path。

---

# 2. 需要修改的模块与接线

## 2.1 `packages/runtime/src/plugin/team-session-activation.ts`

这是本轮主要修改点。

### A. 增加 ownership-ready barrier

当前：

```ts
let ownershipResolver:
  ((sessionId: string) => string | undefined) | undefined
```

以及：

```ts
const owner = ownershipResolver?.(sid)
if (owner === undefined) return
```

需要拆分“resolver 未绑定”与“resolver 已绑定但 Session unmanaged”两个状态。

建议：

```ts
const ownershipReady = createDeferred<void>()
let ownershipResolver:
  ((sessionId: string) => string | undefined) | undefined

bindOwnershipResolver(resolver) {
  ownershipResolver = resolver
  ownershipReady.resolve()
}
```

`beforeAgentCreated()`：

```ts
if (closed) return

if (ownershipResolver === undefined) {
  await Promise.race([
    ownershipReady.promise,
    closedDeferred.promise,
  ])
  if (closed) return
}

const resolver = ownershipResolver
if (resolver === undefined) {
  throw new TeamSessionActivationClosedError()
}

const owner = resolver(sid)
if (owner === undefined) return
```

注意：

- resolver ready 前的 ordinary activation 允许“等待”，不能被误 veto；
- resolver ready 后 ordinary Session 判为 unmanaged，正常 PASS；
- resolver ready 前 Team activation 也应等待 classification，除非 exact Team generation claim 已经足以直接证明是自己的 generation；
- `close()` 必须 settle `ownershipReady` 等待者，不能遗留 Promise。

---

### B. 增加 exact Team generation claim

新增 fence API，例如：

```ts
claimOwnedGeneration(
  sessionId: string,
  agent: TeamActivationAgent,
): void
```

以及内部：

```ts
const ownedGenerationBySession =
  new Map<string, TeamActivationAgent>()
```

Team-side `AgentSetup` 在拿到真实 `setupAgent` 后调用：

```ts
claimOwnedGeneration(sid, setupAgent)
```

`beforeAgentCreated()` 判断顺序建议：

```text
1. closed → pass/teardown
2. ownership ready / classify
3. unmanaged → pass
4. exact claimed Team generation → consume claim + pass
5. valid ordinary permit → consume permit + pass
6. foreign Team-managed activation → rollback record + veto
```

不要再使用：

```ts
ownedDepth > 0
```

作为最终 PASS authority。

`ownedDepth` 若保留，只用于：

- nested runOwned lifetime；
- 防止 claim API 被 Team glue 外部滥用；
- close/in-flight accounting。

---

### C. rollback state 改为 epoch/tombstone 模型

当前：

```ts
foreignRollbacks: Map<sid, RollbackRecord>
```

以及 exact disposer 后立即：

```ts
foreignRollbacks.delete(sid)
```

需要改成可事后证明 completion 的状态。

推荐：

```ts
interface SessionRollbackState {
  nextEpoch: number
  completedEpoch: number
  current?: RollbackRecord & { epoch: number }
}
```

foreign veto：

```ts
const epoch = ++state.nextEpoch
state.current = { agent, disposed, epoch }
```

exact dispose：

```ts
if (state.current?.agent !== agent) return

state.completedEpoch =
  Math.max(state.completedEpoch, state.current.epoch)

state.current.disposed.resolve()
state.current = undefined
notify...
```

不要无限保存 Agent object；只保留 completed epoch 即可。

---

### D. recovery 改为“after epoch + deadline”

新增：

```ts
getRollbackEpoch(sessionId: string): number
```

或：

```ts
snapshotRollbackState(sessionId): {
  completedEpoch: number
  currentEpoch?: number
}
```

`recoverWriterConflict()` 变成：

```ts
recoverWriterConflict(
  sessionId,
  {
    afterEpoch,
    deadlineMs,
  },
): Promise<boolean>
```

满足：

```text
completedEpoch > afterEpoch
```

时立即返回 true。

否则等待：

```text
新的 rollback record / exact dispose / close / deadline
```

所有等待共享同一个 absolute deadline。

---

### E. close semantics 补齐

`close()` 还需要：

- settle ownershipReady；
- settle rollback record waiters；
- settle exact disposed barrier；
- clear generation claims；
- clear ordinary permits；
- clear owned-depth map；
- 所有 timeout/event waiter 必须结束。

---

## 2.2 `packages/runtime/src/plugin/live/agent-bindings.mjs`

第二个主要修改点。

### A. 增加 per-session Team activation single-flight

在 closure state 增加：

```js
/** @type {Map<string, Promise<object>>} */
const activationInFlight = new Map()
```

建议抽象：

```js
async function singleFlightTeamActivation(sessionId, operation) {
  const sid = String(sessionId)
  const existing = activationInFlight.get(sid)
  if (existing !== undefined) return await existing

  const promise = (async () => {
    return await operation()
  })()

  activationInFlight.set(sid, promise)
  try {
    return await promise
  } finally {
    if (activationInFlight.get(sid) === promise) {
      activationInFlight.delete(sid)
    }
  }
}
```

注意：必须是“同一个 Promise identity”，避免早完成旧请求删掉后来请求的 map entry。

---

### B. `ensureLiveAgent()` 整体纳入 single-flight

不要只 single-flight `resumeTeamAgent()`。

需要覆盖：

```text
liveAgents lookup
awaitRollback
foreignLive check
durable exists
owning-root resolve
rollback epoch snapshot
resume
writer conflict recovery
one retry
liveAgents.set
```

否则两个调用仍可能在 `liveAgents miss` 后分别进入前置流程。

目标形状：

```js
async function ensureLiveAgent(sessionId) {
  const sid = String(sessionId)

  if (closing) ...
  const existing = liveAgents.get(sid)
  if (existing !== undefined) return existing

  return await singleFlightTeamActivation(
    sid,
    () => ensureLiveAgentOnce(sid),
  )
}
```

在 `ensureLiveAgentOnce()` 开头再次：

```js
const existing = liveAgents.get(sid)
if (existing !== undefined) return existing
```

解决：

```text
caller B 在等待 single-flight 前
caller A 已完成
```

的二次检查。

---

### C. create/resume wrappers 接入 exact generation claim

当前：

```js
runOwnedActivation(sid, () => agents.resume(...))
```

改成：

```js
runOwnedActivation(
  sid,
  () => agents.resume({
    ...,
    setup: teamOwnedSetup(sid, originalSetup),
  }),
)
```

`teamOwnedSetup`：

```js
function teamOwnedSetup(sessionId, setup) {
  return async (agentCtx, setupAgent) => {
    activationFence?.claimOwnedGeneration?.(
      String(sessionId),
      setupAgent,
    )
    return await setup(agentCtx, setupAgent)
  }
}
```

要保证：

- claim 在 `agent/created` 前一定发生；
- setup 失败时 claim 不泄漏；
- `agent/created` PASS 后 claim 消费；
- setup rejection / create rejection / close 都能 cleanup。

如果 upstream 生命周期证明 setup 在 `agent/created` 前执行，这是优先方案；若 characterization 表明顺序相反，则需要在 `runOwned` 内通过 upstream 可观察 generation 对象建立 claim，不能退回 time-window PASS。

---

### D. writer conflict recovery 使用 baseline epoch

在第一次 `resume()` 前：

```js
const rollbackBaseline =
  activationFence?.getRollbackEpoch?.(sid) ?? 0
```

writer-held catch：

```js
const deadlineMs = Date.now() + WRITER_HANDOFF_TIMEOUT_MS

const recoverable =
  await activationFence.recoverWriterConflict(
    sid,
    {
      afterEpoch: rollbackBaseline,
      deadlineMs,
    },
  )
```

只有 true 时允许 exactly-one retry。

---

### E. single-flight 要覆盖其他 Team activation 入口

检查以下所有调用路径：

```text
boot root create
boot root resume
seed member create
boot member resume
childFactory create
childFactory durable resume
createRootAgent
ensureLiveAgent
```

要求：

- 同 SID 的 create/resume 不能并发；
- 不同 SID 仍允许并发；
- 不要全局锁。

可以把 `createTeamAgent` / `resumeTeamAgent` 本身放入更底层 per-SID coordinator，但要避免 `ensureLiveAgent()` 与它双重 single-flight 自己等待自己。推荐：

```text
高层：
ensureLiveAgent single-flight

低层：
createRootAgent / childFactory / boot
各自通过统一 activateTeamSession(sid, operation)
```

最终所有入口只经过一个 coordinator。

---

## 2.3 `packages/runtime/src/plugin/host.ts`

### A. ownership-ready 接线

listener 仍必须在 `apply()` 最前注册，这一点保持。

domain open 后：

```ts
activationFence.bindOwnershipResolver(...)
```

保持，但要保证：

- bind 之前 `agent/created` 不会被当 unmanaged 直接 PASS；
- bootstrap failure / row close 会释放等待中的 listener。

---

### B. 不要取消 `sessionPersistence.stat()` 修复

以下实现保持：

```ts
sessionPersistence.exists(sessionId)
→ ctx.get('sessionPersistence').stat(sessionId)
→ stat !== undefined
```

禁止恢复：

```text
DSH_HOME
session.vN.jsonl
readdirSync
path scanning
```

---

### C. production host 必须强制 fence API 完整

当前 GlueModule 的 `activationFence` surface 还是 optional / partial。

本轮建议：

- 测试/factory world 可以 optional；
- **production host 传入的 fence 必须满足完整 surface**；
- 缺失 `claimOwnedGeneration` / rollback epoch API 应在构造/boot 前 fail loud，而不是运行到 race 时才 undefined。

---

## 2.4 `packages/runtime/src/plugin/root.ts`

修复 `prepareOrdinaryOpen` 假成功问题。

当前语义类似：

```ts
prepareOrdinaryOpen: sid => {
  live.allowOrdinaryActivationOnce?.(sid)
}
```

目标：只有 armer 真存在才暴露 port。

建议在构造 options 时 conditional spread，或让 `root.prepareOrdinaryOpen` 自身在缺失时 throw typed internal wiring error。

推荐前者：

```ts
const prepareOrdinaryOpen =
  typeof live.allowOrdinaryActivationOnce === 'function'
    ? (sid: string) => {
        live.allowOrdinaryActivationOnce!(sid)
      }
    : undefined
```

然后 S6 options 只在非 `undefined` 时传入。

这样：

```text
fence absent
→ S6 requirePrepareOrdinaryOpenPort()
→ TEAM_REMOTE_TEAM_ORDINARY_OPEN_PORT_UNAVAILABLE
```

真实成立。

---

## 2.5 `packages/runtime/src/plugin/s6-remote.ts`

现有 writer-held mapping 保留：

```text
SessionAlreadyOwnedError name
session/writer-held code
message fallback
→ TEAM_REMOTE_TEAM_ROOT_LIVE_OUTSIDE_TEAM
```

本轮不扩展新的 Remote error vocabulary。

补测：

- Team-vs-Team race 最终不应该走到 OUTSIDE_TEAM；
- genuine ordinary owner（explicit permit 后 live）仍应 OUTSIDE_TEAM；
- foreign unknown root 保持 FOREIGN_TEAM；
- missing ordinary permit port 保持 typed unavailable。

---

# 3. Same-page composer 恢复：单独做一个 client characterization + repair

这是本轮最需要避免“猜修”的部分。

## 3.1 已知事实

0.1.7 中：

```ts
uiWorkspace.openSession(target)
→ sessions.retain(target, { source: 'mainView' })
→ replace mainReference
→ previous.release()
```

对同一个 SID 再 open 时：

```text
retain +1
→ release old -1
→ refcount 从未到 0
→ failed Session generation 不销毁
```

因此：

```ts
await ctx.sessions.refresh()
```

只刷新 Host catalog，无法清理当前 client Session generation 的 open error。

PR #31 的真实浏览器证据已经证明：

```text
veto
→ backend Team takeover success
→ sessions.refresh
→ composer 仍 Session unavailable
```

---

## 3.2 必须先做 characterization，不允许继续堆 refresh

新增一个最小 client spike，观察：

```text
sessions.retainInfo(root)
SessionReference.ready
Session binding / generation identity
uiWorkspace main selection
connection events
```

目标回答：

1. same SID failed generation 是否有 public reset/reopen seam？
2. `SessionReference.release()` 到 referenceCount=0 后，再 retain 是否会建立 fresh generation？
3. Team plugin 是否能通过现有 public `ctx.sessions` / `ctx.uiWorkspace` 安全做到这个动作？
4. 是否存在公开 navigation API 可以“reopen same Session generation”而无需跳到另一 Session？
5. 如果没有，是否可以只替换 client-side Session navigation provider，而无需回到 Host B+？

---

## 3.3 首选 repair 路线

若 public seam 足够：

```text
Team takeover success
→ explicitly retire failed client generation
→ reopen same root
→ composer ready
```

必须保证：

- 不直接访问 upstream private store；
- 不 DOM hack；
- 不 full page reload；
- 不要求用户切换 Session；
- 不创建第二个 Host Agent；
- fresh reference 最终绑定到已经 live 的 Team Agent；
- 保留 composer draft 的行为要明确测试。

---

## 3.4 如果 public seam 不足

不要用“自动切到 blank 再自动切回来”伪装 same-page repair，除非正式 ADR 明确接受这种 navigation side effect。

若确实没有 sanctioned seam，则输出一个 **GO/NO-GO 架构结论**：

### GO-C1-client-extension

能以一个小型 client replacement/provider 接管 same-id generation reopen，不碰 Host SessionController。

### NO-GO-C1

若唯一安全办法需要 private store / DOM / core patch，则停止继续补 C1 client workaround，重新评估：

```text
A' startup ownership protection
或
B+ compatibility replacement
```

但本轮在实证 NO-GO 前，不直接开始 B+。

---

# 4. 测试补充

## 4.1 Fence unit tests

文件：

```text
packages/runtime/test/team-session-activation.test.ts
```

新增：

### A10 — ownership resolver pending + Team Session

```text
listener 已注册
resolver 未 bind
agent/created(teamSid)
→ Promise pending，不 PASS
bind resolver → Team-owned
→ exact foreign generation veto
```

### A11 — ownership resolver pending + ordinary Session

```text
resolver 未 bind
agent/created(ordinarySid)
→ pending
bind resolver
→ unmanaged
→ PASS
```

### A12 — exact Team generation claim

```text
claim Agent A
agent/created(A) → PASS
agent/created(B same sid) → VETO
```

这条是本轮关键 discriminator。

### A13 — completed rollback visible after record deletion

```text
foreign veto
→ exact dispose
→ current record 已清
→ recover(after old epoch)
→ 立即 true
```

不能 timeout。

### A14 — stale completed epoch 不可解锁新 conflict

```text
rollback epoch 1 completed
baseline = 1
无新 rollback
recover(afterEpoch=1)
→ false
```

### A15 — one absolute deadline

构造：

```text
record 接近 deadline 才出现
dispose 不出现
```

总耗时必须约 `timeoutMs`，不能约 `2*timeoutMs`。

---

## 4.2 Glue / activation integration tests

文件：

```text
packages/runtime/test/team-session-activation-glue.test.ts
```

新增：

### G7 — `ensureLiveAgent ∥ ensureLiveAgent`

同一 SID：

```ts
await Promise.all([
  ensureLiveAgent(sid),
  ensureLiveAgent(sid),
])
```

断言：

```text
agents.resume calls = 1
两 caller 都 success
liveAgents 只有一个 handle
无 writer-held 泄漏
```

---

### G8 — `ensureRootLive ∥ message-triggered ensure`

同一 cold member/root：

```text
remote ensure
∥
work/message lazy ensure
```

断言 one resume。

---

### G9 — Team activation 与 foreign ordinary activation overlap

精确控制时序：

```text
Team activation 已开始但未 announce
foreign ordinary activation announce
```

foreign Agent object 与 claimed Team Agent object 不同。

断言：

```text
foreign VETO
Team PASS
```

这条用于证明已移除 temporal-window authority。

---

### G10 — completed-before-Team-catch TOCTOU

时序：

```text
ordinary activation 拿 writer
→ fence veto
→ dispose 完成
→ Team resume 的 writer-held rejection 才进入 catch
```

断言 Team 仍 exactly-one retry success。

---

## 4.3 Host startup race tests

新增单独 test，例如：

```text
packages/runtime/test/team-session-startup-fence.test.ts
```

测试：

### H1

```text
apply 已注册 listeners
domain open 被人为延迟
browser-style foreign Team activation 到达
→ 不能 PASS
domain ready / resolver bind
→ veto
```

### H2

同样场景 ordinary Session：

```text
resolver bind 后 unmanaged
→ PASS
```

---

## 4.4 Remote / ordinary-mode tests

现有 v5 测试保留，并增加：

### R6

production root 不存在 permit armer 时：

```text
team.prepareOrdinaryOpen
→ TEAM_REMOTE_TEAM_ORDINARY_OPEN_PORT_UNAVAILABLE
```

不能返回：

```json
{"permitted": true}
```

---

## 4.5 真实 host race matrix

现有 World E：

```text
follow ∥ ensure
```

保留，但不足。

新增 World F：

### F1 — Team ensure vs Team ensure

至少 20 次：

```text
restart
→ Promise.all([
    ensureRootLive(root),
    ensureRootLive(root),
  ])
```

全部：

```text
2/2 caller success
one Team generation
one writer
zero OUTSIDE_TEAM
zero unresolved writer-held
```

---

### F2 — Team ensure vs message/work ensure

对 member child：

```text
restart
→ concurrent:
   leader sends message/work to cold member
   explicit member/root ensure path
```

最终 one member generation。

---

### F3 — deliberately force ordinary-first

现有 World E 的 20 轮全部：

```text
created=1 disposed=0
```

说明没有真正打中 ordinary publication → veto → rollback handoff。

必须加入 deterministic barrier，使：

```text
ordinary agent/created 确实先发生
→ fence veto
→ exact disposed
→ Team ensure success
```

至少一条 run 必须记录：

```text
created >= 2
disposed >= 1
final surviving = 1
```

否则 recovery 分支仍只是 unit-tested。

---

# 5. Browser hard gate

必须加入一个新的 gold-standard flow，禁止 driver 做 session switch fallback。

流程固定：

```text
1. create dynamic Team root
2. send one successful Team turn
3. stop backend
4. restart same DSH_HOME
5. same browser page / fresh connected page open the cold Team root
6. ordinary activation is vetoed
7. page shows Session unavailable
8. click exactly once:
   “Open in Team mode / back to Leader”
9. DO NOT:
   - reload
   - navigate to blank/new Session
   - switch to another Session and back
10. assert composer enabled
11. type prompt
12. send
13. answer renders
14. captured request has:
   - Team leader persona
   - all 13 team_* tools
   - row staticModel / expected model routing
15. activation probe:
   - no second ordinary surviving writer
   - one final Team generation
```

如果这一 gate 无法通过，PR #31 仍不 merge-ready。

---

# 6. 测试证据与 gate 记录修正

当前 `commit5/final-battery.log` 出现：

```text
[ELIFECYCLE] Test failed
...
ROOTTEST_EXIT=0
```

本轮改脚本记录格式：

```text
ROOTTEST_PROCESS_EXIT=<actual exit>
ROOTTEST_BASELINE_EQUIVALENT=true|false
ROOTTEST_NEW_FAILURE_COUNT=<N>
```

Acceptance：

```text
process exit 可以非 0（存在已知 debt）
但：
NEW_FAILURE_COUNT 必须 = 0
BASELINE_EQUIVALENT 必须 = true
```

禁止把非零 test process 记成 exit 0。

---

# 7. 开发顺序

建议严格按以下顺序：

## Commit S1 — activation core correctness

只改：

```text
team-session-activation.ts
agent-bindings.mjs
相关类型面
```

完成：

- ownershipReady；
- exact Team generation claim；
- rollback epoch/tombstone；
- absolute deadline；
- per-SID single-flight。

先跑 A10–A15 + G7–G10。

---

## Commit S2 — host/root contract repair

改：

```text
host.ts
root.ts
s6-remote.ts（若需要）
```

完成：

- startup pending-classification；
- production fence surface 完整性；
- `prepareOrdinaryOpen` conditional wiring；
- H1/H2/R6。

---

## Commit S3 — client characterization

**先不写最终产品 workaround。**

产出：

```text
dev/agent-workflow/evidence/restart-017rc1/supplement-client/
```

至少包含：

- same-SID reopen reference-count trace；
- failed generation lifetime；
- public seam inventory；
- GO/NO-GO 结论。

---

## Commit S4 — same-page client repair

仅在 S3 得出 GO 后实现。

硬要求：

```text
single click takeover
no reload
no other-session switch
composer immediately usable
```

---

## Commit S5 — real-host supplement

跑：

```text
World A hard browser gate
World B member restart
World C ordinary negative
World D explicit ordinary mode
World E follow-vs-Team race
World F Team-vs-Team race
deterministic ordinary-first rollback handoff
```

---

## Commit S6 — final verification/bookkeeping

重新：

```text
typecheck
build
build:composition
check:artifacts
zero-core
focused suites
root suite baseline comparison
git-install real profile
```

更新：

```text
PR body
graph.yaml
SESSION_ROUTER_LOG.md
STATUS（仅实际状态）
```

---

# 8. 不允许的修复方式

本轮禁止：

- 删除 `session.lock`；
- sleep/backoff retry loop；
- while retry；
- 通过 message substring 作为唯一 writer-held authority；
- 把 foreign Agent 静默 adopt 进 Team `liveAgents`；
- 用 `ownedDepth > 0` 继续作为最终 Team-generation identity authority；
- 重新引入 `$DSH_HOME/sessions` 物理扫描；
- DOM click hack 修 composer；
- private upstream store reach；
- full page reload 作为产品修复；
- 自动“切到 blank 再切回来”而不经过明确 ADR；
- 修改 DSH upstream；
- 直接开始 B+ compatibility fork，除非 S3 的 client seam characterization 给出明确 NO-GO。

---

# 9. 最终 acceptance checklist

合并前必须同时满足：

- [ ] `SessionPersistence.stat()` 是唯一 durability authority。
- [ ] 同 SID Team activation 有真正 single-flight。
- [ ] `ensure ∥ ensure` 只产生一次 resume。
- [ ] Team-own generation 通过 exact Agent object 识别，不是时间窗口。
- [ ] ownership resolver 未 ready 时不会误放行 Team Session。
- [ ] resolver pending 时普通 Session 最终 upstream-equivalent PASS。
- [ ] foreign veto rollback exact-generation。
- [ ] completed rollback 可被事后 recovery 观察。
- [ ] recovery timeout 是单一 absolute deadline。
- [ ] exactly-one retry 保持。
- [ ] genuine ordinary owner 仍 fail-closed OUTSIDE_TEAM。
- [ ] ordinary-mode permit 单次、TTL、Team ensure=0。
- [ ] armer 缺席时 `prepareOrdinaryOpen` typed fail。
- [ ] Team root restart 正常。
- [ ] Team member restart 正常。
- [ ] ordinary non-Team Session 不受影响。
- [ ] deterministic ordinary-first veto→dispose→Team takeover PASS。
- [ ] 20× follow-vs-Team race PASS。
- [ ] 20× Team-vs-Team ensure race PASS。
- [ ] Browser：单击一次 Team takeover 后，同一页面、不 reload、不切 Session，composer 立即可用。
- [ ] Browser prompt 确认运行在 Team leader surface。
- [ ] CORE PATCH BUDGET = 0。
- [ ] `tests/deepseek-harness-test-use` pristine @ `46a7f68b09`。
- [ ] build / typecheck / artifacts 全绿。
- [ ] root suite `new failures = 0`，并记录真实 process exit。
- [ ] install-from-git / production profile smoke PASS。

---

# 10. 对本地 Agent 的任务边界

这是一轮**补充修复**，不是重新设计整个 restart subsystem。

优先级：

```text
correctness
> causal ownership
> race closure
> same-page UX closure
> evidence
> bookkeeping
```

不要顺便重构无关模块。

如果 client characterization 得出：

```text
0.1.7 public client API 无法安全 retire/reopen same SID generation
```

请停止继续堆 workaround，并提交一个单独的 architecture decision：

```text
C1 client closure = NO-GO
```

列出：

- 缺失的 public seam；
- 为什么 refresh/openSession 不足；
- 最小可行替代是 client replacement、A' 还是 B+；
- 各自修改范围。

由主审再决定是否转 B+。

---

## 11. 本轮预计修改文件

核心预期：

```text
packages/runtime/src/plugin/team-session-activation.ts
packages/runtime/src/plugin/live/agent-bindings.mjs
packages/runtime/src/plugin/host.ts
packages/runtime/src/plugin/root.ts
packages/runtime/src/plugin/types.ts
packages/runtime/src/plugin/s6-remote.ts

packages/runtime/test/team-session-activation.test.ts
packages/runtime/test/team-session-activation-glue.test.ts
packages/runtime/test/team-session-startup-fence.test.ts   # 建议新增
packages/runtime/test/d2-s6-ensure-root-live.test.ts

packages/client/src/plugin/team-mount-core.ts              # S4 才改
packages/client/test/...                                    # S3/S4

dev/agent-workflow/evidence/restart-017rc1/supplement-*/
```

Remote v5 contract原则上已经够用，不应再无理由 bump v6。

---

## 12. 完成后 PR #31 应能回答的四个问题

最终 PR body 请明确回答：

1. **同一个 Team Session 有两个 Team caller 同时要求 activation 时，谁负责 single-flight？**
2. **backend restart 后，在 TeamDomain ownership resolver 尚未 ready 的窗口里，为什么 ordinary SessionController 不能再次偷到 Team writer？**
3. **ordinary activation 已经 veto+disposed 后，Team recovery 为什么不会因为 record 已删除而错过这次 handoff？**
4. **用户在同一页面看到 Session unavailable 后，只点击一次“以 Team 模式打开”，为什么 composer 能直接恢复，而不需要 reload / switch-away-and-back？**

如果这四个问题都能由代码 + 测试 + real-host evidence 直接回答，PR #31 才算真正收口。
