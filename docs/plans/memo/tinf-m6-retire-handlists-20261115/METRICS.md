# TINF M6 — 指标（生成于 2026-11-15，数据只来自 API/transcript，不手抄）

口径与限制先写在前面：

- **L1 = job 墙钟**（GitHub Actions `started_at`/`completed_at`，秒，向下取整）。
- **L2 = census transcript 里的自身分解**（`tinf-timing.tsv` 的 `duration_ms`，以及 `DSH-CI-LEG leg=census seconds=`）。
- 采集命令列在每节标题下，可复现。**未测到的项一律写 UNKNOWN + 原因**，不用推断补空。
- 本分支（`task/tinf-m6-retire-handlists-20261115`）**尚未推送**，所以「M6 自己的 CI 指标」不存在，见 §6。

## 1. L1：`ci-required.yml` 最近 24 次 PR 运行的 job 墙钟

采集：

```bash
gh run list --workflow=ci-required.yml --limit 25 --json databaseId,conclusion,createdAt,event
gh run view <id> --json jobs        # 每个 run 一次
```

窗口：`2026-11-14T16:58:57Z` … `2026-11-15T00:34:07Z`，共 25 条 PR 运行，其中 1 条 `cancelled`（43630142078，并发组取消，无 job 时间）被排除 → **N = 24**。

| run | created (UTC) | 结论 | run 墙钟 | census job | ci-integration | ci-product | ci-security | ci-fast | ci-required(聚合) |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 43618553685 | 11-14 16:58:57 | failure | 137 | — | 89 | 105 | 61 | 30 | 11 |
| 43619009957 | 11-14 17:03:41 | failure | 123 | — | 89 | 81 | 55 | 32 | 16 |
| 43619970604 | 11-14 17:13:58 | failure | 159 | — | 91 | 126 | 53 | 25 | 11 |
| 43620486802 | 11-14 17:19:37 | failure | 160 | — | 80 | 121 | 58 | 23 | 15 |
| 43620896869 | 11-14 17:24:02 | failure | 158 | — | 75 | 117 | 59 | 34 | 12 |
| 43621313478 | 11-14 17:28:44 | **success** | **1525** | **1495** | 75 | 91 | 55 | 28 | 11 |
| 43626639235 | 11-14 18:26:48 | failure | 111 | — | 77 | 34 | 32 | 27 | 13 |
| 43627658135 | 11-14 18:37:43 | failure | 123 | — | 88 | 21 | 20 | 29 | 12 |
| 43628355701 | 11-14 18:45:19 | failure | 121 | — | 80 | 35 | 28 | 32 | 13 |
| 43628420606 | 11-14 18:46:00 | failure | 100 | — | 68 | 29 | 30 | 22 | 12 |
| 43629119518 | 11-14 18:53:47 | failure | 160 | — | 70 | 126 | 60 | 21 | 12 |
| 43630118941 | 11-14 19:04:55 | failure | 165 | — | 93 | 131 | 59 | 27 | 13 |
| 43630197388 | 11-14 19:05:41 | **success** | **1434** | **1405** | 89 | 106 | 50 | 29 | 11 |
| 43635202303 | 11-14 20:01:08 | failure | 168 | — | 92 | 135 | 58 | 35 | 13 |
| 43637348068 | 11-14 20:24:41 | failure | 136 | — | 89 | 101 | 57 | 29 | 11 |
| 43637971293 | 11-14 20:31:50 | failure | 151 | — | 78 | 116 | 52 | 27 | 11 |
| 43638506074 | 11-14 20:37:50 | failure | 125 | — | 94 | 94 | 44 | 33 | 12 |
| 43638954936 | 11-14 20:42:56 | **success** | **1453** | **1417** | 80 | 125 | 61 | 28 | 14 |
| 43643902752 | 11-14 21:38:42 | failure | 137 | — | 74 | 104 | 49 | 30 | 11 |
| 43646821309 | 11-14 22:12:02 | failure | 139 | — | 76 | 111 | 62 | 21 | 10 |
| 43648221295 | 11-14 22:27:52 | **success** | **1453** | **1420** | 94 | 108 | 54 | 25 | 10 |
| 43653814687 | 11-14 23:33:14 | failure | 168 | — | 79 | 138 | 54 | 27 | 11 |
| 43658305261 | 11-15 00:28:06 | failure | 161 | — | 120 | 128 | 55 | 30 | 12 |
| 43658816371 | 11-15 00:34:07 | **success** | **1361** | **1325** | 115 | 87 | 54 | 33 | 11 |

**5 次全绿运行的统计**（红 run 的 job 会提前退出，砖墙不可比，不参与统计）：

| 指标 | min | median | max |
| --- | ---: | ---: | ---: |
| run 墙钟 | 1361 | **1453** | 1525 |
| census job | 1325 | **1417** | 1495 |
| ci-integration job | 75 | **89** | 115 |
| ci-product job | 87 | **106** | 125 |
| ci-security job | 50 | **54** | 61 |
| ci-fast job | 25 | **28** | 33 |
| ci-required 聚合 | 10 | **11** | 14 |

读法：census 占整条 run 的 95%（1417/1453），其余四条层是 30–125 s 量级。**node:test 的那些 leg 全在这四条层里，所以它们的墙钟在秒级，改清单结构不会移动 L1 的天花板**——M6 的收益是「不再有两份清单 / 不再需要同步」，不是「更快」。

## 2. L2：census job 墙钟与 leg 自身分解（5 次真正跑了 census 的 run）

采集：`gh run download <id> -D <dir>` → `<dir>/census-runtime-transcripts-*/census-run.txt` 与 `.../census-transcripts/tinf-timing.tsv`。

| run | 模式 | census job | `DSH-CI-LEG seconds` | capture 1 | capture 2 | plan | plan-verify | aggregate | 断言数 / capture |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 43621313478 (#1182) | legacy | 1495 | 1156.7 | UNKNOWN¹ | UNKNOWN¹ | — | — | — | 9176 |
| 43630197388 (#1190) | legacy | 1405 | 1094.1 | UNKNOWN¹ | UNKNOWN¹ | — | — | — | 9213 |
| 43638954936 (#1195) | legacy | 1417 | 1095.9 | 550.8 | 544.8 | — | — | — | 9213 |
| 43648221295 (#1198, M4 合并点) | legacy | 1420 | 1091.3 | 551.0 | 540.0 | — | — | — | 9213 |
| **43658816371 (#1201, M5 合并点)** | **plan** | **1325** | **1029.6** | **517.7** | **510.2** | **0.714** | **0.694** | **0.002** | **9213** |

¹ 这两个 run 上传的 artifact 里没有 `tinf-timing.tsv`（只有 `census-run.txt`），所以只能给出 leg 总计；**分项 = UNKNOWN，不估算**。

**plan 路径的额外开销 = 0.714 + 0.694 + 0.002 ≈ 1.41 s**，占 leg 的 **0.137%**。M5 memo 里估的 0.8 s 偏小（真实的 plan+verify 是 1.41 s），已在 M5 memo §4 更正。

**关于「plan 比 legacy 快 66 s」**：legacy 自身的离散是 1091.3–1156.7 s（极差 65.4 s），plan 的 1029.6 s 与 legacy 中位数 1095.0 s 的差是 65.4 s —— **恰好等于极端值差**。因此这里**不能**声称 plan 更快；能声称的是「plan 的协议开销 ≈1.4 s，其余差异属于 runner 方差」。要证明快/慢需要同一 tree 的重复运行，**未做 = UNKNOWN**。

## 3. 未收集计数与 catalog digest（M6 前后逐字相同）

```bash
node scripts/test-catalog.mjs --max-uncollected 91
```

```
  tests=865 instruments=3 digest=sha256:2497b8f97dcabc973e738188a1eb71ad28597ab54d1a823da4f8dfd4f5944884
  DISCOVERED_AND_COLLECTED 760
  EXCLUDED_WITH_REASON     14
  UNCOLLECTED              91
  by runner: node=110 none=7 vitest=748
DSH-TEST-CATALOG tests=865 digest=sha256:2497b8f97dcabc973e738188a1eb71ad28597ab54d1a823da4f8dfd4f5944884 refused=0 findings=0
```

- 与 M5 基线（`tests=865`、`digest=sha256:2497b8f9…`、`UNCOLLECTED 91`）**完全一致**；ratchet 仍是 `--max-uncollected 91`，只允许降。
- 91 的构成沿用 M5 口径：node 未收集 80 + vitest 未收集 11（`node=110` 里另有 5 个是 `EXCLUDED_WITH_REASON`）。M6 没有把这个数字改小——**改小不是 M6 的目标，不改大是它的门**。

## 4. 变异杀伤率（可测的那部分）

不是「整个仓库的 mutation score」：没有 mutation 工具、也没有跑得起的全量预算。这里测的是**M6 新增/修正的每条定律在被人删掉之后，它声称保护的那个套件会不会红**。

```bash
node dev/agent-workflow/evidence/tinf-m6-dispatch-parity/mutation-controls.mjs
```

| # | 变异 | 跑哪个套件 | 结果 | 红计数 |
| --- | --- | --- | --- | ---: |
| 1 | 证据引用不再比较文件字节（`if (actual !== token)` → `if (false)`） | `census-cutover.test.mjs` | **KILLED** | 1 |
| 2 | 允许空 argv（`DISPATCH_NO_SUITES` 分支删除） | `test-catalog.test.mjs` | **KILLED** | 1 |
| 3 | 把 `node --test <file>` 行塞回 workflow | `test-catalog.test.mjs` | **KILLED** | 1 |
| 4 | 放宽 node:test 谓词（`NODE_SUITE_RE = /.*/`） | `test-catalog.test.mjs` | **KILLED** | 5 |
| 5 | 删掉 `--max-uncollected 91` 那一行 | `test-catalog.test.mjs` | **KILLED** | 1 |
| 6 | `--verify-plan` 退回「不带 plan 自己许可」的推导 | `census-plan.test.mjs` | **KILLED** | 1 |
| 7 | dispatch leg 的 cmd 去掉 `--run` | `eb3-ci-required.mjs` | **KILLED** | 2（`CI_LAYER_LEG_UNPROVEN`, `CI_LAYER_LEG_DISPATCH_SHAPE`） |

**kill = 7/7 = 100%**（n=7，全部为 M6 相关分支）。另有 9 个「manifest 变异 → checker 具名拒绝」的控制，见 `dev/agent-workflow/evidence/tinf-m6-dispatch-parity/negative-controls.txt`（`DSH-M6-NEGATIVE-CONTROLS PASS cases=9 failed=0`），其中包含「settlement leg 也被 grade」这一条。

**这个数字的边界**：n=7 是**挑出来的**，不是随机抽样，所以它是一个「定律不是空话」的存在性证明，**不是**仓库的 mutation score。全仓 mutation score = UNKNOWN（没有工具、没有预算，见 §6）。

## 5. 旧集合 vs 新集合的差异：0

```bash
node scripts/dispatch-tests.mjs --parity --old-ref origin/master
# caveat: `origin/master` must be the TRUE remote master (e5bf0567, M5 merged). Cloning from a stale
# local checkout gives an older origin/master and reports `DIFFERS steps=16` — environmental, not a
# parity failure. In a clone without that ref, pass the base sha itself (`--old-ref e5bf0567`),
# not `HEAD~N` — N changes with every commit the branch gains.
```

```
DISPATCH-PARITY IDENTICAL steps=18 old_files=25 new_files=25 problems=0
  union old=25 new=25 set=sha256:5de65f5ef1355d5b506a95bd635acd25bd2cb6aaecf702b3460bb548f7ffde42
```

- 18 个步骤（ci-integration 17 + pr-gate settlement 1）；旧 argv 24 个唯一文件 + settlement 1 个 = **25**；新 argv 也是 **25**；每个步骤 `missing=none added=none`；`problems=0`。
- 完整逐步骤输出（每个旧/新文件各一行）已提交：`dev/agent-workflow/evidence/tinf-m6-dispatch-parity/old-vs-new-argv.txt`。
- 这个比对是**集合**比对（排序后），因为 argv 顺序不是合同；`node --test` 不关心文件顺序。

## 6. UNKNOWN（明确不测的项与原因）

| 指标 | 状态 | 原因 |
| --- | --- | --- |
| L3（更细的 stage/step 分解、跨 run 趋势） | **deferred** | 没有 profile 采集基础设施；`scripts/census-profile.mjs` 的 step 级报表仍是 M7 计划项（`11-MIGRATION-AND-ACCEPTANCE.md` 第 5 行） |
| 长时运行模型 / 预算外推 | **deferred** | 没有 long-running 语料与可比的运行序列；用 1 次 L2 外推会是编造 |
| flakiness dashboard（逐套件重跑率、flaky 率） | **deferred** | 没有把重跑历史持久化的设施；`gh` API 只给最终结论，不区分「首次红、重跑绿」 |
| K=2 / K=4 分片 census 的真实墙钟、runner-minutes、host boot 次数 | **UNKNOWN** | 从未跑过分片运行（M4 memo §5 的数字全是离线模型） |
| 全仓 mutation score | **UNKNOWN** | 无 mutation 工具；本报告只有 7 个定向变异（§4） |
| vitest 层的 old-vs-new argv 差异 | **UNKNOWN** | M6 没有 vitest dispatcher，两份 vitest 清单按 §3 保留，未做等价性证明 |
| 43621313478 / 43630197388 的 capture 分项 | **UNKNOWN** | 它们的 artifact 里没有 `tinf-timing.tsv`（见 §2 注 1） |
| M6 自己的 CI 指标（本分支） | **UNKNOWN** | 分支未推送、无 run；合并后可用同一命令补测，口径不变 |
| host cache 命中率 | **UNKNOWN** | 缓存键已实现但**未启用**（M3 结论），未启用即无命中数据 |
