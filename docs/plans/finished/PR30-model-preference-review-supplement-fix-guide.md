# PR #30 补充修复指导：`modelPreference` 路由 hardening 与证据收口

> 适用对象：`ArmourPiercer1/dsh-agent-team` PR #30  
> 审查基线：PR #30 head `6b9ff59e952de34a0a9bd6668d705d537cd280c3`  
> base：已适配 DSH `0.1.7-rc.1` 的 `master`  
> 本轮性质：**review-supplement / hardening**，不是重新设计。  
> 目标：闭合 3 个语义一致性问题 + 2 个测试/证据表述问题，使 PR #30 达到可合并状态。  
> 红线：**CORE PATCH BUDGET = 0**；不得修改 DSH upstream；不得扩展为新的模型治理架构；不得给 `team_create_member` / `team_delegate` 新增 `model` 参数；不得引入 synthetic governance override。

---

# 0. 本轮范围锁定

本轮只处理以下 5 项：

1. **malformed-present `modelPreference` 必须真正 fail loud**，不能与“字段 absent”一样返回 `undefined` 后静默回落 `staticModel`。
2. **Blueprint domain 与 runtime 共用同一个 `modelPreference` parser**，删除当前两份近似实现。
3. **`TeamRuntime` 的 `staticModel` 依赖不能 silent-optional**：只要存在可执行 `modelPreference`，inspect/read-side 就不能因 baseline 缺失而静默忽略模板模型。
4. **Gate D / Gate E 的测试命名与实际覆盖范围对齐**：不夸大 unit/integration test 的覆盖层级。
5. **real-host smoke 的 H2 / R6 证据文本自洽**：PASS 证据不能写成 “still bound”，`body.model` 与完整 `provider/model` 的比较也必须准确描述。

本轮**不要**：

- 改动 `EffectivePolicy` precedence；
- 改动 `modelConsumptionView()` 的 unspecified→baseline 规则；
- 改动 MCP initial grant 语义；
- 改动 MemberInstance schema；
- 改动 Team tool schema；
- 改动 provider registry；
- 改动 DSH `installModelSelection`；
- 新建大型 runtime abstraction；
- 重做 PR #30 的 real-host kit 架构。

---

# 1. 修复项 P2-1：malformed `modelPreference` 当前并没有真正 fail closed

## 1.1 当前问题

当前：

```text
packages/runtime/agent-setup/model/template-model.ts
```

大致逻辑：

```ts
const token = template.modelPreference
if (token === undefined) return undefined

const parsed = parseModelPreferenceToken(token)
if (parsed === undefined) return undefined
```

这把两个语义完全不同的情况压成同一个结果：

```text
A. modelPreference absent
B. modelPreference present but malformed
```

而 caller 对 `undefined` 的解释是：

```text
没有 template model value
→ model cell unspecified
→ modelConsumptionView()
→ staticModel baseline
```

所以一个绕过 Blueprint strong validation 的非法模板，例如：

```text
modelPreference = "provider /model"
```

会静默变成：

```text
staticModel
```

这与当前代码注释和 Gate B5 所宣称的：

```text
malformed -> fail closed / no silent staticModel fallback
```

不一致。

## 1.2 目标语义

必须区分：

```text
modelPreference absent
  -> 正常返回 undefined
  -> unspecified
  -> staticModel fallback
```

与：

```text
modelPreference present but malformed
  -> typed/runtime error
  -> setup / activation / inspect fail loud
  -> 绝不 fallback staticModel
```

推荐行为：

```ts
export function initialTemplateModelGrantOf(
  template: BlueprintTemplate,
  baseline: ModelSelection,
): PolicyEntry | undefined {
  const token = template.modelPreference
  if (token === undefined) return undefined

  const parsed = parseModelPreferenceToken(token)
  if (parsed === undefined) {
    throw new InvalidTemplateModelPreferenceError(...)
  }

  const item =
    parsed.provider === undefined
      ? `${baseline.provider}/${parsed.model}`
      : token

  return {
    kind: 'allow',
    items: [item],
  }
}
```

## 1.3 错误类型建议

不要直接散落：

```ts
throw new Error(...)
```

优先使用仓库已有 typed error 体系。

可选两种方式：

### 方案 A：新增 model-layer typed error

纯 helper 抛：

```ts
export class InvalidTemplateModelPreferenceError extends Error {
  readonly code = 'INVALID_TEMPLATE_MODEL_PREFERENCE'
}
```

然后在：

```text
ActivationProvider
live Agent setup
inspect-config
```

边界映射到各自已有错误体系。

### 方案 B：复用现有 `TeamPluginError` / config error

若仓库已有合适错误类型，可直接复用：

```text
TEAM_PLUGIN_CONFIG_INVALID
```

但必须确保：

- 错误信息包含 `templateId`
- 包含原始 token
- 不能被 catch 后回退 `staticModel`

### 不接受的修法

```ts
if (parsed === undefined) {
  return undefined
}
```

然后只改注释为“defensive ignore”。

这会保留当前静默 fallback 缺陷，不应接受。

## 1.4 需要修改的文件

至少：

```text
packages/runtime/agent-setup/model/template-model.ts
packages/runtime/agent-setup/model/index.ts
packages/runtime/test/template-model-preference.test.ts
```

如新增 error：

```text
packages/runtime/agent-setup/model/errors.ts
```

## 1.5 测试要求

把当前 Gate B5：

```text
malformed -> undefined
```

改成：

```text
malformed -> throws typed error
```

至少覆盖：

```text
/model
provider/
provider /model
provider/ model
" "
```

并增加一条**明确防止 fallback**的 integration test：

```text
hand-built malformed BlueprintTemplate
→ live/model derivation invoked
→ setup rejects
→ observeAssembly 不得返回 staticModel
```

如果 live bridge 不适合直接注入 malformed parsed Blueprint，也可以在 activation/provider 边界构造 synthetic template，至少保证 caller 不吞错。

---

# 2. 修复项 P2-2：删除 domain/runtime 两份 `modelPreference` parser

## 2.1 当前问题

现在有两份 parser：

### Domain

```text
packages/domain/blueprint/src/validate.ts
```

使用：

```ts
/\s/
```

判断 whitespace。

### Runtime

```text
packages/runtime/agent-setup/model/route.ts
```

手工枚举 Unicode whitespace code points。

两者**不是严格等价**。

例如 ECMAScript `\s` 会匹配一些 runtime 手工表未覆盖的 Unicode 空白字符。

这意味着理论上存在：

```text
domain reject
runtime accept
```

或者以后修改其中一处时产生：

```text
domain accept
runtime reject
```

的 grammar drift。

当前 `route.ts` 注释认为 runtime 不能 import domain parser，否则会“invert layering”，但现有依赖实际已经是：

```text
runtime → domain
```

例如：

```text
template-model.ts
  import type BlueprintTemplate from domain/blueprint
```

live glue 也已经 import：

```text
parseBlueprint
```

所以没有必要维护两份 mirror parser。

## 2.2 目标架构

建立单一 parser：

```text
packages/domain/blueprint/src/model-preference.ts
```

内容只放纯语义：

```ts
export interface ParsedModelPreferenceToken {
  readonly provider?: string
  readonly model: string
}

export function parseModelPreferenceToken(
  value: string,
): ParsedModelPreferenceToken | undefined
```

要求：

- 无 I/O；
- 无 runtime import；
- 无 DSH import；
- 无 Blueprint object 依赖；
- 可被 validator/runtime/legacy 共用。

## 2.3 接线

### `validate.ts`

从：

```ts
本地定义 parseModelPreferenceToken
```

改为：

```ts
import { parseModelPreferenceToken } from './model-preference.js'
```

### `blueprint/src/index.ts`

export：

```ts
export {
  parseModelPreferenceToken,
  type ParsedModelPreferenceToken,
} from './model-preference.js'
```

### `runtime/agent-setup/model/route.ts`

删除 runtime 自己的：

```ts
ParsedModelPreferenceToken
parseModelPreferenceToken
```

保留：

```ts
parseModelItem()
```

因为 durable policy item：

```text
provider/model
```

和 Blueprint：

```text
provider/model OR bare model
```

不是同一个入口语义。

然后 runtime 直接 import domain parser。

### `template-model.ts`

直接使用 domain single parser。

## 2.4 测试要求

保留 domain parser tests，至少：

```text
qiyuan-self/qwen3.8-27b
qwen3.8-27b
openrouter/meta/llama-x
/model
provider/
provider /model
provider/ model
```

另外补一个 Unicode whitespace case，例如：

```text
U+1680 OGHAM SPACE MARK
```

示例：

```ts
const ogham = '\u1680'
expect(
  parseModelPreferenceToken(`provider${ogham}/model`)
).toBe(undefined)
```

目标不是专门支持这个字符，而是锁住：

```text
只有 ONE parser
```

之后不再存在 parser equivalence 问题。

---

# 3. 修复项 P2-3：`TeamRuntimeOptions.staticModel` 不应 silent-optional

## 3.1 当前问题

当前：

```text
packages/runtime/admission/types.ts
```

有：

```ts
readonly staticModel?: ModelSelection
```

而：

```text
packages/runtime/action-router/effects.ts
```

执行：

```ts
const initialModelGrant =
  ctx.staticModel !== undefined
    ? initialTemplateModelGrantOf(boundTemplate, ctx.staticModel)
    : undefined
```

这意味着一个合法：

```text
modelPreference: bare-model
```

如果 `TeamRuntime` caller 忘了传 `staticModel`：

```text
inspect-config
```

会静默忽略 template model。

生产 `root.ts` 当前确实正确传入了 `staticModel`，但 API 本身仍允许构造：

```text
live Agent = template model
projection = template model
inspect-config = unspecified / wrong
```

这违背本 PR 想建立的“一份 effective truth”。

## 3.2 首选修法：将 `staticModel` 设为 required

改：

```ts
export interface TeamRuntimeOptions {
  ...
  readonly staticModel: ModelSelection
}
```

同时：

```ts
export interface EffectContext {
  ...
  readonly staticModel: ModelSelection
}
```

`createTeamRuntime()`：

```ts
staticModel: options.staticModel
```

不要再：

```ts
...(options.staticModel !== undefined
  ? { staticModel: options.staticModel }
  : {})
```

## 3.3 更新所有内部 test/helper callers

搜索：

```text
createTeamRuntime(
```

所有仓库内 caller。

为测试 world 增加统一 baseline，例如：

```ts
const TEST_STATIC_MODEL = {
  provider: 'test-static',
  model: 'test-default',
}
```

要求：

- 不给每个测试随手 invent 不同值，除非测试本身需要区分；
- 无 `modelPreference` 的既有测试行为不变；
- 不新增 ambient global。

## 3.4 如果维护兼容性导致不能设 required

只有在实际仓库中存在无法在本轮更新的公开 caller 时，才允许退而求其次：

```ts
staticModel?: ModelSelection
```

但必须：

```ts
if (
  boundTemplate.modelPreference !== undefined &&
  ctx.staticModel === undefined
) {
  throw ...
}
```

也就是：

```text
无 preference + 无 staticModel
  -> 可以维持旧 test world 行为

有 preference + 无 staticModel
  -> 必须 fail loud
```

绝不允许：

```text
有 preference + 无 staticModel
  -> 当成没有 preference
```

---

# 4. 补充 `team_inspect_config` 回归测试

## 4.1 为什么必须补

PR #30 已修改：

```text
packages/runtime/action-router/effects.ts
```

使 `team_inspect_config` 也注入 template model。

但当前 Gate F 主要验证：

```text
projection/effectiveConfig
modelState
```

没有真正通过 shipped：

```text
team_inspect_config
```

工具/Runtime action 路径做断言。

所以必须补一组 focused test。

## 4.2 推荐位置

优先放在已有 action-router / tools 测试文件中，不要再新建巨大 world。

候选：

```text
packages/tools/test/p6t6-actions.test.ts
```

或已有 inspect-config 专测。

若现有文件结构不适合，可新建：

```text
packages/runtime/test/model-inspect-config.test.ts
```

## 4.3 必测 4 项

### I1 qualified preference

Blueprint：

```text
modelPreference = openai/gpt-6-astra
```

调用：

```text
team_inspect_config
```

断言 model cell：

```text
value = openai/gpt-6-astra
source = template static 对应 surface
```

不得是：

```text
staticModel
unspecified
```

### I2 bare preference

baseline：

```text
provider = qiyuan-self
```

template：

```text
modelPreference = qwen3.8-27b
```

inspect：

```text
qiyuan-self/qwen3.8-27b
```

### I3 no preference

保持：

```text
staticModel
```

### I4 human override > template

template：

```text
openai/gpt-6-astra
```

human override：

```text
openai/gpt-6-pro
```

inspect 应反映 override / pending 语义，与当前 action-router contract 保持一致。

---

# 5. Gate D 测试命名与覆盖范围收口

## 5.1 当前问题

当前：

```text
packages/runtime/test/model-activation-step8.test.ts
```

调用：

```ts
world.provider.activate(...)
```

但随后验证的 step-8 policy 是测试 helper 自己重新执行：

```text
initialTemplateModelGrantOf
+ initialMcpGrantOf
+ resolveActivationPolicy
```

所以它并没有直接读取：

```text
ActivationProvider 内部实际 step-8 policy
```

这组测试能验证：

- helper composition；
- activate 不崩；
- override row 未生成；

但不能单独证明：

```text
provider.ts 内部一定调用了 initialTemplateModelGrantOf
```

## 5.2 本轮最小处理

不要求为了这一点修改 ActivationProvider public result。

只需：

1. 把文件/describe/comment 中过强措辞改为：
   ```text
   Gate D — activation step-8 composition contract
   ```
2. 明确：
   ```text
   provider wiring 的最终行为由 Gate E + real-host R1/R2 闭合
   ```
3. 不再声称：
   ```text
   this test directly observes the provider's internal frozen policy
   ```

## 5.3 可选增强

如果现有 `ActivationProvider` 有内部 test seam 能无产品改动暴露 step-8 policy，可增加 direct assertion。

但本轮**不要为了测试而扩大 production API**。

---

# 6. Gate E 测试名称与真实覆盖对齐

## 6.1 当前问题

当前：

```text
model-blueprint-initial-routing.test.ts
```

E3 名为：

```text
direct team_delegate
```

但实际调用：

```ts
binding.childFactory.createChildSession(...)
```

它测试的是：

```text
delegation fresh-create setup boundary
```

而不是：

```text
team tool
→ TeamRuntime
→ ActivationProvider
→ child factory
```

完整链。

## 6.2 修复要求

把 E3 名称改成类似：

```text
E3 — delegation fresh-create boundary:
the member's FIRST assembly already uses the template model
```

注释明确：

```text
此 unit/integration leg 锁定 glue fresh-create boundary；
真实 direct team_delegate 全链路由 real-host R2 证明。
```

PR body / gates-summary 同步调整。

## 6.3 不需要新增另一套 direct-team_delegate unit world

real-host R2 已经真实执行：

```text
team_delegate(delegationTemplateId=worker)
```

并检查 actual provider request `body.model`。

这已经是更强证据。

本轮不要重复造大型工具级 unit harness。

---

# 7. real-host smoke 证据收口

## 7.1 H2 detail 自相矛盾

当前：

```js
check(
  'H2',
  'host port released at teardown',
  hostFree === true,
  `port ${HOST_PORT_ACTUAL} still bound`
)
```

PASS 时 summary 会得到：

```json
{
  "ok": true,
  "detail": "port 3181 still bound"
}
```

这是证据质量 bug。

### 修复

```js
check(
  'H2',
  'host port released at teardown',
  hostFree === true,
  hostFree
    ? `port ${HOST_PORT_ACTUAL} free`
    : `port ${HOST_PORT_ACTUAL} still bound`,
)
```

mock port 同理。

## 7.2 R6 “三方相等”文字不准确

当前 label 声称：

```text
body.model == effectiveConfig.model.value == modelState.current.value
```

但实际：

```text
body.model = role-worker
projection = deepseek-official/role-worker
```

代码真正验证的是：

```text
projection.provider == deepseek-official
projection.model suffix == body.model
```

### 修复 label

改成：

```text
actual request model agrees with the provider/model route in both projections
```

或者：

```text
effectiveConfig/modelState carry deepseek-official/role-worker,
and the actual provider request body.model is role-worker for that route
```

### 不改当前正确的 comparison logic

除非 mock protocol 的 `body.model` 将来升级成完整 route，否则不要强行要求：

```text
body.model === provider/model
```

---

# 8. real-host 是否需要重跑

**需要。**

虽然本轮 production 改动很小，但会修改：

- parser source；
- malformed semantics；
- `TeamRuntimeOptions.staticModel` contract；
- inspect-config path；
- smoke kit 本身。

至少重新跑一次：

```text
R1–R8 + H1–H2
```

并保留新的 final run。

由于此前已经连续 GREEN ×2，本轮不要求再次双跑；**一轮 clean final run 足够**，除非第一次出现 flake / infra anomaly。

---

# 9. 建议文件修改清单

预期 production/source 改动集中在：

```text
packages/domain/blueprint/src/model-preference.ts
packages/domain/blueprint/src/validate.ts
packages/domain/blueprint/src/index.ts

packages/runtime/agent-setup/model/route.ts
packages/runtime/agent-setup/model/template-model.ts
packages/runtime/agent-setup/model/index.ts

packages/runtime/admission/types.ts
packages/runtime/action-router/router.ts
packages/runtime/action-router/effects.ts
```

测试：

```text
packages/domain/test/t2-blueprint-validation.test.ts
packages/runtime/test/template-model-preference.test.ts
packages/runtime/test/model-blueprint-initial-routing.test.ts
packages/runtime/test/model-activation-step8.test.ts
<inspect-config focused test file>
```

real-host：

```text
tests/kits/model-preference-routing-smoke/model-preference-routing-smoke.mjs
```

文档/证据：

```text
dev/agent-workflow/evidence/model-preference-routing/gates/gates-summary.md
dev/agent-workflow/evidence/model-preference-routing/real-host/<new-final-run>/
PR #30 body
```

dist：

```text
packages/runtime/dist/...
```

按仓库现有 source→dist 同步纪律重新生成。

---

# 10. 补充测试矩阵

## S1 parser

```text
qualified
bare
further slash
ASCII whitespace
Unicode whitespace U+1680
/model
provider/
```

全部由同一个 parser 执行。

## S2 malformed runtime defensive path

```text
present malformed preference
→ throws
→ no staticModel fallback
```

## S3 helper

```text
absent -> undefined
qualified -> exact route
bare -> baseline provider + bare model
malformed -> throws
```

## S4 TeamRuntime / inspect

```text
qualified preference
bare preference
no preference
human override > preference
```

## S5 live glue regression

原 E1–E9 保持全绿。

仅修命名，不降低任何已有行为断言。

## S6 MCP regression

至少重跑：

```text
mcp-blueprint-initial-grant
multi-mcp-wiring
p8s4b-mcp-facet
```

确认 generic templateValues 未受补充改动影响。

## S7 full suite

判据仍然是：

```text
post failure set - current PR#30 pre-supplement failure set = ∅
```

不能只看 passed 数。

---

# 11. 静态 Gate

执行：

```bash
pnpm install --frozen-lockfile --ignore-scripts

pnpm typecheck

pnpm build

pnpm build:composition

pnpm check:artifacts
```

以及仓库既有：

```text
p4t6 SessionEvent denylist scan
zero-core scanner
```

如果新增：

```text
packages/domain/blueprint/src/model-preference.ts
```

属于新的 scanner-visible source，按 p4t6 当前规则更新 pin。

---

# 12. real-host final Gate

测试宿主：

```text
tests/deepseek-harness-test-use
HEAD = 46a7f68b0922371ce7144b668b90e377d8e799f4
DSH = 0.1.7-rc.1
```

重新执行：

```bash
node tests/kits/model-preference-routing-smoke/model-preference-routing-smoke.mjs
```

最终必须：

```text
R1 PASS
R2 PASS
R3 PASS
R4 PASS
R5 PASS
R6 PASS
R7 PASS
R8 PASS
H1 PASS
H2 PASS
fatal = null
exitCode = 0
```

额外人工检查 summary：

```text
H2 PASS detail = "port ... free"
```

不得再出现：

```text
ok: true
detail: "... still bound"
```

R6 detail 必须与真实比较语义一致。

---

# 13. 最终 merge-ready checklist

- [ ] malformed-present `modelPreference` 不再返回 `undefined`；
- [ ] malformed-present 不可能回落 `staticModel`；
- [ ] absent preference 仍正常回落 `staticModel`；
- [ ] Blueprint/runtime 只存在一个 `modelPreference` parser；
- [ ] Unicode whitespace regression 已覆盖；
- [ ] `TeamRuntime` 不允许静默缺失 bare-model 所需的 `staticModel`；
- [ ] `team_inspect_config` 对 qualified preference 正确；
- [ ] `team_inspect_config` 对 bare preference 正确；
- [ ] `team_inspect_config` 对 no preference 正确；
- [ ] `team_inspect_config` 中 human override 高于 template model；
- [ ] Gate D 文案不再声称直接观察 provider 内部 policy；
- [ ] Gate E E3 不再称作真实 direct `team_delegate`；
- [ ] real-host R2 继续作为真实 direct `team_delegate` 的权威证据；
- [ ] H2 PASS detail 自洽；
- [ ] R6 label 与实际 provider/model 比较语义一致；
- [ ] MCP focused suites 全绿；
- [ ] E1–E9 全绿；
- [ ] full suite 无新增失败；
- [ ] build/composition/artifacts zero drift；
- [ ] p4t6 pin 正确；
- [ ] test-use pre/post pristine；
- [ ] :3080 / :3180 zero-touch；
- [ ] CORE PATCH BUDGET = 0。

---

# 14. 给本地 Agent 的最终执行原则

> 本轮不要重做 PR #30。核心模型路由实现已经成立；只需要把“malformed 与 absent 的语义区分”“single parser”“staticModel 依赖强约束”和“测试/证据措辞”收紧。任何超出这四个方向的大规模重构都属于 scope expansion。

> 最重要的代码不变量是：  
> **`modelPreference` present+valid → template/static model value；absent → unspecified→staticModel；present+invalid → fail loud，绝不能伪装成 absent。**
