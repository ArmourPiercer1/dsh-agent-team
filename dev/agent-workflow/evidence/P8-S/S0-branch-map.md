# P8-S0 — Branch / Worktree Map（R62 快照，S0 清理后）

repo: `D:\AgentDev\dsh-plugins\dsh-agent-team` · 2026-08-31

## Worktrees（30 = 1 main + 25 retained + 4 new P8-S）

| Worktree | Branch | HEAD | 用途 / 状态 |
|---|---|---|---|
| (main) | `master` | `02088d9` | 主 Agent bookkeeping 唯一写入点（log/graph/evidence）；S0 归档待提交 |
| `.worktrees/int-P8-S` | `int/P8-S-backend-closure` | `3fa4c1f` | **新** P8-S integration branch + worktree；node_modules 已装（R62，28.4s） |
| `.worktrees/P8S1A` | (detached) | `3fa4c1f` | **新** S1A production topology audit（只读 worker） |
| `.worktrees/P8S1B` | (detached) | `3fa4c1f` | **新** S1B known defect revalidation（只读 worker） |
| `.worktrees/P8S1C` | (detached) | `3fa4c1f` | **新** S1C backend critical gap scan（只读 worker） |
| `.worktrees/int-P8` | `int/P8-remote-projection` | `3fa4c1f` | P8 集成分支（stop SHA；node_modules 已装）——保留至 G8-S 后 |
| `.worktrees/int-P7` | `int/P7-advanced-semantics` | `959e363` | P7 集成分支（历史）——保留至 G8-S 后 |
| `.worktrees/G8-S1` | `task/G8-S1-gate-supplement` | `50585fb` | G8-S1 补充任务（已集成入 int/P8 → 3fa4c1f）——保留至 G8-S 后 |
| `.worktrees/P8-T1` | `task/P8-T1-projection-dto` | `c3e5b36` | 已集成——保留至 G8-S 后 |
| `.worktrees/P8-T2` | `task/P8-T2-projection-service` | `4f7573b` | 已集成——保留至 G8-S 后 |
| `.worktrees/P8-T3` | `task/P8-T3-remote-contract` | `d237ee1` | 已集成——保留至 G8-S 后 |
| `.worktrees/P8-T4` | `task/P8-T4-remote-push` | `74e23cd` | 已集成——保留至 G8-S 后 |
| `.worktrees/P7-T1`…`P7-T7` | `task/P7-T*` | 5475cd8 等 | P7 已集成（审计日志已归档 master）——保留至 G8-S 后 |
| `.worktrees/P6-T1`…`P6-T6` | `task/P6-T*` | … | P6 已集成——保留至 G8-S 后 |
| `.worktrees/P5-T1`…`P5-T6` | `task/P5-T*` | … | P5 已集成——保留至 G8-S 后 |
| `.worktrees/P4-T1`…`P4-T6` | `task/P4-T*` | … | P4 已集成——保留至 G8-S 后 |
| `.worktrees/P3-T1`…`P3-T6` | `task/P3-T*` | … | P3 已集成——保留至 G8-S 后 |
| `.worktrees/P2-T1`…`P2-T6` | `task/P2-T*` | … | P2 已集成（P2-T1 有 2 个 P2 时代 untracked scratch）——保留至 G8-S 后 |
| `.worktrees/P1-T1`…`P1-T5` | `task/P1-T*` | … | P1 已集成——保留至 G8-S 后 |

**S0 已删除**：`G7-1` `G7-2` `G7-3`（detached @ 298d636；证据 G7 关闭时已归档 + stray scratch 补归档）、`G8-R4` `G8-R5` `G8-R6`（detached @ 3fa4c1f；round-2 证据 R62 归档后删除）。

## Branches（全部）

- `master`（02088d9）— bookkeeping；领先 origin 12 commits（**未推送**；push 纪律依 G8-S 计划/用户指令另行确定）。
- 集成：`int/P0-freeze-provenance` … `int/P7-advanced-semantics`（959e363）、`int/P8-remote-projection`（3fa4c1f）、**`int/P8-S-backend-closure`（3fa4c1f，新）**。
- 任务：`task/P0-T1`…`P8-T4`、`task/G8-S1-gate-supplement`（50585fb）——全部保留。
- 远端：`origin/master` @ `959e363`（push #1–#7 后位置）。

## 锁 / 实例

- 无 `.lock` 文件（`references/` 扫描）；无 live 测试 DSH 实例；ports 3181–3186 free；:3080 = 200（稳定实例未触碰）。
- `references/.dsh-test-*` 目录（历次 gitignored 测试 DSH_HOME）保留，不影响。
