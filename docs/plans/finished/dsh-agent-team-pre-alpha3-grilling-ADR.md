# dsh-agent-team Pre-Alpha.3 重构 Grilling ADR

> 状态：**Accepted / Frozen for implementation**
>
> 决策日期：2026-09-28
>
> 当前实现基线：`master = e22c659a8f919710b99dd1c1bd737ea44c1da5aa`（PR #35 merge）
>
> PR #22：`head = d30397b8`，**不进入重构基线；其正确语义与回归证据由本轮重构吸收**
>
> 总原则：**CORE PATCH BUDGET = 0**；保留九包总体架构；TeamDomain schema v2 本轮不升级。

---

## 1. 背景

Alpha.2 之后，`dsh-agent-team` 已经具备相当完整的 Team lifecycle、Remote v1–v6、MCP、Control、operation permission、restart recovery、projection、liveToken 等能力。但多轮功能叠加暴露出一类共同问题：**同一个概念存在多个局部正确、全局却不一致的事实源和执行路径**。

最典型的例子包括：

- `MutationService` 的设计包含 future-step/StepClock，而 production `StepClock` 长期固定为 `0`；真正运行边界已经演化为 model request、MCP reconcile、tool pre-execute 等 capability-native boundary。
- production 中 `admitGovernanceOverride()` 可以写入 durable override，但其 admission validation 与 `MutationService.requestMutation()` 的 envelope/external-hard 语义并不完全一致。
- model、MCP、inspect、activation/effective-config 分别组装 policy，导致 PolicyState/override/static template 等信息存在漂移风险。
- MCP 的“Blueprint 允许”“host 配置存在”“服务当前可达”“某个 live Agent 已挂载”曾被部分折叠在 `allowed/unavailable/mounted` 中。
- compatibility 的 `optional`、startup acceptance、runtime degradation、recovery 之间缺少清晰状态机。
- Control 已经具备 durable request/decision、同步 wait bridge、exact-operation guard，但 scope 被限定为 instance；Recovery 所需的 template/team target 与 inline reviewed invocation 尚无统一表示。
- PR #22 暴露 persona 的 pre-probe、post-create compatibility、真正 preset mount、persona overlay substrate 存在多事实源问题；同时直接收紧 Blueprint v1 validator 会破坏 frozen v1 snapshot 的恢复。

本轮目标不是重写系统，而是做一次 **semantic convergence**：让每一类事实只有一个 authority，让 UI/inspect/runtime materialization 都从同一事实链派生，并为长期无人值守运行建立明确的降级、恢复、审计语义。

---

## 2. 不变项

以下内容本轮明确保留：

1. 九包总体架构：contracts / domain / storage / runtime / tools / remote / client / legacy / testkit。
2. TeamDomain 是 Team control-plane durable authority。
3. TeamDomain schema v2 与 9-store 布局不升级。
4. `(rootSessionId, instanceId)` 是 member identity。
5. Blueprint snapshot immutable，旧 frozen revision 不原地改写。
6. Remote wire v1–v6 继续兼容；内部 API 可去版本化。
7. External Hard Policy 是绝对上限。
8. Control 与 ArtifactReadGrant 继续是独立 authority plane。
9. CORE PATCH BUDGET = 0，不修改 upstream DSH。
10. post-gate `subagent` surface expansion 本轮不作为 merge blocker；以 runtime enforcement 保证安全，surface contraction 延后。

---

## 3. 核心 Architecture Decisions

### ADR-01：兼容策略

采用 **Alpha-level compatibility**：

- 保留已有用户数据、旧 Blueprint v1、Remote v1–v6、旧 Control ledger rows 的可读性。
- 允许内部 API/模块发生不兼容重构。
- 明确删除“看起来支持、实际上没有 production materialization”的能力。
- tightening 应 fail earlier / fail typed，而不是 silent fallback。

对应 grilling：Q1=B，Q3=B，Q4=B，Q57=A。

---

### ADR-02：TeamDomain v2 冻结

本轮不做 TeamDomain v3。新增 durable 语义优先使用现有 ledger/override store；只有证明无法表达时才允许重新开 schema migration 议题。

对应：Q2=A。

---

### ADR-03：Governance 只有一个 production mutation authority

新增 `GovernanceMutationService`，成为 production 中持久治理变更的唯一逻辑 authority。

职责：

- actor / scope / identity 校验；
- mutation envelope；
- External Hard 检查；
- PolicyState 约束；
- shared per-Team serialization；
- optimistic generation guard；
- desired-state idempotence；
- durable commit-before-ack。

旧 `MutationService` 不再作为 production service；保留其中有价值的纯函数/纯 kernel。

`admitGovernanceOverride()` 降级为 persistence primitive，不允许 Remote/Tools 直接调用。

对应：Q5=B，Q6=A，Q9=A，Q13=C，Q15=B，Q18=B。

---

### ADR-04：治理优先级与独立 authority planes

治理优先级冻结为：

```text
External Hard
  > Explicit Human Override
  > PolicyState / frozen autonomy boundary
  > Leader / Member autonomy overlays
```

Control 继续管理一次性 operation authorization；ArtifactReadGrant 继续管理窄资源能力。二者不并入 persistent governance。

对应：Q7=B，Q8=A，Q9=A。

---

### ADR-05：Override reset 为审计保留的逻辑 tombstone

`override.reset` 不再物理删除 winner record，而是写入更高 generation 的 full-slot reissue / tombstone，使旧历史保留、winner deterministic。

对应：Q14=B。

---

### ADR-06：移除 production StepClock 语义

生产运行不再以虚构统一 `Step` 作为 authority。保留真正需要的 invariant：

> 已经开始的 in-flight work 使用冻结 snapshot；新治理事实只从下一个真实执行边界生效。

真实 boundary 按能力区分：

- model：下一个 model request assembly；
- MCP：setup / request reconcile；
- operation permission：pre-execute；
- Recovery/requirements：work admission / activation / request boundary。

对应：Q10=B，Q11=B。

---

### ADR-07：Committed 与 Applied 分离

所有动态治理/运行状态显式区分：

- `committed`：durable authority 已写入；
- `applied`：对应 runtime surface 已 materialize；
- `pending`：等待适用 boundary；
- `blocked/failed`：materialization 失败。

失败时 fail closed，不允许继续使用更宽的旧 surface。

对应：Q12=C。

---

### ADR-08：Canonical EffectivePolicyReader

所有 model/MCP/inspect/admission/effective-config 消费同一个 canonical `EffectivePolicyReader`，统一读取：

- bound Blueprint snapshot；
- current durable PolicyState；
- current override winners；
- External Hard facts；

输出 `EffectivePolicy + provenance`。

Projection/inspect 是派生读面，绝不能成为 runtime authority。

对应：Q19=B。

---

### ADR-09：Capability 状态分层

对 MCP 等运行能力，明确区分：

1. **Policy**：角色是否被允许使用；
2. **Requirement**：没有它是否还能执行；
3. **Supply**：host/deployment 是否配置；
4. **Readiness**：当前服务是否可达（带 source/time 的 observation）；
5. **Materialization**：当前 applicable Agent 是否已挂载。

Readiness/materialization 的**当前状态**是 ephemeral；历史状态跃迁全部 durable 留痕。

对应：Q12a-1=B，Q17=B，Q20=B，Q28=A。

---

### ADR-10：Required / Optional 与 Applicability

requiredness 约束 **applicable execution boundary**，而不是要求 Agent 24×7 mounted。

Materialization 状态至少区分：

```text
not-applicable | pending | mounted | failed
```

- cold/inactive member：`not-applicable`，即使 required MCP 未 mounted 也不构成故障；
- resume/setup：`pending`；
- 真正执行新工作前 required capability materialize 成功：`mounted`；
- applicable boundary materialize 失败：`failed`，才触发 block。

对应：Q12a-2=C，Q16=B，Q23=B'。

---

### ADR-11：Team-level + per-template requirements

Blueprint v2 同时支持：

- Team-level `requirements`；
- LeaderTemplate / MemberTemplate `requirements`。

Team-level requirement 约束 Team 的 normal work；template-level requirement 只约束该角色/模板的 normal work。

Blueprint v1 保留原 reader，template requirements 视为空。

对应：Q16=B，Q49=B。

---

### ADR-12：Optional 的 startup consent 与 runtime degradation

Optional requirement 的语义分两阶段：

**startup/preflight：**
- 用户必须明确接受缺失（`DegradationConsent`）；
- 同一 Team + immutable Blueprint contentHash + requirement scope 的 consent durable，restart 不重复询问。

**runtime：**
- 后续 optional outage 自动进入 degraded，不阻塞 normal work；
- 状态与事件暴露给未来 UI；
- 不要求再次 consent。

对应：Q21 custom，Q27=B，Q32=B，Q33=A。

---

### ADR-13：Startup preflight 要覆盖所有模板

面向长期无人值守运行，启动阶段尽量暴露未来问题：

- 所有 Team-level requirements；
- Leader requirements；
- 所有 MemberTemplate requirements。

对于 optional unavailable：要求 DegradationConsent。
对于 required unavailable 的 template：用户必须修复，或显式 disable 该 template 后才允许进入无人值守运行。

被 disable 的 template 可在后续 fresh recheck PASS 后由 Human 显式 re-enable；不会自动启用。

对应：Q33=A，Q34=C，Q47=B。

---

### ADR-14：Requirement/Readiness Authority 与 Governance 分离

新增 Requirement/Readiness authority，负责：

- requirement evaluation；
- startup preflight；
- DegradationConsent；
- template enablement；
- CapabilityReadinessProvider；
- recovery state derivation；
- current capability runtime status。

这些不是“谁有权限做什么”，因此不放入 `GovernanceMutationService`。

对应：Q26=C，Q50=B。

---

### ADR-15：MCP per-server independent convergence

多 MCP reconcile 不再 all-or-nothing rollback：

- deny-first 仍然成立；
- 每个 server 独立 mount/failed；
- optional server 失败不能卸掉其他健康 MCP；
- requiredness 由 Requirement Authority 在 applicable boundary 判定。

自动重试：相关 request boundary + bounded cooldown；manual recheck 可显式触发。恢复成功后下一 boundary 自动解除 block。

对应：Q24=B，Q25=B，Q29=B。

---

### ADR-16：Capability telemetry 尽量完整 durable

每次重要 runtime 状态跃迁写 ledger，例如：

```text
readiness-lost
readiness-restored
retry-attempted
retry-failed
mount-started
mount-succeeded
mount-failed
unmounted
```

统一 fact family：

```text
factType = capability-runtime-event
payload.event = <closed discriminator>
```

每条 ledger fact 正常推进 `team_sessions.generation` / `durableGeneration`。本轮不提前设计高频 flap 压缩。

对应：Q28=A，Q51=A，Q58=B。

---

### ADR-17：Recovery 是派生状态，不是 durable flag

Recovery 状态由 fresh requirements + readiness + applicability/materialization 计算，不存 `team.mode=RECOVERY` authority flag。

可写：

```text
recovery-incident-opened
recovery-incident-closed
```

用于 audit/correlation，但 incident 不决定 Recovery。

对应：Q48=B，Q59=B。

---

### ADR-18：Required outage 的运行语义

- 已经开始的工作不被追溯取消；
- 下一 applicable boundary 才阻塞；
- Team-level required outage：所有 **normal work** 暂停，仅 recovery/control/diagnostic/lifecycle 路径可用；
- template-level required outage：只阻止该模板的 normal work；
- Human 可直接唤醒受影响 Member 的 recovery turn；
- Recovery Member 即使自身 required MCP 缺失，也可使用其他仍被原权限允许的能力进行取证/修复。

核心安全不变量：

```text
RecoveryAuthority ⊆ NormalAuthorizedSurface - UnavailableCapabilities
```

故障只允许减能力，绝不能扩权。

对应：Q22=B，Q30 refinements，Q38=A，Q40=A，Q41=B。

---

### ADR-19：Recovery Leader 可委派恢复工作，但每次都要 Human Review

Leader 自身 required capability 缺失时可进入 Recovery Turn。

允许：

- read/inspect/collect/pending-control；
- recheck/diagnostic；
- lifecycle/control；
- 原本就有权使用的本地恢复能力；
- 向 Member 下发 recovery work。

但**任何导致另一个 Agent 开始新执行的 operation**（至少 delegate/follow-up，未来其他同等 effect 也一样）必须同步 Human Review；不能只按工具名做白名单。

每一次真实执行尝试都重新审批，不复用上一次批准。

对应：Q30a=C'，Q35=B，Q36=B，Q42=A。

---

### ADR-20：Control 泛化为统一 durable decision plane

复用并泛化现有 Control，而不是新建第二套 HumanReview service。

内部 canonical subject：

```text
instance | template | team
```

旧 `targetInstanceId` ledger rows/API 通过 adapter 归一化成 instance subject。

Control 支持两种 execution coupling：

1. deferred guarded approval：现有 parameter-permission，保留 operationFingerprint / guard / allow-consumed；
2. inline reviewed invocation：Recovery work dispatch，同一调用栈等待 Human 审核完整 frozen payload；不要求 fingerprint 作为 authority。

Recovery wait 取消/断线时：durably close/abandon 本次 request，zero effect；下一次 attempt 必须新审批。

对应：Q37 revised，Q44=B，Q45=A'，Q46=B，Q54=B。

---

### ADR-21：Recovery 退出完全机器判定

不做 NLP “这是不是恢复工作”的判定。

是否恢复 normal mode只取决于 fresh Blueprint requirement evaluation 与 applicable materialization。

恢复发生在下一 execution boundary，不修改当前 recovery turn。

对应：Q39=B，Q43 clarification。

---

### ADR-22：Recovery audit 保存完整 reviewed payload

Recovery approval ledger 保存完整 normalized reviewed payload、digest、decision、principal、time、incident correlation。

digest 是审计证据，不是 authorization identity。

对应：Q44=B。

---

### ADR-23：Runtime enforcement 是本轮安全边界

本轮不要求拼装 recovery-specific preset 或隐藏所有不允许工具。

若模型调用 recovery mode 下不可直接执行的 operation，runtime typed-reject，并返回明确的 model-facing 提示，要求停止重复尝试并继续不依赖该 operation 的工作。

未来可增加 model-visible surface contraction 作为 defense-in-depth。

对应：Q52=A，Q53=B。

---

### ADR-24：PR #22 不合并，语义由新架构吸收

PR #22 当前方向中“preset id ≠ persona kind”的核心判断保留为回归 invariant，但现实现不合并，因为它：

- 收紧 Blueprint v1 validator，破坏旧 frozen snapshot；
- 未收敛 pre-probe / post-create / actual mount / persona overlay 多事实源；
- 混淆 RequiredPersonaKind 与 ObservedPersonaKind；
- 动态 disabled 解析存在 false OPEN；
- host resolver failure 与 capability verdict 混淆。

重构从当前 master 开始；PR-C 收敛 actual runtime substrate authority；PR-E 在 Blueprint v2 上重新实现 persona requirement semantics，并移植 #22 的 real-host regression。

对应：Q55=C*。

> 设计收口：`ObservedPersonaKind = absent | standard | complete | unresolved`；Blueprint v2 的 requirement 与 observed kind 分离。当前目标 Team persona requirement 推荐只允许 `standard`（composable substrate）；若实现前决定支持其他 required kinds，必须另立小 ADR 与兼容矩阵，不能复用 `available=false` 来同时表达“观察到该 kind”和“不兼容”。

---

### ADR-25：PR 组织原则

采用约 6 个顺序 PR。每个 PR 的合并标准是：

> **发生有意义的架构变化，同时 master 在该 PR 合并后仍然可以正常使用。**

不得合并“必须等下一个 PR 才恢复可用”的半状态。

内部兼容 shim 只允许存在于边界 adapter；迁移完成后删除内部旧 API。

对应：Q56=B，Q57=A。

---

### ADR-26：测试采用分级 real-host gate

不是每个纯 contract PR 都跑全量 host，也不把所有 host 风险推迟到最后。

- pure contract：typecheck/build/full unit；
- 首次触碰真实 runtime seam：必须有 focused real-host；
- 最终 closure：full restart/concurrency/outage/browser/zero-core battery。

对应：Q60=C。

---

## 4. Grilling Decision Ledger

| Q | 决策 |
|---|---|
| Q1 | B — Alpha-level compatibility |
| Q2 | A — TeamDomain v2 frozen |
| Q3 | B — preserve v1–v6 wire; internal de-versioning |
| Q4 | B — truthful contraction |
| Q5 | B — GovernanceMutationService |
| Q6 | A — one logical authority, multiple durable families |
| Q7 | B — Control independent |
| Q8 | A — ArtifactReadGrant independent |
| Q9 | A — frozen authority hierarchy; PolicyState durable-before-ack |
| Q10 | B — capability-native boundaries |
| Q11 | B — no retroactive cancellation of entered effects |
| Q12 | C — Committed vs Applied |
| Q12a-1 | B — Policy/Supply/Readiness/Materialization separated |
| Q12a-2 | C — explicit required/optional semantics |
| Q13 | C — shared team chain + optimistic generation |
| Q14 | B — reset via new-generation tombstone/reissue |
| Q15 | B — desired-state idempotence |
| Q16 | B — Team + per-template requirements |
| Q17 | B — readiness is observation, not authority |
| Q18 | B — MutationService → pure kernels |
| Q19 | B — one EffectivePolicyReader |
| Q20 | B — current readiness/materialization ephemeral |
| Q21 | startup consent; runtime automatic degradation |
| Q22 | B — existing work settles; next boundary blocks |
| Q23 | B' — requiredness only at applicable boundary |
| Q24 | B — per-server MCP convergence |
| Q25 | B — boundary retry + manual recheck + cooldown |
| Q26 | C — CapabilityReadinessProvider |
| Q27 | B — consent survives restart for same immutable requirement |
| Q28 | A — record every meaningful outage/recovery event |
| Q29 | B — automatic unblock on successful next boundary |
| Q30 | refined into principal/action-impact gating |
| Q30a | C' — human-reviewed recovery delegation |
| Q31 | B + two-stage readiness check |
| Q32 | B — DegradationConsent is distinct durable semantic |
| Q33 | A — preflight all templates |
| Q34 | C — required failure: fix or disable template |
| Q35 | B — runtime-enforced Recovery profile |
| Q36 | B — approve by work effect, not only tool name |
| Q37 | inline synchronous payload review; no fingerprint authority requirement |
| Q38 | A — do not pre-reject degraded recovery Member |
| Q39 | B — exit Recovery on next boundary |
| Q40 | A — Team-level required failure pauses all normal work |
| Q41 | B — Human may directly enter Member recovery |
| Q42 | A — every recovery dispatch attempt reapproved |
| Q43 | machine requirement validation decides recovery; Human decides dispatch |
| Q44 | B — persist full reviewed payload + digest |
| Q45 | A' — generalize Control decision plane |
| Q46 | B — abort → durable close, zero effect |
| Q47 | B — explicit recheck + Human re-enable template |
| Q48 | B — durable recovery incident for audit only |
| Q49 | B — Blueprint v2 + v1 reader |
| Q50 | B — Requirement Authority owns consent/template availability |
| Q51 | A — telemetry advances durableGeneration |
| Q52 | A — post-gate subagent issue deferred |
| Q53 | B — runtime-only enforcement this round |
| Q54 | B — additive Control subject normalization |
| Q55 | C* — do not merge PR #22; absorb semantics |
| Q56 | B — ~6 PR, each merge leaves plugin usable |
| Q57 | A — no long-lived internal compatibility shims |
| Q58 | B — one capability-runtime-event family |
| Q59 | B — Recovery is derived, no durable mode flag |
| Q60 | C — tiered real-host validation |

---

## 5. Explicitly Deferred

以下项目不进入本次 merge-ready 判据：

1. post-gate `subagent` / `subagent_fork` surface contraction；
2. recovery-specific preset composition / model-visible surface slimming；
3. full Alpha.3 dynamic operation-permission mutation；
4. Blueprint permission/governance UI；
5. high-frequency capability flap compression / sampling / retention policy；
6. general asynchronous recovery approval continuation；
7. TeamDomain v3；
8. upstream DSH changes。

这些延期不允许削弱本轮 runtime authority：**surface 可晚做，execution gate 不能晚做。**
