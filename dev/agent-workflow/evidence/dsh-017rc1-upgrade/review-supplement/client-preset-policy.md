# Review-supplement F2 — honor the 0.1.7 `modeSelectionEnabled` preset policy

日期：2026-09-24 · 分支：`task/dsh-017rc1-upgrade`
Guide：`PR29-review-supplement-fix-guide.md` §2–§4（finding F2）
Host pin：`46a7f68b0922371ce7144b668b90e377d8e799f4`（0.1.7-rc.1）

## 1. Finding（review 结论，复述）

客户端（`packages/client/src/plugin/team-mount-core.ts` 的 `listAgentPresets`）
**解析了 `agentPresets/list` 响应的 `modeSelectionEnabled` 但完全忽略它**：无论宿主
策略如何，Team 创建面板的 preset roster 恒等于"全部 usable presets"。宿主策略
（`modeSelectionEnabled=false` = 隐藏模式选择、新会话直接用默认 preset）在 Team
创建入口被插件静默推翻。

## 2. 0.1.7 事实（源码核实：字段存活，非废弃）

- `packages/preset/agent-preset-registry/lib/types/types.d.ts:19`：
  `AgentPresetRoster { presets: readonly AgentPresetRow[]; modeSelectionEnabled: boolean }`
  —— 字段文档："Whether visible mode selection is enabled for unnamed new sessions"。
- `AgentPresetRow { id, isDefault, name?, description?, broken? }`。
- wire 默认（`remote-default-responses.ts:28`）：`ok({ presets: [], modeSelectionEnabled: true })`。
- 上游 UI 消费面（本插件必须与之对齐的语义）：
  - `packages/client/ui-agent-preset/src/client/section-store.ts`：
    `showPicker: modeSelectionEnabled`（启用 → 显示选择器 = 全 roster）。
  - `seat-store.ts`：`if (!modeSelectionEnabled) this.clearStage()`；INTERNAL fallback
    `presets.find(p => p.isDefault)?.id ?? presets[0]?.id ?? ''` —— **该 fallback 是
    上游内部 store 的兜底，guide 明令本插件不得采用 first-usable 兜底**（见 §4）。
  → guide §3 的"字段可能已退役"回退条款**未触发**：0.1.7-rc.1 中字段存活且语义明确。

## 3. 修复（`packages/client/src/plugin/team-mount-core.ts` → `listAgentPresets`）

```ts
const { presets, modeSelectionEnabled } = result.value
const usable = presets.filter((row) => row.broken === undefined)
const visible = modeSelectionEnabled
  ? usable
  : usable.filter((row) => row.isDefault === true)
if (!modeSelectionEnabled && visible.length === 0) {
  throw new Error(
    'agentPresets/list: mode selection is disabled (modeSelectionEnabled=false) ' +
    'but the host roster declares no usable default preset',
  )
}
// 返回 visible.map(row => ({ id, name, description, isDefault }))
```

策略表（与 guide §3 对齐）：

| 宿主响应 | 插件行为 |
| --- | --- |
| `modeSelectionEnabled=true` | 全部 usable（`broken` 行剔除）—— 0.1.5 行为不变，选择器保留 |
| `modeSelectionEnabled=false` + 存在 usable default | **仅 default**（不空 roster、不返回全 roster、无选择器） |
| `modeSelectionEnabled=false` + default 行 `broken` 或缺失 | **fail-visible throw**（消息含字段名与原因）—— 不用 first-usable 兜底替宿主做政策决定（**有意偏离上游 seat-store 内部兜底**，按 review 裁决留档） |

## 4. 测试（`packages/client/test/client-plugin-mount.test.ts`，F2 `describe`，4 例）

- **T1**（chooser enabled）：2 preset（default + 非 default）→ `listAgentPresets()`
  原样返回两者（行为不变的回归锚）。
- **T2**（chooser disabled）：同 roster → **仅 default 行**返回。
- **T3**（disabled + default broken）：default 行 `broken: true` → reject，
  `/modeSelectionEnabled=false.*no usable default/`（无静默换 default）。
- **T4**（disabled + 无 default）：roster 全为非 default → reject（同上）。

fixture 升级：remote double 的 `agentPresets/list` 响应体 =
`{ presets, modeSelectionEnabled }`（来自 `makeMount` 的 `modeSelectionEnabled`
选项，默认 `true` 保持既有 47 文件套件语义不变）。

结果：client 套件 **47/47 文件 | 656/656 测试**（基线 649 + 本 4 例 + F3 3 例，零失败）。

## 5. 实宿主验证

见 `real-host-smoke.md` H2：0.1.7 宿主 wire 上 `agentPresets/list` 的
`modeSelectionEnabled` **实际值**（记录真值，不假设）+ New Team 创建 PASS。
（若实测该字段在已发布 registry 面上缺席/退役 —— 与 §2 源码事实矛盾 —— 将按
guide §11 注记以源码为准并单列，当前源码核实结论 = 存活。）
