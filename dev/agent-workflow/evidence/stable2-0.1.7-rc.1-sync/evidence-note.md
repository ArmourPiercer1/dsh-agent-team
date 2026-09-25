# stable-2-0.1.7-rc.1 分支创建 + origin 同步 — 证据留痕

**日期**：2026-09-24（UTC+8）
**指令来源**：用户直接指令（会话 2026-09-24）：
> （1）创建一个新的 stable-2-0.1.7-rc.1 分支，在这个分支中保存 dsh 的 0.1.7-rc.1 版本源码；
> （2）将新的分支与 git 仓库状态推送到我的 github 对应仓库中（deepseek-harness）

**授权性质**：用户明确许可的一次性推送（AGENTS.md 红线「禁止 push（用户明确许可的一次性推送除外）」的例外条款）。

## 1. 目标仓库

`references/deepseek-harness/`（冻结 legacy fork 参考仓，只读纪律；本次操作 = 用户指令下的分支创建 + 推送，
不触碰冻结锚点）。origin = `https://github.com/ArmourPiercer1/deepseek-harness.git`（用户 GitHub）。

## 2. 操作前状态（before）

- 工作树 HEAD：`stable-1-0.1.5-rc.2` @ `fb2c4b9e69`（porcelain 空）
- 本地分支：`master` @ `0d1f50007f`（落后 origin/master）、`stable-1-0.1.5-rc.2` @ `fb2c4b9e69`
- origin 分支：`feat/agent-teams` @ 506191ba89 / `feat/team-vnext-integration-20260829` @ a3ab319927（冻结锚点）/
  `master` @ ddefc45fbc（fetch 后；fetch 前 = 0d1f50007f，用户侧在别处推进过）/ `original` @ dd6322d604 /
  `stable` @ a66e470204 / `stable-1-0.1.5-rc.2` @ fb2c4b9e69
- origin 标签：仅 `legacy-agent-team-pre-vnext`（276b3f8b8e，peel → a3ab319927；冻结锚点）
- 本地已有 19 个 `dsh-v*` upstream 官方 release tag（历史 fetch 带入，此前未推 origin）；本地**无** 0.1.7 系列对象

## 3. 0.1.7-rc.1 源码来源（provenance）

- upstream = `https://github.com/deepseek-ai/deepseek-harness.git`（TEST_METHODS.md §1 的 upstream 标识）
- `git ls-remote` 证实 upstream tag `dsh-v0.1.7-rc.1`（lightweight）→ commit `46a7f68b0922371ce7144b668b90e377d8e799f4`
- 一次性按 URL fetch（不新增持久 remote、不动 refs/tags 命名空间之外的既有 ref）：
  `git fetch https://github.com/deepseek-ai/deepseek-harness.git refs/tags/dsh-v0.1.7-rc.1:refs/upstream/dsh-v0.1.7-rc.1`
- 提交核验：`Merge pull request #5073 from deepseek-harness/rel/dsh-0.1.7-rc.1`（Turtle，2026-09-23 +0800）；
  树内版本字段核验：根 `package.json` 与 `apps/cli/package.json` 均 `"version": "0.1.7-rc.1"`
- fetch 附带 auto-follow 了 4 个新官方 tag 到本地：`dsh-v0.1.5-rc.3` / `dsh-v0.1.7-alpha.1` / `dsh-v0.1.7-alpha.2` / `dsh-v0.1.7-rc.1`

## 4. 本地 ref 变更（before → after，均可逆）

| ref | before | after | 性质 |
| --- | --- | --- | --- |
| `stable-2-0.1.7-rc.1`（新分支） | — | `46a7f68b0922371ce7144b668b90e377d8e799f4` | `git branch` 新建，指向 0.1.7-rc.1 官方 release 提交；**未 checkout**，工作树 HEAD 保持 `stable-1-0.1.5-rc.2` 不动 |
| `master`（本地） | `0d1f50007f` | `ddefc45fbc` | fast-forward 对齐 origin/master（`merge-base --is-ancestor` 预检 FF_OK）；非 checkout 分支，工作树零影响 |
| `refs/upstream/dsh-v0.1.7-rc.1` | （fetch 临时 ref） | 删除 | 与 auto-follow 产生的本地 tag `dsh-v0.1.7-rc.1` 同指 `46a7f68b09`，冗余移除（SHA 已记录于此，可重建） |
| 本地 tags `dsh-v*` ×4 新增 | — | 见 §3 | auto-follow，官方 provenance |

## 5. 推送（一次性授权）

命令：`git push origin stable-2-0.1.7-rc.1 'refs/tags/dsh-v*:refs/tags/dsh-v*'`（auth = `gh auth git-credential`）

推送清单（exit 0，全部 `[new branch]` / `[new tag]`，**零 force-push**）：

- 分支：`stable-2-0.1.7-rc.1` → `46a7f68b0922371ce7144b668b90e377d8e799f4`
- tags ×23：dsh-v0.1.0-rc.7 / dsh-v0.1.0-rc.8 / dsh-v0.1.1-rc.1 / dsh-v0.1.1-rc.2 /
  dsh-v0.1.2-alpha.1…5 / dsh-v0.1.2-rc.1 / dsh-v0.1.3-alpha.1 / dsh-v0.1.3-alpha.2 /
  dsh-v0.1.5-alpha.1 / dsh-v0.1.5-alpha.2 / dsh-v0.1.5-rc.1 / dsh-v0.1.5-rc.2 / dsh-v0.1.5-rc.3 /
  dsh-v0.1.6-alpha.1 / dsh-v0.1.6-alpha.2 / dsh-v0.1.7-alpha.1 / dsh-v0.1.7-alpha.2 / **dsh-v0.1.7-rc.1**
  （全部为 upstream `deepseek-ai/deepseek-harness` 官方 release tag；其中 19 个为本地既有、首次入 origin，
  4 个为本轮 fetch 带入；`dsh-v0.1.7-rc.1` 与新分支同指 `46a7f68b09`）

注：`master` 未推送（本地 push 前已落后 origin，fetch 后对齐，无新增内容）；
冻结锚点 ref 零触碰。

## 6. 终验（ls-remote 远端复核，推送后）

1. `origin/stable-2-0.1.7-rc.1` = `46a7f68b0922371ce7144b668b90e377d8e799f4` ✅（= upstream dsh-v0.1.7-rc.1 peel）
2. `origin/master` = `ddefc45fbc`、`origin/stable-1-0.1.5-rc.2` = `fb2c4b9e69` — 未被本次操作改动 ✅
3. origin 全部 23 个 `dsh-v*` tag 与本地逐一 diff 一致（唯一差异行 = 本地比较面未含的
   `legacy-agent-team-pre-vnext`，属预期）✅
4. 冻结锚点未移动（ls-remote 双证）：
   - `origin/feat/team-vnext-integration-20260829` = `a3ab31992762c5d6560797eabc7e0885a9320ade` ✅
   - `origin` tag `legacy-agent-team-pre-vnext` = `276b3f8b8e`（peel → `a3ab319927...`）✅
5. 工作树状态不变：HEAD = `stable-1-0.1.5-rc.2` @ `fb2c4b9e69`，`git status --porcelain` 空 ✅

## 7. 红线核对

- CORE PATCH BUDGET = 0：未修改任何 upstream 源码；新分支内容 = upstream 0.1.7-rc.1 官方 release 提交原样 ✅
- 冻结锚点（`feat/team-vnext-integration-20260829` + `legacy-agent-team-pre-vnext`）未移动 ✅
- 无 force-push；无 gated 历史改写 ✅
- 测试运行时（`tests/deepseek-harness-test-use` @ fb2c4b9e69 detached）零触碰；:3080/:3180 零触碰 ✅
- 分支策略符合：`stable-2-0.1.7-rc.1` 仅跟踪 upstream 已官方发布的 RC 基线（同 `stable-1-0.1.5-rc.2` 先例），
  不含任何未经裁决的 master alpha 提交 ✅

## 8. 可逆性

- 删除新分支/标签即可完全回退（本地 `git branch -D stable-2-0.1.7-rc.1` + `git tag -d dsh-v*`；
  origin 侧 GitHub 删除对应 ref）；本地 `master` 回退 = `git branch -f master 0d1f50007f`（SHA 已记录）。
- 本仓（dsh-agent-team）自身：本证据目录 + SESSION_ROUTER_LOG 追加条目 + AGENTS.md references 行同步注记
  （纯文档，随下次常规提交入库）。
