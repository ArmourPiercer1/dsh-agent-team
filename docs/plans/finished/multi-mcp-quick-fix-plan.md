# dsh-agent-team 多 MCP 挂载快速修复计划

> 目标：在不重做现有 capability / governance 体系的前提下，将 production MCP supply 从 `0|1` 个 server 泛化为 `0..N` 个 server，使不同 template / member 能真正获得不同的 MCP server 子集。
>
> 基线：当前 `master`（审查时 HEAD `b49f4239ff9378ac8041e5667402029b4dcd4ca4`）。  
> 修复性质：**cardinality completion / supply-side completion**，不是 MCP 权限系统重构。

---

## 0. 结论与修复边界

当前问题的准确结构是：

```text
现状

Production supply:
    mcpServer: 0 | 1
          │
          ▼
Per-template policy:
    capabilities.mcp = allow/deny(server names)
          │
          ▼
Per-instance durable governance:
    mcp cell = allow/deny(server names)
          │
          ▼
Live mount:
    one mcpView + one mcpFiber
```

下半部分已经是按 template / instance 工作的；真正的 blocker 是最上游只能供应一个 server，随后 live state 也被写成了单值。

本轮快速修复的目标是：

```text
目标

Production supply:
    mcpServers: 0..N
          │
          ▼
现有 capabilities.mcp
          │
          ▼
现有 durable mcp policy
          │
          ▼
per-server view + per-server fiber
```

### 明确不做

本轮不要顺手做以下重构：

- 不重做 Blueprint `capabilities.mcp` schema；
- 不仿照 `builtinToolDeny` 再造一套 MCP deny 机制；
- 不把 MCP tool 先全挂上再通过 `tools.restrict()` 隐藏；
- 不增加 MCP CRUD / UI / registry service；
- 不引入新的 durable MCP inventory；
- 不修改 governance override 的 `mcp` cell 语义；
- 不修改 `resolveDurableMcpFacet()` 的核心 policy 规则；
- 不为不同 member 启动独立 MCP server 进程；只控制其 Agent scope 是否 mount 某个已配置 server。

这能把修复控制在一个较小的 production-surface patch 内。

---

# 1. 问题是如何产生的？

## 1.1 最初 MCP 是一个“证明 public seam 可用”的 vertical slice

早期 P2-T4 / P5-T5 主要验证：

```text
agentCtx.plugin(mcpClient, config)
        ↓
streamable-http MCP 连接
        ↓
MCP tools 进入该 Agent surface
        ↓
fiber.dispose()
        ↓
tools 消失
```

当时只需要一个 `mini-mcp` 即可证明：

- Agent-scoped MCP mount 可行；
- tool namespace 正确；
- mount / dispose 生命周期可控；
- fresh / cold-resume 可以重建；
- 不需要修改 DeepSeek Harness core。

所以 harness 天然采用了单 server。

## 1.2 P8-S4B 把这个单 server 用作 durable-governance 闭环

P8-S4B 的目标是验证：

```text
durable override
    ↓
actual Agent behavior
```

MCP 被选作一个 G2 已验证的 capability facet，于是状态自然写成：

```text
mcpView
mcpFiber
mcpActivationError
```

其关注点是“allow → mount，deny → dispose”，不是 MCP inventory 的 cardinality。

## 1.3 P8-S5A 将验证形态 productize

之后 production composition 直接采用了：

```ts
mcpServer: { name, port } | null
```

因此原本只是测试 vertical slice 的 `0|1` cardinality 进入了 production row contract。

## 1.4 alpha.1 后来补齐了 per-template policy，但没有扩供给侧

alpha.1 已经实现：

```yaml
capabilities:
  mcp:
    kind: allow
    items:
      - mcp_signal
      - mcp_designer
```

并在真实 `agentSetup()` 中按当前 member 的 template 做：

```text
configured MCP names
        ∩
template capabilities.mcp
        ∩
durable mcp policy
```

其中 `filterMcpServers()` 从接口开始就是复数：

```ts
filterMcpServers(
  configuredServers: readonly string[],
  policy: PolicyEntry,
): string[]
```

但 production caller 始终传：

```ts
[config.mcpServer.name]
```

所以最终形成了：

```text
policy = set semantics
inventory = singleton semantics
```

### 修复裁决

这不是“一个 Team 在产品语义上只能有一个 MCP”的设计约束，而是：

> **minimal vertical slice 被 productize 后留下的 cardinality debt。**

因此本轮不应该重新设计 policy，只应补齐 supply + live-state cardinality。

---

# 2. 目标设计

## 2.1 配置契约：新增 `mcpServers`，保留单 server 兼容

为了快速修复同时避免破坏现有安装，建议不要直接删除 `mcpServer`。

目标输入：

```ts
interface TeamPluginMcpServer {
  readonly name: string
  readonly port: number | null
}

interface TeamPluginConfig {
  // legacy compatibility
  readonly mcpServer?: TeamPluginMcpServer | null

  // new canonical multi-server input
  readonly mcpServers?: readonly TeamPluginMcpServer[]
}
```

### 规范化规则

在 host config boundary 一次性规范化：

```text
mcpServers present
    -> use mcpServers

mcpServers absent + mcpServer object
    -> [mcpServer]

mcpServers absent + mcpServer null
    -> []

both absent
    -> []
```

如果 **`mcpServers` 与非 null `mcpServer` 同时存在**，建议 fail closed：

```text
TEAM_PLUGIN_CONFIG_INVALID
ambiguous MCP configuration
```

原因：不要建立“谁覆盖谁”的第二套隐式 precedence。

### 必须校验

- `mcpServers` 必须为 array；
- 每项必须是 `{name, port:number|null}`；
- `name` 非空；
- **server name 必须唯一**；
- 不要求 port 唯一；
- `[]` 合法，表示无 MCP。

> 唯一 server name 很重要，因为 MCP tool namespace 和 policy vocabulary 都以 `serverName` 为 identity。

### 兼容期

本轮建议：

- 保留 `mcpServer` 至少一个 alpha 版本；
- 新文档和新测试全部使用 `mcpServers`；
- legacy 单 server fixture 继续保留一条专门回归测试；
- 不批量改写历史 evidence 文件。

---

## 2.2 Runtime consumption：从一个 `mcpView` 改为 per-server views

当前：

```text
resolveConsumptionViews()
  -> modelView
  -> mcpView | null
```

目标：

```text
resolveConsumptionViews()
  -> modelView
  -> mcpViews: Map/Record<serverName, McpFacetView>
```

推荐对外返回 lossless-JSON 友好的普通对象：

```ts
mcpViews: Record<string, McpFacetView>
```

而 runtime ephemeral state 可以使用 `Map`。

伪代码：

```ts
const servers = configuredMcpServers(config)

const mcpViews = Object.fromEntries(
  servers.map(server => [
    server.name,
    resolveDurableMcpFacet({
      rootSessionId,
      instanceId,
      overrides,
      external,
      serverName: server.name,
      appliedRecordIds,
    }).view
  ])
)
```

### `resolveDurableMcpFacet()` 不改

它已经是：

```text
policy + serverName -> allowed?
```

天然可以针对 N 个 server 重复调用。

这正是本轮应该复用的现有语义。

---

## 2.3 Static template gate：直接使用现有集合接口

当前：

```ts
filterMcpServers(
  [config.mcpServer.name],
  capabilities.mcp
)
```

修改为：

```ts
filterMcpServers(
  configuredServers.map(s => s.name),
  capabilities.mcp
)
```

得到：

```text
templateAllowedNames
```

然后逐 server 与 durable view 做 AND：

```text
targetMounted(server) =
    templateAllowedNames contains server
    &&
    mcpViews[server].allowed
```

不要为多 MCP 添加第二个 policy resolver。

---

## 2.4 Live state：单 fiber 改为 server-keyed state

当前：

```text
state.mcpFiber
state.mcpActivationError
```

目标：

```text
state.mcpFibers: Map<serverName, Fiber>
state.mcpActivationErrors: Map<serverName, string>
```

生产逻辑只按 `serverName` 索引。

不要用数组下标做 identity。

---

## 2.5 Reconcile 语义：一次边界收敛到目标 server set

建议把：

```text
reconcileMcp(agentCtx, state, allowed:boolean)
```

改成：

```text
reconcileMcpSet(agentCtx, state, targetServerNames)
```

或等价 API。

### 推荐时序

为了保持 fail-closed：

1. 计算 `targetSet`；
2. **先 dispose 已 mounted 但不在 targetSet 中的 server**；
3. 对 `targetSet - mountedSet` 逐个 mount；
4. 本轮新 mount 的 fiber 先记录在 temporary set；
5. 如果任意一个 activation 失败：
   - dispose 本轮已经新 mount 的所有 fiber；
   - 不恢复刚刚因 deny 而 dispose 的 server；
   - 抛错，request/setup 不继续；
6. 全部成功后再将 temporary fibers commit 进 state。

这样满足：

```text
denied server 永远不会因另一个 MCP 启动失败而继续暴露
+
本轮新增 server 不会留下 partial mount
```

### 为什么不先 mount 再 dispose？

假设：

```text
旧状态 = {A}
新目标 = {B}
```

如果 B 启动失败，而先 mount 后 dispose，则 A 仍可能继续暴露，但 A 已经被新 policy deny。

安全语义上应优先移除不再允许的能力。

---

## 2.6 Boundary record bookkeeping

当前 `applyBoundaryRecords()` 接收一个 `mcpView`。

改为遍历所有 `mcpViews`：

```text
model pending
+
all MCP views pending
    ↓
Set(recordId)
```

同一个 durable override 会在多个 server view 中重复出现，现有 `Set<string>` 正好完成去重，不需要修改 durable schema。

---

## 2.7 Permission Coverage Gate

当前严格模式：

```text
pre-MCP surface snapshot
    ↓
MCP reconcile
    ↓
final surface snapshot
    ↓
delta = OTHER_MANAGED_MCP
```

这套逻辑本身已经支持多个 MCP。

只需要保证：

```text
一次 reconcile 完成所有目标 MCP server
```

之后再拍 final snapshot。

无需按 server 分别修改 coverage classifier。

但必须增加一条 multi-MCP regression test，证明两个 server 引入的 tools 都进入 `OTHER_MANAGED_MCP`，而不是 `UNKNOWN_UNMANAGED`。

---

# 3. 需要修改哪些部分？

## 3.1 必改 production files

### A. Plugin config contract

**Owner files**

```text
packages/runtime/src/plugin/types.ts
packages/runtime/src/plugin/host.ts
```

工作：

- 增加 `TeamPluginMcpServer` 类型；
- 增加 `mcpServers`；
- 保留 legacy `mcpServer`；
- 增加 multi-server validation；
- 增加 duplicate-name rejection；
- 建立唯一的 config normalization helper / normalized read path。

如果现有 host 直接把 raw validated config 传入 root，优先让“读取 configured MCP list”的 helper 成为唯一入口，不要在多个文件复制：

```text
mcpServers ?? (mcpServer ? [mcpServer] : [])
```

---

### B. Live Agent MCP runtime

**唯一 owner**

```text
packages/runtime/src/plugin/live/agent-bindings.mjs
```

工作：

- `resolveConsumptionViews()`：单 `mcpView` → `mcpViews`；
- consumption state：单 fiber/error → Map；
- static template gate 对全部 configured names 过滤；
- 实现 `reconcileMcpSet()`；
- boundary record 遍历所有 views；
- close/dispose 所有 MCP fibers；
- observation 中携带 `serverName`；
- request-boundary re-resolution 对每个 server 生效；
- cold resume 按 durable truth 重新建立 exact server set。

**不要同时让两个子任务编辑这个文件。**

这是本轮冲突最高、语义最集中的文件，应由一个 owner 完整负责。

---

### C. Test bridge / harness projection

主要涉及：

```text
packages/runtime/test/t12a-live-bridge.mjs
packages/runtime/test/t12a-live-bridge.d.mts
packages/tools/harness/plugin.mjs
```

工作：

- test double 允许记录多个 MCP plugin fibers；
- fixture config 支持 `mcpServers`；
- `/__p6t6/state` 的 MCP diagnostics 改为 per-server；
- 不再读取 `state.mcpFiber` / `views.mcpView` 单值。

建议 state diagnostic 形状：

```json
{
  "mcp": {
    "servers": {
      "mcp_signal": {
        "mounted": true,
        "allowed": true,
        "source": {},
        "pendingNextBoundary": []
      },
      "mcp_designer": {
        "mounted": false,
        "allowed": false
      }
    }
  }
}
```

这是 harness / diagnostics contract，不要求本轮升级 public Remote protocol。

---

## 3.2 应改 focused tests

```text
packages/runtime/test/t4a-capability-wiring.test.ts
packages/runtime/test/t12a-h1-nullable-mcp.test.ts
packages/runtime/test/p8s4b-mcp-facet.test.ts        # 主要做回归，不必改 resolver
packages/runtime/test/t12a-b3-external-deny.test.ts # 如引用单 mcpView，则适配
packages/runtime/test/a2c2-permission-coverage.test.ts
packages/runtime/test/t3-skills-mcp-adapter.test.ts # 原 pure filter 逻辑应继续绿
```

建议新增一个专门文件，而不是把所有 multi-MCP case 全塞进 t4a：

```text
packages/runtime/test/multi-mcp-wiring.test.ts
```

这样以后能单独跑快速回归。

---

## 3.3 文档 / sample config

至少改：

```text
docs/INSTALL.md
cordis.patch.yml                 # 若它承担用户可复制模板
```

视当前 authoring skill 内容决定是否补：

```text
.agents/skills/team-blueprint-authoring/SKILL.md
```

但 Blueprint capability 本身没变，因此不要把文档修改扩大成一次 skill 重构。

---

## 3.4 不要修改的核心模块

除非测试证明有真实 blocker，否则以下模块应保持不动：

```text
packages/runtime/agent-setup/capability/mcp-facet.ts
packages/runtime/agent-setup/capability/mcp-adapter.ts
packages/domain/blueprint/*
packages/domain/policy/*
packages/storage/*
packages/contracts/*
```

尤其：

```text
filterMcpServers()
resolveDurableMcpFacet()
capabilities.mcp
```

本来就已经是 set/serverName 语义，是本轮要复用的资产。

---

# 4. 并行开发拆分

建议先由主 agent 花很短时间冻结下面的 contract，然后并行开工：

```text
C1  config supports 0..N named MCP servers
C2  serverName is identity and unique
C3  existing capabilities.mcp semantics unchanged
C4  existing durable mcp cell semantics unchanged
C5  runtime state becomes per-server
C6  forbidden MCP is not mounted, not mounted-then-hidden
C7  legacy single mcpServer remains accepted during this alpha
```

完成这 7 条约定后，可拆成四路。

---

## Task A — Config contract + normalization

### 可立即并行

**Owner**

```text
packages/runtime/src/plugin/types.ts
packages/runtime/src/plugin/host.ts
```

### 工作

1. 定义 server descriptor；
2. 新增 `mcpServers`；
3. 保留 legacy `mcpServer`；
4. 实现唯一 normalization；
5. duplicate-name fail closed；
6. malformed array / entry fail closed；
7. 补 host config tests。

### 输出契约

向其他任务提供：

```ts
configuredMcpServers(config): readonly TeamPluginMcpServer[]
```

或等价的、唯一的 canonical 读取方式。

### 不碰

```text
agent-bindings.mjs
test bridge
harness state route
```

---

## Task B — Multi-MCP live runtime

### 与 A 可并行实现主体；合入时依赖 A 的最终 helper / shape

**唯一 owner**

```text
packages/runtime/src/plugin/live/agent-bindings.mjs
```

### 工作

1. `mcpViews`；
2. `mcpFibers Map`；
3. `mcpActivationErrors Map`；
4. all-server durable resolution；
5. all-server static filter；
6. target set 计算；
7. `reconcileMcpSet()`；
8. failed activation rollback；
9. boundary record aggregation；
10. close/dispose；
11. cold resume；
12. observations 按 server 标注。

### 验收

至少满足：

```text
expert-1 -> A only
expert-2 -> B only
expert-3 -> A+B
expert-4 -> none
```

且共享同一个 Team / production row。

---

## Task C — RED tests + bridge/harness adaptation

### 可与 B 同时进行

**Owner**

```text
packages/runtime/test/t12a-live-bridge.mjs
packages/runtime/test/t12a-live-bridge.d.mts
packages/runtime/test/multi-mcp-wiring.test.ts     # 新建
packages/runtime/test/t4a-capability-wiring.test.ts
packages/runtime/test/t12a-h1-nullable-mcp.test.ts
packages/tools/harness/plugin.mjs
```

### 第一阶段先写 RED

至少先让以下 case 在旧实现上失败：

1. 同 row 配置 A/B 两个 MCP；
2. member-1 只出现 A；
3. member-2 只出现 B；
4. leader 同时出现 A+B；
5. denied member 一个都没有。

### 第二阶段适配 diagnostics

将单：

```text
mcp.mounted
mcp.serverName
mcp.allowed
```

变成：

```text
mcp.servers[serverName].*
```

### 不碰

```text
agent-bindings.mjs
host.ts
types.ts
```

这样 B/C 基本没有代码冲突。

---

## Task D — Docs + one real-host smoke kit

### 可后置，也可与 B/C 并行准备

**Owner**

```text
docs/INSTALL.md
cordis.patch.yml
一个现有 capability live smoke kit 或其最小派生脚本
```

### 工作

给出用户真正需要的配置例子，例如：

```yaml
mcpServers:
  - name: mcp_signal
    port: 3494
  - name: mcp_designer
    port: 3495
```

Blueprint：

```yaml
expert-1:
  capabilities:
    mcp:
      kind: allow
      items: [mcp_signal]

expert-2:
  capabilities:
    mcp:
      kind: allow
      items: [mcp_designer]
```

同时准备一个 **双 mini-MCP real-host smoke**，不要扩成完整 E2E suite。

---

# 5. 建议的集成顺序

```text
Step 0
冻结 C1-C7 contract

        ┌──────── Task A config
        │
Step 1 ─┼──────── Task B runtime
        │
        ├──────── Task C RED tests / bridge
        │
        └──────── Task D docs / live kit

Step 2
先合 A

Step 3
rebase B/C 到 A 的 canonical config shape

Step 4
合 B + C
跑 focused unit/integration

Step 5
合 D
跑 real-host double-MCP smoke

Step 6
typecheck/build/artifact gate
```

如果 A 的实际改动很小，也可以由主 agent 先完成 A，再同时放出 B/C/D，进一步降低 merge cost。

---

# 6. 必须补充的测试

## 6.1 P0：真正 blocker 的 acceptance test

新增 `multi-mcp-wiring.test.ts`，构造：

```text
configured = {A, B, C}

leader:
    allow [A, B]

expert-1:
    allow [A]

expert-2:
    allow [B]

expert-3:
    deny

durable team override:
    allow [A, B, C]
```

断言：

```text
leader   mounted == {A, B}
expert-1 mounted == {A}
expert-2 mounted == {B}
expert-3 mounted == {}
```

这是本轮最核心的 regression。

---

## 6.2 P0：legacy single-server compatibility

旧配置：

```yaml
mcpServer:
  name: A
  port: 3494
```

仍应正常转成：

```text
configured = {A}
```

原来的 single-MCP behavior 不变。

---

## 6.3 P0：no-MCP contract

覆盖：

```yaml
mcpServers: []
```

以及 legacy：

```yaml
mcpServer: null
```

均应：

```text
mcpViews = {}
mcpFibers = {}
zero agentCtx.plugin(mcpClient, ...)
```

原 `t12a-h1-nullable-mcp.test.ts` 应迁移为“zero-MCP contract”，同时保留 legacy-null 一条 case。

---

## 6.4 P0：duplicate identity rejection

```yaml
mcpServers:
  - {name: A, port: 3494}
  - {name: A, port: 3495}
```

必须在 host config validation 阶段 fail closed。

不能把两个同名 server 都挂上，因为：

```text
policy identity = serverName
tool namespace identity = serverName
```

会产生不可判定的目标。

---

## 6.5 P0：static template isolation

配置：

```text
configured = {A, B}
durable = allow {A, B}
member template = allow {A}
```

必须证明：

```text
A mounted
B not mounted
```

这直接防止未来有人误把 per-template gate 退化成：

```text
“只要 mcp cell allowed 就挂所有 configured servers”
```

---

## 6.6 P0：durable instance override isolation

至少做一条：

```text
initial:
  member -> {A, B}

durable next-boundary override:
  member -> allow {B}

next operation:
  A disposed
  B remains
```

并断言 sibling 不受影响。

这证明 multi-server 没有破坏现有 per-instance durable governance。

---

## 6.7 P0：activation failure rollback

例如：

```text
target = {A, B}
A starts successfully
B activation throws
```

断言：

```text
setup/boundary fails
A 本轮新 fiber 被 rollback
B 不存在
不存在 partial newly-mounted set
```

另加一个安全次序 case：

```text
old = {A}
new target = {B}
B activation fails
```

断言：

```text
A 已被移除（因为新 policy 已 deny）
B 未留下 partial fiber
request 不执行
```

---

## 6.8 P1：port=null 精确行为

配置：

```text
A: valid port
B: port=null
```

### Case 1

template / durable 只允许 A：

```text
A mounts
B 未被选择
B 的 null port 不应导致 setup 失败
```

### Case 2

B 被允许：

```text
setup/boundary fail closed
error 明确指向 B
```

避免“一个未使用的坏 server 阻断所有成员”。

---

## 6.9 P1：cold resume

启动前：

```text
member-1 = {A}
member-2 = {B}
```

cold resume 后：

```text
member-1 = {A}
member-2 = {B}
```

重新创建的是新 fibers，但 effective set 相同。

---

## 6.10 P1：close/dispose

一个 agent 同时有 A+B：

```text
close()
```

断言：

```text
A disposed exactly once
B disposed exactly once
```

---

## 6.11 P1：Permission Coverage Gate

严格 permissions agent 同时 mount A/B，各带至少一个 MCP tool。

断言 final-surface delta 中：

```text
tools from A -> OTHER_MANAGED_MCP
tools from B -> OTHER_MANAGED_MCP
```

且 setup 不因第二个 MCP tool 被错误分类为 unknown 而失败。

---

# 7. 改动后应执行哪些测试？

分三层。

---

## Gate A — 最快 focused gate（每次迭代都跑）

建议每次 B/C 修改后运行：

```text
multi-mcp-wiring.test.ts
t4a-capability-wiring.test.ts
t12a-h1-nullable-mcp.test.ts
t3-skills-mcp-adapter.test.ts
p8s4b-mcp-facet.test.ts
t12a-b3-external-deny.test.ts
a2c2-permission-coverage.test.ts
```

再加 config validation 的新 focused test。

### 目的

覆盖：

```text
config
static template filter
durable filter
multi mount
unmount
zero MCP
legacy compatibility
external deny
permission coverage
```

这是开发循环中的主要测试集合。

---

## Gate B — package-level regression（准备合并时跑）

由于修改的是 `agent-bindings.mjs` 这一中央 setup/boundary 文件，建议至少跑：

```text
runtime package full test suite
tools package focused/full suite
runtime typecheck
tools typecheck
domain typecheck
```

即使 domain 没改，也建议 domain typecheck 一次，因为 runtime 直接消费其 capability types / policy API。

### Build

必须：

```text
runtime build
place-dist-glue / build:composition
check-artifacts-committed
```

原因：`agent-bindings.mjs` 有 source/dist mirror 复制要求，不能只证明 source test 绿。

---

## Gate C — 一次真实 DSH host 双 MCP smoke（合并前必须）

这是本轮不能省的一项。

测试 doubles 可以证明逻辑，但真正风险在：

```text
同一个 Agent scope
  同时 ctx.plugin(mcpClient, server A)
  同时 ctx.plugin(mcpClient, server B)
```

是否在真实 Cordis / DSH plugin fiber 生命周期中稳定。

最小 real-host world：

```text
2 个 mini-MCP server
1 leader
2 members

leader -> A+B
member-1 -> A
member-2 -> B
```

验证：

1. 每个 Agent model-facing schema 中 MCP tools 精确匹配；
2. A/B namespaces 不冲突；
3. member isolation；
4. deny/unmount 后 tool 真消失；
5. host restart 后重新得到相同集合；
6. teardown 后两个端口均释放；
7. test-use worktree porcelain clean。

不需要运行完整 T12 vertical matrix。

---

# 8. 哪些测试本轮可以省略？

## 可以省略：完整 browser / UI vertical

本轮没有修改：

```text
client UI
Remote UI protocol
workspace UI
blueprint editor
browser routing
```

因此可以不跑：

- Playwright 全量 browser matrix；
- Gentry 全量；
- UI golden / CSS；
- client package full visual tests。

只要 state/harness diagnostics 没被 public UI 直接依赖即可。

---

## 可以省略：完整 handoff / fork / messaging / control E2E

本轮不触及：

```text
handoff
fork
member messaging
progress
control approval
workspace
persona
model route
```

因此不需要重新跑完整 P8-S7 / T12 handoff matrix。

中央 `agentSetup()` 被修改确实存在回归风险，但 package-level runtime suite 已足够覆盖这些静态路径；不需要每个功能都再跑真实 host vertical。

---

## 可以省略：storage / contracts 全量测试

本轮没有 durable schema 变更。

尤其不要把：

```text
mcpServers inventory
```

写入 TeamDomain durable stores。

所以不需要：

- storage full migration suite；
- contracts version bump；
- schema migration E2E。

可以只跑相关 package typecheck。

---

## 可以省略：重新验证 `filterMcpServers()` 的所有纯函数组合

现有 `t3-skills-mcp-adapter.test.ts` 已经覆盖：

```text
configured ∩ allow(items)
deny -> []
unconfigured ignored
```

新增一两个多 configured server case 即可，不要为这个纯函数构造大量重复测试。

---

## 不应省略：real multi-MCP mount

这是唯一新的 upstream interaction topology：

```text
同一个 Agent scope 同时拥有多个 mcpClient plugin fibers
```

所以即使所有 doubles 绿，也必须至少执行一次真实 DSH host 双 MCP smoke。

---

# 9. 快速修复的完成定义（DoD）

本轮可以在满足以下条件后结束，不继续扩展：

- [ ] production config 能表达 0..N 个唯一命名 MCP server；
- [ ] legacy `mcpServer` 单 server config 仍能启动；
- [ ] `capabilities.mcp` schema 不变；
- [ ] durable `mcp` governance schema 不变；
- [ ] leader/member 可获得不同 MCP server 子集；
- [ ] 同一 Agent 可以同时 mount 两个 MCP server；
- [ ] forbidden server 根本不 mount；
- [ ] durable next-boundary tighten 能只移除目标 server；
- [ ] sibling isolation 成立；
- [ ] activation failure 不留下 partial newly-mounted fibers；
- [ ] cold resume 重建 exact effective set；
- [ ] close() dispose 所有 fibers；
- [ ] strict Permission Coverage 能识别多个 MCP 引入的 tools；
- [ ] focused tests 全绿；
- [ ] runtime package regression 全绿或仅剩已记录 baseline failures；
- [ ] typecheck/build/artifact gate 全绿；
- [ ] 双 mini-MCP real-host smoke 全绿；
- [ ] 无 DSH core patch。

满足这些条件后，应停止本轮修复。

不要因为看到未来可能需要：

```text
MCP CRUD
MCP health registry
按 tool 细分 MCP permissions
remote MCP inventory UI
动态 server hot-add/hot-remove
```

而继续扩展 alpha.2。

---

# 10. 推荐任务卡

可以直接把下面四张卡交给并行 agent。

## A — MCP config cardinality

```text
Goal:
将 TeamPluginConfig 的 MCP supply 从 legacy 0|1 扩展为 0..N，同时兼容旧 mcpServer。

Own:
packages/runtime/src/plugin/types.ts
packages/runtime/src/plugin/host.ts
对应 config validation tests

Must:
- mcpServers[]
- unique name
- legacy mcpServer compatibility
- ambiguous dual non-null config fail closed
- canonical configured-server helper

Do not:
- agent-bindings.mjs
- blueprint/policy/storage
```

## B — Multi-MCP live reconciler

```text
Goal:
让每个 Agent 根据 existing template policy + durable policy 收敛到自己的 MCP server set。

Own:
packages/runtime/src/plugin/live/agent-bindings.mjs

Must:
- mcpViews per server
- mcpFibers Map
- errors Map
- target set
- reconcile set
- deny-first
- new-mount rollback
- boundary records
- close
- cold resume

Do not:
- redesign policy
- tools.restrict MCP
```

## C — Multi-MCP tests + diagnostics

```text
Goal:
先构造能在旧实现上失败的真实 blocker tests，再适配 bridge/harness diagnostics。

Own:
packages/runtime/test/t12a-live-bridge.mjs
packages/runtime/test/t12a-live-bridge.d.mts
packages/runtime/test/multi-mcp-wiring.test.ts
packages/runtime/test/t4a-capability-wiring.test.ts
packages/runtime/test/t12a-h1-nullable-mcp.test.ts
packages/tools/harness/plugin.mjs

Must:
- A/B role isolation
- A+B simultaneous mount
- none
- legacy
- zero MCP
- activation rollback
- cold resume
- dispose
- per-server diagnostics
```

## D — Docs + real-host smoke

```text
Goal:
证明同一真实 DSH Agent scope 能同时稳定运行两个 mcpClient fibers，并给出用户可复制配置。

Own:
docs/INSTALL.md
cordis.patch.yml
targeted live smoke kit/evidence

Must:
- 2 mini-MCP servers
- leader A+B
- member1 A
- member2 B
- model-facing tool schema exact
- unmount
- restart
- teardown port release
- zero core patch
```

---

# 11. 最后一个实施建议

本轮最容易重新掉进“补齐所有潜在漏洞”的位置，是把问题错误升级成：

> “设计完整的 Team MCP 管理系统”。

不要这样做。

本轮的最小正确抽象只有：

```text
singleton configured MCP
        ↓
named configured MCP set
```

而现有：

```text
Blueprint capability
durable governance
Agent-scoped mount
permission coverage
```

全部继续沿用。

因此如果开发过程中某项修改要求改动：

```text
Blueprint mcp schema
GovernanceOverride schema
TeamDomain storage version
Remote protocol version
DSH core
```

默认应视为 **scope expansion signal**，先停止并重新检查是否真的必要，而不是直接继续实现。
