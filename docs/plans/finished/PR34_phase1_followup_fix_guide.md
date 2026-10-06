# PR #34 补充修复指导（Phase 1 收口）

> 仓库：`ArmourPiercer1/dsh-agent-team`  
> PR：`#34 fix: restore team projections and make refresh failures visible`  
> 当前 head：`606d32ab49e965ace900778cdba8d156a580f7b4`  
> base：`4a67f6ed870bed19a0d7f4dadac094f33d1009c8`  
> 本文目标：**不推翻 PR #34 已完成的 Phase 1 架构，只补齐两处并发/lifetime 正确性问题，使 PR 达到可合并状态。**

---

## 0. 结论与工作边界

PR #34 的主体修复方向是正确的，以下内容应保持不变，不要重构或扩大 scope：

1. `artifact-read-granted` 进入既有 `control` 统计类别；
2. grant 不建立 `ControlRequest` / `ControlDecision` chain、不增加 pending；
3. Events 层继续通过 `INTERNAL_FACT_TYPES` 隐藏 grant；
4. compatibility `get/reprobe/ack` 按被寻址 TeamSession 使用 per-root prober；
5. TeamView 能看到完整 projection store 状态；
6. 无帧读取失败不再显示肯定式“当前会话未加入任何团队”；
7. 有旧帧时读取失败保留旧内容并显示 stale/error banner；
8. 独立“刷新团队视图”按钮继续保留；
9. agent/tool 自动失效检测仍属于 Phase 2，不在本轮实现。

本轮只处理以下两个问题：

- **F1（必须修）**：较旧请求的 typed RPC error / foreign / inconsistent / duplicate / stale 仍可能在较新的请求完成后覆盖最新 UI liveness/error 状态。
- **F2（应在本 PR 修）**：TeamView 手动 refresh 的 `refreshEpoch` 没有在 session switch / unmount 时失效，旧 session 的 refresh 可能在切换后继续执行 ledger refresh 或修改 pending 状态。

目标工作量：**局部补丁，预计 30–90 分钟代码 + 测试；不要另起 Phase 2 架构。**

---

# 1. F1：projection store 的 request ordering 仍不完整

## 1.1 当前缺陷

文件：

- `packages/client/src/state/team-projection-store.ts`

PR #34 当前已经正确处理：

```ts
// earlier request transport-loss arrives after a later valid round trip
if (lastCompletedSeq > seq) return assessment
```

因此旧的 transport loss 不会覆盖更新结果。

但是普通 RPC response 路径当前是：

```ts
const assessment = assessProjectionSync(appliedIdentity(), response)
noteRoundTrip(seq)
if (epoch !== epochAtStart) return assessment

if (response.ok === false) {
  publish({
    ...state,
    status: 'error',
    lastError: response.error,
    lastAssessment: assessment,
    ...
  })
  return assessment
}
```

这里没有判断该 response 是否已经被一个**后启动、先完成**的请求 supersede。

### 可复现错误时序 A：旧 typed error 覆盖新成功

```text
pull A: seq=1  开始
pull B: seq=2  开始

B 先返回成功 gen=10
→ store = ready / gen10

A 后返回 typed internal-error
→ 当前代码仍 publish(error)
→ store = error / frame 仍 gen10
→ UI 错误显示“更新失败，当前显示上次成功的数据”
```

A 的 failure 已经不是“最新一次读取”的结果，不应把 B 的成功状态重新降级为 error。

### 可复现错误时序 B：旧 duplicate/stale 清掉新 failure

```text
已有 frame gen=10

pull A: seq=1  开始，最终会返回正常 gen=10（duplicate）
pull B: seq=2  开始

B 先返回 typed error
→ store = error / frame gen10

A 后返回 duplicate
→ 当前 duplicate 分支会 status=ready + clear lastError
→ 新请求 B 的 failure 被较旧请求 A 隐藏
```

同理，较旧的 `foreign` / `inconsistent` response 也不应在更新请求已完成后把最新状态降级。

---

## 1.2 正确语义：frame authority 与 liveness authority 分离

不要简单写成：

```ts
if (lastCompletedSeq > seq) return assessment
```

并放在所有 response 处理之前。

这样会错误阻止一种合法情况：**较旧请求虽然开始得早，但返回了 generation 更高的 authoritative frame**。

例如：

```text
A seq1 开始
B seq2 开始
B 先返回 typed error
A 后返回正确 team 的 gen=11
```

如果当前 applied generation 是 10，A 的 gen=11 仍然应该由 generation verdict 决定并被应用。

因此必须拆分两个问题：

### Frame authority

继续由现有：

```ts
assessProjectionSync(appliedIdentity(), response)
```

及 generation verdict 决定。

- `apply`：可以应用 authoritative frame；
- `duplicate/stale`：不修改 frame；
- `foreign/inconsistent`：不应用 frame。

### UI liveness/error authority

由 request completion ordering 决定：

- 如果一个 response 对应的请求 `seq` 已经被更大的 `lastCompletedSeq` supersede；
- 且该 response **没有产生 `apply` frame**；
- 则它不能修改 `status`、`lastError`、`lastAssessment`、retry/error surface。

---

## 1.3 建议实现方式

在 response 路径中，在更新 `lastCompletedSeq` 之前记录是否已过时：

```ts
const assessment = assessProjectionSync(appliedIdentity(), response)
const supersededByNewerRoundTrip = lastCompletedSeq > seq
noteRoundTrip(seq)

if (epoch !== epochAtStart) return assessment
```

然后按下面顺序处理。

### A. typed RPC error

当前：

```ts
if (response.ok === false) {
  publish(...error...)
  return assessment
}
```

修改为：

```ts
if (response.ok === false) {
  if (supersededByNewerRoundTrip) return assessment

  publish({
    ...state,
    teamSessionId,
    status: 'error',
    lastError: response.error,
    lastAssessment: assessment,
    retryAttempt: 0,
    nextRetryDelayMs: null,
  })
  return assessment
}
```

### B. `apply`

**不要因为 superseded 直接跳过。**

仍然走现有 frame extraction + generation-safe apply：

```ts
if (isApplyAssessment(assessment)) {
  // keep current logic
}
```

原因：generation 才是 authoritative frame freshness。

### C. non-apply normal/anomaly verdict

在进入：

```ts
if (assessment.status === 'duplicate' || assessment.status === 'stale') {
  ...
} else {
  ... foreign/inconsistent ...
}
```

之前增加：

```ts
if (supersededByNewerRoundTrip) return assessment
```

即：

- old duplicate 不清除 newer error；
- old stale 不清除 newer error；
- old foreign 不覆盖 newer success；
- old inconsistent 不覆盖 newer success。

### D. `noteRoundTrip(seq)` 仍然执行

不要因为 superseded 就完全跳过 `noteRoundTrip(seq)`。

它仍然是一个真实完成的 round trip，需要保留现有：

- loss episode absorption；
- pending retry cancellation / sequence baseline；
- `lastCompletedSeq` monotonic。

只是该旧 response 不再拥有“最新 UI status”的写权限。

---

## 1.4 F1 必补测试

文件：

- `packages/client/test/team-projection-store.test.ts`

在现有：

```text
an earlier request fails LATE after a later request succeeded
```

transport-loss 测试旁边新增以下场景。

### F1-T1：old typed error after newer success

时序：

```text
A seq1 pending
B seq2 pending
B → projectionSuccess(team, gen2)
A → projectionError('TEAM_REMOTE_INTERNAL_ERROR', ...)
```

断言：

```ts
final.status === 'ready'
final.appliedGeneration === 2
final.frame.projection.generation === 2
final.lastError === undefined
```

并确认 A 的 assessment 仍可 resolve 为 `rpc-error`，只是**不 publish 成最新 store 状态**。

### F1-T2：old foreign/inconsistent after newer success

至少覆盖一种；建议两种都覆盖。

可构造：

- A 开始较早；
- B later request 成功并应用 gen2；
- A 最后返回 foreign-team frame 或 provenance mismatch。

断言最终仍：

```ts
status === 'ready'
appliedGeneration === 2
```

不能被旧 anomaly 降为 error。

### F1-T3：old duplicate after newer typed error

准备已有 frame gen2：

```text
initial pull → gen2 applied
A seq2 开始，返回 gen2，但延迟（最终 assessment duplicate）
B seq3 开始，先返回 typed RPC error
A 最后返回 gen2 duplicate
```

断言最终：

```ts
status === 'error'
lastError.code === <B 的 typed error code>
frame 仍是 gen2
```

旧 duplicate 不能清除 B 的 error。

### F1-T4：old stale after newer typed error

同上，但 A 最后返回 `< applied generation` 的合法 frame，assessment=`stale`。

断言 B 的最新 error 仍然保留。

> 如果为了控制工作量，T3/T4 可以参数化为 duplicate/stale 两个 case。

---

# 2. F2：TeamView 手动 refresh lifetime 没有真正绑定 session/unmount

## 2.1 当前缺陷

文件：

- `packages/client/src/ui/TeamView.tsx`

当前逻辑：

```ts
const refreshEpoch = useRef(0)

const runRefresh = useCallback(() => {
  ...
  refreshEpoch.current += 1
  const epoch = refreshEpoch.current
  setRefreshPending(true)
  ...
  if (refreshEpoch.current !== epoch) return
  ...
}, [...])
```

代码注释声称：

```text
newer refresh / unmount / session switch 会使旧请求失效
```

但当前整个文件中 `refreshEpoch.current` 只在 `runRefresh()` 自己内部推进。

因此：

```text
Team A 点击刷新
→ pull A pending
→ 用户切到 Team B
→ A pull 返回
→ refreshEpoch 仍等于 A 捕获的 epoch
→ 继续执行旧 refreshTeamLedger()
→ finally 还可能修改 refreshPending
```

这不会直接破坏 durable Team 数据，但会造成：

- 已离开的 Team 多做一次 ledger read；
- 新 session 的 UI pending 状态可能被旧 task 干扰；
- 与注释和 Phase 1 “迟到响应不污染新视图”的目标不一致。

---

## 2.2 建议实现

在 `TeamView` 中，让 `refreshEpoch` 的生命周期真正跟随 `sessionId` / unmount。

推荐局部修法：

```ts
const refreshEpoch = useRef(0)

useEffect(() => {
  // entering a new session invalidates every refresh started in the old scope
  refreshEpoch.current += 1
  setRefreshPending(false)

  return () => {
    // unmount / sessionId change cleanup invalidates in-flight refreshes
    refreshEpoch.current += 1
  }
}, [sessionId])
```

注意：

1. cleanup 中不要调用 `setState`；
2. 新 session effect body 可以清 `refreshPending`；
3. React StrictMode simulated unmount/remount 下 epoch 多加一次没问题，epoch 只要求 monotonic；
4. `loadRoots()` 是 global persisted roots read，本身已有自己的 `rootsEpoch` / unmount guard，不需要把它强行绑定到 Team session；
5. 这里需要失效的是 **projection → ledger refresh continuation 和 local refreshPending lane**。

也可以采用等价的 mounted/session token ref，但必须满足相同语义。

---

## 2.3 F2 必补测试

文件：

- `packages/client/test/team-view.client.spec.tsx`

### F2-T1：session switch invalidates old refresh

构造 deferred projection pull：

```text
render Team A (with frame)
click refresh
A pull pending
rerender TeamView as Team B/session B
resolve A pull as apply
```

断言：

- A 的旧 continuation **不得**调用旧 `refreshTeamLedger`；
- B 的 refresh button 不应保持 disabled；
- B 页面不出现由 A refresh settle 引起的 stale UI update。

建议测试结构：

```ts
const refreshLedgerA = vi.fn(...)
const refreshLedgerB = vi.fn(...)

// render A
// click refresh
// rerender B
// settle A

expect(refreshLedgerA).not.toHaveBeenCalled()
expect(refreshLedgerB).not.toHaveBeenCalled()
expect(buttonB.disabled).toBe(false)
```

### F2-T2：unmount invalidates old refresh

```text
render Team A
click refresh
pull pending
unmount
resolve pull
```

断言：

- 不调用 `refreshTeamLedger`；
- 不产生未捕获 promise rejection；
- 不依赖 React “setState on unmounted” warning 作为唯一判断。

---

# 3. 不要顺手改动的内容

为避免 Phase 1 再次扩大，以下内容本 PR 不做：

1. 不实现 D4-A2 agent/tool mutation 自动刷新；
2. 不引入 v6 `getReadState`；
3. 不做 authoritative session ownership resolver；
4. 不新增 durable/live 双 revision；
5. 不重构 `artifact-read-granted → control` 语义；
6. 不修改 compatibility per-root prober 的总体设计；
7. 不修改 DSH upstream；CORE PATCH BUDGET 仍为 0；
8. 不处理历史“持久团队列表曾缺队”的无法复现时序。

本轮只应修改：

- `packages/client/src/state/team-projection-store.ts`
- `packages/client/test/team-projection-store.test.ts`
- `packages/client/src/ui/TeamView.tsx`
- `packages/client/test/team-view.client.spec.tsx`

如果确有类型/fixture 连带，可做最小必要修改，但应在 PR 描述中说明原因。

---

# 4. 执行顺序建议

## Step 1：先写 failing tests

先在当前 head `606d32ab...` 上补 F1/F2 测试，确认至少以下测试在修复前失败：

- stale typed error after newer success；
- stale duplicate/stale after newer typed error；
- manual refresh session-switch invalidation。

这样证明修的是实际 race，而不是只改注释。

## Step 2：修 `team-projection-store.ts`

实现：

```text
request order 决定 non-apply liveness/error state
         +
generation verdict 决定 frame authority
```

不要改变现有 transport-loss retry/backoff 语义。

## Step 3：修 `TeamView.tsx`

使 refresh lifetime 明确绑定 sessionId/unmount。

不要改变 roots refresh 的 global 语义。

## Step 4：跑 targeted tests

至少：

```bash
pnpm --filter @dsh-agent-team/client test -- team-projection-store.test.ts
pnpm --filter @dsh-agent-team/client test -- team-view.client.spec.tsx
```

如果 Vitest filter 参数在当前 pnpm 透传方式下不稳定，则直接跑完整 client suite：

```bash
pnpm --filter @dsh-agent-team/client test
```

预期：client suite 全绿。

## Step 5：静态与构建门禁

```bash
pnpm typecheck
pnpm build
pnpm build:composition
pnpm check:artifacts
```

`build:composition` 已包含 placement / client bundle / artifact check 的当前仓库流程；如果按现有工程习惯手动分步执行，也必须保证：

- `packages/runtime/dist/**` 与源码同步；
- `packages/client/composition-shim/client-bundle.js` 与源码同步；
- `check:artifacts` 通过。

## Step 6：回归 Phase 1 关键测试

至少再跑：

```bash
pnpm --filter @dsh-agent-team/client test
```

以及 PR #34 已新增/受影响的 runtime 定向套件：

```bash
pnpm test -- packages/runtime/test/team-compatibility-scope.test.ts
pnpm test -- packages/runtime/test/p8s7r2-disposed-history.test.ts
```

如果根 `pnpm test` 仍存在 PR 描述中已记录的 base 既有失败，不要顺手修；但要确认**没有新增失败**。

---

# 5. 浏览器 smoke 建议

本轮不要求重新做整套 9 张截图，但建议补 1 个 race-focused smoke（若容易）：

### 可选 smoke：快速连续刷新/切 session

1. 打开一个正常 Team；
2. 点击“刷新团队视图”；
3. 立即切到另一 session；
4. 等待旧 refresh settle；
5. 确认新 session UI 没有突然出现旧 Team 的 pending/error banner；
6. 返回旧 Team，页面状态仍正常。

如果浏览器环境很难稳定控制 response 延迟，则 unit/UI deferred-promise 测试是主门禁，不必为了 smoke 人工引入复杂代理。

---

# 6. PR 描述需要补充的说明

在 PR #34 描述的验证部分增加一段：

```text
Review follow-up:
- projection-store now separates generation authority from request-order
  liveness authority: a superseded non-apply response cannot overwrite a
  newer success/error state, while a late response carrying a genuinely
  newer authoritative generation may still apply normally;
- manual TeamView refresh is scope-bound to the current session lifetime:
  switching session or unmounting invalidates the old continuation before
  ledger refresh/UI pending settlement.
```

同时列出新增测试名。

不要修改 Phase 1 限制说明：

- agent/tool 自动刷新仍未实现；
- cold member authoritative ownership resolver 仍未实现；
- Phase 2 仍按原计划推进。

---

# 7. 合并退出条件

PR #34 只有在以下全部满足后再请求复审/合并：

- [ ] old typed RPC error after newer success 不再把 store 降成 error；
- [ ] old foreign/inconsistent after newer success 不再污染最新状态；
- [ ] old duplicate/stale after newer typed error 不再清除最新 error；
- [ ] late authoritative `apply` 仍由 generation verdict 正常决定，不能因 request seq 被误丢弃；
- [ ] session switch 后旧 manual refresh 不再触发旧 ledger continuation；
- [ ] unmount 后旧 manual refresh settle 不再继续后续操作；
- [ ] `packages/client` 完整测试全绿；
- [ ] `pnpm typecheck` 通过；
- [ ] build + composition bundle + artifact check 通过；
- [ ] runtime compatibility / disposed-history 定向测试保持通过；
- [ ] 无 upstream 改动；
- [ ] 不扩大到 Phase 2 自动同步设计。

满足以上条件后，PR #34 可作为本次事故 **Phase 1 快速恢复 PR** 重新提交复审。

---

# 8. 给执行 agent 的一句话任务定义

> 在 PR #34 当前 head 上做局部 follow-up：修正 projection store 中“旧 non-apply response 覆盖较新读取状态”的 ordering bug，同时把 TeamView 手动刷新 lifetime 绑定到当前 session/unmount；保留 generation 作为 frame authority、保留现有 Phase 1 H1/H2/UI 架构，补齐 race tests，重建 dist/client bundle 并通过 client + targeted runtime + artifact gates。不要扩展到 Phase 2。
