# dsh-agent-team PR #37–#42 审查问题与修复指导

> 审查对象：pre-Alpha.3 重构栈 PR #37–#42  
> 审查时间：2026-09-29  
> 目标：把当前“模块已基本存在，但若干 authority 尚未端到端闭合”的状态，收敛到可继续进入 PR-F 的 merge-ready 状态。
>
> 本文档不是新的架构设计；除非本文明确指出，否则以此前 Grilling ADR 与目标系统设计为冻结契约。

---

## 0. 当前审查基线与总体判断

本轮审查基于以下 PR heads：

| PR | Head | 作用 |
|---|---|---|
| #37 | `ceefca208f5e0e62dc5beb750ba1bf16754273f8` | PR-0：测试基建 |
| #38 | `aa8391ac1d436deaad355ae7a595be3dd8abe04e` | PR-A：Governance Mutation Authority |
| #39 | `12bb015bd9080278df847c91f3dc726b7af69df8` | PR-B：EffectivePolicy |
| #40 | `b3da27a1a4be9479c82677e9864eee92db44d8f4` | PR-C：Runtime Environment / MCP |
| #41 | `9d637d334232a12ddee7cf466238ddeb971134b1` | PR-D：Control generalization |
| #42 | `cdf1615375f19835fa34485402c1d65bfb4f6c19` | PR-E：Blueprint v2 + Requirement / Recovery |

总体结论：

```text
#37  APPROVE

#38  REQUEST CHANGES
#39  REQUEST CHANGES
#40  HOLD / CONDITIONAL
#41  REQUEST CHANGES + REBASE
#42  REQUEST CHANGES — BLOCKER
```

核心原因不是方向错误，而是若干在 ADR 中已经冻结的安全/一致性契约尚未真正进入 production authority：

- live readiness 与 Requirement gate 尚未闭合；
- persona actual substrate 尚未闭合；
- startup preflight 仍停留在 pure/unit 层；
- Leader template requirement 没有真正 gate Leader execution；
- Recovery dispatch 仍存在 effect 绕过；
- Control abort durable-close 语义仍可被破坏；
- Governance optimistic generation guard 尚不可从 production ingress 使用；
- PolicyState closed-set 仍有 boot Blueprint / bound Blueprint 双 authority。

---

# 1. 问题总表

| ID | 严重度 | 问题 | 主要 PR | 是否阻塞 PR-E |
|---|---:|---|---|---:|
| F1 | P0/P1 | Requirement gate 仍读静态 `config.environmentFacts`，未消费 live readiness/materialization | #40/#42 | **是** |
| F2 | P0/P1 | Recovery abort 的 `abandonControlRequest()` 失败被吞，但仍声称 `abandoned` | #42（根源 #41） | **是** |
| F3 | P1 | `abandonControlRequest()` 错绑 `resolve-control` envelope | #41/#42 | **是** |
| F4 | P1 | persona production observer 对任意 preset 都返回 `standard` | #40/#42 | **是** |
| F5 | P1 | root/member preset 可不同，但只观察 root persona kind | #40/#42 | **是** |
| F6 | P1 | `startupPreflight()` 未接 production Team creation authority | #42 | **是** |
| F7 | P1 | DegradationConsent / template disable 缺少完整 production writer/workflow | #42 | **是** |
| F8 | P1 | Leader-template requirements 没有 gate Leader 的真实 model/request boundary | #42 | **是** |
| F9 | P1 | `team_send_message` 被当作纯 coordination，可绕过 Recovery Human Review | #42 | **是** |
| F10 | P1 | `expectedGeneration` 已在 Governance service 实现，但 production Remote ingress 不传 | #38 | 否，但应先修 |
| F11 | P1 | `policyState.get/set` 的 closed set 仍读 boot Blueprint，而非 addressed Team bound Blueprint | #39 | 否，但应先修 |
| F12 | P1/P2 | `CONTROL_REQUEST_ABANDONED` Remote error mapping 属于 PR-D 语义，却落在 #42 | #41/#42 | 否 |
| F13 | 工程 | stacked PR base/head 漂移；#41 当前 `mergeable=false` | #38–#42 | 否，但必须整理 |
| F14 | P2 | PR-C 的 persona live observer 被标为 follow-up，但 PR-E 已依赖其语义做 cutover | #40/#42 | **是** |
| F15 | P2 | PR-E live kit 部分通过 fixture 扩权/静态 facts 绕过真实 production gap | #42 tests | **是：测试需改造** |

---

# 2. F1 — Requirement gate 没有消费 live readiness / materialization

## 2.1 现状

PR-C 已经建立：

```text
CapabilityReadinessProvider
CapabilityObservationRegistry
MCP materialization state
capability-runtime-event telemetry
```

但 PR-E 的真正 requirement gate：

```text
packages/runtime/admission/requirement-gate.ts
```

通过 `evaluateAllScopes(... environmentFacts ...)` 读取的 production port 仍来自：

```ts
const environmentFacts = async () =>
  config.environmentFacts.map(...)
```

即 host row 的静态配置 facts。

因此：

```text
真实 MCP 掉线
→ MCP runtime 发现失败
→ readiness registry / telemetry 更新
→ Requirement gate 仍可能继续看到 available:true
→ normal work 继续 OPEN
```

这直接违反：

```text
required outage
→ normal work BLOCK
→ Recovery
```

的核心 ADR。

## 2.2 涉及 PR

- **#40**：建立 readiness/materialization substrate，但没有把它升级为 requirement fact authority。
- **#42**：RequirementAuthority/gate cutover 时仍使用静态 environmentFacts。

## 2.3 建议修复

建立一个 production `RuntimeRequirementFactsProvider`（命名可调整），作为 RequirementAuthority 的唯一 live environment source。

建议数据流：

```text
Blueprint requirement
        ↓
Runtime Requirement Fact Resolver
        ├─ MCP supply: configuredMcpServers
        ├─ MCP readiness: CapabilityReadinessProvider / current observation
        ├─ MCP materialization: live agent MCP state
        ├─ persona: RuntimeSubstrateResolver
        ├─ repo/model/... existing authoritative probes
        ↓
EnvironmentFact / RequirementObservation
        ↓
RequirementAuthority
```

对于 MCP：

```text
Team-level requirement:
  supply + fresh readiness

Template/instance applicable boundary:
  supply + fresh readiness + materialization
```

约束：

- cold/inactive Member 的 materialization = `not-applicable`，不能因此 block；
- restart 后 readiness 应恢复为 `unknown`，再 probe；
- 不得从 durable telemetry 推断 current readiness；
- `config.environmentFacts` 可以继续作为 bootstrap/static seed，但不能继续作为 runtime truth。

## 2.4 建议归属

最好将 **live fact provider 的底层 seam 补在 #40**，再在 **#42** 切换 requirement gate consumer。

## 2.5 必补测试

### 单元/集成

1. static row `available:true`，live MCP `unreachable`：
   - required → BLOCK；
   - optional → DEGRADED。
2. static row `available:false`，live probe 恢复 reachable：
   - fresh evaluation 能恢复。
3. restart：
   - durable telemetry 最后一条 `reachable`；
   - current readiness 仍 `unknown`；
   - fresh probe 后才恢复。
4. cold Member：
   - required MCP；
   - `mounted=false/not-applicable`；
   - 不 block Team。
5. resident/applicable Member：
   - required MCP mount failed；
   - block 该 template normal work。

### Real-host

必须真实关闭/恢复 mini-MCP 进程，而不是只 patch `environmentFacts`：

```text
start MCP
→ Team normal
kill MCP
→ next boundary Recovery
restart MCP
→ fresh probe/mount
→ next boundary Normal
```

---

# 3. F2 — Recovery abort durable-close 失败被吞掉

## 3.1 现状

PR-E 的 Recovery dispatch：

```text
awaitControlDecision(...)
→ abort / closed
→ abandonControlRequest(...)
```

当前代码对 `abandonControlRequest()`：

```ts
try {
  await abandonControlRequest(...)
} catch {
  // best-effort
}
throw ... controlDecision:'abandoned'
```

所以可能出现：

```text
abandon durable write FAILED
but
caller receives "abandoned"
```

旧 durable request 仍可能保持 `pending`，以后仍可被 Allow。

## 3.2 涉及 PR

- 根语义：**#41** Control inline/abandon。
- 实际吞错：**#42** Recovery integration。

## 3.3 建议修复

禁止 best-effort swallow。

目标：

```text
wait aborted
→ abandonControlRequest
    → durable commit succeeds
        → throw typed recovery-abandoned
    → durable commit fails
        → propagate typed close/storage failure
        → 不得声称 abandoned
```

## 3.4 必补测试

Fault injection：

- `allocateSequence()` fail；
- ledger `put()` fail；
- domain closed；
- duplicate/identity fault。

断言：

```text
abandon commit failure
→ no "abandoned" result
→ request still pending
→ test can later resolve it
```

成功路径：

```text
abort
→ abandonment durable
→ later allow returns CONTROL_REQUEST_ABANDONED
→ zero work effect
```

---

# 4. F3 — `abandonControlRequest()` 错误依赖 `resolve-control` envelope

## 4.1 现状

PR-D 的 `abandonControlRequest()` 复用了 `RESOLVE_CONTROL_SPEC` 并执行 envelope check。

所以 Recovery Leader 如果没有 `resolve-control` envelope：

```text
可以 request review
但无法 abandon 自己等待中的 review
```

PR-E live kit 已实际遇到，并通过给 fixture Leader 添加 `resolve-control` 权限绕过。

## 4.2 建议修复

不要复用 `RESOLVE_CONTROL_SPEC`。

建立窄 authority：

```text
mayAbandon(request, caller):
  human → yes
  leader → yes（当前 Team）
  member → only if requester == self
  system continuation → only the request it owns
```

不建议暴露新的 Team tool 权限；这是 Control 内部 close authority。

## 4.3 必补测试

1. Leader 有 `request-control`，无 `resolve-control`：
   - Recovery review 可 request；
   - abort 可 durable abandon。
2. Member 只能 abandon 自己 request。
3. Member 不能 abandon sibling request。
4. Human 可 abandon。
5. Abandon 不产生 allow/consume。
6. Abandon 不改变 operation permission。

---

# 5. F4/F5/F14 — Persona actual runtime substrate 未闭合

## 5.1 现状

PR-C 增加了 `RuntimeSubstrateResolver`，但 production PR-E 使用：

```ts
shippedStatePersonaObserver(presetId)
```

它对**任意 presetId**都返回 `standard`。

因此：

```text
rootPresetId = minimal
actual = complete
observed = standard
→ false OPEN
```

此外配置允许：

```text
rootPresetId != memberPresetId
```

但 `RuntimeSubstratePlan` 只有一个 `personaKind`，并只调用：

```text
observePersonaKind(rootPresetId)
```

所以 Member preset 的 actual persona 根本没观察。

## 5.2 涉及 PR

- **#40**
- **#42**

## 5.3 建议修复

### A. plan 结构

建议：

```ts
interface RuntimeSubstratePlan {
  root: {
    presetId: string
    persona: PersonaKindObservation
  }
  member: {
    presetId: string
    persona: PersonaKindObservation
  }
}
```

未来若 template 级 preset 不同，再演化成 per-template resolver。

### B. production observer

必须读取真实 effective composition：

```text
DSH public preset/composition seam
→ effective mounted/composed preset
→ observed persona kind
```

若 public seam 不足：

```text
unresolved
→ fail closed
```

不能继续 shipped-state guess。

### C. PR #22 donor regression

保留：

```text
ptc → standard
minimal/complete → complete
bare → absent
dynamic unresolved → unresolved typed
```

并验证：

```text
preflight observed substrate == actual mount substrate
```

## 5.4 必补测试

1. root=standard / member=standard。
2. root=minimal / member=minimal。
3. root=standard / member=minimal。
4. root=minimal / member=standard。
5. ptc composable。
6. dynamic-disabled unresolved。
7. host preset service failure → typed host failure。
8. cold resume 后 observed plan 与 actual preset 一致。

Real-host 至少真实 mount：`standard`、`minimal`、`ptc`（若当前可用）。

---

# 6. F6/F7 — Startup preflight 尚未成为 production creation authority

## 6.1 现状

PR-E 已实现纯函数 `startupPreflight()`，但 production `team.create` / UI creation flow 并没有在 durable bind 前强制执行：

```text
Team + Leader + ALL MemberTemplate requirements
```

PR #42 自身也将 `startupPreflight = 单元面` 列为 known debt。

同时：

```text
optional-requirement-accepted
template-availability-set
```

虽有 fact model，但缺少完整 production writer/user resolution workflow。

## 6.2 建议修复

建立 server-side creation preflight authority：

```text
resolve Blueprint
→ build ALL scopes
→ fresh runtime requirement facts
→ startupPreflight
```

结果：

### proceed
允许 durable Team bind。

### consentRequired
返回 typed result；Human decision 写 `optional-requirement-accepted`；重新 preflight。

### fixOrDisable
Human 可 repair/recheck，或写 `template-availability-set(false)`；重新 preflight。

### fatal Team-level
不能通过 disable template 绕过。

**必须 server-side enforce**，不能只靠 React UI。

## 6.3 必补测试

1. Team required down → create zero durable effect。
2. MemberTemplate required down → `fixOrDisable`。
3. disable template → create allowed。
4. optional down no consent → create blocked。
5. consent → create allowed。
6. all templates checked，即使没有 instance。
7. restart 后 consent/disable persist。
8. Blueprint hash/revision 改变后旧 consent 不错误继承。

Browser：
- required failure；
- consent；
- disable；
- recheck；
- successful create。

---

# 7. F8 — Leader-template requirement 未 gate Leader 的真实 execution boundary

## 7.1 现状

Blueprint v2 已支持 `leader.requirements`，scope evaluator 也生成 `template:<leaderTemplateId>`，但 production 没有把 Leader normal model request 与该 scope 绑定。

PR #42 evidence 已记录：

```text
leader-template 域 scope 不能 gate 实行动作
```

## 7.2 建议修复

在 Leader 的真实 request assembly/pre-request boundary 加：

```text
Team scope requirement
+
Leader template scope requirement
+
fresh readiness/materialization
```

判定：

```text
PASS → normal request
Leader required blocked → Recovery request mode
optional degraded → normal request + degraded status
```

恢复只在下一 boundary 切回 Normal。

## 7.3 必补测试

1. Leader required MCP down → normal turn blocked，Recovery turn available。
2. Leader optional MCP down → normal continues。
3. recovery 中恢复 → current turn仍 Recovery，next turn Normal。
4. unrelated Member requirement down → 不 block Leader。
5. Team-level required down → block Leader normal turn。

---

# 8. F9 — `team_send_message` 绕过 Recovery Human Review

## 8.1 现状

PR-E：

```ts
ACTION_REQUIREMENT_IMPACT[SEND_MESSAGE] = coordination
```

coordination = always allowed。

但 Messaging coordinator 的真实效果：

```text
submitAttributedInput()
→ recipient session accepts input
→ recipient model turn runs independently
```

因此 Recovery Leader 可绕过 `delegate/follow-up` 的 Human Review，用 `team_send_message` 启动另一个 Agent turn。

## 8.2 建议修复

遵循 ADR：

> 按 effect 分类，不按工具名分类。

至少区分：

```text
pure coordination
cross-agent execution trigger
normal work
recovery work
```

当前 `team_send_message` 属于 cross-agent execution trigger。

Recovery 下：

```text
send-message that wakes recipient
→ synchronous Human Review
```

若未来增加“只留言、不唤醒”的 message mode，该模式才可作为 pure coordination。

## 8.3 必补测试

1. Recovery Leader send-message → Human Review。
2. deny → no recipient input。
3. allow → exactly one recipient input。
4. abort → abandonment durable + no recipient input。
5. normal mode send-message 不增加审批。
6. report-progress 仍 pure coordination。
7. request/resolve-control 不受误伤。

---

# 9. F10 — Governance optimistic generation guard production 不可达

## 9.1 现状

#38 service 已实现：

```text
expectedGeneration
→ OVERRIDE_GENERATION_CONFLICT
```

但 production Remote `override.set/reset` 没有传 `expectedGeneration`。

shared Team chain 能解决并发 lost-update，不能解决 stale UI/tab overwrite。

## 9.2 建议修复

给 current mutation ingress 增加 optional：

```text
expectedGeneration?: number
```

建议：

- additive field；
- absent = legacy compatibility；
- present = optimistic conflict；
- current UI/client 应传最近读到的 slot generation。

## 9.3 必补测试

1. concurrent writes under chain → no lost update。
2. stale UI：read g4 → other writes g5 → expected g4 → conflict，zero g6。
3. legacy absent → 兼容。
4. reset stale generation 同样 conflict。

---

# 10. F11 — PolicyState Remote closed-set 使用 boot Blueprint

## 10.1 现状

`s6-remote.ts` 的 `policyState.get/set` closed set 仍基于 host boot `blueprint.policyStates`，而 Governance service 真正操作 addressed Team bound Blueprint。

多 Team 下会出现：

```text
Remote precheck world != Governance world
```

## 10.2 建议修复

推荐删除 Remote 的 semantic closed-set authority。

Remote 只做 shape validation：

```text
stateId string
target record shape
```

closed-set 由 Governance service 根据 addressed bound Blueprint 判断。

`policyState.get.availableTransitions` 同样必须读取 addressed Team bound Blueprint。

## 10.3 必补测试

同一 host 创建：

```text
Team A: A1/A2
Team B: B1/B2
```

断言：

- get(B) 只显示 B states；
- set(B2) success；
- set(A2 on B) unknown；
- no cross-root ledger leak；
- restart 保持。

---

# 11. F12 — `CONTROL_REQUEST_ABANDONED` Remote mapping 应回填 PR-D

#42 head 已正确加入：

```text
CONTROL_REQUEST_ABANDONED
```

到 Remote backing error set，但这个语义属于 #41。

建议回填 #41，并补 Remote test：

```text
request
→ abandon
→ late allow
→ response.code == CONTROL_REQUEST_ABANDONED
```

不得变 `internal-error`。

---

# 12. F13 — PR 栈 metadata/base 漂移

审查时：

- #38 base 仍是 master，但实际建立在 #37 上；
- #41 `mergeable=false`；
- #41 base SHA 落后于 #40 当前 head；
- 多个 evidence commit 推进后 stacked base 已漂移。

建议按顺序 merge/rebase：

```text
merge #37
→ rebase #38 onto master
→ fix/merge #38
→ rebase #39
→ ...
```

不要在当前 #42 上继续叠 PR-F。

---

# 13. F15 — Real-host kit 掩盖了部分 architecture gap

PR-E live kit 为跑通世界使用了：

- 给 Leader fixture 添加 `request-control`；
- 给 Leader fixture 添加 `resolve-control`；
- scripted `presetSubstrate`；
- 静态 environment facts 模拟 outage；
- team-scope requirement 替代 leader-template requirement。

这些可以作为调试工具，但不能作为最终 production closure 证据。

最终 acceptance kit 必须改成：

```text
persona → actual preset/effective composition
MCP outage → real mini-MCP down/up
Leader requirement → actual leader-template requirement
abort → Leader 无额外 resolve-control
startup → real production creation preflight
```

---

# 14. 修复顺序与依赖

建议分 4 个 Wave。

## Wave 0 — PR 栈整理

先：

```text
#37 merge
```

停止 PR-F。

---

## Wave 1 — 可并行的基础 authority 修复

以下三项可以并行开发：

### W1-A：#38
修 F10：
- `expectedGeneration` production ingress。

### W1-B：#39
修 F11：
- PolicyState addressed bound Blueprint authority。

### W1-C：#41
修 F3/F12：
- abandon 独立 close authority；
- `CONTROL_REQUEST_ABANDONED` Remote mapping；
- rebase/mergeability。

“可并行”仅指开发；merge 仍按 stack 线性顺序。

---

## Wave 2 — Runtime Environment closure

### W2-A：#40

修：

- F4/F5/F14：actual persona observer；
- F1 的底层 live runtime requirement fact provider。

MCP per-server convergence 可保留。

W2-A 可和 Wave 1 并行开发，但 PR-E 的最终验收必须等待 W2-A。

---

## Wave 3 — PR-E production closure

### W3-A：live Requirement gate
修 F1 consumer，依赖 W2-A。

### W3-B：startup production preflight
修 F6/F7，依赖 W2-A + 已有 Blueprint v2 evaluator。

### W3-C：Leader request boundary
修 F8，依赖 W3-A + #39 boundary substrate。

### W3-D：cross-Agent effect review
修 F9，依赖修后的 #41 Control + W3-A。

### W3-E：abort close correctness
修 F2，依赖 #41 F3。

在 W3-A 接口冻结后，W3-B/C/D/E 可部分并行。

---

# 15. 依赖图

```text
#37
 │
 ├────────────┬───────────────┐
 ▼            ▼               ▼
#38 fix      #39 fix        #41 Control fix
F10          F11            F3/F12
 │            │               │
 └──────┬─────┘               │
        │                     │
        ▼                     │
   #40 Runtime Env closure    │
   F1 substrate + F4/F5/F14   │
        │                     │
        ├─────────────┐       │
        ▼             ▼       │
   W3-A live req    W3-B startup
        │             │
   ┌────┼────┐        │
   ▼    ▼    ▼        │
 W3-C W3-D W3-E       │
 leader send abort    │
 gate   review close  │
   └────┴────┴────────┘
            │
            ▼
        repaired #42
            │
            ▼
           PR-F
```

严格 merge 顺序：

```text
#37
→ repaired #38
→ repaired #39
→ repaired #40
→ repaired #41
→ repaired #42
→ PR-F
```

---

# 16. 每个 PR 需要补充的测试

## #37
无需新增产品测试；保持 dual-layout bridge load 与 canonical baseline。

## #38

新增：

```text
governance-stale-ui-generation.test.ts
remote-override-expected-generation.test.ts
```

Real-host：双 client stale save。

## #39

新增：

```text
policy-state-multi-team-bound-blueprint.test.ts
```

覆盖不同 Blueprint policyStates 的双 Team。

## #40

新增：

```text
runtime-substrate-root-member-persona.test.ts
live-persona-observer.test.ts
runtime-requirement-facts-provider.test.ts
mcp-live-readiness-to-requirement-fact.test.ts
```

Real-host：
- root/member 不同 preset；
- actual minimal/standard/ptc；
- MCP process real down/up；
- restart readiness unknown。

## #41

新增：

```text
control-abandon-without-resolve-envelope.test.ts
control-abandon-storage-fault.test.ts
remote-control-abandoned-code.test.ts
```

## #42

### Startup

```text
startup-preflight-production-create.test.ts
startup-consent-production.test.ts
startup-template-disable-production.test.ts
startup-all-templates-real-authority.test.ts
```

### Runtime outage

```text
required-mcp-live-outage-recovery.test.ts
optional-mcp-live-outage-degraded.test.ts
restart-readiness-unknown.test.ts
```

### Leader

```text
leader-template-required-boundary.test.ts
leader-recovery-next-boundary-exit.test.ts
```

### Cross-Agent

```text
recovery-send-message-review.test.ts
recovery-send-message-deny-zero-input.test.ts
recovery-send-message-abort-zero-input.test.ts
```

### Persona

```text
persona-actual-root-member-substrate.test.ts
persona-minimal-false-open-regression.test.ts
persona-ptc-regression.test.ts
persona-unresolved-host-failure.test.ts
```

### Abort

```text
recovery-abandon-commit-fault.test.ts
```

---

# 17. PR-E 最终 Real-host Acceptance Matrix

建议保留旧场景，并增加/替换以下关键场景。

## R1 — Real live MCP outage

```text
MCP A running
→ required PASS
kill A
→ next boundary BLOCKED / Recovery
restart A
→ fresh probe + mount
→ next boundary NORMAL
```

## R2 — Optional runtime outage

```text
startup consent
→ run
optional MCP down
→ auto degraded
→ normal work continues
→ telemetry lost/retry/restored
```

## R3 — Leader template requirement

```text
leader.required MCP down
→ Leader normal turn blocked
→ Leader Recovery turn
```

必须不是 team-scope substitute。

## R4 — Recovery Member reduced authority

Member：

```text
required failed MCP absent
bash=ask
read=allow
write=deny
```

断言：

```text
read works
bash asks
write stays deny
failed MCP absent
```

## R5 — send-message bypass negative

```text
Recovery Leader
→ team_send_message(worker,...)
→ Human Review
```

deny/abort 不得产生 recipient input。

## R6 — abort without resolve-control

Leader envelope 不含 `resolve-control`，abort 仍 durable-close。

## R7 — persona actual preset

真实 `rootPresetId=minimal` 不得观察为 standard。

## R8 — mixed root/member preset

```text
root=standard
member=minimal
```

Member requirement 使用 Member actual observation。

## R9 — creation preflight

未使用 specialist template 的 required MCP down：

```text
team.create
→ fix-or-disable
```

证明 all-template preflight 真正在 server authority。

## R10 — stale governance UI

```text
read generation g
other mutation → g+1
submit expected g
→ typed conflict
```

---

# 18. 进入 PR-F 前的 Merge Gate

必须全部满足：

1. #37–#42 线性 rebase 正确。
2. Governance stale UI write 有 production optimistic guard。
3. PolicyState closed set 只来自 addressed Team bound Blueprint。
4. Requirement gate 不再以静态 row fact 作为 live MCP truth。
5. persona observation 来自 actual runtime substrate；root/member 都正确。
6. startup preflight 在 server creation authority 中强制。
7. DegradationConsent/template-disable 有 production writer 与 restart 语义。
8. Leader template requirement gate 到真实 request boundary。
9. Recovery 下任何触发其他 Agent 新执行的 operation 都 Human Review。
10. `team_send_message` 不可绕过。
11. abort 必须 durable-close 成功后才能返回 abandoned。
12. abandon 不要求 resolve-control envelope。
13. `CONTROL_REQUEST_ABANDONED` Remote code 正确透传。
14. required MCP real down/up real-host test 通过。
15. Blueprint v1 frozen resume 保持。
16. Remote v1–v6 保持。
17. zero-core / test-use pristine。
18. full-suite failure-set 无新增。

---

# 19. 推荐多人并行分工

### Agent A — Governance / PolicyState

负责：

- F10；
- F11；
- tests。

### Agent B — Runtime Environment

负责：

- F1 provider substrate；
- F4/F5/F14；
- persona/MCP live tests。

### Agent C — Control

负责：

- F2；
- F3；
- F12；
- Control/Remote tests。

### Agent D — Requirement / Recovery integration

等待 Agent B/C 接口基本冻结后负责：

- F6/F7；
- F8；
- F9；
- PR-E live acceptance kit。

并行约束：

```text
A / B / C 可以同时开始。

D 可先做 test scaffolding 和 startup pure wiring，
但最终 integration 必须等待：
  B 的 live facts / persona interface
  C 的 abandon / inline-review contract
冻结。
```

最后应由独立 reviewer 做：

```text
cross-PR authority audit
+ real-host final matrix
+ full-suite failure-set diff
```

不要让实现 Agent 自己的 green evidence 成为唯一 merge 依据。

---

# 20. 优先级

如果时间有限：

```text
Priority 1
  F1 live readiness → requirement
  F2 abort false-abandoned
  F3 abandon authority
  F6 startup production preflight
  F8 Leader request gate
  F9 send-message bypass

Priority 2
  F4/F5 persona actual substrate
  F10 expectedGeneration ingress
  F11 PolicyState bound Blueprint
  F12 Remote abandoned mapping

Priority 3
  PR stack metadata cleanup
  test/evidence cleanup
```

Priority 1 全部解决前：

> **不建议合并 PR #42，也不建议进入 PR-F。**
