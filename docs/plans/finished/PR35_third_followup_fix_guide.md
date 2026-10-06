# PR #35 第三轮补充修复指导

> Repository: `ArmourPiercer1/dsh-agent-team`  
> PR: `#35 feat(team-sync): remote contract v6 + client-owned polling + deterministic live token + real-spill E2E (phase 2)`  
> 审查基线：`27bb416fd9749a181b9f49a1340dceccc6493e84`  
> 第二轮实际代码修复 commit：`ee9aca60e208dcaaa554938042d952ab65236247`  
> base：`0d1cf8beaeec11420f45e691f2a5e2c8fc8b0624`

本文只处理第二轮修复后剩余的两个问题：

1. **P1：cold-bootstrap 的 unattached round 仍绕过 coordinator scope epoch；**
2. **P1：最终 E2E / browser evidence 必须绑定到 clean final commit，而不是仅绑定到分支 + 未提交工作区。**

第二轮已完成并应保留：Team-scoped live overlay、same-snapshot v6 `liveToken`、authoritative read-state UI、attached-session detach→reattach scope epoch、read-state driven polling、manual ledger refresh、connection restore coordinator、duplicate child ownership fail-closed、same-generation stale-live guard，以及 Phase 1 的 artifact/compatibility 修复。

---

## 0. 当前结论

当前已经没有新的 P0 架构问题。剩余代码缺陷集中在 coordinator 生命周期：

```text
TeamView cold open
  ↓
ensureProjection(sessionId)
  ↓
refreshCoordinator.trigger(sessionId, ...)
  ↓
此时 session 尚未 attach
  ↓
runRound(..., () => true)
  ↓
该 round 永远不受后续 attach / detach / scope epoch 约束
```

因此 cold-bootstrap round A 可以在后续 attached round B 之后晚到，并重新发布旧 read-state authority。

当前测试 E3 反而把该行为固定为“允许 old cold round 晚到仍落地”，需要改掉。

---

# 1. P1 — cold-bootstrap round 必须进入同一个 session scope

## 1.1 当前真实调用顺序

`packages/client/src/ui/TeamView.tsx` 当前 effect 顺序大致是：

```ts
useEffect(() => {
  if (resolution === undefined) {
    void ensureProjection(sessionId)
  }
}, [sessionId, resolution, ensureProjection])

useEffect(() => {
  refreshCoordinator.attach(sessionId)
  return () => refreshCoordinator.detach(sessionId)
}, [sessionId, refreshCoordinator])
```

React effect 按声明顺序执行，因此 cold open 实际是：

```text
1. ensureProjection()
2. trigger(sessionId)
3. coordinator entries 中还没有该 session
4. runRound(..., () => true)

随后：
5. attach(sessionId)
6. 创建正式 SessionEntry
```

`team-refresh-coordinator.ts` 当前 unattached 分支：

```ts
if (entry === undefined) {
  return runRound(options, sessionId, () => true)
}
```

这等价于：

```text
unattached round 不属于任何 epoch
```

---

# 2. 可复现竞态

## 2.1 old cold success 覆盖 newer success

```text
t0:
cold round A:
  getReadState(S) started
  response delayed

t0+:
TeamView attach(S)
  creates entry N

t3s:
tick round B starts

B returns first:
  readState = team-root, gen=10, token=C
  onReadState(B)

A returns later:
  readState = team-root, gen=9, token=B
```

因为 A guard 永远是：

```ts
() => true
```

A 会继续：

```text
onReadState(S, old A)
```

覆盖新的 authority。

如果 pair 不同，还可能额外触发一次 stale conditional projection pull。

## 2.2 old cold error 覆盖 healthy state

```text
A:
  old transport-loss / remote-error
  delayed

B:
  healthy read-state
  settles first
  Team UI healthy

A late:
  onReadState(error)
```

UI 可能退化为：

```text
团队归属刷新失败，当前显示上次成功的数据
```

直到下一次 tick 才恢复。

---

# 3. 推荐修法：unattached round 也创建 transient SessionEntry

不要只交换 TeamView 两个 `useEffect` 的顺序。交换顺序只能缓解 TeamView 当前路径，不能解决其他 caller 的：

```text
trigger(sessionId) → later attach(sessionId)
```

应在 coordinator 内统一生命周期。

## 3.1 SessionEntry 增加 attached 状态

建议：

```ts
interface SessionEntry {
  readonly epoch: number
  attached: boolean
  timer: number | null
  inFlight: boolean
  dirty: boolean
  followUpWaiters: Array<(result: TeamRefreshRoundResult) => void>
  lastResult: TeamRefreshRoundResult | null
}
```

## 3.2 创建 entry helper

例如：

```ts
const createEntry = (
  sessionId: string,
  attached: boolean,
): SessionEntry => {
  const entry: SessionEntry = {
    epoch: nextEpoch++,
    attached,
    timer: null,
    inFlight: false,
    dirty: false,
    followUpWaiters: [],
    lastResult: null,
  }

  entries.set(sessionId, entry)

  if (attached && !paused) {
    armTick(sessionId)
  }

  return entry
}
```

---

# 4. 修改 trigger()

当前：

```ts
const entry = entries.get(sessionId)

if (entry === undefined) {
  return runRound(options, sessionId, () => true)
}
```

改为：

```ts
let entry = entries.get(sessionId)

if (entry === undefined) {
  entry = createEntry(sessionId, false)
}

return triggerAgainstEntry(sessionId, entry, reason)
```

也就是说，第一次 unattached trigger 不再启动“裸 round”，而是创建 transient scope。

cold-bootstrap round 因此也获得真实的：

```text
entryAtStart
isCurrent()
epoch
```

---

# 5. attach() 必须复用 transient entry

建议：

```ts
const attach = (sessionId: string): void => {
  let entry = entries.get(sessionId)

  if (entry === undefined) {
    entry = createEntry(sessionId, true)
    return
  }

  entry.attached = true

  if (!paused) {
    armTick(sessionId)
  }
}
```

关键是：

```text
如果 cold round 已经创建 transient entry
attach 必须复用它
```

不能另建新的 entry。

这样 cold bootstrap 与后续 tick/manual/mutation 自然共享同一 single-flight lane。

---

# 6. transient entry 清理规则

unattached mutation/create path不能永久泄漏 entry。

建议：

```ts
const maybeDropTransientEntry = (
  sessionId: string,
  entry: SessionEntry,
): void => {
  if (
    entries.get(sessionId) === entry &&
    entry.attached === false &&
    entry.inFlight === false &&
    entry.dirty === false &&
    entry.followUpWaiters.length === 0
  ) {
    entries.delete(sessionId)
  }
}
```

round settle 后调用。

必须检查：

```ts
entries.get(sessionId) === entry
```

避免删除后来的新 scope。

---

# 7. detach() 继续代表 scope close

推荐保持：

```text
detach == close current session scope
```

即：

1. disarm timer；
2. 清理/settle waiter；
3. `entries.delete(sessionId)`。

不要仅设置：

```ts
entry.attached = false
```

并继续保留 entry，否则未来 reattach 可能再次复用旧 scope，使 detach 不再真正 invalidating。

---

# 8. runRound 现有双 guard 保留

第二轮已经有正确的 guard：

```ts
const outcome = await options.readState(sessionId)

if (!isCurrent()) {
  return {
    readState: outcome,
    projectionAssessment: null,
  }
}
```

以及 conditional projection pull 前再次：

```ts
if (!isCurrent()) {
  return {
    readState: outcome,
    projectionAssessment: null,
  }
}
```

这部分不要改弱。

本轮核心只是：

```text
让 cold-bootstrap round 也获得真正的 isCurrent
```

而不是：

```ts
() => true
```

---

# 9. single-flight / dirty coalescing 的目标

修复后：

```text
cold ensureProjection round A in flight
      ↓
TeamView attach
      ↓
timer armed on SAME entry

manual / tick / mutation arrives
      ↓
entry.inFlight == true
      ↓
dirty = true
      ↓
coalesce
```

最终：

```text
cold bootstrap
tick
manual
mutation
resume
connection restore
```

全部统一在同一 per-session coordinator lane 中。

---

# 10. 当前 E3 测试必须删除旧 expectation

当前 E3 语义：

```text
unattached cold-bootstrap round
attach occurs
cold result late settles
=> EXPECT onReadState + projection pull
```

这个 expectation 应删除。

---

# 11. 新的 coordinator 测试

文件：

```text
packages/client/test/team-refresh-coordinator.test.ts
```

至少增加/替换以下测试。

## COLD-E1 — attach 复用 transient entry

```text
trigger(S) while unattached
readState parked

attach(S)

trigger(S, manual)
```

断言：

```text
第二个 trigger 不启动第二个 probe
probe call count == 1
第二触发被 dirty-coalesced
```

第一轮 settle 后：

```text
follow-up exactly once
```

最终：

```text
probe call count == 2
one timer armed
no overlapping rounds
```

## COLD-E2 — detach→reattach invalidates old cold scope

```text
cold A starts in transient entry E1

attach S
  reuses E1

detach S
  E1 deleted

reattach S
  creates E2

round B starts in E2
B settles healthy

A settles late
```

断言：

```text
onReadState only records B
A projectionAssessment == null
A causes no conditional pull
new entry timer remains intact
```

## COLD-E3 — permanent detach

```text
cold A starts
attach
detach permanently
A settles
```

断言：

```text
no onReadState
no projection pull
session no longer attached
```

---

# 12. TeamView effect 顺序可顺手调整，但不是主修法

在 coordinator 修好后，可以把 attach effect 放在 ensureProjection effect 前面：

```text
attach
then ensureProjection
```

这样 UI 路径更直观，也减少 transient path。

但不要只依赖 effect 顺序；coordinator 自身必须保证任意：

```text
trigger → attach
```

顺序都安全。

---

# 13. Evidence 可复现性问题

当前保留的 spill E2E：

```text
wp8-spill-e2e-tvs-spill-2026-09-28T07-38-16
```

summary/preflight 记录：

```text
worktreeHead = 9a94d830...
```

但第二轮代码 commit 是：

```text
ee9aca60...
```

说明它很可能是在：

```text
HEAD = 9a94d830
working tree = 含第二轮未提交修改
dist = 已重建
```

状态下跑的。

这可以作为开发证据，但不能严格证明某个 immutable commit 通过该 E2E。

---

# 14. 修改 E2E preflight

文件：

```text
tests/kits/team-view-sync-complete-e2e/team-view-sync-complete-e2e.mjs
```

当前已有：

```text
test-use HEAD
test-use porcelain
worktree branch
worktree HEAD
dist existence
ports
```

新增：

```ts
const wtPorcelain =
  gitIn(WORKTREE, ['status', '--porcelain'])
```

C0 增加硬 gate：

```ts
wtPorcelain.status === 0 &&
wtPorcelain.out === ''
```

preflight evidence 写：

```json
{
  "worktreeHead": "...",
  "worktreePorcelain": ""
}
```

summary 同样记录：

```json
{
  "worktreeHead": "...",
  "worktreePorcelain": ""
}
```

---

# 15. Browser smoke 也绑定 commit

`browser-smoke-host.mjs` 建议至少记录：

```text
worktreeHead
worktreePorcelain
client bundle size/hash
```

其中：

```text
worktreePorcelain == ""
```

必须作为最终 evidence 的 hard gate。

---

# 16. 最终验证的正确顺序

不要再：

```text
先跑最终 E2E
后 commit
```

推荐：

```text
1. 修改源码
2. targeted tests
3. full client/runtime/remote tests
4. typecheck/build
5. dist/client bundle 重建
6. artifact check
7. commit code
8. git status --porcelain == ""
9. 在这个 clean code commit 上跑最终 E2E/browser smoke
10. 最后再提交 evidence/docs
```

如果最后 evidence/docs 单独产生一个 commit，应明确记录：

```text
testedCodeHead = <code commit>
evidenceCommit = <docs/evidence commit>
```

只要 evidence commit 不修改 executable code，就可以接受测试绑定前一个 code commit。

---

# 17. 最终需要重跑的门禁

至少：

```bash
pnpm --filter @dsh-agent-team/client test
pnpm --filter @dsh-agent-team/runtime test
pnpm --filter @dsh-agent-team/remote test

pnpm typecheck
pnpm build

node scripts/place-dist-glue.mjs
node scripts/build-client-composition.mjs   packages/client   packages/client/composition-shim

pnpm check:artifacts
```

然后：

```bash
git status --porcelain
# 必须为空
```

再运行：

```bash
node tests/kits/team-view-sync-complete-e2e/team-view-sync-complete-e2e.mjs
```

以及 served-bundle browser smoke。

---

# 18. 最终行为回归

必须继续保持：

```text
E1 cold member:
  child first-open
  -> getReadState(child)
  -> team-member
  -> getProjection(root)

E2 ordinary:
  -> readState none
  -> zero getProjection(ordinary)
  -> definitive no-team UI

E5 manual:
  -> forced read-state
  -> explicit ledger refresh

E6:
  Team A inst-leader resident
  Team B inst-leader cold
  no cross-talk

E7:
  authoritative no-team UI

E9:
  same-snapshot
  snapshotCalls == 1
```

新增：

```text
E10 / coordinator deterministic gate:
cold bootstrap belongs to the same SessionEntry/single-flight lane
as subsequent attached triggers.
```

---

# 19. 不要改动已经正确的部分

本轮不要重构：

- `LiveResidencyOverlayPort.snapshot(teamSessionId)`；
- `computeLiveTokenFromProjectedMembers()`；
- v6 same-snapshot projection semantics；
- lightweight read-state liveToken path；
- TeamView `viewMode`；
- read-state fail-closed；
- projection-store request ordering；
- manual ledger semantics；
- connection restore coordinator；
- artifact-read-granted mapping；
- compatibility per-root resolver；
- TeamDomain schema；
- DSH upstream。

---

# 20. Merge exit criteria

再次提交 review 前全部满足：

- [ ] unattached cold trigger 不再使用永久 `() => true` guard；
- [ ] cold trigger 创建真实 per-session coordinator entry；
- [ ] later attach 复用 cold transient entry；
- [ ] cold + attached trigger 保持同一 single-flight lane；
- [ ] detach invalidates in-flight cold round；
- [ ] detach→reattach 后 old cold round不能写 read-state；
- [ ] old cold round不能发 stale conditional projection pull；
- [ ] current E3 的“late cold round may land”语义删除；
- [ ] COLD-E1/E2/E3 tests PASS；
- [ ] existing coordinator ordering tests继续 PASS；
- [ ] E1/E2/E5/E6/E7/E9保持 PASS；
- [ ] spill E2E PASS；
- [ ] final E2E 运行时 worktree clean；
- [ ] evidence 记录 exact tested code commit；
- [ ] typecheck/build/artifact check green；
- [ ] upstream/test-use pristine；
- [ ] PR body 更新到最终 head/commit count。

---

# 21. 只有这些情况才暂停请求人工决策

1. 统一 cold-bootstrap 与 attached coordinator lane 必须改变 Remote contract；
2. 必须修改 DSH upstream；
3. 必须修改 TeamDomain schema；
4. transient SessionEntry 无法在当前 public client lifecycle 中安全清理；
5. 修复 race 必须破坏 mutation exactly-once 或 projection generation authority。

除此之外，工程细节由 agent 自主完成，不需要等待人工确认。

---

# 22. 最终目标

修复后：

```text
                 ONE SESSION SCOPE
                       │
     ┌─────────────────┼─────────────────┐
     │                 │                 │
 cold bootstrap       tick             manual
     │                 │                 │
 mutation            resume       connection restore
     └─────────────────┼─────────────────┘
                       ↓
                SessionEntry(epoch)
                       ↓
                  single-flight
                       ↓
              readState → compare
                       ↓
             conditional projection
```

不再存在第二条：

```text
unattached naked runRound
```

也不再存在：

```text
late old cold authority
```

这样 Phase 2 的 ownership authority、freshness pair 与 coordinator 生命周期才形成完整闭环。
