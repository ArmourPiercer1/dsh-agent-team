# GAP-LEGS.md — B③ 三缺腿实际缺口探测（R 路，E 路派单 根 08:4xZ）

- 写者=R（read-only 纪律；本目录+两 inventory 文件为我的 writer 面）；时刻=2026-10-19 ≈08:5xZ（实际 UTC 见 commit）。
- 纪律：**不真宿主启动**（真装归 lane）；静态可定=钉 file:line；需真装才定=命令级验收脚本草案（同目录）+归属路。冻结计划原文=`docs/plans/memo/alpha5-tool-io-governance/ADR-alpha5-tool-io-governance.md`（ADR）+`alpha5-s0-pr0-pr8-implementation-plan.md`（PLAN），现场 grep 亲引。
- 引用注：`E/`=dev/agent-workflow/evidence/；宿主树=主检出 `tests/deepseek-harness-test-use`@639ed01539；rev6 顺带修正 `E/prod-lsp/ci-304`→`E/alpha5/prod-lsp/ci-304`（两 inventory 文件）。

## 腿① LSP 装面腿

**现状（静态钉死）**
- plane 层**无 lsp 行且永不可有**：`verifyPlaneNames` 的 names map 封闭于 grep/glob/bash 三类（`team-tool-plane.mjs:327-330`），supported takeover 仅 `bash@bash`/`read@read`（`:321-325`）；lsp 的 plane CLAIM=钉拒（`:263`，拒形 `PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED`）。⇒「Team realm 装配下 lsp 可挂性」=模型面**不存在 lsp plane 行**；Team 侧 LSP 治理实体=realm 装配 provider（`plane-effect-backends.mjs:13/:554` P-LSP spawnStreaming 臂），kit/CI 形在码，非模型面挂载行。
- 模型面 lsp 唯一形态=**host 原生名 + per-call 车道**：lsp ∈ 逐次治理闭集 file-class（`operation-permission/types.ts:46/:56-65`、`canonical-operation.ts:699` case 'lsp'、listener 装配 `glue:3019`）——**检查层对 lsp 是真的**；setup 门 class-1 通过（`schema.ts:426`）。
- 挂载前置=宿主 profile 显式行：`tool-lsp` shipped 而**全 preset 零挂载行**（rev3 主检出亲 grep `packages/bundle/**/*.yml`）；试用 profile 未挂 lsp=profile 缺项（M28 行在册）。
- R-B4 结论复核=**现势成立**：realm 粒度=纯装配非阻塞；**policyGeneration 全键池=CORE_SEAM_BLOCKER**（`E/alpha5/LSP-rulings-brief.md:24-25`，引 GAP:40-42/GAP:48/SV:60；"全键扩展只登记不启动"）；realm 形真实验收=`#306` 30/30×2 + CI receipts `E/alpha5/prod-lsp/ci-304/`（coload 8/0）。
**与冻结计划条款差**：PLAN:142 要求池键至少 `(Member,Realm,Provider,Workspace,PolicyGeneration)`——现状=realm 粒度达成、**PolicyGeneration 键=上游缺口**（已裁 CORE_SEAM_BLOCKER，登记不启动）；PLAN:148 PoC-6b 三择裁决=已落 realm 口径；PLAN:150「SUPPORTED 或 BOUNDED-DEFER 如实报告」=现状合规（M28/M29 如实）。**装面腿差距本体=「host lsp 挂载 + team 世界 + per-call 车道」组合从未驱动**（C 表 lsp 行"装面挂 lsp 腿未驱动"），治理链静态完备、缺端到端收据。
**最小装面验收**：草案=`leg1-lsp-mount-acceptance.sh`。世界=新 `tests/homes/<按 TEST_METHODS §7 命名>`；preset-seam=宿主 profile patch 显式加 `tool-lsp` 行（唯一可指启用面=rev3 亲核 opt-in 形）+Team 蓝图 `capabilities.permissions` 对 lsp 一 allow 一 deny 资源；判定读=session trace 的 `observe stage='canonicalized' tool='lsp'` 串 + deny 腿 typed deny verbatim + allow 腿真 server 应答（clangd 在位=试用机已证）。
**归属**：装面 writer = 跑过 `#304/#306` 的 prod-lsp 同路（持有 realm kit 语境），A 线真装矩阵可并跑其 per-call 半。

## 腿② subagent 成员车道端到端

**现状（静态钉死）**
- 挂载条件（主检出 rev3 亲 grep）：`subagent`/`subagent_fork`=缺省已挂（`packages/bundle/base/cordis.patch.yml:370/:383`；web-app `:531/:534`）；`subagent_codex`/`subagent_claude_code`=仅 `packages/bundle/web-app/presets/cordis.patch.yml:102/:110` 挂且 shipped-default-**disabled**（C 表预防钉行在册）。
- 车道差距分形：①strict 成员=subagent/subagent_fork ∈ KNOWN_SENSITIVE（`permission-coverage.ts:153-154`，注册表注释原文 "generic subagent / workflow orchestration **escapes MemberInstance governance**"）→setup FATAL typed——**strict 成员带 subagent=跑不起来（响亮，静态可定，非暗通道）**；②非 strict 成员=host 原生直通（`pre-execute-adapter.ts:1240-1242` `classifyPermissionTool→unsupported→await next()`，不进 canonicalize/resolve/guard 链 `:1245+`）；③Team 面对 subagent 的唯一生产治理消费=归档 drain（`glue:4915/:4955-4962` drainContinuableDescendants，absent→拒）+钉反冒名。
**与冻结计划条款差**：ADR:69「Govern every tool that can actually dispatch from a Team Agent … T_dispatchable(scope) ⊆ T_governed(scope)」——非 strict 成员的 subagent=dispatchable 而 per-call 无治理（drain=生命周期面非审批车道）⇒ **缺口静态判定=成立**（同 ADR 条款也是腿③判据，两腿同源）。冻结计划无 subagent 专项装面条款（现场 grep ADR+PLAN 无 subagent 装面条款，如实）。
**最小验收（一条链跑通即算）**：草案=`leg2-subagent-lane-acceptance.sh`。链=非 strict 蓝图成员被委派→成员面真起 subagent→子代理完成回报→成员 collect→成员 archive→**drain 观察计数归零无残留**；配套负控=同蓝图 strict 形→setup typed `alpha2-permission-coverage-unmanaged-tools` 点名 subagent/subagent_fork（门=治理面在场证明）。
**归属**：能驱动 MemberInstance 会话的真装路=**A 线**（三层矩阵真装同世界并跑，负控可纯 setup 级先跑）。

## 腿③ MCP×治理执行

**现状（静态钉死——回答"是否过 pre-execute 治理面"）**
- **不过**。链完整可指：MCP 名 setup=class-3 `OTHER_MANAGED_MCP` 通过门（`permission-coverage.ts:304-306`；归属证明=挂载 delta 法 `mcpIntroducedToolNames :388-394`）；运行时=`pre-execute-adapter.ts:1240-1242`——`classifyPermissionTool(name)`（`canonical-operation.ts:260-268` 闭集=7 名）对 `mcp__*` 返回 `unsupported` →**`return await next()` 直通执行**，canonicalize/规则 resolve/last-mile guard（`:1245+/:2160+`）全部不进。`mcp__` 前缀另被 plane 冒名钉穷尽（`team-tool-plane.mjs:320`），供给校验在（`mcp-supply.ts:33,70`）——两者均非 per-call 治理。⇒ **治理闭集外=钉死**：MCP 工具在 strict 蓝图下 per-call 无 allow/ask/deny 车道、无 guard、无指纹。
**与冻结计划条款差**：ADR:69 明列 MCP registration 须入 T_governed——**per-call 面现状违反该条款，如实不美化**；PLAN:70「除可信/显式 Binding 外未知工具 **deny**，包括 after-setup Own layer」；PLAN:74 强制负控 **H6「`hc-dyn-observation.dynRan=true` 必须变为 deny」**=计划自须的负控至今未成对 MCP 车道专测；PLAN §10:158=PR7 行（MCP 动态列表随时治理/stdio ConfinedProcess/remote 在真 Provider 端强制）=**既定延期行**（关联 M31）。⇒ 缺口定性=**延期行未收 + H6 负控未跑**，非"从未计划"。
**最小正负控设计**：草案=`leg3-mcp-governance-posneg.sh`。世界+一个 fixture stdio MCP server 暴露 `mcp__a5probe__echo`；**负控（预期红=现状复现）**=strict 蓝图无显式 allow→调用→现状=执行成功（dynRan=true 记账，PLAN:74 判据），目标态=typed deny；**正控**=同世界 host `read` deny 腿仍 typed deny（证明直通非全局失效）+team_grep 别名行不受扰。允许结局=按 PLAN:150 如实 `UNSUPPORTED/BOUNDED-DEFER` 入账（延期行合法收口形），禁"治理已覆盖"表述。
**归属**：PR7 行 writer（M31 同路）主责；**现状红账（dynRan=true 复现）可归 A 线真装顺跑**，属"预期红"证据不属缺陷修复。

## 汇总（对账用一句话）

三腿同源判据=ADR:69 dispatchable⊆governed：LSP=检查链完备只差装面收据（最薄）；subagent=strict 响亮拒/非 strict 直通+drain，缺一条端到端链；MCP=per-call 治理面**结构性缺席**（监听器 unsupported 直通，`:1240-1242`），属 PR7 延期行+H6 负控未跑。三草案脚本均为**未执行草案**（R 禁真装），执行即由归属路落各自 evidence。

## 附注一 · F-6 复核（E 续，根 09:3xZ；现场=主检出宿主树+F runs 只读）

**裁定=口径差+误查（三层叠加），「本宿主构建无模型面 subagent 工具」不成立；F 腿②实质账（typed FATAL 点名 web_fetch/web_search）仍立。**
- (a) **grep 面错**：`subagent_fork` 的注册名是 **config 路由**——`@deepseek-ai/dsh-tool-subagent` 同包两次挂行，`src/index.ts:323` `const toolName = config.toolName ?? 'subagent'` → `:380` `name: toolName`；包源码/lib 零字面（F 全包 grep=0 在源码面为真，但名只在 bundle yml 配置+目录脚本：base `cordis.patch.yml:375` `toolName: subagent`、`:387` `toolName: subagent_fork`；`scripts/gen-tool-catalog.ts:538 shippedNames:['subagent','subagent_fork']`——父抽查两处现场亲验）。
- (b) **挂载形错**：F 世界 leg2 行挂的是**服务包** `packages/subagent/subagent/lib/index.js`（终值 run `cordis.patch.yml:73-74` 亲读），非 tool 行形；服务包无模型工具且与 boot 已注册服务冲突=响亮 fail-closed（F-6 原文）——正确行为，但那是服务面不是工具面。
- (c) **preset 形**：`a5legs-sub` 自建 preset（"production row + p6t6 + preset + 显式 subagent 行"）未含 base 的 tool-subagent 两行 ⇒ 活体面无 subagent/subagent_fork（F-5 面 20-21 名+leg2 门只点名 web 对=自洽）。
⇒ 修正路径（给 A/F 续跑）：与 F-2 同款 **file-URL tool 行** + `config: {provider: spawn|fork, toolName: subagent|subagent_fork, backgroundMode}` 两行，即上活体面；npm 裸名行形在 F runner 不可解析（F-2 先例）。F 的「构建不可达」措辞应收窄为「F 世界挂载形不可达」。

## 附注二 · F-1/leg1 trace 判定读一致性（与 §C2 静态注对账）

- §C2 检查层结论**不受影响且获运行级背书**：消费点=决策链本身（`glue:3019` listener + `canonical-operation.ts:699`），F 腿① deny verbatim（`effective deny; decided by template(leader) deny[lane index 0]`）+ fail-closed 原文即检查层为真的运行时收据。
- **F-1 因果句修正**：glue **有接** onObserve——listener options 内 `glue:3122-3124`（`onObserve: (row) => observations.push('alpha2-perm: '+JSON.stringify(row))`）；`observe()` 非短路（`pre-execute-adapter.ts:914` 判的是"未传"，生产传了）。真相=**sink 不是宿主日志**：行闭包数组 `observations`（声明 `glue:779`，挂出 `glue:5355` row handle）在生产装配中无 log sink（全仓 `.observations` 消费者仅 `s6-remote.ts:2618`=environmentFacts 另一观察集，非此数组）。⇒ F「host 日志零出现」观测成立、判据 L1-TRACE-CANON 红可保留，但归因应从"未接 onObserve"改"接了、sink=row handle"。
- **leg1 判定读口径修订**：`canonicalized` 行第三形态=**in-process row-handle `observations` 数组**（kit/runner 直读，前缀 `alpha2-perm:`），或 F 的替代 wire 读；**宿主日志读法无效**（已无 sink）。本文件草案 leg1 §[4a] 的"读 session trace"按此收窄。
