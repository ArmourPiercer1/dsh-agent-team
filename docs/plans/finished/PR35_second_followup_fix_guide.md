# PR #35 第二轮补充修复指导

> Repository: `ArmourPiercer1/dsh-agent-team`
>
> PR: `#35 feat(team-sync): remote contract v6 + client-owned polling + deterministic live token + real-spill E2E (phase 2)`
>
> 本轮审查基线：`9a94d8309ac33132f730d15ca98173f6a8bd8561`
>
> base：`0d1cf8beaeec11420f45e691f2a5e2c8fc8b0624`
>
> 本文只处理 9a94d830 之后仍存在的 4 个问题。上一轮 `getReadStateV6` 接线、read-state liveToken、manual ledger refresh、connection-restore coordinator、ownership conflict、same-generation stale-live response guard均保留，不要推倒重做。

---

## 0. Review 结论与本轮目标

上一轮发现的 6 项缺陷已经基本闭合，当前真实 browser smoke 已证明：

- visible root：3s cadence 只发 `team.getReadState`，稳定状态不 full-poll projection；
- cold member：无需先打开 root，即可由 child session 解析 owning root；
- ordinary session：`getReadState -> none`，不会发 `getProjection(ordinarySession)`；
- manual refresh：重新读一次 ledger；
- spill writer 真链仍 PASS。

但继续检查 live-state authority 后发现 4 个遗留问题：

| Priority | 问题 | 是否阻断 merge |
|---|---|---|
| **P0** | live overlay 使用 host-wide `Map<instanceId,...>`，跨 Team 的 `inst-leader` 必然碰撞 | **是** |
| **P0** | v6 projection 的 `members[].liveActivity` 与 `liveToken` 来自两次不同 live snapshot | **是** |
| **P1** | TeamView 已获得 authoritative read-state，但 UI 仍把 `none/error` 长期显示成“正在加载” | 建议本轮修 |
| **P1** | coordinator detach→reattach 后旧 probe 可晚到覆盖新 read-state | 建议本轮修 |

本轮目标：

```text
per-Team live snapshot
        +
projection frame/liveToken same-snapshot
        +
authoritative read-state UI
        +
read-state scope ordering
```

完成后再进行最终 review。

---

# 1. P0 — 将 LiveResidencyOverlay 从 host-wide 改成 Team-scoped

## 1.1 当前根因

当前：

```text
packages/runtime/src/plugin/s6-live-overlay.ts
```

构造：

```ts
const result = new Map<InstanceId, MemberLiveActivityDto>()

const roots = new Set<string>([rootSessionId])
for (const record of repositories.teamSessions.list()) {
  roots.add(record.rootSessionId)
}

for (const root of roots) {
  for (const record of repositories.memberInstances.list(root)) {
    ...
    result.set(instanceId, liveActivity)
  }
}
```

其注释写：

```text
Instance ids are globally unique rows
```

这个前提错误。

契约明确规定每个 Team 的 Leader 都使用同一个：

```ts
LEADER_INSTANCE_ID = 'inst-leader'
```

而普通 Member 的 `instanceId` 也是 **within-team identity**；真正的跨 Team identity 是：

```text
(rootSessionId, instanceId)
```

因此：

```text
Team A / inst-leader = resident
Team B / inst-leader = cold
```

host-wide Map 最终只能保留其中一个值。

后果同时污染：

```text
projection.members[].liveActivity
readState.liveToken
projection.liveToken
automatic invalidation
```

## 1.2 冻结修法：overlay 变成 Team-scoped

不要继续维护一个“宿主全 Team 合并后的 Map”。

修改：

```text
packages/runtime/projection/types.ts
packages/runtime/projection/service.ts
packages/runtime/src/plugin/seams.ts
packages/runtime/src/plugin/s6-live-overlay.ts
packages/runtime/src/plugin/root.ts
```

把：

```ts
interface LiveResidencyOverlayPort {
  snapshot(): ReadonlyMap<InstanceId, MemberLiveActivityDto>
}
```

改为：

```ts
interface LiveResidencyOverlayPort {
  snapshot(teamSessionId: TeamSessionId): ReadonlyMap<InstanceId, MemberLiveActivityDto>
}
```

### `s6-live-overlay.ts`

`createLiveResidencyOverlay(...).snapshot(teamSessionId)` 只读取：

```ts
repositories.memberInstances.list(teamSessionId)
```

不要：

```text
teamSessions.list()
遍历所有 owned roots
合并成一个 Map
```

伪代码：

```ts
function snapshot(teamSessionId: TeamSessionId) {
  const result = new Map<InstanceId, MemberLiveActivityDto>()

  for (const raw of repositories.memberInstances.list(teamSessionId)) {
    const row = ...
    const instanceId = row.instanceId

    if (member is DISPOSED) continue

    const session =
      childSessionId exists
        ? childSessionId
        : teamSessionId  // v2 leader

    if (live.hasLive(session)) {
      result.set(instanceId, {
        residency: 'resident',
        lastActivityAt: now(),
      })
    } else if (live.isResuming(session)) {
      result.set(instanceId, { residency: 'resuming' })
    } else {
      result.set(instanceId, { residency: 'cold' })
    }
  }

  return result
}
```

### `projection/service.ts`

把：

```ts
overlay.snapshot()
```

改为：

```ts
overlay.snapshot(teamSessionId)
```

这样每一次：

```text
projection(A)
```

只可能读取 Team A 的 live namespace。

### `seams.ts`

fail-closed proxy 同步传递 team id：

```ts
snapshot(teamSessionId) {
  return seam.current().snapshot(teamSessionId)
}
```

## 1.3 不要采用的替代方案

不要：

- 给 `inst-leader` 单独做 if/else 特判；
- 假设其他 member instanceId 永不跨 Team 重复；
- 把全局 Map key 临时改成字符串 `"root:instance"`，但 projection fold 仍按 `instanceId` 查；
- 让 caller 自己从 host-wide map 再过滤——碰撞已经发生，过滤太晚。

如果一定要保留 host-wide snapshot，那么 key 必须升级为完整 `MemberIdentity`，并同时重构 fold；这比 Team-scoped snapshot 改动更大，本轮不推荐。

---

# 2. P0 — v6 projection frame 与 liveToken 必须来自同一次 live snapshot

## 2.1 当前竞态

当前 production 路径：

```text
team.getProjection v6
  ↓
projection.project(team)
  ↓
overlay.snapshot()        # snapshot A
  ↓
projection.members[].liveActivity

然后：

ports.liveToken.token(team)
  ↓
liveOverlay.snapshot()    # snapshot B
  ↓
liveToken
```

如果 A/B 之间状态变化：

```text
A: resident
B: cold
```

response 会变成：

```text
frame.liveActivity = resident
liveToken          = token(cold)
```

client 应用后：

```text
applied frame = resident
applied token = cold-token
```

下一轮 read-state 也得到 cold-token：

```text
pair unchanged
=> coordinator 不再 pull projection
```

于是错误 frame 可以长期停留。

这违反 Phase 2 的核心不变量：

```text
applied (durableGeneration, liveToken)
必须描述同一个已应用 projection frame
```

## 2.2 推荐修法：projection 生成后直接从该 projection 的 liveActivity 计算 token

在完成 §1 Team-scoped overlay 后：

```ts
projection.project(teamSessionId)
```

已经由：

```text
ONE durable source read
ONE Team-scoped live snapshot
```

生成完整 frame。

因此 v6 token 不应再次读取 overlay。

### 在 `live-token.ts` 增加纯 helper

例如：

```ts
export interface ProjectedLiveMember {
  readonly instanceId: string
  readonly liveActivity:
    | { readonly residency: string }
    | null
}

export function computeLiveTokenFromProjectedMembers(
  members: readonly ProjectedLiveMember[],
): string
```

映射规则必须与现有 token 语义完全相同：

```text
member.liveActivity != null
  -> residency = liveActivity.residency

member.liveActivity == null
  -> residency = 'absent'
```

然后：

```text
sort by instanceId
canonical JSON
sha256
lt-v1-...
```

重要：

- 只读 `instanceId + residency/null`；
- 不读 `lastActivityAt`；
- 不读 `generatedAt`；
- 不读时钟字段；
- token format 不变，仍是 `lt-v1-*`。

### 为什么 projection members 可以作为 token source

当前 projection source/fold 会保留 Team 的 member rows，包括 DISPOSED row；DISPOSED 在 overlay 中无 live fact，因此：

```text
liveActivity === null
```

恰好对应现有 token helper 中的：

```text
absent
```

所以从 projection members 生成 token 能保持已有 semantic token 含义，同时天然保证：

```text
frame + token = same snapshot
```

## 2.3 修改 S6 production handler

重点文件：

```text
packages/runtime/src/plugin/s6-remote.ts
```

当前 v6 projection：

```ts
ports.projection.project(team)
  .then(projection => ports.liveToken.token(team)
    .then(liveToken => ...))
```

改成：

```text
project team ONCE
normalize projection
compute token from normalized/projected members
construct v6 response
```

概念：

```ts
const projection = normalizeS6Projection(
  await ports.projection.project(teamSessionId)
)

const liveToken =
  computeLiveTokenFromProjectedMembers(
    projection.members
  )

return {
  data: {
    projection: {
      ...projection,
      durableGeneration: projection.generation,
      liveToken,
    },
  },
  projectionGeneration: projection.generation,
}
```

### `liveToken` port 仍保留

不要删除 live-token port。

它仍用于：

```text
team.getReadState
```

因为 read-state 是 lightweight probe，不应为了 token 生成 full projection。

但 production v6 projection **不再第二次调用该 port**。

所以职责变成：

```text
getReadState:
  Team-scoped live snapshot
  -> liveToken port

getProjection v6:
  projection's already-materialized live state
  -> compute token directly from projected members
```

## 2.4 Pure remote handler 要保持同一语义

`packages/remote/src/handlers/team.ts` 当前也有：

```ts
projection.project(...)
liveToken.liveToken(...)
```

不要让测试/factory handler 与 production S6 handler 形成两套 v6 语义。

推荐二选一：

### 方案 A（推荐）

给 `RemoteProjectionPort` 增加 v6 原子读：

```ts
projectV6(teamSessionId): {
  projection: RemoteSafeRecord
  liveToken: string
}
```

v1-v5 继续：

```ts
project()
```

v6：

```ts
projectV6()
```

生产 adapter 的 `projectV6` 由同一次 projection 结果计算 token。

### 方案 B

如果该 pure handler 明确不进入 production，仍应至少让其 v6 test double 的 token由同一个 returned projection 生成，并写清该 handler 是 contract/factory surface。

不要留下：

```text
S6 production = same-snapshot
pure remote handler = two-snapshot
```

这种 contract 语义分裂。

---

# 3. P0 必须补的 live correctness tests

## 3.1 两个 Team 的 Leader collision

重点测试：

```text
packages/runtime/test/s6t-live-token.test.ts
```

并建议增加/扩展 overlay spec。

构造：

```text
Team A:
  inst-leader -> session A
  A live = resident

Team B:
  inst-leader -> session B
  B live = cold
```

断言：

```ts
snapshot(A).get('inst-leader').residency === 'resident'
snapshot(B).get('inst-leader').residency === 'cold'
```

然后：

```text
projection(A).leader.liveActivity = resident
projection(B).leader.liveActivity = cold
```

再断言各自 token 与各自 frame一致。

这个测试不能只断言：

```text
token(A) !== token(B)
```

因为 Team 的普通 member set 不同也能导致 token 不同，无法证明 leader collision 修复。

## 3.2 同一 v6 projection 只读一次 live snapshot

构造一个 fake overlay：

```text
1st snapshot => resident
2nd snapshot => cold
```

对**一次**：

```text
team.getProjection v6
```

断言：

```text
snapshot call count === 1
```

且：

```text
frame leader residency = resident
token == token(resident)
```

绝不允许：

```text
frame resident + token(cold)
```

## 3.3 read-state/projection stable consistency

稳定状态继续保留已有：

```text
getReadState.liveToken
==
getProjection.liveToken
```

但注明它只是稳定态一致性，不能替代 §3.2 race test。

---

# 4. P1 — TeamView 必须真正使用 authoritative read-state 驱动 UI

## 4.1 当前症状

当前代码已经：

```ts
const readState = readStates[sessionId] ?? null
const ownership =
  readState?.status === 'ok'
    ? readState.relation
    : null

const authoritativeNone =
  ownership?.kind === 'none'
```

但 zero-state 文案仍主要根据：

```text
projectionState
```

判断。

当前 PR 自己的真实 browser smoke 已记录：

```text
ordinary session
getReadState => none
getProjection => zero calls
```

页面却仍显示：

```text
正在加载团队信息…
```

而且会一直如此。

类似地：

```text
readState remote-error / malformed / transport-loss
```

在没有 projection store 时也会长期呈现 loading。

## 4.2 目标 UI 状态机

### 无 frame

| read-state | UI |
|---|---|
| `null` | 正在读取团队归属… |
| `ok / none` | 已确认当前会话未加入团队 / 普通会话 zero state |
| `remote-error` | 团队归属读取失败 — `code: message` |
| `malformed` | 团队归属响应异常 — `reason` |
| `transport-loss` | 无法读取团队归属，等待连接恢复 |
| `ok / team-root` | 正在加载团队状态… |
| `ok / team-member` | 正在加载团队状态… |

### 已有旧 frame

如果 read-state失败：

```text
不要删除 frame
不要降级成 none
```

应：

```text
继续显示 last good Team view
+
明确 banner:
“团队归属刷新失败，当前显示上次成功的数据”
```

### authoritative `none`

如果当前 session 的 read-state 明确为：

```text
ok / none
```

则该 authority 优先于旧 mirror：

```text
必须进入 ordinary/no-Team zero state
```

不能继续显示旧 Team frame。

## 4.3 修正 render 条件

当前虽然有：

```ts
const inZeroState =
  authoritativeNone ||
  resolution === undefined ||
  snapshot === null
```

但实际 render branch 仍是：

```ts
if (resolution === undefined || snapshot === null) {
```

改为以 authoritative state 为准。

推荐先计算一个明确的 view mode：

```ts
type TeamViewMode =
  | { kind: 'ownership-loading' }
  | { kind: 'ownership-error'; ... }
  | { kind: 'ordinary' }
  | { kind: 'team-loading'; ... }
  | { kind: 'team-ready'; ... }
```

或者至少：

```ts
if (authoritativeNone) {
  return ordinaryZeroState
}

if (readState != null && readState.status !== 'ok' && snapshot === null) {
  return ownershipErrorState
}

if (snapshot === null) {
  return team/loading state
}

return team view
```

不要让：

```text
authoritativeNone=true
但 stale snapshot!=null
```

落进 Team body。

## 4.4 测试

文件：

```text
packages/client/test/team-view.client.spec.tsx
```

至少新增：

### UI-T1

```text
readState = ok/none
mirror empty
=> 显示 definitive ordinary/no-team
=> 不显示“正在加载团队信息…”
```

### UI-T2

```text
readState = remote-error
mirror empty
=> 显示 code/message
=> 不显示 ordinary/no-team
=> 不永久 loading
```

### UI-T3

```text
readState = malformed
mirror empty
=> 显示 malformed reason
```

### UI-T4

```text
readState = transport-loss
mirror empty
=> 显示 reconnect/read failure
```

### UI-T5

```text
stale mirror has Team A
readState = ok/none
=> ordinary zero state wins
=> Team A body不渲染
```

### UI-T6

```text
stale mirror has Team A
readState = error
=> 保留 Team A body
=> 同时显示 ownership stale/error banner
```

---

# 5. P1 — coordinator detach → reattach 必须有 scope epoch

## 5.1 当前 race

当前：

```text
runRound()
  await readState(session)
  onReadState(session, outcome)
  maybe pullProjection(...)
```

`detach(session)` 只：

```ts
entries.delete(sessionId)
```

不会取消已运行的 `runRound()`。

所以：

```text
attach S
round A begins

detach S

reattach S
round B begins
B settles -> records B

A settles late
-> records A
-> may trigger stale conditional projection
```

新的 `sessionReadStatesStore` 没有 PR #34 projection store 那样的 request-order gate。

## 5.2 推荐实现

给每一次 attached session scope 一个 incarnation/epoch。

例如：

```ts
interface SessionEntry {
  readonly epoch: number
  ...
}

let nextEpoch = 1
```

attach 新 entry：

```ts
entry = {
  epoch: nextEpoch++,
  ...
}
```

`startRound` 捕获：

```ts
const entryAtStart = entry
```

在 **每个有外部副作用的阶段前**检查：

```ts
entries.get(sessionId) === entryAtStart
```

至少在：

1. `readState` settle 后、`onReadState` 前；
2. conditional `pullProjection` 前；
3. 后续 `lastResult / dirty follow-up` 接线时。

### 建议给 `runRound` 传 scope guard

概念：

```ts
async function runRound(
  options,
  sessionId,
  isCurrent: () => boolean,
) {
  const outcome = await options.readState(sessionId)

  if (!isCurrent()) {
    return {
      readState: outcome,
      projectionAssessment: null,
    }
  }

  options.onReadState?.(...)

  ...

  if (!isCurrent()) return ...

  await options.pullProjection(...)
}
```

如果不想扩公开 result shape，可以不加 `superseded` 字段；关键是：

```text
旧 scope 不再 publish authority
旧 scope 不再发 conditional projection
```

### unattached forced round

`ensureProjection` 冷开有一个 unattached round。

不要因为增加 epoch 把它误杀。

可以：

- unattached run 使用独立 mount-level single-flight；
- attach 后将后续 3s coordinator round纳入 entry epoch；
- cold round的 result 仍允许落地，因为它是当前 session 的 cold bootstrap。

若想进一步统一，可先 `attach(sessionId)` 再触发 cold round，但这不是本轮必要条件。

## 5.3 必须补测试

文件：

```text
packages/client/test/team-refresh-coordinator.test.ts
```

新增确定性 gate：

```text
A(old) readState blocked

detach S
reattach S

B(new) starts
B settles first -> state B

A settles late
```

断言：

```text
onReadState only records B as latest
A cannot overwrite B
A cannot trigger projection pull
new entry timer remains intact
```

另加：

```text
detach permanently while probe in flight
late probe settle
=> no onReadState
=> no projection pull
```

---

# 6. P0/P1 修复后的最终 live-state 结构

目标结构应为：

```text
                   Team root R
                       │
         ┌─────────────┴─────────────┐
         │                           │
  lightweight readState       full projection
         │                           │
 member rows R                  durable source R
         │                           │
 snapshot(R)                    snapshot(R) ONCE
         │                           │
 token(R)                projection.liveActivity
                                     │
                                     └─ token computed
                                        FROM THIS projection
```

因此：

```text
getReadState:
  durable resolver
  + Team-scoped snapshot(R)
  -> token

getProjection v6:
  projection.project(R)
    -> Team-scoped snapshot(R) exactly once
  -> token from projected members
```

关键不变量：

```text
Within one v6 projection response:

projection.members[].liveActivity
and
projection.liveToken

describe the SAME materialized live snapshot.
```

---

# 7. 需要修改的主要文件

预计至少：

```text
packages/runtime/projection/types.ts
packages/runtime/projection/service.ts
packages/runtime/src/plugin/seams.ts
packages/runtime/src/plugin/s6-live-overlay.ts
packages/runtime/src/plugin/live-token.ts
packages/runtime/src/plugin/root.ts
packages/runtime/src/plugin/s6-remote.ts

packages/remote/src/handlers/ports.ts
packages/remote/src/handlers/team.ts

packages/client/src/state/team-refresh-coordinator.ts
packages/client/src/ui/TeamView.tsx
```

测试：

```text
packages/runtime/test/s6t-live-token.test.ts
packages/runtime/test/s6t-remote-v6.test.ts
packages/remote/test/c6-remote-v6.test.ts
packages/client/test/team-refresh-coordinator.test.ts
packages/client/test/team-view.client.spec.tsx
```

如果仓库已有专门 overlay/projection service spec，优先扩展现有文件，不要为了一个 case 无必要新增大量 test surface。

---

# 8. E2E / browser smoke 新增验收

保留现有 run-15 spill E2E 与 browser smoke。

再补以下重点。

## E6 — two-team leader residency isolation

同一宿主准备 Team A / Team B：

```text
A leader = resident
B leader = cold
```

分别：

```text
getProjection(A) v6
getProjection(B) v6
getReadState(A) v6
getReadState(B) v6
```

断言：

```text
A projection leader = resident
B projection leader = cold

A projection token == A readState token
B projection token == B readState token
```

不要只断言 token A != token B。

## E7 — ordinary UI semantics

现有 E2 已经证明 wire 正确，但 UI 仍写 loading。

修复后截图/DOM 必须证明：

```text
readState=none
=> 页面明确 ordinary/no-team
=> 不显示“正在加载团队信息…”
```

## E8 — ownership failure surface

可以用 test host/fault injection，不一定真实生产 world。

至少 browser/component level 证明：

```text
TEAM_READ_STATE_OWNERSHIP_CONFLICT
或 read-state typed error
```

显示为：

```text
团队归属读取失败
```

不能：

```text
未加入团队
正在加载（永久）
```

## E9 — same-snapshot projection

决定性门禁优先用 deterministic unit/integration fake：

```text
snapshot call #1 => resident
snapshot call #2 => cold
```

一次 v6 getProjection 必须：

```text
snapshot call count == 1
```

不需要在真实浏览器中强制造微秒级 race。

---

# 9. 回归测试重点

必须继续保持：

- `artifact-read-granted` projection 可读；
- grant 仍计入 control summary；
- grant 不进入用户 Events；
- cold member 首开成功；
- ordinary session 0 projection polling；
- unchanged pair 只有 read-state cadence；
- live-only changed token -> projection pull；
- live-only apply不刷新 ledger；
- durable advance -> projection + ledger；
- manual refresh -> explicit ledger refresh；
- connection restore -> coordinator；
- old same-generation live response不能回滚；
- old durable-newer response仍可 apply；
- duplicate child ownership typed fail-closed；
- v1-v5 wire behavior不变。

---

# 10. 构建与门禁

按仓库当前工作流执行，至少：

```bash
pnpm --filter @dsh-agent-team/remote test
pnpm --filter @dsh-agent-team/runtime test
pnpm --filter @dsh-agent-team/client test

pnpm typecheck
pnpm build

node scripts/build-client-composition.mjs   packages/client   packages/client/composition-shim

node scripts/place-dist-glue.mjs
pnpm check:artifacts
```

重新运行：

```bash
node tests/kits/team-view-sync-complete-e2e/team-view-sync-complete-e2e.mjs
```

以及更新后的 browser smoke。

root suite 若继续有已知环境性 failure：

```text
对 base 0d1cf8be 和新 tip 做归一化 failure-set diff
证明 0 new true regression
```

不要只报：

```text
N failed / M passed
```

---

# 11. PR bookkeeping

当前 GitHub 显示：

```text
head  = 9a94d830...
commits = 5
```

PR body 仍有顶部：

```text
4 commits
```

最终提交后统一更新：

- head SHA；
- commit count；
- follow-up gate numbers；
- browser/E2E evidence path；
- 不再保留被后续修复推翻但未明确标记的旧行为描述。

---

# 12. 最终退出条件

再次提交 review 前全部满足：

- [ ] `LiveResidencyOverlayPort` 按 TeamSession scope 读取；
- [ ] 两个 Team 的 `inst-leader` live state 不互相覆盖；
- [ ] v6 `team.getProjection` 一次请求只 materialize 一次 Team live snapshot；
- [ ] projection frame 与其 `liveToken` 必然 same-snapshot；
- [ ] read-state token继续 lightweight，不为 token 构建 whole projection；
- [ ] stable readState token == stable projection token；
- [ ] authoritative `none` UI 明确呈现普通/no-team，不永久 loading；
- [ ] read-state error/malformed/transport-loss 有明确 UI；
- [ ] authoritative none 能压过 stale mirror；
- [ ] read-state failure 有旧 frame 时保留 last-good Team view并显示 stale/error；
- [ ] detach→reattach 的旧 probe不能覆盖新 scope；
- [ ] detached old probe不能触发 stale projection pull；
- [ ] 现有 read-state-driven cadence仍保持；
- [ ] cold member E1仍 PASS；
- [ ] ordinary 0-projection E2仍 PASS；
- [ ] manual refresh E5仍 PASS；
- [ ] 新 E6 two-team leader isolation PASS；
- [ ] spill E2E仍 PASS；
- [ ] typecheck/build/artifact check通过；
- [ ] v1-v5 behavior无回归；
- [ ] upstream/test-use保持 pristine。

---

# 13. 暂停并请求人工决策的条件

只有出现以下情况才暂停：

1. Team-scoped overlay 需要修改 DSH upstream；
2. 为 same-snapshot v6 projection 必须破坏 v1-v5 wire；
3. 需要 TeamDomain migration；
4. 当前 projection DTO 事实上不包含 token 所需的完整 member/live semantic state，无法从同一 snapshot计算；
5. 需要改变 `LEADER_INSTANCE_ID = inst-leader` 或 MemberIdentity 模型。

除以上情况，具体工程接线、helper 命名、测试文件组织由 agent 自行选择，不需要等待用户继续裁决。
