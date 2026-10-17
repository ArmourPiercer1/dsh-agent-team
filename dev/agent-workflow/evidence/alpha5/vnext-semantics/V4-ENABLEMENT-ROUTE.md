# V4-ENABLEMENT-ROUTE — v4 兼容启用路线（可执行；零语义新裁；零代码）

- 轮次 = `alpha5-v4-route`（v4 启用路线 writer）；模型 = qwen3.8-flash-next；基 = `origin/master @ 28d31f2a`（fetch 亲验），branch `alpha5-v4-route`，worktree `.worktrees/alpha5-v4-route`（一次性）。
- 任务出处 = 根 20:01Z『v4 兼容启用路线也应并行』。纪律 = 只写本文件一笔（docs/evidence only）；**零代码、零矩阵、零 gate 行改动；全部行均复述在册源，本文件不做任何新语义裁决**；`:3080`/`:3180` 零触碰；CORE PATCH BUDGET = 0。
- 依据（引用记法：路径@ref:行）：
  1. `dev/agent-workflow/evidence/alpha5/prod/VNEXT-SCHEMA-ADR.md` §5 步骤序+兼容窗口建议（`:120-130`）、§6 精简原则（`:134`）、§6.0 Gate 常规原句（`:139`）、S0 点名（`:6`）、D-01..D-11 转正项（`:92`）、M-1（`:96`）——@`origin/master`。
  2. `dev/agent-workflow/evidence/alpha5/vnext-semantics/A234-VERIFICATION.md` §5 真待裁 T-1（`:89-102`）——@`origin/master`。
  3. `dev/agent-workflow/evidence/alpha5/schema-rev/README.md` M-x 处置表（M-3 行 `:15`、M-7 行 `:19`）与裁决窗口径（`:4-5`）、门禁记录表——@`origin/alpha5-schema-rev`（内容笔 `2731e72d`，支 tip `36a5aa72`，PR **#316**）。
  4. `dev/agent-workflow/evidence/alpha5/schema-rev/runs/v4-flip-PREP.md` 不可逆点与翻档≠退役（`:22-30`）、flip PR 原子清单（`:80-90`，第 4 步 `:88-90`）——@`origin/alpha5-schema-rev`。
  5. 根 17:54Z 口径拆分与 #312 独审结论 = `dev/agent-workflow/evidence/alpha5/COORDINATION.md:97-98`（根协调文件工作副本，untracked，按 A234 先例逐处标注）；#312→#316 关系 = 同文 `:98`『旧 #312-314 已关』+ `:100`『新 PR #316(schema)』。
- 口径基石（复述，非本文件新裁）：根 17:54Z 台账更正（COORDINATION.md:97）原句——『**"启用 v4 且保留 v3" ≠ "退役 v3"**；A-4 真待裁**仅**后者（窗口时长/退出）。v4 接线、coverage/kernel 原子镜像（M-3）、M-7 等**不得**一概冻在翻档待裁下；先核原计划对 v4 启用门的既有批准，满足既定 schema 审查/测试后按原计划推进；自动删除旧字段/退役 v3 禁止』；#312 独审结论（同文 :98）——『#312 schema-rev 独审 PASS（最小真裁决点仍仅 T-1；**M-3/M-7=排程非新裁**）』。

---

## 1. 阶段表（每阶段：前置 / 动作 / 回归判据〔既有套件 + RED 形〕/ 回滚点）

| 阶段 | 内容 | 用户裁决 |
| --- | --- | --- |
| ① | 可逆半区合入（已在 #316） | 不需要 |
| ② | M-3 coverage/kernel 原子镜像（与 flip PR 同笔） | 不需要（排程非新裁） |
| ③ | v4 双解析启用 = flip PR（SUPPORTED `[3]`→`[3,4]`）+ 正式 Schema ADR（D-01 转正）一步 | 不需要（ADR Gate 常规，§6.0） |
| ④ | **T-1 门后**：{3,4} 兼容窗口退出（窗口退出翻档）→ v3 退役讨论 | **需 T-1**（本文 §4） |

### ① 可逆半区（#316 已交付，可即推，无需任何用户裁决）

- **前置**：无。#312 独审 PASS（COORDINATION.md:98）；#316 为新 PR 号待门（同文 :100）。
- **动作**：#316 过 CI 门合入 master。内容 = `2731e72d` 全集：dormant v4 授权语法（`blueprint-v4.ts`，生产入口对 v4 文档仍 MISMATCH 钉死）、M-2 `v4-authoring-map.ts`、M-4 `migration-report.ts`、M-5 NEG 33/33 接线、R1 placement 类型面、flip 备笔 `runs/v4-flip-PREP.md`（FLIP=NOT-APPLIED）。M-3=显式缓落、M-7=缓（README `:15/:19`）。
- **回归判据（既有套件）**：domain lane 736P/1F（唯一红=已发布基线恒等红）＝回归 diff 空；root vitest = 已发布 9 恒等逐行零增减（`runs/root-vitest-FINAL2.log`）；`pnpm -r typecheck` EXIT=0；版本洁净 fence OFFENDING/UNKNOWN 与基线 diff=空；`check:artifacts:head` drift=0（以上均 README 门禁记录表在册）。
- **回归判据（RED 形）**：RED-first 已在件内自证 = `runs/a5sr-RED.log` 实现前 49/56 红（7 绿=行为不变钉腿），实现后全绿；`schema.ts`/`validate.ts` 两文件零改动 = 「新字段缺省=行为字节不变」的机检形式。
- **回滚点**：merge 前 close/revert 任意；merge 后回滚仍零行为影响——全部新面缺省不可达（SUPPORTED 仍 `[3]`，生产路径不可达；barrel 纯加法）。本阶段无可达性、故无不可逆点。

### ② coverage/kernel 原子镜像（M-3；与 flip PR 同笔，随 ③ 落）

- **前置**：① 已合。起草可与 ①③ 并行——ADR §5 第 4 步：『M-3 envelope Scope 语法（独立 lane，可与 3 并行；文件面不交叠）』（`VNEXT-SCHEMA-ADR.md:126`）。
- **动作**：**不单独落地**。README M-3 行（`:15`）在册判语：『半落会造 parse-accept/runtime-unmap 裂缝 ⇒ **必须与 coverage/kernel 镜像钉同笔原子落**』，处置=『归 v4 发布轮 flip PR 原子包（见 `runs/v4-flip-PREP.md` 第 4 步）』。即 ② 的动作就是 ③ flip PR 原子清单的第 4 件（本文 §3 verbatim）。
- **回归判据（既有套件）**：domain lane / coverage 门零弱化（GLUE-5 独审先例口径『coverage 门零弱化』，COORDINATION.md:95）；envelope `coverageOf`/`containment-undetermined` 既有语义零漂移（ADR §1 D1 行扩展点=matcher kinds 封闭集，不新造 rung）。
- **回归判据（RED 形）**：RED 腿 = 「v4 文档 parse-accept ⇒ runtime 可映射」正控——半落状态下先红（parse-accept/runtime-unmap 裂缝被负控捕获），与 ③ 同笔后转绿；落点测试随 flip PR RED-first 提交（NEG 现成负例 + CAND `adr_ref` 逐条，ADR §5 `:122`）。
- **回滚点**：同笔耦合 = 回滚单元为整个 flip PR 一笔；flip 不落则 M-3 不落，无中间态可回滚（这正是"原子"的含义）。

### ③ v4 双解析启用 = flip PR（"启用 v4 且保留 v3"，ADR Gate 常规）

- **前置**：① 已合；② 内容备妥待同笔；正式 Schema ADR 起草完成并过 Gate（起草人提案 + 三 reviewer 采纳）。**不等用户**：『A-1..A-8 全部走 ADR Gate 常规转正（起草人提案 + 三 reviewer 采纳）』+『**是 ADR 问题」≠「逐条问用户的理由**』（`VNEXT-SCHEMA-ADR.md:134`）；§6.0 原句（`:139`）：『**A-1/A-5/A-6/A-8 = 纯 ADR Gate 常规转正项**：与 D-01..D-11 同轨（起草人提案+Gate 采纳），**不是逐条问用户的理由**，不入用户待裁表』。D-01（严格成员检查+窗口 {3,4} 内容）本身即转正项（`:92`『D-01 严格接受』；`:21` A1 行『待办 = ADR 转正 + 常量翻转（§3 M-1）』）。S0§11 点名（`docs/plans/memo/alpha5-tool-io-governance/alpha5-s0-pr0-pr8-implementation-plan.md:171`，经 ADR `:6` 指认）：『PR8 再选择明确的 vNext 版本（**建议 4，但须记录正式 Schema ADR**）实现 `toolBindings`、Read/Write/Network I/O Policies、Provider/Execution Boundary Binding、Assurance 引导与诊断…』——启用门 = 正式 Schema ADR 这一步，而该步按上引 §6 精简原则属 Gate 常规，**不是**用户问卷。
- **动作**（= 本文 §3 flip PR 原子清单，`runs/v4-flip-PREP.md:80-90` verbatim）：schema.ts run set 补 4（派生集自动移动，RETIRED 不变）＋ dormant 第四支 dispatch 线并入分表 ＋ M-7 文档面同 PR ＋ M-3 envelope-scope 原子同笔；正式 Schema ADR（D-01 转正 + 采纳 D-01..D-11）与之同轮落字（ADR §5 第 1 步与第 5 步在启用轮合成一步：转正为文、翻档为实）。窗口内容 {3,4} 与严格成员检查均已在册（CAND D-01 / A234 §1.1），**机制零新件**。
- **回归判据（既有套件）**：root vitest = 已发布 9 恒等零增减（**v3 面行为字节不变**：v3 分支禁改由 fence 脚本机检，ADR §5 `:130` 末句）；domain lane 回归 diff 空；版本洁净 fence（v3 分支禁改+版本词表）；`check:artifacts:head` drift=0（dist 镜像同笔）；零差普查清单（flip-PREP「Zero-diff census」节）= 翻档爆炸半径全集，清单外任何 digit-carrying 站点出现即红。
- **回归判据（RED 形）**：① 门臂真值表四行逐腿钉死（flip-PREP「Gate-arm truth table」：v4: `SCHEMA_VERSION_UNSUPPORTED`→`RUNS`；v1/v2 MISMATCH 臂不变；v3 RUNS 不变）——翻档前 RED 腿 = 现行钉腿 `a5sr2`（生产入口对 `schemaVersion: 4` 仍 MISMATCH）翻档时翻绿 + 「翻档后 v4 RUNS」新腿翻档前红；② 「翻档后未迁 v3 文档照常 RUNS、load-time 零变形」负控先红后绿；③ A234 §1.2 在册形态：翻档前 v4 走『never defined⇒typed 拒』臂的钉腿在翻档后按真值表换形，禁静默改判。
- **回滚点**：merge 前 rebase/改案任意；merge 后、**第一篇 v4 文档写成之前**可 revert（RETIRED 派生集不动，v3 无恙）。不可逆点 = 首篇 v4 文档落笔那一刻，verbatim（flip-PREP `:25-28`）：『Irreversibility arrives the moment the first document is AUTHORED in the new format: rolling the run set back afterwards would strand stored documents that no longer validate. That is the point of no return the A-4 window ruling prices — a WRITE-format decision, not a constant edit.』——翻档本身 demits nothing（`:22-24`）。
- 备注（零新裁）：flip-PREP 节标题『The flip PR (when and if the ruling comes)』为 `2731e72d` 时点措辞，写于根 17:54Z 口径拆分之前；按现行台账，此处 "ruling" 已澄清 = ① 正式 Schema ADR 的 Gate 常规转正（启用）与 ② T-1（仅窗口退出/退役）两件事，本路线按 ①② 分轨执行，不改 PREP 原文一字。

### ④ T-1 门后：{3,4} 兼容窗口退出 → v3 退役讨论（**唯一被 T-1 阻塞的阶段**）

- **前置**：T-1 已裁（本文 §4 verbatim：用户仅需批『发布代下限 + 退出谓词』两参数）。**T-1 未裁前本阶段一切动作不做**；T-1 未裁也**不**阻塞 ①②③（根 17:54Z『不得一概冻在翻档待裁下』+ README `:4-5`『A-4 窗口时长未定只阻退役决策』）。
- **动作**：退出谓词满足后，方谈 run set 撤 v3（翻档方向与幅度由 T-1 裁决形定，候选见 §4：(a) 到期翻 `SUPPORTED=[4]` / (b) 迁移报告驱动）；v3 退役**复用已在产**的 RETIRED 派生臂（`BLUEPRINT_MIGRATION_REQUIRED`，v1/v2 退役轮先例，ADR §5 `:130`『零新机制』）；v3 退役的宣布与政策 = 独立议程，届时单独成文，禁借 ③ 的措辞捎带（flip-PREP `:29-30`：『Retirement of v3 (removing it from the run set) is a SEPARATE later ruling; 翻档 ≠ 退役』）。
- **回归判据（既有套件）**：v1/v2 退役轮先例全套复用——退役臂正控（未迁 v3 文档 → catalog 可见 `BLUEPRINT_MIGRATION_REQUIRED` 迁移任务，非数据丢失）+ `RETIRED` 派生集自动延展机检 + A2-11 式收口 fence 先例（A234 §1.1 生产面行在册）。
- **回归判据（RED 形）**：「窗口退出后 v3 文档仍被 RUNS 臂放行」钉腿在退出前红/退出后绿（与 ③ 镜像对称）；「never-defined 版本仍走 UNSUPPORTED 臂、退役版本走迁移臂」两臂次序契约（A234 §1.1『The order is the contract, not an optimisation』）逐腿重钉。
- **回滚点**：T-1 裁决落字前零动作，故无状态可回滚；退出翻档执行前为最后决策点；执行后未迁存量走迁移臂（可见、可迁、非数据丢失），回滚 = 恢复双支持但双解析器/双 fence 回保（T-1 候选 (b) 后果行在册）。

## 2. 非事项（本路线明确**不做**，均有在册出处）

1. **不删旧字段、不裁历史 trim**：根 17:54Z『自动删除旧字段/退役 v3 禁止』（COORDINATION.md:97）+ ADR §6.0 硬约束『**不得借 v4 迁移擅自裁历史 trim**——任何 v3 时代字段面/能力面的缩减……确需缩减必须单独成项送裁，并在迁移报告中显式记 rejected』（`VNEXT-SCHEMA-ADR.md:141`，P-D2 行）。①②③ 全程 additive only。
2. **不宣布退役**：flip-PREP『Retirement of v3 … is a SEPARATE later ruling；翻档 ≠ 退役』+『this round declares neither』；README 门禁行『翻档备笔（FLIP=NOT-APPLIED；未宣布退役；RETIRED 未翻）』。本路线任何阶段文本均不构成退役宣布。
3. **A-4 时长未裁不阻前三阶段**：README `:4-5`『A-4 窗口时长未定只阻退役决策』；根 17:54Z『v4 接线、coverage/kernel 原子镜像（M-3）、M-7 等不得一概冻在翻档待裁下』；#312 独审『最小真裁决点仍仅 T-1；M-3/M-7=排程非新裁』（COORDINATION.md:98）。

## 3. flip PR 原子清单（直接引用 `runs/v4-flip-PREP.md` 第 80-90 行，verbatim，第 4 步 = M-3 原子条款）

```
## The flip PR (when and if the ruling comes) is ONE edit plus tests

1. `schema.ts`: run set gains the next version (the derived sets move themselves).
2. The frozen per-version parser branch for the new version already exists,
   dormant, in-repo (this round shipped the authoring grammar half); its
   dispatch line joins the per-version switch.
3. Docs face (M-7) updates in the same PR; retirement wording stays a
   SEPARATE later decision (翻档 ≠ 退役).
4. The flip PR must ALSO land the envelope-scope expansion (M-3, deferred
   here on purpose) atomically — half-landing the effect-face scope with a
   runnable v4 would create a parse-accept / runtime-unmap split.
```

（出处：`dev/agent-workflow/evidence/alpha5/schema-rev/runs/v4-flip-PREP.md:80-90`@`origin/alpha5-schema-rev`；零差普查名单 = 同文件「Zero-diff census」节，即 flip PR 自身编辑清单+爆炸半径全集。③ 的「动作」与 ② 的「动作」= 本清单一次落笔。）

## 4. 真待裁 = 仍仅 T-1（原句复述，零改写）

以下 verbatim 摘自 `dev/agent-workflow/evidence/alpha5/vnext-semantics/A234-VERIFICATION.md:91-96,102`@`origin/master`：

> **T-1（唯一）A-4 · v4 {3,4} 兼容窗口时长/退出条件**
> - 分歧：窗口内容 {3,4}、严格成员检查、退役臂均已钉且已在产（§1.1），但**窗口维持多久/以何退出无任何既定源钉**（A2-11 先例=同 ADR 内 phase 有界桥，不覆盖跨发布代的存量退役政策）。
> - 候选 (a) 固定 ≥1 发布代：到期翻 `SUPPORTED=[4]`，未迁 v3 走既有 `BLUEPRINT_MIGRATION_REQUIRED` 臂（catalog 可见迁移任务，非数据丢失）。
> - 候选 (b) 存量 v3 全迁移或经报告显式裁定为止：无固定退役日，S2 翻档时点由迁移报告驱动；验收面长期双支持。
> - 后果对比：(a) 有确定清障日、伤及未迁存量以 typed 拒+诊断呈现；(b) 无固定退役日、双解析器/双 fence 长期在保。
> - 建议：VNEXT-SCHEMA-ADR §5 的 **a∧b 组合**（≥1 发布代 ∧ 存量迁完/裁定完），v3 退役复用已在产派生臂 + fence 机检，零新机制；用户仅需批『发布代下限 + 退出谓词』两参数。

> **当前真待裁 = 1 项（可能 0）**

T-1 只 gate 本路线阶段 ④；①②③ 的门 = 各自既有 Gate（CI/三审/ADR Gate 常规），与 T-1 无关（根 17:54Z 口径拆分）。

## 5. 红线自证与文件清单

- 本分支相对 `28d31f2a` 仅新增本文件一笔（docs/evidence only）；零代码/零测试/零矩阵/零 ledger；冻结文档零改动；`:3080`/`:3180` 零触碰；CORE PATCH BUDGET = 0。
- 本文件所有裁决性语句均为对 §依据 所列在册源的复述或直接引用；未新增、未收窄、未扩大任何裁决点；真待裁计数保持 = 1（T-1）。
- 推送：无凭证（https 无交互式认证），**代推归父**；head sha 以报告面为准（文件内不自指 sha）。
- 文件：`dev/agent-workflow/evidence/alpha5/vnext-semantics/V4-ENABLEMENT-ROUTE.md`（本文件，唯一笔）。

— writer = alpha5-v4-route（qwen3.8-flash-next）；分支 `alpha5-v4-route` @ base `28d31f2a78f947a2d7bde472770300e5c4849e00`。
