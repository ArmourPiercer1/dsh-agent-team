# TOOL-IMPLEMENTATION-MATRIX — 每工具实现来源与处置（Native Reuse First 校正用）

> 书写时刻 = **2026-10-31T05:32Z（整改轮 `date -u` 实测）**——首版锚点 05:02Z 系笔误（晚于自身 commit `d121b4ba3` @04:58:05Z，不可能成立；R-CLOCK-1 违例经独立审查发现，正文其余时刻不动）；基线 = `task/a5w-nraudit-20261031` @ `f995ce7814`；证据链 = 同目录 NATIVE-REUSE-AUDIT.md（行级出处在该表，此处不重复长引）。优先级按用户指令 = **P0**: present / web_search / web_fetch；**P1**: Agent State / Agent Control；**P2**: Inspect / Skill 等。Recommendation 闭集 = KEEP / REUSE / MODIFY / FORK-CANDIDATE / BLOCKED。**本次审计零 FORK-CANDIDATE**（无一工具满足「R1+R2+R3 失败最小复现在册」的 Fork 前提；现行最接近者 present 的正确出路是宿主公开接口裁决，非 Fork）。

## 主表（31 受治理行，按 Family 分组）

| 优先级 | Tool | Family | 实现形态一句话 | 复用面判定 | Recommendation |
|---|---|---|---|---|---|
| P2 | read | dsh.fs-family | Team ControlledFs body（anchored open + O_NOFOLLOW + (dev,ino) 句柄验证 + bounded 窗口） | ③ 不可替代（宿主读工具无治理读窗 seam；ctx.fs 为写向 sandbox） | **KEEP** |
| P2 | write | dsh.fs-family | Team ControlledFs body（post-consume closure，PR #390 CA-01 零中心 diff） | ③ 不可替代 | **KEEP** |
| P2 | edit | dsh.fs-family | 同上 + read-before-edit 对齐 | ③ 不可替代 | **KEEP** |
| P2 | read_image | dsh.fs-family | Team 行 + **宿主 `ctx.attachments` 公开 store 复用**（#488，无 CORE_SEAM_BLOCKER） | 复用形态正确 | **KEEP** |
| P2 | bash / team_bash | dsh.process-family | Team confined-shell mechanics（中心 VERBATIM 迁移 #375）驱动 named sandbox-provider（Landlock） | ②+③（宿主 terminals 无 exec 前沿 confine hook；PTY 未复制） | **KEEP** |
| P2 | pwsh | dsh.process-family | 同 bash 道（u7fpwsh fixture；本机无 pwsh 已 DISCLOSED） | 同上 | **KEEP** |
| P2 | team_grep / team_glob | dsh.search-family | **R3 原文形态**：宿主包根公开 helper（buildGrepCommand/buildGlobCommand/parse*/resolveRgPath）直 import + confined spawn | 复用形态正确（argv/解析零复制） | **KEEP** |
| P0 | web_fetch | dsh.web-family | **自有 node:https transport**（https-only/origin 锁/有界）；宿主公开 provider seam `ctx.web.registerFetchProvider` 未用；输出/截断语义=④复制 | 复用可行（gate 逻辑装进 provider 即兼容 seam） | **MODIFY** |
| P0 | web_search | dsh.web-family | provider **shape** 自有 + 零生产 provider（诚实空转 `WEB_SEARCH_NO_PROVIDER`）；宿主官方 providers（deepseek/exa/perplexity）+ `registerSearchProvider` 未适配 | 复用可行且为裁决③直接命中 | **REUSE** |
| P0 | present | dsh.ui-family | 行 + injected port；**宿主无发布服务面**（#493/#498 证伪）⇒ `UI_PRESENT_PORT_ABSENT` typed 零效果 | 无对象可复用（非复制、非 Fork） | **BLOCKED**（O2-B N2/N3 = 用户裁决位；推荐 N2 宿主公开接口 issue，R-N2 包 #498 已就绪） |
| P1 | ask_user_question | dsh.ui-family | **宿主公开 `userQuestions` service 复用**（#494 per-call carrier 修复 #491 缺口；#491 LIVE probe 端到端可证） | 复用形态正确 | **KEEP** |
| P1 | subagent / subagent_fork / send_message / interrupt_agent / list_agents / list_subagent_models | dsh.agent-control-family | 治理壳 + **执行腿骑宿主公开 `subagents`/`llm` services**（hostService 注入端口，AC-1 #418）；Tier A ceiling/围栏为 Team 增值 | 复用形态正确（宿主 1,214+290 行业务零复制） | **KEEP** |
| P1 | workflow | dsh.agent-control-family | 治理壳 + `runWorkflow refuses typed until AC-4`（LEG_UNWIRED，families/agent-control.mjs:52） | 宿主 workflow runtime 未接 | **BLOCKED**（U7-R3 ④ 裁决：有界 PoC → 用户纳入/排除；无迁移可谈） |
| P1 | create_goal / get_goal / update_goal | dsh.agent-state-family | **全自有状态机 + fs-state-store**；宿主 `ctx.goals` 公开 service 存在（宿主 tool-goal 自身全走它）而 Team 未试 | ④复制 + 裁决③命中（公开服务适配未尝试 = UNPROVEN 不可行） | **REUSE**（评估 `ctx.goals` + per-call 授权壳；失败才保留现实现并补最小复现证明） |
| P1 | todo_write | dsh.agent-state-family | law 复刻宿主 todo 校验/投影 + 自管持久 store；**宿主无 todo 公开 service**（ctx.get 面实占名单无） | ④复制但客观面无 service；缺最小复现证明在册 | **MODIFY**（State Home V2 lane 合并评审：补证明或收敛复制面） |
| P1 | exit_plan_mode | dsh.agent-state-family | 自有 plan 提交法；宿主 plan-mode 复用面未调查 | UNPROVEN | **MODIFY**（同 lane 复用面调查先行） |
| P0(job 复用样板) | job_output / job_list / job_kill | dsh.jobs-family（named-bridge） | **`execution.via:'named-bridge'` + VERBATIM body（byte-pin 71705d6e…）+ provider `dsh.host/job-registry@639ed01539`** — 原生 JobRegistry 执行 100% 保留 | **全账本最优复用形态（R2 现行等价）** | **KEEP** |
| P2 | team_skill | dsh.inspect-family | 自有 SKILL.md loader（语法/限额=上游语义复制）；宿主 `ctx.skills` 公开 service 未试 | ④复制，复用面存在 | **MODIFY**（评估 ctx.skills 快照 + 自有 bounded 读组合） |
| P2 | team_cordis_inspect_list / team_cordis_inspect_query | dsh.inspect-family | 治理壳 + **`hostService('cordisInspect')` 复用**（宿主 8,609 行业务零复制） | 复用形态正确 | **KEEP** |

## 相邻行（不占 31 行台账，义务在册）

| 优先级 | 名集 | 现状 | Recommendation |
|---|---|---|---|
| — | 原生 `grep`/`glob`（Team 会话直通） | 别名挂载 + 同名 typed 拒（PLANE…grep/glob=[]）= S0 允许形态；**无需迁移**；M-06/M-08 两缺陷 = 账本修项 | **KEEP** |
| P2 | `run_code`(PTC) | 传输保留 + escalation 裁决行（approval/request 公开瀑布） | **KEEP**（③ 边界） |
| — | MCP / LSP（bridge:MCP / bridge:LSP REQUIRED） | 交付未开工；lsp = 严格 Profile 默认拒绝（post-poc §3.5 既定） | **BLOCKED**（scope/裁决项，零复制零 Fork） |
| — | team_* Leader 域 15 名（team-native） | Team 自有业务，无宿主对应物 | **KEEP**（不在复用问题域） |
| — | plugin_manager / str_replace_editor / terminal_* / session_* / schedule_* / ralph / wait_agent / structured_output / load_workspace_dependencies / subagent_claude_code / subagent_codex / cua_* / stagehand_* / 3 动态类 | obligations 58 REQUIRED 之外（other:*/OUT_OF_SCOPE 33 名 + UNKNOWN 法） | **N/A**（范围外，不逐行展开） |

## Recommendation 分布计数（31 主行）

- **KEEP = 21**：read, write, edit, read_image, bash, team_bash, pwsh, team_grep, team_glob, ask_user_question, subagent, subagent_fork, send_message, interrupt_agent, list_agents, list_subagent_models, job_output, job_list, job_kill, team_cordis_inspect_list, team_cordis_inspect_query
- **REUSE = 4**：web_search, create_goal, get_goal, update_goal
- **MODIFY = 4**：web_fetch, todo_write, exit_plan_mode, team_skill
- **BLOCKED = 2**：present, workflow
- **FORK-CANDIDATE = 0**

相邻面：KEEP = {原生 grep/glob 直通, run_code, team-native×15, plugin_manager}；BLOCKED = {MCP bridge, LSP}；N/A = OUT_OF_SCOPE 33 + 动态类。
