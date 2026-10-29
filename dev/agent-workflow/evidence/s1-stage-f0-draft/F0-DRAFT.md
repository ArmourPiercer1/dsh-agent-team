# S1 阶段成果 F0 **草稿**（versioned draft · **非签发** · **G1-I 未过**）

- 目录：`dev/agent-workflow/evidence/s1-stage-f0-draft/`（本目录 = S1 自有单一版本化草稿；**不切 `current`、不改 PR363 三计划、不宣称 G1-I 通过**）
- 版本戳：`F0-DRAFT rev 0 @ 2026-10-25T00:13:21Z`（真实时钟）；唯一 writer = 主 Qwen；20 min 主侧时间盒内完成
- 方法：**复用**既有账（下方逐条给路径 + sha），本包**不重扫 48 树、不重扫 549-world 面、不重跑任何实验**；未知资产一律**具名 owner + 保护**，**"未跟踪"不作为贬低价值的理由**

## §1 三锚（固定引用；一切结论只引这三处，不用工作树漂移当事实）

| 锚 | 值（实测命令） | 用途 / 限制 |
|---|---|---|
| 固定 master | `origin/master` = **`4aaaa7b2af87f80a0fae62d9c8d9cf03d5a6fd84`**（`git rev-parse origin/master`）；本地 `refs/heads/master` = `6259cf4bc4d61af74d84bbd9d265184f95493172` = **历史漂移，永不反客为主** | 治理账 / 产品面（`git show 4aaaa7b2:<path>`） |
| PR363 计划 | `1310b959595b211e5da7a5f727dadf522f79d60b`（**只 `git show`，工作树副本已漂移**） | CI-01…CI-12 原文；CI-04/CI-05 为**已批契约**，非条件保证 |
| HTU pinned | `tests/deepseek-harness-test-use` HEAD = **`639ed015397290b3745d163aafe02ffee4aa3f84`**，`git tag --points-at HEAD` = **`dsh-v0.2.0-rc.2`**；官方对象 `https://github.com/deepseek-ai/deepseek-harness/commit/639ed015397290b3745d163aafe02ffee4aa3f84` | **upstream 归属 = 已验对象**；**本地 build artifact provenance = `NOT_VERIFIED`**（两事分开，不互相背书） |

## §2 48 树价值账（**复用**，不重扫）

- 底账：`.worktrees/.s1-f0-census-20261025/gittrees-1.txt` **`469000d2e18a04ed…`**（**第 2-49 行 = 48 个 worktree 行**，第 4 列 `dirty_tracked`）；**`docs-review` 树在册**（实测该件内 `docs-review` 命中 **1** 行 ⇒ 47 + docs-review = **48**，与 `F0-SNAPSHOT-20261024.md` `66f92d058ff9f2f7…` §2"worktree 注册 48"一致）。
- 六列价值表：`dev/agent-workflow/evidence/s1-inventory-lane-a/RECOVERY-VALUE-INDEX.md` **`65cd575cfc73bdf8…`**（列 = 路径 / KiB 实测 / apparent KiB / 是否可再生（依据）/ 现有保全-恢复依据 / 唯一价值判断）。**本包不重导数字，只指针复用。**
- 已具名保护（**不删，等 GO**）：`recovery/a5-m2-int-damaged-20261023`（3,599,048 KiB）、`tests/homes/a5m2-todo-c2-r3-20261023T10-16-39Z`（698,508 KiB）、`tests/homes/a5m2-c2-r15-20261023T14-24-17Z`（547,396 KiB + `.lock`）、`.playwright-browsers`（660,656 KiB，**root 明令不删**）、Q6/Q7 保全目录。
- 容量口径边界：`F0-SNAPSHOT` §3 对 `tests/homes/*` 逐 world 容量与最后消费者 = **`NOT_OBSERVED`**；`du-pass1.txt` `b9d577154e359e53…` 三段 maxdepth 全空 + `du.err` 276 B。**本轮不补测**（禁重扫）。
- `tests/homes` 顶层条目数 = **550**（仅目录名计数；含 `.credentials.yaml`、`.playwright-browsers` 等**非 world 条目**）⇒ **world 精确数仍具名 UNKNOWN**（root 口径 549），**不以计数冒充账**。
- `.git`：806 MiB（25 packs 322.76 MiB + 21,332 loose 273.24 MiB），garbage 1 件 `tmp_pack_YQWrCj` 8.50 MiB（F0-SNAPSHOT §1）；**未 prune / 未 gc**（禁）。

## §3 Q6 / Q7 退役与归档（有据，非记忆）

- **Q6**：`.worktrees/.s1-asset-preserve-q6-20261024/` `PROVENANCE.md` **`75eb746ec36ffb06…`**；`archive.sha256` → **`ac542a96103249b02b88b2a519bab78925bca06643c5a8ad3a11fb3e7887ab27`**（820,248,620 B）；**`tar-diff.out` = 0 B 且 `tar-diff-at-destroy.out` = 0 B**（流式 `tar --diff` 销毁前后**差异 0 行 ×2**）；`index.sha256` 6 件；`meta-diff.txt` = 3 处仅目录 size 差异；`strict-credential-hits.txt` 0 B。
- **Q7**：`PROVENANCE.md` **`9a24ce9d9da27890…`**；唯一精确源退役 = **root GO 已执行**（账本 `23:04Z` 条）；**净空间账已勘误**：正确净增 = `2,715,164,672 − 813,539,328 = 1,901,625,344 B`（早期"只扣归档"的 `1,946,118,301 B` 已作废）。
- **共同边界**：两归档**从未解包验证**（unpackability UNTESTED）；源已消失 ⇒ 归档 = 唯一副本 ⇒ **保护中**。

## §4 两个 `install` 误删与恢复边界

- 对象：`install-0a3f11b2`、`install-d703affb`（HTU `node_modules` 安装树）；删除清单 `.worktrees/.s1-f0-census-20261025/delete-pack-int-install-0a3f11b2-d703affb.txt` **`9970f73ae26c2039…`**（**50 行**）。
- 已在手的恢复件（同目录实测）：`recovered-candidate.install-0a3f11b2.package.json` / `.install-d703affb.`（各 872 B）、`verify.mjs.from-install-0a3f11b2` / `-d703affb`（各 4,112 B）、`0a3f11b2-final.lock.cand` / `d703affb-final.lock.cand`（各 612,696 B / 8,266 行）；恢复工作目录 `.worktrees/.s1-recover-0a3-d703-20261024/`。
- **恢复边界（诚实表述）**：可恢复 = **上述候选件所承载的最小面**（package manifest、verify 脚本、lock 候选）；**不可恢复/未证明可恢复** = 完整 `node_modules` 依赖闭包与原始 mtime/mode 序列 ⇒ **`RECOVERABLE_PARTIAL / UNKNOWN`**，不得写成"已恢复"。相关首批删除与依据：`first-batch-DELETED-receipt.md` `a9a8274de0463dc9…`、`first-batch-recovery-basis.md`、`RECOVERY-a5m2-pinbuild-node_modules.md` `78194afe723c0105…`。

## §5 93 条种子的独立保全

`dev/agent-workflow/evidence/s1-m0-closure-v3-seeds/`（dir 0700，**63 文件**，per-file sha 63/63 匹配）：`MANIFEST.md` **`ec05902e6e9b9ba4…`**；相对路径聚合（两副本同值）**`81102fae614b16521c30717c3122fce6791c66f3c04b901e7e9bb61ab207c657`**；源 = `.worktrees/a5m2-bmcp` 分支 `feat/a5m2-b-mcp` HEAD **`3954d6368cd6fb533c03f20e0017126f1b5880ba`**。
计数口径固定为：**93 records（含 4 条 `surface:*` **义务行**）/ 90 唯一 name / 86 非 surface 名 / 3 双记名**；语义仍为 `PROPOSED_NOT_IMPLEMENTED_NOT_ACCEPTED`；机检 `machine-v3/check.mjs`（`84d3fdcf…`）**从未运行**。

## §6 三次 Host 真实结果（全部一次性、无自动重试）

| # | run 目录 | 真实结果 | 封存件 |
|---|---|---|---|
| 1 | `s1-h0-m1/runs/s1-h0-m1-20261024T222400Z` | **FAIL**（`REQUEST_EXTENSION`，默认 profile） | `m1-run.mjs 4542782e…` / `probe-plugin.mjs c883ac3f…` / `mock-deepseek.mjs 8beade69…`（reply kind = **`'tool-call'`**） |
| 2 | `s1-h0-m1/runs/s1-h0-m1-noext-20261024T225300Z` | 差分 **PASS**（`--variant-no-ext-contributors`）⇒ 归因到扩展贡献者，**不开第三轮** | 同上（差分仅开关参数） |
| 3 | `s1-h0-m2/runs/s1-h0-m2-2026-10-24T23-26-02Z` | **FAIL 已封**：`pass:false`、`outcome:"not-delivered-call1-result"`（18/20） | `m2-run.mjs ef2bf20f…` / `probe-m2-plugin.mjs 03d36a89…` |

**结论分离（不得互相推导）**：晚解析现象 = **已观测** ≠ M2 判定 FAIL ≠ H0 安全**未通过** ≠ 授权绕过（gate 只看 name/args `:1493-1519`）。M3 修复件已交 root 等有限裁决：`probe 181fc9a7…` / `m3-run d581e559…` / `oracle c2a1e33a…`（before 快照 `pre-child-20261025T000552Z/`）；**主侧不再自行修复、不再启动 Host**。

## §7 工具来源并集条件表（复用 Lane A，不重导）

`dev/agent-workflow/evidence/s1-inventory-lane-a/F0-SOURCE-SET.md` **`281e140e9c212d45…`** + `G1-I-MIN-TASKS.md` **`cfe0da6a0d968502…`**（含 root 窄裁决 §R）：**F0 = 跨 source / profile / mode / platform 的并集 + 每行条件标签**；preset 名集 **2/31/31/33**、`native`→全量 `knownNames`（`index.ts:1011-1013`）、`ptc`→折叠 `run_code`（`:1022-1028`）、Team **15** = 13 字面 + 2 工厂动态（`4aaaa7b2:packages/tools/src/tools.ts:1373`）、条件插件（`ralph` `base:447-449`、`plugin_manager`、`bash`/`pwsh` 平台条件）、动态 MCP 面 ⇒ **全部具名在册**；`standard × native` **仅 M1/M2 观测比较切片**。装载者归属 = **UNKNOWN + owner + 下游验证点**（W 轴 `tools/change :208` / `get(name,scope) :1230`），**不等于禁止取证**。

## §8 预算（真实 + 保守上界）

- 保守包络（root 口径：逐 Owner 墙钟区间求和，等待可多计、重叠相加、未知不报 0）：`38,118 + (now − 2026-10-24T23:32:15Z) + 225(付费 child bf754fcc 两段) + 350(Lane A 新段) + 222(付费 child 76fca60b)`；**本包写作时实测** `38,118 + 2,393 + 225 + 350 + 222 = 41,308 s = **11h28m28s**`，16 h 上限剩余 **≤ 4h31m**。
- 真实（非包络）分项：M3 实现包 **156 s**；M3 修复 child **222 s**；Lane A 收口 child **350 s**；安全 child **225 s**；主侧各登记条为逐条实测时钟。
- 额度：PoC **3 / 20**；Host 启动 **3 / 12**；绝对截止 **`2026-10-25T13:00Z`** 不变。

## §9 真正妨碍 F0 签发的缺口（**≤5**，各给 owner 与关法；其余 UNKNOWN 可带账）

| # | 缺口（为何**妨碍签发**，不是"还可再做"） | owner | 关掉它的最小动作 |
|---|---|---|---|
| **G-a** | **口径标签方案未裁**：F0 并集每行的 preset/mode/platform/条件标签如何构成"交付范围"缺 root 裁决 ⇒ 并集**无法冻结**（非"选一个切片"） | root | 一句裁 §7 的标签方案（T1） |
| **G-b** | **build provenance 未证**：HTU 是 build artifact，upstream 对象已验但**本工件来源链未验** ⇒ 任何"W 轴实测代表 upstream 官方构建"的签名语句都不成立 | 主（需 root 给取证面） | 一次构建链取证（或明文把该声明降级为永久限定） |
| **G-c** | **归档完整性仅"零差异流式比对"，未做解包校验**（Q6/Q7 从未 unpack）⇒ "保全=可恢复"仍未闭合，而这是退役资产签字的前提 | 主 | 各一次只读解包到临时点 + 计数比对（需 GO，占磁盘额度） |
| **G-d** | **资产账 owner 面为空**：`tests/homes/*` 逐 world 容量/最后消费者 `NOT_OBSERVED`（F0-SNAPSHOT §3），world 精确数亦 UNKNOWN ⇒ 保护名单靠具名点撑，无法整体签发 | root 指派 owner | 逐 world 归属采集（一次授权的分层 `du` + 最后消费者反查） |
| **G-e** | **种子账机检未跑**：`machine-v3/check.mjs` `84d3fdcf…` 从未运行 ⇒ 93 records 的机检一致性只有人工 sha，无 checker 结论 | 主 | 在副本上一次只读 `node check.mjs`（不碰源 worktree） |

**可带 UNKNOWN 签发后处理的（不妨碍）**：26 名逐名装载归属（G-a/G-b 之外属 W 轴后续验证点）、4 条 `surface:*` 语义、win32 名集、`REQUEST_EXTENSION` 贡献者、~30 s 首派发延迟、runner 内 ~27.6 s 倒退、`tests/paths.mjs` 三处 pin 权威分层、`references/deepseek-harness` 锚对象缺失。

## §10 本包不作的主张

不作 F0 签发；不作 G1/G1-I PASS；不切 `current`；不改 PR363 三计划 / `graph.yaml` / `AGENTS.md`；不判定任何对象"可删"；不把"未跟踪"当价值依据；不重扫 48 树 / 549-world 面；不动 `.credentials.yaml`；不 prune/gc/删分支；**不启动 Host、不新增 PoC**。
