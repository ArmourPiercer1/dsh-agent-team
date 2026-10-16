# review-CensusFix — census 收口 delta 独立 review（reviewer ≠ writer e72e4110）

**对象**：origin/alpha5-int-wiring。Base 轮 = delta `2c955133..42c83a1b`（788db2fd 竞态修 + 067225df TS2554 兼容修 + 42c83a1b baseline 重录）；审查中对象前进至 **a71dd43a**（46768673 merge master@ced9254c + 319a60d7 ledger tie/措辞 + a71dd43a merge-tree 口径重录）——ff 追加节见文末。
**环境与纪律**：一次性 worktree（42c83a1b / merge 模拟 1449da8e / 纯 master / tip a71dd43a，porcelain 0）；宿主复用 a5-wire 预置 checkout @ `639ed01539…`（porcelain 0，version 0.2.0-rc.2 == `tests/paths.mjs` pin 三元一致）；capture 一律 `vitest run --maxWorkers=1 --testTimeout=90000 --reporter=json`（census 腿同款 + .tmp-fault 预清），判分走 gate 自身 `--only census --census-json`（同一 compareCensus 代码路径）；每次判分打印 `DSH-CI-VERDICT` token。

## Base 轮（@42c83a1b）逐项

① **baseline 重录完整性 — PASS**。亲跑 2×2（4 captures）：4/4 `captured 549f/6936l vs baseline-declared 549/6936`、verdict pass、red 集 md5 四捕全同且恰 9 条 = declared；`nine-root-067225df.ids.txt` 与 `nine-root-post-d3-4-split.ids.txt` **逐字节同**（diff 空，9 行，零豁免增删）；新/旧正本 parse 的 family 集同为 `{p6t1-parallel, packages/tools/test/p6t6-actions.test.ts}`；旧正本 2162f6a7.md 与 post-d3-4-split ids 在 delta 内 diff=0（原样留史）；ci-pr-gate 指针三处迁移（BASELINES.census / docstring / self-test live pin 549/6936），machine 文件（scripts/.github/packages）无旧指针残留；`--self-test` 亲跑 **59 assertions pass**。

② **population 口径 — CONDITION（base 轮判定，已被新 head 关闭）**。census-runtime 判的是 PR **merge-ref** 树，非分支尖。亲验（merge 模拟 worktree = tree(42c83a1b × ced9254c)）：merge 树比分支多且仅多 #265 两个可扫文件（549→551f）；两个 CI union 红在 merge 树**首跑即确定性复现**——(a) p4t6 coverage `expected 1157 to be 1155`（分支 ledger 不含 #265 两文件），(b) `a5p1r … G-5 > the repository scan is green` 抓 `WIRING-SURFACE.md:36`（master 新 lint 扫分支文）。纯 master@ced9254c 亲跑亦 census-red（scan 1155 vs 其 ledger 1109——master 自身 PR3/5/7+#265 未入账）。故 42c83a1b 的 OPEN OBSERVATION "Mechanism NOT identified" 是**口径伪象**（0/12 对分支口径为真，对被评分口径不适用）。当时最小修法建议=merge master→入账 tie→措辞限定→按 merge 口径重录；writer 于 319a60d7/a71dd43a 照此完成，见追加节。**连带事实（master 侧义务，不属本分支）**：master 自身指针的 p4t6 ledger 仍欠同一 tie，其 push-census 在 master 侧仍红，直到 master 线补账。

③ **竞态修审读 — 修对了形状，留有残口 → 新条件**。审读：guard 仅吸收 `ENOENT/ENOTDIR`（readdir 目录没了→返回已收集；stat 条目没了→continue），**其余 errno 一律 throw**；diff 只触 `listFiles` 与注释，14 文件 exact-set 钉、NAMES-ONLY 例外钉未动（亲跑 4 legs 全绿）。churn 亲跑（18-way，`packages/runtime/test/.tmp-race-*`）：**旧码（788db2fd^）run1 即红**（`stat …/.tmp-race-1` ENOENT，collection 期，同 CI 形状）——机制成立；**修码 collection 错误消失（修复对该形状有效）但 `zero production consumers` leg 的 `readFileSync`（该文件 L123）在同一威胁模型下仍竞态**：唯一名 churn 3/3 红 + writer 同款同名 churn 1/1 红（4/4），错误 `ENOENT … open '.tmp-race-*/x.ts'`。该红在 census 下是 **TEST 身份红**（非 collection），非容忍集 → 一旦命中即 census fail。修复文档自述的威胁模型（"other suites create/delete transient paths while this walk runs"）涵盖此窗口：瞬态文件存活过 walk、死于 leg 读取前。**条件 = 同一 guard 补到 consumers 循环（逐文件 try/catch，ENOENT/ENOTDIR 跳过、其余抛），一行量级；或按纪律记 OPEN OBSERVATION（率+形状，不设豁免不贴标签）并于下一窗修。**

④ **census 2×2（分支树）— PASS**：见①（4/4 pass、恒等、=declared；本 review 即④亲跑证据）。

⑤ **OPEN OBSERVATION 记录纪律 — PASS（记录本身干净）**：两红（a5p1r G-5 / p4t6 coverage）未入 ids（9 行不变）、未成 family（parse 集与前代全同，"named by stem to avoid the family grant" 措辞不触发 family 正则——亲 parse 验证）；率 0/12 按 round-38 规则引用；其"local"限定语指分支树且自洽。机制归因错误已由 successor 文档以 CLOSED OBSERVATION + 实测 RED log 收口（旧正本未被回改，闭合语在新文件——留史纪律成立）。

⑥ **token/porcelain — PASS**：我的 8 次判分全部输出 `DSH-CI-VERDICT`；writer 证据含 leg+VERDICT token 行；worktree porcelain 在全部测量点=0；宿主三元组（HEAD/pin/version）一致 @639ed01539 且 porcelain 0。**自报**：清理时我的一条过宽 `rm` 误删了 8 个已跟踪的 `ci-gate/scratch/census-comparison-20261008T*.json`（前轮证据 sidecar），当场 `git checkout --` 全量恢复（tracked-dirty=0 复核），未入任何 push。

## 追加节（ff）— delta `42c83a1b..a71dd43a` delta 复核（按新 head 判定）

前提核验：`origin/master == ced9254c` 且已是分支祖先 ⇒ **CI merge-ref 树 == a71dd43a 树**；`319a60d7..a71dd43a` 未触 packages/tests（仅 ci-pr-gate 指针/文案），口径传递成立（tree equality）。

① **合并树 2×2 亲跑 — PASS**：tip worktree 4/4 `captured 551f/6941l vs declared 551/6941`、verdict pass、四捕 red 集 md5 全同，且与 base 轮分支口径 9 红 md5 **相同**（caliber-invariance 亲验：动的只是 context counts）。
② **p4t6 1157 独立数 — PASS**：绕开测试体、直接调已提交 scanner（`scanSessionEventVocabulary`）对两棵树各扫一遍：tip=**1157**、branch=1155（scanner 自排除校正后），set-diff **恰等于** `SCANNED_PATHS_GGPROBES = {a5p1r-gg-probes.test.ts, a5p1r-gg-wording-lint.test.ts}`（无第三文件混入）；tie 链 `expect(SCANNED_PATHS_GGPROBES.length).toBe(1157-1155)` 钉死增量，且两文件被 spread 进"必须出现于 scanned 集"断言——**断言收紧、非豁免**（同 PR3/5/7 记账类）。tip 亲跑 p4t6 10/10 绿。
③ **措辞限定词 — PASS（语义实质不变）**：diff 仅行36——禁令保留（"零…类宣称"→"**不得**作出通道闭合类宣称"），被禁短语改为引号内 + `属 UNTESTED，本闸未证` 限定形（正是 lint 契约要求的 qualification 形），指针桩与后半句逐字未动；tip 亲跑 wording-lint 3/3 绿、`lintRepo` 全库 violations=0。
④ **旧正本未动 — PASS**：`42c83a1b..a71dd43a` 对 `nine-root-067225df.md/.ids` 与 `nine-root-2162f6a7.md`、`post-d3-4-split.ids` 的 diff = **0 行**（OPEN OBSERVATION 原文未回改，闭合在新文件）；`nine-root-319a60d7.ids.txt` 与 post-d3-4-split **逐字节同**；tip `--self-test` 亲跑 **59/59**（live pin 已迁 551/6941）。

## 判定（@a71dd43a）

**条件（conditional pass）**。base 轮 population 口径条件已按建议完整关闭（merge + tie + 措辞 + merge-tree 口径重录，全部亲验）；**剩余唯一条件 = ③ 的 a5p7 `zero production consumers` readFileSync 残口**（4/4 复现于两种 churn 形状，census 下属非容忍新红）——补同款一行 guard（或按纪律记 OPEN OBSERVATION 并于下一窗修）后即可合。
一句话：population 口径与竞态主形状两处收口真实且经我亲数吻合（549/551/1157/9 红零漂移），唯同一文件的下游读取仍会在新 census 下投出非容忍身份红，补一行同款守卫即绿灯可期。

——reviewer（census 收口 delta 独立 review；base @42c83a1b + delta @a71dd43a；qwen3.8-flash-next）
