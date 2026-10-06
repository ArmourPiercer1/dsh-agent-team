# DSH Agent Team vNext 详细开发计划

**文档性质**：下一主版本代码迁移、仓库重构与实现路线权威计划  
**状态**：已归档｜vNext 主开发计划已执行完毕（P0–P9 主线完成；T12/安装面补充已完成；P10 未启动）  
**真正执行进度**：P0–P8 及 P8-S 后端闭合、T12 Production Vertical Closure（`GO RE-STAMPED`）、P9 UI（`P9_VERDICT=GO`）、plugin-bundle-form 与 plugin-prebuilt-artifacts 均已完成并形成发布安装面；后续 D1–D6 修复及 F3/F11/F9/T1.4 属归档后的专项延伸，其中后者最终受 `TEST_INFRA_BLOCKER` 阻塞。  
**完成时间**：2026-09-05（P9 产品合流与安装面推送闭环；后续专项记录延伸至 2026-09-08）  
**日期**：2026-08-29  
**目标产品**：DSH Agent Team vNext  
**推荐新仓库**：`dsh-agent-team`  
**目标宿主**：upstream-clean `deepseek-ai/deepseek-harness`  
**核心约束**：`CORE PATCH BUDGET = 0`

> 本文回答“如何从当前 fork 中高度耦合的 Team 实现，迁移到一个真正独立、可在 upstream-clean DSH 上加载的 Agent Team 插件”。  
> 本文**不重新定义产品架构或 UI 语义**；对象模型、authority、lifecycle、compatibility、fork、handoff 与 UI 交互均以上一阶段两份冻结文档为准。  
> 本文规定仓库策略、旧代码处置、复用边界、接线迁移、Phase/Gate、public-seam characterization、测试、发布与回滚。  
> 具体由主 Agent / subagent 如何分包执行，将在下一份《任务分包与审查方法》中进一步拆解。

---

# 0. 规范性基线

## 0.1 上游与 fork 审计点

本文以以下代码状态为审计基线：

```text
deepseek-ai/deepseek-harness
master = cd5ef8148158c3a752a658978873241fdf8e2bbc

ArmourPiercer1/deepseek-harness
feat/team-vnext-integration-20260829
       = a3ab31992762c5d6560797eabc7e0885a9320ade

compare:
upstream cd5ef814...
    -> fork a3ab3199...
status   = ahead
behind   = 0
ahead_by = 39 commits
```

重要：这 **39 个 ahead commits 不是 39 个 Team-only commits**。

当前比较中已经确认至少混有：

```text
Team implementation
Team Host/API integration
Team Web integration
fork-only permission subsystem
custom-provider model-picker changes
related generated catalogs/docs
other downstream changes
```

因此任何清理动作都不得以“revert 39 commits”作为策略。

---

## 0.2 权威文档顺序

开发阶段遇到冲突时，按以下顺序裁决：

```text
1. DSH upstream public contract / actual supported seam
2. DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md
3. DSH_Agent_Team_vNext_Detailed_UI_Design_20260829.md
4. 本开发计划
5. legacy Team code / legacy docs / old tests
6. 实现便利
```

旧实现是**证据与参考资料**，不是需求来源。

---

## 0.3 不可违反的开发不变量

```text
CORE PATCH BUDGET = 0
```

Team vNext 必须做到：

```text
upstream-clean DSH
+
external dsh-agent-team repository/package
+
public DSH seams only
=
fully operational Team vNext
```

若冻结行为无法通过 public seam 实现：

```text
STOP
→ CORE_SEAM_BLOCKER:<specific-seam>
```

禁止：

```text
“先临时 patch core”
“先 import private source path”
“先复制 upstream internal implementation”
“先让功能跑起来，最后再解耦”
```

---

# 1. 结论先行：新建 `dsh-agent-team` 独立仓库

## 1.1 正式建议

本计划将以下方案作为**正式目标方案**：

```text
CREATE NEW REPOSITORY:
    dsh-agent-team

FREEZE OLD IMPLEMENTATION:
    ArmourPiercer1/deepseek-harness
    feat/team-vnext-integration-20260829
    @ a3ab31992762c5d6560797eabc7e0885a9320ade
    → LEGACY_REFERENCE
```

新仓库**不得**通过以下方式建立：

```text
fork current deepseek-harness fork
copy entire packages/team subtree and keep fixing imports
squash all Team changes into one initial commit
retain hidden dependency on fork-only Host patches
```

推荐方式：

```text
empty/fresh repository
↓
write architecture/compliance skeleton
↓
characterize upstream public seams
↓
selectively port reusable isolated code
↓
rewrite coupled runtime around new architecture
```

---

## 1.2 为什么新仓库优于继续在 deepseek-harness fork 中开发

### 原因 A：仓库边界直接表达 0-core

如果 Team 仍位于 DSH fork 内：

```text
“Team 不修改 core”
```

只是团队约定。

如果 Team 位于独立仓库：

```text
dsh-agent-team repository
cannot directly commit into deepseek-harness source tree
```

则 0-core 可以通过 CI 与 Git diff 机器验证。

---

### 原因 B：当前代码的主要问题正是 ownership contamination

当前 Team 已经进入：

```text
packages/team/**
packages/client/ui-team/**
packages/api/session-controller/**
packages/client/connection/**
packages/client/ui-workspace/**
packages/bundle/**
packages/core/session/src/known-event-types.ts
examples/team-agent/**
generated catalogs/docs
```

如果继续沿用同一 monorepo branch，“哪些东西属于 Team”会持续模糊。

新仓库迫使每一项依赖回答：

> 这是不是 upstream 正式 public seam？

如果不是，就不能自然地进入生产代码。

---

### 原因 C：当前 runtime primitive 已经换代

旧实现：

```text
member definition
→ TeamOrchestrator(memberId)
→ SubagentRuntime.startContinuable()
→ team/member-bound SessionEvent
→ Root/child logs fold TeamProjection
```

vNext：

```text
MemberTemplate
→ ActivationProvider
→ MemberInstance(instanceId)
→ ctx.agents.create()/resume()
→ TeamDomain binding
→ TeamDomain aggregate projection
```

这不是“小版本重构”。

大量旧 runtime 文件即使语法仍可编译，其核心 identity、authority、persistence assumption 也已经错误。

继续直接修改旧代码会产生典型风险：

```text
new names
+
old assumptions
=
architecturally disguised legacy runtime
```

---

### 原因 D：旧 fork 中混有非 Team 功能

当前 39 commits 中包含 fork-only：

```text
packages/permission/**
custom provider model picker changes
...other downstream work
```

新 Team repo 可以避免：

```text
Team release cadence
== downstream fork release cadence
```

也避免为了更新 Team 而重复合并整个 DSH fork。

---

### 原因 E：上游同步成本显著下降

旧模式：

```text
upstream changes
↓
merge into fork
↓
resolve Team edits in API/client/core/docs/generated files
↓
regenerate catalogs
↓
re-review unrelated conflicts
```

新模式：

```text
upstream changes
↓
run dsh-agent-team compatibility CI
↓
public seam unchanged?
    yes → no source merge work
    no  → adapt external plugin
```

这正是本次重构的核心工程收益之一。

---

## 1.3 为什么不建议仓库名长期使用 `dsh-team-vnext`

`vNext` 是迁移期概念，不应成为长期产品 identity。

推荐：

```text
Repository: dsh-agent-team
```

理由：

- 直接说明它是 DSH 的 Agent Team 扩展；
- 与 DSH 官方 experimental agent-team vocabulary 有语义关联但仓库边界清楚；
- vNext 成为正式版本后无需再次改名；
- 将来可发布 v1/v2，而不是永久叫 vNext。

开发初期如果希望避免与 legacy 混淆，可使用：

```text
branch: feat/vnext-foundation
milestone: vNext
```

而不是把 `vnext` 固定到 repository identity。

包发布 namespace 暂不在本文冻结。仓库内部 workspace package 可以使用私有工作区名称；正式 npm 发布时再使用实际拥有的 npm scope。

---

# 2. 推荐的四工作区拓扑

本地开发建议长期保持四个彼此职责清晰的 checkout/worktree：

```text
work/
├─ deepseek-harness-upstream/
│  └─ pristine upstream checkout
│
├─ deepseek-harness-fork/
│  └─ ArmourPiercer1 downstream features
│     ├─ permission experiments
│     ├─ model UI changes
│     └─ other non-Team work
│
├─ dsh-agent-team/
│  └─ authoritative Team vNext source
│
└─ legacy-team-reference/
   └─ read-mostly worktree/checkpoint at
      a3ab31992762c5d6560797eabc7e0885a9320ade
```

其中：

### `deepseek-harness-upstream/`

用途：

```text
host compatibility truth
public seam characterization
release matrix
0-core verification
```

不得承载 Team patch。

### `deepseek-harness-fork/`

用途：

```text
继续保留用户自己的通用 DSH fork 功能
```

但 Team 不以它作为 required host。

### `dsh-agent-team/`

用途：

```text
唯一 active Team vNext development repository
```

### `legacy-team-reference/`

用途：

```text
read old implementation
copy isolated algorithms deliberately
compare old UX
reuse test scenarios
inspect regression behavior
```

禁止在这里继续增加 vNext feature。

---

# 3. Legacy branch 的正式冻结方法

## 3.1 建议立即建立不可混淆的 reference marker

建议在 fork 中创建 annotated tag：

```text
legacy-agent-team-pre-vnext
→ a3ab31992762c5d6560797eabc7e0885a9320ade
```

并将当前 branch 的状态在 README/Agent Note 中标记：

```text
LEGACY_REFERENCE
NO NEW VNEXT DEVELOPMENT
```

如果分支命名策略允许，可进一步建立：

```text
legacy/agent-team-integration-20260829
```

指向同一 checkpoint。

不必删除原分支；保留历史比立即删除更有价值。

---

## 3.2 为什么“作废”不等于“删除”

旧代码仍有三类重要价值：

```text
A. behavioral reference
B. reusable pure implementation
C. regression / historical fixture
```

因此正确状态是：

```text
production authority = retired
historical/reference value = retained
```

而不是：

```text
git rm all old code immediately
```

---

# 4. 当前代码专项审计

# 4.1 当前 Team package family

当前 fork 中 Team 主要包包括：

```text
packages/team/team/
packages/team/team-local/
packages/team/team-runtime/
packages/team/team-channels/
packages/team/team-projection/
packages/team/tool-team/
packages/bundle/team/
packages/client/ui-team/
examples/team-agent/
```

它们并不是等价值的迁移来源。

---

# 4.2 `packages/team/team/`

当前 `TeamMemberDefinition` 同时描述：

```text
role
name
persona prompt
provider/model/maxTokens
tools
approval
skills
MCP
permissions
contextPolicy
```

有价值部分：

```text
字段语义经验
已有配置词汇
validation cases
messaging/control/progress data vocabulary
```

必须淘汰部分：

```text
TeamMemberId simultaneously = static role + runtime target
TeamMemberBoundData as child Session durable authority
Team-specific SessionEvent payload ownership
leader/teammate unified old identity assumption
```

处置：

```text
REWRITE
+
MIGRATE SEMANTICS SELECTIVELY
```

不得 copy `types.ts` 后逐字段改名。

---

# 4.3 `packages/team/team-local/`

旧 parser 已经有可用的：

```text
Markdown body
YAML frontmatter
schemaVersion
parse diagnostics
fields validation
```

但其 product object 是：

```text
one markdown file = one TeamMemberDefinition
```

vNext 需要：

```text
TeamBlueprint
├─ LeaderTemplate
├─ MemberTemplates
├─ policy/envelope
├─ requirements
├─ PolicyStates
└─ quota
```

因此：

```text
parser mechanics      → candidate MIGRATE/REFACTOR
old member schema     → REPLACE
live cwd watcher      → DELETE
shared ctx.team load  → DELETE
home fallback authority → DELETE
```

`.dsh/teammates` 只保留一个：

```text
LegacyBlueprintAdapter
```

并且：

```text
parse once
→ validate
→ snapshot
```

绝不能再次成为 live runtime authority。

---

# 4.4 `packages/team/team-runtime/TeamOrchestrator`

当前核心数据结构：

```text
Map<leaderSessionId,
    Map<memberId, TeammateActivation>>
```

并且：

```text
at most one active delegation per teammate per leader
```

这与 vNext 的：

```text
MemberTemplate -> 0..N MemberInstance
runtime address = instanceId
```

正面冲突。

因此 `TeamOrchestrator`：

```text
REFERENCE_ONLY
REPLACE COMPLETELY
```

可以借鉴：

```text
settled/running tracking lessons
activity metadata naming
error cases
leader-partitioning rationale
```

不能迁移：

```text
Map shape
memberId lookup API
one-member-one-activation invariant
process-memory authority
```

目标替代物：

```text
TeamDomain
+
ActivationProvider
+
TeamRuntime
+
Agent residency cache
```

---

# 4.5 `tool-delegate`

旧 delegate 流程依赖：

```text
ctx.subagents.startContinuable()
team/member-bound SessionEvent
TeamOrchestrator
SubagentRuntime.followup()
SubagentRuntime.interrupt()
```

这些都不能继续作为 Member primitive。

但 tool UX 有明显复用价值：

```text
run / follow_up / shutdown intent
already-running diagnostics
unknown-target diagnostics
human-readable delegation acknowledgement
explicit task prompt
```

处置：

```text
tool schema / UX ideas → MIGRATE
runtime implementation → REWRITE
```

新 tool 必须调用：

```text
TeamRuntime / ActivationProvider
```

而不是 subagent runtime。

---

# 4.6 `packages/team/team-channels/`

旧 channels 包含：

```text
message
progress
control request/decision
control timeout/sweep
```

用户价值应保留。

但旧 implementation 的 durability 与 target identity 仍围绕：

```text
memberId
Session events
host-level in-memory registries
```

vNext 目标：

```text
instanceId-addressed
TeamDomain-durable
reconnect/cold-safe
```

因此：

```text
protocol concepts  → MIGRATE
state authority     → REWRITE
in-memory registry  → cache only or DELETE
```

Timeout/sweep 等纯算法可以择优移植，但 pending control truth 必须来自 TeamDomain。

---

# 4.7 `packages/team/team-projection/`

旧 projection 的重要优点：

```text
cold-safe read
whole-snapshot publication
projection-side pure folds
live status overlay
pagination ideas
```

但它的 authority 完全依赖：

```text
Root Session log
child Session logs
team/* SessionEvents
continuable subagent directory
workspace roster
```

新架构完全改变这一层：

```text
Team projection
= Fold/Read TeamDomain aggregate
+ limited live Agent residency overlay
```

因此：

```text
service implementation → REPLACE
fold patterns           → REFERENCE/MIGRATE selectively
pagination mechanics    → MIGRATE selectively
snapshot publication    → KEEP AS DESIGN PATTERN
```

禁止为复用 projection 而恢复 Team SessionEvents。

---

# 4.8 `packages/client/ui-team/`

这是当前代码中**可复用率最高**的一组，但必须按层拆开。

## 高价值可复用

### Timeline pure math/model

当前 `team-timeline-model.ts` 中：

```text
linear time domain
running span uses caller clock
idle gaps remain honest gaps
1/2/5 × 10^n tick selection
duration formatting
lane ordering patterns
```

这些逻辑与 persistence authority 基本无关。

处置：

```text
MIGRATE + ADAPT INPUT MODEL
```

### Timeline renderer / interaction

当前成熟交互：

```text
zoom
pan
pointer-centered zoom
keyboard navigation
hover duration
click session navigation
```

处置：

```text
MIGRATE / REFACTOR
```

### Members renderer

当前已经尝试：

```text
member grouping
instance rows
running counts
current-session highlight
```

这是通往 Template→Instance UI 的好基础。

但旧 key 仍是：

```text
memberId
sessionIds[0]
```

目标必须改为：

```text
templateId
instanceId
childSessionId
```

处置：

```text
MIGRATE PRESENTATION
REWRITE DATA MODEL
```

### Team Dock

紧凑状态/navigation surface 可以迁移。

处置：

```text
MIGRATE UX
REWRITE DATA SOURCE
```

### Team Feed / Events

分页、filter、跳 Session 的交互思想可迁移。

数据源从：

```text
SessionController Team mirror / Session events
```

改成：

```text
Team Remote / TeamLedger
```

---

## 明确不迁移

### `TeamMarker`

旧 TeamMarker 依赖：

```text
1 team SessionEvent = 1 Chat marker
```

最终架构明确废除此语义。

处置：

```text
DELETE / REFERENCE_ONLY
```

### old Team task board authority

旧 `TeamTasks` 可以保留视觉布局灵感，但不能继续暗示正式 task DAG/workflow authority。

目标重命名/重新定义为：

```text
Activity / Progress
```

处置：

```text
REWRITE SEMANTICS
MAY REUSE PRESENTATION
```

### SessionController mirror hooks

全部作废。

---

# 4.9 `packages/api/session-controller/**` Team wiring

当前 fork 已把 Team projection/mirror 写入 SessionController，包括：

```text
src/team.ts
client/sessions/team-mirror.ts
client contracts
manager/service/remotes
controller control/index/types
Team projection tests
```

在 vNext 中：

```text
SessionController owns ordinary Session API
Team Remote owns Team API
```

处置：

```text
DELETE TEAM COUPLING FROM FORK
REPLACE WITH EXTERNAL TEAM REMOTE
```

这是最重要的“去污染”项目之一。

---

# 4.10 `packages/core/session/src/known-event-types.ts`

当前 fork 为 Team-specific event vocabulary 修改了 core known events。

最终架构：

```text
Team control-plane → TeamDomain
```

所以：

```text
DELETE Team entries
```

不需要等待 upstream 提供“runtime SessionEvent registration”。

这正是新架构解决旧版独立发布阻塞的关键。

---

# 4.11 Client Connection / Workspace / AgentPreset UI patch

当前 fork 中存在 Team 相关：

```text
packages/client/connection/**
packages/client/ui-workspace/**
packages/client/ui-agent-preset/**
```

vNext 的原则：

```text
upstream owners remain untouched
```

因此所有 Team-specific changes：

```text
DELETE / REPLACE WITH PUBLIC CLIENT SLOT
```

其中原生 New Session hero 不再加 Team selector；使用独立 `New Team` 外部入口。

---

# 4.12 `packages/bundle/team` 与 shipped bundle patch

旧 Team 使用：

```text
packages/bundle/team
base/web-app bundle patch
```

新模式：

```text
external dsh-agent-team cordis overlay
```

处置：

```text
DELETE FROM HOST FORK
REPLACE WITH EXTERNAL COMPOSITION FILE
```

---

# 4.13 Generated catalogs / docs

当前 Team 因进入 monorepo graph 触发：

```text
config catalog
module graph
event catalog
persistence catalog
client slot catalog
api catalog
package indexes
```

这些正是用户此前每次 merge 都要付出大量文档维护成本的来源之一。

vNext：

```text
Team docs live in dsh-agent-team repo
DSH generated docs remain upstream-owned
```

处置：

```text
REVERT Team-derived generated changes from active fork
```

新 repo 自己可以生成自己的 API/schema/docs，但不修改 DSH generated catalogs。

---

# 4.14 `packages/permission/**`：必须 SPLIT，不得误当 Team

专项审查确认：

```text
upstream cd5ef814...
has no packages/permission directory
```

而 fork integration branch 中存在完整 permission subsystem：

```text
packages/permission/permission/**
packages/permission/permission-engine/**
packages/permission/tool-permission-guard/**
```

这一部分具有明显通用价值，不应因为旧 Team 使用它就被塞进 Team repo。

正式分类：

```text
SPLIT
```

推荐策略：

```text
Option 1 — preserve in downstream DSH fork
Option 2 — future independent generic permission plugin repo
Option 3 — Team may optionally integrate if detected
```

但：

```text
Team vNext MUST NOT require fork-only permission package
```

Team 的 mandatory behavior 必须首先用 upstream public：

```text
tool visibility/restriction
pre-execute guards
user approval surfaces
external hard policy substrate
```

实现。

若某项冻结 behavior 只能依赖 fork-only permission engine：

```text
CORE_SEAM_BLOCKER / OPTIONAL_EXTENSION_DECISION
```

而不是偷偷把该 subsystem 当“upstream capability”。

---

# 4.15 Custom-provider model-picker 等无关 fork 功能

分类：

```text
KEEP IN DOWNSTREAM FORK
DO NOT COPY TO TEAM REPO
```

Team 只使用 public model directory / ModelSelection contract。

---

# 5. Migration classification vocabulary

每个旧文件/模块最终必须被标记为以下之一。

| 标记 | 精确定义 |
|---|---|
| **DELETE** | vNext 不再需要；从 active DSH fork Team dependency 中删除 |
| **MIGRATE** | 语义与实现都大体成立，可选择性搬到新 repo |
| **REPLACE** | 用户价值保留，但 implementation/authority 必须重新实现 |
| **KEEP** | 非 Team 或仍正确的 downstream feature，保留在原 fork |
| **SPLIT** | 当前与 Team 混在同一 commit/path，但应成为独立 generic capability |
| **REFERENCE_ONLY** | 只用于理解旧行为/测试，不进入新 production source |
| **GENERATED_REVERT** | 由旧 Team monorepo integration 派生的生成内容，应恢复 upstream ownership |

---

# 6. 关键文件/模块迁移表

| 当前区域 | 分类 | vNext 处理 |
|---|---|---|
| `packages/team/team/src/types.ts` | REPLACE + semantic MIGRATE | 重建 Blueprint/Template/Instance/TeamDomain contracts；仅迁移有价值字段词汇 |
| `packages/team/team/src/events.ts` | DELETE | Team control state 不再是 DSH SessionEvent |
| mutable `ctx.team` registry | DELETE | 改 BlueprintCatalog + TeamDomain |
| `team-local/parser.ts` | MIGRATE/REFACTOR | 解析框架可移植；目标 schema 改 Blueprint |
| team-local live watcher | DELETE | 不再作为 runtime authority |
| team-local workspace/home fallback authority | DELETE | 仅 legacy adapter snapshot-on-create |
| `TeamOrchestrator` | REFERENCE_ONLY / REPLACE | 由 ActivationProvider + TeamRuntime + TeamDomain 替代 |
| `tool-delegate` tool UX | MIGRATE | 保留用户操作概念，重写 backend |
| `SubagentRuntime.startContinuable` as Member primitive | DELETE | 改 `ctx.agents.create/resume` |
| `team/member-bound` | DELETE | TeamDomain SessionBinding |
| `team-channels` protocols | MIGRATE | message/progress/control concepts retained |
| `team-channels` registry authority | REPLACE | durable TeamDomain state |
| `team-projection` service | REPLACE | TeamDomain projection + live overlay |
| projection pure folding patterns | MIGRATE selectively | 新 TeamProjection DTO |
| `ui-team/team-timeline-model.ts` | MIGRATE HIGH | 改输入字段为 Template→Instance intervals |
| Timeline renderer/CSS/tests | MIGRATE HIGH | 适配新 DTO/public UI package |
| Members visual hierarchy | MIGRATE/REWRITE | memberId → templateId/instanceId |
| Team Dock | MIGRATE/REWRITE | Session mirror → Team Remote |
| Team Feed/Events | MIGRATE/REWRITE | TeamLedger source |
| TeamMarker | DELETE | TeamDomain event 不进入 Chat |
| TeamTasks | REWRITE | 降为 Activity/Progress telemetry |
| UI Settings old teammate view | REPLACE | Blueprint/catalog/config surfaces |
| SessionController Team mirror | DELETE | External Team Remote |
| SessionController Team host logic | DELETE | External Team runtime |
| Client connection Team frames | DELETE | Team Remote/client module |
| ui-workspace Team integration | DELETE | New Team external entry |
| ui-agent-preset Team-specific integration | DELETE | Team UI 自己读取 preset roster/compatibility |
| `core/session/known-event-types` Team entries | DELETE | TeamDomain |
| `bundle/team` in DSH | DELETE | external `cordis.yml` |
| base/web bundle Team rows | DELETE | external Loader overlay |
| Team-generated DSH catalogs | GENERATED_REVERT | Team repo own docs |
| `examples/team-agent` scenarios | MIGRATE AS TEST IDEAS | 新 repo E2E/test fixtures |
| `packages/permission/**` | SPLIT | downstream/general plugin；非 Team hard dependency |
| custom model-picker change | KEEP | unrelated downstream feature |
| existing legacy Team Sessions | KEEP READ-ONLY | no in-place migration |

---

# 7. 代码复用的正式方法

“尽量复用”不得理解为“尽量复制旧文件”。

应使用四级复用策略。

## 7.1 Level A — Direct Port

仅适用于：

```text
pure function
no old Team authority import
no SessionEvent assumption
no memberId identity assumption
no fork-only Host API dependency
```

典型候选：

```text
Timeline tick calculation
format duration/clock
geometry/math helpers
some CSS/layout primitives
pure validation helpers
```

流程：

```text
copy isolated code
→ update package imports
→ preserve original tests
→ add new vNext DTO tests
```

---

## 7.2 Level B — Port Algorithm, Rewrite Boundary

适用于：

```text
algorithm valuable
but input/output model is legacy
```

典型：

```text
Timeline lane fold
Members grouping
Events pagination
control timeout sweep
projection snapshot publication
```

流程：

```text
write NEW target type first
↓
port algorithm against new type
↓
remove all legacy type imports
↓
compare behavior with old fixtures
```

禁止反过来：

```text
copy old file
→ progressively patch types until compile
```

这种方法最容易留下旧 architecture assumption。

---

## 7.3 Level C — Behavioral Reference Only

适用于：

```text
user-visible behavior useful
implementation primitive obsolete
```

典型：

```text
delegate/followup/shutdown flow
cold continuation behavior
control approval flow
message relay UX
```

方法：

```text
read old tests/README
write vNext acceptance test
implement from new contracts
```

旧 production code 不复制。

---

## 7.4 Level D — Discard

典型：

```text
Team SessionEvent declarations
SessionController Team mirror
TeamMarker Chat event rendering
mutable TeamRegistry
cwd live roster authority
one-member-one-activation map
bundle patches
```

只保留 Git history。

---

# 8. 新仓库推荐结构

为避免一开始形成 15 个极细 package，同时保持 subagent 可分工边界，推荐第一版使用 9 个 workspace package。

```text
dsh-agent-team/
├─ packages/
│  ├─ contracts/
│  ├─ domain/
│  ├─ storage/
│  ├─ runtime/
│  ├─ tools/
│  ├─ remote/
│  ├─ client/
│  ├─ legacy/
│  └─ testkit/
│
├─ tests/
│  ├─ characterization/
│  ├─ integration/
│  ├─ recovery/
│  ├─ e2e/
│  └─ compatibility/
│
├─ examples/
├─ docs/
├─ scripts/
├─ cordis.yml
├─ package.json
├─ pnpm-workspace.yaml
└─ README.md
```

如果未来 package 独立发布需要更强边界，再从这些包内部拆分。

---

# 9. 各 package 的职责

## 9.1 `contracts`

只放跨 host/client/package 的稳定 serializable contracts：

```text
IDs
DTOs
Remote request/response
error codes
schema version constants
projection DTO
compatibility DTO
```

禁止：

```text
business state mutation
Cordis service implementation
storage implementation
React
```

---

## 9.2 `domain`

纯领域层：

```text
Blueprint
LeaderTemplate
MemberTemplate
TeamIntent model primitives
TeamSession aggregate semantics
MemberInstance
lifecycle FSM
PolicyState
policy resolution
compatibility classification logic
quota rules
override precedence
```

尽可能不依赖 live DSH services。

---

## 9.3 `storage`

TeamDomain：

```text
StorageDomain spec
TeamSession records
MemberInstance records
SessionBinding
operation journal
TeamLedger
version/generation
recovery/reconciliation
schema upgrade
```

这是 Team durable authority。

---

## 9.4 `runtime`

Host/Agent integration：

```text
BlueprintCatalog
CompatibilityResolver
TeamAgentBinder
ActivationProvider
TeamRuntime
Admission guards
model mutation bridge
skills/MCP/tool adapters
lifecycle/quiescence
Agent residency
fork recognition
handoff service
projection service
```

这是 public DSH seams 最集中的 package，因此需要最严格 architecture review。

---

## 9.5 `tools`

Model-facing Team tools：

```text
list templates/instances
delegate/create
follow-up/message
control request/decision
progress report
lifecycle actions where authorized
policy/model mutation where authorized
```

Tools 只调用 Runtime public façade。

禁止直接：

```text
write TeamDomain tables
create Agent
inspect private DSH state
```

---

## 9.6 `remote`

Team-owned Host Remote façade：

```text
Blueprint catalog API
TeamIntent compatibility API
Team creation API
Team projection API
member actions
policy/override actions
lifecycle actions
ledger pagination
```

不扩展 SessionController Team mirror。

---

## 9.7 `client`

独立 Web client package：

```text
New Team entry/panel
Team Tab
Timeline
Members
Instance Detail
Activity/Progress
Events
Team Dock
compatibility UI
lifecycle dialogs
Start Team from Here
legacy read-only presentation
```

只消费：

```text
public DSH client slots
Team Remote
public Session navigation capability
```

---

## 9.8 `legacy`

只处理：

```text
.dsh/teammates -> LegacyWorkspaceTeamBlueprint
legacy Team detection/read-only metadata where public data permits
old config import helpers
```

不承载 live runtime。

---

## 9.9 `testkit`

提供：

```text
fake Blueprint catalog
fake TeamDomain backend
fault injection
fake LLM adapter
Agent lifecycle probes
Session lineage fixtures
Team projection fixtures
client Remote fixture
```

---

# 10. 新旧接线对照

## 10.1 Team creation

### 旧

```text
AgentPreset / workspace roster
→ Team runtime implicitly present
→ session-controller / bundle integration
```

### 新

```text
external New Team UI
→ Team Remote
→ TeamIntent
→ CompatibilityResolver
→ public ctx.agents.create(setup)
→ TeamDomain bind
→ Root native Session
```

---

## 10.2 Member creation

### 旧

```text
delegate_to_teammate
→ SubagentRuntime.startContinuable
→ team/member-bound event
→ TeamOrchestrator
```

### 新

```text
delegate/create
→ TeamRuntime
→ ActivationProvider
→ public ctx.agents.create(setup)
→ TeamDomain SessionBinding
→ MemberInstance commit
```

---

## 10.3 Member follow-up

### 旧

```text
memberId
→ orchestrator activation
→ subagent.followup
```

### 新

```text
instanceId
→ TeamDomain MemberInstance
→ ensure Agent residency via ctx.agents.resume if cold
→ admit attributed input/work
→ same durable Session
```

---

## 10.4 Projection

### 旧

```text
Root log
+ child logs
+ roster
+ live agent status
→ TeamProjection
→ SessionController mirror
→ UI
```

### 新

```text
TeamDomain aggregate
+ limited live Agent residency overlay
→ TeamProjection
→ Team Remote
→ external Team client
```

---

## 10.5 Messaging/control/progress

### 旧

```text
team/* SessionEvent
+ in-memory coordinator
```

### 新

```text
TeamDomain TeamLedger / Control records
+
attributed ordinary Agent input when actual Agent sees something
```

---

## 10.6 Web

### 旧

```text
SessionController Team mirror
client connection Team frames
ui-workspace modifications
ui-team
```

### 新

```text
Team Remote
external dsh.client module
public slots only
```

---

# 11. Development Phase 总览

```text
P0  Freeze legacy + provenance audit
 ↓
G0  source ownership known
 ↓
P1  Host decontamination + fresh repo foundation
 ↓
G1  Team-required upstream diff = 0
 ↓
P2  Public seam characterization
 ↓
G2  all architecture-critical seams proven
 ↓
P3  Contracts / Domain / Blueprint / Policy
 ↓
G3  pure architecture encoded and tested
 ↓
P4  TeamDomain / journal / recovery
 ↓
G4  durable aggregate crash-safe
 ↓
P5  Agent binding / Member lifecycle substrate
 ↓
G5  headless Root/Member Agent semantics correct
 ↓
P6  Activation / Runtime / Team coordination
 ↓
G6  complete headless Team runtime
 ↓
P7  Compatibility / mutation / lifecycle / fork / handoff / legacy
 ↓
G7  advanced frozen semantics complete
 ↓
P8  Remote / projection
 ↓
G8  stable browser-facing contract
 ↓
P9  External Web UI migration
 ↓
G9  frozen UI contract complete
 ↓
P10 Hardening / compatibility / release
 ↓
G10 0-core release
```

重要顺序：

> **不得在 G1/G2 通过之前大规模开发新 Team capability。**

先证明“能独立”，再开发“新功能”。

---

# 12. Phase 0 — Freeze Legacy & Provenance Audit

## 12.1 目标

把当前代码从“正在演化的产品代码”转换为：

```text
historical reference
+
migration evidence
```

并准确分离 Team 与 fork 其它功能。

---

## 12.2 任务

### P0-A — 建立 legacy tag

```text
legacy-agent-team-pre-vnext
→ a3ab31992762c5d6560797eabc7e0885a9320ade
```

### P0-B — 建立 provenance manifest

对：

```text
upstream cd5ef814...
→ fork a3ab319...
```

所有 changed file/commit 分类：

```text
TEAM_OWNED
GENERIC_FORK_CAPABILITY
UNRELATED_FORK_FEATURE
GENERATED_FROM_TEAM
MIXED
```

### P0-C — 对 MIXED commit/file 做拆分说明

至少记录：

```text
which hunks are Team
which hunks are generic permission
which hunks are model UI
which generated outputs are derived
```

### P0-D — 建 legacy behavioral inventory

整理当前可观察功能：

```text
delegate
follow-up
message
control
progress
cold resume
Timeline
Members
Events
Dock
session navigation
```

作为 vNext regression/reference list。

---

## 12.3 Gate G0

必须满足：

```text
✓ exact upstream SHA recorded
✓ exact legacy SHA/tag recorded
✓ every changed file has provenance category
✓ MIXED changes identified
✓ old branch marked no-vNext-development
✓ reusable behavior inventory written
```

G0 未通过：禁止开始 host decontamination。

---

# 13. Phase 1 — Host Decontamination + Fresh Repo Foundation

这是整个计划中最重要的结构性 Phase。

## 13.1 目标

建立：

```text
A. upstream-clean host
B. clean downstream fork with unrelated features preserved
C. fresh dsh-agent-team repository
```

且 Team 不再需要 upstream source patch。

---

## 13.2 Host decontamination

从一个新 branch/worktree 开始，而不是在现有 integration branch 上逐个修。

推荐：

```text
base = upstream cd5ef814...
```

然后只重放：

```text
KEEP / GENERIC_FORK_CAPABILITY / unrelated user features
```

而不是：

```text
start from a3ab319
then try to delete Team
```

为什么推荐“从 clean 向前 cherry-pick”而不是“从 contaminated 向后减”：

```text
negative filtering is error-prone
mixed generated files hide residual dependency
package.json/docs graph may retain invisible Team edges
```

如果 downstream 非 Team commit 数量较少，这种方法最可靠。

如果 commit mixing 太严重，则：

```text
construct clean branch by path/hunk transplant
```

并保留 provenance mapping。

---

## 13.3 必须清除的 Team host coupling

至少包括：

```text
Team entries in core/session known-event-types
SessionController Team source/client/mirror
client connection Team fixtures/frames
ui-workspace Team extensions
ui-agent-preset Team-only integration
bundle/team
base/web-app Team bundle rows
Team-generated catalogs/docs
Team-only CLI/bundle composition
Team package graph registrations
```

---

## 13.4 新 repo foundation

创建 fresh：

```text
dsh-agent-team
```

第一批 commit 只能包含：

```text
README
architecture references
package/workspace skeleton
lint/build/test config
compliance scripts
empty external plugin load proof
```

不得第一天就 copy `packages/team/**`。

---

## 13.5 0-core compliance script

新 repo 立即加入：

```text
scripts/verify-zero-core.*
```

至少检查：

```text
no patch-package
no pnpm patch
no postinstall source rewrite
no relative import into ../deepseek-harness/packages/**/src
no vendored modified DSH core
no git apply into host
```

并在 integration test 前后检查 host：

```text
git status --porcelain

git diff --exit-code
```

---

## 13.6 Gate G1 — 0-core foundation

必须满足：

```text
✓ dsh-agent-team is a separate Git repository
✓ legacy branch is not a dependency
✓ plugin skeleton builds independently
✓ plugin can be composed with pristine upstream
✓ pristine upstream remains byte/source clean after test
✓ active downstream host has no Team-required core/api/client/bundle patch
✓ unrelated fork features preserved according to provenance manifest
```

G1 是硬门禁。

**G1 不通过，不允许进入 vNext domain/runtime feature development。**

---

# 14. Phase 2 — Public Seam Characterization

## 14.1 目的

开发前证明：

> 冻结架构所依赖的 Host behavior 真的是 public contract，而不是我们根据源码猜测出来的偶然实现。

这一 Phase 原则：

```text
write tests/probes first
minimal/no Team product code
```

---

# 15. Characterization Matrix

| Seam | 必须证明 | Failure code |
|---|---|---|
| Agent create | `setup(agentCtx)` 在 publication/driver 前执行 | `CORE_SEAM_BLOCKER:AGENT_CREATE_SETUP` |
| Agent resume | cold resume 也支持 Team scoped setup | `CORE_SEAM_BLOCKER:AGENT_RESUME_SETUP` |
| Root cold hydration | ordinary Session resume 后首个 Team-sensitive step 前可恢复 Team scope | `CORE_SEAM_BLOCKER:ROOT_COLD_BINDING` |
| pre-step | 可 fail-closed 拒绝 new Team work | `CORE_SEAM_BLOCKER:ADMISSION_PRESTEP` |
| ModelSelection | future request boundary mutation生效；in-flight 不变 | `CORE_SEAM_BLOCKER:MODEL_SELECTION` |
| persona | scoped `deployment:persona` 可安装；complete:true 可检测 | `CORE_SEAM_BLOCKER:PERSONA_SCOPE` |
| AgentPreset | public mount/compose behavior可由 Team creation使用 | `CORE_SEAM_BLOCKER:PRESET_COMPOSITION` |
| tools | Agent-scope visible tools/restrictions可实现 | `CORE_SEAM_BLOCKER:TOOLS_SCOPE` |
| pre-execute | future operation 可 last-mile veto | `CORE_SEAM_BLOCKER:TOOL_GUARD` |
| skills | per-Agent effective filtering/mutation可实现 | `CORE_SEAM_BLOCKER:SKILL_SCOPE` |
| MCP | per-Agent effective availability/filtering可实现 | `CORE_SEAM_BLOCKER:MCP_SCOPE` |
| StorageDomain | external Team sidecar domain 可 durable open/read/write | `CORE_SEAM_BLOCKER:STORAGE_DOMAIN` |
| fork lineage | native fork parent/lineage足以识别 Root/Member语义 | `CORE_SEAM_BLOCKER:FORK_LINEAGE_VISIBILITY` |
| descendants | Member quiesce 可发现/停止 generic descendants | `CORE_SEAM_BLOCKER:DESCENDANT_DRAIN` |
| Remote | external Team Host service可暴露独立 Remote | `CORE_SEAM_BLOCKER:TEAM_REMOTE` |
| client module | external `dsh.client` package可被发现加载 | `CORE_SEAM_BLOCKER:CLIENT_MODULE` |
| conversation view | Team Tab additive seat存在 | `CORE_SEAM_BLOCKER:TEAM_VIEW_SLOT` |
| input dock | Team Dock additive seat存在 | non-critical UI fallback if equivalent public seat exists |
| sidebar/action | 独立 New Team 入口可通过 public additive surface呈现 | `CORE_SEAM_BLOCKER:NEW_TEAM_ENTRY` if no equivalent public entry exists |

---

## 15.1 特别关注：Root cold resume

Member 是 Team 自己创建的 Agent，因此 setup 容易控制。

Root 可能通过普通 DSH Session UI cold resume，因此必须证明：

```text
Session selected/resumed
↓
Team plugin sees TeamDomain SessionBinding
↓
Team scope hydrated
↓
first Team-sensitive agent/pre-step
```

顺序成立。

这是目前最重要的 characterization 之一。

---

## 15.2 特别关注：skills / MCP

不得假设“tools 能 filter，所以 skills/MCP 也一定能”。

分别测试：

```text
creation-time filter
cold-resume filter
runtime tightening
runtime user override within available substrate
capability disappearance
```

若某一类只能通过 private registry 实现：

```text
block that capability
```

而不是复制 upstream registry。

---

## 15.3 特别关注：permission subsystem independence

测试必须在：

```text
pristine upstream
WITHOUT fork packages/permission/**
```

运行。

否则会产生“在自己的 fork 上看起来 0-core，实际离不开 fork-only substrate”的假阳性。

---

## 15.4 Gate G2

必须满足：

```text
✓ every architecture-critical seam has executable characterization test
✓ tests pass on pristine pinned upstream
✓ no private source import
✓ no fork-only required package
✓ every known limitation has explicit status
✓ any blocker stops affected feature before implementation
```

---

# 16. Phase 3 — Contracts / Domain / Blueprint / Policy

## 16.1 目标

先把架构编码为不依赖 live Agent 的纯模型。

---

## 16.2 内容

### Contracts

```text
IDs
DTOs
errors
schema version
projection contracts
remote-safe values
```

### Blueprint

```text
TeamBlueprint
LeaderTemplate
MemberTemplate
revision/contentHash
strong validation
immutable snapshot
catalog source abstraction
```

### Member

```text
instanceId
Template→0..N Instance
contextPolicy
workspace mutation semantics
lifecycle
```

### Policy

```text
Blueprint envelope
Member envelope
PolicyState
Autonomy Overlay
Human Override
External Hard intersection model
```

### Compatibility

```text
Requirement != Policy
PASS/WARNING/FATAL
ack fingerprint
complete:true fatal
```

---

## 16.3 旧代码复用

允许：

```text
validation test cases
field naming experience
frontmatter parsing utilities
control/progress vocabulary
```

禁止把旧：

```text
TeamMemberDefinition
TeamMemberBoundData
TeamMemberId runtime identity
```

作为新 contract 基础。

---

## 16.4 Gate G3

```text
✓ domain has no live Agent dependency
✓ one template → N instances covered by property tests
✓ lifecycle transition matrix fixed
✓ policy precedence exhaustive tests
✓ complete:true compatibility fatal test
✓ Blueprint snapshot immutable tests
✓ fresh_per_delegation semantics encoded as new-instance policy
```

---

# 17. Phase 4 — TeamDomain / Journal / Recovery

## 17.1 目标

建立新的 durable authority，再接 Agent runtime。

---

## 17.2 必须支持的逻辑 records

```text
TeamSessionRecord
MemberInstanceRecord
SessionBinding
Override/Governance state
Compatibility/Acknowledgement
OperationJournal
TeamLedger
SchemaMeta
```

---

## 17.3 Crash model

必须假设：

```text
TeamDomain write A
↓ crash possible
DSH Session/Agent creation
↓ crash possible
TeamDomain write B
↓ crash possible
ledger append
```

所以采用：

```text
PREPARED operation
→ idempotent effects
→ target records record lastAppliedOperationId
→ ledger
→ COMMITTED
```

recovery 默认：

```text
roll forward / reconcile
```

而不是假设 rollback transaction。

---

## 17.4 Fault-injection matrix

对 Member provisioning 至少故障注入：

```text
before op prepare
after op prepare
before child create
after child create
before SessionBinding
before MemberInstance commit
after MemberInstance commit
before ledger
before operation committed
after committed
```

期望最终只允许：

```text
one committed MemberInstance
OR
no committed MemberInstance + diagnosable orphan
```

---

## 17.5 Gate G4

```text
✓ TeamDomain is sole Team control-plane authority
✓ no Team SessionEvent persistence
✓ crash matrix converges
✓ retries idempotent
✓ SessionBinding integrity checks
✓ schema version mismatch fails loudly
✓ recovery tests work after process restart
```

---

# 18. Phase 5 — Agent Binding / Member Lifecycle Substrate

## 18.1 TeamAgentBinder

统一负责：

```text
persona
Team prompt/policy surface
Team tools
resolved guard
model overlay
skills/MCP adapter
context policy
admission guard
```

它应可：

```text
bind fresh Root
bind fresh Member
rehydrate cold Root
rehydrate cold Member
```

且 idempotent。

---

## 18.2 AgentPreset composition

Root/Member 使用 DSH public preset semantics。

Member 默认继承 Root AgentPreset substrate。

不得实现：

```text
per-member AgentPreset selector
copy preset plugin graph into Blueprint
```

---

## 18.3 Persona

兼容 preset：

```text
Team Blueprint persona
→ scoped identity
```

`complete:true`：

```text
TEAM_PERSONA_COMPLETE_PRESET_CONFLICT
→ FATAL before work
```

不得复制 `dsh-persona` private semantics。

---

## 18.4 Model

使用 public ModelSelection。

测试：

```text
request N = model A
concurrent override -> B
request N remains A
request N+1 uses B
```

---

## 18.5 Member Agent residency

明确：

```text
MemberInstance durable
Session durable
Agent residency ephemeral
```

SETTLED 时允许：

```text
Agent handle absent
```

新 work 再 cold resume。

---

## 18.6 Gate G5

```text
✓ Root fresh bind
✓ Root cold bind
✓ Member fresh create setup
✓ Member cold resume setup
✓ ordinary Agent unaffected
✓ persona semantics correct
✓ model future-boundary mutation correct
✓ runtime residency can be dropped without deleting Member
```

---

# 19. Phase 6 — Activation / Runtime / Coordination

## 19.1 ActivationProvider

所有新 MemberInstance creation 的唯一入口。

来源包括：

```text
leader explicit create
leader delegate implicit create
human UI create
```

未来 router/workflow 也只能调用同一个 Provider。

---

## 19.2 Activation checks

顺序至少：

```text
resolve TeamSession
resolve immutable Blueprint
resolve template
caller authority
admission
compatibility
quota
policy
overlay bounds
workspace/context creation fields
allocate instanceId
journal prepare
create Agent/Session
bind TeamDomain
commit MemberInstance
publish projection
```

---

## 19.3 Messaging

迁移旧 `send_team_message` 用户价值，但所有 transport identity：

```text
instanceId-first
```

TeamDomain 记录 coordination；目标 Session 只记录其实际收到的 ordinary attributed input。

---

## 19.4 Control / Approval

旧 control semantics 可作为参考，但 target state：

```text
ControlRequest durable in TeamDomain
ControlDecision durable in TeamDomain
actual tool operation still goes through DSH tool pipeline
```

决策不能越过 External Hard Policy。

---

## 19.5 Progress / Activity

保留 telemetry：

```text
subject
status
summary
correlation
last action
running intervals
```

不得升级成：

```text
WorkflowState
DAG
completion authority
```

---

## 19.6 Team tools

建议第一轮 tool contract覆盖：

```text
list_team_members/templates
create/delegate instance
follow_up_instance
send_team_message
report_progress
request_control
resolve_control (leader where authorized)
archive/restore/dispose where authorized
inspect effective config
```

具体 tool 命名可以实现阶段收敛，但 authority 必须统一走 Runtime。

---

## 19.7 Gate G6

```text
✓ same template can create N simultaneous instances
✓ every runtime action is instance-addressed
✓ persistent follow-up keeps same Session
✓ fresh_per_delegation creates new instance
✓ message/control/progress survive restart
✓ quota race does not over-create
✓ tool layer cannot bypass ActivationProvider/TeamRuntime
```

---

# 20. Phase 7 — Compatibility / Mutation / Lifecycle / Fork / Handoff / Legacy

这是“高级但冻结”的产品语义收敛 Phase。

---

## 20.1 Compatibility drift

重新 probe：

```text
Root cold resume
Member cold resume
new activation
relevant capability generation change
stale compatibility generation before new work
```

新 warning：

```text
block NEW work
```

already admitted work：

```text
may settle
```

---

## 20.2 Runtime mutation

实现：

```text
model future step
permission/tool future operation
skills/MCP future operation
human override
Autonomy Overlay
PolicyState suppression/provenance
```

所有 effective config 都必须可解释 provenance。

---

## 20.3 Lifecycle

### Archive

```text
close admission
→ interrupt
→ drain descendants
→ wait quiescence
→ release residency
→ commit ARCHIVED
```

### Restore

```text
ARCHIVED
→ SETTLED
```

**不得** resume Agent。

### New work

```text
SETTLED
→ ensure Agent residency
→ admit
→ RUNNING
```

### Dispose

```text
quiesce
→ DISPOSED terminal
```

历史不删除。

---

## 20.4 Fork

Root：

```text
native fork
→ lineage recognition
→ new TeamSession
→ same Blueprint snapshot
→ empty MemberInstances
```

Member child：

```text
native fork
→ ordinary Session
```

无 Team binding。

---

## 20.5 Start Team from Here

```text
ordinary Session A
→ freeze canonical surface
→ one-shot summary
→ new TeamIntent
→ new Root B
```

B 不获得 A live history/search。

---

## 20.6 Legacy

`.dsh/teammates`：

```text
legacy input adapter only
```

Existing old Team Session：

```text
READ-ONLY
```

如果 public seam 可读取旧 metadata：

```text
show best-effort legacy view
```

否则：

```text
native Chat/Trajectory only
```

不是 release blocker。

---

## 20.7 Gate G7

```text
✓ warning/fatal admission semantics
✓ ack fingerprint invalidation
✓ human override precedence
✓ lifecycle quiescence
✓ Restore does not create/resume Agent
✓ Root fork exact semantics
✓ Member fork ordinary semantics
✓ handoff one-shot/no-live-link
✓ legacy old Team cannot mutate/resume
```

---

# 21. Phase 8 — Team Remote + Projection

## 21.1 为什么在 UI 前冻结 Remote

旧 UI 与 SessionController Team mirror 强耦合，是当前 migration 难点之一。

新 UI 必须只面对稳定 Team contract。

因此：

```text
backend complete
→ TeamProjection DTO stable
→ Team Remote stable
→ THEN UI migration
```

---

## 21.2 Projection source

```text
TeamDomain
+
optional current live residency/activity overlay
```

不得扫描：

```text
Root + all child Session logs
```

来重建 Team control truth。

---

## 21.3 Remote API categories

至少：

```text
catalog.list/get
intent.probe
team.create
team.getProjection
team.getLedgerPage
member.create
member.send/followup
member.archive/restore/dispose
override.get/set/reset
policyState.get/set
compatibility.get/ack/reprobe
handoff.prepare/create
legacy.inspect
```

API 命名可调整，但 separation 固定。

---

## 21.4 Push/update model

推荐：

```text
whole Team projection generation
or
versioned invalidation + pull
```

第一版优先 correctness，不追求复杂 delta protocol。

Client 必须拒绝：

```text
stale generation overwrites newer state
```

---

## 21.5 Gate G8

```text
✓ browser needs no SessionController Team mirror
✓ projection round-trip works after reconnect
✓ stale responses ignored
✓ ledger pagination stable
✓ every UI-visible action has typed error/provenance
✓ Remote contract versioned/tested
```

---

# 22. Phase 9 — External Web UI Migration

## 22.1 原则

这一 Phase 不是重写所有视觉组件。

策略：

```text
reuse presentation aggressively
rewrite data ownership completely
```

---

## 22.2 New Team surface

新实现通过 public additive client surface 提供：

```text
New Team
```

不修改 native New Session owner。

TeamIntent 由 Team client 自己管理。

---

## 22.3 Timeline migration

优先迁移当前：

```text
team-timeline-model.ts
Timeline renderer
Timeline CSS
Timeline tests
```

目标 DTO：

```text
Template lane/group
→ instance sublane
→ RUNNING intervals
```

旧 delegation span 概念改为 runtime activity interval。

---

## 22.4 Members migration

旧：

```text
memberId group
→ sessionIds[]
```

新：

```text
MemberTemplate
→ MemberInstances[]
   ├ instanceId
   ├ childSessionId
   ├ lifecycle
   ├ effective config
   └ provenance
```

旧 renderer structure 可以复用，但 pure model 应重写。

---

## 22.5 Team Dock

迁移视觉/折叠逻辑。

删除：

```text
DOM click hack to switch Team tab
```

优先寻找当前 public navigation/view action；若确实没有跨包 view switch，则 Dock 可以退化为：

```text
Open Team / navigate to Session Team view through supported public navigation
```

不能通过 querySelector 文本匹配作为新正式 contract。

---

## 22.6 TeamMarker

不迁移。

Chat/Trajectory 仅显示真实 first-person facts。

例如 relay 被目标 Agent 接收时，它作为 ordinary attributed input 出现在目标 Session；Team lifecycle/control ledger 留在 Team Tab。

---

## 22.7 Activity / Progress

可以复用旧 task row visual pattern，但文案与数据模型必须改成 telemetry。

---

## 22.8 Compatibility / Effective config / Lifecycle

这是旧 UI 没有完整实现的新内容，需要新写：

```text
compatibility detail
warning acknowledgement
structural fatal
read-effective-first provenance
human override editor
PolicyState
Archive/Restore/Dispose
legacy read-only banner
Start Team from Here
```

---

## 22.9 Gate G9

```text
✓ no upstream client source modified
✓ external client module loads via dsh.client
✓ New Team is separate external flow
✓ Team Tab from Team Remote
✓ Timeline/Members preserve mature interaction value
✓ TeamMarker removed
✓ Restore visibly ends SETTLED
✓ legacy read-only
✓ ordinary Session behavior unchanged
✓ responsive/accessibility basics pass
```

---

# 23. Phase 10 — Hardening / Release

## 23.1 Recovery matrix

覆盖：

```text
process crash
browser reconnect
Host restart
child cold resume
Root cold resume
journal partial operation
projection stale frame
fork sidecar race
capability disappearance
```

---

## 23.2 Concurrency matrix

至少：

```text
parallel create same template
quota boundary race
simultaneous model override + request
archive while running
archive + followup race
restore + followup race
dispose + incoming message
compatibility drift + in-flight work
```

---

## 23.3 Performance

第一版 performance acceptance 不追求 benchmark 极致，但不得存在明显 O(all logs) 设计。

测试：

```text
10 instances
50 instances
100+ ledger events
1000+ ledger events
cold projection
repeated Team Tab open
frequent activity update
```

TeamProjection 不应每次 UI refresh 扫描所有 Agent Session 完整历史。

---

## 23.4 Dormant invariance

Team plugin mounted，ordinary Session：

```text
prompt
AgentPreset
model
tools
skills
MCP
fork
subagent
Chat
Trajectory
```

应与 pristine upstream 行为一致。

---

## 23.5 Gate G10 — Release

```text
✓ all architecture invariants tested
✓ all UI invariants tested
✓ upstream source diff = 0
✓ no private imports
✓ no fork-only hard dependency
✓ legacy read-only behavior
✓ recovery/race suite pass
✓ pinned upstream compatibility pass
✓ plugin independent build/test pass
```

---

# 24. 测试体系

## 24.1 Unit

```text
Blueprint validation
policy resolution
override precedence
FSM
quota
compatibility classification
projection transforms
Timeline math
```

---

## 24.2 Characterization

专门测试 upstream public seams。

这些测试与 ordinary unit test 分目录，目的是在 upstream update 时最快回答：

> 是 Team bug，还是 Host seam 改了？

---

## 24.3 Integration

真实 DSH packages + external Team plugin。

重点：

```text
Agent create/resume
AgentPreset
ModelSelection
Tool pipeline
StorageDomain
Remote
client discovery
```

---

## 24.4 Fault Injection

TeamDomain operation journal 必须拥有 deterministic fault points。

不要只用“随机 kill process”测试。

---

## 24.5 E2E canonical scenario

至少一条端到端：

```text
New Team
→ choose Blueprint
→ compatibility warning
→ acknowledge
→ create Root
→ create instance A/B from same template
→ run both
→ followup A
→ model change A
→ nested generic subagent
→ control request/decision
→ settle
→ archive A
→ restore A = SETTLED
→ new work resumes A
→ Root fork
→ child Team has empty members
→ member Session fork
→ ordinary Session
→ restart Host
→ cold recover
```

---

# 25. Upstream Sync Strategy

## 25.1 Team 不再“merge upstream”

这是独立仓库最大的流程变化。

旧：

```text
git merge upstream/master
```

新 Team repo：

```text
update host compatibility target
→ run characterization + integration CI
```

Team source只有需要适配 public API 时才改。

---

## 25.2 Supported host manifest

每个 Team release 建议声明：

```text
minimum tested DSH version/commit
preferred tested DSH version/commit
latest tested DSH version/commit
known incompatible ranges
```

例如概念上：

```yaml
hostCompatibility:
  tested:
    - dsh: 0.1.2-alpha.1
      commit: cd5ef814...
  incompatible: []
```

具体 manifest 形式实现时决定。

---

## 25.3 CI matrix

建议三层：

```text
A. PINNED
   Team release 的确定性 host

B. LATEST_SUPPORTED
   当前正式支持最新 DSH release

C. UPSTREAM_MASTER_ADVISORY
   提前发现 breaking seam
```

Master advisory 失败：

```text
warn / open compatibility issue
```

不一定阻塞已发布版本。

Pinned/Supported 失败则阻塞 release。

---

## 25.4 Versioning

Team 使用自己的 semver/release cadence。

不再要求：

```text
Team version == DSH version
```

但需要显式 peer/support matrix。

---

# 26. Downstream DSH Fork 的后续定位

用户可以继续保留自己的 deepseek-harness fork。

但建议把职责收敛为：

```text
upstream DSH
+
truly generic downstream experiments/features
```

不再把 Agent Team 当 monorepo feature 长期维护。

---

## 26.1 Permission subsystem

建议未来单独评估：

```text
keep downstream
or
extract to dsh-permission-* independent plugin
```

因为它本身比 Agent Team 更通用。

Team 可以适配它，但不依赖它。

---

## 26.2 Model picker

作为独立 downstream Web feature 保留。

Team 只读取 Host public model routes，不关心 picker UI 怎么分组。

---

# 27. Old Code Retirement Procedure

不要在 vNext 第一天删除旧实现。

采用分阶段退休。

## R0 — Freeze

```text
legacy tag
legacy branch
no new feature
```

## R1 — Reference while vNext foundation develops

旧代码仍可运行，用于：

```text
UX compare
behavior regression
copy pure helpers
```

## R2 — vNext headless parity

G6/G7 后：

```text
old runtime no longer authoritative
```

但仍保留 repo history。

## R3 — vNext UI parity

G9 后：

```text
old ui-team reference only
```

## R4 — First production vNext release

从 active downstream DSH branch 中正式去除 Team-required：

```text
packages/team/**
packages/client/ui-team/**
bundle/team
SessionController Team wiring
known Team events
Team-generated integration
```

注意：Git tag/history 不删除。

---

# 28. 为什么不建议把旧 Team subtree 直接复制到新 repo

表面上这样“复用率最高”，实际上风险最高。

如果直接：

```text
cp -r packages/team dsh-agent-team/packages
```

会同时搬入：

```text
old naming
old package boundaries
memberId identity
SessionEvent persistence
subagent primitive
fork-only permission imports
old projection assumptions
```

之后每个 agent 都会倾向“修到能编译”，而不是“按新 architecture 重建”。

推荐：

```text
Target Contract First
Source Code Second
```

每个迁移单元都要先建立 target interface/test，然后才允许从 legacy reference port 实现。

---

# 29. Source Reuse Review Checklist

任何从旧 repo 拿代码的 PR 都必须回答：

```text
1. source path + legacy SHA?
2. why reusable?
3. does it encode memberId runtime identity?
4. does it read/write Team SessionEvents?
5. does it depend on SubagentRuntime as Member primitive?
6. does it read cwd roster as authority?
7. does it import SessionController Team mirror?
8. does it require fork-only permission packages?
9. what new target contract does it implement?
10. which legacy tests were adapted?
11. what architectural assumptions were deliberately removed?
```

缺一项，不应标记为“migration”；应重新审查。

---

# 30. Public Dependency Policy

新 repo production dependency 只能来自：

```text
published/exported DSH package surfaces
Cordis public package API
standard npm dependencies
```

禁止：

```text
@deepseek-ai/.../src/private-file
../../deepseek-harness/packages/...
git submodule into upstream source
runtime monkey patch
prototype patch
```

测试可以引用 host fixture，但不能改变 production dependency boundary。

---

# 31. Optional Capability Strategy

不是所有 Host feature 都必须成为 Team hard dependency。

定义：

```text
Required structural seam
Optional enhanced capability
Blueprint requirement
```

三者分开。

例如 fork-only permission engine：

```text
not structural Team requirement
may be detected as optional enhanced policy provider
```

MCP `abtem`：

```text
not Team structural requirement
may be Blueprint requirement
```

这样避免 Team 再次变成“什么都必须打包进来”的大 bundle。

---

# 32. CORE_SEAM_BLOCKER 处理流程

如果 Phase 2 或后续发现 seam 不足：

```text
1. create minimal reproduction
2. record upstream SHA
3. identify exact missing public behavior
4. prove no existing public composition path
5. classify affected frozen feature
6. stop that feature
7. do NOT patch upstream in Team repo
```

输出格式建议：

```text
CORE_SEAM_BLOCKER: ROOT_COLD_BINDING
Host SHA: ...
Required behavior: ...
Observed public behavior: ...
Minimal reproduction: ...
Affected architecture invariant: ...
Possible upstream generic seam proposal: ...
```

如果未来决定向 DSH upstream 提 PR，该 PR 必须：

```text
generic
Team-unaware
independently justified
```

但 Team release 仍不能在该 seam 尚未进入支持 Host 版本时声称兼容。

---

# 33. Release Compliance Gates

## C1 — pristine Host

测试前后：

```text
git status --porcelain == empty
git diff --exit-code
```

---

## C2 — no private import

扫描：

```text
/packages/**/src/
relative host paths
unexported subpaths
```

---

## C3 — no patch mechanism

禁止：

```text
patch-package
pnpm patch
postinstall host edit
git apply host patch
```

---

## C4 — no fork-only hard dependency

在真正 upstream checkout 中安装并运行所有 mandatory tests。

---

## C5 — no Team SessionEvent

生产代码中不得声明/依赖：

```text
team/member-bound
team/message
team/progress
team/control-*
team-session/*
team-instance/*
```

作为 DSH SessionEvent control-plane vocabulary。

普通 attributed user/context message 不属于此禁令。

---

## C6 — dormant invariance

普通 Session 不因 Team plugin mounted 而改变行为。

---

## C7 — frozen semantic assertions

必须机器断言：

```text
complete:true = Team FATAL
legacy Team = READ ONLY
Restore = ARCHIVED -> SETTLED
Restore does not resume Agent
Root fork = same Blueprint snapshot + zero members
Member fork = ordinary Session
one template → N persistent instances
follow-up existing instance → same child Session
fresh delegation policy → new instance
```

---

# 34. 风险登记

## Risk 1 — 低估 legacy hidden coupling

**症状**：搬到新 repo 后 import graph 继续要求 SessionController/bundle/private types。

**应对**：target-contract-first；G1/G2；禁止批量复制。

---

## Risk 2 — Downstream permission 被误认为 upstream

**症状**：Team 在 fork 上测试全绿，在 pristine DSH 失败。

**应对**：所有 structural CI 首先跑 pristine upstream；permission subsystem SPLIT。

---

## Risk 3 — Root resume seam 不足

**应对**：P2 提前 characterization；失败即 blocker，不在 P5 才发现。

---

## Risk 4 — StorageDomain crash recovery 复杂度被低估

**应对**：P4 独立成 Phase；先 fault injection，再 runtime。

---

## Risk 5 — UI 复用诱导旧 data model 回流

**应对**：Remote/Projection 在 P8 先冻结；UI 只能依赖新 DTO。

---

## Risk 6 — Old branch 持续接受 feature 导致双线漂移

**应对**：legacy tag + no-vNext-development policy。

---

## Risk 7 — 新 repo package 数过多导致维护负担

**应对**：初版 9 package，内部模块化；只在独立发布/ownership真正需要时再拆。

---

## Risk 8 — 去污染误删 unrelated fork feature

**应对**：provenance manifest；从 upstream-clean 正向重放 KEEP，而非 blind revert。

---

# 35. Rollback Strategy

新架构的一个优势是 rollback 很简单。

如果 vNext 某 milestone 不稳定：

```text
DSH upstream/fork remains independently usable
Team external plugin disabled/unmounted
```

无需：

```text
revert Host core patches
repair SessionController schema
regenerate Host catalogs
```

Legacy old Team reference仍可用于诊断，但不作为新生产 fallback 自动启用。

---

# 36. 建议的 Git branch strategy

## `dsh-agent-team`

```text
main
├─ feat/foundation
├─ feat/team-domain
├─ feat/runtime
├─ feat/remote
├─ feat/ui
└─ fix/...
```

每个 Phase 进入 main 前通过对应 Gate。

下一份 task-decomposition 文档会进一步规定主 Agent 如何创建 task branches/worktrees 与审查。

---

# 37. Documentation Ownership

新 repo 自己拥有：

```text
Architecture baseline copy/link
UI baseline copy/link
Development plan
Blueprint schema docs
Remote API docs
operator guide
migration guide
release compatibility matrix
```

DSH upstream 不再因为 Team feature 更新而修改：

```text
config catalog
module graph
persistence catalog
Agent Notes
package README tables
```

除非未来某个**通用 upstream seam**本身被 upstream 接受；那是独立 upstream contribution，不是 Team release 的一部分。

---

# 38. 第一个可运行 milestone 的定义

不要把“Web UI 打开了”定义为第一个 milestone。

第一个真正有价值 milestone 应是：

```text
HEADLESS TEAM FOUNDATION
```

满足：

```text
pristine upstream host
external Team plugin
Blueprint parse
TeamDomain bind
Root Agent Team identity
create 2 MemberInstances from same template
Member Agents run
persistent followup
cold restart recovery
Team projection CLI/test inspection
no Host patch
```

这证明最关键的架构成立。

UI 在此之后接入。

---

# 39. UI Migration Milestone

第二个产品 milestone：

```text
EXTERNAL WEB TEAM
```

满足：

```text
New Team external entry
TeamIntent
compatibility
Team Tab
Timeline
Members
Events
Dock
lifecycle controls
member Session navigation
```

且：

```text
no SessionController Team mirror
no ui-workspace patch
no Team Chat marker
```

---

# 40. First Production Release Definition

第一版 production-ready vNext 只有在：

```text
G0..G10 all pass
```

并且以下成立时才发布：

```text
✓ independent repository
✓ independent versioning
✓ explicit DSH compatibility matrix
✓ pristine upstream install/run
✓ Team-required Host diff = 0
✓ legacy old implementation retired from active development
✓ legacy Sessions read-only
✓ recovery tests
✓ fork semantics
✓ lifecycle semantics
✓ complete:true fatal
✓ UI public-slot only
```

---

# 41. 对“正式作废现有代码”的最终定义

本计划中的“作废”应精确定义为：

```text
Existing Team implementation
is NOT:
    production architecture authority
    source base for vNext
    dependency of dsh-agent-team
    location for new vNext features

Existing Team implementation
IS:
    frozen reference
    behavioral fixture
    selective source-reuse reservoir
    historical migration evidence
```

这比“删掉旧代码重新写”更准确，也比“继续在旧代码上重构”更安全。

---

# 42. 最终推荐路线

整个迁移可以概括为：

```text
CURRENT
ArmourPiercer1/deepseek-harness
feat/team-vnext-integration-20260829
    │
    ├─ Team code
    ├─ Team Host patches
    ├─ Team UI patches
    ├─ permission subsystem
    ├─ model UI work
    └─ generated coupling

            │
            │ Freeze + classify
            ▼

┌──────────────────────────┐
│ legacy-team-reference    │
│ a3ab319...               │
│ READ/REFERENCE ONLY      │
└──────────────────────────┘

            +

┌──────────────────────────┐
│ deepseek-harness upstream│
│ pristine Host            │
└──────────────────────────┘
            ▲
            │ public seams only
            │
┌──────────────────────────┐
│ dsh-agent-team           │
│ new authoritative repo   │
│ TeamDomain/runtime/UI    │
└──────────────────────────┘

            + optional

┌──────────────────────────┐
│ downstream DSH fork      │
│ permission/model/etc.    │
│ NOT required by Team     │
└──────────────────────────┘
```

这一路线最符合当前已经冻结的 architecture：

```text
Team is a plugin
not a fork-wide modification set
```

---

# 43. Definition of Done — Development Plan

实施完成时必须能够回答“是”：</n
### Repository

```text
[ ] 是否存在独立 dsh-agent-team repo？
[ ] 是否能在 pristine upstream 上独立 build/load/test？
[ ] legacy branch 是否只是 reference？
```

### Current code disposal

```text
[ ] 每个 legacy Team module 是否有 DELETE/MIGRATE/REPLACE/KEEP/SPLIT/REFERENCE_ONLY 分类？
[ ] 是否没有 blind revert 39 commits？
[ ] permission subsystem 是否与 Team 分离？
[ ] unrelated model UI 是否保留而未混入 Team repo？
```

### Architecture

```text
[ ] TeamDomain 是否替代 Team SessionEvents？
[ ] MemberInstance 是否使用 Agent factory 而非 continuable subagent primitive？
[ ] 是否支持 same template -> N instances？
[ ] runtime addressing 是否 instanceId-first？
```

### Integration

```text
[ ] SessionController 是否无 Team mirror？
[ ] core known-event-types 是否无 Team dependency？
[ ] ui-workspace 是否无需 Team patch？
[ ] bundle 是否无需 Team patch？
[ ] client 是否由 external module/slots 加载？
```

### Semantics

```text
[ ] complete:true 是否 Team FATAL？
[ ] Restore 是否只到 SETTLED？
[ ] legacy Team 是否 READ-ONLY？
[ ] Root/Member fork 是否符合冻结语义？
```

### Process

```text
[ ] public-seam characterization 是否先于 feature implementation？
[ ] 每个 Phase 是否有硬 Gate？
[ ] upstream update 是否通过 compatibility CI 而非 merge Team patches？
```

全部成立，才说明本次 major-version refactor 真正完成了“从 DSH fork 内 feature 变成 DSH external plugin”的目标。

---

# Appendix A — 当前审计证据路径

## Upstream public seam

```text
packages/core/agent-loop/README.md
packages/core/agent/src/runtime-types.ts
packages/core/agent/src/model-selection.ts
packages/core/system-prompt/src/index.ts
packages/preset/agent-presets/src/index.ts
packages/storage/storage-domain/README.md
docs/subsystems/client-modules.md
packages/client/ui-sidebar/src/client/contract/slots.ts
packages/client/ui-workspace/src/client/contract/slots.ts
packages/client/ui-conversation/src/client/contract/slots.ts
packages/extensions/cordis-client-runner/src/client/slot-catalog.ts
```

## Legacy Team reference

```text
packages/team/team/src/types.ts
packages/team/team-local/src/parser.ts
packages/team/team-runtime/src/orchestrator.ts
packages/team/team-channels/src/**
packages/team/team-projection/src/**
packages/team/tool-team/src/**
packages/client/ui-team/src/**
packages/api/session-controller/src/team.ts
packages/api/session-controller/src/client/sessions/team-mirror.ts
packages/core/session/src/known-event-types.ts
packages/bundle/team/**
examples/team-agent/**
```

## Fork-only generic capability requiring separate ownership

```text
packages/permission/permission/**
packages/permission/permission-engine/**
packages/permission/tool-permission-guard/**
```

---

# Appendix B — 推荐的 migration manifest schema

建议 Phase 0 生成 machine-readable manifest，例如：

```yaml
baseline:
  upstream: cd5ef8148158c3a752a658978873241fdf8e2bbc
  legacy: a3ab31992762c5d6560797eabc7e0885a9320ade

entries:
  - path: packages/team/team-runtime/src/orchestrator.ts
    owner: TEAM
    disposition: REFERENCE_ONLY
    reason: memberId/one-activation/process-memory authority conflicts with vNext

  - path: packages/client/ui-team/src/client/team-timeline-model.ts
    owner: TEAM
    disposition: MIGRATE
    reason: pure time-domain/tick logic reusable; adapt projection DTO

  - path: packages/core/session/src/known-event-types.ts
    owner: MIXED_UPSTREAM_TEAM_PATCH
    disposition: DELETE_TEAM_HUNK
    reason: TeamDomain replaces Team SessionEvent vocabulary

  - path: packages/permission/permission-engine/src/resolve.ts
    owner: GENERIC_FORK_CAPABILITY
    disposition: SPLIT
    reason: not an upstream capability and not Team-specific
```

这份 manifest 将成为下一阶段 task decomposition 与最终 decontamination review 的共同输入。

---

# Appendix C — 本计划不做的事情

本计划刻意不包含：

```text
每个 subagent 的 prompt
每个任务 branch 的精确命名
每个 PR reviewer 角色
每日/每轮 Agent orchestration workflow
主 Agent 如何分配 coding/review/test agents
```

这些属于下一份：

```text
DSH Agent Team vNext — 任务分包与审查方法
```

届时应直接以本文的 Phase/Gate 为骨架，将每个 Phase 拆成可并行/串行的 task graph。

---

**End of Detailed Development Plan**
