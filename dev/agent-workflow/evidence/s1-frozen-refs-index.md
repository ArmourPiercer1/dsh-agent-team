# S1 冻结引用与预算索引（主 Qwen 维护；只读汇编，不含产品结论）

生成：2026-10-24T23:37Z（append-only 账本的**指针表**，不替代 `dev/agent-workflow/SESSION_ROUTER_LOG.md`）
权威序：`dev/agent-workflow/graph.yaml` + 账本最新条目 > 本索引 > 快照文档。

## 1. 本轮固定读三锚（不 checkout、不改权威指针）

| 角色 | 对象 | 取法 |
|---|---|---|
| 代码锚 | master `4aaaa7b2a…`（PR #362 doc-baseline merge） | `git show 4aaaa7b2:<path>` |
| 计划/规则锚 | `1310b9595…` docs(alpha5-reset): gate unlock scope + S1 measurement rules | `git show 1310b959:<path>` |
| Host artifact | `639ed015397290b3745d163aafe02ffee4aa3f84` = `dsh-v0.2.0-rc.2`，porcelain 0 | 工作树 `tests/deepseek-harness-test-use/` |

PR363 三份文档（在 `1310b959` 上，工作树已漂移 ⇒ 必须用 `git show`）：
`docs/plans/memo/alpha5-reset-20261025/center-assembly-architecture.md` ·
`five-stage-implementation-plan.md` · `phase-1-freeze-inventory-feasibility.md`

**历史漂移（承认、不主导）**：主树 HEAD `6259cf4b`；工作树 `tests/paths.mjs` `c0ec639f…` ≠ `@4aaaa7b2` 的 `ba922e50…`。

Host 三聚合摘要（M1 期基线 = 今日实测，逐字节相同）：
`apps/cli/lib e72d7d0c212b8e41` · `packages/core/tools/lib a3353facc7e98f0b` · `apps/web/dist e80728be886b0e7e`
测量法：`cd <tree> && find <rel> -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum | sha256sum`（单路径逐项，不用多参数 du/find 去重）。

## 2. 封存件（禁止改动/删除/补跑）

| 件 | 位置 | 关键值 |
|---|---|---|
| M1 封存 runner | `dev/agent-workflow/evidence/s1-h0-m1/m1-run.mjs` | `4542782e71d2b73b…`（590 L，字节不变） |
| M1 probe | `…/s1-h0-m1/probe-plugin.mjs` | `c883ac3f80efcfe4…` |
| M1 FAIL run | `…/s1-h0-m1/runs/s1-h0-m1-20261024T222400Z/` | `pass=false`，`used_ms=182732` |
| M1 no-ext PASS | `…/s1-h0-m1/runs/s1-h0-m1-noext-20261024T225300Z/` | `pass=true`，`used_ms=32927`，variant `no-ext-contributors` |
| M2 封存件 | `…/s1-h0-m2/{m2-run.mjs,probe-m2-plugin.mjs}` | `ef2bf20f30c14638…` / `03d36a895cea8336…` |
| M2 patch 层 | 由真实 `mountRows` 字节自检 | `bb5898a39d50f2c0…`（1,148 B） |
| M2 run（FAIL） | `…/s1-h0-m2/runs/s1-h0-m2-2026-10-24T23-26-02Z/` | 18/20 判据 true；`outcome=not-delivered-call1-result`；owned_pid 100 已 reaped |
| 封存 world | `tests/homes/s1-h0-m1*`、`tests/homes/s1-h0-m2-*` | 保留；删除禁止 |
| Q6 保全 | `.worktrees/.s1-asset-preserve-q6-20261024/` | 归档 `ac542a96…`（820,248,620 B）；`tar-diff.out` 与 `tar-diff-at-destroy.out` 均 0 B |
| Q7 保全 | `.worktrees/.s1-asset-preserve-q7-20261024/` | 归档 `ff04f805…`（769,046,371 B，119,552 件） |
| Lane A 索引 | `dev/agent-workflow/evidence/s1-inventory-lane-a/` | 5 件，SHA 见账本 `23:23Z` 条目 |

## 3. 计数与预算（保守包络口径）

- **执行计数**：PoC **3/20**、Host **3/12**（M1×2 + M2×1）；**禁止自动重试**；同一假设上限已到。
- **Owner-hours 定义（root 裁定）**：全部实际执行 Owner（主 Qwen + Qwen 子代理 + **付费子代理**）的累计工作时间；非人类参与。
- **方法**：各 session「首次执行 → 任务终态」wall-clock 区间求和；等待可多计、重叠逐 Owner 相加、不去重 ⇒ **保守上界**。
- **已证部分 = 10,719 s**：主 `9,133`（21:00:02→23:32:15）+ Lane A `737` + H0 reviewer（付费 `d141e823`）`171` + preflight `5058d2b7` `203` + `1a78b257`（= 已计 7m55，**仅一次**）`475`。
- **极保守包络 = 3×9,133 s**：`079f1026` / `4f9751c9` / `b31820c6` 缺 wall 起止，各取整段；**非实际消耗**；已结束者此后**不延长**。
- **合计（截至 23:32:15Z）= 10,719 + 27,399 = 38,118 s = 10h35m18s**；此后只累加活跃主 Owner（+ 新增 Owner）。
- **UI active 另列（不混 wall）**：`4m54 / 3m02 / 14m17` = 294 / 182 / 857 s。
- **上限与截止**：16 Owner-hours；绝对截止 `2026-10-25T13:00Z`（与小时上限取更紧者）。剩余（@23:36:01Z，包络 38,344 s）≈ **≤ 5h20m**。
- 更新式：`包络(现在) = 38,118 + (现在 − 23:32:15) + Σ(新增 Owner 实际时长)`；新增 child 用**自身**实际时长，不再套整段包络。

## 4. 保持具名 UNKNOWN（不得强填、不得当作已证）

F0 UNSIGNED · **HTU build 产物**来源 `NOT_VERIFIED`（三 lib/dist 摘要不证明构建来源；**上游 commit 归属已验证**，见 §6；`.git/config` 仍自指）· `references/deepseek-harness` 冻结锚点对象缺失 · `tests/paths.mjs` 三面 pin 哪面权威 · 27 工具名中 26 项运行时装载者归属（27 项属 **M1 toy profile，非产品全集**）· 93 条账（**已定位的历史 PROPOSED 种子**，非当前冻结契约、非实现完成）· 默认 profile `REQUEST_EXTENSION` 的贡献者 · 首次派发 ~30 s 停顿（第二次 7 ms）成因 · M2 runner **自身 stdout 内**观测到的 ~27.6 s 向后跳变成因（**仅指该观测**；`23:56Z` / `2026-10-25T00:10:28Z` 等未来戳已按 root 令**撤回为无证伪引用**，不构成第二条时钟）· M2 wire `content` 数组形状诊断（**原始 wire 未持久化 ⇒ 不作定论**）· `tests/homes` 549 world 逐 world 容量与最后消费者 · 两份 `.tar.zst` 实际可解包性（禁解包）· **`package.json` 层面 repository 声明缺失**（键不存在；不影响上游归属结论）。

## 6. 仓库声明 / paths 源 / 种子副本（23:46Z 实测；**上一版报告的不实内容以此为准**）

- **HTU 声明 HEAD 的上游归属 = GitHub 已验证**（root 一手：<https://github.com/deepseek-ai/deepseek-harness/commit/639ed015397290b3745d163aafe02ffee4aa3f84>，message "Merge PR #5479 release:dsh@0.2.0-rc.2"）；本仓离线交叉核对 `git rev-parse <ref>:packages/core/tools/src/index.ts` = `ca89f370febac1fa24f84cc25351a186866fe7e7` **一致**（1,985 行）。**`package.json` 仍无 `repository` 键** ⇒ 上游归属靠 root 一手 + 对象匹配，不靠 package.json；**build 产物来源仍 `NOT_VERIFIED`**。
- **F0 paths 源 = master `4aaaa7b2`**：`:68-70` = `0.2.0-rc.2` / `639ed015397290b3745d163aafe02ffee4aa3f84` / `639ed01539`（与实际 HTU artifact 一致）。**工作树 `tests/paths.mjs` `:58-59` = `46a7f68b09`（旧 checkout 残留，历史漂移，F0 不用）**。build 来源仍 `NOT_VERIFIED`。
- **种子独立副本**：`dev/agent-workflow/evidence/s1-m0-closure-v3-seeds/`（dir 0700 / 种子 0644 同源于；`MANIFEST.md` 0600 `ec05902e6e9b9ba4…`）。**63 个文件**承载 **93 条记录**（`records=93` / `uniqueNames=90` / `families=27`）；逐文件 sha 63/63 一致，聚合 **`81102fae614b16521c30717c3122fce6791c66f3c04b901e7e9bb61ab207c657`**。来源 worktree HEAD **`3954d6368cd6fb533c03f20e0017126f1b5880ba`**（`64d258e8…` 不存在，作废）。地位不变：**PROPOSED**，未改 status、未切 `current`、checker 未运行。
