# TINF M0 — 基线修复、收集审计与 step 级 profiling（实施记录）

> Dated: 2026-11-14 · Status: **IMPLEMENTED (draft PR)** · 设计正本：`docs/plans/memo/agent-testing-infrastructure-20261114/`（PR #767，M0 一节）
> 范围：只改测试基础设施工具与一个 CI leg；**不**改运行时代码、Authority、Candidate、release 状态，**不**改三个 Required contexts、fail-closed 聚合、census 组成与 deferral。

## 1. 为什么是这五件事

设计集把 M0 定义为“把已有 baseline PR 的缺陷修正在 master 上重写落地”。五个 baseline PR 的缺陷是**同一类**：工具给出的数字不是它宣称度量的东西。

| # | 缺陷（修正前） | 修正后 | 今天的实测 |
| --- | --- | --- | --- |
| 1 | ready-helper 五处假通过（#759，未合并） | 五个 refusal 码 | PR #767：`MARKER_PRESENT_TITLE, SETTLEMENT_MISSING` 之外无假绿 |
| 2 | 证据预算把 `--numstat` 行数当字节（#761） | object DB 真实字节，含二进制 | 近 30 个 first-parent commit：p50 **701,506 B**、p90 **2.31 MB**、max **3.28 MB**、**5/30 超过 2 MiB** |
| 3 | 未定覆盖率只有百分比，诱导“kit=零测试”（#764） | 按类命名 UNKNOWN，保持 exit 2 | 40 commit：21 undetermined（53%），其中 kit 24 次 / 根目录 scratch 10 次 / 脚本 2 次 / **other 0** |
| 4 | 未收集测试集没有当前口径（#530 仍未合并） | 收集审计（只读） | 98 个 in-scope tracked suite，**19 collected / 79 uncollected** |
| 5 | “API 无 step 级耗时”的错误前提（#762 B1） | 读 jobs API 的分位数报表 | n=3：census **1100 s（77%）**、host build 272 s（19%）、repo build 22 s（2%），job p50 1427 s |

## 2. 每项改了什么

### 2.1 `scripts/pr-ready-check.mjs`（替代未合并的 #759）

`origin/master` 上从来没有这个文件；它只在 #759 的分支上。本 PR 重写并落地，`evaluate()` 是纯函数，`gather()` 只读。

五处假通过 → refusal：

1. `mergeable_state` 为 `unknown`/缺失 → `STATE_UNKNOWN` / `STATE_MISSING`（原来只是 note，仍然 READY）；
2. 本地 `HEAD` 与 PR head 不同 → `LOCAL_HEAD_NOT_PR_HEAD`（原来只查工作区干净与 ahead）；
3. 远端没有该分支 → `BRANCH_NOT_PUSHED`（原来 `rev-list @{u}..HEAD` 失败被当成 ahead=0，即“已推送”）；
4. check-run 判据改为**按 `started_at` 取最新一次尝试**，pending/queued 也算最新 → `LAYER_*_IN_PROGRESS`（原来只排序 completed，旧 success 会压过新 re-run）；
5. comments 逐页拉取（原来只读第 1 页 100 条，settlement 更早时被读成“缺失”）。

新增 R9：ready 时带 `ci-defer-full` 标签 → `DEFERRED_LABEL_PRESENT`。理由是该 head 的 L2 会被整层跳过，“一次 L2”在这条 head 上无法成立。

未门控（明示）：review thread 是否 resolve（人的判断）、文档质量、改动好坏。READY 只表示机器可见前置条件成立。

### 2.2 `scripts/evidence-budget.mjs`（替代 #761）

- 字节从 object DB 读（`git cat-file --batch-check`，按输入顺序对齐），二进制文件按真实大小计；
- 窗口是**字面**的 last-N first-parent commit，而不是 `git log -n30 -- <path>`（后者选的是“最近 30 个碰过该路径的 commit”，实测跨了 39 个 commit，这就是 #761 的 p50 7591 B 与逐 PR 中位数 2845 B 矛盾的原因）；
- 一行 = 该 commit 改动的证据文件**在该 commit 的大小之和**（新增文件精确；修改文件取新大小，是上界）。这是“PR 留下的足迹”，不是 diff 大小；
- 新增 `--rev`（默认 `origin/master`）、`--dirs`、`--worktree`。

### 2.3 `scripts/coverage-audit.mjs`（替代 #764）

保留 `classify()` 的 exit 2，并把 undetermined 按原因分桶：`kit-runner`、`world-factory-driver`、`uncatalogued-script`、`root-scratch`、`other`。

**明确不采纳** #764 的 C1（kit 归为 evidence-only → `determined` + 0 tests）。把“我不知道影响面”变成“绿，什么都没跑”正是 `ci-local.mjs` 当初改成 exit 2 要防的事。

分桶的意义：`root-scratch`（`.merge-loop.sh` 这类误提交的根目录文件）用 `.gitignore` 修，`kit-runner`/`uncatalogued-script` 用 M1 的自动发现修，只有 `other` 说明缺一条 `classify()` 规则——一个百分比无法区分这三者。

### 2.4 `scripts/test-collection-audit.mjs`（新，复用 #530 的判定）

- 被审计集合：`scripts/**`、`tests/**` 下的 tracked `*.test.mjs|cjs|js`；
- “被收集”的判据：workflow 的 `run:` 行里的 `node --test` token，或 `dev/ci/eb3-ci-manifest.json` 的 `check[]`；
- 豁免必须有 `reason` 与 `review`，且“既收集又豁免”会报 stale；
- 只读，`--strict` 留给 M1 接成门禁。

**#530 复用复审**：#530 仍是 OPEN；它的 `scripts/eb3-node-test-collection.mjs` + manifest 例外表本质是“再写一份手工名单”，且其 38 文件基线已过时（当时 tracked suite 38 个，现在 98 个）。本 PR 复用其判定，不落地其 gate。

**披露**：census 对 `tests/world-factory/**` 只做结构解析（`ci-pr-gate.mjs:1368` 的 “parse, no spawn”），不执行；所以解析不算收集，审计不把它计入 collected。

### 2.5 `scripts/census-profile.mjs`（新）

读 Actions jobs API 的 per-step `started_at/completed_at`，对 N 个成功 census job 报 step 中位数与占 job 的比例。跳过（skipped）的 step 与没有时间戳的 step **不**记为 0；全 skipped 的 job（draft 轮）不是样本，`--input` 只喂这种 job 时 exit 2 拒绝。

它看不到 census step 内部九个 root 的分解——Actions 只记一个 step，那需要 M3 的 harness 级计时。报表里明说这一点，不编造归因。

### 2.6 CI 接线（增加一个 leg）

`scripts/tinf-m0.test.mjs`（11 个 test）接进 `ci-integration`，并在 `dev/ci/eb3-ci-manifest.json` 登记同一文件为 required token；`node scripts/eb3-ci-required.mjs` 本地 `pass workflows=10 findings=0`。

**一个文件而不是五个**：在 M1 的自动发现落地前，每多一个 suite 就要多写一处 workflow 行 + 一处 manifest 条目，而这正是 2.4 度量的缺陷。这条 leg 本身就是“手写名单”的现状，M1 会把它替换掉。

## 3. 负控（故意制造 → 各工具看见）

| NC | 制造 | 期望 / 实际 | 证据 |
| --- | --- | --- | --- |
| 1 | 未写 settlement 的 draft（PR #767 本身） | `MARKER_PRESENT_TITLE, SETTLEMENT_MISSING` | `nc-1-ready-before-settlement.txt` |
| 2 | 在 M0 worktree 里对 #767 运行（head 不是 PR head、分支超前） | `LOCAL_HEAD_NOT_PR_HEAD, UNPUSHED_COMMITS` | `nc-2-wrong-git-state.txt` |
| 3 | 同上 + 一个未跟踪文件 | 追加 `WORKTREE_DIRTY` | `nc-3-dirty-worktree.txt` |
| 4 | 一个本地空 commit（不 push） | 仍含 `UNPUSHED_COMMITS` | `nc-4-unpushed-commit.txt` |
| 5 | `git add -N` 一个没人命名的 `.test.mjs` | 该路径出现在 UNCOLLECTED，`total 98→99` | `nc-5-uncollected-suite.txt` |
| 6 | 临时 git 仓提交 1 MiB PNG + 12 B json | **1,048,588 B**（#761 会把 PNG 记成 0） | `nc-6-binary-evidence.txt` |
| 7 | 含 `tests/kits/**` 的改动 | 仍 undetermined，reason=`kit-runner`（不是 determined/0 tests） | `nc-7-unknown-named.txt` |
| 8 | 全 skipped 的 census job | exit 2 拒绝，不报 0 秒 | `nc-8-profile-refusal.txt` |

## 4. 被这些测量推翻的旧结论

1. **“24 分钟大部分是构建”**：错误。census 占 77%，host build 占 19%。Host build 缓存最多省 ~4.5 min；真正的杠杆在 census。
2. **“2 MiB/PR 上限永远不会触发”**（#761）：错误。近 30 个 commit 中 5 个超过 2 MiB，max 3.28 MB；而累计证据树 153.2 MiB（413 个目录，27 个目录超过 2 MiB）。
3. **“#764 的 53% undetermined 说明规则缺失”**：只有 0 次落在 `other`。53% 里最大的一块是 kit（24 次）与误提交的根目录文件（10 次），两者都不是 `classify()` 规则问题。

## 5. 已知缺口（不隐藏）

- M0 的测试仍然是“被手工列进一个 leg”，TINF-01 要的自动发现是 M1；当前 `test-collection-audit` 自己就报告 79 个未收集 suite。
- `pr-ready-check` 是本地辅助，不是服务端权威；它不替代 branch protection，也不判断 review。
- `evidence-budget` 对“修改过的文件”取新大小，因此是上界；对 rename 同样计入新文件全量。
- `census-profile` 无法分解 census step；`--runs` 是顺序拉取，CI 之外的网络抖动会跳过个别 run（跳过不计数）。
- #760（candidate-status 只读）与 #763（发布独立）按设计**不在本 PR**。

## 6. 复现

```bash
node --test scripts/tinf-m0.test.mjs
node scripts/pr-ready-check.mjs --self-test
node scripts/evidence-budget.mjs --commits 30 --top 30
node scripts/coverage-audit.mjs --commits 40 --top 8 --explain
node scripts/test-collection-audit.mjs
node scripts/census-profile.mjs --runs 3          # 需要 gh + 网络
node scripts/eb3-ci-required.mjs                  # 形状自检
```

## 7. 回滚

`git revert` 本 PR 的 commit set：leg 是新增的，manifest/workflow 各一行，五个脚本都是只读工具；回滚不触及任何 Authority、candidate ref、Required context 或 census 语义。
