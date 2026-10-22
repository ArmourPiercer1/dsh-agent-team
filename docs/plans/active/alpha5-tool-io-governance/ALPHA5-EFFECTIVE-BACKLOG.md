# ALPHA5-EFFECTIVE-BACKLOG — 有效待办唯一当前入口

<!-- phase-baseline-ref: dev/agent-workflow/graph.yaml#current_contract — 基线以此字段为准；本文件禁 SHA 副本 -->
- 性质：**当前指令**（非快照）。逐项状态=`carried-forward / closed-by<证据> / superseded / needs-revalidation`；逐项标源行，**禁抄旧 OPEN、禁批量关闭**。历史正文仍以 PENDING-GATES.md / CURRENT-STATE / ACCEPTANCE-STATUS / COORDINATION 为正本（只追加不改写）。
- 状态核读时点=本分支创建；标 `needs-revalidation` 者=源文件状态列与正文/后续 merge 存在矛盾，须矩阵轮/人工重核，本文件不代裁。

## A. Release blocker（唯一）

| ID | 项 | 状态 | 事实与源 |
|---|---|---|---|
| BL-01 | **team_bash default-ask 审批穿透**（R2）：真实 ToolRuntime+Guard 隔离组合下 request=0 / body 哨兵=1 | **OPEN — RELEASE BLOCKER** | effect 为合成哨兵、非整 Host 线上复现，**不扩大断言、不外推到其它工具族**（grep/glob 的 r1 观察仅=同词表机制提示）。原件=工作区 `dev/agent-workflow/evidence/alpha5/a9b2-approval-diag/`（w2/w5/DIAG-REPORT/R2-RECEIPT；**尚未入 git**，入册=另批 root per-SHA）。矩阵占位=team_bash 行，级别 BLOCKED-FOR-RELEASE。 |

## B. Alpha.5 门/延期项（PENDING-GATES 逐项核读，含矛盾标注）

| ID | 项 | 状态 | 核读说明（源=PENDING-GATES.md@9b2 行号） |
|---|---|---|---|
| BL-02 | G-b seam-record/s12 必改（三事实+限定措辞） | carried-forward | L15 状态"修复中"；无关闭证据在册。 |
| BL-03 | G-c PR256 F-1/F-2 修复 | **needs-revalidation** | L16 **矛盾**：状态列="修复中"，同行动放行动作列="修复+新 head 独立复核+CI **已完成**：#256 合 ae3dcf54；#260/#261 各独立复核+CI 绿后合"。矩阵轮按 merge 事实重裁，不抄状态列。 |
| BL-04 | G-d 各 lane 对契约 v1.1 集成确认（含 p4t6 pin、tsconfig、接线注、F-3 义务、Supported 宣称禁令） | **needs-revalidation** | L17 **矛盾**：状态列="未开始"，放行动作列已录 wiring #268 @9e75ee83 + live #269 @0e0b605a 入账。ACCEPTANCE-STATUS 判 G-d=OPEN 为更晚口径；G-6 计分项挂本行。人工/根裁关闭。 |
| BL-05 | G-e 原 G1/G3/G7/YAML 待裁项 | carried-forward **未裁** | L18。**不得写成已裁**；四编号正文不在仓内（G-e-mapping.md §1b），引用须带"内容缺位"披露。 |
| BL-06 | G-g 静默通道排除门 | closed-by 证据门收口（**非产品支持宣称**） | L19：等级上限 LIVE-CONFIRMED/ENFORCE-PARTIAL 三项缺项在册；措辞禁则=lint-g-g-wording 常跑；双维度禁合并。 |
| BL-07 | G-f census 非终态禁称全绿 + 事件缺口注记 | carried-forward（纪律行） | L20、L52-56 纪律持续有效。 |
| BL-08 | D-1 NO-ABORT-AFTER-BODY-START | carried-forward DEFERRED（有主，非放弃） | L26/L29-42：owner=d9da2f74（L24 指派）；恢复三条件其一公开才解；回归三件套在册；禁以"延期"写成"已裁放弃"。 |
| BL-09 | D-2 skills 对齐 | closed-by d6b57e55(#270)+终验 420ed3ee(#271) 9/9 | L27。 |
| BL-10 | glob 独立关断键 `a5-globoff-key` | needs-revalidation（候门→现态重查） | 源=CURRENT-STATE §C"已裁、交付候门 @27f70457"；9b2 是否已含关断键须矩阵轮 `git log` 现场核（禁抄）。 |
| BL-11 | #337 glob rc-first 判据线收口 | needs-revalidation | CURRENT-STATE §C 记录收口进行中 + #354（=baseline 自身，confined-rg 取消协作）已落；两线现态矩阵轮实测（#354 与 bash 取消**无关**）。 |
| BL-12 | C-16 钉名表 | closed-by c8ad9c4a（原始 13 名钉+双向漂移机检）；三段实况见 CURRENT-STATE §C | 后续以 pindir 证据为准。 |
| BL-13 | T-1 v3 退役窗口 | carried-forward 待用户裁 | CURRENT-STATE §C（双 v3/v4 并行本身可运行=非必决）。 |
| BL-14 | scoped visibility Q1（休眠 vs 登记 upstream ask 二选一） | carried-forward 待根一句话 | CURRENT-STATE §C；Q 单其余 RESOLVED。 |
| BL-15 | census 上传强化 | carried-forward 待根批准独立小 PR | CI 本体零动=根裁。 |
| BL-16 | net 半臂（confined-execution network arm） | 上游词表需求级缺口，**登记非本仓待办** | M-08 notes 原文口径；#332=0fa2cd76 登记。 |
| BL-17 | bg producer（team_bash 后台臂） | **未合入基线** | 工作区 bg WIP 未跟踪；本分支禁混入；恢复走原 task 纪律。 |
| BL-18 | a9b2-approval-diag 原件入册 | carried-forward 待批 | root per-SHA evidence commit 另批；本轮矩阵仅路径引用+"尚未入 git"披露。 |

## C. 本 docs-realignment 轮自身

| ID | 项 | 状态 |
|---|---|---|
| BR-01 | 三当前态文档 + graph current_contract + AGENTS 入口 + 历史 banner | 本分支首批 commit（已含） |
| BR-02 | CI state-freshness 扩检（Q1-Q8）+ legacy fixture 钉 legacy-only + 正负控 | 本分支第二批（同 PR，非二批） |
| BR-03 | 矩阵 26 行实填（含 R2 行；适用性按依赖路径 drift 实测） | 本分支首批已含实填；复验轮（跑测试/Host）另行，见 current-execution-plan §3 |
