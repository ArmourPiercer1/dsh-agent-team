# PR #16 Multi-MCP bounded follow-up 修复指示

> 目标：在不扩大 alpha.2 范围、不重构 MCP 权限体系的前提下，修复 PR #16 审查中已确认的 4 个问题，然后完成一次有界回归并准备合并。
>
> 当前试用策略：**允许基于 PR #16 当前已审查版本继续内部试用**；本任务与试用并行进行。
>
> 重要约束：**这是 bounded follow-up，不是新一轮开放式 hardening。不要继续搜索和补齐新的理论漏洞。**

---

## 0. 基线与任务边界

目标 PR：

```text
PR #16
int/multi-mcp-quick-fix -> master
```

审查时 PR head：

```text
799f7ae0769c147d4bc8ae2c11fc234bf7e0197c
```

本轮只处理以下四项：

```text
F1  prototype-unsafe MCP server-key record
F2  INSTALL 对 static capabilities.mcp wildcard 的错误说明
F3  INSTALL 对 legacy template MCP 语义的错误说明
F4  TeamPluginConfig 类型契约与 canonical mcpServers 不一致
```

除非某一项修复被真实测试证明无法在当前边界内完成，否则不得扩展任务。

---

# 1. F1 — 修复 prototype-unsafe MCP server key

## 1.1 问题

当前 multi-MCP runtime 使用普通对象保存：

```js
const mcpViews = {}
mcpViews[server.name] = view
```

以及 harness diagnostics：

```js
const out = {}
out[name] = ...
```

而 `server.name` 是配置输入。

普通 JavaScript object 对：

```text
__proto__
constructor
prototype
```

等键具有特殊行为。

尤其 `__proto__` 不是普通 own property 写入：

```js
obj["__proto__"] = value
```

可能修改对象原型，而不是创建正常字段。

这会破坏当前依赖的：

```js
Object.keys(mcpViews)
Object.values(mcpViews)
mcpViews[name]
```

一致性。

在极端配置：

```yaml
mcpServers:
  - name: __proto__
    port: 3494
```

中可能出现：

```text
initial setup 能通过直接属性读取看到 view
但 request-boundary 的 Object.keys(mcpViews) 得到空集合
→ 跳过 reconcile
→ durable deny/tighten 后旧 MCP 不被卸载
```

这是本轮唯一需要视为 merge blocker 的 correctness 问题。

---

## 1.2 修复要求

优先采用最小修改：

```js
const mcpViews = Object.create(null)
```

以及 harness diagnostics：

```js
const out = Object.create(null)
```

只要最终行为满足：

```text
serverName 可作为纯字符串 identity
不受 Object.prototype / __proto__ 语义影响
```

即可。

如果使用 `Map` 会显著扩大改动面，不要为了“更优雅”主动改成 Map。

### 需要检查的文件

至少：

```text
packages/runtime/src/plugin/live/agent-bindings.mjs
packages/tools/harness/plugin.mjs
```

同时搜索本 PR 新增的所有：

```text
Record<serverName, ...>
obj[serverName]
Object.keys(mcpViews)
Object.values(mcpViews)
```

只检查 **本轮 multi-MCP 新增 server-keyed object**，不要做全仓库 prototype-hardening。

---

## 1.3 必须补测试

在现有 multi-MCP focused tests 中增加一个 regression：

```text
serverName = "__proto__"
```

至少证明：

1. config 接受该名字或 runtime 对它有明确且一致的处理；
2. boot 后 view 正常存在；
3. MCP 能按 policy 正常 mount；
4. durable policy 在 next boundary 收紧/deny；
5. `reconcileMcpSet()` 确实执行；
6. MCP fiber 被卸载；
7. diagnostics 中该 server 仍能作为普通 key 被读出；
8. 不发生 prototype mutation。

推荐直接验证：

```js
Object.keys(mcpViews).includes("__proto__") === true
```

或等价可观察结果。

### 不要顺手做

不要把 serverName validator 改成禁止 `__proto__`，除非有现成上游 contract 明确要求禁止。

本问题的核心要求是：

> server identity 应由业务规则决定，而不是由 JavaScript object prototype 机制决定。

---

# 2. F2 — 修正 static `capabilities.mcp` wildcard 文档

## 2.1 问题

当前 `docs/INSTALL.md` 写了类似：

```text
allow 集可用通配 *
```

但现有 static template selector：

```text
filterMcpServers(configuredServers, capabilities.mcp)
```

只做显式 server-name membership。

现有 wildcard `*` 是：

```text
durable MCP facet / governance cell
```

的语义，不是 static Blueprint `capabilities.mcp` 的语义。

因此：

```yaml
capabilities:
  mcp:
    kind: allow
    items: ["*"]
```

当前不会表示“允许所有 MCP”。

---

## 2.2 修复要求

**只修文档，不改 runtime。**

明确区分：

```text
Blueprint static capabilities.mcp
    → 当前使用显式 server name 列表

Durable/governance MCP cell
    → 支持既有 "*" wildcard 语义
```

推荐文案：

```text
Blueprint 的 capabilities.mcp 当前应列出显式 server name；
不要使用 "*" 作为 template-level wildcard。

durable governance 的 mcp cell 保持既有 "*" 语义。
```

### 禁止

不要修改：

```text
packages/runtime/agent-setup/capability/mcp-adapter.ts
packages/runtime/agent-setup/capability/mcp-facet.ts
```

本轮冻结原则是：

```text
C3/C4 existing semantics unchanged
```

---

# 3. F3 — 修正 legacy template MCP 文档

## 3.1 问题

当前 INSTALL 文档错误描述：

```text
template 不声明 capabilities.mcp
→ unspecified
→ fail closed
→ 不挂 MCP
```

但 runtime 实际兼容逻辑是：

```js
capabilities.mode === "legacy"
    ? configuredMcpNames
    : filterMcpServers(...)
```

也就是说：

```text
整个 capabilities block 不存在
→ legacy mode
→ 不施加 static template MCP gate
→ 最终由 durable MCP decision 决定
```

这是已有 compatibility behavior，不应在本轮修改。

---

## 3.2 修复要求

只修改：

```text
docs/INSTALL.md
```

把语义写清楚：

```text
Selective template:
    capabilities 存在
    → capabilities.mcp 参与 static filtering

Legacy template:
    整个 capabilities block 不存在
    → 保持历史兼容，不增加 static MCP filter
    → 是否 mount 由 durable MCP policy 决定
```

同时把当前示例明确标记为：

```text
Blueprint capability 片段
```

不要让用户误以为：

```yaml
expert-1:
  capabilities:
    ...
```

本身就是完整合法 Blueprint。

如果需要，给一句提示：

```text
当 capabilities block 存在时，仍需满足 Blueprint schema 对其它 required capability 字段的要求。
```

---

# 4. F4 — 修正 `TeamPluginConfig` 类型契约

## 4.1 问题

runtime validator 已允许 canonical：

```yaml
mcpServers:
  - ...
```

而不要求 legacy：

```yaml
mcpServer:
```

存在。

但 TypeScript 当前仍声明：

```ts
readonly mcpServer: TeamPluginMcpServer | null
```

为 required。

因此出现：

```text
runtime 合法
TypeScript 不合法
```

并导致代码中需要：

```ts
as unknown as ...
```

绕过类型系统。

---

## 4.2 修复要求

优先做最小兼容修改：

```ts
readonly mcpServer?: {
  readonly name: string
  readonly port: number | null
} | null
```

保留：

```ts
readonly mcpServers?: readonly TeamPluginMcpServer[]
```

runtime validator 继续负责：

```text
mcpServers present + non-null mcpServer
→ ambiguous → fail closed
```

不要为了“类型绝对精确”引入复杂 discriminated union，除非简单 optional 方案无法通过当前调用面 typecheck。

### 验收

以下应能通过 TS：

```ts
const config: TeamPluginConfig = {
  ...
  mcpServers: [],
  // no mcpServer
}
```

legacy 仍应合法：

```ts
mcpServer: null
```

以及：

```ts
mcpServer: { name: "legacy", port: 3494 }
```

---

# 5. 本轮不允许扩展的范围

除 F1-F4 修复直接需要外，不修改：

```text
packages/domain/**
packages/storage/**
packages/contracts/**
packages/remote/**

packages/runtime/agent-setup/capability/mcp-facet.ts
packages/runtime/agent-setup/capability/mcp-adapter.ts
```

不要重新设计：

```text
capabilities.mcp
durable MCP policy
MCP inventory persistence
MCP CRUD
MCP UI
MCP health registry
per-tool MCP permission
hot-add/hot-remove server
stdio MCP
remote URL MCP
```

也不要因为本轮 review 再启动：

```text
全仓库 security scan
全仓库 prototype pollution audit
新的 alpha.2 hardening wave
```

---

# 6. 测试要求

## 6.1 必须新增/修改的 focused tests

至少覆盖：

### F1

```text
serverName "__proto__"
boot
mount
boundary tighten/deny
unmount
diagnostics
```

### F4

config/type contract：

```text
mcpServers-only canonical config
legacy mcpServer config
ambiguous dual config still rejected
```

F2/F3 是文档修复，不需要为错误文案新增 runtime tests。

---

# 7. 修复后测试矩阵

## Gate A — focused

必须跑：

```text
packages/runtime/test/mcp-supply-config.test.ts
packages/runtime/test/multi-mcp-wiring.test.ts
packages/runtime/test/t4a-capability-wiring.test.ts
packages/runtime/test/t12a-h1-nullable-mcp.test.ts
packages/runtime/test/t12a-b3-external-deny.test.ts
packages/runtime/test/a2c2-permission-coverage.test.ts
packages/runtime/test/t3-skills-mcp-adapter.test.ts
packages/runtime/test/p8s4b-mcp-facet.test.ts
```

允许按仓库现有 runner 方式执行。

---

## Gate B — touched-package regression

至少：

```text
runtime typecheck
tools typecheck
runtime package test suite
```

如果当前仓库 canonical test runner 仍有已知 baseline failure：

```text
只要求 failure set 不扩张
```

必须把：

```text
base failure set
branch failure set
diff
```

记录清楚。

---

## Gate C — build/install surface

必须：

```text
pnpm build
pnpm build:composition
pnpm check:artifacts
```

确保：

```text
source
dist
install-surface
```

一致。

---

## Gate D — existing dual-MCP real-host smoke

只需要重新跑现有 PR #16 的双 MCP smoke。

不需要新建更大的 live matrix。

确认：

```text
leader -> A+B
member-1 -> A
member-2 -> B
deny/unmount
restart
teardown
```

仍全部通过。

---

# 8. 本轮可以省略的测试

明确省略：

```text
完整 browser / Playwright suite
完整 client UI suite
完整 handoff E2E
完整 messaging E2E
完整 lifecycle E2E
完整 T12 vertical matrix
完整 storage migration suite
完整 contracts suite
完整 domain suite
完整 alpha.2 security re-audit
```

除非 focused regression 明确出现跨模块失败，否则不要扩大。

---

# 9. 完成定义

只有以下全部满足才完成：

- [ ] F1 prototype-safe server-key storage 修复；
- [ ] `__proto__` regression 证明 next-boundary deny 能卸载；
- [ ] diagnostics 对特殊 key 正常；
- [ ] F2 static wildcard 文档修正；
- [ ] F3 legacy template 文档修正；
- [ ] F4 `TeamPluginConfig` canonical TS contract 修正；
- [ ] legacy single `mcpServer` 继续兼容；
- [ ] ambiguous dual config 继续 fail closed；
- [ ] focused tests 全绿；
- [ ] runtime/tools typecheck 全绿；
- [ ] package regression 无新增失败；
- [ ] build/composition/artifact gate 全绿；
- [ ] existing dual-MCP real-host smoke 全绿；
- [ ] CORE PATCH BUDGET 仍为 0；
- [ ] 未修改禁改模块；
- [ ] 未新增 scope。

---

# 10. 输出要求

完成后只提交：

1. 修复代码；
2. 必要测试；
3. INSTALL 文档更正；
4. 最小 evidence；
5. PR 更新说明。

PR 更新说明必须明确写：

```text
This is a bounded follow-up to PR #16 review.
No MCP policy redesign was performed.
No new feature scope was added.
```

同时给出四项状态：

```text
F1 FIXED
F2 FIXED
F3 FIXED
F4 FIXED
```

以及最终 gate：

```text
focused:
package regression:
typecheck:
build/artifacts:
dual-MCP live smoke:
baseline failure diff:
```

---

# 11. Stop rule

如果执行过程中发现新的问题：

```text
若不会阻断 F1-F4 修复和普通 multi-MCP 使用：
    记录到 follow-up backlog
    不修

若会真实阻断 F1-F4 或导致普通 A/B MCP role isolation 失效：
    停止
    给出：
      1. 触发条件
      2. 用户场景
      3. 实际后果
      4. 为什么无法在当前 contract 下规避
    等待人工裁决
```

不要因为“理论上还能更完善”继续追加任务。

本轮完成后，目标是让 PR #16 达到：

```text
GO for merge
```

而不是把 multi-MCP 扩展成完整 MCP 管理子系统。
