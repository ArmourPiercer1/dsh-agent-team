# PR #35 Phase 2 补充修复指导

> 目标 PR：`ArmourPiercer1/dsh-agent-team#35`
>
> 当前审查基线：`fix/team-view-sync-complete-20260927 @ 24692f178b602eedbe794d330acf4998fd5aec0d`
>
> base：`master @ 0d1cf8beaeec11420f45e691f2a5e2c8fc8b0624`
>
> 本文只处理本轮 review 发现的 Phase 2 收口问题。不要重写既有 v6、liveToken、spill E2E 架构；优先做局部、additive、可验证的修复。

---

## 0. 结论与优先级

当前 PR 的 runtime v6、deterministic liveToken、projection freshness pair、zero-state roots cadence 和真实 spill writer E2E 基本成立，但 **client 端还没有真正使用 `team.getReadState` 作为轻量 authority/invalidation probe**。

目前实际行为仍是：

```text
visible TeamView
  -> every 3s
  -> full team.getProjection v6
  -> compare (durableGeneration, liveToken)
```

而 Phase 2 的冻结目标应是：

```text
visible session
  -> every 3s
  -> lightweight team.getReadState v6
  -> resolve authoritative ownership
  -> compare durableGeneration + liveToken
  -> only when needed: team.getProjection v6(root)
```

因此本轮至少包含三个阻断项：

1. **P0：把 `getReadStateV6` 真正接入 client coordinator / session ownership 流程。**
2. **P0：给 `getReadState` success value 增加 `liveToken`，否则轻量探针无法检测 live-only 变化。**
3. **P0：修复 v6 同 durable generation 下，旧请求晚到导致 liveToken/live frame 回滚。**

另外建议本 PR 一并完成：

4. **P1：恢复 manual force refresh 对 ledger 的显式刷新。**
5. **P1：connection restore immediate refresh 走 coordinator；store backoff retry 可保留独立。**
6. **P2：无 binding 的 ownership scan 检测多重 child claim，fail closed。**

完成这些后再做一次 review。

---

# 1. P0 — 让 client 真正消费 `team.getReadStateV6`

## 1.1 当前问题

当前代码里虽然已经有：

- `packages/client/src/transport/team-remote-client.ts`
  - `getReadStateV6(sessionId)`
- `packages/runtime/src/plugin/team-read-state.ts`
  - `resolveSessionReadState(...)`

但 `packages/client/src/plugin/team-mount-core.ts` 和 `packages/client/src/state/team-refresh-coordinator.ts` 并没有用它。

目前 coordinator 实际只是：

```ts
createTeamRefreshCoordinator({
  pull: (teamSessionId) => projectionStoreOf(teamSessionId).pull(teamSessionId),
  tickMs: 3000,
})
```

因此：

- cold member child 首次进入时，mirror 为空；
- `resolution === undefined`；
- client 把 `sessionId` 当作 candidate root；
- 对 child session 调 `team.getProjectionV6(childSessionId)`；
- root guard 拒绝。

`team.getReadStateV6(childSessionId)` 本来应该解决这个问题，但目前是 dead vertical。

## 1.2 目标架构

建议把 refresh coordinator 从“直接 full projection pull”升级为“read-state driven coordinator”。

推荐 flow：

```text
trigger(sessionId)
  -> getReadStateV6(sessionId)

  relation:none
    -> publish authoritative no-team result
    -> no projection request

  relation:team-root / team-member
    -> obtain rootSessionId
    -> compare:
       durableGeneration
       liveToken
       current applied projection identity
    -> unchanged: no-op
    -> changed / no frame: getProjectionV6(rootSessionId)
```

注意：coordinator 的寻址输入应该优先是 **当前 sessionId**，而不是 root id。因为 cold member 正是要通过 read-state 才知道 root。

## 1.3 建议新增 client-local read-state model

建议新增文件，例如：

```text
packages/client/src/state/team-read-state.ts
```

至少定义：

```ts
export type TeamReadRelation =
  | {
      kind: 'team-root'
      teamSessionId: string
      memberInstanceId: null
      disposed: false
      durableGeneration: number
      liveToken: string
    }
  | {
      kind: 'team-member'
      teamSessionId: string
      memberInstanceId: string
      disposed: boolean
      durableGeneration: number
      liveToken: string
    }
  | {
      kind: 'none'
      teamSessionId: null
      memberInstanceId: null
      disposed: false
      durableGeneration: null
      liveToken: null
    }
```

并加一个严格 parser：

```ts
parseTeamReadStateV6(response: RemoteResponse): TeamReadRelation | RemoteError
```

原则：

- success payload 必须是 closed shape；
- malformed success 不能降级为 `none`；
- typed remote failure原样保留；
- ordinary/no-team 只有 `relation === 'none'` 才成立。

## 1.4 修改 `team-refresh-coordinator.ts`

不要继续只注入：

```ts
pull(teamSessionId)
```

建议改成类似：

```ts
interface TeamRefreshCoordinatorOptions {
  readState(sessionId: string): Promise<TeamReadStateOutcome>
  pullProjection(teamSessionId: string): Promise<ProjectionSyncAssessment>
  currentProjectionIdentity(teamSessionId: string): {
    durableGeneration: number | null
    liveToken: string | null
  }
  onOwnership?(sessionId: string, state: TeamReadStateSuccess): void
}
```

每个 entry 最好按 **session scope** 管理，而不是假定它一开始就知道 team root。

一种安全方式：

```ts
attach(sessionId: string): void
detach(sessionId: string): void
trigger(sessionId: string, reason: TeamRefreshTrigger): Promise<...>
```

每轮：

1. `getReadStateV6(sessionId)`
2. 若 `none`：
   - 记录权威 ordinary/no-team；
   - 不调用 projection。
3. 若 `team-root/team-member`：
   - 得到 `teamSessionId`；
   - 对比 current projection identity；
   - mismatch 时 `getProjectionV6(teamSessionId)`。
4. 若 read-state typed failure：
   - fail visible；
   - 不猜 root；
   - 不 fallback 到 `getProjection(sessionId)`。

## 1.5 修改 `TeamView` resolution

当前：

```ts
const resolution = resolveTeamProjection(mirror, sessionId)
const teamSessionId = resolution?.team.teamSessionId ?? sessionId
```

Phase 2 完整实现后，不应再把 `sessionId` fallback 当“事实”。

需要有一个 authoritative session-read-state observable，例如：

```ts
hooks.sessionReadStates
```

TeamView 应区分：

```text
read-state pending
read-state error
read-state none
read-state team-root
read-state team-member
```

建议规则：

- `none`：允许显示真正的普通会话 / 未加入团队语义；
- `error`：显示“团队归属读取失败”，不能显示 no-team；
- `team-root/member` 但 projection 尚未到：显示 loading；
- projection 成功后：用 `teamSessionId + memberInstanceId` 确定 perspective。

对于 member child，不再需要扫描所有 mirror 才决定 ownership；mirror 只负责拿 projection 数据，不负责 TeamDomain affiliation authority。

---

# 2. P0 — `team.getReadState` 必须携带 `liveToken`

## 2.1 当前 contract 不足

当前 `RemoteTeamGetReadStateValue` 只有：

```text
relation
teamSessionId
memberInstanceId
disposed
durableGeneration
```

这无法发现：

```text
same durable generation
resident -> cold
```

所以如果 read-state 不含 token，client 仍只能每 3 秒 full projection 才能检测 live-only change。

## 2.2 修改 remote contract v6

修改：

```text
packages/remote/src/contracts/types.ts
packages/remote/src/handlers/team.ts
packages/runtime/src/plugin/s6-remote.ts
packages/runtime/src/plugin/root.ts
packages/client/src/transport/team-remote-client.ts
```

建议 closed shape：

```ts
export interface RemoteTeamGetReadStateValue {
  relation: 'team-root' | 'team-member' | 'none'
  teamSessionId: string | null
  memberInstanceId: string | null
  disposed: boolean
  durableGeneration: number | null
  liveToken: string | null
}
```

规则：

### team-root / team-member

必须同时返回：

```text
durableGeneration: positive integer
liveToken: non-empty lt-v1-* string
```

### none

必须：

```text
durableGeneration: null
liveToken: null
```

## 2.3 runtime wiring

推荐不要在 `team-read-state.ts` 里自己计算 live token，保持 durable resolver 纯粹。

可以由 `s6-remote.ts` handler：

```text
readState(sessionId)
  -> durable relation

if relation none
  -> return ... liveToken:null

else
  -> liveToken.token(teamSessionId)
  -> merge into result
```

这样：

- durable ownership resolver 保持 pure/durable-only；
- live token authority继续唯一来自现有 `liveToken` port；
- v6 read-state 与 v6 projection 使用同一 token source。

## 2.4 consistency test

必须验证同一时刻：

```text
getReadStateV6(root).durableGeneration
==
getProjectionV6(root).projection.durableGeneration

getReadStateV6(root).liveToken
==
getProjectionV6(root).projection.liveToken
```

这是 Phase 2 轻量探针成立的必要不变量。

---

# 3. P0 — 修复旧 live-only response 晚到导致回滚

## 3.1 当前 bug

v6 assessor：

```text
same durableGeneration + different liveToken -> apply
```

这是正确的。

但 liveToken 是 opaque hash，没有大小关系。

因此：

```text
seed: gen10 token A

R1 old starts -> server state token B
R2 new starts -> server state token C

R2 returns first -> apply C
R1 returns late  -> same gen, B != C -> current code apply B
```

最终 UI 从新 live state C 回滚到旧 state B。

## 3.2 修复原则

必须区分：

```text
durable apply authority
vs
live-only apply authority
```

规则：

### superseded response + durable generation strictly newer

允许 apply：

```text
old request but gen11 > current gen10
=> authoritative durable update
=> apply
```

### superseded response + same durable generation + different liveToken

禁止 apply：

```text
old request
same durable gen
different opaque live token
=> cannot prove newer
=> drop as stale-by-request-order
```

因此不能简单写：

```ts
if (supersededByNewerRoundTrip) return
```

放在所有 apply 前面。

推荐实现：

```ts
if (isApplyAssessment(assessment)) {
  const frameV6 = ...

  if (isV6 && supersededByNewerRoundTrip) {
    const receivedDurable = frameV6.projection.durableGeneration
    const currentDurable = state.appliedGeneration

    if (
      currentDurable !== null
      && receivedDurable === currentDurable
    ) {
      // live-only apply from older request: reject
      return assessment
    }
  }

  // normal apply
}
```

更严谨的条件：

```text
superseded &&
receivedDurable <= currentDurable
=> do not apply

superseded &&
receivedDurable > currentDurable
=> may apply
```

这样同时保护：

- old live-only token response；
- old duplicate-ish pair response；
- durable newer authoritative frame。

## 3.3 必须补测试

文件：

```text
packages/client/test/team-projection-store-v6.test.ts
```

至少增加：

### T1 — old live-only response after newer live-only response

```text
seed gen10 A
R1 -> gen10 B
R2 -> gen10 C
R2 settles first
R1 settles late

final:
  gen10
  token C
  frame residency/state = C
```

### T2 — newer typed error must not be cleared by old live-only response

```text
seed gen10 A
R1 old -> gen10 B
R2 new -> typed error
R2 settles first
R1 settles late

final:
  error remains
  frame remains old applied frame
  old live-only response must not clear liveness error
```

### T3 — durable newer late response still applies

保留并扩展已有 F1-T5：

```text
seed gen10 A
R2 newer request -> typed error
R1 older request -> gen11 token X late

final:
  ready
  gen11
  token X
```

---

# 4. P1 — 恢复 manual force refresh 对 ledger 的强制重读

## 4.1 当前回归

Phase 1 manual refresh 会：

```text
projection refresh
+ roots refresh
+ ledger refresh
```

Phase 2 当前改成：

```text
roots refresh
+ coordinator/projection refresh
```

并完全删除 manual ledger retry。

这会出现：

```text
projection 已经 gen100
ledger 上次读取 transport-loss
用户手动点刷新
projection duplicate gen100
=> generation 不前进
=> ledger 永远不重读
```

用户必须再去 Events 内部单独点 retry。

## 4.2 目标规则

保持单一自动 trigger：

```text
durable generation advance -> ledger auto refresh
live-only change -> no ledger refresh
duplicate tick -> no ledger refresh
```

但 manual force refresh 应额外：

```text
manual -> force ledger refresh once
```

这不破坏 frozen decision 4。

## 4.3 推荐接线

不要让 coordinator 普通 tick 自己刷 ledger。

在 `TeamView.runRefresh()`：

1. `loadRoots()`
2. `await coordinator.trigger(..., 'manual')`
3. 如果 read-state 确认当前 session 属于 Team：
   - `await refreshTeamLedger()`

若你把 coordinator 的 result 扩展成：

```ts
{
  assessment,
  relation,
  teamSessionId
}
```

则 manual refresh 可以明确判断当前是否有 team。

如果不想扩大 result surface，也可以通过 authoritative read-state store 获取 resolved teamSessionId。

## 4.4 测试

补：

```text
projection duplicate + ledger previous error
manual refresh
=> ledger getLedgerPage called again
```

以及：

```text
tick live-only apply
=> no ledger refresh
```

---

# 5. P1 — connection restore immediate refresh 应进入 coordinator

## 5.1 当前问题

当前仍保留：

```text
coordinator lane
store markConnectionRestored lane
```

于是可能同时发生：

```text
tick/manual pull
+
connection-restored pull
```

store 虽有 ordering guard，但会增加不必要并发，也扩大 live-only race surface。

## 5.2 推荐边界

保留：

```text
store transport-loss backoff retry
```

作为底层 transport recovery。

但 connection restored 事件应做：

```text
refreshCoordinator.trigger(session/team scope, 'resume')
```

或新增 trigger literal：

```ts
'connection-restored'
```

而不是直接对每个 projection store：

```ts
markConnectionRestored()
```

如果 existing store API 还承担 retry attempt reset，可拆：

```ts
store.noteConnectionRestored()
```

只清 transport episode，不直接 pull；真正 immediate read 交给 coordinator。

## 5.3 测试

必须覆盖：

```text
tick in flight
connection restore arrives
=> no parallel second full refresh
=> dirty=true
=> current settles
=> exactly one follow-up
```

---

# 6. P2 — ownership scan 检测 duplicate child ownership

## 6.1 当前问题

`packages/runtime/src/plugin/team-read-state.ts`

在无 binding 的 crash-window fallback 中按顺序扫描 roots，找到第一个：

```ts
member.childSessionId === sid
```

就直接返回。

如果损坏数据中同一个 child session 被两个 member rows claim，会 silently first-match-wins。

这与模块的“integrity failure fail-closed”承诺不一致。

## 6.2 建议新增 error code

例如：

```ts
TEAM_READ_STATE_ERROR_CODES.OWNERSHIP_CONFLICT =
  'TEAM_READ_STATE_OWNERSHIP_CONFLICT'
```

加入：

```text
REMOTE_BACKING_ERROR_CODE_SET
```

## 6.3 resolver 逻辑

无 binding 时：

```ts
const matches = []

scan all relevant roots
collect member rows with childSessionId === sid

if matches.length === 0
  => confirmed none

if matches.length === 1
  => team-member

if matches.length > 1
  => throw OWNERSHIP_CONFLICT
```

boot root 与 listed roots 去重，避免同一 root 被扫描两次。

## 6.4 测试

增加：

```text
two different roots claim same child session
=> typed TEAM_READ_STATE_OWNERSHIP_CONFLICT
=> never none
=> never first-match success
```

---

# 7. Coordinator 推荐最终形态

建议最终 coordinator 抽象成：

```ts
interface TeamRefreshCoordinatorOptions {
  readState(sessionId: string): Promise<TeamReadStateResult>
  pullProjection(teamSessionId: string): Promise<ProjectionSyncAssessment>
  getAppliedIdentity(teamSessionId: string): {
    durableGeneration: number | null
    liveToken: string | null
  }
}
```

每个 session scope entry：

```ts
interface Entry {
  sessionId: string
  timer: number | null
  inFlight: boolean
  dirty: boolean
  attached: boolean
  waiters: ...
}
```

一轮逻辑建议：

```text
runRound(sessionId)
  -> readState(sessionId)

error
  -> publish/read-state error
  -> stop

none
  -> publish authoritative none
  -> stop

team relation
  -> remember:
       teamSessionId
       memberInstanceId
       disposed
       durableGeneration
       liveToken

  -> current applied projection identity?

none
  -> pullProjection(root)

different durableGeneration
  -> pullProjection(root)

same durableGeneration + different liveToken
  -> pullProjection(root)

same pair
  -> no-op
```

### cold member

```text
session child-X
-> getReadState(child-X)
-> team-member, root=R, instance=I
-> projection R
-> render member perspective I
```

### ordinary session

```text
session plain-X
-> getReadState(plain-X)
-> none
-> stop
```

不允许再出现：

```text
plain-X
-> every 3s getProjectionV6(plain-X)
```

---

# 8. TeamView authoritative state surface

建议 TeamView 不再单靠：

```ts
resolveTeamProjection(mirror, sessionId)
```

决定“有没有 Team”。

可以保留它做 frame lookup/backward-compatible helper，但最终 UI state 应由：

```text
authoritative read-state
+
projection availability
```

组合。

推荐 UI 状态：

```text
readState = pending
  -> “正在读取团队归属...”

readState = error
  -> “团队归属读取失败”
  -> retry

readState = none
  -> 普通会话 / 新建团队入口

readState = team-root/member
projection absent/loading
  -> “正在加载团队状态...”

readState = team-root/member
projection error
  -> “团队状态读取失败”
  -> 不能降级成 none

readState = team-root/member
projection ready
  -> normal Team view
```

这样 Phase 1 修复的“不把 read failure 冒充 no-team”才能在 Phase 2 下保持严格成立。

---

# 9. v6 contract / compatibility 测试

修改 remote v6 后至少补这些 contract tests：

文件优先：

```text
packages/remote/test/c6-remote-v6.test.ts
packages/runtime/test/s6t-remote-v6.test.ts
```

必须覆盖：

1. `team.getReadState` 仅 v6 可用。
2. v1-v5 对该 method 仍按原 catalog/version 规则拒绝。
3. team-root success 带：
   - non-null durableGeneration
   - non-null liveToken
4. team-member success 同上。
5. none success：
   - teamSessionId null
   - memberInstanceId null
   - durableGeneration null
   - liveToken null
6. liveToken port missing：
   - Team relation read-state fail closed
   - 不能返回 team relation + null token
7. storage/integrity failure：
   - typed passthrough
   - never none
8. read-state / projection pair consistency。

---

# 10. client tests

重点文件：

```text
packages/client/test/team-refresh-coordinator.test.ts
packages/client/test/team-projection-store-v6.test.ts
packages/client/test/team-view.client.spec.tsx
packages/client/test/client-plugin-mount.test.ts
```

## 10.1 coordinator

至少覆盖：

- root cold attach：
  - read-state -> root
  - first projection pull
- member cold attach：
  - read-state(child) -> root
  - projection pull target = root，不是 child
- ordinary：
  - read-state -> none
  - projection pull count = 0
- unchanged pair：
  - repeated tick
  - projection pull count不增加
- durable changed：
  - one projection pull
- live token changed：
  - one projection pull
- hidden：
  - tick 0 calls
- resume：
  - immediate read-state
- inFlight + multiple triggers：
  - exactly one follow-up round
- connection restored during in-flight：
  - same coalescing semantics

## 10.2 projection store v6

新增本指南 §3 的 3 个 ordering tests。

## 10.3 TeamView

覆盖：

- authoritative `none` 才显示普通会话 zero state；
- read-state error 不显示“未加入团队”；
- cold member 能直接打开 Team；
- manual refresh 重新拉 ledger；
- live-only tick 不拉 ledger。

---

# 11. 真实浏览器 / E2E 验收

保留现有 spill E2E，不要删除。

建议新增/扩充以下真实行为验证。

## E1 cold member ownership

准备一个已存在 member child session。

全新页面/清空 client mirror 后直接打开 member child：

```text
expected:
getReadState(child) -> team-member
getProjection(root) -> ok
TeamView member perspective -> 正确 instance
```

禁止依赖先打开 root。

## E2 ordinary session

打开普通 session：

```text
getReadState -> none
3s 内不出现 getProjection(sessionId) 周期调用
```

## E3 lightweight polling

在稳定 Team 页面观察 10 秒：

```text
getReadState ≈ cadence calls
getProjection 仅首次 + state change
```

不要出现：

```text
every read-state tick == one full projection
```

## E4 live-only change

不修改 durable data，只让 live residency：

```text
resident -> cold
```

要求：

```text
durableGeneration unchanged
liveToken changed
read-state detects
projection re-pull once
ledger page call count unchanged
```

## E5 manual ledger recovery

人为让一次 ledger read fail，然后恢复 transport：

```text
projection pair unchanged
manual refresh
=> ledger page read occurs again
=> Events recover
```

## E6 out-of-order live response

单测作为决定性门禁即可；浏览器无需强行造精确网络排序。

---

# 12. 不要做的事

本轮不要：

- 修改 DSH upstream；
- 增加 server push；
- 迁移 TeamDomain；
- 删除历史 `artifact-read-granted`；
- 为 live state 推进 durable generation；
- 把 `lastActivityAt=now()` 纳入 token；
- 用 plain numeric live counter 代替 deterministic token；
- 在 read-state failure 时 fallback 为 `none`；
- 通过扫描 session logs 推断 ownership；
- 为解决 ordinary/cold-member 问题恢复“sessionId 当 root”的 silent fallback。

---

# 13. 推荐实施顺序

建议按以下顺序执行，避免返工：

### Step A — contract

1. `RemoteTeamGetReadStateValue += liveToken`
2. remote parser / tests
3. runtime handler 合并 live token
4. read-state/projection consistency tests

### Step B — client read-state model

1. strict parser
2. observable state
3. typed error / pending / none / team relation

### Step C — coordinator rewrite

1. coordinator 输入改为 sessionId
2. read-state first
3. pair unchanged -> no projection
4. pair changed -> root projection
5. cold member + ordinary tests

### Step D — TeamView ownership

1. authoritative read-state 驱动 zero-state / perspective
2. mirror 只负责 frame
3. cold member browser smoke

### Step E — concurrency

1. v6 old-live-response rollback fix
2. tests

### Step F — refresh semantics

1. manual ledger force-refresh
2. connection restore -> coordinator
3. tests

### Step G — integrity

1. duplicate child claim typed conflict
2. tests

### Step H — full gates + served bundle

---

# 14. 建议测试命令

以仓库实际脚本为准，至少执行：

```bash
pnpm --filter @dsh-agent-team/remote test
pnpm --filter @dsh-agent-team/runtime test
pnpm --filter @dsh-agent-team/client test

pnpm typecheck
pnpm build

node scripts/place-dist-glue.mjs
node scripts/build-client-composition.mjs \
  packages/client \
  packages/client/composition-shim

pnpm check:artifacts
```

如果 root suite 存在既有失败，继续沿 PR #35 当前做法：

```text
base failure set
vs
new head failure set
```

必须明确证明 0 new true regressions，不能只报总 failure count。

---

# 15. 合并退出条件

PR #35 再次提交 review 前必须满足：

- [ ] client 中实际存在 `getReadStateV6` 调用，不再是 dead wrapper；
- [ ] visible polling 首先读取 read-state，而不是每 3 秒直接 full projection；
- [ ] read-state success 包含 `liveToken`；
- [ ] cold member 首次打开无需先访问 root；
- [ ] ordinary session 得到 authoritative `none`；
- [ ] ordinary session 不周期性请求 `getProjection(sessionId)`；
- [ ] unchanged `(durableGeneration, liveToken)` 不触发 projection pull；
- [ ] live-only token 变化触发 projection pull，但不刷 ledger；
- [ ] durable generation 前进触发 projection + ledger refresh；
- [ ] manual refresh 强制 ledger retry；
- [ ] old same-generation live-only response 不能回滚 newer token/frame；
- [ ] old durable-newer response 仍允许 apply；
- [ ] connection restore immediate refresh 进入 coordinator/coalescing；
- [ ] no-binding duplicate child claim fail closed typed；
- [ ] existing real spill writer E2E 继续 PASS；
- [ ] v1–v5 contract behavior保持；
- [ ] typecheck/build/artifacts green；
- [ ] served bundle browser smoke 完成。

---

# 16. 给执行 agent 的最终约束

如果实现中出现下面任一情况，才暂停等待人工决策：

1. 必须修改 DSH upstream 才能实现 read-state driven sync；
2. 必须迁移 TeamDomain schema；
3. 必须改变现有 v1–v5 wire semantics；
4. deterministic liveToken 无法通过当前公开 live residency seam计算；
5. cold member ownership 无法仅通过 TeamDomain durable rows解析。

除这五类外，其余工程细节自行选择局部、可测试、additive 的实现，不必等待人工确认。
