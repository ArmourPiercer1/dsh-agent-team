# ALPHA5-EFFECTIVE-BACKLOG — 有效待办唯一当前入口

<!-- phase-baseline-ref: dev/engineering/current-authority.json — 基线以该指针解析到的快照为准；本文件禁 SHA 副本 -->
<!-- phase-identity: alpha5-tool-io-governance -->

- 性质：**当前指令**（非快照）。逐项状态=`carried-forward / closed-by<证据> / superseded / needs-revalidation`；逐项标源行，**禁抄旧 OPEN、禁批量关闭**。历史正文仍以 PENDING-GATES.md / CURRENT-STATE / ACCEPTANCE-STATUS / COORDINATION 为正本（只追加不改写）。
- 状态核读时点=本分支创建；标 `needs-revalidation` 者=源文件状态列与正文/后续 merge 存在矛盾，须矩阵轮/人工重核，本文件不代裁。

## A. 已复现审批穿透阻塞（本项非发布唯一条件）

| ID | 项 | 状态 | 事实与源 |
|---|---|---|---|
| BL-01 | **team_bash default-ask 审批穿透**（R2）：真实 ToolRuntime+Guard 隔离组合下 request=0 / body 哨兵=1 | **OPEN — RELEASE BLOCKER（已复现的审批穿透阻塞）** | 本项=已复现的穿透阻塞，**不是**发布阻塞的唯一枚举——矩阵其余缺项（非 DONE 行、族级 GO 未达、全工具审批未达）同样阻发布。effect 为合成哨兵、非整 Host 线上复现，**不扩大断言、不外推到其它工具族**（grep/glob 的 r1 观察仅=同词表机制提示）。原件=工作区 `dev/agent-workflow/evidence/alpha5/a9b2-approval-diag/`（w2/w5/DIAG-REPORT/R2-RECEIPT；**尚未入 git**，入册=另批 root per-SHA）。矩阵占位=team_bash 行，级别 BLOCKED-FOR-RELEASE。 |

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
| BL-19 | glob/grep 判据线**运行面复验**（#342/#343/#354 已合后的现运行行为） | carried-forward 待复验轮 | BL-10/BL-11 关闭的是**合入/取代事实**；运行行为复验属矩阵复验轮（需测试轮授权，当前产品冻结未开）。 |

## C. 本 docs-realignment 轮自身

| ID | 项 | 状态 |
|---|---|---|
| BR-01 | 三当前态文档 + graph current_contract + AGENTS 入口 + 历史 banner | 本分支首批 commit（已含） |
| BR-02 | CI state-freshness 扩检（Q1-Q8）+ legacy fixture 钉 legacy-only + 正负控 | 本分支第二批（同 PR，非二批） |
| BR-03 | 矩阵 26 行实填（含 R2 行；适用性按依赖路径 drift 实测） | 本分支首批已含实填；复验轮（跑测试/Host）另行，见 current-execution-plan §3 |

## D. 外部效率审查 #5 提效令（dated 真实 2026-10-30T12:0xZ，主 Agent 登记；验收缺口优先于 PR 吞吐）

| ID | 项 | 状态 |
|---|---|---|
| EF-01 | 纯日志/同步 PR 批量化（sync 册制）——每波一批，不逐条开 PR | **已在行**（sync13=#485 为首批全量册） |
| EF-02 | 测试影响面局部快速 CI 反馈路径（本地按受影响包/根选择跑，完整必需门仍只在合并候选 head 上跑）——降低 20.1 分钟级全量 CI 的重复成本；设计需先量测当前各 leg 时长构成，不得削弱合并门强度 | OPEN（离线，可并入下一无 boot 窗口） |
| EF-03 | 离线 PoC → 真实 Host 验收转化率：已完成离线验证的能力（本波=State Home V2；后续=read_image/UI 族）优先排 C 池 boot，不再加设计/报告轮 | **执行中**（V2 lane 已出发） |

<!-- dated 2026-10-30T19:45Z coordinator conflict resolution (sync14 fmerge master): both sides kept verbatim, real-UTC order (section D 12:0xZ before EF-04..06 rows 13:2xZ); zero deletions -->
- **EF-04 环境勘误（dated 2026-10-30T13:27Z）**：共享基线 /srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness 本环境**无 .git**（TEST_METHODS 描述按有仓对待）；worktree test-use 供给的克隆源 = 主检出 tests/deepseek-harness-test-use（detached @pin，porcelain 校验后作 --local 源）。R-G4R-1a lane 实踩（其 README 披露），本条转正。托管 census capture-2 今日两次红（485 heads）待 RCA=flake-or-real 判定，EF-02 相关。
- **EF-05 u7-0 义务摘要再生成法（dated 2026-10-30，RCA 转正）**：MATRIX 与 BACKLOG 文本是 `dev/engineering/tool-obligations/build-expected-tool-obligations.mjs` 的**输入**（:144-145 直读），u7-0-census-reconcile 以字节恒等强制三份工件=回放；**编辑这两份正本必须同提交完成三步仪式**：①无参跑 generator 重生成三工件（`--check` 绿）；②更新 `packages/testkit/test/u7-0-census-reconcile.test.ts` 的 `PINNED.expected_digest` 与 `clean_verdict_digest` 为新实际值并跑绿 26/26（这两常数=漂移探测器本体，同 PR diff 可见=有意变更通道）；③docs:sync findings=0。今日实证：#485 的 backlog EF 行与 sync14 的 M-05 行各自使 hosted census 红（NEW RED=u7-0 replay），plain master 绿。今后所有 sync/矩阵 PR 模板步骤含再生成。
- **EF-06 docs:sync 引用路径法（dated 2026-10-30，RCA 转正）**：`CITED_PATH_MISSING` 检查对**任何形态像 repo 内路径的 token**（含代码注释里的占位路径如 `…/run-uif4-<line>.json`）做冷克隆可开性校验；不存在=blocking。写注释/文档时占位路径必须散文改写或指向真实文件。今日实证：#491 suites/085 头注释（托管 ci-integration 红 → 一行修复重清偿）。与 EF-05 同族=「正本文稿的机器可校验面」。
