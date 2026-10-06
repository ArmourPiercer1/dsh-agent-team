# DSH Agent Team vNext — P9 UI：T+12h → T+24h Legacy-Reuse Implementation & Test Plan

> **Status: 已归档｜P9 UI 已完成，`P9_VERDICT=GO`，post-GO 试用缺陷批次已收口。**
>
> **真正执行进度：** S0–S9 完成；S9 五闸全绿、DoD 15/15，独立 reviewer 于 `0738b45` 给出 GO。随后 R118/R119/R121 暴露并收口全局入口、创建链与 workspace 等试用问题；安装面又完成 plugin-bundle-form 与 plugin-prebuilt-artifacts 闭环。P10 未启动。
>
> **完成时间：** 2026-09-05（P9 产品合流、安装验证与推送收口）。
>
> **Purpose:** 在 T+0～T+12 Production Vertical Closure 已得到 `VERDICT=GO` 的前提下，用 **12 小时 wall-clock** 完成 P9 UI 的生产级接线、旧 UI 资产迁移、vNext-only UI 补齐与验证；核心约束是 **最大化复用 `deepseek-harness:feat/agent-teams` 已完成 UI，而不是再次重写一套 UI**。
>
> **Primary implementation baseline:** `ArmourPiercer1/dsh-agent-team`, `int/P8-S-backend-closure@7d07330cca7bb3df416e3a82359d4307d9ab4a64`
>
> **Legacy asset baseline:** `ArmourPiercer1/deepseek-harness`, `feat/agent-teams@506191ba893ac55980dd09680c438710ab24095b`；该 commit 的 tree 为 `a45fd296be6546844c5fae2024bb1a12f831b312`。
>
> **Frozen backend authority:** `dev/agent-workflow/evidence/P8-S/backend-contract-freeze.md`。该文档明确声明其为 P9/P10 的唯一 backend contract reference；P9 不得静默扩展 Remote/Projection contract。

---

## 0. Executive decision

P9 的默认策略不是“按 vNext 设计重新写 UI”，而是：

1. **保留旧 UI 的表现层和成熟交互；**
2. **用一个很薄的 vNext client data layer 替换旧 `TeamMirror / sessions.teams / messagesBefore` 数据面；**
3. **让旧纯 model/组件消费一个 P9 内部的 normalized UI snapshot，而不是直接把每个组件重写成 vNext DTO 解析器；**
4. **所有 authority 只来自 frozen `team.getProjection`、`team.getLedgerPage`、Remote commands 与 Native DSH public surfaces；**
5. **禁止在 browser 端重新推导 TeamDomain authority；**
6. **旧代码中与新架构相冲突的部分明确 DROP，而不是为了“复用率”硬搬。**

最终形态应为：

```text
DSH public client / remote seam
        │
        ▼
TeamRemoteClient                         ← NEW, thin transport adapter
        │
        ├── team.getProjection
        │      │
        │      ▼
        │   TeamProjectionStore          ← NEW, generation-safe cache
        │      │
        │      └── reuse @dsh-agent-team/remote push helpers
        │
        └── team.getLedgerPage
               │
               ▼
            TeamLedgerStore              ← NEW, cursor/merge/filter state
               │
               └── reuse createLedgerPageTracker / verifyLedgerPageAnchor

Projection + loaded ledger
        │
        ▼
TeamUiSnapshot / TeamUiLedgerModel       ← NEW normalized adapter, no authority
        │
        ├── legacy pure view models      ← mostly MECHANICAL ADAPT
        └── legacy React components      ← mostly DIRECT/MECHANICAL reuse

DSH slots / navigation / native Chat / native Trajectory
        │
        ▼
Team tab + Dock + Creation flow + vNext controls
```

**核心判断：**当前 vNext 的 backend 已经很重，client 却仍是 skeleton；而旧分支已经有一套完整 browser UI package。P9 的工作量应集中在 **transport/store/adapter/host seam**，而不是 JSX、CSS、timeline interaction、member grouping 等已经做过的工作。

---

# 1. Entry gate：P9 只在 T+12 `GO` 后启动

上一份 T+0～T+12 文档的约束继续生效：

- `VERDICT=GO`：进入本文；
- `VERDICT=REFACTOR`：先完成上阶段 runtime/backend salvage，**不得**一边补 backend 一边写 UI；
- `VERDICT=STOP-CANDIDATE`：先做项目级裁决，不启动 P9。

P9 的第一条硬边界：

> **P9 不再修 backend architecture。**
>
> 若 UI 需求发现 frozen contract 不提供数据，则：
> 1. 先核对 `backend-contract-freeze.md`；
> 2. 若明确 CLIENT_LOCAL/NATIVE_PROVEN，则在 client/native seam 实现；
> 3. 若明确不支持，则降级/隐藏该 feature；
> 4. 只有确认为冻结文档与实际代码矛盾时才形成 `CONTRACT_CHANGE_REQUEST`；
> 5. 不允许 agent 为了把 UI 做出来直接修改 Remote catalog、Projection schema、TeamDomain 或 Session log 语义。

---

# 2. Audited baseline：当前代码真实状态

## 2.1 vNext 当前 `packages/client` 不是一套新 UI，只是预留骨架

当前 `packages/client` 仅有：

```text
packages/client/
├── package.json
├── src/
│   ├── index.ts
│   └── plugin/
│       └── client.ts
├── test/
│   └── client.test.ts
├── tsconfig.json
├── tsconfig.build.json
└── vitest.config.ts
```

`packages/client/src/plugin/client.ts` 的 `apply()` 当前没有 UI registration，文件注释已经明确：**P9 UI work 在这里增加 public client surface 的 slot registrations**。

因此：

- 不创建 `packages/ui-vnext`；
- 不创建第二套 client plugin；
- 不复制旧 `ui-team` package 的 packaging 边界；
- 直接把迁移后的 UI 作为当前 `@dsh-agent-team/client` 的实现内容。

## 2.2 当前 client build 配置尚未准备好 TSX/browser UI

当前根 `tsconfig.base.json` 只有：

```json
"lib": ["ES2022"]
```

当前 `packages/client/tsconfig.build.json` 也未声明 JSX/DOM。

P9 必须显式完成 browser build plumbing：

```text
- DOM / DOM.Iterable lib
- JSX mode
- React + @types/react
- DSH public client runtime / slots / locale / primitives / conversation deps
- @dsh-agent-team/remote workspace dependency
- 必要时 @dsh-agent-team/contracts workspace dependency
```

**不要**把旧 `package.json` 的 `workspace:^` 依赖整块复制过来；旧 package 和当前 standalone monorepo 的依赖拓扑不同。只迁移实际用到的依赖，并使用当前仓库/宿主固定方式。

## 2.3 P8 已经提供了 P9 不应再实现的 client-side sync primitives

`@dsh-agent-team/remote` 已经公开：

- `decideFrameVerdict()`
- `isStrictlyNewerGeneration()`
- `assessProjectionSync()`
- `extractPushFrame()`
- `isApplyAssessment()`
- `createLedgerPageTracker()`
- `verifyLedgerPageAnchor()`
- reconnect/backoff helpers

因此 **TeamProjectionStore / TeamLedgerStore 只负责 state + transport orchestration**；不得再自己实现：

- generation comparison；
- stale/duplicate/foreign verdict；
- projection provenance cross-check；
- ledger page anchor invariant；
- reconnect backoff formula。

这部分如果重新实现，就是 P9 对 P8 已完成资产的重复建设。

## 2.4 Projection 和 Ledger 的职责必须保持分离

### Projection authoritative for

- TeamSession identity / blueprint snapshot；
- leader/root facts；
- templates；
- member instance identity；
- `childSessionId`；
- member lifecycle；
- context policy；
- effective config；
- durable activity summary；
- live activity overlay；
- model state（v2 optional）；
- ledger summary；
- disposed history（v2 optional）。

### Ledger authoritative for detailed history

`team.getLedgerPage` 返回 durable ledger rows：

```ts
{
  schemaVersion,
  sequence,
  rootSessionId,
  factType,
  payload,
  operationId: string | null,
  createdAt
}
```

Projection **不携带** session-log facts，也不携带完整 ledger entries。

因此旧 UI 中以下做法不得恢复：

- 从 child/root Session log 扫描 Team 状态；
- 把 `messagesBefore` 当 Team historical authority；
- 用 Chat nodes 重新构造 TeamDomain ledger；
- 用 current DOM/Chat state 决定 lifecycle/policy/compatibility。

---

# 3. Legacy UI inventory：旧代码不是“参考”，而是迁移资产

旧 `packages/client/ui-team/src/client` 已经包含完整 UI：

```text
TeamDock.module.css
TeamDock.tsx
TeamFeed.module.css
TeamFeed.tsx
TeamMarker.module.css
TeamMarker.tsx
TeamMembers.module.css
TeamMembers.tsx
TeamSettingsSection.module.css
TeamSettingsSection.tsx
TeamTasks.module.css
TeamTasks.tsx
TeamTimeline.module.css
TeamTimeline.tsx
TeamView.module.css
TeamView.tsx
index.ts
locales.ts
team-dock-model.ts
team-feed-model.ts
team-marker-definition.ts
team-marker-jump.ts
team-members-model.ts
team-timeline-model.ts
```

并有 **14 个完整 component/model/plugin tests**：

```text
client-bundle.client.spec.ts
team-dock-model.client.spec.ts
team-dock.client.spec.tsx
team-feed-model.client.spec.ts
team-feed.client.spec.tsx
team-marker-definition.client.spec.ts
team-marker.client.spec.tsx
team-members-model.client.spec.ts
team-members.client.spec.tsx
team-plugin.client.spec.tsx
team-tasks.client.spec.tsx
team-timeline-model.client.spec.ts
team-timeline.client.spec.tsx
team-view.client.spec.tsx
```

P9 不允许把这些测试全部抛弃后重新写一套“看起来类似”的 tests。它们应当被当作 **behavioral migration tests**：先搬，再只改 fixture / injected data seam / vocabulary。

---

# 4. Reuse classification：五档复用定义

本文使用固定的五档标签。

| 标签 | 定义 | 允许改动 |
|---|---|---|
| **DIRECT COPY** | 实现应基本原样迁移 | path/import/package name；极少类型修复；不改变算法/DOM/交互 |
| **MECHANICAL ADAPT** | 旧实现仍是主体 | 输入类型、字段名、props、import、少量状态 vocabulary；保留算法/JSX 结构 |
| **ADAPT** | 旧行为与组件仍有明显价值，但数据模型变化较大 | 可替换约 40–60% data/lifecycle code；保留 UI structure / tested behavior |
| **REIMPLEMENT** | 新 contract 需要新的实现 | 必须说明旧实现为何不适用；可以复用 tests/visual fragments |
| **DROP** | 旧行为与 vNext architecture 冲突或已由 native DSH 取代 | 明确不迁移；不得偷偷用别的方式恢复 |

### 4.1 强制复用审查规则

任何 P9 coding agent 在新建一个 UI 文件前，必须先回答：

```text
Legacy counterpart:
Reuse class:
Why not DIRECT/MECHANICAL:
Frozen contract forcing the change:
Old tests reused:
```

没有这五项，不允许新建同职责实现。

### 4.2 禁止“clean rewrite”

以下理由 **不是** `REIMPLEMENT` 的充分理由：

- “旧代码风格不够现代”；
- “hook 写法可以更漂亮”；
- “重构后名字不同”；
- “我更熟悉另一套 store”；
- “从头写更快”；
- “避免理解旧 tests”。

P9 的主要风险正是再次发生这种 clean rewrite。

---

# 5. Target client architecture：薄 adapter，而不是第二个 domain

建议最终目录：

```text
packages/client/src/
├── index.ts
├── plugin/
│   └── client.ts
├── transport/
│   ├── team-remote-client.ts
│   └── host-seams.ts
├── state/
│   ├── team-projection-store.ts
│   ├── team-ledger-store.ts
│   └── team-session-resolution.ts
├── model/
│   ├── team-ui-snapshot.ts
│   ├── projection-adapter.ts
│   ├── ledger-adapter.ts
│   ├── team-members-model.ts
│   ├── team-dock-model.ts
│   ├── team-feed-model.ts
│   └── team-timeline-model.ts
├── ui/
│   ├── TeamView.tsx
│   ├── TeamMembers.tsx
│   ├── TeamTimeline.tsx
│   ├── TeamLedger.tsx          # evolved from TeamFeed
│   ├── TeamDock.tsx
│   ├── TeamCreateFlow.tsx      # NEW
│   ├── TeamOverview.tsx        # NEW / vNext details
│   ├── TeamMemberActions.tsx   # NEW
│   ├── TeamConfigPanel.tsx     # NEW
│   ├── TeamHandoffPanel.tsx    # NEW where supported
│   ├── locales.ts
│   └── *.module.css
└── test-support/
    ├── projection-fixtures.ts
    ├── ledger-fixtures.ts
    └── remote-fixture.ts
```

目录名可根据当前 repo style 微调，但职责边界不应变化。

---

# 6. New thin layer：必须重新实现，但面积要小

## 6.1 `TeamRemoteClient` — REIMPLEMENT，约 150–250 LOC

职责只包括：

```ts
interface TeamRemoteClient {
  call(method, params): Promise<RemoteResponse>
  getProjection(teamSessionId): Promise<RemoteResponse>
  getLedgerPage(teamSessionId, afterSequence, limit): Promise<RemoteResponse>
  // command wrappers: create/member/override/policy/compat/handoff
}
```

要求：

- RPC envelope 只在这里组装；
- 不在 React component 里手拼 `/team-remote`；
- 不吞 typed error；
- 不把 `RemoteResponse` exception 化再丢失 `code/details/provenance`；
- 不在此处做 UI mapping。

### 不允许

```text
TeamRemoteClient -> TeamDomain
TeamRemoteClient -> storage
TeamRemoteClient -> Session log scan
TeamRemoteClient -> private DSH server API
```

## 6.2 `TeamProjectionStore` — REIMPLEMENT orchestration，复用 P8 algorithm

State 最少包含：

```ts
interface TeamProjectionState {
  status: 'idle' | 'loading' | 'ready' | 'reconnecting' | 'error'
  teamSessionId: string | null
  appliedGeneration: number | null
  frame: RemotePushFrame | null
  lastError?: RemoteErrorResult
}
```

核心流程：

```text
pull(teamSessionId)
  -> remote team.getProjection
  -> assessProjectionSync(appliedIdentity, response)
  -> apply ONLY when assessment.status === 'apply'
  -> extractPushFrame(response)
  -> publish store snapshot
```

直接复用：

- `assessProjectionSync()`；
- `extractPushFrame()`；
- `decideFrameVerdict()` indirect；
- reconnect/backoff helpers。

### Hard invariant

**任何 response 都不能在 generation check 之前写入 store。**

测试必须覆盖：

- first frame；
- generation +1；
- duplicate；
- stale；
- foreign TeamSession；
- provenance generation mismatch；
- RPC typed error；
- reconnect 后旧 response 晚到。

## 6.3 production live update strategy

Frozen backend 只保证：

```text
generation invalidation + team.getProjection pull
```

不保证 full-payload live push。

P9 处理顺序：

1. **先 characterise 当前 public browser transport 是否已有可订阅 invalidation signal；**
2. 有 public signal：收到 generation/invalidated → `pull()`；
3. 没有：用 bounded client refresh strategy；
4. 不得为了“实时”把 full projection 塞入新的 backend push contract；
5. P10 可优化 transport，不改变 P9 store API。

轮询若被采用，只是 temporary client transport policy，不成为 authority。

## 6.4 `TeamLedgerStore` — REIMPLEMENT orchestration，复用 P8 page tracker

State 建议：

```ts
interface TeamLedgerState {
  teamSessionId: string
  entriesBySequence: Map<number, RemoteLedgerEntryValue>
  orderedSequences: readonly number[]
  total: number | null
  completeThrough: number
  loading: boolean
  error?: RemoteErrorResult | LedgerPageReject
}
```

必须复用：

- `createLedgerPageTracker()`；
- `verifyLedgerPageAnchor()`。

禁止自己再实现 cursor validity。

### P9 correctness-first paging policy

由于 Remote v1 是 `sequence > afterSequence` 的 forward cursor，P9 先采用 correctness-first 模式：

1. 从 `afterSequence=0` 或已知 durable anchor 开始；
2. 逐页 merge，sequence 去重；
3. tracker 验证每页；
4. UI 默认只 render 最近 N 条，但 store 可继续 catch-up；
5. `Load earlier` 只扩大 client-visible window，不能改变 ledger authority；
6. 新事件到达时只追加/重拉，已显示历史窗口不被重新排序破坏；
7. tail-bootstrap 优化若需要复杂跳转，放 P10，除非 frozen test 已给出明确算法。

不要为了恢复旧 `messagesBefore` UX 创造第二个 reverse-paging backend API。

---

# 7. `TeamUiSnapshot`：最大化旧 UI 复用的关键

## 7.1 为什么要有 normalized UI model

若把所有 legacy component 直接改成读取 `TeamProjectionDto` + raw ledger：

- 每个组件都会重复 parse/join；
- old model tests 基本全部失效；
- React 层开始重新推导 backend state；
- 最终等价于“重写”。

因此建立 **纯 client presentation adapter**：

```ts
interface TeamUiSnapshot {
  readonly teamSessionId: string
  readonly generation: number
  readonly blueprint: ...
  readonly perspective: ...
  readonly templates: readonly TeamUiTemplate[]
  readonly members: readonly TeamUiMemberInstance[]
  readonly compatibility: ...
  readonly policyState: ...
  readonly ledgerSummary: ...
  readonly activity: ...
  readonly disposedHistory: ...
}
```

以及：

```ts
interface TeamUiLedgerModel {
  readonly entries: readonly TeamUiLedgerRow[]
  readonly controls: ...
  readonly messages: ...
  readonly intervals: ...
  readonly progress: ...
  readonly completeness: 'partial' | 'complete'
}
```

### 这不是新 authority

Adapter 必须满足：

```text
output = pure(TeamProjectionDto, loaded RemoteLedgerEntryValue[])
```

它：

- 不写 backend；
- 不保存 authoritative lifecycle；
- 不扫描 session logs；
- 不使用 DOM 判断 TeamSession；
- 不发明 missing facts；
- partial ledger 不伪装 complete ledger。

## 7.2 Member mapping

旧 UI 的成员状态是：

```text
unbound / bound / running / settled
```

vNext lifecycle 是正式 authority，不能把旧 vocabulary 当 domain state。

推荐 presentation mapping：

```text
CREATED   -> display: created/bound-like
RUNNING   -> display: running
SETTLED   -> display: settled
ARCHIVED  -> display: archived
DISPOSED  -> display: disposed/history-only
```

但内部 model 应保存原始 `lifecycle`，而不是只保存旧 3-state status。

`currentAction`：

```text
member.liveActivity?.currentAction
  ?? member.activity?.lastAction
  ?? undefined
```

这是 presentation fallback，不是 lifecycle inference。

`childSessionId`：

- leader：absent；navigation target = `teamSessionId/root session`；
- non-leader：直接读 frozen `childSessionId`；
- 不从 label/template/session list 反推。

## 7.3 pending control count

Projection ledger summary有 **team-wide** `pendingControlCount`。

旧 UI 的 per-member pending count 不能简单复制。

规则：

- Dock 顶层 pending count：直接用 Projection ledger summary；
- per-instance pending badge：只有 ledger adapter 能从 **已知完整** control request/decision facts 得到时才显示；
- ledger 尚未 catch-up 完整：显示 unknown/omit，不把 team-wide count 分配给某一个 member。

## 7.4 Task board compatibility

旧 Projection 有 `tasks`，vNext `TeamProjectionDto` **没有 task list**。

因此旧 `TeamTasks` 不能被当作 authoritative task board 原样移植。

P9 有两个合法选择：

### preferred
把旧 Task row visual 改为 **Current Activity / Work summary**：

- member `activity.subject`
- `activity.status`
- `activity.summary`
- live current action

### optional when ledger complete
从 durable `activity-*` progress facts 构造 historical work rows。

禁止：

- 从 Chat 文本猜 task；
- 从 child session 最新消息猜 status；
- partial ledger 下宣称“完整 task board”。

---

# 8. Legacy source：逐文件/逐函数复用裁决

## 8.1 CSS / declarations

| Legacy asset | 裁决 | P9 处理 |
|---|---|---|
| `TeamDock.module.css` | **DIRECT COPY** | 首轮必须 byte-copy；只在 visual integration 后做必要 token fix |
| `TeamFeed.module.css` | **DIRECT COPY** | 可改名 TeamLedger CSS，但先原样复制 |
| `TeamMarker.module.css` | **DROP as Chat marker / REUSE visual fragment** | 不注册 synthetic Chat marker；允许把 row CSS 复用给 ledger compact row |
| `TeamMembers.module.css` | **DIRECT COPY** | 先不重设计 |
| `TeamSettingsSection.module.css` | **DIRECT COPY if settings retained** | 内容语义另行处理 |
| `TeamTasks.module.css` | **DIRECT COPY / reuse for Activity rows** | 不保留旧 task authority |
| `TeamTimeline.module.css` | **DIRECT COPY** | 高价值资产 |
| `TeamView.module.css` | **DIRECT COPY** | section shell 继续复用 |
| `css-modules.d.ts` | **DIRECT COPY** | 若当前 TS tooling 已有等价 declaration 则不重复 |

**Gate:** 在第一轮能够 render 之前，不允许 UI agent“顺便统一样式”。

## 8.2 `team-timeline-model.ts`

### DIRECT COPY

- `teamTimelineTicks()`
- `formatTeamClock()`
- `formatTeamDuration()`
- tick/domain arithmetic
- stable lane-color assignment strategy

### MECHANICAL ADAPT

- `deriveTeamTimeline()`

改动点只有输入：

```text
legacy TeamView.delegations/tasks
    ↓
vNext TeamUiLedgerModel.intervals + TeamUiSnapshot.members/templates
```

保留：

- deterministic lane ordering；
- start/end domain；
- open-ended interval → `now`；
- multiple intervals per instance；
- historical intervals。

vNext 的 BQ-12/N-series requirement 与旧 timeline 的设计高度重合，**这是最不应该重写的文件之一**。

## 8.3 `TeamTimeline.tsx`

**MECHANICAL ADAPT，目标保留 >80% implementation shape。**

直接保留：

- 1s local clock；
- `MINIMUM_ZOOM_MS`；
- drag threshold；
- wheel zoom；
- left/right pointer pan；
- keyboard arrows / `+` / `-` / `0` / `Escape`；
- double-click reset；
- tooltip；
- CSS variable projection；
- bar click navigation。

只改：

- input type；
- lane/member id field names；
- native session navigation callback；
- archived/disposed historical lane labels。

禁止用 charting library 重写。

## 8.4 `team-members-model.ts`

**MECHANICAL ADAPT。**

直接保留：

- pure React-free fold；
- group build pattern；
- deterministic order；
- leader separate row；
- multiple instances per logical group。

修改：

- grouping key 从 legacy `memberId` 语义改为 vNext `templateId`；
- instance identity 使用 `instanceId`；
- `name` 使用 `label` / template display information；
- `sessionIds[0]` 改为 frozen `childSessionId`；
- status union 改为 vNext lifecycle presentation；
- `currentAction` 改读 activity/liveActivity；
- per-member pending count 改为 completeness-aware ledger-derived optional field。

`appendRow()` 的 fold 结构应保留，不需要重新设计 store selector。

## 8.5 `TeamMembers.tsx`

**MECHANICAL ADAPT。**

保留：

- group/instance expansion DOM；
- leader leading row；
- current session highlight；
- click-to-session；
- StateDot；
- action/current tool text layout；
- empty group handling。

修改：

- lifecycle labels/colors；
- template / instance terminology；
- archived/disposed visual；
- optional model-state badge；
- optional `groupId` badge；
- action menu slot（create/archive/restore/dispose），不要把 command logic 写进 row component。

## 8.6 `team-dock-model.ts`

**MECHANICAL ADAPT。**

### preserve

- `deriveTeamDockCounts()` shape；
- `deriveTeamDockContent()` pure selector structure；
- compact member rows；
- top-level running/pending composition。

### change

- running count = projection lifecycle/live state，绝不从 session log；
- pending = `projection.ledger.pendingControlCount`；
- old compact tasks -> current activities or omit；
- archived/disposed not counted running。

## 8.7 `TeamDock.tsx`

分成两个裁决：

### `TeamDockPanel`

**MECHANICAL ADAPT / near DIRECT COPY**。

保留：

- collapsed/expanded state；
- compact readout；
- member rows；
- chevron interaction；
- same input-dock placement concept。

### outer `TeamDock`

**ADAPT。**

DROP：

```text
useTeamMirror
resolveTeamView
ensureTeam via ctx.sessions.teams.refresh
```

改为：

```text
useTeamProjectionStore(session/team resolution)
ensureProjection()
```

### `openTeamTab` DOM hack

**DROP。**

旧代码：

```ts
document.querySelectorAll('[role="tablist"] [role="tab"]')
... label match ...
tab.click()
```

P9 必须一次性 characterise 当前 public navigation/view-selection seam：

- public seam 存在 → 用 public API；
- 不存在 → dock jump button 暂时 disabled/omitted；
- **不得恢复 DOM text-match hack。**

## 8.8 `team-feed-model.ts`

**ADAPT，算法部分复用，数据 source 重写。**

### DIRECT / MECHANICAL reuse

- `TEAM_FEED_INITIAL_LIMIT = 200`
- `TEAM_FEED_STEP = 200`
- ascending time/sequence view semantics
- stable row key idea
- visible window logic
- filter/window UI model
- error + remainder concept

### REIMPLEMENT inside same module

legacy input：

```text
view.approvals
view.messages
olderMessages
messagesBefore anchor
```

vNext input：

```text
TeamUiLedgerModel.entries
client-local category filter
client-local template/instance filter
ledger completeness/window
```

排序 identity 必须优先用 durable `sequence`，不要退回 timestamp-only。

## 8.9 `TeamFeed.tsx` → `TeamLedger.tsx`

**ADAPT。**

保留：

- list section structure；
- compact single-line rows；
- title/full-detail affordance；
- load-more/earlier button；
- retryable loud error；
- row click navigation；
- local visible depth/window state。

扩展 row families：

- team creation/binding；
- member creation；
- work admitted/settled；
- lifecycle；
- message；
- control request/decision；
- policy state transition；
- override mutation；
- compatibility warning/ACK；
- model/effective boundary；
- progress facts；
- other frozen ledger categories。

未知/未来 fact type：

- 不 throw 整个 panel；
- render safe generic row：`factType + sequence + createdAt`；
- payload detail只显示 lossless-safe serialized summary；
- 不猜 actor/session link。

## 8.10 `TeamView.tsx`

**ADAPT；composition 保留，data shell 重写。**

### preserve

- Team tab 顶级 shell；
- ordinary-session zero state；
- section composition pattern；
- current member perspective highlight；
- child/root navigation callback injection。

### replace

```text
TeamMirror                 -> TeamProjectionStore
resolveTeamView            -> TeamSessionResolution + TeamUiSnapshot
ensureTeam                 -> ensureProjection
pageTeamMessages           -> TeamLedgerStore
```

### suggested P9 section order

```text
1. Team Overview / status / compatibility
2. Templates + Member Instances
3. Current Activity / effective config summary
4. Activity Timeline
5. Durable Ledger
```

旧四区 body 不需要为了保持视觉历史而强行保留一个已经失去 backend task list 的“Task Board”。

## 8.11 `TeamTasks.tsx`

**ADAPT AS ACTIVITY UI；不原样保留 task semantics。**

可直接复用：

- row layout；
- StateDot；
- assignee label；
- status + summary visual。

必须重写：

- input model；
- source of subject/status/summary。

若最终 UI design 决定不需要独立 Current Activity panel，则只把这些 visual fragments 复用到 Dock/Member row，不保留组件。

## 8.12 `locales.ts`

**MECHANICAL ADAPT。**

做法：

1. 原样 copy 旧词典，先让旧组件 compile；
2. rename obsolete task/member terms；
3. add vNext strings：
   - blueprint / revision；
   - lifecycle；
   - modelState；
   - effectiveConfig state/source；
   - policyState；
   - compatibility；
   - ledger categories；
   - create member/team；
   - archive/restore/dispose；
   - handoff；
   - loading/reconnecting/stale/error；
4. 删除 synthetic marker-only strings only after marker drop tests pass。

不在第一步重写整个 i18n 文件。

## 8.13 `TeamSettingsSection.tsx`

旧组件视觉 shell：**DIRECT COPY 可用**；旧内容语义：**DROP/REIMPLEMENT**。

旧文案是“用 Markdown files 配置 teammates”，而 vNext authority 是 blueprint catalog / runtime preset / Remote creation flow。

P9 不得继续展示过时说明。

若 Settings 仍需要 Team section：

- 保留 container/title/empty-state layout；
- 内容改为只读 plugin/status/help；
- creation/editing 放到 New Team flow / Team tab，不把完整控制面塞进 Settings。

## 8.14 `team-marker-definition.ts`

**DROP。**

原因不是“接口改了”，而是 **vNext architecture 明确禁止 TeamDomain-only event synthetic Chat**。

旧实现把：

```text
team/progress
team/control-request
team/control-decision
team/message
```

注册成 Chat nodes。

P9 不允许恢复这一层。

Ledger 已经拥有正确位置：**Team Ledger panel**。

## 8.15 `TeamMarker.tsx`

作为 `conversation.chat.node`：**DROP**。

可复用：

- `rowParts()` 的 compact row idea；
- CSS；
- time/type/actor/summary/state 布局。

把这些视觉片段迁入 `TeamLedgerRow`，而不是 Chat flow。

## 8.16 `team-marker-jump.ts`

作为 marker navigation：**DROP**。

其中“instance/member → bound child session”的决策树可 **MECHANICAL ADAPT** 成通用：

```ts
resolveLedgerRowNavigationTarget(row, snapshot)
```

但不要保留 Chat anchor 语义。

## 8.17 legacy `client/index.ts`

**ADAPT registration pattern；DROP old data plumbing。**

### preserve/mechanical

- locale namespace registration；
- `settings.section` registration if still wanted；
- `conversation.view` Team tab registration；
- `conversation.input.dock` registration；
- dependency injection via slots/hooks；
- session open callback injection pattern。

### drop

- `ctx.sessions.teams.mirror`；
- `teams.refresh()`；
- `pageMessagesBefore()`；
- synthetic `conversationEvents.register(teamMarkerDefinition)`；
- `conversation.chat.node` team-marker registration；
- DOM tab activation。

当前 vNext `packages/client/src/plugin/client.ts` 就是新的唯一 registration root。

---

# 9. Reuse summary table

| Asset family | Expected reuse | Main reason |
|---|---:|---|
| 8 CSS modules | 80–100% | presentation independent of old runtime |
| Timeline pure model | 80–95% | vNext interval semantics高度匹配 |
| Timeline React component | 80–90% | interaction/client-local state完全可复用 |
| Member group model | 65–80% | grouping algorithm复用；identity/lifecycle vocabulary更新 |
| Members component | 70–90% | props-driven presentation |
| Dock panel | 70–90% | visual/interaction可复用 |
| Dock outer shell | 40–60% | data subscription/navigation seam替换 |
| Feed model | 40–60% | window/sort/row idea复用；ledger input替换 |
| Feed component | 50–70% | list UX复用；rows generalized |
| TeamView composition | 50–70% | shell复用；data lifecycle替换 |
| Tasks component | 30–60% | visual复用；task authority消失 |
| locales | 50–70% | base strings复用，vNext大量新增 |
| settings | 20–40% | visual shell复用，旧语义过时 |
| marker definition/chat registration | **0%** | 与 vNext negative architecture requirement 冲突 |
| marker compact visual | 50–70% reuse in Ledger | 仅复用 presentation |
| old TeamMirror/sessions data layer | **0%** | 被 Remote/Projection取代 |
| old tests | 50–80% scenario reuse | fixtures/data seam变化，不应整体抛弃 |

如果实际执行结果出现：

```text
Timeline 被从零重写
Members 被从零重写
所有 CSS 全部重写
legacy tests 一个没搬
```

则默认判定 P9 执行偏离计划，除非 reviewer 给出逐项 contract-level justification。

---

# 10. vNext-only UI：哪些确实必须从 0 实现

旧 UI 没有以下能力，这些是合法的 `REIMPLEMENT` 区域。

## 10.1 New Team creation flow

调用顺序：

```text
open flow                   CLIENT_LOCAL
  ↓
catalog.list
  ↓
catalog.get(selected blueprint/revision)
  ↓
native workspace picker
  ↓
public agentPresets seam
  ↓
intent.probe(environmentFacts)
  ├─ PASS    -> create enabled
  ├─ WARNING -> show detail + explicit ACK path
  └─ FATAL   -> create disabled
  ↓
team.create(initialWork?)
  ↓
native open created root Session
```

必须覆盖：

- cancel = zero Team creation；
- reselect blueprint/config -> probe again；
- WARNING cannot silently auto-ack；
- FATAL cannot be downgraded by UI；
- `initialWork` absent stays absent；
- creation flow state purely client-local。

## 10.2 Template / Member creation and lifecycle actions

NEW control surfaces：

- `member.create`；
- create by template；
- label；
- optional `groupId`；
- workspace；
- optional initial work；
- `member.followup`；
- `member.send` where UI exposes targeted send；
- archive；
- restore；
- dispose terminal confirmation。

UI command pattern统一：

```text
click action
  -> local pending token
  -> Remote command
  -> typed success/error
  -> projection invalidation/pull
  -> UI only changes durable state after new projection
```

**禁止 command success 直接 patch lifecycle locally**。即使 command response 成功，最终 view 仍以 Projection 为准。

## 10.3 Effective config / override / PolicyState

这些旧 UI 没有。

建议 P9 先做 read-first：

- per-instance effective config：value/source/state；
- v2 additive states：suppressed/unavailable/deniedBy/effectiveFrom/locked；
- modelState available/unavailable；
- durable/current PolicyState；
- compatibility badge。

写操作：

- `override.set/reset`；
- `policyState.set`；
- `compatibility.ack/reprobe`。

每个 write 遵守同一 mutation rule：

```text
Remote command -> typed result -> projection re-pull -> render
```

不做 optimistic authority mutation。

## 10.4 Ledger filters

P9-owned CLIENT_LOCAL：

- category filter；
- instance/template filter；
- visible depth；
- timeline zoom/pan/hover。

Filter 只能过滤 **已经加载的 ledger rows**。

UI 必须在 partial ledger 时说明：

```text
Showing matches in loaded history
```

不要暗示 filter 是 server-global search。

## 10.5 Handoff / Start Team From Here

以 frozen Remote 为准：

- `handoff.prepare`：read-only preview；
- `handoff.create`：create；
- retry 依赖 `(sourceSessionId, requestToken)` idempotency；
- continue/cancel 是 client-local decision，不添加 backend method；
- target Team 不提供 source history live-read。

这部分无 legacy component，可用 New Team flow 的 dialog/form primitives，避免再做一套 wizard framework。

## 10.6 Legacy / ordinary / fork states

- ordinary Session：Team tab zero-state；
- legacy team：`legacy.inspect` 后显示 degradation/inspection result；
- native Chat / Trajectory / Fork：调用 native DSH surface；
- 不复制 native Chat/Trajectory；
- fork notice dismiss 是 client-local；
- 不通过 TeamDomain synthetic event 注入 Chat/Trajectory。

---

# 11. Host seam characterization：只允许一次、时间盒 45 分钟

P9 首小时需要核对当前被 pin 的 DSH client public surfaces：

1. slot registration API；
2. locale API；
3. native open-session/navigation API；
4. conversation-view selection API；
5. remote RPC client API / channel binding；
6. public `remote.agentPresets` seam；
7. client test runtime；
8. current React/UI primitive package versions。

输出：

```text
dev/agent-workflow/evidence/P9/host-seam-map.md
```

每项只需：

```text
Need
Public API/path
Legacy equivalent
Verdict: SAME / RENAMED / ABSENT
Action
```

### Stop rule

45 分钟结束后禁止继续“熟悉 DSH 前端架构”。

若单一 public seam 不存在：

- affected feature 标为 degraded/blocked；
- 继续其余 P9；
- 不扩大为 upstream code archaeology；
- 不使用 private import/DOM hack 顶替。

---

# 12. Exact migration method：先 copy，再改，不要边看边重写

推荐 staging sequence：

## 12.1 Extract legacy assets verbatim

从旧 repo pin：

```text
feat/agent-teams@506191ba893ac55980dd09680c438710ab24095b
```

一次性提取：

```text
TeamDock.*
TeamFeed.*
TeamMembers.*
TeamTasks.*
TeamTimeline.*
TeamView.*
locales.ts
team-dock-model.ts
team-feed-model.ts
team-members-model.ts
team-timeline-model.ts
14 legacy tests
```

Marker files单独提取到 review scratch，不进入默认 build。

## 12.2 First migration commit = copy-only

建议 commit：

```text
P9-T1: import legacy team UI assets verbatim
```

此 commit 允许暂时不 compile。

目的：后续 `git diff` 能清楚区分：

```text
legacy implementation
vs
vNext adaptation
```

如果 agent 直接复制后同时大改，将无法审查实际复用比例。

## 12.3 Second commit = build/import adaptation only

```text
P9-T2: wire client TSX build and mechanical imports
```

只允许：

- path/import；
- package deps；
- JSX/types；
- module location；
- test harness import。

不改行为。

## 12.4 Third+ commits = data adapter / semantic changes

这样 reviewer 可以精确看到哪些旧逻辑被保留。

---

# 13. T+12 → T+24 wall-clock schedule

以下假设：**main agent + 3 coding/review subagents 并行**。总 person-hours 会大于 12h，但 wall-clock 控制在 12h。若只运行一个执行 agent，不应把这个时序当作单线程 person-hour 估计。

## T+12:00–12:45 — P9-S0：entry + host seam characterization

**Owner:** main agent + seam reviewer

任务：

1. pin 两个 repo/commit；
2.确认 T+12 GO evidence；
3.读取 `backend-contract-freeze.md`；
4.完成 §11 八项 public seam map；
5.创建 P9 evidence dir；
6.冻结 DROP list：TeamMirror、messagesBefore、synthetic markers、DOM tab hack。

### Gate P9-G0

必须产出：

```text
P9 baseline pin
host-seam-map.md
legacy asset manifest
DROP list
```

**Fail condition:** 又开始 broad DSH architecture audit。

---

## T+12:45–14:00 — P9-S1：copy-only import + browser build plumbing

**Owner:** UI migration agent

任务：

- legacy assets copy-only；
- 14 tests copy 到 migration test area；
- current client package 增加 TSX/browser config；
- 最小 React/DSH public deps；
- `@dsh-agent-team/remote` dependency；
- CSS module declaration；
- skeleton client export不破坏。

### Gate P9-G1

- source manifest完整；
- copy-only commit存在；
- build errors 只允许是预期 legacy import/type mismatch；
- 没有任何 UI clean rewrite。

---

## T+13:00–15:30 — P9-S2：Remote client + Projection/Ledger stores

**Owner:** data-layer agent

可与 S1 重叠。

### S2-A Remote client

- public `/team-remote` binding；
- typed wrapper；
- no React dependency。

### S2-B Projection store

- use `assessProjectionSync`；
- use `extractPushFrame`；
- generation-safe apply；
- reconnect/invalidation pull；
- observable hook adapter。

### S2-C Ledger store

- use `createLedgerPageTracker`；
- sequence dedupe；
- forward page merge；
- completeness；
- client filters state separated from durable data。

### Gate P9-G2

Unit tests pass：

```text
stale never overwrites
foreign never overwrites
duplicate no-op
provenance mismatch no-op
page anchor mismatch rejected
page total cannot regress
entry sequence deduped
RPC errors remain typed
```

---

## T+14:00–16:30 — P9-S3：normalized adapters

**Owner:** model migration agent

### S3-A projection adapter

产出：

```text
TeamUiSnapshot
TeamUiTemplate
TeamUiMemberInstance
perspective mapping
compatibility/policy/effective config mapping
```

### S3-B ledger adapter

产出：

```text
TeamUiLedgerRow
control chains
messages
activity intervals
progress/current-work rows
navigation hints only when supported
completeness marker
```

### S3-C migrate pure legacy models

- `team-members-model.ts`；
- `team-dock-model.ts`；
- `team-timeline-model.ts`；
- `team-feed-model.ts`。

### Gate P9-G3

- pure model tests no React；
- duplicate labels don't affect identity；
- leader childSession special case correct；
- archived/disposed represented；
- no session-log input；
- no DOM；
- no TeamDomain import；
- partial ledger clearly represented。

---

## T+15:30–18:30 — P9-S4：high-value legacy UI migration

**Owner:** UI migration agent

顺序：

1. `TeamTimeline`；
2. `TeamMembers`；
3. `TeamDockPanel`；
4. `TeamView` shell；
5. TeamFeed → TeamLedger；
6. activity rows from TeamTasks visual。

每个组件采用：

```text
old test first
→ fixture adapter
→ compile
→ only then semantic adjustments
```

### Gate P9-G4

- timeline wheel/pan/keyboard/tooltip tests retained；
- members grouping/current perspective/navigation retained；
- dock expand/collapse retained；
- Team tab zero-state retained；
- Ledger row window/load/retry retained；
- no synthetic Chat marker registration。

---

## T+16:30–20:00 — P9-S5：vNext-only controls

**Owner:** second UI agent

并行实现：

### S5-A New Team flow

- catalog；
- workspace native picker；
- presets public seam；
- probe；
- warning ack；
- fatal disable；
- initial work；
- create + native open。

### S5-B Member actions

- create；
- followup/send；
- archive/restore/dispose；
- command pending/error；
- projection pull after success。

### S5-C Config/governance

- effective config read；
- override set/reset；
- PolicyState read/set；
- compatibility get/ack/reprobe。

### S5-D Handoff/legacy

- handoff prepare/create；
- client-local continue/cancel；
- legacy.inspect banner/zero-state。

### Gate P9-G5

每个 command flow 证明：

```text
NO optimistic authority patch
Remote typed result preserved
projection refresh occurs
rendered final state comes from Projection
```

---

## T+18:30–20:30 — P9-S6：plugin registration + native DSH integration

**Owner:** main agent

在 `packages/client/src/plugin/client.ts` 完成唯一 client mount。

Expected registrations：

```text
conversation.view       -> TeamView
conversation.input.dock -> TeamDock
settings.section        -> optional minimal Team settings/help
```

New Team entry使用实际 public surface（按 S0 seam map）。

### Explicit non-registration

```text
NO conversation.chat.node team-marker
NO synthetic trajectory
```

Native integration：

- open root/member session；
- native Chat；
- native Trajectory；
- native fork；
- workspace picker；
- presets seam。

### Gate P9-G6

- plugin mount clean；
- ordinary Session remains ordinary；
- Team Root + Member child resolve correct perspective；
- no DOM navigation hack；
- no private DSH import；
- CORE PATCH BUDGET remains 0。

---

## T+20:00–22:15 — P9-S7：test migration + negative tests

**Owner:** test agent + reviewer

### Port all useful legacy tests

| Legacy test | P9 action |
|---|---|
| `client-bundle.client.spec.ts` | **ADAPT** package/export/browser bundle |
| `team-dock-model.client.spec.ts` | **MECHANICAL ADAPT** fixtures |
| `team-dock.client.spec.tsx` | **MECHANICAL ADAPT** store injection |
| `team-feed-model.client.spec.ts` | **ADAPT** ledger fixtures |
| `team-feed.client.spec.tsx` | **ADAPT** pagination/retry semantics |
| `team-marker-definition.client.spec.ts` | **DROP / replace with negative test: no marker registration** |
| `team-marker.client.spec.tsx` | **DROP as Chat; optional reuse as ledger-row visual test** |
| `team-members-model.client.spec.ts` | **MECHANICAL ADAPT** lifecycle/template fixtures |
| `team-members.client.spec.tsx` | **MECHANICAL ADAPT** |
| `team-plugin.client.spec.tsx` | **ADAPT** new registrations + explicit absence of marker |
| `team-tasks.client.spec.tsx` | **ADAPT** to activity row or retire with rationale |
| `team-timeline-model.client.spec.ts` | **MECHANICAL ADAPT** |
| `team-timeline.client.spec.tsx` | **MECHANICAL ADAPT** |
| `team-view.client.spec.tsx` | **ADAPT** store/zero-state/section composition |

### New P9 tests

#### Transport/store

- stale pull；
- duplicate pull；
- reconnect；
- foreign TeamSession；
- typed errors；
- ledger cursor stale response；
- growth while historical window open。

#### Projection adapter

- leader vs member；
- duplicate labels；
- multi-instance same template；
- groupId；
- archived；
- disposedHistory；
- model unavailable；
- effective config source/state；
- activity/live activity fallback。

#### Command flows

- create cancel zero backend mutation；
- warning requires ack；
- fatal disables create；
- member command pending → remote → projection；
- archive/restore/dispose；
- override/policy/compat typed errors；
- handoff retry token reuse。

#### Negative architecture tests

```text
client src contains no TeamDomain imports
client src contains no storage imports
no ctx.sessions.teams mirror dependency
no pageMessagesBefore/messagesBefore Team history path
no team-marker conversation node registration
no document.querySelector tab navigation
no synthetic Chat/Trajectory event generation
```

这些 negative tests 对防止“复活旧技术债”非常重要。

---

## T+22:15–23:15 — P9-S8：production-host vertical browser smoke

**Owner:** main agent + reviewer

不要再造新的 test harness；优先使用当前 DSH public client test runtime / existing browser harness。

### Honest vertical scenario

```text
ordinary Session
  -> open New Team flow
  -> select blueprint/revision
  -> probe PASS/WARNING path
  -> create Team
  -> native root Session opens
  -> Team tab loads Projection over public Remote
  -> create Member
  -> member row appears from refreshed Projection
  -> open member child Session
  -> Team tab perspective changes
  -> submit/follow-up work
  -> activity / timeline / ledger update
  -> trigger lifecycle change
  -> refreshed Projection shows durable lifecycle
  -> navigate root
  -> reload/reconnect
  -> same generation/history survives
```

至少另做一个 typed failure：

```text
invalid/disallowed operation
  -> Remote typed error
  -> UI loud error
  -> no fabricated state change
```

### Evidence

保存：

```text
request/response trace
projection generations
ledger sequences
screenshots or DOM snapshots of key states
client console errors = 0
server unexpected errors = 0
```

---

## T+23:15–24:00 — P9-S9：closure review + freeze

**Owner:** independent reviewer

### 1. Full repo gates

```bash
pnpm -r run typecheck
pnpm -r run test
pnpm -r run build
pnpm lint
pnpm smoke:composition
```

按当前 repo 已有脚本为准，不因为 P9 新建第二套 pipeline。

### 2. Browser/client gates

- migrated component tests；
- store tests；
- adapter tests；
- plugin registration tests；
- vertical smoke evidence。

### 3. Reuse audit

输出：

```text
dev/agent-workflow/evidence/P9/reuse-audit.md
```

格式：

```text
Legacy file
P9 file
Reuse class
Legacy SHA
P9 diff summary
Preserved tests
Semantic changes
Justification
Reviewer verdict
```

### 4. Final verdict

```text
P9_VERDICT = GO | REPAIR | CONTRACT_BLOCKER
```

- `GO`：进入 P10 hardening；
- `REPAIR`：只修已定位 client defects；
- `CONTRACT_BLOCKER`：必须有 frozen backend contract 证据，不允许用“UI 写不下去”泛化为 blocker。

---

# 14. Detailed feature-to-source mapping

| P9 feature | Primary vNext source | Legacy UI asset | Action |
|---|---|---|---|
| Team identification/perspective | Projection/root/member bindings | `TeamView` zero-state + current member highlight | ADAPT |
| Team overview | Projection root/blueprint/ledger summary | `TeamView` shell | ADAPT |
| Member/template list | Projection templates + members | `team-members-model` + `TeamMembers` | MECHANICAL |
| Current member action | activity/liveActivity | legacy currentAction row | MECHANICAL |
| Lifecycle status | member.lifecycle | StateDot/member row | MECHANICAL |
| model availability | member.modelState | none | NEW small badge |
| effective config | member.effectiveConfig | none | NEW panel |
| running/pending dock counts | members + ledger summary | `team-dock-model`, `TeamDockPanel` | MECHANICAL |
| Activity timeline | ledger interval facts / activity | timeline model + component | **HIGH REUSE** |
| Durable event stream | getLedgerPage | feed model/component | ADAPT |
| Ledger filter | CLIENT_LOCAL | feed window UI | ADAPT |
| native session jump | DSH public navigation | old `openSession` callback | MECHANICAL |
| New Team | catalog/probe/create + native picker | none | REIMPLEMENT |
| Create Member | member.create | member row visual | REIMPLEMENT command + reuse row |
| archive/restore/dispose | Remote lifecycle methods | none | REIMPLEMENT controls |
| override/policy/compat | frozen Remote methods | none | REIMPLEMENT panel |
| Start Team From Here | handoff.prepare/create | New Team dialog primitives | REIMPLEMENT |
| legacy inspect | legacy.inspect | zero-state shell | ADAPT |
| native Chat/Trajectory | native DSH | none needed | USE NATIVE |
| synthetic Chat team markers | prohibited by vNext negative requirement | marker files | **DROP** |
| DOM Team-tab jump | no sanctioned old seam | old plugin hack | **DROP** |

---

# 15. Test architecture：不要把“component test passed”当 P9 完成

P9 需要四层测试。

## Layer 1 — Pure model

无 React、无 DOM、无 host：

```text
projection adapter
ledger adapter
members model
dock model
timeline model
ledger/feed model
navigation target resolver
```

这是迁移旧 tests 最容易、收益最高的一层。

## Layer 2 — Component

fake store snapshot + fake navigation：

```text
TeamMembers
TeamTimeline
TeamDock
TeamLedger
TeamView
Create flow
Config panel
```

目标是验证 DOM/interaction，不验证 backend authority。

## Layer 3 — Client plugin integration

fake public DSH client context：

- slot registration；
- remote binding；
- locale；
- session navigation；
- store lifecycle；
- no synthetic marker。

## Layer 4 — Honest host vertical

真实 host seam + frozen backend vertical path。

P9 不允许只有 Layer 1/2 后宣布 UI production-ready。

---

# 16. Specific acceptance criteria

## 16.1 Build/package

- [ ] `@dsh-agent-team/client` browser compile；
- [ ] no Node builtin in browser bundle；
- [ ] no private DSH import；
- [ ] no duplicate UI package；
- [ ] current root scripts pass。

## 16.2 Projection

- [ ] first frame applied；
- [ ] strictly newer generation applied；
- [ ] stale/duplicate rejected；
- [ ] provenance mismatch rejected；
- [ ] foreign team rejected；
- [ ] reconnect does not regress state。

## 16.3 Ledger

- [ ] page anchor validated with P8 helper；
- [ ] sequence ascending；
- [ ] duplicate response cannot double-apply；
- [ ] total cannot regress；
- [ ] filter only covers loaded rows；
- [ ] stable visible history under new events；
- [ ] unknown fact type fails soft, not silently dropped as known semantics。

## 16.4 Members

- [ ] leader separate；
- [ ] template→0..N instances；
- [ ] duplicate labels legal；
- [ ] identity by templateId/instanceId；
- [ ] child session from `childSessionId`；
- [ ] current perspective highlighted；
- [ ] archive/dispose represented correctly；
- [ ] groupId shown if present。

## 16.5 Timeline

- [ ] multiple intervals one instance；
- [ ] open-ended running bar；
- [ ] archive history survives；
- [ ] disposed history survives where contract supplies it；
- [ ] wheel/pan/keyboard/hover unchanged from legacy behavior；
- [ ] click uses native child-session navigation。

## 16.6 Commands

- [ ] no optimistic lifecycle authority；
- [ ] request token managed per logical operation；
- [ ] typed errors visible；
- [ ] success followed by projection refresh；
- [ ] final UI state derives from Projection。

## 16.7 Native boundaries

- [ ] Chat remains native；
- [ ] Trajectory remains native；
- [ ] Fork remains native；
- [ ] no TeamDomain synthetic chat rows；
- [ ] no TeamDomain synthetic trajectory rows。

## 16.8 Reuse

- [ ] all 14 old tests have explicit migrate/drop decision；
- [ ] timeline source preserved substantially；
- [ ] members source preserved substantially；
- [ ] CSS first migration is copy-only；
- [ ] every `REIMPLEMENT` has contract-level reason；
- [ ] reuse audit reviewed independently。

---

# 17. Reuse review metrics：防止再次出现“理论上复用，实际上重写”

不建议用全仓一个简单 LOC 百分比；它容易被 CSS 或 generated code 操纵。采用 **per-asset evidence**。

### R9-1 HIGH-REUSE assets

以下必须达到 `MECHANICAL`，除非 reviewer reject：

```text
TeamTimeline.tsx
team-timeline-model.ts
TeamMembers.tsx
team-members-model.ts
TeamDockPanel portion
TeamTimeline.module.css
TeamMembers.module.css
TeamDock.module.css
TeamView.module.css
```

### R9-2 Behavioral test carry-over

Legacy test scenarios 至少以下继续存在：

```text
timeline interactions
member grouping
current-session highlight
session navigation
dock collapse/expand
feed window/load/retry
Team zero-state
plugin registration
```

### R9-3 Rewrite budget

可从零实现的主文件默认只有：

```text
team-remote-client.ts
team-projection-store.ts
team-ledger-store.ts
team-ui-snapshot.ts
projection-adapter.ts
ledger-adapter.ts
TeamCreateFlow.tsx
TeamConfigPanel.tsx / command panels
```

若出现新的：

```text
NewTimeline.tsx
NewMembers.tsx
NewDock.tsx
NewTeamFeed.tsx
```

默认触发 reviewer stop。

### R9-4 Deletion is allowed

复用不是目的本身。

以下旧资产应大胆删除：

```text
TeamMirror authority path
synthetic team markers
DOM tab hack
messagesBefore Team history path
obsolete Markdown teammate-settings semantics
```

这是 architecture migration，不算“复用失败”。

---

# 18. Suggested agent/worktree decomposition

为了防止一个 agent 再次把 P9 拖成巨大任务，建议四 lane。

## Lane A — P9-DATA

Owner files：

```text
transport/*
state/*
model/projection-adapter.ts
model/ledger-adapter.ts
```

禁止改 UI JSX/CSS。

## Lane B — P9-LEGACY-UI

Owner files：

```text
TeamTimeline*
TeamMembers*
TeamDock*
TeamView shell
legacy pure models
CSS
locales base
```

禁止修改 Remote/contracts/runtime。

## Lane C — P9-VNEXT-UI

Owner：

```text
New Team
member actions
config/policy/compat
handoff/legacy panels
```

使用 Lane A 的 command/query ports，不直接发 wire request。

## Lane D — P9-TEST/REVIEW

Owner：

```text
legacy test migration
negative architecture tests
host smoke
reuse audit
```

不得替 coding lanes“顺便修实现”；发现 defect → issue/patch request 返回 owner。

### Merge DAG

```text
S0 seam-map
   │
   ├──────────────┐
   ▼              ▼
S1 copy/build   S2 data
   │              │
   └──────┬───────┘
          ▼
       S3 adapters
       /        \
      ▼          ▼
 S4 legacy UI   S5 vNext UI
      \          /
       └────┬────┘
            ▼
        S6 plugin
            ▼
        S7 tests
            ▼
        S8 vertical
            ▼
        S9 review
```

不要让 S4/S5 各自发明 store。

---

# 19. Expected commits

推荐可审查 commit 序列：

```text
P9-T0  docs: pin P9 baselines and public host seams
P9-T1  ui: import legacy team UI assets verbatim
P9-T2  client: enable TSX/browser build and public UI dependencies
P9-T3  client: add frozen-remote transport and generation-safe projection store
P9-T4  client: add ledger cursor store and vNext UI adapters
P9-T5  ui: mechanically migrate timeline/member/dock surfaces
P9-T6  ui: adapt team view and durable ledger surface
P9-T7  ui: add New Team and member command flows
P9-T8  ui: add config/policy/compat/handoff surfaces
P9-T9  client: mount public DSH slots and native navigation
P9-T10 test: port legacy behavioral suite and negative architecture guards
P9-T11 test: add host vertical smoke evidence
P9-T12 docs: P9 reuse audit and closure verdict
```

若一个 coding agent 提交单个数千行 “implement P9 UI” commit，reviewer 应要求拆分再审。

---

# 20. Known traps and prescribed responses

## Trap A — “Projection 没 tasks，所以我从 Chat 折叠一个 task board”

**拒绝。**

使用 activity summary / durable ledger；partial history 明示 partial。

## Trap B — “为了实时，我给 backend 增加 `team.pushProjection`”

**拒绝。**

Frozen backend 只保证 invalidation + pull；P9 处理 client transport。

## Trap C — “旧 TeamTimeline 类型完全不同，重写更简单”

**拒绝。**

旧 timeline 交互和几何算法与 vNext requirement高度一致；做 input adapter。

## Trap D — “Team tab 没 public switch API，用 querySelector 临时顶一下”

**拒绝。**

无 sanctioned seam 时 feature degrade；不恢复已知 hack。

## Trap E — “旧 marker 很漂亮，所以继续注册 Chat node”

**拒绝。**

vNext 负向约束禁止 TeamDomain-only synthetic Chat。把视觉复用到 Ledger。

## Trap F — “command 成功后先把 UI status 改成 RUNNING，看起来更快”

**拒绝。**

Local pending 可以显示；authoritative lifecycle 必须等 Projection。

## Trap G — “直接把旧 `package.json` peer deps 全复制”

**拒绝。**

Standalone monorepo 与旧 DSH workspace 不同；按实际 public imports 加 deps。

## Trap H — “为了迁移测试，先重写 component 再写新 tests”

**拒绝。**

Legacy behavior test先搬，fixture 改到新 adapter，再改 component。

---

# 21. P9 Definition of Done

P9 在 T+24 只有同时满足以下条件才算完成：

1. `@dsh-agent-team/client` 不再是 skeleton，真实 mount 到 public DSH client seam；
2. Team root/member/ordinary/legacy perspective 可正确显示；
3. Projection state 使用 P8 generation guard，不被 stale response 回退；
4. Ledger 使用 frozen cursor rule，历史加载不依赖 Session messages；
5. New Team flow 可执行或按 frozen native seam 明确降级；
6. Team Members/Timeline/Dock/Team tab 大量复用旧实现；
7. vNext-only member/config/policy/compat commands 走 frozen Remote；
8. native Chat/Trajectory/Fork 不被复制或 synthetic injection；
9. synthetic marker 和 DOM navigation hack 已删除；
10. 14 legacy tests 每个都有 migrate/drop evidence；
11. full repo test/typecheck/build/smoke 通过；
12. 至少一条 honest production-host UI vertical path 有证据；
13. `reuse-audit.md` 证明没有发生第二次 clean rewrite；
14. CORE PATCH BUDGET = 0；
15. backend frozen contract 未被 P9 silent-edit。

---

# 22. What P10 receives

若 P9 `GO`，P10 接收的应该是：

```text
stable public client plugin
+ generation-safe Projection store
+ cursor-safe Ledger store
+ normalized presentation adapters
+ migrated legacy interaction components
+ vNext command panels
+ host integration tests
+ reuse evidence
```

P10 才处理：

- performance/tail paging优化；
- refresh cadence优化；
- large-ledger virtualization；
- accessibility polish；
- visual polish；
- flaky browser behaviors；
- transport optimization；
- minor lifecycle/read-view tightening；
- cross-version compatibility hardening。

**P10 不应再次承担“把基本 UI 接起来”的任务。**

---

# 23. Final execution order — compact checklist

```text
[ ] T+12 GO confirmed
[ ] pin vNext 7d07330 + legacy 506191b
[ ] read backend-contract-freeze
[ ] 45m public host seam map
[ ] copy legacy UI verbatim
[ ] copy legacy tests verbatim
[ ] TSX/browser package plumbing
[ ] TeamRemoteClient
[ ] TeamProjectionStore using P8 helpers
[ ] TeamLedgerStore using P8 helpers
[ ] Projection -> TeamUiSnapshot adapter
[ ] Ledger -> TeamUiLedgerModel adapter
[ ] migrate timeline model/component
[ ] migrate members model/component
[ ] migrate dock panel/shell
[ ] adapt TeamView
[ ] adapt TeamFeed -> TeamLedger
[ ] replace Task board semantics with activity-derived UI
[ ] DROP synthetic Chat marker registration
[ ] DROP TeamMirror / messagesBefore
[ ] DROP DOM tab switch
[ ] New Team flow
[ ] Member command flows
[ ] Config/Policy/Compatibility UI
[ ] Handoff/legacy surfaces where frozen-supported
[ ] native navigation / Chat / Trajectory / Fork integration
[ ] port 14 legacy tests with explicit decisions
[ ] add generation/cursor/negative tests
[ ] honest browser vertical smoke
[ ] full repo gates
[ ] reuse audit
[ ] P9_VERDICT
```

---

# 24. Bottom-line recommendation

这轮 P9 的工程目标不应被描述为：

> “为重构后的 DSH Agent Team 开发新的 UI。”

更准确的任务描述是：

> **“把已经成熟的 legacy Team UI 表现层迁到 vNext 的 frozen Remote/Projection/Ledger contract 上，同时只为 vNext 新增的 creation/governance/lifecycle surfaces 编写新 UI。”**

按实际代码看，旧 UI 已经提供了相当完整的 Team tab、Dock、Timeline、Members、Feed、样式和 14 个测试；当前 vNext client 反而只是预留 skeleton。若 P9 再把 Timeline、Members、Dock、Feed 从零实现一遍，既不是架构必要条件，也不是合理的重构成本，而是重复建设。

因此 P9 的审查重点应从“新 UI 是否写得漂亮”改为三个更硬的标准：

1. **旧资产是否被真实复用；**
2. **旧 authority 技术债是否被切断；**
3. **vNext backend contract 是否被原样消费，而没有被 UI 反向污染。**

这三个条件同时满足，才是 T+12→T+24 阶段真正的 vertical closure。
