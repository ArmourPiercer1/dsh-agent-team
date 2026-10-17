# C-12 裁决简报 — 取消/静默通道的支持语义（decision brief，只整理不实现）

- 轮次 = `alpha5-c12-brief`；writer = qwen3.8-flash-next（liveness 首报）；基 = `origin/master @ aece4f21`（fetch 亲验）。纪律 = 只读 + 本文件新增；**零代码/矩阵/gates 行改动**；零端口、零 world、`:3080` 未触碰。
- 议题来源 = `pr8/vnext-migration-gap-checklist.md:22`（C-12 行）+ gap 分类 B 类判定（`gap-classification-ABC.md` §C-12，branch `alpha5-gap-classify @9a7a0552`，未合 master）。
- **用户裁定边界（本简报前提）**：支持语义不得由实现者默许以 ENFORCE-PARTIAL 替代已承诺安全性。ENFORCE-PARTIAL 在本简报中只作为**实测能力上限的名称**出现，任何节均不把它当作承诺的满足。

## 0. 裁决问题（一句话）

Alpha.5 对"投递保证 / 取消保证 / 静默安全"类宣称的发布语义按哪种口径收口——(a) 接受现状为产品边界 / (b) 补装配承诺 / (c) 硬保证（触 D-1 上游缺）。裁决前 (b)(c) 不得自行开工（gap-classify 派工边界原文）。

## 1. 精确差异：承诺姿态原文 vs 现状能力（每项一行 + 证据）

记：plan = `docs/plans/memo/alpha5-tool-io-governance/alpha5-s0-pr0-pr8-implementation-plan.md`；design = 同目录 `post-poc-technical-design.md`；GATE = `dev/agent-workflow/evidence/alpha5-pr1r/g-g-probes/GATE-VERDICT.md`；SC = 同域 `g-g-support-contract.md`；LIV = `dev/agent-workflow/evidence/alpha5/live/README.md`；ACC = `dev/agent-workflow/evidence/alpha5/ALPHA5-ACCEPTANCE-STATUS.md`；PG = `dev/agent-workflow/PENDING-GATES.md`。

| # | 承诺姿态（原文+行） | 现状能力（实测+证据） | 差距（一行） |
|---|---|---|---|
| D1 | plan:21 `UNSUPPORTED（正确拒绝）` 为阶段结果法定档 | 静默配置（`tools/change` 订阅成功但永不发射）被**接受并正常放行调用**，非"正确拒绝"（GATE :21 P9 只覆盖 `on` 缺失/抛错档；GATE-VERDICT §4） | "正确拒绝"档对静默 armed 配置不成立 |
| D2 | plan:175 "所有 Unsupported 在运行时**确实拒绝**" | G-7 live 实测被移 Body **实跑**（判据 `L-G7-MOVED-BODY-RAN` PASS；`issued=0 cancelled=0`）＝GATE:42；runs `g7-2026-10-16T22-06-58Z` | "确实拒绝"被实测证伪 ⇒ 按原文该配置只能落 UNSUPPORTED（ACC:71 F2 ✗） |
| D3 | design:34 §1-5 不回退律"执行保证不可用时，工具体零执行" | 变更检测保证不可用时 Body 照样执行，结局=名级降级+响亮上报+钉到 re-bind（GATE:42；SC §1 P2） | 不回退律未在静默配置上强制；机制结局非 fail-closed（**证伪在案**＝GATE §4） |
| D4 | plan:206 "不支持的限制**启动前拒绝**" | 启动前 typed 拒（`IO_POLICY_UNSUPPORTED` 点名 `tools/change`）仅存在于 P9 配置；静默配置"装配时刻逐字段与健康订阅相同"= P1 观测命题（D 级，判据 `RW-INERT-ASSEMBLY-INDISTINGUISHABLE`，GATE:13） | 启动前确实拒绝对该配置**不可达**（装配期不可区分），非未实现 |
| D5 | 投递保证：交付时真投递+定向取消生效 | 维度 A **成立**：机检 E（P6 `armed→proven` 断言）+ live G-6 19/19×2 LIVE-CONFIRMED（GATE:28/:46）；代码面 `install.ts:403/:959/:1174` | 成立域=通道确实投递的配置；上限 ENFORCE-PARTIAL；验收计分挂 G-d 不由本行发放 |
| D6 | 取消保证：强制定向终止（已开始即杀/必停） | G-a 裁决原文＝"不保证立即终止、不回滚已发生副作用"（PG:14）；取消=dispatcher 内部**协作式**（LIV:67；abort 传播 `install.ts:826`）；静默配置下取消信号根本不发（GATE:37） | 取消承诺=协作式+响亮检测，非强制终止；静默档连协作式取消也不触发 |
| D7 | 静默安全：永不投递时不遮掩 | 维度 B **成立**：每调用恰好一条 `severity:'alarm'`、binding 降级 `definition-drift`（`scoped-dispatcher.ts:370-375`）、名级钉到 re-bind、零误报（P7）；G-7 18/18（GATE:29/:47） | 证明的是 **DETECTION+REPORT**；漂移后的 Body 仍实跑一次（D2/D3），"响亮"≠"拦截" |
| D8 | ENFORCE-CONFIRMED 级（OS 阻断同特权绕过） | 不可宣称，三缺项原样（LIV:61-67 ≡ GATE:34-38）：①guard/gated lane 均 in-process 无 OS 强制面 ②trusted 输入 fixture-grade 非 OS 锚定 ③取消协作式 | ENFORCE 增强=独立后续项（C-10 队列），从未在本线兑现 |
| D9 | plan:134 "取消与 Job 未结束不能被误写为已停止" | G-a 结果三分类（未执行/已执行可能有副作用/终止未确认）+ executed-unvalidated 响亮告警，未出现"误写已停止"口径 | 此条在裁决口径层面成立（措辞由 lint 常跑守护） |

**差距定性**：缺的不是代码通道（协作式取消+响亮告警已 LIVE-CONFIRMED，G-6/G-7），而是**该类保证的 shipped 支持语义未定**——纯产品边界（gap-classify 判定原文）。两维禁合并：A（proven 可达）不可用于静默配置，B（响亮告警）不可用于宣称投递/取消生效（GATE:46-48）。

## 2. 可保持现有语义的局部方案（不改已验收语义：G-a 裁决原文、两组分判、G-6/G-7 判据、lint 禁则均不动）

| 方案 | 内容 | 能补什么 | 工作量 | 风险 |
|---|---|---|---|---|
| L1 启动自证（投递证明前置于接受） | 订阅后、放行前强制一次"首投递证明"：合成无副作用 registry-change（同名 no-op re-register）若固定 Host 真实发射 ⇒ `armed→proven`；探针不响 ⇒ 启动前 typed 拒（对齐 plan:175 姿态，gap-classify 称其"team 侧装配期可检、属 A 工作量、随装配轮另卡"） | 把"永不发射"从不可区分变为**启动前可检子集**（前提=Host 该行为成立） | 中 | **不确定在册**：合成 change 在 pinned Host（0.2.0-rc.2 @639ed01539）可否零副作用触发=未在册问题，需先 bounded PoC；不满足则 L1 只剩"证明前延迟放行"（deferred acceptance），非"确实拒绝" |
| L2 告警强化 | 现告警已在观察面（alarm 事件+binding 降级+钉到 re-bind）；补：member/leader 可见面呈现 + 告警密度策略旋钮（如 N 次后该名字全局拒，替代等待显式 re-bind） | 缩短"响亮"到"人知晓"的距离；不新增拦截语义 | 小 | 低（纯附加）；上限不变——仍 DETECTION+REPORT，不产生取消/不投递效果 |
| L3 文档边界收紧 | 本简报入册 + §4 建议行走守卫 PR 落 PG；矩阵/s12 引用处对齐 GATE-VERDICT §1 分级表 | 消除"证据收口后语义即闭合"的误读面 | 极小 | 零（措辞面；lint 互斥已按 `lint-g-g-wording.mjs:86-99` 规避设计） |
| L4（相邻非本线） | ENFORCE-PARTIAL 三缺项补齐（OS 强制面 / trusted OS 锚定 / 协作→硬取消） | 抬高 D5-D8 天花板 | — | **不属 C-12 局部**：①②=C-10 独立后续项；③触 D-1（见 §3c），不得包装成"局部可补" |

判定：L1–L3 各自单独可验收、互不依赖；三者全做也**不产生**"投递/取消/静默安全"保证——保证类宣称的收口只能走 §3。

## 3. 真实待裁边界（必须用户选）

- **(a) 接受现状为产品边界**：协作式取消+响亮告警为交付面，"投递/取消/静默安全"类宣称**永久 UNSUPPORTED**（按原计划支持要求，ACC §2-⑤ 口径即为终态而非过渡态）。后果=零代码；G-g 行可按"UNSUPPORTED for 保证类宣称"落 final_declaration；代价=Alpha.5 及后续版本无保证能力，对外措辞永久受 lint 约束。
- **(b) 补装配承诺**：裁 L1（+L2/L3 顺带）为验收要求。后果=plan:175 只对"启动可检子集"闭合，承诺形态从"硬拒绝"变为"可检即拒、不可检即响亮"；且 L1 成立依赖未在册 Host 自证行为——接受该前置风险（或先批 bounded PoC）本身仍是本选项的一部分。
- **(c) 硬保证**（OS 级取消 / 静默配置 fail-closed 不投递）：触 **D-1 上游缺**——固定 Host `bodyInvoked` 私有（PG:32-33，`packages/core/tools/src/index.ts:1580`）、三候选（pre-body 事件 / 公开读点 / resolution-pinned Definition）在册未选型（PG:34-36）。后果=CORE_SEAM_BLOCKER 路线（CORE PATCH BUDGET=0）＝保证线**阻塞**至上游公开 seam，不是待办；D-1 恢复三件套缺一不得宣布恢复（PG:38-40）。

补充：(a) 不是"现状=已承诺"——(a) 的文本效果是把承诺改为受限支持+保证类 UNSUPPORTED，必须由用户明示；实现者/评审者不得以 ENFORCE-PARTIAL 在册而默许此替换（用户裁定边界）。

## 4. 裁决前：当前已合并语义如何表述

**允许的唯一正面表述（裁决前有效）**：
1. G-g **证据门 CLOSED（证据级）**，等级上限 LIVE-CONFIRMED/ENFORCE-PARTIAL（三缺项在册）。
2. 该配置的**产品支持 = UNSUPPORTED 维持**——依据原计划支持要求（plan:21/:175 + design §1-5），即 ACC:26/§2-⑤ 与 GATE:68（"本文件不构成 closed/compliant/fail-closed 宣称"）的在册口径；此维持态本身不待裁，**待裁的是它是否被改为产品边界或承诺补强**（§3）。
3. 正面宣称仅限两维分判：维度 A（proven 可达，限投递配置，计分挂 G-d）与维度 B（静默响亮告警），禁合并；禁则 `fail-closed / closed / 已合规 / compliant / 无引注 SUPPORTED / 恰一次暴露` 由 `scripts/lint-g-g-wording.mjs` root-suite 常跑强制（@aece4f21 实扫生效）。

**G-g 行现行措辞（PG:19）是否足够**：禁则面**已足够**（含证据级限定、ENFORCE-PARTIAL 上限、三缺项、非 fail-closed、双维禁合并、引用纪律，与 GATE-VERDICT 提案行一致）；**待裁面不足**——行内无"支持语义=产品边界待用户裁决（C-12）"指针，读到 :19 即停者可把"证据门收口"误读为语义闭合。

**建议行**（追加到 :19 第二列尾部，经守卫后续 PR 落文；本简报不落笔。已核对 lint 互斥：该行无 `CLOSED/已关闭` 字面、`G-a` 不同行）：

> ；产品支持语义（保证类宣称）= UNSUPPORTED 维持（plan:21/:175），是否改为产品边界或补强装配承诺 = **C-12 待用户裁决**（选项与后果 = `evidence/alpha5/C12-decision-brief.md` §3），不得以 ENFORCE-PARTIAL 在册默认替换

---
writer = qwen3.8-flash-next（只读 + 本文件新增；引用行号全部在 `master @ aece4f21` 树亲验；唯一例外 = `gap-classification-ABC.md`，标 branch+commit）。配套在册：GATE-VERDICT §3-§5 须随任何 G-g 引用同引。
