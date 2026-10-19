# MCP-WIRING-PROPOSAL.md — `mcp__*` per-call 治理接线修复提案（design-only，R 路，根 09:3xZ ③后半）

状态=**提案/未实施**（R 无代码 writer 面；本文件=design 交付）。运行级收据=F leg3（`gap-legs-f/`，F 并行复跑读数到后再追注，占位）。

## 0. 问题陈述（两层直过，比 leg③ 更精确——guard 层新细化）

- **车道层缺席（leg③ 已钉）**：`pre-execute-adapter.ts:1240-1242`——`classifyPermissionTool` 闭集=7 名（`canonical-operation.ts:260-268`），`mcp__*` → `unsupported` → `return await next()`，canonicalize/规则 resolve/last-mile guard 全不进。setup 门 class-3（`permission-coverage.ts:304-306`+`mcpIntroducedToolNames :388-394`）只做**归因**不做判定。
- **guard 层=以 verified-native 身份直过（本轮现场新增）**：Team 装配面的 closed-world guard（PR1 tool-dispatch：`tool-dispatch/index.ts:8-15` 自述其覆盖对象明含 "an MCP hot mount"）取 `nativeNames = agentCtx.tools.schemas()` 全局面（`glue:2298-2309`），**未对 `mcp__` 前缀做任何过滤** ⇒ mcp__ 名被绑成 verified-native（binding 稳定性受 guard 管，但**永不进 UNVERIFIED-refuse 道**）。F leg3 世界同场自证=guard 在位（read allow 落点撞 `Tool Binding … cannot be verified … no fallback to the native body`），而 mcp 调用照常执行=其绑定形为 native。
- 合起来的准确缺口句：**mcp__ 名 = guard-native + lane-out**；ADR:69（T_dispatchable⊆T_governed，MCP 在列）与 PLAN:70（未知工具 deny，除可信/显式 Binding）在 per-call 面未兑现；PLAN:74 H6 收据已由 F leg3 落成现状红账（dynRan=true）。

## 1. PR249 已批路线边界（本提案全部落点在此内）

- adapter 优先 = 外部插件 + 公开 seam；**tool-level bounded fork 非 core**；CORE PATCH BUDGET=0。
- 本提案全部改动落点=**本仓 `packages/runtime/*` 与 `packages/domain/blueprint`（后者仅选项 A 触及）**，宿主树零触；所需公开 seam 全部现有：`agentCtx.on('tools/pre-execute')`、`agentCtx.tools.schemas()/register/restrict`、profile-patch 行、mcp 供给观测面（`mcp-supply.ts:33,70`；glue `mcp__<server>__*` 前缀跟踪 `:1431-1467`）。

## 2. 选项

### 选项 B（推荐第一步）：guard 装配面把 `mcp__*` 从 native 绑除 → UNVERIFIED-refuse-unless-bound
- **落点**：`glue:2302-2306` 的 `nativeNames` 采集处加一条前缀滤除（`mcp__` 不继承 native 信任）；其余全部复用现机制——UNVERIFIED→dispatch 拒（`no fallback to the native body` 形，F leg3 read 落点已录 verbatim）+「可信/显式 Tool Binding」放行=PR0 冻结代数（`domain/tool-governance`）原语义。
- **性质**：这不是新行为，是**兑现 PLAN:70 已批语义**（"除可信/显式 Binding 外未知工具 deny"——mcp__ 恰是"非可信绑定"类）；语义=二元（拒/放），无 ask。
- **改动面**：一处装配过滤 + 单测（mcp 名 bound→放 / unbound→拒 + 热挂载 monotonic 复用既有 NEG 套件）+ 一条负控（F leg3 目标态翻正：typed 拒且 fixture 计数不 +1）。**风险**：低；影响面=Team agent-scoped（非 Team 宿主会话不受 touch，PR1 不变量原文）；既有世界若隐式依赖 mcp 原生直过会被响亮拒——正是 ENFORCE 方向。
- **与 PR7 关系**：正交且互补——PR7 管 server 侧效应边界（ConfinedProcess/remote provider 强制），B 只管"未绑不信"。**归属**：plane/glue 装配路（a5p7/glue 线，持 installScopedToolGuard 语境）；负控复跑=F runner。

### 选项 C（推荐第二步）：MCP governed-alias 挂载 = grep/glob 先例同族（adapter-first 正文）
- **形**：不救原生名的车道，而是**以别名受治理行挂载**——grep/glob takeover=空→`team_grep/team_glob` 别名行中介的先例（`DEFAULT_PLANE_NAMES:83`+search/glob backends）平移到 MCP：新 plane backend 行按 server 枚举工具（供给面已有：`mcp-supply.ts` + `tools/change` 观测 + glue 前缀跟踪 `:1467`），模型面只出别名名，lane/guard/fingerprint 全走 plane 行现成治理链。
- **性质**=PR249 "adapter 优先" 的直系实现（bounded adapter 中介，不 core fork，不 blueprint schema 变更——`mcp__` 前缀钉只拒 plane **冒名原生**，我们的别名不用该前缀，不触钉）。
- **改动面**：新 backend 模块（对齐 `search-backend.mjs`/`glob-backend.mjs` 形）+ plane names 闭 map 扩 MCP 类（`verifyPlaneNames:327-336` 现封闭于 grep/glob/bash——**这是 plane 自有 map 的扩展，非宿主面**）+ per-call 透传到 MCP client（`@deepseek-ai/dsh-mcp-client` 公开包，glue:342 已 import）。
- **风险**：中——(i) 效应不可知性不因此消失：别名行只能承诺"server 名+工具名+参数指纹"粒度，**效果语义宣称禁止**（披露纪律，同 shell-class 推理 `types.ts:67+`）；(ii) ask 道需 durable 审批 case 的 fingerprint 先例=shell 类已有，可复用；(iii) 热挂载/撤销的代际=Plane 代际语义要新条目（关联 M30 行）。
- **与 PR7 关系**：C 的 ConfinedProcess/remote-provider 半壁仍归 PR7 延期行；C 先收"Team 侧决策与寻址"半壁，PR7 收口时在此形上续接，不返工。**归属**：tools plane backends 线（glob/search backend 同路）。

### 选项 A（备选，须 schema 裁决才开）：canonicalizer/lane 直吃 `mcp__` 资源形
- 形：`classifyPermissionTool` 加 `mcp` class（`mcp__<server>__<tool>` 解析）→ canonical-operation 投影（resource=server/tool，tool-level 类，args 只哈希不入投影——read_image 先例 `canonical-operation.ts:70`）→ 规则 resolve 接 `permissions.default`（deny 世界即闭缺口，allow/ask 需规则可指）。
- **拦路石=封闭 schema**：蓝图 lane 规则词表闭集 `PERMISSION_TOOL_NAMES`（`schema.ts:421-429`）与 v4 蓝图封闭字段集是冻结域——"哪个字段声明 MCP 车道规则"=**蓝图 schema 变更，需根/用户裁决**，R 不预设。setup 门已 class-3 归因 ⇒ A 若行，车道语义应复用该归因（门 detail 的 server 名→规则键），避免第二套 MCP 身份代数。
- 改动面最大（types/canonical/resolver/plane 编译/validate/tests 五处+schema 裁决），**不建议在本窗口开**；列为 B/C 落地后的长期并轨项。

## 3. 推荐路线与验收形

1. **B 先行**（兑现 PLAN:70 原文，最小面，无 schema 触碰）→ F leg3 套件目标态翻正=主收据（typed 拒 + fixture 计数不增 + `mcp-fixture-calls.log` 零增量），H6 台账（PLAN:74）由现状红改收口注。
2. **C 随后**（adapter-first 正文，给"可用治理"非仅二元拒）；acceptance=别名行上 allow/ask/deny 三腿（shell 类先例形）+ 热挂载负控（新 server 后到名=未绑即拒，复用 B 的红）。
3. A 挂 schema 裁决队列，不排期。
4. 全程禁表述：B 落地后不得写"MCP 治理已覆盖"——只可写"未绑 mcp__ 名 per-call 拒（决策层）；效应边界=PR7 延期行在册（M31 关联）"。

## 4. 与既有行/账的勾连

- 本表 §C2 "grep/glob 检查层=门本身"同款结构将获第四形：mcp__ 名检查层=guard-UNVERIFIED 拒（B 后）/别名行 lane（C 后）——届时 TOOLS.md C2 追一行。
- MECHANISMS：M30（MCP×治理执行）行标签由"只有模块/未测"→ B 落地后"有真实验收（拒道）"，C 落地后再升；PR7/M31 延期行不动。
- 本提案不产生任何 CORE_SEAM_BLOCKER：无一处需要宿主改动（若实施中撞上，按律升 blocker 而非绕）。
