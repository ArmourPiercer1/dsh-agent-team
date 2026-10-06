# DSH Agent Team vNext 详细 UI / Interaction 设计

**文档性质**：下一主版本 UI / Interaction 权威基线  
**状态**：已归档｜UI Design Frozen（核心 UI 语义已冻结；P9 已实现主要 UI，部分冻结入口仍记录为后续缺口）  
**真正执行进度**：作为 UI 权威基线完成；P9-S9 于 2026-09-04 获 `P9_VERDICT=GO`，随后 R118 发现全局 New Team 入口覆盖缺口并由后续 P9 修复批次收口。  
**完成时间**：2026-09-04（P9-S9 GO 及 post-GO UI 缺陷收口节点）  
**日期**：2026-08-29  
**上游架构基线**：`DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md`  
**目标产品**：DSH Agent Team vNext  
**目标宿主**：`deepseek-ai/deepseek-harness` Web UI  
**目标交付形态**：独立外部插件 `dsh-team-vnext` 的 Web client package  
**核心约束**：`CORE PATCH BUDGET = 0`

> 本文只规定用户如何发现、创建、观察、配置、控制和恢复 Team vNext 对象。  
> 本文不规定 package 拆分、文件路径、类名、Remote 方法名、React 组件名、Phase、提交顺序或 coding task。  
> 若 UI 实现便利与《详细架构设计》冲突，必须以架构设计为准。

---

# 0. 规范性说明与权威关系

## 0.1 规范词

- **MUST / 必须**：属于用户可观察 UI 契约；实现不得自行省略或改变语义。
- **MUST NOT / 禁止**：违反即意味着 UI 重新引入已废弃架构或误导用户。
- **SHOULD / 应**：默认交互；若现有 DSH design system 需要调整布局，可以改变视觉实现，但不能改变对象和状态语义。
- **MAY / 可以**：允许的视觉增强，不属于 vNext Release 必备能力。

## 0.2 本文的输入与代码审计点

本文基于：

1. `DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md`；
2. `DSH_Agent_Team_vNext_UI_Interaction_Design_20260828.md`；
3. `DSH_Agent_Team_vNext_Compatibility_Design_20260828.md`；
4. 当前 fork 中已经实现的 Team Timeline / Members / Activity / Events / Dock 用户价值；
5. 当前 upstream Web client 的公开 extension surface。

审计基线：

```text
deepseek-ai/deepseek-harness
master = cd5ef8148158c3a752a658978873241fdf8e2bbc

ArmourPiercer1/deepseek-harness
feat/team-vnext-integration-20260829 = a3ab31992762c5d6560797eabc7e0885a9320ade
feat/agent-teams                  = 506191ba893ac55980dd09680c438710ab24095b
```

当前 upstream 已公开的关键 Web extension surface 包括：

```text
sidebar.footer.action
conversation.view
conversation.session.header.actions
conversation.session.header.utilities
conversation.input.dock
conversation.composer / composer-related extension seats
client module graph via dsh.client
```

而以下区域并没有适合外部插件“在原控件内部再插入一个一级 Team 模式开关”的 additive seat：

```text
原生 New Session sidebar button
New Session hero 内部布局
sidebar.workspaces 主区域
conversation.hero.workspace / agentPreset 的既有 single seat owner
```

因此 UI 必须遵守 0-core 降耦边界，而不是为了视觉上更像“原生功能”去替换 upstream owner。

## 0.3 本文明确取代的旧 UI 语义

| 旧 UI 语义 | vNext 最终 UI 语义 |
|---|---|
| 原生 `New Session` hero 内 `[Agent] [Team]` 一级切换 | **原生 New Session 保持不变；Team 插件提供独立 `New Team` 入口与 Team-owned creation panel** |
| Team Intent 第一次 Send 才 materialize | **TeamIntent 在 Team-owned creation panel 中 staging；用户通过明确 Create/Start 操作 materialize** |
| warning 后先产生可见 AWAITING_ACK fake/blank Team Session | **尽可能在 TeamIntent preflight 阶段解决；真正 Root Session 创建后才出现在 Sidebar** |
| Team durable event 写进 Root/child Session，并逐条插入 Chat | **TeamLedger 来自 TeamDomain，只在 Team control-plane surfaces 呈现；Chat 只显示 Agent 第一人称事实** |
| Team durable event 必须进入 Trajectory | **Trajectory 只显示该 DSH Session 原生 first-person execution trace** |
| `ARCHIVED -> Restore -> RUNNING` | **Restore 只做 `ARCHIVED -> SETTLED`；新 work / Resume 才进入 RUNNING** |
| Legacy Team Session 可迁移后继续 | **Existing Legacy Team Session 只读，不提供 vNext Team mutation / resume** |
| Team UI 依赖 upstream client owner wiring | **所有 Team UI 通过公开 client module / slot / Remote surface 外挂** |

---

# 1. UI 设计目标

Team vNext UI 的核心目标不是“把所有 Team 状态都放到一个巨大面板”，而是让用户始终回答清楚以下五个问题：

```text
1. 我现在处于普通 Agent 还是某个 Team？
2. 这支 Team 是哪个 Blueprint revision？
3. 当前有哪些 MemberTemplate，实际创建了哪些 MemberInstance？
4. 每个 MemberInstance 当前到底是什么配置、为什么是这个配置、是否在运行？
5. 如果系统不允许我继续工作，是 compatibility、policy、capability、lifecycle 还是 structural error 导致的？
```

UI 必须做到：

- **Identity first**：Blueprint、Template、Instance 三层身份不混淆；
- **Read-effective-first**：先展示“现在实际是什么”，再让用户修改；
- **Provenance visible**：配置值必须能解释来源；
- **No silent fallback**：不可用、被拒绝、被抑制、已降级、结构错误必须分开；
- **First-person stays first-person**：Chat/Trajectory 不被 Team control-plane 噪声污染；
- **Control plane stays aggregate**：Team-wide coordination 在 Team Tab 中统一查看；
- **Ordinary DSH remains ordinary**：没有 Team 的 Session 不因安装插件而改变普通 Agent 核心交互；
- **Advanced controls are secondary**：常见用户无需理解所有 policy layer 才能开始工作。

---

# 2. 顶层信息架构

## 2.1 全局结构

安装 Team vNext 后，用户会看到两种不同层级的入口：

```text
Global / Root UI
├─ New Session          # DSH 原生，不修改
├─ New Team             # Team 外部插件新增
└─ Settings / other actions

Conversation / Session UI
├─ Chat                 # DSH 原生 first-person
├─ Trajectory           # DSH 原生 first-person
└─ Team                 # Team 外部插件 view

Composer area
└─ Team Dock            # 仅相关 Team Session 显示
```

## 2.2 为什么不把 Team 塞进原生 New Session

用户心智上仍然是：

```text
New Session = 创建普通 Agent Session
New Team    = 创建 Team Root + TeamSession
```

这不是把 Team 降为二等功能，而是为了保证：

- 不替换 upstream New Session owner；
- 不制造 fake blank Session；
- TeamIntent 在创建前可以拥有完整 compatibility/preflight UX；
- Team 插件可独立安装/卸载；
- 上游更新 New Session hero 时不需要持续三方 merge。

如果未来 upstream 正式开放“New Session mode contribution”公共 seat，可以在不改变本文 TeamIntent/TeamSession 语义的前提下重新考虑视觉合并；vNext 不依赖该未来 seam。

---

# 3. `New Team` 全局入口

## 3.1 固定入口

vNext 必须有一个始终可发现的全局入口：

```text
New Team
```

在当前 upstream 公开 surface 下，推荐固定占据 `sidebar.footer.action` 的一个 additive action。

### Sidebar 展开态

```text
...
Settings
New Team
```

### Sidebar rail / 折叠态

```text
[Team icon]
```

必须有：

- tooltip / accessible label = `New Team`；
- 不与原生 `New Session` 使用完全相同 icon；
- 点击后打开 Team-owned creation panel；
- 不创建 DSH Session。

## 3.2 其他入口

除全局 `New Team` 外，允许存在两个 contextual 入口：

```text
Ordinary Session Team Tab zero-state
→ Start Team from Here

Ordinary Session header action
→ Start Team from Here
```

两者都进入同一个 Team creation panel，只是预填 source Session / workspace / handoff 信息。

## 3.3 禁止入口

禁止通过以下方式创造 Team：

- 把某个 AgentPreset 叫作 `team` 后自动进入 Team；
- 修改当前普通 Session 的 mode；
- 从某个 Member child Session fork 后自动认作 Team；
- 在普通 New Session hero 中用 DOM hack 插入 Team mode；
- 通过路由 URL 参数绕过 TeamIntent/preflight 直接创建 operational Team。

---

# 4. Team Creation Panel

## 4.1 形态

`New Team` 打开一个 Team-owned overlay / modal / panel。

概念布局：

```text
┌────────────────────────── New Team ──────────────────────────┐
│ Team Blueprint                                                │
│ [ AIUED-ALGO · rev17                                  ▾ ]     │
│                                                              │
│ Workspace                                                     │
│ [ D:\Projects\AIUED                                  ▾ ]     │
│                                                              │
│ Runtime preset                                                │
│ [ team-friendly                                        ▾ ]     │
│ Advanced                                                      │
│                                                              │
│ Compatibility                                                 │
│ ✓ Ready                                                       │
│                                                              │
│ Initial work (optional)                                       │
│ [ ...                                                         │
│   ... ]                                                       │
│                                                              │
│                         [Cancel] [Create Team]                 │
└───────────────────────────────────────────────────────────────┘
```

如果由 `Start Team from Here` 打开，还增加：

```text
Context handoff
Source: “UED peak indexing discussion”
[✓] Generate one-shot handoff summary
```

## 4.2 面板中的信息优先级

视觉优先级必须是：

```text
1. Blueprint identity
2. Workspace
3. Compatibility / blocking state
4. Initial work / handoff
5. AgentPreset and advanced runtime substrate
```

AgentPreset 不得与 Blueprint 做成两个同等级“团队选择器”。

## 4.3 Create 与 Create & Send

为使“已创建但尚未开始任何 turn”的 TeamSession 边界可被用户自然使用，Creation Panel 支持：

### 无 initial work

```text
[Create Team]
```

结果：

```text
TeamIntent
→ compatibility accepted
→ create Root Session + TeamSession
→ open Root Session
→ no Root turn yet
```

### 有 initial work

主按钮可以显示：

```text
[Create & Send]
```

结果：

```text
create TeamSession
→ open Root
→ admit initial work
→ Root first turn
```

如果 host creation 成功但 initial work admission 失败，UI 必须保留已创建的真实 TeamSession，不得假装整个 creation 没发生；错误状态应在真实 Root Session 中显示并允许用户修复/重试。

---

# 5. TeamIntent 的 UI 生命周期

## 5.1 TeamIntent 不是 Sidebar Session

Creation Panel 打开时：

```text
TeamIntent exists
Root Session does not exist
TeamSession does not exist
```

因此：

- Sidebar 不增加 Session row；
- Chat/Trajectory 不切换；
- 浏览器地址不应伪造 SessionId；
-关闭面板不需要 archive/delete Session。

## 5.2 TeamIntent 状态

UI 至少区分：

```text
EDITING
CHECKING_COMPATIBILITY
READY
WARNING_REQUIRES_ACK
FATAL
CREATING
CREATION_FAILED
```

这些是 creation UI 状态，不是 TeamSession lifecycle。

## 5.3 关闭面板

若 TeamIntent 有修改：

- 同一次页面运行内 SHOULD 保留未提交 draft，便于重新打开；
- 如果用户明确选择 `Discard`，清空 draft；
- vNext 不承诺浏览器刷新后仍恢复 TeamIntent；
- 未创建 Team 不得在 Sidebar 留下“幽灵会话”。

---

# 6. Blueprint Picker

## 6.1 Picker 信息

每一行至少显示：

```text
Display name
revision
source
short description / role summary if available
validation status
```

示例：

```text
Project
────────────────────────
AIUED-ALGO
rev 17 · Project · 5 templates

Global
────────────────────────
Generic Research Team
rev 8 · Global

Legacy definition source
────────────────────────
.dsh/teammates
Workspace snapshot source
```

## 6.2 Source 分组

至少可以区分：

- project/local Blueprint source；
- global/user Blueprint source；
- shipped/system Blueprint source；
- legacy `.dsh/teammates` synthesized source。

同 display name 不得 silent shadow。

## 6.3 Revision

默认选择 current revision，但 UI 必须可检查：

```text
blueprintId
revision
content identity / source detail
```

如果用户选中后 catalog current revision 变化：

```text
Selected: rev17
Current:  rev18
```

UI 必须提示：

```text
Blueprint changed since selection.
[Use rev18] [Keep selected rev17] [Review]
```

只有 selected old revision 仍可被 catalog/source 正确 resolve 时才允许 Keep。

## 6.4 不提供 Blueprint live editor

vNext Creation Panel：

- 可以查看 Blueprint definition；
- 不提供“编辑后保存回 Blueprint”能力；
- session-local override 不写回 Blueprint。

---

# 7. AgentPreset 在 Team 创建中的 UI

## 7.1 定位

显示名建议：

```text
Runtime preset
```

而不是：

```text
Team preset
```

并附解释：

> Controls the ordinary Agent composition used by the Team. It does not define Team identity.

## 7.2 默认值

默认选择 Team-friendly ordinary AgentPreset，例如：

```text
team
```

但 `team` 只是推荐默认，不是 Team Mode 开关。

## 7.3 Advanced 层级

普通用户默认可以只看到当前值；详细选择放在 `Advanced`。

用户在 TeamIntent 阶段可自由切换 AgentPreset，并实时重跑 compatibility。

## 7.4 `complete:true` FATAL

若所选 AgentPreset 的 effective persona 是 `complete:true`：

```text
Structural incompatibility

This AgentPreset owns a complete system persona and cannot safely host
this Team Blueprint's Leader/Member identity without changing DSH core semantics.

[Choose another runtime preset]
```

必须：

- 状态为 FATAL；
- 禁用 `Create Team` / `Create & Send`；
- 不出现 `Continue anyway`；
- 不偷偷忽略 Blueprint persona；
- 不偷偷把 complete 改为 false。

---

# 8. Workspace 与 Creation-time context

## 8.1 Team default workspace

Creation Panel 明确显示：

```text
Default workspace
```

而不是：

```text
Team location
```

因为 workspace 不定义 Team identity。

## 8.2 Member workspace

MemberInstance 创建时若无 explicit workspace：

```text
inherits TeamSession.defaultWorkspace
```

Instance Detail 必须显示实际 workspace 及 provenance。

Member 首次进入 RUNNING 后，workspace 默认不可修改；UI 将 field 变 read-only，并显示：

```text
Locked after first run
```

如需另一 workspace，推荐 UI 操作为：

```text
Create another instance
```

而不是“Move instance”。

---

# 9. Compatibility：创建前 preflight

## 9.1 目的

用户在创建 Team 前应尽量知道：

- Team 能否结构成立；
- 哪些 expected capability 当前缺失；
- 哪些问题可以 acknowledgement；
- 哪些必须换 Blueprint / AgentPreset / environment。

## 9.2 三类结果

### PASS

```text
Compatibility
✓ Ready
```

### WARNING

```text
Compatibility
⚠ 2 requirements need attention

Simulator
  MCP server "abtem" unavailable

Researcher
  Model route "qwen-local" unavailable

[Review details]
```

可选择：

```text
[Acknowledge warnings and create]
```

Acknowledge 必须是明确动作，不得默认勾选。

### FATAL

```text
Compatibility
✕ Team cannot be created

Leader identity cannot be installed with selected runtime preset.

[Change runtime preset]
```

FATAL 不提供 acknowledgement。

## 9.3 Warning acknowledgement 的显示

每个 warning 必须显示：

```text
requirement owner
capability / route id
actual observed state
what will be degraded
```

UI 不需要向普通用户暴露 fingerprint hash，但必须由 Host/Team runtime 负责判断 acknowledgement 是否仍匹配当前 environment generation。

---

# 10. 创建后的 compatibility / Admission UI

## 10.1 为什么创建后仍可能变化

即使 TeamIntent preflight 通过，运行中仍可能发生：

- model/provider route 消失；
- MCP server 消失；
- skill/tool 不再可用；
- External Hard Policy 变严；
- host capability topology 变化。

因此 TeamSession 仍有实时 compatibility/admission 状态。

## 10.2 Header 状态

至少显示：

```text
✓ Compatible
⚠ Degraded
⚠ Action required
✕ Structural error
```

语义：

- **Compatible**：当前无 mismatch；
- **Degraded**：有 warning，但用户已对当前 generation acknowledge；
- **Action required**：存在新 warning，new Team work admission blocked；
- **Structural error**：Team runtime contract 当前无法继续 operational work。

## 10.3 Admission blocked 时

必须同时在以下位置呈现：

```text
Team Header badge
Team Dock
Composer blocker / inert state
Create/Resume/Delegate controls disabled reason
Instance follow-up disabled reason
```

标准文案：

```text
New Team work is paused until compatibility issues are resolved.
Existing admitted work may continue to settle.
[Review compatibility]
```

UI 不得把已经 RUNNING 的 Member 显示成“已停止”。

## 10.4 修复后的恢复

用户修复 environment/config 后：

```text
Recheck
→ new compatibility generation
→ OPEN / DEGRADED_ACKNOWLEDGED
```

新 generation 的 mismatch 不能被旧 acknowledgement 自动覆盖。

---

# 11. 创建成功后的 Session 体验

真实 Root Session 创建后，用户回到标准 DSH Conversation shell：

```text
Root Session
├─ Chat
├─ Trajectory
└─ Team
```

原则：

- 不建立第二套 Team 聊天页；
- 不建立 Team-specific model conversation shell；
- Root Chat 是 Leader first-person Chat；
- Team Tab 是 aggregate control plane。

---

# 12. Team Tab 总体结构

## 12.1 固定结构

```text
Team
├─ Team Header
├─ Timeline
├─ Members
│   └─ contextual Instance Detail
├─ Activity / Progress
└─ Events
```

Timeline 继续是一级核心区域，位于 Members 上方。

## 12.2 不增加 permanent fifth control column

Instance Detail 是 Members 的 contextual extension：

桌面：

```text
Members                         Instance Detail
───────────────────────         ───────────────────────
Researcher                      researcher-A
  researcher-A                  Status  SETTLED
  researcher-B                  Model   Qwen
                                Workspace ...
```

窄屏：

```text
Members
↓
Selected Instance Detail
```

业务语义完全相同。

---

# 13. Team Header

## 13.1 Root perspective

示例：

```text
AIUED-ALGO · rev17
Policy: Exploration
Compatibility: ✓ Compatible
Runtime preset: team
Perspective: Leader
2 running · 3 settled · 1 archived
```

## 13.2 Member perspective

在 Member child Session 打开 Team Tab：

```text
AIUED-ALGO · rev17
Perspective: researcher-A
Policy: Exploration
Compatibility: ✓ Compatible
```

Members / Timeline 同时高亮当前 MemberInstance。

## 13.3 Header 可交互项

允许：

- PolicyState selector；
- Compatibility detail；
- Blueprint identity/revision/source detail；
- AgentPreset 只读查看；
- 在架构允许的 pre-first-turn window 内显示 Change runtime preset；
- pending control count；
- Team-wide counts。

禁止：

- 换 Blueprint；
- 把 TeamSession rename 等同 Blueprint rename；
- 在 Header 直接编辑 Blueprint 文件。

---

# 14. Team Dock

## 14.1 位置与目的

Team Dock 位于 composer 上方的 additive dock seat。

它是：

```text
status + alert + navigation
```

不是第二套 Team control plane。

## 14.2 折叠态

Root：

```text
AIUED-ALGO · 2 running · ⚠ 1 pending
```

Member：

```text
AIUED-ALGO · researcher-A · SETTLED
```

Admission blocked：

```text
AIUED-ALGO · ⚠ Team work paused
```

## 14.3 展开态

最多提供：

- 当前 perspective；
- running/settled counts；
- pending control count；
- compatibility alert；
- `Open Team`；
- `Review pending decisions`。

禁止在 Dock 中放：

-完整 Timeline；
- event list；
- Blueprint picker；
-完整 override matrix；
-复杂 lifecycle editor。

---

# 15. Timeline

## 15.1 语义

Timeline 展示 TeamDomain 中可观察到的 Member work activity interval。

它不是跨 child Session log 按 timestamp 合并出来的“全局执行真相”。

## 15.2 层级

主结构：

```text
MemberTemplate
└─ MemberInstance lane
```

示例：

```text
Algorithm Researcher
 ├─ researcher-A    ███████      ████
 └─ researcher-B       ███████

Simulator
 └─ simulator-A           █████████
```

## 15.3 Bar

Bar 表示：

```text
RUNNING activity interval
```

同一 persistent instance 可以有多段：

```text
RUNNING → SETTLED → RUNNING
```

所以同一 lane 可以出现多根 bar。

Archive / Dispose 不删除历史 bar。

## 15.4 Interaction

必须保留当前成熟能力：

- zoom；
- pan；
- pointer-centered wheel zoom；
- keyboard pan/zoom/reset；
- hover exact start/end/duration；
- running interval 随当前时间延伸；
- idle gap；
- click bar -> Open corresponding Member Session。

## 15.5 groupId

Timeline 的主层级不改成 Workstream tree。

`groupId` 可以作为：

- lane tag；
- hover metadata；
- optional filter；
- optional visual separator。

但不能显示：

```text
Group status
Group lifecycle
Group completion
Group owner
```

因为这些语义不存在。

---

# 16. Members：Template → Instance

## 16.1 固定层级

```text
Leader
  Root session

Algorithm Researcher                 [+]
  researcher-A       RUNNING
  researcher-B       SETTLED
  researcher-C       ARCHIVED

Simulator                            [+]
  simulator-main     RUNNING

Reviewer                             [+]
  No instances
```

## 16.2 Template row

至少显示：

- display name / role；
- active / total count；
- quota summary；
- create `+`；
- template menu；
- optional description。

Template row 本身没有 runtime status。

## 16.3 Instance row

至少显示：

```text
label
lifecycle
activity indicator
model summary
groupId tag if present
compatibility/degraded hint if instance-specific
current perspective highlight
```

`instanceId` 不需要始终完整展示，但在 detail / diagnostics 必须可复制查看。

## 16.4 Duplicate label

允许两个 instance 有相同 label。

UI 不得用 label 作为 selection key 或唯一导航文本。

当发生同名时，可显示辅助短 id：

```text
Fourier · inst…A7F2
Fourier · inst…C91B
```

---

# 17. 创建 MemberInstance

## 17.1 `+` action

Template row 的 `+` 打开 Create Member dialog：

```text
Create MemberInstance
Template      Researcher       read-only
Label         [ Fourier ]
Group         [ route-fourier ] optional
Workspace     [ ... ]
Initial work  [ ... ] optional
Advanced      [ ... ]

[Cancel] [Create]
```

## 17.2 `fresh_per_delegation`

对于采用 fresh-per-delegation creation policy 的 Template，UI 文案必须体现：

```text
New delegation creates a new instance.
```

不得表现为：

```text
Reset existing member context
```

## 17.3 Explicit create vs delegate-and-create

UI explicit `+` 创建是一个合法入口。

Leader model 通过 Team tool 发起新 delegation 时，也可能隐式创建 instance。

二者最终产生完全相同种类的 MemberInstance；UI 不应给“模型创建的 instance”使用不同对象模型。

---

# 18. MemberInstance Detail

## 18.1 默认：Effective Configuration

打开 Instance Detail 时，默认第一屏不是 editor，而是：

```text
Effective Configuration
```

每个字段显示：

```text
value
effective state
source / provenance
suppressed?
unavailable?
deniedBy?
when change takes effect
```

## 18.2 示例

```text
Model
Qwen3.8-27B
Source: Explicit user override
Effective: next request boundary

Workspace
D:\AgentDev\worktree-fourier
Source: Instance creation
Locked after first run

Bash
Allowed
Source: Blueprint / MemberTemplate

Web
Denied
Source: PolicyState / locked-validation

Autonomy overlay
Allow web
Stored, currently suppressed by PolicyState

MCP: abtem
Unavailable
Expected by Blueprint; no current provider
```

## 18.3 必须分开的状态词

```text
Inherited
Overridden
Suppressed
Unavailable
Denied
Locked
Pending next boundary
Degraded
```

不得统一显示为 `Disabled`。

---

# 19. Override 编辑

## 19.1 二级入口

```text
[Configure]
```

进入 user override editor。

## 19.2 Editor 只编辑 Explicit Human Override

默认 editor 的主语义是：

> 用户明确设置当前 TeamSession / MemberInstance 的 durable override。

Autonomy Overlay 可以查看，但不应伪装成“用户刚刚设置的值”。

## 19.3 字段示例

```text
Model       [ Inherit ▾ ]
Bash        [ Allow   ▾ ]
Web         [ Inherit ▾ ]
MCP abtem   [ Allow   ▾ ]
Skills      [ ...        ]
```

## 19.4 Reset

每个 field 提供：

```text
Reset override
```

含义：

```text
remove this explicit human override
→ recompute effective value from lower layers
```

不修改 Blueprint。

## 19.5 External hard policy

如果用户选择的 override 被 External Hard Policy 阻止：

```text
Requested: Allow Bash
Effective: Denied
Reason: Managed policy
```

UI 可以保存或拒绝无法生效的 request 取决于最终 Host API contract，但无论哪种实现，都必须清晰显示最终 effective result；禁止假装 user override 越过 hard policy。

---

# 20. Template Session Defaults

Template menu：

```text
Researcher [...]
  Role details
  Session defaults…
  View Blueprint definition
```

`Session defaults` 的准确语义：

> 当前 TeamSession 中，从该 MemberTemplate **未来创建**的新 MemberInstance 默认使用的 session-local override。

必须显示：

```text
Applies to future instances only.
Existing instances are not changed.
```

现有 instance 通过各自 Instance Detail 修改。

---

# 21. PolicyState

## 21.1 位置

Team Header：

```text
Policy [ Exploration ▾ ]
```

## 21.2 切换

普通切换不默认弹危险确认框，但在 commit 前可显示 impact preview：

```text
Switch to Validation

3 effective settings will change
2 explicit user overrides remain effective
1 autonomy overlay will become suppressed

[Cancel] [Switch]
```

## 21.3 重要文案

PolicyState 的帮助文案应说明：

> Policy controls the Team's current runtime governance envelope. It does not represent task progress.

禁止将：

```text
Research → Coding → Review → Testing
```

仅因为像任务阶段就显示成 Team workflow progress。

---

# 22. Model control

## 22.1 Root

Root/Leader model 继续使用 DSH ordinary model control，但 Team UI 可在 Effective Config 中显示其 Team provenance/constraints。

## 22.2 Member

MemberInstance 使用 Team-owned model control：

```text
Instance Detail
Model [ Qwen3.8-27B ▾ ]
```

不得直接复用 generic addressed-subagent model selector 作为权限绕过路径。

## 22.3 Pending next boundary

若 Member 当前有 in-flight request，用户切换 model 后显示：

```text
Current request: Model A
Next request:    Model B
```

或：

```text
Model B · pending next request boundary
```

不得让用户误以为正在生成中的 request 已切换模型。

---

# 23. Member lifecycle UI

## 23.1 CREATED

含义：identity/session/binding 已创建，但没有运行过有效 work。

操作：

```text
Open Session
Send work…
Archive
Dispose
```

## 23.2 RUNNING

操作：

```text
Open Session
Send follow-up / steering where supported
Archive
Dispose
```

Archive/Dispose 必须提示会终止/收束当前执行：

```text
This member is currently running.
Archiving will stop current work and drain resident descendants before the member is archived.
```

## 23.3 SETTLED

操作：

```text
Open Session
Resume…
Archive
Dispose
```

`Resume…` 不是一个空状态切换按钮；点击后打开“发送新 work”交互。

只有新 work 真正 admitted 后：

```text
SETTLED -> RUNNING
```

如果 Member 当前 non-resident，Host 会先 cold resume Agent；UI 不要求用户手动“启动进程”。

## 23.4 ARCHIVED

默认从 active roster 折叠：

```text
▸ Archived (3)
```

展开后：

```text
Restore
Open Session
Dispose
```

点击 Restore 后：

```text
ARCHIVED -> SETTLED
```

UI 立即表现为可再次接收工作，但：

- 不显示 RUNNING；
- 不显示“Agent resumed”；
- 不发 prompt；
- 不调用 model。

## 23.5 DISPOSED

Disposed 不出现在 normal active roster。

历史可从：

- Team Events；
- Timeline historical lane；
- diagnostic/history disclosure；
- child Session Chat / Trajectory；

访问。

确认文案：

```text
Dispose this member?

This member cannot be restored or receive new Team work.
Its Session history, Chat, Trajectory, and Team audit history will be retained.

[Cancel] [Dispose]
```

禁止使用“Delete member”作为主文案。

---

# 24. Lifecycle 与 Agent Residency 的 UI 分离

用户主界面显示 Member lifecycle：

```text
CREATED / RUNNING / SETTLED / ARCHIVED / DISPOSED
```

Agent residency：

```text
resident / cold / resuming
```

属于次级 runtime diagnostic 信息。

默认 Members row 不应把 `cold` 当成 lifecycle。

Instance Detail / Advanced runtime status 可显示：

```text
Lifecycle: SETTLED
Agent residency: Cold
Child Session: Available
```

这样避免用户误解“进程内没有 live Agent = Member 不存在”。

---

# 25. Activity / Progress

## 25.1 定位

保留当前 UI 的任务板视觉价值，但正式名称：

```text
Activity / Progress
```

## 25.2 内容

示例：

```text
● Running
Literature screening
researcher-A
“17 papers retained”

✓ Completed
Baseline simulation
simulator-A
```

## 25.3 非 workflow authority

Activity / Progress：

- 可以显示 structured progress；
- 可以显示 current/last action；
- 可以显示 correlation；
- 不自动改变 PolicyState；
- 不自动创建 reviewer；
- 不拥有 DAG；
- 不决定“整个项目已完成”。

UI 不得画出会让用户误认为存在正式 Workflow State 的不可逆 stage graph。

---

# 26. Message / Control / Approval

## 26.1 Pending decisions

Team Header 与 Dock 显示：

```text
1 pending decision
```

点击进入 Team Events 的 pending-control filter 或 contextual decision panel。

## 26.2 Control request detail

至少显示：

```text
requester MemberInstance
request kind
requested operation
reason
creation time
current status
requested authority
```

## 26.3 Decision

可能的 decision label 由最终 Team runtime vocabulary 决定，但 UI 必须区分：

```text
allow / deny / escalate / request revision / other typed decision
```

Decision 是 Team coordination fact，不等同实际 tool/model operation。

如果 decision = allow，后续真实 tool call 仍在 Member Session 的 Trajectory 中出现。

## 26.4 External hard policy

若 Team approval 允许，但 DSH hard policy 最终阻止：

```text
Team decision: Allowed
Execution: Blocked by managed policy
```

不得把它显示成“approval failed”。

---

# 27. Team Events：TeamLedger 的唯一 aggregate chronology

## 27.1 来源

Events：

```text
= TeamDomain / TeamLedger
```

不是：

```text
Root Session events + all child Session events merged by wall clock
```

## 27.2 展示内容

至少包括：

- Team creation / binding；
- Member provisioning / creation；
- work admitted / settled correlation；
- lifecycle change；
- message coordination；
- control request / decision；
- PolicyState transition；
- runtime/user override mutation；
- compatibility warning / acknowledgement；
- model mutation request/effective boundary；
- handoff / fork provenance；
- progress/activity coordination facts；
- recovery diagnostics where user-visible。

## 27.3 Event row

默认紧凑一行：

```text
14:32  researcher-A  Model override → Qwen3.8-27B
```

展开：

```text
Event type
ledger sequence
timestamp
actor instance
related instance/template
correlation id
summary
safe payload/detail
related Session navigation
provenance
```

## 27.4 Filter

至少支持：

```text
All
Members
Lifecycle
Messages
Controls
Policy / Overrides
Compatibility
Progress
```

并可按 instance/template filter。

## 27.5 Pagination

大量 TeamLedger history 必须支持 historical pagination / load earlier。

实时新 event 到达不能导致用户当前查看的旧历史窗口突然丢失或跳回顶部。

---

# 28. Chat 边界

## 28.1 Root Chat

Root Chat：

```text
= Leader DSH Session first-person human-readable conversation
```

展示：

- user prompt；
- Leader answer；
- Leader真实 tool call/result 的 Chat presentation；
-真正进入 Root Agent context 的 relay/injected context；
- DSH native conversation markers。

## 28.2 Member Chat

Member Chat：

```text
= that Member child Session first-person conversation
```

如果 Team coordination 将一条任务 relay 到 Member：

```text
TeamLedger:
  leader -> inst-A message M

Member Chat:
  Agent actually received relay M
```

两者通过 correlation 关联，但不是同一 authority。

## 28.3 禁止 synthetic TeamLedger Chat spam

vNext 不再要求：

```text
1 TeamDomain event -> 1 synthetic Chat node
```

例如：

```text
Member lifecycle changed
PolicyState changed
compatibility ack
Team override changed
```

如果这些事实没有真实进入当前 Agent 的 first-person Session，就不应伪造为 Chat conversation node。

## 28.4 可选关联提示

当一个 native Chat item 带有 Team correlation 时，UI MAY 提供小型：

```text
View in Team Events
```

但不能复制整个 Team event 成第二条 Chat history。

---

# 29. Trajectory 边界

Trajectory：

```text
= selected DSH Session first-person durable execution trace
```

Root 和每个 Member 各自独立。

必须保留：

- model request/response execution；
- tool call/result；
- native message admission；
- turn/step facts；
-该 Agent 真正收到的 Team relay/context 的 native provenance。

不要求：

```text
TeamDomain-only lifecycle/policy/compatibility event
```

伪装成 Trajectory record。

禁止：

```text
Global Team Trajectory
```

跨 Session coordination chronology 由 Team Events / Timeline 提供。

---

# 30. Member Session 导航

每个 MemberInstance 的 child Session 是真正 DSH Session：

```text
researcher-A
├─ Chat
├─ Trajectory
└─ Team
```

Team tab：

- 显示同一个 TeamSession aggregate；
- 高亮当前 `instanceId`；
- Header 显示 `Perspective: researcher-A`；
- Open Leader / Open other Member 仍通过 Team navigation 明确发生。

Members row：

```text
click row
→ select contextual detail

Open Session
→ navigate to child Session
```

Timeline bar：

```text
click
→ Open corresponding Session
```

---

# 31. 普通 AgentSession 的 Team zero-state

普通 Session 仍可以看到 Team tab，使功能可发现：

```text
This Session is not part of a Team.

Create a new Team using a one-shot context handoff from this Session.

[Start Team from Here]
```

可显示简短说明：

```text
The current Session will not be converted or modified.
```

---

# 32. `Start Team from Here`

## 32.1 入口

- ordinary Session Team zero-state；
- ordinary Session header action。

## 32.2 行为

```text
Current Session A
↓ Start Team from Here
Team Creation Panel / TeamIntent B
```

预填：

```text
Default workspace = A.workspace
Source session     = A
Handoff            = enabled by default
Blueprint          = user select
Runtime preset     = team-friendly default
```

A 不被转换，不挂 TeamSession。

## 32.3 Handoff UX

Creation Panel：

```text
Context handoff
Source: “UED peak indexing discussion”

[✓] Generate a one-shot summary
```

生成成功后，可展开 preview：

```text
Summary ready
[Preview]
```

Team 创建后，可在 Root Team detail / provenance 中看到：

```text
Started from Session: ...
Handoff generated at: ...
```

但不得显示：

```text
Live linked memory
Shared conversation
Inherited full history
```

## 32.4 Handoff failure

```text
Context handoff failed

[Retry]
[Continue without handoff]
[Cancel]
```

`Continue without handoff` 必须是明确 user decision。

---

# 33. Fork UX

## 33.1 Fork Team Root

用户使用 DSH native fork 后，新 Root：

```text
same Blueprint snapshot
new TeamSession identity = new Root SessionId
MemberInstances = empty
```

首次打开新 fork 的 Team tab，应提供一次非阻塞说明：

```text
Forked Team Session

This fork keeps the same Team Blueprint snapshot and conversation lineage.
Runtime MemberInstances were not copied.

[Got it]
```

禁止把父 Team 的 Member rows复制成新 Team 的当前成员。

## 33.2 Fork Member child Session

对 Member child Session 使用 native fork 后，新 Session 是普通 AgentSession。

Team zero-state 可显示：

```text
This Session was forked from a Team member, but it is not a member of that Team.

[Start Team from Here]
```

禁止自动：

-加入原 Team；
-创建新 MemberInstance；
-创建新 TeamSession；
-成为 Leader。

---

# 34. Legacy Team Session UI

## 34.1 明确只读

检测到 Existing Legacy Team Session：

```text
Legacy Team Session · Read only
```

顶部 persistent banner：

```text
This Session was created by the previous Team implementation.
Team vNext will not resume or mutate it as a vNext Team.
Historical Chat and Trajectory remain available.
```

## 34.2 允许的 UI

- Open Chat；
- Open Trajectory；
- 如果旧 metadata 可通过公开 seam 解码，显示 Legacy Team summary；
- history/session navigation；
-显式 export/import data action（若后续实现）。

## 34.3 禁止的 UI

不显示可执行：

```text
Resume Team
Restore Member
Create Member
Change PolicyState
Edit Team override
Continue legacy Team mutation
Upgrade in place
```

如果提供迁移工具，它必须是未来明确的 data import/export 工作流，而不是“Continue”按钮。

---

# 35. Sidebar 与 Session title

## 35.1 真正 Team Root

只有真实 Root Session 创建后，才作为正常 first-class Session 出现在 Sidebar。

它继续使用 DSH 原生 Session title 机制。

UI MAY 在 row 上增加小型 Team badge：

```text
[Team] UED sample alignment
```

但 Blueprint name 不强行永久覆盖 Session title。

## 35.2 Member child Session

不要求把所有 Member child Session 平铺进 Workspace Sidebar 主列表。

主要导航来自：

```text
Team Members / Timeline / Events
```

如果 DSH 原生 lineage surface 显示它们，Team plugin 不应建立第二套互相冲突的 Sidebar hierarchy。

## 35.3 TeamIntent

TeamIntent 不出现在 Sidebar。

---

# 36. Team runtime / TeamDomain error UI

## 36.1 TeamDomain unavailable

如果 Team control plane 无法读取：

```text
Team data unavailable

Chat and Trajectory for this Session are still available.
New Team work is disabled until Team state can be recovered.

[Retry]
[Diagnostics]
```

原则：

- fail closed for Team mutation；
-不阻止 native historical Chat/Trajectory；
-不伪造空 Team；
-不 silently convert Team Session to ordinary Session。

## 36.2 Binding corruption

```text
Team integrity error
Instance binding is inconsistent.

New Team work has been disabled.
[View diagnostics]
```

不得自动猜测 childSessionId/instanceId mapping。

## 36.3 Recovering / reconnect

UI 可以显示：

```text
Reconnecting…
Recovering Team state…
```

但旧 projection 不得在新 generation 到达后覆盖新状态。

对于 action submit：

- 需要 request identity / optimistic state 与 Host accepted state 对齐；
- UI 不得仅凭本地 optimistic mutation 宣称 lifecycle 已 durable commit。

---

# 37. 状态来源规则

UI 不自行复算业务 authority。

| UI Surface | 权威数据来源 |
|---|---|
| Team Header | Team aggregate projection |
| Members | Team aggregate projection |
| Timeline | Team activity/ledger projection |
| Events | TeamLedger projection |
| Compatibility | Host/Team compatibility resolver output |
| Effective config | Team policy resolver output |
| Model availability | Host model/provider directory + Team-authorized probe |
| Chat | selected DSH Session Conversation projection |
| Trajectory | selected DSH Session Trajectory projection |
| Workspace list | DSH workspace surface |
| AgentPreset list | DSH AgentPreset surface |

禁止 client 自己根据：

```text
Blueprint JSON + event list + local guesses
```

重新算 effective permission/policy。

---

# 38. 错误、限制与降级词汇

UI 必须使用不同语义：

## Unavailable

```text
Capability / route does not currently exist.
```

## Denied

```text
Capability exists but effective policy forbids use.
```

## Suppressed

```text
An overlay is stored, but a higher current Team governance layer prevents it from becoming effective.
```

## Locked

```text
Field can no longer mutate at this lifecycle boundary.
```

## Degraded

```text
A compatibility warning exists and has been explicitly acknowledged for the current generation.
```

## Action required

```text
A new compatibility warning blocks new Team work admission.
```

## Structural error

```text
The Team contract cannot safely operate under the current substrate.
```

禁止把所有上述情况变成灰掉按钮而没有 reason。

---

# 39. 典型端到端屏幕流

## 39.1 创建普通 Team

```text
Sidebar: New Team
↓
Creation Panel
↓ choose Blueprint
↓ choose workspace
↓ compatibility PASS
↓ Create Team
↓
Root Session opens
↓
Chat / Trajectory / Team
```

## 39.2 创建时 warning

```text
New Team
↓
Compatibility WARNING
↓
Review mismatch
├─ Change config -> recheck -> PASS
└─ Acknowledge -> create DEGRADED Team
```

## 39.3 `complete:true`

```text
New Team
↓ choose AgentPreset complete:true
↓
FATAL
↓
Create disabled
↓
Choose another runtime preset
```

## 39.4 创建两个同 template route

```text
Team Tab / Members
Researcher [+]
↓
Create Fourier / workspace A
→ inst-A

Researcher [+]
↓
Create Neural / workspace B
→ inst-B
```

## 39.5 Follow-up settled Member

```text
researcher-A SETTLED
↓ Resume…
↓ enter new work
↓ submit
↓ cold Agent resume if needed
↓ work admitted
↓ RUNNING
```

## 39.6 Archive / Restore

```text
RUNNING
↓ Archive
stop + drain + quiesce
↓
ARCHIVED
↓ Restore
SETTLED
↓ Resume… + new work
RUNNING
```

## 39.7 Compatibility drift during execution

```text
Team OPEN
Members running
↓ capability disappears
Team admission = BLOCKED_WARNING
↓
Existing work continues to settle
New prompt/create/resume disabled
↓
User repairs or acknowledges
↓
Admission reopens
```

## 39.8 Start Team from ordinary Session

```text
Ordinary Session
Team tab zero-state
↓ Start Team from Here
Creation Panel
↓ one-shot handoff
↓ Create Team
New Root Session
```

## 39.9 Root fork

```text
Team Root P
↓ DSH Fork
Root C
same Blueprint snapshot
zero current Members
```

---

# 40. Action availability matrix

| State | Open Session | New work / Resume | Create child instance | Archive | Restore | Dispose | Edit instance runtime config |
|---|---:|---:|---:|---:|---:|---:|---:|
| CREATED | Yes | Yes | N/A per instance | Yes | No | Yes | According to field lifecycle |
| RUNNING | Yes | Follow-up/steer | N/A per instance | Yes, quiesce | No | Yes, quiesce | Future-operation fields only |
| SETTLED | Yes | Yes (`Resume…`) | N/A | Yes | No | Yes | According to envelope |
| ARCHIVED | Yes | No until Restore | N/A | No | Yes -> SETTLED | Yes | Read-only until restored unless explicitly safe metadata |
| DISPOSED | Historical only | No | N/A | No | No | Already terminal | No |

Team-wide action还同时受：

```text
compatibility/admission
caller authority
External Hard Policy
quota
field mutation lifecycle
```

矩阵中的 `Yes` 仅表示 lifecycle 本身允许，不表示最终 policy 一定允许。

---

# 41. Responsive design

## Desktop

- Timeline 全宽；
- Members + Instance Detail 可分栏；
- Events 可使用 table/list hybrid；
- Creation Panel 可用宽 modal；
- Detail provenance 可两列显示。

## Narrow / Mobile

- Creation Panel 变全屏 sheet；
- Timeline 支持水平触控 pan/zoom；
- Instance Detail 下沉到 Members 后；
- Team Dock 保持单行；
- Events detail 使用 disclosure；
- 不建立另一套简化业务模型。

---

# 42. Accessibility

必须：

- 所有状态都有 text label，不只靠颜色；
- Timeline 支持 keyboard pan / zoom / reset；
- Member disclosure 可 keyboard expand/collapse；
- lifecycle action 有 accessible name；
- icon-only rail `New Team` 有 tooltip + aria label；
- warning/FATAL 使用文字说明；
- Dialog focus trap / Escape / return focus 符合现有 DSH modal 行为；
- pending change / blocked reason 对 screen reader 可读。

---

# 43. 推荐术语与 Microcopy

## 43.1 对象名称

```text
Team Blueprint
Team
Member Template / Role
Member
Member instance id (advanced only)
Runtime preset
Policy
Compatibility
Team Events
Activity / Progress
```

普通 UI 可把 `MemberInstance` 显示为 `Member`，但 detail/diagnostics 必须能明确显示 template 与 instance identity。

## 43.2 避免术语

禁止或应避免：

```text
Team Preset            # 容易与 AgentPreset 混淆
Reset member           # fresh_per_delegation 不重置 instance
Restart member         # settled continuation 是 Resume with work
Delete member          # Dispose 不删除历史
Workflow state         # vNext 没有 WorkflowState
Workstream             # vNext 只有 groupId metadata
Inherited full history # handoff 不是 live inheritance
```

## 43.3 Restore / Resume

固定：

```text
Restore
= make an archived Member available again; no model call

Resume…
= send new work to a settled Member; may cold-resume its Agent and then enter RUNNING
```

这两个词不得互换。

---

# 44. 当前 fork UI 的复用价值

当前 `packages/client/ui-team` 已经具备值得保留的用户体验：

- `conversation.view` Team tab；
- Timeline 的 zoom/pan/keyboard/hover；
- Member session navigation；
- Members grouping；
- Activity / Progress；
- control/message event list；
- Team Dock；
-当前 Session perspective 高亮。

这些交互价值应在 vNext 延续。

但以下旧 UI 语义必须被改写：

```text
old memberId-centric group
→ Template + 0..N instance hierarchy

old Team mirror from Session Team events
→ TeamDomain aggregate projection

old chat team-marker for every durable Team event
→ remove for TeamDomain-only events

old Team event Timeline/Events tied to SessionEvent vocabulary
→ TeamLedger vocabulary

old one member definition ≈ at most one active instance
→ multiple persistent instances

old lifecycle restore semantics
→ Restore -> SETTLED
```

---

# 45. 当前 upstream public UI seam 对 UI 设计的约束

本文冻结以下产品映射：

| 产品 surface | 当前可用 public UI seam / 外挂方式 |
|---|---|
| Team Tab | additive `conversation.view` |
| Team Dock | additive `conversation.input.dock` |
| Start Team from Here header action | additive `conversation.session.header.actions` |
| New Team global action | additive `sidebar.footer.action` |
| Team external client | dynamic `dsh.client` client module |
| Team Remote data/actions | Team-owned Remote/Typert service |
| Ordinary Chat/Trajectory | 不替换 owner，使用 DSH 原生 surface |

明确不要求：

```text
replace conversation root
replace sidebar.workspaces
replace New Session hero
patch ui-workspace
patch ui-conversation
patch SessionController client mirror
```

如果开发阶段发现某个冻结 UI 行为确实需要不存在的 public seam，必须标记：

```text
CORE_SEAM_BLOCKER
```

而不是通过 DOM private hack、upstream source patch 或复制整块 shipped UI 来假装满足。

---

# 46. UI 不变量

以下条目应直接进入后续开发计划、任务审查 checklist 和 UI tests。

1. **原生 New Session 保持普通 Agent 产品流，不因 Team plugin 被替换。**
2. **Team 有独立、始终可发现的 `New Team` 入口。**
3. **当前基线下 `New Team` 使用 public additive root/sidebar action，而不是修改 New Session hero。**
4. **New Team 打开 Team-owned Creation Panel。**
5. **TeamIntent 不是 Session，不出现在 Sidebar。**
6. **Blueprint 是 Team 创建时最主要 identity selection。**
7. **AgentPreset 以 Runtime preset secondary/Advanced 身份呈现。**
8. **`team` AgentPreset 只是推荐默认，不代表 Team Mode。**
9. **`complete:true` AgentPreset 显示 structural FATAL，不能 Continue Anyway。**
10. **Team 创建前尽可能完成 compatibility preflight。**
11. **WARNING acknowledgement 必须明确，不能默认忽略。**
12. **FATAL 禁用 Create。**
13. **只有真实 Root Session 创建后才出现 Sidebar Session row。**
14. **创建后使用原生 DSH Conversation shell。**
15. **Team Tab 是 Team aggregate control plane。**
16. **Chat 是 selected Agent 第一人称 conversation。**
17. **Trajectory 是 selected Agent 第一人称 execution trace。**
18. **TeamDomain-only event 不被伪造成 Chat node。**
19. **TeamDomain-only event 不被伪造成 Trajectory record。**
20. **Team-wide chronology 只由 TeamLedger/Events 提供。**
21. **禁止跨 child logs 按 timestamp 构造 authoritative total order。**
22. **Team Tab 固定保留 Header / Timeline / Members / Activity / Events。**
23. **Timeline 是一级核心区域。**
24. **Timeline 主层级 = Template -> Instance lane。**
25. **同一 instance 多次 RUNNING 显示为同一 lane 多个 interval。**
26. **Archive/Dispose 不删除 Timeline historical interval。**
27. **Members 主层级 = Template -> Instance。**
28. **一个 Template 可显示 0..N instances。**
29. **duplicate instance label 合法，UI 不把 label 当 identity。**
30. **groupId 只显示为 tag/filter/group hint，不显示 workflow/lifecycle 语义。**
31. **Instance Detail 默认 read-effective-first。**
32. **Effective config 必须显示 provenance。**
33. **Explicit Human Override 与 Autonomy Overlay 必须可区分。**
34. **suppressed overlay 必须可见，不可假装已删除。**
35. **Template Session Defaults 默认只影响 future instances。**
36. **PolicyState 位于 Team-level Header，不属于单个 Member。**
37. **PolicyState 不显示成 Workflow progress。**
38. **Explicit Human Override 不被 PolicyState suppress。**
39. **Member model control 使用 Team-owned authorized action。**
40. **in-flight model request 不因 UI model change 被显示成中途切换。**
41. **CREATED/RUNNING/SETTLED/ARCHIVED/DISPOSED 是唯一 Member lifecycle vocabulary。**
42. **Restore = ARCHIVED -> SETTLED。**
43. **Restore 不调用 model、不开始 turn、不要求 live Agent resume。**
44. **SETTLED 的 `Resume…` 必须与新 work 一起发生。**
45. **Agent residency 不等于 Member lifecycle。**
46. **Disposed 不可 Restore，但历史保留。**
47. **Dispose 文案不得暗示删除 Chat/Trajectory。**
48. **Activity / Progress 只是 telemetry/projection，不是 Workflow authority。**
49. **Control decision 与实际 execution 必须在 UI 语义上分开。**
50. **Team approval 不能在 UI 上表现成越过 External Hard Policy。**
51. **普通 Session Team tab 显示 zero-state + Start Team from Here。**
52. **Start Team from Here 创建新的 TeamIntent/Root，不原地 convert。**
53. **Handoff 是 one-shot frozen context，不是 live cross-session memory。**
54. **Handoff failure 不 silent continue。**
55. **Root Team fork 保持 same Blueprint snapshot + zero runtime MemberInstances。**
56. **Member child fork 产生 ordinary AgentSession。**
57. **Existing Legacy Team Session 显示 Read-only，不提供 vNext resume/mutation。**
58. **TeamDomain error 不应破坏 native historical Chat/Trajectory 可读性。**
59. **Team mutation error 必须 fail loud，不以空 projection 冒充成功。**
60. **UI 不自行复算 effective policy。**
61. **Unavailable / Denied / Suppressed / Locked / Degraded / Action required / Structural error 必须区分。**
62. **Team Dock 只做 status/navigation，不复制完整 control plane。**
63. **Team UI 必须作为外部 client module 加载。**
64. **Team-required upstream client source diff 必须为 0。**
65. **没有 public seam 时输出 CORE_SEAM_BLOCKER，而不是 DOM/private hack。**

---

# 47. 明确不进入 vNext UI

- 修改或替换原生 New Session hero；
- Workflow DAG editor；
- Workstream tree / state machine；
- per-member AgentPreset picker；
- Blueprint live editor + save-back；
- Blueprint hot upgrade / rebind；
- source Session live recall/search UI；
- Global Team Trajectory；
- Git worktree manager；
- arbitrary capability severity editor；
- synthetic TeamDomain event spam in Chat；
- synthetic TeamDomain event spam in Trajectory；
-自动合并多个 TeamLedger event 形成不可寻址 aggregate identity；
-删除 disposed member history；
-自动迁移 Existing Legacy Team Session；
- Team UI 私有 DOM click hack 作为正式导航 contract；
-替换 shipped conversation/sidebar owner 以获得“更原生”的视觉位置。

---

# 48. 后续开发计划的 UI 输入

后续《详细开发计划》在实现 UI 时，必须把本文拆成至少以下 capability groups：

```text
A. External client boot / Remote store
B. New Team entry + Creation Panel + TeamIntent
C. Blueprint / Runtime preset / Workspace pickers
D. Compatibility preflight + admission UX
E. Team view shell + Header
F. Timeline
G. Members + Instance Detail
H. Effective config + override editor
I. PolicyState / model / lifecycle controls
J. Activity / Progress
K. Events / control / message surfaces
L. Team Dock
M. Ordinary Session zero-state + Start Team from Here
N. Fork UX
O. Legacy read-only UX
P. reconnect/error/accessibility/responsive hardening
```

这些是后续任务切分的 UI 语义边界，不代表本文规定代码 package 必须按此拆分。

---

# 49. 文档状态

在当前架构基线、upstream client public seams 与 fork 现有 Team UI 审计点上，本 UI 设计**不需要重新打开新的产品决策**。

以下事项留给开发计划通过 characterization / prototype 验证，但不得改变本文用户语义：

```text
1. composer blocked/inert presentation 的最佳 public chain 接线
2. Team-owned modal/overlay 在 external client package 中的具体 host surface
3. Remote store generation/reconnect 的最终 wire shape
4. Timeline 现有组件哪些可直接迁移、哪些需重写
5. Team Events historical pagination 的具体 Remote cursor contract
6. Root fork sidecar recognition 完成前 UI 的 transient recovering state
```

如果其中某项 public seam 实际不存在：

```text
CORE_SEAM_BLOCKER
```

必须阻塞对应实现，不得修改上游 core/client owner 来维持表面一致。

---

# 附录 A：用户心智模型摘要

```text
New Session
= ordinary Agent

New Team
= configure a TeamIntent, then create a new Root Session + TeamSession

Team Blueprint
= who this Team is

Runtime preset
= ordinary Agent composition substrate

Member Template
= reusable role definition

Member
= one persistent runtime instance

Team Tab
= aggregate Team control plane

Chat
= this Agent's conversation

Trajectory
= this Agent's execution trace

Team Events
= Team-wide coordination ledger

Restore
= archived -> settled, no model work

Resume…
= send new work to settled Member
```

---

# 附录 B：最小视觉线框总览

## B.1 Global

```text
┌ Sidebar ──────────────┐
│ + New Session         │
│ Workspaces            │
│  ...                  │
│                       │
│ Settings              │
│ New Team              │
└───────────────────────┘
```

## B.2 New Team

```text
┌──────────────── New Team ────────────────┐
│ Blueprint      AIUED-ALGO · rev17      ▾ │
│ Workspace      D:\Projects\AIUED        ▾ │
│ Runtime preset team                     ▾ │
│ Compatibility ✓ Ready                     │
│ Advanced                                  │
│                                           │
│ Initial work (optional)                   │
│ ┌───────────────────────────────────────┐ │
│ │                                       │ │
│ └───────────────────────────────────────┘ │
│                                           │
│                    Cancel   Create Team   │
└───────────────────────────────────────────┘
```

## B.3 Team

```text
┌ AIUED-ALGO · rev17 ─────────────────────────────────────────┐
│ Policy Exploration  ✓ Compatible  Perspective Leader        │
├ Timeline ────────────────────────────────────────────────────┤
│ Researcher A █████        ███                               │
│ Researcher B    ██████                                       │
│ Simulator             █████████                              │
├ Members ────────────────────┬ Instance Detail ────────────────┤
│ Leader                      │ researcher-A                    │
│ Researcher [+]              │ Status: SETTLED                 │
│  researcher-A SETTLED       │ Model: Qwen                     │
│  researcher-B RUNNING       │ Workspace: ...                  │
│ Simulator [+]               │ Effective config...             │
├ Activity / Progress ────────┴─────────────────────────────────┤
│ ...                                                           │
├ Events ───────────────────────────────────────────────────────┤
│ ...                                                           │
└───────────────────────────────────────────────────────────────┘
```

---

**End of UI / Interaction Baseline**
