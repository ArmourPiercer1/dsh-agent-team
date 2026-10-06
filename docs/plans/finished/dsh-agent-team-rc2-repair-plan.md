# dsh-agent-team × DSH 0.1.5-rc.2 修复方案

> 目标：修复 `dsh-agent-team` 在 `deepseek-harness 0.1.5-rc.2` 上已确认的运行时问题，并将该版本作为新的最低兼容基线。  
> 本方案**不再要求兼容 DSH 0.1.2**，也不以保留 0.1.2-era fallback 为设计约束。

---

## 0. 修复基线

### 0.1 代码基线

- 插件仓库：`ArmourPiercer1/dsh-agent-team`
- 插件分支：`master`
- 已诊断版本：`3b4912aa41d458a02b3f1a0a511649d0ae7135ef`

- 宿主仓库：`ArmourPiercer1/deepseek-harness`
- 宿主分支：`stable-1-0.1.5-rc.2`
- DSH 版本：`0.1.5-rc.2`
- 宿主提交：`fb2c4b9e698e30edb738bca4cf0618587db7d203`

### 0.2 本轮修复范围

本轮只处理已经被真实运行证据和代码审查确认的三项 runtime 问题：

1. **A6 / P1**：`guardOperation()` 对 leader 错误执行 member lifecycle 检查，导致 leader 的 ask→approve 操作恒 `target-stale`。
2. **A2 / P2**：binder persona overlay 仍读取 row-level `config.blueprintSource`，而不是 TeamSession 的 bound blueprint snapshot，导致 fresh member durable create 已成功但 post-commit binder 失败，create 假 `rejected`。
3. **A1 / P1**：subtree permission containment 在真实 rc.2 host 上失效；deny lane fail-closed，allow lane no-match。先用极小 instrumentation 将根因唯一化，再做针对性修复。

### 0.3 明确不在本轮处理的事项

以下事项不作为 bug 修复：

- **A3**：`request-control` / `resolve-control` 缺失属于 blueprint authoring 问题，v5 已修。
- **A4**：新 Team 的 MCP cell 未获 durable governance grant，导致零 MCP 工具，属于 fail-closed 设计。
- **A5**：blueprint 显式 `skills: {kind: deny}`，无 Team skill 工具属于当前设计选择。
- `subagent` 在 rc.2 上出现“Coverage Gate 所见 surface 与 model-facing first-request surface 不一致”的问题：应单独登记 compatibility backlog，不与本轮三项修复混合。
- 不进行权限架构、TeamDomain schema、MCP governance、skill framework 的扩展设计。

---

# 1. 总体实施策略

建议将本轮定义为：

> **0.1.5-rc.2 compatibility repair**

按以下顺序实施：

1. **A6：leader last-mile guard 修复**
2. **A2：binder personaSource 迁移到 bound blueprint**
3. **A1：加临时 probe → 根因唯一化 → 最小修复**
4. 全量 targeted tests
5. real-host smoke
6. 删除临时 probe
7. 最终回归与文档更新

建议不要同时大规模清理所有 0.1.2-era compatibility code。  
“停止兼容 0.1.2”意味着本轮可以：

- 不再为了 0.1.2 保留双路径行为；
- 对 0.1.5-rc.2 已稳定存在的 public seam 直接 fail-fast；
- 删除**本轮触及路径中**纯粹为 0.1.2 保留且会妨碍正确性的 fallback；

但不意味着应在同一 PR 中无差别重构整个插件。

---

# 2. A6 — leader `target-stale`

## 2.1 已确认根因

当前 `packages/runtime/control/service.ts` 的 `guardOperation()` 逻辑将所有 `targetInstanceId` 都当作普通 member：

```ts
const member = repositories.memberInstances.get(root, target)

if (
  repositories.teamSessions.get(root) === undefined ||
  member === undefined ||
  !GUARD_LIVE_LIFECYCLES.includes(String(member.lifecycle))
) {
  return {
    allowed: false,
    reason: CONTROL_GUARD_BLOCK_REASONS.TARGET_STALE,
  }
}
```

但 leader 的架构定义是：

- `instanceId = LEADER_INSTANCE_ID` / `inst-leader`
- leader row 是 schema v2 special record
- **没有 `childSessionId`**
- **没有 `lifecycle`**
- leader 的存活性由 TeamSession / root session 本身代表

因此：

```ts
String(member.lifecycle) === 'undefined'
```

leader 只要进入 `guardOperation()`，必然 `target-stale`。

---

## 2.2 正确语义

应采用以下 invariant：

### Leader

```text
leader live
⇔
TeamSession(root) 仍存在
```

不检查 member lifecycle。

### Ordinary member

```text
member live
⇔
TeamSession(root) 存在
AND MemberInstance 存在
AND lifecycle ∈ {CREATED, RUNNING, SETTLED}
```

---

## 2.3 修改文件

主修改：

```text
packages/runtime/control/service.ts
```

可能需要 import：

```text
LEADER_INSTANCE_ID
```

应从 contracts / canonical constant 定义处导入，禁止复制字符串 `"inst-leader"`。

---

## 2.4 推荐代码结构

推荐避免继续把 leader 和 member 混在同一个复合 if 中。

示意：

```ts
const teamExists = repositories.teamSessions.get(root) !== undefined

if (!teamExists) {
  return {
    allowed: false,
    reason: CONTROL_GUARD_BLOCK_REASONS.TARGET_STALE,
  }
}

if (target !== LEADER_INSTANCE_ID) {
  const member = repositories.memberInstances.get(root, target)

  if (
    member === undefined ||
    !GUARD_LIVE_LIFECYCLES.includes(String(member.lifecycle))
  ) {
    return {
      allowed: false,
      reason: CONTROL_GUARD_BLOCK_REASONS.TARGET_STALE,
    }
  }
}
```

### 不允许的修法

不要：

```ts
leader.lifecycle = 'RUNNING'
```

不要修改 leader durable record 去伪造 lifecycle。

原因：

- 违反现有 root-binding 架构；
- lifecycle 对 leader 没有真实状态机含义；
- 会引入一个永远无法被 member lifecycle machinery 正确维护的假状态字段。

---

## 2.5 必须新增的单测

建议新增：

```text
packages/runtime/test/control-guard-leader.test.ts
```

或并入现有 stale / guard 测试，但必须有独立可识别 case。

### Case A6-T1 — live leader + allow decision

准备：

- TeamSession 存在；
- leader row 为 v2，无 lifecycle；
- 有匹配的 pending/approved control state；
- scope target = `LEADER_INSTANCE_ID`。

期望：

```text
guardOperation() != target-stale
```

如果其余决策条件均满足，应：

```text
allowed === true
```

### Case A6-T2 — missing TeamSession

准备：

- leader row 即使仍残留；
- TeamSession 不存在。

期望：

```text
reason === target-stale
```

### Case A6-T3 — ordinary member SETTLED

确保普通成员行为不回归：

```text
SETTLED → live
```

### Case A6-T4 — ordinary member ARCHIVED / DISPOSED

期望仍为：

```text
target-stale
```

---

## 2.6 A6 验收标准

必须满足：

1. leader `bash any → ask → user approve → execute` 能走通；
2. leader ask-approved read 不再 `target-stale`；
3. ordinary member stale semantics 不变；
4. 不修改 leader record schema；
5. 不放宽 external hard policy recheck；
6. 不改变 one-shot durable allow consumption 语义。

---

# 3. A2 — binder persona overlay 使用了错误的 blueprint authority

## 3.1 已确认根因

当前 production root 中存在：

```ts
const blueprint: TeamBlueprint = parseBlueprint(config.blueprintSource)
```

此 `blueprint` 是 **row-level bootstrap anchor**。

但 TeamSession 已经存在 bound blueprint snapshot 机制：

```text
TeamSession
→ bound snapshot ref
→ blueprint authority / registry
→ resolveBoundBlueprint(rootSessionId)
```

`agent-bindings.mjs` 的 agent setup 路径已经使用 bound blueprint。

问题在于 `root.ts` 中 binder 的 `personaSource` 仍然闭包捕获 row-level `blueprint`：

```ts
const personaSource: TeamBlueprintPersonaSource = {
  getLeaderPersona: () => blueprint.leader.persona,

  getMemberPersona: (_rootSessionId, templateId) => {
    const template = blueprint.members.find(
      member => String(member.templateId) === String(templateId),
    )

    if (template === undefined) {
      throw ...
    }

    return template.persona
  },
}
```

因此一个 host row 服务多个 blueprint 时：

```text
durable create:
  使用 Team bound snapshot B
  → 成员已成功创建

binder:
  使用 row bootstrap blueprint A
  → B-only templateId 不存在
  → post-commit binder install failed
  → create API 返回 rejected
```

---

# 4. A2 修复目标

建立单一规则：

> **一旦 TeamSession 已绑定 blueprint snapshot，所有 TeamSession-scoped runtime behavior 都必须从该 bound snapshot 读取。**

`config.blueprintSource` 只允许承担：

1. boot/bootstrap anchor；
2. 在尚未建立 TeamSession identity 前的初始解析；
3. 明确的 test/factory fixture。

它不再是已创建 Team 的 runtime authority。

---

# 5. A2 建议实现

## 5.1 修改文件

主要：

```text
packages/runtime/src/plugin/root.ts
```

相关：

```text
packages/runtime/src/plugin/live/agent-bindings.mjs
packages/runtime/agent-setup/persona/*
packages/runtime/test/*
```

---

## 5.2 推荐方案：向 production root 注入 bound-blueprint resolver

如果 `createTeamProductionRoot()` 已经能获得：

```ts
blueprintAuthority
```

或已有 production-level：

```ts
resolveBoundBlueprint(rootSessionId)
```

则直接构造一个统一 resolver：

```ts
function resolveRuntimeBlueprint(rootSessionId: string): TeamBlueprint {
  // 从 TeamSession bound snapshot / authority 解析
}
```

随后：

```ts
const personaSource: TeamBlueprintPersonaSource = {
  getLeaderPersona: (rootSessionId) => {
    return resolveRuntimeBlueprint(rootSessionId).leader.persona
  },

  getMemberPersona: (rootSessionId, templateId) => {
    const blueprint = resolveRuntimeBlueprint(rootSessionId)

    const template = blueprint.members.find(
      member => String(member.templateId) === String(templateId),
    )

    if (template === undefined) {
      throw ...
    }

    return template.persona
  },
}
```

---

## 5.3 rc.2-only 后应收紧的行为

既然不再兼容 0.1.2，production path 不应再出现这种语义：

```text
resolveBoundBlueprint 不可用
→ 默默回退 config.blueprintSource
```

对 production host，建议：

```text
已存在 TeamSession
但无法解析 bound snapshot
→ fail closed
```

错误应明确表达：

```text
bound blueprint snapshot unavailable / inconsistent
```

不要把它解释成：

```text
templateId 不存在
```

否则未来仍会产生误导诊断。

### 允许保留 fallback 的地方

纯 unit-test/factory world 如果没有 blueprint authority，可以保留显式 test-only/static catalog 构造。

但是 production wiring 与 factory wiring 应有清晰边界，不要再依赖“resolver absent 就隐式 fallback”。

---

# 6. A2 必须新增的测试

## A2-T1 — row anchor A / Team snapshot B

构造：

### row `config.blueprintSource`

Blueprint A：

```text
leader
member template: worker-a
```

### TeamSession bound snapshot

Blueprint B：

```text
leader
member template: worker-b
```

调用：

```text
create worker-b
```

期望：

```text
durable create success
binder install success
persona = B.worker-b.persona
API result = executed/success
```

禁止：

```text
no blueprint member template with templateId "worker-b"
```

---

## A2-T2 — B-only leader persona

确保 leader persona 也来自 bound snapshot B，而不是 row anchor A。

---

## A2-T3 — 多 Team 共用一个 plugin row

同一 row：

```text
Team 1 → blueprint B
Team 2 → blueprint C
```

两个 Team 中相同 `templateId` 可以具有不同 persona。

期望：

```text
Team1 member → B persona
Team2 member → C persona
```

这项测试很重要，因为它直接证明：

> runtime persona lookup 是 root-scoped，而不是 row-global。

---

## A2-T4 — bound snapshot 不可解析

production-like test：

- TeamSession 已存在；
- bound ref 存在；
- snapshot resolver 失败/registry 不一致。

期望：

```text
typed fail-closed error
```

禁止 fallback 到 `config.blueprintSource`。

---

# 7. A2 验收标准

1. fresh member 第一次 create 不再出现“成员已存在但 create 返回 rejected”；
2. binder 与 agent setup 使用同一个 bound snapshot authority；
3. 一个 plugin row 可以正确服务多个 blueprint；
4. row `blueprintSource` 与 Team bound snapshot 不同时，runtime 仍以 bound snapshot 为准；
5. production path 不再静默回退到错误 row anchor。

---

# 8. A1 — subtree permission containment

## 8.1 已知事实

rc.2 的 public filesystem contract 明确包含：

```ts
abstract contains(parent: FsTarget, child: FsTarget): boolean
```

`LocalFileSystem` 明确实现：

```ts
contains(parent, child)
```

`SandboxedFileSystem` 继承 `LocalFileSystem`，因此也具备该 seam。

插件侧当前链路：

```text
host.ts
ctx.get('fs')
  ↓
fsBackend facade
  ↓
agent-bindings.mjs
resolveTarget()
containsTargets()
  ↓
pre-execute-adapter.ts
canonicalLane(subtree)
```

当前真实现象：

```text
deny subtree
→ fail-closed canonicalization failure

allow subtree
→ containment no-match
→ fall default ask/deny

kind:any
→ 正常
```

因此问题已经缩小到：

```text
subtree containment seam
```

而不是普通 path resolve。

---

# 9. A1 第一阶段：只做 instrumentation，不先猜修法

## 9.1 临时 probe 修改点

### `packages/runtime/src/plugin/host.ts`

在 `fsBackend()` 获取：

```ts
const svc = ctx.get('fs')
```

后临时观测：

```ts
{
  constructorName: svc?.constructor?.name,
  resolveType: typeof svc?.resolve,
  containsType: typeof svc?.contains,
}
```

不要打印敏感数据。

---

### `packages/runtime/src/plugin/live/agent-bindings.mjs`

对：

```js
containsTargets(parent, child)
```

临时观测：

```js
{
  backendType,
  hasContains,
  parentTargetKey: parent?.targetKey,
  parentDisplayPath: parent?.displayPath,
  childTargetKey: child?.targetKey,
  childDisplayPath: child?.displayPath,
}
```

若有 throw，打印：

```text
error.name
error.message
error.stack
```

---

### `packages/runtime/operation-permission/pre-execute-adapter.ts`

若已有：

```text
root-not-canonicalizable
containment-undeterminable
```

则临时把该 cause 连同：

```text
lane
tool
rule path
operation display
```

写入 console / probe evidence。

不要改变 authority semantics。

---

# 10. A1 最小 live reproduction

使用一个最简 strict team：

```yaml
leader:
  capabilities:
    permissions:
      allow:
        - tool: read
          resource:
            kind: subtree
            path: team
      default: ask
```

执行：

```text
read team/<existing-file>
```

同时用 deny 变体：

```yaml
deny:
  - tool: read
    resource:
      kind: subtree
      path: runtime
```

目标是一次运行得到以下判定之一。

---

# 11. A1 根因分支与对应修复

## Branch A — `ctx.get('fs').contains` 不存在

观测：

```text
resolveType = function
containsType = undefined
```

### 修复方向

不要在 plugin facade 猜测 private/internal API。

先确认 rc.2 对 `ctx.get('fs')` 的 public service projection 为什么只暴露部分方法。

如果宿主公开的 service accessor存在推荐的 bound/public retrieval 方式，则切换到该方式。

### rc.2-only 原则

因为 rc.2 的 `FileSystem` contract 明确要求 `contains()`：

production path 可以直接：

```text
fs provider lacks contains()
→ typed setup/runtime incompatibility error
```

不再保留：

```text
contains optional
→ subtree silently undeterminable
```

对 rc.2 来说，`contains` 应被视为 required seam。

---

## Branch B — `contains` 存在，但调用抛错

立即根据 stack 定位。

### 高概率子类 B1 — method binding / `this`

当前 host facade 有：

```ts
const resolve = svc.resolve

return {
  resolve: (path, options) => resolve(path, options),
  ...(typeof svc.contains === 'function'
    ? { contains: svc.contains }
    : {}),
}
```

如果 stack 显示：

```text
this.processPath is undefined
this.config is undefined
```

说明是 method extraction/binding 问题。

### 修复

始终保持 receiver：

```ts
return {
  resolve: (path, options) => svc.resolve(path, options),
  contains: (parent, child) => svc.contains(parent, child),
}
```

或：

```ts
const resolve = svc.resolve.bind(svc)
const contains = svc.contains.bind(svc)
```

优先第一种，避免 service proxy identity 被过早固化。

---

## Branch C — `contains()` 返回 `false`，但物理路径明明属于 subtree

此时检查：

```text
root handle
operation handle
cwd
provider identity
targetKey
displayPath
```

### 必须验证

- rule root 与 operation path 使用同一个 `runtimeAgent.session.header.cwd`；
- 两次 `resolve()` 来自同一个 active fs provider；
- handle 没有被序列化/clone；
- `FsTarget.targetKey` 对相对/绝对路径指向一致；
- symlink canonicalization 符合预期。

### 禁止的修法

不要改成：

```ts
operationKey.startsWith(ruleRootKey)
```

不要解析 opaque target key。

A2C-7 的设计原则应保留：

> containment authority 必须来自 `FileSystem.contains(parentTarget, childTarget)`。

---

# 12. A1 production code 应如何收紧

不论最终落在哪个分支，既然最低基线固定为 rc.2，建议将：

```ts
contains?
```

从 production runtime contract 改成 required：

```ts
contains(parent, child): boolean | Promise<boolean>
```

并在 provider 缺失时 fail-fast。

即生产 glue 不再允许：

```text
resolve exists
contains absent
```

继续启动一个声明支持 subtree permission 的 agent。

推荐语义：

```text
template 使用 exact/subtree file permission
AND fs containment seam 不完整
→ setup failure
```

而不是：

```text
agent 创建成功
→ 每次 deny fail-closed
→ allow 全部 no-match
```

这会大幅降低未来诊断成本。

---

# 13. A1 必须新增的测试

## A1-T1 — production facade preserves `contains`

构造一个真实 class-style fake：

```ts
class FakeFs {
  marker = ...
  resolve() {
    assert(this === expected)
  }
  contains() {
    assert(this === expected)
  }
}
```

通过 production `fsBackend` facade。

期望：

```text
resolve receiver 正确
contains receiver 正确
```

---

## A1-T2 — allow subtree

```text
rule = allow read subtree team
operation = read team/a.md
```

期望：

```text
static allow
不生成 control request
```

---

## A1-T3 — deny subtree

```text
rule = deny read subtree runtime
operation = read runtime/a.md
```

期望：

```text
static deny
```

---

## A1-T4 — sibling false positive

```text
root = team/foo
child = team/foobar/x
```

期望：

```text
contains == false
```

防止未来退化成 prefix matching。

---

## A1-T5 — relative/absolute equivalence

同一文件：

```text
team/a.md
/home/.../team/a.md
```

在同 cwd 下：

```text
resolved target identity equivalent
subtree decision equivalent
```

---

## A1-T6 — missing contains fail-fast

rc.2-only production fixture：

```text
fs provider exposes resolve but no contains
```

如果模板声明 file subtree permission：

期望：

```text
typed incompatibility/setup failure
```

不要允许 agent 带着残缺 authority 启动。

---

# 14. 0.1.2 兼容代码的处理原则

## 14.1 本轮可以删除/收紧的内容

仅限本轮触及路径。

### A2 路径

production `resolveBoundBlueprint`：

```text
已存在 TeamSession
→ resolver 必须存在且成功
```

不再：

```text
resolver absent
→ config.blueprintSource fallback
```

### A1 路径

rc.2 public FS seam：

```text
resolve + contains
```

应视为 required contract。

不再把 `contains` 当 optional compatibility extension。

### AgentSetup identity

如果本轮触及相关调用点，可以直接以 rc.2 的 explicit `AgentSetup agent` 作为唯一 production identity。

不要为了 0.1.2 继续扩展：

```text
agentCtx.agent
scope-tag
legacy implicit agent lookup
```

但如果没有触及这部分代码，不要求在本 PR 全量删除。

---

## 14.2 本轮不建议顺手删除的内容

即使未来可以删除，也不要混进此次 repair：

- legacy storage reader；
- archive migration；
- old TeamDomain row parser；
- 与本次三个缺陷无关的 remote compatibility shim；
- MCP policy migration；
- skill registration compatibility；
- 所有旧 evidence harness。

原因：

> 本轮目标是恢复 runtime correctness，而不是完成一次 compatibility-code purge。

建议后续单独做：

```text
chore: raise minimum DSH version to 0.1.5-rc.2
```

再系统性删除 dead fallback。

---

# 15. 推荐开发分支与提交结构

建议新分支：

```bash
git switch master
git pull --ff-only
git switch -c fix/rc2-runtime-compat
```

建议至少拆成 4 个提交。

## Commit 1

```text
fix(control): treat leader liveness as team-session liveness
```

内容：

- A6 code
- A6 tests

---

## Commit 2

```text
fix(runtime): resolve binder persona from bound team blueprint
```

内容：

- A2 code
- A2 tests
- production fail-closed bound snapshot semantics

---

## Commit 3

临时诊断提交可不进最终历史，或作为 evidence-only：

```text
test(probe): instrument rc2 filesystem containment seam
```

跑完 live probe 后可 squash/drop。

---

## Commit 4

根据 probe 结果：

```text
fix(permission): repair rc2 subtree containment bridge
```

内容：

- A1 fix
- A1 unit tests
- subtree live regression

---

# 16. 测试分层

## Level 1 — pure unit

每个问题先跑最小相关测试。

### A6

```text
control guard / stale
```

### A2

```text
persona
binder
fresh-member
blueprint binding
```

### A1

```text
operation-permission
subtree matcher
production wiring
```

---

## Level 2 — package targeted suite

至少覆盖：

```text
packages/runtime/test
packages/tools/test
```

与本轮触及的相关 package。

目标：

```text
0 regression
```

---

## Level 3 — production wiring tests

必须覆盖真实 production composition seam：

```text
host.ts
agent-bindings.mjs
root.ts
```

不要只使用直接 fake `containsTargets()` 的 adapter 单测。

A1 过去漏掉的核心原因正是：

> matcher 单测正确，但 production glue seam 没有被真实验证。

---

# 17. real-host smoke 设计

基线：

```text
deepseek-harness stable-1-0.1.5-rc.2
fb2c4b9...
```

安装修复后的 `dsh-agent-team`。

使用最小 blueprint，不要一开始跑 Route C 全工作流。

---

## Smoke S1 — leader static allow subtree

配置：

```text
read subtree workspace/team → allow
```

操作：

```text
read team/test.md
```

期望：

```text
直接执行
无 approval
```

证明 A1 allow path。

---

## Smoke S2 — leader static deny subtree

配置：

```text
read subtree runtime → deny
```

操作：

```text
read runtime/x
```

期望：

```text
明确 static deny
不是 canonicalization failure
```

证明 A1 deny path。

---

## Smoke S3 — leader ask bash

配置：

```text
bash any → ask
```

流程：

```text
bash echo rc2-smoke
→ approval request
→ GUI approve
→ command executes
```

期望：

```text
不再 target-stale
```

证明 A6。

---

## Smoke S4 — bound blueprint member create

row anchor 使用 demo A。

创建 Team 时绑定 blueprint B，其中包含：

```text
template = rc2-worker-only-in-B
```

调用：

```text
team_create_member(rc2-worker-only-in-B)
```

期望：

```text
第一次 create 成功
persona = B persona
无 binder post-commit reject
```

证明 A2。

---

## Smoke S5 — second Team / different snapshot

同一 plugin row 再创建 blueprint C 的 Team。

相同 templateId，persona 不同。

期望：

```text
两个 Team 各自获得自己的 persona
```

证明 runtime 不再 row-global。

---

# 18. 最终验收门槛

本轮只有同时满足以下条件才算完成。

## A6

- [ ] leader ask-approved bash 正常执行
- [ ] leader ask-approved file op 正常执行
- [ ] member archived/disposed 仍 `target-stale`
- [ ] leader schema 未新增 lifecycle

## A2

- [ ] row blueprint A / Team bound B 时 member create 正常
- [ ] first create 不再“durable success + API rejected”
- [ ] persona 来自 Team bound snapshot
- [ ] 多 Team 不串 persona
- [ ] production bound snapshot failure fail-closed

## A1

- [ ] allow subtree 命中
- [ ] deny subtree 命中
- [ ] sibling prefix 不误判
- [ ] relative/absolute 等价
- [ ] production glue test 覆盖 `ctx.get('fs') → contains`
- [ ] 缺 contains 时 rc.2 production fail-fast
- [ ] real-host smoke 通过

## 综合

- [ ] targeted unit tests 通过
- [ ] production wiring tests 通过
- [ ] rc.2 real-host smoke S1–S5 全通过
- [ ] 临时 instrumentation 已删除
- [ ] 不引入 0.1.2 compatibility workaround
- [ ] 不修改 A3/A4/A5 的既有设计边界
- [ ] 不引入新的 silent fallback

---

# 19. 需要特别防止的错误修复方向

## 19.1 不要把 leader 改成普通 member

禁止：

```text
leader lifecycle = RUNNING
```

正确：

```text
leader liveness = TeamSession existence
```

---

## 19.2 不要把 row blueprint 重新提升为 runtime authority

禁止：

```text
只要把 config.blueprintSource 改成当前 v5 就行
```

这只能缓解单 Team 部署。

正确：

```text
runtime lookup = TeamSession bound snapshot
```

---

## 19.3 不要用字符串前缀实现 subtree

禁止：

```ts
childKey.startsWith(rootKey)
```

正确：

```ts
fs.contains(rootTarget, childTarget)
```

---

## 19.4 不要吞掉 subtree seam 缺失

旧策略：

```text
contains absent
→ allow no-match
→ deny fail-closed
```

在 rc.2-only 基线下，这会让一个 broken runtime 继续工作。

正确策略：

```text
声明 subtree permission
+
public containment seam unavailable
→ setup/runtime compatibility error
```

---

## 19.5 不要在本轮顺手重做 capability architecture

本轮修复应尽量局部：

```text
A6: control guard
A2: blueprint authority
A1: fs containment bridge
```

任何需要修改：

```text
TeamDomain durable schema
MCP governance model
skill capability model
global coverage architecture
```

的方案，都应该视为 scope expansion 并暂停。

---

# 20. 完成后的架构状态

修复后，三个关键 authority 应形成一致结构：

```text
TeamSession
│
├─ Bound Blueprint Snapshot
│    ├─ persona
│    ├─ capabilities
│    ├─ permissions
│    └─ member templates
│
├─ Leader
│    └─ liveness = TeamSession existence
│
└─ Members
     └─ liveness = MemberInstance lifecycle
```

文件权限链：

```text
model tool call
  ↓
canonical operation target
  ↓
DSH rc.2 public FileSystem.resolve()
  ↓
opaque FsTarget
  ↓
rule root resolve()
  ↓
opaque FsTarget
  ↓
FileSystem.contains(root, operation)
  ↓
static allow / ask / deny
  ↓
ask only:
ControlRequest
  ↓
human/leader decision
  ↓
last-mile guard
  ↓
execute
```

最终要求：

> **同一 Team 的 identity、blueprint、persona、permissions、control target 必须都以 TeamSession 为 root authority；文件 subtree authority 必须完全来自 rc.2 的 public filesystem seam。**

---

# 21. 建议交给本地 agent 的执行指令

可以直接使用以下任务约束：

```text
以 dsh-agent-team master 为起点，宿主契约固定为
deepseek-harness 0.1.5-rc.2 / fb2c4b9e698e30edb738bca4cf0618587db7d203。

不再兼容 DSH 0.1.2。

严格按本文顺序执行：

1. 修 A6，并先完成 targeted tests；
2. 修 A2，并先完成 targeted tests；
3. 对 A1 先加入最小 instrumentation，在真实 rc.2 host 上得到唯一根因；
4. 基于 evidence 做最小 A1 patch；
5. 删除 instrumentation；
6. 跑 targeted suite；
7. 跑 real-host smoke S1–S5；
8. 汇报：
   - 每个问题的最终根因；
   - 修改文件；
   - 新增测试；
   - 实际 live evidence；
   - 尚未处理的 compatibility backlog。

禁止：
- 为了兼容 0.1.2 保留新的 fallback；
- 给 leader 添加 lifecycle；
- 使用字符串 prefix 代替 FileSystem.contains；
- 将 row config.blueprintSource 作为已绑定 Team 的 runtime blueprint authority；
- 在本轮扩展 MCP / skill / capability architecture；
- 在没有 live evidence 前猜测 A1 根因并直接修改。
```

---

# 22. 推荐最终版本判断

如果 A6、A2、A1 均按上述门槛完成，则可以把结果视为：

> **dsh-agent-team 对 DSH 0.1.5-rc.2 的第一版真正 production-oriented compatibility baseline**

而不是继续把 `0.1.2 → 0.1.5` 当作双兼容目标。

后续应另开一个独立 cleanup 任务：

```text
Raise minimum DSH host version to 0.1.5-rc.2
```

系统性审查并删除剩余的 0.1.2-era fallback、compatibility comments 与 dead tests；不要和本次 correctness repair 混在同一开发轮次。
