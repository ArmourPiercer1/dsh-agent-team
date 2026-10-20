# OPEN-ITEMS — Alpha.5 历史 bug / 未闭项清单（D 路 docs-matrix）

**盘点时刻**：2026-10-19T07:2xZ–07:4xZ（各条目引用逐条现场核；本清单为快照，权威 = `dev/agent-workflow/graph.yaml` + `SESSION_ROUTER_LOG.md` + `evidence/alpha5/COORDINATION.md`）。
**扫面**：`evidence/alpha5/COORDINATION.md`（全文）+ `ALPHA5-CURRENT-STATE.md` / `PRODUCTION-READINESS-CHECKLIST.md` / `HANDOFF-2026-10-19.md` + PR #337/#346/#347 body/state（gh 只读回读）+ `pindir/ADVERSARIAL-SWEEP.md` + `c1-swallow-diag/` + 本 worktree 代码现场。
**格式**：每项 = 现状 / 证据 / 建议处置 / 归属。**D 路只修自有 writer 面（docs/、skills、scripts/、.github/workflows/）；candidate-package/ 冻结、COORDINATION/graph 非 D 所有——一律列单不代改。**

---

## A. 候裁项（D 路无权裁，列单呈根/用户）

### A1. PR #337 关闭与否（候根裁）
- **现状**：#337 仍 **OPEN**（gh 现场核：`OPEN | fix(runtime): glob walker stderr-stream drain…`）。其语义本体经 收口链 → 新分支 `a5-g6b-rcfinal` → **PR #343 已 MERGED**（`d5de7497…`）；旧 PR 头 `f07ac27b` 因历史重构不可达（不可 ff 亦不可 force），#337 已挂 supersede 注。
- **证据**：COORD 21:3xZ「#337 移交+步骤 B 派单」行与「#337 挂 supersede 注（关闭与否候根）」；`gh pr view 337`（07:3xZ 只读）。
- **建议处置**：根裁后以 supersede 措辞关闭（不改历史正文，append-only）；关闭动作归协调者/根，非 D。
- **归属**：根裁 → 协调者执行。

### A2. PR #347（p4t6 竞态修复）SHA 级安全确认
- **现状**：OPEN、DO NOT MERGE；head **`8f9099966bfc06fa66994f3f7aa2958e025edb57`**（forward merge-sync 至 d5de7497 后头，非旧头 e658e931）；双 CI 绿 + 独审 179bb95f 通过必办 0；根令「候用户对该具体 SHA 明确确认」。
- **证据**：COORD 00:5xZ/01:0xZ/02:2xZ 行；`gh pr view 347`；PR body（独审 VERBATIM 已入）。
- **建议处置**：用户对 `8f909996…` 全 SHA 确认后按 `gh pr merge <n> --squash --match-head-commit <批准全 SHA>` 放行；期间头不动。
- **归属**：用户确认 → 根/协调者放行。

### A3. PR #346 终核：发布态转换 + 合并与否
- **现状**：OPEN；齐件（三回执绿 + 真人入口投机通过 + 尾四销案 + 夹具出树 PASS + CI 全绿@090b87b5）；根 02:52Z 已发**有限试用放行**（仅 body 顶部，覆盖已列测试范围；非全 Alpha.5 验收、非合并/release/部署许可）；横幅仍 RECEIPT-PENDING。
- **证据**：`gh pr view 346`（07:3xZ）；COORD 02:4xZ/02:5xZ；#346 body 首段 VERBATIM。
- **建议处置**：根终核裁「RECEIPT-PENDING→发布态说明」与合并与否；D 无动作。
- **归属**：根裁。

### A4. 钉名口径两裂缝（stagehand 读法；codex/claude_code 预防钉）
- **现状**：stagehand「catalog-shipped vs bundle-mounted」两读法事实并呈**不含倾向**；`subagent_codex`/`subagent_claude_code` 每处 `disabled: true`、未钉、**处置待根裁**（现钉状态=六名已钉维持不动）。
- **证据**：`evidence/alpha5/pindir/ADVERSARIAL-SWEEP.md` A3/A4 行（master 树内，07:3xZ 现场读）；COORD 21:1xZ（含两次「虚构根裁」诚实入账与撤回行——以后者为准）。
- **建议处置**：根裁两口径；裁前任何 lane 不得按任一读法补钉或删钉。
- **归属**：根裁 → C-16 原作者 68e8d70f（若需补钉）。

### A5. G-e / scoped-visibility 用户裁决
- **现状**：G-e 未裁子项按最新裁决源=**仍待用户裁**（非我方恢复）；呈评材料 `scoped-visibility-options.md` 已落（Q1 二态定夺 / Q2Q3 无需再审）；`dev/agent-workflow/PENDING-GATES.md` 在本树**不存在**（07:4xZ `ls` 亲核），lint 第二条款处于 `absent` 诚实态。
- **证据**：COORD 20:42Z（#341 候修四件③）+ 21:2xZ G-e 修正笔行；`scripts/lint-g-g-wording.mjs` PENDING-GATES 条款注记。
- **建议处置**：用户裁 G-e 方向后由协调者落 PENDING-GATES 行（该文件落地即自动 engage lint 第二条款）。
- **归属**：用户裁 → 协调者。

### A6. T-1「v3 退役窗口」用户裁决
- **现状**：双 v3/v4 并行试用期本身可运行=非必决项；仅退役窗口待裁。
- **证据**：`ALPHA5-CURRENT-STATE.md:45`（根 20:2xZ 口径在案）。
- **建议处置**：维持候裁；不阻塞 v4 负控另列腿。
- **归属**：用户裁。

### A7. census-runtime 提为必需检查（纯配置欠债，2026-10-12 起）
- **现状**：master 保护仅 `pr-gate` 为必需上下文；census-runtime 多次连续绿但从未推进为 required check；`pr-gate.yml` 仍带 `--allow-refused census`（两个语义各自如实）。
- **证据**：`docs/STATUS.md` 2026-10-12 勘误(1)（gh api 只读回执在案）；本轮未重复 api 扫（只读、结论无变化迹象；推进与否不属 D 权限）。
- **建议处置**：协调者以一次 `gh api` 现值复核后决定是否把 `census-runtime` 加入 required contexts（分支保护=仓库设置面，非文件 writer 面）。
- **归属**：协调者/用户。

## B. 历史红账（留案不改写；append-only）

### B1. census 458/459/460 三红
- **现状**：三红 run 留案不改（根 02:1xZ/02:2xZ 令）；**根因类已双向修复**——证据侧夹具出树（`090b87b5…`，N8 防再犯门）+ master 侧 walker 抗悬空硬化（本轮 D，见 F1）。
- **证据**：COORD 02:0xZ–02:4xZ；#346 body「HEAD-ON-CI NOTE」VERBATIM；census 461/462@090b87b5 success（身份集与基线恒等）。
- **建议处置**：无——红账保留即正确形态；判读口径按 23:02Z 定稿（身份集不新增 ≠ 全套零失败）。
- **归属**：已闭（红账留案）。

### B2. H1b 钉条件红
- **现状**：装面关断验收唯一红=安装规格钉 d5de 前后 master 前移的时间差红，**非行为红**；根裁口径在案（H1d 正面陈述：ancestorOfLive/commitsOnTop=1/specPinnedToGradedSha）；旧全绿不宣称。
- **证据**：COORD 22:4xZ、23:0xZ（H1b 措辞注不删原文）；`evidence/alpha5/glob-off-install/`（7407 文件根可直读）。
- **建议处置**：维持；后续终头前进按同 kit 快照哈希补差异腿即可（已在手规则）。
- **归属**：口径已裁。

### B3. C1 wire 死亡形 = CORE_SEAM_BLOCKER #1（宿主法律）
- **现状**：行级 abort 透传已修（#345 MERGED `708fb3fe…`，witness cancelled=true 3/3、gen1 kind:user 3/3）；**wire 渲染层=宿主统一死亡形**（tools/lib:3312 设计法律），登记不绕行（根 21:26Z 政策否决借道 post-execute）；四条件验收=修复面实测口径成立，原 r5 wire 红**保留不撤**。
- **证据**：`evidence/alpha5/c1-swallow-diag/core-seam-blocker.md` + `DIAGNOSIS.md` + `a5c1fix-reverify/` + `F3B-EVIDENCE-INDEX.md`（v1/v2/v3+25s 窗口不外推声明）。
- **建议处置**：upstream 接口需求（类型化取消事实登记）保持登记；四条件同时证的宿主契约一致验收若做，按根令另建（换文案≠修复）。
- **归属**：CORE_SEAM_BLOCKER 台账（根面）；原 r5 红=B 类留案。

### B4. shape-N/A 18 腿（glob off/rename 形覆盖）
- **现状**：⑤缺省形装面正控 GREEN 32/32 只驱 default 形；18 条 off/rename 腿 shape-N/A（非绿非红）；关断结论仍以 22-07-01 跑为准。
- **证据**：COORD 23:5xZ ⑤ 行（na:true 账+重跑判据零删）；`evidence/alpha5/a5ie-r5/` run 23-39-12Z。
- **建议处置**：A/B 路覆盖矩阵收口时一并补 off 形装面腿或维持分列声明（R 路对账按标签引用）。
- **归属**：A/B 路 + R 路对账。

## C. #346 三项非阻断小账（27536a5e 审单，候终态笔收）

### C1. 「清 85 文件」vs tracked 实删 78 口径注
- **现状**：开放。夹具出树提交口径说 85（含未 tracked 世界体），tracked delta 实删 78。
- **证据**：#346 body 首段③ + 27536a5e 审原文 VERBATIM ①（07:3xZ 读回）。
- **建议处置**：由候选包作者（c7886d5f）在 #346 终态笔补一行口径注；**candidate-package/ 对 D 冻结，D 不改**。
- **归属**：c7886d5f（列单移交）。

### C2. 收据 basename `n3-sweep-list.json → sweep-list.json`
- **现状**：开放。copyout 法致 basename 变化，下游硬编名须知（试用/复核脚本若按旧名取数会落空）。
- **证据**：同上 ⑥(c)；`test-human-protection.sh` copyout 函数（证据头内只读核）。
- **建议处置**：同 C1 随终态笔收；README 已知限制页加一行（作者面）。
- **归属**：c7886d5f（列单移交）。

### C3. 「四条 workflow 不复跑 test-human-protection.sh」
- **现状**：**修复件已在树且 CI 首跑绿**——`.github/workflows/candidate-protection.yml`：master 侧 CI 检出**具名 pin** `CANDIDATE_EVIDENCE_SHA=090b87b5…`（更新须根批），跑全 spec（CI 形断言 `SUMMARY pass=9 fail=0` + `SKIP N6`；本地实证 07:21:44Z；**CI 首跑 success=run 39217185943，PR #348 pull_request 事件，head 1c38de07…，日志原文含 `pinned evidence head verified: 090b87b5…`+P1/N1a/N1b/N2/N3/N4/N5/N7 全 PASS 行，parent 注②定口径**）。合并候根放行。
- **证据**：本分支 `.github/workflows/candidate-protection.yml`；本地运行原文（`.worktrees/a5d-verify-090b` 内 runs/human-guard-2026-10-19T07-21-42Z，验后清）。
- **建议处置**：随本路 PR 审→放行；放行前该小账状态=「修复件候批」，不宣称已闭。
- **归属**：D（交付）→ 根（放行）。

## D. 环境 / 外部

### D1. K12 外部杀手 / K13 安装相挂死（归因未证）
- **现状**：rv2 job 蒸发、rv2b pnpm 相死、rv3 安装相挂死 >900s DISCARDED；OOM/reaper **疑似未证**；修复面分布已定档 2 KIT_DONE + 1 HARVEST（-15@+5.4/+7.2/+3.95ms），判词不改。
- **证据**：`evidence/alpha5/candidate-package/DISTRIBUTION.md`/`TRIAGE.md`（@090b87b5 分支内）；COORD 00:0xZ/00:1xZ。
- **建议处置**：如需再跑 3 分布，先挂资源台账（dmesg/limit/reaper 配置）再复现；不为已定档判词重跑。
- **归属**：环境（用户侧线索优先）。

### D2. 真模型对话轮未测（候选已知缺口）
- **现状**：试用链终点=`--check-config` rc=0 + README §3b 步骤 5 启动；真模型轮=用户自配凭据后自担步骤（放行注记原文在 body）。
- **证据**：#346 body 首段①；candidate-package README 已知限制页。
- **建议处置**：维持为「用户步骤」非「产品缺测」混称；试用者回执回流协调台账。
- **归属**：用户（试用动作）。

## E. 延期项刊载一致性（p4t6/p4t7/v4/T-1 线）

### E1. 现状与一致性核对结论
- **刊载面**：`ALPHA5-CURRENT-STATE.md`（:30 blueprint v4=文档面 SUPPORTED=[3,4]、执行面 fail-closed；:45 T-1 仅退役窗口候裁；:48 U1 执行面延期与 v4 执行面延期=**同一延期路线两面**，GLUE-8 停针一致）+ HANDOFF:32（已延期集：p4t6 ROSTER〔deferred=roster 非 world，race 修复=#347 候批〕、p4t7 schema 迁移、browser 面宿主依赖、F3b gen2〔K12〕）。
- **核对结论（D 现场，C 交付后更新 07:5xZ）**：刊载互不矛盾；「精确原因+可否按原架构补」终版**已由 C 路交付**（`evidence/alpha5/guard-schema/DEFERRALS.md` 五项 + `FIX-QUEUE.md` R-C-05..13，分支 `a5-guard-schema` @ `0bede36e`，p4t7 归并 U1 行注记、p4t6 ROSTER 落 a4p7 DEFERRALS p7t6 行 + #347 per-SHA）——待协调者并入 CURRENT-STATE（非 D writer 面）；D 的 STATUS 条目已声明权威序避免各文档自封现状。
- **建议处置**：C 路收口后由协调者把终版并入 CURRENT-STATE（非 D writer 面）；D 的 STATUS 条目已声明权威序避免各文档自封现状。
- **归属**：C 路 → 协调者。

### E2. :3080 只读不变式记录
- **现状**：standing 不变式，**设计上不关闭**：历轮验收逐跑回执 401→401 pre==post（glob-off-install 终装、r5、⑤正控、真人入口各卷在案）；D 路本轮全程零触碰 :3080（本环境仅端口 3190/3498 分配，且本轮 D 无宿主启动）。
- **证据**：COORD 22:4xZ「卫生全清 :3080 401→401」；candidate-package 各收据；TEST_METHODS §3 红线。
- **建议处置**：维持每轮验收模板含 :3080 前后状态回执字段；任何 lane 缺该回执=不完整绿。
- **归属**：全员纪律（记录项）。

## F. 本轮 D 路已修（对照销项）

### F1. walker 悬空 ENOENT（census 458/459/460 根因类，master 侧）
- `scripts/lint-g-g-wording.mjs`：walkMarkdown 先 `lstat`，仅 ENOENT 且为 symlink 时 **skip+按名披露**（`SKIPPED-DANGLING <path>` 行 + `skipped=N` 计数），其余错误照抛不吞；解析成功的 symlink 照旧跟随。判定面不变实证：同一干净树新旧脚本 `scanned=873 / violations=0` 恒等；植双悬空链=exit 0 + `skipped=2` 具名（07:1xZ/07:2xZ 两态实录）。负测试入 `packages/runtime/test/a5p1r-gg-wording-lint.test.ts`（TMPDIR scratch 树：悬空 .md 链+悬空目录链+解析链三形；断言 skipped 具名、filesScanned 无丢失、去链后两态计数恒等）。
- 登记源：COORD 02:1xZ「master 侧 walker 抗悬空硬化=登记后续单」；#346 body「Separate master-side hardening observation for root discretion」——本轮即该后续单。

### F2. ci-pr-gate.mjs 基线指针注释滞后
- 注释两处仍写 `nine-root-319a60d7.md`，而 `BASELINES.census` 常量与基线文件自称的现行门指针均为 `nine-root-2b1099d7.md`（GLUE-2 同树捕获，容差段 byte-identical 三代）。已按实况改写注释（行为零变化；`--self-test` 77 断言全过 07:4xZ）。

### F3. skills 面滞后：team_glob「master 整面 shut」旧断言
- `.agents/skills/team-leader-operations/SKILL.md` §2.1 已按 #343 后实况改写（live 行 + `globEnabled` 关断语义 + `team-tool-plane.mjs:672` 挂载式 + 装面/关断/对抗三卷证据路径 + 历史轮 CLOSED 定位）；「What that means」段同步去「wait for the candidate row to land」。15 枚协调工具名集与 `packages/tools/src/tools.ts` 现场核对恒等（13 静态名 + grant/revoke 动态构建:1373）；`team-blueprint-authoring` 零 glob 断言、无滞后。

### F4. docs/STATUS.md Alpha.5 快照条目
- 新条：产品冻结 SHA/证据头/#346·#347 态/四路分工端口/D 路四件/census 口径定稿/:3080 不变式；权威序声明置顶（graph+log 为权威，COORD=台账，本文=快照）。

---

## G. parent 07:5xZ 补充转办件（C 排队 + 基线行核查）

### G1. R-C-05 GitHub 标题卫生（C 路 FIX-QUEUE 转 D）
- **现状**：惯例注**已入文档面**——`docs/BRANCHING.md` §PR/合并消息卫生 第 7 条（合并完成态不得留存 DO NOT MERGE 标题；#257 先例+#347 候批同形）。GitHub 元数据本身（改标题动作）发生在合并时刻，归执行合并的协调者，仓内无残留可改。
- **证据**：`.worktrees/a5-guard-schema/…/guard-schema/FIX-QUEUE.md` R-C-05 行（0bede36e，只读核）；`DEF-#257-FREEZE.md`；COORD 07:5xZ 降档附注行。
- **归属**：纪律=D（已落）；合并时执行=协调者。

### G2. R-C-06 授权链双载体记载（C 路 FIX-QUEUE 转 D）
- **现状**：**已入文档面**——BRANCHING.md 同节第 8 条（squash 消息中间裁决段就地 `SUPERSEDED @<SHA>`；裁决引用须注明载体+时点）。此后所有含裁决演进的 squash 消息按该行执行；已合并历史不回写（append-only）。
- **证据**：FIX-QUEUE R-C-06 行；#257 squash 消息把中间 BLOCKED 与终局 PASS 同筐的 grep 误导实录（DEF-#257-FREEZE）。
- **归属**：D（已落）→ 全员后续 PR 执行。

### G3. 「AGENTS.md 宿主基线行陈旧」= **协调误报已撤**（parent 08:0xZ 撤回更正；append-only 留痕，附复核行号）
- **撤回复核（D，07:4xZ 独立先行完成，与 parent 结论一致）**：分支 `AGENTS.md` **无陈旧行**——现行基线行 `AGENTS.md:11`（TEST_METHODS 摘要行）与 `AGENTS.md:38`（tests/ 行）均已 = **0.2.0-rc.2 @ `639ed01539`（2026-10-03 起）**；文内 `0.1.7-rc.1 @ 46a7f68b09` 命中仅以历史沿革形出现（「此前 0.1.7-rc.1 @ 46a7f68b09（2026-09-24 … 2026-10-03）」，同在第 11/38 行内）；`tests/paths.mjs:68 DSH_BASELINE_VERSION='0.2.0-rc.2'` 恒等。误报成因=parent 自记：会话注入旧快照当文件现状 + grep 命中历史沿革引用；**「R-D-AGENTS-align」件作废，AGENTS.md 未动一字（git diff 零 AGENTS.md 条目可证）**。
- **残余事实与处置（协调裁定 07:5xZ）**：主检出工作树 `/srv/workspace/dsh-plugins/dsh-agent-team/AGENTS.md` 显示 0.1.7-rc.1 为当前，原因=该工作树 HEAD=`6259cf4b`（早于升级轮）。**协调裁定：主检出=协调者 ledger 工作面（COORDINATION/HANDOFF append-only 连续体+自有 scratch），本会话周期内故意不刷新不重置；一切代码/宿主读取走 lane worktree 与主检出 `tests/deepseek-harness-test-use`（其自身 @639ed01539 正确），主检出顶层代码文件面禁作现状依据**（训已入账）。OPEN-ITEMS 项就此关闭——无待办动作，勿动协调面。
- **教训沿记（parent 自记，D 附议）**：文档判定必须现场读文件，不读注入快照。

---

## 附：移交协调者的排队项汇总
1. C1/C2 两口径注 → c7886d5f 终态笔（#346）。
2. A1/A2/A3 三候裁 → 根/用户。
3. A4 钉名两口径 → 根裁后 68e8d70f。
4. E1 延期精确原因终版 → **C 路已交付**（`guard-schema/FIX-QUEUE.md` R-C-07..13 + DEFERRALS 五项，a5-guard-schema @ 0bede36e）→ 协调者并入 CURRENT-STATE。
5. A7 census-runtime required-check 现值复核与推进 → 协调者。
6. ~~G3 主检出刷新~~ → **协调裁定已闭**：周期内故意不刷新（ledger 工作面），主检出顶层代码面禁作现状依据（G3 正文载全文）。
7. R-C-07（install.ts settle 1 行硬化，可做不可需）/R-C-09（p7t6 dirty-class 裁决行）/R-C-10（shape-18 补跑两趟）→ C 路 FIX-QUEUE 在册，派单归协调者（非 D writer 面）。
