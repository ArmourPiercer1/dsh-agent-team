# Legacy Team 可观察行为 inventory（P0-D / P0-T4）

- 状态：P0-T4 产物（Class A，只读 LEGACY）
- 审计基线：`LEGACY_SHA = a3ab31992762c5d6560797eabc7e0885a9320ade`（branch `feat/team-vnext-integration-20260829`，已冻结 tag `legacy-agent-team-pre-vnext`，工作树 clean、只读）
- upstream 基线：`UPSTREAM_SHA = cd5ef8148158c3a752a658978873241fdf8e2bbc`
- 发现方法：在 LEGACY 检出内独立发现（`git ls-tree -r --name-only` 过滤 team 路径 → 319 条；`git diff --name-only UPSTREAM..LEGACY` 全量 470 条变更中 232 条含 team；`git grep Team` 定位 session-controller wiring），再逐文件深读关键实现。
- 行为域清单来源：开发计划 §12.2 P0-D（11 域），复用四级定义来源：开发计划 §7（A 直接移植 / B 移植算法重写边界 / C 仅行为参考 / D 丢弃）。
- 任务卡映射用语：`MIGRATE(A/B)` = 复用 Level A/B；`REWRITE(B/C)` = 保留算法或行为参考、按新契约重写；`REFERENCE_ONLY(C)` = 只读旧实现写 acceptance test；`DISCARD(D)` = 只留 Git history。

## 0. 全局错误 runtime 假设（G 系列，各域条目逐条挂接）

以下假设在旧实现中普遍内嵌。**任何复用都不得把这些假设带入 vNext**；vNext 的控制面 authority 是 TeamDomain/TeamLedger + TeamRemote（instanceId 寻址、持久、cold-safe），不是下列任何一项。

| 编号 | 错误假设 | 旧实现中的体现（证据路径） |
|---|---|---|
| G1 | **memberId 作为 runtime identity**：静态角色定义 id 同时充当运行时目标身份 | `packages/team/team/src/types.ts`（`TeamMemberDefinition.id: TeamMemberId`，payload 全部以 `memberId` 寻址）；`packages/team/team-runtime/src/orchestrator.ts`（activation map 以 memberId 为键）；`packages/team/tool-team/src/tool-delegate.ts`（`team.get(memberId)` 解析目标） |
| G2 | **Team SessionEvent 持久化作为权威**：`team/*` 事件合并进 `SessionEventMap`，session log 成为 team 事实的权威存储 | `packages/team/team/src/events.ts`（declaration merging：`team/member-bound`、`team/progress`、`team/control-request`、`team/control-decision`、`team/message`）；`packages/core/session/src/known-event-types.ts`（9 个 `team/*` 词汇表条目）；`packages/api/session-controller/src/client/sessions/team-mirror.ts` |
| G3 | **continuable subagent 作为 Member 原语**：teammate 的 spawn/follow-up/message/interrupt/settle 全部走 `subagents.startContinuable/followup/reportFrom/interrupt` + `registerContinuableSetup` | `packages/team/tool-team/src/tool-delegate.ts`（`deliverFollowup`、`subagents.interrupt`）；`packages/team/tool-team/src/tool-send-message.ts`（`deliverTeamMessage`）；`packages/team/team-runtime/src/index.ts`（`registerContinuableSetup`） |
| G4 | **cwd/roster 作为 authority**：workspace cwd 下的 `.dsh/teammates/` + `$DSH_HOME/teammates/` 文件系统 roster 被当作 team 成员权威；subagent catalog 的 `team:` label 前缀被当作"team 子会话"判据 | `packages/team/team-local/src/discovery.ts`（`discoverTeamMembers` 扫 `$DSH_HOME/teammates`、`.dsh/teammates`）；`packages/team/team-local/src/index.ts`（`resolveInitialWorkspace` 读 `$DSH_CWD`/`process.cwd()`）；`packages/client/ui-workspace/src/client/tree.ts`（`teamChildSessionIds` 按 catalog label `team:` 前缀隐藏）；`packages/team/team-projection/src/index.ts`（`rosterFor(workspacePath)`） |
| G5 | **process-memory TeamRegistry / activation / pending 状态**：定义注册表、activation 表、pending control 表、progress 表全部是进程内 Map，重启即失 | `packages/team/team/src/index.ts`（`TeamRegistry.definitions`）；`packages/team/team-runtime/src/orchestrator.ts`（`byLeader` Map）；`packages/team/team-channels/src/control-coordinator.ts`（`byLeader` Map）；`packages/team/team-channels/src/progress-store.ts`（`byLeader` Map）；`packages/team/team-runtime/src/rule-layers.ts`（`recoveredRuleLayers` Map） |
| G6 | **one-member-one-activation 不变量**：每个 leader 下每个 teammate 同时至多一个 in-flight delegation | `packages/team/team-runtime/src/orchestrator.ts`（`recordActivation` 对 `status === 'running'` 直接 throw）；`packages/team/tool-team/src/tool-delegate.ts`（依赖该 throw 生成 "already running" 诊断） |
| G7 | **leader session = team 实体**（teamId 即 leaderSessionId，无独立 team 实体） | `packages/team/team-projection/src/types.ts`（`TeamView.teamId` 注释 "always the leader session id (no separate team entity)"）；`packages/team/tool-team/src/index.ts`（`leaderId = session.header.parentSession ?? session.id`） |

## 1. 行为域条目（11 域）

### 1.1 delegate（委派）

**旧行为语义**：leader 调用模型工具 `delegate_to_teammate`（参数 `teammate_id`、`prompt`、`action ∈ run|follow_up|shutdown`，默认 `run`），把一段完整任务文本派给某个 teammate。teammate 在后台工作，完成后以 `subagent-settled` 通知回报。用户可观察效果：工具卡片显示 "Delegate to <id>"；结果文本 `Task delegated to "<name>". They will report back when done.`；teammate 子会话在工作区树中隐藏（`team:` label），完成后 leader 会话多一条回报消息。

**实现位置**：
- `packages/team/tool-team/src/tool-delegate.ts` — 工具定义 + `execute`（L104–L310）+ `deliverFollowup`（L46–L57）+ `pathExists`（L24–L32）
- `packages/team/tool-team/src/index.ts` — `registerDelegateTool` 装配；`session/event` 监听把 `tool/call` 折成 `updateActivity`、把 `user/message(source.kind='subagent-settled')` 折成 `markSettled`（L36–L57）
- `packages/team/team-runtime/src/orchestrator.ts` — `recordActivation/markSettled/markDisposed/get/findByChildSession/updateActivity`
- `packages/team/team/src/index.ts` — `TeamRegistry.get/getLeader/effectiveToolPolicy`
- `packages/team/team-runtime/src/rule-layers.ts` — `resolveRuleLayerPaths`

**值得复用的关键算法/纯函数**：
- `effectiveToolPolicy(member)`（`packages/team/team/src/index.ts` L93–L130）：纯函数，按 role 合并 `DEFAULT_LEADER_TOOLS`/`TEAMMATE_DENIED_TOOLS` 与定义侧 allow/deny → 工具策略合并算法可移植。
- action 三分支（run/follow_up/shutdown）的**诊断语义**：unknown-target（`Unknown teammate: "…"`）、leader 自委派拒绝（`The leader is the current agent; delegate to a teammate instead.`）、already-in-flight（orchestrator throw → `status:'error'`）、no-active-session（shutdown 对已 disposed 返回 `status:'shutdown'` + 说明文案）→ 这些模型可见诊断文案的"意图"是 vNext delegate 工具的 acceptance 素材。
- `contextPolicy === 'persistent'` 时复用 settled 子会话的分支逻辑（L219–L246）→ "持久上下文复用"行为语义保留。

**内嵌的旧 runtime 假设**：
- G1：`teamId/teammate_id` 全程是 `TeamMemberId`，目标身份 = 静态定义 id。
- G2：bind 时把完整 effective policy 快照写成 `team/member-bound` session event（L254–L296），cold resume 依赖该 event 重建。
- G3：spawn = `subagents.startContinuable`（fork-only API）；follow-up = `subagents.followup`；shutdown = `subagents.interrupt` + `markDisposed`。
- G4：`managedPresent` bind-time probe 读 `resolveRuleLayerPaths(undefined, me.session.header.cwd)`（L260）——cwd 是 rule-layer 权威。
- G5/G6：`orchestrator.recordActivation` 进程内 Map + one-member-one-activation throw。

**复用分级**：`REWRITE(B)`。工具 schema/UX/诊断语义 → MIGRATE(B)（先定义 vNext `TeamRuntime`/`ActivationProvider` 目标类型，再按新类型移植分支与诊断）；spawn/follow-up/interrupt 传输层 → DISCARD（G3）；orchestrator 状态 → DISCARD（G5/G6）；`effectiveToolPolicy` 算法 → MIGRATE(A/B，输入类型重写)。

### 1.2 follow-up（跟进指令）

**旧行为语义**：对已有 teammate 会话追加指令。两个入口：(a) `delegate_to_teammate` 的 `action:'follow_up'`——要求该 member 在当前 leader 下存在且未 disposed 的 activation，否则 `status:'error'`（`No active session for "…" to follow up. Delegate first.` 一类文案）；(b) leader 对 settled/disposed 的 teammate 再次 `run` 委派且 `contextPolicy='persistent'` 时，自动改走 follow-up 复用其 settled 子会话（L219–L246，成功文案 `continuing its existing session`）。follow-up 以 `source: { kind:'coordinator', form:'relay', senderSessionId }` 归因。

**实现位置**：
- `packages/team/tool-team/src/tool-delegate.ts` — `deliverFollowup`（L46–L57）、`action==='follow_up'` 分支（L168–L216）、persistent 复用分支（L219–L246）
- `packages/team/tool-team/src/index.ts` — follow-up 后 `recordActivation` 重新置 running

**值得复用的关键算法/纯函数**：
- "settled 复用 vs fresh spawn"的分支判据（activation 存在且 status==='settled' 且 policy==='persistent'）→ 行为语义保留。
- relay 归因三元组 `{kind:'coordinator', form:'relay', senderSessionId}` → vNext 消息归因词汇的参考（C）。
- 失败路径诊断文案（no active session / follow-up failed）→ acceptance 素材（C）。

**内嵌的旧 runtime 假设**：
- G1：follow-up 目标 = memberId → activation 查表。
- G3：传输 = `subagents.followup(parent, SessionId(childSessionId), …)`（continuable subagent 原语）。
- G5：activation 表进程内，leader 重启后 follow-up 直接不可用（`No active session`）。

**复用分级**：`REWRITE(B)`。复用判据与诊断 → 移植算法（B）；传输 → 重写为 vNext `TeamRuntime` 的 instance-followup 语义（DISCARD 旧传输）。

### 1.3 message（成员间消息）

**旧行为语义**：`send_team_message`（参数 `target_id`、`message`）按调用者角色选择传输：
- teammate → 同组其他 teammate：**不能直连**，改经 leader 中转——`subagents.reportFrom` 以 `[Message to <name>]: <message>` 文本唤醒 leader，返回 `status:'relayed'`（`Message to <name> relayed to leader for forwarding.`）；
- teammate → leader：`reportFrom` 直报父级 next-step，`status:'sent'`；
- leader → teammate：`subagents.followup` 投递到该 teammate 的 activation 子会话（followup 可 cold-resume settled/disposed 子会话；从未委派过则 `No active session for "…". Delegate first.`，`status:'error'`）。
成功后在**调用者自己的 session** 追加 `team/message` event（`from = binding?.memberId ?? team.getLeader()?.id ?? 'leader'`）。用户可观察效果：双方会话 log 各多一条 `team/message`；UI Feed/Marker 渲染消息行。

**实现位置**：
- `packages/team/tool-team/src/tool-send-message.ts` — `deliverTeamMessage`（L50–L89，传输选择）、`memberBindingOf`（L17–L22，从自身 session 事件读 `team/member-bound`）、工具 `execute`（L98–L166）

**值得复用的关键算法/纯函数**：
- 角色三分支传输选择的**语义**（peers 经 leader 星型路由）→ vNext 消息通道设计的行为基线（C）。
- 消息 payload 词汇 `{from, to, message}`（`packages/team/team/src/types.ts` `TeamMessageData`）→ contracts 参考（B）。
- "消息落到记录方 session" 的落点选择 → 行为参考（C；vNext 改为 TeamLedger 消息事实）。

**内嵌的旧 runtime 假设**：
- G1：`from/to` 是 memberId；`from` 回退链从自身 session 的 `team/member-bound` event 反解身份。
- G2：`team/message` 持久化在 session log（记录方各存一份，不是单一权威）。
- G3：三种传输全是 subagent followup/reportFrom。
- G5：leader→teammate 依赖进程内 activation 表解析子会话 id。

**复用分级**：`REWRITE(B)`。星型路由语义 + payload 词汇 → MIGRATE(B/C)；传输与身份解析 → DISCARD 重写（vNext：TeamDomain 消息事实 + TeamRemote 投递，instanceId 寻址）。

### 1.4 control（权限审批控制）

**旧行为语义**：teammate 调用 `requiresApproval` 工具（或权限引擎给出 `ask` 决策）时挂起，向 leader 发起审批请求；leader 用 `team_control`（`action: list|decide`，`decision ∈ allow_once|deny|escalate_to_user|approve_plan|request_revision`，可选 `reason`）裁决。挂起期间：teammate 的 `tools/pre-execute` Promise 悬停；请求以 `team/control-request` event 落日志；leader 被 `reportFrom` 唤醒；决策以 `team/control-decision` event 落日志并 resolve 挂起 Promise。决策映射：`allow_once/approve_plan` → 继续执行；`request_revision` → deny（`leader requested revision: please revise plan`）；`deny` → deny；`escalate_to_user` → 转成用户级 ask。孤儿请求三条结算路径：`sweep(now, timeoutMs)`（默认 120000ms，`team-channels` config `controlRequestTimeoutMs`）超时自动 deny、`dispose(leaderSessionId)`（leader 会话拆除）自动 deny、`reconcilePending`（cold resume / execution abort 时把已持久化但无挂起执行体的请求自动 deny）。leader 不可达的 `ask` 结算为 audited `leader_unreachable` deny（明示不是最终裁决）。

**实现位置**：
- `packages/team/team-runtime/src/approval-setup.ts` — `installApprovalHook`（tools/pre-execute 监听，L168–L244）、`requestLeaderDecision`（L61–L168：log request → `registry.create` → 唤醒 leader → race decision vs abort → 决策映射）
- `packages/team/team-channels/src/control-coordinator.ts` — `TeamControlRegistry`（`create/decide/list/sweep/reconcilePending/dispose`，host 级 Service，`ctx.teamControl`）
- `packages/team/tool-team/src/tool-control.ts` — `team_control` 工具（list/decide，decide 对未知 requestId throw → `Error: Unknown control request: "…"`）
- `packages/team/team/src/types.ts` — `TeamControlRequestData`（`requestId/memberId/tool/reason`）、`TeamControlDecision`、`TeamControlDecisionData`
- `packages/team/team-local/src/diagnostic.ts` — `diagnoseLeaderTools`（leader 工具面诊断）

**值得复用的关键算法/纯函数**：
- `sweep(now, timeoutMs)` 与 `reconcilePending(persistedRequests)` 两个纯算法（遍历 + 条件结算 + 清理空分区）→ MIGRATE(B)：先定义 vNext pending-control 目标类型（持久于 TeamDomain），再移植算法。
- "三条孤儿结算路径 + 并发 decide 安全"（decide 先删 entry，reconcile 跳过已删）→ 并发不变量参考（B/C）。
- 五值决策枚举 + 决策→执行动作映射（`requestLeaderDecision` switch，L154–L167）→ contracts 参考（B）。
- `leader_unreachable` 审计语义（"not a final verdict"）→ 行为基线（C）。

**内嵌的旧 runtime 假设**：
- G1：请求以 `memberId` 标识请求方；registry 分区键是 leader session id。
- G2：`team/control-request`/`team/control-decision` 持久化在 child/leader session log，`reconcilePending` 的输入就是从 resuming child 的 log 里扫出来的请求列表。
- G5：`TeamControlRegistry` 进程内 Map；leader 进程重启后挂起 Promise 丢失，只能靠 reconcile 结算。
- G3：唤醒 leader 用 `subagents.reportFrom`。

**复用分级**：`REWRITE(B)`。sweep/reconcile/决策映射/诊断 → MIGRATE(B)（新目标类型：TeamDomain-durable pending control，instanceId 寻址）；进程内 registry 容器 → DISCARD(D)；pre-execute hook 本体 → vNext 按新 seam 重写（旧 hook 行为 REFERENCE_ONLY(C)）。

### 1.5 progress（进度看板）

**旧行为语义**：`team_progress`（`action: list|update`，`task_id/subject/status ∈ pending|in_progress|completed|blocked/summary/teammate_id`）读写团队任务进度板。`update` 是 latest-wins upsert（缺省字段继承既有 entry，`memberId` 缺省回退 `leader`），同时追加 `team/progress` event（durable backing）并写进程内 `TeamProgressStore`。`list` 从 store 读。用户可观察效果：UI 团队 tab 的 task board（`TeamTasks.tsx`，按 status 分列）、dock 展开面板的 task 行、Feed 的 progress 行、`list_teammates` 的 per-member 状态；leader/teammate 均可调（非 leader-only）。

**实现位置**：
- `packages/team/tool-team/src/tool-progress.ts` — 工具（list 分支 L95–L113；update 分支 L114–L126：`me.session.append('team/progress', entry)` + `store.update`）
- `packages/team/team-channels/src/progress-store.ts` — `TeamProgressStore`（`update/list/restore`，按 taskId latest-wins，`restore(events)` 从持久化事件回填）
- `packages/team/team-projection/src/fold.ts` — `TeamFacts.tasks`（projection 侧 latest-per-taskId、first-seen 顺序）
- `packages/client/ui-team/src/client/TeamTasks.tsx` — 看板渲染

**值得复用的关键算法/纯函数**：
- latest-wins by taskId 的 fold（store 与 projection 两处同构）→ MIGRATE(A/B，纯)。
- progress 条目词汇 `{taskId, subject, status, summary, memberId}` 与四态 status 枚举 → contracts 参考（B）。
- "缺省字段继承既有 entry" 的 upsert 语义（L114–L120）→ 行为基线（C）。

**内嵌的旧 runtime 假设**：
- G1：`memberId` 字段（assignee 身份 = 静态定义 id）。
- G2：`team/progress` event 是 durable backing（log 多副本，leader 与 child 都可能记）。
- G5：`TeamProgressStore` 进程内，`restore` 只是 log→内存的回填。
- 注意（开发计划 §4.8）：旧 `TeamTasks` **不得**暗示正式 task DAG/workflow authority——vNext 重命名为 Activity 类概念。

**复用分级**：`REWRITE(B)`。fold/upsert 算法 + 词汇 → MIGRATE(A/B)；store/event 权威 → DISCARD（vNext：TeamLedger 持久 activity 事实）。

### 1.6 cold resume（冷恢复）

**旧行为语义**：teammate 子会话在进程重启（或从未 live）后再次被 follow-up/唤醒时，team-runtime 通过 `subagents.registerContinuableSetup` 注册的 setup contribution 对其重建成员能力：
1. 从子会话 log 扫描第一个 `team/member-bound` event，拿到 bind-time 的完整 effective policy 快照（role、provider/model/maxTokens、tools、requiresApproval、skills、mcpServers、`rules`（inline 权限规则）、permissionMode、`managedPresent`）；
2. 按快照重装 MCP guard、skill guard、approval hook（`installMemberComposition` + `installApprovalHook`）；
3. rule-layer 恢复加载：teammate inline rules 取自快照；managed（`$DSH_HOME/permissions.yml`）与 project（`<cwd>/.dsh/permissions.yml`）文件层**总是从磁盘重读**（恢复中的会话受组织当前策略约束）；bind 时 managed 文件存在而后消失（lapsed）则**加载 reject → fail closed**（`managedPresent` 探针正是为检测这一情形，bind 时只是存在性 probe 而非 load）；
4. 从子会话 log 扫出全部 `team/control-request`，对 leader 的 `TeamControlRegistry.reconcilePending`：仍挂起者自动 deny（孤儿请求不可能再驱动工具）。
无 `team/member-bound` 的 child 是 no-op（非 team 子会话）。

**实现位置**：
- `packages/team/team-runtime/src/index.ts` — `registerContinuableSetup(teamMemberSetupContribution(ctx))`（L40–L43）
- `packages/team/team-runtime/src/member-setup.ts` — `teamMemberSetupContribution`（L120–L161）、`findMemberBound`（L60–L65）、`findControlRequests`（L68–L74）、`installMemberComposition`（L38–L57）、`installRecoveredRules`（L90–L118）
- `packages/team/team-runtime/src/rule-layers.ts` — `MANAGED_RULE_FILE`/`PROJECT_RULE_FILE`、`resolveRuleLayerPaths`（L34–L60 一带）、`setRecoveredRuleLayers/getRecoveredRuleLayers/releaseRecoveredRuleLayers`
- `packages/team/tool-team/src/tool-delegate.ts` — bind 时写 `team/member-bound`（含 `managedPresent` probe，L254–L296）
- 相关设计笔记（REFERENCE_ONLY）：`.agents/notes/implemented/architecture/2026-08-15-layered-rule-loading-and-cold-recovery-snapshot.md`、`.agents/notes/implemented/architecture/2026-08-20-teammate-permission-enforcement-at-the-executor.md`

**值得复用的关键算法/纯函数**：
- "bind-time 快照 + 恢复期文件层重读 + lapsed→reject fail-closed" 的**恢复语义**→ vNext instance 冷恢复的 acceptance 基线（C；vNext 的 snapshot 权威是 TeamDomain，不是 session event）。
- `resolveRuleLayerPaths` 的路径解析（home 层 + workspace 层，任一侧不可解析 → undefined）→ 可移植纯函数（A/B；vNext 的 rule-layer 位置由新契约定义）。
- 从持久化事件重建 pending 状态并做孤儿结算（`findControlRequests` + `reconcilePending`）→ 算法参考（B/C）。
- setup contribution 的 no-op-for-non-team + 完整 disposer 链（L153–L160）→ 生命周期参考（C）。

**内嵌的旧 runtime 假设**：
- G2：`team/member-bound` 是"child Session 的 durable binding 权威"（types.ts 注释明言 "Carries the full effective policy so cold resume reconstructs without the parent's live registry"）——**这是最典型的错误假设**，vNext 禁止以 SessionEvent 为成员绑定权威。
- G3：恢复入口 = continuable subagent 的 setup contribution（fork-only API）。
- G4：managed/project rule 文件位置由 `$DSH_HOME` 与 session `header.cwd` 决定。
- G5：`recoveredRuleLayers` 进程内 Map（sessionId 键）。
- G7：`leaderSessionId = agent.session.header.parentSession`（parent 关系即 leader 关系）。

**复用分级**：`REWRITE(C→B)`。恢复语义 fail-closed 行为 → REFERENCE_ONLY(C)（写 vNext acceptance test）；`resolveRuleLayerPaths`、孤儿结算算法 → MIGRATE(B)；member-bound event 权威与 subagent setup 入口 → DISCARD(D)。

### 1.7 Timeline（委派时间线）

**旧行为语义**：团队 tab 的 timeline 区：每个 teammate 一条 lane（按 projection `members` 顺序，颜色槽 = lane 序号 mod 8 的固定 CSS 色阶），每次 `delegate_to_teammate` 调用一条 bar（span）。时间域是**线性诚实时间域**：最早团队时间戳（delegation 开始，或 task 先于 delegation 记录时的 task 事件）到最后 settle；有 span 仍在 running 时右端延展到**调用方时钟**（`now` 由 renderer 传入，model 不读 wall clock）。idle gap 保持为 gap（不压缩、不 clamp）。未入册（unrostered）的 delegation memberId 不丢 bar：追加 fallback lane（以原始 id 命名）。渲染交互：wheel 在指针处缩放（`WHEEL_ZOOM_EXPONENT=0.0015`）、拖拽平移（`MINIMUM_DRAG_PX=3`）、键盘平移/缩放/复位、hover 提示（name/range/duration，200ms 延迟）、running span 每秒 tick 刷新、点击 bar/lane 跳转该成员绑定会话（`lane.sessionId` → `openSession`）。空态：无 delegation 时一行空态文案（`deriveTeamTimeline` 返回 `null`）。轴刻度按 1/2/5×10^n 选"nice ticks"。

**实现位置**：
- `packages/client/ui-team/src/client/team-timeline-model.ts` — `deriveTeamTimeline`（L67–L126）、`pickTimelineTicks`（1/2/5×10^n 选步）、`formatTimelineTime`、`formatTeamDuration`（L174–L185，中文标签 `N毫秒/N秒/N分NN秒/N小时NN分`）、`TEAM_LANE_COLOR_SLOTS=8`
- `packages/client/ui-team/src/client/TeamTimeline.tsx` — 渲染与交互（`MINIMUM_ZOOM_MS=1000`、`RUNNING_TICK_MS=1000`、`onWheel`、`onPointerDown`、`onKeyDown`、`barTooltipLabel`）
- 上游事实来源（legacy authority，不迁移）：`packages/team/team-projection/src/fold.ts` 的 `delegations`（leader log 的 `delegate_to_teammate` 调用 → `startedAt/endedAt/inProgress`）

**值得复用的关键算法/纯函数**（纯 UI 算法，本域是全场最高复用率）：
- `pickTimelineTicks(start, end, targetCount)`：1/2/5×10^n nice-tick 选择 → MIGRATE(A)（纯数学，无 authority import）。
- `formatTimelineTime`/`formatTeamDuration`：时长/时刻格式化 → MIGRATE(A)，**但 `formatTeamDuration` 内嵌硬编码中文文案**（`毫秒/秒/分/小时`）——移植时必须把 copy 移到 locale 字典（vNext client 约定），纯数学部分保留。
- `deriveTeamTimeline` 的 lane fold（members 顺序建 lane、unrostered fallback lane、span key `${memberId}:${startedAt}:${index}`、running span `endedAt = max(settled, now)`、span 按 startedAt 排序）→ MIGRATE(B)：算法原样，输入从 legacy `TeamView.delegations` 换成 vNext projection DTO（delegation span 事实来自 TeamDomain）。
- 交互算法（指针中心缩放、拖拽阈值、键盘步进、tick 刷新节奏）→ MIGRATE(B)（React 组件按 vNext slot/props/i18n 约定重写，交互数值常量保留）。

**内嵌的旧 runtime 假设**：
- G1：lane/span 以 `memberId` 为键（`buildById: Map<memberId, LaneBuild>`）。
- 输入类型 = legacy `TeamView`（`@deepseek-ai/dsh-api-session-controller/client`），其 delegations 事实来自 session log fold（G2）——model 本身不读 log，只消费 snapshot，这一点本身是好的分层。
- `lane.sessionId` = 成员**首个**绑定会话（G1 变体：member→session 取 `sessionIds[0]`）。

**复用分级**：`MIGRATE(A/B)`。纯数学/格式化 → A（含 i18n 拆分）；`deriveTeamTimeline` → B；`TeamTimeline.tsx` 交互 → B（MIGRATE/REFACTOR，开发计划 §4.8 同判）。

### 1.8 Members（成员分组）

**旧行为语义**：团队 tab 的 members 区：固定的 leader 行（锚定 `view.leaderSessionId`，不是 roster 行——"回到 leader" 入口）+ 每个非 leader 成员定义一个 group（按 `members` 顺序）。group 容器行统计其 running 实例数（`Name · N 活跃` 标签）；展开列出 group 的 instance 行——projection member 行中绑定了 session 的行，各带状态（bound/running/settled）、最近一次工具调用、pending control 数。未绑定实例的行只建立 group、不贡献 instance。共享同一 `memberId` 的多行折进一个 group（多实例接口；当前 projection 每个定义至多一行）。点击 instance 行跳转其绑定会话；当前会话高亮。

**实现位置**：
- `packages/client/ui-team/src/client/team-members-model.ts` — `deriveTeamMembers`（leader 行 L50–L100 一带、group fold L101–L109、`appendRow` 聚合 activeCount）
- `packages/client/ui-team/src/client/TeamMembers.tsx` — 渲染（leader 行、group 展开、instance 行、状态点、点击切换）
- 上游事实来源：projection `members` 行（`memberId/name/sessionIds/status/currentToolCall/pendingControlCount`，`packages/team/team-projection/src/types.ts`）

**值得复用的关键算法/纯函数**：
- group fold 算法（leader 行锚定 leaderSessionId、按 members 顺序建 group、running 计数、instance 行 = 绑定了 session 的行、同 memberId 折叠）→ MIGRATE(B)：算法保留，**键从 `memberId`+`sessionIds[0]` 重写为 `templateId`/`instanceId`/`childSessionId`**（开发计划 §4.8 明确要求的目标键）。
- "未绑定定义仍建 group（空实例）" 的展示语义 → 行为基线（C）。
- 状态直读 projection（log baseline + live overlay 已合并，UI 不重推）→ 分层参考（C）。

**内嵌的旧 runtime 假设**：
- G1：group/instance 键 = `memberId`；点击目标 = `sessionIds[0]`。
- 输入 = legacy `TeamView.members`（G2 authority 的投影产物）。
- "N 活跃" 的 running 判定来自 live overlay（continuable subagent 目录，G3/G4 的投影侧体现）。

**复用分级**：`MIGRATE(B)`（presentation MIGRATE、data model REWRITE——开发计划 §4.8 原话 "MIGRATE PRESENTATION / REWRITE DATA MODEL"）。

### 1.9 Events（事件流 / Feed）

**旧行为语义**：团队 tab 的 event-stream 区：把审批链行（`team/control-request` + 配对 decision）与成员消息行（`team/message`）混排进**单一升序时间轴**（最旧在前），渲染上限取最近 `loadedCount` 行（默认 200），"load earlier" 深度以纯计数携带。混排序 = (time 升序, kind, 源序)：approval 行锚定在**请求时刻**（其后的 decision 就地更新该行，位置不动）；message 行在自身事件时刻；同时刻 approval 先于 message、各自内部保持 projection fold 序 → 同一 loaded 集合下结果确定。快照携带 ≤500 条消息尾（`MESSAGE_CAP=500`）+ 全量审批史；更早消息经 wire 分页（`messagesBefore` 锚定严格更早的页面）逐步取回并拼回全局序。fold 观察到但 loaded 集合未持有的消息数记为 `unloadedMessageCount`（分页加载失败时的醒目计数提示）。行点击跳会话（经 marker-jump 规则，见 1.11）。

**实现位置**：
- `packages/client/ui-team/src/client/team-feed-model.ts` — `deriveTeamFeed`（混排、cap、`oldestMessage` 锚、`unloadedMessageCount`）
- `packages/client/ui-team/src/client/TeamFeed.tsx` — 行渲染（状态点、decision 文案键 `DECISION_KEYS`、`FeedRow` 点击）
- 分页机制（host 侧）：`packages/team/team-projection/src/fold.ts` — `resolvePageLimit`（L389–L398，limit ∈ [1, MESSAGE_CAP] 校验）、`sliceMessagePage`（L409–L431，锚 = (at, sessionId, seq) 三元组，取 `max(0, index-limit) .. index` 的严格更早页）；`packages/team/team-projection/src/index.ts` — `pageMessages`/`resolveAnchor`
- wire：`packages/api/session-controller/src/team.ts`（`team/projection` 单端点：snapshot 或 page）、`packages/api/session-controller/src/types.ts`（`TeamProjectionRequest/TeamProjectionValue`，L522–L527）
- 镜像层：`packages/api/session-controller/src/client/sessions/team-mirror.ts`（`TeamMirror` = leader 键控 whole-snapshot 最后赢家表 + `resolveTeamView`）、`packages/api/session-controller/src/client/sessions/manager.ts`（team control frame 落镜像、cold-read 复用 in-flight 请求）

**值得复用的关键算法/纯函数**：
- 混排确定性排序（(time, kind, source-order)，approval 锚定请求时刻）→ MIGRATE(A/B，纯)。
- `resolvePageLimit` + `sliceMessagePage` 的**锚定分页机制**（三元组锚、严格更早页、limit 边界校验、`ANCHOR_UNKNOWN` 错误码）→ MIGRATE(B)：机制原样移植，输入换 vNext TeamLedger 消息序（开发计划 §4.7 "pagination mechanics → MIGRATE selectively"）。
- whole-snapshot 发布 + 最后赢家镜像 + single-flight cold-read（`manager.ts` 冷读姿态）→ 设计模式参考（C；vNext 由 TeamRemote 实现）。
- 行点击→会话跳转与"失败时响亮计数提示"的 UX → 行为基线（C）。

**内嵌的旧 runtime 假设**：
- G2：数据源 = SessionController Team mirror / `team/*` session events（**vNext 必须换成 Team Remote / TeamLedger**，开发计划 §4.8 明示）。
- G1：approval 行配对与成员解析走 `memberId`；message 行携带 memberId from/to。
- G7：mirror 以 leader session 为 team 键。

**复用分级**：`REWRITE(B)`。排序/分页算法 → MIGRATE(A/B)；数据源与 `TeamView` 类型 → REWRITE（新 TeamRemote DTO）；SessionController 镜像层 → DISCARD（去污染，§4.9）。

### 1.10 Dock（团队 dock 条）

**旧行为语义**：输入框上方常驻的团队 dock（仅 team session 显示；非 team session 不出现）：折叠态是一行紧凑读数——团队级计数 `N 运行 · M 待审`（N = running 成员行的绑定会话数（含 leader 行）；M = 全部成员行 `pendingControlCount` 之和）；展开态是紧凑面板：成员状态行（未绑定行跳过；状态点 bound/running/settled）+ 任务行（taskId/subject/status）。dock 带 team-tab 跳转入口。镜像源与 team tab 同源（sessions face 的 team 面 + 单飞 cold pull），所以 dock 恰好在 team session 出现。

**实现位置**：
- `packages/client/ui-team/src/client/team-dock-model.ts` — `deriveTeamDockCounts`（runningSessions/pendingControls）、`deriveTeamDockPanel`（成员行 + 任务行，key `${memberId}:${sessionIds[0] ?? ''}:${index}`）
- `packages/client/ui-team/src/client/TeamDock.tsx` — `TeamDock`（slot `conversation.input.dock`，id `team`，order 15）、`TeamDockPanel`、`memberDot/taskDot` 状态点映射
- 注册与镜像源：`packages/client/ui-team/src/client/index.ts`（L155–L169 dock 注册；`ensureTeam = teams.refresh`、`openTeamTab`）

**值得复用的关键算法/纯函数**：
- 两个纯计数/投影（counts、panel rows）→ MIGRATE(A)（纯函数，输入换 vNext DTO 后为 A/B）。
- "折叠读数 + 可展开紧凑面板 + 仅 team session 常驻" 的 UX 形态 → MIGRATE（B；开发计划 §4.8 "MIGRATE UX / REWRITE DATA SOURCE"）。
- 状态点颜色映射（`memberDot/taskDot` → StateDot）→ A（纯映射，copy/色板按 vNext token 重接）。

**内嵌的旧 runtime 假设**：
- G1：成员行键含 `memberId` 与 `sessionIds[0]`。
- G2/G7：数据源 = leader 键控 `TeamView` 镜像（session log fold 产物）。
- `openTeamTab` 的 DOM 兜底（`document.querySelectorAll('[role="tablist"] [role="tab"]')` 按 locale 文案匹配点击，index.ts L144–L153）——**跨插件无 verb 时的降级 hack**，属错误机制，不得移植。

**复用分级**：`MIGRATE(B)`（UX 与纯投影 → A/B；数据源 → REWRITE；DOM tab hack → DISCARD(D)）。

### 1.11 session navigation（会话导航）

**旧行为语义**：把 team 各表面上的点击路由到目标会话：
1. **Chat 内联 marker 跳转（D16）**：`team/progress`、`team/control-request`、`team/control-decision`、`team/message` 各成一行紧凑单行 Chat node（`teamMarkerDefinition`，Conversation Node 机制）；点击行解析跳转目标——progress/request 行 → 被分配/请求方成员的首个绑定会话（mirror 是 id→session 连接，D19）；decision 行 → 经 mirror 审批对回到请求方成员会话；message 行 → 记录方自身会话（in-flow 锚点）。mirror 解析不到目标时降级：progress/request 回落自身会话，decision 行变 inert（无目标），message 行构造上即自身会话。
2. **成员/时间线/Feed 行点击**：`TeamMembers` instance 行、`TeamTimeline` lane/bar、`TeamFeed` 行 → 统一经注入的 `openSession(sessionId)` 回调（= `ctx.sessions.open`，既有会话打开路径）切换会话。
3. **工作区树**：`teamChildSessionIds`（D4）——任何父级的 subagent catalog 中 `kind:'child'` 且 label 以 `team:` 前缀的条目，其会话 id 从顶层列表隐藏（普通 subagent 子会话保持来源判据）；`teamRosterCounts`（D5/D23）——mirror 键控的 leader 会话取 `rosterMemberCount` 作徽标数；`sessionVisible` 把 teamChildren 排除出可见集。
4. **team tab 冷拉与激活**：`ensureTeam(sessionId)` = `teams.refresh`（single-flight 冷读，bound-teammate 请求可锚定到其 leader 的 view）；`openTeamTab` 无跨插件 verb 时降级为按 locale 标签 DOM 点击 tab。

**实现位置**：
- `packages/client/ui-team/src/client/team-marker-jump.ts` — `resolveTeamMarkerJump`（L55–L77，四 kind 分支 + 降级）、`memberSessionId`（L43–L46）
- `packages/client/ui-team/src/client/team-marker-definition.ts` — `teamMarkerDefinition`（match/update/buildLocationData；"1 event = 1 row，状态变化加行" D15）
- `packages/client/ui-team/src/client/index.ts` — `openSession` 注入（L97）、`ensureTeam`/`pageTeamMessages`（L110–L125 一带）、`openTeamTab`（L144–L153）
- `packages/client/ui-workspace/src/client/tree.ts` — `teamChildSessionIds`（D4）、`teamRosterCounts`（D5/D23）、`sessionVisible`（`TEAM_LABEL_PREFIX='team:'`）
- `packages/client/ui-workspace/src/client/contract/slots.ts` — `teamMirror: HostObservable<TeamMirror>` 注入契约
- `packages/client/ui-workspace/src/client/rows/Rows.tsx` — leader 徽标渲染
- wire/镜像：`packages/api/session-controller/src/client/contract/sessions.ts`（`TeamMirrorFace.refresh/pageMessagesBefore`）、`team-mirror.ts`（`resolveTeamView`）

**值得复用的关键算法/纯函数**：
- `resolveTeamView`（frozen team-ness test：session 是 team session ⟺ 它键控一个镜像 view 或任一 view 的 `members.sessionIds` 绑定它；返回存储引用保持 identity-stable）→ MIGRATE(A)（纯函数；注意 legacy 中 `team-view-model.ts` 与 `team-mirror.ts` 有**两份锁步副本**——vNext 必须单一实现）。
- marker-jump 四 kind 目标规则 + 降级策略（inert / 回落自身会话）→ MIGRATE(B)（规则语义保留，输入换 vNext 投影：instanceId 连接）。
- "1 event = 1 row、状态变化加行、flow 即可重放 ledger"（D15）的行身份策略 → 行为参考（C；但 TeamMarker 的 "1 team SessionEvent = 1 Chat marker" 语义被 vNext 最终架构废弃，开发计划 §4.8——只参考其行身份/幂等 update 机制，不复制）。
- 工作区树 D4/D5 的**冻结判据形态**（catalog label 前缀隐藏 + roster 计数徽标）→ 行为参考（C）；判据本身依赖 G4（catalog `team:` 前缀），vNext 改为 TeamDomain instance 事实。

**内嵌的旧 runtime 假设**：
- G1：jump 目标解析 = memberId → `sessionIds[0]`（D19 "mirror 的 member 行是 id-to-session join"）。
- G2：marker 行直接消费 session log 的 `team/*` event data。
- G4：`team:` label 前缀 + subagent catalog 是"team 子会话"的权威判据（`tree.ts`、fold 的 `TEAM_LABEL_PREFIX`、delegate 工具 spawn 时打 label 三处耦合）。
- G7：mirror/team 键 = leader session。
- DOM `openTeamTab` hack（错误机制，D）。

**复用分级**：`REWRITE(B)`。`resolveTeamView` → MIGRATE(A)（去重为单一实现）；jump 规则 → B；工作区树判据 → REWRITE（新 authority：TeamDomain instance 集合 + TeamRemote 计数）；`ctx.sessions.open` 打开路径 → 保留（upstream 既有 API，非 team 耦合）；TeamMarker 语义 → REFERENCE_ONLY(C)/DISCARD(D)；DOM tab hack → DISCARD(D)。

## 2. 覆盖自检（对照开发计划 §12.2 P0-D 清单）

| # | §12.2 行为域 | 本 inventory 条目 | 状态 |
|---|---|---|---|
| 1 | delegate | 1.1 | ☑ |
| 2 | follow-up | 1.2 | ☑ |
| 3 | message | 1.3 | ☑ |
| 4 | control | 1.4 | ☑ |
| 5 | progress | 1.5 | ☑ |
| 6 | cold resume | 1.6 | ☑ |
| 7 | Timeline | 1.7 | ☑ |
| 8 | Members | 1.8 | ☑ |
| 9 | Events | 1.9 | ☑ |
| 10 | Dock | 1.10 | ☑ |
| 11 | session navigation | 1.11 | ☑ |

11/11 全覆盖。逐域"复用分级"结论汇总：

| 域 | 分级 | 一句理由 |
|---|---|---|
| delegate | REWRITE(B) | 工具 UX/诊断迁移，spawn/传输/orchestrator 全按 vNext seam 重写 |
| follow-up | REWRITE(B) | 复用判据与诊断移植，传输换 TeamRuntime |
| message | REWRITE(B) | 星型路由语义保留，传输与身份解析重写 |
| control | REWRITE(B) | sweep/reconcile/决策映射移植，进程内 registry 丢弃 |
| progress | REWRITE(B) | latest-wins fold 与词汇迁移，event/store 权威丢弃 |
| cold resume | REWRITE(C→B) | fail-closed 恢复语义做 acceptance 基线；路径解析/孤儿结算算法 B 级移植 |
| Timeline | MIGRATE(A/B) | 纯数学/格式化 A（含 i18n 拆分）；lane fold 与交互 B 级移植 |
| Members | MIGRATE(B) | presentation 迁移，键重写为 templateId/instanceId/childSessionId |
| Events | REWRITE(B) | 排序/锚定分页算法迁移，数据源换 TeamRemote/TeamLedger |
| Dock | MIGRATE(B) | UX 与纯计数迁移，DOM tab hack 丢弃 |
| session navigation | REWRITE(B) | resolveTeamView A 级；jump 规则 B 级；catalog 前缀判据重写 |
