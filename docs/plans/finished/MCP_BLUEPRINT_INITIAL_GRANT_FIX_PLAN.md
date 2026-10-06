# dsh-agent-team：Blueprint MCP 初始治理授权修复计划

> 目标仓库：`ArmourPiercer1/dsh-agent-team`  
> 制订日期：2026-09-20  
> 基线：当前 `master`（PR #16 multi-MCP、#17、#18、#19、#20、#21 已进入主线；PR #22 当前仍独立）  
> 修复性质：**Alpha.2/当前产品线的缺陷修复，不提前实现 Alpha.3/Alpha.4 动态权限治理**

---

## 0. 结论与已冻结语义

本问题不再需要额外的产品架构裁决，可以直接进入实现。

用户已冻结以下语义：

1. Blueprint 中显式 `allow` 的 MCP 是该角色的**初始 governance grant**，团队创建后应立即可用。
2. 这与 Team tools 的静态 `allow` 语义一致：显式允许的能力不应要求用户再执行一次人工治理操作才能使用。
3. 后续 Alpha.3 / Alpha.4 才引入动态治理：
   - Leader mutation envelope 所允许的 MCP 扩权/变更；
   - `ask` 等非立即授权等级；
   - 更完整的动态 grant 生命周期。
4. 本修复只初始化**当前明确 `allow` 的 MCP**。
   - 当前 `TemplateCapabilities.mcp` 的正式 schema 仍只有 `allow | deny`；
   - 如果未来 schema 增加 `ask` 或其他非 `allow` 状态，本初始化逻辑必须**不把它们自动转换为 grant**，而应留给后续动态治理。
5. External Hard Policy 仍然拥有最终否决权；Blueprint grant 不能绕过 external hard deny / capability missing。
6. 现有 durable human override / autonomy overlay 的优先级不改变。

### 一个重要的实现裁决

“初始化 governance MCP cell”**不应通过伪造一条 `human-override` durable record 实现**。

更干净的实现是：

- 将 immutable bound Blueprint 中的 per-template `mcp.allow` 作为 governance resolver 的**静态初始层**；
- provenance 应保持 `template/static`，而不是伪装成 `humanOverride`；
- 后续真实 mutation record 继续覆盖在这个静态初始层之上；
- 因为 Blueprint snapshot 本身已经 durable、immutable，所以不需要再持久化一份重复的“初始授权记录”。

这样同时解决：
- fresh team；
- cold resume；
- 升级后已有 Team；
- 多 root 隔离；

且无需 migration。

---

## 1. 当前缺陷的精确位置

当前 runtime 实际挂载 MCP 的目标集合为：

```text
configured MCP
    ∩ static template MCP gate
    ∩ effective governance MCP cell
```

其中前两层已经正确：

- row config：`mcpServers`
- template 静态过滤：`filterMcpServers(configuredMcpNames, capabilities.mcp)`

真正错误的是第三层。

生产路径：

```text
agent-bindings.mjs
  -> resolveConsumptionViews(...)
     -> resolveDurableMcpFacet(...)
        -> resolveActivationPolicy(...)
```

而当前 `resolveActivationPolicy()` 在 `packages/runtime/activation/checks.ts` 中固定使用：

```ts
blueprint: {},
template: {},
policyState: { stateId: DEFAULT_POLICY_STATE_ID },
...
```

因此 Blueprint 已经解析出的：

```yaml
capabilities:
  mcp:
    kind: allow
    items: [...]
```

从未进入 MCP governance resolver。

结果：

```text
fresh root
  -> no override
  -> mcp governance cell = unspecified
  -> unspecifiedFailClosed
  -> mcpViews[name].allowed = false
  -> mcpMountTarget = []
```

PR #16 的 multi-MCP smoke 之所以是绿色，是因为测试在创建 world 后额外执行了：

```text
override.set(capability=mcp, allow=[...], scope=team)
```

这条人工 durable seed 掩盖了真实用户创建路径的问题。

相关代码/证据：

- `packages/runtime/agent-setup/capability/mcp-facet.ts`
- `packages/runtime/activation/checks.ts`
- `packages/runtime/src/plugin/live/agent-bindings.mjs`
- `packages/domain/policy/src/static-capability-source.ts`
- `packages/runtime/src/plugin/root.ts`
- `packages/runtime/policy-adapter.ts`
- `dev/agent-workflow/evidence/multi-mcp/d-smoke/README.md`
- `dev/agent-workflow/evidence/multi-mcp/d-smoke/base-dryrun-interpretation.md`

---

## 2. 架构目标

修复后，MCP effective governance 的初始状态应为：

```text
Bound Blueprint template
    |
    | capabilities.mcp.kind === allow
    v
initial static MCP grant
    |
    +---- PolicyState / future Alpha.3 governance
    |
    +---- templateOverlay (Leader)
    |
    +---- instanceOverlay (Member)
    |
    +---- humanOverride
    |
    v
External Hard intersection
    |
    v
effective MCP cell
    |
    v
actual MCP mount
```

当前版本只实现最上面的 **initial static MCP grant**。

### 期望 precedence

沿用现有 policy resolver，不发明新规则：

```text
blueprint
< policyState
< template
< templateOverlay
< instanceOverlay
< humanOverride
< external hard ceiling
```

初始 MCP grant 应落在 `template` 静态层。

因此：

- 初始授权 provenance = `template/static`
- 后续 Leader mutation = `templateOverlay/leader`
- Member mutation = `instanceOverlay/member`
- 人工修改 = `humanOverride`
- External hard 始终最后裁决

---

## 3. 明确的非目标

本修复不得顺手实现以下内容：

- 不新增 `ask` MCP schema；
- 不实现 Alpha.3 Leader proactive mutation；
- 不实现 `grant_instance`；
- 不新增 MCP approval UI；
- 不新增 Remote method；
- 不修改 mutation envelope 的现有 vocabulary；
- 不修改 TeamDomain schema；
- 不创建 synthetic `human-override`；
- 不创建新的 durable seed record 类型；
- 不修改 DSH core；
- 不改变 model / skills / permissions 的当前消费语义；
- 不修改历史 evidence 使其“看起来一直正确”。

历史 PR #16 evidence 应保留原样，只新增本修复的证据。

---

## 4. 推荐代码改法

### 4.1 增加“初始 MCP grant”输入，而不是增加人工 override

首选最小改法：

在 MCP durable facet 解析路径增加一个**可选 static initial MCP entry**。

概念接口：

```ts
interface DurableMcpFacetArgs {
  ...
  readonly initialTemplateMcp?: PolicyEntry
}
```

其中：

```ts
initialTemplateMcp =
  capabilities.mode === 'selective'
  && capabilities.mcp.kind === 'allow'
    ? capabilities.mcp
    : undefined
```

重要：

- 必须显式判断 `kind === 'allow'`；
- 不要写成“任何非 deny 都 grant”；
- 这样未来增加 `ask` 等状态时，不会被旧初始化代码静默升级为 allow。

`allow([])` 可以保留为一个显式空 allow；它不会允许任何 server。

`allow(['*'])` 保留 wildcard，不需要在初始化阶段展开为当前 row 的服务器清单；真正可挂载集合仍由 configured MCP supply 决定。

---

### 4.2 让 policy resolver 把初始 grant 放到 `template` 层

推荐扩展 `resolveActivationPolicy()` 的输入为一个**可选 template policy 值**，默认保持当前行为：

概念形态：

```ts
resolveActivationPolicy({
  rootSessionId,
  instanceId,
  overrides,
  external,
  templateValues?: {
    mcp?: PolicyEntry
  }
})
```

内部：

```ts
resolveEffectivePolicy({
  ...
  blueprint: {},
  template:
    templateValues === undefined
      ? {}
      : { values: templateValues },
  ...
})
```

要求：

- 所有现有 caller 不传该参数时行为逐字保持；
- 本轮只从 MCP consumption path 传 `mcp`；
- 不趁机改变 model/tools/skills/permissions 的 `resolveActivationPolicy()` 行为；
- 避免把本修复扩大成 generic capability resolver 重构。

这样可以最大限度降低 regression surface。

---

### 4.3 在 `agent-bindings.mjs` 中确保每次 MCP resolution 都携带同一个 initial grant

当前 setup 和 request-boundary 两个地方都会调用 MCP resolution。

不能只修 create/setup，否则会出现：

```text
setup：有 MCP
next request boundary：重新 resolve -> initial grant 丢失 -> MCP 被卸载
```

因此要把 static grant 放进 `resolveConsumptionViews()` 的统一路径。

推荐：

```text
resolveConsumptionViews(sessionId, instanceIdHint, teamRootSid)
  -> resolve bound template
  -> staticCapabilitiesOf(...)
  -> deriveInitialMcpGrant(...)
  -> resolveDurableMcpFacet(..., initialTemplateMcp)
```

这样：

- fresh root setup
- fresh member setup
- cold root resume
- cold member resume
- every request boundary

全部使用同一套规则。

不要在 setup 和 request boundary 分别手写两份 grant 逻辑。

---

### 4.4 保留现有 static MCP filter

本轮不要删除：

```ts
filterMcpServers(configuredMcpNames, capabilities.mcp)
```

当前 schema 只有 `allow | deny`，它仍然是正确的静态 materialization gate。

本修复之后，初始状态下：

```text
template filter      = allow[A,B]
governance baseline  = allow[A,B]
```

两者一致，因此：

```text
configured ∩ template ∩ governance
```

会正确得到 A/B。

后续 Alpha.3/Alpha.4 如果 Blueprint MCP vocabulary 增加：

```text
allow / ask / deny
```

或者 mutation envelope 允许 Leader 后续把某个“非初始 allow”的 MCP 加入 effective grant，则届时需要重新定义“静态 eligibility gate”如何包含可动态授权集合。

**这是后续动态治理任务，不在本修复中提前设计。**

---

## 5. 建议修改文件

### 产品源码

#### `packages/runtime/activation/checks.ts`

- 给 `resolveActivationPolicy()` 增加 optional static template MCP/value 输入；
- default = 当前 `{}`，确保旧 caller 零行为变化；
- policy precedence 完全复用 `resolveEffectivePolicy()`。

#### `packages/runtime/agent-setup/capability/mcp-facet.ts`

- `DurableMcpFacetArgs` 增加 optional initial template MCP grant；
- 调用 `resolveActivationPolicy()` 时传入该 grant；
- 更新注释：`unspecified` 仅表示“没有 static allow，也没有 governance grant”，不再表示“Blueprint allow 不参与治理”。

#### `packages/runtime/src/plugin/live/agent-bindings.mjs`

- 在 `resolveConsumptionViews()` 内从 bound template 推导 initial MCP grant；
- fresh / resume / next-boundary 统一使用；
- 不在两个 caller 分叉复制逻辑。

### 测试

优先修改/扩展：

- `packages/runtime/test/p8s4b-mcp-facet.test.ts`
- `packages/runtime/test/multi-mcp-wiring.test.ts`
- 可能增加一个专门的 regression test：
  - `packages/runtime/test/mcp-blueprint-initial-grant.test.ts`

### 文档

- `docs/INSTALL.md`
- `.agents/skills/team-blueprint-authoring/SKILL.md`（若其中仍描述“Blueprint MCP 只做 static filter，不产生 initial grant”）
- 当前产品文档中所有仍宣称“必须先 override.set 才能挂 MCP”的说明

### 生成产物

源码修改后按仓库纪律重建：

```bash
pnpm build
pnpm build:composition
pnpm check:artifacts
```

提交相应 `packages/runtime/dist/...` 预构建产物。

---

## 6. TDD / 回归测试矩阵

### Gate A — pure resolver

必须先写 RED。

#### A1 fresh static allow

输入：

```text
template mcp = allow[A]
overrides = []
external = none
server = A
```

期望：

```text
allowed = true
source.layer = template
source.origin = static
```

这是本 bug 的最小 RED。

#### A2 server 不在 initial allow

```text
template allow[A]
server B
```

期望 `allowed=false`。

#### A3 wildcard

```text
template allow[*]
server A
```

期望 `allowed=true`。

#### A4 empty allow

```text
template allow[]
```

所有 server `allowed=false`。

#### A5 no static grant

legacy template / 没有 capabilities：

```text
initialTemplateMcp = undefined
overrides = []
```

保持：

```text
unspecifiedFailClosed
allowed=false
```

#### A6 external hard deny

```text
template allow[A]
external hard deny A
```

必须仍为 false。

#### A7 durable human deny wins

```text
template allow[A]
humanOverride deny
```

下一 boundary false。

#### A8 durable human allow / leader overlay precedence 不回归

使用现有 resolver precedence 测试确认 record-backed higher layer 仍然覆盖 static initial layer。

---

### Gate B — real glue / multi-MCP

#### B1 新 Team，无人工 `override.set`

配置：

```text
row: A, B
leader: allow[A,B]
worker-1: allow[A]
worker-2: allow[B]
```

**不得 seed governance override。**

期望首次 setup：

```text
leader  -> A+B mounted
worker1 -> A only
worker2 -> B only
```

#### B2 model-facing schema

首个真实 model request 的 tools 集：

```text
leader:
  mcp__A__*
  mcp__B__*

worker1:
  only mcp__A__*

worker2:
  only mcp__B__*
```

不能只检查内部 `mcpViews`。

#### B3 next request boundary

对每个 Agent 再发第二个请求。

期望 MCP 仍在，证明 request-boundary re-resolution 没把 initial grant 丢掉。

#### B4 durable tighten

创建后执行现有合法 override：

```text
mcp -> deny
```

下一 boundary：

```text
MCP unmounted
model schema no MCP tools
```

证明 initial grant 没覆盖后续治理。

#### B5 cross-root isolation

在同一 host row 创建 Team-1 与 Team-2：

```text
Team-1 blueprint: leader allow[A]
Team-2 blueprint: leader allow[B]
```

期望各自按 bound blueprint 初始化，绝不使用 row-anchor blueprint 或另一个 root 的 snapshot。

这是 #18 bound-blueprint 修复后的必要回归。

---

### Gate C — restart

#### C1 cold resume

创建 Team：

```text
blueprint allow[A]
无 override
```

关闭 host，重新启动 cold/resume。

期望：

```text
A 仍可挂载
```

原因应是 immutable bound Blueprint 重新派生 initial grant，而不是某条 synthetic override。

#### C2 restart 后 durable override 仍胜出

创建后：

```text
static allow[A]
human override deny
```

重启。

期望仍 deny。

---

### Gate D — product creation flow

这是本次最重要的验收。

必须用真实 `team.create v2 -> open Root -> admitInitialWork` 产品路径。

禁止 smoke 在 `team.create` 后偷偷执行：

```text
override.set(mcp allow ...)
```

场景：

1. 创建 Team-1；
2. 首轮 leader initial work 直接调用 MCP；
3. 创建 Team-2；
4. Team-2 首轮 leader initial work 直接调用 MCP；
5. 两者均成功。

**第二个 fresh root 是必测项**，因为用户遇到的问题就是“每建一个新 Team，MCP 再次归零”。

---

## 7. 修改 PR #16 smoke 的原则

旧 evidence 不删除、不篡改。

但当前 multi-MCP smoke 中的：

```text
durable seed:
override.set(capability=mcp, allow=[A,B], scope=team)
```

不能继续作为“初始 MCP 可用”的前置条件。

建议：

- 保留一个独立场景测试 `override.set` 的动态治理功能；
- 初始挂载场景移除 durable seed；
- 新 evidence 明确证明：
  - `governance.overrides = []`
  - Blueprint initial allow 已经使 MCP mounted；
- 之后再执行 deny/tighten override，验证动态层能覆盖静态初始 grant。

也就是说，测试从：

```text
manual grant -> mount
```

改成：

```text
blueprint initial grant -> mount
then mutation -> changed mount
```

这才与最终产品语义一致。

---

## 8. 文档语义更新

`docs/INSTALL.md` 当前“三层交集”的说法可以保留，但需要修正第三层的来源说明。

建议改成：

```text
实际 mount =
configured server
∩ template materialization eligibility
∩ effective governance MCP cell
```

其中 effective governance cell：

```text
初始值：
  Blueprint template 中显式 allow 的 MCP

之后：
  PolicyState / Leader overlay / Member overlay / Human override

最终：
  与 external hard policy 求交
```

删除/修正类似以下旧表述：

```text
Blueprint capabilities.mcp 只做 static filter，
不会 seed governance cell；
没有 override.set 就必然 fail-closed。
```

历史 evidence 文件不改。

---

## 9. 实施顺序

建议一个小 PR 完成，不拆成多轮大型任务。

### Step 1 — RED

先增加 pure resolver + real glue 两个失败测试：

- static allow + no override => MCP allowed
- fresh Team + no override => MCP mounted

确认当前 `master` RED，错误应精确表现为：

```text
source.layer = unspecified
deniedBy.reason = unspecifiedFailClosed
mounted = false
```

### Step 2 — 最小源码修复

只修改：

```text
activation/checks.ts
mcp-facet.ts
agent-bindings.mjs
```

如果实现中发现可以少改一个文件，可以进一步收缩；不得为了“统一所有 capability resolver”扩大范围。

### Step 3 — focused GREEN

跑：

```text
p8s4b-mcp-facet
multi-mcp-wiring
新增 regression spec
与 agent-bindings 相关的 t12a / capability wiring 套件
```

### Step 4 — dynamic precedence regression

验证：

```text
static allow
-> human/leader deny
-> next boundary unmount
```

以及 external hard deny。

### Step 5 — production live smoke

真实 DSH host：

```text
fresh root #1
fresh root #2
cold resume
```

全部禁止初始人工 `override.set allow`。

### Step 6 — full gates

按仓库当前门禁：

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm build:composition
pnpm check:artifacts
pnpm lint
pnpm smoke:composition
```

并保持：

```text
CORE PATCH BUDGET = 0
tests/deepseek-harness-test-use pristine
稳定实例端口零触碰
```

### Step 7 — docs + evidence + bookkeeping

- 更新 INSTALL / authoring skill；
- 新建本修复 evidence 目录；
- graph.yaml / SESSION_ROUTER_LOG 按当前仓库纪律追加；
- 不修改旧 multi-MCP evidence 的历史事实。

---

## 10. 验收标准（DoD）

修复只有同时满足以下条件才算完成：

- [ ] Blueprint `mcp.allow[A]` + row configured A + **零 governance override**，fresh leader 首轮即可看见并调用 A。
- [ ] member 按各自 bound template 初始化，不跨角色泄漏。
- [ ] 第二个 fresh Team root 同样成立，不依赖第一个 root 的状态。
- [ ] request boundary 重解析后 MCP 不消失。
- [ ] cold resume 后 MCP 仍按 bound Blueprint 恢复。
- [ ] human/leader durable deny 在下一 boundary 覆盖 initial grant。
- [ ] external hard deny 仍然最终否决。
- [ ] legacy / 无 capabilities 不被静默授予 MCP。
- [ ] 当前 schema 中 deny 不产生 initial grant。
- [ ] 未来非 `allow` 状态不会因“else”分支被自动升级成 grant。
- [ ] multi-MCP smoke 的初始成功路径不再人工 seed `override.set allow`。
- [ ] 不新增 Remote/UI/TeamDomain schema。
- [ ] 不实现 Alpha.3/Alpha.4 dynamic grant。
- [ ] CORE PATCH BUDGET = 0。
- [ ] install-surface artifacts 与源码同 commit、freshness gate 通过。

---

## 11. 对本地 Agent 的一句话任务定义

> 修复 MCP initial governance gap：让 bound Blueprint 中每个 template 的 `capabilities.mcp.kind === 'allow'` 成为该 Agent MCP governance cell 的静态初始 grant，并在 fresh setup / cold resume / every request boundary 使用同一派生；保留现有 overlay/human override/external-hard precedence，不生成 synthetic durable override，不实现 ask 或 Alpha.3 dynamic grant；将 multi-MCP 初始挂载测试改为零人工 `override.set allow` 并用两个 fresh roots + cold resume 做真实回归。
