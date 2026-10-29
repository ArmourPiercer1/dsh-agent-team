# dsh-agent-team Pre-Alpha.3 详细重构工作计划

> 基线：`master = e22c659a8f919710b99dd1c1bd737ea44c1da5aa`
>
> PR #22：不合并；作为 PR-C / PR-E 的设计输入与 regression donor。
>
> 目标：6 个顺序 PR；**每个 PR 合并后 master 上插件仍可使用**。
>
> 原则：任何 PR 如果只能形成“等后续 PR 才恢复可用”的半状态，则不得合并；应在分支上继续完成或重新切分。

---

# 0. 全局门禁与工作方式

每个 PR：

1. 从最新 merged master 新建 branch/worktree；
2. 不在未合并的前序 feature branch 上长期堆叠；
3. CORE PATCH BUDGET = 0；
4. test-use upstream checkout 前后 porcelain 必须为空；
5. build/generated dist 与 source 同 commit；
6. 新 durable fact/type 更新 scanner/category/client mirrors；
7. 新行为必须有 typed negative；
8. 任何首次触碰真实 DSH runtime seam 的 PR 必须提供 focused real-host evidence；
9. full-suite 的既有失败必须做 baseline-diff，不以“总数差不多”替代 failure-set comparison；
10. 合并前记录 tested commit SHA 与 evidence commit。

推荐顺序：

```text
PR-A Governance convergence
   ↓
PR-B EffectivePolicy + durability/boundaries
   ↓
PR-C Runtime Environment / Readiness / MCP
   ↓
PR-D Control generalization
   ↓
PR-E Blueprint v2 + Requirement / Recovery atomic cutover
   ↓
PR-F Cleanup / remote internal convergence / final closure
```

执行状态（2026-09-29 主代理簿记，权威 = graph.yaml + SESSION_ROUTER_LOG.md）：PR-0（test-infra 基线修复）= PR #37 @ `ceefca20` OPEN（base master `11ae0c57`）；PR-A（Governance convergence，§A）= PR #38 @ `aa8391ac` OPEN（分支链基线 = PR-0 tip，本 PR 含 tombstone 感知的 `override.get` 修正 + focused real-host smoke PASS + 全套件 9F|19F|4226P 零新增）；PR-B（Effective-Policy 规范读平面 + C3 写侧 root-stamping 生产修正，§B）= PR #39 @ `10add920` OPEN（base = PR-A 分支 `feat/pre-alpha3-pra-governance-authority` @ `aa8391ac`，本 PR 含 `packages/runtime/effective-policy/` 唯一装配入口 + 全量生产消费者改道 + C3 修正（3 行，被寻址 root 穿过 commit 端口）+ real-host smoke §B.4 全 6 准则 PASS（C3 正例 C3a global-default→C3b prb-c3-strict）+ 全套件 9F|19F 零新增 + 12 新测试）；PR-C（Runtime Environment / Readiness / MCP，§C：C.2 运行环境统一 / C.3 ObservedPersonaKind 四态 / C.4 就绪探针 / C.5 统一能力状态 / C.6 逐-server MCP 隔离（headline，一个失败 server 隔离不回滚健康 fiber）/ C.7 持久 capability-runtime 遥测）= PR #40 @ `d7a797b2` OPEN（base = PR-B 分支 `feat/pre-alpha3-prb-effective-policy` @ `12bb015b`，全 gate 绿零新增 + 38 新测试；C.10 real-host mini-MCP gate + observePersonaKind 生产探针 = follow-ups）；PR-D（Control 平面泛化，§D：D.2 ControlSubject instance|template|team / D.3 review payload + executionCoupling / D.4 guarded+inline 耦合 + control-request-abandoned）= PR #41 @ `0a25dc8c` OPEN（base = PR-C 分支 `feat/pre-alpha3-prc-runtime-env` @ `a888c570`，全 gate 绿零新增 + 43 新测试）；PR-E（Blueprint v2 + Requirement/Recovery 原子切换，§E，产品语义切换 PR，最重增量）在 PR-D 基线上继续（已启动）。**PR-C 后续项 C.10 real-host mini-MCP gate 已完成**（7/7 PASS，commit `b3da27a1` @ PR #40 tip，证据 `evidence/pre-alpha3-refactor/pr-c/prc-mcp-.../` 已 scrub；发现 C.6 逐-server retry 仅在 `prepareAgentForRequest` 请求边界触发 = 设计非 bug）。merge 裁决 = 用户（本轮不代行）；PR #22 不 merge（留后续吸收，PR-E E.3 吸收其正确意图）。

---

# PR-A — Governance Mutation Authority Convergence

## A.1 目标

建立唯一 production `GovernanceMutationService`，消除：

```text
MutationService.requestMutation
vs
admitGovernanceOverride
vs
remote override handlers
```

之间的 authority 分叉。

**合并后插件可用：YES。**
用户行为应基本等价；主要是 durability/concurrency correctness 提升。

## A.2 主要修改

### 新增/重组

建议新增：

```text
packages/runtime/governance/
  service.ts
  types.ts
  errors.ts
  effective-input.ts        # 若需要共享纯输入组装
  index.ts
```

或在现有 `runtime/mutation/` 内明确拆成：

```text
kernel/*
governance-service.ts
persistence/*
```

重点是 public naming 不再让 `MutationService` 与 production authority 并存。

### 复用 pure kernels

从：

```text
packages/runtime/mutation/envelope.ts
packages/runtime/mutation/cell-provenance.ts
packages/runtime/mutation/service.ts
```

提取/保留：

- envelope projection/check；
- provenance；
- escalation validation；
- external-hard validation；
- PolicyState legality；
- effective resolver inputs。

### Persistence primitive

`packages/runtime/mutation/override-admission.ts`

改为窄 persistence primitive，例如：

```text
persistGovernanceOverride(...)
```

它不再做完整 logical admission，也不暴露给 remote/tools。

### Production wiring

重点修改：

```text
packages/runtime/src/plugin/root.ts
packages/runtime/src/plugin/types.ts
packages/runtime/src/plugin/durable-mutation-store.ts
packages/runtime/src/plugin/s6-remote.ts
packages/remote/src/handlers/override.ts
packages/remote/src/handlers/policy-state.ts
packages/remote/src/handlers/ports.ts
```

所有 write path 统一：

```text
remote/tool
→ GovernanceMutationService
→ shared TeamOperationChain
→ TeamDomain
```

### Semantics

实现：

- expectedGeneration optimistic guard；
- desired-state no-op；
- reset = higher-generation full-slot tombstone/reissue；
- PolicyState commit-before-ack；
- member self mutation only own instance；
- Human / Leader origin semantics；
- External Hard unbeatable。

## A.3 必须新增/改动测试

### 新 tests

建议：

```text
packages/runtime/test/governance-mutation-authority.test.ts
packages/runtime/test/governance-concurrency.test.ts
packages/runtime/test/governance-idempotence.test.ts
packages/runtime/test/governance-reset-tombstone.test.ts
packages/runtime/test/governance-restart.test.ts
```

覆盖：

1. same-slot concurrent model/MCP updates serialize，无 lost update；
2. stale `expectedGeneration` typed conflict；
3. same desired state 重试不写新 generation；
4. reset 不 delete history；
5. restart 后 winner 精确一致；
6. External Hard 阻断 Human/Leader/Member；
7. invalid envelope 在 durable write 前失败；
8. PolicyState same-state no-op；
9. commit fault 不返回 success；
10. member cross-instance mutation fail closed。

### 改现有测试

重点：

```text
p7t2-override-precedence
p7t2-escalation
p7t2-policy-state
p8s5b-operation-fencing
p8s6-remote-commands
p8s7r2-policy-state-durable
```

把测试依赖从旧 service/public persistence 迁到新 authority。

## A.4 Real-host gate

Focused governance smoke：

- Human override model/MCP；
- restart 后仍在；
- concurrent two-tab/set；
- stale expected generation；
- reset 后旧记录保留；
- current master Remote wire 行为不回归。

## A.5 退出条件

- production write authority grep 证明只有 GovernanceMutationService；
- `admitGovernanceOverride`/primitive 无 remote/tools 直接 caller；
- PolicyState ack 前 durable；
- full unit failure-set 不增加；
- focused host PASS。

---

# PR-B — EffectivePolicy / Boundary / Durability Convergence

## B.1 目标

建立一个 canonical `EffectivePolicyReader`；移除 production fake StepClock 与 ephemeral mutation truth。

**合并后插件可用：YES。**

## B.2 主要修改

### 新 canonical reader

建议：

```text
packages/runtime/effective-policy/
  reader.ts
  types.ts
  derive-model.ts
  derive-mcp.ts
  index.ts
```

或放在现有 policy-adapter 周边，但必须有唯一 public read entry。

输入：

```text
rootSessionId
instanceId
bound Blueprint
PolicyState durable facts
override winners
External Hard facts
```

输出：

```text
EffectivePolicy
provenance
committedGeneration
```

### 替换 consumer

修改：

```text
packages/runtime/src/plugin/effective-config-view.ts
packages/runtime/src/plugin/live/agent-bindings.mjs
packages/runtime/activation/provider.ts
packages/runtime/action-router/effects.ts
packages/runtime/agent-setup/model/**
packages/runtime/agent-setup/capability/mcp-facet.ts
```

以及任何 `resolveActivationPolicy()` / `resolveDurableModelSelection()` / `resolveDurableMcpFacet()` 自行 assemble policy 的路径。

目标：

```text
consumer = derive(canonical EffectivePolicy)
```

而不是 consumer 自己读 stores。

### 移除 production StepClock

修改：

```text
packages/runtime/mutation/service.ts
packages/runtime/mutation/types.ts
packages/runtime/src/plugin/root.ts
packages/runtime/src/plugin/effective-config-view.ts
```

删除 production：

```text
currentStep: () => 0
beginStep authority
effectiveFromStep runtime semantics
```

legacy record 中旧 step 字段可继续 parse/display，但不再成为 production effective decision source。

### Committed / Applied

model/MCP runtime view 统一表达：

```text
committed
applicationStatus
pendingNextBoundary
applied provenance
```

不把 “effectiveFromStep=1” 继续呈现成真实 runtime 时间。

## B.3 测试

### 新 tests

```text
effective-policy-single-source.test.ts
effective-policy-policy-state-live.test.ts
boundary-committed-applied.test.ts
restart-effective-policy.test.ts
```

### 重点修改

```text
p7t2-future-boundary.test.ts
p7t2-policy-state.test.ts
p8s7r2-effective-config.test.ts
p8s4b-mcp-facet.test.ts
model-activation-step8.test.ts
model-blueprint-initial-routing.test.ts
mcp-blueprint-initial-grant.test.ts
```

新增关键断言：

1. PolicyState 改变 model/MCP live consumption；
2. inspect 与实际 request surface 同源；
3. in-flight request 不被 retroactive mutation 改写；
4. next request 使用新 committed policy；
5. restart 后没有 process-local policy truth；
6. model/MCP materialization failure 不回滚 governance intent。

## B.4 Real-host gate

至少覆盖：

- model override → next request；
- MCP override → next request；
- PolicyState switch → next request；
- mutation 与 concurrent request；
- restart；
- inspect-config 与 model/MCP wire 一致。

## B.5 退出条件

- production `StepClock` 无 authority caller；
- effective policy assembly 单入口；
- process-local MutationStore 不承担 production truth；
- host smoke PASS。

---

# PR-C — Runtime Environment / Readiness / MCP Convergence

## C.1 目标

建立真实运行环境 authority，为 PR-E requirements/recovery 做 substrate；同时修复 MCP all-or-nothing materialization。

**合并后插件可用：YES。**
本 PR **不启用完整 required/optional Recovery cutover**，避免半完成 gating。

## C.2 RuntimeSubstrateResolver

新增 server-side resolver，统一实际 mount 与 environment observation。

负责：

- Leader 使用的 actual preset；
- Member 使用的 actual preset；
- persona observed kind；
- model/provider supply；
- MCP supply。

重点消除 PR #22 暴露的四事实源：

```text
UI arbitrary preset
row environmentFacts
rootPresetId/memberPresetId actual mount
hardcoded persona substrate
```

当前若真正 mount authority 是：

```text
config.rootPresetId
config.memberPresetId
```

则 preflight/compatibility 必须消费同一 plan。UI 不得继续暗示一个不会进入 creation/mount 的 preset selector 是 authority。

修改重点：

```text
packages/runtime/src/plugin/host.ts
packages/runtime/src/plugin/root.ts
packages/runtime/src/plugin/live/agent-bindings.mjs
packages/runtime/agent-setup/persona/**
packages/runtime/agent-setup/preset/**
```

PR #22 的 `persona-kind-of` 可参考，但不要直接 cherry-pick其 authority wiring。

## C.3 Persona observed state

新增/冻结：

```text
ObservedPersonaKind =
  absent | standard | complete | unresolved
```

`unresolved` 用 typed host/probe failure，不转成普通 incompatibility。

动态 disabled 无法求值时：

- 首选消费 DSH effective composition；
- 否则 unresolved fail closed；
- 禁止“条件 disabled 当 enabled → standard”造成 false OPEN。

## C.4 CapabilityReadinessProvider

建议新增：

```text
packages/runtime/readiness/
  provider.ts
  registry.ts
  telemetry.ts
  types.ts
  errors.ts
  index.ts
```

接口概念：

```text
probe(capabilityType, name)
→ unknown | reachable | unreachable
```

observation 含：

```text
source
observedAt
reason
```

## C.5 Runtime status

实现统一 current status：

```text
policy
supply
readiness
materialization
```

Materialization：

```text
not-applicable | pending | mounted | failed
```

当前状态 ephemeral。

## C.6 MCP reconcile 重写

修改：

```text
packages/runtime/src/plugin/mcp-supply.ts
packages/runtime/src/plugin/live/agent-bindings.mjs
packages/runtime/agent-setup/capability/mcp-facet.ts
```

目标：

- deny-first；
- per-server mount transaction；
- 一个 optional/失败 server 不回滚其他健康 server；
- failure slot per server；
- boundary retry + cooldown；
- manual recheck seam；
- cold member = not-applicable，不假造 failure。

## C.7 Durable telemetry

新增：

```text
capability-runtime-event
```

closed event vocabulary。

修改：

```text
packages/runtime/src/plugin/projection-source.ts
packages/client/src/model/ledger-adapter.ts
packages/client/src/model/team-ledger-model.ts
contracts ledger category mirrors/tests
testkit scanners/pins
```

category 推荐 `compatibility`。

每条 fact 正常推进 durableGeneration。

## C.8 PR #22 regression donor

把 #22 的核心 bug 转成 characterization tests，但不启用 v2 requirement cutover：

- `ptc` observed = standard/composable；
- `minimal` observed = complete；
- bare/no persona = absent；
- dynamic-unresolved = typed unresolved；
- actual mount preset == observed substrate source。

## C.9 Tests

新增：

```text
runtime-substrate-resolver.test.ts
persona-observed-kind.test.ts
capability-readiness-provider.test.ts
capability-runtime-status.test.ts
capability-telemetry.test.ts
mcp-independent-convergence.test.ts
mcp-retry-cooldown.test.ts
mcp-cold-not-applicable.test.ts
```

修改：

```text
multi-mcp-wiring.test.ts
u6-mcp-017-regression.test.ts
mcp-blueprint-initial-grant.test.ts
p8s4b-mcp-facet.test.ts
s6t-live-token.test.ts   # 只确认 telemetry 与 live token 语义不串线
```

## C.10 Real-host gate

真实 mini-MCP：

1. A/B/C 三 server，C down → A/B 保持 mounted；
2. C 恢复 → next boundary 自动 mount；
3. restart → readiness unknown，重新 probe；
4. telemetry lost/retry/restored 顺序与时间/attempt 正确；
5. durableGeneration 随 ledger event 前进；
6. persona actual preset 与 observed substrate 同源；
7. old Alpha.2 normal workflow 仍能工作。

---

# PR-D — Control Plane Generalization

## D.1 目标

把 Control 从 instance-only approval 服务泛化为统一 durable decision plane，为 Recovery inline Human Review 提供 substrate。

**合并后插件可用：YES。**
现有 parameter-permission / Remote v4 行为不变。

## D.2 Canonical subject

新增：

```text
ControlSubject =
  instance | template | team
```

修改：

```text
packages/runtime/control/types.ts
packages/runtime/control/service.ts
packages/runtime/control/errors.ts
packages/runtime/control/index.ts
```

legacy parser：

```text
targetInstanceId → subject(instance)
```

旧 durable rows 不迁移。

## D.3 Review payload

扩展 request record：

```text
reviewPayload?
reviewPayloadDigest?
executionCoupling?
```

要求 Remote/UI 能 lossless 展示 Recovery reviewed invocation。

旧 request 没有这些字段时保持 legacy semantics。

## D.4 两种 coupling

### Guarded

现有：

```text
request → wait → decision → guard → consume → execute
```

保持。

### Inline

新增：

```text
request → wait → decision
allow → current frozen invocation continue
deny → zero effect
abort → durable abandon/close → zero effect
```

建议新增 additive close fact：

```text
control-request-abandoned
```

而不是物理删除 request。

request state：

```text
pending | decided | abandoned
```

## D.5 Tests

新增：

```text
control-subject-normalization.test.ts
control-template-subject.test.ts
control-team-subject.test.ts
control-inline-review.test.ts
control-inline-abandon.test.ts
control-review-payload-roundtrip.test.ts
control-legacy-row-compat.test.ts
```

修改/保留绿：

```text
p6t4-allow-once
p6t4-deny
p6t4-restart
a4a-control-exact-scope
a5a-pre-execute
f9-control-exactly-once
c1-production-wiring
c1-restart-recovery
f9-remote-v4
```

关键 negative：

- template subject 不能被 instance stale validator 错杀；
- old instance rows 解析字节语义不变；
- inline allow 不自动产生 `control-allow-consumed`；
- abort 后旧 allow/decision 不得执行 operation；
- external hard 仍不可绕过；
- Human-only recovery review resolver。

## D.6 Real-host gate

- 现有 leader/member permission ask 路径不回归；
- Remote v4 allow/deny 不回归；
- template-target inline request 能创建/展示/resolve；
- abort/断线后 durable abandoned，zero effect；
- restart 能读取 abandoned/history。

---

# PR-E — Blueprint v2 + Requirement / Recovery Atomic Cutover

## E.1 目标

这是产品语义切换 PR。必须原子完成，不能拆成“先 block、后 recovery”。

**合并后插件可用：YES。**
但行为从旧 compatibility 模型正式切换到新 requirement/recovery 模型。

## E.2 Blueprint schema v2

修改：

```text
packages/domain/blueprint/src/schema.ts
packages/domain/blueprint/src/types.ts
packages/domain/blueprint/src/validate.ts
packages/domain/blueprint hash/canonical projection
catalog tests
authoring skill
```

支持：

```text
Team requirements
Leader requirements
MemberTemplate requirements
```

v1 reader 继续按旧 closed schema 解析。

必须新增 frozen v1 regression：

```text
bespoke persona preset id v1
→ freeze
→ new code resolveSnapshot/cold resume
→ SAME hash / success
```

禁止在 v1 validator 中收紧成 v2 规则。

## E.3 Persona requirement 正式修复

吸收 PR #22 的正确意图。

要求：

- RequiredPersonaKind 与 ObservedPersonaKind 分离；
- preflight / post-create / actual mount / persona overlay 共用 RuntimeSubstrateResolver；
- `ptc` composable regression；
- complete/bare/unresolved honest diagnostics；
- host service failure typed；
- no false OPEN on unresolved dynamic disabled。

建议当前 v2：

```text
RequiredPersonaKind = standard
```

若实现时要支持 `absent/complete` 为 required value，必须先追加独立 ADR 与 compatibility matrix。

## E.4 RequirementAuthority

建议新增：

```text
packages/runtime/requirements/
  authority.ts
  evaluator.ts
  startup-preflight.ts
  consent.ts
  template-availability.ts
  recovery.ts
  action-impact.ts
  facts.ts
  types.ts
  errors.ts
  index.ts
```

负责：

- Team/template requirements；
- startup all-template preflight；
- DegradationConsent；
- template disable/enable；
- derived Recovery；
- action requirement impact。

## E.5 Durable facts

新增至少：

```text
optional-requirement-accepted
template-availability-set
recovery-incident-opened
recovery-incident-closed
```

更新 ledger category/client mirror/testkit pins。

## E.6 Startup preflight

创建 Team 前：

```text
evaluate ALL Team + Leader + MemberTemplate requirements
```

结果：

### optional missing

UI/command 必须得到 Human consent。

### required template missing

Human：

```text
fix + recheck
OR
disable template
```

### Team-level required missing

不允许通过 disable 某 template 绕过。

## E.7 Action-impact gating

给 `ACTION_SPECS` 或相邻 registry 增加明确的 requirement impact metadata。

禁止仅按 `ActionCategory` 判断。

实现：

- normal model turn；
- follow-up；
- delegate；
- create-member；
- wake-like send-message；
- pure coordination；
- lifecycle；
- control；
- read/inspect。

## E.8 Recovery behavior

### Team-level required down

```text
normal work = block
recovery work = allow
control/diagnostic/lifecycle = allow
```

### Template-level required down

```text
affected normal work = block
affected recovery turn = allow on reduced original authority
unaffected template = normal
```

### Optional runtime down

```text
auto degraded
normal work continues
telemetry writes
```

## E.9 Recovery Leader / Member

Recovery runtime enforcement only，本轮不要求 model-visible surface contraction。

跨 Agent 新 work effect：

```text
→ generalized Control user-approval
→ synchronous wait
→ Human sees complete normalized payload
→ allow THIS invocation
→ deny zero effect
→ abort durable abandoned zero effect
```

每一次 attempt 新审批。

Member 即使同样缺 required MCP，也可被启动 recovery；不可用 MCP 缺失，其他 read/bash/etc 按原权限运行。

## E.10 Recovery exit

fresh requirement evaluation PASS；
需要 materialization 的 applicable capability成功；
从**下一 boundary**恢复 normal。

不写 durable Recovery flag。

## E.11 Tests

### Blueprint / compatibility

```text
blueprint-v1-frozen-resume.test.ts
blueprint-v2-template-requirements.test.ts
blueprint-v2-hash.test.ts
persona-requirement-v2.test.ts
persona-runtime-substrate-equality.test.ts
```

### Startup

```text
startup-preflight-all-templates.test.ts
degradation-consent.test.ts
template-disable-enable.test.ts
startup-required-team-fatal.test.ts
```

### Runtime / Recovery

```text
requirement-applicability.test.ts
team-required-recovery.test.ts
template-required-recovery.test.ts
optional-runtime-degradation.test.ts
recovery-member-reduced-authority.test.ts
recovery-leader-dispatch-review.test.ts
recovery-dispatch-deny-zero-effect.test.ts
recovery-dispatch-abort-zero-effect.test.ts
recovery-exit-next-boundary.test.ts
```

### Authority negatives

必须有：

1. cold member required MCP + mounted false ≠ blocked；
2. Recovery 不把 bash ask 变 allow；
3. Recovery 不把 write deny 变 ask；
4. external-hard 仍绝对；
5. Team-level required down 不允许普通 delegate；
6. recovery delegate 必须 human-only；
7. model retry forbidden operation typed guidance；
8. consent 不等于 governance allow；
9. template disable 不等于 policy deny；
10. restart 后 consent/disable 保留，readiness 重置 unknown。

## E.12 Real-host / browser gate

这是本轮最重 focused validation：

- startup all-template matrix；
- optional consent；
- required template disable；
- Team-level required outage；
- Leader required MCP down → Recovery；
- Human-reviewed delegate；
- degraded Member controlled bash 修复服务；
- service restored → next boundary NORMAL；
- exact reviewed payload UI；
- deny/close/abort zero effect；
- restart；
- PR #22 original `ptc` bug regression；
- old v1 frozen Blueprint cold resume；
- dual-Team isolation。

---

# PR-F — Internal API Cleanup / Remote Convergence / Final Closure

## F.1 目标

删掉过渡抽象、文档漂移和内部版本噪声，完成 merge-ready closure。

**合并后插件可用：YES。**

## F.2 删除旧内部 authority

删除/收缩：

- production `MutationService` class；
- production StepClock；
- direct `admitGovernanceOverride` callers；
- fake generic `permissions` = operation permission 描述；
- “五域 dynamic 都已 production materialized”的陈旧 claim；
- duplicate effective policy assembly；
-长期 internal compatibility shims。

pure kernels 可保留并改名。

## F.3 Internal Remote de-version

wire 保留 v1–v6，但内部 service/client API 使用 semantic method names。

版本 adapter 集中在：

```text
packages/remote/contracts
packages/remote/dispatch/transport adapter
client remote wrapper boundary
```

禁止 runtime/client core 到处出现 `V3/V4/V5/V6` 语义分支。

## F.4 Read surfaces

对齐：

```text
team_inspect_config
effective-config
runtime capability status
requirement/recovery state
Control review payload
ledger events
```

确保 UI 显示与 runtime authority 同源。

## F.5 Docs

更新：

```text
docs/STATUS.md
Architecture / Development Plan
INSTALL.md
team-blueprint-authoring skill
team-leader-operations skill
migration/reuse notes
```

明确 deferred：

- post-gate subagent surface expansion；
- recovery preset/surface contraction；
- Alpha.3 dynamic permission grants；
- telemetry flap/retention；
- async recovery continuation。

## F.6 Final test battery

### Static / package

- typecheck all；
- build all；
- build:composition；
- check:artifacts；
- lint baseline diff；
- p4t6/session-event scanner；
- p6t6 bypass scan；
- zero-core。

### Full unit/integration

要求：

```text
new failure count = 0
failure set ⊆ recorded baseline debt
```

并对并发/重启相关 flaky suite 独立多次复跑。

### Real-host

至少：

1. normal Alpha.2-style team create/delegate；
2. Governance mutation + restart；
3. PolicyState + restart；
4. multi-MCP A/B healthy C down；
5. MCP restore；
6. startup optional consent；
7. startup required template disable；
8. Team-level required outage Recovery；
9. Leader Recovery + Human reviewed dispatch；
10. affected Member controlled bash recovery；
11. cancel approval → durable abandoned；
12. v1 frozen Blueprint cold resume；
13. v2 Blueprint create/resume；
14. persona `ptc` regression；
15. dual Team isolation；
16. spill ArtifactReadGrant regression；
17. Remote v1–v6 compatibility；
18. browser Team tab / ledger / pending review；
19. current surface includes possible `subagent` but forbidden runtime action remains fail-closed where applicable；
20. no upstream modification.

### Long-ish unattended smoke

建议至少运行一个模拟长期 Team：

- optional MCP 在运行中 down/recover；
- normal work 不中断；
- telemetry 完整；
- required MCP down → Recovery；
- Human recovery；
- restore → Normal；
- restart 后恢复 durable consent/governance，但 readiness fresh probe。

---

# 7. PR 可用性矩阵

| PR | Merge 后插件是否可用 | 是否启用新产品语义 | 主要风险 |
|---|---:|---:|---|
| A | YES | 否，治理行为等价 | mutation concurrency / persistence |
| B | YES | 小幅：真实 boundary/状态更诚实 | policy read convergence |
| C | YES | MCP 更健壮、增加诊断 | runtime seam / MCP lifecycle |
| D | YES | Control substrate additive | old control compatibility |
| E | YES | **YES：Blueprint v2 + Recovery 正式 cutover** | 最大产品语义切换 |
| F | YES | 无新增核心语义，主要收口 | 删除旧 path 导致遗漏 |

规则：

> 如果任一 PR 在其预定 scope 内无法做到 “merge 后可用”，则该 PR 不得合并；可以在 branch 内吸收后续小段工作，而不是把 broken intermediate state 推入 master。

---

# 8. PR #22 处理

当前：

```text
PR #22 OPEN
head d30397b8
```

处理建议：

1. 不 merge；
2. 不继续局部修补；
3. 保留 branch/evidence；
4. PR-C 引用其 runtime persona characterization；
5. PR-E 移植其用户 bug regression；
6. PR-E merge 后关闭 #22 为 superseded；
7. 不 cherry-pick v1 validator 收紧、caller-fact rewrite 等旧 authority 实现。

---

# 9. 最终 Definition of Done

本轮只有同时满足以下条件才结束：

1. production governance write authority 唯一；
2. effective policy read authority 唯一；
3. accepted security/governance mutation durable-before-ack；
4. no production StepClock authority；
5. v1 frozen Blueprint 可恢复；
6. v2 per-template requirements 可运行；
7. requirement / policy / supply / readiness / materialization 分离；
8. cold member 未 mounted 不构成 required failure；
9. MCP per-server failure 不拖垮其他 server；
10. optional startup consent / runtime auto-degrade 正确；
11. required outage Recovery 不扩权；
12. Recovery cross-Agent work Human synchronous review；
13. approval abort zero effect + durable audit；
14. Recovery mode 无第二 durable flag authority；
15. telemetry 完整并推进 durableGeneration；
16. persona preflight 与 actual runtime substrate 同源；
17. Remote v1–v6 保持兼容；
18. old Control rows 保持兼容；
19. restart 精确恢复 durable intent；
20. full host/browser/dual-team/concurrency/zero-core gates 通过。
