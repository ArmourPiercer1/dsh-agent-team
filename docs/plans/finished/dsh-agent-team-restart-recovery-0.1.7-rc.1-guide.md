# dsh-agent-team：DSH 0.1.7-rc.1 Team 会话重启恢复修复指导

> **适用基线**
>
> - `dsh-agent-team`：`master @ 4fb79fca77984552ccb6f0ad1badcab69bd97625`
> - DSH：`0.1.7-rc.1 @ 46a7f68b0922371ce7144b668b90e377d8e799f4`
> - 当前升级状态：PR #29 已合并；0.1.7-rc.1 升级 real-host vertical 75/75，G1–G7 PASS。
> - 本文只处理 **backend restart 后 Team-managed Session 被普通 SessionController 抢占 write ownership，导致 `team.ensureRootLive` 无法恢复 Team Agent** 的问题。
> - 保持 `CORE PATCH BUDGET = 0`：**不修改 deepseek-harness upstream**。

---

## 0. 结论与实施原则

当前 `master` 已完成 0.1.7-rc.1 主适配，但 restart blocker 仍然存在于架构上：

```text
backend restart
    ↓
浏览器恢复/打开 cold Team Session
    ↓
DSH session.follow
    ↓
SessionController background promotion
    ↓
ordinary ctx.agents.resume(...)
    ↓
拿到 Session 唯一 write handle
    ↓
用户点击「以 Team 模式打开」
    ↓
dsh-agent-team ensureLiveAgent()
    ↓
第二次 ctx.agents.resume(... Team setup ...)
    ↓
SessionAlreadyOwnedError / session writer-held
```

0.1.7-rc.1 给了一个新机会：`agent/created` 已经从“创建后通知”升级为 **awaited + serial 的 Agent initialization barrier**。监听器 rejection 会使当前 create/resume 失败并由 AgentLoop rollback，且首个 model request 必须等待初始化完成。

因此，本轮**首选架构**不是立刻 fork 整个 `@deepseek-ai/dsh-api-session-controller`，而是先实现一个 **Team Session Activation Fence**：

1. 识别 Team-owned Session；
2. 允许 Team 自己发起的 create/resume；
3. 对 DSH ordinary SessionController 发起的 Team-owned Agent activation，在 `agent/created` barrier 中 fail closed；
4. 等 upstream rollback 完整释放 writer；
5. `team.ensureRootLive` 再通过既有 `agentSetup(...)` 和既有 `AgentHandle` ownership 路径恢复正确的 Team Agent；
6. durable existence 改用 0.1.7 public `SessionPersistence.stat()`，删除 `$DSH_HOME/sessions/...` 文件系统猜测。

**不要直接把 SessionController 创建出的普通 Agent “改装成 Team Agent”作为本轮目标。** 当前 glue 的 `liveAgents` 保存的是 `AgentHandle`，`dropResidency()` / `close()` 都依赖 `handle.dispose()`。`agent/created` payload 只有 bare `Agent`，没有 teardown capability。直接 adopt 会破坏现有 residency、archive、close 和 row-stop 生命周期语义。

**B+（兼容 fork 整包替换 SessionController）保留为 fallback。** 如果下面 Phase 0 实机 spike 证明 intentional veto 会产生无法通过 public seam 消除的持久用户可见 `api-session/error`，或者 ordinary-mode 产品语义无法接受，则停止 C1 方案，转 B+，不要继续堆 client hack。

---

# 1. 当前代码状态与真正缺口

## 1.1 `sessionIsDurable()` 仍然是错误的物理布局探针

当前：

`packages/runtime/src/plugin/live/agent-bindings.mjs`

仍有：

```js
function sessionIsDurable(sessionId) {
  const home = process.env.DSH_HOME
  if (home === undefined) return false
  const sessionsRoot = join(home, 'sessions')
  ...
  if (
    entries.some(
      (e) => e.isFile() && /^session(\.v\d+)?\.jsonl(\.zstd)?$/.test(e.name)
    )
  ) return true
}
```

这段已经暴露过两个实际兼容性 bug：

- `DSH_HOME` 未设置时，DSH 自己 fallback 到 `~/.dsh`，插件却返回 false；
- DSH persistence generation 名称从裸 `session.jsonl.zstd` 演进到 `session.vN.jsonl.zstd`。

0.1.7 已经有公开的：

```ts
ctx.sessionPersistence.stat(sessionId)
```

它：

- 不取得 write ownership；
- 不依赖 JSONL/Zstd；
- 不依赖 generation filename；
- 不依赖 `$DSH_HOME`；
- 不依赖 persistence backend 的物理布局。

所以 `sessionIsDurable()` 应彻底删除，而不是继续扩 regex。

---

## 1.2 当前 Team Agent 的正确生命周期已经高度集中

当前 glue 的核心正确路径是：

```text
agents.create/resume
    ↓
agentSetup(sessionId, hints..., bindPath, teamRoot)
    ↓
Team model selection
AgentPreset substrate
Team tools
Team skills
persona
MCP
permissions
boundary records
    ↓
AgentHandle
    ↓
liveAgents.set(sessionId, handle)
```

`liveAgents` 不是“Agent 列表”，而是 **AgentHandle ownership table**。

当前这些代码都依赖这个事实：

- `ensureLiveAgent()`
- `dropResidency()`
- `residency.dropResidency()`
- `close()`
- row-stop cleanup
- lifecycle archive / release 路径

所以修复必须让 Team-managed Agent 最终仍由 Team glue 自己调用 `ctx.agents.create/resume()` 获得 handle。

---

## 1.3 当前 `ensureLiveAgent()` 的竞争窗口

当前：

```js
const existing = liveAgents.get(sessionId)
if (existing !== undefined) return existing

if (!sessionIsDurable(sessionId)) ...
const handle = await agents.resume({
  resumeSessionId: SessionId(sessionId),
  setup: agentSetup(...),
})
```

它只知道：

```text
Team glue 自己有没有 handle
```

不知道：

```text
同一个 Session 是否正在被 DSH SessionController 普通 resume
```

所以 restart 后：

```text
liveAgents = empty
```

并不能表示：

```text
Session 没有 process-local writer
```

这就是当前 blocker 的直接原因。

---

## 1.4 0.1.7 新 seam：awaited serial `agent/created`

0.1.7 public contract：

```ts
'agent/created'(
  this: Scoped<Agent>,
  payload: {
    agent: Agent
    source: 'startup' | 'resume' | 'clear' | 'compact'
    signal?: AbortSignal
  },
): undefined | Promise<undefined>
```

`AgentRegistry.announce()` 会：

```ts
await ctx.serial(..., 'agent/created', ...)
```

而 AgentLoop 把这一步包含在 rollback-covered initialization 里。

因此：

```text
listener reject
    ↓
create/resume reject
    ↓
AgentLoop dispose
    ↓
write handle close
    ↓
Agent registry/session registry detach
```

这是本轮最有价值的新 public seam。

---

# 2. 目标代码架构

## 2.1 总体拓扑

```text
┌─────────────────────────────────────────────────────────────────┐
│                       stock DSH 0.1.7                            │
│                                                                 │
│ Browser → SessionController → ctx.agents.resume(...)             │
│                               │                                 │
│                               ▼                                 │
│                     AgentLoop initialization                    │
│                               │                                 │
│                        agent/created (awaited)                   │
└───────────────────────────────┼─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    dsh-agent-team                               │
│                                                                 │
│          TeamSessionActivationFence                             │
│          ├─ durable Team ownership classifier                   │
│          ├─ Team-owned activation guard                         │
│          ├─ foreign activation rollback barrier                 │
│          └─ optional ordinary-open one-shot permit              │
│                                                                 │
│ foreign ordinary activation?                                    │
│      ├─ no → pass                                               │
│      └─ yes → reject agent/created                              │
│                 ↓                                               │
│             DSH rollback                                        │
│                 ↓                                               │
│          writer fully released                                  │
│                 ↓                                               │
│       existing Team ensureLiveAgent                             │
│                 ↓                                               │
│       agents.resume(Team agentSetup)                            │
│                 ↓                                               │
│          AgentHandle → liveAgents                               │
└─────────────────────────────────────────────────────────────────┘
```

不替换：

- `AgentRegistry`
- `AgentLoop`
- `SessionPersistence`
- `SessionQuery`
- Session log
- SessionController（首选实现）
- Web Client Session model

只增加：

- 一个 Team activation fence；
- 一个 Team create/resume ownership marker；
- 一个 rollback handoff barrier；
- 一个 public persistence existence seam；
- 若要保留 D3 ordinary-mode 真正可继续对话语义，再加一个 **one-shot ordinary activation permit**。

---

## 2.2 核心不变量

### INV-A：Team-owned Session 只能有两种合法 activation

```text
A. Team-owned activation
   → 必须通过 Team glue
   → 必须运行 agentSetup(...)
   → Team glue 必须持有 AgentHandle

B. explicit ordinary-mode activation
   → 必须有显式 one-shot permit
   → 不运行 Team ensure
   → Team glue 不持有 handle
```

任何第三种情况：

```text
Team-owned Session
+
DSH ordinary auto-promotion
+
无 permit
```

必须在 `agent/created` initialization barrier fail closed。

---

### INV-B：AgentHandle ownership 不转移、不伪造

绝不：

```text
ctx.agents.get(sessionId)
→ 包一层假的 { agent, dispose }
```

绝不调用未公开的：

```text
agent.ctx.fiber.dispose()
```

去模拟 handle teardown。

Team residency 仍然只管理自己真正创建/resume 得到的 handle。

---

### INV-C：Durable existence 只读 public persistence authority

```text
sessionPersistence.stat(sessionId) !== undefined
```

是唯一 durable existence 判据。

禁止再：

- 扫 `$DSH_HOME`
- 猜 `~/.dsh`
- 扫 project hash 目录
- 匹配 `session.v4.jsonl.zstd`
- 假设 JSONL backend

---

### INV-D：Team activation marker 必须覆盖所有 Team create/resume

当前 `agent-bindings.mjs` 有多处直接 `agents.create(...)` / `agents.resume(...)`。

不能只修 `ensureLiveAgent()`。

要确保所有 Team-originated Agent lifecycle 都经过：

```text
activationFence.runOwned(sessionId, operation)
```

否则 fence 会把 Team 自己的 `agent/created` 当成 foreign activation 拒掉。

---

### INV-E：rollback 后才能第二次 resume

看到：

```text
SessionAlreadyOwnedError
```

不能立刻 retry。

必须先确认：

```text
foreign ordinary activation
→ agent/created 被 veto
→ agent/disposed 已发生
→ writer 已释放
```

再执行 Team resume。

---

# 3. 新模块：`TeamSessionActivationFence`

建议新建：

```text
packages/runtime/src/plugin/team-session-activation.ts
```

不要把这套状态机继续塞进 `agent-bindings.mjs`。

建议接口：

```ts
export type TeamSessionStartSource =
  | 'startup'
  | 'resume'
  | 'clear'
  | 'compact'

export interface TeamActivationAgent {
  readonly id: string
}

export interface TeamActivationFence {
  /** Team glue 的 create/resume 必须包在这里。 */
  runOwned<T>(
    sessionId: string,
    operation: () => Promise<T>,
  ): Promise<T>

  /** host 的 awaited agent/created listener 调用。 */
  beforeAgentCreated(input: {
    agent: TeamActivationAgent
    source: TeamSessionStartSource
    signal?: AbortSignal
  }): Promise<void>

  /** host 的 agent/disposed listener 调用。 */
  onAgentDisposed(agent: TeamActivationAgent): void

  /** ensure-live 在恢复前等待已声明的 foreign rollback。 */
  awaitRollback(sessionId: string): Promise<void>

  /** writer-held 竞争发生时，等待 foreign activation 宣告/rollback。 */
  recoverWriterConflict(
    sessionId: string,
    options?: { timeoutMs?: number },
  ): Promise<boolean>

  /** D3 ordinary-mode 的一次性 bypass。 */
  permitOrdinaryOnce?(sessionId: string): void

  /** row stop。 */
  close(): void
}
```

---

## 3.1 内部状态建议

### `ownedDepthBySession`

不要用简单 `Set<string>`。

用 refcount：

```ts
Map<string, number>
```

原因：

- 同一 session 的 helper 可能嵌套；
- teardown/error path 要用 `finally`；
- 以后 create/resume wrapper 组合时不应因为内层结束把外层 marker 清掉。

伪代码：

```ts
async function runOwned(sessionId, operation) {
  ownedDepth.set(sessionId, (ownedDepth.get(sessionId) ?? 0) + 1)
  try {
    return await operation()
  } finally {
    const next = (ownedDepth.get(sessionId) ?? 1) - 1
    if (next === 0) ownedDepth.delete(sessionId)
    else ownedDepth.set(sessionId, next)
  }
}
```

---

### `foreignRollbacks`

建议键：

```text
sessionId → {
  agent: exact Agent object,
  disposed: PromiseWithResolvers<void>
}
```

不能只按 sessionId 看到任意 `agent/disposed` 就认为 writer 释放。

必须 exact generation：

```ts
if (record.agent !== disposedAgent) return
```

避免 stale disposer 解锁后来的 generation。

---

### `ordinaryPermits`

若保留 D3 ordinary mode：

```text
sessionId → {
  expiresAt,
  uses: 1
}
```

规则：

- process-local；
- one-shot；
- 不写 TeamDomain；
- 不跨 backend restart；
- 建议 TTL 10–30 s；
- `agent/created` 消费，而不是 `openOrdinaryMode` 调用完成就消费；
- Team activation marker 优先于 permit。

---

## 3.2 Team ownership classifier

不要在 fence 里复制另一套 TeamDomain 遍历算法。

当前 `agent-bindings.mjs` 已有：

```js
teamRootOfSession(sessionId)
```

但 fence 必须在 host 侧尽早注册，而且 bootstrap 期间可能先于 glue 可用。

建议把 durable ownership 解析抽成一个纯模块：

```text
packages/runtime/src/plugin/team-session-ownership.ts
```

例如：

```ts
export function resolveOwningTeamRoot(
  domain: TeamDomain,
  bootRootSessionId: string,
  sessionId: string,
): string | undefined
```

语义保持当前 `teamRootOfSession()`：

1. boot root → self；
2. 有 `TeamSession` row 的 dynamic root → self；
3. member child → 遍历 owning root 的 `memberInstances`；
4. 未解析 → `undefined`。

然后：

- host activation fence 用它；
- glue `teamRootOfSession()` 改成薄 wrapper，或者直接通过 deps 注入同一 resolver。

**目标是只有一个 ownership authority 算法。**

---

# 4. `host.ts` 修改

文件：

```text
packages/runtime/src/plugin/host.ts
```

---

## 4.1 将 activation fence 在 `apply()` 最前段同步建立

当前 `apply()`：

- 注册 internal/get shim；
- 注册 skills；
- 构造 lazy persistence/preset/fs seams；
- 启动 `bootstrap()`；
- 同步 provide `teamRoot`；
- `apply()` 自己不 await `ready`。

这个结构意味着：

> activation listener 不能等到 `bootstrap()` 最后才注册。

否则浏览器连接后可能在 Team bootstrap 尚未完成时先触发 ordinary Session resume。

建议在 `apply()` 很早的位置：

```ts
const activationFence = createTeamSessionActivationFence(...)
```

并立即：

```ts
ctx.on?.('agent/created', async (payload) => {
  await activationFence.beforeAgentCreated(payload)
}, { global: true })

ctx.on?.('agent/disposed', ({ agent }) => {
  activationFence.onAgentDisposed(agent)
}, { global: true })
```

注意：当前 `TeamPluginHostContext.on?` 的 TS 签名是专门为 `internal/get` 写的。

要改成更通用的结构类型，或增加 overload，至少覆盖：

```ts
on(
  'internal/get',
  ...
)

on(
  'agent/created',
  listener: (payload: { agent: unknown; source: string; signal?: AbortSignal }) => ...
)

on(
  'agent/disposed',
  listener: (payload: { agent: unknown }) => ...
)
```

不要为方便直接把整个 host entry 强绑定成上游 `Context` 类型；当前模块刻意保持 structural independence。

---

## 4.2 Domain open 后绑定 ownership resolver

在：

```text
createTeamDomain / openTeamDomain / createOrOpenTeamDomainDetailed
```

完成、得到：

```ts
domain
resolvedRowConfig
```

之后，尽早：

```ts
activationFence.bindOwnershipResolver(
  (sessionId) =>
    resolveOwningTeamRoot(
      domain,
      resolvedRowConfig.rootSessionId,
      sessionId,
    ),
)
```

这个动作应发生在：

- live glue boot 前；
- remote mount 前也可以；
- 至少早于任何正常 Team activation。

---

## 4.3 给 glue 传 activationFence

扩 `GlueModule.createAgentBindings(...)` deps：

```ts
readonly activationFence?: {
  runOwned<T>(sessionId: string, op: () => Promise<T>): Promise<T>
  awaitRollback(sessionId: string): Promise<void>
  recoverWriterConflict(
    sessionId: string,
    options?: { timeoutMs?: number },
  ): Promise<boolean>
  permitOrdinaryOnce?(sessionId: string): void
}
```

生产 host 必须传。

test/factory world 可选，缺失时 fallback 为 direct operation，避免一次把所有旧测试 double 打爆。

---

# 5. Durable existence：删除 filesystem probe

## 5.1 扩现有 `sessionPersistence` wrapper

当前 host 给 glue 的 `sessionPersistence` 实际是一个 logical wrapper：

```ts
{
  ensureMaterialized(session) {
    return ctx.get('sessions').flush(session)
  }
}
```

保留这个字段，再增加：

```ts
async exists(sessionId: string): Promise<boolean> {
  const persistence = ctx.get('sessionPersistence') as {
    stat?: (id: unknown) => Promise<unknown | undefined>
  } | undefined

  if (persistence === undefined || typeof persistence.stat !== 'function') {
    throw new TeamPluginError(
      TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SERVICE_MISSING,
      'the "sessionPersistence" public service is absent or lacks stat',
    )
  }

  return (await persistence.stat(SessionId(sessionId))) !== undefined
}
```

### inject 建议

在 0.1.7 exact peer baseline 下，建议把：

```ts
export const inject = [
  'agents',
  'storageDomain',
  'sessions',
  'workspaceRegistry',
]
```

改为：

```ts
export const inject = [
  'agents',
  'storageDomain',
  'sessions',
  'sessionPersistence',
  'workspaceRegistry',
]
```

原因：

- Team 的核心产品本来就依赖 durable session；
- 0.1.7 `SessionPersistence` 是 public service；
- 比运行到 `exists()` 才发现 service 缺失更清晰。

如果某些历史 test composition 没有 persistence，可以在测试 fixture 中补 provider，而不是继续让生产代码猜磁盘。

---

## 5.2 `agent-bindings.mjs` 删除

删除：

```js
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
```

前提：确认本文件其他地方没有继续使用这两个 import。

删除：

```js
function sessionIsDurable(...)
```

替换为：

```js
async function sessionIsDurable(sessionId) {
  if (typeof sessionPersistence?.exists !== 'function') {
    throw new Error(
      'agent-bindings: sessionPersistence.exists public seam is unavailable'
    )
  }
  return await sessionPersistence.exists(String(sessionId))
}
```

或者直接改名为：

```js
async function durableSessionExists(sessionId)
```

避免以后又把它理解成“物理 artifact 探针”。

所有调用点改成 `await`。

当前至少需要检查并修改：

- `ensureLiveAgent`
- `childFactory.createChildSession`
- `createRootAgent`
- 任何其他 `sessionIsDurable(...)` 调用（提交前 grep 必须为 0）。

---

# 6. `agent-bindings.mjs`：把所有 Team create/resume 接到 fence

文件：

```text
packages/runtime/src/plugin/live/agent-bindings.mjs
```

---

## 6.1 新建两个内部 helper

建议：

```js
async function runOwnedActivation(sessionId, operation) {
  if (activationFence?.runOwned !== undefined) {
    return await activationFence.runOwned(String(sessionId), operation)
  }
  return await operation()
}
```

以及：

```js
async function resumeTeamAgent({
  sessionId,
  setup,
}) {
  return await runOwnedActivation(sessionId, () =>
    agents.resume({
      resumeSessionId: SessionId(sessionId),
      setup,
    }),
  )
}
```

fresh create 同理：

```js
async function createTeamAgent({
  sessionId,
  meta,
  setup,
}) {
  return await runOwnedActivation(sessionId, () =>
    agents.create({
      sessionId: SessionId(sessionId),
      meta,
      setup,
    }),
  )
}
```

**目标：本文件产品路径里不再散落裸 `agents.create()` / `agents.resume()`。**

允许 characterization / test-only 文件继续直接使用。

---

## 6.2 当前 call-site 全量迁移

当前 master 中，产品 glue 至少有：

### create

1. fresh child；
2. boot root create；
3. boot seed member create；
4. dynamic root create。

### resume

1. `ensureLiveAgent` cold resume；
2. childFactory durable child resume；
3. boot root resume；
4. boot member resume；
5. dynamic root durable resume。

全部改成 wrapper。

提交前加一个静态断言测试：

```text
agent-bindings.mjs production body 中
裸 "agents.create({" == 0
裸 "agents.resume({" == 0
```

wrapper 定义本身除外。

---

# 7. `ensureLiveAgent()` 的新算法

目标：

```text
Team handle 已存在
    ↓ yes
return

activation fence 有 foreign rollback/takeover
    ↓ yes
await rollback

检查 process-local foreign live Agent
    ↓ yes
fail closed as OUTSIDE_TEAM

检查 durable exists via stat
    ↓ no
NO_DURABLE_ARTIFACT

Team-owned resume
    ↓
如 writer-held：
    只在 fence 确认是可接管的 ordinary-promotion race 时
    等待 rollback
    然后 retry 一次
```

建议伪代码：

```js
async function ensureLiveAgent(sessionId) {
  const sid = String(sessionId)

  if (closing) throw ...

  const existing = liveAgents.get(sid)
  if (existing !== undefined) return existing

  // 已经识别到的 ordinary activation rollback 必须先收敛。
  if (activationFence?.awaitRollback !== undefined) {
    await activationFence.awaitRollback(sid)
  }

  // 如果 upstream registry 里已经有 live Agent，但 Team 没有 handle，
  // 这是显式 ordinary-mode 或真正的 foreign live owner。
  const foreignLive =
    typeof agents.get === 'function' ? agents.get(SessionId(sid)) : undefined

  if (foreignLive !== undefined && !liveAgents.has(sid)) {
    throw new Error(
      `agent "${sid}" is already registered outside the Team glue`
    )
  }

  if (!(await durableSessionExists(sid))) {
    throw new Error(
      `p6t6: session '${sid}' is neither live nor durable — no agent to execute a tool on`
    )
  }

  const teamRoot = teamRootOfSession(sid)
  if (teamRoot === undefined) {
    throw new Error(`... no owning Team root ...`)
  }

  const resume = async () =>
    resumeTeamAgent({
      sessionId: sid,
      setup: agentSetup(
        sid,
        undefined,
        undefined,
        teamRoot === sid ? 'cold-root' : 'cold-member',
        teamRoot,
      ),
    })

  resumingSessions.add(sid)

  try {
    let handle
    try {
      handle = await resume()
    } catch (error) {
      if (!isSessionWriterHeld(error)) throw error

      const recoverable =
        await activationFence?.recoverWriterConflict?.(
          sid,
          { timeoutMs: WRITER_HANDOFF_TIMEOUT_MS },
        )

      if (recoverable !== true) throw error

      // exact foreign generation 必须完成 disposed / rollback。
      await activationFence.awaitRollback(sid)

      // 只 retry 一次。
      handle = await resume()
    }

    if (closing) {
      await disposeBestEffort(handle)
      throw ...
    }

    liveAgents.set(sid, handle)
    return handle
  } finally {
    resumingSessions.delete(sid)
  }
}
```

---

## 7.1 writer-held 判断不要只匹配一句英文

0.1.7 正式有：

```text
SessionAlreadyOwnedError
session/writer-held
```

但 glue 是 plain JS + public service。

优先级：

1. 若 error `name === 'SessionAlreadyOwnedError'`；
2. 若 error `code === 'session/writer-held'`；
3. 最后兼容 message：
   `already owned by an active write handle`。

不要把 message substring 作为唯一 authority。

---

## 7.2 retry 规则必须严格

只允许：

```text
1 次 writer conflict
+
fence 确认出现了对应 Team-managed foreign activation
+
exact foreign generation 已 disposed
```

否则禁止重试。

不要：

- while retry；
- 固定 sleep；
- 指数退避；
- 删除 `session.lock`；
- writer-held 一律 retry。

---

# 8. awaited `agent/created` fence

## 8.1 foreign activation 判据

在：

```ts
beforeAgentCreated({ agent, source, signal })
```

中：

```text
sessionId = agent.id

ownership resolver:
  unmanaged → pass

ownedDepth(sessionId) > 0
  → Team 自己的 create/resume
  → pass

ordinary permit exists
  → consume permit
  → pass

否则：
  → foreign activation of Team-managed Session
  → create exact-generation rollback record
  → throw TeamSessionActivationInterceptedError
```

建议所有 `source` 都走同一 ownership rule，不只 `resume`。

理由：

- 当前真正 emitter 主要是 `startup` / `resume`；
- `clear` / `compact` 是 reserved；
- 未来新增 emitter 时 Team-owned Session 也不应绕过 owner fence。

错误信息要稳定且可 grep，例如：

```text
dsh-agent-team: intercepted foreign Agent activation for Team-managed session "<sid>"
```

不要把它冒充 `SessionAlreadyOwnedError`。

---

## 8.2 `agent/disposed` 完成 rollback barrier

```ts
onAgentDisposed(agent) {
  const record = foreignRollbacks.get(agent.id)
  if (record === undefined) return
  if (record.agent !== agent) return

  foreignRollbacks.delete(agent.id)
  record.disposed.resolve()
}
```

这一步是 Team 第二次 resume 的安全边界。

---

# 9. Phase 0 必须先做的 real-host spike

在正式把 C1 做成产品前，先做 **最小 live characterization**。

目的不是测试 Team 工具，而是回答两个问题：

### Q1：rollback 是否真的释放 writer？

场景：

```text
cold Team root
→ session.follow
→ ordinary promotion
→ Team agent/created listener reject
→ observe agent/disposed
→ Team agents.resume succeeds
```

必须实测：

- `agent/created` source = `resume`；
- listener reject；
- `agent/disposed` 到达；
- `SessionPersistence.open(...,'write')` 随后可成功；
- 无残留 ordinary Agent；
- 第一轮 model request 根本没发生。

### Q2：intentional rejection 是否产生持久用户可见 `api-session/error`？

这是 C1 的 **GO / NO-GO 判据**。

如果浏览器 Chat/Session 在 Team takeover 成功后仍保留：

```text
gateway/internal
resume failed...
```

一类明显错误 banner，并且没有 public、无副作用的清除方式：

> **停止 C1 产品化，转 B+。**

不要为了掩掉 intentional SessionController error 去：

- patch DOM；
- 私改 Client store；
- 拦截 network response；
- 吞 `api-session/error` 全局事件。

这些都会比 B+ 更脆。

---

# 10. Ordinary mode：必须明确处理

当前仓库有正式的 D3 产品语义：

```text
「以普通模式打开」
= native open
= 不调用 team.ensureRootLive
= 不保证 team_* tools
```

历史 D4 还验证过：

```text
ordinary entry 打开后 session 仍可正常继续对话
```

如果 fence 默认拦截所有 Team-owned ordinary activation，那么 cold Team root 的 ordinary mode 会退化成：

```text
历史可读
但 ordinary Agent 无法成功 activate
```

这是回归。

---

## 10.1 推荐：one-shot ordinary activation permit

若要保持 D3 可继续对话：

```text
点击「以普通模式打开」
    ↓
team.prepareOrdinaryOpen(rootSid)
    ↓
activationFence.permitOrdinaryOnce(rootSid)
    ↓
native uiWorkspace.openSession(rootSid)
    ↓
SessionController ordinary resume
    ↓
agent/created
    ↓
permit consumed → pass
```

注意这会改变旧测试中的一句：

```text
zero team.* remote calls
```

新语义应调整为：

```text
zero Team ensure / zero Team Agent side effects
```

`prepareOrdinaryOpen` 只是 process-local activation permit：

- 不 resume Team Agent；
- 不改 TeamDomain；
- 不改治理；
- 不注册工具；
- 不持久化；
- one-shot + expiry。

这是比“完全不碰 Team remote”更重要的产品不变量。

---

## 10.2 需要修改的模块

### remote contract

在现有 Team Remote 中加窄方法，例如：

```text
team.prepareOrdinaryOpen
```

输入：

```ts
{
  teamSessionId: string
}
```

输出至少：

```ts
{
  rootSessionId: string
  permitted: true
}
```

host handler 必须先走现有：

```text
assertBoundRoot(...)
```

只允许 Team-owned root。

---

### `packages/runtime/src/plugin/s6-remote.ts`

加：

```ts
prepareOrdinaryOpen?: (rootSessionId: string) => Promise<void> | void
```

handler：

```text
assertBoundRoot
→ require port
→ arm one-shot permit
→ typed success
```

---

### `packages/runtime/src/plugin/root.ts`

给 `createS6RemoteSurfaces(...)` 接：

```ts
prepareOrdinaryOpen: (sid) =>
  live.allowOrdinaryActivationOnce?.(sid)
```

---

### `packages/runtime/src/plugin/types.ts`

`TeamAgentBindings` 增：

```ts
readonly allowOrdinaryActivationOnce?: (
  rootSessionId: string
) => void
```

---

### `agent-bindings.mjs`

只是把 host 传入的 fence surface 暴露：

```js
allowOrdinaryActivationOnce(sessionId) {
  activationFence?.permitOrdinaryOnce?.(String(sessionId))
}
```

不要在 glue 再维护第二张 permit map。

---

### client

`packages/client/src/plugin/team-mount-core.ts`

当前：

```ts
const openOrdinaryMode = (rootSessionId: string): void => {
  openSession(rootSessionId)
  openModeByRoot.set(rootSessionId, 'ordinary')
}
```

改为 async 两阶段：

```ts
const openOrdinaryMode = async (rootSessionId: string): Promise<void> => {
  const permit = await teamRemote.prepareOrdinaryOpen(rootSessionId)
  if (!permit.ok) throw ...
  openSession(rootSessionId)
  openModeByRoot.set(rootSessionId, 'ordinary')
}
```

若 native open 失败：

- permit 留到 TTL 自动过期；
- 不标 ordinary mode；
- 不额外调用 revoke RPC。

简单、无第二次 race。

相应 UI prop 从：

```ts
(rootSessionId: string) => void
```

改成：

```ts
(rootSessionId: string) => Promise<void>
```

并走现有 async error lane。

---

# 11. `s6-remote.ts` 的错误映射补强

即使修复完成，仍应把当前 0.1.7 writer conflict 做成明确诊断。

当前只特判：

```text
agent "<id>" is already registered
```

建议再识别：

- error name `SessionAlreadyOwnedError`
- code `session/writer-held`
- compatibility message `already owned by an active write handle`

映射建议继续使用：

```text
TEAM_REMOTE_TEAM_ROOT_LIVE_OUTSIDE_TEAM
```

或者，如果愿意扩错误词汇，可加：

```text
TEAM_REMOTE_TEAM_ROOT_LIVE_WRITER_HELD
```

但若没有 UI 差异，优先复用 `OUTSIDE_TEAM`，避免只为诊断扩大 frozen contract。

修复后正常 restart regression 中 **不应出现这个 code**。

---

# 12. 具体文件修改清单

## 必改

| 文件 | 修改 |
|---|---|
| `packages/runtime/src/plugin/team-session-activation.ts` | **新建** Team activation fence 状态机 |
| `packages/runtime/src/plugin/team-session-ownership.ts` | **建议新建** durable Team ownership 单一解析函数 |
| `packages/runtime/src/plugin/host.ts` | 早注册 `agent/created`/`agent/disposed`；绑定 domain ownership；增加 `sessionPersistence.stat` wrapper；传 fence 给 glue；inject 增 persistence |
| `packages/runtime/src/plugin/live/agent-bindings.mjs` | 删除物理 `sessionIsDurable`；create/resume 全部统一 wrapper；`ensureLiveAgent` 接 rollback/writer conflict；暴露 ordinary permit passthrough |
| `packages/runtime/src/plugin/types.ts` | 扩 `TeamAgentBindings` / glue structural surface |
| `packages/runtime/src/plugin/root.ts` | 如保留 D3 ordinary mode，接 `prepareOrdinaryOpen` port |
| `packages/runtime/src/plugin/s6-remote.ts` | 如保留 D3，新增 prepare ordinary open handler；补 writer-held 诊断映射 |
| `packages/remote/...` | 如保留 D3，扩 frozen Remote catalog/contracts/client wrapper |
| `packages/client/src/plugin/team-mount-core.ts` | ordinary open 改 permit → native open |
| `packages/client/src/ui/TeamView.tsx` | ordinary face async 类型 |
| `packages/client/src/ui/TeamMembers.tsx` | ordinary face async 类型 |

---

## 应同步更新的 build artifact / declarations

按当前仓库纪律：

- runtime dist mirror；
- composition client bundle；
- `.d.mts` glue declarations；
- `p4t6` scanner pin（若新增 scanner-visible 文件）；
- package artifact freshness。

不要手改 dist 后忘 source，或只改 source 不重建 committed artifacts。

---

# 13. 测试设计

# 13.1 Activation fence 纯单测

建议新建：

```text
packages/runtime/test/team-session-activation.test.ts
```

至少覆盖：

### A1 ordinary unmanaged

```text
ordinary session
→ agent/created(resume)
→ pass
```

### A2 Team foreign resume

```text
managed root
ownedDepth=0
permit absent
→ agent/created rejects
→ rollback record exists
```

### A3 Team-owned resume

```text
runOwned(root, ...)
→ agent/created
→ pass
→ ownedDepth finally returns 0
```

### A4 nested ownership

```text
runOwned(sid,
  runOwned(sid, ...)
)
```

内层结束不能提前清 outer guard。

### A5 exact-generation disposal

```text
foreign Agent A rejected
Agent B disposed
→ A barrier NOT resolved

A disposed
→ resolved
```

### A6 one-shot ordinary permit

```text
permit
→ first foreign activation passes
→ second foreign activation rejects
```

### A7 permit expiry

过期 permit 不再 bypass。

### A8 close

close 后：

- 新 `runOwned` 拒绝；
- waiters settle；
- 不留 dangling promise。

---

# 13.2 Durability seam 单测

新增/改现有 glue tests：

### D1 `DSH_HOME` 完全未设置

`exists()` fake 返回 true：

```text
ensureLiveAgent
→ resume
```

不能再因为环境变量 false。

### D2 V4 filename 完全不可见

test 不提供任何 filesystem tree。

只提供：

```text
sessionPersistence.exists = true
```

应恢复成功。

### D3 nonexistent

```text
exists = false
→ 保留现有 "neither live nor durable"
→ S6 映射 NO_DURABLE_ARTIFACT
```

### D4 persistence fault

`stat` 抛错：

```text
必须传播
不得解释成 "not durable"
```

避免把 backend 故障伪装成不存在。

---

# 13.3 Glue activation ownership 单测

扩：

```text
packages/runtime/test/t12a-live-bridge.*
```

让 fake `agents.create/resume` 在发布前触发 fake `agent/created` 或至少记录 ownership guard。

需要断言：

### G1 所有 Team create 都有 ownership guard

覆盖：

- fresh root
- fresh member
- boot seed member

### G2 所有 Team resume 都有 ownership guard

覆盖：

- cold root
- cold member
- `ensureLiveAgent`
- dynamic root
- durable child factory

### G3 wrapper fault 也清 guard

`agents.resume` throw 后：

```text
ownedDepth == 0
```

### G4 closing race

foreign rollback pending 时调用 `close()`：

- 不启动新 resume；
- waiter 终止；
- no late handle in `liveAgents`.

### G5 writer-held recoverable race

模拟：

```text
first Team resume → SessionAlreadyOwnedError
foreign activation record appears
exact foreign dispose
second Team resume succeeds
```

断言：

```text
resume calls == 2
```

恰好一次 retry。

### G6 writer-held unrecoverable

没有 foreign rollback：

```text
writer-held
→ bounded wait ends
→ original error propagates
→ no retry loop
```

---

# 13.4 S6 / Remote tests

现有：

```text
packages/runtime/test/d2-s6-ensure-root-live.test.ts
```

至少补：

### R1 writer-held typed diagnostic

### R2 ordinary permit only accepts owned root

### R3 unknown/foreign root fail closed

### R4 permit method不调用 `ensureRootLive`

### R5 permit不产生 TeamDomain mutation

---

# 13.5 Client tests

现有：

```text
packages/client/test/d3-open-ordinary-mode.test.ts
packages/client/test/d3-ordinary-mode-entry.client.spec.tsx
```

改/补：

### C1 ordinary two-phase 顺序

```text
prepareOrdinaryOpen resolves
BEFORE
uiWorkspace.openSession
```

### C2 permit reject

native open 不执行，mode 不标记。

### C3 native open reject

ordinary mode 不标记；permit 等 TTL 过期。

### C4 文案

建议 hint 改为：

```text
不执行 Team ensure；以普通 Session Agent 激活
```

不要继续宣称：

```text
zero team.* remote calls
```

因为 prepare permit 本身是 Team control-plane RPC。

### C5 Team mode不申请 ordinary permit

---

# 13.6 最重要：0.1.7 real-host restart regression

建议新增独立 kit：

```text
tests/kits/team-restart-017rc1/
```

或：

```text
dev/agent-workflow/evidence/team-restart-017rc1/
```

不要只复用 boot-root U8 V8。

## World A：dynamic Team root

必须通过真实：

```text
team.create
```

创建动态 root。

然后：

```text
1. Team root 正常工作
2. 记录 rootSessionId
3. stop backend
4. 同一 DSH_HOME fresh restart
5. 浏览器式 session.follow 打开这个 dynamic root
6. ordinary SessionController 尝试 background promotion
7. activation fence 拒绝 foreign Agent
8. 观察 exact agent/disposed
9. 调 team.ensureRootLive
10. Team resume 成功
```

断言：

- 没有最终 `session/writer-held`；
- 同一个 `rootSessionId`；
- `ctx.agents` 最终恰一个该 id live Agent；
- Team glue `hasLive(root)==true`；
- Agent 是 Team-owned handle；
- 当前 frozen Team tools 全部存在（U8 当前 evidence 为 13 个 `team_*`）；
- Team root persona/context block 存在；
- 实际执行 `team_list_members` 成功；
- history 仍存在；
- 第一轮 Team request 使用 Team model selection；
- 无重复 model-selection listener 可观察副作用；
- 无 MCP double mount；
- `sessionPersistence.stat(root)` 为 present；
- 测试完全不读取 `session.v4.jsonl.zstd` 文件名作为产品判据。

---

## World B：dynamic member child

```text
1. 创建 Team + member
2. stop backend
3. restart
4. 对 member child 做 browser-style follow
5. ordinary activation 被 fence
6. Leader team_send_message / team_delegate 触发 member ensure
7. Team member cold resume 成功
```

断言：

- role = member；
- owning root 正确；
- member Team context 正确；
- member preset/base tools 正确；
- Team tools surface 正确；
- 单 writer；
- 无 OUTSIDE_TEAM / writer-held 最终错误。

---

## World C：ordinary non-Team Session 负对照

```text
ordinary cold Session
→ restart
→ browser follow
→ ordinary SessionController promotion
→ 必须照常成功
```

这是最重要的非回归。

Fence 不得把所有 resume 都接管。

---

## World D：显式 ordinary mode

若实现 one-shot permit：

```text
cold Team root
→ prepareOrdinaryOpen
→ native open
→ ordinary Agent 成功
```

断言：

- Team `ensureRootLive` 调用数 = 0；
- Team glue `hasLive(root)` 仍 false；
- upstream `ctx.agents.get(root)` live；
- 普通 prompt 可以执行；
- 后续点击 Team mode 应 typed fail closed（已有 live ordinary owner），不得 silent adopt；
- backend restart 后该 ordinary live owner 消失，Team mode 可再次正常 takeover。

---

## World E：竞争压力

至少跑 20 次：

```text
restart
→ session.follow
→ 0–随机少量 microtask 后并发 team.ensureRootLive
```

验收：

```text
20/20 最终 Team live
0 unresolved writer-held
0 double Agent
0 leaked handle
```

不要只跑一次 happy path。

---

# 14. Phase 0 的 GO/NO-GO gate

C1 public-fence 只有在以下全部成立时才能进入产品代码：

| Gate | 必须结果 |
|---|---|
| `agent/created` rejection | 确实 rollback |
| `agent/disposed` | exact generation 到达 |
| writer | rollback 后可重新 claim |
| first model request | foreign ordinary Agent 为 0 次 |
| UI error | 不留下不可接受的持久错误 |
| ordinary Session | 完全不受影响 |
| Team lifecycle | Team 最终仍持有真实 AgentHandle |

如果唯一失败项是：

```text
intentional rejection
→ SessionController 产生持久用户可见 api-session/error
```

且 public seam 无法干净处理：

> **不要在 client 做错误吞噬补丁；直接转 B+。**

---

# 15. B+ fallback 的触发条件与范围

如果 C1 NO-GO，则采用之前讨论的 compatibility replacement pattern：

```text
disable stock session-controller row
insert dsh-agent-team/session-controller
```

原则与 PR #26 `team-spill-local` 一样：

```text
upstream 0.1.7-rc.1 行为
+
只改 activation owner selection
```

### B+ 唯一允许的核心 semantic delta

在 upstream `ApiSessionAgentController.resolve/resume` 决策点：

```text
SessionId
    ↓
Team activation authority
    ├─ unmanaged → stock ordinary resume
    └─ managed   → dsh-agent-team ensureLiveAgent
```

不要改：

- persistence；
- AgentLoop；
- follow/page wire；
- list/search；
- control；
- Client session implementation；
- Remote request/response shape。

### B+ 开工前必须先做 Typert descriptor spike

证明：

```text
stock business-service row disabled
replacement service active
但 session.* strict Typert descriptors
仍然由 upstream generated contribution 正常提供
```

如果不能直接复用 upstream：

```text
@deepseek-ai/dsh-api-session-controller/typert
```

或当前 loader contribution，就必须把 descriptor registration 也纳入 compatibility fork；这会明显增加维护量。

---

# 16. 推荐实施顺序

## Commit 1 — characterization only

建议标题：

```text
test(restart): characterize 0.1.7 Team activation rollback seam
```

只加：

- real-host spike；
- activation event evidence；
- UI error观察；
- 不改 production。

得到 GO / NO-GO。

---

## Commit 2 — durability + activation core

```text
fix(runtime): fence foreign Team activation and use session persistence stat
```

包含：

- `team-session-activation.ts`
- `team-session-ownership.ts`
- host listener wiring
- stat seam
- glue wrappers
- ensureLiveAgent writer-race recovery
- focused tests
- dist rebuild

不动 client ordinary mode。

---

## Commit 3 — ordinary-mode compatibility

```text
fix(client): preserve explicit ordinary Team-session activation
```

包含：

- prepare ordinary open remote
- one-shot permit
- client async two-phase open
- D3 tests
- D4 real-host update
- composition bundle rebuild

---

## Commit 4 — real-host closure / evidence

```text
test(restart): close dynamic Team cold-resume regression on 0.1.7
```

包含：

- dynamic root
- dynamic member
- ordinary negative control
- ordinary permit
- race repetition
- evidence + bookkeeping

---

# 17. 验收标准

本轮不能只以：

```text
“截图里的报错消失了”
```

为 PASS。

完整 PASS：

1. `DSH_HOME` 未设置时仍可恢复；
2. product code 零 session persistence 文件名扫描；
3. dynamic Team root 跨 backend restart 可恢复；
4. dynamic Team member 跨 backend restart 可恢复；
5. browser `session.follow` 不能抢走 Team ownership；
6. Team Agent 最终由 Team glue 持有真实 `AgentHandle`；
7. ordinary non-Team Session 行为完全 unchanged；
8. explicit ordinary mode 若保留，可真正继续 ordinary 对话；
9. writer-held race 压测无 unresolved collision；
10. Team tools / persona / model / MCP / permissions 首请求即完整；
11. `close()` / archive / dropResidency 生命周期仍正确；
12. zero-core scan PASS；
13. upstream test-use checkout pristine；
14. typecheck/build/build:composition/check:artifacts 全绿；
15. root suite 新失败集合为空；
16. 0.1.7 real-host restart kit deterministic green。

---

# 18. 明确禁止的“短修”

本轮不要做：

### 删除 `session.lock`

无效且危险。当前 writer ownership 是 active handle authority，不是“看到 lock 文件就认为占用”。

### writer-held 后 sleep + retry

没有 ownership proof，会把真正外部 owner 当 transient race。

### `ctx.agents.get()` 后 silent adopt

拿不到 `AgentHandle`，破坏 lifecycle ownership。

### 直接把普通 Agent 再跑一遍 `agentSetup`

即使 tools/persona 看起来能装上：

- Team glue 仍不持 handle；
- ordinary SessionController 已安装自己的 model selection；
- duplicate model/preset semantics 未被证明安全；
- archive/drop/close 语义破坏。

### 全局吞 `api-session/error`

会掩盖真实普通 Session resume 故障。

### 继续补 `sessionIsDurable` regex

0.1.7 已经有 `SessionPersistence.stat()`，物理路径不再是合法 authority。

---

# 19. 给本地 Agent 的最终目标描述

可以把下面这段直接作为任务摘要：

> 在 `dsh-agent-team master @ 4fb79fca`、DSH `0.1.7-rc.1 @ 46a7f68b09` 上修复 dynamic Team Session 的 backend-restart cold resume。禁止修改 DSH upstream。首选利用 0.1.7 awaited serial `agent/created` 作为 Team Session activation ownership fence：Team 自己的所有 `agents.create/resume` 必须带显式 owned guard；Team-managed Session 被 stock SessionController ordinary auto-promotion 时必须在首个 model request 前 fail closed，并以 exact `agent/disposed` 作为 writer-release barrier，随后只允许既有 Team glue 通过完整 `agentSetup` 再 resume 并持有真实 `AgentHandle`。删除 `$DSH_HOME/sessions` / filename-based durable probe，改用 public `SessionPersistence.stat()`。writer-held 只在确认对应 foreign activation rollback 后允许一次 retry，禁止 sleep/retry loop。保留 ordinary non-Team Session 完全 upstream-equivalent；若保持现有 D3「以普通模式打开」可继续对话语义，则增加 process-local one-shot ordinary activation permit，按钮仍不执行 Team ensure。先做 0.1.7 real-host characterization；若 intentional `agent/created` veto 导致不可通过 public seam 消除的持久用户可见 `api-session/error`，立即停止 C1 产品化并切换到 B+ SessionController compatibility replacement，不做 client error swallowing hack。

---

## 附：为什么 0.1.7 后先试这个，而不是直接 B+

0.1.5-rc.2 没有一个可 await、可 veto、rollback-covered 的 per-Agent initialization boundary，所以 ordinary SessionController 一旦完成 resume，Team 基本只能面对已经存在的 writer。

0.1.7-rc.1 把 `agent/created` 提升为真正的 serial initialization barrier，这第一次允许外部插件在 **Agent 第一次 request 之前** 对非法 activation fail closed，并由 upstream 自己完成 rollback。

这足以值得先做一轮 bounded characterization。

但它仍没有提供：

```text
“把一个由别的 consumer 创建的 AgentHandle ownership 转让给 Team”
```

的 public seam。

所以：

```text
C2：直接 adopt ordinary Agent
```

目前仍不应作为目标。

若 C1 的错误呈现/普通模式语义不满足产品要求，B+ 仍是正确 fallback，而不是继续绕 public lifecycle contract。
