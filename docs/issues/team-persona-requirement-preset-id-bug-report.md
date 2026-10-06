# Bug 报告：团队蓝图的 persona 需求按"所选 preset 的 id"精确匹配，且失败信息误导

- **组件**：`dsh-agent-team` 插件（团队建队兼容性探测 / Team Blueprint persona 需求）
- **版本**：`dsh-agent-team@0.1.1-alpha.2`（github:armourpiercer1/dsh-agent-team，安装于 `/home/user/.dsh/profiles/web/node_modules/dsh-agent-team`）
- **宿主**：DSH checkout `/home/user/deepseek-harness`，Node v24.21.0，profile `web`（`patchReload: live`）
- **严重度**：高（阻断建队的结构性 FATAL + 错误诊断信息，用户无法按提示自救）
- **状态**：诊断完成，待修复。临时绕行措施见附录 A（修复落地后应移除）。

---

## 1. 症状

Web GUI "New Team" 面板中，**只要所选运行时预设的 id 不是 `standard`**，即使用该预设的 persona 是完全可组合的（composable prefix/suffix，与 `standard` 相同形态），建队探测也返回结构性 FATAL：

```
✕ 团队无法创建
需求 req-persona-standard — complete:true persona requirement unmet: standard
  (structural FATAL, not downgradable)
该运行时预设拥有完整的系统人格，无法承载此团队蓝图的 Leader/Member 身份
  （不改变 DSH 核心语义）。
```

- 面板 remedy 提示"更换运行时预设"，但**换成任何一个其他预设 id 仍是同样的 FATAL**——只有 id 恰好为 `standard` 的预设能通过。
- 信息把原因归为"预设拥有完整的系统人格（complete persona）"，与真实原因（preset id 不匹配）不符。
- 复现条件（当前部署）：蓝图 `route-c-round2-team` rev 7 的 `requirements: [{domain: persona, name: standard}]`；用户选择任何非 `standard` 预设（如用户自建的临时 preset）。

## 2. 根因：四段代码链

### 2.1 蓝图需求 → 兼容性 DTO：subject = 需求 name，complete 恒为 true

`packages/runtime/dist/packages/runtime/compatibility/blueprint.js:52-67`（`compatibilityRequirementsOf`）：

```js
inputs.push({
    requirementId: `req-${requirement.domain}-${requirement.name}`,
    type,
    subjects: [requirement.name],            // ← persona 域：需求 name 即探测 subject
    complete: requirement.optional !== true, // ← 未显式 optional 一律 complete:true
});
```

当前蓝图 `requirements: [{domain: persona, name: standard}]` 因此产生
`{requirementId: 'req-persona-standard', type: 'persona', subjects: ['standard'], complete: true}`。
persona 域的"需求 name 即预设 id"是**隐式约定**（与行配置 `environmentFacts` 的 `persona/standard` 对齐），无任何类型或文档区分"预设 id"与"persona 种类"。

### 2.2 UI 探测：无条件 `available: true`，subject = 所选预设 id，不读真实 persona 形态

`packages/client/composition-shim/client-bundle.js:1539-1546`（`intentEnvironmentFacts`）：

```js
function intentEnvironmentFacts(draft, presets) {
    if (draft.presetId === null) return [];
    const row = presets.find(candidate => candidate.id === draft.presetId);
    if (row === undefined) return [];
    return [{ domain: 'persona', subject: row.id, available: true, generation: 0 }];
}
```

客户端**从不检查所选预设的 `dsh-persona` 行配置**（无法区分 composable prefix/suffix 与 `complete: true`），任何存在的预设行都被上报为"persona 可用"。

### 2.3 宿主合并 + 引擎判定：persona 域只认 UI fact；subject 不等即 FATAL

`packages/runtime/dist/packages/runtime/src/plugin/s6-remote.js:405-410`（`mergeProbeEnvironmentFacts`，被 `intent.probe` 于同文件 `:800-811` 调用）：

```js
export function mergeProbeEnvironmentFacts(hostFacts, callerFacts) {
    return [
        ...callerFacts.filter((fact) => fact.domain === 'persona'),  // persona 域 = 仅 UI
        ...hostFacts.filter((fact) => fact.domain !== 'persona'),    // 其他域 = 仅行配置
    ];
}
```

`packages/runtime/dist/packages/domain/compatibility/src/engine.js:74-119`（`evaluateCompatibility`）：

```js
const fact = factByKey.get(`${requirement.type}\u0000${subject}`);   // 按 "persona\0<subject>" 查
// ...
if (requirement.complete) {
    outcome = 'FATAL';
    reasonCode = requirement.type === 'persona'
        ? COMPATIBILITY_REASON_CODES.TEAM_PERSONA_COMPLETE_PRESET_CONFLICT  // ← 复用 §7.4 专用码
        : COMPATIBILITY_REASON_CODES.COMPLETE_REQUIREMENT_NOT_MET;
    detail = `complete:true persona requirement unmet: ${unavailableSubjects.join(', ')} (structural FATAL, not downgradeable)`;
}
```

于是：所选预设 id `X ≠ 'standard'` → fact 键 `persona\0standard` 查不到 → subject 不可用 → `complete:true` → **FATAL + `TEAM_PERSONA_COMPLETE_PRESET_CONFLICT`**。

### 2.4 UI 消息映射：该 reason code 被静态映射为"完整系统人格"文案

`client-bundle.js:1492-1505`（`isPersonaPresetFatal`）：任一 FATAL 行携带该 reason code 即触发静态文案（`:5531`）与"更换运行时预设"remedy，Create 保持禁用、无 Continue-anyway：

```js
'intent.fatal.preset': '该运行时预设拥有完整的系统人格，无法承载此团队蓝图的 Leader/Member 身份（不改变 DSH 核心语义）。',
```

### 失败链汇总（截图实例）

1. 用户在 UI 选择预设 X（id ≠ `standard`；X 的 persona 实际为 composable，与 standard 同形态）；
2. UI 探测发 `{persona, X, available: true}`（2.2）；
3. 宿主按 persona 域=UI-only 合并（2.3），评估 `{req-persona-standard: complete:true, subjects:['standard']}`；
4. subject `standard` 不可用 → FATAL + `TEAM_PERSONA_COMPLETE_PRESET_CONFLICT`（2.3）；
5. UI 静态映射为"完整系统人格"文案（2.4）。

## 3. 为什么这是 bug（四个问题面）

1. **误诊（主问题）**：失败的真实条件是"所选预设 id ≠ 蓝图 persona 需求 name"，但 reason code 与 UI 文案把失败归因为"预设拥有 complete 系统人格"。可组合 persona 预设被以错误理由拒绝，且用户无法按提示自救——无法创建 id 为 `standard` 的预设（出厂 preset 占用该 id，roster 拒绝影子覆盖），唯一出路是改蓝图 + 行配置，这是配置级绕行而非产品路径。
2. **探测语义与意图错位**：`intentEnvironmentFacts` 恒发 `available: true`，从不检查预设真实 persona 形态。检查因此"过严"（id 不等 → FATAL，误伤所有 composable 自定义预设）且"过松"（若蓝图需求 name 指向一个 `complete: true` 的预设，该预设的探测会通过——UI 探测对真实 persona 形态零感知，真正的 §7.4 冲突反而不在探测点暴露）。探测实际在做"预设 id 相等"的比较，却以 persona 形态的名义呈现。
3. **reason code 复用导致 UI 误导**：`TEAM_PERSONA_COMPLETE_PRESET_CONFLICT` 本为 §7.4 真实"complete persona 与团队 persona 叠加冲突"设计；引擎对任何未满足的 persona 需求一律给出该码，UI 再把该码静态映射成"完整人格"文案。subject 不匹配与形态冲突被同码合并，诊断信息不可行动。
4. **双配置耦合无文档、无校验**：persona 需求 subject 必须同时满足 (a) 用户 UI 所选预设的 id（探测点），(b) 行配置 `environmentFacts` 的 persona subject（成员激活闸，`root.js:332-339` 直接以行配置 facts 评估）。两处是独立配置，不同步时的失败发生在**建队成功之后**的成员创建时，时机更差，且无静态校验或文档说明该不变量。

## 4. 附证：运行时 persona 基底与所选 preset 无关

`packages/runtime/dist/packages/runtime/src/plugin/root.js:363-367`：

```js
const presetSeam = {
    getSubstrate: () => ({ presetId: 'dsh-agent-team', personaKind: 'standard' }),
};
```

团队 agent 的 persona 叠加基底是**静态**的 composable standard-kind substrate，不读取用户所选 preset 的 persona。即探测点"钉住某个 preset id"在运行时没有对应语义——团队实际需要的条件是"预设提供可组合（非 complete）的 persona 基底"，而不是"预设 id 等于某个固定值"。这是修复方向 B 的依据。

## 5. 修复方向（供决策，供讨论）

- **方向 A（最小改动，修诊断）**：拆分 reason code 与 UI 分支。
  - 引擎/UI 区分两种 persona 需求未满足模式：
    - (i) subject 不匹配（所选预设 id ∉ 需求 subjects）→ 新 reason code（如 `PERSONA_PRESET_SUBJECT_MISMATCH`），文案："该蓝图绑定运行时预设 `standard`；当前所选 `X` 不匹配"，remedy 指向选择绑定预设；
    - (ii) 所选预设 persona 确为 `complete: true` → 保留现有码与文案。
  - 客户端探测补报真实 persona 形态：roster discovery 本已加载 preset composition，可提取其 `dsh-persona` 行 `config.complete` 是否置位，作为 wire fact 的附加字段（wire 形状需版本化向后兼容）。
- **方向 B（语义修复，与运行时行为对齐，推荐为下一版方向）**：persona 域需求 subject 改为**persona kind**（如 `standard` = "可组合标准形态"）而非预设 id：UI 探测上报所选预设实际提供的 kind（composable-standard / complete），行配置 facts 同步按 kind 描述；任何提供 composable standard kind 的预设通过，任何 complete 预设 FATAL（并给出真实信息）。与 `root.js` 静态 substrate（`personaKind: 'standard'`）的运行时行为一致，彻底消除"每个钉住 persona 的蓝图都需要专属 preset id + 双配置同步"的绕行负担。代价：probe wire 形状与行配置 facts schema 的小版本升级（需兼容旧 fact）。
- **方向 C（临时绕行，非产品方案）**：蓝图需求 name 改为新预设 id + 行配置 `environmentFacts` 同步改 subject。可用但脆弱（附录 A 即此措施的产物），修复落地后移除。

**建议**：A 先落地止血（修文案 + 探测报形态），B 作为语义统一方向排入后续。

## 6. 影响面

- 所有含 persona 域需求且需求 name 为特定预设 id 的团队蓝图（当前部署：`route-c-round2-team` rev 7，`persona: standard`）。
- 影响路径：(a) Web UI 建队探测（本报告主症状）；(b) boot team 的内联 `blueprintSource`（同插件 `root.js:321` 解析，同一 DTO 桥）；(c) 成员创建激活闸（行配置 facts，第 3.4 节耦合）。
- 非 persona 域需求（如 tool/skill 能力需求）不受此缺陷影响——它们只走行配置 facts，subject 语义是能力名而非预设 id。

## 7. 环境快照

| 项 | 值 |
|---|---|
| 插件 | `dsh-agent-team@0.1.1-alpha.2`（profile `web` 的 `node_modules`） |
| 宿主 checkout | `/home/user/deepseek-harness`（Node v24.21.0） |
| profile | `~/.dsh/profiles/web`（`patchReload: live`；行配置 `dsh-agent-team` 的 `blueprintSource` 为内联 rev 7） |
| 当前蓝图 | `route-c-round2-team` rev 7，`requirements: [{domain: persona, name: standard}]` |
| 行配置 `environmentFacts` | `tool/web`、`skill/base`、`persona/standard`（均 `available: true`, `generation: 1`） |
| 出厂 preset | `standard`（persona composable prefix/suffix）、`minimal`（persona `complete: true`，即 §7.4 真实案例）、`ptc`、`cordis` |

## 附录 A：临时绕行措施（修复落地后移除）

- `~/.dsh/.agent-presets/team-small-ctx/`：临时用户 preset（`agent.cordis.yml` + `preset.yml`，显示名"团队模式·小模型长上下文（临时）"）——`standard` 全能力 + 小模型长上下文 0.68 压缩基线 + 移除 subagent 工具行；persona 保持 composable（无 `complete: true`）。
- 蓝图与 profile 补丁均已**完全回滚**（内联 `blueprintSource` 与 `route-c-round2-team.v7.yaml` 逐字节一致），不存在 v8。
- 注意：在修复落地前，用 v7 蓝图建队时选择该临时预设仍会触发本报告所述的 FATAL（预期行为，正是本 bug 的体现）。该预设对普通（非团队）会话可正常使用。

## 附录 B：证据文件索引（安装包内 dist 路径）

| 证据 | 文件:行 |
|---|---|
| 需求 → DTO（subject=name, complete=非 optional） | `packages/runtime/dist/packages/runtime/compatibility/blueprint.js:52-67` |
| UI 探测 fact 构造（恒 available:true） | `packages/client/composition-shim/client-bundle.js:1539-1546` |
| 探测 fact 合并（persona=UI only） | `packages/runtime/dist/packages/runtime/src/plugin/s6-remote.js:405-410` |
| `intent.probe` 调用点 | 同上 `:800-811` |
| 引擎 FATAL 分类 + reason code 复用 | `packages/runtime/dist/packages/domain/compatibility/src/engine.js:74-119` |
| UI FATAL 判定 + 静态文案 | `packages/client/composition-shim/client-bundle.js:1492-1505`、`:5531`、`:5771`（EN） |
| 激活闸 facts thunk（行配置 verbatim） | `packages/runtime/dist/packages/runtime/src/plugin/root.js:332-339` |
| 静态 persona substrate | 同上 `:363-367` |
