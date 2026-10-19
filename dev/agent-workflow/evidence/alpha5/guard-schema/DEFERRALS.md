# DEFERRALS — 既定延期项精确原因复核（现场从 evidence/日志核，d5de7497）

C 路；取证 2026-10-19T08:0x–08:5xZ。每项=延期时点精确技术原因（verbatim+路径:行+UTC）+ 今日状态判定。
**U1/v4 行按根 07:30Z 令：只给闭合条件（前置+最小验收形），不复活、不排实施、不作"现在就能做"建议。**

---

## U-1 v4 执行面 / effect-queue 同路线（**并入行**：HANDOFF:32「p4t7 schema 迁移」=协调者速记，全仓仅此一处出现，无独立台账——按 parent 裁定并入本行）

**延期原因（原文，均 verbatim）**
- `docs/blueprint-authoring.md:168-172`（发布轮自我声明）：「**Production effect acceptance is still closed.** A v4 document's `toolBindings` is parsed, frozen and hash-bound — but the runtime effect plane does not yet EXECUTE those lanes… **wiring is the effect-queue round's.** Authoring a v4 document is therefore **safe-but-dark for effects**」
- `ADR-vnext-blueprint-schema-v4.md:101-102`（§7）：「文档面**接受**这些 token 属 **effect-queue 行为轮**（独立 PR、独立审查）：在那之前文档仍按名拒绝——先钉死的方向是『**parse-accept ⇒ runtime 可映射**』」
- `packages/domain/vnext-field-mapping/src/index.ts:4`：「**DORMANT: zero production consumers**」
- 候选包 `candidate-package/README.md:197+` 已知限制页 §4：「**v4 执行面 = fail-closed 既定延期**（v4 语义不在本候选验收面内）」
- GLUE-8 停针披露（U1 考证件 `alpha5-u1-probe@cc58e4d2` §0）：「v4 面 toolBindings 家族 **runtime 消费者=0**，家族无 digest/def-anchor 字段，映射 def#N=新语义待裁」——U1 溯源结论：「**缺实现=在排期，缺字段=既定封闭形状，均非新裁**」。
（U1 考证件在 `alpha5-u1-probe` 分支，**不在 master d5de7497**；本行引其结论性原文时已注明。）

**精确技术原因（一句）**：PR#249/S0 §11:171 只承诺字段族进 vNext schema（A 类承诺）；runtime 效应行为被既定排期给 effect-queue 行为轮（B/C 类），映射引擎保持 DORMANT 是设计姿态不是缺口。

**闭合条件（按根令，只此两项）**
- *前置*：①effect-queue 行为轮立项（独立 PR、独立审查——ADR §7 原文要求）；②作者面→内部 `ToolBinding` 映射引擎获接线路径（`field-mapping.ts` 默认拒绝语义保持，接线不改律）；③若采「def#N 由家族推导」路线：须先有对「不新造第二套身份语言」（CAND D-04）与 #313 placement-only 权威法两条既有律的**显式新语义裁决**（该问题在 A-1..A-8/§6.1 U 表/DECISION-PACK **均无先例条目**，属真新语义）。
- *最小验收形*：v4 文档的家族声明在真宿主上驱动**真拒**（S0 §11:175 矩阵律：「所有 Unsupported 在运行时**确实拒绝**；`P0 fixture 成功` 不能抵 PR8 Gate」）+ 迁移只读报告四律在接线路径逐条有负控（扩权=REJECTION 非选项、无来源宽值=REJECT、requires-decision 不静默）+ 映射表「parse-accept ⇒ runtime 可映射」不出现反向裂缝（ADR §7）。
- *前提消失证据*：无。d5de7497 树内 effect-queue 轮未立项、映射引擎零产线消费者、`MIGRATION_PERMISSION_WIDENING` 等 fail-closed 形仍只在测试面——延期前提**在场**。

---

## U-2 p4t6 ROSTER（「deferred=roster 非 world；race 修复在 #347 候批」）

**可证实体与延期原文**
1. *名册延期（roster 面）*：`packages/testkit/test/a4p7-blueprint-version-clean.test.ts:233-247` DEFERRALS 名册 6 行。前五=「**stays dirty ON PURPOSE**」（退役版本的负例主体/哈希锚，「Deleting this entry … goes the stale-check red, which is the design」）。第六=`packages/legacy/test/p7t6-teammates-adapter.test.ts` 行 verbatim：「NO §7.4 LANE ROW … this is the **legacy .md teammate-file format's OWN version axis, not a TeamBlueprint document** … **Awaiting the fence's dirty-class adjudication row** — disposition recorded in `evidence/a4-pr7/7-3-flip/intentional-retired.md` row 3 … owner: fence owner + §7.3 emitter」——**这就是"roster 延期非 world"**：延的是**扫描名册上的一行裁决位**（legacy roster/.md 自有版本轴的脏类裁决），不是世界运行时缺口。roster 读侧另有宽容形：`packages/legacy/session-reader/format.ts:297-299`（`schemaVersion≠1` 只 push `SCHEMA_VERSION_MISMATCH` **warning，不 drop 文件**——读者职责=不丢）。
2. *race 修复候批*：`gh pr view 347`=**OPEN**、title 载 **DO NOT MERGE**、head=`8f9099966bfc06fa66994f3f7aa2958e025edb57`、merged_at=null；body 自述「DO-NOT-MERGE pending root per-SHA order + independent review + dual CI at exact head」+ 独立审 179bb95f VERBATIM=两联判定**通过（必办 0）**；双 CI 绿（COORDINATION.md:238/243 及 #347 body：回归 p4t6 10/10、planted-window 10/10、census-shape 并发 10/10、pin 1204/1206 亲数）。
**精确技术原因（一句）**：p4t6 扫描宇宙名册在并发 census 下被 a4p7 lint 控制探针对污染（1204→1206 确定性加载窗竞态，RED 实录 repro-RED-1206.log）；修复=控制探针迁出被扫面（实现面单文件 controlDir→repo root，扫描器/判据/pin 零动）；另留一行 legacy .md 版本轴裁决位归 fence owner。

**今日可否按原架构补全**：**部分**。
- race 修复本体=**能且已备好**：障碍仅剩**根 per-SHA 放行**（技术无障碍；8f909996 已 forward merge-sync  onto d5de7497 零冲突，双审+双 CI 在精确头）。最小步：**0 步技术活**，1 次根确认 + 1 次 `gh pr merge 347 --squash --match-head-commit 8f909996…`（由根/parent 执行）。风险≈0（p4t6 面零改动，合并树已亲测 1206 账+10/10）。
- p7t6 裁决位=**能但归 owner**：最小步=在 `evidence/a4-pr7/7-3-flip/intentional-retired.md` 体系内落「dirty-class 裁决行」（纯文档，fence owner 出文+复核）。风险=低（名册等式机检兜底，不触扫描器）。

---

## U-3 shape-N/A 18 枚

**延期原文**：主检出 `COORDINATION.md:233`（2026-10-18T23:5xZ）：「⑤ …**GREEN 32/32+4 booked+18 shape-N/A**…覆盖如实=只驱 default 形，18 条 off/rename 腿 shape-N/A **非绿非红**，关断结论仍以 22-07-01 跑为准；23-36-28 覆盖红处置=na:true 账+重跑判据零删」。
**18 枚清单（现场数出，`a5-candidate-pkg`@01082b35 `glob-off-install/runs/2026-10-18T23-39-12Z/RECORDED-TRANSCRIPT.log`，`^NA` 行=18）**：M0b,M0,M1,M2,M2b,M3,M4,M5,M6,M7,M8,M9,M10,C5（14 枚 `shape 'off'`）+ R1,R2,R3,R4（4 枚 `shape 'rename'`），每行带「[shape 'off' not executed this run]」。
**精确技术原因（一句）**：⑤轮参数化只驱 **default 形**（关断键缺省面正控），off/rename 形腿在该形下不适用；off 形的权威验收在旧关断面 `runs/2026-10-18T22-07-01Z`（49/50+3 booked，唯一红 H1b=钉条件红，根裁=「移动 live master 与冻结验收 SHA 的时间竞态」，旧红保留不宣称全绿——candidate README 限制页脚注①）。
**今日可否按原架构补全**：**部分**。
- off 形 14 枚：技术面**已在 22-07-01Z 面测过**（非未测语义，是未在新面重跑）；关断键已入冻结树（#342=46e48218 在 d5de7497）。最小步=kit（`glob-off-install/code/a5glob-off-kit.mjs`，随 01082b35 已参数化）在现头驱 off 形 1 跑+落账；风险=低，但 **H1b 型钉条件红须按根先例如实保留**（移动 ref vs 冻结 SHA 竞态——须钉 CANDIDATE_SHA 驱跑，勿钉移动中的 master）。
- rename 形 4 枚（R1-R4）：需 rename 形调用方在场（关断键改名拼写形）。最小步=同上 kit 加 rename 形参数 1 跑；风险=低（纯测试面）。
- 合计≈2 kit 跑 + 2 落账笔，零代码改动。

---

## U-4 browser 宿主依赖（两层，各别定性）

**层一：真实浏览器渲染验收维**（历史延期→已闭带限制）
- 原文（根 README 快照行，`a5-candidate-pkg:README.md:117-118`）：「the main session has stopped environment probing; **browser-rendering dimension: no browser binaries in this environment**」；后（同文件 :197 段 2026-10-02 CURRENT）：「**Browser lane CLOSED (2026-10-02): stage-2 LIVE run-7** … kit **VERDICT PASS 16/16 criteria (59/0)** … **DoD #20 (b) real-browser-rendering dimension = CLOSED**」+限制原文「DoD-20 **E4 remains historical unit/E2E — no new browser run of E4 and none claimed**」。中间态披露（同段 superseded 14:30Z）：「Chromium-1228 + headless-shell present … **two sandbox:true probes failed (observed: AppArmor unprivileged_userns DENIED CAP_SYS_ADMIN)**」。
- **今日判定**：能（受限）——二进制在位+CLOSED 先例在账；障碍=环境（AppArmor userns 属宿主/OS 动作，非仓内代码）；最小步=若需新跑：独立环境 session 按 run-7 配方复驱（仓内最小步=0）。
**层二：browser 工具面（宿主词表）——「口径裂缝」已按根 07:46Z 令降级为事实核对并自主收口（本目录 `FACT-CHECK-browser.md`）**
- 事实（核对单钉死）：宿主 0.2.0-rc.2 全树无 `browser` 工具名（`ALPHA5-CURRENT-STATE.md:69`，@639ed01539 0 命中）；stagehand_*×6=**宿主侧注册**（实验包 `packages/experimental/browser-use-stagehand-native/src/index.ts:176-180` `stagehand_${method}` 命名模板工厂，BrowserMethod 六键；**非我方装配**），我方仅在 `team-tool-plane.mjs:318` PLANE_RESERVED_NATIVE **防冒名钉名**（pre-fix 装配曾 ACCEPTED 该名=负控在 pindir/）；「现装」两读法=catalog-shipped（catalog schemas boot 解析+宿主 docs/tool-catalog.md 逐名成节）vs bundle-mounted（base/preset **不显式挂载**，需 profile patch）——`pindir/ADVERSARIAL-SWEEP.md:34,63-64`。
- **裁决状态更正（不再挂"候用户裁"）**：口径裂缝**已销案**——根 21:15Z ③「**'现装才钉'口径撤回后无冲突悬案，维持已钉不动（销案）**」（`pindir/README.md:110`；`ADVERSARIAL-SWEEP.md:69-71` 附记）。HANDOFF 所引「待裁」语境=COORDINATION.md:199，**该行已被 :200 撤回行作废**（虚构"根 21:05Z 并集口径"，补钉轮未发生）；实况=:201（21:1xZ 实况版，两读法作事实呈供参考不含倾向）→ :207（**根 21:15Z (b)+(c) 真令**落地：codex/claude_code 补钉、stagehand 维持已钉）。来源反查腿（钉名须有真实注册来源，猜名=红）66 名全过（`pindir/README.md:106-108`）。
- **计划条款对账**：PR #249 文档集（`docs/plans/memo/alpha5-tool-io-governance/` 六件）+ 阶段计划 WIRING-PHASE-PLAN grep `browser|stagehand` **零命中**——**browser 条目冻结措辞不存在** ⇒ 条款语义冲突无从构成（四联不成立）。
- **精确技术原因（一句）**：真"browser"工具名不存在于现宿主发布面（上游公开面事件位）；插件侧不能造宿主名（CORE=0）。stagehand 面=已钉已裁，非待办。
- **今日判定**：browser 工具名本身=**不能单方面补**（等宿主发布面出现该名，上游事件）；stagehand 口径维度=**已闭**（销案在案）。仓内既有 C-16 三件套机检（双向漂移+来源反查+flip 漂移）常跑中。最小步=0。

---

## U-5 F3b gen2（K12 外部杀手）

**延期原文**：`a5-candidate-pkg:.../a5c1fix-b/TRIAGE.md:9-15` verbatim：
- 「## K12 — **external mid-run killer (shared host)**, two victims on the fixed face / rv2 … **job evaporated from the registry mid-chain**; kit+host dead … HARVESTED (disclosed, not a graded run) … / rv2b … **killed in the pnpm-install phase** (peak memory; concurrent foreign agent worlds visible in tests/homes → **OOM/reaper suspected, unprovable from sandbox**)」
- 「## K13 — rv3 install-phase hang … hung ~25min > the kit's 900s spawnSync timeout … **Distribution finalized 2 KIT_DONE + 1 HARVEST**」
- `a5c1fix-reverify/DISTRIBUTION.md`：「**定档：2 枚 KIT_DONE + 1 枚 HARVEST（带标签），≥3 样本判据满足；rv3 重试不改变判词**」+ 对照面「修复前 … cancelled=**false** ×5，gen1=marker 形状 → 修复后 true×3/kind:user×3；**wire 死亡形两代同红=宿主法律负断言**」。
**精确技术原因（一句）**：gen2（修复面分布样本）补足纯 KIT_DONE 样本被**共享宿主的外部腰斩杀手**（rv2 蒸发/rv2b 安装相死，OOM/reaper 疑似**未证**）阻断；定档 2+1 已满足 ≥3 判据，故"延期"的精确所指=**gen2 纯全账样本形态未达成**（判据本身已按带标签计入成立）。
**今日可否按原架构补全**：**部分**——技术路线在（kit `a5c1fix-b-kit.mjs` 现成、装面 SAME_BYTES 链在账），障碍=K12 威胁**未证消失**且源自共享宿主外部（非仓内可控）。最小步=1 次 kit 复驱（钉死面、带 harvest-on-death+即时脱敏纪律，TRIAGE 缓解姿态原样沿用）；风险=中（再腰斩仍只能带标签入账，不改善分布纯度；且须错峰防撞 rv2b 型安装相杀手）。**判词不因复驱改变**（DISTRIBUTION 原文），故本项属"纯度改善"非"验收缺口"。

---

## 检索盲区（如实）
- 「p4t7」全仓唯一出处=HANDOFF:32（已按 parent 裁并入 U-1，不造指代）。
- 「roster 非 world」无逐字原文——上行为可证实体映射（DEFERRALS 名册行 + p7t6 裁决位 + session-reader ROSTER_* 常量），语义吻合处已标注为解读。
- K12 主检出 COORDINATION.md:238 为未跟踪尾件（工作文件），已改用其入册版（TRIAGE.md@候选分支）作正本引用。
