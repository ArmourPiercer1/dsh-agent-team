# 合并操作规程（主 Agent 单写）— alpha.2 capability completion

> 每个任务 PR merge 时严格执行（计划 §15 十步 + 用户 PR 工作流 D-1）。
> 远端操作（push/PR/merge）只由主 Agent 执行；零 force-push。

## 0. 前置核验（merge 前）

```bash
cd /home/user/dsh-plugins/dsh-agent-team/.worktrees/<task-wt>
git log --oneline int/alpha2-capability-completion..HEAD          # 任务提交集
git diff --stat int/alpha2-capability-completion..HEAD            # 完整 diff 审查
git diff int/alpha2-capability-completion..HEAD -- \
  dev/agent-workflow/graph.yaml dev/agent-workflow/SESSION_ROUTER_LOG.md \
  packages/testkit/test/p4t6-session-event-scan.test.ts \
  package.json pnpm-lock.yaml packages/runtime/dist packages/client/composition-shim \
  | wc -l                                                          # 必须 = 0（single-writer 零触碰）
git -C /home/user/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use status --porcelain  # 必须空
git -C /home/user/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use rev-parse HEAD     # = a66e470204
```

## 1. RED 复现核验

在任务 worktree 上确认 RED probe 测试存在且能区分旧/新行为
（跑任务报告指向的 RED 测试文件；如任务报告声称的 RED 文件缺失 → 拒合并，退回任务）。

## 2. 本地 re-gate（任务 worktree，任务 tip）

```bash
pnpm install --frozen-lockfile --ignore-scripts
pnpm test -- <任务新增/修改的测试文件>          # real vitest
node scripts/run-tests.mjs <触碰包...>           # plain-node 全量
pnpm --filter @dsh-agent-team/<pkg> run typecheck # 每触碰包
pnpm build                                       # 全量编译（dist 盘上产物，不 commit 任务分支上的）
node scripts/verify-zero-core.mjs                # 0 finding
```

失败集与 `evidence/alpha2-capability-completion/baseline.md` 对比：**新增确定性失败 = 0**
（逐文件对比，不只比总数——§18.2）。

## 3. 推送任务分支 + 创建 PR

```bash
git push origin <task-branch>
gh pr create --base int/alpha2-capability-completion --head <task-branch> \
  --title "<task-id> <subject>" --body-file <pr-description>
```

PR 描述必须含计划 §13 固定格式（Task ID / Base integration SHA / Head SHA /
Allowed product files / Actually changed / single-writer MUST BE NONE /
RED / GREEN / Security invariants / Conflict forecast / Evidence path）。
素材取自任务 report.md + 本 SOP 第 0/2 步输出。

## 4. 合并 PR（worktree merge 与 PR merge 同步）

```bash
# 在 int worktree：
cd /home/user/dsh-plugins/dsh-agent-team/.worktrees/a2c-int
git merge --no-ff <task-branch> -m "Merge <task-id> into int/alpha2-capability-completion (<PR #>)"
# 冲突（预期仅 p4t6 pin 可能）：按 DEC-1 union 规则解决 pin；src 冲突 → 停，重审任务
gh pr merge <PR#> --merge          # 与本地 merge 同一提交集
```

> 顺序：本地 merge → 解决 → re-gate（第 5 步）→ 通过后 `git push origin int/...` →
> `gh pr merge`（此时 PR 与 int tip 内容一致；若 gh pr merge 产生不同的 merge commit，
> 以远端 int 的 merge commit 为准，本地 `git pull --ff-only` 对齐）。

## 5. integration tip bookkeeping（int worktree，merge 后）

```bash
# 5.1 p4t6 pin union（DEC-1）：按本任务报告的 expected scanner delta 更新
#     packages/testkit/test/p4t6-session-event-scan.test.ts 的 pin（690 起累加）
pnpm test -- packages/testkit/test/p4t6-session-event-scan.test.ts   # 必须绿
# 5.2 重建 tracked dist 产物并 commit（本分支上允许且必须）
pnpm build
pnpm build:composition
pnpm check:artifacts
pnpm smoke:composition
git add packages/runtime/dist packages/client/composition-shim
git commit -m "alpha2-capability-completion: INT_Wn bookkeeping — merge <task-id> (PR #N), p4t6 pin <new>, dist artifacts"
git push origin int/alpha2-capability-completion
# 5.3 cross-task smoke（§15 第 9 步）：
pnpm test                              # root 全量，失败集 vs baseline 逐文件 diff
node scripts/run-tests.mjs             # plain-node 全量
# 5.4 更新 graph.yaml（task state → MERGED, PR 号, INT_Wn SHA）+ SESSION_ROUTER_LOG.md 追加
git commit + push（并入 5.2 或独立 bookkeeping commit）
```

## 6. 冻结 INT_Wn

记录：INT_Wn SHA、p4t6 pin 值、失败集 delta（应为 0）、PR 号。
此后才允许派发依赖该 tip 的下一波（§15 第 10 步）。

## 7. 最终 PR（INT_W4 冻结后）

```bash
# 全部 4 波冻结 + closure gates（§18 全量）+ closure-report.md 完成 + 最终 re-gate 后：
git push origin int/alpha2-capability-completion
gh pr create --base master --head int/alpha2-capability-completion \
  --title "alpha.2 capability completion (A2C-1/2/3/4/5/7)" --body-file <final-pr-description>
# 关闭除该 PR 外的所有 open PR（此前任务 PR 应已在各自 merge 时关闭；复核 gh pr list --state open）
# 该 PR 留给用户直接 merge；主 Agent 不代合 master
```

## 8. 失败处置

- 任务 merge 后 gate 变红（基线外新失败）→ 判定：任务引入 vs 并行任务互斥
  （W1 两任务同文件区）→ 必要时 `git revert` merge commit（**不 force-push**，
  revert 是新提交，符合红线）并把任务退回 BLOCKED 状态重派。
- PR merge 与本地 merge 分歧 → 以 int 分支实际内容为准，`git pull --ff-only` 对齐，
  记录到 SESSION_ROUTER_LOG。
