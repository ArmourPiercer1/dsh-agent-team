# P0-T4 验证记录 — legacy behavior inventory

- 任务：P0-T4 legacy behavior/reuse inventory（Class A，只读 LEGACY）
- 分支：`task/P0-T4-behavior-inventory`（worktree `.worktrees/P0-T4`，base = NEW_REPO master @ `5ecf11d`）
- 验证环境：Windows pwsh；LEGACY 检出 `D:\AgentDev\dsh-plugins\dsh-agent-team\references\deepseek-harness`（工作树 clean、只读，仅 `git` 只读 ref 操作）
- `LEGACY_SHA = a3ab31992762c5d6560797eabc7e0885a9320ade`（branch `feat/team-vnext-integration-20260829`，tag `legacy-agent-team-pre-vnext`）

## 测试 (a)：全部被引用 legacy 路径存在性

**方法**：从两份产物文档（`docs/migration/legacy-behavior-inventory.md`、`docs/migration/reuse-map.md`）中用正则提取全部反引号包裹的候选 legacy 路径（前缀 `packages/|examples/|apps/|.agents/|docs/`，扩展名 `ts|tsx|md|yml|json|css|mjs|jsonl`），去重后逐条执行：

```
git -C D:\AgentDev\dsh-plugins\dsh-agent-team\references\deepseek-harness cat-file -e a3ab31992762c5d6560797eabc7e0885a9320ade:<path>
```

**排除项**：`docs/migration/*`（2 条）= 本任务在新仓库中的产物自引用，非 legacy 路径，不计入。

**第一轮结果**（初稿）：78 条候选，PASS=71 / FAIL=7。7 条失败全部为引用书写错误，已逐条对照 `git ls-tree` 实际结果修正：

| 初稿错误引用 | 实际 legacy 路径（ls-tree 确认） | 修正 |
|---|---|---|
| `packages/team/tool-team/src/error.ts` | `packages/team/tool-team/src/invariant.ts`（空 InvariantInstaller；"校验在注册期"设计立场） | reuse-map §1.5 行改为 `invariant.ts`（D 级）；汇总行同步 |
| `packages/client/ui-workspace/src/client/WorkspaceBrowser.tsx` | `packages/client/ui-workspace/src/client/rows/WorkspaceBrowser.tsx` | reuse-map §1.9 路径补 `rows/` |
| `examples/team-agent/tests/fixtures/snapshots/team-e2e/{leader,sentry,writer}.expected.jsonl`（3 条） | `examples/team-agent/tests/snapshots/team-e2e/*.expected.jsonl` | reuse-map §1.10 去掉 `fixtures/` |
| `docs/AGENT_TEAM_MODE.md` | repo 根级：`AGENT_TEAM_PLUGIN_PLAN.md`、`AGENT_TEAM_PLUGIN_ROUND2_PLAN.md`、`AGENT_TEAM_PLUGIN_ROUND3_PLAN.md`、`AGENT_TEAM_PLUGIN_AUDIT_2026-08-18.md`、`AGENT_TEAM_N11_MAXCONTEXTTOKENS_DESIGN.md`、`team-mode-feature-gap-analysis.md` | reuse-map §1.10 展开为 6 条真实根级文档 |

**终轮结果**：**76 条唯一 legacy 路径，PASS=76 / FAIL=0，exit 0**。完整清单见本目录 `paths-verified.txt`。

## 测试 (b)：11 行为域覆盖（对照开发计划 §12.2 P0-D）

计划 `docs/plans/active/DSH_Agent_Team_vNext_Detailed_Development_Plan_20260829.md` §12.2 P0-D（L1798–L1814）清单与 inventory `## 1. 行为域条目` 小节逐项比对：

| # | 计划 §12.2 域 | inventory 小节 | 命中 |
|---|---|---|---|
| 1 | delegate | `### 1.1 delegate（委派）` | ✓ |
| 2 | follow-up | `### 1.2 follow-up（跟进指令）` | ✓ |
| 3 | message | `### 1.3 message（成员间消息）` | ✓ |
| 4 | control | `### 1.4 control（权限审批控制）` | ✓ |
| 5 | progress | `### 1.5 progress（进度看板）` | ✓ |
| 6 | cold resume | `### 1.6 cold resume（冷恢复）` | ✓ |
| 7 | Timeline | `### 1.7 Timeline（委派时间线）` | ✓ |
| 8 | Members | `### 1.8 Members（成员分组）` | ✓ |
| 9 | Events | `### 1.9 Events（事件流 / Feed）` | ✓ |
| 10 | Dock | `### 1.10 Dock（团队 dock 条）` | ✓ |
| 11 | session navigation | `### 1.11 session navigation（会话导航）` | ✓ |

**11/11 全覆盖**，顺序与命名一致。每域均含：旧行为语义 / 实现位置（legacy 路径 + 关键函数）/ 值得复用的关键算法/纯函数 / 内嵌的旧 runtime 假设（挂接 G1–G7 全局假设表）/ 复用分级。

## 环境一致性（任务卡要求）

- NEW_REPO master `5ecf11d` clean（worktree base 未动）；本任务提交在 `task/P0-T4-behavior-inventory` 分支上，未 push。
- LEGACY 检出未做任何写操作（仅 `git ls-tree`/`git show`/`git cat-file -e` 只读命令），分支 `feat/team-vnext-integration-20260829` @ `a3ab3199` 保持 clean。
- 未触碰其他 `.worktrees/*`、`dev/agent-workflow/graph.yaml`、`SESSION_ROUTER_LOG.md`。
