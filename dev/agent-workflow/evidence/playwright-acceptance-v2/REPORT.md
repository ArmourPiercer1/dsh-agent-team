# Playwright 真实浏览器验收报告 — TEAM_D1-D6_REPAIR_PLAN_V2 收束态（pw2 run）

- 日期：2026-09-07（02:41–03:15 UTC，本机时间 +8）
- 执行者：主会话 + playwright-cli（session `pw2`，headless Chromium，产物 `.playwright-cli/` 为会话工具临时物，不入库；本目录 screenshots/ 为留存证据）
- 对象：`TEAM_D1-D6_REPAIR_PLAN_V2` 收束后的 master `0132918` 构建
- 纪律：仅汇报、不修复（用户指令）。所有 FAIL/GAP 只记录。

## 1. 执行环境

| 项 | 值 |
| --- | --- |
| 测试 host | `references/deepseek-harness-test-use`（pristine @ `76fda729799fe9b3848dbe2c211d4b231032b81e`，前后均验证 porcelain 空） |
| DSH_HOME | `references/.dsh-test`（工作区内） |
| 端口 | 3180（运行结束已释放，ECONNREFUSED 验证） |
| 模型 | `qiyuan-self/qwen3.8-27b`（真实模型；API key 仅在 spawn env，未出现在任何日志/报告） |
| 启动脚本 | `dev/agent-workflow/evidence/playwright-acceptance-v2/pw-boot.mjs`（两次 boot） |
| boot #1 | `phase=create`，row root = `session-pw2-pwmtqmvxgyb840`（02:41） |
| boot #2 | `phase=resume`（`PW2_ROOT_SESSION_ID=session-82359530-9b58-4a18-aea1-57c1496de187`，create-or-open → resume，03:00） |
| 稳定实例 | `:3080` / `D:\deepseek-harness` 全程未触碰（pid 88988 持续 LISTEN 3080，运行中识别并排除，未操作） |
| 推送 | 无（禁止 push 纪律；master 本地 `0132918` + 本证据 commit） |

控制文件哨兵：`dev/agent-workflow/evidence/playwright-acceptance-v2/control-file.txt`，哨兵行 `sentinel=PW2-SENTINEL-20260907103534-x9q`（第 2 行），用于端到端逐字结果校验。

## 2. 验收结果总表

| # | 项 | 结果 | 证据 |
| --- | --- | --- | --- |
| P0 | 启动与 UI 挂载（3 rows + client bundle + health gate） | **PASS** | §3.1 |
| D1 | 持久 root 零态列表面（普通会话 Team tab，52 行全字段） | **PASS** | §3.2 |
| P1 | Leader 真实模型闭环（恰好 10 个 team_* 工具） | **PASS** | §3.3 |
| P2 | Member 真实模型闭环（26 base + 恰好 10 team_* = 36，身份块，逐字文件读） | **PASS** | §3.4 |
| D2 | 委派结果线形 `{requestToken,status,body}`（哨兵逐字往返） | **PASS** | §3.5 |
| D2 | Team 模式入口 + §1.1.5 打开方式徽章（有历史 root） | **PASS** | §3.6 |
| D3 | 普通模式入口（徽章切换；无 ensureRootLive 调用） | **PASS** | §3.7 |
| D4 | Team↔普通↔Team 切换（无重复注册） | **PASS** | §3.8 |
| P8 | F5 持久化恢复（会话/成员/tab/团队视图） | **PASS** | §3.9 |
| D5 | 确定性实例 ID（重启前后不变） | **PASS** | §3.10 |
| D6 | host 重启恢复（resume boot + 浏览器入口 + 冷恢复 leader 带 10 team 工具） | **PASS** | §3.11 |
| N-a | 普通会话不自动获得 team 工具（文档边界，负例） | **PASS（边界成立）** | §3.12 |
| G1 | 零 turn root 的 Team 入口：UI 不切换（静默 no-op） | **GAP（仅记录）** | §4.1 |
| G2 | picker 入口 promise 链缺 `.catch()`（typed-failure lane 潜在盲区） | **GAP（仅记录）** | §4.2 |
| B1 | agent 侧变更需 F5 才在已挂载 Team tab 呈现（D4-A1 文档范围） | **观察（符合设计）** | §4.3 |

## 3. PASS 项证据

### 3.1 P0 启动与 UI 挂载
- boot #1 / #2 均：`rows mounted: dsh-agent-team=true dsh-agent-team-client=true p6t6=true`（`boot-state.json`、`instances/PWBOOT/*.log`）。
- client bundle：route id = 拥有 manifest 的包名 `@dsh-agent-team/client/client.js`，rev `f8e7d45f476cbad4-45`，910113 B，两次 boot 均 200（boot 日志 "client candidate served"）。
- boot graph（注入 index 的 `/plugins/??…` combo）4630906 B 200。
- health gate `GET /__p6t6/health` → `{"ok":true,"boot":N,"ready":true,"rootSessionId":…,"liveSessions":[…],"toolCount":10}`（`p6t6-health-final.json`、`p6t6-state-final.json`）。
- 教训留痕：早期 pwsh-268 boot FAIL 因 probe 误用 row id 路径 `/plugins/dsh-agent-team-client/client.js`（404）；正确 probe = boot graph URL（本目录 `pw-boot.mjs` 已固化该逻辑）。

### 3.2 D1 持久 root 零态列表面
- 普通会话（G5A-MO-mtqfg4tb / G5A-MO-mtqfg6qs19bf5c 两次）Team tab 渲染 "已持久化团队" 列表：**52 个 `[data-team-root-row]`**，每行含 root id、`blueprint@revision`、default workspace、成员数、创建时间、双入口按钮（`data-team-mode-open-root` / `data-team-ordinary-open-root`）。
- 列表覆盖全部历史世界：`session-577e4c3c…`（2 名成员）、G5A-a/b 系列（17 行）、D4V2-a/b 系列（28 行）、`session-pw2-*`（3 行）、`team-root`（字面 id，G5A 世界 seed）等 —— 跨 boot 的持久索引完整。
- 截图：`screenshots/pw2-ordinary-mode-badge.png`（含 picker 的视口）。

### 3.3 P1 Leader 真实模型闭环
- root `session-82359530-9b58-4a18-aea1-57c1496de187`（UI 创建，blueprint `pw2-bp`，模板 leader+worker）。
- durable log（`dump-session-log.mjs` 输出）：两轮 `request/header` 的 tools 数组均 **count=10 且全部 team_***：`team_create_member, team_delegate, team_follow_up, team_inspect_config, team_list_members, team_list_templates, team_report_progress, team_request_control, team_resolve_control, team_send_message`（与 mock 世界 G5A leader 面一致；`health.toolCount=10` 互证）。
- 真实工具调用序列：`team_list_templates`（seq111，token `list-templates-001`）→ `team_create_member`（seq148，`create-member-w1-001`，worker，label W1 → `inst-0nyvml71o9dq`，childSession `session-team-child-ca039f03216c16895b402d7883a0c852`，ledgerSequence 82，ADMISSION_OPEN）→ `team_delegate`（seq198，`delegate-w1-read-001`）。
- 最终答案向用户报告了 control-file 完整内容（含两行哨兵文本）。截图：`screenshots/pw2-leader-conversation.png`。

### 3.4 P2 Member 真实模型闭环
- W1 模型请求 tools 数组：**36 = 26 base + 恰好 10 team_***（durable log `request/header`）。
- 身份块（W1 请求 system 上下文，`[team-member-context rootSessionId="session-82359530-…" instanceId="inst-0nyvml71o9dq" role="member"]` + "每次 team_* 调用必须带 rootSessionId 与全新 requestToken" 规则）逐字验证。
- 任务信封：`[team-work requestToken=delegate-w1-read-001] 请读取文件…`（user message）。
- W1 以 base `read` 工具依次读取：`docs/ROUTER_RULES.md`、`docs/TEST_METHODS.md`（本仓库 AGENTS.md 的会话开始必读规则，真实模型自行遵守）、`control-file.txt`；结果逐字包含 `sentinel=PW2-SENTINEL-20260907103534-x9q`。
- 时间线（Team tab，F5 后）：#82 成员创建 02:53:57.566Z → #83 工作准入 02:53:59.903Z（事件 .940Z）→ 活动开始 02:54:00 → 活动结束 02:54:06（progress completed）→ #86 生命周期 RUNNING→SETTLED。

### 3.5 D2 委派结果线形
- `team_delegate` 的 tool/result：`effect=work-admitted, settled:true, settledSequence:86, memberResult:{requestToken:"delegate-w1-read-001", status:"succeeded", body:"\n\ncontrol-line-1: the quick brown fox jumps over the lazy dog\ncontrol-line-2: sentinel=PW2-SENTINEL-20260907103534-x9q"}` —— 与 v2 计划 §1.3 结果契约逐字段一致（哨兵跨 leader→member→leader→用户 全链路逐字往返）。

### 3.6 D2 入口 + §1.1.5 打开方式显示
- 有历史 root（82359530）的 leader 行点击 "以 Team 模式打开 / 回到 Leader" → 行内徽章 `data-team-mode-badge data-open-mode=team` 渲染 **"Team 模式"**（ref f1e460），会话保持打开、0 console error。
- 徽章组件：`packages/client/src/ui/TeamMembers.tsx` L413-425（仅当本客户端经显式入口坐在此 root 上时显示）。

### 3.7 D3 普通模式入口
- 同 root 点击 "以普通模式打开" → 徽章切换为 **"普通模式"**，0 console error。
- N2（boot #2，死 root `session-577e4c3c-f09f-42eb-80f9-c3356b7cfde9`，有原生历史）：普通入口成功 open（纯原生 open）；点击前后 `__p6t6/health.liveSessions` 完全一致（无 `session-577e4c3c…` leader 复活）→ **无 team.ensureRootLive 调用**，0 console error。
- D3 语义边界（按设计）：普通模式不保证 team 工具、UI 不做工具移除声明（按钮 title 承载语义承诺）。

### 3.8 D4 切换往返（无重复注册）
- Team → 普通 → Team 三次入口点击，徽章跟随（Team 模式/普通模式/Team 模式）；`liveSessions` 恒为 3 项（82359530、pwmtqmvxgyb840、W1 child），无第二个 leader，`toolCount=10` 不变。截图：`screenshots/pw2-team-tab-badge-team-mode.png`。

### 3.9 P8 F5 持久化恢复
- 会话中按 F5：root 会话恢复为顶部选中；W1 member 会话在 "未分组"；Team tab 选中态保持；团队视图全量渲染（成员组 + 时间线 + 活动进度）。

### 3.10 D5 确定性实例 ID
- `inst-leader` / `inst-0nyvml71o9dq`：boot #2 重启后由冷恢复 leader 的 `team_list_members` 报告，ID 与重启前完全一致（W1 生命周期 SETTLED 亦跨重启保持）。

### 3.11 D6 host 重启恢复（核心场景）
1. kill boot #1（job 终止；端口 3180 ECONNREFUSED；无孤儿 host 进程——识别出的 3.4GB node 进程 pid 88988 经 netstat 确认为 **:3080 稳定实例**，未操作）。
2. `PW2_ROOT_SESSION_ID=session-82359530-…` 重启：`directive written (boot=2 phase=resume root=session-82359530-…)`；3 rows 重挂载；`row ready — toolCount=10 liveSessions=["session-82359530-…","session-team-child-ca039f03…"]`（root + 已绑定 member 重新激活；旧 row root 未复活——符合 row 语义）。
3. 浏览器新 token 重开：root 会话自动恢复选中；Team tab 全量重建（时间线 #82/#83/活动/生命周期条目与重启前逐条一致，时间戳不变 → D1 持久索引重启重建一致）。
4. "以 Team 模式打开 / 回到 Leader" 可用（入口复活）→ 徽章 "Team 模式"，0 console error。
5. 新 leader turn（"用 team_list_members 列出成员"）：调用 `team_list_members`，返回表 `inst-0nyvml71o9dq / W1 / worker / SETTLED` + `inst-leader / leader / leader / (团队领导者)`；durable log 第二轮 `request/header` tools 数组再次 **count=10 team_*=10**（冷恢复 leader 的 team setup 完整）。
6. 截图/状态：`p6t6-state-final.json`、`p6t6-health-final.json`、`screenshots/pw2-team-tab-badge-team-mode.png`（F5 后同视图）、`screenshots/pw2-leader-conversation.png`。

### 3.12 N-a 负例：普通会话不自动获得 team 工具（文档边界成立）
- 证据：`session-ea12e64f-7715-44dc-82ac-492b1911c7f7`（case (a) 中由占位符发送所创建的标准会话）：preset standard、模型请求仅 base 工具、无 team_*；模型自述 "当前会话的工具集里没有 team_create_member"，改用 base `read` 读到了 control file。与 v2 计划 §12 D4 明示边界一致（"普通会话列表打开不自动 Team 工具"不测试/不宣称的反面：实际不授予）。

## 4. GAP / 观察（仅记录，未修复）

### 4.1 G1 — 零 turn root 的 Team 入口：host 侧 ensure 成功，浏览器侧 open 不生效（静默 no-op）
- **复现 1（boot #1, case a）**：对 row root `session-pw2-pwmtqmvxgyb840`（零 turn）点 "以 Team 模式打开 / 回到 Leader"。host 侧 ensureRootLive 成功（generation 1→2），但 UI 停留在 "新会话" 占位；随后在该状态发送 prompt → 创建**新标准会话** `session-ea12e64f…`（无 team 工具）执行；root log 零增长。
- **复现 2（boot #2, N1）**：同一死 root 再点该入口。`liveSessions` 出现 `session-pw2-pwmtqmvxgyb840`（**leader 被冷恢复，host 侧保证成立**），但 UI 选中节点仍为占位符（`[aria-selected]` sessionRow 无 `data-session-id`）；无徽章、无 typed error、0 console error。
- **证据链推断的机制**：零 turn 的 team root 在**原生会话列表中没有条目**；`ctx.sessions.open(rootId)` 被接受（不抛错）但无列表节点可切换 → 选中态不变；open-mode 标记随后被 list 订阅的 reset effect 清除 → 静默 no-op。对照：UI 创建路径可用，因为 `openCreatedSession`（`team-mount-core.ts` L587-596）先 `sessions.refresh()` 再重试 open（创建流程的 list 增量使 root 进入原生列表）。
- **用户影响**：全新安装 / root 尚无 turn 时，点 "以 Team 模式打开 / 回到 Leader" 外观上无效果；用户随后输入发送会落入标准会话（无 team 工具）——§1.1.5 "避免用户误以为普通模式具备 Team 工具" 的意图在该边缘被削弱（无徽章、无错误提示）。
- **不在验收通过范围内**：本 run 的全部 in-scope 场景（UI 创建路径、有历史 root 的入口、重启恢复）均 PASS；G1 影响的是"无原生历史的 root"这一边缘。

### 4.2 G2 — picker 入口 promise 链缺 `.catch()`（typed-failure lane 潜在盲区）
- `packages/client/src/ui/TeamView.tsx` L411-425（`runPickerOpenTeamMode`）：`void face(rootSessionId).then(outcome => { if (!outcome.ok) 设置行内 typed error }).finally(清 pending)` —— **无 `.catch()`**。
- 若 `openTeamMode` reject（例如 seam 契约变更使未知 id 的 open 开始抛错，见 `team-mount-core.ts` D3 注释），行内 typed error lane（`view.members.openMode.error`）永远不会渲染，只剩未处理 promise rejection + pending 清除。
- 本次 run 未触发（open 未抛错，见 G1）；属 D2 typed-failure 路径的健壮性缺口。

### 4.3 B1 — agent 侧 Team 变更需 F5 才呈现（D4-A1 文档范围，符合设计）
- 创建 W1 / 准入 / 生命周期推进期间，已挂载的 Team tab 保持创建时刻的镜像（时间线 "暂无委派记录"、成员缺失）；F5 后全量渲染。截图：`screenshots/pw2-pre-f5-team-tab-stale.png`。
- 与 v2 计划 §12 D4-A1 明示范围一致（仅 UI 发起的变更拉取投影；agent/tool 变更不拉取），D4-A2 为 post-v2 设计项。**非缺陷**，记录以免误读。

## 5. 环境与合规检查（运行结束态）

- `references/deepseek-harness-test-use`：`git status --porcelain` 空，HEAD `76fda729799fe9b3848dbe2c211d4b231032b81e`（pristine 保持）。
- `:3080`：pid 88988 持续 LISTEN（运行中曾识别并确认其为稳定实例，未操作）。
- 端口 3180：已释放（ECONNREFUSED）。
- 仓库：零 upstream 源码修改；唯一工作树噪声 `packages/runtime/dist/…/agent-bindings.mjs` 经 `git diff` 确认仅 CRLF/LF 行尾差异（内容相同），已 `git checkout --` 还原。
- API key：未出现在任何日志、截图、dump 或本报告（仅 spawn env）。
- 未 push。

## 6. 证据文件索引

| 文件 | 内容 |
| --- | --- |
| `pw-boot.mjs` | 两次 boot 的启动脚本（profile patch seam + directive + health gate + client probe） |
| `boot-state.json` / `instances/PWBOOT/` | 每次 boot 的状态与完整启动日志 |
| `control-file.txt` | 哨兵控制文件（`PW2-SENTINEL-20260907103534-x9q`） |
| `p6t6-state-pre-restart.json` / `p6t6-state-final.json` / `p6t6-health-final.json` | p6t6 域状态/健康 JSON（重启前、终态、终态健康） |
| `dump-session-log.mjs` / `dump-team-events.mjs` | durable log 取证助手（多帧 zstd 解压、tools 数组、team_* 事件） |
| `screenshots/pw2-pre-f5-team-tab-stale.png` | F5 前 Team tab 陈旧态（B1 证据） |
| `screenshots/pw2-leader-conversation.png` | leader 对话（含 team 工具调用与报告） |
| `screenshots/pw2-team-tab-badge-team-mode.png` | Team tab 终态（徽章 "Team 模式" + 时间线） |
| `screenshots/pw2-ordinary-mode-badge.png` | 普通模式上下文视口（含零态 picker） |
| `dev/agent-workflow/evidence/playwright-acceptance/`（前次首跑，untracked，未动） | 首次 playwright 验收（boot 404 事故等历史证据） |
| durable logs（`references/.dsh-test/sessions/--D-AgentDev-dsh-plugins-dsh-agent-team--/`） | `session-82359530-…`（leader，435 行，两轮 tools=10）、`session-team-child-ca039f03…`（W1，163 行，tools=36 + 身份块）、`session-pw2-pwmtqmvxgyb840`（row root，4 行）、`session-ea12e64f-…`（N-a 标准会话证据） |

## 7. 结论

v2 收束态（master `0132918`）在真实浏览器 + 真实模型下的 **12 项 in-scope 验收全部 PASS**（含 D6 重启恢复核心场景：冷恢复 leader 带完整 10 team 工具、确定性实例 ID 跨重启保持、D1 索引重启重建一致）。记录 **2 个 GAP（G1 零 turn root 入口静默 no-op、G2 picker 入口缺 .catch）** 与 **1 个符合设计的观察（B1，D4-A1 范围）**，均未修复（遵用户指令）。G1 建议作为 post-v2 跟进项（与 D4-A2、TCM M4 client race 并列），其最小修复方向：`openTeamMode` 在 open 不生效时走 `openCreatedSession` 式的 refresh+retry，或在无原生条目时渲染 typed error lane 而非静默返回。
