# F-RESULTS.md — E 缺口腿可执行执行（F 路）首跑账

- 写者=F（执行路）；时刻=2026-10-19 ≈09:1xZ（UTC，见各 run 目录名）。
- 被审基线=master `cad5cf03ef9bea80fd9093087e4be597eebaf11b`；worktree=`.worktrees/a5-legs-runner`（分支 `a5-legs-runner`，node_modules 软链=主检出绝对路径）。
- 宿主=主检出 `tests/deepseek-harness-test-use` @ `639ed01539`（0.2.0-rc.2，只读；porcelain 前后=0，判据 L-PRISTINE）。
- 世界=仅 `tests/homes/a5legs-<leg>-<UTC>`（收尾删除）；端口=paths.mjs 法定族 `3491-3500`：ss 实测开工时仅 :3080 在听（401 只读探针不变）；执行期 host=3497/3498/3499、mock=3493/3495→3496、MCP fixture=3494（3495 中途被并行路占用，portFree 探针自动跳过=设计内行为）。:3080/:3180 只读探针每腿前后（判据 L-STABLE）。
- R 草案（`../gap-legs/`，R writer 面）**一字未动**；本目录 `leg*.exec.sh` = 去 DRAFT 自拒守卫（`echo "DRAFT…" >&2; exit 2` → 注释留痕）的执行映射副本；真实可执行体=`run-a5-legs-live.mjs --leg <leg>`（bash 草案的判定读在本代次宿主上必须以 .mjs 形态落地，与 natexe/live-assembly 同形）。

## 通用现场判定（三腿共用的静态↔运行时偏差）

- **F-1 判定读字符串不存在于运行时**：R 草案判定读 `observe stage='canonicalized' tool='lsp'` 串在源码里真实存在（`pre-execute-adapter.ts:1277` observe 点，R 钉的 file:line 现势成立），但 glue 装配 `installParameterPermissionListener` 的调用面（`agent-bindings.mjs:3019` 区）**未传 onObserve** → `observe()` 短路（`pre-execute-adapter.ts:914` `if (params.onObserve === undefined) return`）→ 该串在生产宿主日志零出现。替代判定读=**wire 级 tool_result 原文**（mock 转录）+ 宿主日志负证。三腿的 trace 类判据全部改走此形。
- **F-2 tool-lsp 行的启用形**：npm 名行形（`name: '@deepseek-ai/dsh-tool-lsp'` 等）在本主检出宿主上 `failed to import`（包在树、未入 app 级裸名解析面；原文=首轮 instance.log 三行）。同一公开 profile-patch seam 改以**构建产物 file-URL 行**挂同一批 shipped 包（`packages/lsp/{lsp,lsp-stdio,tool-lsp}/lib/index.js`，lsp-stdio 带 `servers.clangd.command=clangd`）→ 行激活、`lsp` 上模型面（判据 L1-MOUNT）。草案意图（唯一可指启用面=profile patch 显式行）不变。
- **F-3 seam.mjs 的 junction farm 前置**：cad5cf03 的 `root-binding/harness/seam.mjs` 顶层 import `@deepseek-ai/dsh-storage-domain`（注释自证"resolve through the harness's gitignored node_modules junction farm"）；直挂 row 不经 `run.mjs` 时 farm 不存在 → 首轮 row setup FATAL（原文 `Cannot find package '@deepseek-ai/dsh-storage-domain' imported from …__resolver__.js`）。修正=按 `run.mjs` 同源逻辑调用 `tests/characterization/lib/instance.mjs:ensureProbeResolution` 在自有 worktree harness 目录重建 farm（gitignored；不动宿主树）。
- **F-4 strict 蓝图封闭集含 `ask` 道**：`capabilities.permissions` 缺 `ask` 字段 = `MALFORMED_DTO blueprint is missing required field 'ask' at $.leader.capabilities.permissions`（team.create 原文）。草案未及此形，修正=三道齐备。
- **F-5 live 面自适配 denyList**（沿用 natexe 形）：boot root DISC 抓活体工具面 → `builtinToolDeny = 面 − MANAGED7 − team 闭集 − mcp__*`；实测该 preset 形下面=20-21 名、remainder=0（rc2-smoke 插件面无 sensitive 残留）。

## 腿① LSP 装面腿 — 三态=**达成（14/15；唯一红=判定读偏差 F-1，已按替代判定读收账）**

终值 run=`runs/a5legs-leg1-2026-10-19T09-10-55Z/`（criteria.json + run-receipt.md 逐字可核）。

- 装面成立：显式行 + clangd provider 配置 → `lsp` ∈ 活体模型面（L1-MOUNT PASS，原文见 live-surface.json）。
- 检查层对 lsp 为真：见 criteria L1-FAILCLOSED / L1-DENY / L1-ALLOW / L1-CLANGD。
- **现场新发现（运行级收据）**：宿主 tool-lsp 模型 schema 拼写 `filePath`，团队 canonicalizer 抽 `file_path`（`canonical-operation.ts:301`）⇒ **按 shipped schema 发的 lsp 调用一律 fail-closed deny（`permission denied: canonicalization failed for tool "lsp": file-path-missing`）**，allow 道亦不豁免（检查先于 body）。fail-closed 方向=安全侧，但「allow 道真应答」组合在纯 schema 形下不可达，需 `file_path`（或双写）形才进车道判定。
- 与 R 静态结论一致性：R 的「治理链静态完备、缺端到端收据」现势成立；「模型面 lsp=host 原生名+per-call 车道」成立；plane 无 lsp 行成立（本腿未触 plane 面）。R 未预见 F-5/F-1/参数拼写差三项（草案判定读三处其一不可用，已按替代判定读收账）。

## 腿③ MCP×治理负控 — 三态=**达成（14/15；唯一红=正控B NOT_RUN，如实记录）**

终值 run=`runs/a5legs-leg3-2026-10-19T09-11-03Z/`。

- 负控=**预期红即收据本体**：lane（default deny）对 `mcp__a5probe__echo` 零覆盖 → 调用**执行成功**（fixture 服务端计数 +1 原文 `mcp-fixture-calls.log`；wire 回显 `echo:A5LEG3-DYN#call1`）= `dynRan=true` 现状复现（PLAN:74 H6 首跑账）。目标态（PR7 收口后）=typed deny 且不触 server。
- 正控 A（同世界 read 对 runtime/ deny 道）：见 L3-READ-DENY 终值。
- 正控 C（read 对 team/ allow 道=哨兵原文）：见 L3-READ-ALLOW 终值。
- 结构缺席负证（L3-TRACE-ABSENT）：宿主日志无任何含 `mcp__a5probe__echo` 的 per-call 治理行（canonicalize/resolve/guard 零进入）。
- 正控 B（team_grep 别名行不受扰）：**NOT_RUN**——别名行=plane 装配产物，本世界为 unfed 形（plane 挂置属 natexe teamToolPlane 形，越出本 runner 预算），如实记录不造假。
- 偏差：fixture 形=行配置 `mcpServers:[{name:'a5probe',port}]`（该代次唯一供给形，f15 先例），非草案之 stdio；仍=全合成回环单工具服务器，草案「禁真实外部 server」意图保持。
- 与 R 静态结论一致性：R 钉的直通链（`classifyPermissionTool` 闭集 7 名外 → `return await next()`，`pre-execute-adapter.ts:1240-1242`）被运行级复现；「治理闭集外=钉死」成立。

## 腿② subagent 纯 setup 负控 — 三态=**部分达成（12/13；typed FATAL+点名=达成，reason 串运行时不可见=DTO 边界红；subagent 道本体=本宿主构建不可达，记录）**

终值 run=`runs/a5legs-leg2-2026-10-19T09-20-35Z/`。

**F-6 本宿主构建无模型面 subagent 工具**：全包 grep `subagent_fork`=0、`@deepseek-ai/dsh-tool-subagent` 仅携 `list_subagent_models`；`@deepseek-ai/dsh-subagent`=服务包（无模型工具，且装入 preset 与服务注册冲突：原文 `preset 'a5legs-sub' is broken: subagent (@deepseek-ai/dsh-subagent): service "subagents" has been registered at <SubagentRuntime>`——响亮 fail-closed，留 instance.log）。coverage 门对道不可知，故改经**同一门**的另一 KNOWN_SENSITIVE 道=tool-web（web_fetch/web_search）收账。

**运行时出口原文（wire，team.create 拒绝，逐字）**：
`team.create: starting the root (leader) agent for 'session-a5legs-leg2-main' failed: permission coverage gate failed for instance 'inst-leader': 2 unmanaged tool(s) on the final model-facing surface: web_fetch (known-sensitive-unmanaged), web_search (known-sensitive-unmanaged) (code: alpha2-permission-coverage-unmanaged-tools)`

= R 静态结论「strict 成员带 KNOWN_SENSITIVE 工具且不被 deny 面覆盖 = setup 起不来，typed 点名」**运行时逐字成立**（点名+分类逐一在场）。**F-7 DTO 边界**：`escapes MemberInstance governance` 出自 `permission-coverage.ts` 注册表 reason → `buildPermissionCoverageErrorDetail.unmanagedTools[].reason`（detail 结构），封闭 Remote DTO 只序列化 code+message、宿主日志零落行 → 该 reason 串在此世界的 wire/log 面不可见（L2-PHRASE 红，非造假）。

**F-8 面组装真相**：模型工具面=preset 行组装（boot root DISC 面与 MemberInstance 面皆然）；profile-patch 行可激活但不加模型工具（leg2 首形证）。`team.createMember` 不在封闭 Remote v1 目录（原文 `unknown-endpoint`）→ MemberInstance 治理面唯一入口=leader 的 team_* 工具/装配路径，本腿由 team.create(leader=strict 实例) 直达同一门。

- 形=preset 追加 host 默认 subagent 三行（`@deepseek-ai/dsh-subagent` / `…-spawn-in-process` / `…-fork-in-process`）使 `subagent`/`subagent_fork` 上活体面（L2-PRESET）；strict 蓝图 builtinToolDeny=活体面−MANAGED7−team 闭集 **减去 subagent/subagent_fork**（故意不覆盖）→ setup 门 typed FATAL。
- 判据=typed id `alpha2-permission-coverage-unmanaged-tools` + detail 点名 + reason 原文含「escapes MemberInstance governance」（R 注该语出自 `permission-coverage.ts` KNOWN_SENSITIVE 注册表注释；运行时出口=`buildPermissionCoverageErrorDetail` 的 `unmanagedTools[].reason` 字段——静态上该 reason 串入 detail，运行时以本跑日志为准）。
- 完整链（委派→起→collect→drain 归零）=A 线预算，未跑（草案第 5 条同判）。
- 与 R 静态结论一致性：「strict 成员带 subagent=跑不起来（响亮，静态可定，非暗通道）」=本腿验收本体；结果见 criteria L2-FATAL-TYPED / L2-NAMES / L2-PHRASE。

## 收账表（每腿三态 = 最小验收达成/部分/未达成 + 红字清单）

| 腿 | 三态 | 关键红字/收据（全部逐字在 runs/ 证据内） |
| --- | --- | --- |
| leg1 | **达成** 14/15 | deny 原文 `permission denied: lsp[...runtime/secret.c]: effective deny; decided by template(leader) deny[lane index 0, source 0]; layers (highest first): template=matched; overridden lower: none`；fail-closed 原文 `permission denied: canonicalization failed for tool "lsp": file-path-missing`；allow 落点原文 `no LSP provider handles ".../team/hello.c"`（unfed 世界 provider 派发记录） |
| leg2 | **部分** 12/13 | typed FATAL+点名原文（上节）；红=reason 串 DTO 边界（F-7）+ subagent 道构建不可达（F-6） |
| leg3 | **达成** 14/15 | gap 收据：fixture `call#1 args={"msg":"A5LEG3-DYN"}` + wire `echo:A5LEG3-DYN#call1`（dynRan=true，PLAN:74 H6 首跑）；read deny lane 原文（同上形）；read allow 落点原文 `team tool guard: the Tool Binding for "read" cannot be verified at dispatch time (no fallback to the native body)`（unfed 世界 plane-guard，非 permission deny）；红=POS-B NOT_RUN |

红字清单（不销案）：
1. `L1-TRACE-CANON` FAIL —— R 草案判定读 `observe stage='canonicalized' tool='lsp'` 零出现（F-1：glue 未接 onObserve；静态存在、运行时不产）。
2. `L3-POS-B` FAIL —— team_grep 别名行 NOT_RUN（需 plane-fed 世界；不造假）。
3. `L2-PHRASE` FAIL —— `escapes MemberInstance governance` wire/log 不可见（F-7 DTO 边界；静态成立）。
4. 现场修正记录（非红，deviation）：F-2 lsp 行 file-URL 形、F-3 junction farm 前置、F-4 `ask` 道必填、F-6 subagent 工具本构建不可达、F-8 preset=面组装真相、MCP fixture http 形（草案 stdio）、canonicalizer `file_path` vs shipped schema `filePath` 拼写差（fail-closed 方向安全）。

## 清理自证（收账）

- `tests/homes/a5legs-*` 零残留（世界全删；实测 `ls | grep a5legs` 空）。
- 端口：本路占过的 3492/3493/3496/3497/3498/3499 全部释放（ss 复核；3495=开工前他人占用，未动）。
- `:3080` 仍在听且全程只读探针（401 不变）；`:3180` unreachable 不变（L-STABLE 每腿前后）。
- 宿主 `tests/deepseek-harness-test-use` porcelain=0、HEAD=`639ed01539…` 未动（L-PRISTINE 每腿）。
- 主检出 HEAD `6259cf4b…` 未动；工作树脏项=开工前既存在他路内容，未触碰。
- R 草案原件（`.worktrees/a5-inventory/…/gap-legs/`）零改动；执行映射副本+全部产物在 `gap-legs-f/`。

---

## 复跑附注（根单 09:3xZ ③前半）— leg3 治理证据判定改读 in-process row-handle observations

终值 run=`runs/a5legs-leg3-2026-10-19T09-33-13Z/`（17/18；红仍=POS-B NOT_RUN）。

**读法修正（R 附注二，运行时确证）**：治理观察的正当通道=**in-process row handle**——glue dist `live/agent-bindings.mjs:3122-3124` 处 `installParameterPermissionListener` **确已传** `onObserve: (row) => observations.push('alpha2-perm: '+JSON.stringify(row))` → `:779` 世界级 `observations[]` → `:5355` handle 导出；p6t6 插件已把 `teamRoot.live.observations` 上挂 `GET /__p6t6/state`（`plugin.mjs:636`）。**宿主 stdout 从来不是治理通道，日志空 ≠ 无治理**。

**F-1 归因更正**：原文「glue 未传 onObserve」不成立（那是我对 stdout 判定的错误归因）；修正为「观察存在且落 row handle，stdout 不落」。L1-TRACE-CANON 的 FAIL 作为「stdout 读法下零出现」的事实保留，deviation 归因以本附注为准。

**两种预期之实测裁决=分支 (b)（GAP 收据证据升级）**：
- `L3-ROWHANDLE-CHANNEL` PASS：通道活——同世界 read 调用产出 6 条 `alpha2-perm:` 行（`{"stage":"canonicalized","callId":"call-leg3-1-…","tool":"read","resourceKind":"file",…}` 起 sample 在 p6t6-observations.json 逐字）。
- `L3-ROWOBS-MCP` PASS branch=B：`mcp__a5probe__echo` 在活通道下 **0 条** alpha2-perm 观察（canonicalize/decision/guard 零进入）。
- `L3-DYNRED2` PASS：branch=B ∧ fixture 服务端计数在场 = 缺口精确形态「**治理行零、执行照跑**」——首跑 GAP 收据（L3-DYNRED）由「stdout 空 + 执行」升级为「**正确读法下结构缺席 + 执行**」，与 `classifyPermissionTool` 闭集外直通（pre-execute-adapter.ts:1240-1242）静态钉死完全一致。
- `L3-TRACE-ABSENT` 保留为负控（stdout 非治理通道的对照）。

（无判定翻案：分支 (a) 未出现=治理面确未触 mcp__ 调用；若 PR7 收口后复跑应见 branch=A + decision:deny 行，本 runner 判据已就绪。）
