# TINF M5 — census 执行切换到 plan + aggregator（Required contexts 不变）

> Dated: 2026-11-14（review round 2 补记 2026-11-15）· Status: **IMPLEMENTED（plan 路径已接线；`legacy` 仍是代码默认，切换 = `census-runtime.yml` 一行）** · 设计正本：`docs/plans/memo/agent-testing-infrastructure-20261114/` 之 07（§1 多重集不变量、§5 fail-closed、§6 step 5「换执行不换 context」）、10（Required contexts 必须仍为三个）、11（M5/M6 范围）、12（TINF-12/13/14/19）
> 前置：M4（`census-plan.mjs` + `census-aggregate.mjs`，merged **`6330ef4c4139ecc1145259e1746cec768250c78f`**，PR #772）。M4 的披露是「`build_digest` 无生产者、无 per-result 身份，所以真实计划今天会拒绝 PASS」——M5 正是补上这两件事并把它接进唯一的 census 执行路径。
> 本轮：`4ff253a50`（首版，PR #773）→ 审查 **CHANGES REQUIRED**（六条）→ `32c1a5bd4`（本 memo 描述的 head）。审查发现与修复的实测记录见 `evidence/review-round-2.txt`；审查后的结论是**六条全部成立**，没有一条是误报。

- 日期：2026-11-14（首版）／2026-11-15（round 2）
- 分支：`task/tinf-m5-census-cutover-20261114`，base = `6330ef4c4139ecc1145259e1746cec768250c78f`（TINF M4 合并点，PR #772）
- 设计正本：`docs/plans/memo/agent-testing-infrastructure-20261114/` 之 07（census 分片/聚合）、10（Actions 与 Required contexts）、11（M5/M6 范围）、12（不变式与负控）
- 本轮不做 PR；commit 后报告 SHA（PR #773 已存在）。

## 0. 一句话

census leg 的**内部执行**从「跑两次 vitest，把两份报告跟一份 baseline 文档对比」换成「按 M4 的 plan 跑 22 个任务、逐任务产出 `root`/`capture`/`status`/`evidence`、由 M4 的 aggregator 判定」；**证据通道（`DSH-CI-LEG` / `DSH-CI-VERDICT`）、population（11 roots / 22 tasks）、三个 Required contexts、job 名、`ci-required` 的评分方式全部不变**。开关是 `census-runtime.yml` 的一行 `--census-execution plan`，回滚就是删掉这一行。

## 1. 交付面

| 文件 | 行数 | 作用 |
| --- | --- | --- |
| `scripts/census-build-stamp.mjs` | 465 | `build_digest` 的**真实生产者**：对两个已提交安装面的字节做 canonical-JSON + sha256；缺面/空面**拒绝**，绝不填占位符；**已记录的 stamp 每次都对当前面重新哈希**（`BUILD_STAMP_STALE` / `BUILD_STAMP_UNVERIFIABLE`） |
| `scripts/census-execution.mjs` | 514 | 每个 plan 任务 → 终态结果 + evidence + skip 计数；`census-evidence/1` 证据产物；`census-replay/1` 录制/回放（含 `merge_tree` 与全覆盖校验）；shard 产物；token 渲染 |
| `scripts/census-aggregate.mjs` | +~100 | **唯一**的改动是新增 `verifyEvidenceRefs()` 并在 CLI 的 `--aggregate` 路径上调用：evidence 必须解析到 shard 目录内的真实文件。M4 的判定代数（`aggregate()`）一个字节没动 |
| `scripts/ci-pr-gate.mjs` | +~390（现 3106） | `--census-execution legacy|plan`、`--census-shards`、`--census-dry-run`、`--census-build-stamp`；`censusPlanLeg()`；`LEGS` 导出（测试用） |
| `scripts/census-cutover.test.mjs` | 942 | **37** 个 `node:test`：正向全量 PASS + 12 类具名拒绝的负控 + build stamp 正/负控 + 真 CLI 的 token/exit + **injected-runner 的 live 分支** |
| `.github/workflows/census-runtime.yml` | **+1 行** | `--census-execution plan`（除此之外一个字节没动：无新 job、无 matrix、无 concurrency、无 Required context） |
| `.github/workflows/ci-integration.yml` | +12 行注释、1 行改 | 新套件接进**同一个** `node --test` 行 |
| `dev/ci/eb3-ci-manifest.json` | `check[]` +1 | 同一个 leg 的 `check[]` 加上新文件，`why` 陈述 M5 |

## 2. 到底切了什么

### 2.1 执行模式开关

`ci-pr-gate.mjs` 的 `LEGS.census` 第一行判断 `ctx.censusExecution === 'plan'` 才走新路径；`legacy` 是**默认值**，所以这个 PR 合并当天行为零变化，切换由 workflow 的那一行完成。三个 plan-only 旋钮（`--census-shards` / `--census-dry-run` / `--census-build-stamp`）在 legacy 下**报错拒绝**而不是静默忽略——一个什么都不做的 flag 是操作者无法核对的断言。

### 2.2 plan leg 的五步

1. **derive**：`deriveRoots()` 从根 `vitest.config.ts` 的 `include[]` + catalog 派生 root 集（不记数字）；`merge_tree = gitTreeSha(HEAD tree)`。`EB3_MERGE_TREE`（若导出）是**声称**，与现树比较、**绝不替代**现树做身份（首版把它同时当身份和比较值，导致 `PLAN_MERGE_TREE_MISMATCH` 永远不可达——round 2 修掉，并加了断言错树的测试）。
2. **build 身份**：`resolveBuildStamp()` 现算真实字节摘要（mode=computed），或校验操作者给的 `--census-build-stamp` 文件（mode=recorded）。**缺失即 `BUILD_STAMP_MISSING` 拒绝**，不写占位符；**已记录的 stamp 会重新哈希当前安装面**，与记录不符即 `BUILD_STAMP_STALE`，面不可哈希即 `BUILD_STAMP_UNVERIFIABLE`（自洽的旧 stamp 不再被信任）。
3. **plan + verify**：`buildPlan()`（identity 里带上 `build_digest`），然后 `verifyPlan()` 用**当前树重新派生**一份再比 digest/identity/task set。plan 是每次现算的，不是从文件读的。
4. **execute**：**按 capture 顺序**，每个 capture 用 `plan.tasks[capture===1][0].runner.argv`（就是 `censusVitestArgv()` 的产物，与 legacy 逐字节相同）跑**一次** invocation，然后从该次的 vitest JSON 报告为 11 个 root 各派生一个终态结果。**不是 22 个进程**：census invocation 没有文件过滤器，按任务 spawn 会把整个 population 跑 22 遍；root 级并发发生在 vitest 进程内部（M4 已用 `census-root` 窗口重叠证明）。argv 里**只重写** `--outputFile.json=`：改为 `census-<stamp>-<pid>-<capture>.json` 并在 spawn 前 `unlink`，所以崩溃时留下的是**没有报告**（`CENSUS_REPORT_MISSING`）而不是上一次的报告。同时写 `census-replay-<n>.json`（真实派生的**输出**，不是手写 fixture）与 `census-evidence-<n>.json`，并记录 M3 的 `census-root` 行。
5. **aggregate**：`buildShardArtifacts()` → `writeShardArtifacts()` → `aggregateArtifacts()`（聚合前逐 shard 校验 evidence 引用）。产物（`census-replay-*.json`、`census-evidence-*.json`、`census-shard-*.json`、`product-build.json`）写在 **`--transcript-dir` 旁边**（shard 在 `<transcript>/plan/`），因此证据链随 transcript 一起被 workflow 上传，checkout 里没有 plan 路径的产物；没有 transcript dir 的本地运行才回落到 gitignored 的 `.artifacts/census/`。测试套件同理：夹具全在 `os.tmpdir()`，跑完 `git status` 为空（最多留一个**空的** gitignored `.artifacts/`，且没有任何代码读它——被审版本正是因为它缺席而 16 条红）。按 spec §5 的 fail-closed 顺序出 `DSH-CENSUS-SUMMARY verdict=… expected=… observed=…`，leg verdict 与 `DSH-CI-VERDICT` 由它决定。**任何拒绝 = RED**，detail 以具名码开头，**绝不回落 legacy**（静默回落会让「plan 真的跑了」不可测，而这正是本里程碑要消除的失败）。

### 2.3 `build_digest`：M4 披露的缺口被补上

M4 的诚实披露是「`build_digest` 无生产者，所以真实计划今天**不可能**聚合为 PASS」。M5 的 `resolveBuildStamp()` 是生产者：

- 摘要载荷 = `{schema, merge_tree, catalog_digest, surfaces, artifacts:[{path,bytes,sha256}]}`（排序后），用 M4 的 `digestJson()`（canonical JSON + sha256）——**不是第二套摘要格式**；
- `built_at` 记录但**不进摘要**（身份不能因为时钟移动而移动）；
- 用的是 `INSTALL_SURFACES`（`scripts/client-composition-surface.mjs`）与 `check-artifacts-committed.mjs` 相同的 ignored 过滤（`git ls-files --ignored --exclude-standard -o -- <surfaces>`），所以「盘上这份」与「提交过这份」看到的是同一个集合；
- 本树 `32c1a5bd4` 实测：`files=2088 bytes=16533772 digest=sha256:c64a4e06…`（每次现算都相同，一字节改动即变；**任何 commit 都会让 `merge_tree` 变，从而让 digest 变**——这是身份，不是缺陷）。
- **staleness**：`readBuildStamp(file, {cwd})` / `resolveBuildStamp({stampPath, cwd})` 会重新枚举当前面并比对：字节/数量/路径任一不同 = `BUILD_STAMP_STALE`；面缺失或为空 = `BUILD_STAMP_UNVERIFIABLE`。首版只校验「stamp 自洽」，因此同一棵树上较早时刻的自洽 stamp 会被接受——round 2 修掉。

### 2.4 每个结果的 identity + evidence

`resultsFromReport()` 为每个 plan 任务产出：

```
{ task_id, root, capture, state: PASS|FAIL|INCOMPLETE,
  files, assertions, skipped,
  evidence: "census-evidence-<capture>.json#<root> sha256:<canonical-json{root,capture,state,files,assertions,skipped}>" }
```

`root` / `capture` **从 plan 任务取**，不从报告事后猜；报告里没有出现的 root → `INCOMPLETE`（沉默不是「跑过且通过」的证据）；`success=false` 但没有可归因的断言失败 → `INCOMPLETE`。

**判定语义（round 2 修正）**：只有 `status === 'failed'` 计为失败（与 legacy 的 `scripts/fail-set.mjs` 一致）；`skipped` / `pending` / `todo` 是「runner 选择不跑」，**不是失败**，但会计数并写入 `skipped=`，因为「0 失败」和「0 跑过」不能读成同一句话（population 里已存在条件 skip，如 `packages/runtime/test/a5rbn-runtime-base-narrow.test.ts`）。未知状态一律 FAIL（`UNKNOWN_ASSERTION_STATUS`）——严格于 legacy，绝不更松。

**evidence 是能被打开的指针**：进程在 shard 目录里写 `census-evidence-<capture>.json`（每条 root 的 state/计数/摘要 + 来源报告路径与摘要），shard 里的结果指向它。`verifyEvidenceRefs()` 在**被评分的字节**上解析每个引用：不存在 → `RESULT_EVIDENCE_UNREADABLE`；解析后逃出 shard 目录 → `RESULT_EVIDENCE_OUTSIDE`；证据产物没有列出该 root → `RESULT_EVIDENCE_UNKNOWN_ROOT`。聚合器 CLI 与 `aggregateArtifacts()` 都走这一步，所以「22 条 PASS + `evidence=/nonexistent/…`」的伪造目录现在 exit 2。

## 3. 证明的东西哪里变了（before / after）

| 维度 | legacy（M4 之前/至今） | plan（M5） |
| --- | --- | --- |
| 判据 | 两份报告的身份集 vs baseline 文档（626 / 7936） | plan 的 22 个任务必须**各有终态结果**（multiset 不变式） |
| 少一个 root | 身份集不等 → 红（依赖 baseline 文档正确） | `TASK_MISSING` → `INCOMPLETE` → 红（依赖 plan） |
| 多一个 root | 由 baseline 对比间接体现 | `TASK_EXTRA` → 红；报告里出现 plan 没命名的 root → `RESULT_ROOT_UNPLANNED` |
| 报告 exit 0 但含 FAIL | 由 re-grade 解析 | `TASK_STATE_FAIL` → 红（shard 自己的 `COMPLETED`/`exit 0` 不算判决） |
| skip | `status !== 'passed'` 之外没有额外语义 | 不计失败、计数并打印（与 legacy 同义） |
| build 身份 | 无 | `build_digest` 进 plan identity；缺失/跨树/过期即拒绝 |
| 证据 | transcript 全文 | 每任务一条 `<evidence artifact>#<root> + digest`，聚合器**打开**它 |
| 计时 | `census-capture` + `census-root` | 同上，另加 `census-plan` / `census-plan-verify` / `census-aggregate` |

**判决等价性的诚实说明**：今天的 baseline 容忍集是**空**的（`nine-root-u7-1-old-reds.md` = 0 条具名 red + 0 个 collection-error 文件），所以对同一 population，plan 模式与 legacy 的判决等价。但 plan 模式**严格更严**：它不接受 baseline 容忍、也不做 load-family 重采样（legacy 对「只有 load family 红」有 3/3 重采样通道，但发布口径的 solo 绿率约 2/8，即这条通道几乎总是红）。这是**有意的收紧**，不是等价替换。

## 4. 测量（before / after）

| 轮次 | run | `ci-census` job 墙钟 | census leg（transcript） | 两份 capture |
| --- | --- | --- | --- | --- |
| M3 最后一次 L2 | 43638954936（#1195） | 20:43:20→21:06:57 = **23m37s**（1417 s） | `seconds=1095.9` | 550.8 s + 544.8 s |
| M4 合并点 L2 | 43648221295（#1198） | 22:28:15→22:51:55 = **23m40s**（1420 s） | `seconds=1091.3` | 551.0 s + 540.0 s |
| M5 | **尚未上机** | — | — | — |

**M5 改的是「证明了什么」，不是墙钟。** 结构上：plan 路径的 invocation 数 = 2（与 legacy 相同），argv 除报告路径外逐字节相同；plan+verify+aggregate 的额外开销在录制数据上实测 **0.8 s**（22 任务）。所以第一次 plan 模式 L2 的 census leg 预期仍是 ~1091 s。首次上机后，`tinf-timing.tsv` 会第一次给出 plan 路径自己的分解（`census-plan` / `census-plan-verify` / `census-capture ×2` / `census-root ×22` / `census-aggregate`），那时「plan 的开销」才是实测而不是估计。

## 5. 离线 dry-run（无宿主，可真跑）

```bash
node scripts/ci-pr-gate.mjs --full --only census --census-execution plan \
  --census-dry-run <dir> --census-captures 2 --census-test-timeout 90000
```

`<dir>` 里放 `census-replay-<n>.json`（`census-replay/1`，live 运行自己写出的录制）或 `census-capture-<n>.json`（vitest 原始报告）。回放现在必须满足三件事：`plan_digest` 相同、`merge_tree` **记录的树 = 本树的树**（否则 `DRYRUN_IDENTITY_MISMATCH`）、**覆盖 plan 的每一个 root**（否则 `DRYRUN_COVERAGE_MISMATCH`）。

### 5.1 输入到底是什么（round 2 更正）

**上传的 artifact 不能被当作录制回放。** `gh run download 43648221295 -n census-runtime-transcripts-1198` 只给出 `census-run.txt`、`census-capture-{1,2}.txt`、`tinf-timing.tsv`——**没有 vitest JSON 报告，也没有 `census-replay-<n>.json`**；直接拿它做 dry-run 会 `DRYRUN_CAPTURE_MISSING`。

本轮的正向证据是**在运行时合成**的录制：把 tsv 的 22 条 `census-root` 行按 `status=ok → PASS` 映射成两个 capture 的 `census-replay/1`，并把 `recorded_tree=7fae3be1…`（tsv 里写明的 M4 树）与 `synthesized_tree=<本树>` 都写进录制。它证明的是 **plan → 结果 → 聚合 → token 这条链**，**不**证明断言数、文件集合或「哪些测试真的跑了」。`evidence/dry-run-positive.txt` 顶部已如此标注；**目前不存在任何真实录制**（live plan 路径从未上机）。

正向 token（完整输出见 `evidence/dry-run-positive.txt`，head `32c1a5bd4`）：

```
DSH-CENSUS-BUILD digest=sha256:c64a4e06… mode=computed files=2088 bytes=16533772 merge_tree=c73ee3a4…
DSH-CENSUS-PLAN verify=ok tasks=22 roots=11 captures=2 plan=sha256:1ca0ed42… build=sha256:c64a4e06… est_unknown=11
DSH-CENSUS-CAPTURE capture=1 mode=dry-run tasks=11 passed=11 failed=0 incomplete=0 assertions=0 skipped=0 evidence=census-evidence-1.json report=recorded:1
DSH-CENSUS-CAPTURE capture=2 mode=dry-run tasks=11 passed=11 failed=0 incomplete=0 assertions=0 skipped=0 evidence=census-evidence-2.json report=recorded:2
DSH-CENSUS-SUMMARY verdict=PASS codes=none expected=22 observed=22 missing=0 extra=0 shards=1
DSH-CI-VERDICT pass pass=1 fail=0 skip=0 skipped=none legs=1 refused=0 refusedlegs=none
```

### 5.2 负控（同一份输入，全部 RED，完整输出见 `evidence/dry-run-negative.txt`）

| 负控 | 结果 | 出口 |
| --- | --- | --- |
| 一个 root 改为 FAIL（shard 仍 `COMPLETED`/exit 0） | `verdict=FAIL codes=TASK_STATE_FAIL expected=22 observed=22` | 1 |
| 录制里少一个 root | `REFUSED DRYRUN_COVERAGE_MISMATCH`（10 of 11 roots） | 1 |
| 只有 capture 1（缺第二次 capture） | `REFUSED DRYRUN_CAPTURE_MISSING` | 1 |
| 把录制标成它自己的 `recorded_tree`（7fae3be1…） | `REFUSED DRYRUN_IDENTITY_MISMATCH` | 1 |
| 缺 build stamp | `REFUSED BUILD_STAMP_MISSING` | 1 |
| 伪造 shard 目录（22 PASS + `evidence=/nonexistent/…`） | `REFUSED RESULT_EVIDENCE_OUTSIDE` | **2** |

另有测试套件内的负控（不经 CLI）：`RESULT_ROOT_UNPLANNED`、`RESULT_EVIDENCE_UNREADABLE`、`RESULT_EVIDENCE_OUTSIDE`、`BUILD_STAMP_STALE`、`BUILD_STAMP_UNVERIFIABLE`、`PLAN_MERGE_TREE_MISMATCH`、`CENSUS_REPORT_MISSING`（stale report 被 unlink）、`CAPTURES_INSUFFICIENT`、`TASK_MISSING`、`SHARD_TASK_ID_DUPLICATE`、`DRYRUN_*` 全 13 个码。

**录制为什么不进仓库**：plan identity 含 `merge_tree_sha`（提交即变），任何**提交**都会让已提交的录制在下一个 commit 失效——M4 的 `L2-20261114-MEASURED.txt` 已把同一现象写明（「memo/log commits 让 merge_tree 按构造移动」）。所以可复现的正/负控放在**测试套件**里：测试用当前树现算 plan、现生成 replay，再跑真 `LEGS.census`。

## 6. 拒绝码

新增（gate 层，前缀 `DSH-CENSUS-REFUSED code=`）：

- build 身份：`BUILD_STAMP_MISSING`、`BUILD_STAMP_UNREADABLE`、`BUILD_STAMP_SCHEMA_UNKNOWN`、`BUILD_STAMP_MALFORMED`、`BUILD_STAMP_DIGEST_MISMATCH`、`BUILD_STAMP_IDENTITY_MISMATCH`、`BUILD_STAMP_CLOCK_INVALID`、`BUILD_STAMP_STALE`、`BUILD_STAMP_UNVERIFIABLE`、`BUILD_ARTIFACTS_MISSING`、`BUILD_ARTIFACTS_EMPTY`、`GIT_READ_FAILED`、`DIGEST_INVALID`
- plan：`ROOT_CONFIG_MISSING`（来自 `deriveRoots`）、`PLAN_MERGE_TREE_MISMATCH`（`EB3_MERGE_TREE` 与现树或与 plan 记录的 identity 不符）、`PLAN_BUILD_FAILED`、`PLAN_VERIFY_FAILED`
- 执行：`CENSUS_SPAWN_FAILED`、`CENSUS_REPORT_MISSING`、`CENSUS_REPORT_UNREADABLE`、`CENSUS_SHARD_UNWRITABLE`、`CENSUS_EVIDENCE_UNWRITABLE`、`CENSUS_SHARDS_INVALID`
- dry-run：`DRYRUN_CAPTURE_MISSING`、`DRYRUN_CAPTURE_UNREADABLE`、`DRYRUN_REPLAY_UNREADABLE`、`DRYRUN_REPLAY_SCHEMA_UNKNOWN`、`DRYRUN_REPLAY_MISSING`、`DRYRUN_PLAN_MISMATCH`、`DRYRUN_IDENTITY_MISMATCH`、`DRYRUN_COVERAGE_MISMATCH`、`DRYRUN_CAPTURE_MISMATCH`、`DRYRUN_TASK_UNKNOWN`
- 逐任务：`TASK_ID_MISSING`、`TASK_STATE_UNKNOWN`、`RESULT_ROOT_MISMATCH`、`RESULT_CAPTURE_MISMATCH`、`RESULT_EVIDENCE_MISSING`、`RESULT_EVIDENCE_UNREADABLE`、`RESULT_EVIDENCE_OUTSIDE`、`RESULT_EVIDENCE_UNKNOWN_ROOT`、`RESULT_EVIDENCE_UNVERIFIABLE`、`RESULT_ROOT_UNPLANNED`、`SHARD_TASK_ID_DUPLICATE`、`SHARD_TASK_ID_UNPLANNED`

沿用 M4 aggregator 的（判定代数未改）：`CAPTURES_INSUFFICIENT`、`PLAN_DIGEST_MISMATCH`、`PLAN_TASK_DUPLICATE`、`PLAN_TASK_SET_EMPTY`、`TASK_MISSING`、`TASK_EXTRA`、`TASK_NO_TERMINAL_RESULT`、`TASK_STATE_<STATE>`、`SHARD_EXIT_<CODE>`、`SHARD_STATUS_<STATE>`、`SHARD_EMPTY`、`IDENTITY_MISMATCH_<FIELD>`、`IDENTITY_BUILD_UNRECORDED`、oracle 系列。出口约定不变：aggregator 0 = PASS / 1 = 非 PASS / 2 = 拒绝；gate 把所有拒绝折成 **leg verdict=fail**。

## 7. 未做（及理由）

- **M6 的手写名单退场**：`census-runtime.yml` 仍写着 `--census-captures 2`，`ci-integration.yml` 仍手写测试文件列表，`packages/testkit` 等仍由 workflow 的 step 文本决定。这些是 M6 的范围；退场会改变「CI 跑什么」，必须单独受审（spec §6 的阴影 workflow 同理，本 PR 没有新增 workflow 文件）。
- **独立 World / per-root 进程分片**：没有做，也不假装。`--census-shards N` 只是**产物布局**（把同一次 invocation 的 22 个结果连续切成 N 个 `census-shard/1` 文件），用来让 aggregator 的多产物路径被真实走一遍；它不是 N 个独立进程或 World。真正独立的 World 需要新的 host 供给与并发模型，属 M4 已披露的 deferral。
- **真机 live 首跑**：本机没有 pristine host（`tests/deepseek-harness-test-use` 不存在），live plan 路径在本地会被 preflight 拒绝。所以本轮 live 分支只经过**代码审查 + dry-run + injected-runner 测试**（测试替身逐 capture 写报告，验证「每 capture 一次带 stamp 的 invocation、只评这份报告、stale 报告被 unlink」），没有任何一次真实的 plan 模式 suite 执行。**live 首跑 = 本 PR 合并后的下一次 L2**，这也是 M5 唯一还没被实测证伪的环节。
- **真实 replay 录制**：不存在。所有回放输入都是运行时合成的（§5.1）；第一次真实录制只能来自第一次 live plan 运行。
- **build stamp 的单独 workflow step**：本轮把 `census-runtime.yml` 限定为一行改动，所以 stamp 由 plan leg **在进程内**计算并写盘（`<transcript-dir>/product-build.json`），没有新增 step。

## 8. 诚实限制

1. **build stamp 证明字节身份，不证明「跑过 build」**。真正证明「已提交产物 = 新构建产物」的是 census job 里 `pnpm build:composition` 末尾的 `check-artifacts-committed.mjs`；两者合起来才等于「这份产物由这次构建产生」。memo 不把前者说成后者。
2. **plan 模式更严**：放弃 baseline 容忍与 load-family 重采样。今天等价（容忍集为空），但若将来 baseline 恢复容忍，plan 模式会红而 legacy 可能绿——这是有意的方向。
3. **`--census-shards N` 不是并行**，`execution.shared_invocation=true` 写在每个 shard 产物里，明说「一次 invocation 的结果被切分」。
4. **aggregator 的 `scope` 块没改**（`shadow:true, wired_to_ci_required:false, writes_required_context_artifact:false, …`）：对**产物**仍然成立（没有 Required context 读它，产物写在 transcript 目录）；但 census **job** 现在在进程内消费 summary 决定自己的 leg verdict。这是「消费」，不是「权威」。
5. **dry-run 的状态映射不经过 vitest 报告**：合成输入的 `status=ok → PASS` 只到 root 级。它证明 plan→结果→聚合→token 的整条链，不证明断言数；live 路径由报告推导（`resultsFromReport`），两者共用 aggregator。
6. **「墙钟不变」是结构论断**（invocations=2、argv 相同）+ 0.8 s 的 plan/aggregate 实测开销，不是 M5 自己的上机测量。
7. **`est_ms=null`（`est_unknown=11`）**：live leg 不读 timing 文件，plan 的估计全为 null；任务集合与顺序不依赖估计，`balance()` 需要估计但本路径不做均衡。
8. **plan 是每次现算的**，不是从文件读的；所以「计划漂移」这类失败只能来自树在运行中变化（`verifyPlan` 会拒绝）。
9. **`census-aggregate.mjs` 本轮被改了一处**（新增 `verifyEvidenceRefs()` + CLI 调用点），这是 round 2 审查明确要求的（「evidence 必须存在」）；M4 的 `aggregate()` 判定代数、`census-plan.mjs`、`docs/ROUTER_RULES.md`、`docs/TEST_METHODS.md`、Authority/Candidate/release、`packages/**`（CORE PATCH BUDGET = 0）**一个字节没动**。
10. **M4 的 CLI 测试 fixture 改了 7 行**（写一份 `evidence.json`），因为 CLI 现在会解析 evidence；它们断言的东西没变（同一批 shard、同一个判决）。

## 9. 门禁（本 head 实测，`32c1a5bd4`）

```
fresh clone (git clone --no-hardlinks, 无 .artifacts/) + 六文件 CI 命令
  ............................................ 238 tests / 238 pass / 0 fail
  同一命令在 4ff253a50（被审 head）上 ......... 226 tests / 210 pass / 16 fail   ← finding 1 复现
node --test scripts/census-cutover.test.mjs ... 37 tests / 37 pass / 0 fail      (原 25)
node scripts/census-plan.mjs --self-test ...... PASS cases=40 failed=0
node scripts/census-aggregate.mjs --self-test . PASS cases=33 failed=0
node scripts/ci-pr-gate.mjs --self-test ....... pass 94 assertions
node scripts/test-catalog.mjs --max-uncollected 91
  ............................................ exit 0  tests=865 UNCOLLECTED=91
                                               digest=sha256:2497b8f9…（UNCOLLECTED 仍 91，棘轮未放宽）
node scripts/eb3-ci-required.mjs .............. pass workflows=10 findings=0
node scripts/docs-sync.mjs --check ............ findings=0 blocking=0
node scripts/lint-identities.mjs .............. exit 0 (162 identity lines / 76 distinct)
npx eslint <6 个改动文件> ..................... 0 problems
node --check <5 个改动脚本> ................... 全过
node scripts/ci-pr-gate.mjs --check-transcript <plan 模式 transcript>
  ............................................ pass class=ok :: 1 leg(s), final token pass
```

新套件接在**同一个** `ci-integration` leg 的 `node --test` 行与**同一个** manifest `check[]`：从任一处删掉新文件 = `CI_LAYER_LEG_WEAKENED`（M1/M3/M4 同一部法律）。`--max-uncollected 91` 未放宽。

## 10. 回滚（一行）

三种等价方式，任选其一，**不触碰任何 Required context / job 名 / `ci-required` 输入**：

1. 删掉 `census-runtime.yml` 里的 `--census-execution plan` 这一行（`legacy` 是代码默认值）；
2. 或把它改成 `--census-execution legacy`（显式）；
3. 或 `git revert` 本 commit —— `census-plan.mjs` 未被修改，M4 的 shadow 工具仍在原处；`census-aggregate.mjs` 只多了一个未被 legacy 路径调用的 evidence 校验函数。

回滚后 census 立即回到「两份报告 vs baseline 文档」的旧判据；plan 路径的产物（`product-build.json`、`census-shard-*.json`、`census-replay-*.json`、`census-evidence-*.json`）只写在 transcript 目录，不影响任何门禁。
