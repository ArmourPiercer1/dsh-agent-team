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

**targetManifest 严格字段名**（fixture T12 现形）：

```js
{
  operation: 'replace-list',            // 闭集单值；todo_write 只有一个公开 operation
  sessionIncarnation: <string>,          // 受信 ctx，非模型参数
  todosDigest: <sha256hex>,              // 规范化(trim)后 JSON 摘要
  counts: { pending, inProgress, completed },
  allowParallelPolicy: <boolean>,        // config 消费位（装配期定值）
  paramFingerprint: <sha256hex>,         // = todosDigest（单参数即全指纹）
}
```

**typed 码**（P-PROPOSED，命名权在 AUTH/CENTER，family 前缀供裁）：
`P_TODO_CLASSIFY_UNKNOWN_PARAMETER`（含**未知顶层键**——原生层无此拒，T10 回归网所在格）、
`P_TODO_CLASSIFY_INVALID_ARGUMENTS`、`P_TODO_CLASSIFY_NO_OWNING_SESSION`（替代宿主 :194-197 裸 Error）、
`P_TODO_CLASSIFY_FOREIGN_SESSION`。

**落码后义务**：`packages/runtime/test/a5-m2-todo-write-c1.test.ts` T10/T11 **翻为 typed 拒断言**（fixture 内已注释钉死：翻转为落地证明，静默即红旗）。

**集中面注意（交 CENTER）**：新文件 `packages/runtime/src/plugin/live/governed-families/todo.mjs` 若 import `domain/tool-governance`，`scripts/audit-a5-tool-governance-imports.mjs` 的 reviewed-consumer 允许清单需同步增行（该脚本明示：每次增员 = 一次受审编辑，非静默）；普查基线由 CENTER 明处重录。
