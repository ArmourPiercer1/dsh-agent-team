# review-PR8-formal-delta — alpha5-pr8-runner 正式轮 delta 复审（31f71b96..27897aef）

- **对象**：`origin/alpha5-pr8-runner` delta `31f71b96..27897aef`（ecc5b6f1 RED → e2fd942c GREEN → 27897aef docs）。31f71b96 全件已审（review-PR8-runner.md，通过）；本件只审增量。
- **审查方式**：一次性 worktree `.worktrees/review-pr8-delta`（已回收）；全程零端口、零 world、零模型 token；收尾回收 + df。

## 判定：**通过**（0 阻塞；2 条非阻塞注记 RN1/RN2）

## ① RED/GREEN 分提交真实 — 成立
- first-parent 链线性：`31f71b96 → ecc5b6f1 → e2fd942c → 27897aef`，无 merge。
- RED 提交 `ecc5b6f1` 仅 +test(+73)/+RED log（不触碰 lib.mjs/matrix ⇒ 不修实现）；GREEN `e2fd942c` 含实现修复（lib.mjs ±24 / run-pr8-negative.mjs ±8 / matrix ±63）。
- **亲跑复现**：checkout ecc5b6f1 自跑 ⇒ 22 tests / pass 18 / **fail 4**，4 红名与 `runs/scope3a-RED-self.log` 逐字一致（N1×2/N2/G-g post-probes ⇒ "四条新判据先行红"）；checkout 27897aef 自跑 ⇒ 22/22。
- rebase 映射：README.md:47 在册（a82f474d→ecc5b6f1）；`git diff a82f474d ecc5b6f1` = 仅 +reviewer 审查件 ⇒ RED 补丁字节级保留（双向 patch diff 恒等亲验）；`a82f474d` 不在任何 remote ref 可达历史、不在 27897aef 历史 ⇒ **remote 历史未改写**。

## ② N1 缺键判红 + DOC-MISSING-KEY×18 点名 — 成立
- 自跑 `run-pr8-negative.mjs`：`DOC-MISSING-KEY` 恰 **18 条**、逐行点名 SUP-01..18（机检侧显式 null 并注）。
- 抽 2 行亲验（SUP-03/SUP-15）：doc acceptance-matrix.json 该行确无 `final_declaration` 键；机检 matrix-machine.json 该行键在且值 null。全量核对：doc 缺键=18、机检缺键=0。
- 机检缺键判红判据（undefined≠null 不放行）在 22/22 自跑中 GREEN（HEAD）/RED（ecc5b6f1）双向印证。

## ③ N2 registry 全 id + suite 引用 lint — 成立（违例注入亲测红）
- 矩阵在册引用 `20-controlled-fs` / `60-web-jobs-mcp-domain` 均唯一命中 registry.mjs 真实 id。
- 违例注入亲测：①全 id 截短为 `60-web-jobs` ⇒ N2 判据红；②改为不存在 `99-nonexistent-suite` ⇒ 红。均即时还原（porcelain 0）。

## ④ G-g 三行引 bbaf45de 结论准确 — 成立（禁则红测亲做）
- M-06/M-12/M-14 三行引注与 `review-G-g-probes.md @ bbaf45de`（git show 原文核对）逐点一致：**P4/P6 达 D**（判据名 RW-CHANGE-INERT-PINNED-UNTIL-REBIND / RW-CHANNEL-PROVEN-ON-FIRST-DELIVERY 与受审件 §⑤建议一致）、unit 腿 E 形状（P2/P3/P6 入常跑网）、**kit-only 上限 D、ENFORCE 不可达（§2.1 明文，不得宣称）**、**P9=UR 不变**（98ddbaa9 §2.2 快照 UR1=P9 亲验，bbaf45de 未触 P9）、**G-6/G-7 仍 LIVE-GATED=PR3 维持 U**、**G-g 行开放**（PENDING-GATES.md 本树不存在 ⇒ 开放如实，与 bbaf45de"保持开放至落文"一致）。快照 E1/D3/UR1/U4（P4=U/P6=U 当时硬缺口）逐字对得上 98ddbaa9。
- 禁则红测：向 M-12 criterion 注入 `fail-closed 已证 compliant` ⇒ G-g lint 自跑判据 2 条红 + runner `LINT-FAIL 措辞违规`点名 exit 2；还原后 GREEN。

## ⑤ 矩阵实例化三升级 — 成立
- **M-06 13/13 原文在 `runs/kit-rerun-built/`**：kit-stdout.log 恰 13 条 PASS（master 版 13 判据，非 probes 18 版，与"本腿跑 master 版"措辞一致）；rereg-window.json criteria=13 全 ok、runStamp 20:07:36Z 早于 GREEN 提交 20:08:41Z 时序自洽。
- **M-11/SUP-08 absent-anchor 机检真实（全树 grep 亲跑）**：在 writer 已构建的钉定运行时（`639ed01539…` = 本分支 paths.mjs canonical pin，porcelain 0）上亲跑 `grep -w job_start` packages/apps/scripts 全树 = **0 命中**；job_output(5)/job_kill(2)@tool-bash、job_list 族@job-controller（typed `job_list_parameter_*/job_list_result`，见 RN2）在册。
- **级别措辞=D 非 E/整链**：32 行 evidence_level 仅 {D,U}；M-06 明写"fixture/记录级 D 观察…非整链验收"；输出无 `lvl=E`；反升格声明行在册。
- 全新 worktree（无 gitignored 运行时）三行如实 NOT_RUN（拒伪造 PASS）；以只读符号链接挂入钉定构建后**亲跑复现 27P/0F/0NR/5RLW** 与提交口径逐字一致（kit-rerun hook 为真 spawn 重跑，非仅读记录）。

## ⑥ 自跑 22/22 + token + porcelain + 共用零命中 — 成立
- 自跑 `node --test --test-concurrency=1`：22/22 EXIT=0（HEAD）。
- token：delta 全文凭据模式扫描零命中；全程零模型调用。
- porcelain：审查 worktree 收尾 0；writer worktree 现 0；origin==27897aef（fetch 复核）。
- 共用文件零命中：delta 13 文件全部落在 `dev/agent-workflow/evidence/alpha5/pr8/` 本 lane 内（name-only 亲跑）。

## 非阻塞注记
- **RN1**：27/0/0/5 分布依赖 gitignored 钉定运行时；全新 worktree 下 M-06/M-11/SUP-08 判 NOT_RUN（行为正确、行文本已自述），集成轮复现需先按 TEST_METHODS §2 链构建 test-use @ `639ed01539`。
- **RN2**：`job_list` 锚点在 typert.host.js 为子串命中（typed 参数/结果名），非独立词元；与 hook 的 includes 语义及"pinned 面枚举在册"措辞相符，如需更强锚可后续收紧。

— 独立 reviewer（≠writer；qwen3.8-flash-next），一次性 worktree 已回收。
