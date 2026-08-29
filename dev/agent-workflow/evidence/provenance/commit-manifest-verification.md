# P0-T2 提交溯源清单 — 抽样验证记录

- 验证日期：2026-08-29
- 验证对象：`dev/agent-workflow/evidence/provenance/commit-manifest.json`（39 条 ahead commits，基线 `UPSTREAM_SHA cd5ef814…..LEGACY_SHA a3ab3199…`）
- 验证方法：对 6 个覆盖全部 5 种分类的样本 commit，在 LEGACY 仓库执行字面命令 `git -C D:\AgentDev\dsh-plugins\dsh-agent-team\references\deepseek-harness show --stat <sha>`（只读；legacy checkout 保持干净），将实际文件集与清单 rationale 比对，记录命令、观察与判定。

## 方法论备注

1. **每 commit 的文件集定义**：`git show --stat <sha>` 的内容（等价于相对第一父的 diff；对 merge commit 即该 merge 带入分支的内容；空 merge `88cd0972` 为 0 文件）。
2. **重命名检测**：使用 git 默认重命名检测（与任务字面命令一致）。`a340d07a` 在默认检测下为 **3235** 个文件，与 `git show --stat` 汇总行一致（`-M100%` 会给出 3254，`--no-renames` 给出 3259，均不采用）。
3. **大 commit 计数**：对 `a340d07a` 以字面 stat 汇总行为权威计数（3235）；Team 路径文件数（13）另以 `git diff <sha>^ <sha> --name-only`（默认重命名检测）过滤确认。

## 样本 1 — `ec7286d5`（TEAM_OWNED）

- 清单条目：2026-08-25 `feat(ui-team): persistent team dock and per-event inline markers replacing the whole-card panel (P5)`
- 命令：`git -C D:\AgentDev\dsh-plugins\dsh-agent-team\references\deepseek-harness show --stat ec7286d5`
- 观察：24 个文件，全部位于 `packages/client/ui-team/**`；含 `TeamDock.tsx`（+211）、`TeamMarker.tsx`（+183）、旧整卡面板 `TeamPanel*` 移除、dock/marker 测试与 spec。汇总行：`24 files changed, 2589 insertions(+), 1159 deletions(-)`。
- 判定：与清单一致 —— 文件集 100% 落在 Team 路径（`packages/client/ui-team/**`），无通用/无关路径混入，`TEAM_OWNED` 成立。

## 样本 2 — `31196dae`（MIXED）

- 清单条目：2026-08-20 `feat(team-runtime): enforce permission at teammate executor boundary`
- 命令：`git -C D:\AgentDev\dsh-plugins\dsh-agent-team\references\deepseek-harness show --stat 31196dae`
- 观察：38 个文件，同时落在两类路径：
  - Team 路径（`packages/team/**`）：`member-setup.spec.ts`（+147）、`permission-enforcement.loader-composition.spec.ts`（+642）、`team-local`/`team-runtime` README 等；
  - 非 Team 路径：`packages/permission/**`（engine 与 tool-permission-guard 的 README）、`.agents/notes`、`docs/cookbook/adding-agent-team` ×3。
  - 汇总行：`38 files changed, 1950 insertions(+), 274 deletions(-)`。
- 判定：与清单一致 —— 同一 commit 同时修改 Team 专属内容（team-runtime 权限强制执行的规格/文档）与通用能力路径（permission 包 README 等），`MIXED` 成立。

## 样本 3 — `113d724a`（GENERIC_FORK_CAPABILITY）

- 清单条目：2026-08-20 `feat(permission): resolve tool-permission-guard permission per call and add composition tests`
- 命令：`git -C D:\AgentDev\dsh-plugins\dsh-agent-team\references\deepseek-harness show --stat 113d724a`
- 观察：17 个文件 = 3 个 `.agents/notes`（tool-permission-guard-resolves-permission-per-call 系列）+ 14 个 `packages/permission/**`（permission 与 tool-permission-guard 的 src/tests/README/package.json）。**无任何 Team 路径文件**。汇总行：`17 files changed, 936 insertions(+), 54 deletions(-)`。
- 判定：与清单一致 —— 虽由 Team 需求（teammate 执行器逐次解析权限）驱动，但按路径规则改动全部落在通用权限包，不新增/修改 Team 专属代码路径，`GENERIC_FORK_CAPABILITY` 成立。

## 样本 4 — `8faf33f7`（GENERATED_FROM_TEAM）

- 清单条目：2026-08-19 `docs: regenerate catalogs after the upstream merge and sync the Chinese counterparts`
- 命令：`git -C D:\AgentDev\dsh-plugins\dsh-agent-team\references\deepseek-harness show --stat 8faf33f7`
- 观察：9 个文件，全部为生成型文档 catalog（`config-catalog` / `event-producer-consumer` / `tool-catalog`，各 3 语言版本）；改动均为 ±14 行的机械重生成。汇总行：`9 files changed, 14 insertions(+), 14 deletions(-)`。
- 判定：与清单一致 —— 无手写源码改动；catalog 在上游 merge（含 Team 工具/配置注册）之后重新生成，内容由（合并后的）Team + upstream 源派生，按任务映射归 `GENERATED_FROM_TEAM` 成立。

## 样本 5 — `bc97f43c`（UNRELATED_FORK_FEATURE）

- 清单条目：2026-08-14 `feat(web): group custom-provider model picker by family with select-all`
- 命令：`git -C D:\AgentDev\dsh-plugins\dsh-agent-team\references\deepseek-harness show --stat bc97f43c`
- 观察：14 个文件 = 3 个 `.agents/notes`（model-picker-family-grouping）+ `apps/web/tests/models-settings.e2e.ts`（+92）+ fetch-grouped 快照 + `packages/client/ui-settings-models/**`（`modelGrouping.ts` +97、`ModelListEditor.tsx`、配套测试）。**无任何 Team 路径文件**。汇总行：`14 files changed, 562 insertions(+), 24 deletions(-)`。
- 判定：与清单一致 —— 纯 fork 用户功能（模型选择器按 family 分组 + 全选），与 Team 无交集，`UNRELATED_FORK_FEATURE` 成立。

## 样本 6 — `a340d07a`（MIXED）

- 清单条目：2026-08-23 `Merge master (b150a551b8) into feat/agent-teams`（单父 squash，唯一父 = `ddff02c4`）
- 命令：`git -C D:\AgentDev\dsh-plugins\dsh-agent-team\references\deepseek-harness show --stat a340d07a`
- 观察：
  - 汇总行（权威计数，默认重命名检测）：`3235 files changed, 82384 insertions(+), 20697 deletions(-)`；
  - stat 输出中可见 Team 路径行，例如：`dsh-teammate-cli` 笔记 ×2、`team-agent-keyless-e2e-snapshot` 笔记 ×2、`packages/client/ui-team/tests/team-panel.client.spec.tsx`、`packages/team/team-local/README.{i18n,zh}.md`、`packages/team/team-runtime/src/approval-setup.ts`、`packages/team/tool-team/src/tool-send-message.ts` 及其 spec；
  - 以 `git diff a340d07a^ a340d07a --name-only`（默认重命名检测）过滤 Team 路径前缀，得 **13** 个 Team 路径文件，其余 **3222** 个为 upstream master（b150a551 树）内容。
- 判定：与清单一致 —— 同一 commit 同时携带大批 upstream 内容与 13 个 Team 路径文件的修改，`MIXED` 成立；清单 rationale 中 3235/3222/13 三个数字均与实测吻合（已修正早期草稿的 3254/3241，那是 `-M100%` 阈值下的计数）。

## 结论

6 个样本（覆盖 TEAM_OWNED / MIXED / GENERIC_FORK_CAPABILITY / GENERATED_FROM_TEAM / UNRELATED_FORK_FEATURE 全部 5 类）的字面 `git show --stat` 实测文件集与 `commit-manifest.json` 各条 rationale 完全一致，分类判定可复核。
