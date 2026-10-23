# M2-MOUNT-AUDIT-01 — 只读核卡（"39 declared_mount" 复数 + win32-pwsh 条件环境探测）

- 日期：2026-10-23（UTC）。执行者：M2 只读核卡子代理。
- 工作树：`.worktrees/a5-m1-kernel`（branch `feat/a5-m1-center-kernel`）。本卡零写入产品/契约/CI 文件；唯一写入 = 本目录。
- 本目录只含本卡产物；`git status --porcelain` 中其它未提交项（`a5ie-r2b/`、`m2-readimg/`、`m2-web/`）为其它卡的既有工作区状态，本卡未触碰。

## 0. 固定宿主自核（起手）

```
$ git -C tests/deepseek-harness-test-use rev-parse HEAD
639ed015397290b3745d163aafe02ffee4aa3f84
$ git -C tests/deepseek-harness-test-use status --porcelain | wc -l
0
```

- rev = `639ed015397290b3745d163aafe02ffee4aa3f84`（pin639 = 0.2.0-rc.2，与 TEST_METHODS §1 一致）✔
- porcelain 为空（工作树 clean）✔；本卡全程只读，收卡时再核仍为 0（见 §5）。
- 三份 preset 实际路径：`tests/deepseek-harness-test-use/packages/bundle/web-app/presets/{cordis,ptc,standard}.patch.yml`（154 / 152 / 146 行，全部逐字亲读）。

## 1. 任务一：三 preset 声明挂载工具名复数

### 1.0 口径（先行声明，防歧义）

"声明挂载" = preset 的 plugin 条目在该 preset 声明装载、且其注册源在 pin639 源码中静态产生该工具名（含 `disabled: true` 的声明——与矩阵 `TOOL-CAPABILITY-MATRIX-9b2.md:52` 把 codex/claude_code `disabled:true` 计入"声明"的口径一致）。每个包→工具名映射均在 pin639 亲读注册源（行号见 1.1 表），未沿用任何二手数字。`tool-fs` 等无 `toolName:` 配置的包按包源码内 `name:` 注册逐名核对。

### 1.1 逐 preset 逐名清单

三 preset 共有的声明条目→名（行号 standard / cordis / ptc；注册源=pin639 `tests/deepseek-harness-test-use` 相对路径:行）：

| 工具名 | preset 条目（standard / cordis / ptc 行） | 注册源（pin639） |
|---|---|---|
| bash | :20-22 / :23-25 / :20-22（win32 上 disabled） | packages/shell/tool-bash/src/index.ts:374 |
| pwsh | :23-25 / :26-28 / :23-25（非 win32 上 disabled） | packages/shell/tool-pwsh/src/index.ts:384 |
| read | tool-fs :26-27 / :29-30 / :26-27 | packages/fs/tool-fs/src/read.ts:78 |
| read_image | 同上 | packages/fs/tool-fs/src/read-image.ts:210 |
| write | 同上 | packages/fs/tool-fs/src/write.ts:73 |
| edit | 同上 | packages/fs/tool-fs/src/edit.ts:85 |
| glob | tool-fs-search :28-31 / :31-34 / :28-31 | packages/fs/tool-fs-search/src/glob.ts:307 |
| grep | 同上 | packages/fs/tool-fs-search/src/grep.ts:285 |
| job_output | tool-jobs :32-33 / :35-36 / :32-33 | packages/jobs/tool-jobs/src/index.ts:311 |
| job_list | 同上 | packages/jobs/tool-jobs/src/index.ts:352 |
| job_kill | 同上 | packages/jobs/tool-jobs/src/index.ts:372 |
| skill | tool-skill :36-37 / :148-149 / :36-37 | packages/skill/tool-skill/src/index.ts:82 |
| create_goal / get_goal / update_goal | tool-goal :40-41 / :39-40 / :40-41 | packages/goal/tool-goal/src/index.ts:208/:196/:235 |
| exit_plan_mode | plan-mode :48-49 / :47-48 / :48-49 | packages/plan/plan-mode/src/index.ts:67,279 |
| send_message | tool-subagent-control :86-87 / :85-86 / :86-87 | packages/subagent/tool-subagent-control/src/index.ts:29 |
| interrupt_agent | 同上 | packages/subagent/tool-subagent-control/src/index.ts:75 |
| list_agents | …/list-agents :88-89 / :87-88 / :88-89 | packages/subagent/tool-subagent-control/src/list-agents.ts:87 |
| subagent | tool-subagent `toolName: subagent` :90-96 / :89-95 / :90-96 | packages/subagent/tool-subagent/src/index.ts:108,380 |
| list_subagent_models | 同上（`modelSelectionSettings: true` 触发注册） | packages/subagent/tool-subagent/src/list-models.ts:88；门=index.ts:608 |
| subagent_fork | tool-subagent-fork :97-102 / :96-101 / :97-102 | 同 toolName 路（index.ts:380） |
| subagent_codex | :103-110 `disabled: true`（:105）/ :102-109(:104) / :103-110(:105) | 同上 |
| subagent_claude_code | :111-118 `disabled: true`（:113）/ :110-117(:112) / :111-118(:113) | 同上 |
| workflow | tool-workflow :123-124 / :122-123 / :124-126（ptc `disabled: true` :126） | packages/workflow/tool-workflow/src/index.ts:60,329（toolName 默认 'workflow'） |
| ralph | tool-ralph :125-130 `disabled: true`（:127）/ 同(:126) / 同(:129) | packages/workflow/tool-ralph/src/index.ts:411 |
| ask_user_question | tool-ask-user :131-132 / :130-131 / :133-134 | packages/interaction/tool-ask-user/src/index.ts:39 |
| todo_write | tool-todo :133-136 / :132-135 / :135-138 | packages/todo/tool-todo/src/index.ts:136 |
| web_fetch | tool-web :137-141 / :136-140 / :139-143 | packages/web/tool-web/src/fetch.ts:457 |
| web_search | 同上 | packages/web/tool-web/src/search.ts:326 |
| present | tool-present :142-143 / :150-151 / :148-149 | packages/deliverables/tool-present/src/index.ts:39 |
| plugin_manager | :144-146 `disabled: true`(:146) / :152-154 `disabled: !!js "!ctx.get('profileContext')"` / :150-152 `disabled: true` | packages/boot/plugin-manager/src/tools.ts:20 |
| cordis_inspect_list | **仅 cordis** tool-cordis :141-142 | packages/extensions/tool-cordis/src/index.ts:23 |
| cordis_inspect_query | **仅 cordis** 同上 | packages/extensions/tool-cordis/src/index.ts:42 |

非工具名条目（亲读确认不注册工具名）：persona、agent-instructions、skill-filesystem、command-goal（commands.register，packages/goal/command-goal/src/index.ts:191）、compaction-basic / command-compact（同，packages/compaction/command-compact/src/index.ts:101）/ tool-result-pruner、workflow-ptc（无 `ctx.tools.register`）、ptc 独有 tool-presentation `@deepseek-ai/dsh-agent-tool-presentation mode: ptc`（ptc :144-147；packages/core/agent-tool-presentation/src/index.ts 只做 `runtimeCtx.tools.presentAs(mode)`，不注册新工具名——run_code 面属宿主 tool registry，不由这三份 preset 声明）。

### 1.2 集合数（实测，raw/set-computation-stdout.txt）

- **standard = 32 名**、**ptc = 32 名**（与 standard 同名集，差异仅在 disabled 侧标：ptc 多 disable `workflow`）、**cordis = 34 名**（= standard ∪ {cordis_inspect_list, cordis_inspect_query}）。
- **并集 = 34**；**交集 = 32**（standard=ptc 名集，cordis 为 strict superset）。
- 启用腿（剔除任何 preset 中 `disabled:true` 的条件声明，即除 subagent_codex/subagent_claude_code/ralph/plugin_manager/workflow(ptc) 之外）：standard enabled=28、ptc enabled=27、cordis enabled=30（plugin_manager 为条件 js 关断，记条件）、并集 enabled=30。

### 1.3 与 plane 侧交叉（`packages/runtime/src/plugin/live/team-tool-plane.mjs`）

亲读行号：**PLANE_RESERVED_NATIVE = :403-463**（68 名，68 唯一；卡上"约 :403-412"实为该常量的前 10 行）；**PLANE_SUPPORTED_NATIVE_TAKEOVERS = :465-479**（`bash:['bash']`、`read:['read']`、`grep:[]`、`glob:[]`、`jobs:['job_output','job_list','job_kill']`）；`PLANE_RESERVED_NATIVE_PREFIXES=['mcp__']` :464。

对并集 34 名交叉：

- **takeover 名 = 5**：`bash`、`read`、`job_output`、`job_list`、`job_kill`（jobs 三件套挂载受 `jobsEnabled` 缺省-off 门控，:687-697，矩阵 :33-35 在册）。
- **保留名但无 takeover = 29**：pwsh、read_image、write、edit、glob、grep、skill、create_goal、get_goal、update_goal、exit_plan_mode、send_message、interrupt_agent、list_agents、subagent、list_subagent_models、subagent_fork、subagent_codex、subagent_claude_code、workflow、ralph、ask_user_question、todo_write、web_search、web_fetch、present、plugin_manager、cordis_inspect_list、cordis_inspect_query。
- **不在 plane 名集 = 0**（无 mcp__ 前缀名；34 名全部命中 PLANE_RESERVED_NATIVE）。
- 反向注：PLANE_RESERVED_NATIVE 68 名中 **34 名不被任何一份 web-app preset 声明**（str_replace_editor、lsp、load_workspace_dependencies、terminal_*6、session_*5、list_mcp_resource*3、read_mcp_resource、上游 team 9、run_code、schedule_*4、stagehand_*6）——这些走 profile bundle / opt-in / experimental bundle-off 路线，不属本次三 preset 口径。

### 1.4 "39" 判定

**"39 declared_mount" 作为"三 preset 声明挂载名数"不能复现**。三 preset 实测 = 32/32/34，并集 **34**、交集 **32**，任一合理解释口径（含/不含 disabled、enabled-only 30）都得不到 39。

"39" 的真实出处与口径（全部亲读）：

- **首次出现**：`docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/M0-PLANB-ASSEMBLY.md:24`——"装载轴（新权威，双射可验）：mountCondition 四值封闭集与 v3c req 逐行对应：REQ 49→always 49；**REQ-COND 39→declared_mount 39**；REQ-COND-win32 1→win32_and_declared_mount 1；N-A-TOOL(surface) 4→surface_invariant 4"。其后复述于同文件 **:87**（"M2 = 全部 required…93 行全覆盖 = always 49 + declared_mount 39 + win32_and_declared_mount 1（pwsh）+ surface_invariant 4"）与 **:132**（R7 风险条）。仓内 `declared_mount` 一词只出现在 `M0-PLANB-ASSEMBLY.md` 与 `M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json` 两文件（全树 grep，含 evidence，无第三处）；首次引入 commit = **`f462ddb71a4b50f22d893c1b46bcefffb3d33eef`**（2026-10-22T18:59:27+00:00，"docs(alpha5/m0): M0 contract package v1 …93-record acceptance index…"）。矩阵 `TOOL-CAPABILITY-MATRIX-9b2.md` 本体**不含**"39"或 `declared_mount`。
- **39 在其自身口径内成立**：`M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json`（93 records / 90 unique names / 27 families）逐行清点 = `{always:49, declared_mount:39, win32_and_declared_mount:1, surface_invariant:4}`（raw/m0-index-mountcondition-tally.txt）。**它是 (name,scope) 记录行的分类计数，不是任何 preset 的工具声明计数**：39 行里 27 行 scope 为 `host-unmounted-*` / `host-experimental-bundle-off` / `host-sdk-app-env-only` / `host-dynamic-mcp-scope`（terminal_*6、session_*5、schedule_*4、stagehand_*6、上游 team 9、str_replace_editor、load_workspace_dependencies、list_mcp_resource*3——preset 根本不声明这些名），另有 4 行 preset 内条件声明（subagent_codex、subagent_claude_code、ralph、list_subagent_models）+ pwsh 单列为 win32_and_declared_mount；而 preset 确实声明的 34 名中 30 名在索引里归 `always`。两口径**互不矛盾、但不可互换**。
- 结论措辞：**"39 declared_mount" 是 93-record 索引的记录行口径（可复现，39 行）；把它读作"三个 preset 声明挂载了 39 个工具名"则不成立（实测并集 34）**。在册声明若以矩阵 :52 为引用源——矩阵 :52 本身不含 39，其 90-116/89-115 行锚与"codex/claude_code disabled 声明"亲读复核**准确**。

## 2. 任务二：win32-pwsh 条件环境可用性（矩阵 :32 pwsh 行口径）

原文见 `raw/task2-env-probe.txt`。要点：

```
$ uname -s
Linux                      （6.8.0-142-generic）
$ command -v pwsh          → exit=1（无）
$ command -v powershell    → exit=1（无）
$ command -v pwsh-preview  → exit=1（无）
$ ls -la /proc/sys/fs/binfmt_misc/
total 0                    （目录存在、零条目；无任何 windows/PE binfmt 条目）
$ command -v wine wine64 wineserver → exit=1（无）
PATH/bin 扫描（/usr/bin /usr/local/bin /opt）→ 无 pwsh|powershell|wine 命中
pwsh --version → 未运行（二进制不存在）
```

**结论（三选一）＝ 本宿主不可跑**：Linux、binfmt_misc 无 Windows Interop 条目、无 pwsh/powershell/pwsh-preview、无 wine/pwsh 组合的任何可跑证据 ⇒ **win32 条件腿在本宿主 ENV-NOT-AVAILABLE**（对齐 M0-PLANB §C2-③"环境不足=ENV_BLOCK 登记≠通过"）。零安装、零配置改动（红线遵守）。
矩阵 pwsh 行⑦"Windows/provider 对等未证明"**维持未证明**——本探测只证"本宿主条件腿不可跑"，不证 provider 对等，不作任何升格。

## 3. 矩阵应改文字（仅建议措辞，落笔权在主 Agent）

1. `TOOL-CAPABILITY-MATRIX-9b2.md:32`（pwsh 行）⑥ 建议追加：`；win32 条件腿宿主可用性 2026-10-23 实测=本宿主(Linux,pin639)无 pwsh/binfmt Win-Interop/wine ⇒ ENV-NOT-AVAILABLE（证据=evidence/alpha5/m2-mount-audit/raw/task2-env-probe.txt；非 Windows 宿主禁跑该腿，非 provider 否定）`。⑦ 建议**原文不动**（对等仍未证明）。
2. 若 M0 口径文件要防"39=preset 声明数"误读，`M0-PLANB-ASSEMBLY.md:24` 句尾可加限定（**由主 Agent 决定是否改，本卡未动**）：`（declared_mount 计数对象=93-record 索引 (name,scope) 记录行；非 web-app 三 preset 声明名数，后者亲测并集=34，见 evidence/alpha5/m2-mount-audit/）`。

## 4. 不确定处（明列）

- `list_subagent_models` 计入声明挂载，依据=三 preset 的 spawn `tool-subagent` 条目均带 `modelSelectionSettings: true`（standard:95/cordis:94/ptc:95）+ 注册条件亲读（tool-subagent index.ts:608、list-models.ts:88）；若主 Agent 口径把"运行时条件注册"排除出"声明挂载"，各集 −1（32→31 等），并集 33，结论"39≠preset 口径"不变。
- preset `disabled: !!js` 两条（bash/pwsh 平台对偶；cordis plugin-manager）按"声明+条件关断"计入；enabled-only 口径已另列（§1.2）。
- `run_code` 不属三 preset 声明面（agent-tool-presentation 仅 presentAs；run_code 注册在宿主 tool registry，本次未逐源追至注册点——按口径不需要）。
- minimal.patch.yml 不在本卡 scope。

## 5. 收卡复核

```
$ git -C tests/deepseek-harness-test-use rev-parse HEAD
639ed015397290b3745d163aafe02ffee4aa3f84
$ git -C tests/deepseek-harness-test-use status --porcelain | wc -l
0
```

本卡新增（且仅新增）：`dev/agent-workflow/evidence/alpha5/m2-mount-audit/`（README + raw/ 4 件）。未 commit/push；未用 `git add -A`。
