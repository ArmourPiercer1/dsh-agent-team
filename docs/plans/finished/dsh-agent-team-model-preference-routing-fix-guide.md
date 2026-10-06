# dsh-agent-team：Blueprint `modelPreference` 角色模型路由修复实施指南

> 适用基线：`ArmourPiercer1/dsh-agent-team` 当前 `master`，已合并 PR #29，宿主适配基线为 DSH `0.1.7-rc.1`。  
> 目标：修复 Blueprint `modelPreference` 已进入 schema/hash/Remote，但没有进入真实 Agent 模型选择路径的问题。  
> 红线：**CORE PATCH BUDGET = 0**；不得修改 `tests/deepseek-harness-test-use` 上游源码；不得通过 synthetic governance override 伪造 Blueprint 初始模型；不得把 `model` 参数塞进 `team_create_member` / `team_delegate` 作为绕行方案。

---

## 0. 执行前要求

本任务开始后先按仓库规则阅读：

1. `AGENTS.md`
2. `docs/ROUTER_RULES.md`
3. `docs/TEST_METHODS.md`

测试宿主必须使用：

- `tests/deepseek-harness-test-use`
- DSH baseline `46a7f68b0922371ce7144b668b90e377d8e799f4` = `0.1.7-rc.1`
- `tests/homes/<world>`
- 3180 族测试端口
- 严禁影响稳定实例 `:3080`

建议工作分支：

```text
fix/model-preference-routing
```

建议 evidence：

```text
dev/agent-workflow/evidence/model-preference-routing/
```

实施前先记录当前 master 的：

```bash
git rev-parse HEAD
git status --porcelain
pnpm test
```

PR #29 补充轮记录的全仓基线仍有一组已知 pre-existing failures。**本任务验收应比较“失败集合是否新增”，不要只比较 passed 数字。**

---

# 1. 当前代码状态与根因

## 1.1 Blueprint 已经声明 `modelPreference`

当前：

- `packages/domain/blueprint/src/schema.ts`
- `packages/domain/blueprint/src/types.ts`
- `packages/domain/blueprint/src/validate.ts`

都承认：

```ts
readonly modelPreference?: string
```

而且它已经参与：

- Blueprint parse
- content hash
- legacy import
- Remote template DTO

因此 **不要新增第二个平行字段**，也不要先改 schemaVersion。

当前类型注释甚至明确写着：

```text
Base model preference/policy token (interpreted later by the runtime).
```

问题恰恰是 “interpreted later by the runtime” 这一段没有接通。

参考：

- `packages/domain/blueprint/src/types.ts`
- `packages/domain/blueprint/src/validate.ts`
- `packages/runtime/src/plugin/s6-remote.ts`

## 1.2 真实模型消费仍然只以 `staticModel` 为 baseline

当前 `packages/runtime/src/plugin/live/agent-bindings.mjs` 的
`resolveConsumptionViews(...)` 构造：

```js
const modelArgs = {
  rootSessionId: teamRoot,
  instanceId,
  overrides,
  external,
  baseline: { ...config.staticModel },
}

const { view: modelView } =
  consumption.model.resolveDurableModelSelection(modelArgs)
```

此时尚未将当前 bound template 的 `modelPreference` 传入 resolver。

同一个函数稍后才为了 MCP 执行：

```js
const grantTemplate = locateTemplate(...)
const grantCaps = staticCapabilitiesOf(...)
const initialTemplateMcp = initialMcpGrantOf(grantCaps)
```

也就是说：

- MCP 已有 “Blueprint template 静态初始值 → template policy layer → durable resolver” 的完整路径；
- model 没有这条路径。

## 1.3 `resolveDurableModelSelection()` 没有 template model 输入

当前：

```ts
export interface DurableModelSelectionArgs {
  rootSessionId
  instanceId
  overrides
  external
  baseline
  appliedRecordIds?
}
```

其内部：

```ts
const policy = resolveActivationPolicy({
  rootSessionId,
  instanceId,
  overrides,
  external,
})
```

没有 `templateValues.model`。

所以无 override 时 model cell 为 `unspecified`，之后 `modelConsumptionView()` 才回落：

```text
selection = baseline = config.staticModel
```

这正是所有角色都跑全局模型的直接根因。

## 1.4 `resolveActivationPolicy()` 已经有正确的架构位置，但目前只为 MCP 开洞

当前：

```ts
readonly templateValues?: {
  readonly mcp?: PolicyEntry
}
```

然后直接进入：

```ts
template:
  templateValues === undefined
    ? {}
    : { values: templateValues }
```

policy resolver 的既有 precedence 已经是：

```text
blueprint
  < policyState
  < template
  < templateOverlay
  < instanceOverlay
  < humanOverride
  < external hard intersection
```

所以**不要创建第二套 model precedence 机制**。

正确做法就是把 `modelPreference` 转成：

```ts
template.values.model = {
  kind: 'allow',
  items: ['provider/model'],
}
```

并复用现有 policy resolver。

## 1.5 read-side 也没有把 `modelPreference` 送进 template policy

`packages/runtime/src/plugin/root.ts` 当前的 `policyReader.readTemplatePolicy()` 只做：

```ts
const capabilities = staticCapabilitiesOf(...)
const values = selectiveToTemplatePolicyValues(capabilities)
```

它只会得到：

- tools
- skills
- mcp

不会得到：

- model

因此即便只修 live Agent 模型调用，`effectiveConfig` / `modelState` 仍会把模型显示成：

```text
unspecified → staticModel
```

这会造成：

```text
真实请求 = Astra
UI / projection = Qwen / inherited staticModel
```

这种状态不允许进入合并。

## 1.6 当前 `root.ts` 的 `policyReader` 仍闭包捕获 bootstrap `blueprint`

当前 `createTeamProductionRoot()` 支持一行 host 管理多个 Team root，并已经有：

```ts
resolveBoundBlueprint?: (teamRootSid: string) => TeamBlueprint
```

persona/live glue 已经按 owning root 解析 bound snapshot。

但 `policyReader` 仍对创建 root 时的：

```ts
const blueprint = parseBlueprint(config.blueprintSource)
```

闭包读取。

因此本轮在接入 `modelPreference` 时，**必须同时保证 policyReader 按 `teamSessionId` 读取该 Team 自己冻结的 bound Blueprint**，否则：

- live model routing 可能正确；
- projection / governance read-side 在 dynamic Team root 上仍可能读 boot root 的 modelPreference。

这是本修复必须覆盖的 cross-root 一致性项，不应留作以后。

---

# 2. 目标代码架构

## 2.1 最终数据流

目标必须收敛成下面这一条 authority chain：

```text
Bound TeamBlueprint snapshot
        │
        ├── LeaderTemplate.modelPreference
        │
        └── MemberTemplate.modelPreference
                    │
                    ▼
       initialTemplateModelGrantOf(...)
                    │
                    ▼
        TemplatePolicy.values.model
                    │
                    ▼
          resolveEffectivePolicy
                    │
       ┌────────────┼───────────────┐
       │            │               │
       ▼            ▼               ▼
 activation     live request     projection /
 step 8         boundary         modelState
       │            │               │
       └────────────┴───────────────┘
                    │
                    ▼
          modelConsumptionView
                    │
                    ▼
         ModelSelection {provider,model}
                    │
                    ▼
     DSH installModelSelection(...)
                    │
                    ▼
           REAL LLM request
```

其中：

```text
config.staticModel
```

只承担：

> “Blueprint/template/model policy 都没有指定模型时的 deployment fallback”

它不再冒充角色模型。

## 2.2 模型 precedence

高优先级 → 低优先级：

```text
external hard policy
        >
humanOverride
        >
instanceOverlay
        >
templateOverlay
        >
Template.modelPreference
        >
PolicyState model value
        >
Blueprint-level model value（如未来存在）
        >
unspecified → config.staticModel fallback
```

注意：

- `external hard` 不是普通 precedence layer，而是最终不可绕过 intersection；
- `modelPreference` 是 `template/static` provenance；
- `staticModel` **不是 Team policy layer**。

## 2.3 不创建 synthetic durable override

禁止这种实现：

```text
create member
  ↓
偷偷写一条 human-override / autonomy-overlay
  ↓
让 override resolver 选中 Blueprint 模型
```

原因：

1. Blueprint snapshot 本身已经是 durable immutable authority；
2. synthetic record 会伪造 provenance；
3. ledger 会错误表现为“运行时发生过模型治理变更”；
4. override precedence / replay / restart 语义被污染。

正确 provenance：

```json
{
  "layer": "template",
  "origin": "static",
  "recordId": null
}
```

## 2.4 不修改 `team_create_member` / `team_delegate` schema

当前：

```text
team_create_member
  delegationTemplateId
  label
  groupId?
  workspace?
```

保持不变。

模型属于：

```text
template configuration / governance
```

而不是：

```text
one tool-call creation argument
```

否则同一 template 的实例会变成 caller supplied model，破坏 Blueprint authority。

修复后应允许正常路径直接工作：

```text
team_delegate(create form)
  ↓
fresh child setup
  ↓
在 FIRST model request 之前已安装 template model
```

这才是本缺陷的核心验收。

---

# 3. `modelPreference` 语义合同

为了兼容仓库现有 fixture 与 legacy 数据，本轮**不建议**把 schema v1 强制改成只接受 `provider/model`。

建议保留两种形式。

## 3.1 完整路由：推荐的新写法

```yaml
modelPreference: qiyuan-self/qwen3.8-27b
```

解释为：

```ts
{
  provider: 'qiyuan-self',
  model: 'qwen3.8-27b',
}
```

## 3.2 model-only shorthand：兼容已有 Blueprint

现有仓库 fixture 已经使用：

```yaml
modelPreference: deepseek-v4-pro
```

因此定义：

```yaml
modelPreference: qwen3.8-27b
```

解释为：

```ts
{
  provider: config.staticModel.provider,
  model: 'qwen3.8-27b',
}
```

也就是说：

> model-only 值继承 deployment default provider；完整 `provider/model` 可以跨 provider 路由。

## 3.3 路由字符串规则

建议 v1 强校验至少保证：

合法：

```text
model
provider/model
provider/model/with/additional/slashes
```

非法：

```text
""
"/model"
"provider/"
" provider/model "
"provider / model"
```

由于现有 `takeString()` 会 trim，validator 可以基于 trim 后值检查：

- non-empty；
- 不含 control chars；
- 不含 whitespace；
- 如果包含 `/`：
  - 第一段 provider 非空；
  - 第一 `/` 后 model 非空；
- 第二个及后续 `/` 属于 model 字符串的一部分。

如果不希望在本轮加强 parser 兼容约束，也至少必须让 runtime helper 对 malformed 值 fail closed；但**推荐在 Blueprint strong validation 阶段就拒绝**，避免“catalog.get 成功、创建 Agent 才报错”。

---

# 4. 需要修改的模块与接线

---

## 4.1 Blueprint validation：让可执行字段在 catalog 阶段可验证

### 文件

```text
packages/domain/blueprint/src/validate.ts
packages/domain/blueprint/src/types.ts
packages/domain/blueprint/src/schema.ts        # 仅注释/常量，如需要
packages/domain/blueprint/src/index.ts         # 如新增 helper 需 export
```

### 改动

新增一个纯 parser / validator，例如：

```ts
interface ParsedModelPreference {
  readonly provider?: string
  readonly model: string
}

function parseModelPreferenceToken(
  value: string,
): ParsedModelPreference | undefined
```

或者等价命名。

`validateTemplate()`：

```ts
const modelPreference = takeString(...)

if (
  modelPreference !== undefined &&
  parseModelPreferenceToken(modelPreference) === undefined
) {
  throw teamContractError(
    'MALFORMED_DTO',
    ...,
    {
      reason: 'invalid-model-preference',
      path: `${path}.modelPreference`,
    },
  )
}
```

### 约束

- 不增加 source field；
- 不改变 `contentHash` 机制；
- 不 bump schemaVersion；
- 不把 provider/model 拆成两个 Blueprint 字段；
- 更新 `BlueprintTemplate.modelPreference` 注释，删除“later runtime”的模糊描述，写明：
  - qualified route；
  - model-only fallback provider。

---

## 4.2 Model pure helper：建立唯一的 template-model derivation

### 建议新增

```text
packages/runtime/agent-setup/model/template-model.ts
```

并从：

```text
packages/runtime/agent-setup/model/index.ts
```

导出。

### 推荐接口

```ts
export function initialTemplateModelGrantOf(
  template: BlueprintTemplate,
  baseline: ModelSelection,
): PolicyEntry | undefined
```

语义：

```ts
template.modelPreference === undefined
  -> undefined

"provider/model"
  -> { kind: 'allow', items: ['provider/model'] }

"model-only"
  -> {
       kind: 'allow',
       items: [`${baseline.provider}/model-only`],
     }
```

### `parseModelItem` 去重

当前：

```text
packages/runtime/agent-setup/model/durable-consumption.ts
```

内含 `parseModelItem()`。

不要在 `template-model.ts` 再写一个不同的 `provider/model` parser。

建议：

```text
packages/runtime/agent-setup/model/route.ts
```

保存纯函数：

```ts
parseModelItem(...)
```

然后：

- `durable-consumption.ts` import 它；
- `template-model.ts` import 它；
- `model/index.ts` 继续 re-export `parseModelItem`，保持已有 public surface 不变。

这样避免：

```text
activation -> model helper -> durable-consumption -> activation
```

形成循环依赖。

### 防御语义

即便 Blueprint strong validator 已保证合法，helper 仍应 defensive fail-closed：

```text
malformed modelPreference
  -> typed/internal error
  -> 不允许猜 provider/model
```

不要静默退回 `staticModel`，否则 malformed Blueprint 会 fail open。

---

## 4.3 `resolveActivationPolicy`：从 MCP-specific 输入改为 generic template values

### 文件

```text
packages/runtime/activation/checks.ts
```

当前：

```ts
templateValues?: {
  readonly mcp?: PolicyEntry
}
```

改为 generic 的 template values，例如：

```ts
readonly templateValues?: TemplatePolicy['values']
```

或：

```ts
readonly templateValues?:
  Partial<Record<CapabilityName, PolicyEntry>>
```

首选前者，直接复用 domain type。

### 为什么必须 generalize

当前 policy resolver 本身早就是 generic：

```ts
template: { values: templateValues }
```

MCP-only 类型只是历史接线遗留。

本轮不要再新增：

```ts
initialTemplateModel?: ...
initialTemplateMcp?: ...
```

然后在 `resolveActivationPolicy` 内写两个特殊分支。

应该让它回到：

> “接收 template static policy values 的通用 resolver adapter”

### 注释同步

把当前：

```text
OPTIONAL templateValues carries initial static grant for mcp
```

改为：

```text
templateValues carries bound template static capability/model cells;
currently model and mcp are the production callers that depend on it.
```

---

## 4.4 ActivationProvider：成员创建时 policy snapshot 就必须看到 modelPreference

### 文件

```text
packages/runtime/activation/provider.ts
```

当前 step 8 只有：

```ts
const initialMcpGrant =
  initialMcpGrantOf(staticCapabilitiesOf(blueprint, template))

resolveActivationPolicy({
  ...
  ...(initialMcpGrant !== undefined
    ? { templateValues: { mcp: initialMcpGrant } }
    : {}),
})
```

改为先同时派生：

```ts
const staticModel = ports/config 中该 world 的 baseline
const initialModelGrant =
  initialTemplateModelGrantOf(template, staticModel)

const initialMcpGrant =
  initialMcpGrantOf(...)
```

然后：

```ts
const templateValues = {
  ...(initialModelGrant !== undefined
    ? { model: initialModelGrant }
    : {}),
  ...(initialMcpGrant !== undefined
    ? { mcp: initialMcpGrant }
    : {}),
}
```

空对象不要伪造 template authority：

```ts
Object.keys(templateValues).length === 0
  -> omit templateValues
```

### 如果 ActivationProvider 当前拿不到 `staticModel`

不要从全局 import 或 process state 猜。

应在其 injected ports 中增加：

```ts
staticModel: ModelSelection
```

或一个只读 getter。

然后在 `root.ts` 生产装配处显式注入：

```ts
{
  provider: config.staticModel.provider,
  model: config.staticModel.model,
}
```

测试 helper 同步补齐。

这样依赖是显式的，不引入 ambient state。

---

## 4.5 Durable model consumption：把 template model 送进同一个 resolver

### 文件

```text
packages/runtime/agent-setup/model/durable-consumption.ts
```

扩展：

```ts
export interface DurableModelSelectionArgs {
  ...
  readonly initialTemplateModel?: PolicyEntry
}
```

或者更通用：

```ts
readonly templateValues?: TemplatePolicy['values']
```

这里建议和 `resolveActivationPolicy()` 对齐，**首选 generic `templateValues`**，因为以后 PolicyState / template model 扩展不会再次增加专用参数。

然后：

```ts
const policy = resolveActivationPolicy({
  rootSessionId,
  instanceId,
  overrides,
  external,
  ...(templateValues !== undefined
    ? { templateValues }
    : {}),
})
```

`baseline` 保留。

### baseline 的职责不变

`modelConsumptionView()` 继续：

```text
layer === unspecified
  -> baseline staticModel
```

这条规则是正确的，不应删除。

修复点是：

> 有 modelPreference 时，policy source 不再是 `unspecified`，而是 `template`。

---

## 4.6 Live glue：必须在 model resolver 之前定位 bound template

### 文件

```text
packages/runtime/src/plugin/live/agent-bindings.mjs
```

这是本轮最重要的 live 接线。

当前顺序：

```text
1. resolve model with staticModel baseline
2. locateTemplate
3. derive MCP initial grant
```

目标顺序：

```text
1. normalize owning teamRoot
2. resolve instanceId
3. locateTemplate under owning teamRoot
4. resolve bound Blueprint under owning teamRoot
5. derive initial model grant
6. derive initial MCP grant
7. resolve model cell
8. resolve MCP cells
```

伪代码：

```js
const grantTemplate =
  locateTemplate(
    sessionId,
    instanceId,
    templateIdHint,
    teamRoot,
    bindPath,
  )

const boundBlueprint = getBoundBlueprint(teamRoot)

const initialTemplateModel =
  initialTemplateModelGrantOf(
    grantTemplate,
    config.staticModel,
  )

const grantCaps =
  staticCapabilitiesOf(
    boundBlueprint,
    grantTemplate,
  )

const initialTemplateMcp =
  initialMcpGrantOf(grantCaps)

const templateValues = {
  ...(initialTemplateModel !== undefined
    ? { model: initialTemplateModel }
    : {}),
  ...(initialTemplateMcp !== undefined
    ? { mcp: initialTemplateMcp }
    : {}),
}
```

然后 model resolver：

```js
const modelArgs = {
  rootSessionId: teamRoot,
  instanceId,
  overrides,
  external,
  baseline: { ...config.staticModel },
  ...(Object.keys(templateValues).length > 0
    ? { templateValues }
    : {}),
}
```

MCP resolver也使用同一个已定位的 `grantTemplate` / `initialTemplateMcp`。

### 必须避免重复 locate

当前 setup 后面还有：

```js
const boundTemplate = locateTemplate(...)
```

建议这一轮把“同一个 setup / boundary 内的 template locate”归一：

- `resolveConsumptionViews` 返回 `boundTemplate`，或
- 提取一个纯 `resolveBoundTemplateContext()`。

目标是：

```text
same owning root
same bound snapshot
same template
```

同时驱动：

- model
- MCP
- permissions
- static capabilities

不要一次 request 中各自重新按不同 fallback 路径解析。

### first-request guarantee

fresh member path 中 `templateIdHint` 已经用于桥接“MemberInstance 尚未 commit”的窗口。

modelPreference 必须复用这个 hint。

否则：

```text
team_delegate(create + first prompt)
```

仍会在第一轮退回 staticModel，第二轮才正确。

这是本任务的 **P0 验收条件**。

---

## 4.7 `root.ts` PolicyReader：read-side 与 live-side 必须使用同一 bound Blueprint

### 文件

```text
packages/runtime/src/plugin/root.ts
```

### 4.7.1 建立 generic per-root bound Blueprint resolver

当前已有：

```ts
resolveBoundBlueprint?: (teamRootSid: string) => TeamBlueprint
```

不要让：

- persona 自己维护一个 per-root resolution；
- live glue 自己正确；
- policyReader 继续闭包 bootstrap anchor。

建议在 root 内建立：

```ts
const boundBlueprintByRoot = new Map<string, TeamBlueprint>()

function boundBlueprintFor(
  teamSessionId: string,
): TeamBlueprint {
  if (resolveBoundBlueprint === undefined) {
    return blueprint // factory-world fallback only
  }

  const key = String(teamSessionId)
  const cached = boundBlueprintByRoot.get(key)
  if (cached !== undefined) return cached

  const resolved = resolveBoundBlueprint(key)
  boundBlueprintByRoot.set(key, resolved)
  return resolved
}
```

然后 persona source 和 policyReader 都复用它。

生产路径：

```text
resolver present
  -> NEVER fallback to row anchor silently

factory/test world resolver absent
  -> bootstrap `blueprint`
```

保持现有 fail-closed 裁决。

### 4.7.2 `readBlueprintEnvelope`

当前闭包读取：

```ts
blueprint.capabilityPolicy
```

改为：

```ts
const bound = boundBlueprintFor(teamSessionId)
capabilityValuesOf(bound.capabilityPolicy)
```

### 4.7.3 `readTemplatePolicy`

改为：

```ts
const bound = boundBlueprintFor(teamSessionId)

const template =
  staticTemplateOf(
    bound,
    teamSessionId,
    member.instanceId,
    repos.memberInstances,
  )

if (template === undefined) return {}

const capValues = ...
const modelValue =
  initialTemplateModelGrantOf(
    template,
    {
      provider: config.staticModel.provider,
      model: config.staticModel.model,
    },
  )

const values = {
  ...(capValues ?? {}),
  ...(modelValue !== undefined
    ? { model: modelValue }
    : {}),
}

return Object.keys(values).length === 0
  ? {}
  : { values }
```

### 关键点：legacy capabilities mode 不能再提前 `return {}`

当前：

```ts
if (capabilities.mode === 'legacy') return {}
```

修复后这是错误的。

因为一个模板完全可以：

```yaml
modelPreference: provider/model
# 无 capabilities
```

这时：

```text
capabilities = legacy
```

但 modelPreference 仍然是合法静态 template model。

所以逻辑必须改成：

```text
capabilities absence
  != template policy completely absent
```

---

## 4.8 effectiveConfig / modelState：原则上不加第二套逻辑，只加回归测试

### 文件

```text
packages/runtime/src/plugin/effective-config-view.ts
packages/runtime/src/plugin/model-state-view.ts
packages/contracts/src/projection/model-state.ts
```

现有实现已经支持：

```text
source.layer = template
```

映射为：

```text
source = member-template
state = inherited
```

而 contracts 也已经允许：

```text
provenance.layer = template
origin = static
recordId = null
```

因此**正常情况下这里不应该增加 modelPreference special case**。

如果必须在这里写：

```ts
if (template.modelPreference) ...
```

说明前面的 PolicyReader/EffectivePolicy 接线没有做干净。

目标是：

```text
live behavior
projection
modelState
team_inspect_config
```

都从同一 EffectivePolicy 事实得到结果。

---

## 4.9 Legacy importer：恢复 provider + model 的可执行语义

### 文件

```text
packages/legacy/teammates-adapter.ts
packages/legacy/test/p7t6-teammates-adapter.test.ts
```

当前 legacy：

```text
provider
model
```

解析后只做：

```ts
template.modelPreference = def.model
```

`provider` 被塞进 inert `legacy.extras`。

修复：

```ts
if (def.model !== undefined) {
  template.modelPreference =
    def.provider !== undefined
      ? `${def.provider}/${def.model}`
      : def.model
}
```

然后 `collectExtras()`：

- `provider + model` 都存在：provider 已被消费，不应再重复作为“unmapped extra”；
- 只有 provider、没有 model：provider 仍留在 extras；
- model 已映射，不进 extras，维持当前规则。

测试 fixture `writer` 目前具有：

```text
provider: deepseek
model: deepseek-writer
```

修复后预期：

```text
modelPreference = deepseek/deepseek-writer
```

而不是：

```text
deepseek-writer
```

并相应更新 metadata extras 断言。

---

## 4.10 Blueprint authoring skill / INSTALL 文档

至少更新：

```text
.agents/skills/team-blueprint-authoring/SKILL.md
```

增加 `modelPreference` 小节。

推荐示例：

```yaml
leader:
  templateId: leader
  persona: ...
  modelPreference: qiyuan-self/qwen3.8-27b

members:
  - templateId: expert
    persona: ...
    modelPreference: openai/gpt-6-astra
```

说明：

```text
qualified provider/model  -> 固定完整 route
bare model                -> 继承 staticModel.provider
absent                    -> fallback staticModel
```

并写清 override precedence。

如 `docs/INSTALL.md` 有 Blueprint 示例，也同步补一处最小示例。

---

# 5. 明确不应修改的部分

除非测试揭示独立缺陷，否则下列部分不应为了本任务改动：

```text
packages/tools/src/tools.ts
```

- 不给 `team_create_member` 增 model；
- 不给 `team_delegate` 增 model；
- 不给 `team_follow_up` 增 model。

```text
MemberInstance durable schema
```

- 不新增 `provider` / `model` snapshot 字段；
- model static authority = bound Blueprint snapshot；
- dynamic authority = durable governance records。

```text
DSH upstream
```

- 不 patch `installModelSelection`；
- 不修改 0.1.7 Agent loop；
- 不修改 provider registry。

```text
MCP initial grant behavior
```

- 本任务可泛化 `templateValues` 类型；
- 不改变 MCP 的已有 allow/deny 语义；
- MCP 现有 regression 必须继续全绿。

---

# 6. 测试补充计划

测试必须覆盖四层：

```text
pure semantics
  ↓
runtime policy/consumption
  ↓
real live glue + projection
  ↓
0.1.7 real-host actual model request
```

不能只加 parser 测试。

---

## 6.1 Gate A — Blueprint parser / schema

### 文件

建议扩展：

```text
packages/domain/test/t2-blueprint-parse.test.ts
packages/domain/test/t2-blueprint-hash.test.ts
```

### 用例

#### A1 qualified route

```yaml
modelPreference: qiyuan-self/qwen3.8-27b
```

parse 后值不变。

#### A2 model-only shorthand

```yaml
modelPreference: qwen3.8-27b
```

parse 后值不变；runtime 再补 provider。

#### A3 malformed

至少：

```text
/model
provider/
provider /model
provider/ model
```

应在 Blueprint strong validation 阶段失败：

```text
MALFORMED_DTO
reason = invalid-model-preference
```

#### A4 hash sensitivity

只改 `modelPreference`：

```text
Qwen → Astra
```

`contentHash` 必须变化。

已有 hash 机制理论上已覆盖字段，但本轮建议加一条显式 regression，防止以后把可执行 route 从 hash projection 中误删。

---

## 6.2 Gate B — pure template model derivation

### 建议新增测试

```text
packages/runtime/test/template-model-preference.test.ts
```

### 用例

#### B1 absent

```text
modelPreference undefined
→ initialTemplateModelGrantOf = undefined
```

#### B2 bare

baseline：

```json
{"provider":"qiyuan-self","model":"default"}
```

template：

```text
qwen3.8-27b
```

结果：

```json
{
  "kind":"allow",
  "items":["qiyuan-self/qwen3.8-27b"]
}
```

#### B3 qualified

```text
openai/gpt-6-astra
```

结果保持 provider：

```text
openai/gpt-6-astra
```

不能被 baseline provider 覆盖。

#### B4 first slash grammar

```text
openrouter/meta/llama-x
```

应解释为：

```json
{
  "provider":"openrouter",
  "model":"meta/llama-x"
}
```

#### B5 malformed defensive failure

绕过 Blueprint validator 构造 malformed template 时：

```text
initialTemplateModelGrantOf
```

必须 fail closed，不得 fallback staticModel。

---

## 6.3 Gate C — durable model resolver precedence

### 扩展

```text
packages/runtime/test/p8s4b-model-consumption.test.ts
```

当前已有：

- unspecified → baseline；
- human override → B；
- deny；
- external unavailable；
- pending boundary；
- in-flight request snapshot。

新增：

#### C1 template model wins over unspecified baseline

调用：

```ts
resolveDurableModelSelection({
  ...
  baseline,
  templateValues: {
    model: {
      kind: 'allow',
      items: ['provider-template/model-template'],
    },
  },
})
```

断言：

```text
selection = provider-template/model-template
source.layer = template
source.origin = static
recordId = null
```

#### C2 no template model remains baseline

锁定 backward compatibility。

#### C3 templateOverlay beats template model

若 autonomy envelope fixture 不允许 grant，可继续使用已有 human-override fixture；至少证明：

```text
template static model A
human override model B
→ B
```

#### C4 explicit deny beats template model

```text
template model A
durable deny
→ no model
```

#### C5 external hard deny beats template model

```text
template model A
external capabilityExists.model = false
→ unavailable
```

#### C6 pending boundary semantics

静态 template 值：

```text
recordId = null
```

本身不得伪装成 pending durable mutation。

---

## 6.4 Gate D — ActivationProvider step 8

新增/扩展 activation provider 测试。

目标不是检查 Agent request，而是检查：

> member 创建时冻结/解析的 effective policy 已把 `modelPreference` 放到 template layer。

至少：

#### D1 member template model

Blueprint worker：

```yaml
modelPreference: provider-worker/model-worker
```

activation result / policy：

```text
model effective allow provider-worker/model-worker
source template/static
```

#### D2 no modelPreference

保持旧行为。

#### D3 MCP regression

同一 template 同时：

```yaml
modelPreference: ...
capabilities:
  mcp:
    kind: allow
    items: [...]
```

确认 generic `templateValues` 改造没有丢 MCP initial grant。

---

## 6.5 Gate E — live glue：这是核心 regression

推荐参照：

```text
packages/runtime/test/mcp-blueprint-initial-grant.test.ts
packages/runtime/test/t12a-live-bridge.mjs
```

新建：

```text
packages/runtime/test/model-blueprint-initial-routing.test.ts
```

不要把大矩阵塞进已有 MCP 测试。

使用：

```ts
observeAssembly(agentCtx)
```

它读取 REAL：

```text
system-prompt/assemble
```

上的 `installModelSelection` 结果。

### E1 fresh leader

Blueprint：

```yaml
leader:
  modelPreference: provider-leader/model-leader
```

fresh root setup 后，FIRST assembly：

```text
provider = provider-leader
model = model-leader
```

### E2 fresh member FIRST request

worker：

```yaml
modelPreference: provider-worker/model-worker
```

成员创建后，第一次 assembly 就必须是 worker model。

这条测试必须使用 fresh-create window 的：

```text
templateIdHint
```

证明 MemberInstance 尚未 commit 时也不会回落 staticModel。

### E3 direct `team_delegate(create form)`

必须增加一条最贴近用户实际路径的集成测试：

```text
Leader
  ↓
team_delegate(delegationTemplateId=expert, prompt=...)
  ↓
fresh member
  ↓
FIRST member turn
```

断言 FIRST member turn 已经使用 expert model。

这是本缺陷的首要 acceptance。

### E4 `team_create_member` → first follow_up

保留另一条：

```text
team_create_member
(no task)
↓
team_follow_up
```

无需 Governance workaround，也应使用 template model。

### E5 next boundary retains template model

无 override 时：

```text
prepareAgentForRequest()
```

不得把 model 重置回 `staticModel`。

### E6 durable override beats template model

创建时 template A：

```text
request 1 = A
```

写 human override B：

```text
request 2 = B
```

request 1 的 in-flight snapshot 不变化。

### E7 cold resume

ZERO model override。

重启 / cold resume 后：

```text
template model A
```

重新从 bound Blueprint 推导。

不得依赖 process-local ref。

### E8 cross-root isolation

ONE plugin row：

```text
Team X bound Blueprint X
  leader model X

Team Y bound Blueprint Y
  leader model Y
```

断言：

```text
X assembly = X
Y assembly = Y
```

且 reverse 不泄漏。

这条同时验证：

- live `getBoundBlueprint(teamRoot)`
- root `policyReader`
- dynamic Team root

接线正确。

### E9 no preference control

legacy/no-model template：

```text
assembly = config.staticModel
source = unspecified
```

锁住兼容。

---

## 6.6 Gate F — projection / read-side 一致性

扩展：

```text
packages/runtime/test/p8s7r2-effective-config.test.ts
```

以及 model-state 对应测试文件。

至少：

### F1 effectiveConfig.model

template：

```text
openai/gpt-6-astra
```

预期：

```json
{
  "value": "openai/gpt-6-astra",
  "source": "member-template",
  "state": "inherited"
}
```

不是：

```text
source = capability
value = staticModel
```

### F2 modelState.current

预期：

```text
current.value = openai/gpt-6-astra
current.source = member-template
provenance.layer = template
provenance.origin = static
provenance.recordId = null
availability = available
```

### F3 override

template A + human override B：

```text
current/next-boundary
```

按现有 two-horizon contract 保持一致。

### F4 dynamic root read-side

与 E8 同结构：

```text
root X projection -> model X
root Y projection -> model Y
```

必须证明 `policyReader` 不再闭包读 bootstrap anchor。

---

## 6.7 Gate G — legacy importer

扩展：

```text
packages/legacy/test/p7t6-teammates-adapter.test.ts
```

当前 fixture writer：

```text
provider: deepseek
model: deepseek-writer
```

新预期：

```text
modelPreference = deepseek/deepseek-writer
```

并：

```text
legacy.extras.writer.provider
```

不再存在，因为已经被映射成可执行 route。

再补两条：

### G1 model-only

```text
model: foo
provider absent
```

→：

```text
modelPreference = foo
```

### G2 provider-only

```text
provider: foo
model absent
```

→：

```text
modelPreference absent
legacy.extras.provider = foo
```

不能发明一个无 model 的 route。

---

# 7. 0.1.7-rc.1 真实宿主验收

这是 merge 前必须执行的 Gate。

建议基于 PR #29 已验证的 0.1.7 real-host kit 结构，建立一个**小型、定向** kit：

```text
tests/kits/model-preference-routing-smoke/
```

如果本轮不希望升格共享 kit，也可先放：

```text
dev/agent-workflow/evidence/model-preference-routing/real-host/
```

但最终建议升格，因为模型路由是长期核心能力。

## 7.1 mock 模型设计

为了避免真实 provider 凭据影响确定性，real-host Gate 用一个已注册的 mock provider，但给不同角色不同 model id：

```text
staticModel:
  provider = deepseek-official
  model    = global-default

leader.modelPreference:
  deepseek-official/role-leader

worker.modelPreference:
  deepseek-official/role-worker

expert.modelPreference:
  deepseek-official/role-expert
```

mock server 记录每个实际 HTTP request 的：

```text
model
session / marker
timestamp
```

**禁止只检查 projection。必须检查实际发给 provider 的 request body。**

provider 跨 provider 路由由 E2/E8 的 assembly test 负责确定性验证；如果测试环境同时有两个可用 provider，再做额外 live sanity，但不把外部凭据作为 CI/merge gate。

## 7.2 R1 Team create initialWork

Team 创建并带 leader initial work。

断言第一条 leader LLM request：

```text
model = role-leader
```

而不是：

```text
global-default
```

并确认：

```text
governance override rows = 0
```

## 7.3 R2 direct team_delegate create+work

Leader 直接：

```text
team_delegate(
  delegationTemplateId=worker,
  prompt=...
)
```

不得先：

```text
team_create_member
override.set
team_follow_up
```

断言 worker 的**第一条** LLM request：

```text
model = role-worker
```

这条是最重要的真实缺陷闭合证据。

## 7.4 R3 explicit create + follow-up

```text
team_create_member(worker)
↓
确认没有实质 worker model turn
↓
team_follow_up(worker)
```

第一条 worker request：

```text
role-worker
```

## 7.5 R4 durable override

worker 初始：

```text
role-worker
```

然后 Governance/human override：

```text
model = deepseek-official/override-worker
```

下一 request：

```text
override-worker
```

并确认 template static route 没有制造 synthetic override record。

## 7.6 R5 cold resume / host restart

在 ZERO model override 的另一个 worker 上：

```text
before restart = role-expert
stop host
fresh boot same DSH_HOME
cold resume
after restart = role-expert
```

证明来源是 bound Blueprint snapshot。

## 7.7 R6 projection agreement

同一真实成员：

```text
actual provider request model
==
effectiveConfig.model.value
==
modelState.current.value
```

静态模板 provenance：

```text
member-template
template/static
recordId = null
```

## 7.8 R7 fallback control

另一个无 `modelPreference` 模板：

```text
actual request model = global-default
```

锁住 backward compatibility。

## 7.9 R8 cross-root

同一 host row 创建两个 Team：

```text
Team A / Blueprint A -> role-a
Team B / Blueprint B -> role-b
```

分别驱动真实 turn。

捕获中不得出现交叉模型。

---

# 8. 最终 Gate

至少执行：

```bash
pnpm install --frozen-lockfile --ignore-scripts

pnpm typecheck

pnpm build

pnpm build:composition

pnpm check:artifacts

pnpm test
```

并执行 focused：

```text
Blueprint parse/hash
template-model helper
p8s4b model consumption
ActivationProvider
model-blueprint-initial-routing
effective-config/model-state
legacy teammates adapter
现有 MCP initial grant suites
```

然后真实 0.1.7 smoke。

## 8.1 full-suite 判据

不是：

```text
0 failures
```

因为 master 有 pre-existing test debt。

而是：

```text
post failure set - baseline failure set = ∅
```

新增测试必须全绿。

## 8.2 dist / composition

仓库跟踪 runtime dist / client composition artifacts。

凡 source 发生变化，必须：

```text
source change
→ build
→ build:composition
→ check:artifacts
```

最终提交不能出现：

```text
source 已更新
dist 仍旧
```

## 8.3 zero-core

真实宿主测试前后：

```bash
git -C tests/deepseek-harness-test-use rev-parse HEAD
git -C tests/deepseek-harness-test-use status --porcelain
```

必须：

```text
HEAD = 46a7f68b0922371ce7144b668b90e377d8e799f4
porcelain = empty
```

并验证：

```text
:3080 pre == post
```

---

# 9. 推荐的提交拆分

建议不要一个巨型 commit。

### Commit 1 — semantic core

```text
fix(model): derive template model preference into policy template layer
```

包含：

- modelPreference grammar
- pure initialTemplateModelGrant
- generic templateValues
- durable model resolver

### Commit 2 — production wiring

```text
fix(runtime): wire bound template model into fresh/cold request boundaries
```

包含：

- live agent bindings
- ActivationProvider
- per-root PolicyReader
- projection agreement

### Commit 3 — migration/docs

```text
fix(legacy): preserve provider/model route in teammate import
```

包含：

- legacy adapter
- authoring skill/docs

### Commit 4 — tests/evidence/dist

按仓库现有纪律决定是否把 dist 与对应 source commit 同提交；如果本仓库要求 source/dist 同 commit，则不要机械采用上述拆分，遵循 `AGENTS.md` / 现有先例。

---

# 10. Merge-ready checklist

本任务只有在以下全部成立后才可标记 merge-ready：

- [ ] `modelPreference` qualified route 有明确语义；
- [ ] 现有 bare model fixture 仍兼容；
- [ ] 无 modelPreference 时仍 fallback `staticModel`；
- [ ] template model 进入 `template/static` policy provenance；
- [ ] `team_delegate(create+prompt)` 的**第一条 member request** 已使用 template model；
- [ ] `team_create_member → follow_up` 无 Governance workaround 即正确；
- [ ] next-boundary 不会把 template model 重置回 `staticModel`；
- [ ] durable override 高于 template model；
- [ ] external hard deny 高于所有 Team 层；
- [ ] cold resume / host restart 从 bound Blueprint 重新派生；
- [ ] 一个 host row 上不同 Team roots 不串 Blueprint/model；
- [ ] effectiveConfig/modelState 与实际 provider request 一致；
- [ ] legacy provider+model 不再丢 provider；
- [ ] 没有 synthetic override；
- [ ] 没有给 `team_create_member` / `team_delegate` 增 model 参数；
- [ ] 现有 MCP initial grant regression 全绿；
- [ ] full-suite 无新增失败；
- [ ] build/composition/artifact checks 全绿；
- [ ] DSH 0.1.7 test-use pristine；
- [ ] CORE PATCH BUDGET = 0。

---

# 11. 预期最终行为示例

Blueprint：

```yaml
---
schemaVersion: 1
blueprintId: mixed-model-team
revision: "1"

leader:
  templateId: leader
  persona: "Coordinate the team."
  modelPreference: qiyuan-self/qwen3.8-27b

members:
  - templateId: expert
    persona: "Handle hard expert tasks."
    modelPreference: openai/gpt-6-astra

  - templateId: cheap-worker
    persona: "Handle routine tasks."
    modelPreference: qwen3.8-4b

requirements: []
memberEnvelopes: []
policyStates: []
metadata: {}
---
```

假设部署：

```yaml
staticModel:
  provider: qiyuan-self
  model: qwen3.8-27b
```

结果：

```text
Leader
  → qiyuan-self/qwen3.8-27b

expert
  → openai/gpt-6-astra

cheap-worker
  → qiyuan-self/qwen3.8-4b
     （bare model 继承 staticModel.provider）

没有 modelPreference 的 template
  → qiyuan-self/qwen3.8-27b
     （真正的 deployment fallback）
```

若之后 human Governance 将 expert 实例模型覆盖为：

```text
openai/gpt-6-pro
```

则：

```text
当前 in-flight request
  → 保持原 capture

下一 request boundary
  → openai/gpt-6-pro

重启后
  → 从 durable override 恢复 openai/gpt-6-pro

override 被移除/失效后
  → 回到 template static openai/gpt-6-astra
```

这才是与现有 policy precedence、future-boundary 语义、Blueprint frozen snapshot 和 DSH model-selection seam 一致的最终架构。

---

# 12. 关键代码参考（当前 master）

- Blueprint template schema  
  https://github.com/ArmourPiercer1/dsh-agent-team/blob/master/packages/domain/blueprint/src/types.ts

- Blueprint validation  
  https://github.com/ArmourPiercer1/dsh-agent-team/blob/master/packages/domain/blueprint/src/validate.ts

- Static capability/template policy source  
  https://github.com/ArmourPiercer1/dsh-agent-team/blob/master/packages/domain/policy/src/static-capability-source.ts

- Policy resolver precedence  
  https://github.com/ArmourPiercer1/dsh-agent-team/blob/master/packages/domain/policy/src/resolve.ts

- Activation policy adapter  
  https://github.com/ArmourPiercer1/dsh-agent-team/blob/master/packages/runtime/activation/checks.ts

- ActivationProvider step 8  
  https://github.com/ArmourPiercer1/dsh-agent-team/blob/master/packages/runtime/activation/provider.ts

- Durable model consumption  
  https://github.com/ArmourPiercer1/dsh-agent-team/blob/master/packages/runtime/agent-setup/model/durable-consumption.ts

- Production live Agent glue  
  https://github.com/ArmourPiercer1/dsh-agent-team/blob/master/packages/runtime/src/plugin/live/agent-bindings.mjs

- Production root / PolicyReader / projection wiring  
  https://github.com/ArmourPiercer1/dsh-agent-team/blob/master/packages/runtime/src/plugin/root.ts

- Effective config model lane  
  https://github.com/ArmourPiercer1/dsh-agent-team/blob/master/packages/runtime/src/plugin/effective-config-view.ts

- Model state projection  
  https://github.com/ArmourPiercer1/dsh-agent-team/blob/master/packages/runtime/src/plugin/model-state-view.ts

- Existing model consumption tests  
  https://github.com/ArmourPiercer1/dsh-agent-team/blob/master/packages/runtime/test/p8s4b-model-consumption.test.ts

- Existing MCP initial-grant reference implementation/tests  
  https://github.com/ArmourPiercer1/dsh-agent-team/blob/master/packages/runtime/test/mcp-blueprint-initial-grant.test.ts

- T12 live bridge / `observeAssembly`  
  https://github.com/ArmourPiercer1/dsh-agent-team/blob/master/packages/runtime/test/t12a-live-bridge.mjs

- Legacy teammates adapter  
  https://github.com/ArmourPiercer1/dsh-agent-team/blob/master/packages/legacy/teammates-adapter.ts

---

## 给执行 Agent 的一句话实现原则

> **不要“让 `modelPreference` 覆盖 `staticModel`”；要“让 `modelPreference` 成为 EffectivePolicy 的 `template/static` model value，而 `staticModel` 只在 model cell 真正 `unspecified` 时作为 deployment fallback”。**
