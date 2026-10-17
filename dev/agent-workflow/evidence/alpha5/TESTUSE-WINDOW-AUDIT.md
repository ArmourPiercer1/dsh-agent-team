# TESTUSE-WINDOW-AUDIT — 共享 test-use 检出在 2026-10-17 04:30–05:30Z 窗内的宿主身份重建

- 轮次 = `alpha5-testuse-audit`；reviewer = qwen3.8-flash-next（独立身份审计，只读 + 本文件）；branch `alpha5-testuse-audit` @ base `origin/master 148c3f49`（fetch 亲验）。
- 触发事实 = C-12 L1-PoC 在册披露（`evidence/alpha5/c12-l1/README.md:37`，branch `alpha5-c12-l1-poc`）：共享 `tests/deepseek-harness-test-use` 曾被其 session 临时 detach 至 master pin `639ed01539`，后"复原至发现状态 **46a7f68b09**、porcelain 0"。发现态与 **IF-4 pin（`639ed01539`，`evidence/alpha5/w4/run-w4.mjs:7`、`wiring/w5/README.md:4`、`wiring/we2/README.md:4`；canonical 常量 = `tests/paths.mjs` `TEST_USE_BASELINE_SHA = 639ed015397290b3745d163aafe02ffee4aa3f84`，`tests/paths.mjs:69`）**表面矛盾。
- 方法 = 只读：各在册分支 `evidence/*/runs/*` + README 的 host HEAD/porcelain 自证行（时间戳 04:30–05:30Z 窗内）＋ 全部 test-use 检出的 `git reflog`（只读，零写入共享树；共享检出本体未被本审计触碰）。
- 本文件不改任何既有 run 结果；③ 只列清单。

## 1. 结论速览

1. **矛盾消解：两者皆真，但说的不是同一棵树。** 根共享检出 `tests/deepseek-harness-test-use` 自 2026-10-01 05:29:05Z 重新 clone 起**从未**位于 IF-4 pin（reflog 全量 3 条，见 §2）；alpha.5 各轮实际使用的 "IF-4 pinned host" 是升级轮独立树 `.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use`（@`639ed01539` 自 2026-10-03 13:53Z）及其克隆/rsync/symlink 衍生物。**L1 的"复原至 46a7f68b09"是对发现态的正确复原**，不构成对任何窗内 run 的污染。
2. **窗内共享树身份轨迹（reflog 直证）：46a7f68b09（04:30→05:02:31Z）→ 639ed01539（05:02:31→05:03:40Z，共 69 s，唯一操作者 = L1-PoC session）→ 46a7f68b09（05:03:40Z→今，porcelain 0）。** 窗内无任何其他 actor 移动过共享树；窗内无任何 LIVE run 以共享根树为宿主（每个 LIVE run 的自证行都指向独立树，见 §4）。
3. **零已知污染，但有一处窗内 run 的主张未自证**（ptc-chain 05:08:09 canonical 轮，§5-T1），另有 3 处窗内 run 无内嵌 host-HEAD 自证但经核为 host-independent 或同 session 覆盖（§5-T2..T4，note 级）。
4. **文档根因两处**：`SESSION_ROUTER_LOG.md:5138`（升级轮追溯补记）称 `tests/deepseek-harness-test-use` "已 detached @639ed01539" —— 与本宿主共享检出的 reflog 不符（该条描述的是升级轮"另一执行环境"的树，导入时未加宿主限定语）；`evidence/alpha5/pr4/review-LaneC.md:42`（10-16）已把共享树的 `46a7f68b09` 当"基线未动"引用 —— 错认基线在窗内之前已有实例。§6 给出衔接 IF-4 的新规 IF-4a。

## 2. 共享检出的真实身份轨迹（只读 reflog 直证）

`tests/deepseek-harness-test-use/.git` HEAD reflog（审计现场 `git reflog --date=iso-local` 原样，2026-10-17 之后全量、无缺口）：

```text
46a7f68b09 HEAD@{2026-10-17 05:03:40 +0000}: checkout: moving from 639ed01539… to 46a7f68b09…   ← L1-PoC 复原（README:37 所称"复原"）
639ed01539 HEAD@{2026-10-17 05:02:31 +0000}: checkout: moving from 46a7f68b09… to 639ed01539…   ← L1-PoC 临时 detach（README:37 所称"临时 detach"）
46a7f68b09 HEAD@{2026-10-01 05:29:05 +0000}: clone: from https://github.com/deepseek-ai/deepseek-harness.git
```

- 现状（只读复核）：detached @ `46a7f68b09`，`git status --porcelain` = 空；`.git/HEAD` mtime = 2026-10-17 05:03:40Z，与 reflog 终点一致。
- 推论（判决性）：**10-01 re-clone 至 10-17 05:02:31Z 之间共享树没有任何身份事件** → 窗前（10-01→04:30）它也是 `46a7f68b09`；`SESSION_ROUTER_LOG.md:5138` 的"已 detached @639ed01539"不可能指本宿主这棵树（它属于升级轮"另一执行环境"的补记，§1-4）。
- detach 期间（69 s）构建尝试因 pnpm store 在沙箱外失败（`ERR_SQLITE_ERROR`），reflog 无 commit/branch 事件、现 porcelain 0 —— 与 L1 披露"未成任何写入"一致；但注意 checkout 本身两次重排了工作树内容（0.2 内容 → 0.1.7 内容），该窗内若有并发读者会看到瞬时 0.2 身份 —— §4 显示窗内并发读者集 = ∅。

## 3. 时间线（谁在何时读到哪个 HEAD；file:行，窗=04:30–05:30Z 另含窗前关键 witness）

| # | 时刻 (UTC) | 读者/轮次 | 读到的 host HEAD | 树（绝对/相对） | 证据 file:行（ref） |
|---|---|---|---|---|---|
| W0 | 10-16（窗前） | PR4 LaneC 独立审查 | **46a7f68b09**（且称"基线未动"） | 根共享检出（相对路径） | `evidence/alpha5/pr4/review-LaneC.md:42` @origin/master |
| W1 | 10-16 20:07:36（窗前） | kit re-reg 重跑（ptc-chain 引为 `kit-rerun-built`） | 无 head 行 | 未标注 | `evidence/alpha5/pr8/runner/runs/kit-rerun-built/rereg-window.json:2` @alpha5-ptc-chain |
| W2 | 04:26:37（窗外前） | W7M writer probe-M-13 LIVE | （runner 行无 head 自证） | `.worktrees/a5-w7m-kit` 自身树（04:01:54 clone @639ed，reflog） | `evidence/alpha5/pr8/probes/runs/w7m-probe-M-13-LIVE.log:1` @alpha5-w7m-kit |
| W3 | 04:40:37 | **W7M review 复跑** kit 起 | **639ed01539**（console 印 host 身份） | `a5w7m-rev-w7m`（rsync 自 `a5-w7m-kit`，SRC 于 setup 打印 639ed+porcelain 0） | `evidence/alpha5/wiring/w7m/rev-rerun-GREEN-console.log:1`；`rev-reviewer-env-setup.sh:3,9` + `rev-reviewer-env-setup.log:2-3` @alpha5-w7m-kit |
| W4 | 04:40:40 | 同上 M0b（**机器实测**） | `head=639ed01539 porcelain=0` | 同上 | `rev-rerun-GREEN-console.log:3` @alpha5-w7m-kit |
| W5 | 04:41:04 | W7M rev W7 复跑 receipt | `639ed…` @`…/a5w7m-rev-w7m/tests/deepseek-harness-test-use` porcelain-clean | 同上 | `rev-w7-w7rerun/run-receipt.md:4` @alpha5-w7m-kit |
| W6 | 04:40:41 | **C-08 ungated LIVE**（机器实测 L-C08-PIN） | `head=639ed01539 porcelain=0` | `.worktrees/alpha5-gap-c08/tests/deepseek-harness-test-use` | `evidence/alpha5/wiring/c08/C08-RED-UNGATED.log:2` @alpha5-gap-c08 |
| W7 | 04:40:50 | **C-08 gated LIVE**（同上） | `head=639ed01539 porcelain=0` | 同上 | `C08-GATED-GREEN.log:2` @alpha5-gap-c08 |
| W8 | 04:42:34 | **C-04/05 gated LIVE**（机器实测 L-C45-PIN） | `head=639ed01539 porcelain=0` | `.worktrees/a5-w8/tests/deepseek-harness-test-use` | `wiring/c0405/runs/gated-2026-10-17T04-42-34Z/run-receipt.md:2,8` @alpha5-gap-c0405 |
| W9 | 04:42:37 / 04:42:46 | probes c08-post-M-05 / a5c45-post-M-04（grep/receipt 级，无 boot） | 无 host 行（断言读 04:40–04:42 已自证 receipt） | lane 源 grep | `pr8/probes/runs/c08-post-M-05.log:1`、`a5c45-post-M-04.log:1` @对应分支 |
| W10 | 04:44:22→04:51:11 | **census ×2 + comparison**（root 全套件） | 无 host 自证；测试路径全部在 `.worktrees/a5-glue/packages/`（进程内，host-independent） | n/a | `evidence/a4-pr7/ci-gate/scratch/census-20261017T044422Z-2-{1,2}.json`、`census-comparison-20261017T045111Z-3.json` @origin/master |
| W11 | 04:48:52 | W7M reviewer runner-matrix 复跑（grep 级） | 无 host 行（同 session 同树由 W4 于 04:40:40 覆盖） | `a5w7m-rev-w7m` | `rev-runner-rerun-reviewer.log:1-2` @alpha5-w7m-kit |
| W12 | **05:02:31** | **L1-PoC detach 共享树 → 639ed01539** | 639ed01539（瞬时） | **根共享检出** | reflog §2；披露 `c12-l1/README.md:37` @alpha5-c12-l1-poc |
| W13 | **05:03:40** | **L1-PoC 复原共享树 → 46a7f68b09** | 46a7f68b09（=发现态，正确复原） | **根共享检出** | reflog §2 |
| W14 | 05:05:53 | **W-PTC-C2 compose LIVE**（机器实测 P-PIN；runner 读 `tests/paths.mjs` pin 并实测 HEAD，`run-a5ptc2-compose.mjs:38,54,155-157`） | `head=639ed01539 porcelain=true` | `.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use` | `w-ptc-c2/runs/compose-2026-10-17T05-05-53Z/criteria.json:6-9` @alpha5-ptc-chain |
| W15 | 05:07:40 | probe-M-08（compose 链的探针行；receipt host 字段为文字主张"@639ed01539 shared built tree porcelain 0 pre/post"，实测由同 session W14 覆盖） | （主张，无本行实测） | 同上（主张） | `pr8/probes/runs/w-ptc-c2-probe-M-08.log:1`、`pr8/probes/receipts/M-08.receipt.json:4` @alpha5-ptc-chain |
| W16 | 05:08:09 | **ptc-chain 05:07/05:08 canonical matrix 轮** | **无 host-HEAD 自证**；log:24 含主张"本机已按 §2 链构建 0.2.0-rc.2（porcelain 0）"（相对路径 `tests/deepseek-harness-test-use`，repo_root=`.worktrees/alpha5-ptc-chain`）；host 依赖钩 = NOT_RUN（拒伪造 PASS） | `.worktrees/alpha5-ptc-chain/tests/deepseek-harness-test-use`（未被实测） | `pr8/runner/runs/matrix-run-2026-10-17T05-08-09-793Z.{json:21,350,648; log:24,32,45}` @alpha5-ptc-chain |
| W17 | 05:08:04–05:13:32 | **L1 PoC LIVE ×4**（05:08:04 RED、05:10:31/05:12:14/05:13:32 GREEN；C01-PIN 机器实测） | `HEAD==paths.mjs baseline, porcelain 0` @ upgrade 树 | `.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use` | `c12-l1/runs-console-run2.log:2`、`c12-l1/receipt.json:10-13,29-33` @alpha5-c12-l1-poc |
| W18 | ~05:08:59 | W7M2 coverage-gate re-derivation（零端口、进程内；其 worktree 树为 05:08:59 全新 clone @639ed from 本地 fork，reflog 直证） | 无 host 自证（未起 host） | `a5-w7m2-covgate/tests/deepseek-harness-test-use`（未用） | `wiring/w7m/rev-coverage-gate-rederivation.txt:1-2` @alpha5-w7m-kit + 现场 reflog |
| W19 | ~05:16:31 | **W-PTC-C2 reviewer 复跑 LIVE**（P-PIN 机器实测） | `head=639ed01539 porcelain=true` | `.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use` | `w-ptc-c2/review-rerun-console.log:2` @alpha5-ptc-chain |
| W20 | 05:16:21 | **C-04/05 rebase 复验** probe（grep/receipt 级，无 boot；断言引用 W8 已自证 receipt） | 无 host 行 | lane 源 grep + W8 receipt | `pr8/probes/runs/a5c45-rebase-M-04.log:1`（M-05 同） @alpha5-gap-c0405 |

（c12-brief 05:23 / lsp-rulings 05:02 = 纯 docs 分支，无 run；live 轮自证 `head=639ed01539 … at .worktrees/dsh-020rc2-upgrade/…` 属 10-16 夜间，窗前。）

## 4. 受影响 run 集与身份核对（②）

共享根树在窗内的读者集 = **∅**：窗内 19 个 run/复跑中，所有 LIVE（起 host）轮的自证行全部指向升级树或其克隆/rsync/symlink 衍生物，**没有一个以相对路径解析到根共享检出**；69 s detach 窗（05:02:31–05:03:40）内正在执行的其他 worker run（W14 compose 于 05:05:53 起、W16/W17 于 05:08 起）均在复原之后才开始且用独立树。**结论：无 run 依赖共享根树构建；"受影响 run"（按"依赖共享树构建且窗内运行"定义）= 0。**

逐轮核对"日志内 host 身份记录 == 其宣称 pin（IF-4 639ed01539）"：

| 轮次（窗内） | 宣称 pin | 实测记录 | 判定 |
|---|---|---|---|
| C-08 ungated/gated（04:40:41/04:40:50，W6/W7） | 639ed01539 | head=639ed01539 porcelain=0（自身 worktree 树，机器实测） | ✅ 一致 |
| C-04/05 gated（04:42:34，W8） | 639ed01539 | head=639ed01539 porcelain=0（a5-w8 树） | ✅ 一致 |
| W7M review 复跑（04:40:37–04:48:52，W3–W5/W11） | 639ed01539 | head=639ed01539 porcelain=0（rev 树；setup 源树亦实测） | ✅ 一致 |
| W-PTC-C2 compose + review 复跑（05:05:53/05:16:31，W14/W19） | 639ed01539 | head=639ed01539 porcelain=true（升级树，runner 现测） | ✅ 一致 |
| L1 PoC ×4（05:08–05:13，W17） | 639ed01539 | C01-PIN 实测（升级树） | ✅ 一致（其共享树操作已披露且复原正确） |
| ptc-chain canonical matrix 轮（05:08:09，W16） | 639ed01539（IF-4 口径） | **本 run 无实测行**；主张句无来源标注 | ⚠️ 未自证（→T1） |
| census ×2 + comparison（04:44/04:51，W10） | （无 host 宣称） | 无 host 行；全腿 in-process | ✅ host-independent（→T3 note） |
| rebase 复验 probes（05:16:21，W20） | （引用 04:42 已自证 receipt） | 无本 run host 行 | ✅ 派生自证（→T2 note） |
| covgate re-derivation（~05:09，W18） | （无 host 宣称） | 零端口进程内 | ✅ host-independent |
| c08 matrix rerun（04:44:23） | — | host 钩 NOT_RUN×2（实测于 json） | ✅ host-independent |

## 5. 需重测清单（③；只列不改结果）

| # | run | 缺什么 | 风险评级 | 建议复测动作 |
|---|---|---|---|---|
| **T1** | **ptc-chain canonical matrix 轮 05:08:09**（`alpha5-ptc-chain` `pr8/runner/runs/matrix-run-2026-10-17T05-08-09-793Z`，含 log:24 "本机已按 §2 链构建 0.2.0-rc.2（porcelain 0）"主张与 W15 receipt 的 "porcelain 0 pre/post" 主张） | 本 run 无任何 `head=` 机器实测行；其 host 依赖钩虽 NOT_RUN，但主张句无出处树；同 session P-PIN 覆盖的是**另一棵树**（dsh-020rc2-upgrade），非 matrix repo_root 下的相对路径树 | **中低**（判定不依赖 host 读数，主张未实测） | 在该 worktree（或等价重建）复跑 matrix 轮，令 runner 打印 `head=<sha> porcelain=<n> at <abs>` 或把主张句改为带出处的实测行 |
| T2 | C-04/05 rebase 复验 probes 05:16:21（`a5c45-rebase-M-04/05.log`） | probe 头无 `host=none` 声明（结论派生自 04:42:34 已实测 receipt，链完整） | 低 | probe 日志头部固定打印 host 面（boot 或不 boot），消除口径歧义 |
| T3 | census 04:44:22 ×2 + comparison 04:51:11（a5-glue） | census 头无 test-use HEAD 行（腿全 in-process，实测无 test-use 路径） | 低 | census 头部打印 `test-use head=` 或显式 `host: none` |
| T4 | kit-rerun-built 引文（W1，10-16 20:07Z）+ W15 receipt 静态 host 串 | 引文自身无 head 行；receipt host 字段是模板主张非读数 | 低 | receipt 生成器把 `rev-parse HEAD` 读数写入字段 |

（窗内其余 run 均有本 run 内嵌机器实测自证行，不在清单。）

## 6. 根因与新规建议（④；与 IF-4 文本衔接）

**根因**：IF-4 把宿主写成仓库相对路径（"`tests/deepseek-harness-test-use` @639ed01539, read-only reuse"），而实际执行中该名字在不同 worktree 解析到**不同的树**（升级树 clone 衍生物 / symlink / 根共享检出），三者身份不同代（639ed vs 46a7 vs 混合构建态）。`SESSION_ROUTER_LOG.md:5138` 与 `review-LaneC.md:42` 各错认一次即生于这个歧义面。

**新规建议（IF-4a，接 IF-4 之后生效）**：

> **IF-4a（pin 不同的实验禁止共树）**：任何与 `tests/paths.mjs` 当前 `TEST_USE_BASELINE_SHA` pin 不同的实验，**必须**使用独立 host worktree（独立 clone/rsync 副本，detached @目标 pin，起停前后各实测并打印 `head=<sha> porcelain=<n> at <绝对路径>`），或复用同一固定只读构建树（登记绝对路径，如 `.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use`）；**禁止**为改 pin 而 detach/checkout 共享 `tests/deepseek-harness-test-use`，且任何 run 证据中的 host 身份主张必须由该 run 自身的机器实测行（含绝对路径）承载——IF-4 的"pinned pristine、read-only、porcelain 前后=0"仅对有该行所指的树成立。既有 IF-4 文本（`evidence/alpha5/w4/run-w4.mjs:7`、`wiring/w5/README.md:4`、`wiring/we2/README.md:4`）自此以"实测行所指树"为宿主解释域；本建议不修改既有裁决。

## 7. 审计留痕（只读）

- 读取的 reflog（全部只读）：根共享检出 + `.worktrees/{dsh-020rc2-upgrade, a5-glue, a5-pr1, a5-w7m-kit, a5w7m-rev-w7m, a5-w7m2-covgate, exp-alpha5-poc-20261016}` 各 test-use 树；symlink 两枚（`a5c08-rev-c08`、`alpha5-gap-c0405` → dsh-020rc2-upgrade 树）仅 `readlink`。
- 未对任何 test-use 检出、共享树、`:3080`/`:3180`、homes 执行任何写操作；本文件与 branch push 为本轮唯一产出。
- 证据行号以各 ref 的 committed 文件为准；`@branch` 标注 = 该内容所在分支（部分窗内件已随 master 合并，路径相同）。
