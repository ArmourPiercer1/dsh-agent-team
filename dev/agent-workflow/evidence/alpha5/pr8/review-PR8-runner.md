# review-PR8-runner — PR8 负例 runner 独立审查（≠writer）

- **对象**：`origin/alpha5-pr8-runner` @ `ddcf1923`（base `d69bfc4b`，13 文件全在 `dev/agent-workflow/evidence/alpha5/pr8/`）；一次性 worktree；`node --test --test-concurrency=1`；reviewer = qwen3.8-flash-next（模型/harness 分列）。
- **裁决：通过**（0 阻塞；4 条非阻塞注记见文末）。以下每项均为本审查者亲跑/亲测，非转述 writer 记录。

## ① matrix-machine ↔ doc 矩阵 32 行 1:1 — PASS
- `lintCorrespondence(machine, doc)` 亲跑 = **0 issues**；另做独立复核（不经其 lint）：32/32 行 id **同集合且同序**、无重复；全部 32 行 `carried_current_status`/`known_partial` 与 doc `current_status`/`known_partial` 逐行相等；`row_count=32` 与 rows.length 相符；machine 32 行 `final_declaration` 全 null。
- 手抽 5 行（M-01/M-06/M-14/SUP-01/M-13）id/status/partial 三字段核销一致；partial 行集合 = doc `known_partial===true` 集合 = {M-01,M-02,M-03,M-06,M-12,M-14}，与自测断言相符。
- doc 矩阵 SUP 行 `final_declaration` 键**缺失**（undefined）而非显式 null；lib 视 undefined=无声明放行——语义成立，见注记 N1。

## ② 三态诚实性 — PASS
- 亲跑 CLI 复现在册分布：**PASS=24 FAIL=0 NOT_RUN=3 RLW=5 TOTAL=32**，与 `final-matrix-run.log/.json` 逐数一致（`run-utc=19:39:28Z`）。
- **NOT_RUN×3 确因缺已构建 0.2.0-rc.2 运行时**：M-06 kit 前置 `tests/deepseek-harness-test-use/vendor/cordis`（kit-rerun 缺前置即拒，`runKitRerun` 无 PASS 出口）；M-11/SUP-08 pinned 面 grep 位 = gitignored test-use 检出（`environment_prerequisite` 声明在 hook 上，缺文件⇒NOT_RUN 而非 PASS，`runFixtureSurface` 未声明时缺文件判 FAIL）。`kit-attempt-verbatim.log` FATAL 原文在册且与我的复跑失败模式一致（`pristine package dir missing … vendor/cordis (is the test-use checkout built?)`）。
- **无 PASS 伪装**：独立重放全部 50 个静态钩——17 个 recorded-evidence（存在+`expect_field_path`+`expect_field_value` 全对）、33 个 fixture-surface（文件在+锚点在）；仅 2 个文件缺失恰对应已声明环境前置的 NOT_RUN 行。`p4t6-readonly-scan` 真实树可跑且零隔离区外命中（自测亲跑复现）。观察上限=D：矩阵 0 行宣称 E（`observation_ceiling` 明文）。
- **REQUIRES-LIVE-WIRING×5（M-04/05/08/09/13）LIVE-GATED 依据逐条溯源有效**：G-d 行（PENDING-GATES.md:17 @origin/alpha5-pr1r-followup `cc47fb18`，状态=未开始，含 OpenAtPort 禁宣称句）✓；doc `current_status`（M-08=s0-strict-disabled-pending-poc、M-13=s0-not-run-structural）✓；e2e-skeleton `registry.mjs` 各 suite `run: null`（20-controlled-fs / 60-web-jobs-mcp-domain 等 9 处）✓；S0-SELECTION-MATRIX M-04/M-05/M-09 未测项与 Strict deny/BOUNDED-DEFER、池键 ⊇ Member+Realm+Provider+Workspace+PolicyGeneration 逐字对上了 S0:51/52/56 ✓；`g-g-support-contract.md` §3 G-6/G-7=LIVE-WIRING-GATED=PR3 后（契约 :78-79）✓。RLW 输出不计入 PASS/FAIL（`evaluateRow` 早退 + 分布单列）。
- **ghost-anchor 对照臂双向亲测**：①健康态 ghost 锚 = FAIL 被如实捕获（OK）；②**故意注释掉观测挂载**（篡改 M-01 hook 锚点）⇒ 该行 FAIL、FAIL=1、**exit=2 变红**；③反向故意致盲（删除 missingAnchors→FAIL 分支）⇒ ghost probe=PASS ⇒ **RUNNER-BLIND 判红 exit=2**。对照臂真能抓观测面失明。测试后全部突变已回滚（porcelain=0）。

## ③ final_declaration 双代码位 — PASS
- 台账三分支亲测：缺文件⇒`ABSENT-AS-OPEN`（fail-closed，open_ids=[`__ledger-absent__`]）；含开放行⇒`OPEN`；全关样例⇒`ALL-CLOSED`。
- **derive 位**：ABSENT-AS-OPEN/OPEN 下即便行带候选值输出恒 null；ALL-CLOSED+候选才透出。违例亲测红：伪造 ALL-CLOSED 台账 + M-04 fd=`ALL GREEN — SUPPORTED` ⇒ 输出 `!!! 存在非空声明 — 违规`，exit=2。
- **assert 位**：同一违例（及仅改 machine 不加台账）⇒ `LINT-FAIL M-04: final_declaration 必须为 null…`，exit=2。两道闸独立性实证：任一单独破都不放行，同放即红。当前 32 行候选全 null ⇒ 正常态恒 null（复现）。

## ④ G-a / G-g 措辞 — PASS
- `_meta.ga_ruling.quote` 含 `2026-10-16 17:52Z` 裁决与 `不回填为 17:02 合并时已批准` 边界，与 `PENDING-GATES.md:14`（@`cc47fb18`）原文比对：除 markdown 粗体/句读外逐字（要点引，README 自述口径如此）。
- **回填句式 lint 亲测抓**：向 M-06 塞入「（17:02 合并时已批准，本行系回填登记）」⇒ `LINT: M-06: 出现 17:02 回填句式`；删除 G-a 行 17:52Z 引用⇒红；削 `_meta.quote` 边界句⇒红。正常行内引注因 allowlist 剥除不误报（0 issues 复现）。
- **G-g 行只引分级、无 fail-closed 宣称**：M-06/M-12/M-14 全部 `fail-closed` 出现仅两种形态=禁则转述（`禁 fail-closed/closed/…`）与 `绝不输出 fail-closed 已证`，均在 allowlist；三行均引 §2.2 分级，`E1/D3/UR1/U4、硬缺口 P4/P6` 与契约 §2.2 分级小结逐字对上（@`98ddbaa9`）。植入断言违例（`fail-closed 已证`/`已验收`/`暴露恰为一次调用`）三种全部判红。

## ⑤ 自跑 16/16 + RED-first 原文 — PASS
- `node --test --test-concurrency=1` 亲跑 = **tests 16 / pass 16 / fail 0 / EXIT 0**，与 `self-GREEN.log` 一致；含真 spawn 的 kit PASS/FAIL 双路与 p4t6 真树查询。
- RED-first 原文在册：`self-RED-first.log`（19:35:24Z，套件先于 lib.mjs 的 `ERR_MODULE_NOT_FOUND`，1 fail）；`RED-first-matrix-run.log/.json`（19:39:07Z 首轮真实红=**9 项措辞 lint 红**，系机检行自身引注禁则原文被禁则误伤，随后以 allowlist 修复——修复后断言形态违例仍判红，见④，属收紧正确方向的修复）；修复→`final-matrix-run`（19:39:28Z）0 lint + 24/0/3/5。

## ⑥ 共用文件零命中 + token + porcelain — PASS
- `git diff --name-only d69bfc4b..ddcf1923` = 13 文件，全部位于 `dev/agent-workflow/evidence/alpha5/pr8/`；根 registry/live glue/tsconfig/barrel/scanner/`packages/**`/`tests/kits/**`/p4t6 账本 **0 命中**；p4t6 scanner 只读且只扫 `packages/**` ⇒ census 无增项成立。
- 零端口（3497 前缀仅声明预留，无 bind 代码）、零 DSH_HOME 世界（`tests/homes/a5p8r-*` 未创建）；证据内无 launch token（token 命中仅词表/策略字段名）；本审查 worktree 全部突变回滚后 **porcelain=0**，临时运行产物已清理。

## 非阻塞注记（正式轮处理）
- **N1**：`lintCorrespondence` 对 doc 行 `final_declaration` 缺失键（undefined）判"无声明"放行（SUP-01..18 现状）。语义成立；正式轮建议要求 doc 显式 null 或补键存在性断言。
- **N2**：M-13 LIVE-GATED 依据串写 `60-web-jobs-mcp`，registry 实际 suite id = `60-web-jobs-mcp-domain`（子串可解析，无溯源损失）。
- **N3**：本 lane 措辞 lint 是 G-5 的自用子集，正则词汇表可被改写绕过（如 `fail-closed 得到证明` 不命中）；正式轮 CI 侧 G-5 lint 为权威，建议届时扩词表或改语义判据。
- **N4**：单提交原子性下 RED-first→GREEN 仅能以 runs/ 在册记录为序（红 19:39:07 → 终 19:39:28，间隔 21s；allowlist 方案系契约 §3 G-5 既定思路，非临时降标准），可接受；正式轮建议红/绿分提交留痕。

**结论**：三态与 REQUIRES-LIVE-WIRING 诚实性、对照臂非盲性、final_declaration 双代码位、G-a/G-g 措辞纪律均经亲跑+植入违例亲测红成立；证据为 fixture/记录级、无升格宣称。**通过**（DORMANT 骨架地位不变，行验收/整链验收仍按 PENDING-GATES 收口路径）。
