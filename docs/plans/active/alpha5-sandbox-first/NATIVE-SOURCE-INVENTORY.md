# ALPHA.5 SANDBOX-FIRST — P3-00 Native-Source Inventory（BL-21..BL-26）

<!-- phase-baseline-ref: dev/engineering/current-authority.json -->
<!-- phase-identity: alpha5-sandbox-first -->

> **日期**：2026-11-03（轮次标签；编制时刻真实 UTC = 2026-11-04，按 R-CLOCK-1 记录）。
> **性质**：BL-21 的 **source-evidenced 半场**——pinned baseline 里有哪些原生 tool 模块、各自注册什么、
> 同步还是延迟、依赖什么、本阶段能否采用、旧 Alpha.5 执行资产如何退役。
> **不是** booted Host 的运行时枚举：动态 MCP/插件新来源仍为 `NOT_TESTED`；本文件**不分配等级**
> （唯一验收合同是 `TOOL-ACCEPTANCE-MATRIX.md`），不修改任何产品或上游源码，**零 Host boot**。
> **设计需求正本**：`docs/plans/memo/alpha5-sandbox-first-20261101/`（TOOL-ADOPTION-MATRIX 是静态种子）。

---

## 0. 基线、方法与边界

| 事实 | 值 / 来源 |
|---|---|
| 宿主 baseline | `639ed015397290b3745d163aafe02ffee4aa3f84`（0.2.0-rc.2）。核验：`cd tests/deepseek-harness-test-use && git rev-parse HEAD` |
| 本仓库 base | `origin/master` = `d0cbef9af`（#576），本 lane 从它切出；矩阵与 backlog 同树 |
| 宿主源位置 | `tests/deepseek-harness-test-use/packages/**`（pristine、gitignored、环境本地；**只读**，本 lane 未写入） |
| 本仓库证据 | `dev/agent-workflow/evidence/a5sf-s1/`、`a5sf-assembly/`、`a5sf-p0/`、`a5sf-deferred/`、`a5sf-acceptance/`、`a5sf-native-route-c/`、`a5sf-tool-axis/` |
| 本仓库 seam | `packages/runtime/team-services/src/mount.ts`、`packages/runtime/src/plugin/live/a5sf-realm-row.mjs`、`packages/runtime/src/plugin/types.ts`、`packages/runtime/member-io-policy/src/trust-registry.ts` |

**每条事实如何建立**（评审者可逐条重跑；行号以 pin 为准）：

1. **模块 id / 版本**：`packages/<group>/<pkg>/package.json` 的 `name` / `version`；全部相关包 = `0.2.0-rc.2`。
2. **注册了什么工具**：各包 `lib/index.js` 里 `ctx.tools.register(defineTool({ name: "…" }))` 与
   `ctx.systemPrompt.section({ name: "tool:<…>" })` 的字面名（两种名都记录：tool 名 / prompt 段名）。
3. **同步还是延迟**：`apply()` 体内是否出现 `ctx.inject([...], cb)`（延迟注册）、
   `ctx.on('…')` 事件驱动注册；`const inject = [...]` 是模块自身的**前置**依赖（同步 apply 的前提）。
4. **产品 preset 归属**：`packages/bundle/web-app/presets/{standard,cordis,ptc,minimal}.patch.yml`
   与 `packages/bundle/base/cordis.patch.yml` 的 `id:` / `name:` 行；`disabled: !!js …` 视为平台条件。
5. **本仓库采用面**：`packages/runtime/src/plugin/types.ts` 的 `a5sfNativeToolModules`（行 251）、
   `a5sf-realm-row.mjs` 的 `nativeToolMountsOf`/`observeNativeToolOwnership`、
   `mount.ts` 的 routed mount；配置实例**只在证据 profile** 里
   （`dev/agent-workflow/evidence/a5sf-{live-native2,live-native3,acceptance}/logs/*/composed-profile-*.patch.yml`），
   产品 composition（`cordis.yml` / profile preset）**没有任何** `a5sfNativeToolModules` 行。

**本文件不主张**：真实 Host 的完整 `ToolRuntime` 清单；动态 MCP / 运行中插件注册；
任何工具的 I/O 验收等级；未列出的模块不存在（只覆盖 `@deepseek-ai/dsh-tool-*` 家族与两个实验/扩展包）。

---

## 1. 模块总表（pinned baseline，源码核实）

“前置依赖”列 = 模块 `inject` 数组（同步 apply 能启动的条件）；“延迟/事件”列 = apply 之后的注册。

| 模块 id（`@deepseek-ai/…`） | 源路径 | 产品 preset 行 | 注册的工具（tool 名 / prompt 段） | 注册模式 | 前置依赖 / 延迟依赖 |
|---|---|---|---|---|---|
| `dsh-tool-fs` | `fs/tool-fs` | standard/cordis/ptc `tool-fs` | `read`、`write`、`edit`（段 `tool:read`/`tool:write`/`tool:edit`）+ `read_image`（**无** `tool:read_image` 段） | 3 个同步 + 1 个**延迟** | `inject=["tools","fs","systemPrompt"]`；`apply()` 末尾 `ctx.inject(["attachments"], …)` 注册 `read_image`（行 1204） |
| `dsh-tool-fs-search` | `fs/tool-fs-search` | standard/cordis/ptc `tool-fs-search` | `grep`、`glob`（段 `tool:grep`/`tool:glob`） | 同步 | `inject=["tools","systemPrompt","subprocess"]`；**无** `fs`（经 `ctx.subprocess` 调 `rg`） |
| `dsh-tool-str-replace-editor` | `fs/tool-str-replace-editor` | **无** | `str_replace_editor`（无 `tool:` 段） | 同步 | `inject=["tools","fs"]`（行 329） |
| `dsh-tool-bash` | `shell/tool-bash` | standard/cordis/ptc `tool-bash`（`disabled: win32`） | `bash`（段 `tool:bash`） | 同步 + **延迟重注册** | `inject=["tools","shell","systemPrompt","shellEnv"]`；`ctx.inject(["jobs"], …)` 在 `jobs` 可解析时**重新注册** `bash`（带 jobs），dispose 时回退前台版（行 702-711） |
| `dsh-tool-bash-persistent` | `shell/tool-bash-persistent` | minimal `persistent-bash`（`disabled: win32`） | `bash` | 同步 | `inject=["tools","terminals"]`（行 367） |
| `dsh-tool-pwsh` | `shell/tool-pwsh` | standard/cordis/ptc `tool-pwsh`（`disabled: !win32`） | `pwsh`（段 `tool:pwsh`） | 同步 + **延迟重注册** | `inject=["tools","shell","systemPrompt","shellEnv"]`；`ctx.inject(["jobs"], …)`（行 704） |
| `dsh-tool-pwsh-persistent` | `shell/tool-pwsh-persistent` | minimal `persistent-pwsh`（`disabled: !win32`） | `pwsh` | 同步 | `inject=["tools","terminals"]`（行 372） |
| `dsh-tool-terminal` | `terminal/tool-terminal` | **无**（`minimal` 只挂 `dsh-terminal` 服务） | `terminal_open`、`terminal_send`、`terminal_read`、`terminal_signal`、`terminal_close`、`terminal_list`（段 `tool:pty`） | 同步 | `inject=["terminals","tools","systemPrompt"]`（行 149） |
| `dsh-tool-lsp` | `lsp/tool-lsp` | **无** | `lsp`（段 `tool:lsp`） | 同步 | `inject=["tools","lsp","systemPrompt"]`（行 193） |
| `dsh-tool-web` | `web/tool-web` | standard/cordis/ptc `tool-web` | `web_search`、`web_fetch`（段 `tool:web_search`/`tool:web_fetch`） | 同步 | `inject=["tools","web","systemPrompt"]`（行 832） |
| `dsh-tool-jobs` | `jobs/tool-jobs` | standard/cordis/ptc `tool-jobs` | `job_output`、`job_list`、`job_kill`（段 `tool:jobs`） | 同步 | `inject=["tools","jobs","systemPrompt"]`（行 83） |
| `dsh-tool-goal` | `goal/tool-goal` | standard/cordis/ptc `tool-goal` | `get_goal`、`create_goal`、`update_goal`（段 `tool:goal`） | 同步 | `inject=["agents","goals","tools","systemPrompt","sessionProjections"]` |
| `dsh-tool-todo` | `todo/tool-todo` | standard/cordis `tool-todo` | `todo_write` | 同步 | `inject=["tools","sessionProjections"]`（行 12） |
| `dsh-tool-present` | `deliverables/tool-present` | standard/cordis `present` | `present` | 同步 | `inject=["tools","fs","sessionProjections"]`（行 10） |
| `dsh-tool-skill` | `skill/tool-skill` | standard/cordis/ptc `tool-skill` | `skill` | 同步 | `inject=["agents","tools","skills"]`（行 35） |
| `dsh-tool-ask-user` | `interaction/tool-ask-user` | standard/cordis `tool-ask-user` | `ask_user_question` | 同步（`mode:"timed"` 时注册定时变体） | `inject=["tools","userQuestions"]`（行 216） |
| `dsh-tool-session-query` | `session-query/tool-session-query` | **无**（`base` 只挂 `session-query-sqlite` 服务） | `session_search`、`session_event_search`、`session_trace`、`session_event_trace`、`session_event_read`（段 `tool:session-query`） | 同步 | `inject=["tools","systemPrompt","sessionQuery","sessionProjections"]`（行 924） |
| `dsh-tool-subagent` | `subagent/tool-subagent` | standard 四行：`tool-subagent`(subagent)、`-fork`(subagent_fork)、`-codex`/`-claude-code`(disabled) | `subagent`/`subagent_fork`/…（`config.toolName`）、`list_subagent_models`（`modelSelectionSettings:true`）、段 `tool:<toolName>` | **事件驱动条件注册** | `inject=["tools","subagents","systemPrompt","sessionProjections"]`；`apply()` 立即注册仅当 provider 已在；否则等 `subagent/provider-added` 再注册、`provider-removed` 注销（行 382/565-582） |
| `dsh-tool-subagent-control` | `subagent/tool-subagent-control`（`./list-agents` 子导出） | standard 两行 | `send_message`、`interrupt_agent`（`./list-agents` 导出 `list_agents`） | 同步 | `inject=["tools","subagents"]`（行 16） |
| `dsh-tool-workflow` | `workflow/tool-workflow` | standard `tool-workflow` | `workflow`（`config.toolName`；段 `tool:workflow`） | 同步 | `inject=["tools","workflowEngine","systemPrompt"]`（行 61） |
| `dsh-tool-ralph` | `workflow/tool-ralph` | standard `tool-ralph`（`disabled: true`） | `ralph`（段 `tool:ralph`） | 同步 | `inject=["tools","workflowEngine","subagents","systemPrompt"]`（行 11） |
| `dsh-tool-cordis` | `extensions/tool-cordis` | cordis preset `tool-cordis` | `cordis_inspect_list`、`cordis_inspect_query` | 同步 | `inject=["tools","cordisInspect"]`（行 29） |
| `dsh-tool-workspace-dependencies` | `skill/tool-workspace-dependencies` | **无** | `load_workspace_dependencies` | 同步 | `inject=["tools"]`；`config.source` 必填 |
| `dsh-experimental-tool-agent-team` | `experimental/tool-agent-team` | **无** | 团队工具平面（`spawn_teammate`、`team_task_create/get/list/update`、`wait_agent`、`send_message`、`interrupt_agent`、`list_agents`、`team:policy`） | 同步 | `inject=["agents","agentTeams","tools","systemPrompt"]`（行 9）；**experimental / pre-stable** |

**不存在于本 baseline 的“模块”**：`run_code`。它是 `@deepseek-ai/dsh-tools` 的 **PTC 模式保留名**
（`packages/core/tools/lib/index.js:898` `RUN_CODE_NAME`，行 2885 明示“cannot be registered or shadowed”，
行 2905 连 `tools.restrict()` 都不许点名），PTC 是 tool runtime 的执行模式而非可装载模块。

### 1.1 三个必须写清楚的注册形状

| 形状 | 实例 | 对 routed mount 的含义 |
|---|---|---|
| **同步**：`inject` 齐备 → `apply()` 直接 `register` | 绝大多数模块 | 路由表在第一次 settle 前就完整；现有 TA 系列证明的就是这个形状 |
| **`ctx.inject` 延迟**：`apply()` 之后子 fiber 起来再注册 | `tool-fs.read_image`（`attachments`）、`tool-bash`/`tool-pwsh`（`jobs` 重注册） | #561 曾整包拒绝；#576 改为“跑起来再判定”：子 fiber 须 ACTIVE、只注册本 mount 转发的名、身份被 `expectedDefinitions` 跟踪；post-settle 落地则**折叠入账并 invalidate**（`a5sf-deferred/README.md` §2） |
| **事件驱动条件注册**：服务事件到才注册 | `tool-subagent`（`subagent/provider-added`） | **settle 窗口不覆盖它**：provider 缺失时它一个名字都不注册，没有 forwarded 名、没有身份检查，surface 名集也不变。provider 若在 settle 之后出现，注册会走“late registration → 折叠 + invalidate”。所以该形状的模块只有在 provider 在 mount 前已解析时才可安全采用（§3/§5.3） |

---

## 2. 采用状态（逐模块）

状态闭集沿用矩阵记法：`ADOPTED` / `CONDITIONALLY ADOPTABLE` / `NOT ADOPTABLE`（本清单内部用词，
不替代矩阵等级）。

| 模块 | 状态 | 已证明到哪 | 条件与执行点 |
|---|---|---|---|
| `dsh-tool-fs`（`read`/`write`/`edit`/`read_image`） | **ADOPTED（仅 mechanism / host-free）** | #561 per-tool realm + #569 归属/持续校验/post-settle invalidation + #574 准入 deny + #576 deferred 判定；证据 `a5sf-s1/six-arms.log`、`a5sf-assembly/green-arms.log`、`a5sf-p0/green-assembly-c1.log`、`a5sf-deferred/{green-probe.log,all-a5sf-node-suites.log}` | 条件=①`attachments` 可解析时 deferred 子 fiber 必须在 20 个 macrotask 内 settle（否则 fail-closed 拒绝）；②归属必须唯一（见 §5）；③Member ctx 必须能挂 `tools/change` 与 `tools/pre-execute`（挂不上即 typed 拒绝，不静默降级——`mount.ts` 行 928-974）；④live 六行从未运行（`a5sf-acceptance/README.md`）。执行点：`mount.ts` + `a5sf-realm-row.mjs`，均 host-free 验证 |
| `dsh-tool-fs-search`（`grep`/`glob`） | **CONDITIONALLY ADOPTABLE** | 无 routed-native 证据；模块同步、依赖 `subprocess`，不依赖 `fs` | 条件=①每 binding 的 subprocess Provider 必须是 OS 受限的（P1-07 机制已测，工具级未接线）；②argv 不可注入越界路径；③有 OS 真实拒读负控才能进矩阵。尚无任何 arm |
| `dsh-tool-str-replace-editor` | **CONDITIONALLY ADOPTABLE** | 模块同步、`inject=["tools","fs"]`；**不在产品 preset** | 条件=①若采用，先加产品 preset 行（这是产品变更，不是本 lane 能做的）；②它只注册 `str_replace_editor`，不与 `read`/`write`/`edit` 争名 → 归属可解析；③逐工具拒绝需自有 arm |
| `dsh-tool-bash` / `dsh-tool-pwsh`（瞬态） | **CONDITIONALLY ADOPTABLE** | 模块同步 + `jobs` 延迟重注册；截至本清单**没有**任何 routed-native arm 覆盖这条 `ctx.inject(["jobs"])` 路径 | 条件=①该延迟子 fiber 必须实测（ACCEPT 或 REFUSE 都要有记录，不能靠 `tool-fs` 的 `attachments` 形状外推）；②`shell` Provider 必须 OS 受限（P1-07/08 机制级）；③`network` 拒绝可达 |
| `dsh-tool-bash-persistent` / `dsh-tool-pwsh-persistent` | **CONDITIONALLY ADOPTABLE** | 模块同步、`inject=["tools","terminals"]`；minimal preset 已挂 | 条件=①真实 PTY 仍是测试 double（P1-08 已披露）→ 真 PTY 端口后才能验收；②旧代 PTY 拒用、撤权先于首个 await 的机制须在该 binding realm 下复验 |
| `dsh-tool-terminal` | **CONDITIONALLY ADOPTABLE** | 模块同步；6 个工具名已核实；**不在产品 preset** | 条件=①terminal backend 的读写轴由 OS 限制；②工具名集合与矩阵一致（本清单更正：**无 `terminal_kill`**，是 `terminal_signal`/`terminal_list`）；③无 routed-native arm |
| `dsh-tool-lsp` | **CONDITIONALLY ADOPTABLE / 可能是 UNSUPPORTED** | 模块同步；不在产品 preset；server 启动位置未 trace | 条件=①language server 子进程的 cwd/代码库只读可被本机 OS 限制；②否则按矩阵 M-12 记 UNSUPPORTED；③需要 trace 才能判断 |
| `dsh-tool-web` | **CONDITIONALLY ADOPTABLE** | 模块同步、依赖 `ctx.web`；矩阵 network=restricted 本轮 UNSUPPORTED（无目的地粒度） | 条件=①network 只有布尔 allow/deny，**没有目的地粒度**；②provider 内部网络不受本机 OS 限制（matrix M-14 已披露）；③不得复用旧 `web-family` PASS |
| `dsh-tool-goal` / `todo` / `jobs` / `ask-user` / `session-query` / `subagent-control` / `workflow` / `ralph` / `cordis` / `workspace-dependencies` | **NOT ADOPTABLE via routed-native（本阶段）** | 它们的数据面是宿主状态/编排，不是工作区 I/O；矩阵 M-19/M-20 用 Alpha.4 调用准入覆盖 | 把它们塞进 `a5sfNativeToolModules` 只会**放大 `observeOnly` 探针成本**而换不到 confined Provider 的收益，还引入第二套归属问题；`tool-present`/`tool-skill` 若被证明读用户文件，则按矩阵 M-20 的条件单列，不走本批 |
| `dsh-tool-subagent` | **NOT ADOPTABLE（本阶段）** | 事件驱动条件注册（§1.1）；`inject` 含 `subagents`/`tools`/`systemPrompt`/`sessionProjections` | 行为上是 agent 编排而非受管 I/O；且 provider 缺失形状不被 settle 窗口覆盖（§5.3）。未来若要采用，先证明 provider 在 mount 前已解析，并有该形状的专属 arm |
| `dsh-experimental-tool-agent-team` | **NOT ADOPTABLE** | experimental/pre-stable；自带团队工具平面 | 与 vNext 的 Team 工具平面冲突（第二套 team 控制面），且上游以 experimental 发布；不满足“一个权威” |
| `run_code` / PTC | **NOT ADOPTABLE** | 保留名，不可 register/shadow（`packages/core/tools/lib/index.js:2885`） | 无 routed-native 接入面；PTC 是执行模式。矩阵 M-11 维持 `NOT_WIRED`，不应被读作“接线待办” |

---

## 3. 退役清单（BL-21..BL-26 范围）

**硬前提（本清单的结论）**：截至 `d0cbef9af`，routed-native 路径**只对 `dsh-tool-fs` 有 host-free
证据**，且产品 composition 里**没有任何** `a5sfNativeToolModules` 配置（§0 第 5 条）。旧 family 平面
仍是 `packages/runtime/src/plugin/live/team-tool-plane.mjs` 的生产路径（`createGovernedToolDefinitions`、
`FAMILY_INDEX` 仍在 import）。所以本阶段只能做 **freeze**：`delete` 一个都不允许。

沿用 `a5sf-reclaim/ASSET-RECLAMATION-REGISTRY.md` 的 R5 行与 standing rule
**freeze → parity → switch → delete，never delete evidence**：

| 旧资产（R5 行） | 现状态 | 被 routed-native 取代了吗 | 本阶段动作 | 保留什么 |
|---|---|---|---|---|
| `packages/tools/fs-family`（R5-a） | 仍是生产 family 路径 | **仅 host-free 的 FS 半场**（#561+ 的 mounted realm 只在证据 profile 里跑过） | **freeze**：不加新行为、不修 bug 以外的东西 | golden vectors、`a5sf-r5/VECTOR-INVENTORY.md`、旧失败样本 |
| `packages/tools/process-family`（R5-b） | 生产路径 | **没有**（`tool-bash*`/`terminal` 未 adopted） | **freeze**，退役条件未触发 | 真实 PTY/P1-08 证据、旧生命周期用例 |
| `packages/tools/search-family`（R5-c） | 生产路径 | **没有**（`grep`/`glob` 未 adopted） | **freeze** | 函数级回归 + 失败样本 |
| `packages/tools/web-family`（R5-d） | 生产路径 | **没有**；旧 admission-only 从来不是 network 硬上界 | **freeze**；继续禁止把旧 PASS 当 network 证据 | 历史 PASS 记录（只作历史索引） |
| `packages/tools/a5p5-tools` 的 EffectSet（R5-e） | 仍被 `team-tool-plane.mjs` 与多个 runtime 测试引用 | **没有** | **freeze**；删除条件 = 无 importer（当前**不满足**） | EffectSet 的历史语义记录 |
| `packages/tools/families/*` + `family-assembly`（R5-f） | 仍是生产装配路径 | **没有**（P3 native coverage 未达成） | **freeze**；保留“不得新增 importer”的 grep gate | `families/manifest.json`、旧 family 测试 |
| 旧全工具覆盖矩阵的 PASS 状态（R5-g） | 历史 | n/a | 永不折算进 G2–G4 | 原样保留（历史索引） |
| `dev/agent-workflow/evidence/a5sf-*`（含本清单引用的全部目录） | 证据 | n/a | **禁止删除、禁止改写**；新增只追加 | 全部 RUN record / ledger / log |

**可以删的**：本阶段没有。任何 `delete` 都必须先有（a）该工具族的 native parity 证据、（b）live 或
host-free parity 与负控、（c）release gate 在无旧 body 的情况下通过；本清单只记录门槛，不发起删除。

---

## 4. 第二个原生模块的门槛（ceiling / interaction 问题）

采用第二个模块会同时改变两件事：**`observeOnly` 探针成本按模块数线性增长**（每个模块多一次
`apply`，见 `a5sf-realm-row.mjs` 的 `observeNativeToolOwnership`，行 668-680；`a5sf-assembly/README.md`
§9 把“模块契约是否幂等/无副作用”列为**未 enforced**的残余风险），以及**归属探针必须能区分 owner**。
在第二个模块被 admit 之前，下面每一条都必须为真；右侧注明**今天代码是否强制**：

| # | 必须为真 | 今天谁强制 |
|---|---|---|
| 1 | 每个被 mount 的 `ToolBinding` 名必须**恰好一个**已配置模块注册 | **是**：`A5SF_BINDING_OWNER_UNRESOLVED` / `A5SF_BINDING_OWNER_AMBIGUOUS`（`a5sf-realm-row.mjs` 行 590-604；`a5sf-assembly.test.mjs` 行 538） |
| 2 | 模块真实 mount 的注册集合必须**复现**它的归属探针观测 | **是**：`A5SF_MODULE_OBSERVATION_UNREPRODUCED`（行 448；assembly README §3.6） |
| 3 | 任何 forwarded 名都必须有**定义身份**覆盖（不能只比名字） | **是**：`expectedDefinitions` / `definitionIdentities` + `tools.get` 身份比较（`a5sf-s1/README.md` §3.1；TA11） |
| 4 | 不能有“未被本 attach 转发”的名字获得执行 | **是**：uncovered-name refusal + 每 mount 路由表（`a5sf-deferred/README.md` §2.3 第 5 点；TA14） |
| 5 | settle 之后才落地的注册必须**折叠入账并 invalidate**，不能逃逸 | **是**：post-settle fold + `a5sf-native-invalidation/1`（`a5sf-deferred/README.md` §2.4；`mount.ts` 行 770） |
| 6 | 失效之后，该 Member 的受管工具调用必须**在准入被拒**（不是回落到 preset 定义） | **是**：#574 `tools/pre-execute` admission deny（`a5sf-p0/README.md` §3；P0-1/P0-3） |
| 7 | 模块的 prompt 段必须叫 `tool:<name>`（否则只进 ceiling fiber，模型可见面可能不平） | **部分**：路由按名转发，surface-neutrality 检查会拒绝名集变化，但**没有**“段名必须合规”的静态检查（`a5sf-s1/README.md` §3/§7.2 披露） |
| 8 | 模块的 `apply` 必须可安全重复执行（探针会多跑一次） | **否**：这是模块作者契约；ruling §0.3 明确把 `observeOnly` 限定为“已验证可安全重复装载的模块”，代码不校验幂等/无副作用（assembly §9） |
| 9 | 事件驱动条件注册（provider 缺失形状）必须被覆盖 | **否**：settle 窗口只等已创建的 fiber；provider 缺失时零注册、零 forwarded 名、零身份检查（§1.1/§5.3）。需要 per-module arm 或“provider 先于 mount 解析”的前置拒绝 |
| 10 | 第二个模块不得与第一个模块**共享工具名** | **部分**：无 binding 时 row 直接返回、不做归属观测（`nativeToolMountsOf` 的 `identities.length === 0` 分支），两个 ceiling mount 会重复注册；`ToolRuntime` 对同 scope 重复名直接抛错（`packages/core/tools/lib/index.js:2634`）→ 仍是 fail-closed，但没有专门的 typed 诊断 |

**结论**：1–6 已由代码强制，7–8 是契约/披露，9 是**当前不成立的缺口**。因此第二个模块的准入判据
应是：**同步注册（或延迟依赖可解析且可 settle）+ 工具名与既有模块不相交 + provider 在 mount 前已解析**；
在这个形状上，`dsh-tool-fs-search`、`dsh-tool-str-replace-editor` 是代价最小的候选（同步、无延迟依赖），
而 `dsh-tool-subagent` 这类事件驱动模块应先补专属 arm。

---

## 5. 与 2026-11-03 装配复杂度裁决的交叉核对

裁决原文（`ALPHA5-SANDBOX-BACKLOG.md` §0，2026-11-03 块，源自 #572）第 2 条要求：
**工具归属的优先输入 = 既有 `TrustedToolRegistry`**，只加一层“模块→工具归属”薄元数据，
不新建第二套权限权威；第 6 条把 `read_image` 记为 P3 条件性不支持项；第 3 条限定 `observeOnly`
只用于已验证可安全重复装载的模块。

### 5.1 实际检查结果：本仓库没有模块→工具清单

| 候选来源 | 实际内容 | 能否回答“哪个模块提供哪些工具” |
|---|---|---|
| `packages/tools/families/manifest.json` | 8 个 family 的 `module` 文件名 + `sha256` + `kernelCapabilities` | **否**：没有工具名 |
| 上游 `PresetDefinition`（`packages/preset/agent-preset-registry/src/definition.ts:5-11`） | `id`/`name`/`description`/`order`/`plugins` | **否**：没有 tool 列表 |
| 本仓库 `a5sfNativeToolModules`（`packages/runtime/src/plugin/types.ts:251`） | `string \| {url, config?}[]` | **否**：只有模块说明符/配置，没有工具名、没有摘要 |
| `TrustedToolRegistry`（`packages/runtime/member-io-policy/src/trust-registry.ts`） | 注册键 = `(scope, toolName)`，校验 `packageDigest`/`dependencyDigest`/`definitionGeneration` | **否**：逐工具信任，不是逐模块归属；且当前**只有测试**在注册（`grep registerTrustedBinding` 仅命中 `packages/runtime/test/a5sf-trust-registry.test.ts`），没有生产 loader 提供 digest |
| 产品 preset 注册表（`packages/bundle/web-app/presets/*.patch.yml`） | 插件行（`id`/`name`/`config`/`disabled`） | **部分**：能回答“哪个模块被挂载”，仍不能回答“它注册什么工具” |

这与 `a5sf-p0/README.md` §6 的核对表一致（该表明确写 `PresetDefinition` = “**No** — no tool-name
inventory”），也与 `a5sf-deferred/README.md` §2/§9 的“不建第二套 registry / 不建通用 loader”纪律一致。
**所以裁决第 2 条今天不可执行**：不是实现难度问题，是输入事实不存在。

### 5.2 `read_image`：裁决早于机制变更

裁决第 6 条写“`read_image` 记为 P3 条件性不支持项（延迟注册、`attachments` 依赖）”，其依据是
**#561 的整包拒绝**。**#576** 之后，延迟注册不再等于不支持：子 fiber 可以跑在 router 形状的环境里，
只要它 ACTIVE、只注册被转发的名、身份被跟踪，且在 post-settle 落地时折叠+invalidate，就**接受**。
所以矩阵把 `read_image` 记为 `BOUNDED-DEFER`（条件性支持机制，限制=可解析 `attachments` + 20-round
settle bound），而不是 `UNSUPPORTED`；裁决中“不得靠改登记名或复用 Team 自研 read_image 声称原生兼容”
的禁令**仍然有效**。本清单不改裁决原文，只记录“裁决所依据的机制已被 #576 取代”这一事实。

### 5.3 事件驱动注册：裁决没有覆盖的第三形状

裁决第 3 条只谈 `observeOnly` 探针与延迟注册；**事件驱动条件注册**（`tool-subagent` 的
`subagent/provider-added`）是两者之外：它不创建待 settle 的 fiber，也不在 `ctx.inject` 里。后果见 §1.1/§4 第 9 条。
本阶段不提议修它（不在此 lane 的授权与预算内），只把它记为**采用第二个模块时必须先补的判据**。

### 5.4 让 trusted-registry 路线以后可行需要什么（只记录，不提议现在建）

1. **模块身份**：`a5sfNativeToolModules` 的每个条目需要 loader 提供的 source URL + content digest
   （今天只有 `url`/`config`）。
2. **模块→工具集合**：要么由模块声明（静态清单），要么由 loader 在一次可信装载点上观测并落账；
   不能靠名称猜。
3. **按 digest 索引的映射**：mount 时用“模块 digest → 工具集合”解析归属，以**替代**每次 mount 的
   `observeOnly` 探针（这是裁决第 4 条允许的“登记只能消掉探针那一次”）。
4. **一个消费 `TrustedToolRegistry` 的生产注册者**：loader 在注册时写入
   `(scope, toolName, packageDigest, dependencyDigest, definitionGeneration)`；今天没有。
5. **不新增第二套权限权威**：归属只回答“谁提供 `read`”，不回答“`read` 能读什么”（裁决第 2 条）。

满足 1–4 之前，`observeOnly` 观测是唯一诚实的归属输入；满足之后，它可以被登记替代，
但**不是本阶段的工作项**。

---

## 6. 本清单不主张什么

- **不是** booted Host 的运行时枚举：动态 MCP/插件来源仍 `NOT_TESTED`；`a5sf-acceptance` 的六行
  live 验收从未执行（`TOOL-ACCEPTANCE-MATRIX.md` §1.1）。
- **不分配验收等级**：矩阵是唯一合同；本清单的 `ADOPTED` 只表示“机制已有 host-free 证据”，
  不等于 `DONE`/`LIVE-CONFIRMED`。
- **不发起删除**：§3 全部是 freeze；`never delete evidence`。
- **不改上游**：所有“条件”都通过公开 seam 或产品 composition 表达，`CORE PATCH BUDGET = 0`。
