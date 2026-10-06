# DSH Agent Team vNext — T+12h Production Vertical Closure 执行计划

**状态：已归档｜T12 Production Vertical Closure 已完成，最终裁决 GO RE-STAMPED（STRENGTHENED）。**  
**真正执行进度：** 基于旧 DSH pin 完成生产 Agent vertical slice；首轮暴露的 360s window latch 已由 T12-V16 修复，最终 `c455c43` 重验通过。剩余失败仅为已记录的 composition-scope / plan-vs-code divergence，不构成阻塞；随后进入 P9。  
**完成时间：** 2026-09-03T09:34:34+08:00（最终提交 `c455c43`）。  
**文档状态**：REVIEW DRAFT V2 / DSH 版本硬钉版 / 可直接交给主 Agent 执行  
**目标阶段**：P8-S7 后的 Production Vertical Closure  
**基线分支**：`int/P8-S-backend-closure`  
**基线提交**：`7d07330cca7bb3df416e3a82359d4307d9ab4a64`  
**时间预算**：T+0 ～ T+12h（wall-clock）  
**唯一最终目的**：在 T+12h 前给出可信的 **GO / REFACTOR / STOP-CANDIDATE** 结论，并以 shipped plugin 的真实 Agent vertical slice 作为主要证据。  
**DSH 第一轮兼容基线**：`0.1.2-alpha.1 @ cd5ef8148158c3a752a658978873241fdf8e2bbc`（HARD PIN）  
**不依赖**：并行 PROTOTYPE worktree 的任何实现、commit、设计决策或测试结果。  
**CORE PATCH BUDGET**：0。

---


# 0A. DSH 兼容性基线 — HARD PIN

> **本版计划的第一轮闭环只针对旧版 DSH。不得在最新 DSH 上执行这一轮 Gate。**

本计划的 DSH host/runtime 基线固定为：

```text
DSH repository:
  ArmourPiercer1/deepseek-harness

OLD_DSH_VERSION:
  0.1.2-alpha.1

OLD_DSH_SHA:
  cd5ef8148158c3a752a658978873241fdf8e2bbc

dsh-agent-team baseline:
  branch = int/P8-S-backend-closure
  SHA    = 7d07330cca7bb3df416e3a82359d4307d9ab4a64
```

vNext 开始时的 upstream audit freeze 已经把 `cd5ef814...` 固定为 DSH 审计基线；该 commit 的 DSH 根版本为 `0.1.2-alpha.1`。

旧 Team 实现的不可变参考 checkpoint 是：

```text
LEGACY_TEAM_REFERENCE_SHA:
  a3ab31992762c5d6560797eabc7e0885a9320ade

branch:
  feat/team-vnext-integration-20260829

tag:
  legacy-agent-team-pre-vnext
```

它同样位于 DSH `0.1.2-alpha.1` 世代。此 SHA 用于后续 legacy asset reuse 对照；它不是本阶段 production host 的替代基线。

截至本计划版本核对时，用户仓库当前 DSH master 已经是：

```text
LATEST_OBSERVED_DSH_VERSION:
  0.1.2-alpha.3

LATEST_OBSERVED_DSH_SHA:
  dd6322d604e00eec1ba5e0c8541159906a21094a
```

旧审计基线到该 master 已前进数百个 commits，且期间包含 alpha.2 / alpha.3 release、plugin inventory / preset scope、connection、session/client 等变动。

因此：

```text
T+0 ───────────────────────── T+12
       OLD DSH ONLY
       alpha.1 @ cd5ef814
               |
               | OLD_DSH_VERTICAL_PASS
               v
       后续独立 Update Adaptation
       alpha.3 @ dd6322d
```

**T+12 的 GO 只能解释为：**

```text
OLD_DSH_VERTICAL_PASS = true
LATEST_DSH_COMPAT     = UNTESTED
```

不得写成：

```text
latest DSH supported
release compatibility PASS
```

---

## 0A.1 为什么必须硬钉 SHA，而不能只写 “0.1.2-alpha.1”

`dsh-agent-team` 自己的 package manifests 没有把所使用的 `@deepseek-ai/*` runtime packages 锁成一个 npm dependency set。

当前 production host 通过 `upstream-resolver.mjs` 从 **实际被挂载的 DSH checkout** 的 workspace links 解析：

```text
@deepseek-ai/dsh-agent
@deepseek-ai/dsh-session
@deepseek-ai/dsh-llm
@deepseek-ai/dsh-mcp-client
...
```

因此如果执行 Agent 使用：

```text
deepseek-harness/master
deepseek-harness/stable
deepseek-harness/original
```

而这些 ref 已经移动到 alpha.3，那么即使 `dsh-agent-team` 自己没有改代码，本轮测试也已经变成 alpha.3 compatibility test。

所以第一轮闭环的兼容性单位必须是：

```text
exact DSH git SHA
```

而不是模糊的 branch name 或 version family。

---

## 0A.2 T+0 新增强制 Version Gate

在运行任何 baseline test、seam probe 或 production E2E 前：

```bash
git -C <OLD_DSH_CHECKOUT> rev-parse HEAD
git -C <OLD_DSH_CHECKOUT> status --short
```

必须得到：

```text
cd5ef8148158c3a752a658978873241fdf8e2bbc
<clean>
```

随后读取该 checkout 的根 `package.json`，版本必须是：

```text
0.1.2-alpha.1
```

建议使用 detached immutable worktree，例如语义上：

```bash
git -C <deepseek-harness-repo> worktree add --detach <OLD_DSH_CHECKOUT> \
  cd5ef8148158c3a752a658978873241fdf8e2bbc
```

具体路径由本地环境决定。

### 禁止

第一轮不得使用：

```text
master
stable
original
任何自动 pull 后的 checkout
0.1.2-alpha.2
0.1.2-alpha.3
```

即使这些版本能够启动，也不能拿它们替代 OLD_DSH Gate。

---

## 0A.3 resolver 也必须指向 OLD_DSH checkout

Version Gate 不能只检查一个“旁边存在”的旧 checkout。

必须证明 production `upstream-resolver.mjs` 真正解析到的 `@deepseek-ai/*` 来自：

```text
OLD_DSH_SHA = cd5ef814...
```

T+0 增加一个 resolution fingerprint：

至少记录以下实际 resolved module/package：

```text
@deepseek-ai/dsh-agent
@deepseek-ai/dsh-session
@deepseek-ai/dsh-llm
@deepseek-ai/dsh-system-prompt
@deepseek-ai/dsh-mcp-client        # 若本基线组合启用
```

并证明其 physical path 属于 `<OLD_DSH_CHECKOUT>`。

如果 resolver 实际落到 alpha.3 checkout：

```text
VERSION_GATE = FAIL
```

不得继续 vertical slice。

---

## 0A.4 所有 seam probe 只查 OLD_DSH_SHA

原计划 T+0～T+0.5h 的：

```text
SP1 persona prompt/setup
SP2 descendant enumeration/drain
SP3 Remote/ConnectionLike mounting
SP4 authenticated caller identity
```

全部增加一条硬规则：

> **第一轮只能从 `cd5ef814...` 的 public API / package docs / generated Cordis API 中寻找 seam。**

即使 alpha.3 新增了更方便的 API，也不得拿来让 alpha.1 Gate 通过。

如果：

```text
alpha.1 public seam missing
alpha.3 public seam exists
```

第一轮结论应写：

```text
OLD_DSH_CORE_SEAM_BLOCKER
LATEST_DSH_HAS_CANDIDATE_SEAM
```

而不是在 T+12 中直接迁移。

---

## 0A.5 Persona seam 的版本核对结果：alpha.1 已经存在公开路径

原计划把 persona → real Agent prompt 作为四个高不确定 seam 之一，这一点需要收紧。

在 `0.1.2-alpha.1 @ cd5ef814...`：

```text
ctx.agents.create/resume(...)
```

已经支持：

```text
setup(agentCtx)
```

并保证 setup 在 Agent / Session publication 和第一次 prompt assembly 前完成。

同时 `@deepseek-ai/dsh-system-prompt` 已明确支持：

```text
agent-scoped prompt section
```

通过 Agent 的 scoped context 注册的 section 只影响该 Agent，并可 shadow global contribution。

因此 T+12 的 M2 不应再先花 60～90min 探索“DSH 有没有 persona seam”。

正确问题缩小为：

```text
现有 Team persona resolver/adapter
        ↓
如何最小地把 resolved persona
接到 agentSetup(agentCtx)
        ↓
agentCtx.systemPrompt.section(...)
```

**不得重新实现 Persona resolver。**

只有当当前 shipped composition 根本没有挂载 `dsh-system-prompt`，或者 Agent setup context 缺失该 public service 时，才升级为 composition blocker。

---

## 0A.6 Core Agent / model-selection seam 的版本核对

旧 alpha.1 已明确提供：

```text
ctx.agents.create()
ctx.agents.resume()
AgentHandle
setup(agentCtx)
followup()
steer()
inject()
cancel()
whenIdle()
Agent.ctx
```

当前 alpha.3 仍保留同一核心 create/resume/setup 形状。

`installModelSelection(agentCtx, ref)` 在 alpha.1 与 alpha.3 的源码 blob 保持一致。

所以第一轮计划中的：

```text
real Agent create/resume
real followup/work delivery
whenIdle
agent-scoped model selection
```

属于 **alpha.1 确认存在的 public seam**，不是根据 alpha.3 倒推出来的接口。

---

## 0A.7 最新版变化如何处理

T+12 内不解决 alpha.3 compatibility。

OLD_DSH vertical PASS 后另开一个有界任务：

```text
UPDATE-ADAPT alpha.1 → alpha.3
```

只审计 Team plugin 实际消费的边界：

```text
1. Cordis plugin loader / row composition
2. injected host services:
   agents
   storageDomain
   sessionPersistence
3. Agent create/resume/setup
4. scoped system-prompt/persona
5. model-selection
6. Session persistence/materialization
7. MCP client
8. Remote / ConnectionLike / host transport
9. plugin inventory / agent preset scopes
10. session event/projection compatibility
```

适配原则：

```text
domain/contracts/storage semantics 不因 DSH 升级重写
优先 adapter/shim
只修改真正变化的 public boundary
```

这一步必须以已经通过的 alpha.1 vertical slice 作为 regression oracle。

---


# 0. 本阶段解决什么问题

本阶段不是“继续完善 P8-S”，也不是新的 broad audit。

本阶段只回答一个问题：

> **当前 P8-S7 代码是否已经具有足够的真实工程价值，使我们值得继续完成 P9，而不是重构 runtime glue 或停止项目？**

因此 T+12h 的核心输出不是新的 coverage matrix、contract freeze 或长篇 evidence，而是：

```text
shipped dsh-agent-team plugin
        ↓
fresh Team creation
        ↓
real Root/Leader DSH Agent
        ↓
real Member DSH Agent / child Session
        ↓
real effective workspace/persona/model/policy
        ↓
real delegate work input
        ↓
real Agent execution/acceptance
        ↓
Team lifecycle/completion durable truth
        ↓
Projection
        ↓
Remote/browser-facing read
```

并额外证明：

```text
handoff identity 不冲突
handoff target 不是“只有 TeamDomain row，没有 Agent”
Remote authority 不能由 browser payload 自封
unknown Error 不泄露 host/internal details
```

---

# 1. 当前代码状态：本计划的真实起点

以下不是规划假设，而是基线 SHA 上的实际代码状态。

## 1.1 production assembly 已经存在，不需要重写插件架构

`packages/runtime/src/plugin/host.ts` 已经：

1. 读取 `config.glueUrl`；
2. 动态加载 production glue；
3. 调用 `glue.createAgentBindings(...)`；
4. 创建 `TeamProductionRoot`；
5. 执行 `builtRoot.boot()`。

所以问题不是“没有 production root”，而是 production root 内部仍有若干错误/冻结 fixture 接线。

**结论：不得重写 Cordis host/plugin composition。**

---

## 1.2 当前真正的 live DSH binding 是

```text
packages/runtime/src/plugin/live/agent-bindings.mjs
```

该文件当前承担：

- root/child `agents.create(...)`
- Agent binder/setup
- model selection
- Team tool exposure
- MCP reconciliation
- Session durability probe
- descendant drain
- child Session identity

因此大量 production semantic gap 集中在这一文件，而不是分散在整个九 package architecture。

---

## 1.3 fresh Root / fresh Member 上层语义已经存在

当前仓库已经有：

```text
packages/runtime/root-binding/*
packages/runtime/activation/provider.ts
packages/runtime/activation/adapter.ts
```

其中 activation adapter 创建 child Session 时已经把：

```text
rootSessionId
instanceId
label
workspace
profile
```

传给 `childSessionFactory.create(...)`。

也就是说，**workspace 在上层已经正确计算并传到了 live binding 边界**。

当前错误只是 `agent-bindings.mjs` 丢掉了 `request.workspace`，转而使用：

```text
process.env.DSH_HOME
```

**结论：M1 是 last-mile glue bug，不允许重写 activation/member provisioning。**

---

## 1.4 Persona resolver/adapter 已经存在

当前：

```text
packages/runtime/agent-setup/persona/adapter.ts
```

已经负责：

- 根据 Team Blueprint / Member snapshot 解析 persona；
- 区分 root/member；
- `complete:true` FATAL；
- install / restore scoped persona。

问题发生在最后一层：

```text
root.ts
  -> promptSurface
  -> promptInstallations: Map
```

只写入内存 Map；

同时：

```text
live/agent-bindings.mjs
```

提供给 binder 的 surface 中：

```text
getInstalledSlots()
installOverlay()
restoreScope()
recordSessionEvent()
```

目前都是 no-op。

**结论：M2 是 persona → real DSH Agent prompt 的 last-mile public-seam binding 缺失。不得重写 Persona resolver/adapter。**

---

## 1.5 production `bootPhase:create` 仍绕过 fresh creation

`packages/runtime/src/plugin/root.ts` 当前正常 create boot 会调用：

```text
seedBootWorld()
```

它写入 deterministic frozen scenario：

- TeamSession
- RootBinding
- Leader row
- worker/scout rows
- frozen child identities

随后再启动 live Agent bindings。

与此同时，`bindFreshTeamRoot`、fresh member creation 等真正路径其实已经 assembled/reachable，只是 create boot 没有使用。

**结论：B1 是 production composition 修复，不是 domain rewrite。**

---

## 1.6 Remote / principal / handoff 实现都已经存在

当前已有：

```text
packages/runtime/src/plugin/s6-principal.ts
packages/runtime/src/plugin/s6-remote.ts
packages/remote/src/handlers/dispatch.ts
packages/runtime/handoff/service.ts
```

因此本阶段修的是：

- trusted principal 缺失；
- production mount 缺失/未证明；
- unknown error boundary；
- handoff composite identity；
- handoff target Agent 实际启动；

不是重新设计 Remote/Handoff protocol。

---

# 2. T+12h 明确纳入与明确不纳入

## 2.1 必须修复的 confirmed semantic defects

| ID | 问题 | T+12 要求 |
|---|---|---|
| B1 | production create 仍使用 frozen `seedBootWorld()` | MUST FIX |
| B2 | child SessionId 未包含 root identity | MUST FIX |
| B3 | live consumption 丢弃 `externalPolicyFacts` | MUST FIX |
| B4 | Remote principal 来源仍是 payload claim，而非 trusted caller | MUST FIX 或 Remote 保持不可外部暴露；若后者则 vertical slice 不得判完整 PASS |
| B5 | handoff `(sourceSessionId, requestToken)` composite identity 被 token generation 破坏 | MUST FIX |
| B6 | handoff completed 不代表 target Agent 启动/收到 context | MUST FIX |
| M1 | actual Agent cwd 使用 `DSH_HOME` 而非 effective workspace | MUST FIX |
| M2 | persona 只进入内存 Map/no-op surface，不进入 real Agent | MUST FIX |
| M3 | descendant drain 只 `whenIdle()` 当前 target，返回 fake `drained:0` | MUST FIX 或 fail-closed；不得继续谎报 recursive drain |
| M4 | Remote registration seam 存在但 production transport mount 未闭合 | MUST FIX 以获得 full vertical PASS |
| H1 | `mcpServer:null` 是合法 config，但 live path 无条件 dereference | MUST FIX |
| H4 | arbitrary `Error.code/message/details` 可穿透 Remote boundary | MUST FIX |

---

## 2.2 本阶段不重新开启的事项

### H2 — durability detection 依赖 DSH 私有磁盘布局

当前 `sessionIsDurable()` 依赖：

```text
DSH_HOME/sessions/<profile>/<sessionId>/session.jsonl.zstd
```

这是确定的 hardening debt。

处理规则：

1. T+0～T+1 的 seam probe 如果能立刻找到 **公开 durability/query seam**，允许顺手替换；
2. 若需要额外 architecture exploration，则记录为 P10 debt；
3. **不得因此阻塞核心 vertical slice**；
4. 不允许引入新的 private import 作为“修复”。

### H3 — PolicyState ACK 后异步 durable settlement

这是当前冻结 contract 已接受的 crash window，而不是本阶段重新定义的 defect。

**T+12 不改变语义。**

---

# 3. 本阶段硬规则

## 3.1 不使用 PROTOTYPE

主线 Agent 和所有 subagent：

```text
不得读取 prototype worktree 实现作为施工依据
不得 cherry-pick prototype commit
不得 copy prototype patch
不得等待 prototype result
不得因为 prototype PASS/FAIL 修改本阶段 Gate
```

PROTOTYPE 只是项目价值的平行实验。

---

## 3.2 不进行第二次 broad audit

禁止：

```text
重新生成 P9→Backend 216-row matrix
重新跑一轮 S7 coverage freeze
重新做全仓 architecture inventory
重新审查所有 P0-P8 task
重新写大规模 evidence 文档
```

当前已知问题清单就是施工输入。

只有真实 vertical slice 暴露出的 **blocking defect** 可以新增到 scope。

---

## 3.3 不重新实现已有资产

以下默认 **READ-ONLY / REUSE**：

```text
packages/runtime/root-binding/*
packages/runtime/activation/provider.ts
packages/runtime/activation/adapter.ts
packages/runtime/agent-setup/persona/adapter.ts
packages/domain/*
packages/storage/*
已有 TeamDomain repository / provisioning state machine
已有 model-selection resolver
已有 policy resolver
已有 Projection contract
已有 Remote DTO/contract vocabulary
```

只有 targeted regression 证明这些模块本身存在错误时，主 Agent才允许修改。

---

## 3.4 不追求“漂亮的证据”

T+12 evidence 只保留：

```text
base SHA
final SHA
实际修改文件
targeted test commands
vertical-slice run logs
restart/repeat run logs
known-defect disposition
final verdict
```

不做三 reviewer blind review。

---

## 3.5 单个未知 public seam 最多探索 60–90 min

高风险 seam：

```text
persona -> actual DSH prompt/setup
descendant enumeration/drain
Remote production ConnectionLike mount
trusted transport principal
```

若 60–90 min 内确认：

```text
public seam exists
```

立即施工。

若确认：

```text
public seam does not exist
```

不得：

```text
patch upstream
private import
DOM/internal hack
fake success
```

直接产生：

```text
CORE_SEAM_BLOCKER
```

这本身就是 T+12 “要不要继续”的有效结论。

---

# 4. 并行施工拓扑

最多三个 production coding lane。

```text
                 T+0 baseline
                      |
        +-------------+-------------+
        |             |             |
        v             v             v
    Lane A         Lane B         Lane C
 Live Agent      Root/Handoff   Remote/Security
        |             |             |
        +-------------+-------------+
                      |
                 Integration
                      |
                      v
              Real Vertical E2E
                      |
                      v
              Restart / lifecycle
                      |
                      v
                T+12 Decision
```

### Write ownership

#### Lane A — Live Agent boundary

主要 owned：

```text
packages/runtime/src/plugin/live/agent-bindings.mjs
packages/runtime/src/plugin/types.ts        # 仅必要 seam type
对应 targeted tests
```

不得修改：

```text
root.ts
handoff/service.ts
s6-principal.ts
s6-remote.ts
```

---

#### Lane B — Root creation + Handoff

主要 owned：

```text
packages/runtime/src/plugin/root.ts
packages/runtime/handoff/service.ts
对应 targeted tests
```

不得重写：

```text
root-binding/*
activation/*
TeamDomain
```

---

#### Lane C — Remote + Security

主要 owned：

```text
packages/runtime/src/plugin/s6-principal.ts
packages/runtime/src/plugin/s6-remote.ts
packages/runtime/src/plugin/host.ts
packages/remote/src/handlers/dispatch.ts
对应 targeted tests
```

---

#### Shared type conflict

如果 Lane A/B/C 都需要改 `types.ts`：

```text
worker 不自行交叉修改
→ 提交需要的最小 interface delta
→ main integrator 一次性修改
```

---

# 5. 时间表

# T+0 ～ T+0.5h — Baseline / Freeze / Seam Probe

## 5.1 固定双基线：Team repo + OLD DSH

先执行 **0A.2 / 0A.3 Version Gate**，确认实际 resolver 使用：

```text
DSH 0.1.2-alpha.1
SHA cd5ef8148158c3a752a658978873241fdf8e2bbc
```

随后记录 Team repo：

```bash
git rev-parse HEAD
git status --short
```

期望：

```text
HEAD = 7d07330cca7bb3df416e3a82359d4307d9ab4a64
clean worktree
```

若主线已经前移：

```text
记录新 SHA
确认上述 defect 是否仍存在
```

不得从 PROTOTYPE worktree 更新基线。

---

## 5.2 只跑一组小 baseline

优先已有 targeted suites：

```bash
pnpm exec vitest run \
  packages/runtime/test/p5t1-fresh-cold-paths.test.ts \
  packages/runtime/test/p6t4-external-policy.test.ts \
  packages/runtime/test/p7t3-descendant-drain.test.ts \
  packages/runtime/test/p8s5a-production-assembly.test.ts \
  packages/runtime/test/p8s6-principal.test.ts \
  packages/runtime/test/p8s6-remote-commands.test.ts \
  packages/runtime/test/p8s7r4-bc22-idempotency.test.ts
```

目的不是证明 green，而是：

```text
记录 baseline
识别原有 known flaky
避免后面把旧失败归咎于新 patch
```

时间上限：20 min。

---

## 5.3 四个 seam probe

主 Agent并行/快速确认：

```text
SP1 real Agent persona prompt/setup 的公开控制入口
SP2 public descendant enumeration/cancel/drain 能力
SP3 host public Remote/ConnectionLike mounting seam
SP4 transport authenticated caller identity 可获得的信息
```

每个只需要结论：

```text
EXISTS(path/API)
MISSING
AMBIGUOUS
```

不要写调研报告。

---

# T+0.5 ～ T+4.5h — 三条 defect repair lane

# 6. Lane A — Live Agent boundary closure

预算：约 3～4h。

---

## A1. B2 — root-aware deterministic child Session identity

### 当前错误

当前：

```js
childSessionIdFor(instanceId)
```

只由 `instanceId` 构造：

```text
session-child-p6t6-...
```

不同 Team 出现相同 instanceId 时发生全局 SessionId collision。

### 修改

改为：

```text
childSessionIdFor(rootSessionId, instanceId)
```

身份输入必须是：

```text
(rootSessionId, instanceId)
```

推荐：

```text
canonical tuple
→ SHA-256
→ fixed-length stable suffix
```

例如语义：

```text
session-team-child-${hash(rootSessionId, instanceId)}
```

要求：

```text
same root + same instance -> same SessionId
different root + same instance -> different SessionId
restart -> stable
```

不得使用随机 UUID，因为会破坏 cold reconciliation。

### 测试

新增：

```text
same pair stable
cross-root same instance distinct
resume derives same child id
```

---

## A2. B3 — external hard policy 进入 real consumption resolver

### 当前错误

`resolveConsumptionViews()` 当前自行构造：

```js
const external = {
  hard: {},
  capabilityExists: {}
}
```

而 `TeamPluginConfig` 已经有：

```text
externalPolicyFacts.hard
externalPolicyFacts.capabilityExists
```

### 修改

删除 fake empty external facts。

实际 model/MCP consumption resolver 必须消费：

```text
config.externalPolicyFacts
```

只允许做 schema normalization，不允许创建第二套 policy semantics。

### Acceptance

至少证明：

```text
external hard DENY
+
Team/member override ALLOW
=
actual Agent boundary DENY
```

不能只验证 projection 显示 DENY。

---

## A3. H1 — nullable MCP contract

当前 config/type 允许：

```text
mcpServer = null
```

live code 却访问：

```text
config.mcpServer.name
config.mcpServer.port
```

### 修改

明确 null semantics：

```text
mcpServer === null
→ no Team MCP server configured
→ no dereference
→ no reconcile/create attempt
→ consumption view remains valid
```

测试：

```text
boot + member setup with mcpServer:null
must not throw
```

---

## A4. M1 — actual Agent cwd = effective workspace

### Child

activation adapter 已经把：

```text
request.workspace
```

传到 live child factory。

修改：

```js
agents.create({
  ...
  meta: {
    cwd: request.workspace
  }
})
```

不得再用 `DSH_HOME` 覆盖它。

### Root

Root Agent 使用当前 Team creation / TeamSession 的 default/effective workspace。

只有 contract 明确指定 fallback 时才允许 fallback；不得把 `DSH_HOME` 当作正常 workspace。

### Acceptance

在 **actual agents.create boundary** 观测：

```text
Root cwd == Team effective root workspace
Child cwd == Member effective workspace
```

不要通过 Projection 字段证明。

---

## A5. M2 — persona 真正进入 DSH Agent

版本核对后，这不再是“DSH 是否存在 public seam”的高不确定项；alpha.1 已确认存在 `setup(agentCtx)` + agent-scoped `systemPrompt.section(...)`。剩余工作是 Team persona resolver 到该 seam 的 last-mile binding。

### 禁止方案

不得：

```text
重写 persona resolver
复制一套 persona logic 到 live file
仅更新 root.promptInstallations Map 后宣称完成
靠模型回答“我是 xxx persona”作为唯一测试
private import DSH internals
```

### 正确方案

继续使用现有：

```text
createPersonaRootAdapter(...)
```

只补最后一层：

```text
ScopedPersonaPromptSurface
        ↓
actual public DSH Agent setup/prompt surface
```

如果 public API 要求 persona 在 Agent create/setup 阶段安装，则调整执行顺序：

```text
resolve effective persona
        ↓
create/setup real Agent with persona
        ↓
first work request
```

而不是在 first request 后再 patch prompt。

### 建议最小结构

如确实需要，可在 `TeamAgentBindings` 中增加一个极小 seam，例如语义上：

```ts
personaSurface / promptSurface
```

由 live binding 实现，root persona adapter 继续只依赖抽象 surface。

### Acceptance

必须在真实 Agent request boundary 证明：

```text
effective persona installed before work
restore restores prior scoped state
complete:true still FATAL
```

若 public DSH surface 不支持且无法通过合法 create/setup 参数完成：

```text
CORE_SEAM_BLOCKER
```

不要继续 3 小时研究 workaround。

---

## A6. M3 — descendant drain 不得再 fake success

### 当前错误

当前逻辑：

```text
await target.whenIdle()
return { drained: 0, quiescent: true }
```

没有 recursive descendant discovery。

### 最优修复

如果 public seam 可以：

```text
enumerate descendants
→ quiesce/cancel bottom-up
→ await idle
→ verify
→ return actual drained count
```

### 最小安全修复

如果当前 public seam 无法 recursive enumerate：

```text
不得返回虚假的 quiescent:true
```

改成 typed fail-closed：

```text
recursive-drain-unavailable
```

并使 archive/dispose 等要求 recursive quiescence 的路径拒绝完成。

**虚假成功比暂时不可用更糟。**

---

# 7. Lane B — Root creation / Handoff closure

预算：约 4h。

---

## B1. B1 — 删除 normal production create 对 `seedBootWorld()` 的依赖

### 当前错误

当前：

```text
bootPhase:create
→ seedBootWorld()
→ frozen TeamSession / root binding / leader / worker / scout rows
→ live boot
```

这使 shipped plugin 正常 create 路径实际上运行的是 P6-era deterministic world。

### 目标

正常 production create：

```text
real Team creation input
→ durable TeamSession
→ bindFreshTeamRoot(...)
→ valid Leader identity
→ real Root Agent
→ zero fabricated members
```

### 必须复用

```text
bindFreshTeamRoot
existing TeamSession repository/store
existing fresh member activation path
existing root identity semantics
```

### 不允许

```text
重新写 root binding
继续 seed worker/scout 再“修正”
为通过测试引入第二个 production-only TeamSession constructor
```

### seed fixture 的处置

可以：

```text
保留 helper 供旧 test/harness 使用
```

但必须保证 normal shipped create 不可达。

最好显式隔离：

```text
test fixture mode
```

而不是由普通 config 隐式触发。

---

## B2. create/resume 分离

### create

必须产生一次新的 durable Team identity。

### resume

必须：

```text
load existing TeamSession/root binding/member rows
reconcile real Agents
```

不得重新 mint root/member identity。

Acceptance：

```text
create once
restart
resume
→ same RootSessionId
→ same MemberInstance
→ same deterministic child SessionId
→ no duplicate Team/member
```

---

## B3. B5 — handoff composite identity

### 当前错误

operation Map 的 key 已经正确：

```text
(sourceSessionId, requestToken)
```

但：

```text
contextToken 仅 requestToken
intentToken 仅 requestToken
```

而 target root 又由 `intentToken` 派生。

### 修改

统一建立：

```text
handoff identity =
canonical(sourceSessionId, requestToken)
```

然后：

```text
contextToken = hash(composite)
intentToken  = hash(composite)
target root  = deterministic(intentToken)
```

允许使用不同 prefix/domain separation，但 identity 输入必须保持 composite。

### 必须新增 BC

```text
(source A, token X)
(source B, token X)
→ different context token
→ different intent token
→ different target Team root
```

同时：

```text
same source + same token replay
→ same logical operation/target
```

---

## B4. B6 — handoff 必须实际启动 target Agent

### 当前错误

当前 `createHandoffTeam(intent)` 只：

```text
create TeamSession
fresh root binding
return identity
```

没有证明：

```text
Root Agent exists
handoff summary/context delivered
```

### 禁止方案

不得为 handoff 再创建一套独立 Team runtime。

### 正确重构方向

抽取/复用同一正式 production creation primitive，语义类似：

```text
createAndStartTeam(...)
```

同时供：

```text
normal fresh Team create
handoff target Team create
```

这个 primitive 应完成：

```text
durable Team identity
fresh root binding
real root Agent create/setup
workspace/persona/effective config
initial context/work delivery
```

### handoff completion 的新条件

`completed` 不能只代表 Team row exists。

至少要求：

```text
target Root Agent 已创建
+
handoff surface/summary 已通过真实 Agent input/context seam 被接受
```

如果采用 at-least-once delivery：

```text
request identity / dedupe contract 必须明确
```

不得 silent duplicate。

---

# 8. Lane C — Remote / Principal / wire boundary

预算：约 3～4h。

---

## C1. H4 — unknown Error fail closed

需要同时修两处重复 error mapping：

```text
packages/remote/src/handlers/dispatch.ts
packages/runtime/src/plugin/s6-remote.ts
```

### 规则

只有：

```text
RemoteContractError
或严格 allowlisted domain/backing error
```

能携带 typed wire code/detail。

任意普通：

```js
Error
```

即使：

```js
error.code = 'ENOENT'
```

也必须变成：

```text
internal-error
```

wire 不包含：

```text
raw filesystem path
raw host error message
stack
arbitrary details
```

### Regression

构造：

```text
code = ENOENT
message contains /secret/path
```

断言客户端响应：

```text
does not contain ENOENT
does not contain /secret/path
```

server-side logging 可保留。

---

## C2. B4 — trusted PrincipalContext

### 当前错误

`s6-principal.ts` 当前只看到：

```text
method
request payload
```

无法区分：

```text
真实 host operator
vs
browser 自称 actor.kind=human
```

### 新边界

authority 必须来自：

```text
transport/authenticated connection
→ server PrincipalContext
→ Remote handler
```

而不是：

```text
request.actor / caller claim
```

payload 中 actor/caller 最多是：

```text
target/claimed identity
```

供 consistency check，不能赋权。

### Fail-closed

没有 authenticated principal：

```text
external remote caller
→ least privilege
```

绝不能默认 host operator。

---

## C3. M4 — production Remote mount

当前 root 已有：

```text
remoteHandlerRegistration
```

但 host 没有证明把真实 connection/public transport 接进去。

### 目标

shipped plugin host：

```text
public DSH remote/connection seam
→ root.remoteHandlerRegistration
→ installed Team remote methods
```

### Gate

如果不存在 public mount seam：

```text
CORE_SEAM_BLOCKER
```

不得：

```text
patch DSH core
private import
把 fake ConnectionLike test 当作 production mount
```

---

# 9. T+4.5 ～ T+5.5h — Integration checkpoint

主 Agent：

1. 依次 review 三条 lane diff；
2. 检查 ownership；
3. 解决 shared types；
4. 合并到 integration worktree；
5. 不做 broad refactor。

### 第一轮快速验收

至少跑：

```text
fresh/cold root
external policy
persona
descendant drain
production assembly
principal
remote commands
handoff idempotency
```

如果某 patch 破坏大量既有测试：

```text
先回滚该 patch
不要让 integration repair 吞掉 2～3h
```

---

# 10. T+5.5 ～ T+9h — Real shipped-plugin vertical slice

这是本阶段最重要的工作。

新建一个 canonical test/runner，例如：

```text
packages/runtime/test/t12-production-vertical.e2e.test.ts
```

实际位置可遵循仓库现有 E2E convention。

---

## 10.1 Anti-cheat 条件

测试必须：

```text
mount shipped host/plugin entrypoint
use production glueUrl
use live agent-bindings.mjs
reach real DSH Agent/Session runtime
```

不得：

```text
inject TestAgentBindings as final Agent implementation
directly call TeamDomain to fabricate success
call root internals to skip plugin
seed frozen worker/scout world
use PROTOTYPE code
```

可以使用：

```text
deterministic/local test model/provider
```

但必须经过真正的 DSH Agent lifecycle，而不是 Team 自己 fake 一个模型执行结果。

---

## 10.2 Slice V1 — fresh Root

输入一个最小合法 Team create：

```text
RootSessionId
Blueprint
workspace W_root
runtime preset/model
```

观察：

```text
TeamSession durable
fresh RootBinding durable
Leader identity valid
real Root Agent created
Root Agent cwd = W_root
no synthetic worker/scout rows
```

---

## 10.3 Slice V2 — real Member

创建一个 Member：

```text
instanceId = worker-...
workspace = W_child
persona = P_child
```

观察真实 Agent boundary：

```text
child SessionId includes root identity semantically
real DSH child Session exists
cwd = W_child
persona installed
effective model/policy installed
mcpServer:null does not crash if test config uses null
```

---

## 10.4 Slice V3 — real policy

配置：

```text
external hard DENY capability/tool X
Team/member override ALLOW X
```

真实 Agent consumption boundary：

```text
X remains denied
```

不能只检查 Projection。

---

## 10.5 Slice V4 — delegate real work

Leader/Team 向 child delegate：

```text
"T12_VERTICAL_TASK_<nonce>"
```

必须证明：

```text
exact task input reaches real child Agent/session
Agent accepts/executes request through normal DSH path
work completion is observed
Team work/lifecycle/activity durable truth settles
```

无需把自然语言输出质量作为 Gate。

---

## 10.6 Slice V5 — Projection / Remote

通过 browser-facing/public Remote：

```text
read TeamProjection
```

必须看到与 durable truth 一致的：

```text
root
member
childSessionId
lifecycle
activity/progress/completion
effective config/provenance
```

测试端不得直接访问 TeamDomain 做 assertion 的“读取来源”。

可以用 server-side instrumentation 做诊断，但最终客户端观察必须来自 Remote/Projection。

---

# 11. T+9 ～ T+10h — Handoff + lifecycle extension

## 11.1 Handoff

执行：

```text
source Team A
requestToken X
handoff summary/context C
```

验证：

```text
target Team B identity distinct
target Root Agent exists
C reaches real target Agent
handoff completed
```

然后：

```text
source Team C
same requestToken X
```

验证：

```text
different target identity
```

---

## 11.2 Lifecycle

至少执行一个真实：

```text
archive -> restore -> follow-up
```

或：

```text
dispose
```

要求 descendant drain：

```text
真实完成 recursive drain
或 fail-closed
```

不得出现：

```text
fake quiescent=true
```

---

# 12. T+10 ～ T+10.8h — Restart / repeat

Vertical slice 必须至少：

```text
fresh run #1
fresh run #2
restart/resume run #1
```

### fresh #1/#2

用不同 RootSessionId：

```text
same member instanceId
```

验证 child SessionId 不 collision。

### restart

验证：

```text
same Team root
same MemberInstance
same child Session
no duplicate Agent/Team/member
projection resumes correctly
```

---

# 13. T+10.8 ～ T+11.4h — Workspace validation

只在这一时段跑一次较大的 chain。

```bash
pnpm typecheck
pnpm build
pnpm smoke:composition
```

如果时间允许：

```bash
pnpm test
```

但规则是：

> **full suite 不能挤掉 decision report，也不能重新开启修复风暴。**

若 full suite 有 failure：

分类：

```text
NEW REGRESSION
KNOWN BASELINE FAILURE
UNRELATED / FLAKY
```

只有 NEW REGRESSION 是本阶段 blocker。

---

# 14. T+11.4 ～ T+12h — 决策报告

只生成：

```text
dev/agent-workflow/evidence/T12/T12-decision.md
```

建议控制在约 2～4 页。

必须包含：

```text
base SHA
final SHA

known defects:
B1 ...
B2 ...
...

vertical slice:
V1 PASS/FAIL
V2 PASS/FAIL
V3 PASS/FAIL
V4 PASS/FAIL
V5 PASS/FAIL

handoff:
PASS/FAIL

restart:
PASS/FAIL

remote auth:
PASS/FAIL

core/private patch:
0 / violation

remaining blockers:
...

VERDICT:
GO
or REFACTOR
or STOP-CANDIDATE
```

---

# 15. T+12 Verdict 定义

# 15.1 GO

只有同时满足：

```text
1. normal production create 不再依赖 seedBootWorld
2. shipped plugin 实际创建 real Root/Leader Agent
3. real Member/child Agent 创建成功
4. child identity root-scoped + restart stable
5. actual Agent cwd 使用 effective workspace
6. actual Agent 使用 effective persona
7. external hard policy 在 actual consumption boundary 生效
8. delegate exact real work 到 child Agent
9. completion/lifecycle durable truth 回写
10. Projection/Remote 能读取真实结果
11. Remote privileged authority 不是 browser self-claim
12. unknown Error fail-closed
13. handoff target 是真实运行 Agent，并收到 context
14. create x2 + restart x1 不产生 identity duplication
15. upstream/core patch = 0
16. 没有 architecture-critical fake success
```

允许留下：

```text
H2 durability public-seam hardening
H3 accepted async crash window
性能
broad race matrix
UI polish
P10 compatibility matrix
```

---

# 15.2 REFACTOR

满足以下任一：

```text
core Team concept/Domain/contract 大体可工作
但
production vertical slice 需要重写 runtime glue 的大块核心
```

具体触发例：

```text
B1 修复后 root/member identity 无法共存
handoff 只能通过第二套 Team runtime 实现
persona/workspace 需要绕过既有 binder architecture
>3 个 central production modules 必须整体替换
现有 root/activation/binder 组合无法表达正常 Agent lifecycle
```

REFACTOR 的含义不是项目失败，而是：

> 保留 contracts/domain/storage/可验证资产，停止继续在当前 runtime glue 上堆 P9。

---

# 15.3 STOP-CANDIDATE

满足以下任一：

```text
public DSH API 无法创建/配置所需 Agent，而必须 core patch/private import
无法从 shipped plugin 建立 real Agent execution path
Team identity 与 DSH Session identity 存在根本不可调和冲突
真实 work delivery 无法可靠进入 Agent
需要绕开 TeamDomain/RootBinding 才能让 demo 工作
T+12 仍只有 fixture/harness success，没有 shipped-plugin success
```

这是与并行 PROTOTYPE 一起用于项目去留判断的核心证据。

---

# 16. T+4 / T+8 / T+12 三个强制时间门

## T+4

预期：

```text
B2/B3/H1/M1 patched
B1 create path patched
B5 identity patched
H4 patched
persona/Remote public seam 已确认存在或明确 blocker
```

若没有：

```text
RED
```

但允许继续到 T+12，因为用户明确给到 12h。

---

## T+8

必须至少出现：

```text
shipped plugin
→ fresh Team
→ real Root Agent
→ real Member Agent
→ real delegate accepted
```

如果 T+8 仍没有这一链：

```text
进入 STOP/REFACTOR 高风险
禁止再投入时间做低价值边角 defect
所有资源转向 vertical slice
```

---

## T+12

不允许：

```text
“再给两小时就好了”
“只差一个 review”
“matrix 还没有跑完”
```

必须输出 verdict。

---

# 17. 主 Agent 调度建议（针对 qwen3.8-27b）

本阶段的风险不是代码生成速度，而是 scope expansion。

每个 worker brief 只给：

```text
1. exact base SHA
2. one lane
3. owned files
4. defect list
5. existing implementation to reuse
6. explicit non-goals
7. exact acceptance tests
8. stop condition
```

不要把：

```text
整个 180K SESSION_ROUTER_LOG
全部 P0-P8 evidence
所有 architecture documents
```

塞给 coding worker。

---

## Worker stop rule

单个 defect：

```text
45 min 没有形成 patch
```

必须输出：

```text
BLOCKER
exact file/function
missing seam
what was tried
why current architecture cannot proceed
```

然后切换下一项。

高风险 public seam 最多：

```text
60–90 min
```

---

# 18. 为什么这个计划有机会在 12h 内完成

当前代码状态并不是：

```text
backend = 0
```

真正需要修改的 production critical surface 主要集中于：

```text
root.ts
live/agent-bindings.mjs
handoff/service.ts
s6-principal.ts
s6-remote.ts
host.ts
remote dispatch.ts
```

而关键上层资产已经存在：

```text
TeamDomain
fresh root binding
activation/member provisioning
persona resolver
policy resolver
model selection
Projection
Remote contracts
handoff state machine
大量 module tests
```

因此正确施工模式是：

```text
repair final-mile wiring
+
one honest vertical E2E
```

而不是：

```text
重新实现 Team architecture
```

版本核对后，persona prompt/setup 已在 alpha.1 找到公开接线方向；12h 工期的主要 public-seam 不确定量收缩为：

```text
recursive descendant control
Remote mounting
trusted transport caller
```

persona 仍可能暴露 composition wiring bug，但不再应被当作 API-discovery 任务。

如果这些 seam 存在，12h 具有实际可行性。

如果不存在，**越早得到 CORE_SEAM_BLOCKER 越好**；这正是 T+12 阶段的价值，而不是失败。

---

# 19. 本阶段完成后，T+12～T+24 的入口条件

UI 阶段绝不能因为时间到了自动开始。

只有：

```text
VERDICT = GO
```

才直接进入 UI implementation。

如果：

```text
VERDICT = REFACTOR
```

先决定 runtime salvage/rewrite。

如果：

```text
VERDICT = STOP-CANDIDATE
```

结合独立 PROTOTYPE 结果决定是否停止项目。

这保证 PROTOTYPE 仍然只是平行价值探针，而不是主线 dependency。

---

# 20. 最小施工文件清单

预计 production 修改应主要限制在：

```text
packages/runtime/src/plugin/live/agent-bindings.mjs
packages/runtime/src/plugin/root.ts
packages/runtime/src/plugin/types.ts                 # only if minimal seam required
packages/runtime/src/plugin/s6-principal.ts
packages/runtime/src/plugin/s6-remote.ts
packages/runtime/src/plugin/host.ts
packages/runtime/handoff/service.ts
packages/remote/src/handlers/dispatch.ts
```

以及：

```text
targeted regression tests
one canonical T12 production vertical E2E
```

如果实际施工迅速扩大到：

```text
domain
storage
contracts
root-binding
activation
persona resolver
大量 tools/projection
```

则主 Agent 必须立即重新评估：

> 这是确有 cross-cutting root cause，还是又开始了无边界 rewrite？

---

# 21. 最终执行原则

本计划的核心不是“12h 内把项目做完”。

而是：

> **12h 内强迫现有 70h 资产接受一次无法靠 fixture、coverage、contract matrix 绕开的真实 production 检验。**

成功：

```text
继续 P9
```

失败但已有 domain/contract 价值：

```text
重构 runtime glue
```

真实 public seam / architecture 根本不成立：

```text
考虑停止
```

无论哪一种，T+12 都必须产生一个比“再开发十几个小时看看”更有价值的结论。
