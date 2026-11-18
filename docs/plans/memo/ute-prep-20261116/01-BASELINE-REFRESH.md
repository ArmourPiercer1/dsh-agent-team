# 01 — 宿主基线刷新：一个固定 tag+commit，第二棵并存树

**[updated 2026-11-16 UTE-Prep]** 本文件替换 #765 的"技术基线"意图（rc.3、并允许"实施时重新确认"）为**规则**。它只处理基线，不重开架构裁决。

## 1. 钉住的基线（我复验过，两次独立通路）

| 项 | 值 |
|---|---|
| Tag | `dsh-v0.2.2-rc.5` |
| Peeled commit | `9c2670d3bce5275e0d1610272958121af87787bb` |
| Tag 类型 | **lightweight**（`git ls-remote` 无 `^{}` 剥离行；`gh api .../git/matching-refs/tags/dsh-v0.2.2` 对 rc.5 返回 `"object":{"type":"commit"}`） |
| 原基线（被替换） | `dsh-v0.2.2-rc.3` = `38a6a5c965aa99ab525161efb7cc5cf1fe62fced` |
| Team 文档基线 | `origin/master@b7276ffa7bd8b040402460d2772c62576d08da5b` |
| 当前产品实际宿主（**不动**） | DSH `0.2.0-rc.2` = `639ed015397290b3745d163aafe02ffee4aa3f84`（`tests/paths.mjs:70-72`） |

**验证命令与输出**（原文，未改写）：

```
$ git ls-remote --tags https://github.com/deepseek-ai/deepseek-harness 'dsh-v0.2.2*'
f3803c96974ad4a94195fb97e5c637e9c2a3afe3	refs/tags/dsh-v0.2.2-alpha.2
05b1cae8db6e674c5685101494d4eec24652424a	refs/tags/dsh-v0.2.2-alpha.3
66491b05e3f05ad35bcdd4f6cd7ed26041d9e3db	refs/tags/dsh-v0.2.2-rc.1
ddac96760b6edf8fa0fe17cbdcf0b512f4c12b2c	refs/tags/dsh-v0.2.2-rc.2
38a6a5c965aa99ab525161efb7cc5cf1fe62fced	refs/tags/dsh-v0.2.2-rc.3
3f321d32bfe382212a8ed8785c1d47a5a300aa23	refs/tags/dsh-v0.2.2-rc.4
9c2670d3bce5275e0d1610272958121af87787bb	refs/tags/dsh-v0.2.2-rc.5

$ gh api repos/deepseek-ai/deepseek-harness/git/matching-refs/tags/dsh-v0.2.2 --jq '.[] | "\(.ref) \(.object.sha) \(.object.type)"'
refs/tags/dsh-v0.2.2-alpha.2 f3803c96… commit
… refs/tags/dsh-v0.2.2-rc.3 38a6a5c9… commit
refs/tags/dsh-v0.2.2-rc.5 9c2670d3… commit
```

**为什么必须对上游核**：`git ls-remote --tags origin`（本仓 `ArmourPiercer1/dsh-agent-team`）返回 9 个 tag，**没有任何 `dsh-v*`**。所以"本仓能证明这个 pin"是假的；基线核对只能引用上游 tag 或上游 API。AGENTS.md §`references/` 里"23 个官方 `dsh-v*` tag 已推送 origin"是历史记录，不能当作今日可核验事实——本 memo 只写我复验过的通路。

**结论**：评估给的 `dsh-v0.2.2-rc.5 = 9c2670d3…` **成立**，无需发明 pin。后续所有 rc.5 引用一律写 `dsh-v0.2.2-rc.5@9c2670d3bce5275e0d1610272958121af87787bb`，不写 `rc.5` 裸版本号、不写分支名。

## 2. 规则：一个宿主代 = 一个固定 tag+commit（可执行条文）

**H-1 固定性。** 每个宿主代际在 `tests/paths.mjs` 里登记为**两个名字 + 三个字面量**：`<GENERATION>_REL`（树路径）、`<GENERATION>_VERSION`（tag 去掉 `dsh-v` 前缀后的版本串）、`<GENERATION>_SHA`（40-hex commit）。禁 `latest`、禁 range、禁 `~`/`^`、禁浮动分支、禁"实施时再确认"。当前已登记：`TEST_USE_REL` / `DSH_BASELINE_VERSION='0.2.0-rc.2'` / `TEST_USE_BASELINE_SHA='639ed015…'`。rc.5 一代在 G0-S1 里以同样三个符号加入（见 [04](./04-FIRST-SLICES-G0-G1.md)），**不得**在测试/kit 里硬编码 40-hex 或版本串（`tests/paths.mjs` 是唯一来源，这条纪律 `docs/TEST_METHODS.md` §4.2 已有）。

**H-2 冻结性。** 已登记的 `(VERSION, SHA)` 对**只增不改**。任何一次"换 pin"都是一个具名裁决 + 一个独立 commit，且必须同时更新：`tests/paths.mjs`、`docs/TEST_METHODS.md` §6 的基线表、以及所有 pin 断言（`scripts/census-plan.test.mjs` 一类）。**替换**一个代际的 pin（不是新增）属于退役动作，按 [05](./05-SCOPE-FENCE.md) §3 的退役顺序执行。

**H-3 第二棵树，不是原地升级。** rc.5 必须是一棵**与 legacy 并存的第二棵 pinned 树**：

| 维度 | legacy 代（现在） | rc.5 代（新增） | 强制规则 |
|---|---|---|---|
| checkout 路径 | `tests/deepseek-harness-test-use` | `tests/deepseek-harness-test-use-rc5`（gitignored，自身 git 仓，detached @ pin） | 两个 realpath 必须不同；**禁止** `git checkout` 迁就：同一棵树里切 tag = 一次 pin 覆盖 + legacy 世界全部失效 |
| DSH_HOME 根 | `tests/homes/` | `tests/homes-rc5/`（或 `tests/homes/<world>-rc5`，二选一由 G0-S1 定死并写进 `paths.mjs`） | 一个 World 只归属一个代际；禁跨代复用同一 home 目录（home 里含 launch token、session log、profile bundle，跨代读 = 未验证的 schema 假设） |
| 端口族 | `HOST_PORT_BANDS` = [3181–3199] → [13000–13049]（legacy 会溢出到第二段） | **代际分带**：legacy host 3181–3199 / legacy mock 3491–3500；rc.5 host 13000–13049 / rc.5 mock 13050–13099 | band 在 `paths.mjs` 里**按代际分区**，不在启动脚本里手写 `--port`。共存期间必须把 legacy 的租用限制在 3181–3199（今天它会溢出到 13000–13049，直接与 rc.5 撞），这是一次显式裁决 + G0-S1 的代码改动，不是“顺手改个常量” |
| world 命名 | `<world>` | `<world>-rc5` 前缀/后缀 | 世界名跨代重复 = 证据归属歧义，一律拒绝 |
| 可变世界状态 | `tests/homes/<world>/**`、mock provider（3491–3500 / 13050–13099） | 全代际私有 | **零共享可变状态**：不共享 home、不共享 mock 端口、不共享工作区目录、不共享正在运行的 host 进程 |
| 证据目录 | `dev/agent-workflow/evidence/**` | 新目录 | 一代一盘；`RUN-SUMMARY` 必须带 host tag+commit，否则不计入该代证据 |

**H-4 只读共享 baseline 的例外写死。** `docs/TEST_METHODS.md` §6 现在只允许一个本仓之外的源树根：`/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness`。rc.5 若沿用同一模式（只读共享 baseline + 各 worktree `clone --local --no-hardlinks`），必须**在 `paths.mjs` 与 `TEST_METHODS.md` 里并列登记第二个根**，并保持"共享 baseline 从不被写入、porcelain 必须为空"。不给"顺手从 /srv 里另一棵树拿"留口子：未登记的源树 = `SOURCE_TREE_OUTSIDE_ALLOWED_ROOTS`。

**H-5 宿主 pin 与资产 pin 是两个 pin。** 这条不是风格问题，是当前事实：

- 沙箱原生资产来自固定发布包 `@deepseek-ai/node-addon-system-linux-x64@0.1.2`（tarball 25758 B，sha256 `77fb771bee2133c3ffd1f96c7b9435ddb1ccaee72b6814f6f4391343a611cc20`，逐文件 sha256 校验，安装 mode `0o755` 取自 manifest 而非归档的 `0o644`，receipt schema `u7-sbx-host-asset-receipt/1`）。
- 我实测 npm registry：该包**只有一个版本 `0.1.2`**（`versions: ['0.1.2']`，`dist-tags.latest=0.1.2`）。
- ⇒ "每个 DSH 发布都有配套发布资产包"**当前不成立**。rc.5 宿主今天**不存在**与之匹配的资产包。
- ⇒ 规则：**宿主升级必须显式重建或显式记录资产 pin 的分歧，之后其安全链才允许跑**。机器规则已经存在，不要发明第二套：`tests/world-factory/lib/host-sandbox-assets.mjs` 的 `PACKAGE_PIN_DIVERGES_FROM_HOST_PIN`（L780/898/901）要求 `packages` 块与 `entries` 块深度相等——发布包**传输**已提交的标准，不能定义第二个标准。因此 rc.5 的正确动作是：`entries` 继续 pin 那组字节，`packages` 继续指向 `0.1.2`，并在 G0-S2 的 RUN record 里**记录**"资产 pin 与宿主 pin 不同代"，而不是改 sha 去凑 rc.5 的构建产物、也不是把 `0.1.2` 说成 rc.5 的配套包。

## 3. 为什么是"共存"而不是"升级"

`tests/deepseek-harness-test-use` 同时是：(a) 唯一允许的运行时源码；(b) 现有 24 任务 / 12 roots / 712 文件 census 与 48 未收编套件的实际执行树；(c) v0.1.6 受限试用版的验收对象。原地换 tag 会一次性作废 (b) 与 (c) 的全部缓存与证据归属，并且违反"影响面必须可逆"。共存让 legacy 的回归基线在 rc.5 工作期间**保持可运行**——这正是 [05](./05-SCOPE-FENCE.md) 要求的"旧路径可运行回归基线"。

**可逆性**：删除 `tests/deepseek-harness-test-use-rc5/` 与 `tests/homes-rc5/`、回退 `paths.mjs` 的两处新增（三个符号 + 一个 port band），即回到今天的单一基线状态。`git status --porcelain` 不应因此变化（两棵树与 home 均 gitignored）。

## 4. 未决 / 本文件不声称的事

- **UNKNOWN**：我没有在 rc.5 上启动过任何 host；本文件只证明 tag/commit 存在且可解析，不证明它在 workspace-write 沙箱内能构建或启动（`docs/TEST_METHODS.md` §2/§5 的启动链是 0.2.0-rc.2 实测，不能外推）。
- **UNKNOWN**：rc.5 与本仓现有 48 个未收编套件 / 712 文件 census 的兼容性未测（census 是 legacy 树的属性，不是 rc.5 的）。
- **UNKNOWN**：`dsh-v0.2.2-rc.5` 是否会被后续 rc 取代、以及 owner 是否希望在 G0 冻结前改用更新的发布点——本 memo 按任务给的 rc.5 钉死，若 owner 改判，按 H-2 走一次具名换 pin 裁决，不改本文件的规则。

---

**文档导航**：[本目录索引](./README.md) · [01 基线刷新](./01-BASELINE-REFRESH.md) · [02 接口差量](./02-INTERFACE-DELTA-RC3-RC5.md) · [03 三条裁决](./03-RULINGS-AUTHORITY-BINDING-SETTLEMENT.md) · [04 首批纵切](./04-FIRST-SLICES-G0-G1.md) · [05 范围围栏](./05-SCOPE-FENCE.md) · [06 待主 Agent 执行的补丁](./06-PROPOSED-ACTIVE-PLAN-PATCH.md)
