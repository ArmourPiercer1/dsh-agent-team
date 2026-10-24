# p-takeover-proposal — todo_write P 前置接管（B-SESSION todo 臂）可机械落地三件

状态：PROPOSAL（M2-TODO-01，todo arm owner 提交；落码 owner = CENTER 独占共享接线 + SERVICE 写 adapter 臂）。
合同：`docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/M0-B-FAMILY-TARGET-CONTRACTS.md` §1/§1.1/§1.2/§3 B-SESSION（保留原生 + 统一前置接管）。
锚文取自工作树 HEAD `7a3540937`（2026-10-23）；行号会漂，**以引文为插入锚**。

## 1) `packages/runtime/src/plugin/live/team-tool-plane.mjs` — takeover 表增行（CENTER 独占文件）

**插入位置**：`PLANE_SUPPORTED_NATIVE_TAKEOVERS` 表尾，`jobs` 行之后、`})` 之前。当前锚文（HEAD :478-480）：

```js
  jobs: Object.freeze(['job_output', 'job_list', 'job_kill']),
})
```

**插入文本**（jobs 行与 `})` 之间）：

```js
  // A5-M2 B-SESSION todo arm (M2-TODO-01): the governed todo row mounts at the
  // FIXED native spelling under the closed `todoEnabled` key — same law as the
  // jobs trio: never the configurable `names` map, absent = zero rows, a
  // non-boolean gate is a config defect refused at assembly. The same-name,
  // same-meaning implementation this ledger line records is
  // createGovernedTodoPrecheck (governed-families/todo.mjs): pure classify +
  // typed owner/incarnation prechecks in front, the PINNATIVE todo_write body
  // captured at bind time behind (contract §3 B-SESSION 保留原生 — no new I/O
  // face, no name-based re-lookup after approval).
  todo: Object.freeze(['todo_write']),
```

表语义与 jobs 行一致（ledger = 本 install 可挂载之真话；`verifyPlaneNames` 只对 grep/glob/bash/read 行走查，todo 行走固定拼写路径，`PLANE_RESERVED_NATIVE` 已含 `todo_write`，无需动保留名表）。

**同文件**：`createTeamToolPlaneAssembly` 内新增闭合键消费，逐字镜像 jobsEnabled 形（现锚 HEAD :775-783）：

```js
  const todoEnabledRaw = input.plane?.todoEnabled
  if (todoEnabledRaw !== undefined && typeof todoEnabledRaw !== 'boolean') {
    return {
      ok: false,
      code: 'PLANE_CONFIG_INVALID',
      message: `planeCfg.todoEnabled must be a boolean when present — got ${JSON.stringify(todoEnabledRaw) ?? String(todoEnabledRaw)} (a non-boolean gate is a config defect: the mount is refused rather than silently defaulting)`,
    }
  }
  const todoEnabled = todoEnabledRaw === true
```

（jobsEnabled 用的 code/message 模板照抄其形状；若 jobsEnabled 实际 code 字面与此不同，以现文为准对齐——CENTER 落码时逐字核对 :776-781。）

## 2) `packages/runtime/src/plugin/live/agent-bindings.mjs` — closed-world 消费增项（CENTER 独占文件）

镜像 jobs 桥消费块（现锚 HEAD :2572-2583，注释块起于 "management trio. Built ONLY when…"）：在 `const a5JobsBridge = planeCfg.jobsEnabled === true ? …` 块之后加同形块：

```js
        const a5TodoBridge = planeCfg.todoEnabled === true
          ? createGovernedTodoPrecheck({ /* deps LAZY: per-root gateway row,
              plane handle, and the member's PINNATIVE todo_write definition
              captured at bind time — never re-read by name post-approval */ })
          : null
```

并把 `todoEnabled` 随 plane 装配输入下传（与 `jobsEnabled` 同一 `plane: { … }` 对象）。closed-world 名单侧**无保留名表改动**（`todo_write` 已在 `PLANE_RESERVED_NATIVE`@:410）；todo 行经与 jobs trio 相同的 publish/placement 通道出现，`origin='inherited-native'`、`definitionIdentity = definitionIdentityOf(captured native definition)`（`tool-dispatch/install.ts:116`）。掩面义务：todoEnabled 实例上原生同名 face 必须先于新行 mask（CENTER placement 法则，audit 见 §5 注意）。

## 3) classify 的 effects 闭集词写法 + manifest 字段名（SERVICE 写 `governed-families/todo.mjs` 时照此）

**效果词（机器字段，§1.1 零新 kind）** — `todo_write` 单 operation ⇒ 恰一条，词表钉死在
`packages/domain/tool-governance/src/effects.ts:43`（EFFECT_KINDS）与 `:57-62`（ToolInvokeEffect）：

```js
{ kind: 'tool-invoke', toolName: 'todo_write', resource: null }
```

- `@<definitionIdentity>` **不写进 effect**（tool-invoke 无 resource 槽，:101 法）：身份绑定在
  `ToolBinding.definitionIdentity`，由 Guard 每调用比对 `definition.fingerprint === entry.binding.definitionIdentity`（closed-world-guard.ts:606-610）。台账记法 `I:tool-invoke@<definitionIdentity>` = bindingId/definitionIdentity 的 shorthand，机器面只有上面三个字段。产出后必须过 `parseRequestedEffectSet`（现 fixture T12 即此证）。
- **S 臂不入 PA effects**（§1.1：S 是业务操作义务的语义记法）：`S(current session incarnation, exact todo action)` 的落点 = targetManifest 字段 + P 前置 owner/incarnation 检查 + 原生提交入口 `exec.agent.session.append('todo/write', …)`（宿主 index.ts:199，pin639）。
- F/N/D = 无（todo 不触 FS/网络/独立域）。

**targetManifest 严格字段名**（实现版现形；封闭集**待中心定版**——缺项清单已交 CENTER）：

```js
{
  operation: 'replace-list',            // 闭集单值；todo_write 只有一个公开 operation
  agentId: <string>,                     // 真实 exec.agent.id（Agent.id，Session-backed）配对成功后回填
  sessionHeaderId: <string>,             // 真实 exec.agent.session.header.id（durable header 单副本）
  todosDigest: <sha256hex>,              // 规范化(trim)后 JSON 摘要 —— 摘要只是 manifest 字段，绝不冒充身份
  counts: { pending, inProgress, completed },
  allowParallelPolicy: <boolean>,        // config 消费位（装配期定值）
  paramFingerprint: <sha256hex>,         // = todosDigest（单参数即全指纹）
}
```

（root 修复卡后 `sessionIncarnation` 字段**已删**——incarnation≠identity；两真实 id 即 I+S 臂的载体。）

**operationFingerprint**（A request 的 `parametersFingerprint` 载体；全值算法**待中心定版**）：现实现 = `sha256:<hex64>` 前缀形（冻结 grant 语法 `$.parametersFingerprint` field-type 实跑撞出的硬要求，同侪件一致）+ canonicalJson(key 排序) 覆盖 `{generations, callId, effects, reviewPayload}` 全值。定版只改 todo.mjs 一处。

**typed 码**（P-PROPOSED，命名权在 AUTH/CENTER，family 前缀供裁）：
`P_TODO_CLASSIFY_UNKNOWN_PARAMETER`（含**未知顶层键**——原生层无此拒，T10 回归网所在格）、
`P_TODO_CLASSIFY_INVALID_ARGUMENTS`、`P_TODO_CLASSIFY_NO_OWNING_SESSION`（替代宿主 :194-197 裸 Error）、
`P_TODO_CLASSIFY_FOREIGN_SESSION`。

**落码后义务（已履行）**：~~T10/T11 翻为 typed 拒断言~~ —— **已完成**：arm 落地当轮 T10/T11 已翻（typed 拒+零 append），且 HOST 面原状（open root 接受键并写入；裸 Error）各自保留钉死（宿主零字节，pinned≠endorsed）。

**集中面注意（交 CENTER）**：实现版 arm **未 import** `domain/tool-governance`（effects 词以结构直发，`parseRequestedEffectSet` 兼容证在 fixture T12）⇒ `scripts/audit-a5-tool-governance-imports.mjs` 消费者清单**无新增**；普查/lint 基线重录见 §5。

## 4. place-dist glue 登记（arm 已落 src，装配归 CENTER；API = 实现版，非提案版）

实现体：`packages/runtime/src/plugin/live/governed-families/todo.mjs` → `createGovernedTodoArm(deps)`。deps 全必填（构造即校验，非布尔/缺项=throw，装配失败非静默默认）：

```js
createGovernedTodoArm({
  nativeDefinition,          // 绑定期捕获的原生 todo_write definition 对象（成员 ctx 注册现场捕获；绝不按名重找；execute 函数值同刻快照）
  definitionIdentity,        // definitionIdentityOf(nativeDefinition) @ tool-dispatch/install.ts —— I 臂 @ 半格，末端重核
  providerId,                // 放置装配自证（'team-adapter'/CENTER 定值；非空必填）
  memberAgentId,             // 真实 Agent.id 配对目标（root 卡①）
  sessionHeaderId,           // 真实 session.header.id 配对目标（durable 单副本）
  bindingFacts,              // () => {bindingId, bindingRevision, policyGeneration, authorityGeneration}：注入的 M1/Guard 同一代际读者；arm 不自造代际
  allowParallelInProgress,   // 装配期 config 定值（manifest 报策略；执法律留原生）
  observe,                   // §1.2 最小 backend 日志（classify/admit/backend-start|commit|end/cancel + correlation）
})
// 面（root 修复版签名）：
//   classify(args, exec, callId)            → 纯解析+真实形配对+深冻结 payload/指纹；快照 append/facade 在此刻定（批准窗之后不可追改）
//   prepare(plan, grant)                    → 记 kernel grantId 入内部态（STATE=记账，非权限来源）
//   execute(plan, {grant, consumed:true})   → 唯一入口：需真 A 边消费凭证；配对/代际/body 重核→提交末端取消·drain 重核→快照跑体
//   cancel(plan) / drain()
```

**装配三步（CENTER 单 writer，`agent-bindings.mjs`，接 §2 的 `a5TodoBridge` 块）——每步的权限来源标注（root 卡：ticket 只是内部状态，不是权限来源）**：
1. **捕获**：成员 setup 的原生注册现场（preset mount 之后）取 `todo_write` definition 对象 + `definitionIdentityOf` 同刻快照 + 真实 `memberAgentId`/`sessionHeaderId`——这是"绑定期捕获"的**唯一合法捕获点**，晚于 = drift。
2. **placement + 真 A 开单**：向 Guard/placement feed 以 `origin='inherited-native'`、`definitionIdentity=快照` 发布 governed 行（jobs trio 同通道同法）；调用路由 = arm 面，**不是** `ScopedDispatcher.byName` 按名路（§1.1）。每调用 `assembly.admitCall(request)`（request.parametersFingerprint = classify 的 operationFingerprint）：本家族 lane 事实 = `PermissionTool` 闭集不含 `todo_write` 且 `default:'allow'` 被语法拒 ⇒ **唯一可表达正控 = ask 案**；requires-approval → 审批案（C2 起 = AUTH 桥真 leg；C1 现形 = 已披露 stand-in `approvingControlLeg`，经 `assembly.issueApprovedGrant` **落真 kernel grant**）→ `arm.prepare(plan, grant)`【拿真 grant 的就是这一步：grant 由 kernel mint，arm 只记数】。
3. **唯一 consume + mask**：`assembly.consumeForExecution(grant, {...})` = 全链**唯一** consume 边（kernel one-shot ledger 记账；arm 不建任何账本）→ `arm.execute(plan, {grant, consumed:true})`；同 exec 双票证在 T18(d)（第二 plan 无配对凭证 → typed 拒，append 恒 1）。`todoEnabled` 实例上原生同名 face 先 mask 后发行（Guard `maskedNames`/maskPort 既有通道）；DRAINING 由 arm.drain()+Guard 双闸，fixture T20 已证无 native fallback 可退。

**booking 续清单（CENTER 明处登记用）**：新 scannable 文件 = `packages/runtime/src/plugin/live/governed-families/todo.mjs`（测试文件 `packages/runtime/test/a5-m2-todo-write-c1.test.ts` 已在 `SCANNED_PATHS_A5M2`）；`lint-identities` = todo.mjs 导出面为新身份（`A5_TODO_FAMILY_ID/TOOL_NAME/OPERATION/ADAPTER_REVISION/TYPED_CODES/createGovernedTodoArm`）；`check-artifacts` = 重建 dist 镜像含新 .mjs；census = 文件 558→560（+test、+src）、legs **+20**（root 修复波重数；前报 +14/+18 作废）、9 titled reds 容差集不动。
