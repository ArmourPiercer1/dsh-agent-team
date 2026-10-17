# D2-closeout-verification — D-2 收尾核验（名义终验段 4dac3d04，qwen3.8-flash-next）

- **基线**：master @ `46a406b9284f4f4add823319df91be8a2f2160fa`（= origin/master；落文 `d6b57e55`(#270) 与候选件 `46a406b9`(#267) 均在其内）。
- **对象**：`.agents/skills/team-leader-operations/SKILL.md` §7 追加条（:250-253）+ §8（:255-302），按 `dev/agent-workflow/evidence/alpha5/pr8/skills-candidate-D2.md`（@46a406b9，blob 与 `c0cfa718` diff=0）**九条验收清单**（:82-92）逐条终验。
- **前置件**：独立审查 PASS（`pr8/review-D2-skills.md`@`e34ef129`，裁决=通过 0 阻塞/2 非阻塞 RNB1-RNB2）；执行注记（`pr8/skills-update-D2-execution.md`）。本件为收尾核验轮终验，独立复跑全部关键比对，不转述前件结论。
- **纪律**：只读 + 本文件新增（`git show d6b57e55 --numstat` 实测 SKILL.md +53/−0 单 hunk 纯插入由本件复核）；分支 `alpha5-d2-verify` 基 46a406b9 ff push；master/stable 未触碰。

## 判定

**九条验收清单 = 9/9 通过（0 不通过）**。行为/执行维度对 §8 全部可测声明逐条对照既有 live 证据：**11 项执行级吻合、1 项 record-level（如实标注，见 B-10）、1 项裁决边界（规范句，无执行义务，见 B-12）**。旧口径残留 = 0。**D-2 skills 落文维度 = 终验通过。**

## A. 文本维度（master@46a406b9 树上亲测）

### 引用 byte-identical 复核（脚本，非转述）

| 比对 | 方法 | 结果 |
| --- | --- | --- |
| 候选 §8（c0cfa718 :12-57，46 行）↔ SKILL.md :255-302（48 行） | `diff -u` | 唯一差异 = 末段末行追加一句（:300-302，3 物理行），其余 45 行含缩进逐字一致 ✓ |
| 候选 §7 追加条（:63-66）↔ SKILL.md :250-253 | `diff` | 4/4 逐字，零差异 ✓ |
| 唯一增句 ↔ 执行注记 :26-28 引文 | 脚本（剥 `> ` 前缀、剥 `regression legs first. ` 行首） | `landed==quoted: True`、`quoted==sent: True` ✓；语义源 = PENDING-GATES.md:7「本登记**仅限项目内**…」原文 |
| PENDING-GATES G-a 裁决+边界段（:14，截取 `sed 's/。运行接线验收.*//'`）`3768a28d`↔`cc47fb18`↔`46a406b9` | sha256 三方 | `640471c8a104e42c3b0b0b74ef937cb66de4680494d29d38629ab0be7f8f6564` 三方恒等；且 `git diff 3768a28d 46a406b9 -- PENDING-GATES.md` = 空 ✓ |
| 候选文件 c0cfa718 ↔ 46a406b9 | `git diff` | 0 行（清单文本同源）✓ |

### 结构

- `## ` 标题序 = :13/:33/:95/:122/:150/:206/:228/:255 → **§1..§8 连续**；:306 无编号 Alpha.4 附录保持文末原位 ✓。
- frontmatter（name/description）完好；d6b57e55 numstat = SKILL.md **53/0**（纯插入，既有行零改写）✓。

## B. 九条清单逐条判定（文本 + 行为双维）

**① 三分类措辞与 (k) 一致 — PASS（执行级）。** SKILL.md :279-281 `not executed / executed, possibly with side effects (original value preserved) / termination unconfirmed` ↔ `s12-residual-evidence.md`（下引 s12，`dev/agent-workflow/evidence/alpha5-pr1r/`）(k) :323 原文三分句逐点对应，无第四类；:281-282 明确 `EXECUTION_TERMINATION_UNCONFIRMED` 不折叠 ↔ (k) E 行 :333「不并入『未执行』，也不并入『已执行』」。执行面：第三类实测在 `runs/kit-r1r-fix1/order-hazard.json` :20/:32/:44/:56/:160（`teardown=EXECUTION_TERMINATION_UNCONFIRMED`），`runs/kit-r1r-fix1/run-receipt.md` :23/:25/:27 PASS(exit=0)。

**② 两句显式在场且绑定"已开始调用" — PASS（执行级）。** 「不保证立即终止」= :271-272（"the ruling does NOT promise immediate termination"，语句主语即 started calls）；「不回滚已发生副作用」= :278（"Side effects of already-started calls are NEVER rolled back"，显式限定 already-started）。执行面：`runs/kit-r1r-fix1/rereg-window.json` :47-50 `RW-ABORT-INSIDE-BODY-IS-TERMINATION` `v1=1 code=ABORTED terminated=1/1 cancelledBeforeBody=0`（终止落地但原值保留）+ `runs/kit-r1r-fix1/kit.log` :19 PASS 行原文 "the Body ran (side effect real, its value still carried) and is never re-labelled as un-executed"——"不承诺立即/不回滚"在测量语义中有实体。

**③ 无旧口径①（弱表述）残留 = 0 — PASS。** 对 `.agents/skills/` 全树正则扫描（`only affects subsequent|does not affect in-flight|只影响后续|…`）= **0 命中**（grep exit=1）。

**④ 无旧口径②（强表述）残留 = 0 — PASS。** 同扫描 `never receives an abort|绝不收到 abort|…` = 0 命中；全文唯一相近文本 :296-299 为**否定式+延期式**（"And do not claim the strict … property: `NO-ABORT-AFTER-BODY-START` is DEFERRED (gate D-1) — today an abort request IS propagated to started calls"），恰为清单要求的口径，非现行语义预告。执行面吻合：abort 确向 started 调用传播且可落地 = rereg-window :47-50（terminated=1/1）；lane 区分两码 = `packages/runtime/test/a5p1r-change-abort.test.ts` :158/:350（`ABORTED_BEFORE_DISPATCH`）与 :374-375（`dispatcher-call-terminated-after-body-start`）。

**⑤ G-g 口径 = 仅"未收口+alarm+名字级撤回+在飞不受影响" — PASS（执行级）。** §8 :294-296 四要素齐全且仅此四要素（"NOT closed (gate G-g; alarm + name-level withdrawal only, in-flight calls unaffected — `RW-CHANGE-INERT-LOUD`)"），全 skills 树无 G-g=SUPPORTED/fail-closed/已合规表述。对照：s12 (j) :296-299（现状事实）与 :316-317（允许/禁止措辞）；`PENDING-GATES.md` :19（G-g 开放，"不得默认 SUPPORTED"）；`g-g-support-contract.md` :4/:37（P8=UNSUPPORTED/待证，不随 17:52Z 裁决关闭）、:65（分级小结：G-g 整体未达收口，U×4）；分级现状按 `bbaf45de`（`evidence/alpha5-pr1r/g-g-probes/review-G-g-probes.md`，裁决 PASS/可合+4 nits，建议 **U→D 部分收口**，G-6/G-7 维持 U/LIVE-GATED）——§8 未宣称任何分级升档，吻合。执行面：alarm+在飞不受影响实测 = rereg-window :71-74 `v2=1 unvalidated=1 issued=0 channel=armed` + kit.log :23 PASS（"the moved Body does run (nothing can cancel it)"）。注意 §8 未把静默配置的 re-bind 恢复写为已证（contract :58 P4=同配置 NO-EVIDENCE）——无越权宣称 ✓。

**⑥ provider 卸载三区别齐全、(a) 为裁决边界 — PASS。** (a) :286-287（"does NOT auto-kill the whole team — **that is an explicit boundary of the ruling**"）；(b) :288-289 有序 teardown 到 `RELEASED` 空台账非 mass abort——执行级：rereg-window :35-38 `pendingAfter=[] teardown={"ok":true,"code":null} state=RELEASED` + kit.log :17 PASS；(c) :290-292 通道不可订阅 = 装配前类型化拒绝 `IO_POLICY_UNSUPPORTED`——执行级：rereg-window :11-14 `refused=true code=IO_POLICY_UNSUPPORTED message=cannot subscribe to the public notification "tools/change"` + kit.log :13 PASS + contract :63（P9=UR，unit `a5p1r-change-abort.test.ts:198-214/:215-244`，源 `install.ts:981-984`）。

**⑦ 17:52Z 引用与不回填 17:02 同段在场；验收依据列无"17:02 已批准" — PASS。** :257-258 同一句内（"User ruling 2026-10-16 17:52Z … recorded after the fact — it is **NOT to be read back into the 17:02 merge**"）；PENDING-GATES.md :14 裁决+边界（"不回填为 17:02 合并时已批准"），该行**验收依据列** = 支持契约@98ddbaa9+review bbaf45de/3ee77729+G-g 保持开放，无 17:02 批准表述；全文 `17:02` 仅此否定式一处；(k) 表验收依据列 = "用户裁决 2026-10-16 17:52Z" ✓。

**⑧ quiesce 未与定义变化取消互相指代 — PASS。** §8/§7 追加条（:250-302）`quiesce` 计数 = **0**；全文仅 :85/:89 两处，均在既有 §2 `team_archive_member` 生命周期语境（QUIESCES the member … quiesce still runs / are never quiesced），未引用取消语义；§8 亦不引用 archive/quiesce。两机制零交叉 ✓。

**⑨ blueprint 侧无第二套三分类 — PASS（条件未触发，自然满足）。** `team-blueprint-authoring/SKILL.md` 在落文 commit（d6b57e55^→d6b57e55）与分支链（ced9254c→90dc56a6）diff 均 = **0 行**；全文对 `termination unconfirmed|three-way|三分类|cancel…` 扫描 0 命中——blueprint 未落文，无第二词表可立 ✓。

## C. 行为/执行维度总表（§8 声明 ↔ 既有 live 证据；不新造 live）

测量载体 = live kit run `runs/kit-r1r-fix1/`（summary.json :2-8：2026-10-16T15:17:37，真 Host **0.2.0-rc.2 @ `639ed01539…`**，port 3185，world 已登记 removed），判据原文均在 `rereg-window.json`，PASS 行在 `kit.log`（各 exit=0）。

| # | §8 声明（行） | 实测锚点（file:行） | 级别 |
| --- | --- | --- | --- |
| B-1 | 未执行调用在门前取消 `ABORTED_BEFORE_DISPATCH`（:269-270） | rereg-window.json :29-32；kit.log :16；RED→GREEN 对 `runs/B3-after-door-RED.json`(v2=1)→`B3-after-door-GREEN.json`(v2=0) | exec |
| B-2 | 仅点名漂移名、邻工具不受（:263-265） | rereg-window.json :53-56 `issued=["grep:p00-c1"] watched=[]`；kit.log :20 | exec |
| B-3 | MCP 整代撤回+重绑同规则（:265-267） | rereg-window.json :65-68 `withdrawnThenRestored=false->true rebindOk=true`；kit.log :22 | exec |
| B-4 | started 收 abort，落地=TERMINATION `ABORTED`/terminated=1（:271-272） | rereg-window.json :47-50；kit.log :19 | exec |
| B-5 | 并发混合状态均入账不误判（(k) C 行支撑） | rereg-window.json（`RW-MULTI-CALL-ALL-CANCELLED` :59-62） | exec |
| B-6 | 三分类第三类独立（:279-283） | order-hazard.json :20/:32/:44/:56/:160；run-receipt.md :23/:25/:27；lane `dispatcher-call-outcome-unreadable`（s12 (k) :333） | exec |
| B-7 | teardown 有序到 RELEASED 空台账（:288-289） | rereg-window.json :35-38；kit.log :17 | exec |
| B-8 | 通道不可订阅=装配前类型化拒绝（:290-292） | rereg-window.json :11-14；kit.log :13；contract :63（E+D 级） | exec |
| B-9 | G-g：alarm+名字级撤回、在飞不受影响（:294-296） | rereg-window.json :71-74；kit.log :23；lane 双腿 `a5p1r-change-abort.test.ts`（g-g-probes 36/36 PASS @bbaf45de） | exec |
| B-10 | caller-side 取消在直调 execute() 结果边不可见、"measured without any lane"（:273-276） | s12 (h) :202-207 叙事 + 探针脚本 `runs/probe-cancel.mjs`（在场，caller-abort-while-body-running）；**stdout 未单独存档** | **record-level**：探针可复跑，但"success-shaped result, no code"仅 (h) 转述，无独立输出工件；§8 措辞（"measured … is not visible"）与记录强度相称，未越权 |
| B-11 | lane 只区分 Host 确实发出的两码（:274-276） | `a5p1r-change-abort.test.ts` :158/:350/:374-375；(h) :206-207 | exec（常跑测试） |
| B-12 | (a) 不自动杀全团队（:286-287） | 无测量腿——**规范句**：文本自述为 "an explicit boundary of the ruling"（裁决边界，非经验断言），口径与 PENDING-GATES :14 边界①一致 | 裁决级（无执行义务） |

D-1 口径执行面：恢复条件与延期理由 ↔ `seam-record-post-door-resolution.md` DEFERRED 节 :236-266（`bodyInvoked` 私有 = `packages/core/tools/src/index.ts:1580`，:159/:249-250；候选三件 (a)/(b)/(c) 不选型；:261 起）与 §8 :297-299 语义一致；登记处 `PENDING-GATES.md` :26/:29。

## D. 记录 ≠ 执行 纪律声明

- 本轮**未新造任何 live 运行**；执行维度全部引用 master 树上已入库的 kit/lane 工件（§C）。
- 唯一 record-level 项 = B-10（caller-cancel 探针 stdout 仅存于 (h) 叙事）。该项在 §8 中的表述已是"实测于本 Host 的边界披露"句式，不含超出记录强度的承诺；不阻塞。
- (k) 表本身是"记录"，其"原文"一列逐字段可在 `runs/kit-r1r-fix1/` 工件中复核（本轮抽核 7/7 判据字符串逐字节吻合）。

## E. 遗留观察（非阻塞）

1. 前件 RNB1（PENDING-GATES 前向引用）已随 pr1r-followup 合入 master 自然**闭环**：`dev/agent-workflow/PENDING-GATES.md` 在 46a406b9 树内，§8 引用均为树上有效名。
2. `runs/full-suite-AFTER-fix1.log` :1789/:1795 有一条 A4-PR7 merge-gate lint-identity 红（`no-undef runs/probe-cancel.mjs` 新增身份）——属 a4 lint 基线身份问题，与 D-2 文本/取消语义无关，留 pr1r 线处理。
3. `PENDING-GATES.md` D-2 行（:27）状态推进（待收尾轮执行→收口）按 candidate :98 由主 Agent 按流程登记，本件不代改（只读+新增纪律）。

## F. 留痕

- 本件 = 分支 `alpha5-d2-verify`（基 `46a406b9`）唯一新增提交；ff push（任务授权，无 force）；master/stable 未触碰；工作树提交前 `git status --porcelain` = 0。
- df（收尾留痕）：`/dev/mapper/ubuntu--vg-ubuntu--lv 107G 67G 36G 65% /`。
