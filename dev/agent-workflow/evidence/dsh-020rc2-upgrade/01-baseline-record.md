# U0 — baseline / 环境 / 落位记录（2026-10-03）

命令均为只读或仅作用于本 worktree；旧根工作树未被触碰（收尾复核见 §6）。

## 1. 远端与 base

| 项 | 值 | 核验方式 |
| --- | --- | --- |
| plugin origin | `https://github.com/armourpiercer1/dsh-agent-team.git` | `git remote -v` |
| 远端 master（fetch 前 ls-remote） | `6b2f401bbc2f82e1eb3e561f71069d5aad2350fc` | `git ls-remote origin refs/heads/master` |
| `git fetch --prune origin` | EXIT=0 | — |
| `refs/remotes/origin/master`（fetch 后） | `6b2f401bbc2f82e1eb3e561f71069d5aad2350fc`（与用户给定 fresh master 逐字一致） | `git show-ref` |
| `refs/remotes/origin/stable` | `b0e5aeb482e27242d523b85129a899dc322d1154`（本轮不动） | `git show-ref` |

旧根（**保持原样，本轮零编辑**）：`/srv/workspace/dsh-plugins/dsh-agent-team` @ `6259cf4bc4d61af74d84bbd9d265184f95493172`（= 用户所述旧 master），`git worktree list` = 27 条目（26 个既有任务 worktree + 主检出），dirty = **15 → 14 行**（见 §6）。

## 2. 新 worktree / branch（本轮唯一写入位置）

| 项 | 值 |
| --- | --- |
| 路径 | `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade` |
| branch | `task/dsh-020rc2-upgrade-20261003`（新建，无同名 branch/worktree 冲突；命名前缀 `task/` 沿 ROUTER_RULES §8.3） |
| base == head（起点） | `6b2f401bbc2f82e1eb3e561f71069d5aad2350fc`（= 核验后的 `origin/master`，`git worktree add` 显式指定该 SHA） |
| 起点 `git status --porcelain` | 空 |

命令：`git worktree add -b task/dsh-020rc2-upgrade-20261003 .worktrees/dsh-020rc2-upgrade 6b2f401b…` → EXIT=0。

## 3. 共享新 baseline（只读）

`/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness`

- branch `stable-3-0.2.0-rc.2`，HEAD `639ed015397290b3745d163aafe02ffee4aa3f84`，`git status --porcelain` 行数 = **0**，根 `package.json` version = `0.2.0-rc.2`；
- origin `https://github.com/ArmourPiercer1/deepseek-harness.git`；
- 远端同名分支独立复核：`git ls-remote origin refs/heads/stable-3-0.2.0-rc.2` → `639ed015397290b3745d163aafe02ffee4aa3f84`（与用户所述一致）；
- 该分支 tip 的提交链含 `c1b47e41fc release(dsh): 0.2.0-rc.2` + `639ed01539 Merge pull request #5479 … release-dsh-0.2.0-rc.2`；
- **注记（代差）**：fork 内 **无** `dsh-v0.2.0-rc.2` tag 对象（`git tag --list 'dsh-v*'` = 22 个，最新 `dsh-v0.1.7-rc.1`）→ 0.2.0-rc.2 的锚点 = 分支名 + 完整 SHA，不是 tag；
- 无 node_modules / 无 lib 构建产物 → 本 agent 全程只读该路径（clone 源），从不写、不在其中 build。
- 旧 baseline（历史，仅上下文）：`46a7f68b0922371ce7144b668b90e377d8e799f4`（0.1.7-rc.1）。

## 4. 本 worktree 内 pristine 0.2.0-rc.2 test-use checkout（唯一运行时源）

| 项 | 值 |
| --- | --- |
| path | `.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use`（canonical 位置；`TEST_USE_REL` 不变；gitignored） |
| 建立方式 | `git clone --local --no-hardlinks /srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness tests/deepseek-harness-test-use`（EXIT=0；`--no-hardlinks` 因跨设备链接被拒 → 完整对象副本）+ `git checkout --detach 639ed015397290b3745d163aafe02ffee4aa3f84` |
| HEAD | `639ed015397290b3745d163aafe02ffee4aa3f84`（detached） |
| branch | `HEAD`（detached @ baseline，与 TEST_METHODS §1 一致） |
| remotes | `origin` = `https://github.com/ArmourPiercer1/deepseek-harness.git`（canonical 远端，逐字核验过同名分支）；`baseline-local` = `/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness`（对象来源，离线可复现） |
| clean | `git status --porcelain` 行数 = **0**（clone+checkout+install 之后复核） |
| version | 根 `package.json` = `0.2.0-rc.2` |
| install | `pnpm install --ignore-scripts --frozen-lockfile --store-dir <repo-local .pnpm-store>` → **EXIT=0**（logs `testuse-020rc2-install.log`；`Lockfile is up to date` = 零 lockfile 改写；supply-chain policy 1685 entries 通过；node_modules 1.9G；3 条 `Failed to create bin … apps/cli/lib/bin.js` WARN = 构建前该文件尚不存在的预期现象） |

## 5. 环境 / 资源

- node `v24.21.0`，pnpm `11.7.0`（`packageManager` 一致），git `2.43.0`；
- CPU 6 核，mem 11G（可用 ~10G），磁盘可用 70G；
- pnpm store = `/srv/workspace/dsh-plugins/dsh-agent-team/.pnpm-store/v11`（工作区内，warm：test-use install `reused 1355 / downloaded 26`）；
- npm registry 可达且 `@deepseek-ai/dsh@0.2.0-rc.2` **已发布**（`npm view … version` → `0.2.0-rc.2`）；`@deepseek-ai/cordis` 0.2 宿主自用版本 = **4.0.4**（与插件现值相同，见 §7）；
- 稳定实例 :3080 未探测未触碰（除本条记录外无任何操作）；测试端口计划 = 3180 族内选空闲口（本轮记录于 U6）；
- npm cache 默认位置只读 → 需要 npm 时以工作区内 cache 覆写（一次性 `npm view` 用的临时目录已删除，见 §6）。

## 6. 冻结锚点 / 旧根状态复核

- `references/deepseek-harness`（冻结 legacy fork 参考）**在本环境不存在**（`references/` 为 gitignored，环境迁移时未随 clone 迁移；STATUS 2026-10-01 行已登记该缺口）→ 本轮无法本地复核，改以远端复核：
  - `refs/heads/feat/team-vnext-integration-20260829` = `a3ab31992762c5d6560797eabc7e0885a9320ade`（= AGENTS.md 冻结锚点，**未移动**）；
  - `refs/tags/legacy-agent-team-pre-vnext` → peel `a3ab31992762c5d6560797eabc7e0885a9320ade`（**未移动**）；
  - 来源 = `https://github.com/ArmourPiercer1/deepseek-harness.git`（`git ls-remote`，只读）。
- 旧根 dirty 复核：本轮开始时 `git status --porcelain` = 14 行；中途一次 `npm view` 需要可写 cache，曾在工作区根临时创建 `.tmp-npm-cache/`（第 15 行）→ 该目录已删除（内含的 0.2 发布集清单移入本 evidence 目录），复核 = **回到逐字相同的 14 行**（1 modified `SESSION_ROUTER_LOG.md` + 13 untracked 证据条目）。旧根未发生 stash / reset / clean / checkout / 文件编辑。

## 7. 0.2 依赖面核验（U2 输入）

- `pnpm-lock.yaml` 重生成后：`@deepseek-ai/dsh*` 解析到 **0.2.0-rc.2 共 281 个包**，**0 个**残留 0.1.7-rc.1；
- cordis 系在 0.2 宿主树内自用版本 = `@deepseek-ai/cordis@4.0.4`、`cordis-plugin-group@1.0.4`、`cordis-plugin-include@1.0.9`、`cordis-plugin-loader@1.0.5` → 与插件现 devDeps **逐字相同**，本轮不动（无版本漂移即无适配）；
- `minimumReleaseAgeExclude` 由 lock 派生 281 条（含 `@deepseek-ai/dsh` 本体），替换旧 hand-curated 80 条子集；派生方法写入 yaml 注释；
- 0.2 树内 `@deepseek-ai/dsh*` 已发布包 = 318 个（`upstream-020rc2-published-from-baseline.txt`，从共享 baseline 的 package.json 集合派生）——lock 的 281 为其解析子集。
