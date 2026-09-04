# R125 合并审计 — int/P9-master-product-closure（merge 232316d）

日期：2026-09-04。审计方：主 Agent（合并执行者自审计；独立复核 = reviewer-1）。
对象：`master`(2c1c200) + `task/upstream-rc1-compat`(bd38827) → `int/P9-master-product-closure`。

## 1. 合并基本事实

| 项 | 值 |
| --- | --- |
| merge commit | `232316db0e395fc8e616e9c67f4eaac0496f133a` |
| parent 1（ours，master） | `2c1c2002687eb257c70c01f82d96c51e346bbcda`（R124 推送后 bookkeeping） |
| parent 2（theirs，rc1-compat） | `bd388272a5b46386a8f5315d38a2f00f575cbc4a`（= P9 tip `dc056d5` + `c6bae9c` build-pin rc.1 + `bd38827` sessions.flush seam） |
| merge-base | `959e36358ee7244ff8c7e1e0b8396e70dfef4562`（master 祖先 → 3-way 合并成立） |
| 合并模式 | `git merge`（非 squash、非 rebase）；int 分支名 `int/P9-master-product-closure` |

## 2. 产品面同一性（核心断言）

```
git diff --stat bd38827 232316d -- packages scripts tests pnpm-lock.yaml package.json tsconfig.json vitest.config.ts eslint.config.mjs .github
→ 空输出（byte-identical）
```

即：merge 后的产品面（9 包源码、测试、锁文件、根配置、CI 配置）与五闸全绿的 RC1 树（bd38827）**逐字节相同**。
R122 全量测试证据对该产品面有效（可迁移性论证 = R125 测试闸的基准；本轮另在全新 tree 复跑四道非 smoke 闸，见 gate-*.log 与 gate-summary.md）。

## 3. 冲突与裁决（3 处，全部 add/add，全部在 evidence/）

唯一冲突 = 3 个 P8-S 测试日志（两侧各自新增，无共同祖先版本）：

| 文件（dev/agent-workflow/evidence/P8-S/） | branch blob（UTF-16LE，BOM FF FE） | master blob（UTF-8 no-BOM，`5c7145a` 规范化） | merged blob |
| --- | --- | --- | --- |
| tc-s6-chain-dist.log | `8c644c0ed2b456298b3857aafcb44e4574e6e901` | `4d3d951c79a262376d62a89ec36ff1aa0d0e5640` | = master |
| tc-s6-chain-fresh.log | `ea4819ae9275b0dddf8a99b7a1ae625aa3f0b573` | `43c896725e1f75a79873ebf8ac4c7ac5629e2d87` | = master |
| tc-s6-live-17-scenarios.log | `02ef34ee4230d2cd136a72eca4ddc307d505b79c` | `e4d23484a774397e81fef1a8844a2539b5f1012f` | = master |

**裁决**：全部取 master（ours）侧，`git checkout --ours` + add。
**理由**：两侧内容为同一测试输出，差异仅为编码 —— branch 侧为 UTF-16LE 原始捕获（tc-s6-chain-dist.log 23176 B，BOM `FF FE`），master 侧为 commit `5c7145a` 的 UTF-8 规范化（11407 B，首行 `PASS packages\client\test\client.test.ts (3 tests)` 与 branch 侧解码后一致）。仓库日志纪律 = UTF-8；branch 侧 UTF-16 为历史捕获瑕疵，规范化版本即权威。裁决理由写入 merge commit message。

**未触碰任何产品面路径**（3 处冲突全部位于 `dev/agent-workflow/evidence/`）。

## 4. 分支侧文档面核验

branch 侧（959e363 → bd38827）对 `AGENTS.md` / `README.md` / `docs/ROUTER_RULES.md` / `docs/TEST_METHODS.md` / `dev/agent-workflow/graph.yaml` / `SESSION_ROUTER_LOG.md` **零改动** → 文档面合并无冲突、无静默漂移。

## 5. int 分支增量（merge 之后）

```
git diff --name-status 232316d 8cf9fcb
M  .gitignore
A  docs/INSTALL.md
M  eslint.config.mjs
M  package.json
A  scripts/build-client-composition.mjs
A  scripts/place-dist-glue.mjs
```

即 R125(1/2)「composition 构建产品化」= 恰好 6 文件（新脚本 2 + 安装文档 1 + 三处构建接线），无其他增量。
`scripts/build-client-composition.mjs` 代码逐字取自 `dev/agent-workflow/evidence/P9/s8/s8-bundle.mjs`（仅文件头 provenance、usage 行、日志前缀 `s8-bundle:` → `build-client-composition:` 变更；移除未用 import 后输出 byte-match 复验，见 byte-compare.md）。
provenance 注（reviewer-1 F1）：`s8-bundle.mjs` 属 **worktree-only untracked P9 证据**（主 worktree `dev/agent-workflow/evidence/P9/s8/` 内 235 文件集之一，从未被 rc1-compat 分支 track）→ 本目录证据在 8cf9fcb 处同为 untracked（reviewer-1 F2）；两者一并由 **R125 bookkeeping 提交归档入库**，归档后本引用与 byte-compare 记录均可经 git 历史验证。

## 6. 红线核验（合并动作面）

- 未 push（R124 一次性授权已消耗；本合并为本地 int 分支操作，push 待用户新授权）。
- 未动 `references/deepseek-harness/`（冻结 legacy fork）与 `D:\deepseek-harness\` / :3080。
- CORE PATCH BUDGET = 0 保持：合并两侧均无 upstream 源码改动（rc1-compat 分支的全部适配在本仓库 packages/runtime 侧，已 R122 L2 复核 GO）。
- worktree：`.worktrees/P9-MC`（1 task = 1 worktree = 1 writer，本会话唯一写入者）。
