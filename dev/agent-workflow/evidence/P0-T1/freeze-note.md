# P0-T1 Freeze Note — Legacy Reference Frozen

- **Date**: 2026-08-29 (UTC+8)
- **Task**: P0-T1 冻结 legacy reference（Class C，机械任务）
- **Executed on branch**: `task/P0-T1-legacy-freeze`（worktree `.worktrees/P0-T1`，基线 `master` @ 5ecf11d）

## 审计基线 SHA

| 名称 | SHA（全 40 位） |
| --- | --- |
| UPSTREAM_SHA（deepseek-harness 上游审计基线） | `cd5ef8148158c3a752a658978873241fdf8e2bbc` |
| LEGACY_SHA（冻结 checkpoint，feat/team-vnext-integration-20260829 分支尖） | `a3ab31992762c5d6560797eabc7e0885a9320ade` |

## 冻结对象（在 LEGACY 检出内创建，只读语义）

LEGACY 检出：`D:\AgentDev\dsh-plugins\dsh-agent-team\references\deepseek-harness`（branch `feat/team-vnext-integration-20260829`）

### 1. Annotated tag

- **tag 名**: `legacy-agent-team-pre-vnext`
- **tag object SHA**: `276b3f8b8e4f03c8ebd70bf9d90cc7c7461e23b9`
- **tag 目标验证输出**（必须测试，2026-08-29 实测）:

  ```text
  $ git -C references\deepseek-harness rev-parse 'legacy-agent-team-pre-vnext^{commit}'
  a3ab31992762c5d6560797eabc7e0885a9320ade   # == LEGACY_SHA ✓
  ```

  本地 tag object 与远端一致（`ls-remote --tags origin` 返回同一 SHA `276b3f8b8e4f03c8ebd70bf9d90cc7c7461e23b9`）。

- **tag message**:

  ```text
  LEGACY_REFERENCE / NO NEW VNEXT DEVELOPMENT

  frozen checkpoint of feat/team-vnext-integration-20260829 (pre-vNext-refactor Team state), 2026-08-29.
  production authority = retired; historical/reference value = retained (behavioral reference / reusable pure implementation / regression fixture).
  No new vNext development on this branch; legacy Team Sessions are READ-ONLY.
  ```

### 2. 本地参考分支（不 push）

- **分支名**: `legacy/agent-team-integration-20260829`
- **指向**: `a3ab31992762c5d6560797eabc7e0885a9320ade`（`rev-parse 'legacy/agent-team-integration-20260829^{commit}'` 验证输出一致）

### 3. Tag push 状态

- **远端**: `git@github.com:ArmourPiercer1/deepseek-harness.git`（push 前 origin 为 `https://github.com/ArmourPiercer1/deepseek-harness.git`，按任务卡切换为 SSH 并设置 `core.sshCommand=C:/WINDOWS/System32/OpenSSH/ssh.exe`）
- **状态**: ✅ **成功（第 1 次尝试，无重试）**
- **输出**:

  ```text
  To github.com:ArmourPiercer1/deepseek-harness.git
   * [new tag]               legacy-agent-team-pre-vnext -> legacy-agent-team-pre-vnext
  ```

- **远端复核**: `git ls-remote --tags origin legacy-agent-team-pre-vnext` → `276b3f8b8e4f03c8ebd70bf9d90cc7c7461e23b9  refs/tags/legacy-agent-team-pre-vnext`

## 冻结语义

- **LEGACY_REFERENCE / NO NEW VNEXT DEVELOPMENT**
- production authority = **retired**（旧 Team 实现不再具有生产权威）
- historical/reference value = **retained**（行为参考 / 可复用纯实现 / 回归 fixture）
- 旧分支 `feat/team-vnext-integration-20260829` 及其参考分支 **禁止继续 vNext 开发、禁止重写历史**
- 旧 Team Sessions **READ-ONLY**

## 必须测试记录（2026-08-29 实测）

| # | 命令 | 期望 | 实际输出 | 结果 |
| --- | --- | --- | --- | --- |
| 1 | `git -C LEGACY rev-parse 'legacy-agent-team-pre-vnext^{commit}'` | == LEGACY_SHA | `a3ab31992762c5d6560797eabc7e0885a9320ade` | PASS |
| 2 | `git -C LEGACY rev-parse HEAD` | == LEGACY_SHA（HEAD 未动） | `a3ab31992762c5d6560797eabc7e0885a9320ade` | PASS |
| 3 | `git -C LEGACY status --porcelain` | 空（工作树未修改） | （空） | PASS |
| 4 | `git -C LEGACY log -1 --format='%H %s'` | 分支尖仍为原 commit | `a3ab31992762c5d6560797eabc7e0885a9320ade docs: router log round 7 — WAVE2 acceptance, S0 complete` | PASS |

前置校验（创建 tag 前）：`rev-parse HEAD` == LEGACY_SHA ✓；`status --porcelain` 空 ✓；`tag -l 'legacy-agent-team-pre-vnext'` 空 ✓。

## 未触碰项

- 未重写 legacy 历史、未删除分支、未修改 legacy 检出内任何工作树文件（legacy 检出内仅 git ref/config 操作：tag、branch、remote set-url、core.sshCommand）
- 未修改主 worktree 分支（NEW_REPO 主 worktree 仍为 `master` @ 5ecf11d）
- 未触碰其他任务的 `.worktrees/*`
