# C-12 裁决简报 — 取消/静默通道的支持语义（decision brief，只整理不实现）

- 轮次 = `alpha5-c12-brief`；writer = qwen3.8-flash-next（liveness 首报）；基 = `origin/master @ aece4f21`（fetch 亲验）。纪律 = 只读 + 本文件新增；**零代码/矩阵/gates 行改动**；零端口、零 world、`:3080` 未触碰。
- 议题来源 = `pr8/vnext-migration-gap-checklist.md:22`（C-12 行）+ gap 分类 B 类判定（`gap-classification-ABC.md` §C-12，branch `alpha5-gap-classify @9a7a0552`，未合 master）。
- **用户裁定边界（本简报前提）**：支持语义不得由实现者默许以 ENFORCE-PARTIAL 替代已承诺安全性。ENFORCE-PARTIAL 在本简报中只作为**实测能力上限的名称**出现，任何节均不把它当作承诺的满足。

## 0. 真最小待裁问题（两项；其余不待裁）

**Q1** 是否接受"当前 Host / 当前版本能力边界"为**本版本**发布姿态（保证类宣称=当前版本 UNSUPPORTED；**不冻结未来版本**）；**Q2** 是否为硬保证路线**启动上游接触**（D-1 三候选 contact/选型——CORE PATCH BUDGET=0 下上游接触本身=用户授权动作）。其余全部为可先行动作，不待裁（§3 非待裁清单）。裁决前口径不变：**不默认接受弱化**——保证类宣称维持 UNSUPPORTED（plan:21/:175），承诺装配/新增拦截类语义不得自行开工（gap-classify 派工边界原文）。

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
| D8 | ENFORCE-CONFIRMED 级（OS 阻断同特权绕过/强制终止） | 不可宣称，三缺项原样（LIV:61-67 ≡ GATE:34-38）：①guard/gated lane 均 in-process 无 OS 强制面 ②trusted 输入 fixture-grade 非 OS 锚定 ③取消协作式 | ENFORCE 增强=独立后续项（C-10 队列），从未在本线兑现；**其缺因独立，与 D10 公开 seam 无因果隶属** |
| D9 | plan:134 "取消与 Job 未结束不能被误写为已停止" | G-a 结果三分类（未执行/已执行可能有副作用/终止未确认）+ executed-unvalidated 响亮告警，未出现"误写已停止"口径 | 此条在裁决口径层面成立（措辞由 lint 常跑守护） |
| D10 | 精确取消：严格"只取消未执行调用"（D-1 属性 NO-ABORT-AFTER-BODY-START，PG:26/:31） | 固定 Host `bodyInvoked` 私有（PG:32-33，`packages/core/tools/src/index.ts:1580`），raise 现场无从判定已开始 vs 未执行 ⇒ D-1 延期有主（PG:24） | D-1 差距=**缺公开 body-start/pre-body 检查**（三候选未选型，PG:34-36）——**不是** OS 强杀能力缺（D8），**也不是**静默档零执行缺（D3/D4）；三个缺口各归各因，禁写成统一根因 |

**差距定性**：缺的不是代码通道（协作式取消+响亮告警已 LIVE-CONFIRMED，G-6/G-7），而是**该类保证的 shipped 支持语义未定**——纯产品边界（gap-classify 判定原文）。两维禁合并：A（proven 可达）不可用于静默配置，B（响亮告警）不可用于宣称投递/取消生效（GATE:46-48）。

## 2. 可保持现有语义的局部方案（不改已验收语义：G-a 裁决原文、两组分判、G-6/G-7 判据、lint 禁则均不动）

| 方案 | 内容 | 能补什么 | 工作量 | 风险 |
|---|---|---|---|---|
| L1 启动自证（投递证明前置于接受） | 订阅后、放行前强制一次"首投递证明"：合成无副作用 registry-change（同名 no-op re-register）若固定 Host 真实发射 ⇒ `armed→proven`；探针不响 ⇒ 启动前 typed 拒（对齐 plan:175 姿态，gap-classify 称其"team 侧装配期可检、属 A 工作量、随装配轮另卡"）。先行形态=**隔离合成世界 bounded PoC**（不改产品语义/发布保证；只读诊断无需另行批准） | 把"永不发射"从不可区分变为**启动前可检子集**（前提=Host 该行为成立） | PoC=小；产品化=中 | **不确定在册**：合成 change 在 pinned Host（0.2.0-rc.2 @639ed01539）可否零副作用触发=未在册问题。**关键证伪判据**：① 同名 no-op 注册是否产生**真实事件**；② no-op re-register **零副作用**核验；③ "启动证明成立后再丢事件"反例——任一落空 ⇒ L1 只剩"证明前延迟放行"（deferred acceptance）非"确实拒绝"；③即便全过也确立**仅启动时健康不可外推未来保证**（D4 的"不可外推"半差距恒存） |
| L2 告警呈现强化 | 现告警已在观察面（alarm 事件+binding 降级+钉到 re-bind）；补=把既有观察面告警呈现至 member/leader 可见面（纯呈现） | 缩短"响亮"到"人知晓"的距离；**不新增拦截语义** | 小 | 低（纯呈现）；上限不变——仍 DETECTION+REPORT，不产生取消/不投递效果 |
| L2b 新增拦截语义候选（单列） | 告警密度策略旋钮（如 N 次后该名字全局拒，替代等待显式 re-bind） | 拦截形态扩展 | — | **属新运行语义，非纯呈现**——从 L2"纯附加"口径移出；**本轮不加阈值**，若引入须自带判据与验收，且属 Q1 的本版本姿态讨论而非默认强化项 |
| L3 文档边界收紧 | 本简报入册 + §4 建议行走守卫 PR 落 PG；矩阵/s12 引用处对齐 GATE-VERDICT §1 分级表 | 消除"证据收口后语义即闭合"的误读面 | 极小 | 零（措辞面；lint 互斥已按 `lint-g-g-wording.mjs:86-99` 规避设计） |
| L4（相邻非本线） | ENFORCE-PARTIAL 三缺项补齐（OS 强制面 / trusted OS 锚定 / 取消协作式） | 抬高 D5-D8 天花板 | — | **不属 C-12 局部**：①②=C-10 独立后续项；③取消协作式≠D-1——D-1 是"只取消未执行"的**精确性**缺（D10，缺公开 body-start 信号），"OS 级强制终止"属 D8 类 OS 强制面缺，各归各因（见 §3 Q2）；不得包装成"局部可补" |

判定：L1–L3 各自单独可验收、互不依赖；三者全做也**不产生**"投递/取消/静默安全"保证（L1 限启动前子证且不可外推，见 L1 判据③；L2b 属新增拦截语义非本表默认项）——保证类宣称的收口只走 §3 Q1/Q2。

## 3. 真最小待裁问题（Q1/Q2）+ 非待裁动作

**Q1 · 本版本发布姿态：是否接受"当前 Host / 当前版本能力边界"**
- **A1 接受**：当前版本交付面=协作式取消+响亮告警；"投递/取消/静默安全"保证类宣称=**当前 Host/当前版本下 UNSUPPORTED**（ACC §2-⑤ 口径，限定当前版本，**不冻结未来版本**——后续版本仍可经 L1 装配兑现或上游 seam（Q2）收紧，本裁决不预放弃该路线）。后果=当前版本零代码；G-g 行可按"UNSUPPORTED for 保证类宣称（当前版本）"落 final_declaration；对外措辞在当前版本受 lint 约束。
- **A2 不接受（本版本要收紧）**：落点只有 L1 启动自证，且其"确实拒绝"效果取决于 §2 L1 PoC 三判据结果；PoC 不成立则本版本只剩 L2 呈现强化（响亮更早，无新拦截），不能承诺"确实拒绝"。A2 无需预批语义变更——PoC 先行、按结果复裁。

**Q2 · 是否启动上游接触**——硬保证路线=**三个互相独立的缺口**，不得由任一充当统一根因：
- **c1 精确"只取消未执行"（D-1）**＝缺公开 body-start/pre-body 检查（PG:32-36 三候选在册未选型）——**不是** OS 强杀能力缺；恢复三件套缺一不得宣布恢复（PG:38-40）。
- **c2 OS 强制面**（同特权阻断/强制终止）＝独立缺项（LIV:61-63 缺项①，C-10 队列），缺因**不是** D-1。
- **c3 静默档"保证不可用即零执行"**（design:34 要求，证伪在案 GATE §4）＝启动前可检性缺（D4），方向=L1，亦**非** D-1。
  Q2 只裁"对 c1 相关候选是否发起 upstream contact/选型"（PG:7：项目内登记≠外部请求，对外接触须用户授权）；答"不启动"= c1-c3 维持在册原样——CORE PATCH BUDGET=0 下阻塞是**阻塞**，不是待办。

**非待裁动作（可先行，不依赖 Q1/Q2）**：L1 隔离合成世界 bounded PoC（只读诊断）；L2 纯呈现告警可见化；L3 文档收紧（§4 建议行走守卫 PR）；C-10 三缺项增强（独立后续项在册）；矩阵/s12 引用对齐 GATE-VERDICT §1。

保持原承诺口径：Q1 裁决前=保证类宣称维持 UNSUPPORTED（按原计划支持要求），**不默认接受弱化**；ENFORCE-PARTIAL 仅是实测能力上限的名称，不是任何承诺的满足（§前提）。

## 4. 裁决前：当前已合并语义如何表述

**允许的唯一正面表述（裁决前有效）**：
1. G-g **证据门 CLOSED（证据级）**，等级上限 LIVE-CONFIRMED/ENFORCE-PARTIAL（三缺项在册）。
2. 该配置的**产品支持 = UNSUPPORTED 维持**——依据原计划支持要求（plan:21/:175 + design §1-5），即 ACC:26/§2-⑤ 与 GATE:68（"本文件不构成 closed/compliant/fail-closed 宣称"）的在册口径；此维持态本身不待裁，**待裁的只有 Q1（本版本边界接受与否）与 Q2（上游接触启动与否）**（§3）。
3. 正面宣称仅限两维分判：维度 A（proven 可达，限投递配置，计分挂 G-d）与维度 B（静默响亮告警），禁合并；禁则 `fail-closed / closed / 已合规 / compliant / 无引注 SUPPORTED / 恰一次暴露` 由 `scripts/lint-g-g-wording.mjs` root-suite 常跑强制（@aece4f21 实扫生效）。

**G-g 行现行措辞（PG:19）是否足够**：禁则面**已足够**（含证据级限定、ENFORCE-PARTIAL 上限、三缺项、非 fail-closed、双维禁合并、引用纪律，与 GATE-VERDICT 提案行一致）；**待裁面不足**——行内无"C-12 真最小待裁问题（Q1/Q2）"指针，读到 :19 即停者可把"证据门收口"误读为语义闭合。

**建议行**（追加到 :19 第二列尾部，经守卫后续 PR 落文；本简报不落笔。已核对 lint 互斥：该行无 `CLOSED/已关闭` 字面、`G-a` 不同行）：

> ；产品支持语义（保证类宣称）= UNSUPPORTED 维持（plan:21/:175），是否接受当前 Host/当前版本能力边界为本版本姿态、或补装配收紧/启动上游接触 = **C-12 Q1/Q2 待用户裁决**（问题与后果 = `evidence/alpha5/C12-decision-brief.md` §3），不得以 ENFORCE-PARTIAL 在册默认替换

---
writer = qwen3.8-flash-next（只读 + 本文件新增；引用行号全部在 `master @ aece4f21` 树亲验；唯一例外 = `gap-classification-ABC.md`，标 branch+commit）。修正轮 = 根 05:0xZ 指令五项：(a)→Q1 限当前版本不冻结未来；D-1 缺口按 D10 独立归因（≠OS 强杀≠静默零执行的统一根因）；L2 拆纯呈现/新增拦截候选（本轮不加阈值）；L1 增隔离 PoC 先行形态+四关键证伪判据（启动健康不可外推）；§3 重写为真最小待裁集 Q1/Q2+非待裁清单。配套在册：GATE-VERDICT §3-§5 须随任何 G-g 引用同引。
