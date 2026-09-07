# tests\mock 执行日志（NOTES.md → 最终汇编 REPORT.md）

> 判据约定：模型非确定性（qwen3.8-27b）——模型不合规 ≠ 产品缺陷；涉及"模型应调用某工具"的任务以 durable log 的 tools 数组 / tool/call 记录为准，提示词重试 ≤3 次后记 MODEL-NONCOMPLIANCE（非 FAIL）。
> 环境快照：宿主 `references/deepseek-harness-test-use` @ stable `a66e4702`（用户裁决切分支 + clean/install/build）；DSH_HOME = `tests\mock\.dsh-home`（fresh）；端口 3181/3491/3492；模型 qiyuan-self/qwen3.8-27b（key 由用户配置于 `.credentials.yaml` ref，会话实测可用）。

## T0.1 搭建 — PASS
- `tests\mock\{scripts,fixtures,work,evidence,state,hosts}` 全量 scaffold；`scripts/boot.mjs`（含 `MOCK_ROOT_SESSION_ID` / `MOCK_HARD_TOOLS` / `MOCK_BOOT_LABEL` / `MOCK_DEAD_MCP_URL` / `MOCK_PROFILE_MODE` 开关）；`scripts/copy-profile.mjs`（junction 保持复制，修复 cpSync 0xC0000409 栈溢出）；`scripts/dump-session-log.mjs`（zstd 持久日志解析：kinds/presets/file-policy/tools 数组）；fixtures（sentinel/requirements/seed-note）。
- 偏离记录：profile 树 = 4 实体文件 + 273 指向宿主树 junction 的链接农场（scan 证据：无环内 link、web/node_modules 无 junction）；fresh 模式下弃用复制、由 ensureProfile throwaway boot 按 stable 树重新初始化。

## T1.1 全新 home 启动 — PASS
- 08:25:41Z `MOCKBOOT_READY`：4 行挂载（dsh-agent-team / dsh-agent-team-client / p6t6-team-tools / dtest-mcp-http），health gate `ok=true toolCount=10`，`liveSessions=["session-dtestmtqz76ah1039"]`；boot-state.json 落盘。
- 首启契约发现（已修）：blueprint `requirements[].domain` 须小写 slug —— 原 `mcpServer` 触发 `TeamContractError … got "mcpServer"`；改 `domain: mcp`（closed bridge 映射 mcp→mcpServer）。见计划 §2.1 契约发现条目。

## T0.2 干跑（T3.8a 并入）— PASS
- 前序步骤（boot→health gate→row dump 4 行→bundle serve 探测 910KB team client bundle）在 boot#1 实启中完成。
- **T3.8a 死 url + failOnStartupError → loud fail：确认**。`MOCK_DEAD_MCP_URL=1`（url→127.0.0.1:3499/mcp，mini#2 不起）：宿主进程 **exit code 1**，无 boot marker、无部分 UI。宿主日志（`hosts/boot-dryrun-t38a/instance-port3181.log`）：
  - `Error: dsh: plugin tree failed to load: failed to apply loader entry include (cordis:include): failed to apply loader entry dtest-mcp-http (@deepseek-ai/dsh-mcp-client): mcp-client(dtesthttp): initial connection or tool synchronization failed`
  - 根因 `Error: connect ECONNREFUSED 127.0.0.1:3499`（`packages/mcp/mcp-client/lib/index.js:783`）。
  - 伴生观察（teardown 时序，非独立 finding）：同一日志中 dsh-agent-team 行 bootstrap 报 `TeamDomainError: store 'team_sessions' operation 'update' was rejected: the TeamDomain is closed`（宿主因 mcp 失败整体中止时，team 行 in-flight bootstrap 撞上关闭的 domain）。
- 拆机：3181/3491/3492 释放验证（kill 树后 100ms 内全 free）。

## T1.3（部分，标准会话侧基线）— 证据先行
- 用户实测会话 `session-ed86deda-2d4b-4588-9e8f-2aa91682b0e1`（D:\test 工作区，标准会话）durable log 断言：
  - `PRESETS: ["workspace-write"]`、`FILE_POLICY: ["workspace-write"]`（prompt 行 `Current DSH file policy: workspace-write`）——**审批项 3 的 workspace-write 即宿主默认 preset，无需 patch 固定**；
  - `TOOLS[0] count=27 team_*=`0` mcp__*=`1``：26 base 工具（与 v2 实测 B0=26 一致）+ `mcp__dtesthttp__ping`（宿主级 MCP row 生效）+ **team_* 不在**（N-a 边界成立）。
- 计划口径的 T1.2 流程内标准会话（tests\mock 工作区）证据待 T1.2 后补齐；`state/baseline-inventory.json` 待写入。

## 测试世界设置操作（非 finding，环境构造留痕）
- **workspace 注册表 bootstrap**（T1.2 前置卡点）：fresh home 首启时 session 列表为空 → `WorkspaceRegistry` 一次性 bootstrap 落 `initialized:true + 0 workspaces`（`storages/workspace.json`）；此后新增 session 不再触发重建（`table.size===0` 分支跳过 reindex）。hero "选择工作区" 在空列表 + add-only 时点击直接拉起 directory flow；`dsh-host-directory-picker-auto` 在 win32+loopback+非 SSH 解析为 **native**（OS 文件夹对话框）→ headless 浏览器无法驱动。处置：停宿主 → 手工把 `workspace.json` 置 `initialized:false` → 重启（directive 不变，root 不变）→ 注册表按 session header 一次性 bootstrap：**2 个 workspace**（`mock` = tests\mock，含 row root；`test` = D:\test，含用户会话 session-ed86deda…）。浏览器侧此后正常列出/选择工作区。
- **T1.2 执行中 root 轮转**（G1 零 turn 前置被消耗）：在 mock 工作区点 "在'mock'中新建会话" 后，hero composer 绑定的是**活着的 team root**（该 workspace 唯一的 session；团队 dock "1 运行中" 同现），发送的探针 prompt 路由进 **leader turn**：root `session-dtestmtqz76ah1039` 由零 turn 变为 1 turn（log 27 行；`session/title` = "请只回复：OK"；root 随之获得原生会话列表条目）。伴生：D:\test 工作区出现 4 行空壳标准会话 `session-9583a5a3-5262-4870-8c6d-d90d925f8039`（session+3 策略行，无 request —— hero 曾短暂绑定 test 空会话的物化痕迹；"占位处发送 → 新标准会话"路径本身在此已出现一次实例）。
  - 处置：重启宿主且**不设** `MOCK_ROOT_SESSION_ID`（新 nonce → 新零 turn row root，phase=create）。旧 root（1 turn）保留为持久行 → 供 G1 列表的**有历史对照行**（预期：点 "以 Team 模式打开" 正常打开 + Team 徽章；零 turn 行 → 静默 no-op）。
  - **下游口径同步**：P5 T5.2 "boot#2 同 root 重启" 与 P4 boot#3（`MOCK_HARD_TOOLS=1`）的 `MOCK_ROOT_SESSION_ID` 一律改用**轮转后的新 root id**（boot-state.json 为准）。
- **Leader 工具面实测**（顺带证据，早于 T1.4）：root leader 首请求 `TOOLS[0] count=11 team_*=10 mcp__*=1`（10 team_* + `mcp__dtesthttp__ping`，**无 base 工具**）——与 v2 实测 leader 面（count=10 全 team_*，无 base）一致，本世界 +1 宿主 MCP 工具。计划 T1.4 措辞 "B0 + 10 team_* + mcp" 与实测/ v2 口径不符 → 以 durable log 为准记 OBS（leader 面无 base 工具属设计，非缺陷）。

## T1.2 G1 观察项 — OBS（fresh-home 复现成立 + 两条新边缘，均仅记录）
**前置状态**（boot label `t12-newroot`，directive root = 新零 turn root `session-dtestmtr0i8cxb3de`）：
- 会话树：mock 工作区下**无**新 root 条目（零 turn → 无原生列表节点）；旧 root（1 turn）有条目"请只回复：OK"；T3.8a 残留 root（`session-dtestmtqzvaez69e5`，无 session artifact）不在树中。
- 观察点 = test 工作区新标准会话（`session-9583a5a3`，占位符发送创建）的 Team tab 零态："当前会话未加入任何团队" + "已持久化的团队"列表 **3 行**（每行 root id / `dtest-bp@1` / default workspace / 0 名成员 / 创建时间 / 双入口按钮），另有 "从此处开始团队" 创建入口。截图 `screenshots/t12-g1-pre-click.png`。

**三次 picker 点击（同一零态列表，控制台均 0 error）：**

| # | 目标 root | 状态 | UI 结果 | host 结果（`__p6t6/health` + disk） |
|---|---|---|---|---|
| 1 | `session-dtestmtr0i8cxb3de`（directive root） | 零 turn、**live** | **静默 no-op**：未打开 root、无徽章、无 typed error；UI 转入惰性占位（"未分组/新会话"，hero "选择工作区/选择一个工作区开始"，composer 全禁用） | liveSessions 恒 `[新root]`（恰 1 项）；root log 恒 4 行（零 turn 不变） |
| 2 | `session-dtestmtqzvaez69e5`（T3.8a 残留） | 零 turn、dead、**无 durable session artifact** | 行内 typed error lane 渲染：`以 Team 模式打开失败：TEAM_REMOTE_TEAM_ROOT_LIVE_NO_DURABLE_ARTIFACT: team.ensureRootLive: session '…' has no durable session artifact and is not live — the Team-mode ensure cannot resume it: p6t6: session '…' is neither live nor durable — no agent to execute a tool on`；UI 停留原处 | 无复活（liveSessions 不变）；磁盘无新 session 目录 |
| 3 | `session-dtestmtqz76ah1039`（旧 directive root） | 1 turn、p6t6 侧 dead、**DSH session 仍 live**（浏览器 reload 自动重开所保持） | 行内 typed error lane：`以 Team 模式打开失败：TEAM_REMOTE_TEAM_ROOT_LIVE_START_FAILED: team.ensureRootLive: the Team-mode ensure of '…' failed: cannot prepare session "…" while it is live`；UI 停留原处 | 无复活（liveSessions 不变）；root log 27→28 行（失败的 ensure 追加 1 条 `session/end-seed`） |

**结论与 finding：**
- **G1 核心（v2 §4.1）fresh-home 复现成立**：零 turn root 的 "以 Team 模式打开 / 回到 Leader" → 浏览器侧 open 不生效（无徽章/无列表节点可切换/无错误），host 侧保证平凡成立（已 live）；用户随后发送将落入标准会话（占位路径本次由 test 工作区会话创建实证：标准会话、无 team 工具）。与 v2 差异（仅表现层）：v2 中 UI 停留在原占位；本 run 中 UI 转入"未分组/新会话"惰性占位（无工作区可选时 composer 全禁用 → 需先选工作区才能发送）。
- **新边缘 A（点击 2，OBS-F1）**：持久 team root **无 durable session artifact**（T3.8a 中断 bootstrap 的产物：team domain 记录在、session 文件不在）→ ensure 走 typed 失败 `NO_DURABLE_ARTIFACT`，不复活、无未处理 rejection。该 lane 工作正常；触发前提是异常世界（正常创建的 root 必有 artifact）。
- **新边缘 B（点击 3，FINDING 候选，仅记录）**：root 的 **DSH session live 但 team agent 不 live**（浏览器自动重开保持 session；宿主重启后 directive 只激活新 root）→ `ensureRootLive` 报 `START_FAILED … cannot prepare session while it is live`——ensure 路径对 "session 已 live 但团队绑定缺失" 无恢复分支（既非 v2 repro-1 的已 live 成功，也非冷恢复）。typed 展示正确；语义缺口 = 用户点击入口无法把 team 面拉回一个 session 仍开着的旧 root。触发条件明确（客户端跨宿主重启保持旧 root session + 该 root 非 directive root），可复现。
- 截图：`t12-g1-pre-click.png` / `t12-g1-post-click1-live-zero-turn.png` / `t12-g1-post-click2-dead-zero-turn.png` / `t12-g1-final-typed-errors.png`（后两者含行内 typed error）；health 快照 `t12-g1-health-pre/post1/post2/post3.json`。

## T1.3 基线工具清单 — PASS
- 标准会话 `session-9583a5a3-5262-4870-8c6d-d90d925f8039`（test 工作区，占位符发送创建，1 轮探针"请只回复：OK"）durable log（27 行）：
  - `PRESETS: ["workspace-write"]` / `FILE_POLICY: ["workspace-write"]`（宿主 permission-presets 默认，审批项 3 成立，无需 patch）；
  - `TOOLS[0] count=27 team_*=0 mcp__*=1`：**B0=26**（与 v2 一致；完整清单见 `state/baseline-inventory.json`）+ `mcp__dtesthttp__ping`（宿主级 MCP row 生效）+ **team_* 不在**（N-a 边界）；
  - 旁证：用户会话 `session-ed86deda…` 同基线（27 工具）。
- 交付：`state/baseline-inventory.json`（含 member 面预期 37 = 26+10+1，供 P2 断言）。

## T1.4 UI 新建团队 — FINDING（结构性阻断；用户裁决：仅记录，不进一步诊断、不修复）
**现象**（截图 `screenshots/t12-g1-final-typed-errors.png` 同世界；对话框快照见本节后证据行）：
- 侧边栏 "新建团队" 对话框：选蓝图 `dtest-bp (rev 1)` + 工作区 mock + 标准模式 → 兼容性 lane 渲染 **`✕ 团队无法创建`**：`需求 req-mcp-dtest-mini — complete:true requirement unmet: dtest-mini (structural FATAL, not downgradeable)`；"创建团队" 按钮永久 disabled。
**根因链（记录为止，不再深入）**：
1. 预创建探针 `intent.probe` 宿主侧是纯域探针，只吃调用方传入的 `environmentFacts`（`packages/runtime/src/plugin/s6-remote.ts` L1413–1425）；
2. 客户端只构造 persona fact（所选预设，`packages/client/src/model/team-intent-model.ts` `intentEnvironmentFacts`）；引擎把缺失 fact 视为 `available:false`；
3. 蓝图非 `optional` 需求映射为 `complete:true`（`packages/runtime/compatibility/blueprint.ts`：`complete: requirement.optional !== true`）→ unmet = 强制 FATAL、不可 ack 降级；
4. 故：**含必需（非 optional）非 persona 需求（如 mcp）的蓝图，UI 创建路径结构性不可达**；directive/row 路径不受影响（row prober 用 row 声明的 `environmentFacts`，含 mcpServer/dtest-mini available → PASS，实测 08:25:41 兼容 ✓）。
5. 旁证：catalog 只含 row 绑定蓝图（`root.ts` L573 `createBlueprintCatalog([blueprint])`）——无法经 row config 加第二个蓝图规避；改 dtest-bp 的 `optional` 会变更 contentHash，现有 3 个持久 root 的绑定快照将不可解析（`s6-remote.ts` L1361–1379）。
**用户裁决（2026-09-07，T1.4 路线提问）**："仅记录即可，不要进一步诊断、更不要修复" → 不做世界重建、不改蓝图、不改代码。
**计划偏差（记录）**：T1.4 的 R1（UI `team.create` 客户端创建路径）本轮**不验证**；其三项可观察断言改由 directive root `session-dtestmtr0i8cxb3de` 承载（首 turn 后：原生树条目 + Team 模式 open/badge + leader 面 11 = 10 team_* + 1 mcp，见 T1.2 leader 面实测）；**P2–P6 全部改在 directive root 内执行**（该 root 为当前唯一 live 的 dtest-bp 团队 root）。
**证据**：对话框兼容性 lane 文本（上方）；本世界 3 root 的 team_domain 记录（`state` 快照 `tests/mock/.dsh-home/storages/team_domain.json`）；T1.2 三次点击 typed-error 截图。

## P2 前置发现 — FINDING（F2：非 directive root 冷恢复后丢失 leader 面；仅记录）
**场景**：宿主重启后（directive root = 新 root），在 UI 会话树点开旧 root（`session-dtestmtqz76ah1039`，1 turn，dtest-bp）→ Team tab 渲染持久化团队视图（"leader · 1 活跃 / 运行中"）→ 在对话 tab 向"leader"发送 T2.1 探针（`请使用 team_list_templates…`）。
**实测**（durable log 为 ground truth，`session-dtestmtqz76ah1039/session.jsonl.zstd` 338 行）：
- `TOOLS[0]`（重启前、root 为 directive root 时的首轮）：count=11 team_*=10 mcp__*=1 — **leader 面** ✓（与 T1.2 leader 面实测一致）
- `TOOLS[1]`（重启后、经 UI 冷恢复的第二轮）：count=27 team_*=0 mcp__*=1 — **标准 base 面**（26 base + mcp__dtesthttp__ping），**无任何 team_***
- 模型如实报告"无法按要求完成"（无 team_list_templates 工具可用），5 步内含 Grep 等 base 工具探索；UI 团队视图仍显示持久化的 "leader · 1 活跃 / 运行中"（**陈旧的持久化状态**，与实际 agent 面不符）。
**结论（记录为止）**：宿主重启后，**非 directive root 的团队 root 经 UI 按需冷恢复时，其会话以标准 base 面运行（leader 面/团队绑定丢失）**；团队 UI 展示的是持久化 team_domain 状态（活跃数等），与实际 agent 工具面脱节。旧 root 因此**不能**作为 P2–P6 的运营团队。
**对 P2–P6 的含义**：运营团队必须 = 当前 directive root（`session-dtestmtr0i8cxb3de`，live、leader 绑定在 row 管理下）；其 leader 的可达路径尝试：mock 工作区 hero 绑定（见下）。
**截图**：`screenshots/p2-oldroot-baseface-turn.png`。

## P2 进展（运营团队 = directive root `session-dtestmtr0i8cxb3de`）
**交付通道发现（世界操作，非诊断）**：UI 无法向零 turn 的 live directive root 的 leader 投递 turn（无树条目；team-mode open = G1 no-op；mock 工作区"新建会话"现绑定空白标准会话）→ 改用 **DSH 公开通道 `POST /api/session/prompt`**（`type:client-request / method:session/prompt / payload.args.request{sessionId, mode:'queue', content:[{type:'text',text}]}`，鉴权 = boot token 重放 303→cookie，cookie 存 `state/cookie-header.txt`）——与仓库 harness 脚本（t12-vertical/g5/d4）同一公开面。
**T1.4 余项（directive root 承载）— PASS**：
- 首 turn 后原生树条目出现（"未分组"组下，"已完成 请使用 team_list_templates… 刚刚"）；
- team 视图内 "以 Team 模式打开 / 回到 Leader" 点击后 badge 实测：`data-team-mode-badge data-open-mode=team` ✓；
- leader 面（首 turn 即零 turn root 的首个请求）：`TOOLS[0] count=11 team_*=10 mcp__*=1`（10 team_* + mcp__dtesthttp__ping，无 base）✓。
**T2.1 team_list_templates — PASS**：leader turn1 调用 `{rootSessionId, requestToken:'list-templates-20250101-001'}` → `effect.kind=templates-listed`，模板 = leader(displayName 空) / worker("DTest Worker") / collector("DTest Collector")，均 contextPolicy=persistent。
**T2.2 team_create_member ×2 — PASS**：
- W1 = worker → `member-activated instanceId=inst-0lhyinm0h9iu childSessionId=session-team-child-abaa6fd6711921efd38e33fb09399cf6`
- W2 = collector → `member-activated instanceId=inst-00s3rtd0gx5f childSessionId=session-team-child-a5e31e6c53c7aefdba3c2e284b535f38`
- team_list_members 复核：lifecycle=CREATED（创建后未工作）；确定性 instance id 待 P5 重启复核。
- **W1 首请求 identity 块**（子会话 request/context 系统提示词原文）：`[team-member-context rootSessionId="session-dtestmtr0i8cxb3de" instanceId="inst-0lhyinm0h9iu" role="member"]` + fresh-requestToken 规则行 ✓；worker persona 逐字安装 ✓。
**T2.3 team_delegate → W1 首工作 — PASS**：work/alpha.md 落盘 `tests\mock\work\alpha.md`（93 bytes，哨兵逐字 = fixtures/sentinel.txt）✓。
**W1 成员面 — PASS**：`TOOLS[0] count=37 team_*=10 mcp__*=1` = 26 base + 10 team_* + mcp__dtesthttp__ping；**无 mcp__dtest-mini__ping**（fail-closed 默认，T3.1 双轨对照之一）✓。
**旁证**：W2 子会话日志（763 行 W1 / a5e31e6c… W2）已生成；W1 4 次 tool/call（文件写入流程）。

**T2.4 team_follow_up W1 — PASS**：follow_up effect `work-admitted, fromLifecycle:SETTLED, memberResult:{requestToken:'followup-w1-alpha-append-…', status:'succeeded', body}`；alpha.md 追加第 2 行 `W1-FOLLOWUP-APPEND-OK`（哨兵行保留）；W1 第二 turn 在同一 child session（guarded continue）✓。
**T2.5 team_send_message leader→W2 — PASS（wire 形态与计划文案不符 → OBS）**：
- 实测 send-message 返回：`{status:"delivered", action:"send-message", callerRole:"leader", recipientInstanceId, deliveryMode:"direct", deliveredToInstanceId, deliveredToSessionId, factSequence:11, deliveredSequence:12, requestToken}` —— **不是** `memberResult:{requestToken,status,body}`；
- `memberResult:{requestToken,status:"succeeded",body}` 形态实测出现在 **delegate / follow_up 的 work-admitted effect**（T2.3/T2.4 已摘）——计划 T2.5 文案把该形态安错了工具（OBS，仅记录）；
- W2 子会话日志实证收到：`from=…-leader (label: leader) to=inst-00s3rtd0gx5f (label: W2) | subject=询问当前工作目录绝对路径 | 请逐字报告…`，W2 turn1 执行（1 tool/call）✓。

## P2 前置发现 — FINDING（F3：member team_report_progress 工具调用无限挂起 → 团队 root 死锁；仅记录）
**触发**：T2.6 探针（leader follow_up 指示 W1 连续两次 team_report_progress：in-progress → done）。
**实测时间线**（UTC）：09:47:07.471 W1 发出 `team_report_progress`（progress=in-progress, token w1-progress-001-inprogress-20250101, seq 2424）→ 之后 **无任何 tool/result**；至 09:55:39（约 8.5 分钟）W1 log 末行仍为该 call，turn 3 未 end；ROOT log 末行 09:47:03.855（turn 6 = 本次 follow_up leader turn，等 W1 settle，未 end）；`team_domain.json` LastWriteTime 停在 17:47:04 本地（09:47:04Z）；UI "活动与进度"=暂无、"团队事件"=暂无；树条目 "[team-work requestToken=delegate-w1-alph…" 状态"进行中"；team dock "1 运行中"。
**结论（记录为止）**：member 的 `team_report_progress` 调用**既无工具返回、也无 ledger fact、也无 team_domain 更新** → member turn 永久挂起；leader 的 follow_up turn 等待 member settle → **整个 root 死锁**（后续 mode:queue 的 leader 提示全部排队不执行；团队 UI 显示"运行中"但无任何进展）。
**恢复动作（世界操作）**：重启宿主（boot#2，同 root `session-dtestmtr0i8cxb3de`）解除挂起；该重启同时作为 P5 T5.2（同 root 重启）的预演数据（确定性 instance id 复核点：W1=inst-0lhyinm0h9iu / W2=inst-00s3rtd0gx5f 应跨重启不变）。
**boot#2 实测**：`boot=2 phase=resume`；liveSessions = root + 两个 member child（全部重水化）；**instance id 跨重启确定**（team_domain.json：inst-leader / inst-0lhyinm0h9iu / inst-00s3rtd0gx5f 与重启前完全一致）✓（P5 预演数据点）。
**F3 复现 #2（boot#2 后，T2.6 重试）**：
- 重试1（progress=done，非法值）→ 立即返回 typed `TEAM_TOOL_BAD_ARGUMENTS: argument 'progress' must be one of in-progress | completed | blocked`（**参数校验路径正常返回**；计划文案 "done" 亦为计划用词偏差——合法枚举是 in-progress/completed/blocked）。
- 重试2（progress=completed，合法值）→ W1 于 10:02:24.787Z 发出 call（token w1-progress-completed-20250101-001）→ **再次无 tool/result**，至 10:10:14（约 8 分钟）W1 末行仍为该 call，turn 5 未 end；ROOT turn 8 未 end → **root 再次死锁**（与 F3 #1 同拓扑）。
**F3 精确指纹（记录为止）**：`team_report_progress` **参数非法 → 立即 typed 拒绝；参数合法（提交 ledger 的路径）→ 无限挂起**；两次发生均在 leader follow_up/delegate turn 等待 member settle 期间（work-admitted effect 携带 settled+memberResult = leader 工具调用同步等待 member settle）。**推论（仅记录，不再诊断）**：activity ledger 提交与 leader 工作准入关键区在同一 per-team 串行链上互相等待。
**恢复动作 #2（世界操作）**：boot#3（同 root，label p2-restart2）。
**F3 复现 #3（boot#3 后，delegation 新工作 turn 内首动作）**：W1 turn 6 第一动作 `team_report_progress`（progress=in-progress，合法值，新 token w1-beta-inprogress-20250101-001）@ 10:14:11.601Z → 4 分多钟无 tool/result、work/beta.md 未创建（挂起发生在文件工作之前）、turn 6 未 end → **挂起绝对化**：三种上下文（follow_up turn ×2、delegation 新工作 turn ×1）中，合法 progress 提交一律挂起。
**F3 最终指纹（记录为止）**：`team_report_progress` = 参数非法 → 立即 typed `TEAM_TOOL_BAD_ARGUMENTS`（校验路径正常）；参数合法（提交 ledger 路径）→ **无限挂起**（3/3 复现）。每次挂起都伴随 leader 侧 delegate/follow_up 工具调用同步等待 member settle（work-admitted effect 含 settled+memberResult）。
**T2.6 状态**：blocked-by-F3（仅记录，按用户裁决不修复）——"进度事实落 ledger + UI 活动与进度显示"无法经团队流程验证（每次尝试都会死锁 root）。已验证部分 = 工具面可达（member 面 10 team_* 含 team_report_progress）+ 参数校验 typed 拒绝 + 挂起指纹 3/3。
**运营约束（本世界内）**：不再指示 member 调用 team_report_progress（必然死锁）；后续重启均以同 root 恢复。
**恢复动作 #3（世界操作）**：boot#4（同 root，label p2-restart3）。

**T2.7 team_list_members — PASS**：members-listed 与实况一致（W2 collector CREATED / W1 worker RUNNING / leader；childSessionId 均匹配）。OBS：W1 lifecycle=RUNNING 跨重启残留（挂起工作的域状态未随宿主重启归位）。
**T2.8 team_inspect_config — PASS**：`config-inspected effective: {model,tools,permissions,skills,mcp 均 kind:"deny"}` = W1 实例无定向覆盖（与 blueprint 未定义 per-member override 的真值一致）。
**T2.9 错误矩阵**：
- a. label 寻址 → `TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED`（"target 'W2' is a member label — actions are addressed by instanceId only (invariant 19)"，details 含 kind:member-label + 解析出的 instanceId）✓ 零副作用
- b. 缺参 → `TEAM_TOOL_BAD_ARGUMENTS`（"required argument 'delegationTemplateId' is missing"，details.field）✓ 零副作用。超长 label 变式未测：leader 面无 base 工具无法构造 10000 字符参数，模型尝试自行计数拼串耗尽 turn（仅 1/2 调用）——记 MODEL-NONCOMPLIANCE（非 FAIL）
- c. token 复用 → **OBS（与计划文案偏差）**：读操作（list-members）复用 token 照常执行（不消费）；**变更操作（create-member）复用已消费 token = 幂等重放**（`replayed:true`，返回原始 W1 的 member-activated effect，未新建成员，零副作用）——比"拒绝"更强的保证
- d. follow_up 已归档成员 → `{status:"blocked", reason:"target-stale"}`（typed，零副作用）✓
- e. 标准会话无 team_* → 已由 T1.3 覆盖 ✓
**T2.10 archive/restore（UI lifecycle surface）— PASS**：
- 首次归档（W2 处于 CREATED）→ UI 内联 typed 拒绝（bonus 错误矩阵数据）：`LIFECYCLE_ILLEGAL_STATE: lifecycle state 'CREATED' forbids this operation: illegal lifecycle transition 'CREATED' -> 'ARCHIVED' (Architecture §29 FSM; legal targets from 'CREATED': [RUNNING, DISPOSED]); operation 'ARCHIVE' is legal only from [SETTLED]`
- W2 先行工作 settle（gamma.md 落盘，domain=SETTLED）后：页面 reload 同步 UI 状态"已结算"→ 归档 → **domain=ARCHIVED** + UI"已归档" + 行内操作收窄为 恢复/处置（不再出现 发送任务/跟进/消息）✓
- 归档期间 leader follow_up → blocked target-stale（T2.9d）✓
- UI 恢复（无确认对话框，直接执行）→ **domain=SETTLED**（回到归档前状态）+ UI"已结算" ✓
**活动账本（UI "团队事件"）**：完整 fact 时间线渲染 = provision-member-instance #1/#2（含 workspace 绝对路径）、team-work-admitted #3/#7/#13/#15/#19（caller/delegate/follow-up 全字段）、活动开始/结束（interval-close, reportedByInstanceId=team-runtime）、member-lifecycle-changed（RUNNING→SETTLED）、send-message（factSequence/deliveredSequence）。**无 team_report_progress fact**（与 F3 一致：提交从未落账）。
**T2.11 第 5 成员 quota — FINDING（F4，定稿：quota 语义 = per-template，非全局；机制本身生效）**：
- blueprint 真值 `quotas.members.maxInstances: 4, maxConcurrent: 4`；
- 实测：W3(worker)/W4(collector)/W5(worker) **全部创建成功**（inst-0vuc6w41d0yw / inst-0pnmli30ho9i / inst-1pl2sim0f5ku）——"全局第 5 成员拒绝"（计划 T2.11 文案的预期）**未出现**；
- 消歧探针：W6(worker) → **executed**（inst-0zi6u2l1yh41，worker 达到 4 个）；W7(worker) → **rejected** `code:TEAM_RUNTIME_QUOTA_EXCEEDED_TEMPLATE_INSTANCES`，message=`activation: member quota maxInstances=4 exhausted for template 'worker' (current+reserved=4, +1 requested)`，details={source:"activation-provider", providerCode:"ACTIVATION_QUOTA_MEMBER_MAX_INSTANCES", templateId:"worker", maxInstances:4, current:4} ✓ typed 拒绝、零副作用；
- **结论**：`members.maxInstances` 按**模板**执行（每个 member template 各限 4 实例），非全队总量上限；计划 T2.11 文案按全局语义写错预期（OBS，仅记录）。世界现态：6 成员（W1 worker·RUNNING 残留 / W2 collector·SETTLED / W3 worker / W4 collector / W5 worker / W6 worker，均 CREATED 或域状态残留）。

## P3 进展（MCP facet + 治理）
**T3.1 facet 初始态（fail-closed）— PASS**：W2 成员面两次 turn 均 `TOOLS count=37 team_*=10 mcp__*=1`（= 26 base + 10 team_* + mcp__dtesthttp__ping；**无 mcp__dtest-mini__ping**）；W1 同（T2.3 已测）。双轨对照成立：宿主级 dtesthttp 在、facet dtest-mini 默认拒绝（mcpServer 已配置但持久策略未 allow）。
**T3.2 GUI override（W2, mcp/allow/dtest-mini）— PASS**：
- 团队 tab 治理区 → per-member override 编辑器（生效配置 per-instance 卡片：W2/W1/W3–W6 各一，capability 下拉 model/tools/permissions/skills/mcp + kind 允许/拒绝 + 条目 textbox + 查看/设置/重置覆盖）；选 W2 → capability=mcp、kind=允许、条目=dtest-mini → 设置覆盖；
- UI 即时状态：W2 卡片显示 `mcp: allow dtest-mini` / 出处 **explicit-human-override** / 状态 **Pending next boundary**（下一边界生效——与 T3.3 预期一致）；
- durable：team_domain.json override 记录 `recordId=ovr-mcp-inst-00s3rtd0gx5f-g0, kind=human-override, scope=instance, generation=1, values={mcp:{items:["dtest-mini"],kind:"allow"}}, updatedAt=10:39:52Z` ✓；
- 兼容性"代数 1"未因 override 变化（代数 = 兼容性探测代数，非 override 版本——计划文案"generation +1"措辞 OBS，override 自身有 generation 字段=1）。

**T3.3 下一边界挂载 + 调用 — PASS**：W2 override 后的下一 turn `TOOLS[2] count=38 mcp__*=2`（dtest-mini 挂载，diff 恰 +1）；模型调用 `mcp__dtest-mini__ping` → 工具结果 `pong:connectivity-check`（durable tool/call+result）✓。**per-instance 作用域**：同批 W3（新 worker，delegate 建 work/delta.md=W3-DELTA-OK）`TOOLS[0] count=37 mcp__*=1`——无 dtest-mini ✓。
**T3.4 卸载（deny）— PASS**：UI kind=拒绝 设置覆盖 → 域记录 g0(allow) 保留 + 新增 **g1 `{mcp:{kind:"deny"}}`**（override 记录 generation g0→g1 ✓ 历史记录保留）；UI"mcp: deny / explicit-human-override / Pending next boundary"；W2 下一 turn `TOOLS[3] count=37`（dtest-mini 消失）✓。
**T3.5 重置 — PASS（语义与计划文案不同 → OBS）**：UI 重置 = **丢弃当前 override 记录、回退到上一条记录**（undo 栈语义）：第一次重置去掉 g1(deny) → 生效值回到 g0(allow dtest-mini)（UI 显示 allow / Pending next boundary；域=g0 单记录）；第二次重置 → **0 记录**，页面 reload 后 W2 卡片能力全部 **Inherited**（base 层重算，无 mcp allow）✓。OBS：计划 T3.5 文案假设 reset 直接回到"未 allow"，实测为逐条回退（需 N 次 reset 回到 base）。t5（reset 后）的 per-turn tools 数组未再落 log（每 turn 上下文仅首次落盘——log 格式 OBS）；t5 面由域真值（0 记录=base）+ 已建立的"记录→挂载"因果链（无记录→37 / allow→38 / deny→37）覆盖。
**T3.6 hard-policy 展示 lane — 部分验证（空态）**：本 boot 无外部 facts → 治理区无 hard-policy lane 内容渲染（无外部硬限制呈现）✓；"override 不得显示为压过 hard policy"的完整契约核查延至 P4 boot#5（T4.7b，外部 facts 在场时）。OBS：策略块"审查"按钮 playwright click 两次超时（UI 交互问题，不影响断言）。
**T3.7 宿主级 MCP 三类会话 — PASS**：leader（turn 20 直接调用）/ W1（follow_up）/ W2（follow_up）各调一次 `mcp__dtesthttp__ping` → 三类会话全通（durable log 各 1 次 call + pong）✓。W1 在域状态 RUNNING（挂起残留）下 follow_up 正常执行（再次印证 F3 挂起 = progress 提交路径特有）。
**T3.8b 运行中 kill/reconnect — PASS（先扩展了 scaffold 拓扑）**：
- 前置发现：boot#4 的两个 mini-MCP 为 **boot 进程内监听**（3491/3492 同属 boot PID；3181 为宿主子进程 PID）→ 计划 T3.8b"独立 kill mini"在进程内拓扑下不可执行。扩展（tests/mock 自有 scaffold，不涉仓库代码）：新增 `scripts/mini-standalone.mjs`（独立进程跑 startMiniMcpServer）+ boot.mjs 新开关 `MOCK_EXTERNAL_MINIS=1`（外部进程模式，默认行为不变）；smoke test 3495 通过（initialize 200 + pong:smoke）。
- boot#4b（label p2-restart4，同 root，EXTERNAL_MINIS=1）：facet pid=15220 / host pid=35248，7 live sessions 全恢复，4 行 mounted。
- **Part A（宿主行 3492）**：kill mini#2 → 宿主 health 持续 ok（无 crash）→ leader turn21 调 `mcp__dtesthttp__ping`(msg=t38b-down) → 工具结果 `isError:true` 原文 `Error: fetch failed`（模型逐字报告、未重试）✓；重启 mini#2（mini-standalone，新 pid）→ leader turn22 再调 → **`pong:t38b-recovered`** ✓ —— dsh-mcp-client 连接监督自动重连、工具"短暂不可用后恢复"、宿主零重启。
- **Part B（facet 3491）**：先经 GUI 重设 W2 mcp/allow/dtest-mini（新 g0 记录 11:09:23）→ kill mini#1 → leader turn23 `team_follow_up`(W2) → 工具结果**类型化拒绝**（非挂起、非崩溃）：`status:rejected` / `code:TEAM_RUNTIME_WORK_DELIVERY_FAILED` / `message:TeamRuntime: work delivery to 'session-team-child-a5e31e…' of 'inst-00s3rtd0gx5f' failed: mcp-client(dtest-mini): initial connection or tool synchronization failed` / details.requestToken=followup-w2-mini-facet-down-…；**域账本落 fact** `workOutcome:"delivery-failed"`（sequence 56，to:SETTLED）；W2 无新 turn（工作在投递门被拒，未进入成员 turn）；leader 逐字段忠实报告 ✓。OBS：计划文案"activation error 记录"实测形态 = 类型化投递失败工具结果 + 账本 delivery-failed fact（无独立 activation-error 记录对象；宿主 instance log 142B 无运行期 facet 错误行）。
- 重启 mini#1（mini-standalone，新 pid）→ W2 下一 turn（t6）：**facet 于下一边界自动重新挂载**（override allow 仍生效），`mcp__dtest-mini__ping` → **`pong:t38b-facet-recovered`**（isError:false）✓。
**P3 完成小结**：T3.1–T3.8b 全 PASS（T3.5 语义 OBS：reset=逐条回退 undo 栈；T3.6 空态部分验证，facts 在场核查延至 P4/T4.7b；T3.8b 需 scaffold 拓扑扩展才可执行）。

### P4 前置发现与 scaffold 调整（记录不修复）
- **F6（OBS + scaffold 调整）**：dtest-bp 蓝图的 member envelope（worker/collector）allow 仅 `[send-message, report-progress]`，**不含 `request-control`** → 计划 P4 全部 control 流（T4.1–T4.7）前提不成立。实测证据（envelope 门 fail-closed 本身验证通过）：W1 turn8 `team_request_control` → 类型化拒绝 `TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS`，details `{action:"request-control", op:"request-control", requiredOps:["request-control"], inBounds:["send-message","report-progress"]}`，零副作用，模型忠实停止并报告。工具面 10 个 team_* 含 `team_request_control`/`team_resolve_control`（可见≠可执行，envelope 门在执行层）。调整（tests/mock scaffold，boot.mjs 蓝图源）：worker/collector envelope allow += `request-control`；teamEnvelope allow += `resolve-control`。
- **F7（产品不变量，记录）**：团队绑定**不可变蓝图快照**（content hash）。boot#4c 重启后（蓝图源已改、revision 仍 "1"）首次 work-admission → 类型化拒绝 `TEAM_RUNTIME_BLUEPRINT_HASH_MISMATCH`："blueprint 'dtest-bp' revision '1' content hash does not match the bound snapshot ref (the snapshot is immutable)"，details 含 boundContentHash sha256:5556ccb7… vs resolvedContentHash sha256:53c9d4d2…。**语义：已绑定团队的蓝图内容不可中途变更（快照不可变）；envelope 变更只对按新快照创建的新团队生效**。零副作用、typed、leader turn 正常结束。
- **F9（产品缺口，记录；T4.1 allow 半程不可执行的根因）**：当前产品**无人类裁决 user-approval 请求的通道**——(a) 客户端（composition-shim client-bundle + src/ui）对 control request 仅有只读展示：member card `data-member-waiting` badge（"N 项待裁决"）、TeamDock 计数（"1 待裁决"）、TeamLedger 行（"等待裁决" badge）；`InstanceRow` nav 按钮仅切会话，action 簇仅 lifecycle 命令；(b) 宿主 remote 方法闭集 = team.create / admitInitialWork / ensureRootLive / listRoots / getProjection / getLedgerPage（s6-remote.ts）——无 control resolve 方法；(c) `team_resolve_control` 工具 `caller: ctx.caller`（恒为调用方 instance），无 human caller 参数；`user-approval → ['human']`（CONTROL_RESOLVER_ROLES，types.ts L94-98）意味着该 kind 仅 human 可裁决。→ 计划 T4.1 的"详情面板 + 用户点 allow"在现产品不可实现；pending user-approval 请求在本世界内永不可裁决（leader 尝试 = T4.2 的被拒场景）。**未做任何修复**（用户裁决：仅记录）。
- **F8（产品数据模型语义，记录；亦是 scaffold 配错根因）**：`packages/runtime/admission/envelope.ts` —— 成员**有效 envelope = teamEnvelope.allow ∩ memberTemplateAllow**（减 deny，再减 instance autonomy overlay）。仅给 member 模板加 `request-control` 无效：团队 allow 不含该 op 时被交集裁掉。实测：dtestp4 新团队（新快照 53c9d4d2，member allow 含 request-control，team allow 不含）→ W1' `team_request_control` 仍 `ENVELOPE_OUT_OF_BOUNDS`，`inBounds:["send-message","report-progress"]` = 交集结果。修正：teamEnvelope.allow 同时 += `request-control`（+`resolve-control`；member 模板 += `resolve-control` 以便 T4.6 到达 invariant 37 而非被 envelope 先行拒绝）。产品行为本身一致且 fail-closed，无缺陷。
- **F3 再发（第 3 次，新上下文）**：dtestp4 W1' 收到 envelope 拒绝后，模型自行决定调 `team_report_progress`（step 3，11:44:46）→ **再次无限挂起**（无 tool/result、无 turn/end、成员永不 settle）→ leader turn2 的 `team_follow_up` 同步等待 → **root 二次死锁**（11 分钟无新事件）。印证 F3 挂起不限于显式指令，凡成员在 work-unit 内发起合法枚举 progress 提交即触发。恢复 = 重启同 root（本次直接换新 root，见下）。
- **路径变更（世界重建，非产品修复）**：旧团队（root session-dtestmtr0i8cxb3de）冻结于旧快照 → P4/P5/P6 改在**新团队**执行：boot#5 新 root `session-dtestp41011041031171125012199120102`（W1'=inst-05lerpm0ydqe / W2'=inst-05bf60n0ynq0）→ 因 F8 配错 + F3 挂起 → dtestp4 亦弃用；**boot#6 再建新 root `session-dtestp61051185350112102111120115117`（label p6-final）为 P4–P6 运营团队**（teamEnvelope.allow 含 request-control+resolve-control；W1=inst-1yabcoe00jed / W2=inst-0zb3tna1drgr）。旧团队全部前期证据（T1–T3）继续有效并引用。

### P4 进展（boot#6 新团队）
- **T4.1 user-approval 全链路 — 请求半程 PASS / allow 半程 BLOCKED-by-F9**：
  - 提示词（leader follow_up 逐字传达）：W1 需在 `D:\AgentDev\dsh-plugins\dsh-agent-team\tests\mock-outside\probe\probe-w1.txt` 创建文件（内容 W1-PROBE-OK），工作区外 → 必须先 `team_request_control`（kind=user-approval）；未批准不得写。**防 F3 挂起附加约束**："本轮禁止调用 team_report_progress 工具（直接以文本报告即可）"（运营性约束，已记录）。
  - 请求 wire 形态（W1 durable log tool/call 12:02:56.685Z + tool/result 12:02:56.889Z）：`team_request_control {rootSessionId, requestToken:"w1-probe-ctrl-001", kind:"user-approval", targetInstanceId:"inst-1yabcoe00jed", actionName:"write: create file D:\...\probe\probe-w1.txt (content: W1-PROBE-OK)", ...}` → 返回 `{"status":"control-requested","request":{"requestId":"ctrl-064wd6o1ft4y810lq7zvy07u","kind":"user-approval","requester":{"kind":"instance","instanceId":"inst-1yabcoe00jed","role":"member"},"targetInstanceId":"inst-1yabcoe00jed","correlation":"w1-probe-ctrl-001","status":"pending","createdAt":"2026-09-07T12:02:56.888Z","requestSequence":73,"toolName":"write","summary":"Business reason: W1 workspace-boundary probe — ..."}}` —— **admitted，status=pending**（envelope 修正后生效）。
  - W1 行为合规：未执行写操作（无 write tool/call），turn 正常结束（turn/end completed 12:03:03），成员 RUNNING→SETTLED（ledger：activity-interval-close progress=completed + member-lifecycle-changed to=SETTLED workOutcome=settled）。
  - UI 呈现（playwright，boot#6 BOOT_URL token yLCtM7…）：Team tab 成员卡 W1（DTest Worker 组）状态按钮 `已结算 暂无动作 1 项待裁决`（badge `data-member-waiting`）；TeamDock `团队 1 运行中 · 1 待裁决`；Team Events 行 `20:02:56 控制请求 W1 write: create file …probe-w1.txt (content: W1-PROBE-OK) · write · Business reason: …` + `等待裁决` badge。详情数据（requester/kind/operation/reason/time/status）均可见于事件行与请求载荷。
  - **allow 半程不可执行（F9）**：遍查客户端（无 decision 提交 UI：InstanceRow 仅 nav+lifecycle 命令；LedgerRow 仅 onSelect 切会话；Governance 仅 override/policy 命令）与宿主 remote 方法闭集（无 control resolve）；`team_resolve_control` 仅接受 instance caller。→ "用户点 allow → 真实 tool call" 在当前产品不可实现；**仅记录，不修复**。该 pending 请求转为 T4.2 的输入（leader 尝试 resolve → 预期角色闭包拒绝）。
- **F10（产品架构语义，记录）：last-mile guard 的作用面 = team work 操作，不是 base 工具**。`packages/tools/src/guard.ts`（SD-GUARD）：`executeGuarded` 仅包裹 4 个受管 team 工具——`team_delegate`(action=delegate) / `team_follow_up`(action=follow-up) / `team_send_message`(action=send-message) / `team_report_progress`(action=report-progress)，且仅当 targetInstanceId 为合法 instance id 时。guard scope = {root, targetInstanceId, actionName, toolName, **correlation=该 team 工具调用的 requestToken**}；`team_request_control` 的 requestToken 即 correlation（"ties the request, the decision, and the later guarded execution to ONE logical operation"，tools.ts L826-827）。**verdict 语义**：`allowed`→执行且 **CONSUMED**（check-and-reserve，exactly-once）；`no-request`→**放行**（该 scope 无持久请求 = 控制面无闸，继续走 runtime facade 的 identity/authority/envelope/quota——文档化偏离 P6-T4 的 blanket block，保 leader 日常自治路径）；其余 reason（request-pending / decision-deny / request-stale / allow-consumed / scope-mismatch / target-stale）→ fail-closed `{status:"blocked", reason, requestId?, decisionSequence?}`，runtime 永不被调用、零副作用。base 工具（write 等）不经过该 guard（宿主 file sandbox 是独立前置闸）。
- **T4.2 resolver 角色闭包（user-approval）— PASS**：leader `team_resolve_control {requestToken:"dtest-t42-leader-resolve-1", requestId:"ctrl-064wd6o1ft4y810lq7zvy07u", decision:"allow", note:"leader tries user-approval"}`（root turn3，12:12:52.672→52.723，51ms）→ 类型化拒绝 `{"status":"rejected","code":"CONTROL_RESOLVER_NOT_AUTHORIZED","message":"ControlService: role 'leader' is not a resolver for kind 'user-approval' (allowed: [human])","details":{"requestId":"ctrl-064wd6o1ft4y810lq7zvy07u","kind":"user-approval","role":"leader","allowedRoles":["human"]}}` —— 角色闭包先于 envelope 生效（leader 的 envelope 已含 resolve-control 仍被拒）。零副作用：无 decision fact（control-decision-recorded=0）、probe-w1.txt 不存在、请求仍 pending。turn 正常结束。
- **T4.3 leader-approval — PASS（全链路 + 文件落盘）**：
  1. W1（t2）`team_request_control {requestToken:"w1-leader-approval-001", kind:"leader-approval", targetInstanceId:"inst-1yabcoe00jed", actionName:"write: create file …probe-w1b.txt (content: W1-LEADER-OK)", toolName:"write"}` → `control-requested` **ctrl-0agrtlw1xck6vr1ypk3bq0l2** pending（12:14:55.070，requestSequence 78）。
  2. leader（t5）`team_resolve_control {decision:"allow", note:"leader approves boundary probe w1b"}` → `{"status":"control-resolved","decision":{"requestId":"ctrl-0agrtlw1xck6vr1ypk3bq0l2","decision":"allow","decider":{"kind":"instance","instanceId":"inst-leader","role":"leader"},"scope":{"targetInstanceId":"inst-1yabcoe00jed","actionName":"write: create file …(content: W1-LEADER-OK)","correlation":"w1-leader-approval-001","toolName":"write"},"decisionSequence":81,"note":"leader approves boundary probe w1b"}}` —— 角色闭包通过（leader ∈ [leader,human]）。
  3. W1（t3）执行写入：第一次 `write` → 宿主 sandbox `Error: [sandbox: file access denied under workspace-write mode]`（成员会话默认 file policy = workspace-write，宿主级闸先于团队 guard，见 F10）；模型重试 `write` 带 `sandbox_permissions:"danger-full-access"` + justification → **DSH 审批提示出现**（T4.8 面：会话树项改题"等待审批"；审批详情 group = "escalate sandbox to danger-full-access: Leader-approved out-of-bounds write (control request ctrl-0agrtlw1xck6vr1ypk3bq0l2, correlation w1-leader-approval-001) requires access beyond the workspace-write sandbox."；按钮 拒绝/允许一次）。
  4. **用户点"允许一次"** → 写入成功：`tests\mock-outside\probe\probe-w1b.txt` 落盘，内容逐字 = **W1-LEADER-OK**（磁盘 ground truth + W1 trajectory write result 文件确认 + W1 自读校验，turn 正常结束 12:26:11）。
  - OBS（guard 未消费）：domain `control-allow-consumed` = 0 —— 本次执行的物理路径是 base `write` 经宿主 sandbox 升级放行，不经过 team guard（F10：guard 只包 team work 操作）；durable allow 仍保留未消费。**guard 消费/exactly-once 路径在 T4.5 用受管 team 操作（follow-up + 同 correlation requestToken）实测**。
- **T4.4 deny 路径 — PASS（typed + 零副作用）**：
  1. W1（t4）`team_request_control {requestToken:"dtest-t44-deny-correlation", kind:"leader-approval", targetInstanceId:"inst-1yabcoe00jed", actionName:"follow-up", toolName:"team_follow_up", summary:"T4.4 deny path gate"}` → **ctrl-1ex2uvz124kelo0o103v11o4** pending（12:28:09.652，requestSequence 88）。
  2. leader（t8）`team_resolve_control {decision:"deny", note:"leader denies T4.4 gate"}` → `{"status":"control-resolved","decision":{"requestId":"ctrl-1ex2uvz124kelo0o103v11o4","decision":"deny","decider":{"instanceId":"inst-leader","role":"leader"},"scope":{...,"correlation":"dtest-t44-deny-correlation"},"decisionSequence":91}}`。
  3. leader（t9）`team_follow_up {requestToken:"dtest-t44-deny-correlation", targetInstanceId:"inst-1yabcoe00jed"}`（同 tuple + 同 correlation）→ **43ms 类型化阻断** `{"status":"blocked","toolName":"team_follow_up","correlation":"dtest-t44-deny-correlation","reason":"decision-deny","requestId":"ctrl-1ex2uvz124kelo0o103v11o4","decisionSequence":91}` —— guard fail-closed，runtime 永不被调用：W1 durable log 无新 turn（仍止于 t4 12:28:12），零副作用 ✓。
- **T4.5 exactly-once — PASS（消费 + 第二次 BLOCKED/consumed）**：
  1. W1（t5）请求（同 T4.4 形态，correlation **dtest-t45-once-correlation**）→ **ctrl-0uo9g0p0woqd4u0bqizmn182** pending（requestSequence 94）。
  2. leader（t11）allow → decisionSequence 97。
  3. leader（t12）**第一次** `team_follow_up {requestToken:"dtest-t45-once-correlation"}` → `{"status":"executed","action":"follow-up",...,"effect":{"kind":"work-admitted","fromLifecycle":"SETTLED","sequence":99,"settled":true,"settledSequence":102,"memberResult":{"requestToken":"dtest-t45-once-correlation","status":"succeeded","body":"OK"}}}` —— **guard CONSUMED**：domain 新 fact `control-allow-consumed`（seq 98，12:43:39.626，`{decisionSequence:97, requestId:"ctrl-0uo9g0p0woqd4u0bqizmn182", scope:{actionName:"follow-up",correlation:"dtest-t45-once-correlation",...}}`）。
  4. leader（t13）**第二次** 同 tuple + 同 correlation → **42ms** `{"status":"blocked","toolName":"team_follow_up","correlation":"dtest-t45-once-correlation","reason":"allow-consumed","requestId":"ctrl-0uo9g0p0woqd4u0bqizmn182","decisionSequence":97}` —— check-and-reserve 语义成立，W1 无新 turn、零副作用 ✓。
- **T4.6 自升级禁止（invariant 37）— PASS**：W1（t7）先发起自己的 pending 请求（correlation dtest-t46-self-resolve-correlation → **ctrl-1rep75m0mgx4b10hjkvyg0ei**，actionName send-message），随即以 `team_resolve_control {requestToken:"dtest-t46-self-resolve-1", requestId:ctrl-1rep75m0mgx4b10hjkvyg0ei, decision:"allow", note:"W1 self-resolve attempt"}` 裁决**自己的**请求 → 类型化拒绝 `{"status":"rejected","code":"CONTROL_RESOLVER_NOT_AUTHORIZED","message":"ControlService: role 'member' is not a resolver for kind 'leader-approval' (allowed: [leader, human])","details":{"role":"member","allowedRoles":["leader","human"],...}}` —— **member 的 envelope 已含 resolve-control op 仍被拒**：角色闭包先于 envelope（invariant 37 原文语义）。零副作用（请求仍 pending；该残留请求已由 leader deny 清理，domain 现 5 requests / 4 decisions / 1 consumed，仅 T4.1 user-approval 因 F9 永驻 pending）。
- **T4.8 DSH approval lane — 环境注记（非 fail）**：host file policy 非 permissive（成员会话默认 `workspace-write`，session_projcache `sandboxMode.val="workspace-write"`）。T4.3 中 W1 的越界 `write` 升级（`sandbox_permissions:"danger-full-access"`）**确实触发 DSH 审批提示**：会话树项改题"等待审批"、会话内"审批详情" group（逐字 escalate 说明 + control request id）、按钮 `拒绝`/`允许一次`；用户点"允许一次"后操作放行、文件落盘。**即：因 host 策略非 permissive，走的是"出现审批提示"分支（而非计划的"permissive → 无提示"分支）——审批 lane 功能实测有效**。此为本 mock 环境实际形态的记录，非缺陷。
- **P4 小结（boot#5/6，无 hard）**：T4.1 请求半程 PASS（allow 半程 BLOCKED-by-F9 产品缺口，仅记录）；T4.2 角色闭包 PASS；T4.3 leader-approval 全链路 PASS（文件逐字落盘 + DSH 审批 lane 实测）；T4.4 deny PASS（typed + 零副作用）；T4.5 exactly-once PASS（消费 + 第二次 allow-consumed BLOCKED）；T4.6 invariant 37 PASS；T4.8 环境注记。发现新增 F9（无人类裁决通道）+ F10（last-mile guard 只包 team work 操作、no-request 放行、correlation=请求 token）。
- **boot#7 重启事故（环境性，已恢复）**：boot#6 被 kill 后直接重启同 root → `row setup failed — cannot prepare session "session-team-child-13456a4a17e2b41a7ed8870416bec677" while it is live`（PersistenceCoordinator.prepare L954）。根因链（durable 取证）：被 kill 时 W1/root 会话处于 open 状态；boot#7 宿主启动时先把 open 会话 revive 为 live（in-process 注册），团队插件随后 prepare 同一会话 → 冲突；bootstrap FAILED 后进程退出时宿主把已 revive 的会话干净 retire（各会话日志末尾追加 `session/end-seed`：root seq 5779 @12:57:18.142、W1 seq 3172 @12:57:18.586）。**重试 boot#7 成功**（会话已 retire，prepare 正常；live=3：root+W1+W2，toolCount=10，hardTools=true）。操作规则补充：**kill 后立即重启同 root 会触发 live 冲突；失败一次后重试即可（end-seed 已写入）**。
- **T4.7a external hard policy — PASS**：
  1. W1（boot#7 后 t8）`team_request_control {requestToken:"dtest-t47-hard-correlation", kind:"leader-approval", targetInstanceId:"inst-1yabcoe00jed", actionName:"write: hard-tools probe", toolName:"write"}` → **ctrl-0tzigz81azfc4h19i9zqq15k** pending（13:05:45.798，requestSequence 111）—— hard policy 下请求**可创建**（requestControl 不受 external policy 约束）✓。
  2. leader（t17）`team_resolve_control {decision:"allow", note:"leader allows under hard policy"}` → 类型化拒绝 `{"status":"rejected","code":"CONTROL_EXTERNAL_POLICY_DENIED","message":"ControlService: allow impossible — the external hard policy denies capability 'tools' (recorded as deny with reason external-policy)","details":{"requestId":"ctrl-0tzigz81azfc4h19i9zqq15k","capabilityDomain":"tools","toolName":"write"}}`。
  3. **durable deny 先行落账**：domain `control-decision-recorded` seq 114 = `{"decider":{"instanceId":"inst-leader","role":"leader"},"decision":"deny","reason":"external-policy","requestId":"ctrl-0tzigz81azfc4h19i9zqq15k","requestSequence":111,"scope":{...,"toolName":"write"}}`。
  4. leader（t18）**重试 allow**（同 requestId，新 token dtest-t47-allow-retry-1）→ `{"status":"rejected","code":"CONTROL_REQUEST_DECIDED","message":"ControlService: request 'ctrl-0tzigz81azfc4h19i9zqq15k' already carries a durable decision (the first decision is authoritative)"}` —— 不可推翻 ✓。
- **T4.7b UI"外部策略阻断"语义 — PASS**：dtestp6 团队页 团队事件 ledger 行（Playwright 快照 `state\teamtab-snap9-t47-ledger.yml`）：`21:10:35 控制裁决 W1 — deny · external-policy`，决策徽章 **拒绝**（`data-decision="deny"`）+ 原因徽章 **external-policy**（`data-ledger-state-reason`）；行 title = `ctrl-0tzigz81azfc4h19i9zqq15k · deny · external-policy` —— 呈现为"带外部策略原因的持久拒绝"，**不是**"审批失败/传输失败"也**不是**成功 ✓。OBS：同一 ledger 中 T4.1 user-approval（20:02:56）行仍挂"等待裁决"徽章（F9 残留，符合预期）；T4.7 请求行（已裁决）无等待徽章。
- **T4.7c 纯协调对照 — PASS**：leader `team_send_message → W2`（token dtest-t47-coord-1，无控制 scope）→ `{"status":"delivered","action":"send-message","deliveryMode":"direct","deliveredToInstanceId":"inst-0zb3tna1drgr","factSequence":115,"deliveredSequence":120}` —— hard policy 只 gate 控制裁决（allow），纯协调不受影响（guard no-request 放行）✓。
- **T4.7d**：计划标注 optional（capabilityExists.mcp 变体）—— MOCK_HARD_TOOLS 注入的 facts 为 `capabilityExists: {}`（空），无 mcp 事实可断言；**明确跳过**（optional 项，留痕）。
- **OBS（UI 小缺陷，仅记录）**：(1) ledger 面板在 `total===0`（零条目载入）时只显示"暂无团队事件"空态，**吞掉 tracker 拒页/错误**（错误提示只在 total>0 分支渲染，TeamLedger.tsx L235-240）；(2) 旧 dtestp4 团队 ledger 页返回 entries seq 65-68 但 `total:4`（该团队事实序号从 65 起、共享全局序号空间），tracker 首页 anchor=0 校验与空态交互导致其事件区不可读（不影响 dtestp6 目标团队）。
- **P4 完成**：T4.1–T4.8 全部记录（T4.1 allow 半程与 T4.1 用户裁决通道受 F9 产品缺口限制，其余 PASS）。

### P5 进展（boot#8 = 同 root 纯 resume，hardTools=false）
- **T5.1 F5 页面刷新（boot#7 内）— PASS**：整页 reload 后：Team tab 保持选中；成员组（leader · 1 活跃 + W1/W2 行与 lifecycle 按钮）、治理面板（兼容性/策略/生效配置）、团队事件 ledger（全部控制请求/裁决行，含 21:10:35 `deny · external-policy` 行）、T4.1 user-approval 行"等待裁决"徽章——全部恢复。快照 `state\teamtab-snap10-t51-reload.yml`。
- **T5.2 boot#8 冷复活（同 root）— PASS**：
  - leader 冷复活 + W1/W2 重绑：boot 日志 `row ready — toolCount=10 liveSessions=[root, session-team-child-13456a4a17e2b41a7ed8870416bec677 (W1), session-team-child-a8d6749abfd2d5698a2f535c3d143f10 (W2)]`——**child session id 与重启前完全一致**。
  - **确定性 instance id 不变**：domain `session_bindings`（dtestp6 scope 3 行）= team-root→root session、`inst-1yabcoe00jed`→W1、`inst-0zb3tna1drgr`→W2；`member_instances` dtestp6 3 行（W1 childSession 13456a4a…/W2 childSession a8d6749a…）与重启前一致。
  - **工具清单复证（boot#8 进程内新模型请求，last-tools.mjs）**：W1 = **37 工具**（10 team_* 全集 + `mcp__dtesthttp__ping`）；leader = **11 工具**（同 10 team_* + mcp）——与 v2 基线（leader 11 / member 37）完全一致。
  - **持久记录恢复**：UI ledger 显示全部控制请求/决策历史（含 external-policy deny 行）；治理面板恢复（兼容性 ✓ 0 警告）；快照 `state\teamtab-snap11-t52-boot8.yml`。OBS：`overrides` 表 dtestp6 scope **0 行**（本世界从未设 override；governance 生效配置区全部 "Inherited"，与 domain 一致——计划中"override 记录可见"项在无 override 世界退化为空状态一致性核查）。OBS：domain compatibility 行 computedAt=11:57:17 而 UI boot#7 显示"最后探测于 11:37:38"（UI 字段与 domain 行时间戳口径可能不同；不影响功能，仅记录）。
  - 复活后全链路可用：leader follow_up W1（token dtest-t52-face-check-1）→ `executed`/work-admitted seq 121/settled 124，memberResult "OK"（1.6s 往返）。
- **T5.3 = boot#7 已执行**（T4.7 组 + hard facts 注入，durable external-policy 痕 seq 114）——见上 P4 节。
- **T5.4 team_domain 持久化 — PASS**：`tests\mock\.dsh-home\storages\team_domain.json` 存在（106KB）；结构 = {unit, global, tables[8: schema_meta/team_sessions/member_instances/session_bindings/overrides/compatibility/operations/ledger]}；dtestp6 root 行集与 UI 状态一致（成员 3 行、控制 6 requests/5 decisions/1 consumed、external-policy deny 行、progress 2 条）。
- **P5 完成**：T5.1–T5.4 全部 PASS（2 项 OBS 留痕）。

### P6 进展（boot#8，dtestp6 世界，最终阶段）
- **T6.1 哨兵业务任务 — PASS（1 项 F3 偏离）**：root API 发送计划业务提示词（逐字保留：读 requirements.md；① W1 sentinel 逐字→work/alpha.md；② W2 读 seed-note.txt 总结→work/summary.md；leader 汇总 work/final.md 含两路径+sentinel 原文+W2 要点）。**偏离（记录）**：计划中"各 report progress 一次"因 F3（成员 team_report_progress 会死锁 leader 同步 follow_up）结构性不可执行 → 改为派发指令中逐字携带"本轮禁止调用 team_report_progress 工具（在回复文本中说明进展即可）"，两名成员均遵守（leader 回报原文）。leader t21 三步编排：
  1. follow_up → W1（token t52-w1-alpha-1）→ `executed`/work-admitted seq 125（SETTLED→RUNNING→SETTLED，lifecycle 128）。
  2. follow_up → W2（t52-w2-summary-1）→ seq 129（W2 首次工作，from CREATED；lifecycle 132）。
  3. follow_up → W2（t52-w2-final-1，leader 自拟汇总内容逐字写入 work/final.md）→ seq 133（lifecycle 136）。
  - **F3 新数据点（记录）**：W2 在 21:15 的 relay turn（T4.7c 消息触发）中自发调用 team_report_progress 两次（21:15:00.644 `progress:"in-progress"` / 21:15:14.351 `progress:"completed"`，token w2-probe-20260905-prog-001/002）——**两次均正常返回，facts 落账（ledger seq 117/118：activity-interval-opened subject=coordination-probe + team-coordination-recorded），turn 正常结束** → F3（此前 3 次无限挂起）存在成功反例，修正为**非确定性挂起**（3 挂起 vs 1 成功）。
- **T6.2 断言 — PASS（UI ledger 区受新发现 F11 影响，单独记录）**：
  1. **磁盘**：`work/alpha.md` 94B = sentinel 逐字（93B 正文+LF；W1 报告 SHA256 `D895A205…B1838F67` 与源文件字节一致 match=True）；`work/summary.md` 673B UTF-8 有效（W2 对 seed-note.txt 4 条事实的总结：部署环境/MCP 端点 3491/3492 各 1 个 ping 工具/Blueprint worker+collector 配额 4/外部硬策略优先级最高）；`work/final.md` 1373B 含两产物路径（含绝对路径）+ sentinel 逐字 + W2 要点 + W1 核验（SHA256/match=True）。
  2. **时间线（durable）**：seq 125–136 完整链 = work-admitted×3（125/129/133）+ activity-interval open/close×3 对（126/127、130/131、134/135，均 subject=work-unit，runtime 自动记账）+ member-lifecycle-changed RUNNING→SETTLED×3（128/132/136）；domain 终态 W1=SETTLED / W2=SETTLED / leader 无 lifecycle 字段（持久会话，预期）。计划时间线中"progress×2"（成员 report_progress 调用）= 0 次（F3 偏离）；work-unit 活动区间记账存在（3 open+3 close）。
  3. **UI 成员态**：重载后收敛 = leader 运行中、W1 已结算（"1 项待裁决"= T4.1 F9 残留 user-approval，预期）、W2 已结算。OBS：重载前 W2 行仍显示"已创建"（21:15 前的状态）——W2 两次 work-settled（13:27:53/13:28:32）后客户端投影未实时收敛，重载后恢复（F5 刷新语义的又一次体现，本次滞后跨越 2 次 lifecycle 变更）。
  4. **leader 回报**：t21 最终消息（log seq 13114）逐字报告全部确切路径（fixtures×2 + work×3，含绝对路径）、sentinel 原文、SHA256 核验、F3 条款遵守说明。
  5. **UI 团队事件区**：受 **F11** 影响——面板仅渲染首页 50 条（止于 21:15:14/seq 118），T6 任务 12 条 facts（125–136）在 durable ledger 中完整存在但 UI 不可见（见 F11）。
- **F11（新发现：ledger UI 静默截断——完整性判据单位错配，仅记录）**：
  - 冻结 schema：`ledger` store 为**单一全局序列空间**（`packages/storage/schema/ledger.ts`：counter 行 `__ledger_sequence_counter` = "最高已分配序列"，事实行 key=`String(sequence)`；本 home 实测：旧 root seq 1–64 / dtestp4 seq 65–68 / dtestp6 seq 69–136，跨 root 连续）。
  - remote 契约：`team.getLedgerPage` 返回 `total` = **per-team 条目计数**（`packages/remote/src/handlers/team.ts` L384 `ports.ledger.countEntries(teamSessionId)`；contracts 注释 "total fact-entry count"）+ cursor `nextAfterSequence` = 末条 sequence。
  - 客户端判据：`team-ledger-store.ts` L246 `nextComplete = total !== null && frontier >= total`，frontier = **最高已载入 sequence**（全局空间数值）与 **条目计数** 比较——单位错配。dtestp6：首页 50 条（seq 69–118，cursor 118，total 68）→ frontier 118 ≥ 68 → catch-up 当页即止，**剩余 18 条（119–136）永不拉取**；snapshot 模型同一比较（team-ui-snapshot.ts L283 `completeThrough < total` 才为 partial）→ 判定 `completeness='complete'` → **partial/剩余计数指示器不渲染，截断完全静默**。
  - 触发条件：任何 per-team 序列首值+49 ≥ per-team 条目数的团队（即**非 home 首个团队**且条目 > 50 时必然）；首个团队（seq 从 1 起）不受影响。
  - 证据（boot#8）：重载后仅 1 次 getLedgerPage 请求；响应 entries 69–118 / nextAfterSequence=118 / total=68；UI 末行 21:15:14；domain 实测 dtestp6 共 68 facts（至 seq 136）。影响面：团队事件面板 + 一切"已知完整"门控的 UI（pending 徽章等，按 plan §7.3 由完整 ledger 推导）。
- **T6.3 — PASS**：W1 durable log（session-team-child-13456a4a…/session.jsonl.zstd）含 sentinel 逐字串 **34 次**（read/write 的模型请求上下文与 tool 结果帧累计）。
- **P6 完成**：T6.1/T6.2/T6.3 全部记录（F3 偏离 + F3 非确定性修正 + F11 新发现 + W2 状态滞后 OBS）。

## P2 完成小结
T2.1–T2.5、T2.7、T2.8、T2.9(a–e)、T2.10、T2.11 全部完成（T2.6 blocked-by-F3）。发现：F3（progress 提交路径死锁，3/3 复现，仅记录）+ F4（quota per-template 语义，计划文案偏差）+ 多个 wire 形态/计划文案 OBS（T2.5 memberResult 归属、progress 枚举无 done、token 复用=幂等重放）。运营团队现态 = directive root + 6 成员，可用于 P3–P6。

## 待办
（已全部完成——见 P2–P6 各节与下方 post-flight；最终报告 `evidence/REPORT.md`。）

## post-flight（拆机与合规核查）
- **teardown**：boot#8 host（job pwsh-25）kill；端口 3181/3491/3492 全部释放（无 listener，无孤儿进程——mini 3491/3492 与 host 进程均随 boot 退出）。
- **:3080 稳定部署未触碰**：`D:\deepseek-harness` 的 `dsh web`（listener pid 11676）运行中、未受影响。
- **:3180 外部实例留痕（未触碰）**：`dsh web --port 3180`（listener pid 17244，pnpm 包装 13352）于 13:05:37 由 **explorer→交互式 powershell** 启动（父链非本 harness 作业树），对应 TEST_METHODS 的 `references/.dsh-test` home——非本战役基础设施（本战役 = 3181 + 3491/3492 + `tests\mock\.dsh-home`），保持运行、未 kill。
- **PilotDeck 进程树未触碰**（D:\PilotDeck-lys 全家桶，与本战役无关）。
- **test-use 树**：`references/deepseek-harness-test-use` HEAD = `a66e4702`，porcelain = 0（clean）。
- **仓库 tracked 文件**：发现并处理 1 处战役期改动——T0.1 搭建期曾向 `.gitignore` 追加 tests/mock 忽略规则（3 行块）；**拆机时已 `git checkout -- .gitignore` 还原** → 现 tracked 修改 = 0，HEAD = `3f06525`（= origin/master，未推送任何内容）。untracked 仅剩战役产物（tests/mock、tests/mock-outside、docs 战役文档等）。
- **API key**：全程未打印/未落盘（仅经 `.credentials.yaml` ref 由宿主读取）。
- **Playwright**：session `mocktest` 已 close。
- **post-flight 完成** → 战役结束，交付 `evidence/REPORT.md`（中文）。
