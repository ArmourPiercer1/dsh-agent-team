# dsh-agent-team Issue #1 修复计划
## `team_delegate` 同步阻塞导致 teammate 无法并行执行

> 适用仓库：`ArmourPiercer1/dsh-agent-team`
>
> Issue：#1 —— `team_delegate` 同步阻塞至成员回合结束，teammate 事实上无法并行执行
>
> 修复定位：**alpha.2 后、alpha.3 前的独立 blocker repair**
>
> 目标：在不破坏现有 sync 行为、不修改 DSH core、不重构 F3 后既有 work execution 三阶段模型的前提下，为 `team_delegate` / `team_follow_up` 增加真正可并发使用的异步执行模式，并提供 durable collect/status 读取能力。

---

# 1. 问题结论

当前行为：

```text
Leader
  ↓
team_delegate(A)
  ↓
等待 A 整个 turn 完成
  ↓
team_delegate(B)
  ↓
等待 B 整个 turn 完成
```

总时长近似：

```text
T ≈ T_A + T_B + ...
```

期望新增 opt-in 异步模式：

```text
team_delegate(A, async=true) ──► admitted receipt
team_delegate(B, async=true) ──► admitted receipt
team_delegate(C, async=true) ──► admitted receipt
                ↓
          A / B / C overlap
                ↓
       team_collect(tokens)
```

总时长近似：

```text
T ≈ max(T_A, T_B, T_C) + orchestration overhead
```

---

# 2. 根因定位

## 2.1 第一阻塞点：runtime facade 同步等待整个 work chain

文件：

```text
packages/runtime/action-router/router.ts
```

当前逻辑：

```ts
const effect = isWorkChainStage(staged) ? await staged.complete() : staged
```

这使 `performAction()` 的返回边界不是“work 已 durable admission”，而是：

```text
admission
→ delivery
→ member 完整 turn
→ settlement
→ memberResult
→ return
```

因此 Leader 的一次 `team_delegate` tool call 会一直占用到成员回合结束。

## 2.2 第二阻塞点：Phase B 等待真实 DSH Agent idle

文件：

```text
packages/runtime/src/plugin/live/agent-bindings.mjs
```

生产 delivery 逻辑：

```ts
handle.agent.followup(message)
await handle.agent.whenIdle()
await sessionPersistence.ensureMaterialized(...)
return readDeliveredWorkTurn(...)
```

这里的 `whenIdle()` 本身**不是 bug**，它仍应作为真实 member turn completion / result observation seam 保留。

问题是 facade 强制同步 await 了包含这一步的 `staged.complete()`。

## 2.3 工具层只是同步 facade 的 lossless projection

文件：

```text
packages/tools/src/tools.ts
```

当前：

```ts
const execute = async () =>
  toExecutedResult(await performRuntimeAction(ctx, request))
```

而 `performRuntimeAction()` 直接调用：

```ts
ctx.options.teamRuntime.performAction(...)
```

所以 tools 层没有独立的异步调度能力，也**不应**在 tools 层绕过 runtime 自建后台任务。

## 2.4 执行层其实已经支持 overlap

文件：

```text
packages/runtime/action-router/work-execution.ts
```

F3 修复后：

```text
Phase A — admission
  持共享 per-team chain
  ↓
release

Phase B — delivery
  不持共享 chain
  ↓
member turn

Phase C — settlement
  重新进入 shared chain
  fresh-read convergence
```

现有代码已明确允许第二个 work unit 在第一个 Phase B 尚未结束时 admission。

**因此不应重构 F3 锁模型。真正缺失的是：Leader 无法在第一条 work chain 完成前拿回控制权。**

---

# 3. 本轮非目标

本轮明确不做：

- 不修改 upstream DSH；
- 不引入 Team SessionEvents / push notification；
- 不做通用 inbox；
- 不做 DAG scheduler；
- 不做 streaming member result；
- 不重构 requestToken replay/resume；
- 不改变现有 `sync` 默认行为；
- 不修改 F3 Phase A/B/C 锁拓扑；
- 不实现 async cancellation API；
- 不引入 alpha.3 dynamic grants；
- 不引入 alpha.4 hard governance；
- 不让 tools 层直接读写 repository / ledger；
- 不为了异步而删除 `whenIdle()`；
- 不强制 remote/client/UI 同轮支持新表面。

---

# 4. 需要冻结的 Contract Change

## CCR-1：默认仍为 sync

```text
execution omitted → sync
```

现有调用：

```text
team_delegate(...)
team_follow_up(...)
```

行为必须和 alpha.2 当前行为保持一致：

```text
wait settlement
→ tool result 直接包含 memberResult
```

## CCR-2：新增 async 模式

```text
team_delegate(..., async=true)
team_follow_up(..., async=true)
```

语义：

```text
Phase A durable admission 成功
→ 后台 detach Phase B/C
→ 立即返回 admission receipt
```

receipt 至少包含：

```text
requestToken
target/member identity
workStatus = admitted
settled = false
```

可以附加已有 Phase A 能稳定提供的：

```text
sequence
fromLifecycle
```

但不得虚构尚未发生的 completion/result 字段。

## CCR-3：async result 通过 collect 读取

async tool result 不直接包含业务最终结果。

新增：

```text
team_collect(requestTokens[])
```

读取 durable work truth。

## CCR-4：async 后台 work 脱离 caller turn AbortSignal

sync：

```text
caller signal → Phase B
```

保持当前取消语义。

async：

```text
receipt 返回后 work ownership 已转移给 Team runtime
```

因此 receipt 返回后 caller turn 的 abort **不得**取消后台 member work。

这是硬契约；否则 async 名存实亡。

---

# 5. 最小代码修改面

主要修改：

```text
packages/runtime/admission/actions.ts
packages/runtime/action-router/router.ts
packages/runtime/action-router/effects.ts
packages/runtime/action-router/work-execution.ts
packages/tools/src/tools.ts
packages/tools/src/types.ts
相关 runtime/tools tests
```

可能少量涉及：

```text
packages/runtime/src/plugin/live/agent-bindings.mjs
```

但只允许做 signal / production glue 必要适配。

原则上不应修改：

```text
operation-permission/**
alpha.3 governance/grants
alpha.4 hard policy
DSH core
UI
```

---

# 6. Step A：给 work action 增加 execution mode

文件：

```text
packages/runtime/admission/actions.ts
```

对：

```text
delegate
follow-up
```

增加可选：

```ts
execution?: 'sync' | 'async'
```

规范化：

```text
undefined → sync
```

其它值必须 fail closed。

不要给无关 read/control action 添加此字段。

---

# 7. Step B：扩展 `WorkChainStage`

当前：

```ts
export interface WorkChainStage {
  readonly complete: () => Promise<RuntimeActionEffect>
}
```

async router 需要在不等待 `complete()` 的情况下返回 Phase A 数据，因此改为类似：

```ts
export interface WorkChainStage {
  readonly admission: WorkAdmissionReceiptData
  readonly complete: (...) => Promise<RuntimeActionEffect>
}
```

`admission` 必须：

- 来自已经成功提交的 Phase A durable truth；
- readonly；
- JSON-safe；
- 不依赖 Phase B/C；
- 不包含未发生的 result。

建议最小字段：

```ts
interface WorkAdmissionReceiptData {
  requestToken: string
  instanceId: string
  sequence?: number
  fromLifecycle?: string
}
```

必须检查两个 staging 点都携带 admission 数据：

```text
stageWorkChainOn(...)
runDelegate(...)
```

保证：

- create-new-member delegate 支持 async；
- existing-member delegate 支持 async；
- follow-up 支持 async。

---

# 8. Step C：router 增加 sync / async 分流

文件：

```text
packages/runtime/action-router/router.ts
```

目标结构：

```ts
if (!isWorkChainStage(staged)) {
  effect = staged
} else if (execution === 'async') {
  detachWorkCompletion(staged)
  effect = toAdmissionEffect(staged.admission)
} else {
  effect = await staged.complete()
}
```

## 8.1 sync 路径

必须保持 alpha.2 当前语义。

## 8.2 async 路径

顺序必须是：

```text
Phase A durable admission already complete
→ create detached completion
→ immediate admission receipt
```

禁止：

```text
return receipt
→ later attempt Phase A
```

因为这会产生指向不存在 work 的假 receipt。

---

# 9. Step D：detached completion 的正确实现

不要只做：

```ts
void staged.complete()
```

而不观察 rejection。

至少需要：

```ts
const task = staged.complete(/* detached signal semantics */)
track(task)

void task
  .catch(error => observeDetachedFailure(error))
  .finally(() => untrack(task))
```

要求：

- 无 unhandled rejection；
- 不重复 settlement；
- 不自行 retry；
- 不产生第二套 authority；
- 只负责后台任务 ownership / observability。

建议 runtime 内部维护最小：

```text
Set<Promise<unknown>> inFlightDetachedWork
```

这个 Set **不是结果 authority**，只用于：

- 观察后台 Promise；
- cleanup；
- dispose 时知道是否仍有 detached work。

---

# 10. Step E：async signal ownership

这是 P0 级实现细节。

当前：

```text
ctx.signal
→ TeamRuntime request.signal
→ workDelivery.deliver(signal)
```

sync 保持。

async 必须满足：

```text
Phase A 前/中可以尊重 caller signal
```

但一旦 durable admission 完成并返回 receipt：

```text
Phase B/C 不能继续依赖 caller AbortSignal
```

实现上可以：

- `WorkChainStage.complete` 接受 completion signal；
- 或 staging 时分离 sync signal 与 detached signal；
- 或 async continuation 显式使用 `undefined` / runtime-owned signal。

具体类型形状由 agent 选择，但行为测试必须冻结。

---

# 11. Step F：`memberResult` 必须 durable

这是异步化最重要的数据面改动。

当前最终 `memberResult` 主要通过：

```text
WorkDeliveryPort result
→ WorkChainResult
→ mapWorkChainEffect
→ 当前等待中的 tool result
```

async 返回后，没有 caller 等待这个内存结果。

因此 settlement fact 必须持久化最终 result。

文件：

```text
packages/runtime/action-router/work-execution.ts
```

在现有 `settleFactPayload` 中增加：

```ts
memberResult?: WorkDeliveryResult
```

保持现有 WorkDeliveryResult 结构，不创建第二套结果 schema。

当前稳定结果：

```text
succeeded
failed
unavailable
```

应 lossless 落入 settlement fact。

---

# 12. Replay / resume 语义必须保持

## replay

现有：

```text
settlement fact already exists
→ zero delivery
→ zero write
→ synthetic WORK_REPLAYED unavailable
```

本轮不改变。

## resume

现有：

```text
admission exists
settlement absent
→ no re-admission
→ redelivery
→ settlement
```

本轮不改变。

## historical settlement compatibility

升级前的旧 settlement fact 没有 `memberResult`。

`team_collect` 遇到此类事实时：

```text
MUST NOT throw
MUST NOT re-deliver
MUST NOT fake success
```

返回稳定兼容结果，例如：

```text
status: unavailable
error.code: WORK_RESULT_NOT_PERSISTED
```

具体 code 可按项目命名规范调整，但必须稳定并测试。

---

# 13. Step G：新增 runtime read action `work-status`

新增 read-only action：

```text
work-status
```

要求：

```text
category: READ
```

输入建议：

```ts
requestTokens: string[]
```

走统一 TeamRuntime facade。

禁止：

```text
tools → repository direct read
```

## 13.1 projection

### running

存在 admission fact，但无 settlement：

```json
{
  "requestToken": "...",
  "status": "running"
}
```

### succeeded

settlement 中：

```text
memberResult.status = succeeded
```

返回 durable memberResult。

### failed

返回 durable failed result。

### unavailable

包括：

- historical settlement 无 memberResult；
- WorkDeliveryResult 自身为 unavailable；
- unknown/not-readable token（按现有错误风格选 stable code）。

本轮不需要拆分：

```text
queued / delivering / thinking / tooling / settling
```

最小 `running + terminal` 即可。

---

# 14. `team_collect` 必须是 pure read

新增工具：

```text
team_collect
```

输入：

```ts
requestTokens: string[]
```

建议：

- 至少 1 个；
- max 32 或 64；
- token 去重；
- 保持确定性输出顺序；
- 复用 requestToken 校验规则。

输出例如：

```json
{
  "items": [
    {
      "requestToken": "A",
      "status": "running"
    },
    {
      "requestToken": "B",
      "status": "succeeded",
      "memberResult": { "status": "succeeded", "...": "..." }
    }
  ]
}
```

**禁止 `team_collect` 自动 resume / redeliver。**

否则 read action 会变成 effectful command。

可以返回非 authority hint，例如：

```text
resumePossible: true
```

但不得主动执行。

---

# 15. Step H：tools 增加 async 参数

文件：

```text
packages/tools/src/tools.ts
```

对：

```text
team_delegate
team_follow_up
```

增加：

```ts
async?: boolean
```

映射：

```text
true  → execution='async'
false → execution='sync'
omit  → execution='sync'
```

不建议把 `execution: string` 直接暴露给模型，bool 更稳定。

---

# 16. Tool descriptions 必须教会模型正确并发使用

`team_delegate` description 至少说明：

```text
Use async=true when starting multiple teammates in parallel.
The call returns after durable admission, not after teammate completion.
Use team_collect with returned requestToken(s) to retrieve results.
```

`team_follow_up` 同理。

`team_collect` 说明：

```text
Reads current durable status/result only; it does not resume or re-run work.
```

---

# 17. requestToken 继续作为唯一 work identity

不要引入新的：

```text
jobId
taskId
receiptId
executionId
```

现有 `requestToken` 已经承担：

- durable logical operation identity；
- replay/resume dedup；
- model-visible delivery token。

async receipt 与 collect 直接沿用它。

---

# 18. 同一 member 的并发边界

主验收场景：

```text
不同 member instance 并行
```

这个必须支持。

但同一 child session 同时多次 `followup` 的真实 DSH 行为需要独立实测。

本轮必须形成一个明确结论：

## 若 upstream 正确排队

冻结为：

```text
同一 member 可接受多个 async work，但实际 turn 可串行排队。
```

## 若存在 result association / interleave 风险

则本轮增加最小限制：

```text
same member only one in-flight async work
```

并返回明确 typed error / status。

**禁止在没有 live probe 的情况下宣称同一 member 并发安全。**

---

# 19. Root initial work 不要混入本轮 collect

已有：

```text
targetKind: root
```

由 root initial-work 路径负责。

本轮 collect 默认只处理 member work token。

如果 token 属于 root work：

- 返回 unsupported/not-member-work；或
- 延续现有 scan skip 语义。

不要借此扩大范围。

---

# 20. RED-first 要求

修改前必须先建立能证明旧设计问题的 RED probe。

## RED-1：Leader 无法在 A 完成前 admission B

使用受控 fake WorkDeliveryPort：

```text
A delivery 阻塞 X 秒
B delivery 阻塞 X 秒
```

旧 sync facade 应表现为：

```text
first delegate 不返回
→ caller 无法继续 second delegate
```

至少用以下之一证明：

```text
B admission/delivery start > A completion
```

或：

```text
first tool promise remains unresolved until A completion
```

RED evidence 必须保存。

---

# 21. GREEN 并发核心探针

修复后：

```text
delegate(A, async=true)
→ receipt before A completion

delegate(B, async=true)
→ receipt before A completion
```

断言：

```text
t_B_admitted < t_A_completed
```

对于不同 member：

```text
maxConcurrentDelivery >= 2
```

这是 Issue #1 最核心的 GREEN。

---

# 22. 必须测试的 probe 矩阵

| Probe | Expected |
|---|---|
| sync delegate default | 当前 alpha.2 行为不变 |
| sync follow-up default | 当前行为不变 |
| async delegate/new member | admission 后立即 receipt |
| async delegate/existing member | admission 后立即 receipt |
| async follow-up | admission 后立即 receipt |
| two different members async | delivery overlap |
| collect immediately | running |
| collect after success | succeeded + business body |
| collect after normalized member failure | failed |
| historical settlement without memberResult | unavailable, no throw |
| async caller abort after receipt | work continues |
| sync caller abort | 旧 cancel/fail-closed 语义 |
| replay | unchanged |
| resume | unchanged |
| invalid execution mode | reject |
| detached completion rejects | observed, no unhandled rejection |
| collect | zero write / zero delivery |
| duplicate collect tokens | deterministic |
| unknown token | stable unavailable/not-found |
| root-work token | no accidental member projection |

---

# 23. Sync compatibility probes

省略 async：

```text
team_delegate(...)
```

必须：

- 等待 settlement；
- 同一个 tool result 中仍有 memberResult；
- caller AbortSignal 传播语义不变；
- requestToken replay/resume 不变；
- 现有 v2 D2 tests 不应被“为了 async”改写成新期望。

---

# 24. Async signal isolation probe

流程：

```text
start async delegate
await admission receipt
callerAbortController.abort()
```

断言：

```text
member delivery NOT cancelled
background work eventually settles
team_collect returns terminal result
```

对比 sync：

```text
start sync delegate
abort caller signal
```

仍保持现有取消 / fail-closed settlement 行为。

---

# 25. Durable result probes

## success

member 返回：

```text
RESULT-A
```

后台完成后：

```text
team_collect(token)
```

必须从 durable settlement truth 读出同一业务结果。

## failure

normalized failure code/message 必须保持。

## historical compatibility

旧 settlement 无 `memberResult`：

```text
collect → unavailable
```

并且：

```text
zero delivery
zero write
```

---

# 26. Crash / restart 语义

如果：

```text
async Phase A admitted
→ process crashes before settlement
```

durable state为：

```text
admission exists
settlement absent
```

`team_collect` 只读时应表现为：

```text
running / incomplete
```

不要自动 retry。

随后相同 requestToken 的 delegate/follow-up retry 仍进入已有 resume path。

---

# 27. Lifecycle / dispose 要求

至少检查：

```text
fresh root
fresh member
cold root
cold member
```

以及 detached task bookkeeping。

推荐最小原则：

```text
normal runtime dispose 不主动把“已 durable admitted”的 async work 当作 caller-turn child 取消
```

若 host shutdown 本身终止 agent，则依赖已有 fail-closed/recovery semantics。

本轮不需要实现无限等待 shutdown drain，但 closure report 必须明确：

- dispose 时 in-flight task 如何处理；
- 是否可能 silent orphan；
- restart 后如何通过现有 resume 恢复。

如果存在：

```text
已返回 receipt
但既无最终 settlement、也无法 resume
```

则属于 blocker，不能关闭 issue。

---

# 28. Permission hardening 交互

本轮不要把 async delegation 变成 alpha.3 permission feature。

但必须跑集成回归：

```text
alpha.2 permissions enabled
+ async member work
```

确认：

- AgentSetup permission listener/guard 生命周期正常；
- 后台 work 不因 caller permission listener dispose 而异常；
- managed builtin tool permission 行为不回退。

---

# 29. Live-host 最终验收

真实 DSH host 至少执行：

```text
Leader:
1. async delegate member A，任务约 20s
2. async delegate member B，任务约 20s
3. 在 A/B 未完成时继续调用其它工具或 collect
4. 稍后 collect A/B
```

记录：

```text
t_A_admitted
t_B_admitted
t_A_done
t_B_done
```

硬条件：

```text
t_B_admitted < t_A_done
```

最好进一步证明：

```text
A/B execution intervals overlap
```

以及：

> Leader 在第一个 teammate 尚未结束时，确实已经拿回模型控制权并能发起第二个 tool call。

这比单纯测 Promise 时间更重要。

---

# 30. 不允许的伪修复

## A. tools 层 `setTimeout` / `queueMicrotask` 绕过 runtime

拒绝。

## B. async 提前返回但 memberResult 不落盘

拒绝。

## C. 删除 `whenIdle()` 让 settlement 提前

拒绝。

## D. admission 未 durable 就返回 receipt

拒绝。

## E. collect 自动执行 retry/resume

拒绝。

## F. 默认 sync 改成默认 async

拒绝。

## G. 用内存 Promise map 作为唯一 result source

拒绝。durable settlement fact 必须是 authority。

---

# 31. 建议任务拆分

## R1 — Contract freeze + RED

输出：

- root-cause note；
- sync/async contract；
- signal ownership；
- durable result contract；
- RED proof。

## R2 — WorkChainStage admission receipt

修改：

```text
effects.ts
work staging paths
```

## R3 — Router detach

修改：

```text
router.ts
```

完成：

```text
sync unchanged
async immediate durable receipt
background observed completion
```

## R4 — Durable memberResult

修改：

```text
work-execution.ts
```

完成：

```text
settlement fact result persistence
historical compatibility
```

## R5 — work-status runtime read action

完成：

```text
requestTokens → running / terminal
```

## R6 — Team tools

完成：

```text
team_delegate(async?)
team_follow_up(async?)
team_collect
```

## R7 — Signal/lifecycle closure

验证：

```text
sync abort
async signal isolation
background rejection
dispose
cold resume
```

## R8 — Live concurrency verification

真实 DSH host 做最终产品验收。

---

# 32. DoD

## Contract

- [ ] `sync` / `async` 语义已冻结。
- [ ] 默认 `sync`。
- [ ] sync tool result 保留 memberResult。
- [ ] async tool result 是 admission receipt。
- [ ] async signal ownership 已冻结。
- [ ] `team_collect` 为 pure read。

## Runtime

- [ ] WorkChainStage 暴露 Phase A durable admission 数据。
- [ ] async 只在 Phase A 成功后返回 receipt。
- [ ] detached `complete()` 有可靠 rejection observation。
- [ ] 无 unhandled rejection。
- [ ] Phase B/C 使用原算法。
- [ ] requestToken replay/resume 保持。
- [ ] memberResult durable 写入 settlement。
- [ ] historical facts 兼容。

## Tools

- [ ] `team_delegate(async=true)`。
- [ ] `team_follow_up(async=true)`。
- [ ] `team_collect(requestTokens)`。
- [ ] descriptions 明确并发工作流。
- [ ] tools 层无 repository direct access。

## Concurrency

- [ ] 不同 member 的 async work 可 overlap。
- [ ] Leader 可在 A 未完成时 delegate B。
- [ ] Leader 可在后台 work 存在时继续其它 tool call。
- [ ] collect 最终读到正确业务结果。

## Signals

- [ ] sync abort 行为不变。
- [ ] async receipt 后 caller abort 不取消后台 work。
- [ ] delivery fault 仍 fail closed。

## Regression

- [ ] F3 INV-9.1 / overlap tests PASS。
- [ ] v2 D2 sync result tests PASS。
- [ ] replay/resume tests PASS。
- [ ] alpha.1 capability tests PASS。
- [ ] alpha.2 permission tests PASS。
- [ ] legacy tests PASS。
- [ ] typecheck PASS。
- [ ] build PASS。
- [ ] live-host concurrency PASS。
- [ ] CORE PATCH BUDGET = 0。

---

# 33. Closure report 模板

本地 agent 完成后提交：

```markdown
# Issue #1 async delegation closure report

## 1. Baseline
- base commit:
- final commit:
- upstream DSH pin:

## 2. Root cause
- facade blocking point:
- delivery blocking point:
- why execution layer already supports overlap:

## 3. Contract change
- sync:
- async:
- collect:
- signal ownership:

## 4. Implementation
### WorkChainStage
### Router detach
### Durable memberResult
### Work-status
### Team tools

## 5. RED proof
- old behavior:
- evidence:

## 6. GREEN concurrency proof
- A admission:
- B admission:
- A finish:
- B finish:
- overlap:

## 7. Collect
- running:
- succeeded:
- failed:
- historical unavailable:

## 8. Signal tests
- sync abort:
- async abort after receipt:

## 9. Replay / resume
- replay:
- resume:

## 10. Lifecycle
- fresh:
- cold resume:
- dispose:
- detached cleanup:

## 11. Regression gates
- runtime:
- tools:
- F3:
- v2 D2:
- alpha.1:
- alpha.2 permission:
- legacy:
- typecheck:
- build:
- live-host:

## 12. Scope compliance
- DSH core patch: NO
- alpha.3 grants: NO
- alpha.4 governance: NO
- push events: NO
- generic scheduler: NO

## 13. Remaining risks
- same-member concurrent followup:
- shutdown in-flight behavior:
- polling UX:

## 14. Verdict
- Issue #1 closed: YES / NO
- Ready for next blocker: YES / NO
- Ready for alpha.3 after all blockers: YES / NO
```

---

# 34. 最终验收定义

Issue #1 只有在以下事实成立时才算关闭：

```text
Leader 调用 team_delegate(async=true) 后，
无需等待该 teammate 完成 turn，
即可获得 durable admission receipt，
继续调用第二个 team_delegate，
并让多个不同 teammate 真正重叠执行；
最终结果可基于 restart-safe durable truth
通过 team_collect 读取。
```

如果只做到：

```text
“工具看起来更快返回”
```

但没有：

```text
durable admission
durable result
collect
signal isolation
真实 overlap
```

则不得关闭 Issue #1。
