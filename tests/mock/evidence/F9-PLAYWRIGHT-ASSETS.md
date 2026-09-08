# F9 Playwright Assets — 持久化 F9（Remote v4 人类裁决通道）证据资产

日期：2026-09-08（UTC+08:00）
任务：`task/repair-r1-f9-playwright-assets`（worktree `.worktrees/repair-r1-f9pw`，base `int/repair-r1` @ `8e9e211`）
范围：**仅** `tests/mock` 脚本 / gate 配置 / 提示词 + 证据文档。产品代码零修改（`packages/*` 未触碰），上游零改动，未 push。
配套验收基线：`docs/plans/active/TEAM_DTEST_WORKSPACE_PLAN_V2.md` §3 回归判据表 **R-F9** 行 + F9 任务包
（`dev/agent-workflow/evidence/F3-F11-F9-T1.4-repair/minimum-frozen-contract.md` §8.1 F9-H / §8.2 / 执行 DAG `F9-U`）。

> 本资产把 F9 的"人类裁决通道"从**一次性 live 复现**升级为**可重复的持久化 gate**：
> 一份配置驱动的 Playwright gate 集（`scripts/gates/f9-*.json`，经扩展后的 `ui-gate.mjs` 执行）
> + 一份零模型 turn 的 durable / wire 校验脚本（`f9-check.mjs`，含离线 `selftest` 预检）。
> 设计口径沿用 V2 计划 §9 执行模型（⊕ 持久 / ◌ 一次性）：
> **⊕ 持久** = 落在本仓库、每个 gate 复跑可重跑；**◌ 一次性** = 仅证据、不进产品。

---

## 0. 交付物清单

| 路径 | 性质 | 说明 |
| --- | --- | --- |
| `scripts/f9-check.mjs` | **新增 · ⊕ 持久** | F9 零模型 turn 校验：`version-gate`（wire v3/v4 门控）、`pending`（§26.2 明细字段）、`decided`（allow/deny）、`consumed`（exactly-once）、`policy`（§26.4 外部硬策略）、`selftest`（离线预检，无需活体宿主） |
| `scripts/ui-gate.mjs` | **扩展 · ⊕ 持久** | 新增 `varsFile`（`{{key}}` 插值）+ `clickEval`（按 data-attribute 选择器做确定性 DOM 动作）+ `settleMs`；原 `find`/`eval` 断言**逐字节不变**（V1/V2 既有 gate 不受影响） |
| `scripts/gates/f9-g3-pending.json` | **新增 · ⊕ 持久** | G3 待裁决明细 gate：pending 行 + 明细字段 + Allow/Deny 命令条 |
| `scripts/gates/f9-g3-allow.json` | **新增 · ⊕ 持久** | allow 半程：点 Allow → 行落 `data-decision="allow"`，命令条消失，无 resolve-error |
| `scripts/gates/f9-g3-deny.json` | **新增 · ⊕ 持久** | deny 半程：点 Deny → 行落 `data-decision="deny"`，零副作用（命令条消失） |
| `scripts/gates/f9-g4-policy.json` | **新增 · ⊕ 持久** | §26.4 外部硬策略：点 Allow → 行落 `data-decision="deny"` + `data-ledger-state-reason="external-policy"`，**不是**"审批失败" |
| `scripts/prompts/t41-deny-req.md` | **新增 · ⊕ 持久** | deny 半程的请求侧提示词（`user-approval` 意图声明，`v2-probe-2.txt`） |
| `scripts/prompts/t41-deny-exec.md` | **新增 · ⊕ 持久** | deny 半程的执行侧提示词（leader→W1 follow-up，要求"尝试但被拒"的逐字回显） |
| `scripts/common.mjs` | 复制 · ⊕ 持久 | V2 共享库（`f9-check.mjs`/`ui-gate.mjs` 的依赖）；从 V2 工作区原样复制、**零改动** |
| `scripts/gates/smoke-g1.json` | 复制 · ⊕ 持久 | G1 冒烟 gate 配置（保持 gate 目录可独立复跑） |
| `scripts/prompts/t41-exec.md` | 复制 · ⊕ 持久 | allow 半程执行提示词（V2 既有，T4.1 allow 半程的 R-F9 live 行） |
| `scripts/preflight-check.mjs` | 复制 · ⊕ 持久 | G0 契约预检（F9 模型 turn 前的既有 G0 gate；本分支自洽可复跑的依赖之一） |
| `.gitignore` | 复制 · ⊕ 持久 | `tests/mock` 运行时产物忽略规则（`.dsh-home*/state//hosts//work/` 等——保证 F9 运行时产物不进版本库） |
| `evidence/F9-PLAYWRIGHT-ASSETS.md` | **新增 · ⊕ 持久** | 本文档：选择器/文案精确表 + 字段映射 + 可复跑口径 + 预检证据 |

> **复制说明**：`common.mjs` / `preflight-check.mjs` / `smoke-g1.json` / `t41-exec.md` /
> `.gitignore` 在上游 V2 工作区（`tests/mock`）是 **untracked** 的 V2 资产（见 V2 计划 §0
> "证据入库需用户再次授权 push"）。本任务为了让 F9 gate 集在**独立 worktree / 独立分支**上
> 自洽可复跑，将其**原样**纳入本分支的 `tests/mock` 路径（零改动；内容 diff 可与 V2 工作区
> 逐字节核对）。这是对"仅新增 F9 资产"范围的最小必要扩张，且全部落在 `tests/mock`
> （非产品代码）内——已在 §6 留痕，供 Gate 审查者核对该边界。

---

## 1. F9 行为契约（被测对象，摘自 F9 实现 + 冻结契约）

F9 交付的是 **Remote contract v4** 的 `team.resolveControl`（**唯一** v4-only 方法）+
宿主侧 human 派生（T12-B4 seam）+ 客户端 pending 行的 Allow/Deny 命令面。本资产只**断言**这些
已冻结行为，不修改、不扩展。

- **版本门控（v3/v4 served-version）**：`team.resolveControl` 仅在 v4 可用（`REMOTE_V4_ONLY_METHODS`）。
  对 v1/v2/v3 发 `team.resolveControl` → 封套解析**之后**的 `method-version-unsupported`
  （`details.contractVersion` 回显**请求**版本；`details.reason = method-not-available-in-version`；
  `details.field = method`）。v4 请求通过版本门后到达 control port。
- **闭合参数（U3）**：v4 参数**恰好** `{teamSessionId, requestId, decision: allow|deny, note?}`。
  **无** caller/role/actor 字段——夹带 `caller` 是 `malformed-params` / `unknown-field`
  （`details.field = caller`），且发生在任何派生 / port 工作**之前**。
- **人类入口（invariant 37 / 34）**：`user-approval` 的 resolver 闭集 = `{human}`——
  member 永远不是 resolver（自批准禁止）；裁决落账的 `decider.kind` 必须是 `human`。
- **exactly-once**：第一个裁决权威（`decided` 半程）；`control-allow-consumed` 恰好一条
  （allow 消费，`consumed` 半程）；deny / 外部策略**无**消费（零副作用）。
- **§26.4 外部硬策略**：外部硬策略 deny 一个 `allow` 时，durable 行记为
  `decision=deny` + `reason=external-policy`（decider 仍是发起裁决的 human），
  然后抛 typed `CONTROL_EXTERNAL_POLICY_DENIED`。UI 呈现为 `data-decision="deny"` +
  `data-ledger-state-reason="external-policy"`——**不是**"审批失败"、**不是** `allow`。
- **durable requestId**：`ctrl-` 前缀的 opaque token（`requestIdOf`，24 字符确定性），
  是 UI 命令条 `data-request-id` 与 durable `control-request-recorded` payload 的**同一** id。

---

## 2. 精确期望选择器 / 文案（gate 断言的"真值表"）

以下选择器与文案**逐字**来自 F9 客户端实现（`packages/client/src/ui/TeamLedger.tsx`
+ `packages/client/src/ui/locales.ts`）与 durable 事实（`packages/runtime/control/service.ts`）。
gate 配置里的 eval 字符串按此断言；**文案双语**（en/zh 均接受，因为运行 locale 取决于宿主 locale）。

### 2.1 pending 控制请求行 + 命令条（`f9-g3-pending.json`）

| UI 元素 | 精确选择器 | 精确文案（en / zh） | 数据来源 |
| --- | --- | --- | --- |
| 命令条容器 | `div[data-ledger-resolve-bar][data-request-id="<requestId>"]` | — | 行 `payload.requestId`（`ctrl-*`） |
| Allow 按钮 | `button[data-ledger-resolve-allow]` | `Allow` / `允许` | `view.ledger.resolve.allow` |
| Deny 按钮 | `button[data-ledger-resolve-deny]` | `Deny` / `拒绝` | `view.ledger.resolve.deny` |
| busy 指示 | `span[data-ledger-resolve-busy]` | `Resolving…` / `裁决中…` | `view.ledger.resolve.busy` |
| typed 错误 | `span[data-ledger-resolve-error][data-resolve-error-code="<code>"]` | `Resolve failed (<code>): <message>` / `裁决失败（<code>）：<message>` | `view.ledger.resolve.error` |
| 请求行 | `button[data-ledger-row][data-ledger-kind="control-request"]` | — | fact `control-request-recorded` |
| 行时间 | `span[data-ledger-time]` | 格式化时钟 | `entry.createdAt` |
| 行类型标记 | `span[data-ledger-marker]` | `Control request` / `控制请求` | `view.ledger.fact.control_request` |
| 行 actor | `span[data-ledger-actor]` | 目标实例标签 | `payload.targetInstanceId` |
| 行摘要 | `span[data-ledger-summary]`（`title` = 完整明细） | 单行摘要 | `payload.actionName` / `summary` |
| pending 徽标 | `span[data-ledger-state][data-pending="true"]` | `Pending decision` / `等待裁决` | `view.ledger.pending` |

> **命令条渲染条件（源码事实）**：`onResolveControl` face 存在 **且** 行
> `kind === 'control-request'` **且** `row.pending !== false` **且** `row.requestId !== undefined`。
> 命令条是行的**兄弟节点**（行是 `<button>`，嵌套按钮是非法 HTML）——
> 所以 gate 用 `bar.previousElementSibling` 反查该行做明细断言（见 `f9-g3-pending.json` 第 3 条 eval）。

### 2.2 裁决落账行（`f9-g3-allow.json` / `f9-g3-deny.json` / `f9-g4-policy.json`）

| UI 元素 | 精确选择器 | 精确文案（en / zh） | 数据来源 |
| --- | --- | --- | --- |
| 裁决行 | `button[data-ledger-row][data-ledger-kind="control-decision"]` | — | fact `control-decision-recorded` |
| allow 徽标 | `span[data-ledger-state][data-decision="allow"]` | `Allowed` / `允许` | `view.ledger.decision.allow` |
| deny 徽标 | `span[data-ledger-state][data-decision="deny"]` | `Denied` / `拒绝` | `view.ledger.decision.deny` |
| stale-denied 徽标 | `span[data-ledger-state][data-decision="stale-denied"]` | `Stale denied` / `过期拒绝` | `view.ledger.decision.stale_denied` |
| 外部策略原因 | `span[data-ledger-state-reason]`（`title` + 文本均 = `external-policy`） | `external-policy` | `payload.reason` |

> **注意**：allow / deny 徽标的 `textContent` 是**纯**文案（`Allowed`/`Denied`），
> 因为 `reason` 是**子** span（`data-ledger-state-reason`），不在徽标自身文本里——
> 所以 `f9-g3-allow.json`/`f9-g3-deny.json` 用 `===` 精确比对，
> 而 `f9-g4-policy.json` 用 `startsWith('Denied')` + 独立查 `data-ledger-state-reason`。

### 2.3 wire 层精确期望（`f9-check.mjs version-gate`）

| 探测 | 精确 `error.code` | 精确 `error.details` 断言 |
| --- | --- | --- |
| v1/v2/v3 → `team.resolveControl` | `method-version-unsupported` | `details.contractVersion === <请求版本>`、`details.reason === 'method-not-available-in-version'`、`details.field === 'method'`、`ok === false` |
| v4 → 未知 `requestId` | `CONTROL_REQUEST_NOT_FOUND` | `ok === false`（证明**过了**版本门、到达 control port） |
| v4 → 夹带 `caller` 字段 | `malformed-params` | `details.field === 'caller'`、`details.reason === 'unknown-field'`、`ok === false` |

---

## 3. §26.2 pending 请求"明细字段"映射（`f9-check.mjs pending`）

F9 任务包 F9-U 验收要求 pending 明细展示
requester / kind / requested operation / reason / created-at / status / requested authority。
`f9-check.mjs pending` 对 **durable** `control-request-recorded` payload 逐项校验（UI 侧由
`f9-g3-pending.json` 覆盖可见单元格）：

| 明细字段 | payload leaf | 校验 | 落点 |
| --- | --- | --- | --- |
| requestId | `payload.requestId` | `ctrl-*` opaque token（`^ctrl-`） | `f9-check pending` + 命令条 `data-request-id` |
| kind（requested authority 类别） | `payload.kind` | ∈ 闭集 `{leader-approval, user-approval, envelope-mutation}` | `f9-check pending` |
| requester（请求者 principal） | `payload.requester` | 存在且 `kind` 非空（`ControlCallerRef`） | `f9-check pending` |
| requested operation | `payload.actionName`（+ `payload.summary` 说明） | 非空字符串；`summary` 若存在必须是字符串 | `f9-check pending` + 行 `data-ledger-summary` |
| 目标 | `payload.targetInstanceId` | 非空 | `f9-check pending` + 行 `data-ledger-actor` |
| 关联 token | `payload.correlation` | 非空 | `f9-check pending` |
| created-at | `entry.createdAt` | 非空（行 `data-ledger-time` 渲染） | `f9-check pending` + 行 `data-ledger-time` |
| status（pending / 已裁决） | 是否存在配对 decision 事实 | `splitControlFacts` 的 `pending` 判定 | `f9-check pending` + 徽标 `data-pending` |

`pending` 阶段还会把选中请求的字段写成 `state/f9-pending.json`（`requestId` 等），
供 `ui-gate.mjs` 经 `varsFile` 的 `{{requestId}}` 插值精确锁定**该**请求的命令条
（而不是页面上任意一个 pending 行）——这是"按 requestId 精确 gate"的关键接线。

---

## 4. 可复跑口径（⊕ 持久，gate 复跑时逐条重跑）

**前提**：一个按 V2 计划 §1/§2 拉起的 mock 宿主（`boot.mjs`，port 3181，MCP 3491/3492），
且 `team.resolveControl` 的 v4 面已在构建产物里（F9 已并入 `int/repair-r1` @ `8e9e211`，
client composition 已重生成携带 `team.resolveControl`）。

**预检（零模型 turn、无需活体渲染）**：
```
node scripts/f9-check.mjs selftest          # 离线 fixture，23 断言，exit 0
node scripts/f9-check.mjs version-gate      # 需活体宿主 + cookie（boot-state.json）
```

**G3 pending 半程**（一次真实模型 turn 让成员发出 user-approval 请求后）：
```
node scripts/f9-check.mjs pending --json '{"kind":"user-approval"}'   # 写 state/f9-pending.json
node scripts/ui-gate.mjs scripts/gates/f9-g3-pending.json
```

**G3 allow 半程**（点 Allow → 裁决落账）：
```
node scripts/ui-gate.mjs scripts/gates/f9-g3-allow.json
node scripts/f9-check.mjs decided  --request-id <rid> --expect allow
# 成员 guarded 写成功后：
node scripts/f9-check.mjs consumed --request-id <rid>
```

**G3 deny 半程**（用 `t41-deny-req.md` 发第二个 user-approval 请求，human deny）：
```
node scripts/f9-check.mjs pending --json '{"kind":"user-approval","out":"state/f9-deny-pending.json"}'
node scripts/ui-gate.mjs scripts/gates/f9-g3-deny.json
node scripts/f9-check.mjs decided  --request-id <rid> --expect deny
node scripts/f9-check.mjs consumed --request-id <rid> --json '{"expectAbsent": true}'   # 零消费 = 零副作用
```
> deny 的"零副作用"由 `decided --expect deny`（恰好一条 deny 裁决、decider=human）+
> `consumed --json '{"expectAbsent": true}'`（**无** `control-allow-consumed` 事实）共同覆盖。

**G4 §26.4 外部硬策略**（boot#2，`externalPolicyFacts.hard.tools=deny` 注入，T4.7）：
```
node scripts/f9-check.mjs pending --json '{"out":"state/f9-policy-pending.json"}'
node scripts/ui-gate.mjs scripts/gates/f9-g4-policy.json
node scripts/f9-check.mjs policy --request-id <rid>   # deny + reason=external-policy + human + 无消费
```

**每次 gate 复跑都会**重新产出：`state/teamtab-f9-*.yml`（snapshot）、
`evidence/screenshots/f9-*.png`（screenshot）、`state/ui-gate-f9-*-raw.txt`（raw 日志）。

---

## 5. 与 V2 计划 R-F9 行的对应

V2 计划 §3 回归判据表 **R-F9**（round-1 结论：`user-approval` 无 human 裁决通道，T4.1 allow 半程 blocked）
→ 本资产把该行拆成 4 个可重复 gate：

| V2 R-F9 子判据 | 本资产 | 半程 |
| --- | --- | --- |
| pending 明细展示（§26.2） | `f9-g3-pending.json` + `f9-check pending` | G3 |
| human allow → 裁决落账 + 成员 guarded 写放行 | `f9-g3-allow.json` + `f9-check decided/consumed` | G3 |
| deny → 零副作用 | `f9-g3-deny.json` + `f9-check decided(deny)` | G3 |
| §26.4 外部硬策略呈现（非"审批失败"） | `f9-g4-policy.json` + `f9-check policy` | G4 |
| v3/v4 served-version 门控 | `f9-check version-gate`（wire） | 预检 |

这正是 F9 任务包把 F9 标为 **fix-verified**（`F9-H`/`F9-U` 已修）所需的可重复证据。

---

## 6. 沙箱 / 合规红线遵守（本轮）

- **产品代码零修改**：`packages/*`、`packages/*/dist` 一律未触碰；本分支 diff 仅落在 `tests/mock`。
- **上游零改动**：`references/deepseek-harness-test-use` pristine（未动）；`CORE PATCH BUDGET = 0` 保持。
- **未启动稳定实例**：未触碰 `:3080` / `D:\deepseek-harness\`；本轮**未**启动任何 DSH 实例
  （`selftest` 是离线的；`version-gate` 等需活体宿主的阶段留待 V2 回归轮按 §4 口径拉起）。
- **未 push**：任务分支 `task/repair-r1-f9-playwright-assets` 仅本地，等 Gate / 用户授权。
- **API key 未打印 / 未落盘新副本**。

## 7. 预检证据（本轮实际执行，2026-09-08）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 脚本语法 | `node --check f9-check.mjs / ui-gate.mjs / common.mjs / preflight-check.mjs` | 全部 exit 0 |
| gate 配置 JSON | `node -e "JSON.parse(...)"` × 5（f9-×4 + smoke-g1） | 全部 exit 0 |
| 离线自测 | `node f9-check.mjs selftest` | **23 PASS / 0 FAIL，exit 0** |

> 自测往返留痕（两处均为本资产自身缺陷，产品行为断言零改动）：
> 1. 初跑 1 FAIL——`selftest policy` 调用漏传 `rid` 实参（笔误），修正后转绿；
> 2. 复核 durable 事实形状时发现 `checkDecided` 初版把 `createdAt` 读在
>    decision **payload** 上，而产品实现（`control/service.ts` `commitDecision`）
>    把 `createdAt` 写在**条目**（entry）层、payload 仅含
>    `requestId/decision/decider/scope/requestSequence[/reason|note]`——已改为读条目层
>    并补负向自测（`decided missing entry createdAt detected`）。
> 该往返证明 selftest 的**负向断言**（错误码 / 错 echo / 双裁决 / 双消费 /
> 成员 decider / 缺字段均被正确捕获）是有效的，不是恒真。

## 8. 遗留 / 交接（非阻塞）

1. `common.mjs` / `smoke-g1.json` / `t41-exec.md` 为 V2 untracked 资产的原样复制（§0 复制说明）；
   V2 计划 §0 的"证据入库需用户再次授权 push"对本分支同样适用——本任务不 push。
2. `version-gate` / `pending` / `decided` / `consumed` / `policy` 五个**需活体宿主**的阶段
   本轮**未**实跑（按红线不启动实例）；其离线等价物（`selftest`）已绿。V2 回归轮按 §4 口径
   拉起宿主后，这些阶段即成为 R-F9 行的正式判据执行。
3. `ui-gate.mjs` 的扩展是**加法**（`varsFile` / `clickEval` / `settleMs` + 对未知 assert 字段的
   `WARN` 提示）；`find`/`eval` 两既有分支的判定逻辑**未改**，`smoke-g1.json` 等既有 gate 语义不变。
