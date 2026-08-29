# Legacy → vNext 复用地图（reuse-map，P0-T4）

- 配套文档：`docs/migration/legacy-behavior-inventory.md`（行为域条目）。
- 级别定义（开发计划 §7）：**A** = 纯函数直接移植（不 import 旧 authority、不假设 SessionEvent/memberId、不用 fork-only API）；**B** = 移植算法、重写边界（先写 vNext 目标类型再移植，禁止反向）；**C** = 仅行为参考（写 vNext acceptance test，不复制生产代码）；**D** = 丢弃（只留 Git history）。
- 目标包（开发计划 §8 布局）：`contracts` / `domain` / `storage` / `runtime` / `tools` / `remote` / `client` / `legacy` / `testkit`；`none` = 无 vNext 目标。
- 路径均相对 LEGACY 检出根（`a3ab31992762c5d6560797eabc7e0885a9320ade`）。行内标注 `Gn` 指 inventory §0 全局错误假设编号。

## 1. 逐文件复用决策

### 1.1 定义与注册（`@deepseek-ai/dsh-team`）

| legacy 路径 | 目标包 | 级别 | 备注 |
|---|---|---|---|
| `packages/team/team/src/types.ts` | `contracts` | B | payload 词汇（progress/message/control 数据结构、status/decision 枚举）→ 重写为 contracts DTO，**去掉 `memberId` 寻址**，改 `templateId`/`instanceId`（G1）。`TeamMemberBoundData`（bind-time 快照）→ D 作为 authority / C 作为 cold-resume 行为参考（见 1.6）。 |
| `packages/team/team/src/events.ts` | none | D | `team/*` SessionEventMap declaration merging 整体丢弃（G2）；vNext 不允许以 SessionEvent 承载 team 事实。词汇表本身留作词汇参考（C，不复制）。 |
| `packages/team/team/src/index.ts` | `runtime` | B | `TeamRegistry` 容器（`definitions[]` 进程内，G5）→ D；`effectiveToolPolicy` 合并算法 → B 级移植到 vNext tool-policy 解析（输入类型重写）。 |
| `packages/team/team/src/constants.ts` | `contracts` | C | `DEFAULT_LEADER_TOOLS`/`TEAMMATE_DENIED_TOOLS`/`TEAM_EVENT_PREFIX` 数值 → 行为参考；vNext 工具策略由新契约定义，默认表重新设计。 |
| `packages/team/team/src/brand.ts` | `contracts` | B | branded id 模式（`TeamMemberId` 等）→ 参考 branded `templateId`/`instanceId` 品牌化做法（C 级机制参考）。 |

### 1.2 roster / markdown 加载（`@deepseek-ai/dsh-team-local`）

| legacy 路径 | 目标包 | 级别 | 备注 |
|---|---|---|---|
| `packages/team/team-local/src/parser.ts` | `legacy`（解析器）→ 供 `runtime` 消费 | B | `parseTeamMemberMarkdown`（YAML frontmatter + body、`SUPPORTED_SCHEMA_VERSION`、`ParseDiagnostic`）算法移植；vNext 成员定义格式由新契约定义，先写目标类型。 |
| `packages/team/team-local/src/discovery.ts` | `runtime` | B | 两级发现（`$DSH_HOME/teammates` → 工作区 `.dsh/teammates`，工作区胜、last-wins 去重）→ 发现**算法**移植；发现**位置**是 G4 错误 authority（cwd/roster），vNext 成员来源由 TeamDomain 决定。 |
| `packages/team/team-local/src/validation.ts` | `runtime` | A | `validateTeamDefinitions`（重复 id、恰好一个 leader、`requiresApproval`⊆允许集、skills 非空串）纯校验函数，直接移植（校验对象换 vNext 定义类型 → 严格说 A→B 边界重写，算法本身 A 级）。 |
| `packages/team/team-local/src/enablement.ts` | `runtime` | B | settings 命名空间开关 + `filterDisabledTeammates` → 移植；settings 键空间按 vNext 重新分配。 |
| `packages/team/team-local/src/diagnostic.ts` | `runtime` | C | `diagnoseLeaderTools` leader 工具面诊断 → 行为参考（vNext 诊断面重写）。 |
| `packages/team/team-local/src/index.ts` | none | C（机制）/ D（本体） | fs.watch + 500ms 防抖 reload、workspace-self-contained 规则 → 生命周期机制参考；`ctx.team.register` 写入进程内 registry 的 plugin 本体 → D（G5）。 |
| `apps/cli/src/teammate.ts` | none | C | CLI teammate 源启动（js-yaml、loader 解析镜像）→ 行为参考；vNext CLI 入口另行设计。 |

### 1.3 运行时（`@deepseek-ai/dsh-team-runtime`）

| legacy 路径 | 目标包 | 级别 | 备注 |
|---|---|---|---|
| `packages/team/team-runtime/src/orchestrator.ts` | none | D | `TeamOrchestrator.byLeader`（G5、G6 one-member-one-activation throw）整体丢弃；"in-flight 冲突诊断"意图 → C 级 acceptance 素材。vNext 激活权威在 TeamDomain。 |
| `packages/team/team-runtime/src/member-setup.ts` | `runtime` | C→B | `installMemberComposition`/`findMemberBound`/`findControlRequests`/`installRecoveredRules` 的恢复**流程**（bind-time 快照 + 恢复期文件层重读 + lapsed fail-closed + pending 孤儿结算）→ vNext cold-resume acceptance 基线（C）；其中的 rule-layer 装载调用序列在 vNext seam 上 B 级重写。`team/member-bound` event 作权威（G2）→ D。 |
| `packages/team/team-runtime/src/rule-layers.ts` | `runtime` | B | `resolveRuleLayerPaths`（home 层 + project 层路径解析）纯函数 → B 级移植（位置由新契约定义）；`recoveredRuleLayers` 进程内 Map（G5）→ D；`MANAGED/PROJECT_RULE_FILE` 常量 → C。 |
| `packages/team/team-runtime/src/approval-setup.ts` | `runtime` | C→B | `installApprovalHook`（pre-execute seam 上的 allow/deny/ask 分流）→ vNext 审批 seam 重写；`requestLeaderDecision` 的决策映射与 `leader_unreachable` 审计语义 → B/C 移植；唤醒 leader 用 `reportFrom`（G3）→ D。 |
| `packages/team/team-runtime/src/mcp-guard.ts` | `runtime` | A | MCP 策略 guard（按 bound snapshot 的 `mcpServers` allow 集过滤）→ 纯策略过滤，直接移植（策略对象换 vNext 类型）。 |
| `packages/team/team-runtime/src/skill-guard.ts` | `runtime` | A | skills guard（按 bound snapshot 的 `skills` 集合限制）→ 纯策略过滤，直接移植。 |
| `packages/team/team-runtime/src/index.ts` | none | D | `registerContinuableSetup`（fork-only API，G3）+ plugin 装配 → D；setup contribution 的 no-op-for-non-team + disposer 链模式 → C。 |

### 1.4 通道（`@deepseek-ai/dsh-team-channels`）

| legacy 路径 | 目标包 | 级别 | 备注 |
|---|---|---|---|
| `packages/team/team-channels/src/control-coordinator.ts` | `domain`（算法） | B | `sweep(now,timeoutMs)` 超时自动 deny、`reconcilePending`（并发 decide 安全）、`decide` 未知 id throw → 算法 B 级移植到 **TeamDomain-durable** pending control（先写目标类型）；`TeamControlRegistry` 进程内容器（G5）→ D。`controlRequestTimeoutMs=120000`（bundle 配置）→ C（默认值重新设计）。 |
| `packages/team/team-channels/src/progress-store.ts` | `domain`（算法） | B | latest-wins by taskId 的 `update/restore` fold → 移植到 TeamLedger activity 事实；`byLeader` 进程内容器（G5）→ D。 |
| `packages/team/team-channels/src/index.ts` | none | D | Service 注册装配（`ctx.teamControl` 等）→ D；service 键名词汇 → C。 |

### 1.5 模型工具（`@deepseek-ai/dsh-tool-team`）

| legacy 路径 | 目标包 | 级别 | 备注 |
|---|---|---|---|
| `packages/team/tool-team/src/tool-delegate.ts` | `tools` | B | `delegate_to_teammate` schema/卡片/三分支（run/follow_up/shutdown）诊断语义 → B 级移植到 vNext `tools`（目标传输 = vNext TeamRuntime，G3 传输 D）；`deliverFollowup`（G3）→ D；`pathExists`（managedPresent probe，G4）→ D；persistent 复用分支语义 → B。 |
| `packages/team/tool-team/src/tool-send-message.ts` | `tools` | B | `send_team_message` 角色三分支**星型路由语义**（peers 经 leader）→ B 级移植（行为基线 C 级验收）；`deliverTeamMessage` 三种 subagent 传输（G3）→ D；`memberBindingOf`（从自身 log 读 member-bound，G2/G1）→ D。 |
| `packages/team/tool-team/src/tool-control.ts` | `tools` | B | `team_control` list/decide 工具面 → B 级移植；decide 的 `Unknown control request` 诊断 → B；底层 registry 调用 → vNext TeamDomain API。 |
| `packages/team/tool-team/src/tool-progress.ts` | `tools` | B | `team_progress` list/update → B 级移植（merge 语义 + status 枚举保留）；`me.session.append('team/progress')`（G2）→ D（vNext 写 TeamLedger）。 |
| `packages/team/tool-team/src/tool-list-teammates.ts` | `tools` | B | `list_teammates`（registry + activations、last_activity/last_action）→ B 级移植；数据源 registry（G5）→ 换 vNext 实例查询。 |
| `packages/team/tool-team/src/index.ts` | none | D | `session/event` 监听（`tool/call`→updateActivity、`subagent-settled`→markSettled）把工具事件折进进程内 activation 表 → D（G2/G5）；settle/活动语义本身 → C 级行为参考。 |
| `packages/team/tool-team/src/invariant.ts` | none | D | 空 `InvariantInstaller`（"tool validation is at registration"）→ D；"校验在注册期完成"这一设计立场 → C 级参考。 |

### 1.6 投影（`@deepseek-ai/dsh-team-projection`）

| legacy 路径 | 目标包 | 级别 | 备注 |
|---|---|---|---|
| `packages/team/team-projection/src/fold.ts` | `remote`（算法） | B | **纯** fold：`foldTeamView`（delegations/tasks latest-per-taskId/approval pairs/messages capped 500）、`compareMessages` (at,sessionId,seq)、`resolvePageLimit`/`sliceMessagePage`（锚定分页，`ANCHOR_UNKNOWN`/`INVALID_LIMIT` 错误码）→ B 级移植，输入从 SessionEvent 语料换 **TeamLedger**（G2 输入 D，机制 B）；`delegatedMemberId` 容错 JSON.parse → C。 |
| `packages/team/team-projection/src/index.ts` | `remote`（模式） | D（实现）/ C（模式） | `TeamProjectionService` 整体实现（`rosterFor(workspacePath)` G4、live overlay 读 subagent catalog G3/G4、`readSession` persistence.inspect）→ D；**模式**保留为 C 级设计参考：whole-snapshot 发布、cold-safe 读、debounce+single-flight+triggerSeq 的 `rebuild` 姿态 → vNext TeamRemote 参考。 |
| `packages/team/team-projection/src/types.ts` | `contracts` | B | `TeamView`/`TeamMemberRow`/`TeamDelegation`/`TeamTask`/`TeamApprovalPair`/`TeamMessageRow`/`MessageAnchor` 等投影 DTO → B 级重写进 contracts（键 → instanceId/childSessionId；G1/G7 键 D）；`teamId = leaderSessionId`（G7）→ D，vNext 有独立 team 实体。 |
| `packages/team/team-projection/src/error.ts` | `contracts` | A | 投影错误码纯定义 → A 级移植（错误面并入 contracts 后）。 |

### 1.7 API / SessionController 耦合（去污染目标）

| legacy 路径 | 目标包 | 级别 | 备注 |
|---|---|---|---|
| `packages/api/session-controller/src/team.ts` | `remote` | B | `SessionTeamController`（namespace `team`、`team/projection` 单端点、`team-unavailable` wire 码）→ vNext **Team Remote** 的 wire 设计参考（B：先写 vNext TeamRemote 契约，再移植端点形态/错误码）；SessionController 承载 team 的耦合本身 → D（§4.9 去污染）。 |
| `packages/api/session-controller/src/types.ts` | `contracts` | B | `TeamProjectionRequest/TeamProjectionValue`、`MessageAnchor` 词汇 → B 级移植进 contracts（锚定分页词汇保留）。 |
| `packages/api/session-controller/src/client/sessions/team-mirror.ts` | `client` | B | `TeamMirror`（leader 键控 last-wins 表）→ D 作为 authority；`resolveTeamView`（frozen team-ness 判据、identity-stable 存储引用）→ B 级移植，vNext 键 = team/instance（G7 D）；注意 legacy 有**两份锁步副本**（`team-mirror.ts` 与 `client/ui-team/src/client/team-view-model.ts`），vNext 单一实现。 |
| `packages/api/session-controller/src/client/sessions/manager.ts` | `remote` | C | team control frame 落镜像 + cold-read single-flight 姿态 → C 级模式参考；team 耦合代码 → D。 |
| `packages/api/session-controller/src/client/contract/sessions.ts` | none | D | `TeamMirrorFace`（refresh/pageMessagesBefore 在 sessions face 上）→ D（vNext TeamRemote 独立 face）。 |
| `packages/core/session/src/known-event-types.ts` | none | D | 9 个 `team/*` 词汇表条目（含未见使用的 `team/member`、`team/message/delivered`、`team/message/queued`、`team/task`）→ D（§4.9/§4.10 去污染）。 |

### 1.8 客户端 UI（`@deepseek-ai/dsh-ui-team`）

| legacy 路径 | 目标包 | 级别 | 备注 |
|---|---|---|---|
| `packages/client/ui-team/src/client/team-timeline-model.ts` | `client` | A/B | `pickTimelineTicks`（1/2/5×10^n）/`formatTimelineTime` → A；`deriveTeamTimeline` lane fold → B（输入换 vNext DTO）；**`formatTeamDuration` 硬编码中文 copy（`毫秒/秒/分/小时`）→ 移植时必须拆入 locale 字典**（i18n 缺陷修复项）；`TEAM_LANE_COLOR_SLOTS=8` 色槽算法 → A。 |
| `packages/client/ui-team/src/client/TeamTimeline.tsx` | `client` | B | 交互常量（`MINIMUM_ZOOM_MS=1000`、`MINIMUM_DRAG_PX=3`、`WHEEL_ZOOM_EXPONENT=0.0015`、`TIMELINE_TOOLTIP_DELAY_MS=200`、`RUNNING_TICK_MS=1000`）与指针中心缩放/拖拽/键盘/tick 算法 → B 级移植；React 组件按 vNext slot/props/locale 约定重写。 |
| `packages/client/ui-team/src/client/team-members-model.ts` | `client` | B | group fold/running 计数/多实例折叠算法 → B；键 `memberId`/`sessionIds[0]` → `templateId`/`instanceId`/`childSessionId`（§4.8 明令 REWRITE DATA MODEL）；leader 行锚定 `leaderSessionId`（G7）→ 换 vNext team 锚。 |
| `packages/client/ui-team/src/client/TeamMembers.tsx` | `client` | B | 渲染/展开/状态点/点击 `openSession` → B；数据源换 vNext 投影。 |
| `packages/client/ui-team/src/client/team-feed-model.ts` | `client` | B | 混排确定性排序（(time,kind,source-order)、approval 锚定请求时刻）、loadedCount cap、`unloadedMessageCount` → B（纯算法 A 级，输入类型 B 级）；数据源 → TeamRemote/TeamLedger（G2 D）。 |
| `packages/client/ui-team/src/client/TeamFeed.tsx` | `client` | B | 行渲染/`DECISION_KEYS` 文案键/load-earlier 交互 → B；copy 全部进 locale。 |
| `packages/client/ui-team/src/client/team-dock-model.ts` | `client` | A/B | `deriveTeamDockCounts`/`deriveTeamDockPanel` 纯计数投影 → A（输入换 DTO 后 B）；成员行键含 `memberId`/`sessionIds[0]`（G1）→ 重写。 |
| `packages/client/ui-team/src/client/TeamDock.tsx` | `client` | B | dock 折叠读数 + 紧凑面板 UX → B（§4.8 "MIGRATE UX / REWRITE DATA SOURCE"）；slot 注册 `conversation.input.dock` id `team` order 15 保留语义。 |
| `packages/client/ui-team/src/client/team-view-model.ts` | `client` | A | `resolveTeamView` 第二份锁步副本 → 与 `team-mirror.ts` 合并为单一 A 级实现（去重是移植要求）。 |
| `packages/client/ui-team/src/client/team-marker-jump.ts` | `client` | B | `resolveTeamMarkerJump` 四 kind 目标规则 + 降级（inert/回落自身会话）→ B；memberId→`sessionIds[0]` join（G1）→ 换 instanceId 连接。 |
| `packages/client/ui-team/src/client/team-marker-definition.ts` | none | C | `teamMarkerDefinition`（1 event = 1 Chat row、D15 行身份、`buildLocationData`）→ 行身份/幂等 update 机制参考；"1 team SessionEvent = 1 Chat marker" 语义整体被 vNext 废弃（§4.8）→ 不复制。 |
| `packages/client/ui-team/src/client/TeamMarker.tsx` | none | C | marker 行渲染 → C；语义 DISCARD。 |
| `packages/client/ui-team/src/client/TeamTasks.tsx` | `client` | C | 旧 task 看板仅作**视觉灵感**（vNext Activity 类概念，不得暗示 task DAG authority，§4.8）；按 status 分列布局 → C 级参考。 |
| `packages/client/ui-team/src/client/TeamView.tsx` | `client` | B | tab 布局容器（timeline/members/feed/dock 组合）→ B；tab 注册语义（全局可见 team view tab）保留。 |
| `packages/client/ui-team/src/client/TeamSettingsSection.tsx` | `client` | C | settings 面板（enablement 开关面）→ C（vNext settings 面重新设计）。 |
| `packages/client/ui-team/src/client/locales.ts` | `client` | A | en/zh 字典结构 → A 级移植（内容按 vNext 词汇重写；timeline 中文硬编码文案并入此处）。 |
| `packages/client/ui-team/src/client/index.ts` | `remote`（注册）/ `client` | B | 注册语义（settings.section order 50、conversation.chat.node key `team-marker`、全局 team tab、input.dock order 15、`openSession` 注入）→ B 级按 vNext slot 契约重写；**`openTeamTab` DOM `querySelectorAll('[role="tab"]')` 文案匹配 hack → D**（跨插件 verb 缺失的错误降级）。 |

### 1.9 工作区耦合（`@deepseek-ai/dsh-ui-workspace`，team 补丁部分）

| legacy 路径 | 目标包 | 级别 | 备注 |
|---|---|---|---|
| `packages/client/ui-workspace/src/client/tree.ts` | `client` | B | D4 `teamChildSessionIds`（catalog `team:` 前缀隐藏，G4）→ 判据 REWRITE（vNext：TeamDomain instance 会话集合）；D5/D23 `teamRosterCounts` 徽标 → B（数据源 TeamRemote 计数）；`sessionVisible` 排除逻辑 → B。 |
| `packages/client/ui-workspace/src/client/contract/slots.ts` | `client` | D | `teamMirror: HostObservable<TeamMirror>` 注入契约 → D（vNext 用 TeamRemote 替代）。 |
| `packages/client/ui-workspace/src/client/rows/Rows.tsx` | `client` | B | leader 徽标渲染 → B（徽标语义保留，键重写）。 |
| `packages/client/ui-workspace/src/client/rows/WorkspaceBrowser.tsx` | `client` | B | 树集成点（teamChildren 过滤调用处）→ B。 |

### 1.10 装配 / preset / 示例 / 笔记

| legacy 路径 | 目标包 | 级别 | 备注 |
|---|---|---|---|
| `packages/bundle/team/cordis.patch.yml` | none | D | 插件装配清单（含 `controlRequestTimeoutMs: 120000`、`homePath` env 绑定）→ D；配置意图（超时默认值、home 路径注入）→ C。 |
| `packages/preset/agent-presets/presets/team/preset.yml` | none | C | team preset 隔离 realm 形态（team/teamControl isolate、subagents 保持 host 单例）→ vNext preset 设计参考。 |
| `packages/preset/agent-presets/presets/team/agent.cordis.yml` | none | C | 同上。 |
| `examples/team-agent/team-mock-llm.mjs` | `testkit` | C | mock LLM 驱动 → acceptance/e2e 素材参考（vNext testkit 自建）。 |
| `examples/team-agent/tests/fixtures/team-driver.ts` | `testkit` | C | e2e 驱动 fixture → C 级参考，不复制。 |
| `examples/team-agent/tests/fixtures/teammates/home-leader.md` | `testkit` | C | fixture 成员定义（leader 角色、`requiresApproval` 示例）→ C。 |
| `examples/team-agent/tests/fixtures/teammates/home-member.md` | `testkit` | C | 同上（member 角色）。 |
| `examples/team-agent/tests/fixtures/teammates/sentry.md` | `testkit` | C | 同上（sentry 场景）。 |
| `examples/team-agent/tests/fixtures/teammates/team-leader.md` | `testkit` | C | 工作区级 roster fixture。 |
| `examples/team-agent/tests/fixtures/teammates/writer.md` | `testkit` | C | 工作区级 roster fixture。 |
| `examples/team-agent/tests/snapshots/team-e2e/leader.expected.jsonl` | `testkit` | C | e2e 快照基线 → C（vNext 重录）。 |
| `examples/team-agent/tests/snapshots/team-e2e/sentry.expected.jsonl` | `testkit` | C | 同上。 |
| `examples/team-agent/tests/snapshots/team-e2e/writer.expected.jsonl` | `testkit` | C | 同上。 |
| `examples/team-agent/tests/team-e2e.snapshot.ts` | `testkit` | C | 快照测试本体 → C（机制参考，vNext 测试另行实现）。 |
| `.agents/notes/implemented/architecture/2026-08-15-layered-rule-loading-and-cold-recovery-snapshot.md` | none | C | cold-resume 设计笔记（bind-time 快照 + lapsed fail-closed 语义来源）→ 行为参考。 |
| `.agents/notes/implemented/architecture/2026-08-20-teammate-permission-enforcement-at-the-executor.md` | none | C | 权限执行 seam 笔记 → 行为参考。 |
| `.agents/notes/**`（2026-08-05/06/14/18/20/22/23 系列 team 笔记） | none | C | 决策史/设计意图 → 仅参考（Git history 亦可取回）。 |
| `AGENT_TEAM_PLUGIN_PLAN.md`、`AGENT_TEAM_PLUGIN_ROUND2_PLAN.md`、`AGENT_TEAM_PLUGIN_ROUND3_PLAN.md`、`AGENT_TEAM_PLUGIN_AUDIT_2026-08-18.md`、`AGENT_TEAM_N11_MAXCONTEXTTOKENS_DESIGN.md`（repo 根级） | none | C | 旧 team 模式规划/审计/设计文档 → C 级行为基线参考。 |
| `team-mode-feature-gap-analysis.md`（repo 根级） | none | C | 旧模式缺口分析 → C 级行为基线参考。 |

## 2. 按目标包汇总

| 目标包 | A 级条目 | B 级条目 | C 级（参考）条目 | D 级（丢弃）条目 |
|---|---|---|---|---|
| `contracts` | — | `types.ts` payload 词汇、projection DTO、anchor/请求词汇 | — | — |
| `domain` | — | `sweep/reconcilePending` 算法、latest-wins fold | — | — |
| `runtime` | `validation.ts`、mcp-guard、skill-guard | `parser.ts`、`discovery.ts` 算法、`enablement.ts`、`rule-layers.ts` 路径解析、`effectiveToolPolicy` | diagnostic、setup 机制、approval seam 语义 | — |
| `tools` | — | 5 个工具（delegate/send-message/control/progress/list-teammates）的 schema/UX/诊断 | invariant.ts 的设计立场（校验在注册期） | — |
| `remote` | — | fold 机制（分页/排序）、TeamRemote 端点形态参考 | whole-snapshot/cold-safe/debounce 模式、cold-read single-flight | projection 实现、SessionController team 端点耦合 |
| `client` | `pickTimelineTicks`、时间格式化、`resolveTeamView`（去重）、dock 计数、locales 结构 | Timeline/Members/Feed/Dock 模型与组件、marker-jump、工作区树判据、tab/dock/settings 注册 | TeamMarker/TeamTasks/Settings 语义 | DOM tab hack、teamMirror slot 契约 |
| `legacy` | — | `parser.ts`（成员定义解析） | — | — |
| `testkit` | — | — | examples/team-agent 全套 fixture/快照/驱动 | — |
| none（无 vNext 目标） | — | — | preset、notes、根级文档、CLI teammate | `events.ts`、orchestrator、进程内 registry 全部、bundle、known-event-types 条目、subagent setup 入口、team SessionEvent 持久化 |

## 3. 红线（移植时禁止事项，对应 inventory §0）

1. 任何移植产物不得 import `@deepseek-ai/dsh-team*` 旧包（G2/G5 authority 隔离）。
2. 不得以 SessionEvent（`team/*`）作为成员绑定/pending control/进度/消息的 durable 权威（G2）→ vNext authority = TeamDomain/TeamLedger + TeamRemote。
3. 不得以 `memberId` 作运行时身份（G1）→ `templateId`（静态定义）/ `instanceId`（运行时目标）/ `childSessionId`（会话连接）三分。
4. 不得以 cwd/roster 文件系统目录或 subagent catalog `team:` label 前缀作为 team 成员/子会话 authority（G4）。
5. 不得复制进程内 registry/activation/pending/progress Map 为 vNext 状态（G5）；只允许作为 cache 且必须声明 cold-safe 重建。
6. 不得复制 `startContinuable/followup/reportFrom` 作为 Member 原语（G3）→ vNext 自有 instance 生命周期。
7. B 级条目一律**先写 vNext 目标类型，再移植算法**（§7 禁止反向：先照抄旧实现再换类型）。
8. Timeline 时长文案禁止保留硬编码中文（1.7 修复项）；所有 UI copy 入 locale 字典。
