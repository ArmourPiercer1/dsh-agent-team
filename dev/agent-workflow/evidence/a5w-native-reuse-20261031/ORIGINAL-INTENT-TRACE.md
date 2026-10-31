# ORIGINAL-INTENT-TRACE — R1–R4 原始设计意图回溯与收窄定位

> 审计席：workflow C 工程基线（Native Reuse First 架构校正 Step 1）。书写时刻 = **2026-10-31T04:51Z 起（`date -u` 实测，R-CLOCK-1 锚点律）**。基线 = 本 worktree `task/a5w-nraudit-20261031` @ `f995ce7814d08578754730716e685a5b7f63bd41`（= origin/master，含 #508/#510 read_image 修复）。宿主固定 = DSH 0.2.0-rc.2 @ `639ed01539`。零 boot、零产品码改动；全部结论实读源码 / 实查 PR，引不出者标 **UNPROVEN**。
>
> 权威层级标注格式 = `[层级 | 日期]`。执行权威 = 用户 2026-10-31 直接指令（Native Reuse First 五原则）+ PR #364 当期实施计划（用户 2026-10-25 裁决 = 唯一实现计划正本）；历史 ADR/S0/post-poc = 设计需求正本（2026-10-22 banner：**「设计约束/需求正文仍有效」**，阶段状态过期）。

---

## A. R1/R2/R3/R4 在最初设计中的各自职责（原文引用）

正本 = `docs/plans/memo/alpha5-tool-io-governance/S0-SELECTION-MATRIX.md`（PR #251 merge `e89cf2b8c4`，2026-10-16）§3「R1–R4 的准确语义」[设计需求正本 | 2026-10-16]：

- **R1 = Scope Binding（范围绑定）**。原文（S0-SELECTION-MATRIX.md:35-36）：「对继承工具先 `tools.restrict({deny:[name]})`，再在 Agent Own Scope 注册 stable-identical Dispatcher/Definition。**所有普通可注册工具的基础装配**（R1 是 foundation registration，**不与 R2/R3 互斥**）。」→ R1 的职责 = **接管路由与遮蔽**（原体被遮蔽、跨 Agent 不互扰、持续 Guard、有序销毁），它要求注册**同名 Definition/Dispatcher**，但对 Definition 背后**执行体是什么不作要求**。
- **R2 = 原生体隔离重装（tool implementation route）**。原文（:37-39）：「R2 是**工具实现路线**，不是 R1 的同义扩展……使用公开 `ctx.isolate(service)` 取得与 native plugin 声明一致的 capability，再用**受信 Service Provider 在正确 Scope 重装原生工具插件**。因此可说"R2 在 R1 基础上重注册 native body"，**不能**把"重装了 native body"降格为"仍只是 R1"而忽略 tool isolation/Service 已变更。Fallback：若 `ctx.isolate(...)` 所需 Provider PENDING，应选 R3，而不是据此 Fork。」→ **原生执行体保留是原设计中的一等路线**。
- **R3 = 公开辅助 API 重组**。原文（:40-43）：「Team Own `ToolDefinition` **只**负责稳定名称、schema、错误、呈现、scope/Guard/Grant 契约；搜索、解析、渲染、构建等确定性 helper **必须**调用 `@deepseek-ai/dsh-tool-fs-search` 等包根公开 helper；Team 仅对自己直接实现的危险 IO 负责。」
- **R4 = bounded tool-level Fork**。原文（:44-48）：「只有 **R1+R2+R3 的 guarantee target 不满足**时，才可用最小复现证明并进入 bounded tool-level Fork。**不豁免"先证明所选 implementation route 失败"**。」配套 = ADR V2 第 8 条「**Adapter-first, bounded fork fallback**」[ADR:77 | 2026-10-16]「Prefer independent registration of Team-owned adapters using DSH **PUBLIC** scope-safe interfaces. Only after a reproducible minimal CORE_SEAM_BLOCKER proves that route incapable…」+ `tool-fork-debt.md` 回退顺序 1–5。

分类映射（post-poc-technical-design.md §2/§3 [设计需求正本 | 2026-10-16]）：A 类文件工具 R1+A（ControlledFs）；B 类 shell R1+ConfinedShellExecutor（§3.3「**不重新实现 shell 语法**，保留 DSH resolve/execute 语义」）；C 类 rg/glob R1+R3（§3.3 附近：「R2 仅缺服务前置实验，暂无 Fork 资格」= §0 表行「`grep/glob`：包根公开辅助函数的 R3 路线已有真实 ripgrep 对照」）；F 类 Web「R1 **或**受信 `ctx.web` 网络目的地 Provider Gateway」（§3.6）；F 类 Jobs「R1 **或**受信 Job Gateway」；D 类 PTC 保留上游传输（§3.4）。

**要点**：原始设计中 R1 与「执行体来源」正交；S0 各行首选路线里，**M-06 grep / M-08 glob / M-10 web / M-11 jobs** 都存在「复用/委托原生执行」的合法形态，R2（原生体重装）从未被排除——只要求真实 PoC。

## B. R1「独立注册与安全路由」是否被扩大成「Team 必须重供全部执行体」

**结论：扩大存在，且分两层，需要精确区分：**

1. **「重供 Definition（同名注册一个模型可见定义）」不是扩大**——S0:35 原文「注册 stable-identical Dispatcher/Definition」本就是 R1 定义的一部分（restrict 撤除后必须由同名 Definition 承接，否则名字回落原生）。用户指令问的「R1 是否原本只要求路由不要求定义」= **否**，R1 原文同时要求注册同名定义；「复用原生功能」在原设计中经由 R2/R3/Gateway 表达在**定义的内部**。
2. **「Definition 的执行体必须是 Team-owned 实现（family-body）」是扩大**——原设计允许执行体 = 重装的原生插件（R2）、公开 helper 组合（R3）、受信 Gateway（M-10/M-11「R1 或 …」）；现行中心装配要求每个受治理行由 Family 提供 definitions 执行体（见 C 节），执行体复用原生仅剩两条窄形：`named-bridge`（实占仅 jobs trio）与 plane 注入的 `hostService` 端口（非 schema 声明面，见 C.4）。

**扩大的确切文本位置**（按时间序）：

- **形成文本** = `docs/plans/memo/unified-baseline-alpha5-20261025/u6/center-assembly-architecture.md` §4「Family Contribution 契约边界」[设计草案（源自 PR #363，**CLOSED 未合并**；内容随 #364 以 memo 承载）| 2026-10-25]：Execution 边界行「Family 可提供：**只持有受限执行 handle，完成一次真实业务调用**」；Kernel 独占「唯一执行入口」。§6「**Bridge 仅解决真正不同的 Host 执行缝隙**……普通工具差异优先留在 Family；Host 原生不可替换、跨进程长生命周期或动态注册差异才升级 Bridge」。→ 该设计只设两种模式：Family 执行体 + 具名 Bridge 例外；**没有第三种「保留原生定义/原生体 + 治理绑定」的模式**。注意 §6 Bridge 候选表**含 Web**（「MCP / Web | 动态来源/服务器、stdio/HTTP/redirect、外部能力边界」）——实现中 Web 反而未走 Bridge（见 E 节）。
- **代码落定** = PR #369（merge `2db321f631`，2026-10-25）`contribution-schema.ts` 把 `execution.via` 闭死为两值（见 C.1）；PR #400（merge `6058bf3cb9`，2026-10-26）`family-assembly.mjs` 把「definitions 名称集 == claims 名称集 EXACTLY」落进挂载合同（见 C.2）。
- **评审决策** = PR #375 body 记录 bash 行形态「row + Family contribution: `execution.via: 'family-body'`, obligations all `kernel`」（merge `269be49e40`）；PR #377 jobs 行选择 `execution.via: 'named-bridge'`、provider `dsh.host/job-registry`（merge `f040a75621`）；PR #400 evidence `S4-JOBS.md` 给出 jobs 保留 named-bridge 的三条工程理由（bridge 身份注入 / 条件注册 / 跨键法）——**未讨论其它工具是否也应走原生复用**。
- **推动语义**（前置氛围）= PR #355 Plan B（head `8f84a784594496…`，**CLOSED 未合并**，2026-10-22 前后）M3：「任何**未接管、未接线、只有 Guard 全拒绝**的必交工具都阻断完成」。其「必须真实接管」口径被 `docs/plans/active/alpha5-tool-io-governance/current-execution-plan.md` §2 引用为日期口径来源；该句本身否定「Guard-only 治理」，但「接管+接线」在 #355 原文中并未指定执行体来源。

**是否混淆了两个不同律**：「no native fallback」（#364 执行计划 §1 设计红线「**无 native fallback、无 Body 后拒绝**」[执行正本（用户 2026-10-25 采纳 #364）| 2026-10-25]）= **安全法**，语义 = 已接管行在 Grant 不可用时**零执行**、绝不回退跑原生产原体（对应 post-poc §1.5「不回退、不重试副作用」）。它**不蕴含**「执行体不得由原生实现完成」——治理行直接调用宿主公开服务（如 jobs bridge、agent-control port）完全满足「无 fallback」（无第二候选体可回退）。「无 fallback ⇒ 必须自研执行体」这一步**在任何正本中都找不到文本**，是工程实现期的默读。

## C. GovernanceKernel/FamilyAssembly/CI/账本是否事实上排除 host-native 路线（逐一验证）

**C.1 `execution.via` 枚举闭死 = 是（类型 + 运行时双闭）**。`packages/runtime/governance-center/contribution-schema.ts`：
- `:74` `readonly backsExecution?: 'family-body' | 'named-bridge'`；`:118` `readonly via: 'family-body' | 'named-bridge'`；
- `:389` `reader.lit('$.execution.via', execution['via'], ['family-body', 'named-bridge'])` —— 运行时闭合集校验，其它值 `BAD_VALUE` 拒绝；`:155` `EXECUTION_KEYS = ['declared','via','bridgeId']` 封闭键集（`:194-200` 未知字段 = `UNKNOWN_FIELD` 拒绝）；
- `:411-412` `provider-backed` 家族必须 `via='named-bridge'`（`NAMED_BRIDGE_REQUIRED`）；`:418-423` requiredCapability 的 backing 与 via 不符 ⇒ `CAPABILITY_UNBACKED`；
- `:105-110` `definition.owner` 只接受 `'family'`（`:356-357` `reader.lit(..., ['family'])`）——**不存在 `owner:'host'`（保留原生定义）的声明位置**。
- 全枚举核对：**无** `host-native` / `native` / `passthrough` / `retain` / `reuse` 任何第三值。`git log -S "'host-native'" -- packages/runtime/governance-center/` 无记录（本 worktree 实查），PR #369/#373/#375/#377/#380/#400 body 及 #369 review comments（`gh api …/pulls/369/comments`）中无 host-native 选项讨论（PR 正文仅在 #375 提及 native 姿态 = 测试 leg `proc:ctl-native-untouched`「native `bash` rode with ZERO kernel mediation」——非受治理面原生直通，非接管模式）。

**C.2 FamilyAssembly definitions 要求 = 是（必须同名放置执行定义）**。`packages/runtime/src/plugin/live/family-assembly.mjs`：
- `:23-24`（descriptor 合同注释）`claims(cap)` = 「the native names an ENABLED mount places; must equal the contribution's `visibility.nativeNames` **EXACTLY**」；`:155-156` 运行时强制；
- `:140-141` `build()` 必须答 `definitions` 数组否则拒绝；`:158-160` `placed = built.definitions.map(d => d.name)` 必须 `sameSet(placed, claims)`——**声称治理哪个名字，就必须放置同名定义**；
- `:171-174` 注释「a dropped governed family would let the native tool **ride**」——把「原生体 riding」设为必须 fail-closed 的危险，即设计上不存在「定义在 Family、体在原生」的第三种接线。
- 放置后由 plane 直接注册：`team-tool-plane.mjs:1673` `defs = placedSeam.flatMap(e => e.built.definitions)`，`:2063` `agentCtx.tools.register(def)`。
- **零 definitions 的纯路由 Family 不可行**（claims 非空 ⇒ definitions 非空；claims 空 ⇒ 该行不受治理，走原生直通 = 非接管）。

**C.3 账本/CI 排除 host-native = 是（在「已装配的真值」意义上）**。
- `packages/tools/families/manifest.json:9-38`：Kernel capability manifest 九能力 `fs-read/fs-write/process-spawn/fs-search/inspect-read/network-egress/agent-control/ui-interaction/agent-state` **全部** `backsExecution:'family-body'`；jobs `jobs-management:'named-bridge'`（经 bridge contribution 的 mount manifest，PR #377）。**没有任何 `host-native` backing 能力可声明**。
- `team-tool-plane.mjs:361+` `PLANE_SUPPORTED_NATIVE_TAKEOVERS` 闭集账本（`bash/read/write/edit/read_image → ['<same>']`；`grep/glob → []`；`jobs → JOBS_MANAGEMENT_NAMES`），`:406-407` 未登记同名对答 `PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED`，消息原文「this install surface assembles **no same-name, same-meaning implementation** for that pair… the ledger is the complete truth of the pairs this surface assembles」——同名接管的前提被写成「装配了同名同义实现」。
- obligations 账本 = 静态义务非实现形式：`dev/engineering/tool-obligations/expected-tool-obligations.v1.json`（counts: entries=91, required=58, out_of_scope=33, named=87, dynamic_classes=3；`law` 字段「unknown name ⇒ REPORTED, never authorized」）。**obligations 本身不要求 family-body**——排除力在上游的 schema/manifest/plane 层。
- u7 验收账本 `dev/agent-workflow/ledgers/u7-tool-acceptance.json` 31 行 `familyId` 全部指向 8 个 `dsh.*-family` + `dsh.jobs-family`——账本以 Family 归属为记录单位，与 schema 排除互为闭环。
- **但注意**：CI/schema 并不检查「body 不得调宿主服务」；四个 Family 实际经注入端口调用宿主公开服务（见 C.4），即**「复用原生执行」未被禁，「把复用声明进契约」被禁**——复用发生在 plane 注入的 capability 把手里，不在可审计的 contribution 面上。

**C.4 现存的原生复用形态（证明 host-native 并非物理不可能，只是没有声明位）**：`family-assembly.mjs:60-74` `CAPABILITY_KEYS` 含 `hostService`（`:71`），plane 实现 `team-tool-plane.mjs:1601-1604` `hostService = (name) => hostServices.ctx?.get(name)`（= 挂载 Agent 的公开 ctx service locator）。实占：`hostService('subagents')`（agent-control port，`agent-runtime-port.mjs:181/240` → `subagents.start/listChildren/listDescendants`）、`hostService('cordisInspect')`（`families/inspect.mjs:82`）、`hostService('userQuestions')`（ui ask，PR #494）、`hostService('attachments')`（read_image，PR #488）、`hostService('llm')`（list_subagent_models）。jobs bridge 经注入 `input.backends.jobs` 复用宿主 JobRegistry（byte-identical body）。**⇒ 保留原生执行体的技术路线在代码中已部分存在，只是以「注入端口」而非「host-native via」表达，且从未用于 fs/process/web/search/state/skill 行。**

## D. 收窄在哪些设计/PR/评审中形成；有无明确用户授权

时间线与授权状态（每行 = PR 号 | merge SHA(10) | 日期 UTC | 授权层级）：

| 节点 | SHA/日期 | 收窄内容与授权状态 |
|---|---|---|
| PR #249 | `b6c99de2fa` / 2026-10-16 | ADR V2：三执行轴分离 + Adapter-first（§2.8，ADR:77）。**尚无 family-body 概念** |
| PR #251 | `e89cf2b8c4` / 2026-10-16 | S0 矩阵：R1–R4 语义 + 逐工具路线（M-01..M-13 含「R1 或 Gateway」选项）。**尚无排除** |
| PR #355 | 未合并（CLOSED，head `8f84a78459`）/ ~2026-10-22 | Plan B M3「未接管、未接线、只有 Guard 全拒绝 = 阻断」——否定 Guard-only 治理，**未指定执行体来源**；其口径被 current-execution-plan §2 引用（层级=历史参考，非现行指令） |
| PR #363 | 未合并（CLOSED）/ 2026-10-25 前后 | center-assembly-architecture.md 草案：§4 Family 提供执行体 + §6 Bridge 例外——**两模式闭合在此形成**；2026-10-31 sweep 评论确认其属「#364 批准前的设计/试验草案线」 |
| PR #364 | `95fbe95cf0` / 2026-10-25 | **用户裁决 = 唯一实施计划正本**（AGENTS.md/STATUS/current-execution-plan banner 一致）。红线含「无 native fallback」与 CA-01/CA-03（引 #363 设计）。**CA-01/CA-03 原文管接线分布（普通 Family 零中心源改动 / 特殊机制入具名 Bridge），未明裁「执行模式枚举封闭、host-native 不得保留」** |
| PR #369 | `2db321f631` / 2026-10-25 | 实现落定：`execution.via` 两值闭死 + definition.owner:'family' 单值。body 自述「deriving every field from sup-a/sup-b tested shapes… **widening is the reviewed path**」（放宽=经评审的通道存在，但 host-native 从未被提案）。评审记录中**未见**对 host-native/保留原生定义选项的独立选型讨论 |
| PR #373/#375/#377/#380 | `cd54f3b7c6`/`269be49e40`/`f040a75621`/`6058bf3cb9` / 2026-10-25…26 | read/bash 迁 family-body（旧行删除、无回退）、jobs 定 named-bridge（S4-JOBS 理由=工程性）、ARC-A/CA-01 fitness gate（CI-13/F1：plane 无 family 字面量）。每 PR 均「旧路径删除、no fallback」 |
| PR #400 | `6058bf3cb9` / 2026-10-26 | FamilyAssembly 通用挂载缝 + definitions==claims EXACTLY + manifest sha256 reviewed set。host-native 无声明位自此成为装配合同 |
| PR #390/#403/#404/#405/#406/#407 | 2026-10-26…27 | 逐 Family 交付（write/edit/read_image、web、inspect、ui、agent-control、agent-state），全部按 family-body + hostService 注入端口模式实现——**收窄作为既成事实扩散到全部 31 行** |

**判定**：(1) 用户明确批准的是 #364 统一计划及其红线（CA-01/CA-03、无 native fallback、G1-F 冻结门）；(2) 「执行模式仅 family-body|named-bridge、host-native 无声明位」这一收窄形成于 #363 草案期并被 #369/#400 落定，**属随唯一实施计划过关的工程默认**；(3) 对「保留原生 ToolDefinition/原生执行体 + 治理绑定」选项，**未找到任何一次独立选型审查记录**（PR 正文、#369 review comments、conditions.md 十不变量——后者不含任何「Family 必须供体」条款）；PR #369 body 只说 schema 派生自 sup-a/sup-b 测试形状（sup-a/sup-b PoC 原件部分在他机，G4-CORE-EVIDENCE.md:67 披露——**UNPROVEN 其是否评估过 host-native**）。(4) 同时必须公平记录：R1 同名注册的技术动机在原设计中已被 PoC 支撑（P0 报告 SUP-11：ToolRuntime dispatch 晚期 `resolveExecution` 重解析 ⇒ 仅 Guard/旁路注入不可靠；NEG-1 回落竞态），「不做 Guard-only 治理」有实证根据；被未经选型审查跳过的只是「同名 Definition 的体复用原生（R2/ctx.web provider seam/hostService）」这一族选项，且其中部分（jobs、agent-control、ui-ask、inspect、read_image）**实际上被实现了**，只是没升格为可声明的第一等模式。

## E. 哪些工具已符合原始设计；哪些形式上用公开 API 但实际复制上游业务逻辑

判据 = S0 各行首选路线 vs 现实现（详表见 NATIVE-REUSE-AUDIT.md）。

**已符合原始设计（复用形态正确）：**
- `job_output/job_list/job_kill` — S0 M-11「R1 或 trusted Job Gateway」+ ADR §8.2 三轴分离；实现 = `named-bridge` 包裹宿主 JobRegistry（PR #377「byte-identical bridge body」，provider `dsh.host/job-registry@0.2.0-rc.2@639ed01539`）。**全账本最优复用形态**。
- `team_grep/team_glob` — S0 M-06/M-08 首选 R3 原文照办：`search-family/src/search-backend.mjs:205`/`glob-backend.mjs:198` 从包根公开导出 import `buildGrepCommand/parseGrepArgs/parseGrepMatches/buildGlobCommand/parseGlobArgs/resolveRgPath`，危险 spawn 走 ConfinedProcessProvider（`search-backend.mjs:242-243`）。
- `ask_user_question` — 现经宿主公开 `userQuestions` service（`families/ui.mjs:76-86` + PR #494 per-call agent carrier）；执行体在宿主，Team 行只管治理——**R2/服务复用形态**（PR #491 定位的缺口已修）。
- `read_image` — `ctx.attachments` AttachmentStore 公开服务消费（PR #488：「ctx.attachments AttachmentStore 公开且我方已消费」「无 CORE_SEAM_BLOCKER」；`hostService('attachments')`）。
- `subagent/subagent_fork/send_message/interrupt_agent/list_agents/list_subagent_models` — 执行腿骑宿主公开 `subagents`/`llm` service（`agent-runtime-port.mjs:181/240` + `families/agent-control.mjs:69-86`「production resolves LAZILY through the mount's public hostService face」）。
- `team_cordis_inspect_list/query` — `hostService('cordisInspect')`（`families/inspect.mjs:82`）；cordis 业务逻辑（宿主 8,609 行）**未被复制**。
- `bash/team_bash/pwsh` — 设计原文即 R1+ConfinedShell（S0 M-07：「不实现 PTY 生命周期/通用 Shell parser…应复用宿主 ShellExecutor」）；实现 = 自有 mechanics 从中心 VERBATIM 迁移（PR #375）+ 驱动 NAMED reviewed `sandbox-provider`（CI-07），PTY 在宿主 terminal controller。安全中介（Landlock/confine）属不可替代类。**符合设计**（注：Team mechanics 层自有代码 1,751 行是「中心历史代码迁移」而非复制上游）。
- `run_code`(PTC) — 保留上游传输 + escalation 裁决行（`ptc-escalation-row.mjs` 头部 S1-S6 语义），逐字符合 post-poc §3.4「保留传输不可覆盖」。

**形式上用公开 API/自有实现、实质复制上游业务语义（五类中的第 4 类 = 对上游 Provider-存储-结果语义的复制）：**
- `web_fetch`（P0）— `web-family/src/web-transport.mjs:42-44` 自实现 `node:https`+`node:dns` transport；宿主存在公开 **provider seam** `ctx.web.registerFetchProvider`（宿主 `packages/web/web/src/types.ts:111-119` `WebFetchProvider{fetch(request,signal)}`；`packages/web/web/src/index.ts:50-93` provider 选择/配置面）。复制的上游语义：fetch 输出契约、截断/渲染（宿主 `tool-web/src/fetch.ts` 的 truncated 三源语义 :264-384）。合理性半边 = redirect 逐跳/origin 锁/host 解析门（PR #403 DECISION-3）确需 provider 内自管跳数——但 provider 接口本来就是「自管 fetch」，**gate 可实现为注册进公开 seam 的 provider，行层可保留**。REUSE/MODIFY 候选。
- `web_search`（P0）— Team 只 ship provider **shape** 不虚构 provider（`web-search-provider.mjs` THE LAW，法律正确：「none is invented」）；但宿主已有官方 search providers（`packages/web/web-search-deepseek|web-search-exa|web-search-perplexity`）+ `registerSearchProvider` seam，现无任何「宿主 provider → Team provider shape 适配器」，L4 缺口（U7-R3 ④「集成走正式配置」）的可复用面未被接。REUSE 候选。
- `todo_write/create_goal/get_goal/update_goal/exit_plan_mode`（P1 Agent State）— `agent-state-family` 2,351 行自有：todo 校验法逐条复刻宿主 `tool-todo/src/index.ts:81-97`（duplicate content / at most one in_progress 同语义，`agent-state-law.mjs:198-224`）、todos 投影 shape 复刻（law:373 vs 宿主 :100-110 todosProjectionSchema）、goal 五态状态机复刻（宿主 `tool-goal` 502 行走 `ctx.goals.*` 公开 service——宿主 `goal/tool-goal/src/index.ts` 实读 `ctx.goals.create/pause/resume/edit/complete/block`）、`fs-state-store.mjs` 自管持久状态。宿主 `ctx.goals` service 存在且 tool-goal 全执行走它；**Team 未经使用**（Team 面实占 hostService 名单 = attachments/cordisInspect/llm/userQuestions，无 goals）⇒ goal 族是「原生不满足时优先公开服务重装/适配」原则（用户裁决③）的直接命中面。todo 的宿主状态在 tool 包 closure + sessionProjections（无独立公开 service 名，#493 口径「91 SERVICE_API 键无对应」）⇒ todo 自实现有客观理由但存储语义复制应披露。
- `skill`（team_skill）— `inspect-family/skill-executor.mjs` 自实现 SKILL.md loader（candidate `<root>/<name>/SKILL.md` 语法、SKILL_MAX_BYTES），宿主 `tool-skill` 走 `ctx.skills.get/list/snapshot` 公开 service；loader 语法属上游语义复制（锚定/bounded-open 法复用的是 fs-family 自家 face，非宿主）。
- `present`（P0）— 唯一**宿主没有可复用发布面**者（PR #498 证伪全历史：host-side publish surface 不存在；`UI_PRESENT_PORT_ABSENT` typed 零效果维持）。非复制，是 BLOCKED（O2-B：R-N2 宿主公开接口提案 vs R-N3 模仿注入，用户裁决项）。
- `read/write/edit` — Team body（ControlledFs）；S0 M-01/M-02/M-03 原文即要求 Team 受控 FS 中介（宿主 tool-fs 走宿主 sandbox 服务，非 realm-anchored 读窗），属**第 3 类（实际执行边界不可替代的安全中介）+ 第 2 类（为独立权限判断增加的检查）**，不算不当复制；read 行窗口/footer 输出 shape 对上游呈现语义有对齐义务（矩阵 M-01「native shape」），维护面存在。

**其余（无原生对应物，不在复用问题域）**：team_* Leader 域 15 名（`team-native` route，obligations v1）；terminal_*/session_*/schedule_*/plugin_manager/mcp_resources/load_workspace_dependencies/str_replace_editor/ralph/wait_agent/subagent_claude_code/subagent_codex 等 = obligations `OUT_OF_SCOPE` 33 名（str_replace_editor = 「NOT mounted in any shipped bundle/preset」，PR #390 证据）。
