# PR #23 修复指导：MCP initial grant 收束 + multi-Team same-server 兼容适配

> 仓库：`ArmourPiercer1/dsh-agent-team`  
> 目标 PR：#23 `fix(mcp): make Blueprint template static mcp:allow the role's initial governance grant`  
> 当前分支：`fix/mcp-blueprint-initial-grant`  
> 当前审查基线：PR #23 head `d3a8cb4ed3ee59b9be164f34c13cb9c3e6625214`  
> 日期：2026-09-20

---

## 0. 本轮目标与冻结裁决

本轮不重做 PR #23 的核心设计。现有核心方向保留：

```text
Blueprint template capabilities.mcp.kind === 'allow'
        ↓
template/static initial governance grant
        ↓
record-backed overlay / human override
        ↓
external hard policy
        ↓
actual MCP mount
```

冻结以下产品语义：

1. Blueprint 中**显式 `allow` 的 MCP**是角色的初始 governance grant。
2. `deny`、未来的 `ask` 或任何其他非 `allow` 状态**不得**被初始化逻辑自动转换为 grant。
3. initial grant 是 immutable bound Blueprint 的静态层，不制造 synthetic durable override。
4. 后续 Leader / Member mutation、Human override 与 external hard policy 的既有 precedence 不变。
5. 同一个 DSH 进程中的多个 live Team，**设计上必须允许使用同一个逻辑 MCP server name**。
6. 但本轮**不把“多 live Team 稳定运行”纳入完整验收范围**：
   - 做必要的作用域兼容适配；
   - 不建设大规模 multi-Team matrix；
   - 本轮 release gate 只要求单 live Team 路径稳定。
7. 不通过给 `serverName` 加 root/session 后缀解决冲突。逻辑 MCP identity 与模型可见名称必须保持稳定：

```text
mcp__<serverName>__<tool>
```

---

# 1. 当前 PR #23 必须修复的两个确定性问题

## P1-A：`resolveConsumptionViews(sessionId)` 对动态 Team root 使用了错误的 fallback

### 当前问题

PR #23 中：

```js
const teamRoot =
  teamRootSid !== undefined
    ? String(teamRootSid)
    : rootSid
```

这意味着任何只提供 `sessionId` 的读取路径都会回退到 row 的 boot root。

已有 harness state 路径就是：

```js
teamRoot.live.resolveConsumptionViews(sid)
```

没有传 `teamRootSid`。

因此动态创建 Team 的实际 MCP 已经 mounted，但 diagnostics 重新计算时却可能：

```text
mounted = true
allowed = false
source = unspecified
deniedBy = unspecifiedFailClosed
```

最终 real-host evidence 已经出现了这个矛盾，并伴随：

```text
capability-template-unresolved ... template-not-found
```

### 必须修复

`resolveConsumptionViews()` 不得把“参数没传 root”解释为“属于 boot root”。

推荐统一 ownership resolution：

```js
const explicitRoot =
  teamRootSid !== undefined ? String(teamRootSid) : undefined

const teamRoot =
  explicitRoot
  ?? existing?.teamRootSessionId
  ?? teamRootOfSession(sessionId)

if (teamRoot === undefined) {
  throw new Error(
    `p6t6 consumption: no owning team root for session '${sessionId}'`
  )
}
```

并在 `consumptionState` 中持久保存 process-local ownership：

```js
const state = {
  instanceId,
  teamRootSessionId: teamRoot,
  ...
}
```

### 所有后续读取都使用规范化后的 `teamRoot`

尤其是：

```js
domain.repositories.overrides.list(teamRoot)
instanceIdForSession(sessionId, teamRoot)
getBoundBlueprint(teamRoot)
locateTemplate(..., teamRoot, ...)
```

不要继续把原始 `teamRootSid`（可能为 `undefined`）传下去。

---

## P1-B：不要吞掉 bound-template resolution fault

PR #23 当前：

```js
let initialTemplateMcp
try {
  const grantTemplate = locateTemplate(...)
  ...
} catch {
  initialTemplateMcp = undefined
}
```

这个 catch 会把：

- 错 root；
- bound Blueprint 不可解析；
- templateId 丢失；
- template 不存在；

全部伪装成“没有 initial grant”。

这正是 P1-A 在 real-host evidence 中没有响亮失败的原因。

### 修改原则

**身份 / bound-template 解析失败必须继续 fail loud。**

只允许“模板成功解析，但它本身不产生 initial grant”落到 `undefined`：

```js
const grantTemplate = locateTemplate(...)
const grantCaps = staticCapabilitiesOf(
  getBoundBlueprint(teamRoot),
  grantTemplate,
)

const initialTemplateMcp =
  grantCaps.mode === 'selective'
  && grantCaps.mcp.kind === 'allow'
  && grantCaps.mcp.items.length > 0
    ? grantCaps.mcp
    : undefined
```

不要 catch `locateTemplate()`。

如果确实需要捕获某个**可预期、非身份类**异常，应只捕获那一个确定错误类型/错误码；不要 `catch {}`。

---

# 2. 统一 initial MCP grant 的单一派生函数

当前 PR 已经在 glue 中写了一次判断：

```js
mode === 'selective'
&& mcp.kind === 'allow'
&& items.length > 0
```

接下来还需要让 `team_inspect_config` 和 activation step 8 使用相同语义。

为了避免三处复制，建议在：

```text
packages/domain/policy/src/static-capability-source.ts
```

增加一个很小的纯 helper。

建议接口：

```ts
export function initialMcpGrantOf(
  capabilities: StaticTemplateCapabilities,
): PolicyEntry | undefined {
  if (capabilities.mode !== 'selective') return undefined

  const entry = capabilities.mcp

  if (entry.kind !== 'allow') return undefined
  if (entry.items.length === 0) return undefined

  return entry
}
```

性质必须固定：

```text
legacy               -> undefined
deny                 -> undefined
allow([])            -> undefined
allow([A, B])        -> allow([A, B])
未来 ask/...         -> undefined
```

注意：

- 判断必须是**正向 `kind === 'allow'`**；
- 不要写成 `kind !== 'deny'`；
- 这样未来新增 `ask` 时不会发生 privilege expansion。

将该 helper 从 policy barrel 导出，供 glue / action-router / activation provider 共用。

---

# 3. 修复 `team_inspect_config`：产品读取必须与实际 MCP surface 一致

## 当前问题

`packages/runtime/action-router/effects.ts` 的 `INSPECT_CONFIG` 仍调用：

```ts
resolveActivationPolicy({
  rootSessionId: ctx.rootSessionId,
  instanceId: target.instanceId,
  overrides: ctx.repositories.overrides.list(ctx.rootSessionId),
  external,
})
```

没有提供 initial template MCP value。

因此可能出现：

```text
实际：
  mcp__A__ping 已 mounted、可调用

team_inspect_config：
  effective.mcp = unspecified / deny
```

这是产品可见的不一致。

## 修复

该路径已经能取得 target 的 bound template。

把 `boundTemplateOf()` 的返回类型改为真实 `BlueprintTemplate`（或至少包含完整 `capabilities`），然后：

```ts
const template = boundTemplateOf(ctx.blueprint, target)
const caps = staticCapabilitiesOf(ctx.blueprint, template)
const initialMcp = initialMcpGrantOf(caps)

policy = resolveActivationPolicy({
  rootSessionId: ctx.rootSessionId,
  instanceId: target.instanceId,
  overrides: ctx.repositories.overrides.list(ctx.rootSessionId),
  external,
  ...(initialMcp !== undefined
    ? { templateValues: { mcp: initialMcp } }
    : {}),
})
```

### 验收

至少增加一个 focused test：

```text
Blueprint mcp allow[A]
overrides=[]
team_inspect_config
=> effective.mcp == allow[A]
```

再加一个 deny/legacy 对照即可，不需要新建大矩阵。

---

# 4. 同步 activation step 8，避免同一 resolver 出现两套初始语义

文件：

```text
packages/runtime/activation/provider.ts
```

当前 step 8 同样未传 `templateValues.mcp`。

虽然当前返回结果主要消费 `policyStateId`，暂时未直接造成 MCP mount bug，但留下：

```text
MCP consumption resolver：有 initial grant
activation policy：没有 initial grant
inspect-config：修后有 initial grant
```

三条路径语义不统一。

本轮应顺手统一。

provider 在 step 3 已经拿到了 resolved `template`，因此：

```ts
const caps = staticCapabilitiesOf(blueprint, template)
const initialMcp = initialMcpGrantOf(caps)

const policy = resolveActivationPolicy({
  rootSessionId,
  instanceId: identity.instanceId,
  overrides: repositories.overrides.list(rootSessionId),
  external,
  ...(initialMcp !== undefined
    ? { templateValues: { mcp: initialMcp } }
    : {}),
})
```

不修改其他 capability 的 activation semantics。

---

# 5. glue 中改为复用统一 helper

文件：

```text
packages/runtime/src/plugin/live/agent-bindings.mjs
```

将当前手写：

```js
grantCaps.mode === 'selective'
&& grantCaps.mcp.kind === 'allow'
&& grantCaps.mcp.items.length > 0
```

替换为：

```js
const initialTemplateMcp = initialMcpGrantOf(grantCaps)
```

前提是 bound template 已成功解析。

最终应形成单一规则：

```text
staticCapabilitiesOf(...)
       ↓
initialMcpGrantOf(...)
       ↓
resolveActivationPolicy(templateValues.mcp)
```

三个生产消费者全部共用：

1. MCP live consumption；
2. `team_inspect_config`；
3. activation step 8。

---

# 6. multi-Team same-server：本轮做作用域兼容适配，但不做完整 multi-Team 验收

## 6.1 根因方向

DSH `mcp-client` 的 duplicate `serverName` 约束不是进程全局设计。

上游逻辑是：

```ts
const owner = scopeOf(ctx) ?? ctx.root
```

并按 `owner` 保存 active server names。

也就是说，上游预期：

```text
Agent A scope: serverName=x   ✓
Agent B scope: serverName=x   ✓

同一 Agent scope:
  x + x                  ✗ duplicate
```

因此**正确适配是保证 MCP client 挂载在真正的 Agent scope 上**，而不是改逻辑 `serverName`。

当前插件已明确知道一个兼容性事实：

> 插件自己的 `@deepseek-ai/dsh-scope` module instance 与 host Agent 创建 Agent scope 时使用的 module instance 可能不同；由于 scope tag 是 module-private Symbol，`scopeOf(agentCtx)` 可能读不到已经存在的 Agent scope。

这正是同名 MCP 最可能退化到：

```ts
owner = ctx.root
```

从而产生跨 Agent / 跨 Team serverName 冲突的原因。

---

## 6.2 推荐最小适配：给 MCP mount 建一个“同 Agent identity 的 scope bridge”

当前 `agentSetup(agentCtx, setupAgent)` 已经能可靠取得：

```js
const runtimeAgent = resolveSetupAgent(agentCtx, setupAgent)
```

对 DSH 0.1.5+，`setupAgent` 是权威 Agent identity。

在 `@deepseek-ai/dsh-scope` import 中增加：

```js
import { createScope, scopeOf } from '@deepseek-ai/dsh-scope'
```

### 建立 bridge

在 setup 时，只为 MCP mount 建一个 compatibility scope：

```js
let mcpMountScope
let mcpMountCtx = agentCtx

if (
  runtimeAgent !== undefined
  && scopeOf(agentCtx) !== runtimeAgent
) {
  mcpMountScope = createScope(agentCtx, runtimeAgent)
  mcpMountCtx = mcpMountScope.ctx
}
```

核心点：

- key 使用**真实 `runtimeAgent` 对象**；
- 不使用 rootSessionId 字符串作为 scope key；
- 不创建一个新的“Team MCP identity”；
- 逻辑 owner 仍然是 Agent；
- `serverName` 保持原值。

把它保存进 consumption state：

```js
const state = {
  ...
  mcpMountCtx,
  mcpMountScope,
}
```

然后：

```js
reconcileMcpSet(state, targetServerNames)
```

内部 mount 改为：

```js
const fiber = state.mcpMountCtx.plugin(mcpClient, {
  serverName: server.name,
  ...
})
```

而不是每次外部再传裸 `agentCtx`。

### 为什么使用同一个 `runtimeAgent` key

这个 bridge 的目的不是创建“子 Agent scope”，而是让插件侧 / mcp-client 侧能看到与 host Agent scope**相同的逻辑 owner identity**。

不要使用：

```js
createScope(agentCtx, { rootSessionId, serverName })
```

因为那会创建新的 scope key，并可能让 MCP 注册落到 Agent 下面不可见的子层。

应使用：

```js
createScope(agentCtx, runtimeAgent)
```

即使 host scope 与 plugin scope 来自不同 module instance，两边看到的 scope key 最终仍是**同一个 Agent 对象**。

---

## 6.3 生命周期

不需要为这个适配引入新的复杂 owner registry。

推荐：

- bridge scope 在 `agentSetup` 生命周期内创建；
- `mcpMountScope` 是 Agent scope 的 child fiber；
- 单个 MCP server 仍由现有 `mcpFibers` 单独 dispose；
- Agent teardown 会结构性 dispose bridge；
- `close()` 仍先 dispose live agent；
- consumption state clear 时不需要额外创造第二套持久化状态。

如希望更明确，可在 state cleanup 时 best-effort：

```js
await state.mcpMountScope?.dispose()
```

但不要同时形成两个互相竞争的 teardown owner。

选择一种 owner：

```text
Agent lifecycle owns bridge
bridge owns MCP fibers
```

即可。

---

# 7. 不允许的 multi-Team 修法

本轮禁止以下快捷方案。

## 7.1 禁止给 serverName 加 root/session 后缀

不要：

```text
mcp_signal
→ mcp_signal__team_123
```

因为模型工具名会变成：

```text
mcp__mcp_signal__team_123__ping
```

这会破坏 Blueprint 中逻辑 MCP identity 的稳定性。

## 7.2 禁止“全 Team 共享一个单例 MCP fiber”

不要为了绕过 duplicate name 把所有 Team 指向一条全局 MCP client fiber。

原因：

- tool registration scope 会失去 Agent 隔离；
- per-role MCP allow 无法可靠 materialize；
- dynamic deny / unmount 会产生跨 Team 影响。

## 7.3 禁止 patch DSH core

继续保持：

```text
CORE PATCH BUDGET = 0
```

上游已经有 per-Agent namespace 语义；插件只需要正确接入它。

---

# 8. 测试要求：本轮不要扩大成 multi-Team 稳定性项目

用户裁决：

> 多 live Team 使用同一个 MCP server 是目标语义，但当前版本尚未验证多 live Team 整体稳定性。本轮只做兼容适配，不需要建立大量 multi-Team 测试。

因此测试分两级。

---

## 8.1 必须：单 live Team 稳定性

保留 PR #23 已有 zero-seed real-host smoke，但修正验收条件。

### fresh root

必须同时成立：

```text
mounted === true
allowed === true
source === {
  layer: "template",
  origin: "static",
  recordId: null
}
deniedBy ABSENT
```

不能只检查 `mounted === true`。

### model surface

首轮 initial work 必须仍能真实调用 MCP 并得到 pong。

### next boundary

第二轮/下一 boundary MCP 仍存在。

### dynamic tighten

已有：

```text
human override deny
→ next boundary
→ unmount
```

必须继续通过。

### cold resume

已有 cold-resume gate 继续通过。

### legacy

无 capabilities 时继续零挂载。

---

## 8.2 必须：修掉当前 evidence 中的内部矛盾

最终 smoke 的 state 中不得再出现：

```text
mounted=true
allowed=false
```

对于 initial-grant mounted server，必须是：

```text
mounted=true
allowed=true
source=template/static
```

并且：

```text
observations
```

中不得出现针对正常动态 root 的：

```text
capability-template-unresolved
```

---

## 8.3 轻量：same-server scope compatibility probe

**不需要**做完整的双-Team workflow / member / restart / mutation matrix。

只加一个很小的 probe 即可，目标不是宣称“multi-Team fully supported”，而是防止本轮适配退化。

推荐任选一种。

### 方案 A：in-process 双 Agent scope（优先）

构造两个独立 Agent scope：

```text
Agent A
Agent B
```

都尝试 mount：

```text
serverName = "same-mcp"
```

验证：

```text
第二个 mount 不因 duplicate serverName 失败
```

不需要跑完整 Team 创建。

### 方案 B：real-host 极小 characterization

如果 A 很难接现有 doubles，可在现有 smoke 里只加一个非 Gate 主场景：

```text
创建两个 root
两者 Blueprint 都 allow 同一个 A
只验证第二个 MCP setup 不抛 duplicate serverName
```

不需要测试：

- 并发消息；
- members；
- restart；
- mutation；
- long-running stability。

### 结果措辞

即便该 probe 通过，也只能记录：

```text
same-server namespace collision adapted / characterized
```

不得宣称：

```text
multi-live-Team stability verified
```

后者留给独立后续测试任务。

---

# 9. `team_inspect_config` focused regression

新增最小测试即可。

### T1 allow

```text
target template:
  mcp allow[A]

overrides=[]
```

预期：

```json
{
  "effective": {
    "mcp": {
      "kind": "allow",
      "items": ["A"]
    }
  }
}
```

### T2 legacy / deny

只需任选一个对照，确认不会误授予。

不需要新建完整 action-router matrix。

---

# 10. 保留 `sessionIsDurable()` 修复

PR #23 对：

```text
session.jsonl[.zstd]
session.vN.jsonl[.zstd]
```

的识别是正确且有 upstream 契约支持的。

本轮不要回滚。

保留已有 G3V / cold-resume regression。

---

# 11. 不处理 fresh first-turn 双请求工具面竞态

PR #23 发现：

```text
fresh session 首 turn 可能有两次 model request
其中一次 tools=[]
另一次 tools=完整
```

本轮不继续扩 scope 修复。

原因：

- initial work 已经真实成功调用 MCP；
- 这是独立的 DSH / assembly 时序问题；
- 与 MCP initial governance truth 已可分离。

保留 finding，但 smoke 不应只用 `fullest-of-turn` 掩盖 governance 状态错误。

必须同时有：

```text
state:
  allowed=true
  source=template/static

实际 tool call:
  pong
```

两层证据。

---

# 12. 建议实施顺序

## Step 1 — 先修 root ownership

修改 `resolveConsumptionViews()`：

```text
explicit root
→ state-owned root
→ teamRootOfSession()
→ unresolved = fail loud
```

同步把 normalized root 传给 bound-blueprint / template / overrides 全链。

删除 broad catch。

先跑现有 initial-grant in-process tests。

---

## Step 2 — 建 initial grant 单一 helper

新增：

```ts
initialMcpGrantOf(...)
```

替换 glue 手写逻辑。

---

## Step 3 — 修 inspect-config + activation provider

三个生产消费者全部统一：

```text
staticCapabilitiesOf
→ initialMcpGrantOf
→ resolveActivationPolicy(templateValues.mcp)
```

---

## Step 4 — 加 Agent-scope MCP bridge

使用 explicit `runtimeAgent` 建兼容 scope。

保持：

```text
serverName = configured name
```

不改模型可见 namespace。

---

## Step 5 — focused tests

只补：

1. `resolveConsumptionViews` dynamic root ownership；
2. `team_inspect_config` initial mcp allow；
3. 一个轻量 same-server Agent-scope probe；
4. 现有单-Team initial grant / tighten / restart 回归。

不要新建大规模 multi-Team suite。

---

## Step 6 — real-host 单 Team final gate

建议 final gate 重点：

```text
fresh create
zero override
initial work directly calls MCP
state allowed=true + template/static
next request still available
human deny unmounts
restart behavior correct
legacy no-capabilities stays denied
```

如果为了 smoke 仍创建第二 root用于 cross-root blueprint isolation，可以保留；但**不把多-Team稳定性作为本轮 PASS 条件**。

---

# 13. 建议更新 PR body

删除/修正当前 finding：

```text
多 Team 共享 MCP server 需要每 root 独立 serverName
```

这不是我们接受的产品语义。

改为：

```text
PR 开发中发现：在当前插件装配方式下，mcp-client 的 Agent scope
可能因 @deepseek-ai/dsh-scope module-instance compatibility 问题退化到
ctx.root owner，从而使不同 Agent 的同名 serverName 错误冲突。

本 PR 增加 Agent-identity scope bridge，使 MCP mount owner 与 explicit
runtime Agent identity 对齐；保持逻辑 serverName 与模型工具 namespace
不变。

本轮只做 namespace/scoping 兼容适配，不宣称 multi-live-Team workflow
已完成稳定性验证；完整 multi-Team stability 留待后续独立测试任务。
```

---

# 14. 最终 DoD

以下全部成立后 PR #23 才进入下一轮 review：

- [ ] Blueprint `mcp.allow` 仍作为 `template/static` initial grant。
- [ ] `resolveConsumptionViews()` 不再默认把未知 session 归属到 boot root。
- [ ] dynamic Team root diagnostics 与实际 mounted surface 一致。
- [ ] 正常 dynamic root 不再产生 `capability-template-unresolved` observation。
- [ ] `team_inspect_config.effective.mcp` 与实际 initial grant 一致。
- [ ] activation step 8 使用相同 initial grant 语义。
- [ ] initial grant 的 `allow` 判定只有一份纯 helper。
- [ ] `deny` / legacy / empty allow / future non-allow 不自动 grant。
- [ ] Human/Leader overlay 与 external hard precedence 不变。
- [ ] MCP client mount owner 与 explicit runtime Agent identity 对齐。
- [ ] 不修改逻辑 `serverName`。
- [ ] 不引入全局共享 MCP fiber。
- [ ] 至少一个轻量 probe 表明两个 Agent 使用同一 `serverName` 不再因 namespace owner 错误而冲突；无需完整 multi-Team matrix。
- [ ] 单 live Team real-host initial work 可以直接调用 MCP。
- [ ] 单 live Team next-boundary、dynamic deny、cold resume 仍通过。
- [ ] legacy/no-capabilities 仍零挂载。
- [ ] `session.vN.jsonl[.zstd]` durability 修复保留。
- [ ] fresh first-turn 双请求竞态仅记录，不在本轮扩修。
- [ ] CORE PATCH BUDGET = 0。
- [ ] rebuilt dist / artifact freshness 通过。
- [ ] 不在本轮宣称“multi-live-Team stability verified”。

---

# 15. 给本地 Agent 的任务摘要

> 在 PR #23 现有分支上收束修复，不重做 initial-grant 设计：  
> ① 修复 `resolveConsumptionViews` 的 owning-root 推导，保存 `teamRootSessionId`，禁止未传 root 时默认 boot root，并删除吞掉 bound-template fault 的 broad catch；  
> ② 抽出唯一 `initialMcpGrantOf()` helper，仅 `kind==='allow' && items.length>0` 产生静态 grant；  
> ③ 让 MCP live consumption、`team_inspect_config`、activation step 8 共用这一派生，确保 effective view 与实际 mounted surface 一致；  
> ④ 使用 DSH 0.1.5+ `AgentSetup` 的 explicit runtime Agent identity，为 MCP mount 建立 Agent-keyed scope compatibility bridge，使不同 Agent / Team 可以保留同一个逻辑 `serverName`，禁止 root 后缀重命名、禁止全局共享 MCP fiber；  
> ⑤ 测试保持克制：只补 dynamic-root truth、inspect-config、一个轻量 same-server Agent-scope probe，并复跑现有单-live-Team fresh/next-boundary/deny/restart/legacy gates；本轮不宣称 multi-live-Team 稳定性完成。
