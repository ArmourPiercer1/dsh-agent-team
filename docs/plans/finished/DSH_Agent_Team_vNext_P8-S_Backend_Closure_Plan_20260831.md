# DSH Agent Team vNext — P8-S Backend Closure 补充阶段详细计划

**状态：已归档｜P8-S 后端补充阶段已完成并收束；P8-S7/FREEZE 完成，后续 P8-S8/G8-S 按用户裁决未继续派发。**  
**真正执行进度：** P8-S0、S1A/S1B/S1C/S1R、S2、S3、S4A/S4B、S5、S6、S7 均完成；最终 backend contract freeze 为 `7d07330`，2091/2091、tsc 8/8、live 17/17。其后直接进入 T12/P9 生产垂直与 UI 闭环。  
**完成时间：** 2026-09-02（P8-S7 freeze；P8-S8/G8-S 保留为暂停/未执行节点）。  
**文档用途**：在当前 `G8` blind review 轮次结束后，由本地主 Agent 直接执行的 P8 后端补充阶段计划。  
**阶段编号**：`P8-S`（P8 Supplemental / Backend Closure）  
**最终 Gate**：`G8-S`（Backend Complete Gate）  
**后续关系**：`G8-S PASS -> P9 UI-only -> P10 Hardening/Release`  
**适用执行模型**：主 Agent + 多个较弱 coding/review subagents；当前重点适配 `qwen3.8-27b` 一类可靠但不应被假设能够自行穷举系统边界的执行模型。  
**计划日期**：2026-08-31

---

# 0. 本文的地位

本文是现有四份冻结文档之后的 **P8 补充执行计划**：

1. `DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md`
2. `DSH_Agent_Team_vNext_Detailed_UI_Design_20260829.md`
3. `DSH_Agent_Team_vNext_Detailed_Development_Plan_20260829.md`
4. `DSH_Agent_Team_vNext_Task_Decomposition_and_Review_Method_20260829.md`

并直接吸收：

5. `DSH_Agent_Team_vNext_G8_Major_Issue_Audit_Report_20260831.md`

本文 **不替代、不重新设计** 已冻结 Architecture / UI / P8→P9→P10 Phase topology。

原计划已经规定：

```text
P7  Advanced backend semantics
 ↓
G7
 ↓
P8  Team Remote + Projection
 ↓
G8  stable browser-facing contract
 ↓
P9  External Web UI
 ↓
G9
 ↓
P10 Hardening / Release
```

P8-S 的作用是：

> 在已经发现 P5–P7 存在 production composition / cross-module closure 漏洞的情况下，于进入 P9 前把这些 integration debt 与 P8 Remote/Projection 一次性闭合。

因此新的严格解释为：

```text
P8 + P8-S
=
ALL BACKEND SEMANTICS COMPLETE

G8-S
=
BACKEND COMPLETE + P9 BACKEND SURFACE COMPLETE

P9
=
UI interaction / rendering only

P10
=
hardening / broad compatibility / performance / release
```

---

# 1. 当前轮次结束后的第一条规则

用户已经向当前主 Agent 发出：

> “请在本轮门禁操作后停止，无论是阻塞还是通过。”

因此：

```text
CURRENT g8-blind-review-round2
    ↓
finish current gate only
    ↓
STOP
```

不得：

```text
自动进入 P9
自动开启下一轮 G8 repair
自动解释本 P8-S 文档
自动继续当前 blind-review loop
```

用户随后把本文交给主 Agent 后，才进入 P8-S。

---

# 2. P8-S 的入口状态

无论当前 `g8-blind-review-round2` 最终结果是：

```text
PASS
BLOCKED
REQUEST_CHANGES
```

P8-S 都必须执行。

原因：

- 旧 G8 review 的 scope 不包含本文新增的 Backend Complete Definition；
- 当前公开审查已经发现 production-path closure 可能被 module-level tests 漏检；
- 即使旧 G8 PASS，也只作为已有 evidence；
- `G8-S` 才是进入 P9 的最终 backend gate。

因此：

```text
old G8 PASS != authorization to enter P9
```

新的唯一前置：

```text
G8-S PASS
```

---

# 3. 主 Agent 的硬职责边界

## 3.1 主 Agent 的职责

主 Agent 是：

```text
orchestrator
integrator
gate owner
state/evidence owner
```

负责：

- 读取本文和冻结文档；
- 记录当前 local HEAD；
- 读取当前 G8 round-2 最终结果；
- 建立 P8-S integration branch；
- 建立 task branches/worktrees；
- 生成 TaskPacket；
- 分派 coding / audit / reviewer agents；
- 管理 write locks；
- 检查 task prerequisite；
- 收集 TaskResult；
- clean cherry-pick；
- 运行或调度 integration-level commands；
- 判定 blocker；
- 创建 repair tasks；
- 维护 `graph.yaml` / evidence index；
- 创建最终 Gate review；
- 根据独立 reviewer evidence 做 PASS/BLOCKED 判定。

---

## 3.2 主 Agent 明确禁止承担具体代码工作

这是 P8-S 的**硬底线**：

```text
MAIN AGENT MUST NOT WRITE PRODUCTION CODE
MAIN AGENT MUST NOT WRITE TEST CODE
MAIN AGENT MUST NOT IMPLEMENT A FIX
```

主 Agent 不得直接修改：

```text
packages/contracts/**
packages/domain/**
packages/storage/**
packages/runtime/**
packages/tools/**
packages/remote/**
packages/projection/**
packages/client/**
tests/**
```

包括：

- “顺手修一行”；
- “只是补一个 adapter”；
- “只是修测试”；
- “只是解决 TypeScript error”；
- “只是修 cherry-pick 冲突中的一个语义 hunk”。

---

## 3.3 主 Agent 可以做的非代码操作

允许：

```text
git branch
git worktree
git status
git diff
git log
git cherry-pick
git reset --abort / cherry-pick --abort
pnpm test / node test runner
tsc
scanner
read files
write dev/agent-workflow bookkeeping
write task briefs / gate reports
```

允许 clean cherry-pick。

如果 cherry-pick 出现**任何 production/test semantic conflict**：

```text
ABORT or leave conflict uncommitted
→ create INTEGRATION_CONFLICT_REPAIR task
→ worker resolves it
```

主 Agent不得自己编辑冲突。

---

# 4. Coding Worker 全局禁止项

所有 P8-S coding worker 的 TaskPacket 顶部必须原样包含：

```text
FORBIDDEN:
- modify deepseek-harness upstream source
- import unexported/private deepseek-harness source
- patch-package / pnpm patch against upstream
- postinstall source rewriting
- reintroduce Team-specific DSH SessionEvent authority
- reintroduce SessionController Team mirror
- use continuable subagent as MemberInstance primitive
- use label/templateId/groupId as runtime actor identity
- make UI/Remote a second Team authority
- silently weaken frozen architecture or acceptance tests
- edit files outside owned_paths

IF REQUIRED:
stop and emit CORE_SEAM_BLOCKER

IF A FROZEN CONTRACT MUST CHANGE OUTSIDE OWNED PATHS:
stop and emit CONTRACT_CHANGE_REQUEST

IF A NEW ARCHITECTURE DECISION IS REQUIRED:
stop and emit ARCHITECTURE_DECISION_REQUIRED
```

---

# 5. P8-S 设计原则

## 5.1 不要求弱 Agent 自己“想全”

本阶段禁止使用下面这种任务：

```text
“请检查 backend 是否完整”
“请列出 UI 所有 backend requirement”
“请找出所有缺失的 Remote API”
```

因为这些要求隐含假设 Agent 能完整枚举系统 surface。

P8-S 已在本文中预先定义：

- 已知重大问题清单；
- Production topology 检查节点；
- P9→Backend Coverage Matrix；
- required semantic query surface；
- required command surface；
- reconnect/push surface；
- canonical E2E；
- race matrix；
- crash matrix；
- security matrix；
- Backend Gap Scan 范围。

Worker 的任务是逐项：

```text
VERIFY
CLASSIFY
IMPLEMENT CONFIRMED GAP
TEST
REPORT
```

而不是自行发现整个检查空间。

---

## 5.2 不把 P10 搬到 P8-S

P8-S 不做：

- 全面 fuzzing；
- 所有 malformed Remote payload permutation；
- 全部 lifecycle state pair exhaustive expansion；
- 大规模性能 benchmark；
- 24h soak；
- 所有 upstream versions；
- 广泛浏览器矩阵；
- UI accessibility；
- visual polish；
- release packaging hardening；
- 大规模 migration tooling。

这些仍属于 P10。

P8-S 只做：

```text
backend semantic completeness
production composition closure
critical crash/race/security correctness
P9 backend surface completeness
```

---

# 6. P8-S 的最终 Definition of Done

G8-S PASS 必须同时满足四层。

## Level A — Semantic Backend Complete

```text
[ ] Team creation works
[ ] Leader identity is valid
[ ] Member creation works
[ ] delegate carries real task input
[ ] follow-up carries real task input
[ ] fresh_per_delegation works
[ ] work completion settles lifecycle/activity
[ ] lifecycle archive/restore/dispose works
[ ] compatibility freshness/ACK is unified
[ ] mutation affects actual future Agent operation
[ ] control/approval semantics work
[ ] fork semantics work
[ ] handoff semantics work
[ ] legacy remains read-only
```

## Level B — Durable Backend Correct

```text
[ ] TeamDomain remains authority
[ ] restart reconstructs Team
[ ] Member identity survives restart
[ ] mutation survives restart
[ ] compatibility state survives/revalidates correctly
[ ] critical multi-system crash windows converge
[ ] required lifecycle writes cannot silently disappear
[ ] critical races cannot corrupt durable state
```

## Level C — Production Composition Complete

```text
[ ] shipped plugin entrypoint assembles backend
[ ] no architecture-critical subsystem is HARNESS_ONLY
[ ] canonical E2E mounts shipped production plugin
[ ] production path reaches real DSH Agent/Session runtime
[ ] production path reaches Projection/Remote
```

## Level D — P9 Backend Surface Complete

For every P9 behavior:

```text
must be implementable using exactly:
A. P8 TeamProjection / Remote query
B. P8 Team Remote command
C. documented native DSH public surface
D. client-local transient state
```

If P9 would need:

```text
direct TeamDomain access
direct TeamRuntime access
new backend semantics
Session log scan for Team truth
client-side lifecycle/policy/compatibility authority
private DSH API
```

then:

```text
G8-S = BLOCKED
```

---

# 7. P8-S Task DAG

为了限制复杂度，本阶段不建立 30–50 个微任务。

固定使用：

```text
P8-S0  Stop-point reconciliation
   ↓
{P8-S1A || P8-S1B || P8-S1C}
   ↓
P8-S1R  Audit reconciliation
   ↓
P8-S2  Leader + core contract repair
   ↓
P8-S3  Work execution + lifecycle closure
   ↓
{P8-S4A || P8-S4B}
   ↓
P8-S5  Production composition + operation fencing
   ↓
P8-S6  Projection / Remote / principal completion
   ↓
P8-S7  Backend Coverage Matrix closure
   ↓
P8-S8  Production E2E + critical matrices
   ↓
{G8-S-R1 || G8-S-R2}
   ↓
G8-S
```

说明：

- `S1A/S1B/S1C` 是只读审计，可以并行；
- `S4A/S4B` 在 S3 contract 稳定后并行；
- 其他 implementation task 默认串行，是为了减少 integration entropy；
- 主 Agent 从不成为其中任何 coding task 的 worker。

---

# 8. WIP 限制

P8-S 默认：

```text
最多 2 个 coding workers
+
最多 1 个 reviewer/audit worker
```

审计波：

```text
3 个只读 audit worker
```

允许一次并行完成。

实现波禁止 4–5 个 worker 同时修改 backend。

原因：

- 当前任务跨 contracts/runtime/storage；
- 弱模型容易各自生成 incompatible local solution；
- 本阶段目标是 closure，不是最大吞吐。

---

# 9. Review 成本控制

本阶段不重复之前的三份全量 blind review 模式。

规则：

## Task-level

```text
worker self-test
→ 1 independent focused reviewer
→ clean integration
```

## Integration-level

每次 integrated backend milestone：

```text
run affected targeted suites
```

## Final Gate

只使用两个互补 reviewer：

```text
G8-S-R1 = Architecture / Production Topology / Coverage reviewer
G8-S-R2 = E2E / Race / Crash / Security reviewer
```

两者不做重复工作。

完整仓库 full test chain：

```text
在最终 integration SHA 上集中跑 1 次
```

Reviewer MAY selective rerun，但不要求每个 reviewer 重跑整个 1500+ suite。

---

# 10. P8-S0 — Stop-point Reconciliation

**Owner**：主 Agent  
**代码修改**：禁止  
**前置**：当前 `g8-blind-review-round2` 已结束并停止

## 10.1 必须记录

```text
current local branch
current local HEAD SHA
current master SHA
current P8 integration SHA
current G8 round-2 verdict
uncommitted changes
existing worktrees
existing task branches
existing write locks
test baseline
```

## 10.2 必须检查

```text
git status
git log --graph
git branch --all
git worktree list
```

确认：

- 当前 round 没有仍在后台写 repo 的 worker；
- 没有 unresolved cherry-pick/rebase；
- 没有被遗忘的 lock；
- 未提交代码被归属到明确 task 或 snapshot。

## 10.3 建立 P8-S integration branch

推荐：

```text
int/P8-S-backend-closure
```

base：

```text
当前实际 P8/G8 integration stop SHA
```

不是公开 GitHub `959e...`，除非本地恰好仍在那里。

## 10.4 输出

```text
dev/agent-workflow/evidence/P8-S/
  S0-stop-point.md
  S0-branch-map.md
```

## 10.5 Gate

主 Agent确认：

```text
P8-S0 READY
```

然后才开始 S1。

---

# 11. P8-S1A — Actual Production Topology Audit

**类型**：read-only audit  
**Worker**：独立 reviewer/audit Agent  
**owned paths**：只写自己的 evidence  
**不得修改 production/test**

## 11.1 必须逐节点追踪

固定节点清单：

```text
A01 shipped Cordis/DSH host plugin entrypoint
A02 TeamDomain creation/open
A03 Blueprint catalog
A04 TeamIntent/preflight
A05 fresh Root binding
A06 cold Root binding
A07 Leader actor identity
A08 fresh Member creation
A09 cold Member residency
A10 TeamAgentBinder
A11 persona overlay
A12 ModelSelection overlay
A13 capability/tool/skill/MCP overlay
A14 CompatibilityProber
A15 new-work admission
A16 ActivationProvider
A17 TeamRuntime action facade
A18 Member work delivery
A19 work completion / settlement
A20 lifecycle service
A21 lifecycle durable commit
A22 mutation service
A23 mutation -> live Agent boundary
A24 messaging
A25 control/approval
A26 activity/progress
A27 fork reconciliation
A28 handoff
A29 legacy read-only reader
A30 TeamProjection
A31 Team Remote handlers
A32 push/generation/reconnect
A33 ledger pagination
A34 external principal derivation
```

## 11.2 每项必须填表

```text
Node:
Status:
  PRODUCTION
  HARNESS_ONLY
  MODULE_ONLY_NOT_WIRED
  MISSING
  UNKNOWN

Production file:
Factory/function:
Created by:
Injected dependencies:
Durable authority:
Live-Agent effect:
Restart path:
Evidence:
```

## 11.3 特别禁止

Reviewer 不得因为：

```text
module exists
unit tests pass
```

就标 `PRODUCTION`。

必须追到 shipped entrypoint。

## 11.4 输出

```text
P8-S/S1A-production-topology.md
```

---

# 12. P8-S1B — Known Major Defect Revalidation

**类型**：read-only audit  
**Worker**：独立 Agent  
**basis**：`G8 Major Issue Audit Report`

不得要求 worker 自行发现新问题。

固定复核：

```text
D-A Work delivery / settlement
D-B Compatibility dual authority
D-C Leader object model
D-D Production plugin assembly
D-E Required lifecycle commit
D-F Mutation -> live Agent
D-G Cross-module fencing
D-H Remote human principal
```

每项必须返回：

```text
CONFIRMED
ALREADY_FIXED
PARTIALLY_FIXED
FALSE_POSITIVE
```

并给：

```text
exact file/function
exact local HEAD evidence
test evidence
remaining gap
```

还必须附加以下六项：

```text
D-I  archive/dispose close-admission production port
D-J  Member lifecycle CAS/version semantics
D-K  work request retry after input acceptance
D-L  Projection TeamDomain-only authority
D-M  no fake Team event -> Chat/Trajectory
D-N  no backend behavior hidden in client package
```

输出：

```text
P8-S/S1B-defect-revalidation.md
```

---

# 13. P8-S1C — Backend Critical Gap Scan

**类型**：read-only audit/test  
**Worker**：独立 Agent

扫描：

```text
packages/contracts/**
packages/domain/**
packages/storage/**
packages/runtime/**
packages/tools/**
packages/remote/**
packages/projection/**
```

若当前 repo 实际路径不同，按现有 package 等价路径扫描。

固定关键词：

```text
TODO
FIXME
stub
placeholder
no-op
temporary
later phase
future task
not wired
mock only
harness only
optional until
P9
future integration
identity default
fallback
```

每个命中只能分类：

```text
G0 HARMLESS_INTERNAL
G1 P10_HARDENING
G2 BACKEND_SEMANTIC_GAP
```

`G2` 必须给：

```text
file
line/function
missing behavior
why P9 cannot fill it
candidate owner task
```

此外做 structural scan：

```text
team SessionEvent authority
SessionController Team mirror
memberId runtime identity
label/templateId/groupId authority
private upstream import
upstream source patch
direct UI -> TeamDomain/Runtime
harness-only production factory
```

输出：

```text
P8-S/S1C-backend-gap-scan.md
```

---

# 14. P8-S1R — Audit Reconciliation

**Owner**：主 Agent + 只读 integration reviewer  
**生产代码修改**：禁止

主 Agent收集：

```text
S1A topology
S1B defects
S1C gaps
current G8 round-2 findings
```

只读 reviewer 负责构造：

```text
P8-S/confirmed-repair-list.md
```

固定优先级：

```text
S0 = must repair before any P8 contract freeze
S1 = must repair before G8-S
S2 = explicitly defer to P10
FALSE = no repair
ALREADY_FIXED = require regression evidence only
```

主 Agent不自行设计 repair。

如果 audit 报告冲突：

```text
create focused READ-ONLY tie-break review
```

不通过主 Agent主观猜测。

---

# 15. P8-S2 — Leader + Core Contract Repair

**类型**：coding  
**前置**：S1R  
**Worker**：高能力 coding worker  
**主 Agent不得写代码**

## 15.1 Owned scope

允许按实际 repo 调整等价路径，但优先：

```text
packages/contracts/**
packages/domain/member/**
packages/runtime/root-binding/**
packages/runtime/admission/resolve*
packages/runtime/action-router/*caller*
packages/projection contract definitions IF already existing
tests directly owned by this repair
```

不允许同时重构 unrelated runtime。

## 15.2 必须闭合的 fixed requirements

### C1 Leader representation

最终必须满足：

```text
LeaderInstance = Root Agent + Root Session
no independent child Session
no ordinary Member lifecycle
cannot archive
cannot restore
cannot dispose
```

不得继续依赖：

```text
childSessionId = rootSessionId
```

作为普通 Member representation。

### C2 Fresh root immediately yields valid Leader actor identity

无需 harness seed。

### C3 Caller resolution

Leader caller 必须可由 durable Root/Team identity 正确解析。

### C4 MemberInstance remains ordinary member only

Member record：

```text
childSessionId
Member lifecycle
```

语义只属于普通 Member。

### C5 Projection-ready discriminated actor semantics

P8 Projection 后续必须能清楚表达：

```text
Leader
Member
```

而不是让 UI 猜。

## 15.3 必须测试

```text
fresh root -> leader can list/delegate
cold root -> leader remains valid
archive(inst-leader) rejected
restore(inst-leader) rejected
dispose(inst-leader) rejected
no fake leader member seed
ordinary Member behavior unchanged
serialization/migration relevant tests
```

## 15.4 禁止扩张

不在本任务：

- work delivery；
- compatibility；
- Remote；
- UI。

## 15.5 输出

```text
code commit
tests
P8-S/S2-result.md
```

---

# 16. P8-S3 — Work Execution + Lifecycle Closure

**类型**：coding  
**前置**：S2  
**目标**：完成 Team 最基本纵向执行链。

## 16.1 Owned scope

优先：

```text
packages/runtime/action-router/**
packages/runtime/activation/**
packages/runtime/member-residency/**
packages/runtime/messaging/** if reused as delivery substrate
packages/runtime/lifecycle/**
packages/storage/repositories/member*
packages/tools/**
direct tests
```

如需要修改 frozen contract，必须先发 `CONTRACT_CHANGE_REQUEST`；由专门 contract repair worker处理，主 Agent不改。

## 16.2 必须实现的纵向链

```text
delegate/follow-up
  ↓
new-work admission
  ↓
ensure/resume Member Agent
  ↓
submit actual model-visible prompt/context
  ↓
real child Session
  ↓
real Agent turn
  ↓
observe completion
  ↓
durable RUNNING -> SETTLED
  ↓
activity interval closure
```

## 16.3 Work request minimum semantics

必须携带：

```text
target instanceId/template delegation
prompt
explicit attached context if provided
requestToken/correlation
actor attribution
```

禁止默认继承：

```text
Leader full transcript
sibling transcript
group transcript
```

## 16.4 Required lifecycle commit

如果 new work 要求：

```text
CREATED/SETTLED -> RUNNING
```

则 durable transition 是 required。

禁止：

```text
work-admitted success
+
lifecycleCommitted=false
```

## 16.5 Durable update

Member lifecycle update 必须有：

```text
expected identity
expected version/activityVersion
expected from-state
next state
```

或同等级 optimistic/CAS 语义。

禁止依赖：

```text
unguarded delete + put
```

作为可被并发覆盖的通用 update。

## 16.6 Settlement

必须明确一个 production owner：

```text
actual Agent turn completion
-> Team work settle
```

在最终报告中必须给具体 file/function。

## 16.7 Delivery failure semantics

必须处理：

```text
admission intent exists
but DSH input not accepted
```

不得留下假 RUNNING。

## 16.8 Minimum tests

```text
W1 delegate TOKEN_A -> real Member Session receives TOKEN_A
W2 persistent follow-up TOKEN_B -> same childSessionId
W3 fresh_per_delegation -> two new instances/sessions
W4 delivery failure -> no fake running success
W5 turn completion -> SETTLED
W6 activity interval opens/closes
W7 non-resident SETTLED -> cold resume -> same Session
W8 concurrent lifecycle version mismatch -> fail one writer
W9 same logical retry does not create duplicate Member
```

---

# 17. P8-S4A — Unified Compatibility Admission

**类型**：coding  
**可与 S4B 并行**  
**前置**：S3

## 17.1 Goal

所有：

```text
follow-up
delegate continue
delegate create
explicit create
```

使用同一 compatibility authority。

## 17.2 Required chain

```text
read current environment facts
→ fingerprint
→ ensure freshness
→ durable compatibility
→ valid ACK
→ single admission result
```

## 17.3 禁止

```text
Runtime trusts durable OPEN without freshness
ActivationProvider independently reinterprets WARNING/ACK
Remote implements another preflight truth
```

## 17.4 Tests

```text
C1 stale OPEN -> next work reprobe/block
C2 stale ACK after environment drift -> invalid
C3 same valid ACK:
   follow-up PASS
   delegate-continue PASS
   delegate-create PASS
   explicit-create PASS
C4 in-flight work settles after drift
C5 next new work is gated
C6 FATAL never ACK-able
```

## 17.5 Owned scope

```text
packages/runtime/compatibility/**
packages/runtime/admission/**
packages/runtime/activation compatibility bridge
direct tests
```

---

# 18. P8-S4B — Mutation -> Actual Agent Closure

**类型**：coding  
**可与 S4A 并行**  
**前置**：S3

## 18.1 Goal

证明并实现：

```text
Team durable mutation
!= merely projection state

Team durable mutation
-> actual future Agent behavior
```

## 18.2 必须至少闭合

### Model

```text
Model A
current in-flight remains A
authorized mutation -> B
next real request uses B
restart
next request still B
```

### Capability

选择已经通过 G2 public seam 的一个实际 facet：

```text
allowed
-> future-operation deny/tighten
-> next actual operation blocked/absent
-> restart remains effective
```

## 18.3 Provenance

Projection 后续必须能读到：

```text
effective value
source
suppressed
unavailable
deniedBy
pending next boundary
```

但本任务只负责 backend truth。

## 18.4 Owned scope

```text
packages/runtime/mutation/**
packages/runtime/policy-adapter*
packages/runtime/agent-setup/model/**
packages/runtime/agent-setup/capability/**
durable override store/repository if needed
direct tests
```

---

# 19. P8-S5 — Production Composition + Shared Operation Fencing

**类型**：coding  
**前置**：S4A + S4B

## 19.1 Goal 1：shipped production plugin 真正 assembly

Production entrypoint 必须实际组装：

```text
TeamDomain
Blueprint catalog
TeamIntent/preflight
Root binding
Member residency
TeamAgentBinder
Compatibility authority
ActivationProvider
TeamRuntime
Work delivery/settlement
Lifecycle
Mutation
Messaging
Control
Activity
Fork
Handoff
Legacy
Projection service
Remote service
```

如果 Projection/Remote 尚由 S6 完成，则 production root 中提供明确 installation seam，S6 接入。

## 19.2 Harness rule

Harness 可以：

```text
mount production plugin
inject static model
expose test observability
```

禁止继续：

```text
手工重新构造一套不同 production graph
```

## 19.3 Goal 2：cross-module operation fencing

用 race tests 证明是否需要共享 coordinator。

固定 race：

```text
R1 follow-up || archive
R2 follow-up || dispose
R3 restore || follow-up
R4 quota-boundary create || create
R5 compatibility drift || new work
R6 mutation || next step begin
```

如果现有 independent locks 已足够：

```text
keep architecture
+ evidence
```

如果不够：

实现一个共享 Team-level operation/admission serialization seam。

禁止：

```text
再增加一个互不相识的 local lock
```

## 19.4 Production topology regression

S1A 中所有 backend-critical：

```text
HARNESS_ONLY
MODULE_ONLY_NOT_WIRED
MISSING
```

必须变：

```text
PRODUCTION
```

或者正式 `CORE_SEAM_BLOCKER`。

---

# 20. P8-S6 — Projection + Remote + Principal Boundary Completion

**类型**：coding  
**前置**：S5  
**这是 P8 原职责的最终收束任务**

## 20.1 Projection authority

必须：

```text
TeamDomain durable truth
+
read-only live residency diagnostic
→ TeamProjection
```

不得：

```text
scan all Session logs to reconstruct Team truth
SessionController Team mirror
root event merge
child event timestamp merge
```

## 20.2 Projection 必须正确表达

固定字段语义：

```text
Team identity
Blueprint snapshot
Leader actor
MemberTemplates
MemberInstances
instanceId
templateId
label
groupId
workspace
Member lifecycle
optional residency diagnostic
childSessionId for ordinary Member only
current perspective identity
quota summary
compatibility/admission
PolicyState
effective config + provenance
template session defaults
human overrides
autonomy overlays / suppression
model current/pending boundary
activity intervals
progress/activity facts
control requests/decisions
pending-control count
TeamLedger summary
generation
integrity/error status
handoff provenance
fork provenance/state
legacy read-only classification
```

## 20.3 Remote principal boundary

External browser request 不能自由传：

```text
caller.kind = human
caller.role = leader
```

并被信任。

Host 必须 server-side derive principal。

固定要求：

```text
Human authority -> authenticated/host-known client principal
Leader/Member authority -> bound Session + TeamDomain identity
```

## 20.4 Remote commands must call backend authority

Remote handler：

```text
must call Runtime/Team service authority
```

禁止：

```text
Remote direct repository mutation
Remote direct Agent.followup
Remote local compatibility recompute
```

## 20.5 Push/reconnect

必须：

```text
generation/version monotonic
stale response cannot overwrite new
duplicate invalidation safe
reconnect can pull authoritative projection
```

## 20.6 Ledger pagination

必须：

```text
stable cursor/page anchor
load earlier
new events do not invalidate historical window
```

---

# 21. Required Backend Semantic Surface Catalog

为了避免弱 Agent 自行遗漏，P8-S6/S7 必须按以下 surface catalog 建立实际 mapping。

实际函数名可以不同，但**每个 semantic surface 必须有一个明确实现或明确归类为 native/client-local**。

---

## 21.1 Query Surfaces — BQ

### BQ-01 Session classification

Input:

```text
sessionId
```

Output distinguishes:

```text
ordinary
team-root
team-member(rootSessionId, instanceId)
legacy-team-readonly
integrity-error
```

### BQ-02 Blueprint catalog

至少：

```text
list available Blueprints
blueprintId
revision
display identity
source/detail safe metadata
requirements summary
```

### BQ-03 TeamIntent/preflight state

创建前：

```text
selected Blueprint
workspace
runtime preset identity
initial work metadata
handoff metadata
compatibility result
warning/FATAL
ack eligibility
```

### BQ-04 Whole TeamProjection

Team Tab 的主 aggregate read。

### BQ-05 Compatibility detail

```text
status
generation
environment fingerprint metadata safe view
mismatches
WARNING/FATAL
ack state
blocked reason
```

### BQ-06 Member template detail

```text
template identity
display name
description
contextPolicy
quota
future-default state
```

### BQ-07 Member instance detail

```text
identity
lifecycle
workspace
group
child Session
model summary
residency diagnostic
```

### BQ-08 Effective configuration + provenance

每个 field：

```text
value
source
effective state
suppressed?
unavailable?
deniedBy?
effectiveFrom boundary
locked?
```

### BQ-09 Template session defaults

只针对未来 instances。

### BQ-10 PolicyState detail

```text
current PolicyState
available authorized transitions
effective impact data if backend provides preview
```

### BQ-11 Model state

```text
current model
next-boundary pending model
Team constraint/provenance
availability
```

### BQ-12 Activity intervals

Template -> Instance -> intervals。

### BQ-13 Progress/activity facts

structured progress + correlation。

### BQ-14 Pending controls

count + ids + target summary。

### BQ-15 Control request detail

```text
requester
kind
operation
reason/summary
createdAt
status
requested authority
decision if present
```

### BQ-16 TeamLedger page

```text
sequence
timestamp
actor
related instance/template
correlation
safe detail
provenance
navigation metadata
```

### BQ-17 Handoff state/provenance

```text
source Session provenance
snapshot/summary status
failure choices/state
created Team provenance
```

### BQ-18 Fork reconciliation state

```text
ordinary
root-fork-reconciled
root-fork-recovering
member-fork-ordinary
integrity conflict
```

### BQ-19 Legacy summary

read-only historical metadata if available。

### BQ-20 Team diagnostics/integrity

```text
TeamDomain unavailable
binding corruption
recovery state
safe diagnostic code
```

### BQ-21 Contract/generation metadata

```text
Remote contract version
projection generation
server generation
```

### BQ-22 Team-wide counts / pending summaries

如果不直接包含在 BQ-04，可独立提供。

---

# 22. Required Command Surfaces — BC

### BC-01 Preflight TeamIntent

```text
Blueprint
workspace
runtime preset
handoff source if any
```

返回 compatibility/preflight。

### BC-02 Acknowledge creation warning

只 ACK 当前 mismatch/environment fingerprint。

### BC-03 Create Team

materialize：

```text
new Root Session
TeamSession
Leader identity
```

可携带 optional initial work。

### BC-04 Recheck existing compatibility

环境/config 修复后重新 probe。

### BC-05 Acknowledge existing compatibility warning

只允许 WARNING。

### BC-06 Explicit Create Member

```text
templateId
label
groupId?
workspace
initialWork?
```

### BC-07 Delegate work

支持：

```text
template delegation
explicit existing instance delegation
fresh_per_delegation semantics
```

### BC-08 Follow-up / Resume with work

对 existing Member 发送新 work。

### BC-09 Running follow-up/steer

仅在 backend/public seam 支持的精确定义范围内。

如果没有独立语义，可明确映射 BC-08。

### BC-10 Archive Member

RUNNING 时必须 quiesce。

### BC-11 Restore Member

```text
ARCHIVED -> SETTLED
```

no Agent/model work。

### BC-12 Dispose Member

terminal，保留历史。

### BC-13 Set/reset explicit human override

Team/instance scope 按冻结模型。

### BC-14 Set/reset template session default

future instances only。

### BC-15 Switch PolicyState

authorized transition。

### BC-16 Member model mutation

Team-authorized next-boundary action。

可由 BC-13 generic mutation 承载，但 contract 必须明确。

### BC-17 Send Team message

instance-first。

### BC-18 Request control/approval

durable request。

### BC-19 Resolve control/approval

server-derived authorized principal。

### BC-20 Report progress

若 UI 有人工 progress action；如果 UI 只读，则记录为 runtime/model-only surface。

### BC-21 Start Team from Here / handoff begin

one-shot source snapshot。

### BC-22 Handoff retry

使用同一 frozen snapshot，不 reread source。

### BC-23 Continue without handoff

显式 user decision。

### BC-24 Cancel handoff

不创建 Team。

### BC-25 Recover/retry Team read

若无需 backend command，仅重新 BQ pull，则映射为 client action，不强制新增 command。

---

# 23. Push / Reconnect Surfaces — BS

### BS-01 Team projection invalidation

```text
rootSessionId
new generation
```

### BS-02 TeamLedger/new-event notification

可为：

```text
sequence/generation invalidation
```

不要求 push 完整 payload。

### BS-03 reconnect recovery

断线后：

```text
pull BQ-04/BQ-21
discard stale local generation
```

### BS-04 request/result correlation

mutation command response 必须能确认：

```text
Host accepted
durable generation/result
```

不能只依赖 client optimistic state。

---

# 24. Native DSH Public Surfaces — ND

这些不要求 Team Remote 重做，但 P8-S 必须确认 P9 可通过 public surface 使用。

### ND-01 Workspace list/current workspace

用于 Team creation/member workspace picker。

### ND-02 AgentPreset list/detail

包括足够判断：

```text
complete:true
runtime preset identity
```

如果 browser 没有 public access，则 P8 Remote 必须提供 Team-owned safe adapter，而不能让 P9 private import。

### ND-03 Model/provider directory

普通 Root model UI 与 available-model selection。

Team effective constraints 仍由 backend Team resolver 给。

### ND-04 Native Session Chat

selected Agent first-person。

### ND-05 Native Session Trajectory

selected Agent first-person。

### ND-06 Native Session navigation

根据 root/child sessionId 打开 Session。

### ND-07 Native Session fork

Root/member fork 都使用 DSH native fork；Team sidecar由 backend reconciliation。

### ND-08 Root ordinary model control

Root/Leader 保留 ordinary DSH model control；Team只投影 provenance/constraints。

---

# 25. Pure Client-local State — CL

P9 可以自行维护，但不得成为 authority。

### CL-01 selected Team tab subview

### CL-02 selected Member/Template for inspector

### CL-03 Timeline zoom/pan/hover

### CL-04 Event filter UI + currently loaded page window

### CL-05 modal open/close/input draft before server preflight

### CL-06 optimistic pending spinner

但最终 state 必须由 BC response / BQ projection确认。

### CL-07 non-blocking “Got it” fork notice dismissal

### CL-08 local accessibility/responsive presentation

---

# 26. Complete P9 → Backend Coverage Matrix

P8-S7 **不得让 Agent自己列矩阵**。

以下矩阵是必须逐行验证的固定清单。

状态栏只能：

```text
COVERED
PARTIAL
MISSING
NATIVE_PROVEN
CLIENT_LOCAL
NOT_APPLICABLE_WITH_REASON
```

`PARTIAL/MISSING` backend semantic 行必须生成 repair task，不能带入 P9。

---

## A. External client boot / session classification

| ID | P9 行为 | 必需 surface |
|---|---|---|
| UI-A01 | external Team client 能加载 | ND public client module seam + BQ-21 |
| UI-A02 | ordinary Session 识别为 ordinary | BQ-01 |
| UI-A03 | Team Root 识别 | BQ-01 |
| UI-A04 | Member child Session 识别 + perspective | BQ-01 + BQ-04 |
| UI-A05 | legacy Session 识别 | BQ-01 + BQ-19 |
| UI-A06 | integrity error 不伪装 ordinary | BQ-01 + BQ-20 |
| UI-A07 | projection generation | BQ-21 + BS-01/03 |

---

## B. New Team / TeamIntent

| ID | P9 行为 | 必需 surface |
|---|---|---|
| UI-B01 | New Team 打开 creation flow | CL-05 |
| UI-B02 | Blueprint picker | BQ-02 |
| UI-B03 | Blueprint revision/source detail | BQ-02 |
| UI-B04 | Workspace picker | ND-01 |
| UI-B05 | Runtime preset picker/detail | ND-02 或 safe Remote adapter |
| UI-B06 | `complete:true` FATAL 判定 | BC-01/BQ-03 authoritative result |
| UI-B07 | Initial work optional field | CL draft -> BC-03 |
| UI-B08 | preflight compatibility PASS | BC-01 + BQ-03 |
| UI-B09 | WARNING mismatch detail | BQ-03 |
| UI-B10 | WARNING explicit ACK | BC-02 |
| UI-B11 | FATAL Create disabled | BQ-03 authoritative |
| UI-B12 | reselect config -> preflight again | BC-01 |
| UI-B13 | Create Team | BC-03 |
| UI-B14 | TeamIntent before create not Sidebar Session | backend must not materialize root before BC-03 |
| UI-B15 | created Root opens native Session | BC-03 result + ND-06 |
| UI-B16 | cancel panel has zero backend Team creation | CL-05 + negative BC evidence |

---

## C. Header / perspective / counts

| ID | P9 行为 | 必需 surface |
|---|---|---|
| UI-C01 | Blueprint identity/revision | BQ-04 |
| UI-C02 | Leader perspective | BQ-01/BQ-04 |
| UI-C03 | Member perspective | BQ-01/BQ-04 |
| UI-C04 | lifecycle counts | BQ-04/BQ-22 |
| UI-C05 | pending control count | BQ-14/BQ-22 |
| UI-C06 | Compatibility badge | BQ-05 |
| UI-C07 | PolicyState current | BQ-10 |
| UI-C08 | AgentPreset readonly identity | BQ-04 + ND-02 |
| UI-C09 | Blueprint detail view | BQ-02/BQ-04 |
| UI-C10 | no Blueprint replacement action | backend exposes no rebind command |

---

## D. Members / Templates

| ID | P9 行为 | 必需 surface |
|---|---|---|
| UI-D01 | Leader shown separately | BQ-04 |
| UI-D02 | Template list | BQ-04/BQ-06 |
| UI-D03 | Template description | BQ-06 |
| UI-D04 | Template active/total count | BQ-04 |
| UI-D05 | Template quota summary | BQ-06/BQ-04 |
| UI-D06 | 0..N instances | BQ-04 |
| UI-D07 | duplicate labels legal | backend identity uses instanceId |
| UI-D08 | instance lifecycle | BQ-07 |
| UI-D09 | instance model summary | BQ-07/BQ-11 |
| UI-D10 | groupId tag | BQ-07 |
| UI-D11 | current perspective highlight | BQ-01/BQ-04 |
| UI-D12 | instanceId diagnostics/copy | BQ-07 |
| UI-D13 | archived collapsed group | BQ-04 + CL |
| UI-D14 | disposed historical discoverability | BQ-04/BQ-12/BQ-16 |

---

## E. Explicit Create Member / Delegation

| ID | P9 行为 | 必需 surface |
|---|---|---|
| UI-E01 | Create Member template fixed | BQ-06 |
| UI-E02 | label | BC-06 |
| UI-E03 | group optional | BC-06 |
| UI-E04 | workspace | ND-01 + BC-06 |
| UI-E05 | initial work optional | BC-06 + real work execution |
| UI-E06 | fresh_per_delegation wording | BQ-06 contextPolicy |
| UI-E07 | explicit create | BC-06 |
| UI-E08 | Leader delegate existing instance | BC-07 |
| UI-E09 | Leader delegate by template | BC-07 |
| UI-E10 | same template -> multiple instances | BC-06/07 + BQ-04 |
| UI-E11 | quota rejection typed | BC-06/07 typed error |

---

## F. Instance Detail / Effective Config

| ID | P9 行为 | 必需 surface |
|---|---|---|
| UI-F01 | value | BQ-08 |
| UI-F02 | source/provenance | BQ-08 |
| UI-F03 | inherited state | BQ-08 |
| UI-F04 | overridden state | BQ-08 |
| UI-F05 | suppressed overlay visible | BQ-08 |
| UI-F06 | unavailable distinct | BQ-08 |
| UI-F07 | denied distinct + reason | BQ-08 |
| UI-F08 | locked distinct | BQ-08 |
| UI-F09 | pending next boundary | BQ-08/BQ-11 |
| UI-F10 | degraded distinct | BQ-05/BQ-08 |
| UI-F11 | workspace source/locked-after-run | BQ-07/BQ-08 |
| UI-F12 | residency diagnostic | BQ-07/BQ-16 |

---

## G. Override / Template Defaults

| ID | P9 行为 | 必需 surface |
|---|---|---|
| UI-G01 | view explicit human override | BQ-08 |
| UI-G02 | distinguish autonomy overlay | BQ-08 |
| UI-G03 | set Team/instance human override | BC-13 |
| UI-G04 | reset override | BC-13 |
| UI-G05 | hard-policy block reflected | BC-13 result + BQ-08 |
| UI-G06 | template future defaults read | BQ-09 |
| UI-G07 | set template future defaults | BC-14 |
| UI-G08 | existing instances unchanged | BC-14 semantics + test |
| UI-G09 | suppressed stored overlay still visible | BQ-08 |

---

## H. PolicyState / Model

| ID | P9 行为 | 必需 surface |
|---|---|---|
| UI-H01 | current PolicyState | BQ-10 |
| UI-H02 | allowed transitions | BQ-10 |
| UI-H03 | switch PolicyState | BC-15 |
| UI-H04 | explicit overrides remain visible/effective | BQ-08 |
| UI-H05 | PolicyState not workflow progress | backend uses governance state only |
| UI-H06 | Member current model | BQ-11 |
| UI-H07 | Member authorized model mutation | BC-16/BC-13 |
| UI-H08 | current request stays model A | backend mutation semantics |
| UI-H09 | next request model B | BQ-11 + actual execution test |
| UI-H10 | model availability | ND-03 + Team constraint BQ-08 |
| UI-H11 | Root ordinary model control | ND-08 |
| UI-H12 | Team provenance on Root model | BQ-08/BQ-11 |

---

## I. Member Lifecycle / Work

| ID | P9 行为 | 必需 surface |
|---|---|---|
| UI-I01 | CREATED send work | BC-08 |
| UI-I02 | RUNNING follow-up/steer | BC-09 or documented BC-08 |
| UI-I03 | SETTLED Resume… means new work | BC-08 |
| UI-I04 | cold SETTLED automatically resumes Agent | backend Member residency |
| UI-I05 | work actually reaches child Session | backend production E2E |
| UI-I06 | work -> RUNNING | BQ-07 after BC |
| UI-I07 | completion -> SETTLED | backend settlement + BQ-07 |
| UI-I08 | Archive CREATED | BC-10 |
| UI-I09 | Archive RUNNING quiesces | BC-10 |
| UI-I10 | Archive SETTLED | BC-10 |
| UI-I11 | Restore ARCHIVED -> SETTLED | BC-11 |
| UI-I12 | Restore creates/resumes no Agent | BC-11 negative test |
| UI-I13 | Dispose active/settled/archived | BC-12 |
| UI-I14 | DISPOSED terminal | BQ-07 + typed BC rejection |
| UI-I15 | history retained after dispose | BQ-12/BQ-16 + ND-04/05 |
| UI-I16 | residency != lifecycle | BQ-07/BQ-16 |

---

## J. Compatibility / Admission

| ID | P9 行为 | 必需 surface |
|---|---|---|
| UI-J01 | Compatible | BQ-05 |
| UI-J02 | Degraded acknowledged | BQ-05 |
| UI-J03 | Action required warning | BQ-05 |
| UI-J04 | Structural FATAL | BQ-05 |
| UI-J05 | blocked reason | BQ-05 |
| UI-J06 | Review compatibility | BQ-05 |
| UI-J07 | Recheck | BC-04 |
| UI-J08 | ACK current warning | BC-05 |
| UI-J09 | stale ACK invalidated | backend compatibility |
| UI-J10 | existing admitted work can settle | backend compatibility |
| UI-J11 | new prompt/create/resume disabled | authoritative admission errors |
| UI-J12 | same ACK semantics on all new-work paths | backend tests |

---

## K. Activity / Progress

| ID | P9 行为 | 必需 surface |
|---|---|---|
| UI-K01 | running activity | BQ-12/BQ-13 |
| UI-K02 | completed activity | BQ-13 |
| UI-K03 | blocked progress | BQ-13 |
| UI-K04 | actor instance | BQ-13 |
| UI-K05 | correlation | BQ-13 |
| UI-K06 | no workflow-state authority | backend has no progress->PolicyState automation |

---

## L. Message / Control / Approval

| ID | P9 行为 | 必需 surface |
|---|---|---|
| UI-L01 | send Team message if exposed | BC-17 |
| UI-L02 | message appears as Team coordination | BQ-16 |
| UI-L03 | actual relay received by Agent appears natively | ND-04/05 |
| UI-L04 | pending control count | BQ-14 |
| UI-L05 | control request detail | BQ-15 |
| UI-L06 | request approval/control | BC-18 |
| UI-L07 | resolve allowed | BC-19 |
| UI-L08 | resolve denied | BC-19 |
| UI-L09 | user-approval only human principal | backend principal boundary |
| UI-L10 | decision != tool execution | BQ-15/BQ-16 + ND-05 |
| UI-L11 | Team allow but managed policy blocks execution | BQ-08/BQ-15 + native execution result |
| UI-L12 | exactly-once allow consumption | backend control tests |

---

## M. Team Events

| ID | P9 行为 | 必需 surface |
|---|---|---|
| UI-M01 | creation/binding event | BQ-16 |
| UI-M02 | member creation | BQ-16 |
| UI-M03 | work admitted/settled | BQ-16 |
| UI-M04 | lifecycle change | BQ-16 |
| UI-M05 | message | BQ-16 |
| UI-M06 | control request/decision | BQ-16 |
| UI-M07 | PolicyState transition | BQ-16 |
| UI-M08 | override mutation | BQ-16 |
| UI-M09 | compatibility warning/ACK | BQ-16 |
| UI-M10 | model mutation/effective boundary | BQ-16 |
| UI-M11 | handoff/fork provenance | BQ-16 |
| UI-M12 | progress facts | BQ-16 |
| UI-M13 | ledger sequence | BQ-16 |
| UI-M14 | actor/related instance/template | BQ-16 |
| UI-M15 | correlation | BQ-16 |
| UI-M16 | safe detail/provenance | BQ-16 |
| UI-M17 | filter by category | BQ-16 server filter OR CL over loaded pages, explicitly documented |
| UI-M18 | filter instance/template | same |
| UI-M19 | load earlier | BQ-16 pagination |
| UI-M20 | stable historical window while new events arrive | BQ-16 + BS-02 |

---

## N. Timeline

| ID | P9 行为 | 必需 surface |
|---|---|---|
| UI-N01 | Template -> Instance lane | BQ-12 |
| UI-N02 | multiple intervals same instance | BQ-12 |
| UI-N03 | start/end/duration | BQ-12 |
| UI-N04 | running interval open-ended | BQ-12 |
| UI-N05 | historical bars survive archive | BQ-12 |
| UI-N06 | historical bars survive dispose | BQ-12 |
| UI-N07 | groupId metadata | BQ-12/BQ-07 |
| UI-N08 | click -> Member Session | BQ-07 + ND-06 |
| UI-N09 | zoom/pan/hover | CL-03 |

---

## O. Native Chat / Trajectory / Navigation

| ID | P9 行为 | 必需 surface |
|---|---|---|
| UI-O01 | Root Chat first-person | ND-04 |
| UI-O02 | Member Chat first-person | ND-04 |
| UI-O03 | Root Trajectory first-person | ND-05 |
| UI-O04 | Member Trajectory first-person | ND-05 |
| UI-O05 | TeamDomain-only event not synthetic Chat | negative architecture test |
| UI-O06 | TeamDomain-only event not synthetic Trajectory | negative architecture test |
| UI-O07 | Open Member Session | BQ-07 + ND-06 |
| UI-O08 | Open Leader | BQ-04 + ND-06 |
| UI-O09 | Team tab perspective after navigation | BQ-01/BQ-04 |

---

## P. Ordinary Session / Start Team from Here

| ID | P9 行为 | 必需 surface |
|---|---|---|
| UI-P01 | ordinary Team zero-state | BQ-01 |
| UI-P02 | Start Team from Here | BC-21 |
| UI-P03 | source workspace prefill | ND-01/session metadata |
| UI-P04 | source Session identity | ND session identity |
| UI-P05 | one-shot source snapshot | backend handoff |
| UI-P06 | summary preview/status | BQ-17 |
| UI-P07 | Retry without reread | BC-22 |
| UI-P08 | Continue without handoff explicit | BC-23 |
| UI-P09 | Cancel | BC-24 |
| UI-P10 | source Session not converted | negative backend test |
| UI-P11 | new Root created | BC-03/BC-21 result |
| UI-P12 | provenance visible | BQ-17/BQ-16 |
| UI-P13 | target cannot live-read source later | backend negative test |

---

## Q. Fork

| ID | P9 行为 | 必需 surface |
|---|---|---|
| UI-Q01 | native fork Root | ND-07 |
| UI-Q02 | root fork same Blueprint snapshot | backend reconciliation + BQ-18 |
| UI-Q03 | root fork zero MemberInstances | BQ-04/BQ-18 |
| UI-Q04 | transient recovering state | BQ-18/BQ-20 |
| UI-Q05 | member child native fork | ND-07 |
| UI-Q06 | member fork stays ordinary | BQ-01/BQ-18 |
| UI-Q07 | no auto-new Member/Team | negative backend test |
| UI-Q08 | fork notice dismissal | CL-07 |

---

## R. Legacy

| ID | P9 行为 | 必需 surface |
|---|---|---|
| UI-R01 | detect legacy read-only | BQ-01 |
| UI-R02 | legacy summary if available | BQ-19 |
| UI-R03 | native Chat available | ND-04 |
| UI-R04 | native Trajectory available | ND-05 |
| UI-R05 | no Resume Team | no command / typed rejection |
| UI-R06 | no Restore Member | typed rejection |
| UI-R07 | no Create Member | typed rejection |
| UI-R08 | no Policy mutation | typed rejection |
| UI-R09 | no override mutation | typed rejection |
| UI-R10 | no in-place upgrade | no backend command |

---

## S. Error / Reconnect / Durable result

| ID | P9 行为 | 必需 surface |
|---|---|---|
| UI-S01 | TeamDomain unavailable | BQ-20 |
| UI-S02 | native Chat/Trajectory remain usable | ND-04/05 |
| UI-S03 | Team mutation fail closed | Remote typed error |
| UI-S04 | binding corruption | BQ-20 |
| UI-S05 | no guessed mapping | backend fail-closed |
| UI-S06 | reconnect state | BS-03 |
| UI-S07 | old generation cannot overwrite new | BQ-21 + BS-01/03 |
| UI-S08 | optimistic action not treated durable until Host accepts | BS-04 |
| UI-S09 | Retry projection | BQ-04/BQ-21 |
| UI-S10 | Diagnostics safe detail | BQ-20 |

---

# 27. P8-S7 — Backend Coverage Matrix Closure

**类型**：audit + targeted coding repairs  
**前置**：S6

## 27.1 第一轮只读 mapping

分派一个 reviewer，不让它自行新增行。

它逐行读取本文 `UI-A01 ... UI-S10`，填写：

```text
semantic ID
required surface
actual implementation file/function
status
test
```

输出：

```text
P8-S/ui-backend-coverage-matrix.md
```

## 27.2 Missing handling

对于：

```text
PARTIAL
MISSING
```

主 Agent不得自己补代码。

每个 gap 创建一个 bounded repair packet。

为了避免任务爆炸，可按 owner 合并：

```text
Repair-R1 Creation/preflight surface
Repair-R2 Projection query surface
Repair-R3 Runtime/command surface
Repair-R4 Handoff/fork/legacy surface
Repair-R5 Error/reconnect/pagination surface
```

只有实际有 gap 的 repair task 才创建。

## 27.3 Freeze artifact

所有行 closure 后，生成：

```text
P8-S/backend-contract-freeze.md
```

至少列出：

```text
Projection DTO/version
Remote query methods
Remote command methods
Remote error semantics
principal derivation
generation/reconnect
ledger pagination
native DSH surfaces assumed by P9
client-local-only state
```

这个 artifact 是 P9 的唯一 backend contract reference。

---

# 28. P8-S8 — Canonical Backend Surface Completeness E2E

**类型**：test implementation + execution  
**前置**：S7

必须构造一个 **不加载 Team UI** 的 fake browser/client。

它只允许调用：

```text
P8 Projection
P8 Remote
documented native DSH public surface
```

不得：

```text
import TeamRuntime
open TeamDomain directly
call repository
directly call Agent.followup
construct production runtime by hand
```

---

## 28.1 Canonical Scenario

必须按顺序覆盖：

```text
E01 mount shipped production plugin

E02 list/select Blueprint
E03 select workspace/runtime preset
E04 preflight PASS/WARNING/FATAL fixtures
E05 ACK warning
E06 create Team
E07 Leader valid immediately

E08 explicit create Member
E09 delegate work TOKEN_A
E10 assert real child Session received TOKEN_A
E11 work RUNNING
E12 actual turn settles
E13 durable SETTLED

E14 follow-up TOKEN_B
E15 same instanceId
E16 same childSessionId
E17 real Session received TOKEN_B
E18 SETTLED again

E19 fresh_per_delegation twice
E20 two new instances/sessions

E21 model mutation A -> B
E22 in-flight A unchanged
E23 next real request B

E24 capability tighten
E25 next actual operation blocked

E26 compatibility environment drift
E27 next new work blocked/reprobed
E28 previous admitted work may settle
E29 valid ACK/recovery
E30 create/follow-up/delegate agree on ACK

E31 archive RUNNING or SETTLED
E32 quiesce/drain
E33 ARCHIVED
E34 restore
E35 assert SETTLED and NO Agent resume
E36 send new work
E37 cold resume same child Session

E38 control request
E39 authorized resolution
E40 exact allow consumption
E41 managed hard policy still blocks actual forbidden execution

E42 Team message
E43 TeamLedger correlation
E44 native Member Session receives actual relay where designed

E45 Start Team from ordinary Session
E46 one-shot handoff
E47 source remains ordinary
E48 target cannot live-read source

E49 native Root fork
E50 same Blueprint + zero Members
E51 member child fork
E52 ordinary Session

E53 process restart
E54 reopen production plugin
E55 Team reconstructed
E56 Members/bindings preserved
E57 mutation preserved
E58 compatibility correct
E59 no duplicate logical instances

E60 pull Projection
E61 page TeamLedger
E62 reconnect/generation test
E63 stale response rejected

E64 legacy fixture classified read-only
E65 mutation commands rejected
E66 native historical Chat/Trajectory still available
```

---

# 29. Critical Race Matrix

P8-S8 只要求以下 critical matrix，不扩展 exhaustive。

```text
RR1 follow-up || archive
    result must not be ARCHIVED + newly admitted work

RR2 follow-up || dispose
    no work after terminal commit

RR3 restore || follow-up
    Restore alone no resume
    follow-up may resume only from valid SETTLED state

RR4 create || create at quota boundary
    no oversubscription

RR5 compatibility drift || new work
    stale generation cannot slip through

RR6 mutation || begin next request
    exactly old/current vs new/next boundary semantics

RR7 lifecycle CAS || lifecycle CAS same expected version
    at most one succeeds

RR8 same logical work retry
    no duplicate Member; delivery semantics documented/tested
```

---

# 30. Critical Crash Matrix

只要求以下：

## CR1 Member provisioning

```text
operation PREPARED
child absent
child created
binding absent
binding committed
member row absent
member committed
ledger final absent
```

restart convergence：

```text
one logical Member
one child Session
```

## CR2 Work delivery

```text
admission intent durable
input not accepted

input accepted
Team completion metadata absent

process dies after input acceptance
retry same requestToken
```

必须明确：

```text
exactly-once
or
at-least-once + visible/deduped contract
```

不允许 silent duplicate ambiguity。

## CR3 Lifecycle

```text
quiesced
before durable commit crash

durable transition committed
before ledger final crash
```

recovery deterministic。

## CR4 Compatibility

```text
environment changes
before durable re-probe commit
```

next work fail-closed/reprobe。

---

# 31. Security Matrix

固定测试：

```text
SEC1 browser self-asserts caller.kind=human
     -> no human authority

SEC2 browser self-asserts leader instanceId/role
     -> authority derived server-side, spoof rejected

SEC3 Member attempts human override
     -> rejected

SEC4 Member attempts control resolve
     -> rejected unless architecture explicitly authorizes role (current frozen model: no)

SEC5 Team allow cannot exceed External Hard Policy

SEC6 Remote cannot mutate repository directly outside Runtime authority

SEC7 legacy Session cannot mutate through vNext Remote
```

---

# 32. G8-S-R1 — Architecture / Topology / Coverage Review

**Reviewer**：fresh independent Agent  
**不参与实现**  
**不修改代码**

只检查：

```text
1. frozen architecture invariants
2. actual shipped production topology
3. no HARNESS_ONLY critical subsystem
4. Leader/Member object semantics
5. single authority
6. TeamDomain truth
7. P9 Coverage Matrix every row
8. Backend Contract Freeze
9. zero-core/private-import
10. no client/backend semantic leakage
```

不要求重跑 full suite。

可 selective rerun：

```text
Leader
compatibility
production plugin load
coverage fake-client
```

输出：

```text
P8-S/G8-S-R1-report.md
```

Verdict：

```text
APPROVE
REQUEST_CHANGES
BLOCKED
CORE_SEAM_BLOCKER
```

---

# 33. G8-S-R2 — E2E / Race / Crash / Security Review

第二个 independent reviewer。

只检查：

```text
canonical fake-client E2E
real DSH Agent/Session path
restart
race matrix
crash matrix
principal/security matrix
Remote generation/reconnect/pagination
```

它不重复 R1 的完整 architecture coverage。

selective rerun relevant tests。

输出：

```text
P8-S/G8-S-R2-report.md
```

---

# 34. Final Full Test Chain

两个 reviewer 完成后，主 Agent在**同一个最终 integration SHA**：

```text
run full repository tests once
run tsc/package checks once
run verify-zero-core once
run private-import/dependency scan once
```

记录：

```text
P8-S/final-chain.log
```

如果失败：

```text
main agent does NOT fix
→ create focused repair worker
→ new SHA
→ rerun affected suite
→ final full chain again once
```

---

# 35. G8-S Gate

主 Agent只能在：

```text
R1 = APPROVE
R2 = APPROVE
full chain = PASS
zero-core = PASS
all Coverage Matrix rows closed
no S0/S1 confirmed gap open
```

时判：

```text
G8-S PASS
```

否则：

```text
G8-S BLOCKED
```

---

# 36. G8-S 最终 Checklist

```text
BACKEND SEMANTICS
[ ] Leader valid without fake childSession
[ ] Leader cannot Member-lifecycle mutate
[ ] create/delegate/follow-up real work delivery
[ ] real work completion -> SETTLED
[ ] fresh_per_delegation correct
[ ] lifecycle durable required commits
[ ] restore no Agent/model work
[ ] cold resume same Session
[ ] compatibility one authority
[ ] stale OPEN impossible
[ ] ACK consistent all paths
[ ] mutation affects actual Agent
[ ] mutation restart-safe
[ ] control/approval exact authority
[ ] fork/handoff/legacy correct

DURABILITY
[ ] critical CAS/version semantics
[ ] provisioning recovery
[ ] work delivery crash semantics
[ ] lifecycle recovery
[ ] critical race matrix

PRODUCTION
[ ] shipped plugin assembly complete
[ ] no critical HARNESS_ONLY component
[ ] fake-client E2E mounts shipped plugin
[ ] real DSH Agent/Session used

REMOTE / PROJECTION
[ ] TeamDomain -> Projection
[ ] Leader projected separately
[ ] all required P9 data present
[ ] all required P9 commands present
[ ] server derives principal
[ ] reconnect/generation safe
[ ] ledger pagination stable
[ ] typed fail-loud errors

P9 SURFACE
[ ] UI-A01..A07 closed
[ ] UI-B01..B16 closed
[ ] UI-C01..C10 closed
[ ] UI-D01..D14 closed
[ ] UI-E01..E11 closed
[ ] UI-F01..F12 closed
[ ] UI-G01..G09 closed
[ ] UI-H01..H12 closed
[ ] UI-I01..I16 closed
[ ] UI-J01..J12 closed
[ ] UI-K01..K06 closed
[ ] UI-L01..L12 closed
[ ] UI-M01..M20 closed
[ ] UI-N01..N09 closed
[ ] UI-O01..O09 closed
[ ] UI-P01..P13 closed
[ ] UI-Q01..Q08 closed
[ ] UI-R01..R10 closed
[ ] UI-S01..S10 closed

ZERO CORE
[ ] upstream source diff 0
[ ] no private import
[ ] no patch-package/pnpm patch
[ ] no SessionController Team mirror
[ ] no Team SessionEvent authority
[ ] no private DOM/client hack required by backend
```

---

# 37. P9 Entry Contract

G8-S PASS 后，P9 启动时必须把以下规则放进所有 UI TaskPacket：

```text
P9 IS UI-ONLY.

ALLOWED backend access:
- frozen TeamProjection/Remote
- documented native DSH public UI/session surfaces
- client-local transient state

FORBIDDEN:
- invent new backend semantics
- direct TeamDomain access
- direct TeamRuntime access
- scan Session logs to reconstruct Team truth
- recompute compatibility/policy/lifecycle authority client-side
- private upstream imports
- upstream UI patch
```

如果 P9 worker 发现 backend 缺失：

```text
emit UI_BACKEND_GAP
```

主 Agent不得让 UI worker自行补 runtime。

`UI_BACKEND_GAP` 被视为：

```text
G8-S escaped defect
```

由独立 backend hotfix worker修复。

---

# 38. TaskPacket 最小模板

为了适应弱本地模型，每个 task 不要附四份完整长文档。

主 Agent给 worker：

```text
TASK_ID
BASE_SHA
OBJECTIVE
OWNED_PATHS
FORBIDDEN_PATHS
EXACT FIXED REQUIREMENTS
EXACT TEST LIST
EXACT OUTPUT FILES
RELEVANT frozen invariants (10–30 items max)
KNOWN files/functions
```

Worker 返回：

```text
TaskResult
- task id
- base SHA
- final SHA
- changed files
- implementation summary
- tests commands/results
- each acceptance item PASS/FAIL
- blockers
- known limitations
- no-core assertion
```

禁止让 worker自己总结整个 Architecture。

---

# 39. Reviewer Prompt 最小模板

```text
You are the independent reviewer for <TASK>.

Do not modify code.

Verify only:
1. the exact acceptance checklist in this TaskPacket;
2. the listed frozen invariants;
3. the diff base..head;
4. targeted positive/negative tests;
5. no out-of-scope changes;
6. no private/upstream workaround.

Return:
APPROVE / REQUEST_CHANGES / BLOCKED
with concrete file/function/test evidence.
```

---

# 40. Main Agent 执行循环

固定：

```text
READ current graph
↓
CHECK current integration SHA
↓
COMPUTE one/two READY implementation tasks
↓
CREATE worktree/branch
↓
ASSIGN worker
↓
COLLECT result
↓
ASSIGN one focused reviewer
↓
APPROVE?
  no -> repair task
  yes
↓
MAIN clean cherry-pick
↓
targeted integration tests
↓
advance DAG
```

主 Agent不得：

```text
在等待 worker 时自己开始写另一个修复
为了加速直接改 integration branch
在 review finding 后自己修
```

---

# 41. 当前公开仓库基线说明

公开 GitHub 审查时：

```text
ArmourPiercer1/dsh-agent-team
master ≈ 959e36358ee7244ff8c7e1e0b8396e70dfef4562
```

该公开点主要反映 G7 close-out。

用户明确指出本地开发已经推进到 G8 review，GitHub 可能落后。

因此所有 P8-S worker：

```text
MUST use local P8-S base SHA
MUST NOT reset to the GitHub audit SHA
```

公开 audit 只用作 defect provenance。

---

# 42. P8-S 不得无限扩张

如果审查发现新问题，只有满足：

```text
backend semantic correctness
production composition
P9 backend surface completeness
critical security/durability
```

之一，才进入 P8-S。

否则：

```text
record as P10_HARDENING
```

例如：

```text
5% performance optimization -> P10
rare malformed payload wording -> P10
broad stress -> P10
UI polish -> P9/P10
```

这样防止 P8-S 再成为无限 review loop。

---

# 43. 最终应产生的 artifacts

```text
dev/agent-workflow/evidence/P8-S/
├─ S0-stop-point.md
├─ S0-branch-map.md
├─ S1A-production-topology.md
├─ S1B-defect-revalidation.md
├─ S1C-backend-gap-scan.md
├─ confirmed-repair-list.md
├─ S2-result.md
├─ S3-result.md
├─ S4A-result.md
├─ S4B-result.md
├─ S5-result.md
├─ S6-result.md
├─ ui-backend-coverage-matrix.md
├─ backend-contract-freeze.md
├─ production-e2e-report.md
├─ race-matrix.md
├─ crash-matrix.md
├─ security-matrix.md
├─ G8-S-R1-report.md
├─ G8-S-R2-report.md
├─ final-chain.log
└─ G8-S-verdict.md
```

不要求每个文件写长篇叙事。

应以：

```text
facts
paths
SHA
PASS/FAIL
evidence
```

为主。

---

# 44. 最终成功状态

P8-S 的目标不是获得：

```text
more modules
more tests
more review reports
```

而是使下面这条链成为真实 production fact：

```text
shipped dsh-agent-team plugin
        ↓
Team creation / Leader
        ↓
TeamRuntime single authority
        ↓
persistent Member Agent + Session
        ↓
real work delivery / execution / settlement
        ↓
durable lifecycle / compatibility / mutation
        ↓
TeamDomain
        ↓
Projection / Remote
        ↓
complete P9-facing backend contract
```

然后：

```text
P9
```

只需要实现：

```text
render
interaction
navigation
client store
presentation
```

而不再发明任何 backend semantics。

---

# 45. 最终裁决规则

如果 G8-S PASS：

```text
advance to P9
```

如果 G8-S BLOCKED：

```text
only create focused repair tasks for failed criteria
do not restart full blind-review cycle from scratch
```

如果发现 `CORE_SEAM_BLOCKER`：

```text
stop affected path
record exact missing public seam
do not modify upstream
ask user only if product-level behavior must change
```

如果发现 P10-only issue：

```text
record
defer
do not block G8-S
```

这就是 P8-S 的完整边界。
