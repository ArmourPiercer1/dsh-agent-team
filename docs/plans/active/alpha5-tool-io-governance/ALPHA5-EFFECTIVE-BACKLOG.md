# ALPHA5-EFFECTIVE-BACKLOG — 有效待办唯一当前入口

<!-- phase-baseline-ref: dev/agent-workflow/graph.yaml#current_contract — 基线以此字段为准；本文件禁 SHA 副本 -->
<!-- phase-identity: alpha5-tool-io-governance -->

- 性质：**当前指令**（非快照）。逐项状态=`carried-forward / closed-by<证据> / superseded / needs-revalidation`；逐项标源行，**禁抄旧 OPEN、禁批量关闭**。历史正文仍以 PENDING-GATES.md / CURRENT-STATE / ACCEPTANCE-STATUS / COORDINATION 为正本（只追加不改写）。
- 状态核读时点=本分支创建；标 `needs-revalidation` 者=源文件状态列与正文/后续 merge 存在矛盾，须矩阵轮/人工重核，本文件不代裁。

## A. 已复现审批穿透阻塞（本项非发布唯一条件）

| ID | 项 | 状态 | 事实与源 |
|---|---|---|---|
| BL-01 | **team_bash default-ask 审批穿透**（R2）：真实 ToolRuntime+Guard 隔离组合下 request=0 / body 哨兵=1 | **OPEN — RELEASE BLOCKER（已复现的审批穿透阻塞）** | 本项=已复现的穿透阻塞，**不是**发布阻塞的唯一枚举——矩阵其余缺项（非 DONE 行、族级 GO 未达、全工具审批未达）同样阻发布。effect 为合成哨兵、非整 Host 线上复现，**不扩大断言、不外推到其它工具族**（grep/glob 的 r1 观察仅=同词表机制提示）。原件=工作区 `dev/agent-workflow/evidence/alpha5/a9b2-approval-diag/`（w2/w5/DIAG-REPORT/R2-RECEIPT；**尚未入 git**，入册=另批 root per-SHA）。矩阵占位=team_bash 行，级别 BLOCKED-FOR-RELEASE。2026-10-23 按已验证边界登记链接（**登记非关闭，本行仍 OPEN**）：M1 已合入 master `929fc4af23725a1de4cda9206eb7abb149b1bf12`（已审 tree == `7a3540937e39aa5b90abec6eac6ea2a30c78deeb`）。M1 真机三参考（安装面=已审 commit `7a3540937…` 之 pack；现均为 `.worktrees/a5-m1-host` 工作区未跟踪件，**尚未入 git**，入册=另批 root per-SHA，沿 BL-18 口径）：read 臂 `dev/agent-workflow/evidence/alpha5/w-pa-host-chain/runs/live-plane-2026-10-23T05-32-38`（exit 2，L3.4 失败原文在该目录 FAILURE.md）、bash 臂 `dev/agent-workflow/evidence/alpha5/w-pa-host-chain/runs/live-plane-2026-10-23T05-42-01`（PASS exit 0）、unsupported 臂 `dev/agent-workflow/evidence/alpha5/w-pa-host-chain/runs/live-plane-2026-10-23T05-48-18`（PASS exit 0）。noTeam/基线对照轮 `dev/agent-workflow/evidence/alpha5/a5ie-r2b/runs/2026-10-23T06-31-02Z`（installedSha=`7a3540937e39aa5b90abec6eac6ea2a30c78deeb`；criteria.json 49 项有红在册，同样尚未入 git）：其中 **A2（read CROSS-ROOT NEGATIVE）被拒、拒文=`Error: locator-rejected — undefined`，detail 面为 `undefined` 的原因仍待核——留册**。 |

## B. Alpha.5 门/延期项（PENDING-GATES 逐项核读，含矛盾标注）

| ID | 项 | 状态 | 核读说明（源=PENDING-GATES.md@9b2 行号） |
|---|---|---|---|
| BL-02 | G-b seam-record/s12 必改（三事实+限定措辞） | carried-forward | L15 状态"修复中"；无关闭证据在册。 |
| BL-03 | G-c PR256 F-1/F-2 修复 | **needs-revalidation** | L16 **矛盾**：状态列="修复中"，同行动放行动作列="修复+新 head 独立复核+CI **已完成**：#256 合 ae3dcf54；#260/#261 各独立复核+CI 绿后合"。矩阵轮按 merge 事实重裁，不抄状态列。 |
| BL-04 | G-d 各 lane 对契约 v1.1 集成确认（含 p4t6 pin、tsconfig、接线注、F-3 义务、Supported 宣称禁令） | **needs-revalidation** | L17 **矛盾**：状态列="未开始"，放行动作列已录 wiring #268 @9e75ee83 + live #269 @0e0b605a 入账。ACCEPTANCE-STATUS 判 G-d=OPEN 为更晚口径；G-6 计分项挂本行。人工/根裁关闭。 |
| BL-05 | G-e 原 G1/G3/G7/YAML 待裁项 | carried-forward **决策身份待核** | L18。**不得写成已裁**；四编号正文不在仓内（G-e-mapping.md §1b）→ **决策身份待核**（引用时须带"内容缺位+身份待核"披露；**不写作"待用户未裁"，不重新问旧问题**）。 |
| BL-06 | G-g 静默通道排除门 | closed-by 证据门收口（**非产品支持宣称**） | L19：等级上限 LIVE-CONFIRMED/ENFORCE-PARTIAL 三项缺项在册；措辞禁则=lint-g-g-wording 常跑；双维度禁合并。 |
| BL-07 | G-f census 非终态禁称全绿 + 事件缺口注记 | carried-forward（纪律行） | L20、L52-56 纪律持续有效。 |
| BL-08 | D-1 NO-ABORT-AFTER-BODY-START | carried-forward DEFERRED（有主，非放弃） | L26/L29-42：owner=d9da2f74（L24 指派）；恢复三条件其一公开才解；回归三件套在册；禁以"延期"写成"已裁放弃"。 |
| BL-09 | D-2 skills 对齐 | closed-by d6b57e55(#270)+终验 420ed3ee(#271) 9/9 | L27。 |
| BL-10 | glob 独立关断键 `a5-globoff-key` | **closed-by #342 `46e48218e48314662586ff053ca3825e2889a6bb`**（ancestor 亲核=9b2 祖先；题注"minimal independent glob-off config key (#342)"） | 键在码=亲读 team-tool-plane.mjs :662-681：`globEnabled` 缺省=默认开（`!== false`），显式 false=typed 关闭面，非布尔=PLANE_CONFIG_INCOMPLETE 拒。**关断机制非"未来待查"**；运行面复验另列 BL-19。 |
| BL-11 | #337 glob rc-first 判据线收口 | **superseded by #343 `d5de74974b0320b191b310ead82407d478477ed7`**（ancestor 亲核；题注原文含"supersedes #337 (#343)"） | 旧 #337 判据线由 #343 取代，非本文件代裁而是题注自述+ancestor 事实；运行面复验另列 BL-19（#354=baseline 自身，与 bash 取消**无关**）。 |
| BL-12 | C-16 钉名表 | closed-by c8ad9c4a（原始 13 名钉+双向漂移机检）；三段实况见 CURRENT-STATE §C | 后续以 pindir 证据为准。 |
| BL-13 | T-1 v3 退役窗口 | carried-forward 待用户裁 | CURRENT-STATE §C（双 v3/v4 并行本身可运行=非必决）。 |
| BL-14 | scoped visibility Q1（休眠 vs 登记 upstream ask 二选一） | **superseded（按本议题自身证据记）** | 本议题=**scoped visibility**（独立议程，**不被 PTC #332/#334 吸收**）。自身证据=CURRENT-STATE §B scoped-visibility 行原文：**GLUE-4 Q 单 10-17 已 RESOLVED，Q1=降级 optional upstream ask 休眠**（Q4 准/Q2·Q3 拒有实测）；出处=GLUE-4 #302=`79f82441` README「RESOLVED 2026-10-17」节 + `4ba92b77`（两者存在已核）。**不再要求用户一句话**；不抄 §C 旧问题文本。 |
| BL-15 | census 上传强化 | carried-forward 待根批准独立小 PR | CI 本体零动=根裁。 |
| BL-16 | net 半臂（confined-execution network arm） | 上游词表需求级缺口，**登记非本仓待办** | M-08 notes 原文口径；#332=0fa2cd76 登记。 |
| BL-17 | bg producer（team_bash 后台臂） | **未合入基线** | 工作区 bg WIP 未跟踪；本分支禁混入；恢复走原 task 纪律。 |
| BL-18 | a9b2-approval-diag 原件入册 | carried-forward 待批 | root per-SHA evidence commit 另批；本轮矩阵仅路径引用+"尚未入 git"披露。 |
| BL-19 | glob/grep 判据线**运行面复验**（#342/#343/#354 已合后的现运行行为） | carried-forward 待复验轮 | BL-10/BL-11 关闭的是**合入/取代事实**；运行行为复验属矩阵复验轮（需测试轮授权，当前产品冻结未开）。 **〔历史标记 2026-10-23〕上句"当前产品冻结未开"=9b2/该条目当时口径，原句保留；已被 PR#357/#358 阶段事实取代（M1 已准入已合、M2 进行中）；本行状态列不改、不关单。** |

## C. 本 docs-realignment 轮自身

| ID | 项 | 状态 |
|---|---|---|
| BR-01 | 三当前态文档 + graph current_contract + AGENTS 入口 + 历史 banner | 本分支首批 commit（已含） |
| BR-02 | CI state-freshness 扩检（Q1-Q8）+ legacy fixture 钉 legacy-only + 正负控 | 本分支第二批（同 PR，非二批） |
| BR-03 | 矩阵 26 行实填（含 R2 行；适用性按依赖路径 drift 实测） | 本分支首批已含实填；复验轮（跑测试/Host）另行，见 current-execution-plan §3 |

## M2 四档状态/owner 表（2026-10-23 15:4xZ，root 15:4x 裁决落表；四档唯一定义：未开发=治理实现仍实质缺口｜未接线=实际适配可交付未生产装配｜接线未测=真实生产路径已接但对应 Host 验收未完｜已测试=明确功能范围/固定版本真实验收。无第五档；阻塞只作备注，不升档不降档。）

| 工具/面 | 档位（按档定义） | 范围与固定版本 | owner/树 | 备注 |
|---|---|---|---|---|
| todo_write | 已测试 | todo PA hand-off C2 **r11** 真 Host 验收 @31f7 包 / pin bbde8（root 签收口径，更正：非 r14@8b94——r14 是 write 旧 kit 判据失败轮） | center/已关弧 | — |
| write（既有文件） | 已测试 | 既有文件写 C2 r16 @19d54 包，root 14:38 限定既有文件范围接受 | center/已关弧 | 范围外新文件不在此档 |
| write（新建文件） | 未开发 | 治理实现仍实质缺口（r16 明示限定既有文件） | 待派 | 无第五档 |
| read_image | 接线未测 | paImageHandoff 生产已接 @249eb（真 Host boot 起效、旧门=0 实证 r17），Host 功能验收 r17 RC2 未完成 | center（原主保定位）+ 307c 窗口 | r17 决策侧 drift 诊断中（seam 缺失候选，见证据目录） |
| read | 接线未测 | 生产挂载真路径（M1 弧已老版本验收；本固定包组合未重验） | V-RSJ `68701321` 第二 lane 进行中 | Host 验收=r17 后首跑 |
| search | 接线未测 | 生产 rg 后端真路径 | 同上 | 同上 |
| jobs | 接线未测 | durable bridge 生产路径 | 同上 | 同上 |
| G1 纯查询子集（inspect×2 + team_list_pending_control） | 未接线 | g1-surface-adapters 组件（59 腿）+ wiring 候选 g1-query-wiring（15 腿，center 实测并入）可交付未生产装配 | 接线 `44ece7a3`@feat/a5m2-wire-g1 | 子集由冻结表推导（capture=tool ∧ 全 read 义务） |
| G1 dependency/plugin/present 资源臂 | 未开发 | 治理实现仍实质缺口（无成熟适配可交付；禁冒升） | 待派 | 不强塞、不冒完成 |
| G2 WEB seams 面 | 未接线 | provider-seams 可交付（registerSearchProvider/registerFetchProvider WEB pins） | 接线 `e78dee2a`@feat/a5m2-wire-g2 | WEB global/env 禁 |
| G2 WEB 真实 Team-scoped 固定 provider | 未开发 | 实际 provider 仍缺（真 Team scoped register+close 绑定实现缺位，禁 server 名匹配） | 原 G2 组件 owner 生命周期修复卡内 | 具名阻塞 |
| G2 MCP seams | 未接线 | 真 SDK 签名面可交付 | 同上 | request=执行租约 |
| G2 BROWSER 装配 | 未开发（组件独审 BLOCK） | team-assembly 候选独审 BLOCK：MCP pending connect 未计 close/inflight、失败无 rollback、并发 reconnect 覆盖 client/吞 close 失败/提前 closed（需串行轮换+按 generation 跟踪+失败 ownership）；Browser 直连 openNativeBrowser 的 Stagehand.create 失败无清理且 execute 忽略 signal（按公开 worker/真实连接所有权修半开，无 ownedChromium 不得假清理）；makeTransport 须实际 endpoint/spawn/config 同源；真 Team scoped register+close 绑定，不靠 server 名 | 生命周期修复=原 G2 组件 owner 独占 g2-team-assembly.*（int 树两文件，进行中）；接线 `e78dee2a` 只续自身 plane/glue 且 browser 行 fail-closed 钉 BLOCK | 未修组件严禁升 Host/C2；533 组件已关不重开；不 Core/global |
| G3 fsproc/shell 适配面 | 未接线 | 适配器+33 腿可交付未生产装配 | 原 owner 续写中（int 树） | 合并归 center |
| G3 受控 PTY per-open 真实供给 | 未开发 | 真实 Host 供给实现中（现仅 integrator-supplied perOpenRegistration(callId)），§5.1 未完成 | 原 owner | 无同名 API≠无实现路（root 15:08） |
| create_goal/get_goal/update_goal | 未开发 | 639 真接口适配实现中（无交付不落"未接线"） | 适配 `8722db94` | packages/goal/tool-goal 锚点 |
| session_search/trace/event_read/event_search/event_trace | 未接线 | g6 五型别行适配已交付（639 file:line 全锚，26 腿+红除实测，center 实测并入）未生产装配；search 二行 declared_mount INACTIVE（抽象后端组合+SESSION_QUERY_SEARCH_DISABLED） | 适配 `8e6e7788`（已停笔交付） | 残差具名导出：TARGET_PREAUTH/PARENT_FILTER/TITLES_PRESENTATION/SESSION_HISTORY_RESOURCE_KIND |

适配不等待中心接线（用户 15:4x 原话）；同物理树/integration ref 禁并写，隔离树完成后由 center 解冲突并核组合 SHA；空接口/声明不得记"未接线"。
