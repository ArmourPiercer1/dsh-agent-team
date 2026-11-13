# 证据体积预算：先测量，再定上限

> **Dated**: 2026-11-13（UTC）· **状态**: 度量已完成；上限属提案，待 owner 裁决
> **性质**: 设计 memo（`docs/plans/memo/`），不是当期执行计划；不删除、不移动任何证据
> **工具**: `scripts/evidence-budget.mjs`（只读）· **证据**: `dev/agent-workflow/evidence/eng-evidence-budget-20261113/`

---

## 0. 为什么要先测量

工程基线 memo 的 M5 提出「每 PR 证据 ≤ 2 MB」。上限如果没有测量就是猜：要么永远不触发（没人需要理它），
要么挡住诚实的工作。本 memo 用同一个只读工具回答两个不同的问题：

1. **单个 PR 增加多少证据？**（`--commits`：master 上最近 30 个 first-parent commit 在
   `dev/agent-workflow/evidence/` 下新增的字节数）
2. **证据树累积了多少？**（`--dirs`：每个顶层目录的字节数）

两者不是一回事，混在一起定一个数就会定错。

## 1. 实测（2026-11-13，`origin/master` @ `6361185d8`）

**每 PR（最近 30 个 commit）**

| 指标 | 值 |
|---|---|
| 中位 | **7.4 KiB** |
| P90 | **38.3 KiB** |
| 最大 | **55.4 KiB**（PD33-STALE-INSTRUMENT） |
| 合计 | 385.2 KiB |
| 超过 2 MiB 的 commit | **0** |

**累积（413 个顶层条目）**

| 指标 | 值 |
|---|---|
| 合计 | **151.0 MiB** |
| 中位目录 | 52.0 KiB |
| P90 目录 | 982.2 KiB |
| 最大目录 | **6.5 MiB**（`a5sf-pty-devlive`，342 文件） |
| 超过 2 MiB 的目录 | **26** |

结论有两句，方向相反：

- **M5 的 2 MB/PR 上限目前从不触发**（P90 只有 38 KiB，最坏 55 KiB）。作为「防事故」的护栏可以留，
  但它不会改变任何一次 PR 的成本，也不该被当作优化项。
- **真正的体积问题在累积**：151 MiB / 约 1 万个文件。每个 `git worktree add` 都要检出这份历史，
  这是**开发速度**问题，不是单个 PR 的卫生问题。

## 2. 提案（未实施）

### E1 保留 2 MB/PR 作为护栏

它不约束正常 PR（P90 = 38 KiB），只拦「误把构建产物、录像、大二进制提交进 evidence」这类事故。
实施位置属于 PR 模板/审查清单，不需要 gate 改动；本 PR 不动。

### E2 单目录上限建议 8 MiB（warn，不 block）

最大的目录 6.5 MiB 仍有意义（真实 boot 证据）。建议超过 8 MiB 时由审查者要求说明，而不是自动拒绝。
是否需要机器检查由 owner 裁决（会触及 CI 面）。

### E3 累积治理需要 owner 裁决

151 MiB 的历史证据是**只追加**的审计资产，本 PR **不删除、不移动、不压缩**。可选方向（都需要 owner）：

1. 按里程碑把已完成阶段的证据打成归档包（例如 `dev/agent-workflow/evidence-archive/<milestone>.tar.zst`），
   仓库里只留索引；——改变「证据就在树里」的现有保证，风险最高；
2. 保持现状，接受检出体积；
3. 只对**未来**的大目录设「单目录 ≤ 8 MiB」，历史不动。

在没有 owner 裁决前，本 PR 只提供测量，不提供删除。

## 3. 与开发速度的关系

- 证据本身不是 PR 慢的原因（P90 38 KiB）；CI 的 census 才是。
- 但 151 MiB / 1 万文件会放大每个 worktree 的创建与 `git status` 成本，在「1 task = 1 worktree」的
  工作流下被乘以任务数。这是 E3 值得讨论的理由，也是它必须由 owner 裁决的理由（涉及审计语义）。

## 4. 验收

- `node --test scripts/evidence-budget.test.mjs` → 8/8；
- `node scripts/evidence-budget.mjs --self-test` → 5/5；
- 真树两次运行：`evidence/eng-evidence-budget-20261113/commits.txt`、`dirs.txt`；
- 未改 `.github/`、`dev/ci/`、`scripts/eb3-*`、分支保护、Authority、候选 manifest/ref；未删除证据。
