# Git 分支与发布管理

## 当前策略：首个正式 release 之前

| 分支 / ref | 用途 | 允许进入的内容 |
| --- | --- | --- |
| `master` | Alpha 开发线 | 下一 alpha 的持续开发与已通过阶段 Gate 的集成结果 |
| `stable` | RC 稳定线 | 已经由用户/发布 Gate 裁决发布的 RC 基线，以及从独立 task/int 分支验收通过的 RC 修复 |
| `task/*` | 单任务开发线 | 一个任务、一个 worktree、一个 writer |
| `int/*` | 阶段或修复集成线 | 经 task review 后使用 `cherry-pick -x` 集成的候选变更 |
| 版本 tag | 不可移动的发布快照 | 与发布版本同名，如 `0.1.0-rc.1` |

### 推进规则

1. Alpha 功能从 `task/*` 经 review 进入对应 `int/*`，通过 Gate 后进入 `master`。
2. `stable` 不跟随 `master` 自动前进。未经 RC 裁决的 alpha 提交不得直接合入 `stable`。
3. RC 修复从当前 stable 基线切出独立 `task/*` / `int/*`，通过相应测试和 Gate 后再进入 `stable`。
4. 每个 RC 发布提交创建 annotated tag；tag 和 gated history 禁止 force-push 或移动。
5. 远端 push 仍需用户明确授权，并在执行日志中记录 ref、SHA 与 `git ls-remote` 核验结果。
6. 首个正式 release 发布后，本策略不自动延续；届时必须通过新的发布决策定义长期支持分支、版本维护窗口与回合并策略。

## 当前基线

- RC 稳定基线：`0.1.0-rc.1`
- `stable`：指向最新已裁决 RC
- `master`：从 RC 基线继续推进下一 alpha；当前计划目标为 `0.1.1-alpha.1`
