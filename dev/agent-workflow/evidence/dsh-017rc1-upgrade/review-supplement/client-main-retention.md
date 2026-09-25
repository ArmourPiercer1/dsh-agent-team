# Review-supplement F3 — main-session retention: `retainInfo`-first + churn guard

日期：2026-09-24 · 分支：`task/dsh-017rc1-upgrade`
Guide：`PR29-review-supplement-fix-guide.md` §5–§7（finding F3）
Host pin：`46a7f68b0922371ce7144b668b90e377d8e799f4`（0.1.7-rc.1）

## 1. Finding（review 结论，复述）

主视图的"当前会话"推导（`team-mount-core.ts` 的 open-mode reset 效应）只扫
`sessions.list.byId`（catalog 快照）。在 **catalog 刷新窗口 / 会话代际替换窗口**
（byId 短暂缺行但会话仍 live 并持有 mainView retain），推导得到 `null` →
reset() 把 Team open-mode 标记**误清**（用户看到 Team 模式凭空消失，需重新打开）。
上游 0.1.7 的 client 对同一问题有正确模式（`retainInfo` 优先），本插件未采用。

## 2. 0.1.7 事实（源码核实）

- 上游模式 `packages/client/ui-session/src/client/index.ts:436-459`：
  - `publishMain`：`currentIsMain = currentId !== undefined &&
    (this.sessions.retainInfo(currentId).getSnapshot().retainedBy.mainView ?? 0) > 0`
    —— **先查当前 id 的 retain，再看 catalog**。
  - `nextId = currentIsMain ? currentId : Object.values(byId).find(c =>
    (c.retainedBy.mainView ?? 0) > 0)?.id`。
  - `watchMainRetention(sessionId)`：`if (sessionId === this.mainRetainId) return;`
    —— **churn guard**：同一 id 的重复订阅不重建 watcher。
- `retainInfo(id)` 契约（session-controller client contract）：**同 id 代际稳定的只读
  源；无 live 会话时返回零计数，unknown id 不抛**。→ 对 unknown/换代 id 调用是安全的
  零计数读，不会把"查不到"误当"会话死了"。

## 3. 修复（`packages/client/src/plugin/team-mount-core.ts`）

### 3.1 `resolveCurrentMainSessionId(previousId, sessions)` 取代 `currentMainSessionId(snapshot)`

```ts
// retainInfo 优先（上游模式）：previous id 仍持有 mainView retain → 它就是当前会话，
// 无论 catalog 此刻是否还列着它（刷新/换代窗口）。
if (previousId !== undefined) {
  const retained = sessions.retainInfo(previousId).getSnapshot().retainedBy.mainView ?? 0
  if (retained > 0) return previousId
}
// 回退：catalog 扫描（与上游 nextId 的 byId 扫描同序）。
return Object.values(sessions.list.byId).find(c => (c.retainedBy.mainView ?? 0) > 0)?.id ?? null
```

消费点（全部改走新推导）：
- open-mode reset 效应：`reset()` 内 `current = resolveCurrentMainSessionId(watchedMainId, ctx.sessions)`；
  标记清理 `for (root of [...openModeByRoot.keys()]) if (root !== current) delete`。
- sidebar `currentSessionId: () => resolveCurrentMainSessionId(watchedMainId, ctx.sessions)`。

### 3.2 churn guard（挂载作用域 `let watchedMainId`）

```ts
if (current !== watchedMainId) {
  watchedMainId = current === null ? undefined : current
  disposeWatch?.(); disposeWatch = undefined
  if (current !== null) {
    disposeWatch = ctx.sessions.retainInfo(current).subscribe(() => {
      if (watchedMainId === current) void reset()   // 自校验：过期回调不触发清理
    })
  }
}
```

- 同一 current id 的重复 reset（catalog 抖动、保留计数 1→1 重发）**不重建 watcher**
  （对齐上游 `watchMainRetention` 的 `sessionId === this.mainRetainId → return`）。
- teardown：list 订阅 + retain watcher 双释放，`watchedMainId` 清空。

## 4. 测试（`client-plugin-mount.test.ts`，F3 `describe`，3 例）

fixture 升级：sessions double 增加 `addKnown(id)` / `publishList(snapshot)` /
`setRetainInfo(id, retainedBy)` / `retainInfoSubCount(id)`；per-id retain 状态机
（默认零计数快照 = 契约行为）。

- **R1**（catalog 缺口 + retain live）：root 行 `mainView:1` 发布、retain 1 →
  openTeamMode → 标记 'team'、current 'root'、subCount 1；随后 `publishList({})`
  （catalog 空窗口）→ **current 仍 'root'、标记存活**；同值再发一次 → **subCount 仍 1**
  （churn guard：无 watcher 重建）。
- **R2**（retain 真释放）：catalog 空窗口内标记先存活；`setRetainInfo(root, 0)` →
  current null、标记清、subCount 0（释放路径不被 retainInfo-first 卡住）。
- **R3**（A→B 切换）：A 标记 + subCount(A)=1；`setRetainInfo(A,0)/B,1` +
  `publishList({A:0,B:1})` → current 'B'、A 标记清、B 无标记（未开过 Team）、
  subCount A=0 / B=1（**A 的 watcher 已 dispose，无残留订阅**）。

结果：client 套件 47/47 | 656/656（含本 3 例）。

## 5. 实宿主验证

见 `real-host-smoke.md` H3：0.1.7 宿主 wire 级 `session.retainInfo`（mainView 计数）
+ 普通↔Team 会话切换 / reload / reconnect 无 spurious 模式标记丢失；
client-store 层不变量已由 R1–R3 锁定，H3 覆盖映射 = R1（刷新窗口）/ R2（释放）/
R3（切换）在真实 wire 上的对应观察。
