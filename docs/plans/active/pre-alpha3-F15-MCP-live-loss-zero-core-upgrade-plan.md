# pre-alpha.3 / F15：MCP Live-Loss Zero-Core 升级方案

> 目标仓库：`ArmourPiercer1/dsh-agent-team`  
> 适用阶段：pre-alpha.3 重构，PR #38–#42 之后的 F15 / follow-up  
> 核心约束：**CORE PATCH BUDGET = 0**  
> 状态：供本地 agent 直接执行的开发与验收计划

---

## 0. 结论与执行裁决

本轮不要修改 DSH upstream，也不要通过 private import、内部字段反射、monkey patch 等方式读取 `mcp-client` supervisor 的内部 `client` / `connectedAt` 状态。

采用 **zero-core 两级恢复模型**：

1. **短暂掉线由 upstream MCP supervisor 自己恢复**；
2. **upstream 重连预算耗尽后，以 public ToolRuntime 中该 MCP 的工具 surface 被撤销作为 confirmed-loss 信号**；
3. dsh-agent-team 在下一 request boundary 将该 MCP 判为 `unreachable`，Requirement Gate 对 required MCP **fail closed / BLOCKED**；
4. 插件随后回收已经 exhausted 的旧 fiber，删除 `mcpFibers[name]`，进入自身 cooldown；后续 boundary 允许重新 materialize；
5. 将 upstream reconnect budget 从默认约 151.5 s backoff 缩短到插件显式配置的短 grace window。

推荐默认：

```ts
reconnect: {
  enabled: true,
  initialDelayMs: 500,
  maxDelayMs: 2_000,
  maxAttempts: 3,
}
```

该配置的**纯 backoff 累计为 3.5 s**：

```text
0.5 s + 1 s + 2 s = 3.5 s
```

注意：这不是严格的 3.5 s wall-clock 上界；每轮 transport connect/handshake 自身的失败耗时需单独计入。未经实测，不得在文档中声称“必然 5 秒内检测”。

本轮应把原 R1 验收语义从：

```text
MCP running → kill → next boundary BLOCKED
```

改为：

```text
MCP running
→ irrecoverable transport loss
→ upstream reconnect grace budget exhausted
→ public MCP tool surface withdrawn
→ plugin observes confirmed loss
→ next protected boundary BLOCKED
```

这是 core=0 条件下可以由公开 seam 证明的最强语义。

---

# 1. 问题背景

PR #40 已经完成：

- `CapabilityReadinessProvider`
- `unknown | reachable | unreachable` 三态 readiness
- per-server MCP materialization
- `mcpFibers: Map<serverName, fiber>`
- MCP mount failure / recovery telemetry
- request-boundary reconcile
- required capability gate

但当前 production MCP readiness 仍存在一个 observation gap：

```text
state.mcpFibers.has(name)
```

只能证明：

> dsh-agent-team 曾经挂载过这个 MCP 的 supervisor fiber，而且插件尚未主动 dispose 它。

不能证明：

> supervisor 当前的 MCP connection generation 仍然 connected。

DSH upstream `mcp-client` 在 transport 掉线后会保留外层 supervisor，并进行自动 reconnect。当前 public `ConnectionHandle` 没有公开 `isConnected`、connection-state snapshot 或 disconnect event。

因此会出现 stale positive：

```text
MCP alive
  ↓
fiber exists
  ↓
reachable

MCP killed
  ↓
upstream supervisor enters reconnect
  ↓
fiber STILL exists
  ↓
current plugin probe STILL says reachable
  ↓
required gate remains OPEN
```

冷启动 / restart 路径没有这个问题，因为 restart 会重新建立 ephemeral fiber，首次 mount 失败可以直接得到 `unreachable`。

---

# 2. upstream 可依赖的公开行为

当前 DSH upstream MCP client 的公开/稳定行为可作为本轮 zero-core 设计基础：

## 2.1 Reconnect policy 是公开配置

`mcp-client` 支持：

```ts
reconnect?: {
  enabled?: boolean
  initialDelayMs?: number
  maxDelayMs?: number
  maxAttempts?: number
}
```

默认值为：

```text
initialDelayMs = 500 ms
maxDelayMs     = 30 s
maxAttempts    = 10
```

默认 backoff 序列约：

```text
0.5, 1, 2, 4, 8, 16, 30, 30, 30, 30 s
```

总 backoff = **151.5 s**，不含每次连接尝试本身耗时。

## 2.2 Budget exhaustion 会撤销 tools

supervisor 在重连预算耗尽后会：

```text
unregister this MCP server's registered tools
```

并停止继续 reconnect。

恢复只能依靠 plugin/HMR/reload 或重新创建 MCP client instance。

## 2.3 ToolRuntime 有公开读取面

`ctx.tools` 提供公开 API：

```ts
get(name, scope?)
schemas(scope?)
```

以及公开：

```text
tools/change
```

事件。

因此插件可以在 **不读取 upstream 私有 state** 的情况下观察：

```text
mcp__<serverName>__*
```

是否仍存在于该 Agent 的 public tool surface。

---

# 3. 设计原则

## 3.1 不伪装成“实时 connection liveness”

本实现检测的是：

> **upstream supervisor 已确认无法恢复后，模型可见 MCP capability surface 是否仍存在。**

不要把它命名成：

```text
transportConnected
socketAlive
connectionLiveness
```

建议命名为：

```text
publicToolSurfacePresent
confirmedCapabilityLoss
mcpOperationalWitness
```

原因是 ToolRuntime surface 是 capability-level witness，不是 transport-level truth。

## 3.2 Grace period 内允许 optimistic availability

在 upstream reconnect budget 尚未耗尽时：

```text
fiber exists
tools still registered
```

插件无法从公开 seam 区分：

```text
connected
```

和：

```text
temporarily disconnected + reconnecting
```

因此 core=0 下必须接受：

```text
grace window 内 readiness 仍可能是 reachable
```

这不是实现 bug，而是 public seam 的观测上限。

## 3.3 Confirmed loss 后必须回收 exhausted fiber

只把 readiness 改为 `unreachable` 不够。

upstream budget exhaustion 后 supervisor 已停止 reconnect，但：

```text
state.mcpFibers.has(name) === true
```

仍可能成立。

而当前 reconcile 又只会 mount：

```js
!state.mcpFibers.has(server.name)
```

如果不回收，server 会进入：

```text
upstream 不再重试
+
plugin 因 fiber 仍存在也不重挂
=
永久死槽
```

因此 confirmed loss 必须触发：

```text
dispose old exhausted fiber
delete state.mcpFibers[name]
mark materialization failed
start plugin cooldown
```

## 3.4 Plugin-initiated removal 不能误报为 runtime loss

policy deny、team teardown、agent close、正常 reconcile dispose 都会导致 MCP tools 消失。

必须区分：

```text
unexpected public surface withdrawal
```

与：

```text
plugin intended disposal
```

否则会产生伪 `capabilityLost` / `mount-failed` telemetry。

---

# 4. 推荐架构

## 4.1 两级 owner

### Level 1 — upstream supervisor

负责：

```text
connected
→ transient disconnect
→ bounded reconnect
→ success
```

此时 dsh-agent-team 不重建 fiber。

### Level 2 — dsh-agent-team

只在 upstream 明确 exhausted 后接管：

```text
tools withdrawn
→ confirmed loss
→ BLOCK required work
→ retire exhausted supervisor
→ plugin cooldown
→ later rematerialize
```

完整状态机：

```text
                 ┌──────────────────────┐
                 │      mounted         │
                 │ fiber + tool surface │
                 └──────────┬───────────┘
                            │ transport loss
                            ▼
                 ┌──────────────────────┐
                 │ reconnect grace      │
                 │ fiber still exists   │
                 │ tools still visible  │
                 └──────┬────────┬──────┘
                        │        │
              reconnect│        │budget exhausted
                success│        ▼
                        │  ┌──────────────────────┐
                        │  │ public tools absent  │
                        │  │ confirmed loss       │
                        │  └──────────┬───────────┘
                        │             │
                        │             ▼
                        │  readiness = unreachable
                        │             │
                        │             ▼
                        │      requirement BLOCK
                        │             │
                        │             ▼
                        │      retire old fiber
                        │             │
                        │             ▼
                        │    plugin cooldown/failed
                        │             │
                        └─────────────┤ later boundary
                                      ▼
                                  remount
```

---

# 5. 产品代码改动

## 5.1 `packages/runtime/src/plugin/live/agent-bindings.mjs`

这是本轮主要 owned surface。

### A. 显式传入短 reconnect policy

当前 mount 类似：

```js
state.mcpMountCtx.plugin(mcpClient, {
  transport: 'streamable-http',
  serverName: server.name,
  url: ...,
  headers: {},
  toolCallTimeoutMs: 15_000,
  failOnStartupError: true,
})
```

改为显式：

```js
state.mcpMountCtx.plugin(mcpClient, {
  transport: 'streamable-http',
  serverName: server.name,
  url: ...,
  headers: {},
  toolCallTimeoutMs: 15_000,
  failOnStartupError: true,
  reconnect: {
    enabled: true,
    initialDelayMs: 500,
    maxDelayMs: 2_000,
    maxAttempts: 3,
  },
})
```

不要依赖 upstream default。

将数值提取为插件 owned constants，例如：

```js
const MCP_UPSTREAM_RECONNECT_INITIAL_MS = 500
const MCP_UPSTREAM_RECONNECT_MAX_MS = 2_000
const MCP_UPSTREAM_RECONNECT_ATTEMPTS = 3
```

并在注释中明确：

```text
这是 transient-failure grace policy，不是 plugin remount cooldown。
```

现有 `MCP_RETRY_COOLDOWN_MS = 30_000` 属于另一层语义，不要混淆。

---

### B. 增加 public tool-surface witness

在每个 Agent 的 MCP ephemeral state 中记录最小必要信息。

建议：

```ts
mcpToolWitness: Map<
  string,
  {
    everToolBearing: boolean
    lastObservedNames: readonly string[]
  }
>
```

或者实现等价结构。

成功 `await fiber` 后，用 **public ToolRuntime API** 在该 Agent scope 上读取当前 schema：

```text
ctx.tools.schemas(scope)
```

过滤：

```text
mcp__${serverName}__*
```

记录当前 public names。

禁止：

- 读取 `ToolRuntime` 私有 map；
- import upstream `mcp-client/src/connection.ts` 私有实现；
- 读取 fiber 内部未公开字段；
- monkey patch `startConnection`；
- patch `references/deepseek-harness-test-use`。

### Witness 规则

如果一次成功 mount 后观察到 `>= 1` 个该 server tool：

```text
everToolBearing = true
```

则后续可以使用“整个 server-qualified public tool surface 消失”作为 confirmed-loss witness。

如果成功 mount 后就是 0 tools：

```text
everToolBearing = false
```

本轮不得把“0 tools”自动解释成 transport dead。

该 server 的 live-disconnect 判断能力应显式降级为：

```text
observation unavailable / unknown
```

不要伪造 `unreachable`。

> 若未来需要支持 resource-only MCP，应建立独立 readiness strategy；不要在本轮通过猜测扩展。

---

### C. 增加 confirmed-loss detector

新增小型 owned helper，建议职责：

```text
observeMcpOperationalWitness(state, serverName)
```

返回类似：

```ts
{
  verdict: 'reachable' | 'unreachable' | 'unknown',
  reason?: string,
  confirmedLoss?: boolean,
}
```

建议规则：

```text
1. no successful fiber / current materialization failed
   → 沿用现有状态

2. fiber exists
   + everToolBearing = true
   + server-qualified tool surface currently non-empty
   → reachable

3. fiber exists
   + everToolBearing = true
   + server-qualified tool surface currently empty
   + NOT intentional removal
   + server is still policy-targeted
   → unreachable
   → confirmedLoss = true
   → reason = MCP_PUBLIC_TOOL_SURFACE_WITHDRAWN

4. fiber exists
   + everToolBearing = false
   → unknown for live-loss observation
   （不要因为没有 tool 就判 dead）
```

注意：这里判断的是“capability operational witness”，不是 transport socket state。

---

## 5.2 Intentional removal suppression

在所有插件主动 dispose MCP fiber 的路径上增加 suppression。

例如 ephemeral state：

```ts
mcpIntentionalRemoval: Set<string>
closing: boolean
```

在正常 policy deny / close：

```text
add intentional-removal
→ dispose
→ delete fiber
→ clean witness
→ remove intentional-removal
```

confirmed-loss detector 在以下情形不得产生 runtime-loss telemetry：

```text
state.closing
server ∈ mcpIntentionalRemoval
server 已不在当前 policy target set
```

特别测试：

```text
policy allow → deny
```

只应产生 policy-driven unmount，不得额外产生：

```text
capabilityLost
mount-failed
MCP_PUBLIC_TOOL_SURFACE_WITHDRAWN
```

---

## 5.3 Exhausted fiber retirement

确认 public tool surface 已撤销后：

1. readiness 返回 `unreachable`；
2. 写一次 loss telemetry；
3. 将 materialization 写为 failed；
4. dispose old fiber；
5. 从 `state.mcpFibers` 删除；
6. 清除该 server 的 witness；
7. 保留 failed slot 的 `lastAttemptAt`，让现有 plugin cooldown 生效；
8. 后续 boundary 再由正常 reconcile 尝试 fresh mount。

建议将 retirement 做成 idempotent helper：

```text
retireExhaustedMcpFiber(serverName, reason)
```

要求：

```text
重复调用不重复 dispose
重复调用不重复写 capabilityLost
重复 boundary 不重复推进 attempt
```

### 推荐顺序

为了保证 request gate 在同一 boundary fail closed：

```text
boundary starts
→ observe MCP witness
→ confirmed loss
→ materialization = failed / readiness = unreachable
→ requirement evaluation
→ BLOCKED
→ cleanup/retirement 已完成或在同一 owned preparation step 完成
```

不要先把 fiber 删除后又因为 reconcile 立即 fresh mount，从而在同一个 boundary 把故障“洗掉”。

因此：

- confirmed-loss 时必须写 `failed.lastAttemptAt = now`；
- 现有 MCP plugin cooldown 必须阻止同 boundary remount。

---

# 6. `CapabilityReadinessProvider` 接线原则

相关目录：

```text
packages/runtime/readiness/
  provider.ts
  registry.ts
  status.ts
  telemetry.ts
  types.ts
```

本轮尽量不要让 generic readiness domain 直接依赖 DSH ToolRuntime。

推荐：

```text
CapabilityReadinessProvider
        ↑
MCP-specific production probe port
        ↑
agent-bindings MCP operational witness
        ↑
public ctx.tools surface
```

即：

- domain 层仍只认识 `unknown | reachable | unreachable`；
- DSH `ctx.tools` 细节留在 plugin/live adapter；
- 不把 `mcpFibers`、tool prefix、Cordis scope 等泄漏进 generic domain types。

如需新增 reason code，可加插件 owned evidence，例如：

```text
MCP_PUBLIC_TOOL_SURFACE_WITHDRAWN
MCP_LIVE_WITNESS_UNAVAILABLE
```

不要把它们伪装成 upstream error code。

---

# 7. 是否使用 `tools/change`

## 第一版建议：**不要让 `tools/change` 直接改变业务状态**

`ctx.tools` 确实提供 public `tools/change`，但 upstream `syncTools()` 在一个 successful generation swap 中会：

```text
dispose previous registrations
→ register new generation
```

中间会产生 registry change。

如果 listener 在第一条 change 时立即把“暂时为 0”解释成 loss，会产生假阳性。

### 推荐 V1

以 **request boundary pull-probe** 为权威：

```text
boundary
→ query public ToolRuntime
→ stable observation
→ readiness decision
```

这已经满足 requirement gate 的实际需要，而且比 event-driven mutation 更容易证明。

### 可选 V1.1 优化

如确实希望 UI/telemetry 在 boundary 前尽快感知，可以订阅：

```text
tools/change
```

但只能把它当作：

```text
dirty / recheck-needed signal
```

不得直接判 `unreachable`。

即：

```text
tools/change
→ mark MCP witness dirty
→ coalesced/deferred probe
```

且最终仍必须由同一 canonical probe 判定。

---

# 8. Timing / SLO 定义

不要继续使用默认 upstream 10 次、最大 30 s backoff，因为它会带来约 151.5 s 的纯 backoff 延迟。

采用：

```text
500 ms, 1 s, 2 s
```

三次 reconnect grace。

定义两个指标：

## 8.1 `reconnect-backoff-budget`

必须可静态计算：

```text
≤ 3.5 s
```

## 8.2 `confirmed-loss-observation-latency`

真实 wall-clock：

```text
transport failure time
+ 3.5 s backoff
+ connect/handshake failure durations
+ 到下一 protected boundary 的等待时间
```

本轮 real-host kit 必须记录实际时间，但不要把 3.5 s 等同于完整 wall-clock SLO。

如果实测 localhost mini-MCP 永久下线后稳定在数秒内完成 exhaustion，可以记录 empirical median/max，但不要将其提升为跨 transport 的强契约。

---

# 9. 测试计划

## 9.1 Characterization RED：先证明现有缺口

新增测试前先固定当前 bug：

```text
MCP mounted
→ kill server
→ fiber remains
→ old readiness probe still says reachable
```

该 RED 必须清楚证明：

```text
fiber existence != live operational capability
```

不要通过 mock “直接删除 fiber”伪造问题。

---

## 9.2 Unit：reconnect config

新增/扩展测试，断言每个 production MCP mount 显式带：

```ts
reconnect: {
  enabled: true,
  initialDelayMs: 500,
  maxDelayMs: 2000,
  maxAttempts: 3,
}
```

防止后续又无意回退到 upstream defaults。

---

## 9.3 Unit：public witness

建议新增：

```text
packages/runtime/test/mcp-live-loss-detection.test.ts
```

至少覆盖：

### L1 正常

```text
fiber present
+ tool prefix present
→ reachable
```

### L2 permanent loss

```text
previously tool-bearing
+ fiber still present
+ tool prefix absent
+ still policy-targeted
→ unreachable
→ confirmedLoss
```

### L3 zero-tool server

```text
successful mount
+ never observed tool
→ NOT unreachable
→ unknown / observation unavailable
```

### L4 intentional deny

```text
policy removes server
→ tools disappear
→ NO runtime loss telemetry
```

### L5 close / teardown

```text
agent closing
→ tools disappear
→ NO runtime loss telemetry
```

### L6 idempotence

```text
same confirmed loss observed on repeated boundary
→ one retirement
→ one loss telemetry
→ no duplicate disposal
```

### L7 remount

```text
confirmed loss
→ fiber removed
→ failed cooldown
→ after cooldown fresh mount
→ mounted
→ restored telemetry
```

---

## 9.4 Re-sync transient regression

非常重要。

upstream successful tool generation swap 会先：

```text
dispose old tools
```

再：

```text
register new tools
```

因此测试：

```text
live server
→ tools list changes
→ upstream successful re-sync
→ final server-qualified surface remains non-empty
→ MUST NOT classify as capability loss
```

如果本轮只采用 boundary pull-probe，此项应自然通过；仍要固定测试防未来 event watcher 回归。

---

## 9.5 Existing multi-MCP regressions

至少保持：

```text
packages/runtime/test/multi-mcp-wiring.test.ts
packages/runtime/test/capability-readiness-provider.test.ts
packages/runtime/test/capability-runtime-status.test.ts
packages/runtime/test/capability-telemetry.test.ts
```

原有：

```text
A healthy + B failed
```

per-server isolation 语义不得退回 all-or-nothing rollback。

---

# 10. F15 Real-Host 验收

新增独立 real-host kit，或扩展现有：

```text
tests/kits/pr-c-mcp-isolation-smoke/
```

但建议 F15 单独目录，避免污染已封存的 PR-C evidence：

```text
tests/kits/f15-mcp-live-loss-smoke/
```

必须使用：

- pristine DSH test-use；
- plugin production build；
- 真实 `mcp-client`；
- 真实 mini-MCP HTTP server；
- 真实 Agent request boundary；
- public tool registry；
- 不 monkey patch supervisor；
- 不读取 internal client state。

## F15-R1 transient recovery

```text
1. MCP online + mounted
2. kill MCP
3. 在 3-attempt budget exhaust 前恢复
4. upstream reconnect succeeds
5. next protected boundary remains admitted
6. SAME fiber 未被 plugin recycle
7. no capabilityLost / mount-failed caused by live-loss detector
```

证明 grace window 有价值，不会把瞬态抖动升级成 hard failure。

## F15-R2 permanent loss

```text
1. MCP online + mounted
2. verify mcp__<name>__* visible
3. permanently kill MCP
4. wait until upstream reconnect budget exhausts
5. verify public tool surface withdrawn
6. trigger next protected boundary
7. requirement gate BLOCKED
8. readiness = unreachable
9. old fiber retired
10. state.mcpFibers no longer holds exhausted entry
11. exactly one durable loss telemetry
```

这是新的 R1 权威验收。

## F15-R3 recovery after confirmed loss

```text
1. start from R2 failed state
2. restart MCP
3. before plugin cooldown expires: still blocked / no hot retry loop
4. after cooldown + next boundary
5. plugin fresh-mounts a NEW MCP client instance
6. tools restored
7. readiness reachable
8. requirement gate opens
9. mount-restored / capabilityRestored telemetry exactly once
```

## F15-R4 policy deny is not runtime loss

```text
mounted
→ durable policy denies MCP
→ plugin intentionally disposes
→ tools disappear
```

断言：

```text
NO capabilityLost
NO MCP_PUBLIC_TOOL_SURFACE_WITHDRAWN incident
```

## F15-R5 restart path

继续保留：

```text
cold/restart
→ no fabricated failed state before first reconcile
→ fresh probe/mount
```

不得因新 witness state 引入 stale durable restoration。

`mcpToolWitness` 必须是 ephemeral，不要持久化为 authority。

---

# 11. Telemetry 语义

现有：

```text
capability-runtime-event
```

继续使用。

建议区分：

## mount-time failure

```text
event = mount-failed
source = mcp-fiber
```

## live capability loss

如果现有闭集允许 `capabilityLost`，优先：

```text
event = capability-lost
source = mcp-public-tool-surface
reason = MCP_PUBLIC_TOOL_SURFACE_WITHDRAWN
```

若 frozen schema 已限定 event vocabulary，不要为了命名好看破坏兼容；使用既有最接近的 event，并在 reason/source 中保留区分。

要求：

```text
confirmed loss exactly once
fresh remount recovery exactly once
timestamps monotonic
attempt counters do not double-increment
```

---

# 12. 数据与 authority 边界

以下 state 必须保持 **ephemeral**：

```text
mcpFibers
mcpToolWitness
mcpIntentionalRemoval
live public tool presence
reconnect/exhaustion observation
```

以下可以 durable：

```text
capability-runtime-event telemetry
```

但 durable telemetry 只是历史证据，不得在 restart 时直接恢复为：

```text
“当前 MCP 一定 unreachable”
```

restart 后仍按：

```text
unknown
→ fresh reconcile/probe
```

重建 live truth。

---

# 13. 不做的事情

本轮明确禁止：

1. patch DSH upstream；
2. 修改 `references/deepseek-harness-test-use`；
3. private import `mcp-client/src/connection.ts` 并读取内部 `client` / `connectedAt`；
4. reflection / property guessing；
5. monkey patch upstream `startConnection`；
6. 把 process existence / fiber existence 再包装成“connection alive”；
7. 为了满足旧 R1 测试而人为 kill/dispose fiber；
8. 把 3.5 s backoff 宣称为完整 wall-clock detection upper bound；
9. 将 zero-tool MCP 误判为 dead；
10. 让 policy-driven unmount 产生 runtime-loss telemetry；
11. 在 confirmed loss 后保留 exhausted fiber，造成永久死槽；
12. 修改 #38–#42 已完成的设计边界来“顺手重构”。

---

# 14. PR / Git 策略

本问题不应回写、重写或 force-push PR #38–#42。

建议新开一个 focused follow-up：

```text
feat/pre-alpha3-f15-mcp-live-loss
```

基于当前 pre-alpha.3 integration 最新 tip；若 #38–#42 尚未合并，则按现有 stacked discipline 叠在最新 stack tip 上。

建议单 PR、三阶段 commit：

### Commit 1 — characterization + RED

- 固定 fiber-vs-liveness gap；
- 固定 upstream public tool-withdrawal witness；
- 不改 product behavior。

### Commit 2 — product closure

- explicit short reconnect policy；
- public witness；
- confirmed-loss classification；
- intentional-removal suppression；
- exhausted-fiber retirement；
- unit tests GREEN。

### Commit 3 — F15 real-host evidence

- transient recovery；
- permanent loss；
- blocked next boundary；
- post-loss remount；
- policy deny negative；
- restart negative；
- full gate evidence。

---

# 15. 静态与全量门禁

至少执行：

```text
typecheck
build
build:composition
check:artifacts
```

以及：

```text
focused readiness/MCP tests
multi-mcp wiring tests
root/full suite against existing baseline
```

判据：

```text
新增真实失败集合 = ∅
```

现有 known test debt 必须按当前 baseline 逐项比对，不得用“总失败数相同”替代 failure-set comparison。

同时：

```text
git status on pristine test-use = clean
CORE PATCH BUDGET = 0
:3080 不触碰
测试端口全部 teardown
```

---

# 16. 最终验收清单

只有以下全部满足才能把 F15 标记 COMPLETE：

- [ ] production MCP mount 显式配置短 reconnect grace；
- [ ] 不依赖 upstream reconnect defaults；
- [ ] readiness 不再仅由 `mcpFibers.has(name)` 决定；
- [ ] 使用 public `ctx.tools` observation；
- [ ] transient reconnect 成功不会误报 loss；
- [ ] permanent loss 在 upstream exhaustion 后可被确认；
- [ ] confirmed loss 的下一 protected boundary 必须 BLOCK required work；
- [ ] exhausted fiber 被 dispose + delete；
- [ ] 不存在 permanent dead slot；
- [ ] plugin cooldown 阻止同 boundary / hot-loop remount；
- [ ] 后续 MCP 恢复能够 fresh remount；
- [ ] runtime-loss telemetry exactly once；
- [ ] restore telemetry exactly once；
- [ ] policy deny / agent close 不会伪造 runtime loss；
- [ ] zero-tool MCP 不被误判为 unreachable；
- [ ] restart 不从历史 telemetry 伪造 live state；
- [ ] F15 transient/permanent/recovery/policy/restart real-host legs 全绿；
- [ ] existing multi-MCP isolation semantics 全绿；
- [ ] full suite 无新增真实失败；
- [ ] zero-core / pristine upstream / no private seam 全部满足。

---

# 17. 文档更新要求

完成后更新：

- `docs/STATUS.md`
- 当前 pre-alpha.3 active plan / F15 条目
- `dev/agent-workflow/graph.yaml`
- `dev/agent-workflow/SESSION_ROUTER_LOG.md`

并明确记录新的 R1 语义：

> 在 CORE PATCH BUDGET = 0 下，dsh-agent-team 不声明即时 transport liveness。  
> 对 tool-bearing MCP，live capability loss 以 upstream reconnect budget exhaustion 后 public server-qualified tool surface withdrawal 为 confirmed-loss witness；required capability 在下一 protected boundary fail closed。  
> Cold/restart failure 仍由 fresh mount probe 直接检测。

同时记录 remaining limitation：

> upstream 若未来公开 MCP connection-state snapshot/event，可把 R1 从 delayed confirmed-loss 升级为 immediate next-boundary liveness；届时 public-tool witness 可降级为 fallback/compatibility path。

---

# 18. 给执行 Agent 的优先级

按以下顺序执行，不要跳步：

```text
P0 读取仓库规则 / current plan / PR #40 MCP implementation
↓
P1 characterization：证明 stale-positive gap
↓
P2 固定新的 R1 contract
↓
P3 显式 short reconnect policy
↓
P4 public tool-surface witness
↓
P5 intentional-removal suppression
↓
P6 confirmed-loss → BLOCK + exhausted-fiber retirement
↓
P7 fresh remount recovery
↓
P8 focused unit/regression tests
↓
P9 F15 real-host five-leg gate
↓
P10 full suite / artifacts / zero-core / evidence
↓
提交 PR，等待用户 merge 裁决
```

发现需要 upstream private state 才能继续时，不得绕过约束；以：

```text
CORE_SEAM_BLOCKER
```

形式报告，并给出所缺最小 public seam，但不要修改 upstream。
