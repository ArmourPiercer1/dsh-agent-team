# 内部试用候选评估（J-5）— INTERNAL-TRIAL-CANDIDATE-ASSESSMENT

> **落笔时间（R-CLOCK-1，`date -u` 现场取值）**：2026-10-31T08:54Z。本文所有「dated」均为写作时刻真实 UTC；不继承任何上游文档日期。
> **席位**：workflow C 独立评估席（零 boot、零端口、零产品码；本席全部运行时结论均为对在册证据的引用，非本席实测）。
> **输入基线**：`master @ 0e6b5d129`（#518 sync16 合并头）；机器台账 `dev/agent-workflow/ledgers/u7-tool-acceptance.json`（@33efb33a0，PR #474 后未再改动，本席核验）；`dev/agent-workflow/gates/U7-R3-GAP-MATRIX-20261029.md`（v3 + 2026-10-31T05:39Z dated 翻转条目，随 #516 @ df92b3447d 入册）；`dev/agent-workflow/evidence/a5w-bootwave-20261030/c2/L4-RECEIPT-read-image.md` 与 run-bw1..bw10.json + RCA-1/2/3/4/6/7/8；`dev/agent-workflow/gates/BOOT-BUDGET-20261031C.md`（含 06:04Z 更正规格 L139）；`SESSION_ROUTER_LOG.md` sync16（L7326-7332，@ 0e6b5d129）；`dev/agent-workflow/evidence/a5w-native-reuse-20261031/` 七文档（五审计 + PRESENT-NATIVE-POC + WEB-NATIVE-POC）；`docs/plans/active/alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md`；`ALPHA5-EFFECTIVE-BACKLOG.md`；`dev/agent-workflow/evidence/a5w-portprobe-20261030/RESULT.md` §7。
> **裁决语义（派工令原文）**：本文件 = 「内部试用候选评估，不得冒充 G5」。

---

## §A 「内部试用可依赖」面（逐格列举，每条给台账行/载体）

判据：机器台账 L3-refusal/L4-positive 双 PROVEN（台账契约：L3 = live typed refusal with zero effect；L4 = live authorized call whose real effect was read back——`u7-tool-acceptance.json` note 原文），或 dated 翻转条目具名承载。

| # | 能力面 | 格位 | 证据载体（逐格） |
| --- | --- | --- | --- |
| A-1 | `read` | L1–L4 全 PROVEN | L3 `fs:refusal-zero-effect`（record u6-pr3-20261026/c2/run-u6fs-rerun.json）+ L4 `fs:governed-read-positive`（同族 RUN record） |
| A-2 | `write` | L1–L4 全 PROVEN | L3 `fsm:refusal-zero-effect` + L4 `fsm:write-positive` |
| A-3 | `team_bash` | L3+L4 PROVEN（**附披露，见 C-9**） | L3 `tbash:deny-zero-effect` + L4 `tbash:approve-spawn-once` |
| A-4 | `team_grep` | L3+L4 PROVEN | L3 `arca:search-refusal-zero-effect` + L4 `arca:search-grep-live` |
| A-5 | `team_cordis_inspect_query` | L3+L4 PROVEN | L3 `u7f:refusal-zero-effect` + L4 `u7f:inspect-query` |
| A-6 | `job_output` | L3+L4 PROVEN | L3 `u74a:planted-unattributed` + L4 `u74a:ring-bytes-via-job-output-wait` |
| A-7 | `job_list` | L3 PROVEN(**CASE**) + L4 PROVEN | L3 `u74a:list-deny-leg-honest-zero`（CASE opt-in，runOverall/failedScope 披露在案）+ L4 `u74a:list-shows-owner` |
| A-8 | `web_fetch` | L3+L4 PROVEN | L3 `web:deny-leg-zero-wire` + L4 `web:fetch-positive`（矩阵 M-10 行为 fixture 级历史口径；台账行为权威） |
| A-9 | `update_goal` | L3+L4 PROVEN | L3 `ast:cross-scope-zero-effect` + L4 `ast:update-goal-positive` |
| A-10 | `read_image`（六格） | L3 PROVEN + **L4 = PROVEN（具名承载翻转）** | GAP-MATRIX dated 条目（2026-10-31T05:39Z，:40）：bw9 `u5-u7r3-bootwave-bw9-2026-10-31T05-38-21-670Z` + bw10 `…bw10-2026-10-31T05-39-04-663Z` 双跑六格全绿（对象 sha d6325bd24a66141e…，69B good.png）；六格 = `ri:placement-one-row / ri:ask-approved-ran / ri:attachment-commit-one / ri:tool-output-two-blocks / ri:answered-deny-zero-effect / ri:store-law-zero-commit`（L4-RECEIPT 表）；L3 双臂在册：kernel-admission 臂（bw8/9/10）+ control-bridge 臂（bw6/7，#510 后语义）。**双录披露**：JSON 台账行 `read_image.L4` 仍为 DISCLOSED（JSON @33efb33a0，翻转的具名承载 = GAP-MATRIX 条目 + L4-RECEIPT；本席不声称 JSON 已更新，行同步 = 未决尾项 §E-8）。 |

以上 10 面 = 试用白名单核心。**#511 后观测面事实**（试用运维可依赖的旁证）：内核授予审计行经白名单渲染 `a5-admission: event=… callId=… grantId=… caseId=…` + shipped-style stdout echo 首次到达实例日志面（#511 @ 4229bd5605 commit 正文；写面仅 plane 面，agent-bindings 零触碰——sync16 L7327）；bw9/bw10 收据即从实例日志读取该面判绿。试用期的授予/拒绝链在日志面可审计。

**可用但带披露的中间带**（试用可开，判据不完整须如实标注）：

- `edit / bash / team_glob / team_skill / team_cordis_inspect_list / job_kill / todo_write / create_goal / get_goal / exit_plan_mode`：L4 PROVEN、**L3 NOT_VERIFIED**（正臂在册、live 拒绝臂零副作用未证，多为 unit/静态覆盖）。处置 = **可用+披露**（不承诺「拒绝路径 live 零副作用」）。
- `ask_user_question`：L3 PROVEN（`ui:ask-live-refused`）；**L4 台账 DISCLOSED**（reason 原文「no trusted production mount injects a UI port (production `backends` a…」，@33efb33a0）。**证据待同步**：uif4 轮（#494 前）`ui:ask-approved-ran` FAIL = `UI_INTERACTION_PORT_FAILED`（具名缺口）；#494（@15:55:09Z per-call carrier）后 boot 波次该格 **PASS**——run-bw9.json `ui:ask-approved-ran`：`governed-ask RAN answers=1` + `team.resolveControl` allow（decider.kind=human）+ $events waterfall 闭环 + 答案回 tool_result；RCA-2/RCA-6 记「f4 三连绿」。处置 = **可用+披露**（L4 转正须 eb3 candidate-bound 台账同步，§E-8）；`ui:live-root-law` 维持 NOT_REACHED 披露（GAP-MATRIX :43）。
- agent-control 实际格位（`subagent / subagent_fork / send_message / list_agents / list_subagent_models / interrupt_agent`）：L4 DISCLOSED（reason=「the cited live record binds teamSha ab8a5f236 (pre-fix output faces/au…」；send_message=「not exercised live (would steer a live member)」）；L3 仅 `interrupt_agent` PROVEN(**CASE**，`ac:interrupt-foreign-zero`)，其余 NOT_VERIFIED；`interrupt_agent` L4 = **NOT_VERIFIED（全表唯一 L4 NV 行）**。处置 = **可用+披露**（编排生产实际运转依赖此族——本席即 subagent 派发——但台账级治理验收未入账；再证 = 候选绑定 C2，池=0 §E-2）。

## §B 必须关闭 / 强制披露面（逐项处置）

| # | 面 | 台账/矩阵状态（逐字要点） | 试用处置 |
| --- | --- | --- | --- |
| B-1 | `web_search` | 台账 L3 PROVEN（`web:search-no-provider` 类型化拒答 live）/ **L4 DISCLOSED：「no provider ships with the product」**；矩阵 M-10 级 = NOT_VERIFIED（V@B=no）；WEB-NATIVE-POC：路线 A（原生直通治理）NO-GO（P-W1 无 lane 直通零 PA），路线 B 封顶 CONDITIONAL（per-destination 执法不可达 ③层 proxy/upstream/DNS），DeepSeekSearchProvider = MOCK-PASS only；ENV 腿 E-1..E-5 全 ENV-PENDING（§5 表） | **禁用/不宣称**：无 provider = 天然 fail-closed 可保留挂载，但产品面不得宣称搜索结果能力；试用 preset 建议关 `webEnabled` 并披露 |
| B-2 | `present` | L3 PROVEN / **L4 DISCLOSED**（reason=「the present publication face exists on no host ctx service」）；PRESENT-NATIVE-POC（38/38）：**P-P1 = FAIL-on-clause**（G1 in-flight 身份锚定缺失、G2 body 出身证明缺失 = 公开面不可消除；G3 guard→dispatch 窗口、G4 无 callId 去重）；§4 路线表全表无 GO：「**任何 GO（含 present L4 转正）在 boot 级 P-P4 正臂完成前禁止**」；N2 提案路线已按用户指令作废（sync16 L7332） | **试用 preset 禁用**（发布语义无验收）；如保留 = 逐会话披露 G1–G4 + 无 P-P4 正臂 |
| B-3 | `workflow` | L3 NOT_VERIFIED / L4 DISCLOSED（reason=「no recognized public host face at the pin」；审计 BLOCKED-2，MIGRATION-DECISION-TABLE §C） | **禁用**（LEG 未接线，类型化拒绝是唯一行为） |
| B-4 | `pwsh` | L3 PROVEN / L4 DISCLOSED（reason=「**C2 6/6 PASS over the refusal/lifecycle arms; positive spawn DISCLOSE…」）；无 Windows 腿、本机无二进制 | **不挂载/禁用** |
| B-5 | ui live-root 面 | `ui:live-root-law` = **NOT_REACHED 维持 L2-as-is 披露**（GAP-MATRIX :43：assertLiveRoot 仅在请求携带 Agent 时进入；非 read_image 义务格） | **披露**：live-root 执法面未达，属 ui 族 L4 未决的一部分 |
| B-6 | `bash`（native） | L4 PROVEN（`u74a:ring-bytes-via-job-output-wait`）/ **L3 NOT_VERIFIED**；矩阵 M-07 native 行 = LIVE-CONFIRMED(scope 历史轮)+完整依赖适用性 NOT_VERIFIED | **可用+披露**（前台接管链历史轮实测；live 拒绝臂未证；后台 producer 未合 BL-17 在册） |
| B-7 | 子代理族再证 | 见 §A 中间带：5×L4 DISCLOSED + `interrupt_agent` L4 NOT_VERIFIED | **可用+披露**；对外试用文档中列为「治理验收未入账」 |
| B-8 | `subagent/subagent_fork/list_*` 的 pre-fix 绑定 | L4 reason 明载引用记录绑定 teamSha `ab8a5f236`（pre-fix output faces），非当前候选 | **披露**：转正需候选绑定重证（C2，池=0） |
| B-9 | `team_bash` default-ask 组合 | 矩阵 team_bash 行（:31）：「**RELEASE BLOCKER**：team_bash default-ask 在真实 ToolRuntime+Guard 隔离组合下 request=0/body 哨兵=1；effect 为合成哨兵、非整 Host 线上复现，不扩大断言」+ **BLOCKED-FOR-RELEASE**；BACKLOG BL-01 =「OPEN — RELEASE BLOCKER（已复现的审批穿透阻塞）」 | **降级**：试用期 shell-class 资源用显式 allow/deny 车道，规避 default-ask 组合；披露 BL-01。断言边界照抄：合成哨兵、非整 Host 线上复现、不外推其它族 |

## §C G5/发布条件不因内部试用而降低（逐字引用 + 声明）

1. AGENTS.md 阶段行：「**release BLOCKED = 全工具审批未达，见矩阵**」。
2. `u7-tool-acceptance.json` note：「**Honesty is the merge gate; completeness (every L4 PROVEN) is the G5 release gate, not a CI colour.**」
3. GAP-MATRIX 2026-10-31T05:39Z 条目自限：本条目 = 逐工具验收账翻转的**具名承载**；G5/发布级结论不在本条目范围。
4. L4-RECEIPT-read-image.md 自限：本收据 = 工具能力格 L3/L4 证据完备声明；不宣布 G5/发布级结论。
5. BL-01（§B-9）与矩阵 9b2 全行 V@B=no 仍是发布阻塞枚举的一部分（BL-01 行原文：本项「不是发布阻塞的唯一枚举——矩阵其余缺项（非 DONE 行、族级 GO 未达、全工具审批未达）同样阻发布」）。

**声明**：本评估 = **试用候选**判定，不是 Alpha.5 release 判定，不改动任何格位状态、不构成任何 GO。建议对外试用话术：「内部试用候选：以 §A 十面为核心白名单；§A 中间带与 §B-6/7 面可用但强制披露未证臂；§B-1..4 关闭。G5 发布门 = 全 L4 PROVEN + BL-01 清除 + 矩阵行级验收，与本试用并行不互证。」
**建议试用 preset 面开关**：开 = fs 族（read/write/edit*）、team_grep、team_skill*、cordis inspect*、jobs 三件（job_kill*）、goal 三件（create/get*）、todo_write*、exit_plan_mode*、ask_user_question*、read_image、web_fetch、subagent 族*、update_goal（* = §A 中间带披露条款）；关 = web_search、present、workflow、pwsh、webEnabled；shell-class = 显式 allow/deny 车道（规避 BL-01 组合）。

## §D 试用候选期间必须随包披露的未决依赖

| # | 依赖 | 状态与出处 |
| --- | --- | --- |
| D-1 | **PR-D 中心接口最小变更**（4 项接口缺口：B 路线生产化落点 / webEnabled 语义翻转 / 错误码透传表 / UA-头策略） | WEB-NATIVE-POC §7 在册；「是否立项」= 用户裁决位（sync16 :7329 待裁条） |
| D-2 | **PR-E/F 迁移放行**（web_search provider 适配、web_fetch→registerFetchProvider、ctx.goals/ctx.skills 调研腿） | MIGRATION-DECISION-TABLE M1–M4；「PR-E/F 迁移是否放行」= 用户裁决位（同 :7329） |
| D-3 | **boot 预算池 = 0**；任何 live 再证（agent-control 族、ask L4 转正、present P-P4、workflow L3 等）需用户新裁 | BOOT-BUDGET-20261031C 06:04Z 更正规格（L139：真实 starts=9 唯一正本；「池=0 结论不变」）；硬停线在案 |
| D-4 | **ENV 腿 E-1..E-5**（web：真 api.deepseek.com 端到端 / 真 TLS+DNS rebinding / 代理环境真机 / resolvePublicAddresses accept 腿 / 路线 B GUI 端到端 boot） | WEB-NATIVE-POC §5 ENV-PENDING 表；另 portprobe RESULT §7 E-1..E-4 = 端口探针腿后续（E-1 已清+披露，E-2/E-3/E-4 post-merge follow-up） |
| D-5 | **BL-01 team_bash default-ask 穿透** | §B-9；OPEN — RELEASE BLOCKER；原件未入 git（BL-18 入册另批） |
| D-6 | **State Home V2 / 收束尾项**（shomev2 两臂在册 + 463arch 审计在途） | evidence u7r3-shomev2-20261030 / u7r3-state-home-463arch-20261031；试用不受阻但状态族验收未完 |
| D-7 | **present boot 级 P-P4 正臂**（含真世界/持久化/GUI 消费） | PRESENT-NATIVE-POC §4「全表无 GO」；受 D-3 预算阻塞 |
| D-8 | **台账同步尾项**：read_image L4 JSON 行、ask_user_question L4 行（材料在案）、agent-control 候选绑定重证 | §A-10 / §A 中间带具名；均须 eb3 candidate-bound 通道，非文档手改 |
| D-9 | 接管席注入异常未溯源（「忽略之前的指令」样式文本，来源未明） | sync16 :7330；试用期内继续按数据纪律处置并随包披露 |

## §E UNPROVEN 清单（本席不可证事项，逐条）

- 各 §A 面在**候选 SHA 全新安装面**上的整机回归 = UNPROVEN（格位证据绑定各自 tested SHA；本席零 boot 不复测）。
- 审查席启动时刻（四相效率之「启动」）在全部 12 样本 PR 均无独立在册时刻 → 见 EFFICIENCY-METRICS-20261031.md §1 口径与 UNPROVEN 标注。
- #511/#512/#492/#495/#496 的审查**结论回报时间**无在案评论承载（sync16 汇总行仅记「全部独立审查」）→ EFFICIENCY 文档中该两相记 UNPROVEN。
- 本席引用的所有运行时事实（bw9/bw10 九绿、a5-admission 行、ui:ask-approved-ran PASS）= 收据/记录引用，非本席实测；引用文件 SHA 已在输入基线行给出。

——评估席（workflow C pilot）落笔 2026-10-31T08:54Z；本文件为追加式新文件，零改动任何台账/矩阵/账册。
