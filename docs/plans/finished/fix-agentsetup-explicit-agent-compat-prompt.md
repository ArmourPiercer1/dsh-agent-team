# 快速修复提示词：AgentSetup explicit-Agent 兼容性缺陷

你正在修复 `ArmourPiercer1/dsh-agent-team` 的一个真实试用 blocker。

## 任务目标

修复当前 alpha.2 Permission Coverage / permission canonicalization 对旧 Agent identity seam 的依赖，使插件在当前 DSH `0.1.5-rc.2` 的 `AgentSetup(agentCtx, agent)` contract 下正常工作，同时尽量保持对当前插件既有 0.1.2-era 测试/兼容路径的兼容。

完成后：

1. 跑最小必要测试；
2. 在真实 DSH `0.1.5-rc.2` host 上验证一次带 `capabilities.permissions` 的 fresh-root `team.create`；
3. commit；
4. push 到独立修复分支；
5. 如果仓库工具允许，创建 PR 到 `master`；
6. 最后只汇报真实改动、测试结果、commit SHA、branch/PR。

这是一个 **bounded fast fix**。不要开启新的 hardening/rearchitecture。

---

# 0. 当前基线

仓库：

```text
ArmourPiercer1/dsh-agent-team
```

当前 `master` 审查时：

```text
df9230de678f987f407f3bb59492863bb8dc6530
```

它已经包含 PR #16 multi-MCP 修复。

建议分支名：

```text
fix/alpha2-explicit-agent-setup-compat
```

开始前：

```bash
git fetch origin
git checkout master
git pull --ff-only
git checkout -b fix/alpha2-explicit-agent-setup-compat
```

如果本地 `master` 已经不是上述 SHA，以最新 `origin/master` 为准，但先记录基线 SHA。

---

# 1. 用户实际遇到的错误

真实 UI 创建团队时报：

```text
TEAM_REMOTE_TEAM_CREATE_ROOT_START_FAILED:
team.create: starting the root (leader) agent ... failed:
agent-bindings: alpha.2 permission coverage surface unavailable ...
the agent ctx carries no scope tag —
the agent-scoped tool surface is unreadable
(code: alpha2-permission-coverage-surface-unavailable)
```

触发条件：

```text
Leader template 声明 capabilities.permissions
```

失败链：

```text
team.create
→ createRootAgent
→ agents.create(... setup: agentSetup(...))
→ agentSetup
→ permissionPolicy !== undefined
→ coverageSurfaceNames(agentCtx)
→ scopeOf(agentCtx) === undefined
→ setup reject
→ root Agent rollback
```

这是 **真实 P1 使用 blocker**。

---

# 2. 已定位根因

当前 production glue：

```text
packages/runtime/src/plugin/live/agent-bindings.mjs
```

仍依赖旧的 Agent identity 获取方式：

```js
scopeOf(agentCtx)
```

以及：

```js
agentCtx.agent?.session?.header?.cwd
```

但当前 upstream DSH `0.1.5-rc.2` 已经将 Agent identity 改为显式传入：

```ts
type AgentSetup = (
  agentCtx: Context,
  agent: Agent,
) => ...
```

并明确移除了 `agentCtx.agent` reverse association。

当前 upstream：

```text
@deepseek-ai/dsh-agent 0.1.5-rc.2
```

的正式 contract 是：

```text
setup(agentCtx, agent)
```

需要 Agent identity 的代码应使用第二参数 `agent`。

同时 `@deepseek-ai/dsh-scope` 内部 scope tag 使用模块私有：

```ts
const kScope = Symbol('dsh.scope')
```

所以外部插件若解析到另一个 `dsh-scope` package instance：

```text
host createScope() 的 Symbol A
!=
plugin scopeOf() 的 Symbol B
```

则：

```js
scopeOf(agentCtx) === undefined
```

即使真实 Agent ctx 本身完全正常。

因此：

> 不要修 node_modules dedupe，不要 patch upstream，不要修改 `dsh-scope` 的 Symbol。

正确修复是直接消费 upstream 已经公开提供的 explicit Agent。

---

# 3. 必须修改的 production 逻辑

## 3.1 将 Agent identity 从 `AgentSetup` 第二参数显式传入

找到：

```js
function agentSetup(...) {
  return async (agentCtx) => {
```

或当前等价实现。

改成能够接收：

```js
return async (agentCtx, setupAgent) => {
```

然后建立一个**单一 canonical runtime-agent resolver**。

建议最小兼容逻辑：

```js
const runtimeAgent =
  setupAgent
  ?? agentCtx.agent
  ?? scopeOf(agentCtx)
```

优先级必须是：

```text
1. setupAgent       # DSH 0.1.5+ 正式 contract
2. agentCtx.agent   # 旧 0.1.2-era compatibility
3. scopeOf(agentCtx)# 最后 fallback，仅兼容旧环境
```

如果当前代码结构更适合 helper，可写：

```js
function resolveSetupAgent(agentCtx, explicitAgent) { ... }
```

但不要扩成新 subsystem。

---

## 3.2 Permission Coverage Gate 使用 explicit Agent

当前：

```js
coverageSurfaceNames(agentCtx, sessionId)
```

内部：

```js
const scope = scopeOf(agentCtx)
...
const schemas = tools.schemas(scope)
```

改为：

```js
coverageSurfaceNames(agentCtx, sessionId, runtimeAgent)
```

内部：

```js
if (runtimeAgent === undefined) {
  throw permissionCoverageSurfaceUnavailable(
    sessionId,
    'the AgentSetup callback exposes no runtime Agent identity',
  )
}

const schemas = tools.schemas(runtimeAgent)
```

保留现有：

```text
tools.schemas seam absence
non-array
schema.name malformed
```

等 fail-closed 检查。

### 重要

不要把：

```js
tools.schemas()
```

无参数调用作为 fallback。

那会读 global surface，可能把 permission coverage 判断变成错误的全局视图，属于 fail-open/false-positive 风险。

---

## 3.3 permission path / bash workdir canonicalization 使用同一个 runtimeAgent

当前还有：

```js
const cwd = agentCtx.agent?.session?.header?.cwd
```

这是同一个 compatibility defect。

改为：

```js
const cwd = runtimeAgent?.session?.header?.cwd
```

确保：

```text
read/write/edit/lsp/bash/pwsh
```

的 path/workdir canonicalization 仍以**当前 Agent 的真实 SessionHeader.cwd** 为基准。

不要改 resolver 其它语义。

---

# 4. 优先检查的同源旧 seam

只针对同一个 defect 做一次窄搜索：

```bash
rg "agentCtx\.agent|scopeOf\(agentCtx\)" packages/runtime packages/tools
```

分类：

### 必须修

任何 production 路径中：

```text
需要知道“当前正在 setup 的 Agent 是谁”
```

却仍靠：

```js
agentCtx.agent
scopeOf(agentCtx)
```

反推 identity 的地方。

### 不要乱改

如果 `scopeOf()` 的用途是真正的：

```text
registration scope routing
```

而不是“找当前 Agent domain subject”，不要改。

本轮只修 **AgentSetup identity consumption**。

如果除已知两处外发现新的 production 命中，先判断是否同一根因；若不是，记录但不扩大任务。

---

# 5. 不允许做的事情

本轮禁止：

```text
修改 deepseek-harness upstream source
修改 @deepseek-ai/dsh-scope 的 Symbol 机制
Symbol.for('dsh.scope')
node_modules dedupe hack
pnpm override hack
重新设计 Permission Coverage Gate
重新设计 capability.permissions schema
重新设计 operation-permission
重构 agent-bindings.mjs
升级整个插件依赖到 0.1.5-rc.2
顺便修其它 alpha.2 backlog
重新审计整个权限体系
```

本轮的唯一目标是：

```text
把 Agent identity 从旧的隐式反推
迁移到 upstream 0.1.5 已提供的显式 AgentSetup 参数
```

---

# 6. 必须补的测试

## T1 — current DSH 0.1.5 style

构造：

```js
setup(agentCtx, explicitAgent)
```

其中：

```text
agentCtx.agent 不存在
scopeOf(agentCtx) 可以是 undefined
explicitAgent 存在
```

断言：

```text
Permission Coverage Gate 成功读取
tools.schemas(explicitAgent)
```

并且不会抛：

```text
alpha2-permission-coverage-surface-unavailable
```

这条是本轮最重要 RED→GREEN。

---

## T2 — legacy 0.1.2 style compatibility

构造：

```js
setup(agentCtx)
```

其中：

```text
agentCtx.agent = legacyAgent
```

断言仍能：

```text
coverage
permission resolver cwd
```

正常工作。

如果现有测试环境已经自然覆盖旧形态，可以在现有 suite 上增加精确 assertion，不必另建大文件。

---

## T3 — explicit Agent precedence

构造：

```text
setupAgent = Agent A
agentCtx.agent = Agent B
scopeOf(agentCtx) = Agent C
```

断言实际使用：

```text
Agent A
```

尤其验证：

```text
tools.schemas(A)
session cwd = A.session.header.cwd
```

这能防止未来再次退回旧 seam。

---

## T4 — fail closed when absolutely no Agent identity exists

构造：

```text
setupAgent = undefined
agentCtx.agent = undefined
scopeOf(agentCtx) = undefined
```

在 strict `capabilities.permissions` 下仍必须失败。

错误码保持：

```text
alpha2-permission-coverage-surface-unavailable
```

错误文字可更新为：

```text
no runtime Agent identity is available
```

不要静默降级。

---

## T5 — cwd basis

至少保留/补一条：

```text
explicitAgent.session.header.cwd = workspace-A
```

permission resolver 对 relative file path 或 bash workdir 的 resolve 调用必须收到：

```text
cwd: workspace-A
```

证明 0.1.5 style 下 FACT 3b 仍成立。

---

# 7. 必跑 focused tests

优先跑：

```text
packages/runtime/test/a2c2-permission-coverage.test.ts
packages/runtime/test/a6a-production-wiring.test.ts
packages/runtime/test/h1a-pre-execute-endcap.test.ts
packages/runtime/test/issue2-capability-permission-precedence.test.ts
packages/runtime/test/tcm-m3-root-work-glue.test.ts
packages/runtime/test/p8s7r1-initial-work.test.ts
```

如果文件名在当前仓库略有变化，以现有对应 suite 为准。

然后跑：

```bash
pnpm --filter @dsh-agent-team/runtime typecheck
pnpm --filter @dsh-agent-team/runtime test
```

如果 runtime full suite 存在已记录 baseline failures：

```text
只要求 failure set 不扩张
```

必须记录：

```text
before baseline
after branch
new failures = 0
```

---

# 8. Build / artifact gate

必须跑仓库现有 canonical：

```bash
pnpm build
pnpm build:composition
pnpm check:artifacts
```

或当前 package.json/AGENTS.md 定义的等价命令。

确保：

```text
src 与 committed dist glue 一致
```

如果项目要求 dist 产物提交，则提交对应 dist。

---

# 9. 真实 DSH 0.1.5-rc.2 live smoke

这是本轮 merge 前必须有的一条真实验证。

不要只用 t12a bridge double。

使用当前：

```text
deepseek-harness 0.1.5-rc.2
```

真实 host。

最小 Blueprint：

```text
Leader:
  capabilities.permissions 存在
```

至少包含一个合法的普通 allow/deny/ask policy，不需要复杂规则。

执行：

```text
team.create
```

必须证明：

```text
1. Root Agent setup 成功
2. 不再出现：
   alpha2-permission-coverage-surface-unavailable
3. Leader 真正进入 live registry
4. 初始任务可提交/Agent 可开始工作
```

随后再验证一个最小 permission behavior：

```text
一个被允许的 managed tool 能进入正常 permission pipeline
```

不需要重新跑整个 alpha.2 live security matrix。

---

# 10. 关于 DSH 版本

不要在本任务中做完整 `0.1.5-rc.2` dependency upgrade。

但在报告中明确记录：

```text
当前插件 package dependencies 仍 pin 0.1.2-rc.1
当前修复只适配 AgentSetup explicit-Agent seam
完整 upstream 0.1.5-rc.2 compatibility review 属于独立任务
```

原因：

这次真实 bug 已经证明当前 runtime 正运行在更新的 host contract 上，但完整依赖升级可能涉及更多 API 面，不应混进这个 fast fix。

---

# 11. 完成条件

以下全部满足后立即停止：

- [ ] `agentSetup` 接收 explicit Agent；
- [ ] 0.1.5 style 优先使用 explicit Agent；
- [ ] 0.1.2 style `agentCtx.agent` fallback 保留；
- [ ] `scopeOf(agentCtx)` 只作为最后 legacy fallback，或在证明无需后移除；
- [ ] Coverage Gate 使用 runtime Agent 读取 `tools.schemas(agent)`；
- [ ] permission cwd 使用 runtime Agent 的 `session.header.cwd`；
- [ ] no-identity strict path 仍 fail closed；
- [ ] T1–T5 覆盖；
- [ ] focused tests green；
- [ ] runtime regression 无新增失败；
- [ ] typecheck green；
- [ ] build/artifact green；
- [ ] real DSH 0.1.5-rc.2 fresh-root + permissions smoke green；
- [ ] CORE PATCH BUDGET = 0；
- [ ] 未扩大 scope。

完成后不要继续寻找更多潜在问题。

---

# 12. Git / push 要求

修复完成后：

```bash
git status
git diff --check
```

确认没有无关文件和临时日志进入 commit。

建议 commit message：

```text
fix(runtime): use explicit AgentSetup identity for permission coverage
```

然后：

```bash
git add <only intended files>
git commit -m "fix(runtime): use explicit AgentSetup identity for permission coverage"
git push -u origin fix/alpha2-explicit-agent-setup-compat
```

如果 GitHub CLI / API 可用，创建 PR：

```text
base: master
head: fix/alpha2-explicit-agent-setup-compat
```

PR 标题建议：

```text
fix(runtime): adapt permission coverage to explicit AgentSetup identity
```

PR 描述只需包含：

```text
Root cause
- DSH 0.1.5 AgentSetup supplies Agent explicitly.
- Team runtime still derived identity from scopeOf(agentCtx)/agentCtx.agent.
- scopeOf can also fail across duplicate dsh-scope module instances because the tag uses a module-private Symbol.

Fix
- Prefer explicit setup Agent.
- Retain bounded legacy fallback.
- Use the same Agent for tools.schemas(agent) and permission cwd resolution.

Verification
- focused:
- runtime regression:
- typecheck:
- build/artifacts:
- real 0.1.5-rc.2 fresh-root permissions smoke:
```

---

# 13. Stop rule

如果执行过程中发现新问题：

### 若与本 defect 无关

记录：

```text
follow-up backlog
```

不要修。

### 若会阻止本修复完成

只汇报：

```text
1. 触发条件
2. 具体用户场景
3. 实际结果
4. 为什么无法在当前 bounded fix 内解决
5. 最小建议
```

然后停下等待人工裁决。

不要启动新的 hardening wave。
